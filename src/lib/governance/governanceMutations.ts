import { supabase } from '../supabase.ts';
import {
  ALLOWED_MANAGER_CAPABILITIES,
  classifyGovernanceRpcError,
  isPrivilegedRole,
  type AppointPrivilegedRoleCommand,
  type GovernanceMutationResult,
  type GovernanceResult,
  type GovernanceRpcClient,
  type ManagerDelegationPayload,
  type ReviewAccountCommand,
  type SetManagerCapabilityResult,
} from './governanceTypes.ts';

function resolveRpcClient(clientOverride?: GovernanceRpcClient | null): GovernanceRpcClient | null {
  if (clientOverride !== undefined) return clientOverride;
  return (supabase as unknown as GovernanceRpcClient | null) ?? null;
}

function mapMutationResult(data: unknown, fallbackTargetUserId: string): GovernanceMutationResult {
  const row = data as Record<string, unknown>;
  return {
    targetUserId: String(row.targetUserId ?? row.target_user_id ?? fallbackTargetUserId),
    accountStatus: String(row.accountStatus ?? row.account_status ?? 'APPROVED') as any,
    activeRoles: Array.isArray(row.activeRoles ?? row.active_roles) ? ((row.activeRoles ?? row.active_roles) as any) : [],
    governanceVersion: Number(row.governanceVersion ?? row.governance_version ?? 1),
    auditLogId: String(row.auditLogId ?? row.audit_log_id ?? ''),
    reviewedAt: String(row.reviewedAt ?? row.reviewed_at ?? new Date().toISOString()),
  };
}

export async function reviewAccountLifecycle(
  command: ReviewAccountCommand,
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<GovernanceMutationResult>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return { ok: false, errorCode: 'backend_unavailable', errorMessage: 'Supabase client is not configured in this build.' };
  }
  try {
    const { data, error } = await client.rpc('governance_review_account', {
      p_target_user_id: command.targetUserId,
      p_decision: command.decision,
      p_assigned_role: command.assignedRole ?? null,
      p_reason: command.reason,
      p_expected_version: command.expectedVersion,
      p_idempotency_key: command.idempotencyKey ?? null,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, errorCode: 'governance_operation_failed', errorMessage: 'Invalid review account mutation response.' };
    }
    return { ok: true, data: mapMutationResult(data, command.targetUserId) };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
  }
}

export async function appointPrivilegedRole(
  command: AppointPrivilegedRoleCommand,
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<GovernanceMutationResult>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return { ok: false, errorCode: 'backend_unavailable', errorMessage: 'Supabase client is not configured in this build.' };
  }
  if (!isPrivilegedRole(command.role)) {
    return { ok: false, errorCode: 'invalid_role', errorMessage: 'Specified role is not a privileged administrative role.' };
  }
  try {
    const { data, error } = await client.rpc('governance_appoint_privileged_role', {
      p_target_user_id: command.targetUserId,
      p_role: command.role,
      p_action: command.action,
      p_reason: command.reason,
      p_expected_version: command.expectedVersion,
      p_confirmed: command.confirmed,
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, errorCode: 'governance_operation_failed', errorMessage: 'Invalid appoint privileged role response.' };
    }
    return { ok: true, data: mapMutationResult(data, command.targetUserId) };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
  }
}

export async function fetchManagerDelegations(
  clientOverride?: GovernanceRpcClient | null,
): Promise<GovernanceResult<ManagerDelegationPayload>> {
  const client = resolveRpcClient(clientOverride);
  if (!client) {
    return { ok: false, errorCode: 'backend_unavailable', errorMessage: 'Supabase client is not configured in this build.' };
  }
  try {
    const { data, error } = await client.rpc('governance_list_manager_grants');
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, errorCode: 'governance_operation_failed', errorMessage: 'Invalid manager delegations payload.' };
    }
    const payload = data as Record<string, unknown>;
    const managers = Array.isArray(payload.managers)
      ? payload.managers.map((m: any) => ({
          id: m.id,
          username: m.username,
          fullName: m.fullName ?? m.full_name,
          email: m.email ?? null,
          accountStatus: m.accountStatus ?? m.account_status,
          governanceVersion: typeof (m.governanceVersion ?? m.governance_version) === 'number' ? (m.governanceVersion ?? m.governance_version) : 1,
        }))
      : [];
    const grants = Array.isArray(payload.grants)
      ? payload.grants.map((g: any) => ({
          id: g.id,
          managerUserId: g.managerUserId ?? g.manager_user_id,
          managerUsername: g.managerUsername ?? g.manager_username,
          managerFullName: g.managerFullName ?? g.manager_full_name,
          capability: g.capability,
          active: Boolean(g.active),
          grantedBy: g.grantedBy ?? g.granted_by ?? null,
          grantedAt: g.grantedAt ?? g.granted_at,
          updatedAt: g.updatedAt ?? g.updated_at,
        }))
      : [];
    return { ok: true, data: { managers, grants } };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
  }
}

export async function setManagerCapability(
  params: {
    managerUserId: string;
    capability: string;
    active: boolean;
    reason?: string;
    clientOverride?: GovernanceRpcClient | null;
  },
  clientOverrideArg?: GovernanceRpcClient | null,
): Promise<GovernanceResult<SetManagerCapabilityResult>> {
  const client = resolveRpcClient(clientOverrideArg !== undefined ? clientOverrideArg : params.clientOverride);
  if (!client) {
    return { ok: false, errorCode: 'backend_unavailable', errorMessage: 'Supabase client is not configured in this build.' };
  }
  if (!ALLOWED_MANAGER_CAPABILITIES.includes(params.capability as any)) {
    return { ok: false, errorCode: 'invalid_capability', errorMessage: 'Specified manager capability is invalid.' };
  }
  try {
    const { data, error } = await client.rpc('governance_set_manager_capability', {
      p_manager_user_id: params.managerUserId,
      p_capability: params.capability,
      p_active: params.active,
      p_reason: params.reason ?? '',
    });
    if (error) {
      const classified = classifyGovernanceRpcError(error);
      return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, errorCode: 'governance_operation_failed', errorMessage: 'Invalid set manager capability response.' };
    }
    const row = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        grantId: String(row.grantId ?? row.grant_id ?? ''),
        managerUserId: String(row.managerUserId ?? row.manager_user_id ?? params.managerUserId),
        capability: String(row.capability ?? params.capability),
        active: Boolean(row.active),
        auditLogId: String(row.auditLogId ?? row.audit_log_id ?? ''),
      },
    };
  } catch (err) {
    const classified = classifyGovernanceRpcError(err);
    return { ok: false, errorCode: classified.errorCode, errorMessage: classified.errorMessage };
  }
}
