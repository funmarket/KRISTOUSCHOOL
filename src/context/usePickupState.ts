import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { AccountRole, BackendOpStatus, User } from '../types.ts';
import { isMatchingApprovedAccountContext, type AccountIdentityContext } from '../lib/appStateGuards.ts';
import {
  announcePickupArrival as defaultAnnouncePickupArrival,
  confirmPickupRelease as defaultConfirmPickupRelease,
  createPickupRequestId,
  deniedPickupOutcome as deniedOutcome,
  deriveSuccessDeliveryStatus,
  fetchPickupBoardCycles as defaultFetchPickupBoardCycles,
  hasCommittedPickupTransition,
  hasServerSupersededPending,
  PICKUP_BACKEND_UNAVAILABLE_CODE,
  readPickupOperationReceipt as defaultReadPickupOperationReceipt,
  toLegacyPickupRecord,
  unavailablePickupOutcome as unavailableOutcome,
  unknownPickupOutcomeFor as unknownOutcomeFor,
  type AnnounceArrivalInput,
  type ConfirmReleaseInput,
  type PickupAvailabilityStatus,
  type PickupCommandConflict,
  type PickupCommandOutcome,
  type PickupCycleRecord,
  type PickupMutationEntry,
  type PickupReadResult,
  type PickupReasonCode,
  type PickupRecord,
} from '../lib/domains/pickup.ts';
import {
  toPickupMutationResponse,
  usePickupAdminActions,
  type PickupAdminNotice,
  type PickupMutationResponse,
  type UsePickupAdminAdapters,
} from './usePickupAdminActions.ts';
import {
  usePickupEarlyDepartureActions,
  type EarlyDepartureMutationResponse,
  type UsePickupEarlyDepartureAdapters,
} from './usePickupEarlyDepartureActions.ts';

export type { EarlyDepartureMutationResponse, PickupAdminNotice, PickupMutationResponse };

export interface UsePickupStateAdapters extends UsePickupAdminAdapters, UsePickupEarlyDepartureAdapters {
  fetchCycles?: (options?: { role?: AccountRole | null; classId?: string | null }) => Promise<PickupReadResult>;
  announceArrival?: (input: AnnounceArrivalInput) => Promise<PickupCommandOutcome>;
  confirmRelease?: (input: ConfirmReleaseInput) => Promise<PickupCommandOutcome>;
  readOperationReceipt?: (requestId: string, cycleId: string) => Promise<PickupCommandOutcome>;
}

export interface UsePickupStateParams {
  currentUser: User | null;
  identityContext: AccountIdentityContext;
  getCurrentIdentity: () => AccountIdentityContext;
  mountedRef?: React.MutableRefObject<boolean>;
  adapters?: UsePickupStateAdapters;
}

type PickupCommandPayload = AnnounceArrivalInput | ConfirmReleaseInput;

const isEligible = (user: User | null | undefined): boolean =>
  Boolean(user && user.accountStatus === 'APPROVED' && user.role !== 'STUDENT');

