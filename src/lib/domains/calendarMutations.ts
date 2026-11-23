import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult, AccountRole } from '../../types.ts';
import { validateCalendarCreateInput } from '../calendar/calendarAudience.ts';
import type { DatabaseSchema } from '../supabase.ts';

export type CalendarEventCategory =
  | 'EXAM'
  | 'TEST'
  | 'EVENT'
  | 'HOLIDAY'
  | 'MEETING'
  | 'CLOSURE'
  | 'ACTIVITY'
  | 'TRIP'
  | 'OTHER';

export type CalendarAudienceMode =
  | 'WHOLE_SCHOOL'
  | 'SINGLE_CLASS'
  | 'TEACHER_CLASSES'
  | 'ALL_MY_CLASSES';

export interface CalendarEvent {
  id: string;
  audienceMode?: CalendarAudienceMode;
  classId?: string;
  targetClassIds?: string[];
  title: string;
  date: string;
  endDate?: string;
  isAllDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string;
  status?: 'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED';
  cancellationReason?: string | null;
  isPublic?: boolean;
  myResponse?: 'ATTENDING' | 'ACKNOWLEDGED' | 'DECLINED' | null;
  category: CalendarEventCategory;
  description: string;
}

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function upsertSchoolCalendarEvent(
  input: {
    title: string;
    description: string;
    category: CalendarEventCategory;
    startDate: string;
    endDate?: string;
    classId?: string | null;
    teacherUserId?: string | null;
    isAllDay?: boolean;
    isPublic?: boolean;
    audienceMode?: CalendarAudienceMode;
    actorRole?: AccountRole | null;
    canManageCalendar?: boolean;
    allowedClassIds?: readonly string[];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<CalendarEvent>> {
  const validation = validateCalendarCreateInput({
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    category: input.category,
    audienceMode: input.audienceMode,
    classId: input.classId,
    teacherUserId: input.teacherUserId,
    isPublic: input.isPublic,
    actorRole: input.actorRole,
    canManageCalendar: input.canManageCalendar,
    allowedClassIds: input.allowedClassIds,
  });
  if (validation.valid === false) {
    return {
      ok: false,
      status: validation.status,
      errorCode: validation.errorCode,
      errorMessage: validation.errorMessage,
    };
  }
  if (!client) return unavailableResult();
  try {
    const rpcArgs: DatabaseSchema['public']['Functions']['create_school_calendar_event']['Args'] = {
      p_title: input.title.trim(),
      p_description: input.description.trim(),
      p_category: input.category,
      p_start_date: input.startDate,
      p_end_date: validation.endDate,
      p_audience_mode: validation.audienceMode,
      p_is_all_day: input.isAllDay ?? true,
      p_is_public: validation.audienceMode === 'WHOLE_SCHOOL' ? validation.isPublic : false,
      ...(validation.audienceMode === 'SINGLE_CLASS' && validation.classId
        ? { p_class_id: validation.classId }
        : {}),
      ...(validation.audienceMode === 'TEACHER_CLASSES' && validation.teacherUserId
        ? { p_teacher_user_id: validation.teacherUserId }
        : {}),
    };
    const { data, error } = await client.rpc('create_school_calendar_event', rpcArgs);
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_calendar_event_response',
        errorMessage: 'Calendar event response was missing.',
      };
    }
    const row = data as Record<string, unknown>;
    const validModes: readonly CalendarAudienceMode[] = [
      'WHOLE_SCHOOL',
      'SINGLE_CLASS',
      'TEACHER_CLASSES',
      'ALL_MY_CLASSES',
    ];
    const validCategories: readonly CalendarEventCategory[] = [
      'EVENT',
      'EXAM',
      'TEST',
      'MEETING',
      'HOLIDAY',
      'CLOSURE',
      'ACTIVITY',
      'TRIP',
      'OTHER',
    ];
    const validStatuses: readonly NonNullable<CalendarEvent['status']>[] = [
      'SCHEDULED',
      'RESCHEDULED',
      'CANCELLED',
    ];
    const rawId = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : null;
    const rawTitle = typeof row.title === 'string' && row.title.trim() ? row.title : null;
    const rawStart =
      typeof row.start_date === 'string' && row.start_date.trim() ? row.start_date : null;
    const rowAudienceMode = validModes.find((m) => m === row.audience_mode);
    const rowCategory = validCategories.find((c) => c === row.category);
    const rowStatus = validStatuses.find((s) => s === row.status);
    if (
      !rawId ||
      !rawTitle ||
      !rawStart ||
      !rowAudienceMode ||
      !rowCategory ||
      !rowStatus ||
      typeof row.is_public !== 'boolean'
    ) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_calendar_event_response',
        errorMessage: 'Calendar event response was incomplete.',
      };
    }
    const rowClassId =
      typeof row.class_id === 'string' && row.class_id.trim() ? row.class_id.trim() : undefined;

    return {
      ok: true,
      status: 'READY',
      data: {
        id: rawId,
        audienceMode: rowAudienceMode,
        classId: rowAudienceMode === 'WHOLE_SCHOOL' ? undefined : rowClassId,
        title: rawTitle,
        description: typeof row.description === 'string' ? row.description : '',
        category: rowCategory,
        date: rawStart,
        endDate:
          typeof row.end_date === 'string' && row.end_date.trim() ? row.end_date : rawStart,
        isAllDay: row.is_all_day !== false,
        startTime: typeof row.start_time === 'string' ? row.start_time : null,
        endTime: typeof row.end_time === 'string' ? row.end_time : null,
        timezone:
          typeof row.timezone === 'string' && row.timezone.trim()
            ? row.timezone
            : 'Africa/Tunis',
        isPublic: row.is_public,
        status: rowStatus,
        cancellationReason:
          typeof row.cancellation_reason === 'string' ? row.cancellation_reason : null,
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
