import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { BackendOpStatus, User } from '../types.ts';
import { isMatchingApprovedAccountContext, type AccountIdentityContext } from '../lib/appStateGuards.ts';
import {
  announcePickupArrival as defaultAnnouncePickupArrival,
  confirmPickupRelease as defaultConfirmPickupRelease,
  createPickupRequestId,
  fetchPickupBoardCycles as defaultFetchPickupBoardCycles,
  PICKUP_BACKEND_UNAVAILABLE_CODE,
  readPickupOperationReceipt as defaultReadPickupOperationReceipt,
  toLegacyPickupRecord,
  type AnnounceArrivalInput,
  type ConfirmReleaseInput,
  type PickupAvailabilityStatus,
  type PickupCommandOutcome,
  type PickupCycleRecord,
  type PickupMutationEntry,
  type PickupNotificationDeliveryStatus,
  type PickupReadResult,
  type PickupReasonCode,
  type PickupRecord,
} from '../lib/domains/pickup.ts';

export interface PickupMutationResponse {
  success: boolean;
  status: BackendOpStatus;
  outcome: PickupCommandOutcome['outcome'];
  error?: string;
  errorCode?: PickupReasonCode;
  commandOutcome: PickupCommandOutcome;
}

export interface UsePickupStateAdapters {
  fetchCycles?: () => Promise<PickupReadResult>;
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

function toMutationResponse(outcome: PickupCommandOutcome): PickupMutationResponse {
  const status: BackendOpStatus = outcome.ok
    ? 'READY'
    : outcome.outcome === 'DENIED'
      ? 'UNAUTHORIZED'
      : outcome.outcome === 'UNAVAILABLE' && outcome.reasonCode === PICKUP_BACKEND_UNAVAILABLE_CODE
        ? 'BLOCKED_BACKEND'
        : 'ERROR';
  return {
    success: outcome.ok,
    status,
    outcome: outcome.outcome,
    error: outcome.ok ? undefined : outcome.reasonCode,
    errorCode: outcome.ok ? undefined : outcome.reasonCode,
    commandOutcome: outcome,
  };
}

const deniedOutcome = (reasonCode: PickupReasonCode, message: string): PickupCommandOutcome =>
  ({ ok: false, outcome: 'DENIED', reasonCode, message });

const unavailableOutcome = (reasonCode: PickupReasonCode, message: string): PickupCommandOutcome =>
  ({ ok: false, outcome: 'UNAVAILABLE', reasonCode, message, retryable: true });

const unknownOutcomeFor = (requestId: string, cycleId: string, message: string): PickupCommandOutcome => ({
  ok: false,
  outcome: 'UNKNOWN_OUTCOME',
  requestId,
  cycleId,
  reasonCode: 'unknown_outcome_verify_required',
  message,
  requiresAuthoritativeReadback: true,
});

function deriveSuccessDeliveryStatus(outboxEnqueued: boolean, record?: PickupCycleRecord): PickupNotificationDeliveryStatus {
  if (record?.outboxStatus === 'DELIVERED') return 'DELIVERED';
  if (record?.outboxStatus === 'PENDING_RETRY') return 'RETRYING';
  if (record?.outboxStatus === 'FAILED') return 'UNAVAILABLE';
  return outboxEnqueued ? 'QUEUED' : 'UNAVAILABLE';
}

function hasCommittedTransition(record: PickupCycleRecord | undefined, cycleId: string, op: 'ARRIVAL' | 'RELEASE'): record is PickupCycleRecord {
  if (!record || record.cycleId !== cycleId) return false;
  return op === 'ARRIVAL' ? (record.state === 'PARENT_ARRIVED' || record.state === 'RELEASED') : record.state === 'RELEASED';
}

function hasServerSupersededPending(records: PickupCycleRecord[], cycleId: string, entry: PickupMutationEntry): boolean {
  if (entry.status !== 'UNKNOWN_OUTCOME' || !entry.payload) return false;
  const serverCycle = records.find((r) => r.cycleId === cycleId);
  if (!serverCycle) return false;
  if (serverCycle.version > entry.payload.expectedVersion) return true;
  if (entry.operation === 'ARRIVAL') return serverCycle.state === 'PARENT_ARRIVED' || serverCycle.state === 'RELEASED';
  return entry.operation === 'RELEASE' ? serverCycle.state === 'RELEASED' : false;
}

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

  useEffect(() => {
    if (mountedRef) return;
    internalMountedRef.current = true;
    return () => { internalMountedRef.current = false; };
  }, [mountedRef]);

