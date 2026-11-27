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
  confirmPickupRelease,
  fetchPickupBoardCycles,
  provisionPickupCycles,
  readPickupOperationReceipt,
  reinstatePickupReleaseAuthority,
  revokePickupReleaseAuthority,
} from '../src/lib/domains/pickup.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const UUID_CYCLE = '11111111-1111-4111-8111-111111111111';
const UUID_STUDENT = '22222222-2222-4222-8222-222222222222';
const UUID_CLASS = '33333333-3333-4333-8333-333333333333';
const UUID_COLLECTOR = '44444444-4444-4444-8444-444444444444';
const UUID_COLLECTOR_UNVERIFIED = '55555555-5555-4555-8555-555555555555';
const UUID_REQ = '66666666-6666-4666-8666-666666666666';
const UUID_TARGET_STAFF = '77777777-7777-4777-8777-777777777777';

function makeStaffBoardRow(overrides = {}) {
  return {
    cycle_id: UUID_CYCLE,
    student_id: UUID_STUDENT,
    student_label: 'Youssef Ben Ali',
    class_id: UUID_CLASS,
    class_label: 'CE1-A',
    school_date: '2026-11-27',
    state: 'PARENT_ARRIVED',
    version: 2,
    window_start: '2026-11-27T15:00:00Z',
    window_end: '2026-11-27T16:30:00Z',
    schedule_available: true,
    eligible: true,
    eligibility_reason: 'present',
    can_announce_arrival: false,
    can_confirm_release: true,
    arrival_at: '2026-11-27T15:10:00Z',
    arrival_actor_label: 'Amira Ben Ali',
    collector_label: 'Amira Ben Ali',
    release_at: null,
    release_actor_label: null,
    collectors: [],
    ...overrides,
  };
}

