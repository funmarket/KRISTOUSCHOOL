import React from 'react';
import { pickText } from '../../../i18n/homepages';
import {
  CANONICAL_ROLES,
  type GovernanceAccountRecord,
  type GovernanceLifecycleDecision,
} from '../../../lib/accountGovernance';
import type { AccountApprovalStatus, AccountRole, Language } from '../../../types';
import { ROLE_LABELS, STATUS_BADGE_STYLES, STATUS_LABELS } from './governanceDisplayConfig';

export interface GovernanceUserDirectorySectionProps {
  language: Language;
  directoryItems: GovernanceAccountRecord[];
  directoryTotal: number;
  directorySearch: string;
  setDirectorySearch: React.Dispatch<React.SetStateAction<string>>;
  directoryStatusFilter: AccountApprovalStatus | 'ALL';
  setDirectoryStatusFilter: React.Dispatch<React.SetStateAction<AccountApprovalStatus | 'ALL'>>;
  directoryRoleFilter: AccountRole | 'ALL';
  setDirectoryRoleFilter: React.Dispatch<React.SetStateAction<AccountRole | 'ALL'>>;
  directoryPage: number;
  setDirectoryPage: React.Dispatch<React.SetStateAction<number>>;
  loadingDirectory: boolean;
  reasonsByTarget: Record<string, string>;
  setReasonsByTarget: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submittingTargetId: string | null;
  loadingDetailId: string | null;
  handleInspectAccountDetail: (userId: string) => Promise<void>;
  handleReviewDecision: (
    account: GovernanceAccountRecord,
    decision: GovernanceLifecycleDecision,
  ) => Promise<void>;
}

