import { supabase, classifySupabaseError } from './supabase.ts';
import { CANONICAL_SCHOOL_LEVELS } from './schoolOperations.ts';
import type {
  AccountRole,
  AdminDirectoryMember,
  Announcement,
  BackendOpResult,
  CalendarEvent,
  CalendarEventCategory,
  ClassDocumentItem,
  ClassGalleryItem,
  ClassQuestion,
  ClassQuestionReply,
  FoodMenuItem,
  FoodMenuWeek,
  Homework,
  Language,
  MessageRecipientOption,
  MessageThread,
  NotificationItem,
  NotificationSoundOption,
  ParentNote,
  PublicContentEntry,
  SchoolBroadcastItem,
  TeacherDirectoryMember,
  ThemeMode,
  UserPreferencesState,
} from '../types.ts';

export const PARENT_NOTES_DAILY_QUOTA = 11;
export const SHORT_MESSAGE_MAX_CHARS = 200;

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

export function validateShortMessageContent(
  content: string,
): { valid: true; clean: string } | { valid: false; errorCode: string } {
  const clean = content.trim();
  if (clean.length < 1 || clean.length > SHORT_MESSAGE_MAX_CHARS) {
    return { valid: false, errorCode: 'message_length_invalid' };
  }
  return { valid: true, clean };
}

const CANONICAL_LEVEL_CODES = new Set(CANONICAL_SCHOOL_LEVELS.map((lvl) => lvl.code));

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

