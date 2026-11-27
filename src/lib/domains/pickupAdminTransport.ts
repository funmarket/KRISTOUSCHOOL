import { supabase } from '../supabase.ts';
import { invokeTelegramPrivateOperation } from '../telegramPrivateOperations.ts';
import type {
  PickupAuthorizedCollectorSummary,
  PickupOutboxFailureItem,
  PickupOutboxRetryResult,
  PickupOutboxSummary,
  PickupProvisionResult,
  PickupReasonCode,
  PickupReleaseAuthorityResult,
} from './pickupTypes.ts';
import {
  extractPickupErrorCode,
  ISO_DATE_RE,
  isTelegramRuntime,
  UUID_RE,
} from './pickupTransportErrors.ts';

function mapAdminErrorReason(code: string): PickupReasonCode {
  if (code === 'pickup_backend_unavailable' || code === 'backend_unavailable') return 'pickup_backend_unavailable';
  if (code === 'schedule_unavailable') return 'schedule_unavailable';
  if (code === 'pickup_provision_authority_required') return 'pickup_provision_authority_required';
  if (code === 'pickup_app_admin_required') return 'pickup_app_admin_required';
  if (code === 'release_authority_target_ineligible') return 'release_authority_target_ineligible';
  if (code === 'pickup_release_authority_already_revoked') return 'pickup_release_authority_already_revoked';
  if (code === 'pickup_release_authority_not_revoked') return 'pickup_release_authority_not_revoked';
  if (code === 'invalid_pickup_authority_request' || code === 'invalid_request') return 'invalid_pickup_authority_request';
  if (code === 'actor_unauthenticated' || code === 'actor_not_approved') return 'actor_not_authorized';
  return 'unknown_outcome_verify_required';
}

