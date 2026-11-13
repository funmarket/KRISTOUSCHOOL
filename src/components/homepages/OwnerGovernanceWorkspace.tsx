import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AccountApprovalStatus, AccountRole } from '../../types';
import {
  appointPrivilegedRole,
  CANONICAL_ROLES,
  fetchGovernanceActorScope,
  getAccountGovernanceDetail,
  GovernanceAccountDetail,
  GovernanceAccountRecord,
  GovernanceActorScope,
  GovernanceAuditLogEntry,
  GovernanceErrorCode,
  GovernanceLifecycleDecision,
  listAccountDirectory,
  listPendingAccounts,
  ORDINARY_ROLES,
  PRIVILEGED_ROLES,
  PrivilegedRole,
  reviewAccountLifecycle,
} from '../../lib/accountGovernance';
import { LocalizedText, pickText } from '../../i18n/homepages';
import { EmptyFeatureState } from './shared/EmptyFeatureState';

export type OwnerGovernanceSection =
  | 'control-center'
  | 'pending-approvals'
  | 'user-directory'
  | 'role-governance';

export interface OwnerGovernanceWorkspaceProps {
  activeSection: OwnerGovernanceSection;
  onSelectSection: (section: OwnerGovernanceSection) => void;
  onClose: () => void;
  onScopeVerified?: (available: boolean, scope: GovernanceActorScope | null) => void;
}

const ROLE_LABELS: Record<AccountRole, LocalizedText> = {
  APP_ADMIN: {
    ar: 'مالك المدرسة / المدير العام',
    fr: 'Propriétaire / Fondateur',
    en: 'School Owner / App Admin',
  },
  MANAGER: {
    ar: 'المدير المساعد / المسير',
    fr: 'Directeur adjoint / Manager',
    en: 'School Manager',
  },
  ADMINISTRATIVE_PERSONNEL: {
    ar: 'الإدارة المدرسية',
    fr: 'Personnel administratif',
    en: 'Administrative Personnel',
  },
  TEACHER: {
    ar: 'مربي / أستاذ',
    fr: 'Enseignant(e)',
    en: 'Teacher',
  },
  SCHOOL_STAFF: {
    ar: 'عون مدرسة',
    fr: 'Personnel scolaire',
    en: 'School Staff',
  },
  PARENT: {
    ar: 'ولي أمر',
    fr: 'Parent d’élève',
    en: 'Parent / Guardian',
  },
  STUDENT: {
    ar: 'تلميذ',
    fr: 'Élève',
    en: 'Student',
  },
};

const STATUS_BADGE_STYLES: Record<AccountApprovalStatus, string> = {
  APPROVED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  REJECTED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  SUSPENDED: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  REVOKED: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
};

const STATUS_LABELS: Record<AccountApprovalStatus, LocalizedText> = {
  APPROVED: { ar: 'معتمد (APPROVED)', fr: 'Approuvé (APPROVED)', en: 'Approved (APPROVED)' },
  PENDING: { ar: 'قيد المراجعة (PENDING)', fr: 'En attente (PENDING)', en: 'Pending (PENDING)' },
  REJECTED: { ar: 'مرفوض (REJECTED)', fr: 'Refusé (REJECTED)', en: 'Rejected (REJECTED)' },
  SUSPENDED: { ar: 'معلّق مؤقتاً (SUSPENDED)', fr: 'Suspendu (SUSPENDED)', en: 'Suspended (SUSPENDED)' },
  REVOKED: { ar: 'ملغى (REVOKED)', fr: 'Révoqué (REVOKED)', en: 'Revoked (REVOKED)' },
};