  const clearPickupState = useCallback(() => {
    readReqGenRef.current += 1;
    setPickupCycles([]);
    setPickupStatus('BLOCKED_BACKEND');
    setPickupAvailability('UNAVAILABLE');
    setPickupError(null);
    setPickupErrorCode(PICKUP_BACKEND_UNAVAILABLE_CODE);
    setPickupLastSyncedAt(null);
    setPickupMutationState({});
    setIsLoadingPickup(false);
  }, []);

  const lastIdentityGenRef = useRef<number>(identityContext.generation);
  useEffect(() => {
    if (lastIdentityGenRef.current !== identityContext.generation || !isEligible(currentUser)) {
      lastIdentityGenRef.current = identityContext.generation;
      clearPickupState();
    }
  }, [clearPickupState, currentUser, identityContext.generation]);

  const refreshPickupBoard = useCallback(async (): Promise<PickupReadResult> => {
    const origin = getCurrentIdentity();
    if (!currentUser || !isEligible(currentUser)) {
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
    try {
      const res = await fetchCycles();
      const stillValid = reqGen === readReqGenRef.current && isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current);
      if (!stillValid) {
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
  }, [currentUser, effectiveMountedRef, fetchCycles, getCurrentIdentity]);

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
        upsertCycle(outcome.serverRecord);
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
      setPickupMutationState((prev) => ({
        ...prev,
        [targetKey]: { status: outcome.outcome === 'DENIED' ? 'DENIED' : 'UNAVAILABLE', reasonCode: outcome.reasonCode, message: outcome.message },
      }));
    },
    [effectiveMountedRef],
  );