export async function fetchAuthorizedPickupCollectorsTransport(
  studentId: string,
  schoolDate?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupAuthorizedCollectorSummary[]> {
  if (!UUID_RE.test(studentId) || isTelegramRuntime()) return [];
  const client = clientOverride ?? supabase;
  if (!client || typeof client.rpc !== 'function') return [];
  try {
    const args: Record<string, string> = { p_student_id: studentId };
    if (schoolDate && ISO_DATE_RE.test(schoolDate)) args.p_school_date = schoolDate;
    const { data, error } = await client.rpc('list_authorized_pickup_persons', args);
    if (error || !Array.isArray(data)) return [];
    const out: PickupAuthorizedCollectorSummary[] = [];
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== 'string' || !r.id || typeof r.display_name !== 'string' || !r.display_name.trim()) continue;
      if (!r.verified_at) continue;
      out.push({
        collectorId: r.id,
        fullName: r.display_name.trim(),
        relationshipLabel: typeof r.relationship_label === 'string' ? r.relationship_label : '',
        status: 'ACTIVE',
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function provisionPickupCyclesTransport(
  schoolDate?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupProvisionResult> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0, errorCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.' };
  }
  const cleanDate = typeof schoolDate === 'string' && schoolDate.trim() ? schoolDate.trim() : null;
  if (cleanDate && !ISO_DATE_RE.test(cleanDate)) {
    return { ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0, errorCode: 'invalid_pickup_request', message: 'Invalid school date format.' };
  }
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>(
      'pickup.provision',
      cleanDate ? { schoolDate: cleanDate } : {},
      client,
    );
    let data: unknown;
    if (tg.handled) {
      data = tg.data;
    } else {
      if (!client || typeof client.rpc !== 'function') {
        return { ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0, errorCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.' };
      }
      const res = await client.rpc('provision_pickup_cycles', cleanDate ? { p_school_date: cleanDate } : {});
      if (res.error) {
        const { code, message } = extractPickupErrorCode(res.error);
        return { ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0, errorCode: mapAdminErrorReason(code), message };
      }
      data = res.data;
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0, errorCode: 'unknown_outcome_verify_required', message: 'Invalid provision response.' };
    }
    const obj = data as Record<string, unknown>;
    if (obj.ok !== true) {
      return { ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0, errorCode: 'schedule_unavailable', message: 'Cycle provisioning did not complete.' };
    }
    return {
      ok: true,
      schoolDate: typeof obj.schoolDate === 'string' ? obj.schoolDate : cleanDate,
      timezone: typeof obj.timezone === 'string' ? obj.timezone : 'Africa/Tunis',
      provisionedCount: typeof obj.provisionedCount === 'number' ? obj.provisionedCount : 0,
      skippedCount: typeof obj.skippedCount === 'number' ? obj.skippedCount : 0,
    };
  } catch (err) {
    const { code, message } = extractPickupErrorCode(err);
    return { ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0, errorCode: mapAdminErrorReason(code), message };
  }
}

async function runReleaseAuthorityChange(
  action: 'revoke' | 'reinstate',
  targetUserId: string,
  reason: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupReleaseAuthorityResult> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, targetUserId, isRevoked: null, errorCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.' };
  }
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!UUID_RE.test(targetUserId) || trimmedReason.length < 3 || trimmedReason.length > 500) {
    return { ok: false, targetUserId, isRevoked: null, errorCode: 'invalid_pickup_authority_request', message: 'A valid target user ID and reason (3-500 characters) are required.' };
  }
  const tgOp = action === 'revoke' ? 'pickup.revokeRelease' : 'pickup.reinstateRelease';
  const rpcFn = action === 'revoke' ? 'revoke_pickup_release_authority' : 'reinstate_pickup_release_authority';
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>(tgOp, { targetUserId, reason: trimmedReason }, client);
    let data: unknown;
    if (tg.handled) {
      data = tg.data;
    } else {
      if (!client || typeof client.rpc !== 'function') {
        return { ok: false, targetUserId, isRevoked: null, errorCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.' };
      }
      const res = await client.rpc(rpcFn, { p_target_user_id: targetUserId, p_reason: trimmedReason });
      if (res.error) {
        const { code, message } = extractPickupErrorCode(res.error);
        return { ok: false, targetUserId, isRevoked: null, errorCode: mapAdminErrorReason(code), message };
      }
      data = res.data;
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, targetUserId, isRevoked: null, errorCode: 'unknown_outcome_verify_required', message: 'Invalid authority update response.' };
    }
    const obj = data as Record<string, unknown>;
    return {
      ok: true,
      targetUserId: typeof obj.targetUserId === 'string' ? obj.targetUserId : targetUserId,
      isRevoked: typeof obj.isRevoked === 'boolean' ? obj.isRevoked : action === 'revoke',
      version: typeof obj.version === 'number' ? obj.version : undefined,
      effectiveAt: typeof obj.effectiveAt === 'string' ? obj.effectiveAt : undefined,
    };
  } catch (err) {
    const { code, message } = extractPickupErrorCode(err);
    return { ok: false, targetUserId, isRevoked: null, errorCode: mapAdminErrorReason(code), message };
  }
}

export const revokePickupReleaseAuthorityTransport = (
  targetUserId: string,
  reason: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
) => runReleaseAuthorityChange('revoke', targetUserId, reason, clientOverride);

export const reinstatePickupReleaseAuthorityTransport = (
  targetUserId: string,
  reason: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
) => runReleaseAuthorityChange('reinstate', targetUserId, reason, clientOverride);

const emptyOutboxSummary = (errorCode?: PickupReasonCode, message?: string): PickupOutboxSummary => ({
  ok: false,
  pendingCount: 0,
  retryCount: 0,
  processingCount: 0,
  sentCount: 0,
  failedCount: 0,
  totalCount: 0,
  oldestPendingAt: null,
  lastSentAt: null,
  recentFailures: [],
  errorCode,
  message,
});

function toFailureItem(raw: unknown): PickupOutboxFailureItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.eventType !== 'string') return null;
  return {
    id: r.id,
    eventType: r.eventType,
    attemptCount: typeof r.attemptCount === 'number' ? r.attemptCount : 0,
    lastError: typeof r.lastError === 'string' ? r.lastError : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
  };
}

