import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';
import { translations } from '../src/i18n/translations.ts';
import {
  announcePickupArrival,
  confirmPickupRelease,
  createPickupRequestId,
  fetchPickupBoardCycles,
  PICKUP_BACKEND_UNAVAILABLE_CODE,
  readPickupOperationReceipt,
} from '../src/lib/domains/pickup.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';
const UUID_4 = '44444444-4444-4444-8444-444444444444';
const UUID_5 = '55555555-5555-4555-8555-555555555555';
const UUID_6 = '66666666-6666-4666-8666-666666666666';

function makeServerBoardRow(overrides = {}) {
  return {
    cycle_id: UUID_1,
    student_id: UUID_2,
    student_label: 'Youssef Ben Ali',
    class_id: UUID_3,
    class_label: 'CE1-A',
    school_date: '2026-11-26',
    state: 'WAITING',
    version: 1,
    window_start: '2026-11-26T15:00:00Z',
    window_end: '2026-11-26T16:30:00Z',
    schedule_available: true,
    eligible: true,
    eligibility_reason: 'present',
    can_announce_arrival: true,
    can_confirm_release: false,
    arrival_at: null,
    arrival_actor_label: null,
    collector_label: null,
    release_at: null,
    release_actor_label: null,
    collectors: [
      { id: UUID_4, displayName: 'Amira Ben Ali', relationshipLabel: 'Mother' },
      { id: UUID_5, displayName: 'Karim Ben Ali', relationshipLabel: 'Father' },
    ],
    ...overrides,
  };
}

