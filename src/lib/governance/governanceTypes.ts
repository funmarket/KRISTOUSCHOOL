import type { AccountApprovalStatus, AccountRole } from '../../types.ts';

export const CANONICAL_ROLES: readonly AccountRole[] = [
  'APP_ADMIN',
  'MANAGER',
  'ADMINISTRATIVE_PERSONNEL',
  'TEACHER',
  'SCHOOL_STAFF',
  'PARENT',
  'STUDENT',
] as const;

export const PRIVILEGED_ROLES: readonly ('APP_ADMIN' | 'MANAGER')[] = [
  'APP_ADMIN',
  'MANAGER',
] as const;

export const ORDINARY_ROLES: readonly AccountRole[] = [
  'ADMINISTRATIVE_PERSONNEL',
  'TEACHER',
  'SCHOOL_STAFF',
  'PARENT',
  'STUDENT',
] as const;

export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];

export type GovernanceLifecycleDecision =
  | 'APPROVE'
  | 'REJECT'
  | 'SUSPEND'
  | 'REVOKE'
  | 'REACTIVATE';

export type PrivilegedAppointmentAction = 'GRANT' | 'REVOKE';

export type GovernanceErrorCode =
  | 'backend_unavailable'
  | 'actor_unauthenticated'
  | 'actor_not_approved'
  | 'insufficient_governance_authority'
  | 'manager_delegation_required'
  | 'self_governance_denied'
  | 'privileged_target_requires_owner'
  | 'owner_only_operation'
  | 'explicit_confirmation_required'
  | 'last_owner_protection'
  | 'contact_not_confirmed'
  | 'target_not_found'
  | 'invalid_role'
  | 'invalid_capability'
  | 'invalid_transition'
  | 'reason_required'
  | 'version_conflict'
  | 'governance_operation_failed';

export const ALLOWED_MANAGER_CAPABILITIES = [
  'ACCOUNT_APPROVAL_REVIEW',
  'CLASSES_ROSTER_VIEW',
  'CLASSES_MANAGE',
  'ENROLLMENT_REVIEW',
  'BROADCAST_MANAGE',
  'CALENDAR_MANAGE',
  'CAN_MANAGE_FOOD_MENU',
  'PUBLIC_CONTENT_MANAGE',
  'COMMUNITY_MODERATE',
  'OVERSIGHT:PARENT_HOME',
  'OVERSIGHT:STUDENT_HOME',
  'OVERSIGHT:TEACHER_HOME',
  'OVERSIGHT:SCHOOL_STAFF_HOME',
  'OVERSIGHT:ADMINISTRATIVE_PERSONNEL_HOME',
  'OVERSIGHT:MANAGER_HOME',
] as const;

export type AllowedManagerCapability = (typeof ALLOWED_MANAGER_CAPABILITIES)[number];

export interface ManagerSummary {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  accountStatus: AccountApprovalStatus;
  governanceVersion: number;
}

export interface ManagerGrantRecord {
  id: string;
  managerUserId: string;
  managerUsername: string;
  managerFullName: string;
  capability: string;
  active: boolean;
  grantedBy: string | null;
  grantedAt: string;
  updatedAt: string;
}

export interface ManagerDelegationPayload {
  managers: ManagerSummary[];
  grants: ManagerGrantRecord[];
}

export interface SetManagerCapabilityResult {
  grantId: string;
  managerUserId: string;
  capability: string;
  active: boolean;
  auditLogId: string;
}

export interface GovernanceResult<T> {
  ok: boolean;
  data?: T;
  errorCode?: GovernanceErrorCode;
  errorMessage?: string;
}

export interface GovernanceActorScope {
  actorUserId: string;
  actorRole: AccountRole;
  accountStatus: AccountApprovalStatus;
  canReviewOrdinaryAccounts: boolean;
  canAppointPrivilegedRoles: boolean;
  assignableRoles: AccountRole[];
  activeOwnerCount: number;
  pendingCount: number;
  approvedCount: number;
  suspendedCount: number;
  revokedCount: number;
}

export interface GovernanceAccountRecord {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  emailConfirmed: boolean;
  phoneConfirmed: boolean;
  requestedRole: AccountRole;
  accountStatus: AccountApprovalStatus;
  activeRoles: AccountRole[];
  capabilities: string[];
  staffId?: string | null;
  admissionId?: string | null;
  statusReason?: string | null;
  statusReviewedBy?: string | null;
  statusReviewedAt?: string | null;
  governanceVersion: number;
  createdAt: string;
  actionableByCaller?: boolean;
}

