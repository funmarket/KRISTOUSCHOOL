import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  Plus,
} from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import type {
  CalendarClassOption,
  CalendarTeacherOption,
} from '../../../lib/calendar/calendarAudience';
import type { CalendarMonthLoader } from '../../../lib/calendar/useCalendarMonth';
import type { BackendOpStatus, CalendarEvent } from '../../../types';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import { CalendarCreateEventForm } from '../calendar/CalendarCreateEventForm';
import { CalendarDayAgendaPanel } from '../calendar/CalendarDayAgendaPanel';
import { CalendarMonthGrid } from '../calendar/CalendarMonthGrid';
import { AGENDA_PAGE_SIZE, CATEGORIES } from '../calendar/calendarDisplayConfig';
import { useSchoolCalendarController } from '../calendar/useSchoolCalendarController';

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
  teacherOptions?: CalendarTeacherOption[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRefresh: () => Promise<boolean | void>;
  loadMonthEvents?: CalendarMonthLoader;
}

export const SchoolCalendarPanel: React.FC<SchoolCalendarPanelProps> = (props) => {
  const cal = useSchoolCalendarController(props);
  const {
    language, t, todayStr, selectedDate, categoryFilter, setCategoryFilter, setAgendaLimit,
    monthRange, monthTitle, weekdayLabels, monthCells, events, visibleEvents,
    selectedDayEvents, pagedDayEvents, classNameById, backendStatus, errorMessage,
    isLoading, isUnauthorized, isSchoolCalendarManager, canCreateResolved,
    canCancelResolved, canRespondResolved, audiencePlan, resolvedAssignedClasses,
    loadingTeachers, effectiveTeacherPickerBlocked, chooseDate, shiftMonth, goToToday,
    onRefresh, showCreateForm, setShowCreateForm, title, setTitle, description,
    setDescription, category, setCategory, startDate, setStartDate, endDate, setEndDate,
    audienceMode, targetClassId, setTargetClassId, selectedTeacherId, setSelectedTeacherId,
    isPublic, setIsPublic, submitting, isCreateSubmitDisabled, cancellingId,
    setCancellingId, cancelReason, setCancelReason, cancellingSubmitting, rsvpPendingId,
    feedback, refreshWarning, toggleCreateForm, handleAudienceModeChange,
    handleRetryRefreshOnly, handleCreate, handleRsvp, handleCancelEvent,
  } = cal;

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

          {canCreateResolved && !isUnauthorized && backendStatus === 'READY' && (
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

      {canCreateResolved && !isUnauthorized && backendStatus === 'READY' && showCreateForm && (
        <CalendarCreateEventForm
          language={language}
          t={t}
          isSchoolCalendarManager={isSchoolCalendarManager}
          audiencePlan={audiencePlan}
          resolvedAssignedClasses={resolvedAssignedClasses}
          loadingTeachers={loadingTeachers}
          effectiveTeacherPickerBlocked={effectiveTeacherPickerBlocked}
          audienceMode={audienceMode}
          handleAudienceModeChange={handleAudienceModeChange}
          targetClassId={targetClassId}
          setTargetClassId={setTargetClassId}
          selectedTeacherId={selectedTeacherId}
          setSelectedTeacherId={setSelectedTeacherId}
          title={title}
          setTitle={setTitle}
          category={category}
          setCategory={setCategory}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          description={description}
          setDescription={setDescription}
          isPublic={isPublic}
          setIsPublic={setIsPublic}
          submitting={submitting}
          isCreateSubmitDisabled={isCreateSubmitDisabled}
          setShowCreateForm={setShowCreateForm}
          handleCreate={handleCreate}
        />
      )}

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

      {!isUnauthorized && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <CalendarMonthGrid
            weekdayLabels={weekdayLabels}
            monthCells={monthCells}
            visibleEvents={visibleEvents}
            todayStr={todayStr}
            selectedDate={selectedDate}
            chooseDate={chooseDate}
          />

          <CalendarDayAgendaPanel
            selectedDate={selectedDate}
            isLoading={isLoading}
            events={events}
            selectedDayEvents={selectedDayEvents}
            pagedDayEvents={pagedDayEvents}
            backendStatus={backendStatus}
            language={language}
            t={t}
            classNameById={classNameById}
            canRespondResolved={canRespondResolved}
            canCancelResolved={canCancelResolved}
            rsvpPendingId={rsvpPendingId}
            cancellingId={cancellingId}
            setCancellingId={setCancellingId}
            cancelReason={cancelReason}
            setCancelReason={setCancelReason}
            cancellingSubmitting={cancellingSubmitting}
            onRsvpAttending={(ev) => void handleRsvp(ev.id, 'ATTENDING')}
            onRsvpAcknowledged={(ev) => void handleRsvp(ev.id, 'ACKNOWLEDGED')}
            onRsvpDeclined={(ev) => void handleRsvp(ev.id, 'DECLINED')}
            handleCancelEvent={handleCancelEvent}
            setAgendaLimit={setAgendaLimit}
          />
        </div>
      )}
    </div>
  );
};
