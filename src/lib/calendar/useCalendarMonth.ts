import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendOpResult, CalendarEvent } from '../../types.ts';
import { listSchoolCalendarEvents, type CalendarReadOptions } from './calendarQueries.ts';
import { createCalendarReadOwner, type CalendarReadState } from './calendarReadOwner.ts';

export type CalendarMonthLoader = (
  userId?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any,
  options?: CalendarReadOptions,
) => Promise<BackendOpResult<CalendarEvent[]>>;

interface MonthRequest {
  userId: string | null;
  accountKey: string;
  classId: string | null;
  startDate: string;
  endDate: string;
  enabled: boolean;
  refreshVersion: readonly CalendarEvent[];
  loader?: CalendarMonthLoader;
}

/** Owns month reads, not school-wide hydration or mutation policy. */
export function useCalendarMonth(request: MonthRequest) {
  const { userId, accountKey, classId, startDate, endDate, enabled, refreshVersion, loader } = request;
  const loaderRef = useRef<CalendarMonthLoader>(loader ?? listSchoolCalendarEvents);
  loaderRef.current = loader ?? listSchoolCalendarEvents;

  const key = JSON.stringify([accountKey, classId, startDate, endDate, enabled]);
  const ownerRef = useRef<ReturnType<typeof createCalendarReadOwner> | null>(null);
  if (!ownerRef.current) ownerRef.current = createCalendarReadOwner();
  const owner = ownerRef.current;
  owner.setScope(key);
  const [state, setState] = useState<CalendarReadState>({ key, loading: false, result: null });

  const reload = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    return owner.load(
      key,
      () => loaderRef.current(userId, undefined, { startDate, endDate, classId }),
      setState,
    );
  }, [enabled, key, userId, startDate, endDate, classId, owner]);

  useEffect(() => {
    owner.activate();
    if (enabled) void reload();
    return () => {
      owner.deactivate();
    };
  }, [enabled, reload, refreshVersion, owner]);

  return {
    scopeKey: key,
    currentScope: state.key === key,
    result: state.key === key ? state.result : null,
    loading: enabled && (state.key !== key || state.loading),
    reload,
  };
}
