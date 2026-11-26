import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import test from 'node:test';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const testDir = path.dirname(fileURLToPath(import.meta.url));

async function bundleDomain(relativePath, outputName) {
  const outfile = path.join('/tmp', outputName);
  await build({
    entryPoints: [path.resolve(testDir, relativePath)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    plugins: [{
      name: 'telegram-private-operations-test-config',
      setup(builder) {
        builder.onResolve({ filter: /(?:^|\/)supabase\.ts$/ }, () => ({
          path: 'mock-supabase',
          namespace: 'telegram-private-operations-test',
        }));
        builder.onLoad({ filter: /^mock-supabase$/, namespace: 'telegram-private-operations-test' }, () => ({
          contents: `
            export const supabase = null;
            export const classifySupabaseError = (error) => ({
              status: 'ERROR', errorCode: error?.message || 'operation_failed',
              errorMessage: error?.message || 'Operation failed.'
            });
          `,
          loader: 'js',
        }));
      },
    }],
  });
  delete require.cache[require.resolve(outfile)];
  return require(outfile);
}

function makeTelegramClient() {
  const calls = [];
  const client = {
    functions: {
      async invoke(name, options) {
        calls.push({ name, body: options?.body });
        const body = options?.body ?? {};
        if (name !== 'telegram-private-ops') return { data: null, error: new Error('unexpected function') };
        const account = {
          id: 'target-user', username: 'target_user', fullName: 'Target User',
          requestedRole: 'PARENT', accountStatus: 'APPROVED', activeRoles: ['PARENT'],
          capabilities: [], createdAt: '2026-01-01T00:00:00Z',
        };
        const values = {
          'notifications.list': [{
            id: 'notification-1', category: 'system', title: 'Notice', body: 'Message',
            target_tab: null, target_ref_id: null, is_read: false,
            created_at: '2026-01-01T00:00:00Z',
          }],
          'notifications.markOne': true,
          'notifications.markAll': 2,
          'preferences.load': {
            language: 'fr', theme: 'light', notification_sound: 'Kristou Bell',
            sound_muted: false, vibration_enabled: true,
          },
          'preferences.save': {
            language: body?.params?.language ?? 'ar', theme: 'pitch-black', notification_sound: 'Soft Chime',
            sound_muted: true, vibration_enabled: false,
          },
          'governance.actorScope': {
            actorUserId: 'owner-1', actorRole: 'APP_ADMIN', accountStatus: 'APPROVED',
            canReviewOrdinaryAccounts: true, canAppointPrivilegedRoles: true,
          },
          'governance.pendingAccounts': { items: [account], totalCount: 1, limit: 25, offset: 0 },
          'governance.accountDirectory': { items: [account], totalCount: 1, limit: 25, offset: 0 },
          'governance.accountDetail': { account, auditTrail: [] },
        };
        return { data: values[body.operation], error: null };
      },
    },
    from() {
      throw new Error('Telegram private reads must not use the ordinary Supabase client');
    },
    rpc() {
      throw new Error('Telegram private RPCs must use the verified gateway');
    },
  };
  return { client, calls };
}

test('Telegram private adapters route reads and writes through the verified gateway', async () => {
  globalThis.window = { Telegram: { WebApp: { initData: 'signed-fresh-init-data' } } };

  const notifications = await bundleDomain('../src/lib/domains/notifications.ts', 'tg-private-notifications.cjs');
  const preferences = await bundleDomain('../src/lib/domains/preferences.ts', 'tg-private-preferences.cjs');
  const governance = await bundleDomain('../src/lib/governance/governanceQueries.ts', 'tg-private-governance.cjs');
  const { client, calls } = makeTelegramClient();

  const listed = await notifications.listMyNotifications(client);
  assert.equal(listed.ok, true);
  assert.equal(listed.data[0].id, 'notification-1');
  assert.equal((await notifications.markNotificationReadOnServer('notification-1', client)).data, true);
  assert.equal((await notifications.markAllNotificationsReadOnServer(client)).data, 2);

  assert.equal((await preferences.loadMyPreferences('owner-1', client)).data.language, 'fr');
  assert.equal((await preferences.saveMyPreferences({ language: 'ar' }, client)).data.language, 'ar');

  assert.equal((await governance.fetchGovernanceActorScope(client)).data.actorRole, 'APP_ADMIN');
  assert.equal((await governance.listPendingAccounts({ clientOverride: client })).data.items.length, 1);
  assert.equal((await governance.listAccountDirectory({ clientOverride: client })).data.items.length, 1);
  assert.equal((await governance.fetchGovernanceAccountDetail({ targetUserId: 'target-user', clientOverride: client })).data.account.id, 'target-user');

  assert.equal(calls.length, 9, 'every protected Telegram operation must be sent to the gateway');
  assert.ok(calls.every((call) => call.name === 'telegram-private-ops'));
  assert.ok(calls.every((call) => call.body.initData === 'signed-fresh-init-data'));
  assert.deepEqual(calls.map((call) => call.body.operation), [
    'notifications.list', 'notifications.markOne', 'notifications.markAll',
    'preferences.load', 'preferences.save', 'governance.actorScope',
    'governance.pendingAccounts', 'governance.accountDirectory', 'governance.accountDetail',
  ]);

  for (const lang of ['es', 'de', 'pt']) {
    const saved = await preferences.saveMyPreferences({ language: lang }, client);
    assert.equal(saved.ok, true);
    assert.equal(saved.data.language, lang);
  }
  const callsBeforeInvalid = calls.length;
  const rejected = await preferences.saveMyPreferences({ language: 'it' }, client);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errorCode, 'invalid_language');
  assert.equal(calls.length, callsBeforeInvalid, 'Unsupported language must be rejected before invoking Telegram gateway');

  delete globalThis.window;
});

test('Telegram gateway failures fail closed without falling back to direct Supabase reads or RPCs', async () => {
  globalThis.window = { Telegram: { WebApp: { initData: 'signed-fresh-init-data' } } };
  const notifications = await bundleDomain('../src/lib/domains/notifications.ts', 'tg-private-notifications-fail-closed.cjs');
  let directCalls = 0;
  const client = {
    functions: {
      async invoke() {
        return {
          data: null,
          error: {
            message: 'gateway unavailable',
            context: new Response(JSON.stringify({ error: 'backend_unavailable' }), { status: 503 }),
          },
        };
      },
    },
    from() { directCalls += 1; throw new Error('must not fall back'); },
    rpc() { directCalls += 1; throw new Error('must not fall back'); },
  };
  const result = await notifications.listMyNotifications(client);
  assert.equal(result.ok, false);
  assert.equal(directCalls, 0);
  delete globalThis.window;
});