test('G4 Domain Contract: UUID v4 request IDs, parent/staff board RPC routing, fail-closed checks, and Telegram Edge routing', async () => {
  const uuidV4Re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const reqIdA = createPickupRequestId('arrival', UUID_1);
  const reqIdB = createPickupRequestId('arrival', UUID_1);
  assert.match(reqIdA, uuidV4Re);
  assert.notEqual(reqIdA, reqIdB);

  const rpcCalls = [];
  const parentClient = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      return { data: [makeServerBoardRow()], error: null };
    },
  };
  const parentRes = await fetchPickupBoardCycles({ role: 'PARENT' }, parentClient);
  assert.equal(parentRes.ok, true);
  assert.equal(parentRes.availability, 'READY');
  assert.equal(rpcCalls[0].fn, 'get_pickup_parent_board');
  assert.equal(parentRes.records[0].windowLabel, '16:00 - 17:30');
  assert.equal(parentRes.records[0].windowStatus, 'OPEN');
  assert.equal(parentRes.records[0].actorCanConfirmRelease, false);

  const staffRes = await fetchPickupBoardCycles(
    { role: 'TEACHER', classId: UUID_3 },
    {
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return { data: [makeServerBoardRow({ eligible: false, eligibility_reason: 'attendance_absent', can_announce_arrival: false })], error: null };
      },
    },
  );
  assert.equal(staffRes.ok, true);
  assert.equal(rpcCalls[1].fn, 'get_pickup_staff_board');
  assert.deepEqual(rpcCalls[1].args, { p_class_id: UUID_3 });
  assert.equal(staffRes.records[0].attendanceEligibility, 'INELIGIBLE');
  assert.equal(staffRes.records[0].attendanceReasonCode, 'attendance_absent');

  // SCHOOL_STAFF & STUDENT fail closed locally without RPC calls
  let calledDenied = false;
  const staffBlocked = await fetchPickupBoardCycles(
    { role: 'SCHOOL_STAFF' },
    { rpc: async () => { calledDenied = true; return { data: [], error: null }; } },
  );
  assert.equal(staffBlocked.ok, false);
  assert.equal(staffBlocked.availability, 'UNAUTHORIZED');
  assert.equal(calledDenied, false);

  // Server non-array or malformed row fails closed as ERROR without fabricating WAITING
  const badRes = await fetchPickupBoardCycles({ role: 'PARENT' }, { rpc: async () => ({ data: [{ cycle_id: UUID_1 }], error: null }) });
  assert.equal(badRes.ok, false);
  assert.equal(badRes.availability, 'ERROR');
  assert.deepEqual(badRes.records, []);

  // Insufficient pickup scope error maps to UNAUTHORIZED
  const scopeErr = await fetchPickupBoardCycles({ role: 'MANAGER' }, { rpc: async () => ({ data: null, error: { code: 'P0001', message: 'insufficient_pickup_scope' } }) });
  assert.equal(scopeErr.ok, false);
  assert.equal(scopeErr.availability, 'UNAUTHORIZED');

  // Telegram private ops routing when Telegram.WebApp.initData is present
  const prevWin = globalThis.window;
  try {
    const edgeInvokes = [];
    globalThis.window = { Telegram: { WebApp: { initData: 'signed_tg_init_data_payload' } } };
    const tgClient = {
      functions: {
        invoke: async (fnName, { body }) => {
          edgeInvokes.push({ fnName, body });
          if (body.operation === 'pickup.board') {
            return { data: [makeServerBoardRow({ state: 'PARENT_ARRIVED', version: 2, can_announce_arrival: false, arrival_at: '2026-11-26T15:15:00Z', collector_label: 'Amira Ben Ali' })], error: null };
          }
          if (body.operation === 'pickup.arrive') {
            return { data: { ok: true, code: 'parent_arrived', cycleId: UUID_1, state: 'PARENT_ARRIVED', version: 2, requestId: UUID_6 }, error: null };
          }
          return { data: { found: true, cycleId: UUID_1, state: 'PARENT_ARRIVED', version: 2, result: { ok: true, code: 'parent_arrived' } }, error: null };
        },
      },
    };
    const tgBoard = await fetchPickupBoardCycles({ role: 'MANAGER', classId: UUID_3 }, tgClient);
    assert.equal(tgBoard.ok, true);
    assert.equal(edgeInvokes[0].body.operation, 'pickup.board');
    assert.equal(edgeInvokes[0].body.params.classId, UUID_3);

    const tgArr = await announcePickupArrival({ cycleId: UUID_1, studentId: UUID_2, collectorId: UUID_4, requestId: UUID_6, expectedVersion: 1 }, tgClient);
    assert.equal(tgArr.ok, true);
    assert.equal(tgArr.state, 'PARENT_ARRIVED');
    assert.equal(edgeInvokes[1].body.operation, 'pickup.arrive');

    const tgReceipt = await readPickupOperationReceipt(UUID_6, UUID_1, tgClient);
    assert.equal(tgReceipt.ok, true);
    assert.equal(edgeInvokes[2].body.operation, 'pickup.receipt');
  } finally {
    globalThis.window = prevWin;
  }
});

