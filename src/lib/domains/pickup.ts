import type { AccountRole } from '../../types.ts';
import {
  announcePickupArrivalTransport,
  confirmPickupReleaseTransport,
  fetchPickupBoardCyclesTransport,
  readPickupOperationReceiptTransport,
} from './pickupTransport.ts';
import {
  fetchAuthorizedPickupCollectorsTransport,
  provisionPickupCyclesTransport,
  reinstatePickupReleaseAuthorityTransport,
  revokePickupReleaseAuthorityTransport,
} from './pickupAdminTransport.ts';
import type {
  AnnounceArrivalInput,
  ConfirmReleaseInput,
  PickupAuthorizedCollectorSummary,
  PickupAvailabilityStatus,
  PickupCommandOutcome,
  PickupCycleRecord,
  PickupMutationEntry,
  PickupNotificationDeliveryStatus,
  PickupPresentationState,
  PickupProvisionResult,
  PickupReadResult,
  PickupReasonCode,
  PickupRecord,
  PickupReleaseAuthorityResult,
} from './pickupTypes.ts';

export type {
  AnnounceArrivalInput,
  ConfirmReleaseInput,
  PickupAttendanceEligibility,
  PickupAuthorizedCollectorSummary,
  PickupAvailabilityStatus,
  PickupBackendStatus,
  PickupCommandConflict,
  PickupCommandDenied,
  PickupCommandOutcome,
  PickupCommandSuccess,
  PickupCommandUnavailable,
  PickupCommandUnknownOutcome,
  PickupCycleRecord,
  PickupDurableState,
  PickupMutationEntry,
  PickupNotificationDeliveryStatus,
  PickupOutboxStatus,
  PickupPresentationState,
  PickupProvisionResult,
  PickupReadResult,
  PickupReasonCode,
  PickupRecord,
  PickupReleaseAuthorityResult,
  PickupRevocationStatus,
  PickupWindowStatus,
} from './pickupTypes.ts';

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
  _operation?: 'arrival' | 'release',
  _cycleId?: string,
): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex = '';
    for (let i = 0; i < bytes.length; i += 1) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

export function deriveSuccessDeliveryStatus(
  outboxEnqueued: boolean,
  record?: PickupCycleRecord,
): PickupNotificationDeliveryStatus {
  if (record?.outboxStatus === 'DELIVERED') return 'DELIVERED';
  if (record?.outboxStatus === 'PENDING_RETRY') return 'RETRYING';
  if (record?.outboxStatus === 'FAILED') return 'UNAVAILABLE';
  return outboxEnqueued ? 'QUEUED' : 'UNAVAILABLE';
}

export function hasCommittedPickupTransition(
  record: PickupCycleRecord | undefined,
  cycleId: string,
  op: 'ARRIVAL' | 'RELEASE',
): record is PickupCycleRecord {
  if (!record || record.cycleId !== cycleId) return false;
  return op === 'ARRIVAL' ? (record.state === 'PARENT_ARRIVED' || record.state === 'RELEASED') : record.state === 'RELEASED';
}

export function hasServerSupersededPending(
  records: PickupCycleRecord[],
  cycleId: string,
  entry: PickupMutationEntry,
): boolean {
  if (entry.status !== 'UNKNOWN_OUTCOME' || !entry.payload) return false;
  const serverCycle = records.find((r) => r.cycleId === cycleId);
  if (!serverCycle) return false;
  if (serverCycle.version > entry.payload.expectedVersion) return true;
  if (entry.operation === 'ARRIVAL') return serverCycle.state === 'PARENT_ARRIVED' || serverCycle.state === 'RELEASED';
  return entry.operation === 'RELEASE' ? serverCycle.state === 'RELEASED' : false;
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

  if (mutation?.status === 'UNKNOWN_OUTCOME') return 'UNKNOWN';
  if (mutation?.status === 'CONFLICT') return 'CONFLICT';
  if (mutation?.status === 'DENIED') return 'DENIED';
  if (mutation?.status === 'UNAVAILABLE') return 'UNAVAILABLE';

  if (availability !== 'READY') {
    if (availability === 'UNAUTHORIZED') return 'DENIED';
    if (availability === 'ERROR') return 'UNKNOWN';
    return 'UNAVAILABLE';
  }

  if (!cycle) return 'UNKNOWN';
  if (cycle.state === 'RELEASED') return 'RELEASED';
  if (cycle.state === 'PARENT_ARRIVED') return 'PARENT_ARRIVED';
  if (cycle.windowStatus === 'UNAVAILABLE' || cycle.attendanceEligibility === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (cycle.attendanceEligibility === 'INELIGIBLE') return 'INELIGIBLE';
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
  if (mutation?.status === 'SUBMITTING' || mutation?.status === 'UNKNOWN_OUTCOME') return false;
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
  if (mutation?.status === 'SUBMITTING' || mutation?.status === 'UNKNOWN_OUTCOME') return false;
  if (cycle.revocationStatus !== 'NONE') return false;
  if (!cycle.actorCanConfirmRelease) return false;
  if (cycle.state !== 'PARENT_ARRIVED') return false;
  if (cycle.windowStatus === 'UNAVAILABLE') return false;
  if (cycle.attendanceEligibility !== 'ELIGIBLE') return false;
  return cycle.authorizedCollectors.some((c) => c.status === 'ACTIVE');
}

export const deniedPickupOutcome = (reasonCode: PickupReasonCode, message: string): PickupCommandOutcome =>
  ({ ok: false, outcome: 'DENIED', reasonCode, message });

export const unavailablePickupOutcome = (reasonCode: PickupReasonCode, message: string): PickupCommandOutcome =>
  ({ ok: false, outcome: 'UNAVAILABLE', reasonCode, message, retryable: true });

export const unknownPickupOutcomeFor = (requestId: string, cycleId: string, message: string): PickupCommandOutcome => ({
  ok: false,
  outcome: 'UNKNOWN_OUTCOME',
  requestId,
  cycleId,
  reasonCode: 'unknown_outcome_verify_required',
  message,
  requiresAuthoritativeReadback: true,
});

export async function fetchPickupBoardCycles(
  options?: { role?: AccountRole | null; classId?: string | null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupReadResult> {
  return fetchPickupBoardCyclesTransport(options, clientOverride);
}

export async function announcePickupArrival(
  input: AnnounceArrivalInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupCommandOutcome> {
  return announcePickupArrivalTransport(input, clientOverride);
}

export async function confirmPickupRelease(
  input: ConfirmReleaseInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupCommandOutcome> {
  return confirmPickupReleaseTransport(input, clientOverride);
}

export async function readPickupOperationReceipt(
  requestId: string,
  cycleId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupCommandOutcome> {
  return readPickupOperationReceiptTransport(requestId, cycleId, clientOverride);
}

export async function fetchAuthorizedPickupCollectors(
  studentId: string,
  schoolDate?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupAuthorizedCollectorSummary[]> {
  return fetchAuthorizedPickupCollectorsTransport(studentId, schoolDate, clientOverride);
}

export async function provisionPickupCycles(
  schoolDate?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupProvisionResult> {
  return provisionPickupCyclesTransport(schoolDate, clientOverride);
}

export async function revokePickupReleaseAuthority(
  targetUserId: string,
  reason: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupReleaseAuthorityResult> {
  return revokePickupReleaseAuthorityTransport(targetUserId, reason, clientOverride);
}

export async function reinstatePickupReleaseAuthority(
  targetUserId: string,
  reason: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupReleaseAuthorityResult> {
  return reinstatePickupReleaseAuthorityTransport(targetUserId, reason, clientOverride);
}
