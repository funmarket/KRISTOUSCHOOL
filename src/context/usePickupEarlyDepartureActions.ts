import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { AccountRole, BackendOpStatus, User } from '../types.ts';
import { isMatchingApprovedAccountContext, type AccountIdentityContext } from '../lib/appStateGuards.ts';
import {
  completeEarlyDepartureRelease as defaultCompleteEarlyDeparture,
  fetchEarlyDepartures as defaultFetchEarlyDepartures,
  PICKUP_BACKEND_UNAVAILABLE_CODE,
  readEarlyDepartureReceipt as defaultReadEarlyReceipt,
  requestEarlyDeparture as defaultRequestEarlyDeparture,
  reviewEarlyDeparture as defaultReviewEarlyDeparture,
  type CompleteEarlyDepartureInput,
  type EarlyDepartureCommandOutcome,
  type EarlyDepartureMutationEntry,
  type EarlyDepartureReadResult,
  type EarlyDepartureRequestRow,
  type PickupAvailabilityStatus,
  type PickupReadResult,
  type PickupReasonCode,
  type RequestEarlyDepartureInput,
  type ReviewEarlyDepartureInput,
} from '../lib/domains/pickup.ts';

export interface EarlyDepartureMutationResponse {
  success: boolean;
  status: BackendOpStatus;
  outcome: EarlyDepartureCommandOutcome['outcome'];
  error?: string;
  errorCode?: PickupReasonCode;
  commandOutcome: EarlyDepartureCommandOutcome;
}

export interface UsePickupEarlyDepartureAdapters {
  fetchEarlyDepartures?: (options?: { role?: AccountRole | null; classId?: string | null }) => Promise<EarlyDepartureReadResult>;
  requestEarlyDeparture?: (input: RequestEarlyDepartureInput) => Promise<EarlyDepartureCommandOutcome>;
  reviewEarlyDeparture?: (input: ReviewEarlyDepartureInput) => Promise<EarlyDepartureCommandOutcome>;
  completeEarlyDepartureRelease?: (input: CompleteEarlyDepartureInput) => Promise<EarlyDepartureCommandOutcome>;
  readEarlyDepartureReceipt?: (requestId: string, targetId: string) => Promise<EarlyDepartureCommandOutcome>;
}

const isEligible = (user: User | null | undefined): boolean =>
  Boolean(user && user.accountStatus === 'APPROVED' && user.role !== 'STUDENT');

