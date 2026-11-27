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
  buildTunisTimestampForTime,
  completeEarlyDepartureRelease,
  createPickupRequestId,
  fetchEarlyDepartures,
  hasOpenOrCompletedEarlyDepartureForStudent,
  readEarlyDepartureReceipt,
  requestEarlyDeparture,
  reviewEarlyDeparture,
} from '../src/lib/domains/pickup.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const UUID_ED = '11111111-1111-4111-8111-111111111111';
const UUID_STUDENT = '22222222-2222-4222-8222-222222222222';
const UUID_CLASS = '33333333-3333-4333-8333-333333333333';
const UUID_COLLECTOR = '44444444-4444-4444-8444-444444444444';
const UUID_CYCLE = '55555555-5555-4555-8555-555555555555';
const UUID_REQ = '66666666-6666-4666-8666-666666666666';

function makeEarlyRow(overrides = {}) {
  return {
    id: UUID_ED,
    studentId: UUID_STUDENT,
    studentLabel: 'Youssef Ben Ali',
    classId: UUID_CLASS,
    classLabel: 'CE1-A',
    cycleId: null,
    schoolDate: '2026-11-27',
    collectorId: UUID_COLLECTOR,
    collectorLabel: 'Amira Ben Ali',
    reason: 'Medical appointment at 11:30',
    requestedPickupAt: '2026-11-27T10:30:00Z',
    status: 'PENDING',
    version: 1,
    requestedByLabel: 'Amira Ben Ali',
    reviewedByLabel: null,
    reviewedAt: null,
    reviewReason: null,
    releasedByLabel: null,
    completedAt: null,
    handoffNotes: null,
    createdAt: '2026-11-27T08:15:00Z',
    canReview: true,
    canComplete: false,
    ...overrides,
  };
}

