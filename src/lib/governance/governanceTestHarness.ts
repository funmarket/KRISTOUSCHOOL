import {
  ORDINARY_ROLES,
  isPrivilegedRole,
  type GovernanceAccountRecord,
  type GovernanceAuditLogEntry,
  type GovernanceMutationResult,
} from './governanceTypes.ts';

function rpcErr(message: string, code = 'P0001') {
  return { data: null, error: { code, message } };
}

/**
 * Deterministic reference server-policy test harness matching the exact authorization,
 * lifecycle, concurrency, and audit invariants in `20261113150000_account_governance_foundation.sql`
 * and `20261114100000_gov02_manager_delegation_and_preferences.sql`.
 */
export function createInMemoryGovernanceTestHarness(
  initialAccounts: GovernanceAccountRecord[],
  initialAuditLog: GovernanceAuditLogEntry[] = [],
) {
  const accounts = initialAccounts.map((a) => ({
    ...a,
    activeRoles: [...a.activeRoles],
    capabilities: [...a.capabilities],
  }));
  const auditTrail = [...initialAuditLog];
  const managerGrants: Array<{ id: string; managerUserId: string; capability: string; active: boolean }> = [];
  const idemCache = new Map<string, GovernanceMutationResult>();
  let mutex: Promise<void> = Promise.resolve();

  const withLock = async <T>(fn: () => T): Promise<T> => {
    const prev = mutex;
    let release!: () => void;
    mutex = new Promise<void>((res) => {
      release = res;
    });
    await prev;
    try {
      return fn();
    } finally {
      release();
    }
  };

  const countActiveOwners = () =>
    accounts.filter((a) => a.accountStatus === 'APPROVED' && a.activeRoles.includes('APP_ADMIN')).length;

  const resolveCaller = (actorId: string | null, requireOwner: boolean) => {
    const actor = actorId ? accounts.find((a) => a.id === actorId) || null : null;
    if (!actor) return { ok: false as const, err: rpcErr('actor_unauthenticated') };
    if (actor.accountStatus !== 'APPROVED') return { ok: false as const, err: rpcErr('actor_not_approved') };
    const isOwner = actor.activeRoles.includes('APP_ADMIN');
    if (requireOwner) {
      return isOwner
        ? { ok: true as const, actor, role: 'APP_ADMIN' as const }
        : { ok: false as const, err: rpcErr('owner_only_operation') };
    }
    if (isOwner) return { ok: true as const, actor, role: 'APP_ADMIN' as const };
    if (actor.activeRoles.includes('ADMINISTRATIVE_PERSONNEL')) {
      return { ok: true as const, actor, role: 'ADMINISTRATIVE_PERSONNEL' as const };
    }
    if (actor.activeRoles.includes('MANAGER')) {
      if (actor.capabilities.includes('ACCOUNT_APPROVAL_REVIEW')) {
        return { ok: true as const, actor, role: 'MANAGER' as const };
      }
      return { ok: false as const, err: rpcErr('manager_delegation_required') };
    }
    return { ok: false as const, err: rpcErr('insufficient_governance_authority') };
  };

  return {
    accounts,
    auditTrail,
    getAuditLogs: () => [...auditTrail],
    getAccount: (id: string) => accounts.find((a) => a.id === id) || null,
    asActor: (actorUserId: string | null) => ({
      rpc: async (fnName: string, args?: Record<string, unknown>) => {
        if (fnName === 'governance_get_actor_scope') {
          const auth = resolveCaller(actorUserId, false);
          if (!auth.ok) return auth.err;
          return {
            data: {
              actorUserId: auth.actor.id,
              actorRole: auth.role,
              accountStatus: auth.actor.accountStatus,
              canReviewOrdinaryAccounts: true,
              canAppointPrivilegedRoles: auth.role === 'APP_ADMIN',
              assignableRoles: [...ORDINARY_ROLES],
              activeOwnerCount: countActiveOwners(),
              pendingCount: accounts.filter((a) => a.accountStatus === 'PENDING').length,
              approvedCount: accounts.filter((a) => a.accountStatus === 'APPROVED').length,
              suspendedCount: accounts.filter((a) => a.accountStatus === 'SUSPENDED').length,
              revokedCount: accounts.filter((a) => a.accountStatus === 'REVOKED').length,
            },
            error: null,
          };
        }

        if (fnName === 'governance_list_pending_accounts' || fnName === 'governance_list_account_directory') {
          const auth = resolveCaller(actorUserId, false);
          if (!auth.ok) return auth.err;
          const isPendingOnly = fnName === 'governance_list_pending_accounts';
          const statusFilter = isPendingOnly ? 'PENDING' : (args?.p_status as string | null) ?? null;
          const roleFilter = (args?.p_requested_role ?? args?.p_role ?? null) as string | null;
          const search = typeof args?.p_search === 'string' ? args.p_search.trim().toLowerCase() : '';
          const filtered = accounts.filter((a) => {
            if (statusFilter && a.accountStatus !== statusFilter) return false;
            if (roleFilter && a.requestedRole !== roleFilter && !a.activeRoles.includes(roleFilter as any)) return false;
            if (search && !`${a.fullName} ${a.username} ${a.email ?? ''}`.toLowerCase().includes(search)) return false;
            return true;
          });
          return {
            data: {
              items: filtered.map((a) => ({ ...a, actionableByCaller: auth.role === 'APP_ADMIN' || (!isPrivilegedRole(a.requestedRole) && !a.activeRoles.some(isPrivilegedRole) && a.id !== auth.actor.id) })),
              totalCount: filtered.length,
              limit: Number(args?.p_limit ?? 25),
              offset: Number(args?.p_offset ?? 0),
            },
            error: null,
          };
        }

        if (fnName === 'governance_get_account_detail') {
          const auth = resolveCaller(actorUserId, false);
          if (!auth.ok) return auth.err;
          const target = accounts.find((a) => a.id === args?.p_target_user_id);
          if (!target) return rpcErr('target_not_found', 'PGRST116');
          return { data: { account: { ...target }, auditTrail: auditTrail.filter((l) => l.targetUserId === target.id) }, error: null };
        }

        if (fnName === 'governance_review_account') {
          const entryAuth = resolveCaller(actorUserId, false);
          if (!entryAuth.ok) return entryAuth.err;
          return withLock(() => {
            const actor = entryAuth.actor;
            const callerRole = entryAuth.role;
            const reason = typeof args?.p_reason === 'string' ? args.p_reason.trim() : '';
            if (reason.length < 3) return rpcErr('reason_required');
            const idem = typeof args?.p_idempotency_key === 'string' ? args.p_idempotency_key.trim() : '';
            if (idem) {
              const cached = idemCache.get(`${actor.id}::${idem}`);
              if (cached) return { data: cached, error: null };
            }
            const target = accounts.find((a) => a.id === args?.p_target_user_id);
            if (!target) return rpcErr('target_not_found');
            const decision = String(args?.p_decision ?? '');
            const assignedRole = (args?.p_assigned_role as any) || null;
            const effectiveRole = assignedRole ?? target.requestedRole;
            const targetHasPriv = target.activeRoles.some(isPrivilegedRole);
            if (callerRole !== 'APP_ADMIN') {
              if (target.id === actor.id) return rpcErr('self_governance_denied');
              if (targetHasPriv || isPrivilegedRole(target.requestedRole) || isPrivilegedRole(effectiveRole)) {
                return rpcErr('privileged_target_requires_owner');
              }
            }
            if ((decision === 'APPROVE' || decision === 'REACTIVATE') && (isPrivilegedRole(effectiveRole) || targetHasPriv)) {
              return rpcErr('explicit_confirmation_required');
            }
            if (args?.p_expected_version !== target.governanceVersion) return rpcErr('version_conflict');
            if ((decision === 'APPROVE' || decision === 'REACTIVATE') && !target.emailConfirmed && !target.phoneConfirmed) {
              return rpcErr('contact_not_confirmed');
            }
            if ((decision === 'SUSPEND' || decision === 'REVOKE' || decision === 'REJECT') && target.accountStatus === 'APPROVED' && target.activeRoles.includes('APP_ADMIN') && countActiveOwners() <= 1) {
              return rpcErr('last_owner_protection');
            }
            const prevStatus = target.accountStatus;
            const prevRoles = [...target.activeRoles];
            if (decision === 'APPROVE' || decision === 'REACTIVATE') {
              target.accountStatus = 'APPROVED';
              target.requestedRole = effectiveRole;
              target.activeRoles = [effectiveRole];
            } else if (decision === 'REJECT') {
              target.accountStatus = 'REJECTED';
              target.activeRoles = [];
            } else if (decision === 'SUSPEND') {
              target.accountStatus = 'SUSPENDED';
              target.activeRoles = [];
            } else if (decision === 'REVOKE') {
              target.accountStatus = 'REVOKED';
              target.activeRoles = [];
            } else {
              return rpcErr('invalid_transition');
            }
            target.governanceVersion += 1;
            const auditId = 'audit-' + Math.random().toString(36).slice(2, 10);
            const reviewedAt = new Date().toISOString();
            auditTrail.push({
              id: auditId,
              actorUserId: actor.id,
              actorRole: callerRole,
              targetUserId: target.id,
              action: decision as any,
              previousStatus: prevStatus,
              resultingStatus: target.accountStatus,
              previousRoles: prevRoles,
              resultingRoles: [...target.activeRoles],
              reason,
              idempotencyKey: idem || null,
              createdAt: reviewedAt,
            });
            const resPayload: GovernanceMutationResult = {
              targetUserId: target.id,
              accountStatus: target.accountStatus,
              activeRoles: [...target.activeRoles],
              governanceVersion: target.governanceVersion,
              auditLogId: auditId,
              reviewedAt,
            };
            if (idem) idemCache.set(`${actor.id}::${idem}`, resPayload);
            return { data: resPayload, error: null };
          });
        }

        if (fnName === 'governance_appoint_privileged_role') {
          const entryAuth = resolveCaller(actorUserId, true);
          if (!entryAuth.ok) return entryAuth.err;
          return withLock(() => {
            const actor = entryAuth.actor;
            if (!args?.p_confirmed) return rpcErr('explicit_confirmation_required');
            const role = String(args?.p_role ?? '');
            if (!isPrivilegedRole(role)) return rpcErr('invalid_role');
            const action = String(args?.p_action ?? '');
            if (action !== 'GRANT' && action !== 'REVOKE') return rpcErr('invalid_transition');
            const reason = typeof args?.p_reason === 'string' ? args.p_reason.trim() : '';
            if (reason.length < 3) return rpcErr('reason_required');
            const target = accounts.find((a) => a.id === args?.p_target_user_id);
            if (!target) return rpcErr('target_not_found');
            if (args?.p_expected_version !== target.governanceVersion) return rpcErr('version_conflict');
            if (action === 'GRANT' && !target.emailConfirmed && !target.phoneConfirmed) return rpcErr('contact_not_confirmed');
            if (((action === 'REVOKE' && role === 'APP_ADMIN') || (action === 'GRANT' && role === 'MANAGER')) && target.accountStatus === 'APPROVED' && target.activeRoles.includes('APP_ADMIN') && countActiveOwners() <= 1) {
              return rpcErr('last_owner_protection');
            }
            const prevStatus = target.accountStatus;
            const prevRoles = [...target.activeRoles];
            if (action === 'GRANT') {
              target.accountStatus = 'APPROVED';
              target.activeRoles = [...target.activeRoles.filter((r) => !isPrivilegedRole(r)), role as any];
            } else {
              target.activeRoles = target.activeRoles.filter((r) => r !== role);
              if (target.activeRoles.length === 0) target.accountStatus = 'REVOKED';
            }
            target.governanceVersion += 1;
            const auditId = 'audit-' + Math.random().toString(36).slice(2, 10);
            const reviewedAt = new Date().toISOString();
            auditTrail.push({
              id: auditId,
              actorUserId: actor.id,
              actorRole: 'APP_ADMIN',
              targetUserId: target.id,
              action: action === 'GRANT' ? 'APPOINT_PRIVILEGED_ROLE' : 'REVOKE_PRIVILEGED_ROLE',
              previousStatus: prevStatus,
              resultingStatus: target.accountStatus,
              previousRoles: prevRoles,
              resultingRoles: [...target.activeRoles],
              reason,
              createdAt: reviewedAt,
            });
            return {
              data: {
                targetUserId: target.id,
                accountStatus: target.accountStatus,
                activeRoles: [...target.activeRoles],
                governanceVersion: target.governanceVersion,
                auditLogId: auditId,
                reviewedAt,
              },
              error: null,
            };
          });
        }

        if (fnName === 'governance_list_manager_grants') {
          const auth = resolveCaller(actorUserId, true);
          if (!auth.ok) return auth.err;
          return {
            data: {
              managers: accounts.filter((a) => a.activeRoles.includes('MANAGER') && a.accountStatus === 'APPROVED'),
              grants: managerGrants.map((g) => {
                const mgr = accounts.find((a) => a.id === g.managerUserId);
                return { id: g.id, managerUserId: g.managerUserId, managerUsername: mgr?.username ?? '', managerFullName: mgr?.fullName ?? '', capability: g.capability, active: g.active, grantedBy: auth.actor.id, grantedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
              }),
            },
            error: null,
          };
        }

        if (fnName === 'governance_set_manager_capability') {
          const auth = resolveCaller(actorUserId, true);
          if (!auth.ok) return auth.err;
          const mgrId = String(args?.p_manager_user_id ?? '');
          const cap = String(args?.p_capability ?? '');
          const active = Boolean(args?.p_active);
          const existing = managerGrants.find((g) => g.managerUserId === mgrId && g.capability === cap);
          const grantId = existing ? existing.id : 'grant-' + Math.random().toString(36).slice(2, 9);
          if (existing) existing.active = active;
          else managerGrants.push({ id: grantId, managerUserId: mgrId, capability: cap, active });
          const auditId = 'audit-' + Math.random().toString(36).slice(2, 9);
          auditTrail.push({
            id: auditId,
            actorUserId: auth.actor.id,
            actorRole: 'APP_ADMIN',
            targetUserId: mgrId,
            action: active ? 'GRANT_MANAGER_CAPABILITY' : 'REVOKE_MANAGER_CAPABILITY',
            capability: cap,
            previousStatus: 'APPROVED',
            resultingStatus: 'APPROVED',
            previousRoles: ['MANAGER'],
            resultingRoles: ['MANAGER'],
            reason: String(args?.p_reason ?? ''),
            createdAt: new Date().toISOString(),
          });
          return { data: { grantId, managerUserId: mgrId, capability: cap, active, auditLogId: auditId }, error: null };
        }

        return rpcErr('not_implemented', 'PGRST202');
      },
    }),
  };
}
