import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { getCalendarPermissionsUi } from '../../homepages/homepageAccess';
import {
  resolveCalendarAudiencePlan, type CalendarClassOption, type CalendarTeacherOption,
} from '../../../lib/calendar/calendarAudience';
import {
  calendarEventMatchesAuthorizedClasses, isWholeSchoolCalendarEvent,
} from '../../../lib/calendar/calendarModel';
import { useCalendarMonth, type CalendarMonthLoader } from '../../../lib/calendar/useCalendarMonth';
import {
  getEventsForCalendarDate, getMonthCalendarRange, getTunisSchoolDay,
} from '../../../lib/schoolContent';
import type { AccountRole, BackendOpStatus, CalendarEvent } from '../../../types';
import { AGENDA_PAGE_SIZE, pad2 } from './calendarDisplayConfig';
import { useCalendarEventMutations } from './useCalendarEventMutations';
import { useTeacherDirectoryOptions } from './useTeacherDirectoryOptions';

export interface SchoolCalendarControllerProps {
  events: CalendarEvent[]; backendStatus: BackendOpStatus;
  classId?: string | null; canManage?: boolean; canCreate?: boolean;
  canCancel?: boolean; canManageCalendar?: boolean; canRespond?: boolean;
  assignedClasses?: CalendarClassOption[]; allClasses?: CalendarClassOption[];
  teacherOptions?: CalendarTeacherOption[]; isLoading?: boolean;
  errorMessage?: string | null; onRefresh: () => Promise<boolean | void>;
  loadMonthEvents?: CalendarMonthLoader;
}

