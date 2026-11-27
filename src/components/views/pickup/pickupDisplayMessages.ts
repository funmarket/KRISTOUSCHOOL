import { formatAttendanceTimestamp } from '../../../lib/attendance/dateUtils.ts';
import type {
  PickupNotificationDeliveryStatus,
  PickupPresentationState,
  PickupReasonCode,
  PickupWindowStatus,
} from '../../../lib/domains/pickup.ts';
import type { Language } from '../../../types.ts';
import type { TranslationKey } from '../../../i18n/translations.ts';

export function getPickupBadgeMeta(
  state: PickupPresentationState,
  t: (key: TranslationKey) => string,
) {
  const map: Record<PickupPresentationState, { key: TranslationKey; cls: string }> = {
    WAITING: { key: 'waiting', cls: 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
    PARENT_ARRIVED: { key: 'parentArrived', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' },
    RELEASED: { key: 'released', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
    PENDING_RETRY: { key: 'pickupStatePendingRetry', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
    CONFLICT: { key: 'pickupStateConflict', cls: 'bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300' },
    DENIED: { key: 'pickupStateDenied', cls: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
    INELIGIBLE: { key: 'pickupStateIneligible', cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
    CLOSED_WINDOW: { key: 'pickupStateClosedWindow', cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
    UNKNOWN: { key: 'pickupStateUnknown', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' },
    UNAVAILABLE: { key: 'pickupStateUnavailable', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' },
  };
  const m = map[state] ?? map.UNAVAILABLE;
  return { label: t(m.key), toneClass: m.cls };
}

export function getPickupDeliveryBadgeMeta(
  status: PickupNotificationDeliveryStatus,
  t: (key: TranslationKey) => string,
) {
  if (status === 'QUEUED') {
    return { label: t('pickupDeliveryQueued'), cls: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' };
  }
  if (status === 'RETRYING') {
    return { label: t('pickupDeliveryRetrying'), cls: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-200' };
  }
  if (status === 'DELIVERED') {
    return { label: t('pickupDeliveryDelivered'), cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' };
  }
  if (status === 'UNAVAILABLE') {
    return { label: t('pickupDeliveryUnavailable'), cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
  }
  return null;
}

export function resolvePickupWindowStatusLabel(
  status: PickupWindowStatus,
  t: (key: TranslationKey) => string,
): string {
  switch (status) {
    case 'OPEN':
      return t('pickupWindowOpen');
    case 'NOT_STARTED':
      return t('pickupWindowNotStarted');
    case 'CLOSED':
      return t('pickupWindowClosedLabel');
    case 'NO_WINDOW_CONFIGURED':
    case 'UNAVAILABLE':
    default:
      return t('pickupWindowUnavailable');
  }
}

const ATTENDANCE_PENDING_CODES = new Set<PickupReasonCode>([
  'register_missing',
  'register_not_submitted',
  'attendance_mark_missing',
  'attendance_mark_unknown',
  'attendance_entry_missing_or_conflicting',
  'conflicting_registers',
  'conflicting_effective_memberships',
  'responsible_teacher_unavailable',
  'attendance_unavailable',
]);

export function resolvePickupReasonText(
  code: PickupReasonCode | null | undefined,
  t: (key: TranslationKey) => string,
  fallback?: string | null,
): string {
  if (!code) return fallback || t('pickupStateUnavailable');
  if (code === 'attendance_absent') return t('pickupEligibilityAbsent');
  if (code === 'attendance_excused') return t('pickupEligibilityExcused');
  if (code === 'attendance_ineligible') return t('pickupStateIneligible');
  if (ATTENDANCE_PENDING_CODES.has(code)) return t('pickupEligibilityAttendancePending');
  if (code === 'outside_dismissal_window' || code === 'window_closed') return t('pickupWindowClosedLabel');
  if (code === 'window_not_started') return t('pickupWindowNotStarted');
  if (code === 'schedule_unavailable') return t('pickupScheduleUnavailableNotice');
  if (code === 'idempotency_conflict') return t('pickupReasonIdempotencyConflict');
  if (code === 'arrival_required') return t('pickupReasonArrivalRequired');
  if (code === 'version_conflict' || code === 'already_arrived' || code === 'already_released') {
    return t('pickupStateConflict');
  }
  if (code === 'attestation_required' || code === 'handoff_attestation_required') {
    return t('pickupReasonAttestationRequired');
  }
  if (code === 'collector_invalid') return t('pickupReasonCollectorInvalid');
  if (
    code === 'pickup_release_authority_required' ||
    code === 'pickup_provision_authority_required' ||
    code === 'pickup_app_admin_required'
  ) {
    return t('pickupReasonReleaseAuthorityRequired');
  }
  if (code === 'pickup_release_authority_revoked' || code === 'release_authority_revoked') {
    return t('pickupReleaseRevokedNotice');
  }
  if (code === 'release_authority_target_ineligible' || code === 'invalid_pickup_authority_request') {
    return t('pickupReasonAuthorityRequestInvalid');
  }
  if (code === 'pickup_release_authority_already_revoked' || code === 'pickup_release_authority_not_revoked') {
    return t('pickupReasonAuthorityStateConflict');
  }
  if (
    code === 'actor_not_authorized' ||
    code === 'collector_not_authorized' ||
    code === 'collector_revoked' ||
    code === 'pickup_cycle_not_found' ||
    code === 'pickup_receipt_unavailable' ||
    code === 'invalid_pickup_request'
  ) {
    return t('pickupStateDenied');
  }
  if (code === 'unknown_outcome_verify_required') return t('pickupUnknownOutcomeHint');
  if (code === 'pickup_backend_unavailable') return t('pickupStateUnavailable');
  return fallback || t('pickupStateUnavailable');
}

export function formatTunisPickupTime(
  isoTimestamp: string | null | undefined,
  language: Language,
): string {
  return formatAttendanceTimestamp(isoTimestamp, language);
}