export async function getPickupOutboxSummaryTransport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupOutboxSummary> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return emptyOutboxSummary('pickup_backend_unavailable', 'Pickup backend client is unavailable.');
  }
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.outboxSummary', {}, client);
    let data: unknown;
    if (tg.handled) {
      data = tg.data;
    } else {
      if (!client || typeof client.rpc !== 'function') {
        return emptyOutboxSummary('pickup_backend_unavailable', 'Pickup backend client is unavailable.');
      }
      const res = await client.rpc('get_pickup_outbox_summary');
      if (res.error) {
        const { code, message } = extractPickupErrorCode(res.error);
        return emptyOutboxSummary(mapAdminErrorReason(code), message);
      }
      data = res.data;
    }
    if (!data || typeof data !== 'object') {
      return emptyOutboxSummary('unknown_outcome_verify_required', 'Invalid outbox summary response.');
    }
    const obj = data as Record<string, unknown>;
    const failures = Array.isArray(obj.recentFailures)
      ? obj.recentFailures.map(toFailureItem).filter((item): item is PickupOutboxFailureItem => Boolean(item))
      : [];
    return {
      ok: obj.ok === true,
      pendingCount: typeof obj.pendingCount === 'number' ? obj.pendingCount : 0,
      retryCount: typeof obj.retryCount === 'number' ? obj.retryCount : 0,
      processingCount: typeof obj.processingCount === 'number' ? obj.processingCount : 0,
      sentCount: typeof obj.sentCount === 'number' ? obj.sentCount : 0,
      failedCount: typeof obj.failedCount === 'number' ? obj.failedCount : 0,
      totalCount: typeof obj.totalCount === 'number' ? obj.totalCount : 0,
      oldestPendingAt: typeof obj.oldestPendingAt === 'string' ? obj.oldestPendingAt : null,
      lastSentAt: typeof obj.lastSentAt === 'string' ? obj.lastSentAt : null,
      recentFailures: failures,
    };
  } catch (err) {
    const { code, message } = extractPickupErrorCode(err);
    return emptyOutboxSummary(mapAdminErrorReason(code), message);
  }
}

export async function retryFailedPickupNotificationsTransport(
  requestId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<PickupOutboxRetryResult> {
  const client = clientOverride ?? supabase;
  if (!client && !isTelegramRuntime()) {
    return { ok: false, retriedCount: 0, requestId, errorCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.' };
  }
  if (!UUID_RE.test(requestId)) {
    return { ok: false, retriedCount: 0, requestId, errorCode: 'invalid_pickup_request', message: 'Valid request ID is required.' };
  }
  try {
    const tg = await invokeTelegramPrivateOperation<unknown>('pickup.retryOutbox', { requestId }, client);
    let data: unknown;
    if (tg.handled) {
      data = tg.data;
    } else {
      if (!client || typeof client.rpc !== 'function') {
        return { ok: false, retriedCount: 0, requestId, errorCode: 'pickup_backend_unavailable', message: 'Pickup backend client is unavailable.' };
      }
      const res = await client.rpc('retry_failed_pickup_notifications', { p_request_id: requestId });
      if (res.error) {
        const { code, message } = extractPickupErrorCode(res.error);
        const mapped = code === 'idempotency_conflict' ? 'idempotency_conflict' : mapAdminErrorReason(code);
        return { ok: false, retriedCount: 0, requestId, errorCode: mapped, message };
      }
      data = res.data;
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, retriedCount: 0, requestId, errorCode: 'unknown_outcome_verify_required', message: 'Invalid outbox retry response.' };
    }
    const obj = data as Record<string, unknown>;
    return {
      ok: obj.ok === true,
      retriedCount: typeof obj.retriedCount === 'number' ? obj.retriedCount : 0,
      requestId: typeof obj.requestId === 'string' ? obj.requestId : requestId,
      replayed: obj.replayed === true,
    };
  } catch (err) {
    const { code, message } = extractPickupErrorCode(err);
    const mapped = code === 'idempotency_conflict' ? 'idempotency_conflict' : mapAdminErrorReason(code);
    return { ok: false, retriedCount: 0, requestId, errorCode: mapped, message };
  }
}

