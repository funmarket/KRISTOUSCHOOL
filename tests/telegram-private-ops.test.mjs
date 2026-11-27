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

function fakeDatabase({ accountStatus = 'APPROVED', role = 'PARENT', banned = false, throwError = null } = {}) {
  const statements = [];
  const database = {
    statements,
    async begin(callback) {
      let authenticatedRole = false;
      const query = async (strings, ...values) => {
        const text = strings.join('?').replace(/\s+/g, ' ').trim();
        statements.push({ text, values });
        if (text.startsWith('select user_id::text as user_id')) return [{ user_id: ACTOR }];
        if (text.startsWith('select coalesce(banned_until > now()')) return [{ is_banned: banned }];
        if (text.includes("set_config('request.jwt.claim")) return [];
        if (text === 'set local role authenticated') { authenticatedRole = true; return []; }
        assert.equal(authenticatedRole, true, `database operation must execute as authenticated: ${text}`);
        if (text.startsWith('select id::text as id, account_status')) return [{ id: ACTOR, account_status: accountStatus }];
        if (text.startsWith('select role::text as role')) return [{ role }];
        if (throwError && !text.startsWith('select id::text as id') && !text.startsWith('select role::text as role')) {
          throw new Error(throwError);
        }
        if (text.startsWith('select id::text as id, category')) return [{ id: 'notice-1', title: 'Own notification' }];
        if (text.includes('upsert_my_preferences')) {
          const requestedLang = typeof values[0] === 'string' ? values[0] : 'ar';
          return [{ language: requestedLang, theme: 'light', notification_sound: 'Kristou Bell', sound_muted: false, vibration_enabled: true }];
        }
        if (text.startsWith('select language, theme, notification_sound')) return [{ language: 'fr', theme: 'light' }];
        if (text.includes('governance_get_actor_scope')) return [{ data: { role } }];
        if (text.includes('mark_all_user_notification')) return [{ data: 1 }];
        if (text.includes('get_pickup_parent_board') || text.includes('get_pickup_staff_board')) {
          return [{ cycle_id: '00000000-0000-4000-8000-000000000301', student_id: '00000000-0000-4000-8000-000000000302' }];
        }
        if (text.includes('parent_arrived(')) return [{ data: { ok: true, code: 'parent_arrived', state: 'PARENT_ARRIVED', version: 2 } }];
        if (text.includes('get_pickup_operation_receipt(')) return [{ data: { found: true, state: 'RELEASED', version: 3 } }];
        if (text.includes('release_pupil(')) return [{ data: { ok: true, code: 'pupil_released', state: 'RELEASED', version: 3 } }];
        if (text.includes('provision_pickup_cycles(')) return [{ data: { ok: true, provisionedCount: 3, skippedCount: 0 } }];
        if (text.includes('revoke_pickup_release_authority(')) return [{ data: { ok: true, isRevoked: true, version: 1 } }];
        if (text.includes('reinstate_pickup_release_authority(')) return [{ data: { ok: true, isRevoked: false, version: 2 } }];
        if (text.includes('get_pickup_early_departures(')) return [{ data: [{ id: '00000000-0000-4000-8000-000000000401', status: 'PENDING' }] }];
        if (text.includes('request_early_departure(')) return [{ data: { ok: true, code: 'early_departure_requested', status: 'PENDING', version: 1 } }];
        if (text.includes('review_early_departure(')) return [{ data: { ok: true, code: 'early_departure_approved', status: 'APPROVED', version: 2 } }];
        if (text.includes('complete_early_departure_release(')) return [{ data: { ok: true, code: 'early_departure_completed', status: 'COMPLETED', version: 3 } }];
        if (text.includes('get_pickup_outbox_summary(')) return [{ data: { ok: true, pendingCount: 1, retryCount: 0, processingCount: 0, sentCount: 4, failedCount: 0, totalCount: 5, recentFailures: [] } }];
        if (text.includes('retry_failed_pickup_notifications(')) return [{ data: { ok: true, retriedCount: 2, requestId: values[0] } }];
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

  const bannedDb = fakeDatabase({ banned: true });
  const banned = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData(), operation: 'notifications.list', params: {},
  }), deps(bannedDb));
  assert.equal(banned.status, 403, 'an Auth-banned account must be rejected before private work');
  assert.deepEqual(await banned.json(), { error: 'account_not_approved' });
  assert.equal(bannedDb.statements.some(({ text }) => text === 'set local role authenticated'), false);

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

test('preferences.save forwards all 6 supported languages and rejects unsupported codes before database access', async () => {
  for (const lang of ['ar', 'fr', 'en', 'es', 'de', 'pt']) {
    const sql = fakeDatabase();
    const res = await handleTelegramPrivateOps(makeRequest(null, {
      initData: await initData(),
      operation: 'preferences.save',
      params: { language: lang },
    }), deps(sql));
    assert.equal(res.status, 200, `Expected ${lang} to be accepted by telegram-private-ops`);
    const body = await res.json();
    assert.equal(body.language, lang);
    const upsertStmt = sql.statements.find(({ text }) => text.includes('upsert_my_preferences'));
    assert.ok(upsertStmt, `Expected upsert_my_preferences call for ${lang}`);
    assert.equal(upsertStmt.values[0], lang);
  }

  for (const invalidLang of ['it', 'ja', 'xx', 'ES', 123]) {
    const sql = fakeDatabase();
    const res = await handleTelegramPrivateOps(makeRequest(null, {
      initData: await initData(),
      operation: 'preferences.save',
      params: { language: invalidLang },
    }), deps(sql));
    assert.equal(res.status, 400, `Expected ${String(invalidLang)} to be rejected with 400`);
    assert.deepEqual(await res.json(), { error: 'invalid_request' });
    assert.equal(sql.statements.length, 0, `Unsupported language ${String(invalidLang)} must be rejected before database access`);
  }
});

test('all G4/G5/G6 pickup gateway operations enforce validation, authenticated role, and error-status mapping', async () => {
  const U1 = '00000000-0000-4000-8000-000000000301';
  const U2 = '00000000-0000-4000-8000-000000000302';
  const U3 = '00000000-0000-4000-8000-000000000303';

  const parentBoard = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData(), operation: 'pickup.board', params: {},
  }), deps(fakeDatabase({ role: 'PARENT' })));
  assert.equal(parentBoard.status, 200);
  assert.equal((await parentBoard.json())[0].cycle_id, U1);

  const parentWithClassDb = fakeDatabase({ role: 'PARENT' });
  const parentWithClass = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData(), operation: 'pickup.board', params: { classId: U2 },
  }), deps(parentWithClassDb));
  assert.equal(parentWithClass.status, 400);
  assert.equal(parentWithClassDb.statements.some(({ text }) => text.includes('get_pickup_')), false);

  const staffDb = fakeDatabase({ role: 'MANAGER' });
  const staffBoard = await handleTelegramPrivateOps(makeRequest(null, {
    initData: await initData(), operation: 'pickup.board', params: { classId: U2 },
  }), deps(staffDb));
  assert.equal(staffBoard.status, 200);
  assert.equal(staffDb.statements.some(({ text }) => text.includes('get_pickup_staff_board')), true);

  const validPickupCalls = [
    ['pickup.arrive', { cycleId: U1, collectorId: U2, requestId: U3, expectedVersion: 1 }, 'parent_arrived('],
    ['pickup.receipt', { requestId: U3, cycleId: U1 }, 'get_pickup_operation_receipt('],
    ['pickup.release', { cycleId: U1, collectorId: U2, requestId: U3, expectedVersion: 2, inPersonVerified: true, handoffNotes: 'Gate' }, 'release_pupil('],
    ['pickup.provision', { schoolDate: '2026-11-27' }, 'provision_pickup_cycles('],
    ['pickup.openCycles', {}, 'provision_pickup_cycles('],
    ['pickup.revokeRelease', { targetUserId: U2, reason: 'Temporary rotation' }, 'revoke_pickup_release_authority('],
    ['pickup.reinstateRelease', { targetUserId: U2, reason: 'Returned to duty' }, 'reinstate_pickup_release_authority('],
    ['pickup.earlyDepartures', { classId: U2 }, 'get_pickup_early_departures('],
    ['pickup.requestEarly', { studentId: U1, collectorId: U2, requestId: U3, reason: 'Medical checkup', requestedPickupAt: '2026-11-27T11:30:00Z' }, 'request_early_departure('],
    ['pickup.reviewEarly', { earlyDepartureId: U1, requestId: U3, decision: 'APPROVED', expectedVersion: 1 }, 'review_early_departure('],
    ['pickup.completeEarly', { earlyDepartureId: U1, collectorId: U2, requestId: U3, expectedVersion: 2, inPersonVerified: true, handoffNotes: 'Signed out' }, 'complete_early_departure_release('],
    ['pickup.outboxSummary', {}, 'get_pickup_outbox_summary('],
    ['pickup.retryOutbox', { requestId: U3 }, 'retry_failed_pickup_notifications('],
  ];

  for (const [operation, params, expectedSql] of validPickupCalls) {
    const sql = fakeDatabase({ role: 'APP_ADMIN' });
    const res = await handleTelegramPrivateOps(makeRequest(null, {
      initData: await initData(), operation, params,
    }), deps(sql));
    assert.equal(res.status, 200, `${operation} should return 200`);
    assert.equal(sql.statements.some(({ text }) => text.includes(expectedSql)), true, `${operation} must call ${expectedSql}`);
    assert.equal(sql.statements.some(({ text }) => text === 'set local role authenticated'), true);
  }

  const badRequests = [
    ['pickup.arrive', { cycleId: 'not-uuid', collectorId: U2, requestId: U3, expectedVersion: 1 }],
    ['pickup.release', { cycleId: U1, collectorId: U2, requestId: U3, expectedVersion: 0, inPersonVerified: true }],
    ['pickup.revokeRelease', { targetUserId: U2, reason: 'no' }],
    ['pickup.requestEarly', { studentId: U1, collectorId: U2, requestId: U3, reason: 'Medical', requestedPickupAt: 'invalid-date' }],
    ['pickup.reviewEarly', { earlyDepartureId: U1, requestId: U3, decision: 'REJECTED', expectedVersion: 1 }],
    ['pickup.completeEarly', { earlyDepartureId: U1, collectorId: U2, requestId: U3, expectedVersion: 2, inPersonVerified: 'yes' }],
    ['pickup.retryOutbox', { requestId: 'not-a-uuid' }],
  ];
  for (const [operation, params] of badRequests) {
    const sql = fakeDatabase({ role: 'APP_ADMIN' });
    const res = await handleTelegramPrivateOps(makeRequest(null, {
      initData: await initData(), operation, params,
    }), deps(sql));
    assert.equal(res.status, 400, `${operation} invalid input must return 400`);
    assert.equal(sql.statements.some(({ text }) => text.includes('early_departure') || text.includes('release_') || text.includes('parent_arrived')), false);
  }

  const errorStatusCases = [
    ['version_conflict', 409],
    ['early_departure_already_open', 409],
    ['early_departure_terminal', 409],
    ['early_departure_not_approved', 409],
    ['pickup_release_authority_revoked', 403],
    ['insufficient_pickup_scope', 403],
    ['cycle_date_mismatch', 422],
    ['early_departure_not_found', 422],
    ['schedule_unavailable', 422],
    ['invalid_pickup_request', 400],
    ['pickup_app_admin_required', 403],
  ];
  for (const [code, expectedStatus] of errorStatusCases) {
    const sql = fakeDatabase({ role: 'APP_ADMIN', throwError: code });
    const res = await handleTelegramPrivateOps(makeRequest(null, {
      initData: await initData(),
      operation: 'pickup.completeEarly',
      params: { earlyDepartureId: U1, collectorId: U2, requestId: U3, expectedVersion: 2, inPersonVerified: true },
    }), deps(sql));
    assert.equal(res.status, expectedStatus, `${code} must map to HTTP ${expectedStatus}`);
    assert.deepEqual(await res.json(), { error: code });
  }
});

