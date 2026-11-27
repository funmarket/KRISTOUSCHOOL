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
  | 'outside_dismissal_window'
  | 'attendance_unavailable'
  | 'attendance_ineligible'
  | 'attendance_absent'
  | 'attendance_excused'
  | 'attendance_mark_missing'
  | 'attendance_mark_unknown'
  | 'attendance_entry_missing_or_conflicting'
  | 'register_missing'
  | 'register_not_submitted'
  | 'conflicting_registers'
  | 'conflicting_effective_memberships'
  | 'responsible_teacher_unavailable'
  | 'window_closed'
  | 'window_not_started'
  | 'actor_not_authorized'
  | 'release_authority_revoked'
  | 'collector_not_authorized'
  | 'collector_revoked'
  | 'collector_invalid'
  | 'handoff_attestation_required'
  | 'attestation_required'
  | 'pickup_release_authority_required'
  | 'pickup_release_authority_revoked'
  | 'pickup_provision_authority_required'
  | 'pickup_app_admin_required'
  | 'release_authority_target_ineligible'
  | 'pickup_release_authority_already_revoked'
  | 'pickup_release_authority_not_revoked'
  | 'invalid_pickup_authority_request'
  | 'arrival_required'
  | 'version_conflict'
  | 'idempotency_conflict'
  | 'pickup_cycle_not_found'
  | 'pickup_receipt_unavailable'
  | 'early_departure_not_found'
  | 'early_departure_already_open'
  | 'early_departure_terminal'
  | 'early_departure_not_approved'
  | 'cycle_date_mismatch'
  | 'invalid_pickup_request'
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
  windowStart?: string | null;
  windowEnd?: string | null;
  windowStatus: PickupWindowStatus;
  attendanceEligibility: PickupAttendanceEligibility;
  attendanceReasonCode?: PickupReasonCode | null;
  serverEligibilityReason?: string | null;
  state: PickupDurableState;
  version: number;
  parentArrivedAt: string | null;
  arrivedByUserId: string | null;
  arrivalActorLabel?: string | null;
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
  handoffNotes?: string | null;
}

export interface PickupProvisionResult {
  ok: boolean;
  schoolDate: string | null;
  timezone: string | null;
  provisionedCount: number;
  skippedCount: number;
  errorCode?: PickupReasonCode;
  message?: string;
}

export interface PickupReleaseAuthorityResult {
  ok: boolean;
  targetUserId: string;
  isRevoked: boolean | null;
  version?: number;
  effectiveAt?: string;
  errorCode?: PickupReasonCode;
  message?: string;
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
  reasonCode: 'version_conflict' | 'idempotency_conflict' | 'already_arrived' | 'already_released' | 'arrival_required';
  serverRecord?: T;
  serverState?: PickupDurableState;
  serverVersion?: number;
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

export type EarlyDepartureStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface EarlyDepartureRequestRow {
  id: string;
  studentId: string;
  studentLabel: string;
  classId: string;
  classLabel: string;
  cycleId: string | null;
  schoolDate: string;
  collectorId: string;
  collectorLabel: string;
  reason: string;
  requestedPickupAt: string | null;
  status: EarlyDepartureStatus;
  version: number;
  requestedByLabel?: string | null;
  reviewedByLabel?: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  releasedByLabel?: string | null;
  completedAt: string | null;
  handoffNotes?: string | null;
  createdAt: string;
  canReview: boolean;
  canComplete: boolean;
}

export interface EarlyDepartureReadResult {
  ok: boolean;
  status: PickupBackendStatus;
  availability: PickupAvailabilityStatus;
  records: EarlyDepartureRequestRow[];
  lastSyncedAt: string | null;
  errorCode?: PickupReasonCode;
  errorMessage?: string;
}

export interface RequestEarlyDepartureInput {
  studentId: string;
  collectorId: string;
  reason: string;
  requestId: string;
  requestedPickupAt?: string | null;
}

export interface ReviewEarlyDepartureInput {
  earlyDepartureId: string;
  decision: 'APPROVED' | 'REJECTED';
  requestId: string;
  expectedVersion: number;
  reviewReason?: string | null;
}

export interface CompleteEarlyDepartureInput {
  earlyDepartureId: string;
  collectorId: string;
  requestId: string;
  expectedVersion: number;
  inPersonVerified: true;
  handoffNotes?: string | null;
}

export interface EarlyDepartureCommandSuccess {
  ok: true;
  outcome: 'SUCCESS';
  code: 'early_departure_requested' | 'early_departure_approved' | 'early_departure_rejected' | 'early_departure_completed';
  earlyDepartureId: string;
  studentId: string | null;
  cycleId: string | null;
  status: EarlyDepartureStatus;
  version: number;
  requestId: string;
  cycleState?: PickupDurableState | null;
  cycleVersion?: number | null;
  replayed?: boolean;
}

export interface EarlyDepartureCommandConflict {
  ok: false;
  outcome: 'CONFLICT';
  reasonCode:
    | 'version_conflict'
    | 'idempotency_conflict'
    | 'already_released'
    | 'early_departure_already_open'
    | 'early_departure_terminal'
    | 'early_departure_not_approved';
  earlyDepartureId?: string;
  serverStatus?: EarlyDepartureStatus;
  serverVersion?: number;
  cycleId?: string | null;
  message: string;
}

export interface EarlyDepartureCommandUnknownOutcome {
  ok: false;
  outcome: 'UNKNOWN_OUTCOME';
  requestId: string;
  targetId: string;
  reasonCode: 'unknown_outcome_verify_required';
  message: string;
  requiresAuthoritativeReadback: true;
}

export type EarlyDepartureCommandOutcome =
  | EarlyDepartureCommandSuccess
  | PickupCommandUnavailable
  | PickupCommandDenied
  | EarlyDepartureCommandConflict
  | EarlyDepartureCommandUnknownOutcome;

export interface EarlyDepartureMutationEntry {
  status: 'IDLE' | 'SUBMITTING' | 'UNKNOWN_OUTCOME' | 'CONFLICT' | 'DENIED' | 'UNAVAILABLE';
  requestId?: string;
  operation?: 'REQUEST' | 'REVIEW' | 'COMPLETE';
  payload?: RequestEarlyDepartureInput | ReviewEarlyDepartureInput | CompleteEarlyDepartureInput;
  reasonCode?: PickupReasonCode;
  message?: string;
}
