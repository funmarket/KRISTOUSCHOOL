import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult } from '../../types.ts';

export interface ParentNote {
  id: string;
  parentId: string;
  parentName: string;
  childId: string;
  childName: string;
  classId?: string | null;
  teacherId?: string | null;
  topic: 'ABSENCE' | 'HOMEWORK' | 'BEHAVIOR' | 'HEALTH' | 'PICKUP' | 'OTHER';
  content: string;
  schoolDay?: string;
  createdAt: string;
  status: 'SENT' | 'READ' | 'REPLIED';
  replyContent?: string;
  repliedByName?: string;
  repliedAt?: string;
}

export const PARENT_NOTES_DAILY_QUOTA = 11;

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
    errorMessage: 'The server returned an invalid parent notes response.',
  };
}

const PARENT_NOTE_TOPICS = new Set<ParentNote['topic']>([
  'ABSENCE',
  'HOMEWORK',
  'BEHAVIOR',
  'HEALTH',
  'PICKUP',
  'OTHER',
]);

const PARENT_NOTE_STATUSES = new Set<ParentNote['status']>(['SENT', 'READ', 'REPLIED']);

function optionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseParentNoteRow(data: unknown): ParentNote | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;

  const id = optionalString(row.id);
  const parentId = optionalString(row.parent_user_id);
  const parentName = optionalString(row.parent_name);
  const childId = optionalString(row.student_id);
  const childName = optionalString(row.student_name);
  const topic = optionalString(row.topic);
  const content = optionalString(row.content);
  const status = optionalString(row.status);
  const createdAt = optionalString(row.created_at);

  if (
    typeof id !== 'string' ||
    typeof parentId !== 'string' ||
    typeof parentName !== 'string' ||
    typeof childId !== 'string' ||
    typeof childName !== 'string' ||
    typeof topic !== 'string' ||
    !PARENT_NOTE_TOPICS.has(topic as ParentNote['topic']) ||
    typeof content !== 'string' ||
    typeof status !== 'string' ||
    !PARENT_NOTE_STATUSES.has(status as ParentNote['status']) ||
    typeof createdAt !== 'string'
  ) {
    return null;
  }

  const classId = optionalString(row.class_id);
  const teacherId = optionalString(row.recipient_teacher_id);
  const schoolDay = optionalString(row.school_day);
  const replyContent = optionalString(row.reply_content);
  const repliedByName = optionalString(row.replied_by_name);
  const repliedAt = optionalString(row.replied_at);

  if (
    classId === undefined ||
    teacherId === undefined ||
    typeof schoolDay !== 'string' ||
    (row.reply_content !== undefined && replyContent === undefined) ||
    (row.replied_by_name !== undefined && repliedByName === undefined) ||
    (row.replied_at !== undefined && repliedAt === undefined)
  ) {
    return null;
  }

  return {
    id,
    parentId,
    parentName,
    childId,
    childName,
    classId,
    teacherId,
    topic: topic as ParentNote['topic'],
    content,
    schoolDay: schoolDay ?? undefined,
    status: status as ParentNote['status'],
    replyContent: replyContent ?? undefined,
    repliedByName: repliedByName ?? undefined,
    repliedAt: repliedAt ?? undefined,
    createdAt,
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
 * Returns the active Parent Notes quota cycle day anchored to 00:00 Africa/Tunis calendar date.
 */
export function getParentNotesQuotaDay(date: Date = new Date()): string {
  return getTunisTimeParts(date).dateStr;
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
    if (!Array.isArray(data)) return invalidResponseResult();
    const mapped: ParentNote[] = [];
    for (const row of data) {
      const note = parseParentNoteRow(row);
      if (!note) return invalidResponseResult();
      mapped.push(note);
    }
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
    if (!data || typeof data !== 'object') return invalidResponseResult();
    const payload = data as Record<string, unknown>;
    const note = parseParentNoteRow(payload.note);
    const remainingToday = payload.remainingToday;
    if (
      !note ||
      typeof remainingToday !== 'number' ||
      !Number.isInteger(remainingToday) ||
      remainingToday < 0 ||
      remainingToday > PARENT_NOTES_DAILY_QUOTA
    ) {
      return invalidResponseResult();
    }
    return {
      ok: true,
      status: 'READY',
      data: { note, remainingToday },
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
    const note = parseParentNoteRow(data);
    if (!note) return invalidResponseResult();
    return { ok: true, status: 'READY', data: note };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

