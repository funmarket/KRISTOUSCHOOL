import { supabase } from '../supabase.ts';
import type { AccountRole, AccountApprovalStatus } from '../../types.ts';
import {
  classifyGovernanceRpcError,
  type GovernanceAccountDetail,
  type GovernanceAccountRecord,
  type GovernanceActorScope,
  type GovernanceResult,
  type GovernanceRpcClient,
  type ManagerDelegationPayload,
  type PaginatedGovernanceList,
} from './governanceTypes.ts';
import { fetchManagerDelegations } from './governanceMutations.ts';

function resolveRpcClient(clientOverride?: GovernanceRpcClient | null): GovernanceRpcClient | null {
  if (clientOverride !== undefined) return clientOverride;
  return (supabase as unknown as GovernanceRpcClient | null) ?? null;
}

function mapAccountRecord(r: any): GovernanceAccountRecord {
  return {
    id: r.id,
    username: r.username,
    fullName: r.fullName ?? r.full_name ?? r.username,
    email: r.email ?? null,
    phone: r.phone ?? null,
    emailConfirmed: Boolean(r.emailConfirmed ?? r.email_confirmed),
    phoneConfirmed: Boolean(r.phoneConfirmed ?? r.phone_confirmed),
    requestedRole: (r.requestedRole ?? r.requested_role) as AccountRole,
    accountStatus: (r.accountStatus ?? r.account_status) as AccountApprovalStatus,
    activeRoles: Array.isArray(r.activeRoles ?? r.active_roles) ? ((r.activeRoles ?? r.active_roles) as AccountRole[]) : [],
    capabilities: Array.isArray(r.capabilities) ? (r.capabilities as string[]) : [],
    staffId: r.staffId ?? r.staff_id ?? null,
    admissionId: r.admissionId ?? r.admission_id ?? null,
    statusReason: r.statusReason ?? r.status_reason ?? null,
    statusReviewedBy: r.statusReviewedBy ?? r.status_reviewed_by ?? null,
    statusReviewedAt: r.statusReviewedAt ?? r.status_reviewed_at ?? null,
    governanceVersion: typeof (r.governanceVersion ?? r.governance_version) === 'number' ? (r.governanceVersion ?? r.governance_version) : 1,
    createdAt: r.createdAt ?? r.created_at,
    actionableByCaller:
      (r.actionableByCaller ?? r.actionable_by_caller) !== undefined
        ? Boolean(r.actionableByCaller ?? r.actionable_by_caller)
        : true,
  };
}

export async function fetchGovernanceActorScope(
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<GovernanceActorScope>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return { ok: false, errorCode: 'backend_unavailable', errorMessage: 'Supabase client is not configured in this build.' };
  }
  try {
    const { data, error } = await client.rpc('governance_get_actor_scope');
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, errorCode: 'governance_operation_failed', errorMessage: 'Invalid scope payload received from RPC.' };
    }
    const row = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        actorUserId: typeof (row.actorUserId ?? row.actor_user_id) === 'string' ? String(row.actorUserId ?? row.actor_user_id) : '',
        actorRole: (typeof (row.actorRole ?? row.actor_role) === 'string' ? String(row.actorRole ?? row.actor_role) : 'STUDENT') as AccountRole,
        accountStatus: (typeof (row.accountStatus ?? row.account_status) === 'string' ? String(row.accountStatus ?? row.account_status) : 'PENDING') as AccountApprovalStatus,
        canReviewOrdinaryAccounts: Boolean(row.canReviewOrdinaryAccounts ?? row.can_review_ordinary_accounts),
        canAppointPrivilegedRoles: Boolean(row.canAppointPrivilegedRoles ?? row.can_appoint_privileged_roles),
        assignableRoles: Array.isArray(row.assignableRoles ?? row.assignable_roles)
          ? ((row.assignableRoles ?? row.assignable_roles) as AccountRole[])
          : [],
        activeOwnerCount: Number(row.activeOwnerCount ?? row.active_owner_count ?? 0),
        pendingCount: Number(row.pendingCount ?? row.pending_count ?? 0),
        approvedCount: Number(row.approvedCount ?? row.approved_count ?? 0),
        suspendedCount: Number(row.suspendedCount ?? row.suspended_count ?? 0),
        revokedCount: Number(row.revokedCount ?? row.revoked_count ?? 0),
      },
    };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
  }
}

