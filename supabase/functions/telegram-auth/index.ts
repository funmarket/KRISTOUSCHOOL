// @ts-ignore Deno Edge Runtime URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateInitData } from '../_shared/telegram-init-data.ts';

declare const Deno:
  | {
      env?: { get?(key: string): string | undefined };
      serve?(handler: (request: Request) => Promise<Response> | Response): void;
    }
  | undefined;

const CANONICAL_ROLES = new Set([
  'APP_ADMIN',
  'MANAGER',
  'ADMINISTRATIVE_PERSONNEL',
  'TEACHER',
  'SCHOOL_STAFF',
  'PARENT',
  'STUDENT',
]);

const DEFAULT_API_TOKEN_TTL_SECONDS = 900;

function getEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno?.env && typeof Deno.env.get === 'function') {
    return Deno.env.get(key);
  }
  return undefined;
}

const getAllowedOrigin = () => getEnv('ALLOWED_ORIGIN') ?? 'http://localhost:3000';
const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
});

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signTelegramApiJwt(params: {
  userId: string;
  supabaseUrl: string;
  ttlSeconds: number;
  hs256Secret?: string;
  es256JwkJson?: string;
}): Promise<string> {
  const encoder = new TextEncoder();
  const nowSec = Math.floor(Date.now() / 1000);
  const issuer = `${params.supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  const payload = {
    aud: 'authenticated',
    exp: nowSec + params.ttlSeconds,
    iat: nowSec,
    iss: issuer,
    sub: params.userId,
    role: 'authenticated',
    amr: [{ method: 'telegram', timestamp: nowSec }],
  };

  if (params.es256JwkJson) {
    const jwk = JSON.parse(params.es256JwkJson) as JsonWebKey & { kid?: string };
    const header: Record<string, string> = { alg: 'ES256', typ: 'JWT' };
    if (typeof jwk.kid === 'string' && jwk.kid.trim()) {
      header.kid = jwk.kid.trim();
    }
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const signingInput = `${toBase64Url(encoder.encode(JSON.stringify(header)))}.${toBase64Url(encoder.encode(JSON.stringify(payload)))}`;
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      encoder.encode(signingInput),
    );
    return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
  }

  const secret = params.hs256Secret ?? '';
  const header = { alg: 'HS256', typ: 'JWT' };
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signingInput = `${toBase64Url(encoder.encode(JSON.stringify(header)))}.${toBase64Url(encoder.encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function handleTelegramAuth(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders() });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== getAllowedOrigin()) return json({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return json({ error: 'unsupported_media_type' }, 415);
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 20_000) return json({ error: 'request_too_large' }, 413);
    const body = JSON.parse(rawBody) as { initData?: unknown };
    if (typeof body.initData !== 'string' || body.initData.length === 0) {
      return json({ error: 'invalid_telegram_auth' }, 400);
    }

    const botToken = getEnv('TELEGRAM_BOT_TOKEN');
    const url = getEnv('SUPABASE_URL');
    const serviceKey = getEnv('SERVICE_ROLE_KEY') ?? getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!botToken || !url || !serviceKey) return json({ error: 'telegram_unavailable' }, 503);

    const es256JwkJson = getEnv('APP_JWT_PRIVATE_JWK')?.trim() || '';
    const hs256Secret =
      (
        getEnv('APP_JWT_SECRET') ??
        getEnv('POSTGREST_JWT_SECRET') ??
        getEnv('JWT_SECRET') ??
        getEnv('SUPABASE_JWT_SECRET') ??
        ''
      ).trim();
    if (!es256JwkJson && !hs256Secret) {
      return json({ error: 'telegram_auth_signing_unconfigured' }, 503);
    }

    const validated = await validateInitData(body.initData, botToken);
    if (!validated) return json({ error: 'invalid_telegram_auth' }, 401);
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    let linked = false;
    if (validated.startParam) {
      const verifierDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(validated.startParam));
      const verifierHash = [...new Uint8Array(verifierDigest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const { error } = await db.rpc('claim_telegram_account_link', {
        p_verifier_hash: verifierHash,
        p_telegram_user_id: validated.user.id,
        p_telegram_username: validated.user.username ?? null,
        p_first_name: validated.user.first_name ?? null,
        p_last_name: validated.user.last_name ?? null,
        p_language_code: validated.user.language_code ?? null,
      });

      if (error) {
        if (error.message.includes('telegram_identity_conflict')) return json({ error: 'telegram_identity_conflict' }, 409);
        if (error.message.includes('link_challenge_invalid') || error.code === '23505') return json({ error: 'invalid_or_conflicting_link' }, 409);
        return json({ error: 'telegram_link_failed' }, 500);
      }
      linked = true;
    }

    const { data: identity, error: identityError } = await db
      .from('telegram_identities')
      .select('user_id')
      .eq('telegram_user_id', validated.user.id)
      .maybeSingle();
    if (identityError) return json({ error: 'telegram_account_lookup_failed' }, 500);
    if (!identity) return json({ error: 'telegram_not_linked' }, 404);

    const [profileResult, roleResult] = await Promise.all([
      db.from('profiles').select('id,username,full_name,email,avatar_url,account_status').eq('id', identity.user_id).single(),
      db.from('role_assignments').select('role').eq('user_id', identity.user_id).eq('active', true),
    ]);
    if (profileResult.error || !profileResult.data || roleResult.error) {
      return json({ error: 'telegram_account_lookup_failed' }, 500);
    }

    const profile = profileResult.data;
    const accountStatus = typeof profile.account_status === 'string' ? profile.account_status.trim() : '';
    if (accountStatus !== 'APPROVED') {
      return json({ error: 'account_not_approved' }, 403);
    }

    const rawRoles = (roleResult.data ?? []).map((assignment: { role?: unknown }) => String(assignment.role ?? '').trim());
    const roleCapabilities = rawRoles.filter((assignedRole: string) => CANONICAL_ROLES.has(assignedRole));
    const role = roleCapabilities.includes('APP_ADMIN')
      ? 'APP_ADMIN'
      : roleCapabilities[0] ?? null;
    if (!role) {
      return json({ error: 'account_not_approved' }, 403);
    }

    const managerCapabilities: string[] = [];
    if (role === 'MANAGER') {
      const { data: grantRows, error: grantError } = await db
        .from('manager_capability_grants')
        .select('capability')
        .eq('manager_user_id', identity.user_id)
        .eq('active', true);
      if (grantError) {
        return json({ error: 'telegram_account_lookup_failed' }, 500);
      }
      for (const row of grantRows ?? []) {
        const cap = typeof row?.capability === 'string' ? row.capability.trim() : '';
        if (cap && !managerCapabilities.includes(cap)) {
          managerCapabilities.push(cap);
        }
      }
    }

    if (typeof db.auth?.admin?.getUserById === 'function') {
      const { data: authUserData, error: authUserError } = await db.auth.admin.getUserById(identity.user_id);
      if (authUserError || !authUserData?.user) {
        return json({ error: 'telegram_account_lookup_failed' }, 500);
      }
      if (authUserData.user.banned_until && Date.parse(authUserData.user.banned_until) > Date.now()) {
        return json({ error: 'account_not_approved' }, 403);
      }
    }

    const rawTtl = Number(getEnv('TELEGRAM_API_TOKEN_TTL_SECONDS') ?? DEFAULT_API_TOKEN_TTL_SECONDS);
    const expiresInSeconds = Number.isFinite(rawTtl)
      ? Math.min(Math.max(Math.trunc(rawTtl), 300), 1800)
      : DEFAULT_API_TOKEN_TTL_SECONDS;

    let apiToken: string;
    try {
      apiToken = await signTelegramApiJwt({
        userId: identity.user_id,
        supabaseUrl: url,
        ttlSeconds: expiresInSeconds,
        hs256Secret,
        es256JwkJson: es256JwkJson || undefined,
      });
    } catch {
      return json({ error: 'telegram_auth_signing_unconfigured' }, 503);
    }

    const capabilities = [...new Set([...roleCapabilities, ...managerCapabilities])];
    return json({
      linked,
      apiToken,
      expiresInSeconds,
      user: {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name || profile.username,
        email: profile.email,
        avatarUrl: profile.avatar_url,
        role,
        account_status: accountStatus,
        accountStatus,
        capabilities,
        manager_capabilities: managerCapabilities,
        telegramLinked: true,
      },
    });
  } catch {
    return json({ error: 'telegram_link_failed' }, 400);
  }
}

if (typeof Deno !== 'undefined' && typeof Deno?.serve === 'function') {
  Deno.serve((request) => handleTelegramAuth(request));
}