export function usePickupState({ currentUser, identityContext, getCurrentIdentity, mountedRef, adapters }: UsePickupStateParams) {
  const fetchCycles = adapters?.fetchCycles ?? defaultFetchPickupBoardCycles;
  const announceArrival = adapters?.announceArrival ?? defaultAnnouncePickupArrival;
  const confirmRelease = adapters?.confirmRelease ?? defaultConfirmPickupRelease;
  const readOperationReceipt = adapters?.readOperationReceipt ?? defaultReadPickupOperationReceipt;

  const [pickupCycles, setPickupCycles] = useState<PickupCycleRecord[]>([]);
  const [pickupStatus, setPickupStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [pickupAvailability, setPickupAvailability] = useState<PickupAvailabilityStatus>('UNAVAILABLE');
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [pickupErrorCode, setPickupErrorCode] = useState<PickupReasonCode | null>(PICKUP_BACKEND_UNAVAILABLE_CODE);
  const [pickupLastSyncedAt, setPickupLastSyncedAt] = useState<string | null>(null);
  const [pickupMutationState, setPickupMutationState] = useState<Record<string, PickupMutationEntry>>({});
  const [isLoadingPickup, setIsLoadingPickup] = useState<boolean>(false);

  const internalMountedRef = useRef<boolean>(true);
  const effectiveMountedRef = mountedRef ?? internalMountedRef;
  const readReqGenRef = useRef<number>(0);
  const refreshEarlyRef = useRef<(targetUser: User | null | undefined, classId?: string | null) => Promise<unknown>>(async () => {});

  useEffect(() => {
    if (mountedRef) return;
    internalMountedRef.current = true;
    return () => { internalMountedRef.current = false; };
  }, [mountedRef]);

  const refreshPickupBoardForUser = useCallback(
    async (targetUser: User | null | undefined, classId?: string | null): Promise<PickupReadResult> => {
      const origin = getCurrentIdentity();
      if (!targetUser || !isEligible(targetUser)) {
        const denied: PickupReadResult = {
          ok: false, status: 'UNAUTHORIZED', availability: 'UNAUTHORIZED', records: [],
          lastSyncedAt: null, errorCode: 'actor_not_authorized', errorMessage: 'Approved eligible account required for pickup access.',
        };
        if (effectiveMountedRef.current) {
          setPickupCycles([]); setPickupStatus('UNAUTHORIZED'); setPickupAvailability('UNAUTHORIZED');
          setPickupError(denied.errorMessage ?? null); setPickupErrorCode('actor_not_authorized'); setPickupLastSyncedAt(null);
        }
        return denied;
      }
      const reqGen = ++readReqGenRef.current;
      if (effectiveMountedRef.current) setIsLoadingPickup(true);
      void refreshEarlyRef.current(targetUser, classId ?? null);
      try {
        const res = await fetchCycles({ role: targetUser.role, classId: classId ?? null });
        if (reqGen !== readReqGenRef.current || !isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
          return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'session_changed', errorMessage: 'Account session changed.' };
        }
        setPickupStatus(res.status);
        setPickupAvailability(res.availability);
        setPickupError(res.ok ? null : res.errorMessage ?? null);
        setPickupErrorCode(res.ok ? null : res.errorCode ?? null);
        setPickupLastSyncedAt(res.lastSyncedAt);
        if (res.ok && res.availability === 'READY') {
          setPickupCycles(res.records);
          setPickupMutationState((prev) =>
            Object.fromEntries(
              Object.entries(prev).filter(([cycleId, entry]) =>
                entry.status === 'UNKNOWN_OUTCOME'
                  ? !hasServerSupersededPending(res.records, cycleId, entry)
                  : entry.status === 'IDLE' && entry.notificationDeliveryStatus && entry.notificationDeliveryStatus !== 'NONE',
              ),
            ),
          );
        } else if (res.availability === 'UNAUTHORIZED') {
          setPickupCycles([]);
        }
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to refresh pickup board.';
        if (reqGen === readReqGenRef.current && effectiveMountedRef.current) {
          setPickupStatus('ERROR'); setPickupAvailability('ERROR'); setPickupError(message); setPickupErrorCode('unknown_outcome_verify_required');
        }
        return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: 'Unable to refresh pickup board.' };
      } finally {
        if (reqGen === readReqGenRef.current && effectiveMountedRef.current) setIsLoadingPickup(false);
      }
    },
    [effectiveMountedRef, fetchCycles, getCurrentIdentity],
  );

  const adminActions = usePickupAdminActions({
    currentUser, getCurrentIdentity, effectiveMountedRef, refreshPickupBoardForUser, adapters,
  });
  const earlyActions = usePickupEarlyDepartureActions({
    currentUser, getCurrentIdentity, effectiveMountedRef, refreshPickupBoardForUser, adapters,
  });
  refreshEarlyRef.current = earlyActions.refreshEarlyDeparturesForUser;

  const { clearPickupAdminState } = adminActions;
  const { clearEarlyDepartureState } = earlyActions;

  const clearPickupState = useCallback(() => {
    readReqGenRef.current += 1;
    setPickupCycles([]); setPickupStatus('BLOCKED_BACKEND'); setPickupAvailability('UNAVAILABLE');
    setPickupError(null); setPickupErrorCode(PICKUP_BACKEND_UNAVAILABLE_CODE);
    setPickupLastSyncedAt(null); setPickupMutationState({}); setIsLoadingPickup(false);
    clearPickupAdminState();
    clearEarlyDepartureState();
  }, [clearEarlyDepartureState, clearPickupAdminState]);

  const lastIdentityGenRef = useRef<number>(identityContext.generation);
  useEffect(() => {
    if (lastIdentityGenRef.current !== identityContext.generation || !isEligible(currentUser)) {
      lastIdentityGenRef.current = identityContext.generation;
      clearPickupState();
    }
  }, [clearPickupState, currentUser, identityContext.generation]);

  const refreshPickupBoard = useCallback(
    (classId?: string | null) => refreshPickupBoardForUser(currentUser, classId),
    [currentUser, refreshPickupBoardForUser],
  );

  const applyCommandOutcome = useCallback(
    (targetKey: string, outcome: PickupCommandOutcome, ctx?: { operation: 'ARRIVAL' | 'RELEASE'; payload: PickupCommandPayload }) => {
      if (!effectiveMountedRef.current) return;
      const upsertCycle = (record?: PickupCycleRecord) => {
        if (!record) return;
        setPickupCycles((prev) => prev.some((i) => i.cycleId === record.cycleId) ? prev.map((i) => (i.cycleId === record.cycleId ? record : i)) : [...prev, record]);
      };
      if (outcome.ok) {
        upsertCycle(outcome.updatedRecord);
        setPickupMutationState((prev) => ({
          ...prev,
          [targetKey]: { status: 'IDLE', requestId: ctx?.payload.requestId, notificationDeliveryStatus: deriveSuccessDeliveryStatus(outcome.outboxEnqueued, outcome.updatedRecord) },
        }));
        return;
      }
      if (outcome.outcome === 'CONFLICT') {
        if (outcome.serverRecord) {
          upsertCycle(outcome.serverRecord);
        } else if (outcome.serverState || outcome.serverVersion) {
          setPickupCycles((prev) => prev.map((item) => item.cycleId !== targetKey ? item : {
            ...item, state: outcome.serverState ?? item.state, version: outcome.serverVersion ?? item.version,
            actorCanAnnounceArrival: outcome.serverState === 'WAITING' ? item.actorCanAnnounceArrival : false,
            actorCanConfirmRelease: outcome.serverState === 'PARENT_ARRIVED' ? item.actorCanConfirmRelease : false,
          }));
        }
        setPickupMutationState((prev) => ({
          ...prev,
          [targetKey]: { status: 'CONFLICT', reasonCode: outcome.reasonCode, message: outcome.message, serverRecord: outcome.serverRecord },
        }));
        return;
      }
      if (outcome.outcome === 'UNKNOWN_OUTCOME') {
        setPickupMutationState((prev) => ({
          ...prev,
          [targetKey]: {
            status: 'UNKNOWN_OUTCOME', requestId: outcome.requestId,
            operation: ctx?.operation ?? prev[targetKey]?.operation,
            payload: ctx?.payload ?? prev[targetKey]?.payload,
            reasonCode: outcome.reasonCode, message: outcome.message,
          },
        }));
        return;
      }
      if (outcome.outcome === 'DENIED' && outcome.reasonCode === 'pickup_release_authority_revoked') {
        setPickupCycles((prev) => prev.map((c) => ({ ...c, revocationStatus: 'REVOKED', actorCanConfirmRelease: false })));
      }
      setPickupMutationState((prev) => ({
        ...prev,
        [targetKey]: { status: outcome.outcome === 'DENIED' ? 'DENIED' : 'UNAVAILABLE', reasonCode: outcome.reasonCode, message: outcome.message },
      }));
    },
    [effectiveMountedRef],
  );

  const reconcileConflictFromBoard = useCallback(
    async (cycleId: string, role: AccountRole, conflict: PickupCommandConflict, origin: AccountIdentityContext): Promise<PickupCommandConflict> => {
      if (conflict.serverRecord) return conflict;
      try {
        const board = await fetchCycles({ role });
        if (isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current) && board.ok && board.availability === 'READY') {
          setPickupCycles(board.records); setPickupStatus(board.status); setPickupAvailability(board.availability); setPickupLastSyncedAt(board.lastSyncedAt);
          const matched = board.records.find((r) => r.cycleId === cycleId);
          if (matched) return { ...conflict, serverRecord: matched };
        }
      } catch {
        // Retain conflict metadata even when follow-up readback fails.
      }
      return conflict;
    },
    [effectiveMountedRef, fetchCycles, getCurrentIdentity],
  );

  const reconcileAuthoritativeSuccess = useCallback(
    async (
      cycleId: string, operation: 'ARRIVAL' | 'RELEASE', payload: PickupCommandPayload,
      outcome: Extract<PickupCommandOutcome, { ok: true }>, origin: AccountIdentityContext, role: AccountRole,
      skipReceiptRead = false,
    ): Promise<PickupCommandOutcome> => {
      if (hasCommittedPickupTransition(outcome.updatedRecord, cycleId, operation)) return outcome;
      if (!skipReceiptRead) {
        try {
          const receipt = await readOperationReceipt(payload.requestId, cycleId);
          if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return deniedOutcome('session_changed', 'Account session changed.');
          if (receipt.ok && hasCommittedPickupTransition(receipt.updatedRecord, cycleId, operation)) return receipt;
          if (!receipt.ok && (receipt.outcome === 'CONFLICT' || receipt.outcome === 'DENIED')) return receipt;
        } catch {
          // Fall through to board readback verification.
        }
      }
      try {
        const board = await fetchCycles({ role });
        if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return deniedOutcome('session_changed', 'Account session changed.');
        if (board.ok && board.availability === 'READY') {
          const matched = board.records.find((r) => r.cycleId === cycleId);
          if (hasCommittedPickupTransition(matched, cycleId, operation)) {
            if (effectiveMountedRef.current) {
              setPickupCycles(board.records); setPickupStatus(board.status); setPickupAvailability(board.availability); setPickupLastSyncedAt(board.lastSyncedAt);
            }
            return { ...outcome, updatedRecord: matched };
          }
        }
      } catch {
        // Authoritative readback failed; require explicit verification.
      }
      return unknownOutcomeFor(payload.requestId, cycleId, 'Server acknowledged command without updated pickup record; verification required.');
    },
    [effectiveMountedRef, fetchCycles, getCurrentIdentity, readOperationReceipt],
  );

  const verifyPickupOperationReceipt = useCallback(async (cycleId: string): Promise<PickupMutationResponse> => {
    if (!currentUser || !isEligible(currentUser)) return toPickupMutationResponse(deniedOutcome('actor_not_authorized', 'Approved account required.'));
    const existing = pickupMutationState[cycleId];
    if (!existing || existing.status !== 'UNKNOWN_OUTCOME' || !existing.requestId || !existing.payload || !existing.operation) {
      return toPickupMutationResponse(unknownOutcomeFor(existing?.requestId || '', cycleId, 'No pending unconfirmed operation to verify.'));
    }
    const origin = getCurrentIdentity();
    let outcome: PickupCommandOutcome;
    try {
      const receipt = await readOperationReceipt(existing.requestId, cycleId);
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toPickupMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
      if (receipt.ok) outcome = await reconcileAuthoritativeSuccess(cycleId, existing.operation, existing.payload, receipt, origin, currentUser.role);
      else if (receipt.outcome === 'CONFLICT') outcome = await reconcileConflictFromBoard(cycleId, currentUser.role, receipt, origin);
      else if (receipt.outcome === 'DENIED') outcome = receipt;
      else outcome = unknownOutcomeFor(existing.requestId, cycleId, receipt.message || 'Outcome still unconfirmed on server.');
    } catch (err) {
      outcome = unknownOutcomeFor(existing.requestId, cycleId, err instanceof Error ? err.message : 'Receipt verification failed.');
    }
    if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toPickupMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
    applyCommandOutcome(cycleId, outcome, { operation: existing.operation, payload: existing.payload });
    return toPickupMutationResponse(outcome);
  }, [applyCommandOutcome, currentUser, effectiveMountedRef, getCurrentIdentity, pickupMutationState, readOperationReceipt, reconcileAuthoritativeSuccess, reconcileConflictFromBoard]);

  const runCommand = useCallback(
    async (
      cycleId: string, operation: 'ARRIVAL' | 'RELEASE', payload: PickupCommandPayload,
      execute: (effectivePayload: PickupCommandPayload) => Promise<PickupCommandOutcome>,
    ): Promise<PickupMutationResponse> => {
      if (!currentUser || !isEligible(currentUser)) return toPickupMutationResponse(deniedOutcome('actor_not_authorized', 'Approved account required.'));
      if (pickupAvailability !== 'READY') {
        const unavailable = unavailableOutcome(pickupErrorCode || PICKUP_BACKEND_UNAVAILABLE_CODE, pickupError || 'Pickup backend is unavailable.');
        applyCommandOutcome(cycleId, unavailable);
        return toPickupMutationResponse(unavailable);
      }
      const origin = getCurrentIdentity();
      let effectivePayload = payload;
      const existing = pickupMutationState[cycleId];
      if (existing?.status === 'UNKNOWN_OUTCOME') {
        if (!existing.requestId || payload.requestId !== existing.requestId) {
          return toPickupMutationResponse(unknownOutcomeFor(existing.requestId || payload.requestId, cycleId, 'Verify or retry the pending request before submitting a new request.'));
        }
        effectivePayload = existing.payload ?? payload;
        try {
          const receipt = await readOperationReceipt(existing.requestId, cycleId);
          if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toPickupMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
          if (receipt.ok || receipt.outcome === 'CONFLICT' || receipt.outcome === 'DENIED') {
            const resolved = receipt.ok
              ? await reconcileAuthoritativeSuccess(cycleId, operation, effectivePayload, receipt, origin, currentUser.role)
              : receipt.outcome === 'CONFLICT'
                ? await reconcileConflictFromBoard(cycleId, currentUser.role, receipt, origin)
                : receipt;
            applyCommandOutcome(cycleId, resolved, { operation, payload: effectivePayload });
            return toPickupMutationResponse(resolved);
          }
        } catch {
          // Receipt lookup unavailable; retry with exact stored payload & requestId.
        }
      }
      if (effectiveMountedRef.current) {
        setPickupMutationState((prev) => ({
          ...prev,
          [cycleId]: { status: 'SUBMITTING', requestId: effectivePayload.requestId, operation, payload: effectivePayload },
        }));
      }
      let outcome: PickupCommandOutcome;
      try {
        outcome = await execute(effectivePayload);
      } catch (err) {
        outcome = unknownOutcomeFor(effectivePayload.requestId, cycleId, err instanceof Error && err.message ? err.message : 'Request failed before server confirmation.');
      }
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toPickupMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
      let receiptAlreadyChecked = false;
      if (!outcome.ok && outcome.outcome === 'UNKNOWN_OUTCOME') {
        try {
          const autoReceipt = await readOperationReceipt(effectivePayload.requestId, cycleId);
          receiptAlreadyChecked = true;
          if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toPickupMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
          if (autoReceipt.ok || autoReceipt.outcome === 'CONFLICT' || autoReceipt.outcome === 'DENIED') outcome = autoReceipt;
        } catch {
          // Preserve UNKNOWN_OUTCOME with exact requestId for explicit verification or retry.
        }
      }
      if (outcome.ok) outcome = await reconcileAuthoritativeSuccess(cycleId, operation, effectivePayload, outcome, origin, currentUser.role, receiptAlreadyChecked);
      else if (outcome.outcome === 'CONFLICT') outcome = await reconcileConflictFromBoard(cycleId, currentUser.role, outcome, origin);
      applyCommandOutcome(cycleId, outcome, { operation, payload: effectivePayload });
      return toPickupMutationResponse(outcome);
    },
    [applyCommandOutcome, currentUser, effectiveMountedRef, getCurrentIdentity, pickupAvailability, pickupError, pickupErrorCode, pickupMutationState, readOperationReceipt, reconcileAuthoritativeSuccess, reconcileConflictFromBoard],
  );

  const markPickupArrived = useCallback(
    async (inputOrChildId: AnnounceArrivalInput | string, collectorId?: string): Promise<PickupMutationResponse> => {
      const input: AnnounceArrivalInput = typeof inputOrChildId === 'string'
        ? (() => {
            const matched = pickupCycles.find((c) => c.studentId === inputOrChildId);
            const activeCol = matched?.authorizedCollectors.find((c) => c.status === 'ACTIVE');
            const resolvedId = matched?.cycleId || inputOrChildId;
            return {
              cycleId: resolvedId, studentId: inputOrChildId,
              collectorId: collectorId || matched?.intendedCollectorId || activeCol?.collectorId || '',
              requestId: createPickupRequestId('arrival', resolvedId), expectedVersion: matched?.version ?? 0,
            };
          })()
        : inputOrChildId;
      return runCommand(input.cycleId, 'ARRIVAL', input, (p) => announceArrival(p as AnnounceArrivalInput));
    },
    [announceArrival, pickupCycles, runCommand],
  );

  const confirmPickupRelease = useCallback(
    async (inputOrRecordId: ConfirmReleaseInput | string): Promise<PickupMutationResponse> => {
      if (typeof inputOrRecordId === 'string' || inputOrRecordId.physicalHandoffAttested !== true || inputOrRecordId.collectorVerifiedInPerson !== true) {
        const targetId = typeof inputOrRecordId === 'string' ? inputOrRecordId : inputOrRecordId.cycleId;
        const outcome = !currentUser || !isEligible(currentUser)
          ? deniedOutcome('actor_not_authorized', 'Approved account required.')
          : pickupAvailability !== 'READY'
            ? unavailableOutcome(pickupErrorCode || PICKUP_BACKEND_UNAVAILABLE_CODE, pickupError || 'Pickup backend is unavailable.')
            : deniedOutcome('attestation_required', 'Physical handoff and collector verification must be attested.');
        if (currentUser && isEligible(currentUser)) applyCommandOutcome(targetId, outcome);
        return toPickupMutationResponse(outcome);
      }
      return runCommand(inputOrRecordId.cycleId, 'RELEASE', inputOrRecordId, (p) => confirmRelease(p as ConfirmReleaseInput));
    },
    [applyCommandOutcome, confirmRelease, currentUser, pickupAvailability, pickupError, pickupErrorCode, runCommand],
  );

  const pickupRecords: PickupRecord[] = useMemo(() => pickupCycles.map(toLegacyPickupRecord), [pickupCycles]);

  return {
    pickupCycles, pickupRecords, pickupStatus, pickupAvailability, pickupError, pickupErrorCode,
    pickupLastSyncedAt, pickupMutationState, isLoadingPickup, refreshPickupBoard, refreshPickupBoardForUser,
    verifyPickupOperationReceipt, markPickupArrived, confirmPickupRelease, clearPickupState,
    ...adminActions,
    ...earlyActions,
  };
}
