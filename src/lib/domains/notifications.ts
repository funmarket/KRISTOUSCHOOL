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

export async function listNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<NotificationItem[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('user_notifications')
      .select('id, title, message, is_read, notification_type, target_view, target_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const mapped: NotificationItem[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          title: String(row.title || ''),
          message: String(row.message || row.body || ''),
          time: String(row.created_at || new Date().toISOString()),
          read: Boolean(row.is_read || row.read),
          type: (String(row.notification_type || row.type || 'announcement') as NotificationItem['type']),
          targetTab: row.target_view ? String(row.target_view) : undefined,
          targetRefId: row.target_id ? String(row.target_id) : undefined,
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listMyNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<NotificationItem[]>> {
  return listNotifications(client);
}

export async function markNotificationReadOnServer(
  notificationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<boolean>> {
  const activeClient = client || supabase;
  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('mark_user_notification_read', {
      p_notification_id: notificationId,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    return { ok: true, status: 'READY', data: true };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function markAllNotificationsReadOnServer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<number>> {
  const activeClient = client || supabase;
  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('mark_all_user_notifications_read');
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const count = typeof data === 'number' ? data : 1;
    return { ok: true, status: 'READY', data: count };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
