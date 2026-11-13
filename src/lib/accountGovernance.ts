import { supabase } from './supabase.ts';
import type { AccountApprovalStatus, AccountRole } from '../types.ts';

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
  | 'invalid_transition'
  | 'reason_required'
  | 'version_conflict'
  | 'governance_operation_failed';

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
    | 'REVOKE_PRIVILEGED_ROLE';
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

const KNOWN_ERROR_CODES = new Set<GovernanceErrorCode>([
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
  'invalid_transition',
  'reason_required',
  'version_conflict',
  'governance_operation_failed',
]);

export function isPrivilegedRole(role: unknown): role is PrivilegedRole {
  return role === 'APP_ADMIN' || role === 'MANAGER';
}

export function isCanonicalRole(role: unknown): role is AccountRole {
  return typeof role === 'string' && (CANONICAL_ROLES as readonly string[]).includes(role);
}

export function classifyGovernanceRpcError(error: unknown): {
  errorCode: GovernanceErrorCode;
  errorMessage: string;
} {
  if (!error || typeof error !== 'object') {
    return {
      errorCode: 'governance_operation_failed',
      errorMessage: 'Governance operation failed.',
    };
  }

  const rawCode =
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code.trim()
      : '';
  const rawMessage =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.trim()
      : '';

  // PostgREST / PostgreSQL missing RPC function or unreachable backend -> backend_unavailable
  if (
    rawCode === 'PGRST202' ||
    rawCode === '42883' ||
    rawCode === '42P01' ||
    rawMessage.includes('Could not find the function') ||
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError')
  ) {
    return {
      errorCode: 'backend_unavailable',
      errorMessage:
        'The Supabase account-governance RPC contract is not yet deployed on the server.',
    };
  }

  for (const known of KNOWN_ERROR_CODES) {
    if (rawCode === known || rawMessage === known || rawMessage.includes(known)) {
      return {
        errorCode: known,
        errorMessage: rawMessage || known,
      };
    }
  }

  return {
    errorCode: 'governance_operation_failed',
    errorMessage: 'Governance operation could not be completed.',
  };
}

function resolveRpcClient(clientOverride?: GovernanceRpcClient | null): GovernanceRpcClient | null {
  if (clientOverride !== undefined) {
    return clientOverride;
  }
  return (supabase as unknown as GovernanceRpcClient | null) ?? null;
}

export async function fetchGovernanceActorScope(
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<GovernanceActorScope>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return {
      ok: false,
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase client is not configured in this build.',
    };
  }

  try {
    const { data, error } = await client.rpc('governance_get_actor_scope', {});
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, ...classified };
    }
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        errorCode: 'backend_unavailable',
        errorMessage: 'Empty governance scope response.',
      };
    }
    return { ok: true, data: data as GovernanceActorScope };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, ...classified };
  }
}

export async function listPendingAccounts(
  params: {
    limit?: number;
    offset?: number;
    requestedRole?: AccountRole | 'ALL';
    search?: string;
  } = {},
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<PaginatedGovernanceList<GovernanceAccountRecord>>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return {
      ok: false,
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase client is not configured in this build.',
    };
  }

  try {
    const { data, error } = await client.rpc('governance_list_pending_accounts', {
      p_limit: params.limit ?? 25,
      p_offset: params.offset ?? 0,
      p_requested_role:
        params.requestedRole && params.requestedRole !== 'ALL' ? params.requestedRole : null,
      p_search: params.search?.trim() || null,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, ...classified };
    }
    if (!data || !Array.isArray(data.items)) {
      return {
        ok: false,
        errorCode: 'backend_unavailable',
        errorMessage: 'Invalid pending-accounts payload.',
      };
    }
    return { ok: true, data: data as PaginatedGovernanceList<GovernanceAccountRecord> };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, ...classified };
  }
}

