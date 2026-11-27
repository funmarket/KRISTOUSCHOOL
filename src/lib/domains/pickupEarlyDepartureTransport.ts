import { supabase } from '../supabase.ts';
import { invokeTelegramPrivateOperation } from '../telegramPrivateOperations.ts';
import type { AccountRole } from '../../types.ts';
import type {
  CompleteEarlyDepartureInput,
  EarlyDepartureCommandOutcome,
  EarlyDepartureReadResult,
  EarlyDepartureRequestRow,
  EarlyDepartureStatus,
  PickupDurableState,
  RequestEarlyDepartureInput,
  ReviewEarlyDepartureInput,
} from './pickupTypes.ts';
import {
  extractPickupErrorCode,
  isTelegramRuntime,
  mapEarlyDepartureCommandError,
  UUID_RE,
  VALID_STATES,
} from './pickupTransportErrors.ts';

const VALID_EARLY_STATUSES = new Set<EarlyDepartureStatus>([
  'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED',
]);

const EARLY_CONFLICT_CODES = new Set([
  'already_released',
  'early_departure_already_open',
  'early_departure_terminal',
  'early_departure_not_approved',
  'version_conflict',
]);

function optStr(val: unknown): string | null {
  return typeof val === 'string' && val.trim() ? val.trim() : null;
}

function parseEarlyDepartureRow(raw: unknown): EarlyDepartureRequestRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== 'string' || !r.id ||
    typeof r.studentId !== 'string' || !r.studentId ||
    typeof r.studentLabel !== 'string' ||
    typeof r.classId !== 'string' || !r.classId ||
    typeof r.classLabel !== 'string' ||
    typeof r.schoolDate !== 'string' || !r.schoolDate ||
    typeof r.collectorId !== 'string' || !r.collectorId ||
    typeof r.reason !== 'string' ||
    typeof r.status !== 'string' || !VALID_EARLY_STATUSES.has(r.status as EarlyDepartureStatus) ||
    typeof r.version !== 'number' || !Number.isInteger(r.version) || r.version < 1 ||
    typeof r.createdAt !== 'string'
  ) {
    return null;
  }
  return {
    id: r.id,
    studentId: r.studentId,
    studentLabel: r.studentLabel,
    classId: r.classId,
    classLabel: r.classLabel,
    cycleId: optStr(r.cycleId),
    schoolDate: r.schoolDate,
    collectorId: r.collectorId,
    collectorLabel: typeof r.collectorLabel === 'string' ? r.collectorLabel : '',
    reason: r.reason,
    requestedPickupAt: optStr(r.requestedPickupAt),
    status: r.status as EarlyDepartureStatus,
    version: r.version,
    requestedByLabel: optStr(r.requestedByLabel),
    reviewedByLabel: optStr(r.reviewedByLabel),
    reviewedAt: optStr(r.reviewedAt),
    reviewReason: optStr(r.reviewReason),
    releasedByLabel: optStr(r.releasedByLabel),
    completedAt: optStr(r.completedAt),
    handoffNotes: optStr(r.handoffNotes),
    createdAt: r.createdAt,
    canReview: Boolean(r.canReview),
    canComplete: Boolean(r.canComplete),
  };
}

