import type {
  AccountApprovalStatus,
  BackendOpResult,
  MessageRecipientOption,
  NotificationItem,
} from '../types.ts';

export type PreferencesSyncStatus =
  | 'LOCAL_ONLY'
  | 'SAVING'
  | 'SAVED'
  | 'UNAVAILABLE'
  | 'ERROR';

export interface AccountIdentityContext {
  userId: string | null;
  accountStatus: AccountApprovalStatus | null | undefined;
  generation: number;
}

export interface PendingNotificationSnapshot {
  originUserId: string;
  originGeneration: number;
  requestSeq: number;
  targetIds: string[];
  previouslyUnreadIds: string[];
}

/** Preserve unread provenance hidden by earlier optimistic reads until they settle. */
export function captureNotificationReadSnapshot(
  notifications: readonly NotificationItem[],
  targetIds: readonly string[],
  pending: Iterable<PendingNotificationSnapshot>,
  origin: AccountIdentityContext,
  requestSeq: number,
): PendingNotificationSnapshot {
  if (!origin.userId || origin.accountStatus !== 'APPROVED') throw new Error('actor_not_approved');
  const unread = new Set(notifications.filter(item => !item.read).map(item => item.id));
  for (const snapshot of pending) {
    if (snapshot.originUserId === origin.userId && snapshot.originGeneration === origin.generation) {
      for (const id of snapshot.previouslyUnreadIds) unread.add(id);
    }
  }
  const targets = [...new Set(targetIds)];
  return {
    originUserId: origin.userId,
    originGeneration: origin.generation,
    requestSeq,
    targetIds: targets,
    previouslyUnreadIds: targets.filter(id => unread.has(id)),
  };
}

export function isMatchingApprovedAccountContext(
  origin: AccountIdentityContext,
  current: AccountIdentityContext,
  isMounted = true,
): boolean {
  if (!isMounted) return false;
  if (!origin.userId || origin.accountStatus !== 'APPROVED') return false;
  if (!current.userId || current.accountStatus !== 'APPROVED') return false;
  return (
    origin.userId === current.userId &&
    origin.generation === current.generation
  );
}

export function applySingleNotificationOptimisticRead(
  notifications: readonly NotificationItem[],
  id: string,
): NotificationItem[] {
  return notifications.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
}

export function applyAllNotificationsOptimisticRead(
  notifications: readonly NotificationItem[],
): {
  nextNotifications: NotificationItem[];
  previouslyUnreadIds: string[];
} {
  const previouslyUnreadIds: string[] = [];
  const nextNotifications = notifications.map((item) => {
    if (!item.read) {
      previouslyUnreadIds.push(item.id);
      return { ...item, read: true };
    }
    return item;
  });
  return { nextNotifications, previouslyUnreadIds };
}

/**
 * Reconciles a failed single-notification mark-read deterministically:
 * - Never restores an old snapshot array.
 * - Drops results when logged out, switched accounts, unmounted, or invalidated.
 * - Preserves concurrent successes (e.g., B succeeded while A failed) and newly added items.
 * - Keeps `id` read if a newer confirmed mark-all or single-read succeeded after this request started.
 */
export function reconcileFailedSingleNotificationRead(
  currentNotifications: readonly NotificationItem[],
  snapshot: PendingNotificationSnapshot,
  currentContext: AccountIdentityContext,
  confirmedReadSeqById: ReadonlyMap<string, number>,
  latestMarkAllConfirmedSeq: number,
  isMounted = true,
): { applied: boolean; notifications: NotificationItem[] } {
  const origin: AccountIdentityContext = {
    userId: snapshot.originUserId,
    accountStatus: 'APPROVED',
    generation: snapshot.originGeneration,
  };
  if (!isMatchingApprovedAccountContext(origin, currentContext, isMounted)) {
    return { applied: false, notifications: [...currentNotifications] };
  }

  const targetId = snapshot.targetIds[0];
  if (!targetId) {
    return { applied: false, notifications: [...currentNotifications] };
  }

  const confirmedSeq = confirmedReadSeqById.get(targetId) ?? 0;
  const supersededByConfirm =
    confirmedSeq > snapshot.requestSeq ||
    latestMarkAllConfirmedSeq > snapshot.requestSeq;

  if (supersededByConfirm) {
    return { applied: true, notifications: [...currentNotifications] };
  }

  const wasPreviouslyUnread = snapshot.previouslyUnreadIds.includes(targetId);
  if (!wasPreviouslyUnread) {
    return { applied: true, notifications: [...currentNotifications] };
  }

  return {
    applied: true,
    notifications: currentNotifications.map((item) =>
      item.id === targetId ? { ...item, read: false } : item,
    ),
  };
}

