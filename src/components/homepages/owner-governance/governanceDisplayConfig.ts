import type { GovernanceErrorCode } from '../../../lib/accountGovernance';
import type { LocalizedText } from '../../../i18n/homepages';
import type { AccountApprovalStatus, AccountRole } from '../../../types';
import type { OwnerGovernanceSection } from '../OwnerGovernanceWorkspace';

export const ROLE_LABELS: Record<AccountRole, LocalizedText> = {
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

export const STATUS_BADGE_STYLES: Record<AccountApprovalStatus, string> = {
  APPROVED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  REJECTED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  SUSPENDED: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  REVOKED: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
};

export const STATUS_LABELS: Record<AccountApprovalStatus, LocalizedText> = {
  APPROVED: { ar: 'معتمد (APPROVED)', fr: 'Approuvé (APPROVED)', en: 'Approved (APPROVED)' },
  PENDING: { ar: 'قيد المراجعة (PENDING)', fr: 'En attente (PENDING)', en: 'Pending (PENDING)' },
  REJECTED: { ar: 'مرفوض (REJECTED)', fr: 'Refusé (REJECTED)', en: 'Rejected (REJECTED)' },
  SUSPENDED: { ar: 'معلّق مؤقتاً (SUSPENDED)', fr: 'Suspendu (SUSPENDED)', en: 'Suspended (SUSPENDED)' },
  REVOKED: { ar: 'ملغى (REVOKED)', fr: 'Révoqué (REVOKED)', en: 'Revoked (REVOKED)' },
};

export const ERROR_MESSAGES: Record<GovernanceErrorCode, LocalizedText> = {
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
  invalid_capability: {
    ar: 'الصلاحية المحددة غير مدرجة ضمن قائمة التفويض المعتمدة.',
    fr: 'La capacité demandée n’est pas autorisée dans la liste de délégation.',
    en: 'Requested capability is not in the approved Manager delegation allowlist.',
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

export const ALL_GOVERNANCE_SECTION_TABS: Array<{
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
    key: 'manager-delegation',
    label: { ar: 'تفويض المدير المساعد', fr: 'Délégation Manager', en: 'Manager Delegation' },
  },
  {
    key: 'role-governance',
    label: { ar: 'تعيين الأدوار القيادية', fr: 'Gouvernance des rôles', en: 'Role & Permission Governance' },
  },
];