export function getMonthCalendarRange(
  year: number,
  monthIndex: number,
): { startDate: string; endDate: string } {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const mm = String(monthIndex + 1).padStart(2, '0');
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`,
  };
}

export function sortCalendarEvents(events: readonly CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (Boolean(a.isAllDay) !== Boolean(b.isAllDay)) return a.isAllDay ? -1 : 1;
    const ta = a.startTime || '';
    const tb = b.startTime || '';
    if (ta !== tb) return ta.localeCompare(tb);
    const titleCmp = a.title.localeCompare(b.title);
    if (titleCmp !== 0) return titleCmp;
    return a.id.localeCompare(b.id);
  });
}

export function getEventsForCalendarDate(
  events: readonly CalendarEvent[],
  dateStr: string,
): CalendarEvent[] {
  return sortCalendarEvents(
    events.filter((ev) => {
      const start = ev.date;
      const end = ev.endDate && ev.endDate >= start ? ev.endDate : start;
      return dateStr >= start && dateStr <= end;
    }),
  );
}

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function listSchoolBroadcasts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<SchoolBroadcastItem[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('school_broadcasts')
      .select(
        'id, title, body, priority, status, audience_scope, target_level_codes, target_class_ids, is_public, published_at, author_name, author_role, created_at',
      )
      .order('created_at', { ascending: false });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const mapped: SchoolBroadcastItem[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          title: String(row.title),
          body: String(row.body),
          priority: row.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
          status: (String(row.status) as SchoolBroadcastItem['status']) || 'PUBLISHED',
          audienceScope:
            (String(row.audience_scope) as SchoolBroadcastItem['audienceScope']) || 'ALL_SCHOOL',
          targetLevelCodes: Array.isArray(row.target_level_codes)
            ? (row.target_level_codes as string[])
            : [],
          targetClassIds: Array.isArray(row.target_class_ids)
            ? (row.target_class_ids as string[])
            : [],
          isPublic: Boolean(row.is_public),
          authorName: String(row.author_name ?? 'Administration'),
          authorRole: String(row.author_role ?? 'Administration'),
          createdAt: String(row.published_at || row.created_at),
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function publishSchoolBroadcast(
  input: {
    title: string;
    body: string;
    priority?: 'NORMAL' | 'URGENT';
    audienceScope?: SchoolBroadcastItem['audienceScope'];
    isPublic?: boolean;
    targetClassIds?: string[];
    targetLevelCodes?: string[];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<SchoolBroadcastItem>> {
  if (input.title.trim().length < 2 || input.body.trim().length < 2) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_broadcast_input',
      errorMessage: 'Title and message body are required.',
    };
  }

  const scope = input.audienceScope ?? 'ALL_SCHOOL';
  const requestedPublic = Boolean(input.isPublic);
  if (requestedPublic && scope !== 'PUBLIC_SITE') {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'targeted_broadcast_cannot_be_public',
      errorMessage: 'Targeted or internal-only broadcasts cannot be marked public.',
    };
  }

  const cleanLevels = Array.from(
    new Set(
      (input.targetLevelCodes ?? [])
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code.length > 0),
    ),
  );
  if (scope === 'SELECTED_LEVELS') {
    if (cleanLevels.length === 0) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'target_levels_required',
        errorMessage: 'Select at least one school level.',
      };
    }
    if (cleanLevels.some((code) => !CANONICAL_LEVEL_CODES.has(code))) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_target_levels',
        errorMessage: 'One or more selected school levels are invalid.',
      };
    }
  }

  const cleanClasses = Array.from(
    new Set(
      (input.targetClassIds ?? [])
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );
  if (scope === 'SELECTED_CLASSES' && cleanClasses.length === 0) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'target_classes_required',
      errorMessage: 'Select at least one active class.',
    };
  }

  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('publish_school_broadcast', {
      p_title: input.title.trim(),
      p_body: input.body.trim(),
      p_priority: input.priority ?? 'NORMAL',
      p_audience_scope: scope,
      p_is_public: scope === 'PUBLIC_SITE' ? true : false,
      p_target_class_ids: scope === 'SELECTED_CLASSES' ? cleanClasses : [],
      p_target_level_codes: scope === 'SELECTED_LEVELS' ? cleanLevels : [],
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(row.id),
        title: String(row.title),
        body: String(row.body),
        priority: row.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
        status: (String(row.status) as SchoolBroadcastItem['status']) || 'PUBLISHED',
        audienceScope:
          (String(row.audience_scope) as SchoolBroadcastItem['audienceScope']) || 'ALL_SCHOOL',
        targetLevelCodes: Array.isArray(row.target_level_codes)
          ? (row.target_level_codes as string[])
          : [],
        targetClassIds: Array.isArray(row.target_class_ids)
          ? (row.target_class_ids as string[])
          : [],
        isPublic: Boolean(row.is_public),
        authorName: String(row.author_name ?? 'Administration'),
        authorRole: String(row.author_role ?? 'Administration'),
        createdAt: String(row.published_at || row.created_at),
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listSchoolCalendarEvents(
  userId?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
  options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  },
): Promise<BackendOpResult<CalendarEvent[]>> {
  if (!client) return unavailableResult();
  try {
    let query = client
      .from('school_calendar_events')
      .select(
        'id, class_id, title, description, category, start_date, end_date, is_all_day, start_time, end_time, timezone, is_public, status, cancellation_reason',
      )
      .order('start_date', { ascending: true });

    if (options?.endDate && typeof query?.lte === 'function') {
      query = query.lte('start_date', options.endDate);
    }
    if (options?.startDate && typeof query?.gte === 'function') {
      query = query.gte('end_date', options.startDate);
    }
    if (typeof query?.limit === 'function') {
      query = query.limit(options?.limit ?? 250);
    }

    const { data, error } = await query;
    if (error) return { ok: false, ...classifySupabaseError(error) };

    const eventRows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    const responseMap = new Map<string, CalendarEvent['myResponse']>();
    if (userId && eventRows.length > 0) {
      let respQuery = client
        .from('school_calendar_responses')
        .select('event_id, response')
        .eq('user_id', userId);
      if (typeof respQuery?.in === 'function') {
        respQuery = respQuery.in(
          'event_id',
          eventRows.map((row) => String(row.id)),
        );
      }
      const { data: respData, error: respErr } = await respQuery;
      if (respErr) return { ok: false, ...classifySupabaseError(respErr) };
      if (Array.isArray(respData)) {
        for (const r of respData as { event_id: string; response: CalendarEvent['myResponse'] }[]) {
          responseMap.set(r.event_id, r.response);
        }
      }
    }

    const mapped: CalendarEvent[] = eventRows.map((row) => ({
      id: String(row.id),
      classId: row.class_id ? String(row.class_id) : undefined,
      title: String(row.title),
      description: String(row.description ?? ''),
      category: (String(row.category) as CalendarEventCategory) || 'EVENT',
      date: String(row.start_date),
      endDate: row.end_date ? String(row.end_date) : String(row.start_date),
      isAllDay: row.is_all_day !== false,
      startTime: row.start_time ? String(row.start_time) : null,
      endTime: row.end_time ? String(row.end_time) : null,
      timezone: row.timezone ? String(row.timezone) : 'Africa/Tunis',
      isPublic: Boolean(row.is_public),
      status: (String(row.status) as CalendarEvent['status']) || 'SCHEDULED',
      cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : null,
      myResponse: responseMap.get(String(row.id)) ?? null,
    }));
    return { ok: true, status: 'READY', data: sortCalendarEvents(mapped) };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function upsertSchoolCalendarEvent(
  input: {
    title: string;
    description: string;
    category: CalendarEventCategory;
    startDate: string;
    endDate?: string;
    classId?: string | null;
    isAllDay?: boolean;
    isPublic?: boolean;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<CalendarEvent>> {
  if (input.title.trim().length < 2 || !input.startDate) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_event_input', errorMessage: 'Title and start date are required.' };
  }
  const endDate = input.endDate && input.endDate.trim() ? input.endDate.trim() : input.startDate;
  if (endDate < input.startDate) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_date_range', errorMessage: 'End date must be on or after start date.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('upsert_school_calendar_event', {
      p_title: input.title.trim(),
      p_description: input.description.trim(),
      p_category: input.category,
      p_start_date: input.startDate,
      p_end_date: endDate,
      p_class_id: input.classId || null,
      p_is_all_day: input.isAllDay ?? true,
      p_is_public: Boolean(input.isPublic) && !input.classId,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(row.id),
        classId: row.class_id ? String(row.class_id) : undefined,
        title: String(row.title),
        description: String(row.description ?? ''),
        category: String(row.category) as CalendarEventCategory,
        date: String(row.start_date),
        endDate: String(row.end_date ?? row.start_date),
        isAllDay: row.is_all_day !== false,
        timezone: String(row.timezone ?? 'Africa/Tunis'),
        isPublic: Boolean(row.is_public),
        status: (String(row.status) as CalendarEvent['status']) || 'SCHEDULED',
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function cancelSchoolCalendarEvent(
  eventId: string,
  reason: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string; status: string }>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('cancel_school_calendar_event', {
      p_event_id: eventId,
      p_reason: reason.trim() || 'Cancelled by administration',
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as Record<string, unknown>;
    return { ok: true, status: 'READY', data: { id: String(row.id), status: String(row.status) } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function respondToCalendarEvent(
  eventId: string,
  response: 'ATTENDING' | 'ACKNOWLEDGED' | 'DECLINED',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ eventId: string; response: string }>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('respond_to_calendar_event', {
      p_event_id: eventId,
      p_response: response,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as Record<string, unknown>;
    return { ok: true, status: 'READY', data: { eventId: String(row.event_id), response: String(row.response) } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listClassCommunityContent(
  classId?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<
  BackendOpResult<{
    announcements: Announcement[];
    homework: Homework[];
    questions: ClassQuestion[];
    documents: ClassDocumentItem[];
    gallery: ClassGalleryItem[];
  }>
> {
  if (!client) return unavailableResult();
  try {
    const annQuery = classId
      ? client.from('class_announcements').select('*').eq('class_id', classId).order('created_at', { ascending: false })
      : client.from('class_announcements').select('*').order('created_at', { ascending: false });
    const hwQuery = classId
      ? client.from('class_homework_items').select('*').eq('class_id', classId).order('due_date', { ascending: true })
      : client.from('class_homework_items').select('*').order('due_date', { ascending: true });
    const qQuery = classId
      ? client.from('class_questions').select('*').eq('class_id', classId).order('created_at', { ascending: false })
      : client.from('class_questions').select('*').order('created_at', { ascending: false });
    const docQuery = classId
      ? client.from('class_documents').select('*').eq('class_id', classId).order('created_at', { ascending: false })
      : client.from('class_documents').select('*').order('created_at', { ascending: false });
    const galQuery = classId
      ? client.from('class_gallery_items').select('*').or(`class_id.eq.${classId},class_id.is.null`).order('created_at', { ascending: false })
      : client.from('class_gallery_items').select('*').order('created_at', { ascending: false });

    const [annRes, hwRes, qRes, docRes, galRes] = await Promise.all([
      annQuery,
      hwQuery,
      qQuery,
      docQuery,
      galQuery,
    ]);

    if (annRes.error) return { ok: false, ...classifySupabaseError(annRes.error) };
    if (hwRes.error) return { ok: false, ...classifySupabaseError(hwRes.error) };
    if (qRes.error) return { ok: false, ...classifySupabaseError(qRes.error) };
    if (docRes.error) return { ok: false, ...classifySupabaseError(docRes.error) };
    if (galRes.error) return { ok: false, ...classifySupabaseError(galRes.error) };

    const questionsRows = Array.isArray(qRes.data) ? (qRes.data as Record<string, unknown>[]) : [];
    const questionIds = questionsRows.map((q) => String(q.id));
    const repliesMap = new Map<string, ClassQuestionReply[]>();
    if (questionIds.length > 0) {
      const { data: repRows, error: repErr } = await client
        .from('class_question_replies')
        .select('*')
        .in('question_id', questionIds)
        .order('created_at', { ascending: true });
      if (repErr) return { ok: false, ...classifySupabaseError(repErr) };
      if (Array.isArray(repRows)) {
        for (const r of repRows as Record<string, unknown>[]) {
          const qid = String(r.question_id);
          const list = repliesMap.get(qid) ?? [];
          list.push({
            id: String(r.id),
            questionId: qid,
            authorId: String(r.author_user_id),
            authorName: String(r.author_name),
            content: String(r.content),
            createdAt: String(r.created_at),
          });
          repliesMap.set(qid, list);
        }
      }
    }

    const announcements: Announcement[] = Array.isArray(annRes.data)
      ? annRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          classId: String(r.class_id),
          title: String(r.title),
          body: String(r.body),
          authorName: String(r.author_name),
          authorRole: String(r.author_role),
          createdAt: String(r.created_at),
          priority: r.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
        }))
      : [];

    const homework: Homework[] = Array.isArray(hwRes.data)
      ? hwRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          classId: String(r.class_id),
          title: String(r.title),
          description: String(r.description ?? ''),
          dueDate: String(r.due_date),
          teacherName: String(r.teacher_name),
          createdAt: String(r.created_at),
        }))
      : [];

    const questions: ClassQuestion[] = questionsRows.map((r) => {
      const reps = repliesMap.get(String(r.id)) ?? [];
      return {
        id: String(r.id),
        classId: String(r.class_id),
        studentId: String(r.author_user_id),
        studentName: String(r.author_name),
        content: String(r.content),
        isHidden: Boolean(r.is_hidden),
        createdAt: String(r.created_at),
        repliesCount: reps.length,
        replies: reps,
      };
    });

    const documents: ClassDocumentItem[] = Array.isArray(docRes.data)
      ? docRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          classId: String(r.class_id),
          title: String(r.title),
          description: String(r.description ?? ''),
          documentUrl: String(r.document_url),
          fileType: String(r.file_type ?? 'PDF'),
          createdAt: String(r.created_at),
        }))
      : [];

    const gallery: ClassGalleryItem[] = Array.isArray(galRes.data)
      ? galRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          classId: r.class_id ? String(r.class_id) : null,
          title: String(r.title),
          caption: String(r.caption ?? ''),
          imageUrl: String(r.image_url),
          isPublic: Boolean(r.is_public),
          createdAt: String(r.created_at),
        }))
      : [];

    return {
      ok: true,
      status: 'READY',
      data: { announcements, homework, questions, documents, gallery },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function createClassAnnouncement(
  classId: string,
  title: string,
  body: string,
  priority: 'NORMAL' | 'URGENT' = 'NORMAL',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<Announcement>> {
  if (!classId || title.trim().length < 2 || body.trim().length < 2) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_input', errorMessage: 'Class, title, and body are required.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('create_class_announcement', {
      p_class_id: classId,
      p_title: title.trim(),
      p_body: body.trim(),
      p_priority: priority,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id),
        classId: String(r.class_id),
        title: String(r.title),
        body: String(r.body),
        authorName: String(r.author_name),
        authorRole: String(r.author_role),
        createdAt: String(r.created_at),
        priority: r.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function createClassHomework(
  classId: string,
  title: string,
  description: string,
  dueDate: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<Homework>> {
  if (!classId || title.trim().length < 2 || !dueDate) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_input', errorMessage: 'Class, title, and due date are required.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('create_class_homework', {
      p_class_id: classId,
      p_title: title.trim(),
      p_description: description.trim(),
      p_due_date: dueDate,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id),
        classId: String(r.class_id),
        title: String(r.title),
        description: String(r.description ?? ''),
        dueDate: String(r.due_date),
        teacherName: String(r.teacher_name),
        createdAt: String(r.created_at),
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function postClassQuestion(
  classId: string,
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<ClassQuestion>> {
  const check = validateShortMessageContent(content);
  if (check.valid === false) {
    return { ok: false, status: 'ERROR', errorCode: check.errorCode, errorMessage: 'Question must be 1 to 200 characters.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('post_class_question', {
      p_class_id: classId,
      p_content: check.clean,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id),
        classId: String(r.class_id),
        studentId: String(r.author_user_id),
        studentName: String(r.author_name),
        content: String(r.content),
        isHidden: Boolean(r.is_hidden),
        createdAt: String(r.created_at),
        repliesCount: 0,
        replies: [],
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function replyClassQuestion(
  questionId: string,
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<ClassQuestionReply>> {
  const check = validateShortMessageContent(content);
  if (check.valid === false) {
    return { ok: false, status: 'ERROR', errorCode: check.errorCode, errorMessage: 'Reply must be 1 to 200 characters.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('reply_class_question', {
      p_question_id: questionId,
      p_content: check.clean,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id),
        questionId: String(r.question_id),
        authorId: String(r.author_user_id),
        authorName: String(r.author_name),
        content: String(r.content),
        createdAt: String(r.created_at),
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function moderateClassQuestion(
  questionId: string,
  hidden: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string; isHidden: boolean }>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('moderate_class_question', {
      p_question_id: questionId,
      p_hidden: hidden,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return { ok: true, status: 'READY', data: { id: String(r.id), isHidden: Boolean(r.is_hidden) } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
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

    const mapped: MessageThread[] = threadRows.map((t) => {
      const tid = String(t.id);
      const parts = partByThread.get(tid) ?? [];
      const selfPart = parts.find((p) => p.userId === userId);
      const otherPart = parts.find((p) => p.userId !== userId);
      const threadMsgs = msgByThread.get(tid) ?? [];
      const otherMsg = threadMsgs.find((m) => m.senderId !== userId);
      return {
        id: tid,
        subject: t.subject ? String(t.subject) : undefined,
        recipientId: otherPart?.userId ?? '',
        recipientName: otherMsg?.senderName || (t.subject ? String(t.subject) : 'School Thread'),
        recipientRole: 'SCHOOL',
        lastMessage: String(t.last_message_preview ?? ''),
        updatedAt: String(t.updated_at),
        unread: Boolean(selfPart?.unread),
        messages: threadMsgs,
      };
    });

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
    return {
      ok: true,
      status: 'READY',
      data: Array.isArray(data) ? (data as MessageRecipientOption[]) : [],
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
    return { ok: true, status: 'READY', data: { threadId: String(row.threadId ?? '') } };
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
    return { ok: true, status: 'READY', data: { id: String(row.id ?? '') } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listPublicDirectory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<
  BackendOpResult<{
    teachers: TeacherDirectoryMember[];
    admins: AdminDirectoryMember[];
  }>
> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('directory_entries')
      .select('id, entry_type, display_name, title, photo_url, bio, tags, languages, is_published, sort_order')
      .order('sort_order', { ascending: true });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const teachers: TeacherDirectoryMember[] = [];
    const admins: AdminDirectoryMember[] = [];
    if (Array.isArray(data)) {
      for (const row of data as Record<string, unknown>[]) {
        const entryType = String(row.entry_type);
        if (entryType === 'TEACHER') {
          teachers.push({
            id: String(row.id),
            name: String(row.display_name),
            title: String(row.title),
            photoUrl: String(row.photo_url || '/assets/kristou-logo.png'),
            bio: String(row.bio ?? ''),
            classes: Array.isArray(row.tags) ? (row.tags as string[]) : [],
            languages: Array.isArray(row.languages) ? (row.languages as string[]) : [],
            isPublished: Boolean(row.is_published),
          });
        } else if (entryType === 'ADMIN') {
          admins.push({
            id: String(row.id),
            name: String(row.display_name),
            title: String(row.title),
            photoUrl: String(row.photo_url || '/assets/kristou-logo.png'),
            bio: String(row.bio ?? ''),
            responsibilities: Array.isArray(row.tags) ? (row.tags as string[]) : [],
            isPublished: Boolean(row.is_published),
          });
        }
      }
    }
    return { ok: true, status: 'READY', data: { teachers, admins } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function upsertDirectoryEntry(
  input: {
    id?: string | null;
    entryType: 'TEACHER' | 'ADMIN';
    displayName: string;
    title: string;
    bio: string;
    tags: string[];
    languages?: string[];
    photoUrl?: string;
    isPublished?: boolean;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string }>> {
  if (input.displayName.trim().length < 2 || input.title.trim().length < 2) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_directory_input', errorMessage: 'Name and title are required.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('upsert_directory_entry', {
      p_id: input.id || null,
      p_entry_type: input.entryType,
      p_display_name: input.displayName.trim(),
      p_title: input.title.trim(),
      p_bio: input.bio.trim(),
      p_tags: input.tags,
      p_languages: input.languages ?? [],
      p_photo_url: input.photoUrl?.trim() || '/assets/kristou-logo.png',
      p_is_published: input.isPublished ?? true,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as { id?: string };
    return { ok: true, status: 'READY', data: { id: String(row.id ?? '') } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function fetchActiveFoodMenu(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<FoodMenuWeek | null>> {
  if (!client) return unavailableResult();
  try {
    const { data: weeks, error } = await client
      .from('food_menu_weeks')
      .select('id, week_range, provider_name, status, created_at')
      .eq('status', 'PUBLISHED')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const week = Array.isArray(weeks) && weeks.length > 0 ? (weeks[0] as Record<string, unknown>) : null;
    if (!week) return { ok: true, status: 'READY', data: null };

    const { data: days, error: daysErr } = await client
      .from('food_menu_days')
      .select('day_order, day_label, starter, main_dish, side_dish, dessert, notes')
      .eq('menu_week_id', String(week.id))
      .order('day_order', { ascending: true });
    if (daysErr) return { ok: false, ...classifySupabaseError(daysErr) };

    const items: FoodMenuItem[] = Array.isArray(days)
      ? days.map((d: Record<string, unknown>) => ({
          day: String(d.day_label),
          starter: String(d.starter ?? ''),
          main: String(d.main_dish ?? ''),
          side: String(d.side_dish ?? ''),
          dessert: String(d.dessert ?? ''),
          notes: d.notes ? String(d.notes) : undefined,
        }))
      : [];

    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(week.id),
        weekRange: String(week.week_range),
        providerName: String(week.provider_name ?? 'La Toque Gourmande'),
        published: String(week.status) === 'PUBLISHED',
        status: String(week.status) as FoodMenuWeek['status'],
        items,
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function saveFoodMenuWeek(
  weekRange: string,
  days: FoodMenuItem[],
  publish = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string }>> {
  if (weekRange.trim().length < 3 || days.length === 0) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_menu_input', errorMessage: 'Week range and at least one day are required.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('save_food_menu_week', {
      p_week_range: weekRange.trim(),
      p_days: days,
      p_publish: publish,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as { id?: string };
    return { ok: true, status: 'READY', data: { id: String(row.id ?? '') } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function loadMyPreferences(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<UserPreferencesState | null>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('user_preferences')
      .select('language, theme, notification_sound, sound_muted, vibration_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (!data) return { ok: true, status: 'READY', data: null };
    return {
      ok: true,
      status: 'READY',
      data: {
        language: (data.language as Language) || 'fr',
        theme: (data.theme as ThemeMode) || 'light',
        notificationSound: (data.notification_sound as NotificationSoundOption) || 'Kristou Bell',
        soundMuted: Boolean(data.sound_muted),
        vibrationEnabled: data.vibration_enabled !== false,
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function saveMyPreferences(
  prefs: Partial<UserPreferencesState>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<UserPreferencesState>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('upsert_my_preferences', {
      p_language: prefs.language ?? null,
      p_theme: prefs.theme ?? null,
      p_notification_sound: prefs.notificationSound ?? null,
      p_sound_muted: prefs.soundMuted ?? null,
      p_vibration_enabled: prefs.vibrationEnabled ?? null,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        language: (r.language as Language) || 'fr',
        theme: (r.theme as ThemeMode) || 'light',
        notificationSound: (r.notification_sound as NotificationSoundOption) || 'Kristou Bell',
        soundMuted: Boolean(r.sound_muted),
        vibrationEnabled: r.vibration_enabled !== false,
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
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

export async function fetchPublicContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<Record<string, PublicContentEntry>>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('school_public_content')
      .select('slug, title_ar, title_fr, title_en, body_ar, body_fr, body_en, is_published, updated_at')
      .eq('is_published', true);
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const entries: Record<string, PublicContentEntry> = {};
    if (Array.isArray(data)) {
      for (const row of data as Record<string, unknown>[]) {
        const slug = String(row.slug || '').trim();
        if (!slug) continue;
        entries[slug] = {
          slug,
          titleAr: String(row.title_ar ?? ''),
          titleFr: String(row.title_fr ?? ''),
          titleEn: String(row.title_en ?? ''),
          bodyAr: String(row.body_ar ?? ''),
          bodyFr: String(row.body_fr ?? ''),
          bodyEn: String(row.body_en ?? ''),
          isPublished: Boolean(row.is_published),
          updatedAt: row.updated_at ? String(row.updated_at) : undefined,
        };
      }
    }
    return { ok: true, status: 'READY', data: entries };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

