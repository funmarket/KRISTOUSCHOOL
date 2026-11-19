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
    const mapped: NotificationItem[] = Array.isArray(data)
      ? data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          title: String(r.title),
          message: String(r.body),
          time: String(r.created_at).slice(0, 16).replace('T', ' '),
          read: Boolean(r.is_read),
          type: (String(r.category) as NotificationItem['type']) || 'system',
          targetTab: r.target_tab ? String(r.target_tab) : null,
          targetRefId: r.target_ref_id ? String(r.target_ref_id) : null,
        }))
      : [];
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
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('mark_user_notification_read', {
      p_notification_id: notificationId,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    return { ok: true, status: 'READY', data: Boolean(data) };
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
    return { ok: true, status: 'READY', data: Number(data ?? 0) };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export const listNotifications = listMyNotifications;

