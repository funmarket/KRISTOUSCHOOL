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

test('Pickup G4/G5/G6 Telegram operations route exclusively through telegram-private-ops and fail closed', async () => {
  globalThis.window = { Telegram: { WebApp: { initData: 'signed-fresh-init-data' } } };
  const pickup = await bundleDomain('../src/lib/domains/pickup.ts', 'tg-private-pickup.cjs');
  const tgOps = await bundleDomain('../src/lib/telegramPrivateOperations.ts', 'tg-private-ops-helper.cjs');

  const U1 = '00000000-0000-4000-8000-000000000301';
  const U2 = '00000000-0000-4000-8000-000000000302';
  const U3 = '00000000-0000-4000-8000-000000000303';
  const calls = [];
  const client = {
    functions: {
      async invoke(name, options) {
        calls.push({ name, body: options?.body });
        const op = options?.body?.operation;
        if (op === 'pickup.board') {
          return {
            data: [{
              cycle_id: U1, student_id: U2, student_label: 'Test Pupil', class_id: U3, class_label: 'CP-A',
              school_date: '2026-11-27', state: 'PARENT_ARRIVED', version: 2, eligible: true,
              eligibility_reason: 'present', schedule_available: true, window_start: '2026-11-27T11:30:00Z',
              window_end: '2026-11-27T12:30:00Z', can_announce_arrival: false, can_confirm_release: true,
              collectors: [{ id: U2, displayName: 'Authorized Parent', relationshipLabel: 'Parent' }],
              collector_label: 'Authorized Parent',
            }],
            error: null,
          };
        }
        if (op === 'pickup.arrive') return { data: { ok: true, code: 'parent_arrived', cycleId: U1, state: 'PARENT_ARRIVED', version: 2, requestId: U3 }, error: null };
        if (op === 'pickup.release') return { data: { ok: true, code: 'pupil_released', cycleId: U1, state: 'RELEASED', version: 3, requestId: U3 }, error: null };
        if (op === 'pickup.receipt') return { data: { found: true, cycleId: U1, state: 'RELEASED', version: 3, result: { ok: true, code: 'pupil_released' } }, error: null };
        if (op === 'pickup.provision') return { data: { ok: true, schoolDate: '2026-11-27', timezone: 'Africa/Tunis', provisionedCount: 2, skippedCount: 0 }, error: null };
        if (op === 'pickup.revokeRelease') return { data: { ok: true, targetUserId: U2, isRevoked: true, version: 1 }, error: null };
        if (op === 'pickup.reinstateRelease') return { data: { ok: true, targetUserId: U2, isRevoked: false, version: 2 }, error: null };
        if (op === 'pickup.earlyDepartures') return { data: [{ id: U1, status: 'PENDING' }], error: null };
        if (op === 'pickup.requestEarly') return { data: { ok: true, code: 'early_departure_requested', earlyDepartureId: U1, status: 'PENDING', version: 1 }, error: null };
        if (op === 'pickup.reviewEarly') return { data: { ok: true, code: 'early_departure_approved', earlyDepartureId: U1, status: 'APPROVED', version: 2 }, error: null };
        if (op === 'pickup.completeEarly') return { data: { ok: true, code: 'early_departure_completed', earlyDepartureId: U1, status: 'COMPLETED', version: 3 }, error: null };
        return { data: null, error: new Error(`Unexpected op ${op}`) };
      },
    },
    from() { throw new Error('Pickup Telegram operations must never use PostgREST'); },
    rpc() { throw new Error('Pickup Telegram operations must never call direct RPC'); },
  };

  assert.equal((await pickup.fetchPickupBoardCycles({ role: 'MANAGER' }, client)).ok, true);
  assert.equal((await pickup.announcePickupArrival({ cycleId: U1, collectorId: U2, requestId: U3, expectedVersion: 1 }, client)).outcome, 'SUCCESS');
  assert.equal((await pickup.confirmPickupRelease({ cycleId: U1, collectorId: U2, requestId: U3, expectedVersion: 2, collectorVerifiedInPerson: true, physicalHandoffAttested: true }, client)).outcome, 'SUCCESS');
  assert.equal((await pickup.readPickupOperationReceipt(U3, U1, client)).outcome, 'SUCCESS');
  assert.equal((await pickup.provisionPickupCycles('2026-11-27', client)).provisionedCount, 2);
  assert.equal((await pickup.revokePickupReleaseAuthority(U2, 'Audit hold', client)).isRevoked, true);
  assert.equal((await pickup.reinstatePickupReleaseAuthority(U2, 'Audit cleared', client)).isRevoked, false);

  assert.equal((await tgOps.invokeTelegramPrivateOperation('pickup.earlyDepartures', { classId: U3 }, client)).data[0].id, U1);
  assert.equal((await tgOps.invokeTelegramPrivateOperation('pickup.requestEarly', { studentId: U2, collectorId: U2, requestId: U3, reason: 'Appointment' }, client)).data.code, 'early_departure_requested');
  assert.equal((await tgOps.invokeTelegramPrivateOperation('pickup.reviewEarly', { earlyDepartureId: U1, requestId: U3, decision: 'APPROVED', expectedVersion: 1 }, client)).data.code, 'early_departure_approved');
  assert.equal((await tgOps.invokeTelegramPrivateOperation('pickup.completeEarly', { earlyDepartureId: U1, collectorId: U2, requestId: U3, expectedVersion: 2, inPersonVerified: true }, client)).data.code, 'early_departure_completed');

  assert.deepEqual(calls.map((c) => c.body.operation), [
    'pickup.board', 'pickup.arrive', 'pickup.release', 'pickup.receipt',
    'pickup.provision', 'pickup.revokeRelease', 'pickup.reinstateRelease',
    'pickup.earlyDepartures', 'pickup.requestEarly', 'pickup.reviewEarly', 'pickup.completeEarly',
  ]);

  for (const code of ['cycle_date_mismatch', 'early_departure_not_found', 'early_departure_already_open', 'early_departure_terminal', 'early_departure_not_approved']) {
    let directCalls = 0;
    const errClient = {
      functions: {
        async invoke() {
          return {
            data: null,
            error: { message: 'gateway error', context: new Response(JSON.stringify({ error: code }), { status: 409 }) },
          };
        },
      },
      from() { directCalls += 1; throw new Error('must not fall back'); },
      rpc() { directCalls += 1; throw new Error('must not fall back'); },
    };
    await assert.rejects(() => tgOps.invokeTelegramPrivateOperation('pickup.completeEarly', {}, errClient), (err) => err.code === code);
    assert.equal(directCalls, 0);
  }
  delete globalThis.window;
});


