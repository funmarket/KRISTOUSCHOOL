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
import { canAccessAppTab } from '../src/components/homepages/access/appTabAccess.ts';
import {
  announcePickupArrival,
  attemptPickupOperation,
  canActorTriggerArrivalUi,
  canActorTriggerReleaseUi,
  confirmPickupRelease,
  deriveNotificationDeliveryStatus,
  derivePickupPresentationState,
  fetchPickupBoardCycles,
  getChildAvatarInitials,
  PICKUP_BACKEND_UNAVAILABLE_CODE,
  readPickupOperationReceipt,
} from '../src/lib/domains/pickup.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function findPdfFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...findPdfFiles(full));
    else if (ent.name.toLowerCase().endsWith('.pdf')) out.push(full);
  }
  return out;
}

function makeCycle(overrides = {}) {
  return {
    cycleId: 'cycle-1',
    studentId: 'child-1',
    studentName: 'Youssef Ben Ali',
    studentPhotoUrl: '',
    classId: 'class-1',
    className: 'CE1-A',
    schoolDate: '2026-11-25',
    windowId: 'win-1',
    windowLabel: '16:00 - 17:00',
    windowStatus: 'OPEN',
    attendanceEligibility: 'ELIGIBLE',
    state: 'WAITING',
    version: 1,
    parentArrivedAt: null,
    arrivedByUserId: null,
    intendedCollectorId: null,
    intendedCollectorName: null,
    authorizedCollectors: [
      { collectorId: 'col-1', fullName: 'Amira Ben Ali', relationshipLabel: 'Mother', status: 'ACTIVE' },
      { collectorId: 'col-2', fullName: 'Karim Ben Ali', relationshipLabel: 'Father', status: 'ACTIVE' },
    ],
    releasedAt: null,
    releasedByUserId: null,
    releasedByName: null,
    releasedToCollectorId: null,
    releasedToCollectorName: null,
    actorCanAnnounceArrival: true,
    actorCanConfirmRelease: false,
    revocationStatus: 'NONE',
    outboxStatus: 'NONE',
    lastSyncedAt: '2026-11-25T15:00:00Z',
    ...overrides,
  };
}

