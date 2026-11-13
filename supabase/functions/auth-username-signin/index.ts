// @ts-ignore Deno Edge Runtime URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno:
  | {
      env?: { get?(key: string): string | undefined };
      serve?(handler: (request: Request) => Promise<Response> | Response): void;
    }
  | undefined;

const CONTROL_OR_INVISIBLE_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Cn}\r\n\u2028\u2029]/u;
const CONSECUTIVE_PUNCTUATION_PATTERN = /[._-]{2,}/;
const PHONE_LIKE_CHARS_ONLY_PATTERN = /^[+\d\s().-]+$/u;

function getEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno?.env && typeof Deno.env.get === 'function') {
    return Deno.env.get(key);
  }
  return undefined;
}

const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': getEnv('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
  });

export function isUsernameLetterOrDigitCodePoint(cp: number): boolean {
  return (
    (cp >= 0x0030 && cp <= 0x0039) ||
    (cp >= 0x0041 && cp <= 0x005a) ||
    (cp >= 0x0061 && cp <= 0x007a) ||
    (cp >= 0x00c0 && cp <= 0x00d6) ||
    (cp >= 0x00d8 && cp <= 0x00f6) ||
    (cp >= 0x00f8 && cp <= 0x00ff) ||
    (cp >= 0x0100 && cp <= 0x024f) ||
    (cp >= 0x1e00 && cp <= 0x1eff) ||
    (cp >= 0x0621 && cp <= 0x063a) ||
    (cp >= 0x0641 && cp <= 0x064a) ||
    (cp >= 0x0660 && cp <= 0x0669) ||
    (cp >= 0x066e && cp <= 0x066f) ||
    (cp >= 0x0671 && cp <= 0x06d3) ||
    cp === 0x06d5 ||
    (cp >= 0x06f0 && cp <= 0x06f9) ||
    (cp >= 0x06fa && cp <= 0x06fc) ||
    cp === 0x06ff
  );
}

export function isUsernameMarkCodePoint(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x064b && cp <= 0x065f) ||
    cp === 0x0670
  );
}

export function isUsernameSeparatorCodePoint(cp: number): boolean {
  return cp === 0x0020 || cp === 0x002d || cp === 0x002e || cp === 0x005f;
}

export function isAllowedUsernameCodePoint(cp: number): boolean {
  return (
    isUsernameLetterOrDigitCodePoint(cp) ||
    isUsernameMarkCodePoint(cp) ||
    isUsernameSeparatorCodePoint(cp)
  );
}

export function normalizeUsernameDisplay(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(/^ +| +$/g, '')
    .replace(/ {2,}/g, ' ');
}

export function normalizeUsernameKey(value: string): string {
  return normalizeUsernameDisplay(value).toLowerCase();
}

export function isValidUsername(value: string): boolean {
  if (typeof value !== 'string' || CONTROL_OR_INVISIBLE_PATTERN.test(value)) {
    return false;
  }
  const display = normalizeUsernameDisplay(value);
  if (!display) return false;

  const codePoints = Array.from(display, (ch) => ch.codePointAt(0)!);
  if (codePoints.length < 3 || codePoints.length > 50) return false;
  if (display.includes('@') || PHONE_LIKE_CHARS_ONLY_PATTERN.test(display)) return false;

  for (let i = 0; i < codePoints.length; i++) {
    const cp = codePoints[i];
    if (!isAllowedUsernameCodePoint(cp)) return false;
    if (isUsernameMarkCodePoint(cp)) {
      const prev = i > 0 ? codePoints[i - 1] : -1;
      if (!isUsernameLetterOrDigitCodePoint(prev) && !isUsernameMarkCodePoint(prev)) {
        return false;
      }
    }
  }

  const firstCp = codePoints[0];
  const lastCp = codePoints[codePoints.length - 1];
  if (
    !isUsernameLetterOrDigitCodePoint(firstCp) ||
    (!isUsernameLetterOrDigitCodePoint(lastCp) && !isUsernameMarkCodePoint(lastCp)) ||
    CONSECUTIVE_PUNCTUATION_PATTERN.test(display) ||
    display.includes('  ')
  ) {
    return false;
  }

  return true;
}

function isClientCredentialStatus(status: unknown): boolean {
  return status === 400 || status === 401;
}

function isCredentialRejectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: unknown }).status;
  if (!isClientCredentialStatus(status)) return false;

  const code =
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code.trim()
      : '';
  if (code) {
    return code === 'invalid_credentials' || code === 'invalid_grant';
  }

  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';
  return message === 'Invalid login credentials' || message === 'Invalid credentials';
}

export async function handleUsernameSignIn(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders() });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  if (!payload || typeof payload !== 'object') {
    return json({ error: 'invalid_request' }, 400);
  }

  const { username, password } = payload as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string' || password.length < 1) {
    return json({ error: 'invalid_request' }, 400);
  }

  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    return json({ error: 'invalid_request' }, 400);
  }

  if (!isValidUsername(username)) {
    return json({ error: 'invalid_credentials' }, 401);
  }

  const normalizedKey = normalizeUsernameKey(username);

  try {
    const url = getEnv('SUPABASE_URL');
    const anonKey = getEnv('SUPABASE_ANON_KEY');
    const serviceKey = getEnv('SERVICE_ROLE_KEY') ?? getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return json({ error: 'auth_unavailable' }, 503);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email, phone')
      .eq('username_normalized', normalizedKey)
      .maybeSingle();

    if (profileError) {
      return json({ error: 'auth_unavailable' }, 503);
    }

    // Keep the same public response for missing and invalid credentials to prevent enumeration.
    if (!profile || (!profile.email && !profile.phone)) {
      return json({ error: 'invalid_credentials' }, 401);
    }

    const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const identifier = profile.email ?? profile.phone;
    const { data, error } = await publicClient.auth.signInWithPassword(
      profile.email ? { email: identifier, password } : { phone: identifier, password },
    );

    if (error) {
      const status = (error as { status?: unknown }).status;
      const code = (error as { code?: string }).code;
      if (
        (status === 400 || status === 401 || status === 403) &&
        (code === 'email_not_confirmed' || code === 'phone_not_confirmed')
      ) {
        return json({ error: code }, 403);
      }
      if (isCredentialRejectionError(error)) {
        return json({ error: 'invalid_credentials' }, 401);
      }
      return json({ error: 'auth_unavailable' }, 503);
    }

    if (!data?.session || !data?.user) {
      return json({ error: 'auth_unavailable' }, 503);
    }

    return json({ session: data.session, user: data.user });
  } catch {
    return json({ error: 'auth_unavailable' }, 503);
  }
}

if (typeof Deno !== 'undefined' && typeof Deno?.serve === 'function') {
  Deno.serve((request) => handleUsernameSignIn(request));
}