const ERROR_MESSAGES: Record<GovernanceErrorCode, LocalizedText> = {
  backend_unavailable: {
    ar: 'عقود الحوكمة في الخادم (Supabase RPC) غير منشورة أو غير متاحة حالياً. لا يتم تنفيذ أي موافقة وهمية في المتصفح.',
    fr: 'Les contrats RPC Supabase de gouvernance ne sont pas encore déployés ou joignables. Aucune approbation fictive n’est exécutée.',
    en: 'Verified Supabase governance RPC contracts are not deployed or reachable yet. No browser-side mock approvals are performed.',
  },
  actor_unauthenticated: {
    ar: 'يجب تسجيل الدخول بحساب معتمد لتنفيذ عمليات الحوكمة.',
    fr: 'Session authentifiée requise pour les opérations de gouvernance.',
    en: 'An authenticated session is required for governance operations.',
  },
  actor_not_approved: {
    ar: 'حسابك الحالي غير معتمد (PENDING / SUSPENDED / REVOKED) ولا يملك صلاحية الحوكمة.',
    fr: 'Votre compte n’est pas au statut APPROVED et ne peut pas exécuter d’actions de gouvernance.',
    en: 'Your account is not in APPROVED status and cannot perform governance actions.',
  },
  insufficient_governance_authority: {
    ar: 'دورك الحالي غير مخول للوصول إلى وحدة حوكمة الحسابات.',
    fr: 'Votre rôle actuel n’est pas autorisé à accéder à la gouvernance des comptes.',
    en: 'Your role is not authorized to access account governance.',
  },
  manager_delegation_required: {
    ar: 'يتطلب دور المدير المساعد (MANAGER) تفويضاً نشطاً (ACCOUNT_APPROVAL_REVIEW) من مالك المدرسة.',
    fr: 'Le rôle MANAGER nécessite une délégation active (ACCOUNT_APPROVAL_REVIEW) accordée par le Propriétaire.',
    en: 'MANAGER requires an active ACCOUNT_APPROVAL_REVIEW capability grant from the School Owner.',
  },
  self_governance_denied: {
    ar: 'يُمنع على الموظف الإداري أو المدير المفوض اعتماد أو تعديل حالة حسابه الشخصي.',
    fr: 'L’auto-approbation ou la modification de son propre statut est interdite.',
    en: 'Self-governance is denied: you cannot approve, suspend, revoke, or reactivate your own account.',
  },
  privileged_target_requires_owner: {
    ar: 'الحسابات ذات الأدوار العليا (APP_ADMIN / MANAGER) تخضع حصرياً لسلطة مالك المدرسة (APP_ADMIN).',
    fr: 'Les comptes privilégiés (APP_ADMIN / MANAGER) relèvent exclusivement du Propriétaire (APP_ADMIN).',
    en: 'Privileged accounts and roles (APP_ADMIN / MANAGER) require School Owner (APP_ADMIN) authority.',
  },
  owner_only_operation: {
    ar: 'تعيين أو سحب أدوار القيادة (APP_ADMIN / MANAGER) مقتصر حصرياً على مالك المدرسة (APP_ADMIN).',
    fr: 'La nomination ou révocation des rôles APP_ADMIN / MANAGER est réservée au Propriétaire (APP_ADMIN).',
    en: 'Appointing or revoking APP_ADMIN or MANAGER roles is restricted exclusively to the School Owner (APP_ADMIN).',
  },
  last_owner_protection: {
    ar: 'حماية المالك الأخير: لا يمكن تعليق أو إلغاء أو سحب صلاحية آخر مالك مدرسة نشط (APP_ADMIN).',
    fr: 'Protection du dernier Propriétaire : impossible de suspendre, révoquer ou retirer le dernier APP_ADMIN actif.',
    en: 'Last-Owner protection: cannot suspend, revoke, or remove the last active School Owner (APP_ADMIN).',
  },
  contact_not_confirmed: {
    ar: 'لا يمكن اعتماد هذا الحساب قبل تأكيد البريد الإلكتروني أو رقم الهاتف.',
    fr: 'Impossible d’approuver un compte avant la confirmation de l’e-mail ou du téléphone.',
    en: 'Cannot approve an account before email or phone confirmation is completed.',
  },
  invalid_transition: {
    ar: 'انتقال حالة الحساب غير صالح للحالة الحالية.',
    fr: 'Transition de statut invalide pour l’état actuel du compte.',
    en: 'Invalid account lifecycle transition for the current status.',
  },
  reason_required: {
    ar: 'يرجى إدخال سبب توثيقي واضح (3 إلى 500 حرف) لسجل التدقيق.',
    fr: 'Veuillez saisir un motif d’audit valide (3 à 500 caractères).',
    en: 'Please provide an audit reason between 3 and 500 characters.',
  },
  invalid_role: {
    ar: 'الدور المحدد غير صالح.',
    fr: 'Le rôle sélectionné est invalide.',
    en: 'The selected role is invalid.',
  },
  explicit_confirmation_required: {
    ar: 'يرجى تأكيد عملية التعيين أو السحب للدور القيادي.',
    fr: 'Veuillez cocher la confirmation explicite pour cette opération privilégiée.',
    en: 'Explicit confirmation is required for privileged role appointment or removal.',
  },
  target_not_found: {
    ar: 'لم يتم العثور على الحساب المستهدف.',
    fr: 'Compte cible introuvable.',
    en: 'Target account was not found.',
  },
  version_conflict: {
    ar: 'تعارض في النسخة: تم تعديل هذا الحساب من طرف مسؤول آخر. يرجى تحديث القائمة والمحاولة مجدداً.',
    fr: 'Conflit de version : ce compte a été modifié par un autre administrateur. Veuillez actualiser.',
    en: 'Version conflict: this account was modified by another actor. Please refresh and try again.',
  },
  governance_operation_failed: {
    ar: 'تعذر إتمام عملية الحوكمة عبر الخادم.',
    fr: 'Échec de l’opération de gouvernance côté serveur.',
    en: 'Server governance operation failed.',
  },
};

