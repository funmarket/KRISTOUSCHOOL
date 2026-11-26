import React from 'react';
import { pickText } from '../../i18n/homepages';
import {
  appointPrivilegedRole,
  type GovernanceActorScope,
  listAccountDirectory,
  listPendingAccounts,
  reviewAccountLifecycle,
} from '../../lib/accountGovernance';
import { GovernanceAuditLogDrawer } from './owner-governance/GovernanceAuditLogDrawer';
import { GovernanceControlCenterSection } from './owner-governance/GovernanceControlCenterSection';
import { ERROR_MESSAGES } from './owner-governance/governanceDisplayConfig';
import { GovernanceUserDirectorySection } from './owner-governance/GovernanceUserDirectorySection';
import { ManagerCapabilityDelegationSection } from './owner-governance/ManagerCapabilityDelegationSection';
import { PendingAccountApprovalsSection } from './owner-governance/PendingAccountApprovalsSection';
import { PrivilegedRoleGovernanceSection } from './owner-governance/PrivilegedRoleGovernanceSection';
import { useOwnerGovernanceController } from './owner-governance/useOwnerGovernanceController';
import { EmptyFeatureState } from './shared/EmptyFeatureState';

export type OwnerGovernanceSection =
  | 'control-center'
  | 'pending-approvals'
  | 'user-directory'
  | 'manager-delegation'
  | 'role-governance';

export interface OwnerGovernanceWorkspaceProps {
  activeSection: OwnerGovernanceSection;
  onSelectSection: (section: OwnerGovernanceSection) => void;
  onClose: () => void;
  onScopeVerified?: (available: boolean, scope: GovernanceActorScope | null) => void;
  ordinaryReviewOnly?: boolean;
}