function parseEarlyDepartureMutationJson(
  data: unknown,
  requestId: string,
  targetId: string,
): EarlyDepartureCommandOutcome {
  if (!data || typeof data !== 'object') {
    return {
      ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, targetId,
      reasonCode: 'unknown_outcome_verify_required',
      message: 'Invalid early departure response from server.',
      requiresAuthoritativeReadback: true,
    };
  }
  const res = data as Record<string, unknown>;
  if (
    res.ok === true &&
    (res.code === 'early_departure_requested' ||
      res.code === 'early_departure_approved' ||
      res.code === 'early_departure_rejected' ||
      res.code === 'early_departure_completed') &&
    typeof res.earlyDepartureId === 'string' &&
    typeof res.status === 'string' &&
    VALID_EARLY_STATUSES.has(res.status as EarlyDepartureStatus) &&
    typeof res.version === 'number'
  ) {
    const cycleState =
      typeof res.cycleState === 'string' && VALID_STATES.has(res.cycleState as PickupDurableState)
        ? (res.cycleState as PickupDurableState)
        : null;
    return {
      ok: true,
      outcome: 'SUCCESS',
      code: res.code,
      earlyDepartureId: res.earlyDepartureId,
      studentId: optStr(res.studentId),
      cycleId: optStr(res.cycleId),
      status: res.status as EarlyDepartureStatus,
      version: res.version,
      requestId: typeof res.requestId === 'string' ? res.requestId : requestId,
      cycleState,
      cycleVersion: typeof res.cycleVersion === 'number' ? res.cycleVersion : null,
      replayed: Boolean(res.replayed),
    };
  }
  if (res.ok === false && typeof res.code === 'string' && EARLY_CONFLICT_CODES.has(res.code)) {
    const serverStatus =
      typeof res.status === 'string' && VALID_EARLY_STATUSES.has(res.status as EarlyDepartureStatus)
        ? (res.status as EarlyDepartureStatus)
        : undefined;
    const serverVersion = typeof res.version === 'number' ? res.version : undefined;
    return {
      ok: false,
      outcome: 'CONFLICT',
      reasonCode: res.code as
        | 'already_released'
        | 'early_departure_already_open'
        | 'early_departure_terminal'
        | 'early_departure_not_approved'
        | 'version_conflict',
      earlyDepartureId: optStr(res.earlyDepartureId) ?? undefined,
      serverStatus,
      serverVersion,
      cycleId: optStr(res.cycleId),
      message: `Server returned ${res.code} for early departure.`,
    };
  }
  return {
    ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, targetId,
    reasonCode: 'unknown_outcome_verify_required',
    message: 'Unrecognized early departure response from server.',
    requiresAuthoritativeReadback: true,
  };
}

export async function fetchEarlyDeparturesTransport(
  options?: { role?: AccountRole | null; classId?: string | null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<EarlyDepartureReadResult> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return {
      ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [],
      lastSyncedAt: null, errorCode: 'pickup_backend_unavailable',
      errorMessage: 'Pickup backend client is unavailable.',
    };
  }
  try {
    let rawData: unknown;
    const tg = await invokeTelegramPrivateOperation<unknown[]>(
      'pickup.earlyDepartures',
      options?.classId ? { classId: options.classId } : {},
      client,
    );
    if (tg.handled) {
      rawData = tg.data;
    } else {
      if (!client || typeof client.rpc !== 'function') {
        return {
          ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [],
          lastSyncedAt: null, errorCode: 'pickup_backend_unavailable',
          errorMessage: 'Pickup backend client is unavailable.',
        };
      }
      if (options?.role === 'STUDENT' || options?.role === 'SCHOOL_STAFF') {
        return {
          ok: false, status: 'UNAUTHORIZED', availability: 'UNAUTHORIZED', records: [],
          lastSyncedAt: null, errorCode: 'actor_not_authorized',
          errorMessage: 'Role does not have early departure scope.',
        };
      }
      const rpcRes = await client.rpc(
        'get_pickup_early_departures',
        options?.classId ? { p_class_id: options.classId } : {},
      );
      if (rpcRes.error) {
        const { code, message } = extractPickupErrorCode(rpcRes.error);
        if (code === 'pickup_backend_unavailable') {
          return { ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [], lastSyncedAt: null, errorCode: 'pickup_backend_unavailable', errorMessage: message };
        }
        if (code === 'actor_unauthenticated' || code === 'actor_not_approved' || code === 'insufficient_pickup_scope') {
          return { ok: false, status: 'UNAUTHORIZED', availability: 'UNAUTHORIZED', records: [], lastSyncedAt: null, errorCode: 'actor_not_authorized', errorMessage: message };
        }
        return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: message };
      }
      rawData = rpcRes.data;
    }

    if (!Array.isArray(rawData)) {
      return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: 'Invalid early departures payload from server.' };
    }
    const mapped: EarlyDepartureRequestRow[] = [];
    for (const row of rawData) {
      const parsed = parseEarlyDepartureRow(row);
      if (!parsed) {
        return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: 'Malformed early departure row returned by server.' };
      }
      mapped.push(parsed);
    }
    return { ok: true, status: 'READY', availability: 'READY', records: mapped, lastSyncedAt: new Date().toISOString() };
  } catch (err) {
    const { code, message } = extractPickupErrorCode(err);
    if (code === 'pickup_backend_unavailable' || code === 'backend_unavailable') {
      return { ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [], lastSyncedAt: null, errorCode: 'pickup_backend_unavailable', errorMessage: message };
    }
    if (code === 'actor_unauthenticated' || code === 'actor_not_approved' || code === 'insufficient_pickup_scope') {
      return { ok: false, status: 'UNAUTHORIZED', availability: 'UNAUTHORIZED', records: [], lastSyncedAt: null, errorCode: 'actor_not_authorized', errorMessage: message };
    }
    return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: message };
  }
}