test('G5 Staff Board Collector Hydration & release_pupil RPC/Telegram Contract', async () => {
  const rpcCalls = [];
  const staffClient = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      if (fn === 'get_pickup_staff_board') return { data: [makeStaffBoardRow()], error: null };
      if (fn === 'list_authorized_pickup_persons') {
        return {
          data: [
            { id: UUID_COLLECTOR_UNVERIFIED, student_id: UUID_STUDENT, display_name: 'Unverified Uncle', relationship_label: 'Uncle', valid_from: '2026-11-01', valid_until: '2027-06-30', verified_at: null },
            { id: UUID_COLLECTOR, student_id: UUID_STUDENT, display_name: 'Amira Ben Ali', relationship_label: 'Mother', valid_from: '2026-11-01', valid_until: '2027-06-30', verified_at: '2026-11-20T10:00:00Z' },
          ],
          error: null,
        };
      }
      if (fn === 'release_pupil') {
        return {
          data: { ok: true, code: 'pupil_released', cycleId: UUID_CYCLE, studentId: UUID_STUDENT, state: 'RELEASED', version: 3, requestId: UUID_REQ, occurredAt: '2026-11-27T15:20:00Z' },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };

  const board = await fetchPickupBoardCycles({ role: 'MANAGER' }, staffClient);
  assert.equal(board.ok, true);
  assert.equal(board.records[0].actorCanConfirmRelease, true);
  assert.equal(board.records[0].authorizedCollectors.length, 1);
  assert.equal(board.records[0].authorizedCollectors[0].collectorId, UUID_COLLECTOR);
  assert.equal(board.records[0].intendedCollectorId, UUID_COLLECTOR);

  // Refuses missing attestation locally before RPC
  const rpcCountBefore = rpcCalls.length;
  const noAttest = await confirmPickupRelease({
    cycleId: UUID_CYCLE,
    collectorId: UUID_COLLECTOR,
    requestId: UUID_REQ,
    expectedVersion: 2,
    physicalHandoffAttested: false,
    collectorVerifiedInPerson: true,
  }, staffClient);
  assert.equal(noAttest.outcome, 'DENIED');
  assert.equal(noAttest.reasonCode, 'attestation_required');
  assert.equal(rpcCalls.length, rpcCountBefore);

  // Refuses malformed UUID locally before RPC
  const badUuid = await confirmPickupRelease({
    cycleId: 'not-a-uuid',
    collectorId: UUID_COLLECTOR,
    requestId: UUID_REQ,
    expectedVersion: 2,
    physicalHandoffAttested: true,
    collectorVerifiedInPerson: true,
  }, staffClient);
  assert.equal(badUuid.outcome, 'DENIED');
  assert.equal(badUuid.reasonCode, 'invalid_pickup_request');
  assert.equal(rpcCalls.length, rpcCountBefore);

  // Valid release call sends exact RPC args including trimmed handoff notes
  const okRel = await confirmPickupRelease({
    cycleId: UUID_CYCLE,
    collectorId: UUID_COLLECTOR,
    requestId: UUID_REQ,
    expectedVersion: 2,
    physicalHandoffAttested: true,
    collectorVerifiedInPerson: true,
    handoffNotes: '  ID card checked at gate  ',
  }, staffClient);
  assert.equal(okRel.ok, true);
  assert.equal(okRel.state, 'RELEASED');
  assert.equal(okRel.version, 3);
  assert.deepEqual(rpcCalls.at(-1), {
    fn: 'release_pupil',
    args: {
      p_cycle_id: UUID_CYCLE,
      p_collector_id: UUID_COLLECTOR,
      p_request_id: UUID_REQ,
      p_expected_version: 2,
      p_in_person_verified: true,
      p_handoff_notes: 'ID card checked at gate',
    },
  });

  // Conflict JSON + P0001 error mappings
  for (const code of ['version_conflict', 'already_released', 'arrival_required']) {
    const res = await confirmPickupRelease(
      { cycleId: UUID_CYCLE, collectorId: UUID_COLLECTOR, requestId: UUID_REQ, expectedVersion: 2, physicalHandoffAttested: true, collectorVerifiedInPerson: true },
      { rpc: async () => ({ data: { ok: false, code, state: code === 'arrival_required' ? 'WAITING' : 'RELEASED', version: 3 }, error: null }) },
    );
    assert.equal(res.outcome, 'CONFLICT');
    assert.equal(res.reasonCode, code);
  }
  for (const [errMsg, expectedOutcome, expectedCode] of [
    ['attestation_required', 'DENIED', 'attestation_required'],
    ['collector_invalid', 'DENIED', 'collector_invalid'],
    ['pickup_release_authority_revoked', 'DENIED', 'pickup_release_authority_revoked'],
    ['pickup_release_authority_required', 'DENIED', 'pickup_release_authority_required'],
    ['attendance_ineligible', 'UNAVAILABLE', 'attendance_ineligible'],
  ]) {
    const res = await confirmPickupRelease(
      { cycleId: UUID_CYCLE, collectorId: UUID_COLLECTOR, requestId: UUID_REQ, expectedVersion: 2, physicalHandoffAttested: true, collectorVerifiedInPerson: true },
      { rpc: async () => ({ data: null, error: { code: 'P0001', message: errMsg } }) },
    );
    assert.equal(res.outcome, expectedOutcome);
    assert.equal(res.reasonCode, expectedCode);
  }

  // Receipt parsing for RELEASE operation
  const receipt = await readPickupOperationReceipt(UUID_REQ, UUID_CYCLE, {
    rpc: async () => ({
      data: { found: true, requestId: UUID_REQ, operationType: 'RELEASE', cycleId: UUID_CYCLE, state: 'RELEASED', version: 3, result: { ok: true, code: 'pupil_released', version: 3 } },
      error: null,
    }),
  });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.state, 'RELEASED');
  assert.equal(receipt.version, 3);

  // Telegram gateway routing for pickup.release, pickup.provision, pickup.revokeRelease, pickup.reinstateRelease
  const prevWin = globalThis.window;
  try {
    const ops = [];
    globalThis.window = { Telegram: { WebApp: { initData: 'signed_tg_init_data_payload' } } };
    const tgClient = {
      functions: {
        invoke: async (_fn, { body }) => {
          ops.push(body);
          if (body.operation === 'pickup.release') return { data: { ok: true, code: 'pupil_released', cycleId: UUID_CYCLE, state: 'RELEASED', version: 3, requestId: UUID_REQ }, error: null };
          if (body.operation === 'pickup.provision') return { data: { ok: true, schoolDate: '2026-11-27', timezone: 'Africa/Tunis', provisionedCount: 12, skippedCount: 2 }, error: null };
          if (body.operation === 'pickup.revokeRelease') return { data: { targetUserId: UUID_TARGET_STAFF, isRevoked: true, version: 1 }, error: null };
          if (body.operation === 'pickup.reinstateRelease') return { data: { targetUserId: UUID_TARGET_STAFF, isRevoked: false, version: 2 }, error: null };
          return { data: null, error: null };
        },
      },
    };
    const tgRel = await confirmPickupRelease({ cycleId: UUID_CYCLE, collectorId: UUID_COLLECTOR, requestId: UUID_REQ, expectedVersion: 2, physicalHandoffAttested: true, collectorVerifiedInPerson: true }, tgClient);
    assert.equal(tgRel.ok, true);
    assert.equal(ops[0].operation, 'pickup.release');
    assert.equal(ops[0].params.inPersonVerified, true);

    const tgProv = await provisionPickupCycles('2026-11-27', tgClient);
    assert.equal(tgProv.ok, true);
    assert.equal(tgProv.provisionedCount, 12);
    assert.equal(ops[1].operation, 'pickup.provision');

    const tgRev = await revokePickupReleaseAuthority(UUID_TARGET_STAFF, 'Temporary desk rotation', tgClient);
    assert.equal(tgRev.ok, true);
    assert.equal(tgRev.isRevoked, true);
    assert.equal(ops[2].operation, 'pickup.revokeRelease');

    const tgRein = await reinstatePickupReleaseAuthority(UUID_TARGET_STAFF, 'Returned to dismissal gate duty', tgClient);
    assert.equal(tgRein.ok, true);
    assert.equal(tgRein.isRevoked, false);
    assert.equal(ops[3].operation, 'pickup.reinstateRelease');
  } finally {
    globalThis.window = prevWin;
  }
});

