import React, { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { pickText } from '../../../i18n/homepages';
import type {
  CalendarAudienceMode, CalendarAudiencePlan, CalendarClassOption,
} from '../../../lib/calendar/calendarAudience';
import {
  cancelSchoolCalendarEvent, respondToCalendarEvent, upsertSchoolCalendarEvent,
} from '../../../lib/schoolContent';
import type {
  AccountRole, BackendOpStatus, CalendarEvent, CalendarEventCategory, Language,
} from '../../../types';
import { AGENDA_PAGE_SIZE } from './calendarDisplayConfig';

interface UseCalendarEventMutationsParams {
  todayStr: string; selectedDate: string; setSelectedDate: (dateStr: string) => void;
  setAgendaLimit: React.Dispatch<React.SetStateAction<number>>;
  audiencePlan: CalendarAudiencePlan; resolvedAssignedClasses: CalendarClassOption[];
  effectiveTeacherPickerBlocked: boolean; loadingTeachers: boolean;
  backendStatus: BackendOpStatus; isUnauthorized: boolean;
  canCreateResolved: boolean; canCancelResolved: boolean; canRespondResolved: boolean;
  effectiveActorRole: AccountRole | null; isSchoolCalendarManager: boolean;
  activeScopeKey: string; monthScopeKey: string;
  mountedRef: MutableRefObject<boolean>; requestGenRef: MutableRefObject<number>;
  activeScopeRef: MutableRefObject<string>;
  sameScopeCacheRef: MutableRefObject<{ key: string; events: CalendarEvent[] }>;
  confirmedCancellationsRef: MutableRefObject<Map<string, { scopeKey: string; reason: string }>>;
  confirmedCancellations: Record<string, { scopeKey: string; reason: string }>;
  setConfirmedCancellations: React.Dispatch<
    React.SetStateAction<Record<string, { scopeKey: string; reason: string }>>
  >;
  events: CalendarEvent[]; onRefresh: () => Promise<boolean>;
  language: Language; t: (key: any) => string;
}

export function useCalendarEventMutations(params: UseCalendarEventMutationsParams) {
  const {
    todayStr, selectedDate, setSelectedDate, setAgendaLimit, audiencePlan,
    resolvedAssignedClasses, effectiveTeacherPickerBlocked, loadingTeachers,
    backendStatus, isUnauthorized, canCreateResolved, canCancelResolved,
    canRespondResolved, effectiveActorRole, isSchoolCalendarManager,
    activeScopeKey, monthScopeKey, mountedRef, requestGenRef, activeScopeRef,
    sameScopeCacheRef, confirmedCancellationsRef, setConfirmedCancellations,
    events, onRefresh, language, t,
  } = params;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CalendarEventCategory>('EVENT');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [audienceMode, setAudienceMode] = useState<CalendarAudienceMode>(audiencePlan.defaultMode);
  const [targetClassId, setTargetClassId] = useState<string>(audiencePlan.defaultClassId);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(audiencePlan.defaultTeacherUserId);
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingSubmitting, setCancellingSubmitting] = useState(false);

  const [rsvpPendingId, setRsvpPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

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
    setSelectedTeacherId(audiencePlan.defaultTeacherUserId);
    setIsPublic(false);
    setCancellingId(null);
    setCancelReason('');
    setFeedback(null);
    setRefreshWarning(null);
    setRsvpPendingId(null);
    setAgendaLimit(AGENDA_PAGE_SIZE);
  }, [activeScopeKey, todayStr, audiencePlan.defaultMode, audiencePlan.defaultClassId]);

  useEffect(() => {
    if (audiencePlan.selectableTeachers.length === 0) {
      setSelectedTeacherId('');
      return;
    }
    setSelectedTeacherId((prev) =>
      prev && audiencePlan.selectableTeachers.some((teacher) => teacher.id === prev)
        ? prev
        : audiencePlan.defaultTeacherUserId || audiencePlan.selectableTeachers[0].id,
    );
  }, [audiencePlan.selectableTeachers, audiencePlan.defaultTeacherUserId]);

  const selectedAudienceDescriptor = useMemo(
    () => audiencePlan.options.find((opt) => opt.mode === audienceMode) ?? null,
    [audiencePlan.options, audienceMode],
  );
  const missingTargetClassForSingle = audienceMode === 'SINGLE_CLASS' && !targetClassId.trim();
  const missingTargetTeacherForTeacherClasses =
    audienceMode === 'TEACHER_CLASSES' &&
    (effectiveTeacherPickerBlocked || loadingTeachers || !selectedTeacherId.trim());
  const missingClassesForAllMyClasses =
    audienceMode === 'ALL_MY_CLASSES' && resolvedAssignedClasses.length === 0;
  const isCreateSubmitDisabled =
    submitting ||
    backendStatus !== 'READY' ||
    selectedAudienceDescriptor?.supportedByBackend === false ||
    missingTargetClassForSingle ||
    missingTargetTeacherForTeacherClasses ||
    missingClassesForAllMyClasses;

  const isContextStillActive = (capturedGen: number, capturedScope: string) =>
    mountedRef.current &&
    requestGenRef.current === capturedGen &&
    activeScopeRef.current === capturedScope;

  const clearTransientInteractionState = () => {
    setCancellingId(null);
    setCancelReason('');
    setFeedback(null);
    setRefreshWarning(null);
  };

  const syncDatesOnDateChoose = (dateStr: string) => {
    clearTransientInteractionState();
    if (!showCreateForm) {
      setStartDate(dateStr);
      setEndDate(dateStr);
    }
  };

  const toggleCreateForm = () => {
    if (isUnauthorized || !canCreateResolved || backendStatus !== 'READY') return;
    clearTransientInteractionState();
    setShowCreateForm((prev) => {
      const next = !prev;
      if (next) {
        setStartDate(selectedDate);
        setEndDate(selectedDate);
        setAudienceMode(audiencePlan.defaultMode);
        setTargetClassId(audiencePlan.defaultClassId);
        setSelectedTeacherId(
          audiencePlan.defaultTeacherUserId || audiencePlan.selectableTeachers[0]?.id || '',
        );
        setIsPublic(false);
      }
      return next;
    });
  };

  const handleAudienceModeChange = (nextMode: CalendarAudienceMode) => {
    setAudienceMode(nextMode);
    if (nextMode !== 'WHOLE_SCHOOL') setIsPublic(false);
    if (nextMode === 'SINGLE_CLASS' && !targetClassId) {
      setTargetClassId(audiencePlan.defaultClassId || audiencePlan.selectableClasses[0]?.id || '');
    }
    if (nextMode === 'TEACHER_CLASSES' && !selectedTeacherId) {
      setSelectedTeacherId(
        audiencePlan.defaultTeacherUserId || audiencePlan.selectableTeachers[0]?.id || '',
      );
    }
  };

  const runPostCommitRefresh = async (
    capturedGen: number,
    capturedScope: string,
    successMessage: string,
  ) => {
    const warnMsg = pickText({ ar: 'تم حفظ التغيير، لكن تعذر تحديث الروزنامة. أعد تحميل العرض دون إعادة الإرسال.', fr: 'Enregistré, mais l’actualisation du calendrier a échoué. Rechargez sans renvoyer.', en: 'Saved, but the calendar could not refresh. Retry reload without resubmitting.', es: 'Guardado, pero falló la actualización del calendario. Recargue sin reenviar.', de: 'Gespeichert, aber Kalender-Aktualisierung fehlgeschlagen. Ohne erneutes Senden neu laden.', pt: 'Guardado, mas a atualização do calendário falhou. Recarregue sem reenviar.' }, language);
    try {
      const refreshed = await onRefresh();
      if (!isContextStillActive(capturedGen, capturedScope)) return;
      if (refreshed === false) {
        setRefreshWarning(warnMsg);
      } else {
        setRefreshWarning(null);
        setFeedback({ type: 'success', text: successMessage });
      }
    } catch {
      if (isContextStillActive(capturedGen, capturedScope)) setRefreshWarning(warnMsg);
    }
  };

  const handleRetryRefreshOnly = async () => {
    setRefreshWarning(null);
    const retryWarn = pickText({ ar: 'لا يزال تحديث الروزنامة متعثراً.', fr: 'L’actualisation du calendrier reste indisponible.', en: 'Calendar refresh still failed. Try again.', es: 'Sigue fallando la actualización del calendario. Inténtelo de nuevo.', de: 'Kalender-Aktualisierung weiter fehlgeschlagen. Erneut versuchen.', pt: 'A atualização do calendário ainda falhou. Tente novamente.' }, language);
    try {
      const refreshed = await onRefresh();
      if (refreshed === false) setRefreshWarning(retryWarn);
    } catch {
      setRefreshWarning(retryWarn);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      submitting || !canCreateResolved || isUnauthorized ||
      backendStatus !== 'READY' || selectedAudienceDescriptor?.supportedByBackend === false
    ) {
      return;
    }
    setFeedback(null);
    setRefreshWarning(null);

    const capturedGen = ++requestGenRef.current;
    const capturedScope = activeScopeRef.current;
    setSubmitting(true);
    try {
      const res = await upsertSchoolCalendarEvent({
        title, description, category, startDate, endDate,
        classId: audienceMode === 'SINGLE_CLASS' ? targetClassId : null,
        teacherUserId: audienceMode === 'TEACHER_CLASSES' ? selectedTeacherId : null,
        isAllDay: true,
        isPublic: audienceMode === 'WHOLE_SCHOOL' && audiencePlan.canSetPublic ? isPublic : false,
        audienceMode, actorRole: effectiveActorRole,
        canManageCalendar: isSchoolCalendarManager,
        allowedClassIds: resolvedAssignedClasses.map((c) => c.id),
      });
      if (!isContextStillActive(capturedGen, capturedScope)) return;
      if (!res.ok) {
        const errMsg =
          res.errorCode === 'calendar_no_eligible_classes'
            ? pickText({ ar: 'لا توجد أقسام نشطة مؤهلة لهذا الحدث في الروزنامة.', fr: 'Aucune classe active éligible n’est disponible pour cet événement.', en: 'No active eligible classes are available for this calendar event.', es: 'No hay clases activas elegibles para este evento del calendario.', de: 'Für diesen Kalendereintrag sind keine aktiven berechtigten Klassen verfügbar.', pt: 'Não há turmas ativas elegíveis para este evento do calendário.' }, language)
            : res.errorMessage || t('error');
        setFeedback({ type: 'error', text: errMsg });
        return;
      }

      setTitle('');
      setDescription('');
      setIsPublic(false);
      setShowCreateForm(false);
      setSelectedDate(startDate);
      const committedMsg = pickText({ ar: 'تم حفظ الحدث في التقويم بنجاح.', fr: 'Événement enregistré dans le calendrier.', en: 'Calendar event saved.', es: 'Evento del calendario guardado.', de: 'Kalendereintrag gespeichert.', pt: 'Evento do calendário guardado.' }, language);
      setFeedback({ type: 'success', text: committedMsg });
      await runPostCommitRefresh(capturedGen, capturedScope, committedMsg);
    } catch {
      if (isContextStillActive(capturedGen, capturedScope)) {
        setFeedback({ type: 'error', text: t('error') });
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
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
      if (!isContextStillActive(capturedGen, capturedScope)) return;
      if (!res.ok) {
        setFeedback({ type: 'error', text: res.errorMessage || t('error') });
        return;
      }
      const committedMsg = pickText({ ar: 'تم تسجيل ردك على الحدث.', fr: 'Réponse enregistrée.', en: 'RSVP saved.', es: 'Confirmación guardada.', de: 'Rückmeldung gespeichert.', pt: 'Confirmação guardada.' }, language);
      setFeedback({ type: 'success', text: committedMsg });
      await runPostCommitRefresh(capturedGen, capturedScope, committedMsg);
    } catch {
      if (isContextStillActive(capturedGen, capturedScope)) {
        setFeedback({ type: 'error', text: t('error') });
      }
    } finally {
      if (mountedRef.current) setRsvpPendingId(null);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!canCancelResolved || isUnauthorized || cancellingSubmitting) return;
    setFeedback(null);
    setRefreshWarning(null);
    const capturedGen = ++requestGenRef.current;
    const capturedScope = activeScopeRef.current;
    const capturedMonthScope = monthScopeKey;
    const committedReason = cancelReason.trim() || 'Cancelled by administration';
    setCancellingSubmitting(true);
    try {
      const res = await cancelSchoolCalendarEvent(eventId, cancelReason);
      if (!isContextStillActive(capturedGen, capturedScope)) return;
      if (!res.ok) {
        setFeedback({ type: 'error', text: res.errorMessage || t('error') });
        return;
      }

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
      const committedMsg = pickText({ ar: 'تم إلغاء الحدث في الروزنامة دون حذفه.', fr: 'Événement marqué annulé dans le calendrier.', en: 'Event marked cancelled.', es: 'Evento marcado como cancelado.', de: 'Veranstaltung als abgesagt markiert.', pt: 'Evento marcado como cancelado.' }, language);
      setFeedback({ type: 'success', text: committedMsg });
      await runPostCommitRefresh(capturedGen, capturedScope, committedMsg);
    } catch {
      if (isContextStillActive(capturedGen, capturedScope)) {
        setFeedback({ type: 'error', text: t('error') });
      }
    } finally {
      if (mountedRef.current) setCancellingSubmitting(false);
    }
  };

  return {
    showCreateForm, setShowCreateForm, title, setTitle, description, setDescription,
    category, setCategory, startDate, setStartDate, endDate, setEndDate,
    audienceMode, targetClassId, setTargetClassId, selectedTeacherId, setSelectedTeacherId,
    isPublic, setIsPublic, submitting, isCreateSubmitDisabled,
    cancellingId, setCancellingId, cancelReason, setCancelReason, cancellingSubmitting,
    rsvpPendingId, feedback, refreshWarning,
    clearTransientInteractionState, syncDatesOnDateChoose,
    toggleCreateForm, handleAudienceModeChange, handleRetryRefreshOnly,
    handleCreate, handleRsvp, handleCancelEvent,
  };
}