export async function listAccountDirectory(
  params: {
    limit?: number;
    offset?: number;
    status?: AccountApprovalStatus | 'ALL';
    role?: AccountRole | 'ALL';
    search?: string;
  } = {},
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<PaginatedGovernanceList<GovernanceAccountRecord>>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return {
      ok: false,
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase client is not configured in this build.',
    };
  }

  try {
    const { data, error } = await client.rpc('governance_list_account_directory', {
      p_limit: params.limit ?? 25,
      p_offset: params.offset ?? 0,
      p_status: params.status && params.status !== 'ALL' ? params.status : null,
      p_role: params.role && params.role !== 'ALL' ? params.role : null,
      p_search: params.search?.trim() || null,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, ...classified };
    }
    if (!data || !Array.isArray(data.items)) {
      return {
        ok: false,
        errorCode: 'backend_unavailable',
        errorMessage: 'Invalid account-directory payload.',
      };
    }
    return { ok: true, data: data as PaginatedGovernanceList<GovernanceAccountRecord> };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, ...classified };
  }
}

export async function getAccountGovernanceDetail(
  targetUserId: string,
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<GovernanceAccountDetail>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return {
      ok: false,
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase client is not configured in this build.',
    };
  }

  try {
    const { data, error } = await client.rpc('governance_get_account_detail', {
      p_target_user_id: targetUserId,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, ...classified };
    }
    if (!data || !data.account) {
      return {
        ok: false,
        errorCode: 'target_not_found',
        errorMessage: 'Account detail not found.',
      };
    }
    return { ok: true, data: data as GovernanceAccountDetail };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, ...classified };
  }
}

export async function reviewAccountLifecycle(
  command: ReviewAccountCommand,
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<GovernanceMutationResult>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return {
      ok: false,
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase client is not configured in this build.',
    };
  }

  const trimmedReason = command.reason?.trim() ?? '';
  if (trimmedReason.length < 3) {
    return {
      ok: false,
      errorCode: 'reason_required',
      errorMessage: 'A clear audit reason (at least 3 characters) is required.',
    };
  }

  try {
    const { data, error } = await client.rpc('governance_review_account', {
      p_target_user_id: command.targetUserId,
      p_decision: command.decision,
      p_assigned_role: command.assignedRole ?? null,
      p_reason: trimmedReason,
      p_expected_version: command.expectedVersion,
      p_idempotency_key: command.idempotencyKey ?? null,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, ...classified };
    }
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        errorCode: 'backend_unavailable',
        errorMessage: 'Invalid account review response.',
      };
    }
    return { ok: true, data: data as GovernanceMutationResult };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, ...classified };
  }
}

export async function appointPrivilegedRole(
  command: AppointPrivilegedRoleCommand,
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<GovernanceMutationResult>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return {
      ok: false,
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase client is not configured in this build.',
    };
  }

  if (!command.confirmed) {
    return {
      ok: false,
      errorCode: 'explicit_confirmation_required',
      errorMessage: 'Explicit confirmation is required for Owner/Manager role appointments.',
    };
  }

  if (!isPrivilegedRole(command.role)) {
    return {
      ok: false,
      errorCode: 'invalid_role',
      errorMessage: 'Only APP_ADMIN or MANAGER may be appointed via privileged appointment.',
    };
  }

  const trimmedReason = command.reason?.trim() ?? '';
  if (trimmedReason.length < 3) {
    return {
      ok: false,
      errorCode: 'reason_required',
      errorMessage: 'A clear audit reason (at least 3 characters) is required.',
    };
  }

  try {
    const { data, error } = await client.rpc('governance_appoint_privileged_role', {
      p_target_user_id: command.targetUserId,
      p_role: command.role,
      p_action: command.action,
      p_reason: trimmedReason,
      p_expected_version: command.expectedVersion,
      p_confirmed: command.confirmed,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, ...classified };
    }
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        errorCode: 'backend_unavailable',
        errorMessage: 'Invalid privileged appointment response.',
      };
    }
    return { ok: true, data: data as GovernanceMutationResult };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, ...classified };
  }
}

/**
 * Deterministic reference server-policy test harness matching the exact authorization,
 * lifecycle, concurrency, and audit invariants in `20261113150000_account_governance_foundation.sql`.
 * Used ONLY in isolated automated tests (`tests/account-governance.test.mjs`), never in production UI.
 */
