import React from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  Globe,
  Users,
  XCircle,
} from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import {
  getVisibleCalendarTargetClassIds,
  isWholeSchoolCalendarEvent,
} from '../../../lib/calendar/calendarModel';
import type { BackendOpStatus, CalendarEvent, Language } from '../../../types';
import {
  AGENDA_PAGE_SIZE,
  formatRsvpLabel,
  getCategoryStyle,
} from './calendarDisplayConfig';

export interface CalendarDayAgendaPanelProps {
  selectedDate: string;
  isLoading: boolean;
  events: CalendarEvent[];
  selectedDayEvents: CalendarEvent[];
  pagedDayEvents: CalendarEvent[];
  backendStatus: BackendOpStatus;
  language: Language;
  t: (key: any) => string;
  classNameById: Map<string, string>;
  canRespondResolved: boolean;
  canCancelResolved: boolean;
  rsvpPendingId: string | null;
  cancellingId: string | null;
  setCancellingId: (id: string | null) => void;
  cancelReason: string;
  setCancelReason: (val: string) => void;
  cancellingSubmitting: boolean;
  onRsvpAttending: (ev: CalendarEvent) => void;
  onRsvpAcknowledged: (ev: CalendarEvent) => void;
  onRsvpDeclined: (ev: CalendarEvent) => void;
  handleCancelEvent: (eventId: string) => Promise<void>;
  setAgendaLimit: React.Dispatch<React.SetStateAction<number>>;
}