test('G5 Cycle Provisioning & Release Authority Fail-Closed Checks', async () => {
  const schedFail = await provisionPickupCycles(null, { rpc: async () => ({ data: null, error: { code: 'P0001', message: 'schedule_unavailable' } }) });
  assert.equal(schedFail.ok, false);
  assert.equal(schedFail.errorCode, 'schedule_unavailable');

  // Invalid short reason fails locally without hitting RPC
  let rpcCalled = false;
  const badReason = await revokePickupReleaseAuthority(UUID_TARGET_STAFF, 'no', {
    rpc: async () => { rpcCalled = true; return { data: null, error: null }; },
  });
  assert.equal(badReason.ok, false);
  assert.equal(badReason.errorCode, 'invalid_pickup_authority_request');
  assert.equal(rpcCalled, false);

  const nonAdmin = await reinstatePickupReleaseAuthority(UUID_TARGET_STAFF, 'Valid audit reason', {
    rpc: async () => ({ data: null, error: { code: 'P0001', message: 'pickup_app_admin_required' } }),
  });
  assert.equal(nonAdmin.ok, false);
  assert.equal(nonAdmin.errorCode, 'pickup_app_admin_required');
});

test('G5 Hook Lifecycle: timeout receipt recovery, revocation enforcement, provisioning & admin authority guards', async () => {
  const dom = installNodeDomShim();
  const { usePickupState } = await import('../src/context/usePickupState.ts');
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  let hookApi = null;
  let releasedOnServer = false;
  let releaseShouldTimeout = true;
  let revokeResponse = { ok: false, outcome: 'DENIED', reasonCode: 'pickup_release_authority_revoked', message: 'Revoked' };
  const receiptRequests = [];
  let boardRefreshCount = 0;

  const baseArrivedCycle = {
    cycleId: UUID_CYCLE,
    studentId: UUID_STUDENT,
    studentName: 'Youssef Ben Ali',
    classId: UUID_CLASS,
    className: 'CE1-A',
    schoolDate: '2026-11-27',
    windowId: `${UUID_CLASS}:2026-11-27`,
    windowLabel: '16:00 - 17:30',
    windowStatus: 'OPEN',
    attendanceEligibility: 'ELIGIBLE',
    state: 'PARENT_ARRIVED',
    version: 2,
    parentArrivedAt: '2026-11-27T15:10:00Z',
    arrivedByUserId: null,
    intendedCollectorId: UUID_COLLECTOR,
    intendedCollectorName: 'Amira Ben Ali',
    authorizedCollectors: [{ collectorId: UUID_COLLECTOR, fullName: 'Amira Ben Ali', relationshipLabel: 'Mother', status: 'ACTIVE' }],
    releasedAt: null,
    releasedByUserId: null,
    releasedByName: null,
    releasedToCollectorId: null,
    releasedToCollectorName: null,
    actorCanAnnounceArrival: false,
    actorCanConfirmRelease: true,
    revocationStatus: 'NONE',
    outboxStatus: 'NONE',
    lastSyncedAt: '2026-11-27T15:10:00Z',
  };

  let identityRef = { userId: 'mgr-1', accountStatus: 'APPROVED', generation: 1 };
  const adapters = {
    fetchCycles: async () => {
      boardRefreshCount += 1;
      return {
        ok: true,
        status: 'READY',
        availability: 'READY',
        records: [
          releasedOnServer
            ? { ...baseArrivedCycle, state: 'RELEASED', version: 3, releasedAt: '2026-11-27T15:20:00Z', releasedByName: 'Manager', releasedToCollectorName: 'Amira Ben Ali', actorCanConfirmRelease: false }
            : baseArrivedCycle,
        ],
        lastSyncedAt: '2026-11-27T15:20:00Z',
      };
    },
    confirmRelease: async (input) => {
      if (releaseShouldTimeout) {
        releasedOnServer = true;
        throw new Error('Request timed out');
      }
      return revokeResponse;
    },
    readOperationReceipt: async (reqId, cycleId) => {
      receiptRequests.push({ reqId, cycleId });
      return { ok: true, outcome: 'SUCCESS', operationId: reqId, cycleId, state: 'RELEASED', version: 3, outboxEnqueued: true };
    },
    provisionCycles: async () => ({ ok: true, schoolDate: '2026-11-27', timezone: 'Africa/Tunis', provisionedCount: 4, skippedCount: 0 }),
    revokeReleaseAuthority: async (targetUserId) => ({ ok: true, targetUserId, isRevoked: true, version: 1 }),
    reinstateReleaseAuthority: async (targetUserId) => ({ ok: true, targetUserId, isRevoked: false, version: 2 }),
  };

  function Harness({ user, identity }) {
    hookApi = usePickupState({ currentUser: user, identityContext: identity, getCurrentIdentity: () => identityRef, adapters });
    return null;
  }

  const mgrUser = { id: 'mgr-1', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: [] };
  await act(async () => { root.render(React.createElement(Harness, { user: mgrUser, identity: identityRef })); });
  await act(async () => { await hookApi.refreshPickupBoard(); });

  // Timeout auto-recovers via receipt + authoritative board readback without duplicating mutation
  let relRes;
  await act(async () => {
    relRes = await hookApi.confirmPickupRelease({
      cycleId: UUID_CYCLE,
      collectorId: UUID_COLLECTOR,
      requestId: UUID_REQ,
      expectedVersion: 2,
      collectorVerifiedInPerson: true,
      physicalHandoffAttested: true,
    });
  });
  assert.equal(relRes.success, true);
  assert.deepEqual(receiptRequests, [{ reqId: UUID_REQ, cycleId: UUID_CYCLE }]);
  assert.equal(hookApi.pickupCycles[0].state, 'RELEASED');

  // Manager can provision cycles, but CANNOT revoke release authority
  const refreshesBeforeProv = boardRefreshCount;
  let provRes;
  await act(async () => { provRes = await hookApi.provisionTodayPickupCycles(); });
  assert.equal(provRes.ok, true);
  assert.ok(boardRefreshCount > refreshesBeforeProv);

  let mgrRevoke;
  await act(async () => { mgrRevoke = await hookApi.revokePickupReleaseAuthority(UUID_TARGET_STAFF, 'Not allowed'); });
  assert.equal(mgrRevoke.ok, false);
  assert.equal(mgrRevoke.errorCode, 'pickup_app_admin_required');

  // Switch to revoked manager check -> pickup_release_authority_revoked disables release UI
  releasedOnServer = false;
  releaseShouldTimeout = false;
  await act(async () => { await hookApi.refreshPickupBoard(); });
  await act(async () => {
    await hookApi.confirmPickupRelease({
      cycleId: UUID_CYCLE,
      collectorId: UUID_COLLECTOR,
      requestId: UUID_REQ,
      expectedVersion: 2,
      collectorVerifiedInPerson: true,
      physicalHandoffAttested: true,
    });
  });
  assert.equal(hookApi.pickupCycles[0].revocationStatus, 'REVOKED');
  assert.equal(hookApi.pickupCycles[0].actorCanConfirmRelease, false);

  // Switch to APP_ADMIN -> can revoke & reinstate and refreshes board
  identityRef = { userId: 'admin-1', accountStatus: 'APPROVED', generation: 2 };
  const adminUser = { id: 'admin-1', username: 'owner', fullName: 'Owner', role: 'APP_ADMIN', accountStatus: 'APPROVED', capabilities: [] };
  await act(async () => { root.render(React.createElement(Harness, { user: adminUser, identity: identityRef })); });
  let admRev;
  await act(async () => { admRev = await hookApi.revokePickupReleaseAuthority(UUID_TARGET_STAFF, 'Audit suspension'); });
  assert.equal(admRev.ok, true);
  assert.equal(hookApi.pickupAdminNotice.action, 'REVOKE');

  // Switch to TEACHER -> cannot provision cycles
  identityRef = { userId: 'teacher-1', accountStatus: 'APPROVED', generation: 3 };
  const teacherUser = { id: 'teacher-1', username: 't1', fullName: 'Teacher', role: 'TEACHER', accountStatus: 'APPROVED', capabilities: [] };
  await act(async () => { root.render(React.createElement(Harness, { user: teacherUser, identity: identityRef })); });
  let teacherProv;
  await act(async () => { teacherProv = await hookApi.provisionTodayPickupCycles(); });
  assert.equal(teacherProv.ok, false);
  assert.equal(teacherProv.errorCode, 'pickup_provision_authority_required');

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
});

