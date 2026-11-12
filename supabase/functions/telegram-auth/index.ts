import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateInitData } from '../_shared/telegram-init-data.ts';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? 'http://localhost:3000';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== allowedOrigin) return json({ error: 'origin_not_allowed' }, 403);
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

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!botToken || !url || !serviceKey) return json({ error: 'telegram_unavailable' }, 503);

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
      db.from('profiles').select('id,username,full_name,email,avatar_url').eq('id', identity.user_id).single(),
      db.from('role_assignments').select('role').eq('user_id', identity.user_id).eq('active', true),
    ]);
    if (profileResult.error || !profileResult.data || roleResult.error) {
      return json({ error: 'telegram_account_lookup_failed' }, 500);
    }

    const allowedRoles = [
      'APP_ADMIN', 'MANAGER', 'PARENT', 'STUDENT', 'TEACHER', 'SCHOOL_STAFF', 'ADMINISTRATIVE_PERSONNEL',
    ];
    const capabilities = (roleResult.data ?? [])
      .map((assignment) => String(assignment.role))
      .filter((role) => allowedRoles.includes(role));
    const role = capabilities.includes('APP_ADMIN')
      ? 'APP_ADMIN'
      : capabilities[0] ?? null;
    if (!role) return json({ error: 'account_not_approved' }, 403);
    const profile = profileResult.data;
    return json({
      linked,
      user: {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name || profile.username,
        email: profile.email,
        avatarUrl: profile.avatar_url,
        role,
        capabilities,
        telegramLinked: true,
      },
    });
  } catch {
    return json({ error: 'telegram_link_failed' }, 400);
  }
});