export const OwnerGovernanceWorkspace: React.FC<OwnerGovernanceWorkspaceProps> = ({
  activeSection,
  onSelectSection,
  onClose,
  onScopeVerified,
}) => {
  const { language, theme } = useApp();

  const [loadingScope, setLoadingScope] = useState<boolean>(true);
  const [scope, setScope] = useState<GovernanceActorScope | null>(null);
  const [scopeError, setScopeError] = useState<GovernanceErrorCode | null>(null);

  // Pending accounts state
  const [pendingItems, setPendingItems] = useState<GovernanceAccountRecord[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [pendingRoleFilter, setPendingRoleFilter] = useState<AccountRole | 'ALL'>('ALL');
  const [pendingPage, setPendingPage] = useState<number>(1);
  const [loadingPending, setLoadingPending] = useState<boolean>(false);

  // Directory state
  const [directoryItems, setDirectoryItems] = useState<GovernanceAccountRecord[]>([]);
  const [directoryTotal, setDirectoryTotal] = useState<number>(0);
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<AccountApprovalStatus | 'ALL'>('ALL');
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState<AccountRole | 'ALL'>('ALL');
  const [directoryPage, setDirectoryPage] = useState<number>(1);
  const [loadingDirectory, setLoadingDirectory] = useState<boolean>(false);

  // Per-row review inputs
  const [selectedRolesByTarget, setSelectedRolesByTarget] = useState<Record<string, AccountRole>>({});
  const [reasonsByTarget, setReasonsByTarget] = useState<Record<string, string>>({});
  const [submittingTargetId, setSubmittingTargetId] = useState<string | null>(null);

  // Account detail & audit drawer
  const [selectedDetail, setSelectedDetail] = useState<GovernanceAccountDetail | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // Privileged appointment form state
  const [appointTargetId, setAppointTargetId] = useState<string>('');
  const [appointExpectedVersion, setAppointExpectedVersion] = useState<number>(1);
  const [appointRole, setAppointRole] = useState<PrivilegedRole>('MANAGER');
  const [appointAction, setAppointAction] = useState<'GRANT' | 'REVOKE'>('GRANT');
  const [appointReason, setAppointReason] = useState<string>('');
  const [appointConfirmed, setAppointConfirmed] = useState<boolean>(false);
  const [submittingAppoint, setSubmittingAppoint] = useState<boolean>(false);

  // Action feedback banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadScope = useCallback(async () => {
    setLoadingScope(true);
    setScopeError(null);
    const result = await fetchGovernanceActorScope();
    if (!result.ok || !result.data) {
      const code: GovernanceErrorCode = result.errorCode ?? 'governance_operation_failed';
      setScope(null);
      setScopeError(code);
      onScopeVerified?.(false, null);
      setLoadingScope(false);
      return;
    }
    setScope(result.data);
    setScopeError(null);
    onScopeVerified?.(true, result.data);
    setLoadingScope(false);
  }, [onScopeVerified]);

  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    const limit = 10;
    const offset = (pendingPage - 1) * limit;
    const result = await listPendingAccounts({
      search: pendingSearch,
      requestedRole: pendingRoleFilter,
      limit,
      offset,
    });
    if (result.ok && result.data) {
      setPendingItems(result.data.items);
      setPendingTotal(result.data.totalCount);
    } else if (result.errorCode === 'backend_unavailable') {
      setScopeError('backend_unavailable');
    }
    setLoadingPending(false);
  }, [pendingSearch, pendingRoleFilter, pendingPage]);

  const loadDirectory = useCallback(async () => {
    setLoadingDirectory(true);
    const limit = 12;
    const offset = (directoryPage - 1) * limit;
    const result = await listAccountDirectory({
      search: directorySearch,
      status: directoryStatusFilter,
      role: directoryRoleFilter,
      limit,
      offset,
    });
    if (result.ok && result.data) {
      setDirectoryItems(result.data.items);
      setDirectoryTotal(result.data.totalCount);
    } else if (result.errorCode === 'backend_unavailable') {
      setScopeError('backend_unavailable');
    }
    setLoadingDirectory(false);
  }, [directorySearch, directoryStatusFilter, directoryRoleFilter, directoryPage]);

  useEffect(() => {
    void loadScope();
  }, [loadScope]);

  useEffect(() => {
    if (!scope || scopeError) return;
    if (activeSection === 'pending-approvals' || activeSection === 'control-center') {
      void loadPending();
    }
    if (activeSection === 'user-directory' || activeSection === 'role-governance') {
      void loadDirectory();
    }
  }, [activeSection, scope, scopeError, loadPending, loadDirectory]);

  const handleReviewDecision = async (
    account: GovernanceAccountRecord,
    decision: GovernanceLifecycleDecision,
  ) => {
    setFeedback(null);
    const reason = (reasonsByTarget[account.id] || '').trim();
    const assignedRole =
      selectedRolesByTarget[account.id] ||
      account.activeRoles[0] ||
      account.requestedRole;

    setSubmittingTargetId(account.id);
    const result = await reviewAccountLifecycle({
      targetUserId: account.id,
      decision,
      assignedRole,
      reason,
      expectedVersion: account.governanceVersion,
    });
    setSubmittingTargetId(null);

    if (!result.ok) {
      const code: GovernanceErrorCode = result.errorCode ?? 'governance_operation_failed';
      setFeedback({
        type: 'error',
        message: pickText(ERROR_MESSAGES[code] || ERROR_MESSAGES.governance_operation_failed, language),
      });
      return;
    }

    setFeedback({
      type: 'success',
      message: pickText(
        {
          ar: `تم تحديث حالة الحساب (${account.fullName}) إلى ${result.data?.accountStatus} وتوثيق العملية في سجل التدقيق.`,
          fr: `Statut du compte (${account.fullName}) mis à jour vers ${result.data?.accountStatus} avec trace d’audit.`,
          en: `Updated ${account.fullName} to ${result.data?.accountStatus} and recorded immutable audit log.`,
        },
        language,
      ),
    });

    setReasonsByTarget((prev) => ({ ...prev, [account.id]: '' }));
    await Promise.all([loadScope(), loadPending(), loadDirectory()]);
    if (selectedDetail?.account.id === account.id) {
      const detailRes = await getAccountGovernanceDetail(account.id);
      if (detailRes.ok && detailRes.data) {
        setSelectedDetail(detailRes.data);
      }
    }
  };

  const handleInspectAccountDetail = async (userId: string) => {
    setLoadingDetailId(userId);
    const result = await getAccountGovernanceDetail(userId);
    setLoadingDetailId(null);
    if (result.ok && result.data) {
      setSelectedDetail(result.data);
    } else {
      const code: GovernanceErrorCode = result.errorCode ?? 'governance_operation_failed';
      setFeedback({
        type: 'error',
        message: pickText(ERROR_MESSAGES[code] || ERROR_MESSAGES.governance_operation_failed, language),
      });
    }
  };

  const handlePrivilegedAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmittingAppoint(true);

    const result = await appointPrivilegedRole({
      targetUserId: appointTargetId.trim(),
      role: appointRole,
      action: appointAction,
      reason: appointReason.trim(),
      expectedVersion: appointExpectedVersion,
      confirmed: appointConfirmed,
    });

    setSubmittingAppoint(false);

    if (!result.ok) {
      const code: GovernanceErrorCode = result.errorCode ?? 'governance_operation_failed';
      setFeedback({
        type: 'error',
        message: pickText(ERROR_MESSAGES[code] || ERROR_MESSAGES.governance_operation_failed, language),
      });
      return;
    }

    setFeedback({
      type: 'success',
      message: pickText(
        {
          ar: `تم تنفيذ عملية الدور القيادي (${appointAction} ${appointRole}) وتوثيقها في سجل التدقيق.`,
          fr: `Opération sur rôle privilégié (${appointAction} ${appointRole}) enregistrée dans le journal d’audit.`,
          en: `Privileged role operation (${appointAction} ${appointRole}) committed and recorded in the audit log.`,
        },
        language,
      ),
    });
    setAppointReason('');
    setAppointConfirmed(false);
    await Promise.all([loadScope(), loadDirectory()]);
  };

  const sectionTabs: Array<{
    key: OwnerGovernanceSection;
    label: LocalizedText;
  }> = [
    {
      key: 'control-center',
      label: { ar: 'مركز القيادة', fr: 'Centre de contrôle', en: 'Control Center' },
    },
    {
      key: 'pending-approvals',
      label: { ar: 'طلبات الحسابات المعلقة', fr: 'Approbations en attente', en: 'Pending Account Approvals' },
    },
    {
      key: 'user-directory',
      label: { ar: 'دليل الحسابات وحالتها', fr: 'Répertoire & Statuts', en: 'User Directory & Status' },
    },
    {
      key: 'role-governance',
      label: { ar: 'تعيين الأدوار القيادية', fr: 'Gouvernance des rôles', en: 'Role & Permission Governance' },
    },
  ];

  // Section 7 Honest Non-Availability when backend RPC contract is not yet deployed or reachable
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
            },
            language,
          )}
          description={pickText(ERROR_MESSAGES.backend_unavailable, language)}
          actionLabel={pickText(
            {
              ar: 'إعادة فحص اتصال الخادم',
              fr: 'Réessayer la vérification serveur',
              en: 'Retry server verification',
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

  const assignableRoles: readonly AccountRole[] = scope?.assignableRoles?.length
    ? scope.assignableRoles
    : ORDINARY_ROLES;

  return (
    <section
      data-testid={`owner-governance-workspace-${activeSection}`}
      aria-label="Account Governance and Access Control Workspace"
      className={`mt-5 rounded-3xl border p-4 sm:p-6 shadow-sm transition-all ${cardSurfaceClass}`}
    >
      {/* Top workspace header & navigation pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-zinc-800 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
            🔒{' '}
            {pickText(
              {
                ar: 'عقد حوكمة الخادم متصل (Supabase RPC)',
                fr: 'Contrat RPC Supabase vérifié',
                en: 'Server-Verified Supabase Governance Contract',
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
            }}
            className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-900"
          >
            ↻ {pickText({ ar: 'تحديث', fr: 'Actualiser', en: 'Refresh' }, language)}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-900"
          >
            ✕ {pickText({ ar: 'إغلاق', fr: 'Fermer', en: 'Close' }, language)}
          </button>
        </div>
      </div>

      {/* Section switcher bar */}
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

      {/* Feedback Banner */}
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
            },
            language,
          )}
        </div>
      ) : (
        <>
          {/* 1. CONTROL CENTER OVERVIEW */}
          {activeSection === 'control-center' && scope && (
            <div className="mt-5 space-y-5" data-testid="gov-section-control-center">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    {pickText({ ar: 'بانتظار المراجعة', fr: 'En attente', en: 'Pending Review' }, language)}
                  </div>
                  <div className="mt-1 text-2xl font-black">{scope.pendingCount}</div>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {pickText({ ar: 'حسابات معتمدة', fr: 'Approuvés', en: 'Approved Accounts' }, language)}
                  </div>
                  <div className="mt-1 text-2xl font-black">{scope.approvedCount}</div>
                </div>
                <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3.5">
                  <div className="text-xs font-bold text-orange-800 dark:text-orange-300">
                    {pickText({ ar: 'حسابات معلّقة', fr: 'Suspendus', en: 'Suspended' }, language)}
                  </div>
                  <div className="mt-1 text-2xl font-black">{scope.suspendedCount}</div>
                </div>
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5">
                  <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
                    {pickText({ ar: 'حسابات ملغاة', fr: 'Révoqués', en: 'Revoked' }, language)}
                  </div>
                  <div className="mt-1 text-2xl font-black">{scope.revokedCount}</div>
                </div>
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3.5">
                  <div className="text-xs font-bold text-sky-800 dark:text-sky-300">
                    {pickText({ ar: 'مُلّاك نشطون (APP_ADMIN)', fr: 'Propriétaires actifs', en: 'Active School Owners' }, language)}
                  </div>
                  <div className="mt-1 text-2xl font-black">{scope.activeOwnerCount}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-2 text-xs sm:text-sm">
                <div className="font-extrabold">
                  {pickText(
                    {
                      ar: 'نطاق صلاحياتك الموثق من الخادم:',
                      fr: 'Portée d’autorité vérifiée par le serveur :',
                      en: 'Your Server-Verified Governance Authority Scope:',
                    },
                    language,
                  )}
                </div>
                <p className="text-slate-600 dark:text-zinc-400">
                  {pickText(
                    {
                      ar: `الدور الفعّال: ${scope.actorRole} • مراجعة الحسابات العادية: ${scope.canReviewOrdinaryAccounts ? 'نعم' : 'لا'} • تعيين الأدوار القيادية (APP_ADMIN / MANAGER): ${scope.canAppointPrivilegedRoles ? 'نعم (مالك المدرسة حصرياً)' : 'لا'}`,
                      fr: `Rôle actif : ${scope.actorRole} • Revue des comptes ordinaires : ${scope.canReviewOrdinaryAccounts ? 'Oui' : 'Non'} • Nomination APP_ADMIN / MANAGER : ${scope.canAppointPrivilegedRoles ? 'Oui (Propriétaire uniquement)' : 'Non'}`,
                      en: `Active Role: ${scope.actorRole} • Ordinary Account Review: ${scope.canReviewOrdinaryAccounts ? 'Yes' : 'No'} • Privileged Role Appointment (APP_ADMIN / MANAGER): ${scope.canAppointPrivilegedRoles ? 'Yes (Owner Exclusive)' : 'No'}`,
                    },
                    language,
                  )}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectSection('pending-approvals')}
                    className="rounded-xl bg-[#0D8AE8] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[#0B76C7]"
                  >
                    {pickText(
                      {
                        ar: `مراجعة الطلبات المعلقة (${scope.pendingCount})`,
                        fr: `Examiner les demandes en attente (${scope.pendingCount})`,
                        en: `Review Pending Approvals (${scope.pendingCount})`,
                      },
                      language,
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectSection('user-directory')}
                    className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3.5 py-2 text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-zinc-900"
                  >
                    {pickText(
                      {
                        ar: 'فتح دليل الحسابات وحالات التفعيل',
                        fr: 'Ouvrir le répertoire des comptes',
                        en: 'Open User Directory & Status',
                      },
                      language,
                    )}
                  </button>
                  {scope.canAppointPrivilegedRoles && (
                    <button
                      type="button"
                      onClick={() => onSelectSection('role-governance')}
                      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-extrabold text-amber-800 dark:text-amber-200"
                    >
                      {pickText(
                        {
                          ar: 'تعيين أو سحب دور قيادي (MANAGER / APP_ADMIN)',
                          fr: 'Nommer ou révoquer MANAGER / APP_ADMIN',
                          en: 'Appoint or Revoke MANAGER / APP_ADMIN',
                        },
                        language,
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. PENDING ACCOUNT APPROVALS */}
          {activeSection === 'pending-approvals' && (
            <div className="mt-5 space-y-4" data-testid="gov-section-pending-approvals">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  value={pendingSearch}
                  onChange={(e) => {
                    setPendingSearch(e.target.value);
                    setPendingPage(1);
                  }}
                  placeholder={pickText(
                    {
                      ar: 'بحث بالاسم، اسم المستخدم، أو البريد...',
                      fr: 'Rechercher par nom, identifiant ou e-mail...',
                      en: 'Search by name, username, or email...',
                    },
                    language,
                  )}
                  className="flex-1 min-w-[220px] rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3.5 py-2 text-xs sm:text-sm"
                />
                <select
                  value={pendingRoleFilter}
                  onChange={(e) => {
                    setPendingRoleFilter(e.target.value as AccountRole | 'ALL');
                    setPendingPage(1);
                  }}
                  aria-label="Filter pending accounts by requested role"
                  className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs sm:text-sm font-bold"
                >
                  <option value="ALL">
                    {pickText({ ar: 'جميع الأدوار المطلوبة', fr: 'Tous les rôles demandés', en: 'All requested roles' }, language)}
                  </option>
                  {CANONICAL_ROLES.map((r: AccountRole) => (
                    <option key={r} value={r}>
                      {pickText(ROLE_LABELS[r], language)} ({r})
                    </option>
                  ))}
                </select>
              </div>

              {loadingPending ? (
                <div className="py-6 text-center text-xs font-bold text-slate-500">
                  {pickText({ ar: 'جاري تحميل الطلبات المعلقة...', fr: 'Chargement des demandes...', en: 'Loading pending accounts...' }, language)}
                </div>
              ) : pendingItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-6 text-center text-xs sm:text-sm text-slate-500">
                  {pickText(
                    {
                      ar: 'لا توجد طلبات حسابات معلقة تطابق معايير البحث حالياً.',
                      fr: 'Aucune demande de compte en attente pour ces critères.',
                      en: 'No pending account applications match the current filters.',
                    },
                    language,
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingItems.map((item) => {
                    const contactConfirmed = item.emailConfirmed || item.phoneConfirmed;
                    const selectedRole = selectedRolesByTarget[item.id] || item.requestedRole;
                    const reasonVal = reasonsByTarget[item.id] || '';
                    const isBusy = submittingTargetId === item.id;

                    return (
                      <div
                        key={item.id}
                        data-testid={`pending-account-row-${item.id}`}
                        className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-sm sm:text-base">{item.fullName}</span>
                              <span className="text-xs font-mono text-slate-500">@{item.username}</span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_BADGE_STYLES[item.accountStatus]}`}
                              >
                                {pickText(STATUS_LABELS[item.accountStatus], language)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-600 dark:text-zinc-400 space-x-3 rtl:space-x-reverse">
                              <span>{item.email || '—'}</span>
                              {item.phone && <span>• {item.phone}</span>}
                              {item.staffId && <span>• Staff ID: {item.staffId}</span>}
                              {item.admissionId && <span>• Admission ID: {item.admissionId}</span>}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                contactConfirmed
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {contactConfirmed
                                ? pickText(
                                    { ar: '✓ تم تأكيد البريد/الهاتف', fr: '✓ Contact confirmé', en: '✓ Contact confirmed' },
                                    language,
                                  )
                                : pickText(
                                    { ar: '⚠ بانتظار تأكيد البريد/الهاتف', fr: '⚠ Contact non confirmé', en: '⚠ Unconfirmed contact' },
                                    language,
                                  )}
                            </span>
                            <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-bold">
                              {pickText({ ar: 'الدور المطلوب:', fr: 'Rôle demandé :', en: 'Requested:' }, language)}{' '}
                              {pickText(ROLE_LABELS[item.requestedRole], language)} ({item.requestedRole})
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              {pickText({ ar: 'الدور المعتمد عند الموافقة', fr: 'Rôle à attribuer', en: 'Role to assign on approval' }, language)}
                            </label>
                            <select
                              value={selectedRole}
                              onChange={(e) =>
                                setSelectedRolesByTarget((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value as AccountRole,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-2.5 py-1.5 text-xs font-bold"
                            >
                              {assignableRoles.map((r: AccountRole) => (
                                <option key={r} value={r}>
                                  {pickText(ROLE_LABELS[r], language)} ({r})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              {pickText(
                                { ar: 'سبب القرار (إلزامي لسجل التدقيق)', fr: 'Motif de la décision (obligatoire pour l’audit)', en: 'Audit reason (required, 3–500 chars)' },
                                language,
                              )}
                            </label>
                            <input
                              type="text"
                              value={reasonVal}
                              onChange={(e) =>
                                setReasonsByTarget((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder={pickText(
                                {
                                  ar: 'مثال: تم التحقق من ملف التسجيل / عقد العمل...',
                                  fr: 'Ex: Dossier d’inscription ou contrat vérifié...',
                                  en: 'e.g., Verified parent enrollment record or staff contract...',
                                },
                                language,
                              )}
                              className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleInspectAccountDetail(item.id)}
                            className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-900"
                          >
                            {pickText({ ar: 'سجل التدقيق', fr: 'Journal d’audit', en: 'Audit Log' }, language)}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleReviewDecision(item, 'REJECT')}
                            className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            {pickText({ ar: 'رفض الطلب (REJECT)', fr: 'Refuser (REJECT)', en: 'Reject' }, language)}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy || !contactConfirmed}
                            onClick={() => void handleReviewDecision(item, 'APPROVE')}
                            className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {pickText({ ar: 'اعتماد الحساب (APPROVE)', fr: 'Approuver (APPROVE)', en: 'Approve Account' }, language)}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>
                  {pickText({ ar: 'إجمالي الطلبات:', fr: 'Total en attente :', en: 'Total pending:' }, language)} {pendingTotal}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pendingPage <= 1}
                    onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border px-2.5 py-1 disabled:opacity-40"
                  >
                    ←
                  </button>
                  <span>Page {pendingPage}</span>
                  <button
                    type="button"
                    disabled={pendingPage * 10 >= pendingTotal}
                    onClick={() => setPendingPage((p) => p + 1)}
                    className="rounded-lg border px-2.5 py-1 disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. USER DIRECTORY & ACCOUNT STATUS */}
          {activeSection === 'user-directory' && (
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
                  <option value="ALL">{pickText({ ar: 'كل الحالات', fr: 'Tous les statuts', en: 'All statuses' }, language)}</option>
                  {(['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED'] as AccountApprovalStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {pickText(STATUS_LABELS[st], language)}
                    </option>
                  ))}
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
                  <option value="ALL">{pickText({ ar: 'كل الأدوار الـ 7', fr: 'Les 7 rôles', en: 'All 7 roles' }, language)}</option>
                  {CANONICAL_ROLES.map((r: AccountRole) => (
                    <option key={r} value={r}>
                      {pickText(ROLE_LABELS[r], language)} ({r})
                    </option>
                  ))}
                </select>
              </div>

              {loadingDirectory ? (
                <div className="py-6 text-center text-xs font-bold text-slate-500">
                  {pickText({ ar: 'جاري تحميل دليل الحسابات...', fr: 'Chargement du répertoire...', en: 'Loading account directory...' }, language)}
                </div>
              ) : directoryItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-6 text-center text-xs sm:text-sm text-slate-500">
                  {pickText({ ar: 'لا توجد حسابات مطابقة.', fr: 'Aucun compte correspondant.', en: 'No matching accounts found.' }, language)}
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
                              ID: <code className="font-mono">{acct.id}</code> • v{acct.governanceVersion} • {acct.email || '—'}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={loadingDetailId === acct.id}
                            onClick={() => void handleInspectAccountDetail(acct.id)}
                            className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-900"
                          >
                            {pickText({ ar: 'التفاصيل وسجل التدقيق', fr: 'Détails & Audit', en: 'Details & Audit Trail' }, language)}
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
                                {pickText({ ar: 'تعليق مؤقت (SUSPEND)', fr: 'Suspendre', en: 'Suspend' }, language)}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleReviewDecision(acct, 'REVOKE')}
                                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-rose-700 disabled:opacity-50"
                              >
                                {pickText({ ar: 'إلغاء نهائي (REVOKE)', fr: 'Révoquer', en: 'Revoke' }, language)}
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
                              {pickText({ ar: 'إعادة تفعيل (REACTIVATE)', fr: 'Réactiver', en: 'Reactivate' }, language)}
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
                                {pickText({ ar: 'اعتماد (APPROVE)', fr: 'Approuver', en: 'Approve' }, language)}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleReviewDecision(acct, 'REJECT')}
                                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-rose-700 disabled:opacity-50"
                              >
                                {pickText({ ar: 'رفض (REJECT)', fr: 'Refuser', en: 'Reject' }, language)}
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
                  {pickText({ ar: 'إجمالي الحسابات:', fr: 'Total des comptes :', en: 'Total accounts:' }, language)} {directoryTotal}
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
          )}

          {/* 4. OWNER-ONLY PRIVILEGED ROLE APPOINTMENT (MANAGER / APP_ADMIN) */}
          {activeSection === 'role-governance' && (
            <div className="mt-5 space-y-4" data-testid="gov-section-role-governance">
              {!scope?.canAppointPrivilegedRoles ? (
                <EmptyFeatureState
                  state="UNAUTHORIZED"
                  title={pickText(
                    {
                      ar: 'تعيين الأدوار القيادية مقتصر على مالك المدرسة (APP_ADMIN)',
                      fr: 'Nomination des rôles privilégiés réservée à APP_ADMIN',
                      en: 'Privileged Role Appointment is Restricted to School Owner (APP_ADMIN)',
                    },
                    language,
                  )}
                  description={pickText(ERROR_MESSAGES.owner_only_operation, language)}
                />
              ) : (
                <form
                  onSubmit={handlePrivilegedAppointmentSubmit}
                  className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-4"
                >
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold">
                      👑{' '}
                      {pickText(
                        {
                          ar: 'تعيين أو سحب دور قيادي (MANAGER / APP_ADMIN) — صلاحية مالك المدرسة حصرياً',
                          fr: 'Nomination ou révocation d’un rôle privilégié (MANAGER / APP_ADMIN)',
                          en: 'Owner-Only Privileged Role Appointment & Removal (MANAGER / APP_ADMIN)',
                        },
                        language,
                      )}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                      {pickText(
                        {
                          ar: 'لا يُسمح بالتسجيل الذاتي لأدوار MANAGER و APP_ADMIN. يجب أن يمتلك المستخدم حساباً مؤكداً بالبريد أو الهاتف قبل ترقيته من طرف مالك المدرسة. يمنع الخادم تلقائياً إزالة آخر مالك مدرسة نشط.',
                          fr: 'L’auto-inscription aux rôles MANAGER et APP_ADMIN est interdite. Le compte cible doit avoir un contact vérifié. Le serveur bloque la suppression du dernier Propriétaire actif.',
                          en: 'Self-registration never grants MANAGER or APP_ADMIN. The target account must have a confirmed email or phone. The server enforces last-Owner protection.',
                        },
                        language,
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        {pickText(
                          { ar: 'اختر حساباً من الدليل أو أدخل معرف UUID', fr: 'Compte cible (UUID)', en: 'Target Account (Select or enter UUID)' },
                          language,
                        )}
                      </label>
                      <select
                        value={appointTargetId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setAppointTargetId(id);
                          const found = directoryItems.find((item) => item.id === id);
                          if (found) {
                            setAppointExpectedVersion(found.governanceVersion);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-bold mb-2"
                      >
                        <option value="">
                          {pickText({ ar: '— اختر من الحسابات المحملة —', fr: '— Choisir un compte —', en: '— Select from loaded directory —' }, language)}
                        </option>
                        {directoryItems.map((acct) => (
                          <option key={acct.id} value={acct.id}>
                            {acct.fullName} (@{acct.username}) — {acct.accountStatus} [v{acct.governanceVersion}]
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        value={appointTargetId}
                        onChange={(e) => setAppointTargetId(e.target.value)}
                        placeholder="00000000-0000-4000-8000-000000000000"
                        className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          {pickText({ ar: 'الدور القيادي', fr: 'Rôle privilégié', en: 'Privileged Role' }, language)}
                        </label>
                        <select
                          value={appointRole}
                          onChange={(e) => setAppointRole(e.target.value as PrivilegedRole)}
                          className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-bold"
                        >
                          {PRIVILEGED_ROLES.map((r: PrivilegedRole) => (
                            <option key={r} value={r}>
                              {pickText(ROLE_LABELS[r], language)} ({r})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1">
                          {pickText({ ar: 'الإجراء', fr: 'Action', en: 'Action' }, language)}
                        </label>
                        <select
                          value={appointAction}
                          onChange={(e) => setAppointAction(e.target.value as 'GRANT' | 'REVOKE')}
                          className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-bold"
                        >
                          <option value="GRANT">
                            {pickText({ ar: 'تعيين / منح (GRANT)', fr: 'Attribuer (GRANT)', en: 'Appoint / Grant (GRANT)' }, language)}
                          </option>
                          <option value="REVOKE">
                            {pickText({ ar: 'سحب الدور (REVOKE)', fr: 'Retirer (REVOKE)', en: 'Remove Role (REVOKE)' }, language)}
                          </option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-bold mb-1">
                          {pickText({ ar: 'رقم نسخة الحوكمة المتوقع (expectedVersion)', fr: 'Version attendue', en: 'Expected Governance Version' }, language)}
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={appointExpectedVersion}
                          onChange={(e) => setAppointExpectedVersion(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {pickText(
                        { ar: 'سبب قرار التعيين / السحب (إلزامي لسجل التدقيق)', fr: 'Motif d’audit obligatoire (3–500 caractères)', en: 'Mandatory Audit Reason (3–500 chars)' },
                        language,
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={500}
                      value={appointReason}
                      onChange={(e) => setAppointReason(e.target.value)}
                      placeholder={pickText(
                        {
                          ar: 'مثال: تعيين مدير مساعد للمدرسة بعد التحقق من الهوية...',
                          fr: 'Ex: Nomination officielle au poste de Manager après vérification...',
                          en: 'e.g., Official School Owner appointment after identity verification...',
                        },
                        language,
                      )}
                      className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appointConfirmed}
                      onChange={(e) => setAppointConfirmed(e.target.checked)}
                      className="rounded"
                    />
                    <span>
                      {pickText(
                        {
                          ar: 'أؤكد بصفتي مالك المدرسة (APP_ADMIN) تنفيذ هذا التغيير في الصلاحيات القيادية وتوثيقه في سجل التدقيق.',
                          fr: 'Je confirme en tant que Propriétaire (APP_ADMIN) cette modification de rôle privilégié.',
                          en: 'I explicitly confirm as School Owner (APP_ADMIN) this privileged role mutation and audit entry.',
                        },
                        language,
                      )}
                    </span>
                  </label>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingAppoint || !appointConfirmed}
                      className="rounded-xl bg-[#0D8AE8] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#0B76C7] disabled:opacity-50"
                    >
                      {pickText(
                        {
                          ar: 'تنفيذ قرار الدور القيادي عبر الخادم',
                          fr: 'Exécuter la décision sur le serveur',
                          en: 'Commit Privileged Role Decision',
                        },
                        language,
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Account Detail & Immutable Audit Trail Drawer */}
          {selectedDetail && (
            <div
              data-testid="governance-account-detail-drawer"
              className="mt-5 rounded-2xl border border-slate-300 dark:border-zinc-700 p-4 space-y-3 bg-slate-50/70 dark:bg-zinc-900/60"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold">
                  📋{' '}
                  {pickText(
                    {
                      ar: `سجل التدقيق غير القابل للتعديل: ${selectedDetail.account.fullName} (@${selectedDetail.account.username})`,
                      fr: `Journal d’audit immuable : ${selectedDetail.account.fullName} (@${selectedDetail.account.username})`,
                      en: `Immutable Governance Audit Log: ${selectedDetail.account.fullName} (@${selectedDetail.account.username})`,
                    },
                    language,
                  )}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="text-xs font-bold underline"
                >
                  {pickText({ ar: 'إخفاء السجل', fr: 'Masquer', en: 'Hide Log' }, language)}
                </button>
              </div>

              {selectedDetail.auditTrail.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {pickText(
                    { ar: 'لا توجد عمليات مسجلة بعد لهذا الحساب.', fr: 'Aucune entrée d’audit pour ce compte.', en: 'No governance audit entries recorded for this account yet.' },
                    language,
                  )}
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedDetail.auditTrail.map((log: GovernanceAuditLogEntry) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                        <span>
                          {log.action}: {log.previousStatus} → {log.resultingStatus} (
                          {log.resultingRoles.join(', ') || 'none'})
                        </span>
                        <span className="text-[11px] text-slate-500">{log.createdAt}</span>
                      </div>
                      <div className="mt-1 text-slate-600 dark:text-zinc-400">
                        Actor: <code className="font-mono">{log.actorUserId}</code> ({log.actorRole}) • Reason: “{log.reason}”
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
