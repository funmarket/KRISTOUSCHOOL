import { supabase } from '../supabase.ts';
import { invokeTelegramPrivateOperation } from '../telegramPrivateOperations.ts';
import type { Database } from '../database.types.ts';
import type { AccountRole } from '../../types.ts';
import type {
  AnnounceArrivalInput,
  ConfirmReleaseInput,
  PickupAttendanceEligibility,
  PickupAuthorizedCollectorSummary,
  PickupCommandOutcome,
  PickupCycleRecord,
  PickupDurableState,
  PickupReadResult,
  PickupReasonCode,
  PickupWindowStatus,
} from './pickupTypes.ts';
import {
  extractPickupErrorCode,
  isTelegramRuntime,
  mapPickupCommandError,
  UUID_RE,
  VALID_STATES,
} from './pickupTransportErrors.ts';
import { fetchAuthorizedPickupCollectorsTransport } from './pickupAdminTransport.ts';

type ParentBoardRow = Database['public']['Functions']['get_pickup_parent_board']['Returns'][number];
const tunisClockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const UNAVAILABLE_ELIGIBILITY_CODES = new Set([
  'student_unavailable', 'conflicting_effective_memberships', 'effective_membership_missing',
  'responsible_teacher_unavailable', 'conflicting_registers', 'register_missing', 'register_not_submitted',
  'attendance_entry_missing_or_conflicting', 'attendance_mark_missing', 'attendance_mark_unknown', 'eligibility_unavailable',
]);

function formatTunisClock(isoTimestamp: string | null | undefined): string | null {
  if (!isoTimestamp) return null;
  const parsed = new Date(isoTimestamp);
  return Number.isNaN(parsed.getTime()) ? null : tunisClockFmt.format(parsed);
}

function parseWindowMeta(row: ParentBoardRow, nowMs: number): { windowLabel: string | null; windowStatus: PickupWindowStatus } {
  if (!row.schedule_available) return { windowLabel: null, windowStatus: 'UNAVAILABLE' };
  const sClock = formatTunisClock(row.window_start);
  const eClock = formatTunisClock(row.window_end);
  const windowLabel = sClock && eClock ? `${sClock} - ${eClock}` : null;
  if (row.can_announce_arrival) return { windowLabel, windowStatus: 'OPEN' };
  const startMs = row.window_start ? Date.parse(row.window_start) : Number.NaN;
  const endMs = row.window_end ? Date.parse(row.window_end) : Number.NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return { windowLabel, windowStatus: 'UNAVAILABLE' };
  if (nowMs < startMs) return { windowLabel, windowStatus: 'NOT_STARTED' };
  if (nowMs >= endMs) return { windowLabel, windowStatus: 'CLOSED' };
  return { windowLabel, windowStatus: 'OPEN' };
}

function parseCollectors(raw: unknown): PickupAuthorizedCollectorSummary[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PickupAuthorizedCollectorSummary[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || !obj.id || typeof obj.displayName !== 'string' || !obj.displayName) return null;
    out.push({
      collectorId: obj.id,
      fullName: obj.displayName,
      relationshipLabel: typeof obj.relationshipLabel === 'string' ? obj.relationshipLabel : '',
      status: 'ACTIVE',
    });
  }
  return out;
}

function mapAttendanceReason(raw: string): PickupReasonCode | null {
  if (raw === 'attendance_absent' || raw === 'attendance_excused') return raw;
  if (raw === 'register_missing' || raw === 'register_not_submitted' || raw === 'conflicting_registers') return raw;
  if (raw === 'attendance_mark_missing' || raw === 'attendance_mark_unknown' || raw === 'attendance_entry_missing_or_conflicting') return raw;
  if (raw === 'conflicting_effective_memberships' || raw === 'responsible_teacher_unavailable') return raw;
  return UNAVAILABLE_ELIGIBILITY_CODES.has(raw) ? 'attendance_unavailable' : null;
}