function toResponse(outcome: EarlyDepartureCommandOutcome): EarlyDepartureMutationResponse {
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

export function usePickupEarlyDepartureActions(params: {
  currentUser: User | null;
  getCurrentIdentity: () => AccountIdentityContext;
  effectiveMountedRef: React.MutableRefObject<boolean>;
  refreshPickupBoardForUser: (targetUser: User | null | undefined, classId?: string | null) => Promise<PickupReadResult>;
  adapters?: UsePickupEarlyDepartureAdapters;
}) {
  const { currentUser, getCurrentIdentity, effectiveMountedRef, refreshPickupBoardForUser, adapters } = params;
  const fetchFn = adapters?.fetchEarlyDepartures ?? defaultFetchEarlyDepartures;
  const requestFn = adapters?.requestEarlyDeparture ?? defaultRequestEarlyDeparture;
  const reviewFn = adapters?.reviewEarlyDeparture ?? defaultReviewEarlyDeparture;
  const completeFn = adapters?.completeEarlyDepartureRelease ?? defaultCompleteEarlyDeparture;
  const receiptFn = adapters?.readEarlyDepartureReceipt ?? defaultReadEarlyReceipt;

  const [earlyDepartures, setEarlyDepartures] = useState<EarlyDepartureRequestRow[]>([]);
  const [earlyDeparturesStatus, setEarlyDeparturesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [earlyDeparturesAvailability, setEarlyDeparturesAvailability] = useState<PickupAvailabilityStatus>('UNAVAILABLE');
  const [earlyDeparturesError, setEarlyDeparturesError] = useState<string | null>(null);
  const [isLoadingEarlyDepartures, setIsLoadingEarlyDepartures] = useState<boolean>(false);
  const [earlyDepartureMutationState, setEarlyDepartureMutationState] = useState<Record<string, EarlyDepartureMutationEntry>>({});
  const [earlyDepartureRevoked, setEarlyDepartureRevoked] = useState<boolean>(false);

  const readGenRef = useRef<number>(0);

  const clearEarlyDepartureState = useCallback(() => {
    readGenRef.current += 1;
    setEarlyDepartures([]);
    setEarlyDeparturesStatus('BLOCKED_BACKEND');
    setEarlyDeparturesAvailability('UNAVAILABLE');
    setEarlyDeparturesError(null);
    setIsLoadingEarlyDepartures(false);
    setEarlyDepartureMutationState({});
    setEarlyDepartureRevoked(false);
  }, []);

  const refreshEarlyDeparturesForUser = useCallback(
    async (targetUser: User | null | undefined, classId?: string | null): Promise<EarlyDepartureReadResult> => {
      const origin = getCurrentIdentity();
      if (!targetUser || !isEligible(targetUser) || targetUser.role === 'SCHOOL_STAFF') {
        const denied: EarlyDepartureReadResult = {
          ok: false, status: 'UNAUTHORIZED', availability: 'UNAUTHORIZED', records: [],
          lastSyncedAt: null, errorCode: 'actor_not_authorized', errorMessage: 'Early departure scope unavailable.',
        };
        if (effectiveMountedRef.current) {
          setEarlyDepartures([]);
          setEarlyDeparturesStatus('UNAUTHORIZED');
          setEarlyDeparturesAvailability('UNAUTHORIZED');
          setEarlyDeparturesError(denied.errorMessage ?? null);
        }
        return denied;
      }
      const gen = ++readGenRef.current;
      if (effectiveMountedRef.current) setIsLoadingEarlyDepartures(true);
      try {
        const res = await fetchFn({ role: targetUser.role, classId: classId ?? null });
        if (gen !== readGenRef.current || !isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
          return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'session_changed', errorMessage: 'Account session changed.' };
        }
        setEarlyDeparturesStatus(res.status);
        setEarlyDeparturesAvailability(res.availability);
        setEarlyDeparturesError(res.ok ? null : res.errorMessage ?? null);
        if (res.ok && res.availability === 'READY') {
          setEarlyDepartures(res.records);
        } else if (res.availability === 'UNAUTHORIZED') {
          setEarlyDepartures([]);
        }
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to refresh early departures.';
        if (gen === readGenRef.current && effectiveMountedRef.current) {
          setEarlyDeparturesStatus('ERROR');
          setEarlyDeparturesAvailability('ERROR');
          setEarlyDeparturesError(message);
        }
        return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: message };
      } finally {
        if (gen === readGenRef.current && effectiveMountedRef.current) setIsLoadingEarlyDepartures(false);
      }
    },
    [effectiveMountedRef, fetchFn, getCurrentIdentity],
  );

  const refreshEarlyDepartures = useCallback(
    (classId?: string | null) => refreshEarlyDeparturesForUser(currentUser, classId),
    [currentUser, refreshEarlyDeparturesForUser],
  );

  const applyOutcome = useCallback(
    (
      targetKey: string,
      outcome: EarlyDepartureCommandOutcome,
      ctx?: { operation: 'REQUEST' | 'REVIEW' | 'COMPLETE'; payload: RequestEarlyDepartureInput | ReviewEarlyDepartureInput | CompleteEarlyDepartureInput },
    ) => {
      if (!effectiveMountedRef.current) return;
      if (outcome.ok) {
        setEarlyDepartureMutationState((prev) => ({
          ...prev,
          [targetKey]: { status: 'IDLE', requestId: outcome.requestId },
        }));
        return;
      }
      if (outcome.outcome === 'UNKNOWN_OUTCOME') {
        setEarlyDepartureMutationState((prev) => ({
          ...prev,
          [targetKey]: {
            status: 'UNKNOWN_OUTCOME',
            requestId: outcome.requestId,
            operation: ctx?.operation ?? prev[targetKey]?.operation,
            payload: ctx?.payload ?? prev[targetKey]?.payload,
            reasonCode: outcome.reasonCode,
            message: outcome.message,
          },
        }));
        return;
      }
      if (outcome.outcome === 'DENIED' && outcome.reasonCode === 'pickup_release_authority_revoked') {
        setEarlyDepartureRevoked(true);
      }
      setEarlyDepartureMutationState((prev) => ({
        ...prev,
        [targetKey]: {
          status: outcome.outcome === 'CONFLICT' ? 'CONFLICT' : outcome.outcome === 'DENIED' ? 'DENIED' : 'UNAVAILABLE',
          reasonCode: outcome.reasonCode,
          message: outcome.message,
        },
      }));
    },
    [effectiveMountedRef],
  );

  const runMutation = useCallback(
    async (
      targetKey: string,
      operation: 'REQUEST' | 'REVIEW' | 'COMPLETE',
      payload: RequestEarlyDepartureInput | ReviewEarlyDepartureInput | CompleteEarlyDepartureInput,
      execute: () => Promise<EarlyDepartureCommandOutcome>,
    ): Promise<EarlyDepartureMutationResponse> => {
      if (!currentUser || !isEligible(currentUser)) {
        return toResponse({ ok: false, outcome: 'DENIED', reasonCode: 'actor_not_authorized', message: 'Approved account required.' });
      }
      const origin = getCurrentIdentity();
      if (effectiveMountedRef.current) {
        setEarlyDepartureMutationState((prev) => ({
          ...prev,
          [targetKey]: { status: 'SUBMITTING', requestId: payload.requestId, operation, payload },
        }));
      }
      let outcome: EarlyDepartureCommandOutcome;
      try {
        outcome = await execute();
      } catch (err) {
        outcome = {
          ok: false, outcome: 'UNKNOWN_OUTCOME', requestId: payload.requestId, targetId: targetKey,
          reasonCode: 'unknown_outcome_verify_required',
          message: err instanceof Error && err.message ? err.message : 'Request failed before server confirmation.',
          requiresAuthoritativeReadback: true,
        };
      }
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
        return toResponse({ ok: false, outcome: 'DENIED', reasonCode: 'session_changed', message: 'Account session changed.' });
      }
      if (!outcome.ok && outcome.outcome === 'UNKNOWN_OUTCOME') {
        try {
          const receipt = await receiptFn(payload.requestId, targetKey);
          if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
            return toResponse({ ok: false, outcome: 'DENIED', reasonCode: 'session_changed', message: 'Account session changed.' });
          }
          if (receipt.ok || receipt.outcome === 'CONFLICT' || receipt.outcome === 'DENIED') {
            outcome = receipt;
          }
        } catch {
          // Keep UNKNOWN_OUTCOME with requestId for explicit retry/verify.
        }
      }
      applyOutcome(targetKey, outcome, { operation, payload });
      if (outcome.ok || outcome.outcome === 'CONFLICT') {
        await Promise.all([
          refreshEarlyDeparturesForUser(currentUser),
          refreshPickupBoardForUser(currentUser),
        ]);
      }
      return toResponse(outcome);
    },
    [applyOutcome, currentUser, effectiveMountedRef, getCurrentIdentity, receiptFn, refreshEarlyDeparturesForUser, refreshPickupBoardForUser],
  );

  const submitEarlyDepartureRequest = useCallback(
    (input: RequestEarlyDepartureInput) => runMutation(input.studentId, 'REQUEST', input, () => requestFn(input)),
    [requestFn, runMutation],
  );

  const reviewEarlyDepartureRequest = useCallback(
    (input: ReviewEarlyDepartureInput) => runMutation(input.earlyDepartureId, 'REVIEW', input, () => reviewFn(input)),
    [reviewFn, runMutation],
  );

  const completeEarlyDepartureRelease = useCallback(
    (input: CompleteEarlyDepartureInput) => runMutation(input.earlyDepartureId, 'COMPLETE', input, () => completeFn(input)),
    [completeFn, runMutation],
  );

  const verifyEarlyDepartureReceipt = useCallback(
    async (targetKey: string): Promise<EarlyDepartureMutationResponse> => {
      if (!currentUser || !isEligible(currentUser)) {
        return toResponse({ ok: false, outcome: 'DENIED', reasonCode: 'actor_not_authorized', message: 'Approved account required.' });
      }
      const existing = earlyDepartureMutationState[targetKey];
      if (!existing || existing.status !== 'UNKNOWN_OUTCOME' || !existing.requestId || !existing.operation || !existing.payload) {
        return toResponse({
          ok: false, outcome: 'UNKNOWN_OUTCOME', requestId: existing?.requestId || '', targetId: targetKey,
          reasonCode: 'unknown_outcome_verify_required', message: 'No pending early departure operation to verify.', requiresAuthoritativeReadback: true,
        });
      }
      const origin = getCurrentIdentity();
      let outcome: EarlyDepartureCommandOutcome;
      try {
        outcome = await receiptFn(existing.requestId, targetKey);
      } catch (err) {
        outcome = {
          ok: false, outcome: 'UNKNOWN_OUTCOME', requestId: existing.requestId, targetId: targetKey,
          reasonCode: 'unknown_outcome_verify_required',
          message: err instanceof Error ? err.message : 'Receipt verification failed.', requiresAuthoritativeReadback: true,
        };
      }
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
        return toResponse({ ok: false, outcome: 'DENIED', reasonCode: 'session_changed', message: 'Account session changed.' });
      }
      applyOutcome(targetKey, outcome, { operation: existing.operation, payload: existing.payload });
      if (outcome.ok || outcome.outcome === 'CONFLICT') {
        await Promise.all([refreshEarlyDeparturesForUser(currentUser), refreshPickupBoardForUser(currentUser)]);
      }
      return toResponse(outcome);
    },
    [applyOutcome, currentUser, earlyDepartureMutationState, effectiveMountedRef, getCurrentIdentity, receiptFn, refreshEarlyDeparturesForUser, refreshPickupBoardForUser],
  );

  return useMemo(
    () => ({
      earlyDepartures,
      earlyDeparturesStatus,
      earlyDeparturesAvailability,
      earlyDeparturesError,
      isLoadingEarlyDepartures,
      earlyDepartureMutationState,
      earlyDepartureRevoked,
      refreshEarlyDeparturesForUser,
      refreshEarlyDepartures,
      submitEarlyDepartureRequest,
      reviewEarlyDepartureRequest,
      completeEarlyDepartureRelease,
      verifyEarlyDepartureReceipt,
      clearEarlyDepartureState,
    }),
    [
      clearEarlyDepartureState,
      completeEarlyDepartureRelease,
      earlyDepartureMutationState,
      earlyDepartureRevoked,
      earlyDepartures,
      earlyDeparturesAvailability,
      earlyDeparturesError,
      earlyDeparturesStatus,
      isLoadingEarlyDepartures,
      refreshEarlyDepartures,
      refreshEarlyDeparturesForUser,
      reviewEarlyDepartureRequest,
      submitEarlyDepartureRequest,
      verifyEarlyDepartureReceipt,
    ],
  );
}
