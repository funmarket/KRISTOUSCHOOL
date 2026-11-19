import { supabase, classifySupabaseError } from '../supabase.ts';

import type { BackendOpResult, ParentNote } from '../../types.ts';

export const PARENT_NOTES_DAILY_QUOTA = 11;

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export function getTunisTimeParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateStr: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const year = Number(lookup('year'));
  const month = Number(lookup('month'));
  const day = Number(lookup('day'));
  const hour = Number(lookup('hour'));
  const minute = Number(lookup('minute'));
  const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, minute, dateStr };
}

export function isWithinParentNotesTunisWindow(date: Date = new Date()): boolean {
  const { hour } = getTunisTimeParts(date);
  return hour >= 8 && hour < 18;
}

export function getTunisSchoolDay(date: Date = new Date()): string {
  return getTunisTimeParts(date).dateStr;
}

/**
 * Returns the active Parent Notes quota cycle day anchored to 08:00 Africa/Tunis.
 * Before 08:00 Tunis, the prior school day's cycle remains active until the 08:00 reset.
 */

export function getParentNotesQuotaDay(date: Date = new Date()): string {
  const parts = getTunisTimeParts(date);
  if (parts.hour >= 8) {
    return parts.dateStr;
  }
  const prevUtcDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 1));
  return `${prevUtcDay.getUTCFullYear()}-${String(prevUtcDay.getUTCMonth() + 1).padStart(2, '0')}-${String(prevUtcDay.getUTCDate()).padStart(2, '0')}`;
}

export function getRemainingParentNotesQuota(
  notes: readonly ParentNote[],
  parentUserId: string | null | undefined,
  date: Date = new Date(),
): number {
  if (!parentUserId) return PARENT_NOTES_DAILY_QUOTA;
  const activeQuotaDay = getParentNotesQuotaDay(date);
  const used = notes.filter((n) => {
    if (n.parentId !== parentUserId) return false;
    const noteDay = n.schoolDay || getParentNotesQuotaDay(new Date(n.createdAt));
    return noteDay === activeQuotaDay;
  }).length;
  return Math.max(0, PARENT_NOTES_DAILY_QUOTA - used);
}

export function validateParentNoteSubmission(
  content: string,
  now: Date = new Date(),
): { valid: true } | { valid: false; errorCode: string } {
  if (!isWithinParentNotesTunisWindow(now)) {
    return { valid: false, errorCode: 'parent_notes_outside_window' };
  }
  const clean = content.trim();
  if (clean.length < 1 || clean.length > 1000) {
    return { valid: false, errorCode: 'invalid_note_content' };
  }
  return { valid: true };
}

export async function listParentNotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<ParentNote[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('parent_notes')
      .select(
        'id, parent_user_id, parent_name, student_id, student_name, class_id, recipient_teacher_id, topic, content, school_day, status, reply_content, replied_by_name, replied_at, created_at',
      )
      .order('created_at', { ascending: false });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const mapped: ParentNote[] = Array.isArray(data)
      ? data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          parentId: String(r.parent_user_id),
          parentName: String(r.parent_name),
          childId: String(r.student_id),
          childName: String(r.student_name),
          classId: r.class_id ? String(r.class_id) : null,
          teacherId: r.recipient_teacher_id ? String(r.recipient_teacher_id) : null,
          topic: String(r.topic) as ParentNote['topic'],
          content: String(r.content),
          schoolDay: r.school_day ? String(r.school_day) : undefined,
          status: String(r.status) as ParentNote['status'],
          replyContent: r.reply_content ? String(r.reply_content) : undefined,
          repliedByName: r.replied_by_name ? String(r.replied_by_name) : undefined,
          repliedAt: r.replied_at ? String(r.replied_at) : undefined,
          createdAt: String(r.created_at),
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function sendParentNote(
  studentId: string,
  topic: ParentNote['topic'],
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
  now: Date = new Date(),
): Promise<BackendOpResult<{ note: ParentNote; remainingToday: number }>> {
  const check = validateParentNoteSubmission(content, now);
  if (check.valid === false) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: check.errorCode,
      errorMessage:
        check.errorCode === 'parent_notes_outside_window'
          ? 'Parent notes can only be sent between 08:00 and 18:00 Tunis time.'
          : 'Please enter note content (1 to 1000 characters).',
    };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('send_parent_note', {
      p_student_id: studentId,
      p_topic: topic,
      p_content: content.trim(),
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const payload = (data ?? {}) as { note?: Record<string, unknown>; remainingToday?: number };
    const r = payload.note ?? {};
    return {
      ok: true,
      status: 'READY',
      data: {
        remainingToday: Number(payload.remainingToday ?? 0),
        note: {
          id: String(r.id),
          parentId: String(r.parent_user_id),
          parentName: String(r.parent_name),
          childId: String(r.student_id),
          childName: String(r.student_name),
          classId: r.class_id ? String(r.class_id) : null,
          teacherId: r.recipient_teacher_id ? String(r.recipient_teacher_id) : null,
          topic: String(r.topic) as ParentNote['topic'],
          content: String(r.content),
          schoolDay: r.school_day ? String(r.school_day) : undefined,
          status: String(r.status) as ParentNote['status'],
          createdAt: String(r.created_at),
        },
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function replyParentNote(
  noteId: string,
  replyContent: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<ParentNote>> {
  if (!replyContent.trim()) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_reply_content', errorMessage: 'Reply cannot be empty.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('reply_parent_note', {
      p_note_id: noteId,
      p_reply_content: replyContent.trim(),
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id),
        parentId: String(r.parent_user_id),
        parentName: String(r.parent_name),
        childId: String(r.student_id),
        childName: String(r.student_name),
        classId: r.class_id ? String(r.class_id) : null,
        teacherId: r.recipient_teacher_id ? String(r.recipient_teacher_id) : null,
        topic: String(r.topic) as ParentNote['topic'],
        content: String(r.content),
        status: String(r.status) as ParentNote['status'],
        replyContent: r.reply_content ? String(r.reply_content) : undefined,
        repliedByName: r.replied_by_name ? String(r.replied_by_name) : undefined,
        repliedAt: r.replied_at ? String(r.replied_at) : undefined,
        createdAt: String(r.created_at),
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

