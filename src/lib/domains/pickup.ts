export type PickupDurableState = 'WAITING' | 'PARENT_ARRIVED' | 'RELEASED';

export type PickupPresentationState =
  | PickupDurableState
  | 'UNKNOWN'
  | 'UNAVAILABLE'
  | 'PENDING_RETRY'
  | 'CONFLICT'
  | 'INELIGIBLE'
  | 'CLOSED_WINDOW'
  | 'DENIED';

export type PickupWindowStatus =
  | 'OPEN'
  | 'NOT_STARTED'
  | 'CLOSED'
  | 'NO_WINDOW_CONFIGURED'
  | 'UNAVAILABLE';

export type PickupAttendanceEligibility = 'ELIGIBLE' | 'INELIGIBLE' | 'UNAVAILABLE';

export type PickupRevocationStatus = 'NONE' | 'REVOKED' | 'UNKNOWN';

export type PickupOutboxStatus = 'NONE' | 'PENDING_RETRY' | 'DELIVERED' | 'FAILED';

export type PickupNotificationDeliveryStatus =
  | 'NONE'
  | 'QUEUED'
  | 'RETRYING'
  | 'DELIVERED'
  | 'UNAVAILABLE';

export type PickupAvailabilityStatus = 'READY' | 'UNAVAILABLE' | 'UNAUTHORIZED' | 'ERROR';

export type PickupBackendStatus = 'READY' | 'BLOCKED_BACKEND' | 'UNAUTHORIZED' | 'ERROR';

export type PickupReasonCode =
  | 'pickup_backend_unavailable'
  | 'schedule_unavailable'
  | 'attendance_unavailable'
  | 'attendance_ineligible'
  | 'window_closed'
  | 'window_not_started'
  | 'actor_not_authorized'
  | 'release_authority_revoked'
  | 'collector_not_authorized'
  | 'collector_revoked'
  | 'handoff_attestation_required'
  | 'version_conflict'
  | 'already_arrived'
  | 'already_released'
  | 'outbox_pending_retry'
  | 'unknown_outcome_verify_required'
  | 'session_changed';