export async function requestEarlyDepartureTransport(
  input: RequestEarlyDepartureInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<EarlyDepartureCommandOutcome> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
  }
  const cleanReason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (
    !UUID_RE.test(input.studentId) ||
    !UUID_RE.test(input.collectorId) ||
    !UUID_RE.test(input.requestId) ||
    cleanReason.length < 3 ||
    cleanReason.length > 500
  ) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'invalid_pickup_request', message: 'Valid pupil, collector, request ID, and reason (3–500 chars) are required.' };
  }
  const requestedAt = optStr(input.requestedPickupAt);
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.requestEarly', {
      studentId: input.studentId,
      collectorId: input.collectorId,
      reason: cleanReason,
      requestId: input.requestId,
      ...(requestedAt ? { requestedPickupAt: requestedAt } : {}),
    }, client);
    if (tg.handled) return parseEarlyDepartureMutationJson(tg.data, input.requestId, input.studentId);
    if (!client || typeof client.rpc !== 'function') {
      return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
    }
    const { data, error } = await client.rpc('request_early_departure', {
      p_student_id: input.studentId,
      p_collector_id: input.collectorId,
      p_reason: cleanReason,
      p_request_id: input.requestId,
      ...(requestedAt ? { p_requested_pickup_at: requestedAt } : {}),
    });
    if (error) return mapEarlyDepartureCommandError(error, input.requestId, input.studentId);
    return parseEarlyDepartureMutationJson(data, input.requestId, input.studentId);
  } catch (err) {
    return mapEarlyDepartureCommandError(err, input.requestId, input.studentId);
  }
}

export async function reviewEarlyDepartureTransport(
  input: ReviewEarlyDepartureInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<EarlyDepartureCommandOutcome> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
  }
  const cleanNote = optStr(input.reviewReason);
  if (
    !UUID_RE.test(input.earlyDepartureId) ||
    !UUID_RE.test(input.requestId) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    (input.decision !== 'APPROVED' && input.decision !== 'REJECTED') ||
    (input.decision === 'REJECTED' && (!cleanNote || cleanNote.length < 3 || cleanNote.length > 500)) ||
    (cleanNote && cleanNote.length > 500)
  ) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'invalid_pickup_request', message: 'Invalid early departure review parameters.' };
  }
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.reviewEarly', {
      earlyDepartureId: input.earlyDepartureId,
      decision: input.decision,
      requestId: input.requestId,
      expectedVersion: input.expectedVersion,
      ...(cleanNote ? { reviewReason: cleanNote } : {}),
    }, client);
    if (tg.handled) return parseEarlyDepartureMutationJson(tg.data, input.requestId, input.earlyDepartureId);
    if (!client || typeof client.rpc !== 'function') {
      return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
    }
    const { data, error } = await client.rpc('review_early_departure', {
      p_early_departure_id: input.earlyDepartureId,
      p_decision: input.decision,
      p_request_id: input.requestId,
      p_expected_version: input.expectedVersion,
      ...(cleanNote ? { p_review_reason: cleanNote } : {}),
    });
    if (error) return mapEarlyDepartureCommandError(error, input.requestId, input.earlyDepartureId);
    return parseEarlyDepartureMutationJson(data, input.requestId, input.earlyDepartureId);
  } catch (err) {
    return mapEarlyDepartureCommandError(err, input.requestId, input.earlyDepartureId);
  }
}

