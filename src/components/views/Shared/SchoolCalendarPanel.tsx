import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { BackendOpStatus, CalendarEvent, CalendarEventCategory } from '../../../types';
import { pickText } from '../../../i18n/homepages';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import {
  cancelSchoolCalendarEvent,
  getEventsForCalendarDate,
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
} from 'lucide-react';

export interface SchoolCalendarPanelProps {
  events: CalendarEvent[];
  backendStatus: BackendOpStatus;
  classId?: string | null;
  canManage: boolean;
  onRefresh: () => Promise<void>;
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
  events,
  backendStatus,
  classId = null,
  canManage,
  onRefresh,
}) => {
  const { language, t } = useApp();
  const todayStr = getTunisSchoolDay();
  const [cursorYear, setCursorYear] = useState<number>(() => Number(todayStr.slice(0, 4)));
  const [cursorMonth, setCursorMonth] = useState<number>(() => Number(todayStr.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CalendarEventCategory>('EVENT');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const visibleEvents = useMemo(() => {
    return events.filter((ev) => {
      if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
      return true;
    });
  }, [events, categoryFilter]);

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
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(cursorYear, cursorMonth, 1)),
    );
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

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(cursorYear, cursorMonth + delta, 1));
    setCursorYear(next.getUTCFullYear());
    setCursorMonth(next.getUTCMonth());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    const res = await upsertSchoolCalendarEvent({
      title,
      description,
      category,
      startDate,
      endDate,
      classId,
      isAllDay: true,
      isPublic: !classId && isPublic,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.errorMessage || t('error') });
      return;
    }
    setTitle('');
    setDescription('');
    setShowCreateForm(false);
    setFeedback({
      type: 'success',
      text: pickText(
        {
          ar: 'تم حفظ الحدث في التقويم بنجاح.',
          fr: 'Événement enregistré dans le calendrier.',
          en: 'Calendar event saved to server.',
        },
        language,
      ),
    });
    await onRefresh();
  };

  const handleRsvp = async (eventId: string, response: 'ATTENDING' | 'ACKNOWLEDGED') => {
    setFeedback(null);
    const res = await respondToCalendarEvent(eventId, response);
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.errorMessage || t('error') });
      return;
    }
    await onRefresh();
  };

  const handleCancelEvent = async (eventId: string) => {
    setFeedback(null);
    const res = await cancelSchoolCalendarEvent(eventId, cancelReason);
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.errorMessage || t('error') });
      return;
    }
    setCancellingId(null);
    setCancelReason('');
    await onRefresh();
  };

  return (
    <div className="space-y-5" data-testid="school-calendar-panel">
      {/* Toolbar */}
      <div className="bg-white dark:bg-[#111111] p-4 sm:p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
            onClick={() => {
              setCursorYear(Number(todayStr.slice(0, 4)));
              setCursorMonth(Number(todayStr.slice(5, 7)) - 1);
              setSelectedDate(todayStr);
            }}
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
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

          {canManage && (
            <button
              type="button"
              data-testid="calendar-add-event-btn"
              onClick={() => setShowCreateForm((v) => !v)}
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

      {feedback && (
        <div
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

      {/* Create Event Form */}
      {canManage && showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
        >
          <h4 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText(
              { ar: 'إنشاء حدث في التقويم المدرسي', fr: 'Nouvel événement scolaire', en: 'New Calendar Event' },
              language,
            )}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={pickText({ ar: 'عنوان الحدث', fr: 'Titre', en: 'Event title' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <select
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
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={pickText({ ar: 'التفاصيل', fr: 'Description', en: 'Description' }, language)}
            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
          />
          {!classId && (
            <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
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
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {backendStatus === 'BLOCKED_BACKEND' && events.length === 0 && (
        <EmptyFeatureState
          state="BLOCKED_BACKEND"
          title={pickText(
            {
              ar: 'التقويم المدرسي بانتظار التفعيل في الخادم',
              fr: 'Calendrier scolaire en attente du contrat serveur',
              en: 'School Calendar Pending Backend Deployment',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'الجدول school_calendar_events غير منشور بعد في Supabase. لا يتم عرض أي أحداث وهمية.',
              fr: 'La table school_calendar_events n’est pas encore déployée sur Supabase. Aucune donnée fictive n’est affichée.',
              en: 'public.school_calendar_events is awaiting deployment on Supabase. No mock events are substituted.',
            },
            language,
          )}
        />
      )}

      {/* Calendar Grid + Selected Day Agenda */}
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
                return <div key={`empty-${idx}`} className="min-h-[4.25rem] rounded-xl bg-gray-50/40 dark:bg-zinc-950/30" />;
              }
              const dayEvents = getEventsForCalendarDate(visibleEvents, cell.dateStr);
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr!)}
                  className={`min-h-[4.25rem] p-1.5 rounded-xl border text-start flex flex-col gap-1 transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                      : isToday
                      ? 'border-emerald-500/70 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <span
                    className={`text-[11px] font-extrabold ${
                      isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
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
                      <div className="text-[9px] font-bold text-gray-400">+{dayEvents.length - 2}</div>
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
              <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{selectedDate}</h4>
            </div>
            <span className="text-[11px] font-bold text-gray-400">{t('timezone')}</span>
          </div>

          {selectedDayEvents.length === 0 ? (
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
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg uppercase ${getCategoryStyle(
                        ev.category,
                        ev.status === 'CANCELLED',
                      )}`}
                    >
                      {ev.category}
                    </span>
                    {ev.status === 'CANCELLED' && (
                      <span className="text-[10px] font-bold text-red-600">CANCELLED</span>
                    )}
                  </div>
                  <h5 className="font-bold text-xs text-gray-900 dark:text-white">{ev.title}</h5>
                  {ev.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">{ev.description}</p>
                  )}
                  {ev.cancellationReason && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                      {ev.cancellationReason}
                    </p>
                  )}

                  {ev.status !== 'CANCELLED' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleRsvp(ev.id, 'ACKNOWLEDGED')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                          ev.myResponse === 'ACKNOWLEDGED'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>
                          {pickText({ ar: 'تم الاطلاع', fr: 'Vu', en: 'Acknowledge' }, language)}
                        </span>
                      </button>

                      {canManage && (
                        <button
                          type="button"
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

                  {cancellingId === ev.id && (
                    <div className="pt-2 space-y-2">
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder={pickText(
                          { ar: 'سبب الإلغاء', fr: 'Motif d’annulation', en: 'Cancellation reason' },
                          language,
                        )}
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCancelEvent(ev.id)}
                        className="w-full py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
                      >
                        {pickText(
                          { ar: 'تأكيد الإلغاء', fr: 'Confirmer l’annulation', en: 'Confirm cancel' },
                          language,
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