test('G6 Domain Contract: RPC routing, local validation guards, Telegram Edge gateway, and conflict/error mapping', async () => {
  const rpcCalls = [];
  const listRes = await fetchEarlyDepartures(
    { role: 'MANAGER', classId: UUID_CLASS },
    {
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return { data: [makeEarlyRow()], error: null };
      },
    },
  );
  assert.equal(listRes.ok, true);
  assert.equal(listRes.availability, 'READY');
  assert.equal(listRes.records.length, 1);
  assert.deepEqual(rpcCalls[0], { fn: 'get_pickup_early_departures', args: { p_class_id: UUID_CLASS } });

  // SCHOOL_STAFF & STUDENT fail closed locally without RPC
  let deniedCalled = false;
  const staffBlocked = await fetchEarlyDepartures(
    { role: 'SCHOOL_STAFF' },
    { rpc: async () => { deniedCalled = true; return { data: [], error: null }; } },
  );
  assert.equal(staffBlocked.ok, false);
  assert.equal(staffBlocked.availability, 'UNAUTHORIZED');
  assert.equal(deniedCalled, false);

  const dummyClient = { rpc: async () => ({ data: null, error: null }) };

  // Parent request validates reason 3..500 chars locally before RPC
  const shortReason = await requestEarlyDeparture(
    { studentId: UUID_STUDENT, collectorId: UUID_COLLECTOR, reason: 'no', requestId: UUID_REQ },
    dummyClient,
  );
  assert.equal(shortReason.ok, false);
  assert.equal(shortReason.outcome, 'DENIED');
  assert.equal(shortReason.reasonCode, 'invalid_pickup_request');

  // Parent request RPC + conflict mapping
  const reqOk = await requestEarlyDeparture(
    {
      studentId: UUID_STUDENT,
      collectorId: UUID_COLLECTOR,
      reason: 'Dental appointment in Tunis',
      requestId: UUID_REQ,
      requestedPickupAt: '2026-11-27T11:30:00+01:00',
    },
    {
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return {
          data: {
            ok: true, code: 'early_departure_requested', earlyDepartureId: UUID_ED,
            studentId: UUID_STUDENT, cycleId: null, status: 'PENDING', version: 1, requestId: UUID_REQ,
          },
          error: null,
        };
      },
    },
  );
  assert.equal(reqOk.ok, true);
  assert.equal(reqOk.status, 'PENDING');
  assert.equal(rpcCalls[1].fn, 'request_early_departure');

  const alreadyOpen = await requestEarlyDeparture(
    { studentId: UUID_STUDENT, collectorId: UUID_COLLECTOR, reason: 'Another request', requestId: UUID_REQ },
    { rpc: async () => ({ data: { ok: false, code: 'early_departure_already_open', earlyDepartureId: UUID_ED, status: 'PENDING', version: 1 }, error: null }) },
  );
  assert.equal(alreadyOpen.ok, false);
  assert.equal(alreadyOpen.outcome, 'CONFLICT');
  assert.equal(alreadyOpen.reasonCode, 'early_departure_already_open');

  const absentRes = await requestEarlyDeparture(
    { studentId: UUID_STUDENT, collectorId: UUID_COLLECTOR, reason: 'Appointment', requestId: UUID_REQ },
    { rpc: async () => ({ data: null, error: { code: 'P0001', message: 'attendance_absent' } }) },
  );
  assert.equal(absentRes.outcome, 'UNAVAILABLE');
  assert.equal(absentRes.reasonCode, 'attendance_absent');

  // Review REJECTED requires 3..500 char reason locally
  const rejectNoReason = await reviewEarlyDeparture(
    { earlyDepartureId: UUID_ED, decision: 'REJECTED', requestId: UUID_REQ, expectedVersion: 1, reviewReason: 'ok' },
    dummyClient,
  );
  assert.equal(rejectNoReason.outcome, 'DENIED');
  assert.equal(rejectNoReason.reasonCode, 'invalid_pickup_request');

  // Complete requires inPersonVerified === true locally
  const noAttest = await completeEarlyDepartureRelease(
    { earlyDepartureId: UUID_ED, collectorId: UUID_COLLECTOR, requestId: UUID_REQ, expectedVersion: 2, inPersonVerified: false },
    dummyClient,
  );
  assert.equal(noAttest.outcome, 'DENIED');
  assert.equal(noAttest.reasonCode, 'attestation_required');

  // Revoked staff P0001 error maps cleanly
  const revokedComplete = await completeEarlyDepartureRelease(
    { earlyDepartureId: UUID_ED, collectorId: UUID_COLLECTOR, requestId: UUID_REQ, expectedVersion: 2, inPersonVerified: true },
    { rpc: async () => ({ data: null, error: { code: 'P0001', message: 'pickup_release_authority_revoked' } }) },
  );
  assert.equal(revokedComplete.outcome, 'DENIED');
  assert.equal(revokedComplete.reasonCode, 'pickup_release_authority_revoked');

  // Telegram private ops routing
  const prevWin = globalThis.window;
  try {
    const tgOps = [];
    globalThis.window = { Telegram: { WebApp: { initData: 'signed_tg_init_data_payload' } } };
    const tgClient = {
      functions: {
        invoke: async (_fn, { body }) => {
          tgOps.push(body);
          if (body.operation === 'pickup.earlyDepartures') return { data: [makeEarlyRow()], error: null };
          if (body.operation === 'pickup.requestEarly') return { data: { ok: true, code: 'early_departure_requested', earlyDepartureId: UUID_ED, status: 'PENDING', version: 1, requestId: UUID_REQ }, error: null };
          if (body.operation === 'pickup.reviewEarly') return { data: { ok: true, code: 'early_departure_approved', earlyDepartureId: UUID_ED, status: 'APPROVED', version: 2, requestId: UUID_REQ }, error: null };
          if (body.operation === 'pickup.completeEarly') return { data: { ok: true, code: 'early_departure_completed', earlyDepartureId: UUID_ED, cycleId: UUID_CYCLE, status: 'COMPLETED', version: 3, cycleState: 'RELEASED', cycleVersion: 2, requestId: UUID_REQ }, error: null };
          return { data: { found: true, operationType: 'EARLY_DEPARTURE', result: { ok: true, code: 'early_departure_completed', earlyDepartureId: UUID_ED, status: 'COMPLETED', version: 3, requestId: UUID_REQ } }, error: null };
        },
      },
    };
    const tgList = await fetchEarlyDepartures({ role: 'APP_ADMIN' }, tgClient);
    assert.equal(tgList.ok, true);
    const tgReq = await requestEarlyDeparture({ studentId: UUID_STUDENT, collectorId: UUID_COLLECTOR, reason: 'Doctor visit', requestId: UUID_REQ }, tgClient);
    assert.equal(tgReq.ok, true);
    const tgRev = await reviewEarlyDeparture({ earlyDepartureId: UUID_ED, decision: 'APPROVED', requestId: UUID_REQ, expectedVersion: 1 }, tgClient);
    assert.equal(tgRev.ok, true);
    const tgComp = await completeEarlyDepartureRelease({ earlyDepartureId: UUID_ED, collectorId: UUID_COLLECTOR, requestId: UUID_REQ, expectedVersion: 2, inPersonVerified: true, handoffNotes: 'ID card checked' }, tgClient);
    assert.equal(tgComp.ok, true);
    assert.equal(tgComp.cycleState, 'RELEASED');
    const tgRcpt = await readEarlyDepartureReceipt(UUID_REQ, UUID_ED, tgClient);
    assert.equal(tgRcpt.ok, true);
    assert.deepEqual(tgOps.map((o) => o.operation), [
      'pickup.earlyDepartures', 'pickup.requestEarly', 'pickup.reviewEarly', 'pickup.completeEarly', 'pickup.receipt',
    ]);
  } finally {
    globalThis.window = prevWin;
  }

  assert.equal(buildTunisTimestampForTime('11:30', '2026-11-27'), '2026-11-27T11:30:00+01:00');
  assert.equal(hasOpenOrCompletedEarlyDepartureForStudent(UUID_STUDENT, [makeEarlyRow({ status: 'REJECTED' })]), false);
  assert.equal(hasOpenOrCompletedEarlyDepartureForStudent(UUID_STUDENT, [makeEarlyRow({ status: 'APPROVED' })]), true);
});

