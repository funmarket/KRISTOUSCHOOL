import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { BackendOpResult, NotificationItem } from '../types';
import {
  listMyNotifications,
  markAllNotificationsReadOnServer,
  markNotificationReadOnServer,
} from '../lib/domains/notifications';
import {
  applyAllNotificationsOptimisticRead,
  applySingleNotificationOptimisticRead,
  captureNotificationReadSnapshot,
  isMatchingApprovedAccountContext,
  mergeRefreshedNotifications,
  reconcileFailedMarkAllNotificationsRead,
  reconcileFailedSingleNotificationRead,
  type AccountIdentityContext,
  type PendingNotificationSnapshot,
} from '../lib/appStateGuards';

export interface NotificationContextType {
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  notificationsError: string | null;
  markingNotificationIds: string[];
  markingAllNotifications: boolean;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  syncNotificationsIdentity: (identity: AccountIdentityContext) => void;
  hydrateNotificationsForAccount: (origin: AccountIdentityContext) => Promise<void>;
  resetNotificationTracking: () => void;
  clearNotificationsState: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{
  children: React.ReactNode;
  initialIdentity?: AccountIdentityContext;
}> = ({ children, initialIdentity }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [markingNotificationIds, setMarkingNotificationIds] = useState<string[]>([]);
  const [markingAllNotifications, setMarkingAllNotifications] = useState<boolean>(false);

  const mountedRef = useRef<boolean>(true);
  const identityRef = useRef<AccountIdentityContext>(
    initialIdentity ?? { userId: null, accountStatus: null, generation: 1 },
  );
  const notificationsRef = useRef<NotificationItem[]>([]);
  const notifSeqRef = useRef<number>(0);
  const inFlightSingleReadsRef = useRef<Set<string>>(new Set());
  const pendingNotificationSnapshotsRef = useRef<Map<number, PendingNotificationSnapshot>>(new Map());
  const pendingMarkAllReadsRef = useRef<Map<number, ReadonlySet<string>>>(new Map());
  const confirmedReadSeqByIdRef = useRef<Map<string, number>>(new Map());
  const latestMarkAllConfirmedSeqRef = useRef<number>(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateNotificationsState = useCallback(
    (updater: NotificationItem[] | ((prev: NotificationItem[]) => NotificationItem[])) => {
      const next = typeof updater === 'function' ? updater(notificationsRef.current) : updater;
      notificationsRef.current = next;
      setNotifications(next);
    },
    [],
  );

  const mergeWithPending = useCallback(
    (items: NotificationItem[]) =>
      mergeRefreshedNotifications(
        items,
        inFlightSingleReadsRef.current,
        pendingMarkAllReadsRef.current,
        confirmedReadSeqByIdRef.current,
      ),
    [],
  );

  const resetNotificationTracking = useCallback(() => {
    inFlightSingleReadsRef.current.clear();
    pendingMarkAllReadsRef.current.clear();
    pendingNotificationSnapshotsRef.current.clear();
    confirmedReadSeqByIdRef.current.clear();
    latestMarkAllConfirmedSeqRef.current = 0;
    setMarkingNotificationIds([]);
    setMarkingAllNotifications(false);
  }, []);

  const clearNotificationsState = useCallback(() => {
    resetNotificationTracking();
    updateNotificationsState([]);
    setNotificationsError(null);
  }, [resetNotificationTracking, updateNotificationsState]);

  const syncNotificationsIdentity = useCallback(
    (identity: AccountIdentityContext) => {
      const prev = identityRef.current;
      const changed =
        prev.generation !== identity.generation ||
        prev.userId !== identity.userId ||
        prev.accountStatus !== identity.accountStatus;
      identityRef.current = identity;
      if (changed) {
        notifSeqRef.current += 1;
        clearNotificationsState();
      }
    },
    [clearNotificationsState],
  );

  const hydrateNotificationsForAccount = useCallback(
    async (origin: AccountIdentityContext) => {
      if (!origin.userId || origin.accountStatus !== 'APPROVED') return;
      syncNotificationsIdentity(origin);
      setNotificationsError(null);
      const notifRes = await listMyNotifications();
      if (!isMatchingApprovedAccountContext(origin, identityRef.current, mountedRef.current)) return;
      if (notifRes.ok && notifRes.data) {
        updateNotificationsState(mergeWithPending(notifRes.data));
        setNotificationsError(null);
      } else if (notifRes.status === 'UNAUTHORIZED') {
        updateNotificationsState([]);
        setNotificationsError(
          notifRes.errorMessage || notifRes.errorCode || 'Not authorized to load notifications.',
        );
      } else if (!notifRes.ok && notifRes.status !== 'BLOCKED_BACKEND') {
        setNotificationsError(
          notifRes.errorMessage || notifRes.errorCode || 'Unable to load notifications.',
        );
      }
    },
    [mergeWithPending, syncNotificationsIdentity, updateNotificationsState],
  );

  const reconcileNotificationsFromServer = useCallback(
    async (origin: AccountIdentityContext) => {
      try {
        const readback = await listMyNotifications();
        if (!isMatchingApprovedAccountContext(origin, identityRef.current, mountedRef.current)) return;
        if (readback.ok && readback.data) {
          updateNotificationsState(mergeWithPending(readback.data));
        }
      } catch {
        // Keep deterministic local reconciliation state if readback cannot complete.
      }
    },
    [mergeWithPending, updateNotificationsState],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      const current = identityRef.current;
      if (!current.userId || current.accountStatus !== 'APPROVED') return;

      const origin: AccountIdentityContext = { ...current };
      const requestSeq = ++notifSeqRef.current;
      const snapshot = captureNotificationReadSnapshot(
        notificationsRef.current,
        [id],
        pendingNotificationSnapshotsRef.current.values(),
        origin,
        requestSeq,
      );
      pendingNotificationSnapshotsRef.current.set(requestSeq, snapshot);
      inFlightSingleReadsRef.current.add(id);
      setMarkingNotificationIds([...inFlightSingleReadsRef.current]);
      setNotificationsError(null);
      updateNotificationsState((prev) => applySingleNotificationOptimisticRead(prev, id));

      void (async () => {
        let res: BackendOpResult<boolean>;
        try {
          res = await markNotificationReadOnServer(id);
        } catch (err) {
          res = {
            ok: false,
            status: 'ERROR',
            errorCode: 'notification_mark_failed',
            errorMessage: err instanceof Error ? err.message : 'Unable to update notification status.',
          };
        }

        if (!isMatchingApprovedAccountContext(origin, identityRef.current, mountedRef.current)) return;

        pendingNotificationSnapshotsRef.current.delete(requestSeq);
        inFlightSingleReadsRef.current.delete(id);
        setMarkingNotificationIds([...inFlightSingleReadsRef.current]);

        if (res.ok) {
          const prevSeq = confirmedReadSeqByIdRef.current.get(id) ?? 0;
          if (requestSeq > prevSeq) confirmedReadSeqByIdRef.current.set(id, requestSeq);
          updateNotificationsState((prev) => mergeWithPending(prev));
          return;
        }

        updateNotificationsState((prev) =>
          mergeWithPending(
            reconcileFailedSingleNotificationRead(
              prev,
              snapshot,
              identityRef.current,
              confirmedReadSeqByIdRef.current,
              latestMarkAllConfirmedSeqRef.current,
              mountedRef.current,
            ).notifications,
          ),
        );

        if (res.status !== 'BLOCKED_BACKEND') {
          setNotificationsError(res.errorMessage || res.errorCode || 'Unable to update notification status.');
          if (res.status !== 'UNAUTHORIZED') await reconcileNotificationsFromServer(origin);
        }
      })();
    },
    [mergeWithPending, reconcileNotificationsFromServer, updateNotificationsState],
  );

  const markAllNotificationsRead = useCallback(() => {
    const current = identityRef.current;
    if (!current.userId || current.accountStatus !== 'APPROVED') return;

    const origin: AccountIdentityContext = { ...current };
    const requestSeq = ++notifSeqRef.current;
    const snapshot = captureNotificationReadSnapshot(
      notificationsRef.current,
      notificationsRef.current.map((item) => item.id),
      pendingNotificationSnapshotsRef.current.values(),
      origin,
      requestSeq,
    );
    pendingNotificationSnapshotsRef.current.set(requestSeq, snapshot);
    pendingMarkAllReadsRef.current.set(requestSeq, new Set(snapshot.targetIds));
    setMarkingAllNotifications(true);
    setNotificationsError(null);
    updateNotificationsState((prev) => applyAllNotificationsOptimisticRead(prev).nextNotifications);

    void (async () => {
      let res: BackendOpResult<number>;
      try {
        res = await markAllNotificationsReadOnServer();
      } catch (err) {
        res = {
          ok: false,
          status: 'ERROR',
          errorCode: 'notifications_mark_all_failed',
          errorMessage: err instanceof Error ? err.message : 'Unable to mark notifications read.',
        };
      }

      if (!isMatchingApprovedAccountContext(origin, identityRef.current, mountedRef.current)) return;

      pendingNotificationSnapshotsRef.current.delete(requestSeq);
      pendingMarkAllReadsRef.current.delete(requestSeq);
      setMarkingAllNotifications(pendingMarkAllReadsRef.current.size > 0);

      if (res.ok) {
        for (const id of snapshot.targetIds) {
          confirmedReadSeqByIdRef.current.set(
            id,
            Math.max(requestSeq, confirmedReadSeqByIdRef.current.get(id) ?? 0),
          );
        }
        if (requestSeq > latestMarkAllConfirmedSeqRef.current) {
          latestMarkAllConfirmedSeqRef.current = requestSeq;
        }
        updateNotificationsState((prev) => mergeWithPending(prev));
        return;
      }

      updateNotificationsState((prev) =>
        mergeWithPending(
          reconcileFailedMarkAllNotificationsRead(
            prev,
            snapshot,
            identityRef.current,
            confirmedReadSeqByIdRef.current,
            latestMarkAllConfirmedSeqRef.current,
            mountedRef.current,
          ).notifications,
        ),
      );

      if (res.status !== 'BLOCKED_BACKEND') {
        setNotificationsError(res.errorMessage || res.errorCode || 'Unable to mark notifications read.');
        if (res.status !== 'UNAUTHORIZED') await reconcileNotificationsFromServer(origin);
      }
    })();
  }, [mergeWithPending, reconcileNotificationsFromServer, updateNotificationsState]);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadNotificationsCount,
        notificationsError,
        markingNotificationIds,
        markingAllNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        syncNotificationsIdentity,
        hydrateNotificationsForAccount,
        resetNotificationTracking,
        clearNotificationsState,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
