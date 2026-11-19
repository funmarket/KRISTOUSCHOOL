import { supabase, classifySupabaseError } from '../supabase.ts';

import type { AccountRole, BackendOpResult, BackendOpStatus, MessageRecipientOption, MessageThread } from '../../types.ts';



export const SHORT_MESSAGE_MAX_CHARS = 200;



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
    errorMessage: 'The server returned an invalid messaging response.',
  };
}

function parseMessageRecipients(data: unknown): MessageRecipientOption[] | null {
  if (!Array.isArray(data)) return null;

  const recipients: MessageRecipientOption[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const fullName = typeof row.fullName === 'string' ? row.fullName.trim() : '';
    const role = typeof row.role === 'string' ? row.role.trim() : '';
    if (!id || !fullName || !role) return null;
    recipients.push({ id, fullName, role: role as AccountRole });
  }

  return recipients;
}

export function countUnreadThreads(
  threads: readonly MessageThread[] | null | undefined,
  status?: BackendOpStatus,
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

/**
 * UI-level role pair pre-check matching public.can_users_direct_message().
 * Server RPCs/RLS additionally verify active linked-child class assignments for PARENT <-> TEACHER.
 */

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
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<MessageThread[]>> {
  if (!client) return unavailableResult();
  try {
    const { data: threads, error } = await client
      .from('message_threads')
      .select('id, subject, created_by_user_id, last_message_preview, updated_at')
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const threadRows = Array.isArray(threads) ? (threads as Record<string, unknown>[]) : [];
    if (threadRows.length === 0) return { ok: true, status: 'READY', data: [] };

    const threadIds = threadRows.map((t) => String(t.id));
    const [{ data: participants, error: partErr }, { data: messages, error: msgErr }] = await Promise.all([
      client.from('thread_participants').select('thread_id, user_id, unread').in('thread_id', threadIds),
      client.from('thread_messages').select('*').in('thread_id', threadIds).order('created_at', { ascending: true }),
    ]);
    if (partErr) return { ok: false, ...classifySupabaseError(partErr) };
    if (msgErr) return { ok: false, ...classifySupabaseError(msgErr) };

    const { data: recipientData, error: recipientErr } = await client.rpc('list_approved_message_recipients');
    if (recipientErr) return { ok: false, ...classifySupabaseError(recipientErr) };
    const recipientOptions = parseMessageRecipients(recipientData);
    if (!recipientOptions) return invalidResponseResult();
    const recipientById = new Map(recipientOptions.map((recipient) => [recipient.id, recipient]));

    const partByThread = new Map<string, { userId: string; unread: boolean }[]>();
    if (Array.isArray(participants)) {
      for (const p of participants as Record<string, unknown>[]) {
        const tid = String(p.thread_id);
        const list = partByThread.get(tid) ?? [];
        list.push({ userId: String(p.user_id), unread: Boolean(p.unread) });
        partByThread.set(tid, list);
      }
    }

    const msgByThread = new Map<string, MessageThread['messages']>();
    if (Array.isArray(messages)) {
      for (const m of messages as Record<string, unknown>[]) {
        const tid = String(m.thread_id);
        const list = msgByThread.get(tid) ?? [];
        list.push({
          id: String(m.id),
          senderId: String(m.sender_user_id),
          senderName: m.sender_name ? String(m.sender_name) : undefined,
          content: String(m.content),
          createdAt: String(m.created_at),
        });
        msgByThread.set(tid, list);
      }
    }

    const mapped: MessageThread[] = [];
    for (const t of threadRows) {
      const tid = String(t.id);
      const parts = partByThread.get(tid) ?? [];
      const selfPart = parts.find((p) => p.userId === userId);
      const otherPart = parts.find((p) => p.userId !== userId);
      if (!selfPart || !otherPart) return invalidResponseResult();
      const recipient = recipientById.get(otherPart.userId);
      if (!recipient) return invalidResponseResult();
      const threadMsgs = msgByThread.get(tid) ?? [];
      mapped.push({
        id: tid,
        subject: t.subject ? String(t.subject) : undefined,
        recipientId: recipient.id,
        recipientName: recipient.fullName,
        recipientRole: recipient.role,
        lastMessage: String(t.last_message_preview ?? ''),
        updatedAt: String(t.updated_at),
        unread: Boolean(selfPart.unread),
        messages: threadMsgs,
      });
    }

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
    const recipients = parseMessageRecipients(data);
    if (!recipients) return invalidResponseResult();
    return {
      ok: true,
      status: 'READY',
      data: recipients,
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function sendOperationalMessage(
  recipientUserId: string,
  subject: string,
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ threadId: string }>> {
  const check = validateShortMessageContent(content);
  if (check.valid === false) {
    return { ok: false, status: 'ERROR', errorCode: check.errorCode, errorMessage: 'Message must be 1 to 200 characters.' };
  }
  if (!recipientUserId) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_recipient', errorMessage: 'Select a recipient.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('send_operational_message', {
      p_recipient_user_id: recipientUserId,
      p_subject: subject.trim(),
      p_content: check.clean,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as { threadId?: string };
    const threadId = typeof row.threadId === 'string' ? row.threadId.trim() : '';
    if (!threadId) return invalidResponseResult();
    return { ok: true, status: 'READY', data: { threadId } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function replyOperationalThread(
  threadId: string,
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string }>> {
  const check = validateShortMessageContent(content);
  if (check.valid === false) {
    return { ok: false, status: 'ERROR', errorCode: check.errorCode, errorMessage: 'Reply must be 1 to 200 characters.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('reply_operational_thread', {
      p_thread_id: threadId,
      p_content: check.clean,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as { id?: string };
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id) return invalidResponseResult();
    return { ok: true, status: 'READY', data: { id } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

