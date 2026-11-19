import { supabase, classifySupabaseError } from '../supabase.ts';
import type { AccountRole, MessageThread, MessageRecipientOption, BackendOpResult } from '../../types.ts';

export const SHORT_MESSAGE_MAX_CHARS = 200;

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export function countUnreadThreads(
  threads: readonly MessageThread[] | null | undefined,
  status?: string,
): number {
  if (status !== 'READY' || !Array.isArray(threads)) return 0;
  return threads.filter((thread) => Boolean(thread.unread)).length;
}

export function validateShortMessageContent(
  content: string,
): { valid: true; clean: string } | { valid: false; errorCode: string } {
  const clean = content.trim();
  if (clean.length < 1 || clean.length > SHORT_MESSAGE_MAX_CHARS) {
    return { valid: false, errorCode: 'message_length_invalid' };
  }
  return { valid: true, clean };
}

export function canParticipantMessage(
  senderRole: AccountRole | null | undefined,
  recipientRole: AccountRole | null | undefined,
): boolean {
  if (!senderRole || !recipientRole) return false;
  if (senderRole === 'STUDENT' || recipientRole === 'STUDENT') return false;
  if (senderRole === 'PARENT' && (recipientRole === 'PARENT' || recipientRole === 'SCHOOL_STAFF')) {
    return false;
  }
  if (recipientRole === 'PARENT' && (senderRole === 'PARENT' || senderRole === 'SCHOOL_STAFF')) {
    return false;
  }
  return true;
}

export async function listMessageThreads(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<MessageThread[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.from('operational_message_threads').select('*').order('updated_at', { ascending: false });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const mapped: MessageThread[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          threadId: String(row.id),
          subject: row.subject ? String(row.subject) : undefined,
          recipientId: String(row.recipient_id || ''),
          recipientName: String(row.recipient_name || 'Member'),
          recipientRole: String(row.recipient_role || 'STAFF'),
          lastMessage: String(row.last_message || ''),
          updatedAt: String(row.updated_at || new Date().toISOString()),
          unread: Boolean(row.unread),
          messages: Array.isArray(row.messages) ? (row.messages as MessageThread['messages']) : [],
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listApprovedMessageRecipients(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<MessageRecipientOption[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('list_approved_message_recipients');
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const items = Array.isArray(data)
      ? data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          fullName: String(r.full_name || r.fullName || ''),
          role: (String(r.role || 'STAFF') as AccountRole),
        }))
      : [];
    return { ok: true, status: 'READY', data: items };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function sendOperationalMessage(
  recipientIdOrInput: string | { recipientId: string; content: string; subject?: string },
  contentOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<MessageThread & { threadId: string }>> {
  const input = typeof recipientIdOrInput === 'object'
    ? recipientIdOrInput
    : { recipientId: recipientIdOrInput, content: String(contentOrClient || '') };
  const client = typeof recipientIdOrInput === 'object' ? contentOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('send_operational_message', {
      p_recipient_id: input.recipientId,
      p_content: input.content.trim(),
      p_subject: input.subject?.trim() || null,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    const tid = String(r.id || '');
    return {
      ok: true,
      status: 'READY',
      data: {
        id: tid,
        threadId: tid,
        subject: r.subject ? String(r.subject) : undefined,
        recipientId: String(r.recipient_id || input.recipientId),
        recipientName: String(r.recipient_name || 'Member'),
        recipientRole: String(r.recipient_role || 'STAFF'),
        lastMessage: input.content,
        updatedAt: new Date().toISOString(),
        unread: false,
        messages: [],
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function replyOperationalThread(
  threadIdOrInput: string | { threadId: string; content: string },
  contentOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<{ threadId: string; messageId: string }>> {
  const input = typeof threadIdOrInput === 'object'
    ? threadIdOrInput
    : { threadId: threadIdOrInput, content: String(contentOrClient || '') };
  const client = typeof threadIdOrInput === 'object' ? contentOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('reply_operational_thread', {
      p_thread_id: input.threadId,
      p_content: input.content.trim(),
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: { threadId: input.threadId, messageId: String(r.id || '') },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
