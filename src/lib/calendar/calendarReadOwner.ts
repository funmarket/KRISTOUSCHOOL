import type { BackendOpResult, CalendarEvent } from '../../types.ts';

export interface CalendarReadState {
  key: string;
  loading: boolean;
  result: BackendOpResult<CalendarEvent[]> | null;
}

/** Request ownership shared by effect-driven loads and delayed post-mutation reloads. */
export function createCalendarReadOwner() {
  let key = '';
  let active = false;
  let generation = 0;
  return {
    setScope(next: string) {
      if (key !== next) { key = next; generation += 1; }
    },
    activate() { active = true; },
    deactivate() { active = false; generation += 1; },
    async load(
      capturedKey: string,
      read: () => Promise<BackendOpResult<CalendarEvent[]>>,
      publish: (state: CalendarReadState) => void,
    ): Promise<boolean> {
      // An old callback must not invalidate a newer read or replace its loading state.
      if (!active || key !== capturedKey) return false;
      const request = ++generation;
      publish({ key: capturedKey, loading: true, result: null });
      const result = await read();
      if (!active || key !== capturedKey || request !== generation) return false;
      publish({ key: capturedKey, loading: false, result });
      return result.ok;
    },
  };
}
