import type { CalendarEvent } from '../../types.ts';

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

