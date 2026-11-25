import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const source = fileURLToPath(new URL('../supabase/functions/telegram-private-ops/index.ts', import.meta.url));
const bundled = await build({
  entryPoints: [source], bundle: true, write: false, format: 'esm', platform: 'node', target: 'node22',
  plugins: [{
    name: 'stub-postgres-driver',
    setup(builder) {
      builder.onResolve({ filter: /^npm:postgres@/ }, () => ({ path: 'postgres-stub', namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export default function postgres(){throw new Error("unexpected real database connection")}', loader: 'js' }));
    },
  }],
});
const encoded = Buffer.from(bundled.outputFiles[0].contents).toString('base64');
const { handleTelegramPrivateOps } = await import(`data:text/javascript;base64,${encoded}`);
const BOT_TOKEN = 'tg-authz-test-token';
const ACTOR = '00000000-0000-4000-8000-000000000201';

async function initData({ authDate = Math.floor(Date.now() / 1000), userId = 900001, tamper = false } = {}) {
  const params = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify({ id: userId, first_name: 'Synthetic' }) });
  const message = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n');
  const encoder = new TextEncoder();
  const derivation = await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const secret = await crypto.subtle.sign('HMAC', derivation, encoder.encode(BOT_TOKEN));
  const validation = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = Buffer.from(await crypto.subtle.sign('HMAC', validation, encoder.encode(message))).toString('hex');
  params.set('hash', tamper ? `${hash.slice(0, -1)}${hash.endsWith('0') ? '1' : '0'}` : hash);
  return params.toString();
}

function fakeDatabase({ accountStatus = 'APPROVED', role = 'PARENT' } = {}) {
  const statements = [];
  const database = {
    statements,
    async begin(callback) {
      let authenticatedRole = false;
      const query = async (strings, ...values) => {
        const text = strings.join('?').replace(/\s+/g, ' ').trim();
        statements.push({ text, values });
        if (text.startsWith('select user_id::text as user_id')) return [{ user_id: ACTOR }];
        if (text.includes("set_config('request.jwt.claim")) return [];
        if (text === 'set local role authenticated') { authenticatedRole = true; return []; }
        assert.equal(authenticatedRole, true, `database operation must execute as authenticated: ${text}`);
        if (text.startsWith('select id::text as id, account_status')) return [{ id: ACTOR, account_status: accountStatus }];
        if (text.startsWith('select role::text as role')) return [{ role }];
        if (text.startsWith('select id::text as id, category')) return [{ id: 'notice-1', title: 'Own notification' }];
        if (text.includes('upsert_my_preferences')) return [{ language: 'ar', theme: 'light', notification_sound: 'Kristou Bell', sound_muted: false, vibration_enabled: true }];
        if (text.startsWith('select language, theme, notification_sound')) return [{ language: 'fr', theme: 'light' }];
        if (text.includes('governance_get_actor_scope')) return [{ data: { role } }];
        if (text.includes('mark_all_user_notification')) return [{ data: 1 }];
        return [{ data: true }];
      };
      return callback(query);
    },
  };
  return database;
}

function makeRequest(data, body, extraHeaders = {}) {
  return new Request('https://edge.invalid/telegram-private-ops', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
}

const deps = (sql, nowSeconds = Math.floor(Date.now() / 1000)) => ({ sql, botToken: BOT_TOKEN, nowSeconds, allowedOrigins: ['https://school.invalid'] });

test('fresh signed initData maps to one authenticated transaction and returns no client session', async () => {
  const sql = fakeDatabase();
  const response = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData(), operation: 'notifications.list', params: {},
  }, { origin: 'https://school.invalid' }), deps(sql));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ id: 'notice-1', title: 'Own notification' }]);
  assert.equal(sql.statements.some(({ text }) => text === 'set local role authenticated'), true);
  assert.equal(sql.statements.some(({ text }) => /select .*session|access_token/i.test(text)), false);
});

test('invalid or expired Telegram signatures are rejected before database access', async () => {
  const invalidDb = fakeDatabase();
  const invalid = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData({ tamper: true }), operation: 'notifications.list', params: {},
  }), deps(invalidDb));
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'invalid_telegram_auth' });
  assert.equal(invalidDb.statements.length, 0);

  const now = Math.floor(Date.now() / 1000);
  const expiredDb = fakeDatabase();
  const expired = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData({ authDate: now - 301 }), operation: 'notifications.list', params: {},
  }), deps(expiredDb, now));
  assert.equal(expired.status, 401);
  assert.deepEqual(await expired.json(), { error: 'telegram_auth_expired' });
  assert.equal(expiredDb.statements.length, 0);
});

test('unapproved accounts and Telegram-to-account mismatch fail closed', async () => {
  for (const accountStatus of ['PENDING', 'SUSPENDED', 'REVOKED']) {
    const deniedDb = fakeDatabase({ accountStatus });
    const denied = await handleTelegramPrivateOps(makeRequest(null, {
      initData: await initData(), operation: 'notifications.list', params: {},
    }), deps(deniedDb));
    assert.equal(denied.status, 403, `${accountStatus} account must be rejected`);
    assert.deepEqual(await denied.json(), { error: 'account_not_approved' });
  }

  const mismatchDb = fakeDatabase();
  const mismatch = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData(), operation: 'notifications.list', params: { expectedUserId: '00000000-0000-4000-8000-000000000999' },
  }), deps(mismatchDb));
  assert.equal(mismatch.status, 409);
  assert.deepEqual(await mismatch.json(), { error: 'telegram_identity_conflict' });
});

test('only enumerated operations are accepted and allowed mutations call the existing RPC once', async () => {
  const unsupportedDb = fakeDatabase();
  const unsupported = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData(), operation: 'rpc.arbitrary', params: { sql: 'select 1' },
  }), deps(unsupportedDb));
  assert.equal(unsupported.status, 400);
  assert.equal(unsupportedDb.statements.length, 0);

  const sql = fakeDatabase();
  const saved = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData(), operation: 'preferences.save', params: { language: 'ar' },
  }), deps(sql));
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { language: 'ar', theme: 'light', notification_sound: 'Kristou Bell', sound_muted: false, vibration_enabled: true });
  assert.equal(sql.statements.filter(({ text }) => text.includes('upsert_my_preferences')).length, 1);
});