function mapBoardRow(raw: unknown, syncedAt: string, nowMs: number): PickupCycleRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.cycle_id !== 'string' || !r.cycle_id || typeof r.student_id !== 'string' || !r.student_id ||
      typeof r.student_label !== 'string' || typeof r.class_id !== 'string' || typeof r.class_label !== 'string' ||
      typeof r.school_date !== 'string' || typeof r.state !== 'string' || !VALID_STATES.has(r.state as PickupDurableState) ||
      typeof r.version !== 'number' || !Number.isInteger(r.version) || r.version < 1 || typeof r.eligible !== 'boolean') {
    return null;
  }
  const collectors = parseCollectors(r.collectors);
  if (!collectors) return null;

  const row = r as unknown as ParentBoardRow;
  const reasonRaw = typeof row.eligibility_reason === 'string' ? row.eligibility_reason : 'eligibility_unavailable';
  const attendanceEligibility: PickupAttendanceEligibility = row.eligible
    ? 'ELIGIBLE'
    : UNAVAILABLE_ELIGIBILITY_CODES.has(reasonRaw)
      ? 'UNAVAILABLE'
      : 'INELIGIBLE';
  const { windowLabel, windowStatus } = parseWindowMeta(row, nowMs);
  const collectorLabel = typeof row.collector_label === 'string' && row.collector_label.trim() ? row.collector_label.trim() : null;
  const matchedCollector = collectorLabel ? collectors.find((c) => c.fullName === collectorLabel) : undefined;

  return {
    cycleId: row.cycle_id,
    studentId: row.student_id,
    studentName: row.student_label,
    studentPhotoUrl: null,
    classId: row.class_id,
    className: row.class_label,
    schoolDate: row.school_date,
    windowId: row.schedule_available ? `${row.class_id}:${row.school_date}` : null,
    windowLabel,
    windowStart: row.window_start ?? null,
    windowEnd: row.window_end ?? null,
    windowStatus,
    attendanceEligibility,
    attendanceReasonCode: row.eligible ? null : (mapAttendanceReason(reasonRaw) ?? 'attendance_ineligible'),
    serverEligibilityReason: reasonRaw,
    state: row.state as PickupDurableState,
    version: row.version,
    parentArrivedAt: row.arrival_at ?? null,
    arrivedByUserId: null,
    arrivalActorLabel: row.arrival_actor_label ?? null,
    intendedCollectorId: matchedCollector?.collectorId ?? null,
    intendedCollectorName: collectorLabel,
    authorizedCollectors: collectors,
    releasedAt: row.release_at ?? null,
    releasedByUserId: null,
    releasedByName: row.release_actor_label ?? null,
    releasedToCollectorId: null,
    releasedToCollectorName: row.state === 'RELEASED' ? collectorLabel : null,
    actorCanAnnounceArrival: Boolean(row.can_announce_arrival),
    actorCanConfirmRelease: Boolean(row.can_confirm_release),
    revocationStatus: 'NONE',
    outboxStatus: 'NONE',
    lastSyncedAt: syncedAt,
  };
}