export interface PickupAuthorizedCollectorSummary {
  collectorId: string;
  fullName: string;
  relationshipLabel: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface PickupCycleRecord {
  cycleId: string;
  studentId: string;
  studentName: string;
  studentPhotoUrl?: string | null;
  classId: string;
  className: string;
  schoolDate: string;
  windowId: string | null;
  windowLabel: string | null;
  windowStatus: PickupWindowStatus;
  attendanceEligibility: PickupAttendanceEligibility;
  attendanceReasonCode?: PickupReasonCode | null;
  state: PickupDurableState;
  version: number;
  parentArrivedAt: string | null;
  arrivedByUserId: string | null;
  intendedCollectorId: string | null;
  intendedCollectorName: string | null;
  authorizedCollectors: PickupAuthorizedCollectorSummary[];
  releasedAt: string | null;
  releasedByUserId: string | null;
  releasedByName: string | null;
  releasedToCollectorId: string | null;
  releasedToCollectorName: string | null;
  actorCanAnnounceArrival: boolean;
  actorCanConfirmRelease: boolean;
  revocationStatus: PickupRevocationStatus;
  outboxStatus?: PickupOutboxStatus;
  lastSyncedAt: string;
}

export interface PickupRecord {
  id: string;
  childId: string;
  childName: string;
  classId: string;
  className: string;
  state: PickupDurableState;
  parentArrivedAt?: string;
  releasedAt?: string;
  releasedBy?: string;
  authorizedPerson: string;
}

export interface PickupReadResult {
  ok: boolean;
  status: PickupBackendStatus;
  availability: PickupAvailabilityStatus;
  records: PickupCycleRecord[];
  lastSyncedAt: string | null;
  errorCode?: PickupReasonCode;
  errorMessage?: string;
}

export interface AnnounceArrivalInput {
  cycleId: string;
  studentId: string;
  collectorId: string;
  requestId: string;
  expectedVersion: number;
}

export interface ConfirmReleaseInput {
  cycleId: string;
  collectorId: string;
  requestId: string;
  expectedVersion: number;
  physicalHandoffAttested: true;
  collectorVerifiedInPerson: true;
}

export interface PickupCommandSuccess<T = PickupCycleRecord> {
  ok: true;
  outcome: 'SUCCESS';
  operationId: string;
  cycleId: string;
  state: PickupDurableState;
  version: number;
  updatedRecord?: T;
  outboxEnqueued: boolean;
}

export interface PickupCommandUnavailable {
  ok: false;
  outcome: 'UNAVAILABLE';
  reasonCode: PickupReasonCode;
  message: string;
  retryable: true;
}

export interface PickupCommandDenied {
  ok: false;
  outcome: 'DENIED';
  reasonCode: PickupReasonCode;
  message: string;
}

export interface PickupCommandConflict<T = PickupCycleRecord> {
  ok: false;
  outcome: 'CONFLICT';
  reasonCode: 'version_conflict' | 'already_arrived' | 'already_released';
  serverRecord?: T;
  message: string;
}

export interface PickupCommandUnknownOutcome {
  ok: false;
  outcome: 'UNKNOWN_OUTCOME';
  requestId: string;
  cycleId: string;
  reasonCode: 'unknown_outcome_verify_required';
  message: string;
  requiresAuthoritativeReadback: true;
}

export type PickupCommandOutcome<T = PickupCycleRecord> =
  | PickupCommandSuccess<T>
  | PickupCommandUnavailable
  | PickupCommandDenied
  | PickupCommandConflict<T>
  | PickupCommandUnknownOutcome;

export interface PickupMutationEntry {
  status:
    | 'IDLE'
    | 'SUBMITTING'
    | 'PENDING_RETRY'
    | 'UNKNOWN_OUTCOME'
    | 'CONFLICT'
    | 'DENIED'
    | 'UNAVAILABLE';
  requestId?: string;
  operation?: 'ARRIVAL' | 'RELEASE';
  payload?: AnnounceArrivalInput | ConfirmReleaseInput;
  reasonCode?: PickupReasonCode;
  message?: string;
  serverRecord?: PickupCycleRecord;
  notificationDeliveryStatus?: PickupNotificationDeliveryStatus;
}

export const PICKUP_BACKEND_UNAVAILABLE_CODE: PickupReasonCode = 'pickup_backend_unavailable';

export function attemptPickupOperation(
  operation: 'ARRIVAL' | 'RELEASE',
  targetId: string,
): {
  allowed: false;
  status: 'BLOCKED_BACKEND';
  operation: 'ARRIVAL' | 'RELEASE';
  targetId: string;
  reason: string;
} {
  return {
    allowed: false,
    status: 'BLOCKED_BACKEND',
    operation,
    targetId,
    reason: PICKUP_BACKEND_UNAVAILABLE_CODE,
  };
}

export function createPickupRequestId(
  operation: 'arrival' | 'release',
  cycleId: string,
): string {
  const safeId = cycleId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'cycle';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pickup_${operation}_${safeId}_${crypto.randomUUID()}`;
  }
  return `pickup_${operation}_${safeId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getChildAvatarInitials(fullName: string | null | undefined): string {
  const clean = typeof fullName === 'string' ? fullName.trim() : '';
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return [...parts[0]].slice(0, 2).join('').toUpperCase();
  }
  const first = [...parts[0]][0] || '';
  const last = [...parts[parts.length - 1]][0] || '';
  return `${first}${last}`.toUpperCase();
}

export function toLegacyPickupRecord(cycle: PickupCycleRecord): PickupRecord {
  return {
    id: cycle.cycleId,
    childId: cycle.studentId,
    childName: cycle.studentName,
    classId: cycle.classId,
    className: cycle.className,
    state: cycle.state,
    parentArrivedAt: cycle.parentArrivedAt ?? undefined,
    releasedAt: cycle.releasedAt ?? undefined,
    releasedBy: cycle.releasedByName ?? undefined,
    authorizedPerson:
      cycle.releasedToCollectorName ||
      cycle.intendedCollectorName ||
      cycle.authorizedCollectors.find((c) => c.status === 'ACTIVE')?.fullName ||
      '',
  };
}

export function deriveNotificationDeliveryStatus(
  cycle: PickupCycleRecord | null | undefined,
  mutation?: PickupMutationEntry | null,
): PickupNotificationDeliveryStatus {
  if (cycle?.outboxStatus === 'DELIVERED') return 'DELIVERED';
  if (cycle?.outboxStatus === 'PENDING_RETRY') return 'RETRYING';
  if (cycle?.outboxStatus === 'FAILED') return 'UNAVAILABLE';
  if (mutation?.notificationDeliveryStatus && mutation.notificationDeliveryStatus !== 'NONE') {
    return mutation.notificationDeliveryStatus;
  }
  return 'NONE';
}

export function derivePickupPresentationState(
  cycle: PickupCycleRecord | null | undefined,
  options?: {
    readAvailability?: PickupAvailabilityStatus;
    mutation?: PickupMutationEntry | null;
  },
): PickupPresentationState {
  const availability = options?.readAvailability ?? 'UNAVAILABLE';
  const mutation = options?.mutation ?? null;

  if (mutation?.status === 'UNKNOWN_OUTCOME') {
    return 'UNKNOWN';
  }
  if (mutation?.status === 'CONFLICT') {
    return 'CONFLICT';
  }
  if (mutation?.status === 'DENIED') {
    return 'DENIED';
  }
  if (mutation?.status === 'UNAVAILABLE') {
    return 'UNAVAILABLE';
  }

  if (availability !== 'READY') {
    if (availability === 'UNAUTHORIZED') return 'DENIED';
    if (availability === 'ERROR') return 'UNKNOWN';
    return 'UNAVAILABLE';
  }

  if (!cycle) {
    return 'UNKNOWN';
  }

  if (cycle.state === 'RELEASED') {
    return 'RELEASED';
  }

  if (cycle.state === 'PARENT_ARRIVED') {
    return 'PARENT_ARRIVED';
  }

  if (cycle.windowStatus === 'UNAVAILABLE' || cycle.attendanceEligibility === 'UNAVAILABLE') {
    return 'UNAVAILABLE';
  }

  if (cycle.attendanceEligibility === 'INELIGIBLE') {
    return 'INELIGIBLE';
  }

  if (
    cycle.windowStatus === 'CLOSED' ||
    cycle.windowStatus === 'NOT_STARTED' ||
    cycle.windowStatus === 'NO_WINDOW_CONFIGURED'
  ) {
    return 'CLOSED_WINDOW';
  }

  return cycle.state;
}

export function canActorTriggerArrivalUi(
  cycle: PickupCycleRecord | null | undefined,
  readAvailability: PickupAvailabilityStatus,
  mutation?: PickupMutationEntry | null,
): boolean {
  if (readAvailability !== 'READY' || !cycle) return false;
  if (
    mutation?.status === 'SUBMITTING' ||
    mutation?.status === 'UNKNOWN_OUTCOME'
  ) {
    return false;
  }
  if (!cycle.actorCanAnnounceArrival) return false;
  if (cycle.state !== 'WAITING') return false;
  if (cycle.windowStatus !== 'OPEN') return false;
  if (cycle.attendanceEligibility !== 'ELIGIBLE') return false;
  return cycle.authorizedCollectors.some((c) => c.status === 'ACTIVE');
}

export function canActorTriggerReleaseUi(
  cycle: PickupCycleRecord | null | undefined,
  readAvailability: PickupAvailabilityStatus,
  mutation?: PickupMutationEntry | null,
): boolean {
  if (readAvailability !== 'READY' || !cycle) return false;
  if (
    mutation?.status === 'SUBMITTING' ||
    mutation?.status === 'UNKNOWN_OUTCOME'
  ) {
    return false;
  }
  if (cycle.revocationStatus !== 'NONE') return false;
  if (!cycle.actorCanConfirmRelease) return false;
  if (cycle.state !== 'PARENT_ARRIVED') return false;
  if (cycle.windowStatus === 'UNAVAILABLE') return false;
  if (cycle.attendanceEligibility !== 'ELIGIBLE') return false;
  return cycle.authorizedCollectors.some((c) => c.status === 'ACTIVE');
}

export async function fetchPickupBoardCycles(): Promise<PickupReadResult> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    availability: 'UNAVAILABLE',
    records: [],
    lastSyncedAt: null,
    errorCode: PICKUP_BACKEND_UNAVAILABLE_CODE,
    errorMessage: 'Pickup board backend contract is not deployed yet.',
  };
}

export async function announcePickupArrival(
  _input: AnnounceArrivalInput,
): Promise<PickupCommandOutcome> {
  return {
    ok: false,
    outcome: 'UNAVAILABLE',
    reasonCode: PICKUP_BACKEND_UNAVAILABLE_CODE,
    message: 'Pickup arrival backend contract is not deployed yet.',
    retryable: true,
  };
}

export async function confirmPickupRelease(
  _input: ConfirmReleaseInput,
): Promise<PickupCommandOutcome> {
  return {
    ok: false,
    outcome: 'UNAVAILABLE',
    reasonCode: PICKUP_BACKEND_UNAVAILABLE_CODE,
    message: 'Pickup release backend contract is not deployed yet.',
    retryable: true,
  };
}

export async function readPickupOperationReceipt(
  _requestId: string,
  _cycleId: string,
): Promise<PickupCommandOutcome> {
  return {
    ok: false,
    outcome: 'UNAVAILABLE',
    reasonCode: PICKUP_BACKEND_UNAVAILABLE_CODE,
    message: 'Pickup operation receipt lookup backend contract is not deployed yet.',
    retryable: true,
  };
}
