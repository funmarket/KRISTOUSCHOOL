import * as supabaseModule from './supabase.ts';
import { createTelegramLinkUrl } from './telegram.ts';
import { AUTH_ROLE_MAP, resolveCanonicalAccountRole } from './authRoles.ts';
import type { User } from '../types.ts';

export type TelegramAuthResult = { user: User; linked: boolean; apiToken?: string | null };

let lastTelegramAuthAttempt: { initData: string; result: Promise<TelegramAuthResult> } | null = null;

function clearTelegramApiAuthState() {
  const clearFn = (supabaseModule as { clearTelegramApiAuthorization?: () => void }).clearTelegramApiAuthorization;
  clearFn?.();
}

function attachTelegramApiAuthState(token: string, userId: string): string {
  const setFn = (
    supabaseModule as {
      setTelegramApiAuthorization?: (tok: string, uid: string) => { token: string };
    }
  ).setTelegramApiAuthorization;
  if (typeof setFn !== 'function') {
    throw new Error('telegram_api_authorization_unavailable');
  }
  return setFn(token, userId).token;
}

export function clearTelegramAuthCache() {
  lastTelegramAuthAttempt = null;
  clearTelegramApiAuthState();
}

async function readFunctionsErrorCode(error: any): Promise<string | null> {
  const context = error?.context;
  if (!context) return null;
  try {
    const payload =
      typeof context.clone === 'function'
        ? await context.clone().json()
        : typeof context.json === 'function'
        ? await context.json()
        : null;
    return typeof payload?.error === 'string' && payload.error.trim() ? payload.error.trim() : null;
  } catch {
    return null;
  }
}

export async function createTelegramLinkChallenge() {
  const client = supabaseModule.requireSupabaseClient();
  const { data, error } = await client.functions.invoke('telegram-link-challenge', { body: {} });
  if (error || !data?.linkCode) throw error ?? new Error('Unable to start Telegram linking');
  return {
    linkUrl: createTelegramLinkUrl(data.linkCode as string),
    expiresInSeconds: Number(data.expiresInSeconds) || 600,
  };
}

export function authenticateTelegramInitData(
  initData: string,
  clientOverride?: {
    functions: { invoke: (fn: string, opts: any) => Promise<{ data: any; error: any }> };
    auth?: {
      getSession?: () => Promise<{ data?: { session?: { user?: { id?: string } } | null }; error?: any }>;
      signOut?: () => Promise<any>;
    };
    requireApiToken?: boolean;
  },
): Promise<TelegramAuthResult> {
  if (!clientOverride && lastTelegramAuthAttempt?.initData === initData) {
    return lastTelegramAuthAttempt.result;
  }
  const result = (async () => {
    const client = clientOverride ?? supabaseModule.requireSupabaseClient();
    const { data, error } = await client.functions.invoke('telegram-auth', { body: { initData } });
    if (error || !data?.user) {
      clearTelegramApiAuthState();
      const errorCode = error ? await readFunctionsErrorCode(error) : null;
      throw new Error(errorCode || data?.error || 'Telegram account is not linked');
    }

    const rawUser = data.user as {
      id: string;
      username: string;
      fullName?: string;
      email?: string | null;
      avatarUrl?: string | null;
      role?: string;
      capabilities?: string[];
      manager_capabilities?: string[];
      managerCapabilities?: string[];
      telegramLinked?: boolean;
      accountStatus?: string;
      account_status?: string;
    };
    const rawTgStatus =
      typeof rawUser.accountStatus === 'string'
        ? rawUser.accountStatus.trim()
        : typeof rawUser.account_status === 'string'
        ? rawUser.account_status.trim()
        : '';
    if (rawTgStatus !== 'APPROVED') {
      clearTelegramApiAuthState();
      throw new Error('account_not_approved');
    }
    const rawCapabilities = Array.isArray(rawUser.capabilities)
      ? rawUser.capabilities.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
      : [];
    const candidateRoles = [
      ...(typeof rawUser.role === 'string' ? [rawUser.role.trim()] : []),
      ...rawCapabilities,
    ];
    const resolvedRole = resolveCanonicalAccountRole(candidateRoles);
    if (!resolvedRole) {
      clearTelegramApiAuthState();
      throw new Error('account_not_approved');
    }
    const rawManagerCaps = Array.isArray(rawUser.manager_capabilities)
      ? rawUser.manager_capabilities
      : Array.isArray(rawUser.managerCapabilities)
      ? rawUser.managerCapabilities
      : [];
    const mergedCaps = new Set<string>([resolvedRole]);
    for (const candidate of rawCapabilities) {
      if (AUTH_ROLE_MAP[candidate] || (resolvedRole === 'MANAGER' && candidate !== 'GENERAL_USER' && candidate !== 'EMPLOYEE')) {
        mergedCaps.add(candidate);
      }
    }
    if (resolvedRole === 'MANAGER') {
      for (const cap of rawManagerCaps) {
        if (typeof cap === 'string' && cap.trim()) mergedCaps.add(cap.trim());
      }
    }

    if (typeof (client as any)?.auth?.getSession === 'function') {
      const sessionResult = await (client as any).auth.getSession().catch(() => null);
      const webUserId = sessionResult?.data?.session?.user?.id;
      if (typeof webUserId === 'string' && webUserId && webUserId !== rawUser.id) {
        clearTelegramApiAuthState();
        throw new Error('telegram_identity_conflict');
      }
    }

    const hasApiTokenField = Object.prototype.hasOwnProperty.call(data, 'apiToken');
    const requireApiToken = !clientOverride || hasApiTokenField || Boolean(clientOverride.requireApiToken);
    let attachedToken: string | null = null;

    if (typeof data.apiToken === 'string' && data.apiToken.trim().length > 0) {
      try {
        attachedToken = attachTelegramApiAuthState(data.apiToken, rawUser.id);
      } catch {
        clearTelegramApiAuthState();
        throw new Error('telegram_api_authorization_unavailable');
      }
    } else if (requireApiToken) {
      clearTelegramApiAuthState();
      throw new Error('telegram_api_authorization_unavailable');
    }

    return {
      linked: data.linked === true,
      apiToken: attachedToken,
      user: {
        id: rawUser.id,
        username: rawUser.username,
        fullName: rawUser.fullName || rawUser.username,
        email: rawUser.email ?? undefined,
        avatarUrl: rawUser.avatarUrl ?? undefined,
        role: resolvedRole,
        accountStatus: 'APPROVED' as const,
        capabilities: [...mergedCaps],
        telegramLinked: rawUser.telegramLinked ?? true,
      },
    };
  })();
  if (!clientOverride) {
    lastTelegramAuthAttempt = { initData, result };
  }
  return result;
}

export async function completeTelegramLinkFromInitData(initData: string): Promise<User> {
  const result = await authenticateTelegramInitData(initData);
  if (!result.linked) throw new Error('Telegram link could not be confirmed');
  return result.user;
}