export interface GovernanceAuditLogEntry {
  id: string;
  actorUserId: string;
  actorRole: AccountRole;
  targetUserId: string;
  action:
    | GovernanceLifecycleDecision
    | 'APPOINT_PRIVILEGED_ROLE'
    | 'REVOKE_PRIVILEGED_ROLE'
    | 'GRANT_MANAGER_CAPABILITY'
    | 'REVOKE_MANAGER_CAPABILITY';
  capability?: string | null;
  previousStatus: AccountApprovalStatus;
  resultingStatus: AccountApprovalStatus;
  previousRoles: AccountRole[];
  resultingRoles: AccountRole[];
  reason: string;
  idempotencyKey?: string | null;
  createdAt: string;
}

export interface GovernanceAccountDetail {
  account: GovernanceAccountRecord;
  auditTrail: GovernanceAuditLogEntry[];
}

export interface PaginatedGovernanceList<T> {
  items: T[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface ReviewAccountCommand {
  targetUserId: string;
  decision: GovernanceLifecycleDecision;
  assignedRole?: AccountRole;
  reason: string;
  expectedVersion: number;
  idempotencyKey?: string;
}

export interface AppointPrivilegedRoleCommand {
  targetUserId: string;
  role: PrivilegedRole;
  action: PrivilegedAppointmentAction;
  reason: string;
  expectedVersion: number;
  confirmed: boolean;
}

export interface GovernanceMutationResult {
  targetUserId: string;
  accountStatus: AccountApprovalStatus;
  activeRoles: AccountRole[];
  governanceVersion: number;
  auditLogId: string;
  reviewedAt: string;
}

export interface GovernanceRpcClient {
  rpc: (
    fnName: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: any; error: any }>;
}

export const KNOWN_ERROR_CODES = new Set<GovernanceErrorCode>([
  'backend_unavailable',
  'actor_unauthenticated',
  'actor_not_approved',
  'insufficient_governance_authority',
  'manager_delegation_required',
  'self_governance_denied',
  'privileged_target_requires_owner',
  'owner_only_operation',
  'explicit_confirmation_required',
  'last_owner_protection',
  'contact_not_confirmed',
  'target_not_found',
  'invalid_role',
  'invalid_capability',
  'invalid_transition',
  'reason_required',
  'version_conflict',
  'governance_operation_failed',
]);

export function isPrivilegedRole(role: unknown): role is PrivilegedRole {
  return typeof role === 'string' && PRIVILEGED_ROLES.includes(role as any);
}

export function isCanonicalRole(role: unknown): role is AccountRole {
  return typeof role === 'string' && CANONICAL_ROLES.includes(role as any);
}

export function classifyGovernanceRpcError(error: unknown): {
  errorCode: GovernanceErrorCode;
  errorMessage: string;
} {
  if (!error || typeof error !== 'object') {
    return { errorCode: 'governance_operation_failed', errorMessage: 'Governance operation failed.' };
  }
  const err = error as Record<string, unknown>;
  const msg = typeof err.message === 'string' ? err.message : '';
  const details = typeof err.details === 'string' ? err.details : '';
  const hint = typeof err.hint === 'string' ? err.hint : '';
  const code = typeof err.code === 'string' ? err.code : '';
  const combined = `${msg} ${details} ${hint} ${code}`.toLowerCase();

  for (const known of KNOWN_ERROR_CODES) {
    if (combined.includes(known)) {
      return { errorCode: known, errorMessage: msg || `Governance error: ${known}` };
    }
  }

  if (
    code === 'PGRST301' ||
    combined.includes('jwt expired') ||
    (combined.includes('jwt') && combined.includes('invalid'))
  ) {
    return { errorCode: 'actor_unauthenticated', errorMessage: msg || 'Authentication session expired.' };
  }

  if (code === '42501' || combined.includes('permission denied') || combined.includes('policy')) {
    return { errorCode: 'insufficient_governance_authority', errorMessage: msg || 'Permission denied.' };
  }
  if (
    code === 'PGRST202' ||
    code === '42883' ||
    code === '42P01' ||
    combined.includes('does not exist') ||
    combined.includes('could not find the function')
  ) {
    return { errorCode: 'backend_unavailable', errorMessage: 'Governance backend function unavailable.' };
  }

  return { errorCode: 'governance_operation_failed', errorMessage: msg || 'Governance operation failed.' };
}
