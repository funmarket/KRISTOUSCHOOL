export const NOTIFICATION_CATEGORIES = [
  'pickup', 'note', 'announcement', 'message', 'calendar', 'system',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationFilter = 'all' | NotificationCategory;

export function filterLoadedNotifications<T extends { type: string }>(
  notifications: readonly T[],
  selected: NotificationFilter,
): T[] {
  return selected === 'all'
    ? [...notifications]
    : notifications.filter((notification) => notification.type === selected);
}