export async function fetchPickupBoardCyclesTransport(
  options?: { role?: AccountRole | null; classId?: string | null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupReadResult> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [], lastSyncedAt: null, errorCode: 'pickup_backend_unavailable', errorMessage: 'Pickup backend client is unavailable.' };
  }
  try {
    let rawData: unknown;
    const tg = await invokeTelegramPrivateOperation<unknown[]>(
      'pickup.board',
      options?.classId ? { classId: options.classId } : {},
      client,
    );
    if (tg.handled) {
      rawData = tg.data;
    } else {
      if (!client || typeof client.rpc !== 'function') {
        return { ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [], lastSyncedAt: null, errorCode: 'pickup_backend_unavailable', errorMessage: 'Pickup backend client is unavailable.' };
      }
      if (options?.role === 'STUDENT' || options?.role === 'SCHOOL_STAFF') {
        return { ok: false, status: 'UNAUTHORIZED', availability: 'UNAUTHORIZED', records: [], lastSyncedAt: null, errorCode: 'actor_not_authorized', errorMessage: 'Role does not have pickup board scope.' };
      }
      const rpcRes = options?.role === 'PARENT'
        ? await client.rpc('get_pickup_parent_board')
        : await client.rpc('get_pickup_staff_board', options?.classId ? { p_class_id: options.classId } : {});
      if (rpcRes.error) {
        const { code, message } = extractPickupErrorCode(rpcRes.error);
        if (code === 'pickup_backend_unavailable') return { ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [], lastSyncedAt: null, errorCode: 'pickup_backend_unavailable', errorMessage: message };
        if (code === 'actor_unauthenticated' || code === 'actor_not_approved' || code === 'pickup_parent_required' || code === 'insufficient_pickup_scope') {
          return { ok: false, status: 'UNAUTHORIZED', availability: 'UNAUTHORIZED', records: [], lastSyncedAt: null, errorCode: 'actor_not_authorized', errorMessage: message };
        }
        return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: message };
      }
      rawData = rpcRes.data;
    }

    if (!Array.isArray(rawData)) {
      return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: 'Invalid pickup board payload from server.' };
    }
    const syncedAt = new Date().toISOString();
    const nowMs = Date.now();
    const mapped: PickupCycleRecord[] = [];
    for (const row of rawData) {
      const parsed = mapBoardRow(row, syncedAt, nowMs);
      if (!parsed) {
        return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: 'Malformed pickup board row returned by server.' };
      }
      mapped.push(parsed);
    }

    if (options?.role !== 'PARENT' && !isTelegramRuntime() && typeof client?.rpc === 'function') {
      const needsCollectors = mapped.filter(
        (c) => c.state === 'PARENT_ARRIVED' && c.actorCanConfirmRelease && c.authorizedCollectors.length === 0,
      );
      if (needsCollectors.length > 0) {
        const seen = new Map<string, Promise<PickupAuthorizedCollectorSummary[]>>();
        for (const c of needsCollectors) {
          const key = `${c.studentId}|${c.schoolDate}`;
          if (!seen.has(key)) seen.set(key, fetchAuthorizedPickupCollectorsTransport(c.studentId, c.schoolDate, client));
        }
        const resolved = new Map<string, PickupAuthorizedCollectorSummary[]>();
        await Promise.all([...seen.entries()].map(async ([k, p]) => { resolved.set(k, await p); }));
        for (let i = 0; i < mapped.length; i += 1) {
          const cur = mapped[i];
          if (cur.authorizedCollectors.length === 0) {
            const fetched = resolved.get(`${cur.studentId}|${cur.schoolDate}`) ?? [];
            if (fetched.length > 0) {
              const matchedCol = cur.intendedCollectorName ? fetched.find((col) => col.fullName === cur.intendedCollectorName) : undefined;
              mapped[i] = { ...cur, authorizedCollectors: fetched, intendedCollectorId: matchedCol?.collectorId ?? cur.intendedCollectorId };
            }
          }
        }
      }
    }

    return { ok: true, status: 'READY', availability: 'READY', records: mapped, lastSyncedAt: syncedAt };
  } catch (err) {
    const { code, message } = extractPickupErrorCode(err);
    if (code === 'pickup_backend_unavailable' || code === 'backend_unavailable') {
      return { ok: false, status: 'BLOCKED_BACKEND', availability: 'UNAVAILABLE', records: [], lastSyncedAt: null, errorCode: 'pickup_backend_unavailable', errorMessage: message };
    }
    if (code === 'actor_unauthenticated' || code === 'actor_not_approved' || code === 'pickup_parent_required' || code === 'insufficient_pickup_scope') {
      return { ok: false, status: 'UNAUTHORIZED', availability: 'UNAUTHORIZED', records: [], lastSyncedAt: null, errorCode: 'actor_not_authorized', errorMessage: message };
    }
    return { ok: false, status: 'ERROR', availability: 'ERROR', records: [], lastSyncedAt: null, errorCode: 'unknown_outcome_verify_required', errorMessage: message };
  }
}

