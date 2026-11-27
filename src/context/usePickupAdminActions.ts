import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import type { AccountRole, BackendOpStatus, User } from '../types.ts';
import { isMatchingApprovedAccountContext, type AccountIdentityContext } from '../lib/appStateGuards.ts';
import {
  PICKUP_BACKEND_UNAVAILABLE_CODE,
  provisionPickupCycles as defaultProvisionPickupCycles,
  reinstatePickupReleaseAuthority as defaultReinstateReleaseAuthority,
  revokePickupReleaseAuthority as defaultRevokeReleaseAuthority,
  type PickupCommandOutcome,
  type PickupProvisionResult,
  type PickupReadResult,
  type PickupReasonCode,
  type PickupReleaseAuthorityResult,
} from '../lib/domains/pickup.ts';

export interface PickupMutationResponse {
  success: boolean;
  status: BackendOpStatus;
  outcome: PickupCommandOutcome['outcome'];
  error?: string;
  errorCode?: PickupReasonCode;
  commandOutcome: PickupCommandOutcome;
}

export interface PickupAdminNotice {
  ok: boolean;
  action: 'PROVISION' | 'REVOKE' | 'REINSTATE';
  errorCode?: PickupReasonCode;
  provisionedCount?: number;
  skippedCount?: number;
  schoolDate?: string | null;
  message?: string;
}

export interface UsePickupAdminAdapters {
  provisionCycles?: (schoolDate?: string | null) => Promise<PickupProvisionResult>;
  revokeReleaseAuthority?: (targetUserId: string, reason: string) => Promise<PickupReleaseAuthorityResult>;
  reinstateReleaseAuthority?: (targetUserId: string, reason: string) => Promise<PickupReleaseAuthorityResult>;
}

export function toPickupMutationResponse(outcome: PickupCommandOutcome): PickupMutationResponse {
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

const canProvisionRole = (role: AccountRole | null | undefined): boolean =>
  role === 'APP_ADMIN' || role === 'MANAGER' || role === 'ADMINISTRATIVE_PERSONNEL';

export function usePickupAdminActions(params: {
  currentUser: User | null;
  getCurrentIdentity: () => AccountIdentityContext;
  effectiveMountedRef: React.MutableRefObject<boolean>;
  refreshPickupBoardForUser: (targetUser: User | null | undefined, classId?: string | null) => Promise<PickupReadResult>;
  adapters?: UsePickupAdminAdapters;
}) {
  const { currentUser, getCurrentIdentity, effectiveMountedRef, refreshPickupBoardForUser, adapters } = params;
  const provisionFn = adapters?.provisionCycles ?? defaultProvisionPickupCycles;
  const revokeFn = adapters?.revokeReleaseAuthority ?? defaultRevokeReleaseAuthority;
  const reinstateFn = adapters?.reinstateReleaseAuthority ?? defaultReinstateReleaseAuthority;

  const [isProvisioningPickup, setIsProvisioningPickup] = useState(false);
  const [isUpdatingReleaseAuthority, setIsUpdatingReleaseAuthority] = useState(false);
  const [pickupAdminNotice, setPickupAdminNotice] = useState<PickupAdminNotice | null>(null);

  const clearPickupAdminState = useCallback(() => {
    setIsProvisioningPickup(false);
    setIsUpdatingReleaseAuthority(false);
    setPickupAdminNotice(null);
  }, []);

  const provisionTodayPickupCycles = useCallback(
    async (schoolDate?: string | null): Promise<PickupProvisionResult> => {
      if (!currentUser || currentUser.accountStatus !== 'APPROVED' || !canProvisionRole(currentUser.role)) {
        const denied: PickupProvisionResult = {
          ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0,
          errorCode: 'pickup_provision_authority_required', message: 'Provisioning requires APP_ADMIN, MANAGER, or ADMINISTRATIVE_PERSONNEL role.',
        };
        if (effectiveMountedRef.current) {
          setPickupAdminNotice({ ok: false, action: 'PROVISION', errorCode: denied.errorCode, message: denied.message });
        }
        return denied;
      }
      const origin = getCurrentIdentity();
      if (effectiveMountedRef.current) setIsProvisioningPickup(true);
      try {
        const res = await provisionFn(schoolDate ?? null);
        if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
          return { ok: false, schoolDate: null, timezone: null, provisionedCount: 0, skippedCount: 0, errorCode: 'session_changed', message: 'Account session changed.' };
        }
        setPickupAdminNotice({
          ok: res.ok, action: 'PROVISION', errorCode: res.errorCode,
          provisionedCount: res.provisionedCount, skippedCount: res.skippedCount,
          schoolDate: res.schoolDate, message: res.message,
        });
        if (res.ok) await refreshPickupBoardForUser(currentUser);
        return res;
      } finally {
        if (effectiveMountedRef.current) setIsProvisioningPickup(false);
      }
    },
    [currentUser, effectiveMountedRef, getCurrentIdentity, provisionFn, refreshPickupBoardForUser],
  );

  const updateAuthority = useCallback(
    async (action: 'REVOKE' | 'REINSTATE', targetUserId: string, reason: string): Promise<PickupReleaseAuthorityResult> => {
      if (!currentUser || currentUser.accountStatus !== 'APPROVED' || currentUser.role !== 'APP_ADMIN') {
        const denied: PickupReleaseAuthorityResult = {
          ok: false, targetUserId, isRevoked: null, errorCode: 'pickup_app_admin_required',
          message: 'Only APP_ADMIN can revoke or reinstate pickup release authority.',
        };
        if (effectiveMountedRef.current) {
          setPickupAdminNotice({ ok: false, action, errorCode: denied.errorCode, message: denied.message });
        }
        return denied;
      }
      const origin = getCurrentIdentity();
      if (effectiveMountedRef.current) setIsUpdatingReleaseAuthority(true);
      try {
        const res = action === 'REVOKE' ? await revokeFn(targetUserId, reason) : await reinstateFn(targetUserId, reason);
        if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
          return { ok: false, targetUserId, isRevoked: null, errorCode: 'session_changed', message: 'Account session changed.' };
        }
        setPickupAdminNotice({ ok: res.ok, action, errorCode: res.errorCode, message: res.message });
        if (res.ok) await refreshPickupBoardForUser(currentUser);
        return res;
      } finally {
        if (effectiveMountedRef.current) setIsUpdatingReleaseAuthority(false);
      }
    },
    [currentUser, effectiveMountedRef, getCurrentIdentity, refreshPickupBoardForUser, reinstateFn, revokeFn],
  );

  const revokePickupReleaseAuthority = useCallback(
    (targetUserId: string, reason: string) => updateAuthority('REVOKE', targetUserId, reason),
    [updateAuthority],
  );

  const reinstatePickupReleaseAuthority = useCallback(
    (targetUserId: string, reason: string) => updateAuthority('REINSTATE', targetUserId, reason),
    [updateAuthority],
  );

  return useMemo(
    () => ({
      isProvisioningPickup,
      isUpdatingReleaseAuthority,
      pickupAdminNotice,
      provisionTodayPickupCycles,
      revokePickupReleaseAuthority,
      reinstatePickupReleaseAuthority,
      clearPickupAdminState,
    }),
    [
      clearPickupAdminState,
      isProvisioningPickup,
      isUpdatingReleaseAuthority,
      pickupAdminNotice,
      provisionTodayPickupCycles,
      reinstatePickupReleaseAuthority,
      revokePickupReleaseAuthority,
    ],
  );
}