export function createInMemoryGovernanceTestHarness(
  initialAccounts: GovernanceAccountRecord[],
) {
  const accounts = new Map<string, GovernanceAccountRecord>(
    initialAccounts.map((acc) => [
      acc.id,
      {
        ...acc,
        activeRoles: [...acc.activeRoles],
        capabilities: [...(acc.capabilities ?? [])],
      },
    ]),
  );
  const auditLogs: GovernanceAuditLogEntry[] = [];
  const idempotencyResults = new Map<string, GovernanceMutationResult>();

  const countActiveApprovedOwners = (): number => {
    let count = 0;
    for (const acc of accounts.values()) {
      if (acc.accountStatus === 'APPROVED' && acc.activeRoles.includes('APP_ADMIN')) {
        count += 1;
      }
    }
    return count;
  };

  const resolveEffectiveRole = (acc: GovernanceAccountRecord): AccountRole | null => {
    if (acc.activeRoles.includes('APP_ADMIN')) return 'APP_ADMIN';
    for (const role of CANONICAL_ROLES) {
      if (acc.activeRoles.includes(role)) return role;
    }
    return null;
  };

  const verifyGovernanceCaller = (
    actorUserId: string | null,
    requireOwnerOnly = false,
  ):
    | {
        ok: true;
        actor: GovernanceAccountRecord;
        actorRole: AccountRole;
        canReviewOrdinary: boolean;
        canAppointPrivileged: boolean;
      }
    | { ok: false; code: GovernanceErrorCode } => {
    if (!actorUserId) {
      return { ok: false, code: 'actor_unauthenticated' };
    }
    const actor = accounts.get(actorUserId);
    if (!actor || actor.accountStatus !== 'APPROVED') {
      return { ok: false, code: 'actor_not_approved' };
    }
    const actorRole = resolveEffectiveRole(actor);
    if (!actorRole) {
      return { ok: false, code: 'actor_not_approved' };
    }

    if (requireOwnerOnly) {
      if (actorRole !== 'APP_ADMIN') {
        return { ok: false, code: 'owner_only_operation' };
      }
      return {
        ok: true,
        actor,
        actorRole,
        canReviewOrdinary: true,
        canAppointPrivileged: true,
      };
    }

    if (actorRole === 'APP_ADMIN') {
      return {
        ok: true,
        actor,
        actorRole,
        canReviewOrdinary: true,
        canAppointPrivileged: true,
      };
    }

    if (actorRole === 'ADMINISTRATIVE_PERSONNEL') {
      return {
        ok: true,
        actor,
        actorRole,
        canReviewOrdinary: true,
        canAppointPrivileged: false,
      };
    }

    if (actorRole === 'MANAGER') {
      if (!actor.capabilities.includes('ACCOUNT_APPROVAL_REVIEW')) {
        return { ok: false, code: 'manager_delegation_required' };
      }
      return {
        ok: true,
        actor,
        actorRole,
        canReviewOrdinary: true,
        canAppointPrivileged: false,
      };
    }

    return { ok: false, code: 'insufficient_governance_authority' };
  };

  const targetHasOrRequestsPrivilegedRole = (
    target: GovernanceAccountRecord,
    assignedRole?: AccountRole | null,
  ): boolean => {
    if (target.activeRoles.some((r) => isPrivilegedRole(r))) return true;
    if (isPrivilegedRole(target.requestedRole)) return true;
    if (assignedRole && isPrivilegedRole(assignedRole)) return true;
    return false;
  };

  const asActor = (actorUserId: string | null): GovernanceRpcClient => ({
    rpc: async (fnName: string, args: Record<string, unknown> = {}) => {
      if (fnName === 'governance_get_actor_scope') {
        const auth = verifyGovernanceCaller(actorUserId, false);
        if (!auth.ok) {
          return { data: null, error: { code: auth.code, message: auth.code } };
        }
        const all = [...accounts.values()];
        const scope: GovernanceActorScope = {
          actorUserId: auth.actor.id,
          actorRole: auth.actorRole,
          accountStatus: auth.actor.accountStatus,
          canReviewOrdinaryAccounts: auth.canReviewOrdinary,
          canAppointPrivilegedRoles: auth.canAppointPrivileged,
          assignableRoles: auth.canAppointPrivileged
            ? [...CANONICAL_ROLES]
            : [...ORDINARY_ROLES],
          activeOwnerCount: countActiveApprovedOwners(),
          pendingCount: all.filter((a) => a.accountStatus === 'PENDING').length,
          approvedCount: all.filter((a) => a.accountStatus === 'APPROVED').length,
          suspendedCount: all.filter((a) => a.accountStatus === 'SUSPENDED').length,
          revokedCount: all.filter((a) => a.accountStatus === 'REVOKED').length,
        };
        return { data: scope, error: null };
      }

      if (fnName === 'governance_list_pending_accounts') {
        const auth = verifyGovernanceCaller(actorUserId, false);
        if (!auth.ok) {
          return { data: null, error: { code: auth.code, message: auth.code } };
        }
        const limit = Number(args.p_limit ?? 25);
        const offset = Number(args.p_offset ?? 0);
        const reqRole = (args.p_requested_role as AccountRole | null) ?? null;
        const search = ((args.p_search as string | null) ?? '').toLowerCase();

        const filtered = [...accounts.values()]
          .filter((a) => a.accountStatus === 'PENDING')
          .filter((a) => (!reqRole ? true : a.requestedRole === reqRole))
          .filter((a) =>
            !search
              ? true
              : a.fullName.toLowerCase().includes(search) ||
                a.username.toLowerCase().includes(search) ||
                (a.email?.toLowerCase().includes(search) ?? false),
          )
          .map((a) => ({
            ...a,
            actionableByCaller:
              auth.actorRole === 'APP_ADMIN'
                ? true
                : a.id !== auth.actor.id && !targetHasOrRequestsPrivilegedRole(a),
          }));

        return {
          data: {
            items: filtered.slice(offset, offset + limit),
            totalCount: filtered.length,
            limit,
            offset,
          },
          error: null,
        };
      }

      if (fnName === 'governance_list_account_directory') {
        const auth = verifyGovernanceCaller(actorUserId, false);
        if (!auth.ok) {
          return { data: null, error: { code: auth.code, message: auth.code } };
        }
        const limit = Number(args.p_limit ?? 25);
        const offset = Number(args.p_offset ?? 0);
        const statusFilter = (args.p_status as AccountApprovalStatus | null) ?? null;
        const roleFilter = (args.p_role as AccountRole | null) ?? null;
        const search = ((args.p_search as string | null) ?? '').toLowerCase();

        const filtered = [...accounts.values()]
          .filter((a) => (!statusFilter ? true : a.accountStatus === statusFilter))
          .filter((a) =>
            !roleFilter
              ? true
              : a.activeRoles.includes(roleFilter) || a.requestedRole === roleFilter,
          )
          .filter((a) =>
            !search
              ? true
              : a.fullName.toLowerCase().includes(search) ||
                a.username.toLowerCase().includes(search) ||
                (a.email?.toLowerCase().includes(search) ?? false),
          )
          .map((a) => ({
            ...a,
            actionableByCaller:
              auth.actorRole === 'APP_ADMIN'
                ? true
                : a.id !== auth.actor.id && !targetHasOrRequestsPrivilegedRole(a),
          }));

        return {
          data: {
            items: filtered.slice(offset, offset + limit),
            totalCount: filtered.length,
            limit,
            offset,
          },
          error: null,
        };
      }

      if (fnName === 'governance_get_account_detail') {
        const auth = verifyGovernanceCaller(actorUserId, false);
        if (!auth.ok) {
          return { data: null, error: { code: auth.code, message: auth.code } };
        }
        const targetId = String(args.p_target_user_id ?? '');
        const target = accounts.get(targetId);
        if (!target) {
          return {
            data: null,
            error: { code: 'target_not_found', message: 'target_not_found' },
          };
        }
        return {
          data: {
            account: { ...target },
            auditTrail: auditLogs.filter((l) => l.targetUserId === targetId),
          },
          error: null,
        };
      }

      if (fnName === 'governance_review_account') {
        const auth = verifyGovernanceCaller(actorUserId, false);
        if (!auth.ok) {
          return { data: null, error: { code: auth.code, message: auth.code } };
        }

        const targetId = String(args.p_target_user_id ?? '');
        const decision = String(args.p_decision ?? '') as GovernanceLifecycleDecision;
        const assignedRole =
          (args.p_assigned_role as AccountRole | null) ?? undefined;
        const reason = String(args.p_reason ?? '').trim();
        const expectedVersion = Number(args.p_expected_version ?? 0);
        const idempotencyKey =
          typeof args.p_idempotency_key === 'string' && args.p_idempotency_key.trim()
            ? args.p_idempotency_key.trim()
            : null;

        if (idempotencyKey && idempotencyResults.has(`${auth.actor.id}:${idempotencyKey}`)) {
          return {
            data: idempotencyResults.get(`${auth.actor.id}:${idempotencyKey}`),
            error: null,
          };
        }

        if (reason.length < 3) {
          return {
            data: null,
            error: { code: 'reason_required', message: 'reason_required' },
          };
        }

        const target = accounts.get(targetId);
        if (!target) {
          return {
            data: null,
            error: { code: 'target_not_found', message: 'target_not_found' },
          };
        }

        // Non-Owner callers cannot govern themselves or any privileged account/role
        if (auth.actorRole !== 'APP_ADMIN') {
          if (target.id === auth.actor.id) {
            return {
              data: null,
              error: { code: 'self_governance_denied', message: 'self_governance_denied' },
            };
          }
          if (targetHasOrRequestsPrivilegedRole(target, assignedRole)) {
            return {
              data: null,
              error: {
                code: 'privileged_target_requires_owner',
                message: 'privileged_target_requires_owner',
              },
            };
          }
        }

        if (target.governanceVersion !== expectedVersion) {
          return {
            data: null,
            error: { code: 'version_conflict', message: 'version_conflict' },
          };
        }

        const effectiveTargetRole = assignedRole ?? target.requestedRole;
        if (!isCanonicalRole(effectiveTargetRole)) {
          return {
            data: null,
            error: { code: 'invalid_role', message: 'invalid_role' },
          };
        }

        // Last-owner protection on SUSPEND, REVOKE, or REJECT of an active APP_ADMIN
        if (
          (decision === 'SUSPEND' || decision === 'REVOKE' || decision === 'REJECT') &&
          target.accountStatus === 'APPROVED' &&
          target.activeRoles.includes('APP_ADMIN') &&
          countActiveApprovedOwners() <= 1
        ) {
          return {
            data: null,
            error: { code: 'last_owner_protection', message: 'last_owner_protection' },
          };
        }

        // Contact confirmation required before APPROVE or REACTIVATE
        if (
          (decision === 'APPROVE' || decision === 'REACTIVATE') &&
          !target.emailConfirmed &&
          !target.phoneConfirmed
        ) {
          return {
            data: null,
            error: { code: 'contact_not_confirmed', message: 'contact_not_confirmed' },
          };
        }

        const previousStatus = target.accountStatus;
        const previousRoles = [...target.activeRoles];
        let resultingStatus: AccountApprovalStatus = previousStatus;
        let resultingRoles: AccountRole[] = [];

        if (decision === 'APPROVE' || decision === 'REACTIVATE') {
          resultingStatus = 'APPROVED';
          resultingRoles = [effectiveTargetRole];
        } else if (decision === 'REJECT') {
          resultingStatus = 'REJECTED';
          resultingRoles = [];
        } else if (decision === 'SUSPEND') {
          resultingStatus = 'SUSPENDED';
          resultingRoles = [];
        } else if (decision === 'REVOKE') {
          resultingStatus = 'REVOKED';
          resultingRoles = [];
        } else {
          return {
            data: null,
            error: { code: 'invalid_transition', message: 'invalid_transition' },
          };
        }

        const nowIso = new Date().toISOString();
        const nextVersion = target.governanceVersion + 1;
        const updatedTarget: GovernanceAccountRecord = {
          ...target,
          accountStatus: resultingStatus,
          activeRoles: resultingRoles,
          requestedRole: effectiveTargetRole,
          statusReason: reason,
          statusReviewedBy: auth.actor.id,
          statusReviewedAt: nowIso,
          governanceVersion: nextVersion,
        };
        accounts.set(target.id, updatedTarget);

        const auditId = `audit-${auditLogs.length + 1}`;
        auditLogs.push({
          id: auditId,
          actorUserId: auth.actor.id,
          actorRole: auth.actorRole,
          targetUserId: target.id,
          action: decision,
          previousStatus,
          resultingStatus,
          previousRoles,
          resultingRoles,
          reason,
          idempotencyKey,
          createdAt: nowIso,
        });

        const mutationResult: GovernanceMutationResult = {
          targetUserId: target.id,
          accountStatus: resultingStatus,
          activeRoles: resultingRoles,
          governanceVersion: nextVersion,
          auditLogId: auditId,
          reviewedAt: nowIso,
        };

        if (idempotencyKey) {
          idempotencyResults.set(`${auth.actor.id}:${idempotencyKey}`, mutationResult);
        }

        return { data: mutationResult, error: null };
      }

      if (fnName === 'governance_appoint_privileged_role') {
        const auth = verifyGovernanceCaller(actorUserId, true);
        if (!auth.ok) {
          return { data: null, error: { code: auth.code, message: auth.code } };
        }

        const confirmed = Boolean(args.p_confirmed);
        if (!confirmed) {
          return {
            data: null,
            error: {
              code: 'explicit_confirmation_required',
              message: 'explicit_confirmation_required',
            },
          };
        }

        const targetId = String(args.p_target_user_id ?? '');
        const role = String(args.p_role ?? '') as PrivilegedRole;
        const action = String(args.p_action ?? '') as PrivilegedAppointmentAction;
        const reason = String(args.p_reason ?? '').trim();
        const expectedVersion = Number(args.p_expected_version ?? 0);

        if (!isPrivilegedRole(role)) {
          return {
            data: null,
            error: { code: 'invalid_role', message: 'invalid_role' },
          };
        }

        if (reason.length < 3) {
          return {
            data: null,
            error: { code: 'reason_required', message: 'reason_required' },
          };
        }

        const target = accounts.get(targetId);
        if (!target) {
          return {
            data: null,
            error: { code: 'target_not_found', message: 'target_not_found' },
          };
        }

        if (target.governanceVersion !== expectedVersion) {
          return {
            data: null,
            error: { code: 'version_conflict', message: 'version_conflict' },
          };
        }

        if (action === 'GRANT' && !target.emailConfirmed && !target.phoneConfirmed) {
          return {
            data: null,
            error: { code: 'contact_not_confirmed', message: 'contact_not_confirmed' },
          };
        }

        if (
          action === 'REVOKE' &&
          role === 'APP_ADMIN' &&
          target.accountStatus === 'APPROVED' &&
          target.activeRoles.includes('APP_ADMIN') &&
          countActiveApprovedOwners() <= 1
        ) {
          return {
            data: null,
            error: { code: 'last_owner_protection', message: 'last_owner_protection' },
          };
        }

        const previousStatus = target.accountStatus;
        const previousRoles = [...target.activeRoles];
        let resultingRoles: AccountRole[];
        let resultingStatus: AccountApprovalStatus = target.accountStatus;

        if (action === 'GRANT') {
          resultingStatus = 'APPROVED';
          resultingRoles = target.activeRoles.includes(role)
            ? [...target.activeRoles]
            : [...target.activeRoles.filter((r) => !isPrivilegedRole(r)), role];
        } else {
          resultingRoles = target.activeRoles.filter((r) => r !== role);
          if (resultingRoles.length === 0) {
            resultingStatus = 'REVOKED';
          }
        }

        const nowIso = new Date().toISOString();
        const nextVersion = target.governanceVersion + 1;
        accounts.set(target.id, {
          ...target,
          accountStatus: resultingStatus,
          activeRoles: resultingRoles,
          statusReason: reason,
          statusReviewedBy: auth.actor.id,
          statusReviewedAt: nowIso,
          governanceVersion: nextVersion,
        });

        const auditId = `audit-${auditLogs.length + 1}`;
        auditLogs.push({
          id: auditId,
          actorUserId: auth.actor.id,
          actorRole: auth.actorRole,
          targetUserId: target.id,
          action:
            action === 'GRANT' ? 'APPOINT_PRIVILEGED_ROLE' : 'REVOKE_PRIVILEGED_ROLE',
          previousStatus,
          resultingStatus,
          previousRoles,
          resultingRoles,
          reason,
          createdAt: nowIso,
        });

        return {
          data: {
            targetUserId: target.id,
            accountStatus: resultingStatus,
            activeRoles: resultingRoles,
            governanceVersion: nextVersion,
            auditLogId: auditId,
            reviewedAt: nowIso,
          } satisfies GovernanceMutationResult,
          error: null,
        };
      }

      return {
        data: null,
        error: { code: 'PGRST202', message: `Could not find the function public.${fnName}` },
      };
    },
  });

  return {
    asActor,
    getAccount: (id: string) => accounts.get(id),
    getAuditLogs: () => [...auditLogs],
  };
}
