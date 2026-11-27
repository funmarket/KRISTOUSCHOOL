import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';

const dom = installNodeDomShim();
const { createRoot } = await import('react-dom/client');
import { translations } from '../src/i18n/translations.ts';
import {
  getPickupOutboxSummary,
  retryFailedPickupNotifications,
  subscribePickupRealtime,
} from '../src/lib/domains/pickup.ts';
import { usePickupAdminActions } from '../src/context/usePickupAdminActions.ts';
import { usePickupRealtime } from '../src/context/usePickupRealtime.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const UUID_REQ = '66666666-6666-4666-8666-666666666666';
const UUID_FAIL = '77777777-7777-4777-8777-777777777777';

function makeOutboxSummary(overrides = {}) {
  return {
    ok: true,
    pendingCount: 2,
    retryCount: 1,
    processingCount: 0,
    sentCount: 14,
    failedCount: 1,
    totalCount: 18,
    oldestPendingAt: '2026-11-27T10:00:00Z',
    lastSentAt: '2026-11-27T10:05:00Z',
    recentFailures: [
      {
        id: UUID_FAIL,
        eventType: 'pickup.arrival_announced',
        attemptCount: 5,
        lastError: 'telegram_http_429',
        createdAt: '2026-11-27T09:50:00Z',
      },
    ],
    ...overrides,
  };
}

test('G7 Transports: outbox summary, idempotent retry, Telegram gateway, and realtime subscription states', async () => {
  const rpcCalls = [];
  const summaryRes = await getPickupOutboxSummary({
    rpc: async (fn) => {
      rpcCalls.push(fn);
      return { data: makeOutboxSummary(), error: null };
    },
  });
  assert.equal(summaryRes.ok, true);
  assert.equal(summaryRes.failedCount, 1);
  assert.equal(summaryRes.recentFailures.length, 1);
  assert.deepEqual(rpcCalls, ['get_pickup_outbox_summary']);

  const deniedSummary = await getPickupOutboxSummary({
    rpc: async () => ({ data: null, error: { code: 'P0001', message: 'pickup_app_admin_required' } }),
  });
  assert.equal(deniedSummary.ok, false);
  assert.equal(deniedSummary.errorCode, 'pickup_app_admin_required');

  const badRetry = await retryFailedPickupNotifications('not-a-uuid', { rpc: async () => ({ data: null, error: null }) });
  assert.equal(badRetry.ok, false);
  assert.equal(badRetry.errorCode, 'invalid_pickup_request');

  const conflictRetry = await retryFailedPickupNotifications(UUID_REQ, {
    rpc: async () => ({ data: null, error: { code: 'P0001', message: 'idempotency_conflict' } }),
  });
  assert.equal(conflictRetry.ok, false);
  assert.equal(conflictRetry.errorCode, 'idempotency_conflict');

  const okRetry = await retryFailedPickupNotifications(UUID_REQ, {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      return { data: { ok: true, retriedCount: 2, requestId: UUID_REQ, replayed: false }, error: null };
    },
  });
  assert.equal(okRetry.ok, true);
  assert.equal(okRetry.retriedCount, 2);
  assert.deepEqual(rpcCalls[1], { fn: 'retry_failed_pickup_notifications', args: { p_request_id: UUID_REQ } });

  // Realtime transport: null client falls back to POLLING; valid client tracks LIVE/POLLING & cleans up
  const fallbackStatuses = [];
  const noClientSub = subscribePickupRealtime({
    onChange: () => {},
    onStatusChange: (s) => fallbackStatuses.push(s),
    clientOverride: null,
  });
  assert.deepEqual(fallbackStatuses, ['POLLING']);
  noClientSub.unsubscribe();

  const statuses = [];
  let changes = 0;
  let subscribeCb = null;
  let tableHandler = null;
  let removed = false;
  const subscribedTables = [];
  const channelStub = {
    on(_evt, filter, cb) {
      subscribedTables.push(filter.table);
      tableHandler = cb;
      return channelStub;
    },
    subscribe(cb) {
      subscribeCb = cb;
      return channelStub;
    },
  };
  const sub = subscribePickupRealtime({
    onChange: () => { changes += 1; },
    onStatusChange: (s) => statuses.push(s),
    clientOverride: {
      channel: () => channelStub,
      removeChannel: () => { removed = true; },
    },
  });
  assert.deepEqual(subscribedTables, ['pickup_cycles', 'early_departure_requests', 'pickup_release_revocations']);
  subscribeCb('SUBSCRIBED');
  tableHandler();
  subscribeCb('CHANNEL_ERROR');
  sub.unsubscribe();
  assert.deepEqual(statuses, ['CONNECTING', 'LIVE', 'POLLING']);
  assert.equal(changes, 1);
  assert.equal(removed, true);
});

