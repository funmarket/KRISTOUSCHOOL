import { supabase, classifySupabaseError } from '../supabase.ts';

import type { BackendOpResult, NotificationItem } from '../../types.ts';

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

function invalidResponseResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'ERROR',
    errorCode: 'operation_failed',
    errorMessage: 'The server returned an invalid notifications response.',
  };
}

function parseNotificationRow(data: unknown): NotificationItem | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;

  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const category = typeof row.category === 'string' ? row.category.trim() : '';
  const createdAt = typeof row.created_at === 'string' ? row.created_at.trim() : '';

  if (
    !id ||
    !category ||
    typeof row.title !== 'string' ||
    typeof row.body !== 'string' ||
    typeof row.is_read !== 'boolean' ||
    !createdAt
  ) {
    return null;
  }

  const targetTab =
    row.target_tab === null ? null : typeof row.target_tab === 'string' ? row.target_tab : undefined;
  const targetRefId =
    row.target_ref_id === null
      ? null
      : typeof row.target_ref_id === 'string'
        ? row.target_ref_id
        : undefined;

  if (targetTab === undefined || targetRefId === undefined) return null;

  return {
    id,
    title: row.title,
    message: row.body,
    time: createdAt.slice(0, 16).replace('T', ' '),
    read: row.is_read,
    type: category as NotificationItem['type'],
    targetTab,
    targetRefId,
  };
}

export async function listMyNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<NotificationItem[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('user_notifications')
      .select('id, category, title, body, target_tab, target_ref_id, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (!Array.isArray(data)) return invalidResponseResult();

    const mapped: NotificationItem[] = [];
    for (const row of data) {
      const notification = parseNotificationRow(row);
      if (!notification) return invalidResponseResult();
      mapped.push(notification);
    }

    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function markNotificationReadOnServer(
  notificationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<boolean>> {
  const cleanId = notificationId.trim();
  if (!cleanId) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_notification_id',
      errorMessage: 'Notification ID is required.',
    };
  }
  if (!client) return unavailableResult();

  try {
    const { data, error } = await client.rpc('mark_user_notification_read', {
      p_notification_id: cleanId,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (typeof data !== 'boolean') return invalidResponseResult();
    return { ok: true, status: 'READY', data };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function markAllNotificationsReadOnServer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<number>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('mark_all_user_notifications_read');
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (typeof data !== 'number' || !Number.isInteger(data) || data < 0) {
      return invalidResponseResult();
    }
    return { ok: true, status: 'READY', data };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export const listNotifications = listMyNotifications;