  const reconcileAuthoritativeSuccess = useCallback(
    async (
      cycleId: string,
      operation: 'ARRIVAL' | 'RELEASE',
      payload: PickupCommandPayload,
      outcome: Extract<PickupCommandOutcome, { ok: true }>,
      origin: AccountIdentityContext,
    ): Promise<PickupCommandOutcome> => {
      if (hasCommittedTransition(outcome.updatedRecord, cycleId, operation)) return outcome;

      try {
        const receipt = await readOperationReceipt(payload.requestId, cycleId);
        if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return deniedOutcome('session_changed', 'Account session changed.');
        if (receipt.ok && hasCommittedTransition(receipt.updatedRecord, cycleId, operation)) return receipt;
        if (!receipt.ok && (receipt.outcome === 'CONFLICT' || receipt.outcome === 'DENIED')) return receipt;
      } catch {
        // Fall through to board readback verification.
      }

      try {
        const board = await fetchCycles();
        if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return deniedOutcome('session_changed', 'Account session changed.');
        if (board.ok && board.availability === 'READY') {
          const matched = board.records.find((r) => r.cycleId === cycleId);
          if (hasCommittedTransition(matched, cycleId, operation)) {
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
    if (!currentUser || !isEligible(currentUser)) return toMutationResponse(deniedOutcome('actor_not_authorized', 'Approved account required.'));
    const existing = pickupMutationState[cycleId];
    if (!existing || existing.status !== 'UNKNOWN_OUTCOME' || !existing.requestId || !existing.payload || !existing.operation) {
      return toMutationResponse(unknownOutcomeFor(existing?.requestId || '', cycleId, 'No pending unconfirmed operation to verify.'));
    }
    const origin = getCurrentIdentity();
    let outcome: PickupCommandOutcome;
    try {
      const receipt = await readOperationReceipt(existing.requestId, cycleId);
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
      if (receipt.ok) outcome = await reconcileAuthoritativeSuccess(cycleId, existing.operation, existing.payload, receipt, origin);
      else if (receipt.outcome === 'CONFLICT' || receipt.outcome === 'DENIED') outcome = receipt;
      else outcome = unknownOutcomeFor(existing.requestId, cycleId, receipt.message || 'Outcome still unconfirmed on server.');
    } catch (err) {
      outcome = unknownOutcomeFor(existing.requestId, cycleId, err instanceof Error ? err.message : 'Receipt verification failed.');
    }
    if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
    applyCommandOutcome(cycleId, outcome, { operation: existing.operation, payload: existing.payload });
    return toMutationResponse(outcome);
  }, [applyCommandOutcome, currentUser, effectiveMountedRef, getCurrentIdentity, pickupMutationState, readOperationReceipt, reconcileAuthoritativeSuccess]);

  const runCommand = useCallback(
    async (
      cycleId: string,
      operation: 'ARRIVAL' | 'RELEASE',
      payload: PickupCommandPayload,
      execute: (effectivePayload: PickupCommandPayload) => Promise<PickupCommandOutcome>,
    ): Promise<PickupMutationResponse> => {
      if (!currentUser || !isEligible(currentUser)) return toMutationResponse(deniedOutcome('actor_not_authorized', 'Approved account required.'));
      if (pickupAvailability !== 'READY') {
        const unavailable = unavailableOutcome(pickupErrorCode || PICKUP_BACKEND_UNAVAILABLE_CODE, pickupError || 'Pickup backend is unavailable.');
        applyCommandOutcome(cycleId, unavailable);
        return toMutationResponse(unavailable);
      }

      const origin = getCurrentIdentity();
      let effectivePayload = payload;
      const existing = pickupMutationState[cycleId];
      if (existing?.status === 'UNKNOWN_OUTCOME') {
        if (!existing.requestId || payload.requestId !== existing.requestId) {
          return toMutationResponse(unknownOutcomeFor(existing.requestId || payload.requestId, cycleId, 'Verify or retry the pending request before submitting a new request.'));
        }
        effectivePayload = existing.payload ?? payload;
        try {
          const receipt = await readOperationReceipt(existing.requestId, cycleId);
          if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
          if (receipt.ok || receipt.outcome === 'CONFLICT' || receipt.outcome === 'DENIED') {
            const resolved = receipt.ok ? await reconcileAuthoritativeSuccess(cycleId, operation, effectivePayload, receipt, origin) : receipt;
            applyCommandOutcome(cycleId, resolved, { operation, payload: effectivePayload });
            return toMutationResponse(resolved);
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
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) return toMutationResponse(deniedOutcome('session_changed', 'Account session changed.'));
      if (outcome.ok) outcome = await reconcileAuthoritativeSuccess(cycleId, operation, effectivePayload, outcome, origin);
      applyCommandOutcome(cycleId, outcome, { operation, payload: effectivePayload });
      return toMutationResponse(outcome);
    },
    [applyCommandOutcome, currentUser, effectiveMountedRef, getCurrentIdentity, pickupAvailability, pickupError, pickupErrorCode, pickupMutationState, readOperationReceipt, reconcileAuthoritativeSuccess],
  );

  const markPickupArrived = useCallback(
    async (inputOrChildId: AnnounceArrivalInput | string, collectorId?: string): Promise<PickupMutationResponse> => {
      const input: AnnounceArrivalInput =
        typeof inputOrChildId === 'string'
          ? (() => {
              const matched = pickupCycles.find((c) => c.studentId === inputOrChildId);
              const activeCol = matched?.authorizedCollectors.find((c) => c.status === 'ACTIVE');
              const resolvedId = matched?.cycleId || inputOrChildId;
              return {
                cycleId: resolvedId,
                studentId: inputOrChildId,
                collectorId: collectorId || matched?.intendedCollectorId || activeCol?.collectorId || '',
                requestId: createPickupRequestId('arrival', resolvedId),
                expectedVersion: matched?.version ?? 0,
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
        const outcome =
          !currentUser || !isEligible(currentUser)
            ? deniedOutcome('actor_not_authorized', 'Approved account required.')
            : pickupAvailability !== 'READY'
              ? unavailableOutcome(pickupErrorCode || PICKUP_BACKEND_UNAVAILABLE_CODE, pickupError || 'Pickup backend is unavailable.')
              : deniedOutcome('handoff_attestation_required', 'Physical handoff and collector verification must be attested.');
        if (currentUser && isEligible(currentUser)) applyCommandOutcome(targetId, outcome);
        return toMutationResponse(outcome);
      }
      return runCommand(inputOrRecordId.cycleId, 'RELEASE', inputOrRecordId, (p) => confirmRelease(p as ConfirmReleaseInput));
    },
    [applyCommandOutcome, confirmRelease, currentUser, pickupAvailability, pickupError, pickupErrorCode, runCommand],
  );

  const pickupRecords: PickupRecord[] = useMemo(() => pickupCycles.map(toLegacyPickupRecord), [pickupCycles]);

  return {
    pickupCycles, pickupRecords, pickupStatus, pickupAvailability, pickupError, pickupErrorCode,
    pickupLastSyncedAt, pickupMutationState, isLoadingPickup, refreshPickupBoard,
    verifyPickupOperationReceipt, markPickupArrived, confirmPickupRelease, clearPickupState,
  };
}