test('G7 Hooks: usePickupRealtime debounces updates, runs polling fallback, and cleans up on unmount', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  let hookRes = null;
  let syncCount = 0;
  let emitChange = null;
  let emitStatus = null;
  let unsubscribedCount = 0;

  function Harness({ enabled, accountKey }) {
    hookRes = usePickupRealtime({
      enabled,
      accountKey,
      debounceMs: 25,
      pollIntervalMs: 30,
      onSync: () => { syncCount += 1; },
      subscribeFn: ({ onChange, onStatusChange }) => {
        emitChange = onChange;
        emitStatus = onStatusChange;
        onStatusChange?.('LIVE');
        return {
          unsubscribe: () => {
            unsubscribedCount += 1;
          },
        };
      },
    });
    return null;
  }

  await act(async () => {
    root.render(React.createElement(Harness, { enabled: true, accountKey: 'admin-1' }));
  });
  assert.equal(hookRes.realtimeStatus, 'LIVE');

  // Multiple rapid postgres_changes events coalesce into one sync
  act(() => {
    emitChange();
    emitChange();
    emitChange();
  });
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(syncCount, 1);

  // Switching to POLLING triggers periodic fallback syncs
  await act(async () => {
    emitStatus('POLLING');
  });
  assert.equal(hookRes.realtimeStatus, 'POLLING');
  await new Promise((r) => setTimeout(r, 85));
  assert.ok(syncCount >= 2, `Expected polling fallback syncs, got ${syncCount}`);

  // Account switch unsubscribes previous channel
  const prevUnsubs = unsubscribedCount;
  await act(async () => {
    root.render(React.createElement(Harness, { enabled: true, accountKey: 'admin-2' }));
  });
  assert.ok(unsubscribedCount > prevUnsubs);

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
});

