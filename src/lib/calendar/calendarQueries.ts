import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult, CalendarAudienceMode, CalendarEvent } from '../../types.ts';
import { getMonthCalendarRange, sortCalendarEvents } from './calendarModel.ts';

type CalendarClient = Pick<NonNullable<typeof supabase>, 'from'>;
export interface CalendarReadOptions {
  startDate?: string;
  endDate?: string;
  /** Page size, not a cap on the month's visible events. */
  limit?: number;
  classId?: string | null;
}

// Excludes created_at, created_by, and updated_at because school_calendar_event_feed intentionally omits them.
const SELECT_EVENT_FEED =
  'id, audience_mode, class_id, target_class_ids, title, description, category, start_date, end_date, is_all_day, start_time, end_time, timezone, is_public, status, cancellation_reason';

const VALID_AUDIENCE_MODES: readonly CalendarAudienceMode[] = [
  'WHOLE_SCHOOL',
  'SINGLE_CLASS',
  'TEACHER_CLASSES',
  'ALL_MY_CLASSES',
];
const VALID_CATEGORIES = [
  'EVENT',
  'EXAM',
  'TEST',
  'MEETING',
  'HOLIDAY',
  'CLOSURE',
  'ACTIVITY',
  'TRIP',
  'OTHER',
] as const;
const VALID_STATUSES = ['SCHEDULED', 'RESCHEDULED', 'CANCELLED'] as const;

function knownValue<const T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value === 'string') {
    for (const candidate of allowed) {
      if (candidate === value) return candidate;
    }
  }
  throw new Error(`Invalid calendar ${field}: ${String(value)}`);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing calendar ${field}`);
  }
  return value;
}

function normalizeTargetClassIds(value: unknown, audienceMode: CalendarAudienceMode): string[] {
  if (audienceMode === 'WHOLE_SCHOOL') {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('Malformed calendar target_class_ids');
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new Error('Malformed calendar target_class_ids entry');
    }
    const clean = item.trim();
    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
}

export async function listSchoolCalendarEvents(
  userId?: string | null,
  client: CalendarClient | null = supabase,
  options?: CalendarReadOptions,
): Promise<BackendOpResult<CalendarEvent[]>> {
  if (!client) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase public configuration is not available in this build.',
    };
  }
  try {
    const cleanClassId = options?.classId ? options.classId.trim() : null;
    if (cleanClassId && !/^[A-Za-z0-9-]+$/.test(cleanClassId)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_class_id',
        errorMessage: 'Invalid class filter.',
      };
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
    const defaultRange = getMonthCalendarRange(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1);
    const startDate = options?.startDate ?? defaultRange.startDate;
    const endDate = options?.endDate ?? defaultRange.endDate;
    const pageSize = Math.max(1, Math.min(250, Math.trunc(options?.limit || 250)));
    const events: CalendarEvent[] = [];

    for (let offset = 0; ; offset += pageSize) {
      let query = client
        .from('school_calendar_event_feed')
        .select(SELECT_EVENT_FEED)
        .lte('start_date', endDate)
        .gte('end_date', startDate)
        .order('start_date', { ascending: true })
        .order('id', { ascending: true });
      // RLS remains authoritative; this filter narrows to the displayed class plus whole-school events.
      if (cleanClassId) {
        query = query.or(`audience_mode.eq.WHOLE_SCHOOL,target_class_ids.cs.{${cleanClassId}}`);
      }
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      if (error) return { ok: false, ...classifySupabaseError(error) };
      const rows = data ?? [];
      const rowIds: string[] = [];
      for (const row of rows) {
        rowIds.push(requireNonEmptyString(row.id, 'id'));
      }

      const responses = new Map<string, CalendarEvent['myResponse']>();
      if (userId && rowIds.length > 0) {
        const { data: responseRows, error: responseError } = await client
          .from('school_calendar_responses')
          .select('event_id, response')
          .eq('user_id', userId)
          .in('event_id', rowIds);
        if (responseError) return { ok: false, ...classifySupabaseError(responseError) };
        for (const row of responseRows ?? []) {
          responses.set(
            requireNonEmptyString(row.event_id, 'response.event_id'),
            knownValue(row.response, ['ATTENDING', 'ACKNOWLEDGED', 'DECLINED'], 'response'),
          );
        }
      }

      for (const row of rows) {
        const id = requireNonEmptyString(row.id, 'id');
        const audienceMode = knownValue(row.audience_mode, VALID_AUDIENCE_MODES, 'audience_mode');
        const title = requireNonEmptyString(row.title, 'title');
        const start = requireNonEmptyString(row.start_date, 'start_date');
        const category = knownValue(row.category, VALID_CATEGORIES, 'category');
        const status = knownValue(row.status, VALID_STATUSES, 'status');
        if (typeof row.is_public !== 'boolean') {
          throw new Error('Malformed calendar is_public');
        }
        const targetClassIds = normalizeTargetClassIds(row.target_class_ids, audienceMode);
        const classId =
          audienceMode === 'WHOLE_SCHOOL'
            ? undefined
            : typeof row.class_id === 'string' && row.class_id.trim().length > 0
            ? row.class_id.trim()
            : undefined;

        events.push({
          id,
          audienceMode,
          classId,
          targetClassIds,
          title,
          description: typeof row.description === 'string' ? row.description : '',
          category,
          date: start,
          endDate:
            typeof row.end_date === 'string' && row.end_date.trim().length > 0 ? row.end_date : start,
          isAllDay: row.is_all_day !== false,
          startTime: row.start_time ?? null,
          endTime: row.end_time ?? null,
          timezone:
            typeof row.timezone === 'string' && row.timezone.trim().length > 0
              ? row.timezone
              : 'Africa/Tunis',
          isPublic: row.is_public,
          status,
          cancellationReason: row.cancellation_reason ?? null,
          myResponse: responses.get(id) ?? null,
        });
      }
      if (rows.length < pageSize) break;
    }

    return { ok: true, status: 'READY', data: sortCalendarEvents(events) };
  } catch (error) {
    return { ok: false, ...classifySupabaseError(error) };
  }
}
