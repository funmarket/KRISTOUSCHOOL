import type { BackendOpResult, User } from '../../types.ts';

export type ClassReceipt = { id: string; name: string; levelCode: string };
export type RefreshOutcome = 'pending' | 'failed' | 'unverified' | 'refreshed';
export interface ClassCreationFeedback {
  generation: number;
  outcome: 'pending' | 'failed' | 'unknown' | 'confirmed';
  receipt?: ClassReceipt;
  refresh: RefreshOutcome;
  error?: string;
}

/** Presentation scope only. The existing permission owner and server authorize writes. */
export function getClassCreationScope(user: User | null | undefined, allowed: boolean): string | null {
  if (!user || user.accountStatus !== 'APPROVED' || !allowed) return null;
  return JSON.stringify([user.id, user.role, user.accountStatus, [...new Set(user.capabilities ?? [])].sort()]);
}

export interface ClassOperationToken { readonly generation: number; readonly sequence: number }

/** Synchronous exclusion and invalidation; a stale completion cannot release a newer operation. */
export class ClassOperationGate {
  generation = 0;
  private scope: string | null = null;
  private sequence = 0;
  private active: ClassOperationToken | null = null;
  private mounted = true;

  configure(scope: string | null): void {
    if (scope === this.scope) return;
    this.scope = scope;
    this.generation++;
    this.active = null;
  }
  resume(): void { this.mounted = true; }
  dispose(): void { this.mounted = false; this.generation++; this.active = null; }
  begin(): ClassOperationToken | null {
    if (!this.mounted || !this.scope || this.active) return null;
    this.active = { generation: this.generation, sequence: ++this.sequence };
    return this.active;
  }
  isCurrent(token: ClassOperationToken): boolean {
    return this.mounted && this.scope !== null && this.active === token && token.generation === this.generation;
  }
  release(token: ClassOperationToken): boolean {
    if (!this.isCurrent(token)) return false;
    this.active = null;
    return true;
  }
}

export function classifyClassRefreshResult(result: boolean | void): RefreshOutcome {
  // Even true confirms only the callback, never the presence of the created identity.
  return result === false ? 'failed' : result === true ? 'refreshed' : 'unverified';
}

export function classifyClassCreationResult(result: BackendOpResult<ClassReceipt>): {
  outcome: 'confirmed' | 'failed' | 'unknown'; receipt?: ClassReceipt; error?: string;
} {
  if (result.ok) {
    const row = result.data;
    if (row && typeof row.id === 'string' && row.id.trim() &&
        typeof row.name === 'string' && row.name.trim() && typeof row.levelCode === 'string' && row.levelCode.trim()) {
      return { outcome: 'confirmed', receipt: row };
    }
    return { outcome: 'unknown' };
  }
  const code = result.errorCode ?? '';
  // An explicit authorization/contract/validation rejection is distinct from an uncertain transport outcome.
  const rejected = result.status === 'UNAUTHORIZED' || result.status === 'BLOCKED_BACKEND' ||
    /^(invalid_|actor_|insufficient_authority|23505|23514|23503)/.test(code) ||
    code.includes('duplicate key value violates unique constraint');
  return { outcome: rejected ? 'failed' : 'unknown', error: result.errorMessage || code };
}

export function resolveClassReadback(
  receipt: ClassReceipt | undefined,
  refresh: RefreshOutcome,
  backendStatus: string,
  classes: readonly { id: string }[],
): 'pending' | 'failed' | 'confirmed' | 'unverified' {
  if (refresh === 'pending') return 'pending';
  // The shared refresh callback covers many domains and can return true even if class hydration failed.
  if (refresh === 'failed' || backendStatus === 'ERROR' || backendStatus === 'BACKEND_NOT_IMPLEMENTED') return 'failed';
  return receipt && backendStatus === 'READY' && classes.some((row) => row.id === receipt.id)
    ? 'confirmed' : 'unverified';
}