/**
 * Reconciles a failed mark-all-notifications-read deterministically:
 * - Never restores an old snapshot array or resurrects a logged-out account's list.
 * - Only reverts notifications that were unread before this request AND have not been
 *   confirmed read by a concurrent successful single-read or mark-all.
 * - Preserves any newly arrived notifications added during an overlapping refresh.
 */
export function reconcileFailedMarkAllNotificationsRead(
  currentNotifications: readonly NotificationItem[],
  snapshot: PendingNotificationSnapshot,
  currentContext: AccountIdentityContext,
  confirmedReadSeqById: ReadonlyMap<string, number>,
  latestMarkAllConfirmedSeq: number,
  isMounted = true,
): { applied: boolean; notifications: NotificationItem[] } {
  const origin: AccountIdentityContext = {
    userId: snapshot.originUserId,
    accountStatus: 'APPROVED',
    generation: snapshot.originGeneration,
  };
  if (!isMatchingApprovedAccountContext(origin, currentContext, isMounted)) {
    return { applied: false, notifications: [...currentNotifications] };
  }

  if (latestMarkAllConfirmedSeq > snapshot.requestSeq) {
    return { applied: true, notifications: [...currentNotifications] };
  }

  const revertSet = new Set(
    snapshot.previouslyUnreadIds.filter(
      (id) => (confirmedReadSeqById.get(id) ?? 0) < snapshot.requestSeq,
    ),
  );

  if (revertSet.size === 0) {
    return { applied: true, notifications: [...currentNotifications] };
  }

  return {
    applied: true,
    notifications: currentNotifications.map((item) =>
      revertSet.has(item.id) ? { ...item, read: false } : item,
    ),
  };
}

/**
 * Merges a server notification refresh while preserving active optimistic reads
 * that were either already confirmed or are still in flight for the same account.
 */
export function mergeRefreshedNotifications(
  serverNotifications: readonly NotificationItem[],
  inFlightReadIds: ReadonlySet<string>,
  pendingMarkAllReads: ReadonlyMap<number, ReadonlySet<string>>,
  confirmedReadSeqById: ReadonlyMap<string, number> = new Map(),
): NotificationItem[] {
  const readIds = new Set(inFlightReadIds);
  for (const targets of pendingMarkAllReads.values()) {
    for (const id of targets) readIds.add(id);
  }
  for (const id of confirmedReadSeqById.keys()) readIds.add(id);
  return serverNotifications.map((item) =>
    readIds.has(item.id) ? { ...item, read: true } : item,
  );
}

/**
 * Resolves preference persistence state safely:
 * - Drops stale responses (out-of-order request seq, account switch, logout, unmount).
 * - Never lets `BLOCKED_BACKEND` erase a genuine save error as though the save succeeded.
 */
export function resolvePreferencesPersistOutcome(params: {
  result: BackendOpResult<unknown>;
  origin: AccountIdentityContext;
  current: AccountIdentityContext;
  requestSeq: number;
  latestRequestSeq: number;
  previousError: string | null;
  isMounted?: boolean;
}): {
  ignored: boolean;
  syncStatus: PreferencesSyncStatus;
  error: string | null;
} {
  const {
    result,
    origin,
    current,
    requestSeq,
    latestRequestSeq,
    previousError,
    isMounted = true,
  } = params;

  if (!isMatchingApprovedAccountContext(origin, current, isMounted)) {
    return {
      ignored: true,
      syncStatus: 'LOCAL_ONLY',
      error: null,
    };
  }

  if (requestSeq !== latestRequestSeq) {
    return {
      ignored: true,
      syncStatus: 'SAVING',
      error: previousError,
    };
  }

  if (result.ok) {
    return {
      ignored: false,
      syncStatus: 'SAVED',
      error: null,
    };
  }

  if (result.status === 'BLOCKED_BACKEND') {
    return {
      ignored: false,
      syncStatus: 'UNAVAILABLE',
      error: previousError,
    };
  }

  return {
    ignored: false,
    syncStatus: 'ERROR',
    error: result.errorMessage || result.errorCode || 'Failed to save preferences.',
  };
}

/**
 * Reconciles selected recipient ID against a freshly fetched recipient list.
 * Drops obsolete IDs that are no longer eligible for the current account.
 */
export function reconcileSelectedRecipientId(
  currentRecipientId: string,
  freshRecipients: readonly MessageRecipientOption[],
): string {
  if (freshRecipients.length === 0) return '';
  if (
    currentRecipientId &&
    freshRecipients.some((recipient) => recipient.id === currentRecipientId)
  ) {
    return currentRecipientId;
  }
  return freshRecipients[0].id;
}
