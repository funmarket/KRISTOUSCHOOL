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

function normalizeUsernameKey(value: string): string {
  return value
    .normalize('NFC')
    .replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '')
    .replace(/[\s\u00A0]+/g, ' ')
    .toLowerCase();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const { username, password } = await request.json();
    if (typeof username !== 'string' || typeof password !== 'string' || password.length < 1) {
      return json({ error: 'invalid_credentials' }, 400);
    }

    const normalizedKey = normalizeUsernameKey(username);
    const codePointLength = [...normalizedKey].length;
    if (codePointLength < 3 || codePointLength > 50 || normalizedKey.includes('@')) {
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
      const code = (error as { code?: string }).code;
      if (code === 'email_not_confirmed' || code === 'phone_not_confirmed') {
        return json({ error: code }, 403);
      }
      return json({ error: 'invalid_credentials' }, 401);
    }

    if (!data.session || !data.user) return json({ error: 'invalid_credentials' }, 401);

    return json({ session: data.session, user: data.user });
  } catch {
    return json({ error: 'invalid_credentials' }, 401);
  }
});