export async function completeEarlyDepartureReleaseTransport(
  input: CompleteEarlyDepartureInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<EarlyDepartureCommandOutcome> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
  }
  if (input.inPersonVerified !== true) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'attestation_required', message: 'In-person collector verification is required.' };
  }
  const cleanNotes = optStr(input.handoffNotes);
  if (
    !UUID_RE.test(input.earlyDepartureId) ||
    !UUID_RE.test(input.collectorId) ||
    !UUID_RE.test(input.requestId) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    (cleanNotes && cleanNotes.length > 500)
  ) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'invalid_pickup_request', message: 'Invalid early departure release parameters.' };
  }
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.completeEarly', {
      earlyDepartureId: input.earlyDepartureId,
      collectorId: input.collectorId,
      requestId: input.requestId,
      expectedVersion: input.expectedVersion,
      inPersonVerified: true,
      ...(cleanNotes ? { handoffNotes: cleanNotes } : {}),
    }, client);
    if (tg.handled) return parseEarlyDepartureMutationJson(tg.data, input.requestId, input.earlyDepartureId);
    if (!client || typeof client.rpc !== 'function') {
      return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
    }
    const { data, error } = await client.rpc('complete_early_departure_release', {
      p_early_departure_id: input.earlyDepartureId,
      p_collector_id: input.collectorId,
      p_request_id: input.requestId,
      p_expected_version: input.expectedVersion,
      p_in_person_verified: true,
      ...(cleanNotes ? { p_handoff_notes: cleanNotes } : {}),
    });
    if (error) return mapEarlyDepartureCommandError(error, input.requestId, input.earlyDepartureId);
    return parseEarlyDepartureMutationJson(data, input.requestId, input.earlyDepartureId);
  } catch (err) {
    return mapEarlyDepartureCommandError(err, input.requestId, input.earlyDepartureId);
  }
}

export async function readEarlyDepartureReceiptTransport(
  requestId: string,
  targetId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<EarlyDepartureCommandOutcome> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup receipt lookup backend client is unavailable.', retryable: true };
  }
  if (!UUID_RE.test(requestId)) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'invalid_pickup_request', message: 'Invalid early departure receipt request ID.' };
  }
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.receipt', { requestId }, client);
    let data: unknown;
    if (tg.handled) {
      data = tg.data;
    } else {
      if (!client || typeof client.rpc !== 'function') {
        return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup receipt lookup backend client is unavailable.', retryable: true };
      }
      const res = await client.rpc('get_pickup_operation_receipt', { p_request_id: requestId });
      if (res.error) return mapEarlyDepartureCommandError(res.error, requestId, targetId);
      data = res.data;
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, targetId, reasonCode: 'unknown_outcome_verify_required', message: 'Invalid operation receipt response.', requiresAuthoritativeReadback: true };
    }
    const obj = data as Record<string, unknown>;
    if (obj.found === false || !obj.result || typeof obj.result !== 'object') {
      return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, targetId, reasonCode: 'unknown_outcome_verify_required', message: 'Operation receipt not found on server yet.', requiresAuthoritativeReadback: true };
    }
    return parseEarlyDepartureMutationJson(obj.result, requestId, targetId);
  } catch (err) {
    return mapEarlyDepartureCommandError(err, requestId, targetId);
  }
}
