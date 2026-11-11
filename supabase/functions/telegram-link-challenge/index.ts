import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'auth_unavailable' }, 503);

  try {
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: existingIdentity, error: identityError } = await db
      .from('telegram_identities')
      .select('telegram_user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (identityError) return json({ error: 'challenge_failed' }, 500);
    if (existingIdentity) return json({ error: 'telegram_already_linked' }, 409);

    const rawCode = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawCode));
    const verifierHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

    await db.from('account_link_challenges')
      .delete()
      .eq('user_id', user.id)
      .or(`consumed_at.not.is.null,expires_at.lt.${new Date().toISOString()}`);

    const { error: insertError } = await db.from('account_link_challenges').insert({
      user_id: user.id,
      verifier_hash: verifierHash,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertError) return json({ error: 'challenge_failed' }, 500);

    return json({ linkCode: rawCode, expiresInSeconds: 600 });
  } catch {
    return json({ error: 'challenge_failed' }, 500);
  }
});
