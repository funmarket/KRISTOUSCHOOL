import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = request.headers.get('Authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'auth_unavailable' }, 503);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  const rawCode = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawCode));
  const verifierHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await db.from('account_link_challenges').delete().eq('user_id', user.id).or('consumed_at.not.is.null,expires_at.lt.' + new Date().toISOString());
  const { error } = await db.from('account_link_challenges').insert({ user_id: user.id, verifier_hash: verifierHash, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  if (error) return json({ error: 'challenge_failed' }, 500);
  return json({ linkCode: rawCode, expiresInSeconds: 600 });
});
