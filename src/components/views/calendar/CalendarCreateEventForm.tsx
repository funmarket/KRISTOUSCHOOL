import React from 'react';
import { Info, Lock, Users } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import type {
  CalendarAudienceMode,
  CalendarAudiencePlan,
  CalendarClassOption,
} from '../../../lib/calendar/calendarAudience';
import type { CalendarEventCategory, Language } from '../../../types';
import { CATEGORIES, formatAudienceOptionLabel } from './calendarDisplayConfig';

export interface CalendarCreateEventFormProps {
  language: Language;
  t: (key: any) => string;
  isSchoolCalendarManager: boolean;
  audiencePlan: CalendarAudiencePlan;
  resolvedAssignedClasses: CalendarClassOption[];
  loadingTeachers: boolean;
  effectiveTeacherPickerBlocked: boolean;
  audienceMode: CalendarAudienceMode;
  handleAudienceModeChange: (nextMode: CalendarAudienceMode) => void;
  targetClassId: string;
  setTargetClassId: (val: string) => void;
  selectedTeacherId: string;
  setSelectedTeacherId: (val: string) => void;
  title: string;
  setTitle: (val: string) => void;
  category: CalendarEventCategory;
  setCategory: (val: CalendarEventCategory) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  isPublic: boolean;
  setIsPublic: (val: boolean) => void;
  submitting: boolean;
  isCreateSubmitDisabled: boolean;
  setShowCreateForm: (val: boolean) => void;
  handleCreate: (e: React.FormEvent) => Promise<void>;
}

