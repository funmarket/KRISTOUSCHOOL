import React from 'react';
import { getEventsForCalendarDate } from '../../../lib/schoolContent';
import type { CalendarEvent } from '../../../types';
import { getCategoryStyle } from './calendarDisplayConfig';

export interface CalendarMonthGridProps {
  weekdayLabels: string[];
  monthCells: Array<{ dateStr: string | null; dayNum: number | null }>;
  visibleEvents: CalendarEvent[];
  todayStr: string;
  selectedDate: string;
  chooseDate: (dateStr: string) => void;
}

export const CalendarMonthGrid: React.FC<CalendarMonthGridProps> = ({
  weekdayLabels,
  monthCells,
  visibleEvents,
  todayStr,
  selectedDate,
  chooseDate,
}) => {
  return (
    <div className="lg:col-span-2 bg-white dark:bg-[#111111] p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekdayLabels.map((lbl) => (
          <div key={lbl} className="text-[11px] font-extrabold text-gray-500 py-1">
            {lbl}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthCells.map((cell, idx) => {
          if (!cell.dateStr || !cell.dayNum) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[4.25rem] rounded-xl bg-gray-50/40 dark:bg-zinc-950/30"
              />
            );
          }
          const dayEvents = getEventsForCalendarDate(visibleEvents, cell.dateStr);
          const isToday = cell.dateStr === todayStr;
          const isSelected = cell.dateStr === selectedDate;
          return (
            <button
              key={cell.dateStr}
              type="button"
              data-testid={`calendar-day-${cell.dateStr}`}
              aria-pressed={isSelected}
              onClick={() => chooseDate(cell.dateStr!)}
              className={`min-h-[4.25rem] p-1.5 rounded-xl border text-start flex flex-col gap-1 transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                  : isToday
                  ? 'border-emerald-500/70 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[11px] font-extrabold ${
                    isToday
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cell.dayNum}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] font-extrabold px-1.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-0.5 w-full overflow-hidden">
                {dayEvents.slice(0, 2).map((ev) => (
                  <div
                    key={ev.id}
                    className={`text-[9px] font-bold px-1 py-0.5 rounded truncate ${getCategoryStyle(
                      ev.category,
                      ev.status === 'CANCELLED',
                    )}`}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] font-bold text-gray-400">
                    +{dayEvents.length - 2}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
