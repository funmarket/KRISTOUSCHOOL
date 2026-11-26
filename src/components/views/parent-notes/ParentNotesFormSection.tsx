import React from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import { ParentNote } from '../../../types';
import { pickText } from '../../../i18n/homepages';
import { PARENT_NOTES_DAILY_QUOTA } from '../../../lib/schoolContent';

interface ParentNotesFormSectionProps {
  embeddedUnderCalendar: boolean;
  classNameLabel: string | null;
  withinTunisWindow: boolean;
  isStaffReviewer: boolean;
  isRefreshingQuota: boolean;
  isQuotaStale: boolean;
  isQuotaVerified: boolean;
  remainingParentNotesToday: number | null;
  showNoChildHint: boolean;
  notesStatus: string;
  notesError: string | null;
  showSendForm: boolean;
  errorMsg: string;
  successMsg: string;
  scopedChildren: { id: string; fullName: string; className: string }[];
  effectiveChildId: string;
  setSelectedChildId: (id: string) => void;
  topic: ParentNote['topic'];
  setTopic: (t: ParentNote['topic']) => void;
  content: string;
  setContent: (c: string) => void;
  trimmedLength: number;
  canSubmitParentNote: boolean;
  submitting: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleQuotaRefresh: () => void;
  t: (key: string) => string;
  language: string;
}

