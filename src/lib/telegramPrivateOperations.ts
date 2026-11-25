import { getTelegramWebAppInitData } from './telegram.ts';
import { supabase } from './supabase.ts';

export type TelegramPrivateOperation =
  | 'governance.actorScope'
  | 'governance.pendingAccounts'
  | 'governance.accountDirectory'
  | 'governance.accountDetail'
  | 'notifications.list'
  | 'notifications.markOne'
  | 'notifications.markAll'
  | 'preferences.load'
  | 'preferences.save';

export interface TelegramPrivateOperationResult<T = unknown> {
  handled: boolean;
  data?: T;
}

const GOVERNANCE_ERROR_CODES = new Set([
  'actor_unauthenticated',
  'actor_not_approved',
  'insufficient_governance_authority',
  'manager_delegation_required',
  'owner_only_operation',
  'target_not_found',
  'backend_unavailable',
]);

async function getRemoteError(error: any): Promise<Error> {
  const context = error?.context;
  let payload: any = null;
  if (context) {
    try {
      const response = typeof context.clone === 'function' ? context.clone() : context;
      if (typeof response.json === 'function') payload = await response.json();
    } catch {
      payload = null;
    }
  }

  const rawCode = typeof payload?.error === 'string'
    ? payload.error
    : typeof payload?.code === 'string'
      ? payload.code
      : '';
  const code = rawCode === 'telegram_auth_expired' || rawCode === 'invalid_telegram_auth' ||
      rawCode === 'telegram_not_linked' || rawCode === 'telegram_identity_conflict'
    ? 'actor_unauthenticated'
    : rawCode === 'account_not_approved'
      ? 'actor_not_approved'
      : GOVERNANCE_ERROR_CODES.has(rawCode)
        ? rawCode
        : context?.status === 503
          ? 'backend_unavailable'
          : 'operation_failed';
  return Object.assign(new Error(code), {
    code,
    status: typeof context?.status === 'number' ? context.status : undefined,
  });
}

/**
 * Telegram has no Supabase Auth session. Route its private work through the
 * server verifier; once in Telegram context, a gateway failure never falls
 * back to anonymous PostgREST access.
 */
export async function invokeTelegramPrivateOperation<T = unknown>(
  operation: TelegramPrivateOperation,
  params: Record<string, unknown> = {},
  clientOverride?: any,
): Promise<TelegramPrivateOperationResult<T>> {
  if (typeof window === 'undefined' || !getTelegramWebAppInitData()) return { handled: false };

  const client = clientOverride ?? supabase;
  if (!client?.functions || typeof client.functions.invoke !== 'function') {
    throw Object.assign(new Error('backend_unavailable'), { code: 'backend_unavailable' });
  }

  const initData = getTelegramWebAppInitData();
  if (!initData) throw Object.assign(new Error('actor_unauthenticated'), { code: 'actor_unauthenticated' });

  const { data, error } = await client.functions.invoke('telegram-private-ops', {
    body: { initData, operation, params },
  });
  if (error) throw await getRemoteError(error);
  return { handled: true, data: data as T };
}