export const CalendarDayAgendaPanel: React.FC<CalendarDayAgendaPanelProps> = ({
  selectedDate,
  isLoading,
  events,
  selectedDayEvents,
  pagedDayEvents,
  backendStatus,
  language,
  t,
  classNameById,
  canRespondResolved,
  canCancelResolved,
  rsvpPendingId,
  cancellingId,
  setCancellingId,
  cancelReason,
  setCancelReason,
  cancellingSubmitting,
  onRsvpAttending,
  onRsvpAcknowledged,
  onRsvpDeclined,
  handleCancelEvent,
  setAgendaLimit,
}) => {
  return (
    <div className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{selectedDate}</h4>
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
          {pickText({ ar: 'لا توجد أحداث مجدولة لهذا اليوم.', fr: 'Aucun événement prévu pour cette date.', en: 'No events scheduled for this date.', es: 'No hay eventos programados para esta fecha.', de: 'Keine Veranstaltungen für dieses Datum geplant.', pt: 'Não há eventos agendados para esta data.' }, language)}
        </p>
      ) : selectedDayEvents.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">
          {pickText({ ar: 'لا توجد أحداث معروضة لهذا التاريخ.', fr: 'Aucun événement affiché pour cette date.', en: 'No displayed events for this date.', es: 'No hay eventos mostrados para esta fecha.', de: 'Keine angezeigten Veranstaltungen für dieses Datum.', pt: 'Não há eventos exibidos para esta data.' }, language)}
        </p>
      ) : (
        <div className="space-y-3">
          {pagedDayEvents.map((ev) => {
            const isWholeSchool = isWholeSchoolCalendarEvent(ev);
            const visibleTargetClassIds = getVisibleCalendarTargetClassIds(ev);
            const visibleTargetNames = visibleTargetClassIds.map(
              (cid) => classNameById.get(cid) || cid,
            );
            const scopeBadgeLabel = isWholeSchool
              ? pickText({ ar: 'كامل المدرسة', fr: 'Toute l’école', en: 'Whole school', es: 'Toda la escuela', de: 'Ganze Schule', pt: 'Toda a escola' }, language)
              : visibleTargetNames.length > 0
              ? visibleTargetNames.join(', ')
              : pickText({ ar: 'قسم مستهدف', fr: 'Classe ciblée', en: 'Targeted class', es: 'Clase objetivo', de: 'Zielklasse', pt: 'Turma alvo' }, language);
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
                      <span>{scopeBadgeLabel}</span>
                    </span>
                    {ev.isPublic && (
                      <span
                        data-testid="calendar-event-public-badge"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                      >
                        <Globe className="w-3 h-3" />
                        <span>
                          {pickText({ ar: 'عام', fr: 'Public', en: 'Public', es: 'Público', de: 'Öffentlich', pt: 'Público' }, language)}
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
                        {pickText({ ar: 'ملغى', fr: 'ANNULÉ', en: 'CANCELLED', es: 'CANCELADO', de: 'ABGESAGT', pt: 'CANCELADO' }, language)}
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
                          {pickText({ ar: `ردك السابق (${formatRsvpLabel(ev.myResponse, language)})`, fr: `Réponse précédente (${formatRsvpLabel(ev.myResponse, language)})`, en: `Prior response: ${formatRsvpLabel(ev.myResponse, language)}`, es: `Respuesta anterior: ${formatRsvpLabel(ev.myResponse, language)}`, de: `Vorherige Antwort: ${formatRsvpLabel(ev.myResponse, language)}`, pt: `Resposta anterior: ${formatRsvpLabel(ev.myResponse, language)}` }, language)}
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-500">
                      {pickText({ ar: 'إشعار إلغاء حدث فقط — لا يُسجل غياباً ولا يغلق المدرسة ولا يُعد إذن خروج.', fr: 'Annulation d’événement uniquement — n’enregistre ni absence, ni fermeture, ni sortie.', en: 'Event cancellation notice only — does not record pupil absence, school closure, or pickup release.', es: 'Solo aviso de cancelación del evento: no registra ausencia, cierre escolar ni salida.', de: 'Nur Veranstaltungsabsage — erfasst weder Abwesenheit noch Schulschließung oder Abholfreigabe.', pt: 'Apenas aviso de cancelamento — não regista falta, encerramento escolar nem autorização de saída.' }, language)}
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
                          onClick={() => onRsvpAttending(ev)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                            ev.myResponse === 'ATTENDING'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{pickText({ ar: 'سأحضر', fr: 'Participer', en: 'Attending', es: 'Asistiré', de: 'Teilnahme', pt: 'Participar' }, language)}</span>
                        </button>

                        <button
                          type="button"
                          disabled={rsvpPendingId === ev.id}
                          onClick={() => onRsvpAcknowledged(ev)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                            ev.myResponse === 'ACKNOWLEDGED'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{pickText({ ar: 'تم الاطلاع', fr: 'Vu', en: 'Acknowledge', es: 'Visto', de: 'Bestätigen', pt: 'Confirmar leitura' }, language)}</span>
                        </button>

                        <button
                          type="button"
                          disabled={rsvpPendingId === ev.id}
                          onClick={() => onRsvpDeclined(ev)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                            ev.myResponse === 'DECLINED'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <XCircle className="w-3 h-3" />
                          <span>{pickText({ ar: 'معتذر', fr: 'Absent', en: 'Decline', es: 'No asistiré', de: 'Absagen', pt: 'Recusar' }, language)}</span>
                        </button>
                      </>
                    )}

                    {canCancelResolved && (
                      <button
                        type="button"
                        data-testid="calendar-cancel-event-btn"
                        onClick={() => setCancellingId(cancellingId === ev.id ? null : ev.id)}
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
                      placeholder={pickText({ ar: 'سبب الإلغاء', fr: 'Motif d’annulation', en: 'Cancellation reason', es: 'Motivo de cancelación', de: 'Absagegrund', pt: 'Motivo do cancelamento' }, language)}
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
                        : pickText({ ar: 'تأكيد الإلغاء', fr: 'Confirmer l’annulation', en: 'Confirm cancel', es: 'Confirmar cancelación', de: 'Absage bestätigen', pt: 'Confirmar cancelamento' }, language)}
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
              {pickText({ ar: `عرض المزيد (${selectedDayEvents.length - pagedDayEvents.length})`, fr: `Afficher plus (${selectedDayEvents.length - pagedDayEvents.length})`, en: `Show more (${selectedDayEvents.length - pagedDayEvents.length})`, es: `Mostrar más (${selectedDayEvents.length - pagedDayEvents.length})`, de: `Mehr anzeigen (${selectedDayEvents.length - pagedDayEvents.length})`, pt: `Mostrar mais (${selectedDayEvents.length - pagedDayEvents.length})` }, language)}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