export const ParentNotesFormSection: React.FC<ParentNotesFormSectionProps> = ({
  embeddedUnderCalendar,
  classNameLabel,
  withinTunisWindow,
  isStaffReviewer,
  isRefreshingQuota,
  isQuotaStale,
  isQuotaVerified,
  remainingParentNotesToday,
  showNoChildHint,
  notesStatus,
  notesError,
  showSendForm,
  errorMsg,
  successMsg,
  scopedChildren,
  effectiveChildId,
  setSelectedChildId,
  topic,
  setTopic,
  content,
  setContent,
  trimmedLength,
  canSubmitParentNote,
  submitting,
  handleSubmit,
  handleQuotaRefresh,
  t,
  language,
}) => {
  const hasNumericQuota = typeof remainingParentNotesToday === 'number' && Number.isFinite(remainingParentNotesToday);
  const quotaUnavailable = notesStatus === 'UNAUTHORIZED' || !hasNumericQuota;
  const quotaOutdated = !quotaUnavailable && (isQuotaStale || !isQuotaVerified);
  const quotaDigits = hasNumericQuota ? `${remainingParentNotesToday} / ${PARENT_NOTES_DAILY_QUOTA}` : '';

  const quotaBadgeLabel = quotaUnavailable
    ? pickText(
        {
          ar: 'تقدير الحصة غير متاح',
          fr: 'Estimation indisponible',
          en: 'Estimated quota unavailable',
          es: 'Cuota estimada no disponible',
          de: 'Geschätztes Kontingent nicht verfügbar',
          pt: 'Quota estimada indisponível',
        },
        language as any,
      )
    : quotaOutdated
    ? pickText(
        {
          ar: `غير محدّث (${quotaDigits})`,
          fr: `Périmée (${quotaDigits})`,
          en: `Outdated (${quotaDigits})`,
          es: `Desactualizado (${quotaDigits})`,
          de: `Veraltet (${quotaDigits})`,
          pt: `Desatualizado (${quotaDigits})`,
        },
        language as any,
      )
    : pickText(
        {
          ar: `تقديريًا (${quotaDigits})`,
          fr: `Estimation (${quotaDigits})`,
          en: `Estimated (${quotaDigits})`,
          es: `Estimado (${quotaDigits})`,
          de: `Geschätzt (${quotaDigits})`,
          pt: `Estimado (${quotaDigits})`,
        },
        language as any,
      );

  const closedWindowText = pickText(
    {
      ar: 'مغلق خارج 08:00–18:00 تونس',
      fr: 'Fermé hors 08h00–18h00 Tunis',
      en: 'Closed Outside 08:00–18:00 Tunis',
      es: 'Cerrado fuera de 08:00–18:00 Túnez',
      de: 'Geschlossen außerhalb 08:00–18:00 Tunis',
      pt: 'Fechado fora das 08:00–18:00 Tunes',
    },
    language as any,
  );

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-[#111111] p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {classNameLabel ? `${t('parentNotes')} • ${classNameLabel}` : t('parentNotes')}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
            {embeddedUnderCalendar
              ? pickText(
                  {
                    ar: 'ملاحظات الأولياء الخاصة تحت الروزنامة',
                    fr: 'Notes privées des parents sous le calendrier',
                    en: 'Private Parent–School Notes',
                    es: 'Notas privadas de padres y escuela',
                    de: 'Private Eltern-Schule-Notizen',
                    pt: 'Notas privadas de pais e escola',
                  },
                  language as any,
                )
              : t('parentNotes')}
          </h2>
          <p className="text-xs text-gray-500">{t('notesDescription')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {!isStaffReviewer && (
            <div
              data-testid="parent-notes-quota-badge"
              className={`px-3.5 py-2 rounded-2xl border text-xs font-bold ${
                quotaUnavailable || quotaOutdated
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                  : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300'
              }`}
            >
              {quotaBadgeLabel}
            </div>
          )}
          <div
            data-testid="parent-notes-window-badge"
            className={`px-3.5 py-2 rounded-2xl border text-xs font-bold ${
              withinTunisWindow
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
            }`}
          >
            {withinTunisWindow
              ? pickText(
                  { ar: 'مفتوح الآن (08:00–18:00 تونس)', fr: 'Ouvert (08h00–18h00 Tunis)', en: 'Open Now (08:00–18:00 Tunis)', es: 'Abierto ahora (08:00–18:00 Túnez)', de: 'Jetzt geöffnet (08:00–18:00 Tunis)', pt: 'Aberto agora (08:00–18:00 Tunes)' },
                  language as any,
                )
              : closedWindowText}
          </div>
        </div>
      </div>

      {isRefreshingQuota && (
        <div data-testid="parent-notes-quota-refreshing" className="p-3 bg-blue-50 text-blue-800 rounded-2xl text-xs">
          {t('loading')}
        </div>
      )}

      {notesStatus === 'UNAUTHORIZED' && (
        <div data-testid="parent-notes-unauthorized-state" className="p-4 bg-amber-50 text-amber-900 rounded-2xl text-xs">
          {notesError || t('unauthorized')}
        </div>
      )}

      {notesStatus === 'ERROR' && (
        <div data-testid="parent-notes-error-state" className="p-4 bg-red-50 text-red-800 rounded-2xl text-xs flex justify-between items-center">
          <span>{notesError || t('error')}</span>
          <button data-testid="parent-notes-retry-btn" type="button" onClick={handleQuotaRefresh} className="underline font-bold">
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language as any)}
          </button>
        </div>
      )}

      {showNoChildHint && (
        <div data-testid="parent-note-no-child-hint" className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-2xl text-xs font-semibold">
          {pickText(
            {
              ar: 'لا يوجد طفل مرتبط بحسابك في هذا القسم.',
              fr: 'Aucun enfant associé à votre compte dans cette classe.',
              en: 'No linked child in this class.',
              es: 'Ningún hijo vinculado en esta clase.',
              de: 'Kein verknüpftes Kind in dieser Klasse.',
              pt: 'Nenhuma criança associada a esta turma.',
            },
            language as any,
          )}
        </div>
      )}

      {showSendForm && (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'إرسال ملاحظة جديدة', fr: 'Envoyer une nouvelle note', en: 'Send New Note', es: 'Enviar nueva nota', de: 'Neue Notiz senden', pt: 'Enviar nova nota' }, language as any)}
          </h3>
          {!withinTunisWindow && (
            <div data-testid="parent-notes-window-closed-notice" className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-2xl text-xs font-semibold">
              {closedWindowText}
            </div>
          )}
          {errorMsg && <div className="p-3 bg-red-50 text-red-700 rounded-2xl text-xs">{errorMsg}</div>}
          {successMsg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl text-xs">{successMsg}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {scopedChildren.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {t('childConcerned')}
                </label>
                <select
                  value={effectiveChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  {scopedChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.fullName} ({child.className})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t('subject')}
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as ParentNote['topic'])}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
              >
                <option value="ABSENCE">Absence / Retard</option>
                <option value="HOMEWORK">Devoirs / Travail</option>
                <option value="HEALTH">Santé / Médical</option>
                <option value="PICKUP">Sortie / Pickup</option>
                <option value="OTHER">Autre / Général</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t('message')} ({trimmedLength}/1000)
              </label>
              <textarea
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('notePlaceholder')}
                className="w-full p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                data-testid="parent-note-submit-btn"
                disabled={!canSubmitParentNote}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? t('loading') : t('sendNote')}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
