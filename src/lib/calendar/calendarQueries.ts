import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult, CalendarEvent } from '../../types.ts';
import { getMonthCalendarRange, sortCalendarEvents } from './calendarModel.ts';

type CalendarClient = Pick<NonNullable<typeof supabase>, 'from'>;
export interface CalendarReadOptions {
  startDate?: string;
  endDate?: string;
  /** Page size, not a cap on the month's visible events. */
  limit?: number;
  classId?: string | null;
}
const SELECT_EVENTS = 'id, class_id, title, description, category, start_date, end_date, is_all_day, start_time, end_time, timezone, is_public, status, cancellation_reason';

function knownValue<const T extends string>(value: string, allowed: readonly T[]): T {
  for (const candidate of allowed) if (candidate === value) return candidate;
  throw new Error(`Unsupported calendar value: ${value}`);
}

export async function listSchoolCalendarEvents(
  userId?: string | null,
  client: CalendarClient | null = supabase,
  options?: CalendarReadOptions,
): Promise<BackendOpResult<CalendarEvent[]>> {
  if (!client) return { ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable', errorMessage: 'Supabase public configuration is not available in this build.' };
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
    const defaultRange = getMonthCalendarRange(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1);
    const startDate = options?.startDate ?? defaultRange.startDate;
    const endDate = options?.endDate ?? defaultRange.endDate;
    const pageSize = Math.max(1, Math.min(250, Math.trunc(options?.limit || 250)));
    const events: CalendarEvent[] = [];
    for (let offset = 0; ; offset += pageSize) {
      let query = client.from('school_calendar_events').select(SELECT_EVENTS)
        .lte('start_date', endDate).gte('end_date', startDate)
        .order('start_date', { ascending: true }).order('id', { ascending: true });
      // RLS remains authoritative; this filter narrows the displayed class plus school-wide events.
      if (options?.classId) query = query.or(`class_id.is.null,class_id.eq.${options.classId}`);
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      if (error) return { ok: false, ...classifySupabaseError(error) };
      const rows = data ?? [];
      const responses = new Map<string, CalendarEvent['myResponse']>();
      if (userId && rows.length > 0) {
        const { data: responseRows, error: responseError } = await client.from('school_calendar_responses')
          .select('event_id, response').eq('user_id', userId).in('event_id', rows.map(row => row.id));
        if (responseError) return { ok: false, ...classifySupabaseError(responseError) };
        for (const row of responseRows ?? []) responses.set(row.event_id,
          knownValue(row.response, ['ATTENDING', 'ACKNOWLEDGED', 'DECLINED']));
      }
      for (const row of rows) events.push({
        id: row.id, classId: row.class_id ?? undefined, title: row.title,
        description: row.description ?? '', category: knownValue(row.category ?? 'EVENT', ['EVENT', 'EXAM', 'TEST', 'MEETING', 'HOLIDAY', 'CLOSURE', 'ACTIVITY', 'TRIP', 'OTHER']),
        date: row.start_date, endDate: row.end_date ?? row.start_date,
        isAllDay: row.is_all_day !== false, startTime: row.start_time ?? null,
        endTime: row.end_time ?? null, timezone: row.timezone ?? 'Africa/Tunis',
        isPublic: row.is_public, status: knownValue(row.status ?? 'SCHEDULED', ['SCHEDULED', 'RESCHEDULED', 'CANCELLED']),
        cancellationReason: row.cancellation_reason ?? null,
        myResponse: responses.get(row.id) ?? null,
      });
      if (rows.length < pageSize) break;
    }
    return { ok: true, status: 'READY', data: sortCalendarEvents(events) };
  } catch (error) {
    return { ok: false, ...classifySupabaseError(error) };
  }
}