test('G7 Admin Hook & UI: APP_ADMIN sees outbox health + retries failures; non-admins do not see outbox card', async () => {
  // Hook test for usePickupAdminActions outbox methods
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  let adminHook = null;
  let identityRef = { userId: 'mgr-1', accountStatus: 'APPROVED', generation: 1 };
  let boardRefreshes = 0;
  let failedCountState = 2;

  function AdminHarness({ user }) {
    adminHook = usePickupAdminActions({
      currentUser: user,
      getCurrentIdentity: () => identityRef,
      effectiveMountedRef: { current: true },
      refreshPickupBoardForUser: async () => {
        boardRefreshes += 1;
        return { ok: true, status: 'READY', availability: 'READY', records: [], lastSyncedAt: null };
      },
      adapters: {
        getOutboxSummary: async () => makeOutboxSummary({ failedCount: failedCountState }),
        retryFailedOutbox: async (requestId) => {
          assert.match(requestId, /^[0-9a-f-]{36}$/i);
          failedCountState = 0;
          return { ok: true, retriedCount: 2, requestId };
        },
      },
    });
    return null;
  }

  const mgrUser = { id: 'mgr-1', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED' };
  await act(async () => { root.render(React.createElement(AdminHarness, { user: mgrUser })); });
  const denied = await adminHook.refreshPickupOutboxSummary();
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, 'pickup_app_admin_required');

  const ownerUser = { id: 'owner-1', username: 'owner', fullName: 'Owner', role: 'APP_ADMIN', accountStatus: 'APPROVED' };
  identityRef = { userId: 'owner-1', accountStatus: 'APPROVED', generation: 2 };
  await act(async () => { root.render(React.createElement(AdminHarness, { user: ownerUser })); });
  await act(async () => { await adminHook.refreshPickupOutboxSummary(); });
  assert.equal(adminHook.pickupOutboxSummary.failedCount, 2);

  await act(async () => { await adminHook.retryFailedPickupOutbox(); });
  assert.equal(adminHook.pickupAdminNotice.action, 'RETRY_OUTBOX');
  assert.equal(adminHook.pickupAdminNotice.retriedCount, 2);
  assert.equal(adminHook.pickupOutboxSummary.failedCount, 0);
  assert.equal(boardRefreshes, 1);

  await act(async () => { adminHook.clearPickupAdminState(); });
  assert.equal(adminHook.pickupOutboxSummary, null);

  // Full PickupBoardView render test
  const outdir = path.join('/tmp', 'kristou-pickup-g7-ui-test');
  fs.mkdirSync(outdir, { recursive: true });
  const pickupOutfile = path.join(outdir, 'PickupBoardView.cjs');
  const require = createRequire(import.meta.url);
  const plugin = {
    name: 'mock-g7-ui',
    setup(builder) {
      builder.onResolve({ filter: /context\/AppContext$/ }, () => ({ path: 'mock-app-ctx', namespace: 'pickupg7' }));
      builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'pickupg7' }, () => ({ contents: `export const useApp = () => globalThis.__PICKUP_G7_UI_CTX__;` }));
      builder.onResolve({ filter: /^[^./]/ }, (args) => ({ path: require.resolve(args.path), external: true }));
    },
  };
  await build({ entryPoints: [path.resolve(ROOT, 'src/components/views/PickupBoardView.tsx')], outfile: pickupOutfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [plugin] });

  const { PickupBoardView } = require(pickupOutfile);
  const tEn = (key) => translations.en[key] ?? key;

  let summaryRefreshes = 0;
  let retryClicks = 0;
  globalThis.__PICKUP_G7_UI_CTX__ = {
    currentUser: ownerUser,
    currentRole: 'APP_ADMIN',
    childrenList: [],
    classesList: [],
    pickupCycles: [],
    pickupAvailability: 'READY',
    pickupError: null,
    pickupErrorCode: null,
    pickupLastSyncedAt: '2026-11-27T10:05:00Z',
    pickupMutationState: {},
    isLoadingPickup: false,
    pickupOutboxSummary: makeOutboxSummary(),
    isLoadingPickupOutbox: false,
    isRetryingPickupOutbox: false,
    earlyDepartures: [],
    earlyDeparturesAvailability: 'READY',
    refreshPickupBoard: async () => ({ ok: true, status: 'READY', availability: 'READY', records: [], lastSyncedAt: null }),
    refreshPickupOutboxSummary: async () => { summaryRefreshes += 1; return makeOutboxSummary(); },
    retryFailedPickupOutbox: async () => { retryClicks += 1; return { ok: true, retriedCount: 1, requestId: UUID_REQ }; },
    language: 'en',
    t: tEn,
  };

  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector('[data-testid="pickup-realtime-status-badge"]'));
  assert.ok(container.querySelector('[data-testid="pickup-outbox-health-card"]'));
  assert.equal(container.querySelector('[data-testid="pickup-outbox-failed-count"]').textContent, '1');
  assert.ok(container.querySelector(`[data-testid="pickup-outbox-failure-${UUID_FAIL}"]`));
  assert.ok(summaryRefreshes >= 1);

  await act(async () => { container.querySelector('[data-testid="pickup-outbox-refresh-btn"]').click(); });
  await act(async () => { container.querySelector('[data-testid="pickup-outbox-retry-btn"]').click(); });
  assert.equal(retryClicks, 1);

  // When failedCount is 0, retry button is disabled
  globalThis.__PICKUP_G7_UI_CTX__ = {
    ...globalThis.__PICKUP_G7_UI_CTX__,
    pickupOutboxSummary: makeOutboxSummary({ failedCount: 0, recentFailures: [] }),
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.equal(container.querySelector('[data-testid="pickup-outbox-retry-btn"]').disabled, true);
  assert.ok(container.querySelector('[data-testid="pickup-outbox-no-failures"]'));

  // Non-APP_ADMIN role (MANAGER) does NOT see outbox health card
  globalThis.__PICKUP_G7_UI_CTX__ = {
    ...globalThis.__PICKUP_G7_UI_CTX__,
    currentUser: mgrUser,
    currentRole: 'MANAGER',
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.equal(container.querySelector('[data-testid="pickup-outbox-health-card"]'), null);

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
  fs.rmSync(outdir, { recursive: true, force: true });
});

test('G7 Localization: all 6 languages have complete non-English G7 realtime and outbox keys', () => {
  const g7Keys = [
    'pickupRealtimeLiveBadge',
    'pickupRealtimePollingBadge',
    'pickupOutboxHealthTitle',
    'pickupOutboxPendingLabel',
    'pickupOutboxRetryingLabel',
    'pickupOutboxProcessingLabel',
    'pickupOutboxSentLabel',
    'pickupOutboxFailedLabel',
    'pickupOutboxRefreshBtn',
    'pickupOutboxRetryFailedBtn',
    'pickupOutboxRetrying',
    'pickupOutboxRetrySuccess',
    'pickupOutboxNoFailures',
    'pickupOutboxRecentFailuresLabel',
  ];
  for (const lang of ['ar', 'fr', 'en', 'es', 'de', 'pt']) {
    for (const key of g7Keys) {
      const val = translations[lang][key];
      assert.equal(typeof val, 'string');
      assert.ok(val.trim().length > 0, `Missing ${lang}.${key}`);
      if (lang !== 'en') {
        assert.notEqual(val, translations.en[key], `English fallback in ${lang}.${key}`);
      }
    }
  }
});
