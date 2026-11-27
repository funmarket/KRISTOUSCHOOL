import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import type { AccountRole, BackendOpStatus, User } from '../types.ts';
import { isMatchingApprovedAccountContext, type AccountIdentityContext } from '../lib/appStateGuards.ts';
import {
  createPickupRequestId,
  getPickupOutboxSummary as defaultGetPickupOutboxSummary,
  PICKUP_BACKEND_UNAVAILABLE_CODE,
  provisionPickupCycles as defaultProvisionPickupCycles,
  reinstatePickupReleaseAuthority as defaultReinstateReleaseAuthority,
  retryFailedPickupNotifications as defaultRetryFailedPickupNotifications,
  revokePickupReleaseAuthority as defaultRevokeReleaseAuthority,
  type PickupCommandOutcome,
  type PickupOutboxRetryResult,
  type PickupOutboxSummary,
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
  action: 'PROVISION' | 'REVOKE' | 'REINSTATE' | 'RETRY_OUTBOX';
  errorCode?: PickupReasonCode;
  provisionedCount?: number;
  skippedCount?: number;
  retriedCount?: number;
  schoolDate?: string | null;
  message?: string;
}

export interface UsePickupAdminAdapters {
  provisionCycles?: (schoolDate?: string | null) => Promise<PickupProvisionResult>;
  revokeReleaseAuthority?: (targetUserId: string, reason: string) => Promise<PickupReleaseAuthorityResult>;
  reinstateReleaseAuthority?: (targetUserId: string, reason: string) => Promise<PickupReleaseAuthorityResult>;
  getOutboxSummary?: () => Promise<PickupOutboxSummary>;
  retryFailedOutbox?: (requestId: string) => Promise<PickupOutboxRetryResult>;
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

const emptyDeniedSummary = (errorCode: PickupReasonCode, message: string): PickupOutboxSummary => ({
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
  const outboxSummaryFn = adapters?.getOutboxSummary ?? defaultGetPickupOutboxSummary;
  const retryOutboxFn = adapters?.retryFailedOutbox ?? defaultRetryFailedPickupNotifications;

  const [isProvisioningPickup, setIsProvisioningPickup] = useState(false);
  const [isUpdatingReleaseAuthority, setIsUpdatingReleaseAuthority] = useState(false);
  const [pickupAdminNotice, setPickupAdminNotice] = useState<PickupAdminNotice | null>(null);
  const [pickupOutboxSummary, setPickupOutboxSummary] = useState<PickupOutboxSummary | null>(null);
  const [isLoadingPickupOutbox, setIsLoadingPickupOutbox] = useState(false);
  const [isRetryingPickupOutbox, setIsRetryingPickupOutbox] = useState(false);

  const clearPickupAdminState = useCallback(() => {
    setIsProvisioningPickup(false);
    setIsUpdatingReleaseAuthority(false);
    setPickupAdminNotice(null);
    setPickupOutboxSummary(null);
    setIsLoadingPickupOutbox(false);
    setIsRetryingPickupOutbox(false);
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

  const refreshPickupOutboxSummary = useCallback(async (): Promise<PickupOutboxSummary> => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED' || currentUser.role !== 'APP_ADMIN') {
      return emptyDeniedSummary('pickup_app_admin_required', 'Only APP_ADMIN can inspect pickup notification outbox health.');
    }
    const origin = getCurrentIdentity();
    if (effectiveMountedRef.current) setIsLoadingPickupOutbox(true);
    try {
      const res = await outboxSummaryFn();
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
        return emptyDeniedSummary('session_changed', 'Account session changed.');
      }
      if (res.ok) {
        setPickupOutboxSummary(res);
      }
      return res;
    } finally {
      if (effectiveMountedRef.current) setIsLoadingPickupOutbox(false);
    }
  }, [currentUser, effectiveMountedRef, getCurrentIdentity, outboxSummaryFn]);

  const retryFailedPickupOutbox = useCallback(async (): Promise<PickupOutboxRetryResult> => {
    const requestId = createPickupRequestId();
    if (!currentUser || currentUser.accountStatus !== 'APPROVED' || currentUser.role !== 'APP_ADMIN') {
      const denied: PickupOutboxRetryResult = {
        ok: false,
        retriedCount: 0,
        requestId,
        errorCode: 'pickup_app_admin_required',
        message: 'Only APP_ADMIN can retry failed pickup notifications.',
      };
      if (effectiveMountedRef.current) {
        setPickupAdminNotice({ ok: false, action: 'RETRY_OUTBOX', errorCode: denied.errorCode, message: denied.message });
      }
      return denied;
    }
    const origin = getCurrentIdentity();
    if (effectiveMountedRef.current) setIsRetryingPickupOutbox(true);
    try {
      const res = await retryOutboxFn(requestId);
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current)) {
        return { ok: false, retriedCount: 0, requestId, errorCode: 'session_changed', message: 'Account session changed.' };
      }
      setPickupAdminNotice({
        ok: res.ok,
        action: 'RETRY_OUTBOX',
        retriedCount: res.retriedCount,
        errorCode: res.errorCode,
        message: res.message,
      });
      if (res.ok) {
        const refreshed = await outboxSummaryFn();
        if (isMatchingApprovedAccountContext(origin, getCurrentIdentity(), effectiveMountedRef.current) && refreshed.ok) {
          setPickupOutboxSummary(refreshed);
        }
        await refreshPickupBoardForUser(currentUser);
      }
      return res;
    } finally {
      if (effectiveMountedRef.current) setIsRetryingPickupOutbox(false);
    }
  }, [currentUser, effectiveMountedRef, getCurrentIdentity, outboxSummaryFn, refreshPickupBoardForUser, retryOutboxFn]);

  return useMemo(
    () => ({
      isProvisioningPickup,
      isUpdatingReleaseAuthority,
      pickupAdminNotice,
      pickupOutboxSummary,
      isLoadingPickupOutbox,
      isRetryingPickupOutbox,
      provisionTodayPickupCycles,
      revokePickupReleaseAuthority,
      reinstatePickupReleaseAuthority,
      refreshPickupOutboxSummary,
      retryFailedPickupOutbox,
      clearPickupAdminState,
    }),
    [
      clearPickupAdminState,
      isLoadingPickupOutbox,
      isProvisioningPickup,
      isRetryingPickupOutbox,
      isUpdatingReleaseAuthority,
      pickupAdminNotice,
      pickupOutboxSummary,
      provisionTodayPickupCycles,
      refreshPickupOutboxSummary,
      reinstatePickupReleaseAuthority,
      retryFailedPickupOutbox,
      revokePickupReleaseAuthority,
    ],
  );
}