test('Step 3 Fix 1 & G0+G1 Domain Adapters: zero public PDFs, fail-closed adapters, zero .from/.rpc calls', async () => {
  assert.deepEqual(findPdfFiles(path.join(ROOT, 'public')), [], 'No internal .pdf files may exist under public/');

  const pickupDomainSrc = fs.readFileSync(path.join(ROOT, 'src/lib/domains/pickup.ts'), 'utf8');
  assert.doesNotMatch(pickupDomainSrc, /\.from\s*\(|\.rpc\s*\(/);

  const readRes = await fetchPickupBoardCycles();
  assert.equal(readRes.ok, false);
  assert.equal(readRes.status, 'BLOCKED_BACKEND');
  assert.equal(readRes.availability, 'UNAVAILABLE');
  assert.deepEqual(readRes.records, []);
  assert.equal(readRes.errorCode, PICKUP_BACKEND_UNAVAILABLE_CODE);

  const arrRes = await announcePickupArrival({
    cycleId: 'cycle-1',
    studentId: 'child-1',
    collectorId: 'col-1',
    requestId: 'req-1',
    expectedVersion: 1,
  });
  assert.equal(arrRes.ok, false);
  assert.equal(arrRes.outcome, 'UNAVAILABLE');
  assert.equal(arrRes.reasonCode, PICKUP_BACKEND_UNAVAILABLE_CODE);

  const relRes = await confirmPickupRelease({
    cycleId: 'cycle-1',
    collectorId: 'col-1',
    requestId: 'req-2',
    expectedVersion: 1,
    physicalHandoffAttested: true,
    collectorVerifiedInPerson: true,
  });
  assert.equal(relRes.ok, false);
  assert.equal(relRes.outcome, 'UNAVAILABLE');
  assert.equal(relRes.reasonCode, PICKUP_BACKEND_UNAVAILABLE_CODE);

  const receiptRes = await readPickupOperationReceipt('req-2', 'cycle-1');
  assert.equal(receiptRes.ok, false);
  assert.equal(receiptRes.outcome, 'UNAVAILABLE');
  assert.equal(receiptRes.reasonCode, PICKUP_BACKEND_UNAVAILABLE_CODE);

  const lock = attemptPickupOperation('RELEASE', 'cycle-1');
  assert.equal(lock.allowed, false);
  assert.equal(lock.status, 'BLOCKED_BACKEND');
  assert.equal(lock.reason, 'pickup_backend_unavailable');
});

test('Step 3 Fixes 3 & 4 Guards: release requires PARENT_ARRIVED (never WAITING), permits CLOSED window post-arrival, separates delivery from custody', () => {
  assert.equal(derivePickupPresentationState(null, { readAvailability: 'UNAVAILABLE' }), 'UNAVAILABLE');
  assert.equal(derivePickupPresentationState(null, { readAvailability: 'ERROR' }), 'UNKNOWN');
  assert.equal(derivePickupPresentationState(null, { readAvailability: 'UNAUTHORIZED' }), 'DENIED');
  assert.equal(derivePickupPresentationState(null, { readAvailability: 'READY' }), 'UNKNOWN');

  const waitingCycle = makeCycle();
  assert.equal(derivePickupPresentationState(waitingCycle, { readAvailability: 'READY' }), 'WAITING');
  assert.equal(derivePickupPresentationState(makeCycle({ attendanceEligibility: 'INELIGIBLE' }), { readAvailability: 'READY' }), 'INELIGIBLE');
  assert.equal(derivePickupPresentationState(makeCycle({ windowStatus: 'CLOSED' }), { readAvailability: 'READY' }), 'CLOSED_WINDOW');

  // Fix 4: outbox PENDING_RETRY NEVER overwrites committed PARENT_ARRIVED or RELEASED custody state
  const arrivedRetry = makeCycle({ state: 'PARENT_ARRIVED', outboxStatus: 'PENDING_RETRY' });
  assert.equal(derivePickupPresentationState(arrivedRetry, { readAvailability: 'READY' }), 'PARENT_ARRIVED');
  assert.equal(deriveNotificationDeliveryStatus(arrivedRetry), 'RETRYING');

  const releasedRetry = makeCycle({ state: 'RELEASED', outboxStatus: 'PENDING_RETRY' });
  assert.equal(derivePickupPresentationState(releasedRetry, { readAvailability: 'READY' }), 'RELEASED');
  assert.equal(deriveNotificationDeliveryStatus(releasedRetry), 'RETRYING');
  assert.equal(deriveNotificationDeliveryStatus(makeCycle({ state: 'RELEASED', outboxStatus: 'DELIVERED' })), 'DELIVERED');
  assert.equal(deriveNotificationDeliveryStatus(waitingCycle, { status: 'IDLE', notificationDeliveryStatus: 'QUEUED' }), 'QUEUED');

  // Fix 3: WAITING cannot trigger release even with actorCanConfirmRelease=true; PARENT_ARRIVED CAN trigger release even if windowStatus=CLOSED
  assert.equal(canActorTriggerReleaseUi(makeCycle({ state: 'WAITING', actorCanConfirmRelease: true }), 'READY'), false);
  assert.equal(canActorTriggerReleaseUi(makeCycle({ state: 'PARENT_ARRIVED', windowStatus: 'CLOSED', actorCanConfirmRelease: true }), 'READY'), true);
  assert.equal(canActorTriggerReleaseUi(makeCycle({ state: 'PARENT_ARRIVED', windowStatus: 'UNAVAILABLE', actorCanConfirmRelease: true }), 'READY'), false);
  assert.equal(canActorTriggerReleaseUi(makeCycle({ state: 'RELEASED', actorCanConfirmRelease: true }), 'READY'), false);

  assert.equal(canActorTriggerArrivalUi(waitingCycle, 'UNAVAILABLE'), false);
  assert.equal(canActorTriggerArrivalUi(waitingCycle, 'READY'), true);
  assert.equal(canActorTriggerArrivalUi(waitingCycle, 'READY', { status: 'UNKNOWN_OUTCOME', requestId: 'r-1' }), false);

  const releasableCycle = makeCycle({ state: 'PARENT_ARRIVED', actorCanAnnounceArrival: false, actorCanConfirmRelease: true });
  assert.equal(canActorTriggerReleaseUi(releasableCycle, 'READY'), true);
  assert.equal(canActorTriggerReleaseUi({ ...releasableCycle, revocationStatus: 'REVOKED' }, 'READY'), false);
  assert.equal(canActorTriggerReleaseUi({ ...releasableCycle, actorCanConfirmRelease: false }, 'READY'), false);

  assert.equal(getChildAvatarInitials('Youssef Ben Ali'), 'YA');
  assert.equal(getChildAvatarInitials('Amira'), 'AM');
  assert.equal(getChildAvatarInitials(''), '?');
});

test('G1 Role Access Matrix (Addendum Sec 01): MANAGER default tab access regardless of unrelated caps; SCHOOL_STAFF & STUDENT bounds', () => {
  for (const caps of [[], ['MANAGER'], ['BROADCAST_MANAGE'], ['CLASSES_MANAGE']]) {
    assert.equal(
      canAccessAppTab({ id: 'mgr-1', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: caps }, 'pickup'),
      true,
    );
  }
  for (const role of ['APP_ADMIN', 'ADMINISTRATIVE_PERSONNEL', 'TEACHER', 'PARENT']) {
    assert.equal(
      canAccessAppTab({ id: `u-${role}`, username: role.toLowerCase(), fullName: role, role, accountStatus: 'APPROVED', capabilities: [] }, 'pickup'),
      true,
    );
  }
  assert.equal(canAccessAppTab({ id: 'staff-default', username: 'staff', fullName: 'Staff', role: 'SCHOOL_STAFF', accountStatus: 'APPROVED', capabilities: [] }, 'pickup'), false);
  assert.equal(canAccessAppTab({ id: 'stu-1', username: 'stu', fullName: 'Student', role: 'STUDENT', accountStatus: 'APPROVED', capabilities: [] }, 'pickup'), false);
});

test('Step 3 Fixes 2 & 5 Hook Lifecycle: UNKNOWN_OUTCOME persistence across stale refresh, same-requestId retry/receipt verify, caught rejection, and authoritative readback on missing updatedRecord', async () => {
  const dom = installNodeDomShim();
  const { usePickupState } = await import('../src/context/usePickupState.ts');

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  let hookApi = null;
  let mode = 'ready';
  let boardState = 'PARENT_ARRIVED';
  let boardVersion = 2;
  let receiptMode = 'unavailable';
  const sentReleaseRequestIds = [];
  const verifiedRequestIds = [];
  let identityRef = { userId: 'mgr-1', accountStatus: 'APPROVED', generation: 1 };

  const adapters = {
    fetchCycles: async () => ({
      ok: true,
      status: 'READY',
      availability: 'READY',
      records: [
        makeCycle({
          state: boardState,
          version: boardVersion,
          actorCanAnnounceArrival: false,
          actorCanConfirmRelease: boardState === 'PARENT_ARRIVED',
        }),
      ],
      lastSyncedAt: '2026-11-25T15:05:00Z',
    }),
    readOperationReceipt: async (requestId, cycleId) => {
      verifiedRequestIds.push(requestId);
      if (receiptMode === 'confirmed') {
        return {
          ok: true,
          outcome: 'SUCCESS',
          operationId: 'op-receipt-1',
          cycleId,
          state: 'RELEASED',
          version: 3,
          outboxEnqueued: true,
          updatedRecord: makeCycle({ state: 'RELEASED', version: 3, outboxStatus: 'PENDING_RETRY' }),
        };
      }
      return {
        ok: false,
        outcome: 'UNAVAILABLE',
        reasonCode: 'pickup_backend_unavailable',
        message: 'Receipt unavailable.',
        retryable: true,
      };
    },
    confirmRelease: async (input) => {
      sentReleaseRequestIds.push(input.requestId);
      if (mode === 'reject') {
        throw new Error('Network connection reset during release');
      }
      if (mode === 'success-missing-record') {
        return {
          ok: true,
          outcome: 'SUCCESS',
          operationId: 'op-missing',
          cycleId: input.cycleId,
          state: 'RELEASED',
          version: input.expectedVersion + 1,
          outboxEnqueued: false,
        };
      }
      if (mode === 'conflict') {
        return {
          ok: false,
          outcome: 'CONFLICT',
          reasonCode: 'already_released',
          message: 'Already released on server.',
          serverRecord: makeCycle({ state: 'RELEASED', version: 3, releasedByName: 'Directrice Nadia', releasedToCollectorName: 'Amira Ben Ali' }),
        };
      }
      if (mode === 'unknown') {
        return {
          ok: false,
          outcome: 'UNKNOWN_OUTCOME',
          requestId: input.requestId,
          cycleId: input.cycleId,
          reasonCode: 'unknown_outcome_verify_required',
          message: 'Timeout waiting for server confirmation.',
          requiresAuthoritativeReadback: true,
        };
      }
      return {
        ok: true,
        outcome: 'SUCCESS',
        operationId: 'op-1',
        cycleId: input.cycleId,
        state: 'RELEASED',
        version: input.expectedVersion + 1,
        outboxEnqueued: true,
        updatedRecord: makeCycle({ state: 'RELEASED', version: input.expectedVersion + 1, outboxStatus: 'PENDING_RETRY' }),
      };
    },
  };

  function Harness({ user, identity }) {
    hookApi = usePickupState({ currentUser: user, identityContext: identity, getCurrentIdentity: () => identityRef, adapters });
    return null;
  }

  const mgrUser = { id: 'mgr-1', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: ['BROADCAST_MANAGE'] };

  await act(async () => { root.render(React.createElement(Harness, { user: mgrUser, identity: identityRef })); });
  await act(async () => { await hookApi.refreshPickupBoard(); });

  // Fix 5: rejected command promise never leaves SUBMITTING stuck; converts to UNKNOWN_OUTCOME with stored requestId
  mode = 'reject';
  let rejRes;
  await act(async () => {
    rejRes = await hookApi.confirmPickupRelease({
      cycleId: 'cycle-1', collectorId: 'col-1', requestId: 'req-rej-1', expectedVersion: 2,
      collectorVerifiedInPerson: true, physicalHandoffAttested: true,
    });
  });
  assert.equal(rejRes.outcome, 'UNKNOWN_OUTCOME');
  assert.equal(hookApi.pickupMutationState['cycle-1'].status, 'UNKNOWN_OUTCOME');
  assert.equal(hookApi.pickupMutationState['cycle-1'].requestId, 'req-rej-1');

  // Fix 2: generic stale refresh (same version 2, PARENT_ARRIVED) MUST preserve UNKNOWN_OUTCOME; blind new requestId stays blocked
  await act(async () => { await hookApi.refreshPickupBoard(); });
  assert.equal(hookApi.pickupMutationState['cycle-1'].status, 'UNKNOWN_OUTCOME');

  let blindNewRes;
  await act(async () => {
    blindNewRes = await hookApi.confirmPickupRelease({
      cycleId: 'cycle-1', collectorId: 'col-1', requestId: 'req-new-blind', expectedVersion: 2,
      collectorVerifiedInPerson: true, physicalHandoffAttested: true,
    });
  });
  assert.equal(blindNewRes.outcome, 'UNKNOWN_OUTCOME');
  assert.equal(blindNewRes.commandOutcome.requestId, 'req-rej-1');
  assert.equal(sentReleaseRequestIds.includes('req-new-blind'), false);

  // Fix 2: verifyPickupOperationReceipt keeps UNKNOWN_OUTCOME while receipt unavailable, then clears when receipt confirms
  let verifyUnavail;
  await act(async () => { verifyUnavail = await hookApi.verifyPickupOperationReceipt('cycle-1'); });
  assert.equal(verifyUnavail.outcome, 'UNKNOWN_OUTCOME');
  assert.equal(verifiedRequestIds[0], 'req-rej-1');

  receiptMode = 'confirmed';
  let verifyConfirmed;
  await act(async () => { verifyConfirmed = await hookApi.verifyPickupOperationReceipt('cycle-1'); });
  assert.equal(verifyConfirmed.success, true);
  assert.equal(hookApi.pickupCycles[0].state, 'RELEASED');
  assert.equal(hookApi.pickupMutationState['cycle-1'].status, 'IDLE');
  assert.equal(hookApi.pickupMutationState['cycle-1'].notificationDeliveryStatus, 'RETRYING');

  // Reset cycle to PARENT_ARRIVED v2 for Fix 5 (SUCCESS missing updatedRecord without server confirmation -> UNKNOWN_OUTCOME)
  receiptMode = 'unavailable';
  boardState = 'PARENT_ARRIVED';
  boardVersion = 2;
  await act(async () => { await hookApi.refreshPickupBoard(); });

  mode = 'success-missing-record';
  let unconfirmedSuccess;
  await act(async () => {
    unconfirmedSuccess = await hookApi.confirmPickupRelease({
      cycleId: 'cycle-1', collectorId: 'col-1', requestId: 'req-missing-rec', expectedVersion: 2,
      collectorVerifiedInPerson: true, physicalHandoffAttested: true,
    });
  });
  assert.equal(unconfirmedSuccess.success, false);
  assert.equal(unconfirmedSuccess.outcome, 'UNKNOWN_OUTCOME');
  assert.equal(hookApi.pickupMutationState['cycle-1'].status, 'UNKNOWN_OUTCOME');

  // When server board subsequently shows committed RELEASED v3, generic refresh clears UNKNOWN_OUTCOME
  boardState = 'RELEASED';
  boardVersion = 3;
  await act(async () => { await hookApi.refreshPickupBoard(); });
  assert.equal(hookApi.pickupCycles[0].state, 'RELEASED');
  assert.equal(hookApi.pickupMutationState['cycle-1'], undefined);

  // Explicit same-requestId retry reuses stored requestId and completes on server retry
  boardState = 'PARENT_ARRIVED';
  boardVersion = 2;
  await act(async () => { await hookApi.refreshPickupBoard(); });
  mode = 'unknown';
  await act(async () => {
    await hookApi.confirmPickupRelease({
      cycleId: 'cycle-1', collectorId: 'col-1', requestId: 'req-retry-idempotent', expectedVersion: 2,
      collectorVerifiedInPerson: true, physicalHandoffAttested: true,
    });
  });
  mode = 'ready';
  let retrySameRes;
  await act(async () => { retrySameRes = await hookApi.confirmPickupRelease(hookApi.pickupMutationState['cycle-1'].payload); });
  assert.equal(retrySameRes.success, true);
  assert.equal(sentReleaseRequestIds.filter((id) => id === 'req-retry-idempotent').length, 2);

  // Generation / account switch clears all pickup state
  identityRef = { userId: 'parent-2', accountStatus: 'APPROVED', generation: 2 };
  await act(async () => {
    root.render(React.createElement(Harness, { user: { id: 'parent-2', username: 'p2', fullName: 'Parent 2', role: 'PARENT', accountStatus: 'APPROVED' }, identity: identityRef }));
  });
  assert.deepEqual(hookApi.pickupCycles, []);
  assert.equal(hookApi.pickupStatus, 'BLOCKED_BACKEND');
  assert.deepEqual(hookApi.pickupMutationState, {});

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
});

test('Step 3 Fixes 2, 4 & 6 UI + i18n: separate delivery badge, actor-change reset of collector/attestations/filter, same-requestId retry button', async () => {
  for (const lang of ['ar', 'fr', 'en']) {
    for (const key of [
      'pickupServerSyncedBadge', 'pickupStateUnavailable', 'pickupStateUnknown', 'pickupStatePendingRetry',
      'pickupStateConflict', 'pickupStateDenied', 'pickupStateIneligible', 'pickupStateClosedWindow',
      'pickupRefreshFromServer', 'pickupNoDefaultReleaseHint', 'pickupReleaseRevokedNotice',
      'pickupDeliveryQueued', 'pickupDeliveryRetrying', 'pickupDeliveryDelivered', 'pickupDeliveryUnavailable', 'pickupRetrySameRequest',
    ]) {
      assert.ok(translations[lang][key]?.trim(), `Missing translation ${lang}.${key}`);
    }
  }

  const dom = installNodeDomShim();
  const require = createRequire(import.meta.url);
  const outdir = path.join('/tmp', 'kristou-pickup-g0-g1-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const pickupOutfile = path.join(outdir, 'pickup-board.cjs');
  const managerOutfile = path.join(outdir, 'manager-home.cjs');

  const plugin = {
    name: 'pickup-g0-g1-mocks',
    setup(builder) {
      builder.onResolve({ filter: /context\/AppContext$/ }, () => ({ path: 'mock-app-ctx', namespace: 'pickupg0g1' }));
      builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'pickupg0g1' }, () => ({ contents: `export const useApp = () => globalThis.__PICKUP_G0_G1_CTX__;` }));
      builder.onResolve({ filter: /lib\/schoolOperations$/ }, () => ({ path: 'mock-school-ops', namespace: 'pickupg0g1' }));
      builder.onLoad({ filter: /^mock-school-ops$/, namespace: 'pickupg0g1' }, () => ({ contents: `export const respondPublicInquiry = async () => ({ ok: true });` }));
      builder.onResolve({ filter: /^[^./]/ }, (args) => ({ path: require.resolve(args.path), external: true }));
    },
  };

  await Promise.all([
    build({ entryPoints: [path.resolve(ROOT, 'src/components/views/PickupBoardView.tsx')], outfile: pickupOutfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [plugin] }),
    build({ entryPoints: [path.resolve(ROOT, 'src/components/homepages/ManagerHomePage.tsx')], outfile: managerOutfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [plugin] }),
  ]);

  const { PickupBoardView } = require(pickupOutfile);
  const { ManagerHomePage } = require(managerOutfile);
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);
  const tEn = (key) => translations.en[key] ?? key;

  // 1. Parent with empty photoUrl and READY PARENT_ARRIVED + outboxStatus=PENDING_RETRY: primary badge shows Parent arrived, secondary badge shows retrying
  globalThis.__PICKUP_G0_G1_CTX__ = {
    currentUser: { id: 'parent-1', username: 'parent1', fullName: 'Amira Ben Ali', role: 'PARENT', accountStatus: 'APPROVED', linkedChildrenIds: ['child-1'] },
    currentRole: 'PARENT',
    childrenList: [{ id: 'child-1', fullName: 'Youssef Ben Ali', classId: 'c-1', className: 'CE1-A', level: 'CE1', birthDate: '2019-03-01', photoUrl: '', pickupAuthorizedNames: ['Amira Ben Ali'] }],
    pickupCycles: [],
    pickupRecords: [],
    pickupAvailability: 'UNAVAILABLE',
    pickupErrorCode: 'pickup_backend_unavailable',
    pickupLastSyncedAt: null,
    pickupMutationState: {},
    isLoadingPickup: false,
    refreshPickupBoard: async () => ({ ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [], lastSyncedAt: null }),
    markPickupArrived: async () => ({ success: false, status: 'BLOCKED_BACKEND', outcome: 'UNAVAILABLE' }),
    confirmPickupRelease: async () => ({ success: false, status: 'BLOCKED_BACKEND', outcome: 'UNAVAILABLE' }),
    language: 'en',
    t: tEn,
  };

  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector('[data-testid="pickup-safety-lock-banner"]'));
  assert.equal(container.querySelector('[data-testid="pickup-avatar-fallback"]').textContent, 'YA');
  assert.equal(container.querySelector('img'), null);
  assert.doesNotMatch(container.querySelector('[data-testid="pickup-child-state-badge-child-1"]').textContent, /WAITING/i);

  // Separate notification delivery badge on PARENT_ARRIVED + PENDING_RETRY
  globalThis.__PICKUP_G0_G1_CTX__ = {
    ...globalThis.__PICKUP_G0_G1_CTX__,
    pickupAvailability: 'READY',
    pickupErrorCode: null,
    pickupCycles: [makeCycle({ state: 'PARENT_ARRIVED', outboxStatus: 'PENDING_RETRY' })],
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.equal(container.querySelector('[data-testid="pickup-child-state-badge-child-1"]').textContent, tEn('parentArrived'));
  assert.equal(container.querySelector('[data-testid="pickup-delivery-status-badge-child-1"]').textContent, tEn('pickupDeliveryRetrying'));

  // 2. Fix 6: Manager actor-1 checks both attestation checkboxes, then actor switch to Manager actor-2 resets checkboxes & collector
  const retriedPayloads = [];
  globalThis.__PICKUP_G0_G1_CTX__ = {
    ...globalThis.__PICKUP_G0_G1_CTX__,
    currentUser: { id: 'mgr-1', username: 'mgr1', fullName: 'Manager One', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: ['BROADCAST_MANAGE'] },
    currentRole: 'MANAGER',
    pickupCycles: [makeCycle({ state: 'PARENT_ARRIVED', actorCanAnnounceArrival: false, actorCanConfirmRelease: true })],
    pickupMutationState: {},
    confirmPickupRelease: async (input) => { retriedPayloads.push(input); return { success: true, status: 'READY', outcome: 'SUCCESS' }; },
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  const getCheckboxes = () => [...container.querySelectorAll('input')].filter((el) => el.type === 'checkbox');
  const checkboxesBefore = getCheckboxes();
  assert.equal(checkboxesBefore.length, 2);
  await act(async () => {
    checkboxesBefore.forEach((cb) => { cb.click(); });
  });
  assert.equal(getCheckboxes().filter((cb) => cb.checked).length, 2);

  // Switch actor to mgr-2 -> attestation checkboxes MUST reset to unchecked
  globalThis.__PICKUP_G0_G1_CTX__ = {
    ...globalThis.__PICKUP_G0_G1_CTX__,
    currentUser: { id: 'mgr-2', username: 'mgr2', fullName: 'Manager Two', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: [] },
    pickupMutationState: {
      'cycle-1': {
        status: 'UNKNOWN_OUTCOME',
        requestId: 'req-stored-1',
        operation: 'RELEASE',
        payload: { cycleId: 'cycle-1', collectorId: 'col-1', requestId: 'req-stored-1', expectedVersion: 1, collectorVerifiedInPerson: true, physicalHandoffAttested: true },
      },
    },
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.equal(getCheckboxes().filter((cb) => cb.checked).length, 0);

  // Even when UNKNOWN_OUTCOME clears for mgr-3, previously checked boxes do not survive actor change
  globalThis.__PICKUP_G0_G1_CTX__ = {
    ...globalThis.__PICKUP_G0_G1_CTX__,
    currentUser: { id: 'mgr-3', username: 'mgr3', fullName: 'Manager Three', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: [] },
    pickupMutationState: {},
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.equal(getCheckboxes().length, 2);
  assert.equal(getCheckboxes().filter((cb) => cb.checked).length, 0);

  // Re-render mgr-2 UNKNOWN_OUTCOME to test exact stored requestId retry button
  globalThis.__PICKUP_G0_G1_CTX__ = {
    ...globalThis.__PICKUP_G0_G1_CTX__,
    currentUser: { id: 'mgr-2', username: 'mgr2', fullName: 'Manager Two', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: [] },
    pickupMutationState: {
      'cycle-1': {
        status: 'UNKNOWN_OUTCOME',
        requestId: 'req-stored-1',
        operation: 'RELEASE',
        payload: { cycleId: 'cycle-1', collectorId: 'col-1', requestId: 'req-stored-1', expectedVersion: 1, collectorVerifiedInPerson: true, physicalHandoffAttested: true },
      },
    },
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });

  // Retry button reuses exact stored requestId 'req-stored-1'
  const retryBtn = container.querySelector('[data-testid="pickup-retry-release-btn-cycle-1"]');
  assert.ok(retryBtn);
  await act(async () => { retryBtn.click(); });
  assert.equal(retriedPayloads.length, 1);
  assert.equal(retriedPayloads[0].requestId, 'req-stored-1');

  // 3. SCHOOL_STAFF with actorCanConfirmRelease=false sees no release buttons
  globalThis.__PICKUP_G0_G1_CTX__ = {
    ...globalThis.__PICKUP_G0_G1_CTX__,
    currentUser: { id: 'staff-1', username: 'staff1', fullName: 'Staff User', role: 'SCHOOL_STAFF', accountStatus: 'APPROVED', capabilities: ['PICKUP_VIEW'] },
    currentRole: 'SCHOOL_STAFF',
    pickupMutationState: {},
    pickupCycles: [makeCycle({ state: 'PARENT_ARRIVED', actorCanAnnounceArrival: false, actorCanConfirmRelease: false })],
  };
  await act(async () => { root.render(React.createElement(PickupBoardView)); });
  assert.ok(container.querySelector('[data-testid="pickup-no-default-release-notice"]'));
  assert.ok(!container.textContent.includes(tEn('confirmRelease')));

  // 4. ManagerHomePage renders manager-pickup card even when manager has unrelated capabilities
  globalThis.__PICKUP_G0_G1_CTX__ = {
    ...globalThis.__PICKUP_G0_G1_CTX__,
    currentUser: { id: 'mgr-1', username: 'mgr1', fullName: 'Manager One', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: ['BROADCAST_MANAGE'] },
    currentRole: 'MANAGER',
    operationalCounts: {}, operationalCountsLoaded: true, schoolContextError: null,
    publicInquiries: [], inquiriesStatus: 'READY', messages: [], messagesStatus: 'READY',
    refreshSchoolData: async () => true,
  };
  await act(async () => { root.render(React.createElement(ManagerHomePage, { setActiveTab: () => {} })); });
  assert.ok(container.querySelector('[data-testid="shortcut-card-manager-pickup"]'));

  await act(async () => { root.unmount(); });
  dom.document.body.removeChild(container);
  fs.rmSync(outdir, { recursive: true, force: true });
});
