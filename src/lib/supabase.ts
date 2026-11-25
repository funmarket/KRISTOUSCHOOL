/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

declare const __KRISTOU_SUPABASE_URL__: string | undefined;
declare const __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: string | undefined;

const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env) || {};
const procEnv = (typeof process !== 'undefined' && process.env) || {};

// vite.config.ts selectively injects only public config, never a service-role key.
const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  procEnv.VITE_SUPABASE_URL ||
  (typeof __KRISTOU_SUPABASE_URL__ !== 'undefined' ? __KRISTOU_SUPABASE_URL__ : '') ||
  '';

const supabasePublishableKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  procEnv.VITE_SUPABASE_ANON_KEY ||
  procEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (typeof __KRISTOU_SUPABASE_PUBLISHABLE_KEY__ !== 'undefined' ? __KRISTOU_SUPABASE_PUBLISHABLE_KEY__ : '') ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

import type { Database } from './database.types';

// Preserve the existing client type export with one generated schema owner.
export type DatabaseSchema = Database;

export interface TelegramApiAuthorization {
  token: string;
  userId: string;
  exp: number;
}

let activeTelegramApiAuth: TelegramApiAuthorization | null = null;

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function setTelegramApiAuthorization(token: string, expectedUserId: string): TelegramApiAuthorization {
  const trimmed = typeof token === 'string' ? token.trim() : '';
  const claims = parseJwtPayload(trimmed);
  const sub = typeof claims?.sub === 'string' ? claims.sub.trim() : '';
  const role = typeof claims?.role === 'string' ? claims.role.trim() : '';
  const exp = typeof claims?.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp : 0;

  if (!trimmed || !sub || sub !== expectedUserId || role !== 'authenticated' || exp * 1000 <= Date.now()) {
    activeTelegramApiAuth = null;
    throw new Error('telegram_api_authorization_invalid');
  }

  activeTelegramApiAuth = { token: trimmed, userId: expectedUserId, exp };
  return activeTelegramApiAuth;
}

export function clearTelegramApiAuthorization(): void {
  activeTelegramApiAuth = null;
}

export function getTelegramApiAuthorization(): TelegramApiAuthorization | null {
  return activeTelegramApiAuth;
}

function buildJsonErrorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ code, message, details: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createTelegramAuthorizedFetch(
  baseUrl: string,
  publishableKey: string,
  baseFetch?: typeof fetch,
): typeof fetch {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const resolveFetcher = (): typeof fetch => baseFetch ?? globalThis.fetch.bind(globalThis);

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const fetcher = resolveFetcher();
    const requestUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (!normalizedBase || !requestUrl.startsWith(normalizedBase)) {
      return fetcher(input, init);
    }

    const relativePath = requestUrl.slice(normalizedBase.length);
    if (relativePath.startsWith('/auth/v1/') || relativePath.startsWith('/functions/v1/telegram-auth')) {
      return fetcher(input, init);
    }

    const currentTelegramAuth = activeTelegramApiAuth;
    if (!currentTelegramAuth) {
      return fetcher(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined),
    );
    const authHeader = headers.get('Authorization') || '';
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const incomingToken = bearerMatch ? bearerMatch[1].trim() : null;
    const hasWebUserToken = Boolean(incomingToken && incomingToken !== publishableKey);

    if (hasWebUserToken) {
      const claims = parseJwtPayload(incomingToken!);
      const webSub = typeof claims?.sub === 'string' ? claims.sub.trim() : '';
      if (!webSub || webSub !== currentTelegramAuth.userId) {
        return buildJsonErrorResponse(403, '42501', 'telegram_identity_conflict');
      }
      return fetcher(input, init);
    }

    if (currentTelegramAuth.exp * 1000 <= Date.now()) {
      return buildJsonErrorResponse(401, 'PGRST301', 'telegram_api_authorization_expired');
    }

    headers.set('Authorization', `Bearer ${currentTelegramAuth.token}`);
    if (publishableKey && !headers.has('apikey')) {
      headers.set('apikey', publishableKey);
    }

    return fetcher(input, { ...(init ?? {}), headers });
  };
}

export const supabase = isSupabaseConfigured
  ? createClient<DatabaseSchema>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        fetch: createTelegramAuthorizedFetch(supabaseUrl, supabasePublishableKey),
      },
    })
  : null;

if (typeof supabase?.auth?.onAuthStateChange === 'function') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      clearTelegramApiAuthorization();
    }
  });
}

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase public configuration was not included in this frontend build. Check the deployment build variables and rebuild.',
    );
  }

  return supabase;
}

export function classifySupabaseError(error: unknown): {
  status: 'BLOCKED_BACKEND' | 'UNAUTHORIZED' | 'ERROR';
  errorCode: string;
  errorMessage: string;
} {
  if (!isSupabaseConfigured) {
    return {
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase public configuration is not available in this build.',
    };
  }
  if (!error || typeof error !== 'object') {
    return {
      status: 'ERROR',
      errorCode: 'operation_failed',
      errorMessage: 'Operation could not be completed.',
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

  if (
    rawCode === 'PGRST202' ||
    rawCode === 'PGRST205' ||
    rawCode === '42883' ||
    rawCode === '42P01' ||
    rawMessage.includes('Could not find the function') ||
    rawMessage.includes('Could not find the table') ||
    rawMessage.includes('schema cache')
  ) {
    return {
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
    };
  }

  if (
    rawCode === '42501' ||
    rawCode === 'PGRST301' ||
    rawMessage.includes('actor_unauthenticated') ||
    rawMessage.includes('actor_not_approved') ||
    rawMessage.includes('insufficient_authority') ||
    rawMessage.includes('owner_only_operation') ||
    rawMessage.includes('students_cannot_direct_message') ||
    rawMessage.includes('row-level security')
  ) {
    return {
      status: 'UNAUTHORIZED',
      errorCode: rawMessage || rawCode || 'insufficient_authority',
      errorMessage: rawMessage || 'You are not authorized to perform this action.',
    };
  }

  return {
    status: 'ERROR',
    errorCode: rawMessage || rawCode || 'operation_failed',
    errorMessage: rawMessage || 'Operation failed.',
  };
}
