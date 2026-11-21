import React, { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { BackendOpResult, NotificationItem, User } from '../types';
import {
  listMyNotifications, markNotificationReadOnServer, markAllNotificationsReadOnServer,
} from '../lib/domains/notifications';
import {
  applyAllNotificationsOptimisticRead, applySingleNotificationOptimisticRead,
  captureNotificationReadSnapshot, isMatchingApprovedAccountContext,
  mergeRefreshedNotifications, reconcileFailedMarkAllNotificationsRead,
  reconcileFailedSingleNotificationRead,
  type AccountIdentityContext, type PendingNotificationSnapshot,
} from '../lib/appStateGuards';

export interface NotificationIdentityAccess {
  readonly generation: number;
  getUser: () => User | null;
  getIdentity: () => AccountIdentityContext;
  isMounted: () => boolean;
}
export interface NotificationServices {
  listMyNotifications: () => ReturnType<typeof listMyNotifications>;
  markNotificationReadOnServer: (id: string) => ReturnType<typeof markNotificationReadOnServer>;
  markAllNotificationsReadOnServer: () => ReturnType<typeof markAllNotificationsReadOnServer>;
}
export interface NotificationActions {
  hydrate: (isStillValid: () => boolean) => Promise<void>;
  clear: () => void;
}
export interface NotificationContextValue extends NotificationActions {
  notifications: NotificationItem[];
  notificationsError: string | null;
  markingNotificationIds: string[];
  markingAllNotifications: boolean;
  unreadNotificationsCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}
const NotificationContext = createContext<NotificationContextValue | null>(null);
const defaultServices: NotificationServices = {
  listMyNotifications, markNotificationReadOnServer, markAllNotificationsReadOnServer,
};

export const NotificationProvider: React.FC<{
  children: React.ReactNode;
  identity: NotificationIdentityAccess;
  services?: NotificationServices;
  onRegister?: (actions: NotificationActions | null) => void;
}> = ({ children, identity, services = defaultServices, onRegister }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [markingNotificationIds, setMarkingNotificationIds] = useState<string[]>([]);
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
  const notificationsRef = useRef<NotificationItem[]>([]);
  const notifSeqRef = useRef(0);
  const inFlightSingleReadsRef = useRef<Set<string>>(new Set());
  const pendingNotificationSnapshotsRef = useRef<Map<number, PendingNotificationSnapshot>>(new Map());
  const pendingMarkAllReadsRef = useRef<Map<number, ReadonlySet<string>>>(new Map());
  const confirmedReadSeqByIdRef = useRef<Map<string, number>>(new Map());
  const latestMarkAllConfirmedSeqRef = useRef(0);

  const updateNotificationsState = useCallback(
    (updater: NotificationItem[] | ((prev: NotificationItem[]) => NotificationItem[])) => {
      setNotifications((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        notificationsRef.current = next;
        return next;
      });
    }, [],
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
  const clear = useCallback(() => {
    resetNotificationTracking();
    updateNotificationsState([]);
    setNotificationsError(null);
  }, [resetNotificationTracking, updateNotificationsState]);

  useLayoutEffect(() => { clear(); }, [identity.generation, clear]);
  const hydrate = async (isStillValid: () => boolean): Promise<void> => {
    const origin = identity.getIdentity();
    setNotificationsError(null);
    const res = await services.listMyNotifications();
    if (!isStillValid() ||
      !isMatchingApprovedAccountContext(origin, identity.getIdentity(), identity.isMounted())) return;
    if (res.ok && res.data) {
      updateNotificationsState(mergeRefreshedNotifications(
        res.data, inFlightSingleReadsRef.current,
        pendingMarkAllReadsRef.current, confirmedReadSeqByIdRef.current,
      ));
      setNotificationsError(null);
    } else if (res.status === 'UNAUTHORIZED') {
      updateNotificationsState([]);
      setNotificationsError(res.errorMessage || res.errorCode || 'Not authorized to load notifications.');
    } else if (!res.ok && res.status !== 'BLOCKED_BACKEND') {
      setNotificationsError(res.errorMessage || res.errorCode || 'Unable to load notifications.');
    }
  };

  const reconcileNotificationsFromServer = async (origin: AccountIdentityContext) => {
    try {
      const readback = await services.listMyNotifications();
      if (!isMatchingApprovedAccountContext(origin, identity.getIdentity(), identity.isMounted())) {
        return;
      }
      if (readback.ok && readback.data) {
        updateNotificationsState(
          mergeRefreshedNotifications(
            readback.data,
            inFlightSingleReadsRef.current,
            pendingMarkAllReadsRef.current,
            confirmedReadSeqByIdRef.current,
          ),
        );
      }
    } catch {
      // Keep the deterministic local reconciliation state if readback itself cannot complete.
    }
  };

  const markNotificationRead = (id: string) => {
    const user = identity.getUser();
    if (!user || user.accountStatus !== 'APPROVED' || user.id !== identity.getIdentity().userId) return;

    const origin: AccountIdentityContext = {
      userId: user.id,
      accountStatus: user.accountStatus,
      generation: identity.getIdentity().generation,
    };
    const requestSeq = ++notifSeqRef.current;
    const snapshot = captureNotificationReadSnapshot(
      notificationsRef.current, [id], pendingNotificationSnapshotsRef.current.values(), origin, requestSeq,
    );
    pendingNotificationSnapshotsRef.current.set(requestSeq, snapshot);

    inFlightSingleReadsRef.current.add(id);
    setMarkingNotificationIds(Array.from(inFlightSingleReadsRef.current));
    setNotificationsError(null);
    updateNotificationsState((prev) => applySingleNotificationOptimisticRead(prev, id));

    void (async () => {
      let res: BackendOpResult<boolean>;
      try {
        res = await services.markNotificationReadOnServer(id);
      } catch (err) {
        res = {
          ok: false,
          status: 'ERROR',
          errorCode: 'notification_mark_failed',
          errorMessage: err instanceof Error ? err.message : 'Unable to update notification status.',
        };
      }

      if (!isMatchingApprovedAccountContext(origin, identity.getIdentity(), identity.isMounted())) {
        return;
      }

      pendingNotificationSnapshotsRef.current.delete(requestSeq);
      inFlightSingleReadsRef.current.delete(id);
      setMarkingNotificationIds(Array.from(inFlightSingleReadsRef.current));

      if (res.ok) {
        const prevSeq = confirmedReadSeqByIdRef.current.get(id) ?? 0;
        if (requestSeq > prevSeq) {
          confirmedReadSeqByIdRef.current.set(id, requestSeq);
        }
        updateNotificationsState((prev) => mergeRefreshedNotifications(
          prev, inFlightSingleReadsRef.current, pendingMarkAllReadsRef.current, confirmedReadSeqByIdRef.current,
        ));
        return;
      }

      updateNotificationsState((prev) => mergeRefreshedNotifications(
        reconcileFailedSingleNotificationRead(
          prev,
          snapshot,
          identity.getIdentity(),
          confirmedReadSeqByIdRef.current,
          latestMarkAllConfirmedSeqRef.current,
          identity.isMounted(),
        ).notifications,
        inFlightSingleReadsRef.current,
        pendingMarkAllReadsRef.current,
        confirmedReadSeqByIdRef.current,
      ));

      if (res.status !== 'BLOCKED_BACKEND') {
        setNotificationsError(
          res.errorMessage || res.errorCode || 'Unable to update notification status.',
        );
        if (res.status !== 'UNAUTHORIZED') {
          await reconcileNotificationsFromServer(origin);
        }
      }
    })();
  };

  const markAllNotificationsRead = () => {
    const user = identity.getUser();
    if (!user || user.accountStatus !== 'APPROVED' || user.id !== identity.getIdentity().userId) return;

    const origin: AccountIdentityContext = {
      userId: user.id,
      accountStatus: user.accountStatus,
      generation: identity.getIdentity().generation,
    };
    const requestSeq = ++notifSeqRef.current;
    const snapshot = captureNotificationReadSnapshot(
      notificationsRef.current, notificationsRef.current.map(item => item.id),
      pendingNotificationSnapshotsRef.current.values(), origin, requestSeq,
    );
    pendingNotificationSnapshotsRef.current.set(requestSeq, snapshot);

    pendingMarkAllReadsRef.current.set(requestSeq, new Set(snapshot.targetIds));
    setMarkingAllNotifications(true);
    setNotificationsError(null);
    updateNotificationsState((prev) => applyAllNotificationsOptimisticRead(prev).nextNotifications);

    void (async () => {
      let res: BackendOpResult<number>;
      try {
        res = await services.markAllNotificationsReadOnServer();
      } catch (err) {
        res = {
          ok: false,
          status: 'ERROR',
          errorCode: 'notifications_mark_all_failed',
          errorMessage: err instanceof Error ? err.message : 'Unable to mark notifications read.',
        };
      }

      if (!isMatchingApprovedAccountContext(origin, identity.getIdentity(), identity.isMounted())) {
        return;
      }

      pendingNotificationSnapshotsRef.current.delete(requestSeq);
      pendingMarkAllReadsRef.current.delete(requestSeq);
      setMarkingAllNotifications(pendingMarkAllReadsRef.current.size > 0);

      if (res.ok) {
        for (const id of snapshot.targetIds) {
          confirmedReadSeqByIdRef.current.set(id, Math.max(requestSeq, confirmedReadSeqByIdRef.current.get(id) ?? 0));
        }
        if (requestSeq > latestMarkAllConfirmedSeqRef.current) {
          latestMarkAllConfirmedSeqRef.current = requestSeq;
        }
        updateNotificationsState((prev) => mergeRefreshedNotifications(
          prev, inFlightSingleReadsRef.current, pendingMarkAllReadsRef.current, confirmedReadSeqByIdRef.current,
        ));
        return;
      }

      updateNotificationsState((prev) => mergeRefreshedNotifications(
        reconcileFailedMarkAllNotificationsRead(
          prev,
          snapshot,
          identity.getIdentity(),
          confirmedReadSeqByIdRef.current,
          latestMarkAllConfirmedSeqRef.current,
          identity.isMounted(),
        ).notifications,
        inFlightSingleReadsRef.current,
        pendingMarkAllReadsRef.current,
        confirmedReadSeqByIdRef.current,
      ));

      if (res.status !== 'BLOCKED_BACKEND') {
        setNotificationsError(
          res.errorMessage || res.errorCode || 'Unable to mark notifications read.',
        );
        if (res.status !== 'UNAUTHORIZED') {
          await reconcileNotificationsFromServer(origin);
        }
      }
    })();
  };


  useLayoutEffect(() => {
    onRegister?.({ hydrate, clear });
    return () => onRegister?.(null);
  }, [hydrate, clear, onRegister]);

  return (
    <NotificationContext.Provider value={{
      notifications, notificationsError, markingNotificationIds,
      markingAllNotifications, unreadNotificationsCount: notifications.filter(item => !item.read).length,
      markNotificationRead, markAllNotificationsRead, hydrate, clear,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
