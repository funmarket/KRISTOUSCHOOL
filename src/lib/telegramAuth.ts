import * as supabaseModule from './supabase.ts';
import { createTelegramLinkUrl } from './telegram.ts';
import { AUTH_ROLE_MAP, resolveCanonicalAccountRole } from './authRoles.ts';
import type { User } from '../types.ts';

export type TelegramAuthResult = { user: User; linked: boolean };

let lastTelegramAuthAttempt: { initData: string; result: Promise<TelegramAuthResult> } | null = null;

export function clearTelegramAuthCache() {
  lastTelegramAuthAttempt = null;
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
  },
): Promise<TelegramAuthResult> {
  if (!clientOverride && lastTelegramAuthAttempt?.initData === initData) {
    return lastTelegramAuthAttempt.result;
  }
  const result = (async () => {
    const client = clientOverride ?? supabaseModule.requireSupabaseClient();
    const { data, error } = await client.functions.invoke('telegram-auth', { body: { initData } });
    if (error || !data?.user) {
      const errorCode = error ? await readFunctionsErrorCode(error) : null;
      const status = typeof error?.context?.status === 'number' ? error.context.status : null;
      const dataError = typeof data?.error === 'string' && data.error.trim() ? data.error.trim() : null;
      const rawErrorMessage =
        typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : null;
      const resolvedError =
        errorCode ||
        dataError ||
        (status === 404 || !error ? 'telegram_not_linked' : rawErrorMessage || 'telegram_auth_failed');
      throw new Error(resolvedError);
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
        throw new Error('telegram_identity_conflict');
      }
    }

    return {
      linked: data.linked === true,
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
    const trackedResult = result.catch((error) => {
      if (lastTelegramAuthAttempt?.result === trackedResult) {
        lastTelegramAuthAttempt = null;
      }
      throw error;
    });
    lastTelegramAuthAttempt = { initData, result: trackedResult };
    return trackedResult;
  }
  return result;
}

export async function completeTelegramLinkFromInitData(initData: string): Promise<User> {
  const result = await authenticateTelegramInitData(initData);
  if (!result.linked) throw new Error('Telegram link could not be confirmed');
  return result.user;
}