export function useSchoolCalendarController(props: SchoolCalendarControllerProps) {
  const {
    events: hydratedEvents, backendStatus: hydratedStatus, classId = null,
    canManage, canCreate, canCancel, canManageCalendar, canRespond,
    assignedClasses, allClasses, teacherOptions,
    isLoading: isHydrating = false, errorMessage: hydrationError = null,
    onRefresh: refreshSchoolData, loadMonthEvents,
  } = props;

  const { currentUser, language, t } = useApp();
  const todayStr = getTunisSchoolDay();
  const [cursorYear, setCursorYear] = useState<number>(() => Number(todayStr.slice(0, 4)));
  const [cursorMonth, setCursorMonth] = useState<number>(() => Number(todayStr.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [agendaLimit, setAgendaLimit] = useState<number>(AGENDA_PAGE_SIZE);
  const [confirmedCancellations, setConfirmedCancellations] = useState<
    Record<string, { scopeKey: string; reason: string }>
  >({});

  const resolvedAssignedClasses = useMemo(() => {
    const allowedUserClassIds =
      currentUser?.role === 'TEACHER' && Array.isArray(currentUser.assignedClassIds)
        ? new Set(currentUser.assignedClassIds)
        : null;
    if (assignedClasses !== undefined) {
      return allowedUserClassIds
        ? assignedClasses.filter((c) => allowedUserClassIds.has(c.id))
        : [...assignedClasses];
    }
    if (allowedUserClassIds) {
      const catalog = allClasses ?? [];
      return currentUser!.assignedClassIds!.map(
        (id) => catalog.find((c) => c.id === id) ?? { id, name: id },
      );
    }
    return [];
  }, [assignedClasses, currentUser?.role, currentUser?.assignedClassIds, allClasses]);

  const resolvedAssignedClassIds = useMemo(
    () => resolvedAssignedClasses.map((c) => c.id),
    [resolvedAssignedClasses],
  );

  const actorPerms = useMemo(
    () =>
      getCalendarPermissionsUi(currentUser, {
        classId,
        assignedClassIds: assignedClasses !== undefined ? resolvedAssignedClassIds : undefined,
      }),
    [currentUser, classId, assignedClasses, resolvedAssignedClassIds],
  );

  const isAccountUnapproved = Boolean(currentUser && currentUser.accountStatus !== 'APPROVED');
  const effectiveActorRole: AccountRole | null =
    currentUser && currentUser.accountStatus === 'APPROVED' ? currentUser.role : null;

  const canManageProp = canManageCalendar ?? canManage;
  const isSchoolCalendarManager =
    actorPerms.canManageCalendar && (canManageProp === undefined || Boolean(canManageProp));
  const canCreateResolved =
    actorPerms.canCreate && (canCreate === undefined || Boolean(canCreate));
  const canCancelResolved =
    actorPerms.canCancel && (canCancel === undefined || Boolean(canCancel));
  const canRespondResolved =
    actorPerms.canRespond && (canRespond === undefined || Boolean(canRespond));

  const resolvedAllClasses = useMemo(() => {
    if (allClasses && allClasses.length > 0) return [...allClasses];
    if (resolvedAssignedClasses.length > 0) return resolvedAssignedClasses;
    if (isSchoolCalendarManager && classId) return [{ id: classId, name: classId }];
    return [];
  }, [allClasses, resolvedAssignedClasses, isSchoolCalendarManager, classId]);

  const userCapabilitiesKey = useMemo(
    () => [...(currentUser?.capabilities ?? [])].sort().join(','),
    [currentUser?.capabilities],
  );
  const userAssignedClassesKey = useMemo(
    () => [...(currentUser?.assignedClassIds ?? [])].sort().join(','),
    [currentUser?.assignedClassIds],
  );
  const panelAssignedClassesKey = useMemo(
    () => [...resolvedAssignedClassIds].sort().join(','),
    [resolvedAssignedClassIds],
  );
  const userLinkedChildrenKey = useMemo(
    () => [...(currentUser?.linkedChildrenIds ?? [])].sort().join(','),
    [currentUser?.linkedChildrenIds],
  );

  const accountKey = useMemo(
    () =>
      JSON.stringify([
        currentUser?.id ?? null, currentUser?.accountStatus ?? null, currentUser?.role ?? null,
        userCapabilitiesKey, userAssignedClassesKey, panelAssignedClassesKey, userLinkedChildrenKey,
        isSchoolCalendarManager, canCreateResolved, canCancelResolved,
      ]),
    [
      currentUser?.id, currentUser?.accountStatus, currentUser?.role,
      userCapabilitiesKey, userAssignedClassesKey, panelAssignedClassesKey, userLinkedChildrenKey,
      isSchoolCalendarManager, canCreateResolved, canCancelResolved,
    ],
  );
  const activeScopeKey = `${accountKey}::${classId ?? 'school'}`;

  const mountedRef = useRef(true);
  const requestGenRef = useRef(0);
  const activeScopeRef = useRef(activeScopeKey);
  activeScopeRef.current = activeScopeKey;
  const lastScopeKeyRef = useRef(activeScopeKey);
  const sameScopeCacheRef = useRef<{ key: string; events: CalendarEvent[] }>({
    key: '', events: [],
  });
  const confirmedCancellationsRef = useRef<Map<string, { scopeKey: string; reason: string }>>(
    new Map(),
  );

  if (lastScopeKeyRef.current !== activeScopeKey) {
    lastScopeKeyRef.current = activeScopeKey;
    sameScopeCacheRef.current = { key: '', events: [] };
    confirmedCancellationsRef.current.clear();
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenRef.current += 1;
    };
  }, []);

  const monthRange = useMemo(
    () => getMonthCalendarRange(cursorYear, cursorMonth),
    [cursorYear, cursorMonth],
  );
  const month = useCalendarMonth({
    userId: currentUser?.accountStatus === 'APPROVED' ? currentUser.id : null,
    accountKey, classId, ...monthRange,
    enabled: !isAccountUnapproved && (hydratedStatus === 'READY' || hydratedStatus === 'ERROR'),
    refreshVersion: hydratedEvents, loader: loadMonthEvents,
  });

  const backendStatus: BackendOpStatus = isAccountUnapproved
    ? 'UNAUTHORIZED'
    : month.result?.status ?? hydratedStatus;
  const errorMessage = isAccountUnapproved
    ? null
    : month.result?.errorMessage ?? hydrationError;
  const isLoading = !isAccountUnapproved && (isHydrating || month.loading);
  const isUnauthorized =
    backendStatus === 'UNAUTHORIZED' ||
    isAccountUnapproved ||
    (currentUser === null && classId !== null);

  const { loadingTeachers, effectiveTeacherOptions, effectiveTeacherPickerBlocked } =
    useTeacherDirectoryOptions({
      teacherOptions, isSchoolCalendarManager, isAccountUnapproved, isUnauthorized,
      currentUser, activeScopeKey, mountedRef, activeScopeRef,
    });

  const audiencePlan = useMemo(
    () =>
      resolveCalendarAudiencePlan({
        actorRole: effectiveActorRole, canManageCalendar: isSchoolCalendarManager,
        contextClassId: classId, assignedClasses: resolvedAssignedClasses,
        allClasses: resolvedAllClasses, teacherOptions: effectiveTeacherOptions,
        teacherPickerBlocked: effectiveTeacherPickerBlocked,
      }),
    [
      effectiveActorRole, isSchoolCalendarManager, classId, resolvedAssignedClasses,
      resolvedAllClasses, effectiveTeacherOptions, effectiveTeacherPickerBlocked,
    ],
  );

  const authorizedUserClassIdSet = useMemo(() => {
    const base = new Set(currentUser?.assignedClassIds ?? []);
    if (currentUser?.role === 'TEACHER' && assignedClasses !== undefined) {
      return new Set(resolvedAssignedClassIds.filter((id) => base.has(id)));
    }
    return base;
  }, [currentUser?.assignedClassIds, currentUser?.role, assignedClasses, resolvedAssignedClassIds]);

  const applyConfirmedCancellations = (list: CalendarEvent[]): CalendarEvent[] =>
    list.map((ev) => {
      const confirmed =
        confirmedCancellationsRef.current.get(ev.id) ?? confirmedCancellations[ev.id];
      if (!confirmed || confirmed.scopeKey !== activeScopeKey) return ev;
      return {
        ...ev,
        status: 'CANCELLED',
        cancellationReason: ev.cancellationReason || confirmed.reason || undefined,
      };
    });

  if (isUnauthorized) {
    sameScopeCacheRef.current = { key: '', events: [] };
  } else if (month.currentScope && month.result?.ok) {
    sameScopeCacheRef.current = {
      key: month.scopeKey,
      events: applyConfirmedCancellations(month.result.data ?? []),
    };
  }

  const hasSameScopeCache = sameScopeCacheRef.current.key === month.scopeKey;
  const hydratedScopedEvents = useMemo(() => {
    const inRange = hydratedEvents.filter(
      (event) =>
        event.date <= monthRange.endDate && (event.endDate || event.date) >= monthRange.startDate,
    );
    if (effectiveActorRole === null) {
      return inRange.filter((event) => isWholeSchoolCalendarEvent(event) && event.isPublic !== false);
    }
    if (!isSchoolCalendarManager) {
      return inRange.filter((event) =>
        calendarEventMatchesAuthorizedClasses(event, authorizedUserClassIdSet),
      );
    }
    return inRange;
  }, [
    hydratedEvents, monthRange.startDate, monthRange.endDate,
    effectiveActorRole, isSchoolCalendarManager, authorizedUserClassIdSet,
  ]);

  let rawEvents: CalendarEvent[] = [];
  if (!isUnauthorized) {
    if (month.currentScope && month.result?.ok) {
      rawEvents = month.result.data ?? [];
    } else if (month.loading || (month.currentScope && month.result && !month.result.ok)) {
      rawEvents = hasSameScopeCache ? sameScopeCacheRef.current.events : [];
    } else if (hydratedStatus === 'READY') {
      rawEvents = hydratedScopedEvents;
    } else {
      rawEvents = hasSameScopeCache ? sameScopeCacheRef.current.events : [];
    }
  }
  const events = isUnauthorized ? [] : applyConfirmedCancellations(rawEvents);

  const onRefresh = async () => {
    let schoolRefreshed: boolean | void = true;
    try {
      schoolRefreshed = await refreshSchoolData();
    } catch {
      schoolRefreshed = false;
    }
    let monthRefreshed = false;
    try {
      monthRefreshed = await month.reload();
    } catch {
      monthRefreshed = false;
    }
    return schoolRefreshed !== false && monthRefreshed;
  };

  const mutations = useCalendarEventMutations({
    todayStr, selectedDate, setSelectedDate, setAgendaLimit,
    audiencePlan, resolvedAssignedClasses, effectiveTeacherPickerBlocked, loadingTeachers,
    backendStatus, isUnauthorized, canCreateResolved, canCancelResolved, canRespondResolved,
    effectiveActorRole, isSchoolCalendarManager, activeScopeKey, monthScopeKey: month.scopeKey,
    mountedRef, requestGenRef, activeScopeRef, sameScopeCacheRef, confirmedCancellationsRef,
    confirmedCancellations, setConfirmedCancellations, events, onRefresh, language, t,
  });

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of resolvedAllClasses) map.set(c.id, c.name);
    for (const c of resolvedAssignedClasses) map.set(c.id, c.name);
    return map;
  }, [resolvedAllClasses, resolvedAssignedClasses]);

  const visibleEvents = useMemo(() => {
    if (isUnauthorized) return [];
    return events.filter((ev) => categoryFilter === 'ALL' || ev.category === categoryFilter);
  }, [events, categoryFilter, isUnauthorized]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(cursorYear, cursorMonth, 1));
    const startOffset = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(cursorYear, cursorMonth + 1, 0)).getUTCDate();
    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ dateStr: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ dateStr: `${cursorYear}-${pad2(cursorMonth + 1)}-${pad2(d)}`, dayNum: d });
    }
    while (cells.length % 7 !== 0) cells.push({ dateStr: null, dayNum: null });
    return cells;
  }, [cursorYear, cursorMonth]);

  const monthTitle = useMemo(() => {
    const locale = language === 'ar' ? 'ar-TN' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(Date.UTC(cursorYear, cursorMonth, 1)));
  }, [cursorYear, cursorMonth, language]);

  const weekdayLabels = useMemo(() => {
    if (language === 'ar') return ['إث', 'ثل', 'أر', 'خم', 'جم', 'سب', 'أح'];
    if (language === 'fr') return ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }, [language]);

  const selectedDayEvents = useMemo(
    () => getEventsForCalendarDate(visibleEvents, selectedDate),
    [visibleEvents, selectedDate],
  );
  const pagedDayEvents = useMemo(
    () => selectedDayEvents.slice(0, agendaLimit),
    [selectedDayEvents, agendaLimit],
  );

  const chooseDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setAgendaLimit(AGENDA_PAGE_SIZE);
    mutations.syncDatesOnDateChoose(dateStr);
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(cursorYear, cursorMonth + delta, 1));
    setCursorYear(next.getUTCFullYear());
    setCursorMonth(next.getUTCMonth());
    chooseDate(`${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-01`);
    mutations.clearTransientInteractionState();
  };

  const goToToday = () => {
    const currentTunisToday = getTunisSchoolDay();
    setCursorYear(Number(currentTunisToday.slice(0, 4)));
    setCursorMonth(Number(currentTunisToday.slice(5, 7)) - 1);
    chooseDate(currentTunisToday);
  };

  return {
    language, t, todayStr, selectedDate, categoryFilter, setCategoryFilter, setAgendaLimit,
    monthRange, monthTitle, weekdayLabels, monthCells, events, visibleEvents,
    selectedDayEvents, pagedDayEvents, classNameById,
    backendStatus, errorMessage, isLoading, isUnauthorized,
    isSchoolCalendarManager, canCreateResolved, canCancelResolved, canRespondResolved,
    audiencePlan, resolvedAssignedClasses, loadingTeachers, effectiveTeacherPickerBlocked,
    chooseDate, shiftMonth, goToToday, onRefresh,
    ...mutations,
  };
}
