import type { NotificationItem, User } from '../types';

export type NotificationDestinationTab = 'messages' | 'notes' | 'registration';

export interface NotificationTargetIntent {
  tab: NotificationDestinationTab;
  refId: string;
  actorKey: string;
  requestId: number;
}

export type NotificationTargetResolution<T> =
  | { state: 'idle' | 'loading' | 'unavailable'; record: null }
  | { state: 'found'; record: T };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identity token for UI lifecycle only; NEVER an authorization mechanism. */
export function getNotificationActorKey(user: Pick<User, 'id' | 'role' | 'accountStatus'> | null | undefined): string | null {
  return user?.id && user.accountStatus === 'APPROVED'
    ? `${user.id}::${user.role}::${user.accountStatus}`
    : null;
}

/** Only the three verified notification producers use record IDs; other tabs retain their existing navigation. */
export function createNotificationTargetIntent(
  notification: Pick<NotificationItem, 'targetTab' | 'targetRefId'>,
  actorKey: string | null,
  requestId: number,
): NotificationTargetIntent | null {
  if (!actorKey) return null;
  const tab = notification.targetTab;
  const refId = notification.targetRefId?.trim();
  if ((tab !== 'messages' && tab !== 'notes' && tab !== 'registration') || !refId || !UUID.test(refId)) {
    return null;
  }
  return { tab, refId, actorKey, requestId };
}

export function getCurrentNotificationTarget(
  intent: NotificationTargetIntent | null | undefined,
  actorKey: string | null,
  tab: NotificationDestinationTab,
): NotificationTargetIntent | null {
  return intent && actorKey && intent.actorKey === actorKey && intent.tab === tab ? intent : null;
}

/** Resolve from the destination's own server-authorized list. A reference ID grants nothing. */
export function resolveNotificationTarget<T extends { id: string }>(
  intent: NotificationTargetIntent | null | undefined,
  actorKey: string | null,
  backendStatus: string,
  isHydrating: boolean,
  authorizedRecords: readonly T[],
): NotificationTargetResolution<T> {
  if (!intent || !actorKey || intent.actorKey !== actorKey) return { state: 'idle', record: null };
  if (isHydrating) return { state: 'loading', record: null };
  if (backendStatus !== 'READY') return { state: 'unavailable', record: null };
  const record = authorizedRecords.find((item) => item.id === intent.refId);
  return record ? { state: 'found', record } : { state: 'unavailable', record: null };
}