test('G5 UI & 6-Language Coverage: attested release submit, immutable RELEASED rows, provisioning & APP_ADMIN governance panel', async () => {
  const g5Keys = [
    'pickupReleaseBlockedPolicy', 'pickupHandoffNotesPlaceholder', 'pickupReleasedReceiptLabel',
    'pickupReasonAttestationRequired', 'pickupReasonCollectorInvalid', 'pickupReasonArrivalRequired',
    'pickupReasonReleaseAuthorityRequired', 'pickupReasonAuthorityRequestInvalid',
    'pickupReasonAuthorityStateConflict', 'pickupProvisionCyclesBtn', 'pickupProvisioning',
    'pickupProvisionSuccess', 'pickupProvisionCreatedLabel', 'pickupProvisionSkippedLabel',
    'pickupScheduleUnavailableNotice', 'pickupReleaseAuthorityTitle', 'pickupTargetAccountLabel',
    'pickupTargetUserIdPlaceholder', 'pickupAuthorityReasonLabel', 'pickupAuthorityReasonPlaceholder',
    'pickupRevokeReleaseBtn', 'pickupReinstateReleaseBtn', 'pickupAuthorityUpdatedNotice',
  ];
  for (const key of g5Keys) {
    for (const lang of ['ar', 'fr', 'en', 'es', 'de', 'pt']) {
      assert.ok(translations[lang][key]?.trim(), `Missing G5 translation ${lang}.${key}`);
    }
    for (const lang of ['ar', 'fr', 'es', 'de', 'pt']) {
      assert.notEqual(translations[lang][key], translations.en[key], `English leakage in ${lang}.${key}`);
    }
  }

  const dom = installNodeDomShim();
  const require = createRequire(import.meta.url);
  const outdir = path.join('/tmp', 'kristou-pickup-g5-ui-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const pickupOutfile = path.join(outdir, 'pickup-board.cjs');
  const plugin = {
    name: 'pickup-g5-ui-mocks',
    setup(builder) {
      builder.onResolve({ filter: /context\/AppContext$/ }, () => ({ path: 'mock-app-ctx', namespace: 'pickupg5' }));
      builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'pickupg5' }, () => ({ contents: `export const useApp = () => globalThis.__PICKUP_G5_UI_CTX__;` }));
      builder.onResolve({ filter: /^[^./]/ }, (args) => ({ path: require.resolve(args.path), external: true }));
    },
  };
  await build({ entryPoints: [path.resolve(ROOT, 'src/components/views/PickupBoardView.tsx')], outfile: pickupOutfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [plugin] });

  const { PickupBoardView } = require(pickupOutfile);
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);
  const tEn = (key) => translations.en[key] ?? key;

  const releaseCalls = [];
  const provisionCalls = [];
  const revokeCalls = [];

  globalThis.__PICKUP_G5_UI_CTX__ = {
    currentUser: { id: 'admin-1', username: 'owner', fullName: 'Owner', role: 'APP_ADMIN', accountStatus: 'APPROVED', capabilities: [] },
    currentRole: 'APP_ADMIN',
    childrenList: [],
    classesList: [{ id: UUID_CLASS, name: 'CE1-A' }],
    pickupCycles: [{
      cycleId: UUID_CYCLE,
      studentId: UUID_STUDENT,
      studentName: 'Youssef Ben Ali',
      classId: UUID_CLASS,
      className: 'CE1-A',
      schoolDate: '2026-11-27',
      windowId: `${UUID_CLASS}:2026-11-27`,
      windowLabel: '16:00 - 17:30',
      windowStatus: 'OPEN',
      attendanceEligibility: 'ELIGIBLE',
      state: 'PARENT_ARRIVED',
      version: 2,
      parentArrivedAt: '2026-11-27T15:10:00Z',
      arrivedByUserId: null,
      intendedCollectorId: UUID_COLLECTOR,
      intendedCollectorName: 'Amira Ben Ali',
      authorizedCollectors: [{ collectorId: UUID_COLLECTOR, fullName: 'Amira Ben Ali', relationshipLabel: 'Mother', status: 'ACTIVE' }],
      releasedAt: null,
      releasedByUserId: null,
      releasedByName: null,
      releasedToCollectorId: null,
      releasedToCollectorName: null,
      actorCanAnnounceArrival: false,
      actorCanConfirmRelease: true,
      revocationStatus: 'NONE',
      outboxStatus: 'NONE',
      lastSyncedAt: '2026-11-27T15:10:00Z',
    }],
    pickupAvailability: 'READY',
    pickupError: null,
    pickupErrorCode: null,
    pickupLastSyncedAt: '2026-11-27T15:10:00Z',
    pickupMutationState: {},
    isLoadingPickup: false,
    isProvisioningPickup: false,
    isUpdatingReleaseAuthority: false,
    pickupAdminNotice: null,
    refreshPickupBoard: async () => ({ ok: true, status: 'READY', availability: 'READY', records: [], lastSyncedAt: null }),
    confirmPickupRelease: async (input) => { releaseCalls.push(input); return { success: true }; },
    provisionTodayPickupCycles: async () => { provisionCalls.push(true); return { ok: true, provisionedCount: 3, skippedCount: 0 }; },
    revokePickupReleaseAuthority: async (id, r) => { revokeCalls.push({ id, r }); return { ok: true, targetUserId: id, isRevoked: true }; },
    reinstatePickupReleaseAuthority: async (id, r) => ({ ok: true, targetUserId: id, isRevoked: false }),
    language: 'en',
    t: tEn,
  };

  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector('[data-testid="pickup-provision-cycles-btn"]'));
  assert.ok(container.querySelector('[data-testid="pickup-release-authority-panel"]'));

  const releaseBtn = container.querySelector(`[data-testid="pickup-confirm-release-btn-${UUID_CYCLE}"]`);
  assert.equal(releaseBtn.disabled, true);

  const checkboxes = [...container.querySelectorAll('input')].filter((el) => el.type === 'checkbox');
  assert.equal(checkboxes.length, 2);
  await act(async () => { checkboxes.forEach((cb) => { cb.click(); }); });
  assert.equal(container.querySelector(`[data-testid="pickup-confirm-release-btn-${UUID_CYCLE}"]`).disabled, false);

  await act(async () => { container.querySelector(`[data-testid="pickup-confirm-release-btn-${UUID_CYCLE}"]`).click(); });
  assert.equal(releaseCalls.length, 1);
  assert.equal(releaseCalls[0].collectorVerifiedInPerson, true);
  assert.equal(releaseCalls[0].physicalHandoffAttested, true);
  assert.match(releaseCalls[0].requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

  // Trigger provisioning
  await act(async () => { container.querySelector('[data-testid="pickup-provision-cycles-btn"]').click(); });
  assert.equal(provisionCalls.length, 1);

  // RELEASED state is read-only with authoritative receipt and zero checkboxes
  globalThis.__PICKUP_G5_UI_CTX__ = {
    ...globalThis.__PICKUP_G5_UI_CTX__,
    currentRole: 'MANAGER',
    currentUser: { id: 'mgr-1', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: [] },
    pickupCycles: [{
      ...globalThis.__PICKUP_G5_UI_CTX__.pickupCycles[0],
      state: 'RELEASED',
      version: 3,
      releasedAt: '2026-11-27T15:20:00Z',
      releasedByName: 'Owner',
      releasedToCollectorName: 'Amira Ben Ali',
      actorCanConfirmRelease: false,
    }],
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.equal(container.querySelector('[data-testid="pickup-release-authority-panel"]'), null);
  assert.ok(container.querySelector(`[data-testid="pickup-staff-released-receipt-${UUID_CYCLE}"]`));
  assert.equal([...container.querySelectorAll('input')].filter((el) => el.type === 'checkbox').length, 0);
  assert.equal(container.querySelector(`[data-testid="pickup-confirm-release-btn-${UUID_CYCLE}"]`), null);

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
  fs.rmSync(outdir, { recursive: true, force: true });
});