export async function listPendingAccounts(
  params?: { limit?: number; offset?: number; requestedRole?: AccountRole | 'ALL' | null; role?: AccountRole | 'ALL' | null; searchQuery?: string | null; search?: string | null; clientOverride?: GovernanceRpcClient | null } | GovernanceRpcClient | null,
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<PaginatedGovernanceList<GovernanceAccountRecord>>> {
  const isDirectClient = typeof params === 'object' && params !== null && 'rpc' in params;
  const opts = !isDirectClient && typeof params === 'object' && params !== null ? params : {};
  const client = resolveRpcClient(isDirectClient ? (params as GovernanceRpcClient) : (clientOverride !== undefined ? clientOverride : opts.clientOverride));
  if (!client) {
    return { ok: false, errorCode: 'backend_unavailable', errorMessage: 'Supabase client is not configured in this build.' };
  }
  try {
    const rawRole = opts.requestedRole ?? opts.role ?? null;
    const rawSearch = opts.searchQuery ?? opts.search ?? null;
    const { data, error } = await client.rpc('governance_list_pending_accounts', {
      p_limit: opts.limit ?? 25,
      p_offset: opts.offset ?? 0,
      p_requested_role: rawRole && rawRole !== 'ALL' ? rawRole : null,
      p_search: rawSearch && rawSearch.trim() ? rawSearch.trim() : null,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, errorCode: 'governance_operation_failed', errorMessage: 'Invalid pending accounts payload.' };
    }
    const payload = data as Record<string, unknown>;
    const items = (Array.isArray(payload.items) ? payload.items : []).map(mapAccountRecord);
    return {
      ok: true,
      data: {
        items,
        totalCount: Number(payload.totalCount ?? payload.total_count ?? items.length),
        limit: Number(payload.limit ?? opts.limit ?? 25),
        offset: Number(payload.offset ?? opts.offset ?? 0),
      },
    };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
  }
}

export async function listAccountDirectory(
  params?: { limit?: number; offset?: number; status?: AccountApprovalStatus | 'ALL' | null; statusFilter?: AccountApprovalStatus | 'ALL' | null; role?: AccountRole | 'ALL' | null; roleFilter?: AccountRole | 'ALL' | null; searchQuery?: string | null; search?: string | null; clientOverride?: GovernanceRpcClient | null } | GovernanceRpcClient | null,
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<PaginatedGovernanceList<GovernanceAccountRecord>>> {
  const isDirectClient = typeof params === 'object' && params !== null && 'rpc' in params;
  const opts = !isDirectClient && typeof params === 'object' && params !== null ? params : {};
  const client = resolveRpcClient(isDirectClient ? (params as GovernanceRpcClient) : (clientOverride !== undefined ? clientOverride : opts.clientOverride));
  if (!client) {
    return { ok: false, errorCode: 'backend_unavailable', errorMessage: 'Supabase client is not configured in this build.' };
  }
  try {
    const rawStatus = opts.status ?? opts.statusFilter ?? null;
    const rawRole = opts.role ?? opts.roleFilter ?? null;
    const rawSearch = opts.searchQuery ?? opts.search ?? null;
    const { data, error } = await client.rpc('governance_list_account_directory', {
      p_limit: opts.limit ?? 25,
      p_offset: opts.offset ?? 0,
      p_status: rawStatus && rawStatus !== 'ALL' ? rawStatus : null,
      p_role: rawRole && rawRole !== 'ALL' ? rawRole : null,
      p_search: rawSearch && rawSearch.trim() ? rawSearch.trim() : null,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, errorCode: 'governance_operation_failed', errorMessage: 'Invalid account directory payload.' };
    }
    const payload = data as Record<string, unknown>;
    const items = (Array.isArray(payload.items) ? payload.items : []).map(mapAccountRecord);
    return {
      ok: true,
      data: {
        items,
        totalCount: Number(payload.totalCount ?? payload.total_count ?? items.length),
        limit: Number(payload.limit ?? opts.limit ?? 25),
        offset: Number(payload.offset ?? opts.offset ?? 0),
      },
    };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
  }
}

export async function listGovernanceAccounts(params?: {
  limit?: number;
  offset?: number;
  statusFilter?: AccountApprovalStatus | null;
  roleFilter?: AccountRole | null;
  searchQuery?: string | null;
  clientOverride?: GovernanceRpcClient | null;
}): Promise<GovernanceResult<PaginatedGovernanceList<GovernanceAccountRecord>>> {
  return listAccountDirectory({
    limit: params?.limit,
    offset: params?.offset,
    status: params?.statusFilter ?? null,
    role: params?.roleFilter ?? null,
    searchQuery: params?.searchQuery ?? null,
  }, params?.clientOverride);
}

export async function fetchGovernanceAccountDetail(params: {
  targetUserId: string;
  clientOverride?: GovernanceRpcClient | null;
}): Promise<GovernanceResult<GovernanceAccountDetail>> {
  const client = resolveRpcClient(params.clientOverride);
  if (!client) {
    return { ok: false, errorCode: 'backend_unavailable', errorMessage: 'Supabase client is not configured in this build.' };
  }
  try {
    const { data, error } = await client.rpc('governance_get_account_detail', {
      p_target_user_id: params.targetUserId,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, errorCode: 'target_not_found', errorMessage: 'Account detail not found.' };
    }
    const payload = data as Record<string, unknown>;
    const account = mapAccountRecord(payload.account as Record<string, unknown>);
    const rawAudit = Array.isArray(payload.auditTrail ?? payload.audit_trail) ? ((payload.auditTrail ?? payload.audit_trail) as any[]) : [];
    const auditTrail = rawAudit.map((a: any) => ({
      id: a.id,
      actorUserId: a.actorUserId ?? a.actor_user_id,
      actorRole: a.actorRole ?? a.actor_role,
      targetUserId: a.targetUserId ?? a.target_user_id,
      action: a.action,
      capability: a.capability ?? null,
      previousStatus: a.previousStatus ?? a.previous_status,
      resultingStatus: a.resultingStatus ?? a.resulting_status,
      previousRoles: Array.isArray(a.previousRoles ?? a.previous_roles) ? (a.previousRoles ?? a.previous_roles) : [],
      resultingRoles: Array.isArray(a.resultingRoles ?? a.resulting_roles) ? (a.resultingRoles ?? a.resulting_roles) : [],
      reason: a.reason,
      idempotencyKey: a.idempotencyKey ?? a.idempotency_key ?? null,
      createdAt: a.createdAt ?? a.created_at,
    }));
    return { ok: true, data: { account, auditTrail } };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
  }
}

export async function getAccountGovernanceDetail(
  targetUserId: string,
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<GovernanceAccountDetail>> {
  return fetchGovernanceAccountDetail({ targetUserId, clientOverride });
}

export async function listManagerGrants(
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<ManagerDelegationPayload>> {
  return fetchManagerDelegations(clientOverride);
}

export async function listApprovedAccounts(params?: any, clientOverride?: GovernanceRpcClient | null) {
  const isDirectClient = typeof params === 'object' && params !== null && 'rpc' in params;
  const opts = !isDirectClient && typeof params === 'object' && params !== null ? params : {};
  const client = isDirectClient ? (params as GovernanceRpcClient) : clientOverride;
  return listAccountDirectory({ ...opts, status: 'APPROVED' }, client);
}