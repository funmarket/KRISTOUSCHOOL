import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { getCalendarPermissionsUi } from '../../homepages/homepageAccess';
import { useCalendarMonth, type CalendarMonthLoader } from '../../../lib/calendar/useCalendarMonth';
import {
  resolveCalendarAudiencePlan,
  type CalendarAudienceMode,
  type CalendarClassOption,
} from '../../../lib/calendar/calendarAudience';
import {
  AccountRole,
  BackendOpStatus,
  CalendarEvent,
  CalendarEventCategory,
} from '../../../types';
import { pickText } from '../../../i18n/homepages';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import {
  cancelSchoolCalendarEvent,
  getEventsForCalendarDate,
  getMonthCalendarRange,
  getTunisSchoolDay,
  respondToCalendarEvent,
  upsertSchoolCalendarEvent,
} from '../../../lib/schoolContent';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Info,
  Lock,
  Globe,
  Users,
} from 'lucide-react';

export interface SchoolCalendarPanelProps {
  events: CalendarEvent[];
  backendStatus: BackendOpStatus;
  classId?: string | null;
  canManage?: boolean;
  canCreate?: boolean;
  canCancel?: boolean;
  canManageCalendar?: boolean;
  canRespond?: boolean;
  assignedClasses?: CalendarClassOption[];
  allClasses?: CalendarClassOption[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRefresh: () => Promise<boolean | void>;
  loadMonthEvents?: CalendarMonthLoader;
}

const CATEGORIES: readonly CalendarEventCategory[] = [
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

const AGENDA_PAGE_SIZE = 10;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getCategoryStyle(category: CalendarEventCategory, cancelled?: boolean): string {
  if (cancelled) {
    return 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 line-through';
  }
  switch (category) {
    case 'EXAM':
    case 'TEST':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    case 'HOLIDAY':
    case 'CLOSURE':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    case 'MEETING':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300';
    default:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
  }
}

export const SchoolCalendarPanel: React.FC<SchoolCalendarPanelProps> = ({
  events: hydratedEvents,
  backendStatus: hydratedStatus,
  classId = null,
  canManage,
  canCreate,
  canCancel,
  canManageCalendar,
  canRespond,
  assignedClasses,
  allClasses,
  isLoading: isHydrating = false,
  errorMessage: hydrationError = null,
  onRefresh: refreshSchoolData,
  loadMonthEvents,
}) => {
  const { currentUser, language, t } = useApp();
  const todayStr = getTunisSchoolDay();
  const [cursorYear, setCursorYear] = useState<number>(() => Number(todayStr.slice(0, 4)));
  const [cursorMonth, setCursorMonth] = useState<number>(() => Number(todayStr.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [agendaLimit, setAgendaLimit] = useState<number>(AGENDA_PAGE_SIZE);

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

  // Use the real currentUser and canonical permission owner (homepageAccess); never substitute APP_ADMIN.
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

  const audiencePlan = useMemo(
    () =>
      resolveCalendarAudiencePlan({
        actorRole: effectiveActorRole,
        canManageCalendar: isSchoolCalendarManager,
        contextClassId: classId,
        assignedClasses: resolvedAssignedClasses,
        allClasses: resolvedAllClasses,
      }),
    [effectiveActorRole, isSchoolCalendarManager, classId, resolvedAssignedClasses, resolvedAllClasses],
  );

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CalendarEventCategory>('EVENT');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [audienceMode, setAudienceMode] = useState<CalendarAudienceMode>(audiencePlan.defaultMode);
  const [targetClassId, setTargetClassId] = useState<string>(audiencePlan.defaultClassId);
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingSubmitting, setCancellingSubmitting] = useState(false);

  const [rsvpPendingId, setRsvpPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [confirmedCancellations, setConfirmedCancellations] = useState<
    Record<string, { scopeKey: string; reason: string }>
  >({});

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
        currentUser?.id ?? null,
        currentUser?.accountStatus ?? null,
        currentUser?.role ?? null,
        userCapabilitiesKey,
        userAssignedClassesKey,
        panelAssignedClassesKey,
        userLinkedChildrenKey,
        isSchoolCalendarManager,
        canCreateResolved,
        canCancelResolved,
      ]),
    [
      currentUser?.id,
      currentUser?.accountStatus,
      currentUser?.role,
      userCapabilitiesKey,
      userAssignedClassesKey,
      panelAssignedClassesKey,
      userLinkedChildrenKey,
      isSchoolCalendarManager,
      canCreateResolved,
      canCancelResolved,
    ],
  );
  const activeScopeKey = `${accountKey}::${classId ?? 'school'}`;

  const mountedRef = useRef(true);
  const requestGenRef = useRef(0);
  const activeScopeRef = useRef(activeScopeKey);
  activeScopeRef.current = activeScopeKey;
  const lastScopeKeyRef = useRef(activeScopeKey);
  const sameScopeCacheRef = useRef<{ key: string; events: CalendarEvent[] }>({
    key: '',
    events: [],
  });
  const confirmedCancellationsRef = useRef<
    Map<string, { scopeKey: string; reason: string }>
  >(new Map());

  // Immediately drop cached restricted events and confirmed overlays if assignment/access scope changes
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

  // Reset transient drafts, cancel prompts, confirmed overlays, and feedback when switching scope/assignments
  useEffect(() => {
    requestGenRef.current += 1;
    sameScopeCacheRef.current = { key: '', events: [] };
    confirmedCancellationsRef.current.clear();
    setConfirmedCancellations({});
    setShowCreateForm(false);
    setTitle('');
    setDescription('');
    setCategory('EVENT');
    setStartDate(todayStr);
    setEndDate(todayStr);
    setAudienceMode(audiencePlan.defaultMode);
    setTargetClassId(audiencePlan.defaultClassId);
    setIsPublic(false);
    setCancellingId(null);
    setCancelReason('');
    setFeedback(null);
    setRefreshWarning(null);
    setRsvpPendingId(null);
    setAgendaLimit(AGENDA_PAGE_SIZE);
  }, [activeScopeKey, todayStr, audiencePlan.defaultMode, audiencePlan.defaultClassId]);

  const monthRange = useMemo(
    () => getMonthCalendarRange(cursorYear, cursorMonth),
    [cursorYear, cursorMonth],
  );
  const month = useCalendarMonth({
    userId: currentUser?.accountStatus === 'APPROVED' ? currentUser.id : null,
    accountKey,
    classId,
    ...monthRange,
    enabled: !isAccountUnapproved && (hydratedStatus === 'READY' || hydratedStatus === 'ERROR'),
    refreshVersion: hydratedEvents,
    loader: loadMonthEvents,
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
    if (
      effectiveActorRole === 'TEACHER' ||
      effectiveActorRole === 'PARENT' ||
      effectiveActorRole === 'STUDENT'
    ) {
      if (!isSchoolCalendarManager) {
        return inRange.filter(
          (event) => !event.classId || authorizedUserClassIdSet.has(event.classId),
        );
      }
    }
    return inRange;
  }, [
    hydratedEvents,
    monthRange.startDate,
    monthRange.endDate,
    effectiveActorRole,
    isSchoolCalendarManager,
    authorizedUserClassIdSet,
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
    const startOffset = (firstDay.getUTCDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(Date.UTC(cursorYear, cursorMonth + 1, 0)).getUTCDate();
    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${cursorYear}-${pad2(cursorMonth + 1)}-${pad2(d)}`,
        dayNum: d,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: null, dayNum: null });
    }
    return cells;
  }, [cursorYear, cursorMonth]);

  const monthTitle = useMemo(() => {
    const locale = language === 'ar' ? 'ar-TN' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
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

  const selectedAudienceDescriptor = useMemo(
    () => audiencePlan.options.find((opt) => opt.mode === audienceMode) ?? null,
    [audiencePlan.options, audienceMode],
  );
  const isAudienceContractPending =
    audienceMode === 'TEACHER_CLASSES' ||
    audienceMode === 'ALL_MY_CLASSES' ||
    selectedAudienceDescriptor?.supportedByBackend === false;
  const missingTargetClassForSingle =
    audienceMode === 'SINGLE_CLASS' && !targetClassId.trim();

  const chooseDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setAgendaLimit(AGENDA_PAGE_SIZE);
    setCancellingId(null);
    setCancelReason('');
    setFeedback(null);
    setRefreshWarning(null);
    if (!showCreateForm) {
      setStartDate(dateStr);
      setEndDate(dateStr);
    }
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(cursorYear, cursorMonth + delta, 1));
    setCursorYear(next.getUTCFullYear());
    setCursorMonth(next.getUTCMonth());
    chooseDate(`${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-01`);
    setCancellingId(null);
    setCancelReason('');
    setFeedback(null);
    setRefreshWarning(null);
  };

  const goToToday = () => {
    const currentTunisToday = getTunisSchoolDay();
    setCursorYear(Number(currentTunisToday.slice(0, 4)));
    setCursorMonth(Number(currentTunisToday.slice(5, 7)) - 1);
    chooseDate(currentTunisToday);
  };

  const toggleCreateForm = () => {
    if (isUnauthorized || !canCreateResolved) return;
    setFeedback(null);
    setRefreshWarning(null);
    setCancellingId(null);
    setCancelReason('');
    setShowCreateForm((prev) => {
      const next = !prev;
      if (next) {
        setStartDate(selectedDate);
        setEndDate(selectedDate);
        setAudienceMode(audiencePlan.defaultMode);
        setTargetClassId(audiencePlan.defaultClassId);
        setIsPublic(false);
      }
      return next;
    });
  };

  const handleAudienceModeChange = (nextMode: CalendarAudienceMode) => {
    setAudienceMode(nextMode);
    if (nextMode !== 'WHOLE_SCHOOL') {
      setIsPublic(false);
    }
    if (nextMode === 'SINGLE_CLASS' && !targetClassId) {
      setTargetClassId(
        audiencePlan.defaultClassId || audiencePlan.selectableClasses[0]?.id || '',
      );
    }
  };

  const runPostCommitRefresh = async (
    capturedGen: number,
    capturedScope: string,
    successMessage: string,
  ) => {
    try {
      const refreshed = await onRefresh();
      if (
        !mountedRef.current ||
        requestGenRef.current !== capturedGen ||
        activeScopeRef.current !== capturedScope
      ) {
        return;
      }
      if (refreshed === false) {
        setRefreshWarning(
          pickText(
            {
              ar: 'تم حفظ التغيير، لكن تعذر تحديث الروزنامة. أعد تحميل العرض دون إعادة الإرسال.',
              fr: 'Enregistré, mais l’actualisation du calendrier a échoué. Rechargez sans renvoyer.',
              en: 'Saved, but the calendar could not refresh. Retry reload without resubmitting.',
            },
            language,
          ),
        );
      } else {
        setRefreshWarning(null);
        setFeedback({ type: 'success', text: successMessage });
      }
    } catch {
      if (
        !mountedRef.current ||
        requestGenRef.current !== capturedGen ||
        activeScopeRef.current !== capturedScope
      ) {
        return;
      }
      setRefreshWarning(
        pickText(
          {
            ar: 'تم حفظ التغيير، لكن تعذر تحديث الروزنامة. أعد تحميل العرض دون إعادة الإرسال.',
            fr: 'Enregistré, mais l’actualisation du calendrier a échoué. Rechargez sans renvoyer.',
            en: 'Saved, but the calendar could not refresh. Retry reload without resubmitting.',
          },
          language,
        ),
      );
    }
  };

  const handleRetryRefreshOnly = async () => {
    setRefreshWarning(null);
    try {
      const refreshed = await onRefresh();
      if (refreshed === false) {
        setRefreshWarning(
          pickText(
            {
              ar: 'لا يزال تحديث الروزنامة متعثراً.',
              fr: 'L’actualisation du calendrier reste indisponible.',
              en: 'Calendar refresh still failed. Try again.',
            },
            language,
          ),
        );
      }
    } catch {
      setRefreshWarning(
        pickText(
          {
            ar: 'لا يزال تحديث الروزنامة متعثراً.',
            fr: 'L’actualisation du calendrier reste indisponible.',
            en: 'Calendar refresh still failed. Try again.',
          },
          language,
        ),
      );
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canCreateResolved || isUnauthorized) return;
    setFeedback(null);
    setRefreshWarning(null);

    const capturedGen = ++requestGenRef.current;
    const capturedScope = activeScopeRef.current;
    setSubmitting(true);
    try {
      const res = await upsertSchoolCalendarEvent({
        title,
        description,
        category,
        startDate,
        endDate,
        classId: audienceMode === 'SINGLE_CLASS' ? targetClassId : null,
        isAllDay: true,
        isPublic: audienceMode === 'WHOLE_SCHOOL' && audiencePlan.canSetPublic ? isPublic : false,
        audienceMode,
        actorRole: effectiveActorRole,
        canManageCalendar: isSchoolCalendarManager,
        allowedClassIds: resolvedAssignedClasses.map((c) => c.id),
      });
      if (
        !mountedRef.current ||
        requestGenRef.current !== capturedGen ||
        activeScopeRef.current !== capturedScope
      ) {
        return;
      }
      if (!res.ok) {
        setFeedback({ type: 'error', text: res.errorMessage || t('error') });
        return;
      }

      // Committed on server: clear draft & close form before refreshing readback
      setTitle('');
      setDescription('');
      setIsPublic(false);
      setShowCreateForm(false);
      setSelectedDate(startDate);
      const committedMsg = pickText(
        {
          ar: 'تم حفظ الحدث في التقويم بنجاح.',
          fr: 'Événement enregistré dans le calendrier.',
          en: 'Calendar event saved.',
        },
        language,
      );
      setFeedback({ type: 'success', text: committedMsg });
      await runPostCommitRefresh(capturedGen, capturedScope, committedMsg);
    } catch {
      if (
        mountedRef.current &&
        requestGenRef.current === capturedGen &&
        activeScopeRef.current === capturedScope
      ) {
        setFeedback({ type: 'error', text: t('error') });
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const handleRsvp = async (
    eventId: string,
    response: 'ATTENDING' | 'ACKNOWLEDGED' | 'DECLINED',
  ) => {
    if (!canRespondResolved || isUnauthorized || rsvpPendingId !== null) return;
    const targetEvent = events.find((ev) => ev.id === eventId);
    if (targetEvent?.status === 'CANCELLED') return;

    setFeedback(null);
    setRefreshWarning(null);
    const capturedGen = ++requestGenRef.current;
    const capturedScope = activeScopeRef.current;
    setRsvpPendingId(eventId);
    try {
      const res = await respondToCalendarEvent(eventId, response);
      if (
        !mountedRef.current ||
        requestGenRef.current !== capturedGen ||
        activeScopeRef.current !== capturedScope
      ) {
        return;
      }
      if (!res.ok) {
        setFeedback({ type: 'error', text: res.errorMessage || t('error') });
        return;
      }
      const committedMsg = pickText(
        {
          ar: 'تم تسجيل ردك على الحدث.',
          fr: 'Réponse enregistrée.',
          en: 'RSVP saved.',
        },
        language,
      );
      setFeedback({ type: 'success', text: committedMsg });
      await runPostCommitRefresh(capturedGen, capturedScope, committedMsg);
    } catch {
      if (
        mountedRef.current &&
        requestGenRef.current === capturedGen &&
        activeScopeRef.current === capturedScope
      ) {
        setFeedback({ type: 'error', text: t('error') });
      }
    } finally {
      if (mountedRef.current) {
        setRsvpPendingId(null);
      }
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!canCancelResolved || isUnauthorized || cancellingSubmitting) return;
    setFeedback(null);
    setRefreshWarning(null);
    const capturedGen = ++requestGenRef.current;
    const capturedScope = activeScopeRef.current;
    const capturedMonthScope = month.scopeKey;
    const committedReason = cancelReason.trim() || 'Cancelled by administration';
    setCancellingSubmitting(true);
    try {
      const res = await cancelSchoolCalendarEvent(eventId, cancelReason);
      if (
        !mountedRef.current ||
        requestGenRef.current !== capturedGen ||
        activeScopeRef.current !== capturedScope
      ) {
        return;
      }
      if (!res.ok) {
        setFeedback({ type: 'error', text: res.errorMessage || t('error') });
        return;
      }

      // Server confirmed cancellation: preserve CANCELLED state, reason & prior RSVP against failed or stale readbacks
      const confirmedEntry = { scopeKey: capturedScope, reason: committedReason };
      confirmedCancellationsRef.current.set(eventId, confirmedEntry);
      setConfirmedCancellations((prev) => ({ ...prev, [eventId]: confirmedEntry }));
      const baseCache =
        sameScopeCacheRef.current.key === capturedMonthScope
          ? sameScopeCacheRef.current.events
          : events;
      sameScopeCacheRef.current = {
        key: capturedMonthScope,
        events: baseCache.map((ev) =>
          ev.id === eventId
            ? {
                ...ev,
                status: 'CANCELLED',
                cancellationReason: ev.cancellationReason || committedReason,
              }
            : ev,
        ),
      };

      setCancellingId(null);
      setCancelReason('');
      const committedMsg = pickText(
        {
          ar: 'تم إلغاء الحدث في الروزنامة دون حذفه.',
          fr: 'Événement marqué annulé dans le calendrier.',
          en: 'Event marked cancelled.',
        },
        language,
      );
      setFeedback({ type: 'success', text: committedMsg });
      await runPostCommitRefresh(capturedGen, capturedScope, committedMsg);
    } catch {
      if (
        mountedRef.current &&
        requestGenRef.current === capturedGen &&
        activeScopeRef.current === capturedScope
      ) {
        setFeedback({ type: 'error', text: t('error') });
      }
    } finally {
      if (mountedRef.current) {
        setCancellingSubmitting(false);
      }
    }
  };

  const formatAudienceOptionLabel = (mode: CalendarAudienceMode): string => {
    switch (mode) {
      case 'WHOLE_SCHOOL':
        return pickText(
          { ar: 'كامل المدرسة', fr: 'Toute l’école', en: 'Whole school' },
          language,
        );
      case 'SINGLE_CLASS':
        return isSchoolCalendarManager
          ? pickText(
              { ar: 'قسم واحد محدد', fr: 'Une classe sélectionnée', en: 'One selected class' },
              language,
            )
          : pickText(
              {
                ar: 'أحد أقسامي المسندة',
                fr: 'Une de mes classes attribuées',
                en: 'One of my assigned classes',
              },
              language,
            );
      case 'TEACHER_CLASSES':
        return pickText(
          {
            ar: 'أقسام أستاذ محدد (غير متاح حالياً)',
            fr: 'Classes d’un enseignant (Indisponible pour le moment)',
            en: 'One selected teacher’s assigned classes (Not yet available)',
          },
          language,
        );
      case 'ALL_MY_CLASSES':
        return pickText(
          {
            ar: 'جميع أقسامي المسندة (غير متاح حالياً)',
            fr: 'Toutes mes classes attribuées (Indisponible pour le moment)',
            en: 'All of my assigned classes (Not yet available)',
          },
          language,
        );
    }
  };

  const formatRsvpLabel = (resp: 'ATTENDING' | 'ACKNOWLEDGED' | 'DECLINED'): string => {
    if (resp === 'ATTENDING') {
      return pickText({ ar: 'سأحضر', fr: 'Participer', en: 'Attending' }, language);
    }
    if (resp === 'ACKNOWLEDGED') {
      return pickText({ ar: 'تم الاطلاع', fr: 'Vu', en: 'Acknowledged' }, language);
    }
    return pickText({ ar: 'معتذر', fr: 'Absent', en: 'Declined' }, language);
  };

  return (
    <div className="space-y-5" data-testid="school-calendar-panel">
      {/* Toolbar */}
      <div className="bg-white dark:bg-[#111111] p-4 sm:p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="calendar-today-btn"
            onClick={goToToday}
            className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200"
          >
            {pickText({ ar: 'اليوم', fr: 'Aujourd’hui', en: 'Today' }, language)}
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white ms-2 capitalize">
            {monthTitle}
          </h3>
          <span
            data-testid="calendar-timezone-badge"
            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
          >
            Africa/Tunis • {monthRange.startDate.slice(0, 7)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setAgendaLimit(AGENDA_PAGE_SIZE);
            }}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200"
          >
            <option value="ALL">
              {pickText({ ar: 'كل الفئات', fr: 'Toutes catégories', en: 'All categories' }, language)}
            </option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {canCreateResolved && !isUnauthorized && (
            <button
              type="button"
              data-testid="calendar-add-event-btn"
              onClick={toggleCreateForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {pickText({ ar: 'إضافة حدث', fr: 'Ajouter un événement', en: 'Add Event' }, language)}
              </span>
            </button>
          )}
        </div>
      </div>

      {audiencePlan.isTeacherWithoutAssignments && !isUnauthorized && (
        <div
          data-testid="calendar-teacher-no-assignments"
          role="status"
          className="p-3.5 rounded-2xl text-xs font-semibold bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 border border-amber-200 dark:border-amber-900 flex items-center gap-2"
        >
          <Info className="w-4 h-4 shrink-0" />
          <span>
            {pickText(
              {
                ar: 'لا يوجد أي قسم مسند لحسابك كأستاذ حالياً. لا يمكنك إضافة أحداث في الروزنامة قبل إسناد قسم من الإدارة.',
                fr: 'Aucune classe active n’est attribuée à votre compte enseignant. Création d’événements indisponible sans classe attribuée.',
                en: 'No active class is assigned to your teacher account yet. Calendar event creation stays disabled until administration assigns a class.',
              },
              language,
            )}
          </span>
        </div>
      )}

      {refreshWarning && (
        <div
          role="alert"
          data-testid="calendar-refresh-warning"
          className="p-3.5 rounded-2xl text-xs font-semibold bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-900 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{refreshWarning}</span>
          </div>
          <button
            type="button"
            data-testid="calendar-retry-refresh-btn"
            onClick={() => void handleRetryRefreshOnly()}
            className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
          >
            {pickText(
              { ar: 'إعادة تحميل العرض فقط', fr: 'Recharger l’affichage', en: 'Retry Reload' },
              language,
            )}
          </button>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          data-testid={feedback.type === 'error' ? 'calendar-feedback-error' : 'calendar-feedback-success'}
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Create Event Form (starts from selected date; retains draft on failed commit) */}
      {canCreateResolved && !isUnauthorized && showCreateForm && (
        <form
          onSubmit={handleCreate}
          data-testid="calendar-create-form"
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
        >
          <h4 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText(
              { ar: 'إنشاء حدث في التقويم المدرسي', fr: 'Nouvel événement scolaire', en: 'New Calendar Event' },
              language,
            )}
          </h4>

          {/* Explicit Audience Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span>
                {pickText({ ar: 'الجمهور المستهدف', fr: 'Public cible', en: 'Event audience' }, language)}
              </span>
              <select
                data-testid="calendar-audience-select"
                value={audienceMode}
                onChange={(e) => handleAudienceModeChange(e.target.value as CalendarAudienceMode)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
              >
                {audiencePlan.options.map((opt) => (
                  <option key={opt.mode} value={opt.mode}>
                    {formatAudienceOptionLabel(opt.mode)}
                  </option>
                ))}
              </select>
            </label>

            {audienceMode === 'SINGLE_CLASS' && (
              <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <span>
                  {pickText({ ar: 'القسم المستهدف', fr: 'Classe cible', en: 'Target class' }, language)}
                </span>
                <select
                  data-testid="calendar-target-class-select"
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  {audiencePlan.selectableClasses.length === 0 ? (
                    <option value="">
                      {pickText(
                        { ar: 'لا توجد أقسام متاحة', fr: 'Aucune classe disponible', en: 'No active classes available' },
                        language,
                      )}
                    </option>
                  ) : (
                    audiencePlan.selectableClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.level ? ` (${cls.level})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
          </div>

          {isAudienceContractPending && (
            <div
              data-testid="calendar-audience-contract-pending"
              role="status"
              className="p-3.5 rounded-2xl text-xs font-semibold bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 border border-amber-200 dark:border-amber-900 space-y-1"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  {audienceMode === 'TEACHER_CLASSES'
                    ? pickText(
                        {
                          ar: 'إنشاء حدث موحد لجميع أقسام أستاذ محدد غير متاح حالياً. يمكنك حالياً اختيار قسم واحد محدد أو كامل المدرسة.',
                          fr: 'La création d’un événement groupé pour toutes les classes d’un enseignant n’est pas encore disponible. Choisissez « Une classe sélectionnée » ou « Toute l’école ».',
                          en: 'Publishing one event across all classes of a selected teacher is not yet available. Choose "One selected class" or "Whole school".',
                        },
                        language,
                      )
                    : pickText(
                        {
                          ar: 'إرسال حدث واحد إلى جميع أقسامك المسندة دفعة واحدة غير متاح حالياً. يمكنك حالياً اختيار «أحد أقسامي المسندة».',
                          fr: 'La publication d’un même événement pour toutes vos classes attribuées n’est pas encore disponible. Utilisez « Une de mes classes attribuées ».',
                          en: 'Publishing one event to all of your assigned classes at once is not yet available. Use "One of my assigned classes" for now.',
                        },
                        language,
                      )}
                </span>
              </div>
              {audienceMode === 'ALL_MY_CLASSES' && resolvedAssignedClasses.length === 1 && (
                <p className="text-[11px] font-normal text-amber-800 dark:text-amber-300 ps-6">
                  {pickText(
                    {
                      ar: 'ملاحظة: لديك قسم واحد مسند حالياً، لذا يغطيه خيار القسم الواحد مباشرة.',
                      fr: 'Remarque : vous avez actuellement une seule classe attribuée, déjà couverte par « Une de mes classes attribuées ».',
                      en: 'Note: you currently have one assigned class, which "One of my assigned classes" covers directly.',
                    },
                    language,
                  )}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              data-testid="calendar-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={pickText({ ar: 'عنوان الحدث', fr: 'Titre', en: 'Event title' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <select
              data-testid="calendar-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as CalendarEventCategory)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <input
              type="date"
              required
              data-testid="calendar-start-date-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="date"
              required
              data-testid="calendar-end-date-input"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
          </div>
          <textarea
            data-testid="calendar-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={pickText({ ar: 'التفاصيل', fr: 'Description', en: 'Description' }, language)}
            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
          />
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              {pickText(
                {
                  ar: 'تُحفظ الأحداث ليوم كامل بتوقيت تونس. الأوقات المحددة وتعديل الأحداث والموقع والصور وإحصائيات الحضور غير متاحة حالياً.',
                  fr: 'Les événements sont enregistrés sur la journée entière (Africa/Tunis). Les horaires précis, la modification, le lieu, les photos et les totaux de réponses ne sont pas encore disponibles.',
                  en: 'Events save as all-day entries (Africa/Tunis). Specific time slots, editing, locations, photos, and attendance totals are not yet available.',
                },
                language,
              )}
            </span>
          </p>
          {audiencePlan.canSetPublic && audienceMode === 'WHOLE_SCHOOL' && (
            <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                data-testid="calendar-is-public-checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>
                {pickText(
                  { ar: 'مرئي في الموقع العام', fr: 'Visible sur le site public', en: 'Visible on public homepage' },
                  language,
                )}
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              data-testid="calendar-submit-event-btn"
              disabled={submitting || isAudienceContractPending || missingTargetClassForSingle}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {/* Always show ERROR / UNAUTHORIZED banners even when cached events exist */}
      {isUnauthorized && (
        <div
          data-testid="calendar-unauthorized-state"
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {errorMessage ||
                pickText(
                  {
                    ar: 'غير مصرح بعرض أو تعديل أحداث هذا التقويم.',
                    fr: 'Accès non autorisé à ce calendrier.',
                    en: 'Not authorized to view or modify calendar events.',
                  },
                  language,
                )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {backendStatus === 'ERROR' && (
        <div
          data-testid="calendar-error-state"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-3 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {errorMessage ||
                pickText(
                  {
                    ar: 'تعذر تحميل أحداث التقويم.',
                    fr: 'Impossible de charger les événements du calendrier.',
                    en: 'Failed to load calendar events.',
                  },
                  language,
                )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {backendStatus === 'BLOCKED_BACKEND' && events.length === 0 && (
        <EmptyFeatureState
          state="BLOCKED_BACKEND"
          title={pickText(
            {
              ar: 'التقويم المدرسي غير متاح حالياً',
              fr: 'Calendrier scolaire indisponible',
              en: 'School Calendar Unavailable',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'خدمة التقويم المدرسي غير مفعلة بعد في المدرسة.',
              fr: 'Le service de calendrier scolaire n’est pas encore activé.',
              en: 'The school calendar service is not active yet.',
            },
            language,
          )}
        />
      )}

      {/* Calendar Grid + Selected Day Agenda */}
      {!isUnauthorized && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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

          {/* Selected Day Agenda */}
          <div className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                  {selectedDate}
                </h4>
              </div>
              <span className="text-[11px] font-bold text-gray-400">Africa/Tunis</span>
            </div>

            {isLoading && events.length === 0 ? (
              <div
                data-testid="calendar-loading-state"
                className="text-xs font-bold text-gray-500 py-6 text-center"
              >
                {t('loading')}
              </div>
            ) : selectedDayEvents.length === 0 && backendStatus === 'READY' ? (
              <p className="text-xs text-gray-500 py-6 text-center">
                {pickText(
                  {
                    ar: 'لا توجد أحداث مجدولة لهذا اليوم.',
                    fr: 'Aucun événement prévu pour cette date.',
                    en: 'No events scheduled for this date.',
                  },
                  language,
                )}
              </p>
            ) : selectedDayEvents.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">
                {pickText(
                  {
                    ar: 'لا توجد أحداث معروضة لهذا التاريخ.',
                    fr: 'Aucun événement affiché pour cette date.',
                    en: 'No displayed events for this date.',
                  },
                  language,
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {pagedDayEvents.map((ev) => {
                  const classLabel = ev.classId ? classNameById.get(ev.classId) || ev.classId : null;
                  const isCancelled = ev.status === 'CANCELLED';
                  return (
                    <div
                      key={ev.id}
                      data-testid={`calendar-event-card-${ev.id}`}
                      className="p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/50 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg uppercase ${getCategoryStyle(
                              ev.category,
                              isCancelled,
                            )}`}
                          >
                            {ev.category}
                          </span>
                          <span
                            data-testid="calendar-event-scope-badge"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                          >
                            <Users className="w-3 h-3" />
                            <span>
                              {classLabel
                                ? classLabel
                                : pickText(
                                    { ar: 'كامل المدرسة', fr: 'Toute l’école', en: 'Whole school' },
                                    language,
                                  )}
                            </span>
                          </span>
                          {ev.isPublic && (
                            <span
                              data-testid="calendar-event-public-badge"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                            >
                              <Globe className="w-3 h-3" />
                              <span>
                                {pickText({ ar: 'عام', fr: 'Public', en: 'Public' }, language)}
                              </span>
                            </span>
                          )}
                        </div>
                        {isCancelled && (
                          <span
                            data-testid="calendar-event-cancelled-badge"
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>
                              {pickText(
                                { ar: 'ملغى', fr: 'ANNULÉ', en: 'CANCELLED' },
                                language,
                              )}
                            </span>
                          </span>
                        )}
                      </div>
                      <h5
                        className={`font-bold text-xs text-gray-900 dark:text-white ${
                          isCancelled ? 'line-through opacity-75' : ''
                        }`}
                      >
                        {ev.title}
                      </h5>
                      {ev.startTime && (
                        <p className="text-[11px] font-mono text-gray-500">
                          {ev.startTime}
                          {ev.endTime ? ` – ${ev.endTime}` : ''} ({ev.timezone || 'Africa/Tunis'})
                        </p>
                      )}
                      {ev.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">{ev.description}</p>
                      )}
                      {isCancelled && (
                        <div className="space-y-1.5">
                          {ev.cancellationReason && (
                            <p
                              data-testid="calendar-cancellation-reason"
                              className="text-[11px] text-red-600 dark:text-red-400 font-medium"
                            >
                              {ev.cancellationReason}
                            </p>
                          )}
                          {ev.myResponse && (
                            <div
                              data-testid="calendar-prior-rsvp"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                            >
                              <Check className="w-3 h-3" />
                              <span>
                                {pickText(
                                  {
                                    ar: `ردك السابق (${formatRsvpLabel(ev.myResponse)})`,
                                    fr: `Réponse précédente (${formatRsvpLabel(ev.myResponse)})`,
                                    en: `Prior response: ${formatRsvpLabel(ev.myResponse)}`,
                                  },
                                  language,
                                )}
                              </span>
                            </div>
                          )}
                          <p className="text-[10px] text-gray-500">
                            {pickText(
                              {
                                ar: 'إشعار إلغاء حدث فقط — لا يُسجل غياباً ولا يغلق المدرسة ولا يُعد إذن خروج.',
                                fr: 'Annulation d’événement uniquement — n’enregistre ni absence, ni fermeture, ni sortie.',
                                en: 'Event cancellation notice only — does not record pupil absence, school closure, or pickup release.',
                              },
                              language,
                            )}
                          </p>
                        </div>
                      )}

                      {!isCancelled && (canRespondResolved || canCancelResolved) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {canRespondResolved && (
                            <>
                              <button
                                type="button"
                                disabled={rsvpPendingId === ev.id}
                                onClick={() => void handleRsvp(ev.id, 'ATTENDING')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                                  ev.myResponse === 'ATTENDING'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                <span>
                                  {pickText(
                                    { ar: 'سأحضر', fr: 'Participer', en: 'Attending' },
                                    language,
                                  )}
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={rsvpPendingId === ev.id}
                                onClick={() => void handleRsvp(ev.id, 'ACKNOWLEDGED')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                                  ev.myResponse === 'ACKNOWLEDGED'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                <span>
                                  {pickText(
                                    { ar: 'تم الاطلاع', fr: 'Vu', en: 'Acknowledge' },
                                    language,
                                  )}
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={rsvpPendingId === ev.id}
                                onClick={() => void handleRsvp(ev.id, 'DECLINED')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                                  ev.myResponse === 'DECLINED'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <XCircle className="w-3 h-3" />
                                <span>
                                  {pickText(
                                    { ar: 'معتذر', fr: 'Absent', en: 'Decline' },
                                    language,
                                  )}
                                </span>
                              </button>
                            </>
                          )}

                          {canCancelResolved && (
                            <button
                              type="button"
                              data-testid="calendar-cancel-event-btn"
                              onClick={() =>
                                setCancellingId(cancellingId === ev.id ? null : ev.id)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>{t('cancel')}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {canCancelResolved && !isCancelled && cancellingId === ev.id && (
                        <div className="pt-2 space-y-2">
                          <input
                            type="text"
                            data-testid="calendar-cancel-reason-input"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder={pickText(
                              {
                                ar: 'سبب الإلغاء',
                                fr: 'Motif d’annulation',
                                en: 'Cancellation reason',
                              },
                              language,
                            )}
                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                          />
                          <button
                            type="button"
                            data-testid="calendar-confirm-cancel-btn"
                            disabled={cancellingSubmitting}
                            onClick={() => void handleCancelEvent(ev.id)}
                            className="w-full py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50"
                          >
                            {cancellingSubmitting
                              ? t('loading')
                              : pickText(
                                  {
                                    ar: 'تأكيد الإلغاء',
                                    fr: 'Confirmer l’annulation',
                                    en: 'Confirm cancel',
                                  },
                                  language,
                                )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {selectedDayEvents.length > pagedDayEvents.length && (
                  <button
                    type="button"
                    data-testid="calendar-load-more-btn"
                    onClick={() => setAgendaLimit((n) => n + AGENDA_PAGE_SIZE)}
                    className="w-full py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-900"
                  >
                    {pickText(
                      {
                        ar: `عرض المزيد (${selectedDayEvents.length - pagedDayEvents.length})`,
                        fr: `Afficher plus (${selectedDayEvents.length - pagedDayEvents.length})`,
                        en: `Show more (${selectedDayEvents.length - pagedDayEvents.length})`,
                      },
                      language,
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