test('G4 Arrival Command Outcomes & Fail-Closed G5 Release Guard', async () => {
  const rpcCalls = [];
  const okRes = await announcePickupArrival(
    { cycleId: UUID_1, studentId: UUID_2, collectorId: UUID_4, requestId: UUID_6, expectedVersion: 1 },
    {
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return { data: { ok: true, code: 'parent_arrived', cycleId: UUID_1, state: 'PARENT_ARRIVED', version: 2, requestId: UUID_6 }, error: null };
      },
    },
  );
  assert.equal(okRes.ok, true);
  assert.equal(okRes.state, 'PARENT_ARRIVED');
  assert.equal(okRes.version, 2);
  assert.deepEqual(rpcCalls[0], {
    fn: 'parent_arrived',
    args: { p_cycle_id: UUID_1, p_collector_id: UUID_4, p_request_id: UUID_6, p_expected_version: 1 },
  });

  // version_conflict JSON response preserves serverState & serverVersion
  const conflictRes = await announcePickupArrival(
    { cycleId: UUID_1, studentId: UUID_2, collectorId: UUID_4, requestId: UUID_6, expectedVersion: 1 },
    { rpc: async () => ({ data: { ok: false, code: 'version_conflict', state: 'PARENT_ARRIVED', version: 2 }, error: null }) },
  );
  assert.equal(conflictRes.ok, false);
  assert.equal(conflictRes.outcome, 'CONFLICT');
  assert.equal(conflictRes.serverState, 'PARENT_ARRIVED');
  assert.equal(conflictRes.serverVersion, 2);

  // P0001 error mappings
  const idemRes = await announcePickupArrival(
    { cycleId: UUID_1, studentId: UUID_2, collectorId: UUID_4, requestId: UUID_6, expectedVersion: 1 },
    { rpc: async () => ({ data: null, error: { code: 'P0001', message: 'idempotency_conflict' } }) },
  );
  assert.equal(idemRes.outcome, 'CONFLICT');
  assert.equal(idemRes.reasonCode, 'idempotency_conflict');

  const outsideWin = await announcePickupArrival(
    { cycleId: UUID_1, studentId: UUID_2, collectorId: UUID_4, requestId: UUID_6, expectedVersion: 1 },
    { rpc: async () => ({ data: null, error: { code: 'P0001', message: 'outside_dismissal_window' } }) },
  );
  assert.equal(outsideWin.outcome, 'UNAVAILABLE');
  assert.equal(outsideWin.reasonCode, 'outside_dismissal_window');

  const deniedCol = await announcePickupArrival(
    { cycleId: UUID_1, studentId: UUID_2, collectorId: UUID_4, requestId: UUID_6, expectedVersion: 1 },
    { rpc: async () => ({ data: null, error: { code: 'P0001', message: 'collector_or_parent_not_authorized' } }) },
  );
  assert.equal(deniedCol.outcome, 'DENIED');
  assert.equal(deniedCol.reasonCode, 'collector_not_authorized');

  // Network throw maps to UNKNOWN_OUTCOME with requestId
  const netErr = await announcePickupArrival(
    { cycleId: UUID_1, studentId: UUID_2, collectorId: UUID_4, requestId: UUID_6, expectedVersion: 1 },
    { rpc: async () => { throw new Error('Failed to fetch'); } },
  );
  assert.equal(netErr.outcome, 'UNKNOWN_OUTCOME');
  assert.equal(netErr.requestId, UUID_6);

  // G5 physical release stays strictly disabled / fail-closed
  const relLocked = await confirmPickupRelease({
    cycleId: UUID_1,
    collectorId: UUID_4,
    requestId: UUID_6,
    expectedVersion: 2,
    physicalHandoffAttested: true,
    collectorVerifiedInPerson: true,
  });
  assert.equal(relLocked.ok, false);
  assert.equal(relLocked.outcome, 'UNAVAILABLE');
  assert.equal(relLocked.reasonCode, PICKUP_BACKEND_UNAVAILABLE_CODE);
});

