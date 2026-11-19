import { supabase, classifySupabaseError } from '../supabase.ts';
import type { ParentNote, BackendOpResult } from '../../types.ts';

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
    const { data, error } = await client.from('parent_notes').select('*').order('created_at', { ascending: false });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const mapped: ParentNote[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          parentId: String(row.parent_id || ''),
          parentName: String(row.parent_name || 'Parent'),
          childId: String(row.child_id || ''),
          childName: String(row.child_name || 'Student'),
          classId: row.class_id ? String(row.class_id) : undefined,
          teacherId: row.teacher_id ? String(row.teacher_id) : undefined,
          topic: (String(row.topic || 'OTHER') as ParentNote['topic']),
          content: String(row.content || ''),
          schoolDay: row.school_day ? String(row.school_day) : undefined,
          createdAt: String(row.created_at || new Date().toISOString()),
          status: (String(row.status || 'SENT') as ParentNote['status']),
          replyContent: row.reply_content ? String(row.reply_content) : undefined,
          repliedByName: row.replied_by_name ? String(row.replied_by_name) : undefined,
          repliedAt: row.replied_at ? String(row.replied_at) : undefined,
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function sendParentNote(
  childIdOrInput: string | { childId: string; topic: ParentNote['topic']; content: string; classId?: string },
  topicOrClient?: ParentNote['topic'] | any,
  contentOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<ParentNote & { note: ParentNote }>> {
  const input = typeof childIdOrInput === 'object'
    ? childIdOrInput
    : { childId: childIdOrInput, topic: topicOrClient as ParentNote['topic'], content: String(contentOrClient || '') };
  const client = typeof childIdOrInput === 'object' ? topicOrClient : maybeClient;
  const activeClient = client || supabase;

  const check = validateParentNoteSubmission(input.content);
  if (!check.valid) {
    return { ok: false, status: 'ERROR', errorCode: check.errorCode, errorMessage: 'Parent note validation failed.' };
  }
  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('send_parent_note', {
      p_child_id: input.childId,
      p_topic: input.topic,
      p_content: input.content.trim(),
      p_class_id: input.classId || null,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    const createdNote: ParentNote = {
      id: String(r.id || ''),
      parentId: String(r.parent_id || ''),
      parentName: String(r.parent_name || 'Parent'),
      childId: input.childId,
      childName: String(r.child_name || 'Student'),
      topic: input.topic,
      content: input.content.trim(),
      createdAt: new Date().toISOString(),
      status: 'SENT',
    };
    return {
      ok: true,
      status: 'READY',
      data: { ...createdNote, note: createdNote },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function replyParentNote(
  noteIdOrInput: string | { noteId: string; replyContent: string },
  contentOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<ParentNote>> {
  const noteId = typeof noteIdOrInput === 'object' ? noteIdOrInput.noteId : noteIdOrInput;
  const replyContent = typeof noteIdOrInput === 'object' ? noteIdOrInput.replyContent : String(contentOrClient || '');
  const client = typeof noteIdOrInput === 'object' ? contentOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('reply_parent_note', {
      p_note_id: noteId,
      p_reply_content: replyContent.trim(),
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    const updatedNote: ParentNote = {
      id: noteId,
      parentId: String(r.parent_id || ''),
      parentName: String(r.parent_name || 'Parent'),
      childId: String(r.child_id || ''),
      childName: String(r.child_name || 'Student'),
      topic: 'OTHER',
      content: String(r.content || ''),
      createdAt: String(r.created_at || new Date().toISOString()),
      status: 'REPLIED',
      replyContent: replyContent.trim(),
      repliedByName: String(r.replied_by_name || 'Teacher'),
      repliedAt: new Date().toISOString(),
    };
    return { ok: true, status: 'READY', data: updatedNote };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