export const OwnerGovernanceWorkspace: React.FC<OwnerGovernanceWorkspaceProps> = ({
  activeSection,
  onSelectSection,
  onClose,
  onScopeVerified,
  ordinaryReviewOnly = false,
}) => {
  const {
    language,
    theme,
    operationalCounts,
    loadingScope,
    scope,
    scopeError,
    sectionTabs,
    assignableRoles,
    pendingItems,
    pendingTotal,
    pendingSearch,
    setPendingSearch,
    pendingRoleFilter,
    setPendingRoleFilter,
    pendingPage,
    setPendingPage,
    loadingPending,
    directoryItems,
    directoryTotal,
    directorySearch,
    setDirectorySearch,
    directoryStatusFilter,
    setDirectoryStatusFilter,
    directoryRoleFilter,
    setDirectoryRoleFilter,
    directoryPage,
    setDirectoryPage,
    loadingDirectory,
    managersList,
    managerGrants,
    loadingDelegation,
    delegationReason,
    setDelegationReason,
    submittingCapKey,
    selectedRolesByTarget,
    setSelectedRolesByTarget,
    reasonsByTarget,
    setReasonsByTarget,
    submittingTargetId,
    selectedDetail,
    setSelectedDetail,
    loadingDetailId,
    appointTargetId,
    setAppointTargetId,
    appointExpectedVersion,
    setAppointExpectedVersion,
    appointRole,
    setAppointRole,
    appointAction,
    setAppointAction,
    appointReason,
    setAppointReason,
    appointConfirmed,
    setAppointConfirmed,
    submittingAppoint,
    feedback,
    loadScope,
    loadPending,
    loadDirectory,
    loadManagerDelegation,
    handleReviewDecision,
    handleInspectAccountDetail,
    handlePrivilegedAppointmentSubmit,
    handleToggleManagerCapability,
  } = useOwnerGovernanceController({
    activeSection,
    onScopeVerified,
    ordinaryReviewOnly,
    services: {
      listPendingAccounts,
      listAccountDirectory,
      reviewAccountLifecycle,
      appointPrivilegedRole,
    },
  });

  if (!loadingScope && scopeError === 'backend_unavailable') {
    return (
      <div data-testid="owner-governance-blocked-backend" className="mt-4">
        <EmptyFeatureState
          state="BLOCKED_BACKEND"
          title={pickText(
            {
              ar: 'حوكمة الحسابات بانتظار نشر عقد الخادم (Supabase Migration)',
              fr: 'Gouvernance des comptes en attente du déploiement Supabase',
              en: 'Account Governance Awaiting Verified Supabase Migration Deployment',
              es: 'Gobernanza de cuentas en espera del despliegue de migración Supabase',
              de: 'Kontoverwaltung wartet auf verifizierte Supabase-Migration',
              pt: 'Governação de contas a aguardar implementação da migração Supabase',
            },
            language,
          )}
          description={pickText(ERROR_MESSAGES.backend_unavailable, language)}
          actionLabel={pickText(
            {
              ar: 'إعادة فحص اتصال الخادم',
              fr: 'Réessayer la vérification serveur',
              en: 'Retry server verification',
              es: 'Reintentar verificación del servidor',
              de: 'Serverprüfung wiederholen',
              pt: 'Repetir verificação do servidor',
            },
            language,
          )}
          onAction={() => void loadScope()}
          onClose={onClose}
        />
      </div>
    );
  }

  if (!loadingScope && scopeError) {
    return (
      <div data-testid="owner-governance-unauthorized" className="mt-4">
        <EmptyFeatureState
          state="UNAUTHORIZED"
          title={pickText(
            {
              ar: 'غير مصرح بالوصول إلى وحدة الحوكمة',
              fr: 'Accès gouvernance refusé par le serveur',
              en: 'Server Denied Account Governance Access',
              es: 'El servidor denegó el acceso a gobernanza',
              de: 'Server verweigert Zugriff auf Kontoverwaltung',
              pt: 'O servidor recusou o acesso à governação',
            },
            language,
          )}
          description={pickText(
            ERROR_MESSAGES[scopeError] || ERROR_MESSAGES.insufficient_governance_authority,
            language,
          )}
          onClose={onClose}
        />
      </div>
    );
  }

  const cardSurfaceClass =
    theme === 'pitch-black'
      ? 'bg-[#0C0C0C] border-zinc-800 text-zinc-100'
      : 'bg-white border-slate-200 text-slate-900';

  return (
    <section
      data-testid={`owner-governance-workspace-${activeSection}`}
      aria-label="Account Governance and Access Control Workspace"
      className={`mt-5 rounded-3xl border p-4 sm:p-6 shadow-sm transition-all ${cardSurfaceClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-zinc-800 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
            🔒{' '}
            {pickText(
              {
                ar: 'عقد حوكمة الخادم متصل (Supabase RPC)',
                fr: 'Contrat RPC Supabase vérifié',
                en: 'Server-Verified Supabase Governance Contract',
                es: 'Contrato de gobernanza Supabase verificado',
                de: 'Servergeprüfter Supabase-Governance-Vertrag',
                pt: 'Contrato de governação Supabase verificado',
              },
              language,
            )}
          </span>
          <h2 className="mt-1 text-lg sm:text-xl font-black">
            {pickText(
              {
                ar: 'حوكمة الحسابات والتحكم في الصلاحيات — مدرسة كريستو',
                fr: 'Gouvernance des comptes & contrôle d’accès — KRISTOU School',
                en: 'KRISTOU School — Account Governance & Access Control',
                es: 'KRISTOU School — Gobernanza de cuentas y control de acceso',
                de: 'KRISTOU School — Kontoverwaltung & Zugriffskontrolle',
                pt: 'KRISTOU School — Governação de contas e controlo de acesso',
              },
              language,
            )}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadScope();
              void loadPending();
              void loadDirectory();
              if (!ordinaryReviewOnly) {
                void loadManagerDelegation();
              }
            }}
            className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-900"
          >
            ↻ {pickText({ ar: 'تحديث', fr: 'Actualiser', en: 'Refresh', es: 'Actualizar', de: 'Aktualisieren', pt: 'Atualizar' }, language)}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-900"
          >
            ✕ {pickText({ ar: 'إغلاق', fr: 'Fermer', en: 'Close', es: 'Cerrar', de: 'Schließen', pt: 'Fechar' }, language)}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {sectionTabs.map((tab) => {
          const isActive = activeSection === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`gov-tab-${tab.key}`}
              onClick={() => onSelectSection(tab.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors ${
                isActive
                  ? 'bg-[#0D8AE8] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {pickText(tab.label, language)}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          role="alert"
          className={`mt-4 rounded-2xl border px-4 py-3 text-xs sm:text-sm font-bold ${
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {loadingScope ? (
        <div className="py-8 text-center text-sm font-bold text-slate-500">
          {pickText(
            {
              ar: 'جاري التحقق من صلاحيات الحوكمة عبر الخادم...',
              fr: 'Vérification serveur des droits de gouvernance...',
              en: 'Verifying governance authority with server...',
              es: 'Verificando autoridad de gobernanza en el servidor...',
              de: 'Governance-Berechtigungen werden vom Server geprüft...',
              pt: 'A verificar autoridade de governação no servidor...',
            },
            language,
          )}
        </div>
      ) : (
        <>
          {activeSection === 'control-center' && scope && (
            <GovernanceControlCenterSection
              scope={scope}
              operationalCounts={operationalCounts}
              language={language}
              onSelectSection={onSelectSection}
            />
          )}

          {activeSection === 'pending-approvals' && (
            <PendingAccountApprovalsSection
              language={language}
              pendingItems={pendingItems}
              pendingTotal={pendingTotal}
              pendingSearch={pendingSearch}
              setPendingSearch={setPendingSearch}
              pendingRoleFilter={pendingRoleFilter}
              setPendingRoleFilter={setPendingRoleFilter}
              pendingPage={pendingPage}
              setPendingPage={setPendingPage}
              loadingPending={loadingPending}
              assignableRoles={assignableRoles}
              selectedRolesByTarget={selectedRolesByTarget}
              setSelectedRolesByTarget={setSelectedRolesByTarget}
              reasonsByTarget={reasonsByTarget}
              setReasonsByTarget={setReasonsByTarget}
              submittingTargetId={submittingTargetId}
              handleInspectAccountDetail={handleInspectAccountDetail}
              handleReviewDecision={handleReviewDecision}
            />
          )}

          {activeSection === 'user-directory' && (
            <GovernanceUserDirectorySection
              language={language}
              directoryItems={directoryItems}
              directoryTotal={directoryTotal}
              directorySearch={directorySearch}
              setDirectorySearch={setDirectorySearch}
              directoryStatusFilter={directoryStatusFilter}
              setDirectoryStatusFilter={setDirectoryStatusFilter}
              directoryRoleFilter={directoryRoleFilter}
              setDirectoryRoleFilter={setDirectoryRoleFilter}
              directoryPage={directoryPage}
              setDirectoryPage={setDirectoryPage}
              loadingDirectory={loadingDirectory}
              reasonsByTarget={reasonsByTarget}
              setReasonsByTarget={setReasonsByTarget}
              submittingTargetId={submittingTargetId}
              loadingDetailId={loadingDetailId}
              handleInspectAccountDetail={handleInspectAccountDetail}
              handleReviewDecision={handleReviewDecision}
            />
          )}

          {activeSection === 'manager-delegation' && (
            <ManagerCapabilityDelegationSection
              language={language}
              ordinaryReviewOnly={ordinaryReviewOnly}
              scope={scope}
              delegationReason={delegationReason}
              setDelegationReason={setDelegationReason}
              loadingDelegation={loadingDelegation}
              managersList={managersList}
              managerGrants={managerGrants}
              submittingCapKey={submittingCapKey}
              handleToggleManagerCapability={handleToggleManagerCapability}
            />
          )}

          {activeSection === 'role-governance' && (
            <PrivilegedRoleGovernanceSection
              language={language}
              ordinaryReviewOnly={ordinaryReviewOnly}
              scope={scope}
              directoryItems={directoryItems}
              appointTargetId={appointTargetId}
              setAppointTargetId={setAppointTargetId}
              appointExpectedVersion={appointExpectedVersion}
              setAppointExpectedVersion={setAppointExpectedVersion}
              appointRole={appointRole}
              setAppointRole={setAppointRole}
              appointAction={appointAction}
              setAppointAction={setAppointAction}
              appointReason={appointReason}
              setAppointReason={setAppointReason}
              appointConfirmed={appointConfirmed}
              setAppointConfirmed={setAppointConfirmed}
              submittingAppoint={submittingAppoint}
              handlePrivilegedAppointmentSubmit={handlePrivilegedAppointmentSubmit}
            />
          )}

          <GovernanceAuditLogDrawer
            language={language}
            selectedDetail={selectedDetail}
            onClose={() => setSelectedDetail(null)}
          />
        </>
      )}
    </section>
  );
};
