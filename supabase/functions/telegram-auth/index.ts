import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function validateInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(botToken));
  const key = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataCheckString));
  const expected = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expected !== hash) return null;
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > 300) return null;
  const rawUser = params.get('user');
  if (!rawUser) return null;
  return JSON.parse(rawUser) as { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const { initData, linkCode } = await request.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!botToken || !url || !serviceKey || typeof initData !== 'string') return json({ error: 'telegram_unavailable' }, 503);
    const telegramUser = await validateInitData(initData, botToken);
    if (!telegramUser) return json({ error: 'invalid_telegram_auth' }, 401);

    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    let userId: string | null = null;
    if (typeof linkCode === 'string' && linkCode.length > 0) {
      const verifierHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(linkCode));
      const hash = [...new Uint8Array(verifierHash)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const { data: challenge } = await db.from('account_link_challenges').select('id,user_id').eq('verifier_hash', hash).is('consumed_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
      if (!challenge) return json({ error: 'invalid_or_expired_link' }, 409);
      userId = challenge.user_id;
      const { data: conflict } = await db.from('telegram_identities').select('user_id').eq('telegram_user_id', telegramUser.id).maybeSingle();
      if (conflict && conflict.user_id !== userId) return json({ error: 'identity_conflict' }, 409);
      await db.from('account_link_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', challenge.id);
    } else {
      const { data: existing } = await db.from('telegram_identities').select('user_id').eq('telegram_user_id', telegramUser.id).maybeSingle();
      userId = existing?.user_id ?? null;
      if (!userId) {
        const { data: created, error } = await db.from('profiles').insert({ username: `tg_${telegramUser.id}`, full_name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'Telegram user', requested_role: 'GENERAL_USER' }).select('id').single();
        if (error || !created) return json({ error: 'profile_creation_failed' }, 500);
        userId = created.id;
        await db.from('role_assignments').insert({ user_id: userId, role: 'GENERAL_USER' });
      }
    }

    await db.from('telegram_identities').upsert({ user_id: userId, telegram_user_id: telegramUser.id, telegram_username: telegramUser.username ?? null, first_name: telegramUser.first_name ?? null, last_name: telegramUser.last_name ?? null, language_code: telegramUser.language_code ?? null, last_authenticated_at: new Date().toISOString() });
    const { data: profile } = await db.from('profiles').select('id,username,full_name,email,phone,avatar_url').eq('id', userId).single();
    return json({ profile, linked: Boolean(linkCode) });
  } catch {
    return json({ error: 'telegram_auth_failed' }, 401);
  }
});
