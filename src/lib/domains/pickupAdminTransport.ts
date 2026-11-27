import { supabase } from '../supabase.ts';
import { invokeTelegramPrivateOperation } from '../telegramPrivateOperations.ts';
import type {
  PickupAuthorizedCollectorSummary,
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