test('G6 Hook Readback & Revocation: recovers via receipt, refreshes board+early list, and clears on session switch', async () => {
  const { usePickupState } = await import('../src/context/usePickupState.ts');

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  let hookApi = null;
  let identityRef = { userId: 'parent-1', accountStatus: 'APPROVED', generation: 1 };
  let serverSubmitted = false;
  let boardRefreshes = 0;
  const receiptCalls = [];

  const adapters = {
    fetchCycles: async () => {
      boardRefreshes += 1;
      return { ok: true, status: 'READY', availability: 'READY', records: [], lastSyncedAt: '2026-11-27T09:00:00Z' };
    },
    fetchEarlyDepartures: async () => ({
      ok: true, status: 'READY', availability: 'READY',
      records: serverSubmitted ? [makeEarlyRow()] : [],
      lastSyncedAt: '2026-11-27T09:00:00Z',
    }),
    requestEarlyDeparture: async (input) => {
      serverSubmitted = true;
      throw new Error(`Dropped connection for ${input.requestId}`);
    },
    readEarlyDepartureReceipt: async (requestId, targetId) => {
      receiptCalls.push({ requestId, targetId });
      return {
        ok: true, outcome: 'SUCCESS', code: 'early_departure_requested',
        earlyDepartureId: UUID_ED, studentId: UUID_STUDENT, cycleId: null, status: 'PENDING', version: 1, requestId,
      };
    },
    completeEarlyDepartureRelease: async () => ({
      ok: false, outcome: 'DENIED', reasonCode: 'pickup_release_authority_revoked', message: 'Revoked',
    }),
  };

  function Harness({ user }) {
    hookApi = usePickupState({ currentUser: user, identityContext: identityRef, getCurrentIdentity: () => identityRef, adapters });
    return null;
  }

  const parentUser = { id: 'parent-1', username: 'p1', fullName: 'Amira', role: 'PARENT', accountStatus: 'APPROVED' };
  await act(async () => { root.render(React.createElement(Harness, { user: parentUser })); });
  await act(async () => { await hookApi.refreshEarlyDepartures(); });

  const prevRefreshes = boardRefreshes;
  let res;
  await act(async () => {
    res = await hookApi.submitEarlyDepartureRequest({
      studentId: UUID_STUDENT, collectorId: UUID_COLLECTOR, reason: 'Clinic appointment', requestId: UUID_REQ,
    });
  });

  assert.equal(res.success, true);
  assert.deepEqual(receiptCalls, [{ requestId: UUID_REQ, targetId: UUID_STUDENT }]);
  assert.equal(hookApi.earlyDepartures.length, 1);
  assert.ok(boardRefreshes > prevRefreshes, 'Board refreshes after early departure mutation');

  // Switch to admin and verify revocation flips earlyDepartureRevoked, then clears on identity bump
  const adminUser = { id: 'mgr-1', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED' };
  identityRef = { userId: 'mgr-1', accountStatus: 'APPROVED', generation: 2 };
  await act(async () => { root.render(React.createElement(Harness, { user: adminUser })); });
  await act(async () => {
    await hookApi.completeEarlyDepartureRelease({
      earlyDepartureId: UUID_ED, collectorId: UUID_COLLECTOR, requestId: UUID_REQ, expectedVersion: 2, inPersonVerified: true,
    });
  });
  assert.equal(hookApi.earlyDepartureRevoked, true);

  identityRef = { userId: 'other-1', accountStatus: 'APPROVED', generation: 3 };
  await act(async () => { root.render(React.createElement(Harness, { user: { ...parentUser, id: 'other-1' } })); });
  assert.deepEqual(hookApi.earlyDepartures, []);
  assert.equal(hookApi.earlyDepartureRevoked, false);

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
});

test('G6 UI Roles: pre-cycle Parent request, Admin review/attestation release, Teacher read-only, and SCHOOL_STAFF fail-closed', async () => {
  const outdir = path.join('/tmp', 'kristou-pickup-g6-ui-test');
  fs.mkdirSync(outdir, { recursive: true });
  const pickupOutfile = path.join(outdir, 'PickupBoardView.cjs');
  const require = createRequire(import.meta.url);

  const plugin = {
    name: 'mock-g6-ui',
    setup(builder) {
      builder.onResolve({ filter: /context\/AppContext$/ }, () => ({ path: 'mock-app-ctx', namespace: 'pickupg6' }));
      builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'pickupg6' }, () => ({ contents: `export const useApp = () => globalThis.__PICKUP_G6_UI_CTX__;` }));
      builder.onResolve({ filter: /^[^./]/ }, (args) => ({ path: require.resolve(args.path), external: true }));
    },
  };
  await build({ entryPoints: [path.resolve(ROOT, 'src/components/views/PickupBoardView.tsx')], outfile: pickupOutfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [plugin] });

  const { PickupBoardView } = require(pickupOutfile);
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);
  const tEn = (key) => translations.en[key] ?? key;

  const submittedRequests = [];
  const reviewedCalls = [];
  const completedCalls = [];

  // 1. Pre-cycle Parent (pickupCycles = [], collectors resolved from linked child cycle OR fallback empty)
  // Provide one waiting cycle so collector dropdown populates cleanly without needing live Supabase client
  globalThis.__PICKUP_G6_UI_CTX__ = {
    currentUser: { id: 'p-1', username: 'parent', fullName: 'Amira', role: 'PARENT', accountStatus: 'APPROVED', linkedChildrenIds: [UUID_STUDENT] },
    currentRole: 'PARENT',
    childrenList: [{ id: UUID_STUDENT, fullName: 'Youssef Ben Ali', classId: UUID_CLASS, className: 'CE1-A', level: 'CE1', birthDate: '2018-01-01', photoUrl: '', pickupAuthorizedNames: ['Amira Ben Ali'] }],
    classesList: [{ id: UUID_CLASS, name: 'CE1-A' }],
    pickupCycles: [{
      cycleId: UUID_CYCLE, studentId: UUID_STUDENT, studentName: 'Youssef Ben Ali', classId: UUID_CLASS, className: 'CE1-A',
      schoolDate: '2026-11-27', windowId: null, windowLabel: null, windowStatus: 'NOT_STARTED', attendanceEligibility: 'ELIGIBLE',
      state: 'WAITING', version: 1, parentArrivedAt: null, arrivedByUserId: null, intendedCollectorId: UUID_COLLECTOR, intendedCollectorName: null,
      authorizedCollectors: [{ collectorId: UUID_COLLECTOR, fullName: 'Amira Ben Ali', relationshipLabel: 'Mother', status: 'ACTIVE' }],
      releasedAt: null, releasedByUserId: null, releasedByName: null, releasedToCollectorId: null, releasedToCollectorName: null,
      actorCanAnnounceArrival: false, actorCanConfirmRelease: false, revocationStatus: 'NONE', outboxStatus: 'NONE', lastSyncedAt: '2026-11-27T08:00:00Z',
    }],
    pickupAvailability: 'READY',
    pickupError: null,
    pickupErrorCode: null,
    pickupLastSyncedAt: '2026-11-27T08:00:00Z',
    pickupMutationState: {},
    isLoadingPickup: false,
    earlyDepartures: [],
    earlyDeparturesAvailability: 'READY',
    isLoadingEarlyDepartures: false,
    earlyDepartureMutationState: {},
    refreshPickupBoard: async () => ({ ok: true, status: 'READY', availability: 'READY', records: [], lastSyncedAt: null }),
    refreshEarlyDepartures: async () => ({ ok: true, status: 'READY', availability: 'READY', records: [], lastSyncedAt: null }),
    submitEarlyDepartureRequest: async (input) => { submittedRequests.push(input); return { success: true }; },
    language: 'en',
    t: tEn,
  };

  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector('[data-testid="pickup-parent-early-section"]'));
  const submitBtn = container.querySelector('[data-testid="early-departure-submit-btn"]');
  assert.equal(submitBtn.disabled, true);

  const reasonEl = container.querySelector('[data-testid="early-departure-reason-input"]');
  const timeEl = container.querySelector('[data-testid="early-departure-time-input"]');
  await act(async () => {
    dom.setInputValue(reasonEl, 'Pediatrician follow-up');
    dom.setInputValue(timeEl, '11:30');
  });
  assert.equal(container.querySelector('[data-testid="early-departure-submit-btn"]').disabled, false);
  await act(async () => { container.querySelector('[data-testid="early-departure-submit-btn"]').click(); });
  assert.equal(submittedRequests.length, 1);
  assert.equal(submittedRequests[0].studentId, UUID_STUDENT);
  assert.equal(submittedRequests[0].collectorId, UUID_COLLECTOR);
  assert.equal(submittedRequests[0].reason, 'Pediatrician follow-up');
  assert.equal(submittedRequests[0].requestedPickupAt, '2026-11-27T11:30:00+01:00');
  assert.match(submittedRequests[0].requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

  // 1b. Pre-cycle Parent with an existing open early departure sees status card and already-open guard
  const verifyCalls = [];
  globalThis.__PICKUP_G6_UI_CTX__ = {
    ...globalThis.__PICKUP_G6_UI_CTX__,
    pickupCycles: [],
    earlyDepartures: [makeEarlyRow({ status: 'PENDING' })],
    earlyDepartureMutationState: { [UUID_STUDENT]: { status: 'UNKNOWN_OUTCOME', operation: 'REQUEST' } },
    verifyEarlyDepartureReceipt: async (targetKey) => { verifyCalls.push(targetKey); },
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector(`[data-testid="early-departure-parent-card-${UUID_ED}"]`));
  assert.ok(container.querySelector('[data-testid="early-departure-already-open-hint"]'));
  assert.equal(container.querySelector('[data-testid="early-departure-submit-btn"]').disabled, true);
  await act(async () => { container.querySelector('[data-testid="early-departure-parent-verify-btn"]').click(); });
  assert.deepEqual(verifyCalls, [UUID_STUDENT]);

  // 2. Staff PENDING review: Reject disabled until 3+ char note, Approve works, and Reject works with note
  globalThis.__PICKUP_G6_UI_CTX__ = {
    ...globalThis.__PICKUP_G6_UI_CTX__,
    currentRole: 'APP_ADMIN',
    currentUser: { id: 'admin-1', username: 'owner', fullName: 'Owner', role: 'APP_ADMIN', accountStatus: 'APPROVED' },
    pickupCycles: [],
    earlyDepartures: [makeEarlyRow({ status: 'PENDING', canReview: true, canComplete: false })],
    earlyDepartureMutationState: {},
    reviewEarlyDepartureRequest: async (input) => { reviewedCalls.push(input); return { success: true }; },
    completeEarlyDepartureRelease: async (input) => { completedCalls.push(input); return { success: true }; },
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.equal(container.querySelector(`[data-testid="early-departure-reject-btn-${UUID_ED}"]`).disabled, true);
  await act(async () => { container.querySelector(`[data-testid="early-departure-approve-btn-${UUID_ED}"]`).click(); });
  assert.equal(reviewedCalls.length, 1);
  assert.equal(reviewedCalls[0].decision, 'APPROVED');
  assert.equal(reviewedCalls[0].expectedVersion, 1);

  const reviewNoteEl = container.querySelector(`[data-testid="early-departure-review-note-${UUID_ED}"]`);
  await act(async () => { dom.setInputValue(reviewNoteEl, 'Class exam scheduled'); });
  assert.equal(container.querySelector(`[data-testid="early-departure-reject-btn-${UUID_ED}"]`).disabled, false);
  await act(async () => { container.querySelector(`[data-testid="early-departure-reject-btn-${UUID_ED}"]`).click(); });
  assert.equal(reviewedCalls.length, 2);
  assert.equal(reviewedCalls[1].decision, 'REJECTED');
  assert.equal(reviewedCalls[1].reviewReason, 'Class exam scheduled');

  // 3. Staff APPROVED completion: disabled until verified checkbox is ticked
  globalThis.__PICKUP_G6_UI_CTX__ = {
    ...globalThis.__PICKUP_G6_UI_CTX__,
    earlyDepartures: [makeEarlyRow({ status: 'APPROVED', version: 2, canReview: false, canComplete: true })],
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  const completeBtn = container.querySelector(`[data-testid="early-departure-complete-btn-${UUID_ED}"]`);
  assert.equal(completeBtn.disabled, true);
  await act(async () => { container.querySelector(`[data-testid="early-departure-verify-checkbox-${UUID_ED}"]`).click(); });
  assert.equal(container.querySelector(`[data-testid="early-departure-complete-btn-${UUID_ED}"]`).disabled, false);
  await act(async () => { container.querySelector(`[data-testid="early-departure-complete-btn-${UUID_ED}"]`).click(); });
  assert.equal(completedCalls.length, 1);
  assert.equal(completedCalls[0].inPersonVerified, true);
  assert.equal(completedCalls[0].collectorId, UUID_COLLECTOR);
  assert.equal(completedCalls[0].expectedVersion, 2);

  // 4. TEACHER sees scoped early departures strictly read-only
  globalThis.__PICKUP_G6_UI_CTX__ = {
    ...globalThis.__PICKUP_G6_UI_CTX__,
    currentRole: 'TEACHER',
    currentUser: { id: 't-1', username: 'teacher', fullName: 'Teacher', role: 'TEACHER', accountStatus: 'APPROVED' },
    earlyDepartures: [makeEarlyRow({ status: 'APPROVED', version: 2, canReview: false, canComplete: false })],
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector(`[data-testid="early-departure-staff-card-${UUID_ED}"]`));
  assert.equal(container.querySelector(`[data-testid="early-departure-complete-btn-${UUID_ED}"]`), null);
  assert.equal(container.querySelector(`[data-testid="early-departure-approve-btn-${UUID_ED}"]`), null);

  // 5. SCHOOL_STAFF sees fail-closed unauthorized banner
  globalThis.__PICKUP_G6_UI_CTX__ = {
    ...globalThis.__PICKUP_G6_UI_CTX__,
    currentRole: 'SCHOOL_STAFF',
    currentUser: { id: 'ss-1', username: 'staff', fullName: 'Staff', role: 'SCHOOL_STAFF', accountStatus: 'APPROVED' },
    earlyDepartures: [],
    earlyDeparturesAvailability: 'UNAUTHORIZED',
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector('[data-testid="early-departure-staff-unauthorized"]'));

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
  fs.rmSync(outdir, { recursive: true, force: true });
});

test('G6 Localization: all 6 languages have complete non-English G6 keys', () => {
  const g6Keys = Object.keys(translations.en).filter((k) => k.startsWith('pickupEarly'));
  assert.ok(g6Keys.length >= 25);
  for (const lang of ['ar', 'fr', 'en', 'es', 'de', 'pt']) {
    for (const key of g6Keys) {
      const val = translations[lang][key];
      assert.equal(typeof val, 'string');
      assert.ok(val.trim().length > 0, `Missing ${lang}.${key}`);
      if (lang !== 'en') {
        assert.notEqual(val, translations.en[key], `English fallback in ${lang}.${key}`);
      }
    }
  }
});