test('G4 Hook Readback: auto-invokes get_pickup_operation_receipt with same requestId on transport uncertainty and recovers PARENT_ARRIVED', async () => {
  const dom = installNodeDomShim();
  const { usePickupState } = await import('../src/context/usePickupState.ts');

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  let hookApi = null;
  const verifiedReceipts = [];
  let boardArrived = false;
  const identityRef = { userId: 'parent-1', accountStatus: 'APPROVED', generation: 1 };

  const baseRecord = {
    cycleId: UUID_1,
    studentId: UUID_2,
    studentName: 'Youssef Ben Ali',
    studentPhotoUrl: null,
    classId: UUID_3,
    className: 'CE1-A',
    schoolDate: '2026-11-26',
    windowId: `${UUID_3}:2026-11-26`,
    windowLabel: '16:00 - 17:30',
    windowStatus: 'OPEN',
    attendanceEligibility: 'ELIGIBLE',
    state: 'WAITING',
    version: 1,
    parentArrivedAt: null,
    arrivedByUserId: null,
    intendedCollectorId: UUID_4,
    intendedCollectorName: null,
    authorizedCollectors: [{ collectorId: UUID_4, fullName: 'Amira Ben Ali', relationshipLabel: 'Mother', status: 'ACTIVE' }],
    releasedAt: null,
    releasedByUserId: null,
    releasedByName: null,
    releasedToCollectorId: null,
    releasedToCollectorName: null,
    actorCanAnnounceArrival: true,
    actorCanConfirmRelease: false,
    revocationStatus: 'NONE',
    outboxStatus: 'NONE',
    lastSyncedAt: '2026-11-26T15:00:00Z',
  };

  const adapters = {
    fetchCycles: async () => ({
      ok: true,
      status: 'READY',
      availability: 'READY',
      records: [
        boardArrived
          ? { ...baseRecord, state: 'PARENT_ARRIVED', version: 2, parentArrivedAt: '2026-11-26T15:10:00Z', intendedCollectorName: 'Amira Ben Ali', actorCanAnnounceArrival: false }
          : baseRecord,
      ],
      lastSyncedAt: '2026-11-26T15:10:00Z',
    }),
    announceArrival: async (input) => {
      boardArrived = true;
      throw new Error(`Network drop for ${input.requestId}`);
    },
    readOperationReceipt: async (requestId, cycleId) => {
      verifiedReceipts.push({ requestId, cycleId });
      return { ok: true, outcome: 'SUCCESS', operationId: requestId, cycleId, state: 'PARENT_ARRIVED', version: 2, outboxEnqueued: true };
    },
  };

  function Harness({ user }) {
    hookApi = usePickupState({ currentUser: user, identityContext: identityRef, getCurrentIdentity: () => identityRef, adapters });
    return null;
  }

  const parentUser = { id: 'parent-1', username: 'p1', fullName: 'Amira', role: 'PARENT', accountStatus: 'APPROVED' };
  await act(async () => { root.render(React.createElement(Harness, { user: parentUser })); });
  await act(async () => { await hookApi.refreshPickupBoard(); });

  let res;
  await act(async () => {
    res = await hookApi.markPickupArrived({
      cycleId: UUID_1,
      studentId: UUID_2,
      collectorId: UUID_4,
      requestId: UUID_6,
      expectedVersion: 1,
    });
  });

  assert.ok(verifiedReceipts.length >= 1);
  assert.deepEqual(verifiedReceipts[0], { requestId: UUID_6, cycleId: UUID_1 });
  assert.equal(res.success, true);
  assert.equal(hookApi.pickupCycles[0].state, 'PARENT_ARRIVED');
  assert.equal(hookApi.pickupCycles[0].version, 2);

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
});