export const GovernanceUserDirectorySection: React.FC<GovernanceUserDirectorySectionProps> = ({
  language,
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
  reasonsByTarget,
  setReasonsByTarget,
  submittingTargetId,
  loadingDetailId,
  handleInspectAccountDetail,
  handleReviewDecision,
}) => {
  return (
    <div className="mt-5 space-y-4" data-testid="gov-section-user-directory">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={directorySearch}
          onChange={(e) => {
            setDirectorySearch(e.target.value);
            setDirectoryPage(1);
          }}
          placeholder={pickText(
            {
              ar: 'بحث في دليل الحسابات (الاسم، اسم المستخدم، البريد)...',
              fr: 'Rechercher dans le répertoire (nom, identifiant, e-mail)...',
              en: 'Search directory by name, username, or email...',
              es: 'Buscar en el directorio por nombre, usuario o correo...',
              de: 'Verzeichnis nach Name, Benutzername oder E-Mail durchsuchen...',
              pt: 'Pesquisar no diretório por nome, utilizador ou e-mail...',
            },
            language,
          )}
          className="flex-1 min-w-[200px] rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3.5 py-2 text-xs sm:text-sm"
        />
        <select
          value={directoryStatusFilter}
          onChange={(e) => {
            setDirectoryStatusFilter(e.target.value as AccountApprovalStatus | 'ALL');
            setDirectoryPage(1);
          }}
          aria-label="Filter directory by account status"
          className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-bold"
        >
          <option value="ALL">
            {pickText({ ar: 'كل الحالات', fr: 'Tous les statuts', en: 'All statuses', es: 'Todos los estados', de: 'Alle Status', pt: 'Todos os estados' }, language)}
          </option>
          {(['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED'] as AccountApprovalStatus[]).map(
            (st) => (
              <option key={st} value={st}>
                {pickText(STATUS_LABELS[st], language)}
              </option>
            ),
          )}
        </select>
        <select
          value={directoryRoleFilter}
          onChange={(e) => {
            setDirectoryRoleFilter(e.target.value as AccountRole | 'ALL');
            setDirectoryPage(1);
          }}
          aria-label="Filter directory by role"
          className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-bold"
        >
          <option value="ALL">
            {pickText({ ar: 'كل الأدوار الـ 7', fr: 'Les 7 rôles', en: 'All 7 roles', es: 'Los 7 roles', de: 'Alle 7 Rollen', pt: 'Todas as 7 funções' }, language)}
          </option>
          {CANONICAL_ROLES.map((r: AccountRole) => (
            <option key={r} value={r}>
              {pickText(ROLE_LABELS[r], language)} ({r})
            </option>
          ))}
        </select>
      </div>

      {loadingDirectory ? (
        <div className="py-6 text-center text-xs font-bold text-slate-500">
          {pickText(
            {
              ar: 'جاري تحميل دليل الحسابات...',
              fr: 'Chargement du répertoire...',
              en: 'Loading account directory...',
              es: 'Cargando directorio de cuentas...',
              de: 'Kontoverzeichnis wird geladen...',
              pt: 'A carregar diretório de contas...',
            },
            language,
          )}
        </div>
      ) : directoryItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-6 text-center text-xs sm:text-sm text-slate-500">
          {pickText(
            {
              ar: 'لا توجد حسابات مطابقة.',
              fr: 'Aucun compte correspondant.',
              en: 'No matching accounts found.',
              es: 'No se encontraron cuentas coincidentes.',
              de: 'Keine passenden Konten gefunden.',
              pt: 'Nenhuma conta correspondente encontrada.',
            },
            language,
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {directoryItems.map((acct) => {
            const effectiveRole = acct.activeRoles[0] || acct.requestedRole;
            const reasonVal = reasonsByTarget[acct.id] || '';
            const isBusy = submittingTargetId === acct.id;

            return (
              <div
                key={acct.id}
                data-testid={`directory-account-row-${acct.id}`}
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm">{acct.fullName}</span>
                      <span className="text-xs font-mono text-slate-500">@{acct.username}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_BADGE_STYLES[acct.accountStatus]}`}
                      >
                        {pickText(STATUS_LABELS[acct.accountStatus], language)}
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-bold">
                        {pickText(ROLE_LABELS[effectiveRole], language)} ({effectiveRole})
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      ID: <code className="font-mono">{acct.id}</code> • v{acct.governanceVersion} •{' '}
                      {acct.email || '—'}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={loadingDetailId === acct.id}
                    onClick={() => void handleInspectAccountDetail(acct.id)}
                    className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-900"
                  >
                    {pickText(
                      {
                        ar: 'التفاصيل وسجل التدقيق',
                        fr: 'Détails & Audit',
                        en: 'Details & Audit Trail',
                        es: 'Detalles y auditoría',
                        de: 'Details & Prüfprotokoll',
                        pt: 'Detalhes e auditoria',
                      },
                      language,
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                  <input
                    type="text"
                    value={reasonVal}
                    onChange={(e) =>
                      setReasonsByTarget((prev) => ({
                        ...prev,
                        [acct.id]: e.target.value,
                      }))
                    }
                    placeholder={pickText(
                      {
                        ar: 'سبب تغيير الحالة (إلزامي للتدقيق)...',
                        fr: 'Motif du changement de statut (obligatoire)...',
                        en: 'Audit reason for lifecycle change (required)...',
                        es: 'Motivo de auditoría para el cambio de estado (obligatorio)...',
                        de: 'Prüfungsgrund für Statusänderung (erforderlich)...',
                        pt: 'Motivo de auditoria para alteração de estado (obrigatório)...',
                      },
                      language,
                    )}
                    className="flex-1 min-w-[200px] rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs"
                  />

                  {acct.accountStatus === 'APPROVED' && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleReviewDecision(acct, 'SUSPEND')}
                        className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-orange-700 disabled:opacity-50"
                      >
                        {pickText(
                          { ar: 'تعليق مؤقت (SUSPEND)', fr: 'Suspendre', en: 'Suspend', es: 'Suspender', de: 'Sperren', pt: 'Suspender' },
                          language,
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleReviewDecision(acct, 'REVOKE')}
                        className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {pickText(
                          { ar: 'إلغاء نهائي (REVOKE)', fr: 'Révoquer', en: 'Revoke', es: 'Revocar', de: 'Widerrufen', pt: 'Revogar' },
                          language,
                        )}
                      </button>
                    </>
                  )}

                  {(acct.accountStatus === 'SUSPENDED' ||
                    acct.accountStatus === 'REVOKED' ||
                    acct.accountStatus === 'REJECTED') && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleReviewDecision(acct, 'REACTIVATE')}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {pickText(
                        { ar: 'إعادة تفعيل (REACTIVATE)', fr: 'Réactiver', en: 'Reactivate', es: 'Reactivar', de: 'Reaktivieren', pt: 'Reativar' },
                        language,
                      )}
                    </button>
                  )}

                  {acct.accountStatus === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleReviewDecision(acct, 'APPROVE')}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {pickText(
                          { ar: 'اعتماد (APPROVE)', fr: 'Approuver', en: 'Approve', es: 'Aprobar', de: 'Genehmigen', pt: 'Aprovar' },
                          language,
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleReviewDecision(acct, 'REJECT')}
                        className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {pickText({ ar: 'رفض (REJECT)', fr: 'Refuser', en: 'Reject', es: 'Rechazar', de: 'Ablehnen', pt: 'Rejeitar' }, language)}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
        <span>
          {pickText(
            { ar: 'إجمالي الحسابات:', fr: 'Total des comptes :', en: 'Total accounts:', es: 'Total de cuentas:', de: 'Konten gesamt:', pt: 'Total de contas:' },
            language,
          )}{' '}
          {directoryTotal}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={directoryPage <= 1}
            onClick={() => setDirectoryPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-2.5 py-1 disabled:opacity-40"
          >
            ←
          </button>
          <span>Page {directoryPage}</span>
          <button
            type="button"
            disabled={directoryPage * 12 >= directoryTotal}
            onClick={() => setDirectoryPage((p) => p + 1)}
            className="rounded-lg border px-2.5 py-1 disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
};
