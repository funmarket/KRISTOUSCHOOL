import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const { username, password } = await request.json();
    if (typeof username !== 'string' || typeof password !== 'string' || username.trim().length < 3 || password.length < 1) {
      return json({ error: 'invalid_credentials' }, 400);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return json({ error: 'auth_unavailable' }, 503);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email, phone')
      .eq('username_normalized', username.trim().toLowerCase())
      .maybeSingle();

    // Keep the same public response for missing and invalid credentials.
    if (profileError || !profile || (!profile.email && !profile.phone)) return json({ error: 'invalid_credentials' }, 401);

    const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const identifier = profile.email ?? profile.phone;
    const { data, error } = await publicClient.auth.signInWithPassword(
      profile.email ? { email: identifier, password } : { phone: identifier, password },
    );
    if (error || !data.session || !data.user) return json({ error: 'invalid_credentials' }, 401);

    return json({ session: data.session, user: data.user });
  } catch {
    return json({ error: 'invalid_credentials' }, 401);
  }
});