test('G4 UI + 6-Language Coverage: fail-closed empty READY board, parent arrival receipt across all 6 languages, staff filter & G5 notice', async () => {
  const newKeys = [
    'pickupVerifyReceipt', 'pickupNoCycleNotice', 'pickupWindowOpen', 'pickupWindowNotStarted',
    'pickupWindowClosedLabel', 'pickupWindowUnavailable', 'pickupEligibilityAbsent', 'pickupEligibilityExcused',
    'pickupEligibilityAttendancePending', 'pickupReasonIdempotencyConflict', 'pickupReleasePendingG5', 'pickupAllClasses',
  ];
  for (const lang of ['ar', 'fr', 'en', 'es', 'de', 'pt']) {
    for (const key of newKeys) {
      assert.ok(translations[lang][key]?.trim(), `Missing translation ${lang}.${key}`);
      if (lang !== 'en') {
        assert.notEqual(translations[lang][key], translations.en[key], `English fallback detected in ${lang}.${key}`);
      }
    }
  }

  const dom = installNodeDomShim();
  const require = createRequire(import.meta.url);
  const outdir = path.join('/tmp', 'kristou-pickup-g4-ui-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const pickupOutfile = path.join(outdir, 'pickup-board-g4.cjs');

  const plugin = {
    name: 'pickup-g4-ui-mocks',
    setup(builder) {
      builder.onResolve({ filter: /context\/AppContext$/ }, () => ({ path: 'mock-app-ctx', namespace: 'pickupg4' }));
      builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'pickupg4' }, () => ({ contents: `export const useApp = () => globalThis.__PICKUP_G4_UI_CTX__;` }));
      builder.onResolve({ filter: /^[^./]/ }, (args) => ({ path: require.resolve(args.path), external: true }));
    },
  };

  await build({
    entryPoints: [path.resolve(ROOT, 'src/components/views/PickupBoardView.tsx')],
    outfile: pickupOutfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    plugins: [plugin],
  });

  const { PickupBoardView } = require(pickupOutfile);
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  // 1. READY with empty cycles -> child badge shows UNKNOWN + noCycleNotice (never WAITING)
  globalThis.__PICKUP_G4_UI_CTX__ = {
    currentUser: { id: 'p-1', username: 'p1', fullName: 'Amira', role: 'PARENT', accountStatus: 'APPROVED', linkedChildrenIds: [UUID_2] },
    currentRole: 'PARENT',
    childrenList: [{ id: UUID_2, fullName: 'Youssef Ben Ali', classId: UUID_3, className: 'CE1-A', level: 'CE1', birthDate: '2019-03-01', photoUrl: '', pickupAuthorizedNames: [] }],
    classesList: [],
    pickupCycles: [],
    pickupAvailability: 'READY',
    pickupError: null,
    pickupErrorCode: null,
    pickupLastSyncedAt: '2026-11-26T15:00:00Z',
    pickupMutationState: {},
    isLoadingPickup: false,
    refreshPickupBoard: async () => ({ ok: true, status: 'READY', availability: 'READY', records: [], lastSyncedAt: null }),
    verifyPickupOperationReceipt: async () => ({ success: true }),
    markPickupArrived: async () => ({ success: true }),
    confirmPickupRelease: async () => ({ success: false }),
    language: 'en',
    t: (k) => translations.en[k] ?? k,
  };

  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.equal(container.querySelector(`[data-testid="pickup-child-state-badge-${UUID_2}"]`).textContent, translations.en.pickupStateUnknown);
  assert.ok(container.querySelector(`[data-testid="pickup-no-cycle-notice-${UUID_2}"]`));

  // 2. Parent arrived receipt across all 6 languages + verify receipt button on UNKNOWN_OUTCOME
  const verifiedCalls = [];
  for (const lang of ['ar', 'fr', 'en', 'es', 'de', 'pt']) {
    const tFn = (k) => translations[lang][k] ?? k;
    globalThis.__PICKUP_G4_UI_CTX__ = {
      ...globalThis.__PICKUP_G4_UI_CTX__,
      language: lang,
      t: tFn,
      pickupCycles: [{
        cycleId: UUID_1,
        studentId: UUID_2,
        studentName: 'Youssef Ben Ali',
        classId: UUID_3,
        className: 'CE1-A',
        schoolDate: '2026-11-26',
        windowId: `${UUID_3}:2026-11-26`,
        windowLabel: '16:00 - 17:30',
        windowStatus: 'OPEN',
        attendanceEligibility: 'ELIGIBLE',
        state: 'PARENT_ARRIVED',
        version: 2,
        parentArrivedAt: '2026-11-26T15:15:00Z',
        arrivedByUserId: null,
        intendedCollectorId: UUID_4,
        intendedCollectorName: 'Amira Ben Ali',
        authorizedCollectors: [{ collectorId: UUID_4, fullName: 'Amira Ben Ali', relationshipLabel: 'Mother', status: 'ACTIVE' }],
        releasedAt: null,
        releasedByUserId: null,
        releasedByName: null,
        releasedToCollectorId: null,
        releasedToCollectorName: null,
        actorCanAnnounceArrival: false,
        actorCanConfirmRelease: false,
        revocationStatus: 'NONE',
        outboxStatus: 'NONE',
        lastSyncedAt: '2026-11-26T15:15:00Z',
      }],
    };
    await act(async () => { root.render(React.createElement(PickupBoardView)); });
    const receiptEl = container.querySelector(`[data-testid="pickup-parent-arrived-receipt-${UUID_2}"]`);
    assert.ok(receiptEl?.textContent.includes(tFn('arrivalSent')));
  }

  // Verify receipt button triggers verifyPickupOperationReceipt
  globalThis.__PICKUP_G4_UI_CTX__ = {
    ...globalThis.__PICKUP_G4_UI_CTX__,
    language: 'en',
    t: (k) => translations.en[k] ?? k,
    pickupMutationState: {
      [UUID_1]: {
        status: 'UNKNOWN_OUTCOME',
        requestId: UUID_6,
        operation: 'ARRIVAL',
        payload: { cycleId: UUID_1, studentId: UUID_2, collectorId: UUID_4, requestId: UUID_6, expectedVersion: 1 },
      },
    },
    verifyPickupOperationReceipt: async (cid) => { verifiedCalls.push(cid); return { success: true }; },
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  const verifyBtn = container.querySelector(`[data-testid="pickup-verify-receipt-btn-${UUID_2}"]`);
  assert.ok(verifyBtn);
  await act(async () => { verifyBtn.click(); });
  assert.deepEqual(verifiedCalls, [UUID_1]);

  // 3. Staff queue empty state & manager PARENT_ARRIVED G5 pending note without enabling confirmRelease
  globalThis.__PICKUP_G4_UI_CTX__ = {
    ...globalThis.__PICKUP_G4_UI_CTX__,
    currentUser: { id: 'mgr-1', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: [] },
    currentRole: 'MANAGER',
    pickupMutationState: {},
    pickupCycles: [],
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector('[data-testid="pickup-staff-empty-state"]'));

  globalThis.__PICKUP_G4_UI_CTX__ = {
    ...globalThis.__PICKUP_G4_UI_CTX__,
    classesList: [{ id: UUID_3, name: 'CE1-A' }, { id: UUID_5, name: 'CE2-B' }],
    pickupCycles: [{
      cycleId: UUID_1,
      studentId: UUID_2,
      studentName: 'Youssef Ben Ali',
      classId: UUID_3,
      className: 'CE1-A',
      schoolDate: '2026-11-26',
      windowId: `${UUID_3}:2026-11-26`,
      windowLabel: '16:00 - 17:30',
      windowStatus: 'OPEN',
      attendanceEligibility: 'ELIGIBLE',
      state: 'PARENT_ARRIVED',
      version: 2,
      parentArrivedAt: '2026-11-26T15:15:00Z',
      arrivedByUserId: null,
      intendedCollectorId: UUID_4,
      intendedCollectorName: 'Amira Ben Ali',
      authorizedCollectors: [{ collectorId: UUID_4, fullName: 'Amira Ben Ali', relationshipLabel: 'Mother', status: 'ACTIVE' }],
      releasedAt: null,
      releasedByUserId: null,
      releasedByName: null,
      releasedToCollectorId: null,
      releasedToCollectorName: null,
      actorCanAnnounceArrival: false,
      actorCanConfirmRelease: false,
      revocationStatus: 'NONE',
      outboxStatus: 'NONE',
      lastSyncedAt: '2026-11-26T15:15:00Z',
    }],
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector('[data-testid="pickup-staff-class-filter"]'));
  assert.ok(container.textContent.includes(translations.en.pickupReleasePendingG5));
  assert.ok(!container.textContent.includes(translations.en.confirmRelease));

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
  fs.rmSync(outdir, { recursive: true, force: true });
});
