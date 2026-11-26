import type { GovernanceErrorCode } from '../../../lib/accountGovernance';
import type { LocalizedText } from '../../../i18n/homepages';
import type { AccountApprovalStatus, AccountRole } from '../../../types';
import type { OwnerGovernanceSection } from '../OwnerGovernanceWorkspace';

export const ROLE_LABELS: Record<AccountRole, LocalizedText> = {
  APP_ADMIN: {
    ar: 'مالك المدرسة / المدير العام',
    fr: 'Propriétaire / Fondateur',
    en: 'School Owner / App Admin',
    es: 'Propietario / Administrador escolar',
    de: 'Schulinhaber / App-Admin',
    pt: 'Proprietário / Administrador escolar',
  },
  MANAGER: {
    ar: 'المدير المساعد / المسير',
    fr: 'Directeur adjoint / Manager',
    en: 'School Manager',
    es: 'Director adjunto / Gestor',
    de: 'Schulleiter / Manager',
    pt: 'Diretor adjunto / Gestor',
  },
  ADMINISTRATIVE_PERSONNEL: {
    ar: 'الإدارة المدرسية',
    fr: 'Personnel administratif',
    en: 'Administrative Personnel',
    es: 'Personal administrativo',
    de: 'Verwaltungspersonal',
    pt: 'Pessoal administrativo',
  },
  TEACHER: {
    ar: 'مربي / أستاذ',
    fr: 'Enseignant(e)',
    en: 'Teacher',
    es: 'Docente',
    de: 'Lehrkraft',
    pt: 'Professor(a)',
  },
  SCHOOL_STAFF: {
    ar: 'عون مدرسة',
    fr: 'Personnel scolaire',
    en: 'School Staff',
    es: 'Personal escolar',
    de: 'Schulpersonal',
    pt: 'Funcionário escolar',
  },
  PARENT: {
    ar: 'ولي أمر',
    fr: 'Parent d’élève',
    en: 'Parent / Guardian',
    es: 'Padre / Tutor',
    de: 'Elternteil / Erziehungsberechtigter',
    pt: 'Pai / Encarregado',
  },
  STUDENT: {
    ar: 'تلميذ',
    fr: 'Élève',
    en: 'Student',
    es: 'Estudiante',
    de: 'Schüler(in)',
    pt: 'Aluno(a)',
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
  APPROVED: { ar: 'معتمد (APPROVED)', fr: 'Approuvé (APPROVED)', en: 'Approved (APPROVED)', es: 'Aprobado (APPROVED)', de: 'Genehmigt (APPROVED)', pt: 'Aprovado (APPROVED)' },
  PENDING: { ar: 'قيد المراجعة (PENDING)', fr: 'En attente (PENDING)', en: 'Pending (PENDING)', es: 'Pendiente (PENDING)', de: 'Ausstehend (PENDING)', pt: 'Pendente (PENDING)' },
  REJECTED: { ar: 'مرفوض (REJECTED)', fr: 'Refusé (REJECTED)', en: 'Rejected (REJECTED)', es: 'Rechazado (REJECTED)', de: 'Abgelehnt (REJECTED)', pt: 'Rejeitado (REJECTED)' },
  SUSPENDED: { ar: 'معلّق مؤقتاً (SUSPENDED)', fr: 'Suspendu (SUSPENDED)', en: 'Suspended (SUSPENDED)', es: 'Suspendido (SUSPENDED)', de: 'Gesperrt (SUSPENDED)', pt: 'Suspenso (SUSPENDED)' },
  REVOKED: { ar: 'ملغى (REVOKED)', fr: 'Révoqué (REVOKED)', en: 'Revoked (REVOKED)', es: 'Revocado (REVOKED)', de: 'Widerrufen (REVOKED)', pt: 'Revogado (REVOKED)' },
};

export const ERROR_MESSAGES: Record<GovernanceErrorCode, LocalizedText> = {
  backend_unavailable: {
    ar: 'عقود الحوكمة في الخادم (Supabase RPC) غير منشورة أو غير متاحة حالياً. لا يتم تنفيذ أي موافقة وهمية في المتصفح.',
    fr: 'Les contrats RPC Supabase de gouvernance ne sont pas encore déployés ou joignables. Aucune approbation fictive n’est exécutée.',
    en: 'Verified Supabase governance RPC contracts are not deployed or reachable yet. No browser-side mock approvals are performed.',
    es: 'Los contratos RPC de gobernanza en Supabase aún no están desplegados o disponibles. No se realizan aprobaciones ficticias en el navegador.',
    de: 'Verifizierte Supabase-Governance-RPCs sind noch nicht bereitgestellt oder erreichbar. Im Browser erfolgen keine Scheingenehmigungen.',
    pt: 'Os contratos RPC de governação no Supabase ainda não estão disponíveis. Nenhuma aprovação fictícia é executada no navegador.',
  },
  actor_unauthenticated: {
    ar: 'يجب تسجيل الدخول بحساب معتمد لتنفيذ عمليات الحوكمة.',
    fr: 'Session authentifiée requise pour les opérations de gouvernance.',
    en: 'An authenticated session is required for governance operations.',
    es: 'Se requiere una sesión autenticada para las operaciones de gobernanza.',
    de: 'Für Governance-Vorgänge ist eine authentifizierte Sitzung erforderlich.',
    pt: 'É necessária uma sessão autenticada para operações de governação.',
  },
  actor_not_approved: {
    ar: 'حسابك الحالي غير معتمد (PENDING / SUSPENDED / REVOKED) ولا يملك صلاحية الحوكمة.',
    fr: 'Votre compte n’est pas au statut APPROVED et ne peut pas exécuter d’actions de gouvernance.',
    en: 'Your account is not in APPROVED status and cannot perform governance actions.',
    es: 'Tu cuenta no tiene el estado APPROVED y no puede realizar acciones de gobernanza.',
    de: 'Ihr Konto hat nicht den Status APPROVED und kann keine Governance-Aktionen ausführen.',
    pt: 'A sua conta não está no estado APPROVED e não pode executar ações de governação.',
  },
  insufficient_governance_authority: {
    ar: 'دورك الحالي غير مخول للوصول إلى وحدة حوكمة الحسابات.',
    fr: 'Votre rôle actuel n’est pas autorisé à accéder à la gouvernance des comptes.',
    en: 'Your role is not authorized to access account governance.',
    es: 'Tu rol no está autorizado para acceder a la gobernanza de cuentas.',
    de: 'Ihre Rolle ist nicht zum Zugriff auf die Kontoverwaltung berechtigt.',
    pt: 'A sua função não tem autorização para aceder à governação de contas.',
  },
  manager_delegation_required: {
    ar: 'يتطلب دور المدير المساعد (MANAGER) تفويضاً نشطاً (ACCOUNT_APPROVAL_REVIEW) من مالك المدرسة.',
    fr: 'Le rôle MANAGER nécessite une délégation active (ACCOUNT_APPROVAL_REVIEW) accordée par le Propriétaire.',
    en: 'MANAGER requires an active ACCOUNT_APPROVAL_REVIEW capability grant from the School Owner.',
    es: 'MANAGER requiere una delegación activa (ACCOUNT_APPROVAL_REVIEW) otorgada por el Propietario.',
    de: 'MANAGER erfordert eine aktive Berechtigung (ACCOUNT_APPROVAL_REVIEW) durch den Schulinhaber.',
    pt: 'MANAGER requer uma delegação ativa (ACCOUNT_APPROVAL_REVIEW) concedida pelo Proprietário.',
  },
  self_governance_denied: {
    ar: 'يُمنع على الموظف الإداري أو المدير المفوض اعتماد أو تعديل حالة حسابه الشخصي.',
    fr: 'L’auto-approbation ou la modification de son propre statut est interdite.',
    en: 'Self-governance is denied: you cannot approve, suspend, revoke, or reactivate your own account.',
    es: 'Auto-gobernanza denegada: no puedes aprobar, suspender, revocar ni reactivar tu propia cuenta.',
    de: 'Selbstverwaltung verweigert: Sie können Ihr eigenes Konto nicht genehmigen, sperren, widerrufen oder reaktivieren.',
    pt: 'Autogovernação negada: não pode aprovar, suspender, revogar ou reativar a sua própria conta.',
  },
  privileged_target_requires_owner: {
    ar: 'الحسابات ذات الأدوار العليا (APP_ADMIN / MANAGER) تخضع حصرياً لسلطة مالك المدرسة (APP_ADMIN).',
    fr: 'Les comptes privilégiés (APP_ADMIN / MANAGER) relèvent exclusivement du Propriétaire (APP_ADMIN).',
    en: 'Privileged accounts and roles (APP_ADMIN / MANAGER) require School Owner (APP_ADMIN) authority.',
    es: 'Las cuentas y roles privilegiados (APP_ADMIN / MANAGER) requieren autoridad del Propietario (APP_ADMIN).',
    de: 'Privilegierte Konten und Rollen (APP_ADMIN / MANAGER) erfordern die Befugnis des Schulinhabers (APP_ADMIN).',
    pt: 'Contas e funções privilegiadas (APP_ADMIN / MANAGER) requerem autoridade do Proprietário (APP_ADMIN).',
  },
  owner_only_operation: {
    ar: 'تعيين أو سحب أدوار القيادة (APP_ADMIN / MANAGER) مقتصر حصرياً على مالك المدرسة (APP_ADMIN).',
    fr: 'La nomination ou révocation des rôles APP_ADMIN / MANAGER est réservée au Propriétaire (APP_ADMIN).',
    en: 'Appointing or revoking APP_ADMIN or MANAGER roles is restricted exclusively to the School Owner (APP_ADMIN).',
    es: 'Designar o revocar los roles APP_ADMIN o MANAGER está reservado exclusivamente al Propietario (APP_ADMIN).',
    de: 'Die Ernennung oder der Entzug von APP_ADMIN- oder MANAGER-Rollen ist ausschließlich dem Schulinhaber (APP_ADMIN) vorbehalten.',
    pt: 'Nomear ou revogar funções APP_ADMIN ou MANAGER é exclusivo do Proprietário da Escola (APP_ADMIN).',
  },
  last_owner_protection: {
    ar: 'حماية المالك الأخير: لا يمكن تعليق أو إلغاء أو سحب صلاحية آخر مالك مدرسة نشط (APP_ADMIN).',
    fr: 'Protection du dernier Propriétaire : impossible de suspendre, révoquer ou retirer le dernier APP_ADMIN actif.',
    en: 'Last-Owner protection: cannot suspend, revoke, or remove the last active School Owner (APP_ADMIN).',
    es: 'Protección del último Propietario: no se puede suspender, revocar ni eliminar al último APP_ADMIN activo.',
    de: 'Schutz des letzten Inhabers: Der letzte aktive Schulinhaber (APP_ADMIN) kann nicht gesperrt, widerrufen oder entfernt werden.',
    pt: 'Proteção do último Proprietário: não é possível suspender, revogar ou remover o último APP_ADMIN ativo.',
  },
  contact_not_confirmed: {
    ar: 'لا يمكن اعتماد هذا الحساب قبل تأكيد البريد الإلكتروني أو رقم الهاتف.',
    fr: 'Impossible d’approuver un compte avant la confirmation de l’e-mail ou du téléphone.',
    en: 'Cannot approve an account before email or phone confirmation is completed.',
    es: 'No se puede aprobar una cuenta antes de confirmar el correo o teléfono.',
    de: 'Ein Konto kann erst nach Bestätigung von E-Mail oder Telefon genehmigt werden.',
    pt: 'Não é possível aprovar uma conta antes da confirmação de e-mail ou telefone.',
  },
  invalid_transition: {
    ar: 'انتقال حالة الحساب غير صالح للحالة الحالية.',
    fr: 'Transition de statut invalide pour l’état actuel du compte.',
    en: 'Invalid account lifecycle transition for the current status.',
    es: 'Transición de estado de cuenta no válida para el estado actual.',
    de: 'Ungültiger Kontostatus-Übergang für den aktuellen Status.',
    pt: 'Transição de estado de conta inválida para o estado atual.',
  },
  reason_required: {
    ar: 'يرجى إدخال سبب توثيقي واضح (3 إلى 500 حرف) لسجل التدقيق.',
    fr: 'Veuillez saisir un motif d’audit valide (3 à 500 caractères).',
    en: 'Please provide an audit reason between 3 and 500 characters.',
    es: 'Por favor, indica un motivo de auditoría de entre 3 y 500 caracteres.',
    de: 'Bitte geben Sie einen Prüfungs­grund mit 3 bis 500 Zeichen an.',
    pt: 'Por favor, forneça um motivo de auditoria entre 3 e 500 caracteres.',
  },
  invalid_role: {
    ar: 'الدور المحدد غير صالح.',
    fr: 'Le rôle sélectionné est invalide.',
    en: 'The selected role is invalid.',
    es: 'El rol seleccionado no es válido.',
    de: 'Die ausgewählte Rolle ist ungültig.',
    pt: 'A função selecionada é inválida.',
  },
  invalid_capability: {
    ar: 'الصلاحية المحددة غير مدرجة ضمن قائمة التفويض المعتمدة.',
    fr: 'La capacité demandée n’est pas autorisée dans la liste de délégation.',
    en: 'Requested capability is not in the approved Manager delegation allowlist.',
    es: 'La capacidad solicitada no está en la lista aprobada de delegación.',
    de: 'Die angeforderte Berechtigung steht nicht in der genehmigten Delegationsliste.',
    pt: 'A capacidade solicitada não consta na lista aprovada de delegação.',
  },
  explicit_confirmation_required: {
    ar: 'يرجى تأكيد عملية التعيين أو السحب للدور القيادي.',
    fr: 'Veuillez cocher la confirmation explicite pour cette opération privilégiée.',
    en: 'Explicit confirmation is required for privileged role appointment or removal.',
    es: 'Se requiere confirmación explícita para designar o retirar un rol privilegiado.',
    de: 'Für die Ernennung oder Entfernung privilegierter Rollen ist eine ausdrückliche Bestätigung erforderlich.',
    pt: 'É necessária confirmação explícita para nomeação ou remoção de função privilegiada.',
  },
  target_not_found: {
    ar: 'لم يتم العثور على الحساب المستهدف.',
    fr: 'Compte cible introuvable.',
    en: 'Target account was not found.',
    es: 'No se encontró la cuenta objetivo.',
    de: 'Zielkonto wurde nicht gefunden.',
    pt: 'A conta de destino não foi encontrada.',
  },
  version_conflict: {
    ar: 'تعارض في النسخة: تم تعديل هذا الحساب من طرف مسؤول آخر. يرجى تحديث القائمة والمحاولة مجدداً.',
    fr: 'Conflit de version : ce compte a été modifié par un autre administrateur. Veuillez actualiser.',
    en: 'Version conflict: this account was modified by another actor. Please refresh and try again.',
    es: 'Conflicto de versión: esta cuenta fue modificada por otro administrador. Actualiza e inténtalo de nuevo.',
    de: 'Versionskonflikt: Dieses Konto wurde von einem anderen Akteur geändert. Bitte aktualisieren.',
    pt: 'Conflito de versão: esta conta foi modificada por outro administrador. Atualize e tente novamente.',
  },
  governance_operation_failed: {
    ar: 'تعذر إتمام عملية الحوكمة عبر الخادم.',
    fr: 'Échec de l’opération de gouvernance côté serveur.',
    en: 'Server governance operation failed.',
    es: 'La operación de gobernanza en el servidor falló.',
    de: 'Server-Governance-Vorgang fehlgeschlagen.',
    pt: 'A operação de governação no servidor falhou.',
  },
};

export const ALL_GOVERNANCE_SECTION_TABS: Array<{
  key: OwnerGovernanceSection;
  label: LocalizedText;
}> = [
  {
    key: 'control-center',
    label: { ar: 'مركز القيادة', fr: 'Centre de contrôle', en: 'Control Center', es: 'Centro de control', de: 'Kontrollzentrum', pt: 'Centro de controlo' },
  },
  {
    key: 'pending-approvals',
    label: { ar: 'طلبات الحسابات المعلقة', fr: 'Approbations en attente', en: 'Pending Account Approvals', es: 'Aprobaciones pendientes', de: 'Ausstehende Genehmigungen', pt: 'Aprovações pendentes' },
  },
  {
    key: 'user-directory',
    label: { ar: 'دليل الحسابات وحالتها', fr: 'Répertoire & Statuts', en: 'User Directory & Status', es: 'Directorio y estados', de: 'Benutzerverzeichnis & Status', pt: 'Diretório e estados' },
  },
  {
    key: 'manager-delegation',
    label: { ar: 'تفويض المدير المساعد', fr: 'Délégation Manager', en: 'Manager Delegation', es: 'Delegación Manager', de: 'Manager-Delegation', pt: 'Delegação Manager' },
  },
  {
    key: 'role-governance',
    label: { ar: 'تعيين الأدوار القيادية', fr: 'Gouvernance des rôles', en: 'Role & Permission Governance', es: 'Gobernanza de roles', de: 'Rollenverwaltung', pt: 'Governação de funções' },
  },
];
