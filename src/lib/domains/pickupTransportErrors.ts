import { getTelegramWebAppInitData } from '../telegram.ts';
import type { PickupCommandOutcome, PickupDurableState, PickupReasonCode } from './pickupTypes.ts';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const VALID_STATES = new Set<PickupDurableState>(['WAITING', 'PARENT_ARRIVED', 'RELEASED']);

export function isTelegramRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(getTelegramWebAppInitData());
}

const KNOWN_PICKUP_ERROR_CODES = new Set([
  'actor_unauthenticated', 'actor_not_approved', 'pickup_parent_required', 'pickup_parent_child_link_required',
  'collector_or_parent_not_authorized', 'insufficient_pickup_scope', 'pickup_receipt_unavailable',
  'pickup_cycle_not_found', 'invalid_pickup_request', 'invalid_request', 'pickup_crypto_unavailable',
  'idempotency_conflict', 'version_conflict', 'arrival_required', 'already_released', 'attestation_required',
  'collector_invalid', 'attendance_ineligible', 'pickup_release_authority_required',
  'pickup_release_authority_revoked', 'pickup_provision_authority_required', 'pickup_app_admin_required',
  'release_authority_target_ineligible', 'pickup_release_authority_already_revoked',
  'pickup_release_authority_not_revoked', 'invalid_pickup_authority_request',
  'schedule_unavailable', 'outside_dismissal_window', 'attendance_absent', 'attendance_excused',
  'attendance_mark_missing', 'attendance_mark_unknown', 'attendance_entry_missing_or_conflicting',
  'register_missing', 'register_not_submitted', 'conflicting_registers', 'conflicting_effective_memberships',
  'responsible_teacher_unavailable', 'attendance_unavailable', 'eligibility_unavailable',
  'backend_unavailable', 'pickup_backend_unavailable',
]);

export function extractPickupErrorCode(err: unknown): { code: string; message: string; isTransport: boolean } {
  if (!err || typeof err !== 'object') return { code: 'operation_failed', message: 'Pickup operation failed.', isTransport: true };
  const obj = err as { code?: unknown; message?: unknown; status?: unknown; isTransportError?: unknown };
  const code = typeof obj.code === 'string' && obj.code.trim() ? obj.code.trim() : '';
  const msg = typeof obj.message === 'string' && obj.message.trim() ? obj.message.trim() : 'Pickup operation failed.';

  if (
    code === 'PGRST202' || code === 'PGRST205' || code === '42883' || code === '42P01' ||
    msg.includes('Could not find the function') || msg.includes('Could not find the table') || msg.includes('schema cache')
  ) {
    return { code: 'pickup_backend_unavailable', message: 'This workflow is awaiting verified Supabase backend deployment.', isTransport: false };
  }

  if (KNOWN_PICKUP_ERROR_CODES.has(msg)) {
    return { code: msg, message: msg, isTransport: false };
  }
  if (KNOWN_PICKUP_ERROR_CODES.has(code)) {
    return { code, message: msg, isTransport: false };
  }

  if (
    code === '42501' || code === 'PGRST301' ||
    msg.includes('actor_unauthenticated') || msg.includes('actor_not_approved') ||
    msg.includes('insufficient_authority') || msg.includes('row-level security')
  ) {
    return { code: 'actor_unauthenticated', message: msg, isTransport: false };
  }

  const finalCode = code && code !== 'P0001' ? code : 'operation_failed';
  const isTransport = Boolean(obj.isTransportError) || (typeof obj.status === 'number' && obj.status >= 500) ||
    finalCode === 'operation_failed' || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout');
  return { code: finalCode, message: msg, isTransport };
}

export function mapPickupCommandError(err: unknown, requestId: string, cycleId: string): PickupCommandOutcome {
  const { code, message } = extractPickupErrorCode(err);
  if (code === 'pickup_backend_unavailable' || code === 'backend_unavailable' || code === 'pickup_crypto_unavailable') {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'pickup_backend_unavailable', message, retryable: true };
  }
  if (code === 'idempotency_conflict') {
    return { ok: false, outcome: 'CONFLICT', reasonCode: 'idempotency_conflict', message: 'Request ID conflicts with an earlier pickup payload.' };
  }
  if (code === 'already_released' || code === 'arrival_required' || code === 'version_conflict') {
    return { ok: false, outcome: 'CONFLICT', reasonCode: code, message };
  }
  if (
    code === 'actor_unauthenticated' || code === 'actor_not_approved' || code === 'pickup_parent_required' ||
    code === 'pickup_parent_child_link_required' || code === 'insufficient_pickup_scope'
  ) {
    return { ok: false, outcome: 'DENIED', reasonCode: 'actor_not_authorized', message };
  }
  if (code === 'collector_or_parent_not_authorized') return { ok: false, outcome: 'DENIED', reasonCode: 'collector_not_authorized', message };
  if (
    code === 'attestation_required' || code === 'collector_invalid' ||
    code === 'pickup_release_authority_required' || code === 'pickup_release_authority_revoked' ||
    code === 'pickup_app_admin_required' || code === 'pickup_provision_authority_required' ||
    code === 'pickup_receipt_unavailable' || code === 'pickup_cycle_not_found' ||
    code === 'invalid_pickup_request' || code === 'invalid_request'
  ) {
    return { ok: false, outcome: 'DENIED', reasonCode: code === 'invalid_request' ? 'invalid_pickup_request' : (code as PickupReasonCode), message };
  }
  if (code === 'outside_dismissal_window' || code === 'schedule_unavailable') {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: code, message, retryable: true };
  }
  if (
    code === 'attendance_ineligible' || code === 'attendance_absent' || code === 'attendance_excused' ||
    code === 'attendance_mark_missing' || code === 'attendance_mark_unknown' ||
    code === 'attendance_entry_missing_or_conflicting' || code === 'register_missing' ||
    code === 'register_not_submitted' || code === 'conflicting_registers' ||
    code === 'conflicting_effective_memberships' || code === 'responsible_teacher_unavailable'
  ) {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: code, message, retryable: true };
  }
  if (code === 'attendance_unavailable' || code === 'eligibility_unavailable') {
    return { ok: false, outcome: 'UNAVAILABLE', reasonCode: 'attendance_unavailable', message, retryable: true };
  }
  return { ok: false, outcome: 'UNKNOWN_OUTCOME', requestId, cycleId, reasonCode: 'unknown_outcome_verify_required', message, requiresAuthoritativeReadback: true };
}