function parseArrivalJson(data: unknown, requestId: string, cycleId: string): PickupCommandOutcome {
  if (!data || typeof data !== 'object') {
    return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, cycleId, reasonCode: 'unknown_outcome_verify_required', message: 'Invalid arrival response from server.', requiresAuthoritativeReadback: true };
  }
  const res = data as Record<string, unknown>;
  if (res.ok === true && res.code === 'parent_arrived' && typeof res.state === 'string' && VALID_STATES.has(res.state as PickupDurableState) && typeof res.version === 'number') {
    return { ok: true, outcome: 'SUCCESS', operationId: typeof res.requestId === 'string' ? res.requestId : requestId, cycleId: typeof res.cycleId === 'string' ? res.cycleId : cycleId, state: res.state as PickupDurableState, version: res.version, outboxEnqueued: true };
  }
  if (res.ok === false && res.code === 'version_conflict') {
    const serverState = typeof res.state === 'string' && VALID_STATES.has(res.state as PickupDurableState) ? (res.state as PickupDurableState) : undefined;
    const serverVersion = typeof res.version === 'number' ? res.version : undefined;
    return { ok: false, outcome: 'CONFLICT', reasonCode: 'version_conflict', serverState, serverVersion, message: 'Pickup status changed on the server before your arrival request completed.' };
  }
  return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, cycleId, reasonCode: 'unknown_outcome_verify_required', message: 'Unrecognized arrival response from server.', requiresAuthoritativeReadback: true };
}

export async function announcePickupArrivalTransport(
  input: AnnounceArrivalInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupCommandOutcome> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
  }
  if (!UUID_RE.test(input.cycleId) || !UUID_RE.test(input.collectorId) || !UUID_RE.test(input.requestId) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'invalid_pickup_request', message: 'Invalid pickup arrival request parameters.' };
  }
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.arrive', {
      cycleId: input.cycleId, collectorId: input.collectorId, requestId: input.requestId, expectedVersion: input.expectedVersion,
    }, client);
    if (tg.handled) return parseArrivalJson(tg.data, input.requestId, input.cycleId);
    if (!client || typeof client.rpc !== 'function') {
      return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
    }
    const { data, error } = await client.rpc('parent_arrived', {
      p_cycle_id: input.cycleId, p_collector_id: input.collectorId, p_request_id: input.requestId, p_expected_version: input.expectedVersion,
    });
    if (error) return mapPickupCommandError(error, input.requestId, input.cycleId);
    return parseArrivalJson(data, input.requestId, input.cycleId);
  } catch (err) {
    return mapPickupCommandError(err, input.requestId, input.cycleId);
  }
}

function parseReleaseJson(data: unknown, requestId: string, cycleId: string): PickupCommandOutcome {
  if (!data || typeof data !== 'object') {
    return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, cycleId, reasonCode: 'unknown_outcome_verify_required', message: 'Invalid physical release response from server.', requiresAuthoritativeReadback: true };
  }
  const res = data as Record<string, unknown>;
  if (res.ok === true && res.code === 'pupil_released' && typeof res.state === 'string' && VALID_STATES.has(res.state as PickupDurableState) && typeof res.version === 'number') {
    return { ok: true, outcome: 'SUCCESS', operationId: typeof res.requestId === 'string' ? res.requestId : requestId, cycleId: typeof res.cycleId === 'string' ? res.cycleId : cycleId, state: res.state as PickupDurableState, version: res.version, outboxEnqueued: true };
  }
  if (res.ok === false && (res.code === 'version_conflict' || res.code === 'already_released' || res.code === 'arrival_required')) {
    const serverState = typeof res.state === 'string' && VALID_STATES.has(res.state as PickupDurableState) ? (res.state as PickupDurableState) : undefined;
    const serverVersion = typeof res.version === 'number' ? res.version : undefined;
    return { ok: false, outcome: 'CONFLICT', reasonCode: res.code, serverState, serverVersion, message: `Server returned ${res.code} for this pickup cycle.` };
  }
  return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, cycleId, reasonCode: 'unknown_outcome_verify_required', message: 'Unrecognized physical release response from server.', requiresAuthoritativeReadback: true };
}