export const CalendarCreateEventForm: React.FC<CalendarCreateEventFormProps> = ({
  language,
  t,
  isSchoolCalendarManager,
  audiencePlan,
  resolvedAssignedClasses,
  loadingTeachers,
  effectiveTeacherPickerBlocked,
  audienceMode,
  handleAudienceModeChange,
  targetClassId,
  setTargetClassId,
  selectedTeacherId,
  setSelectedTeacherId,
  title,
  setTitle,
  category,
  setCategory,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  description,
  setDescription,
  isPublic,
  setIsPublic,
  submitting,
  isCreateSubmitDisabled,
  setShowCreateForm,
  handleCreate,
}) => {
  return (
    <form
      onSubmit={(e) => void handleCreate(e)}
      data-testid="calendar-create-form"
      className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
    >
      <h4 className="font-bold text-sm text-gray-900 dark:text-white">
        {pickText(
          { ar: 'إنشاء حدث في التقويم المدرسي', fr: 'Nouvel événement scolaire', en: 'New Calendar Event', es: 'Nuevo evento del calendario', de: 'Neuer Kalendereintrag', pt: 'Novo evento do calendário' },
          language,
        )}
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <span>
            {pickText({ ar: 'الجمهور المستهدف', fr: 'Public cible', en: 'Event audience', es: 'Público del evento', de: 'Zielgruppe', pt: 'Público do evento' }, language)}
          </span>
          <select
            data-testid="calendar-audience-select"
            value={audienceMode}
            onChange={(e) => handleAudienceModeChange(e.target.value as CalendarAudienceMode)}
            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
          >
            {audiencePlan.options.map((opt) => (
              <option key={opt.mode} value={opt.mode}>
                {formatAudienceOptionLabel(opt.mode, isSchoolCalendarManager, language)}
              </option>
            ))}
          </select>
        </label>

        {audienceMode === 'SINGLE_CLASS' && (
          <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>
              {pickText({ ar: 'القسم المستهدف', fr: 'Classe cible', en: 'Target class', es: 'Clase objetivo', de: 'Zielklasse', pt: 'Turma de destino' }, language)}
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
                    { ar: 'لا توجد أقسام متاحة', fr: 'Aucune classe disponible', en: 'No active classes available', es: 'No hay clases activas disponibles', de: 'Keine aktiven Klassen verfügbar', pt: 'Nenhuma turma ativa disponível' },
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

        {audienceMode === 'TEACHER_CLASSES' && (
          <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>
              {pickText({ ar: 'الأستاذ المستهدف', fr: 'Enseignant cible', en: 'Target teacher', es: 'Docente objetivo', de: 'Ziellehrkraft', pt: 'Professor de destino' }, language)}
            </span>
            {loadingTeachers ? (
              <div
                data-testid="calendar-teacher-picker-loading"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500"
              >
                {t('loading')}
              </div>
            ) : effectiveTeacherPickerBlocked || audiencePlan.selectableTeachers.length === 0 ? (
              <div
                data-testid={
                  effectiveTeacherPickerBlocked
                    ? 'calendar-teacher-picker-unavailable'
                    : 'calendar-teacher-picker-empty'
                }
                role="status"
                className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {effectiveTeacherPickerBlocked
                    ? pickText(
                        {
                          ar: 'اختيار الأستاذ غير متاح لهذا الحساب حالياً. يمكنك استخدام خيار «كامل المدرسة» أو «قسم واحد محدد».',
                          fr: 'La sélection d’un enseignant n’est pas disponible pour ce compte actuellement. Utilisez « Toute l’école » ou « Une classe sélectionnée ».',
                          en: 'Selecting a teacher is unavailable for this account right now. Use "Whole school" or "One selected class" instead.',
                          es: 'La selección de docente no está disponible para esta cuenta en este momento. Use "Toda la escuela" o "Una clase seleccionada".',
                          de: 'Die Lehrkraftauswahl ist für dieses Konto derzeit nicht verfügbar. Nutzen Sie „Ganze Schule“ oder „Eine ausgewählte Klasse“.',
                          pt: 'A seleção de professor não está disponível para esta conta neste momento. Use "Toda a escola" ou "Uma turma selecionada".',
                        },
                        language,
                      )
                    : pickText(
                        {
                          ar: 'لا يوجد أساتذة معتمدون متاحون للاختيار حالياً.',
                          fr: 'Aucun enseignant approuvé n’est disponible pour le moment.',
                          en: 'No approved teachers are available to select right now.',
                          es: 'No hay docentes aprobados disponibles para seleccionar ahora.',
                          de: 'Derzeit sind keine genehmigten Lehrkräfte zur Auswahl verfügbar.',
                          pt: 'Não há professores aprovados disponíveis para selecionar neste momento.',
                        },
                        language,
                      )}
                </span>
              </div>
            ) : (
              <select
                data-testid="calendar-teacher-select"
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
              >
                {audiencePlan.selectableTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                    {teacher.username ? ` (@${teacher.username})` : ''}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}
      </div>

      {audienceMode === 'ALL_MY_CLASSES' && (
        <div
          data-testid={
            resolvedAssignedClasses.length > 0
              ? 'calendar-all-my-classes-summary'
              : 'calendar-no-assigned-classes-notice'
          }
          role="status"
          className="p-3.5 rounded-2xl text-xs font-semibold bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200 border border-blue-200 dark:border-blue-900 flex items-center gap-2"
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>
            {resolvedAssignedClasses.length > 0
              ? pickText(
                  {
                    ar: `سيظهر هذا الحدث في جميع أقسامك المسندة: ${resolvedAssignedClasses.map((c) => c.name).join('، ')}`,
                    fr: `Cet événement sera visible dans toutes vos classes attribuées : ${resolvedAssignedClasses.map((c) => c.name).join(', ')}`,
                    en: `This event will appear across all of your assigned classes: ${resolvedAssignedClasses.map((c) => c.name).join(', ')}`,
                    es: `Este evento aparecerá en todas sus clases asignadas: ${resolvedAssignedClasses.map((c) => c.name).join(', ')}`,
                    de: `Dieser Eintrag erscheint in allen Ihren zugewiesenen Klassen: ${resolvedAssignedClasses.map((c) => c.name).join(', ')}`,
                    pt: `Este evento aparecerá em todas as suas turmas atribuídas: ${resolvedAssignedClasses.map((c) => c.name).join(', ')}`,
                  },
                  language,
                )
              : pickText(
                  {
                    ar: 'لا توجد أقسام مسندة لحسابك حالياً.',
                    fr: 'Aucune classe active n’est attribuée à votre compte actuellement.',
                    en: 'No active assigned classes are available for your account.',
                    es: 'No hay clases activas asignadas para su cuenta.',
                    de: 'Für Ihr Konto sind keine aktiven zugewiesenen Klassen verfügbar.',
                    pt: 'Não existem turmas ativas atribuídas à sua conta.',
                  },
                  language,
                )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          data-testid="calendar-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={pickText({ ar: 'عنوان الحدث', fr: 'Titre', en: 'Event title', es: 'Título del evento', de: 'Veranstaltungstitel', pt: 'Título do evento' }, language)}
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
        placeholder={pickText({ ar: 'التفاصيل', fr: 'Description', en: 'Description', es: 'Descripción', de: 'Beschreibung', pt: 'Descrição' }, language)}
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
              es: 'Los eventos se guardan para todo el día (Africa/Tunis). Horarios exactos, edición, ubicaciones, fotos y totales de asistencia aún no están disponibles.',
              de: 'Einträge werden ganztägig gespeichert (Africa/Tunis). Uhrzeiten, Bearbeitung, Orte, Fotos und Teilnahmesummen sind noch nicht verfügbar.',
              pt: 'Os eventos são guardados para o dia inteiro (Africa/Tunis). Horários específicos, edição, locais, fotos e totais de presença ainda não estão disponíveis.',
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
              { ar: 'مرئي في الموقع العام', fr: 'Visible sur le site public', en: 'Visible on public homepage', es: 'Visible en la portada pública', de: 'Auf öffentlicher Startseite sichtbar', pt: 'Visível na página pública' },
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
          disabled={isCreateSubmitDisabled}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
        >
          {submitting ? t('loading') : t('save')}
        </button>
      </div>
    </form>
  );
};