export async function confirmPickupReleaseTransport(
  input: ConfirmReleaseInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupCommandOutcome> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
  }
  if (input.physicalHandoffAttested !== true || input.collectorVerifiedInPerson !== true) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'attestation_required', message: 'In-person collector verification and physical handoff attestation are required.' };
  }
  if (!UUID_RE.test(input.cycleId) || !UUID_RE.test(input.collectorId) || !UUID_RE.test(input.requestId) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'invalid_pickup_request', message: 'Invalid pickup release request parameters.' };
  }
  const handoffNotes = typeof input.handoffNotes === 'string' && input.handoffNotes.trim() ? input.handoffNotes.trim() : null;
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.release', {
      cycleId: input.cycleId,
      collectorId: input.collectorId,
      requestId: input.requestId,
      expectedVersion: input.expectedVersion,
      inPersonVerified: true,
      ...(handoffNotes ? { handoffNotes } : {}),
    }, client);
    if (tg.handled) return parseReleaseJson(tg.data, input.requestId, input.cycleId);
    if (!client || typeof client.rpc !== 'function') {
      return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.', retryable: true };
    }
    const { data, error } = await client.rpc('release_pupil', {
      p_cycle_id: input.cycleId,
      p_collector_id: input.collectorId,
      p_request_id: input.requestId,
      p_expected_version: input.expectedVersion,
      p_in_person_verified: true,
      ...(handoffNotes ? { p_handoff_notes: handoffNotes } : {}),
    });
    if (error) return mapPickupCommandError(error, input.requestId, input.cycleId);
    return parseReleaseJson(data, input.requestId, input.cycleId);
  } catch (err) {
    return mapPickupCommandError(err, input.requestId, input.cycleId);
  }
}

function parseReceiptJson(data: unknown, requestId: string, cycleId: string): PickupCommandOutcome {
  if (!data || typeof data !== 'object') {
    return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, cycleId, reasonCode: 'unknown_outcome_verify_required', message: 'Invalid operation receipt response.', requiresAuthoritativeReadback: true };
  }
  const obj = data as Record<string, unknown>;
  if (obj.found === false) {
    return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, cycleId, reasonCode: 'unknown_outcome_verify_required', message: 'Operation receipt not found on server yet.', requiresAuthoritativeReadback: true };
  }
  if (obj.found === true && obj.result && typeof obj.result === 'object') {
    const resObj = obj.result as Record<string, unknown>;
    const resolvedCycleId = typeof obj.cycleId === 'string' ? obj.cycleId : cycleId;
    if (resObj.ok === true && (resObj.code === 'parent_arrived' || resObj.code === 'pupil_released')) {
      const defaultState: PickupDurableState = resObj.code === 'pupil_released' ? 'RELEASED' : 'PARENT_ARRIVED';
      const state = typeof obj.state === 'string' && VALID_STATES.has(obj.state as PickupDurableState) ? (obj.state as PickupDurableState) : defaultState;
      const version = typeof obj.version === 'number' ? obj.version : 1;
      return { ok: true, outcome: 'SUCCESS', operationId: requestId, cycleId: resolvedCycleId, state, version, outboxEnqueued: true };
    }
    if (resObj.ok === false && (resObj.code === 'version_conflict' || resObj.code === 'already_released' || resObj.code === 'arrival_required')) {
      const serverState = typeof obj.state === 'string' && VALID_STATES.has(obj.state as PickupDurableState) ? (obj.state as PickupDurableState) : undefined;
      const serverVersion = typeof obj.version === 'number' ? obj.version : undefined;
      return { ok: false, outcome: 'CONFLICT', reasonCode: resObj.code, serverState, serverVersion, message: `Server recorded ${resObj.code} for this request.` };
    }
  }
  return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, cycleId, reasonCode: 'unknown_outcome_verify_required', message: 'Unable to resolve operation receipt state.', requiresAuthoritativeReadback: true };
}

export async function readPickupOperationReceiptTransport(
  requestId: string,
  cycleId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupCommandOutcome> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup receipt lookup backend client is unavailable.', retryable: true };
  }
  if (!UUID_RE.test(requestId) || (cycleId && !UUID_RE.test(cycleId))) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'invalid_pickup_request', message: 'Invalid pickup receipt lookup parameters.' };
  }
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.receipt', {
      requestId, ...(cycleId ? { cycleId } : {}),
    }, client);
    if (tg.handled) return parseReceiptJson(tg.data, requestId, cycleId);
    if (!client || typeof client.rpc !== 'function') {
      return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message: 'Pickup receipt lookup backend client is unavailable.', retryable: true };
    }
    const { data, error } = await client.rpc('get_pickup_operation_receipt', {
      p_request_id: requestId, ...(cycleId ? { p_cycle_id: cycleId } : {}),
    });
    if (error) return mapPickupCommandError(error, requestId, cycleId);
    return parseReceiptJson(data, requestId, cycleId);
  } catch (err) {
    return mapPickupCommandError(err, requestId, cycleId);
  }
}
