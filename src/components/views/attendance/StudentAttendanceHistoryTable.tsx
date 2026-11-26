import React from 'react';
import { CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import { formatAttendanceDateLabel } from '../../../lib/attendance/dateUtils';
import { getAttendanceMarkBadgeClass, getAttendanceMarkLabel } from './attendanceLabels';
import type { BackendOpStatus, Language, StudentAttendanceRecord } from '../../../types';

interface StudentAttendanceHistoryTableProps {
  testId: string;
  language: Language;
  effectiveStatus: BackendOpStatus | 'LOADING';
  isRangeValid: boolean;
  errorMessage: string | null;
  visibleItems: StudentAttendanceRecord[];
  resolveClassLabel: (classId: string) => string;
  resolveTeacherLabel: (classId: string, teacherUserId: string) => string;
  onRetry: () => void;
  t: (key: 'loading') => string;
}

export const StudentAttendanceHistoryTable: React.FC<StudentAttendanceHistoryTableProps> = ({
  testId,
  language,
  effectiveStatus,
  isRangeValid,
  errorMessage,
  visibleItems,
  resolveClassLabel,
  resolveTeacherLabel,
  onRetry,
  t,
}) => (
  <>
    {!isRangeValid && (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2"
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          {pickText(
            {
              ar: 'نطاق التاريخ غير صالح: يجب أن يكون تاريخ البداية قبل أو مساوياً لتاريخ النهاية وبحد أقصى 366 يوماً.',
              fr: 'Période invalide : la date de début doit précéder la fin (366 jours maximum).',
              en: 'Invalid date range: start date must be on or before end date and within 366 days.',
              es: 'Rango de fechas no válido: la fecha inicial debe ser anterior o igual a la final (máximo 366 días).',
              de: 'Ungültiger Datumsbereich: Startdatum muss vor oder am Enddatum liegen (maximal 366 Tage).',
              pt: 'Intervalo de datas inválido: a data de início deve ser anterior ou igual à de fim (máximo de 366 dias).',
            },
            language,
          )}
        </span>
      </div>
    )}

    {effectiveStatus === 'LOADING' && (
      <div className="py-6 text-center text-xs font-bold text-slate-500 dark:text-zinc-400">
        {t('loading')}
      </div>
    )}

    {effectiveStatus === 'UNAUTHORIZED' && (
      <div
        role="alert"
        className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2"
      >
        <Lock className="w-4 h-4 shrink-0" />
        <span>
          {errorMessage ||
            pickText(
              {
                ar: 'غير مصرح بعرض سجل الحضور لهذا التلميذ.',
                fr: 'Accès non autorisé à l’historique de présence.',
                en: 'Not authorized to view attendance history for this pupil.',
                es: 'No autorizado para ver el historial de asistencia de este alumno.',
                de: 'Keine Berechtigung zur Einsicht des Anwesenheitsverlaufs dieses Schülers.',
                pt: 'Sem autorização para ver o histórico de assiduidade deste aluno.',
              },
              language,
            )}
        </span>
      </div>
    )}

    {effectiveStatus === 'BLOCKED_BACKEND' && (
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 px-4 py-3 text-xs font-semibold text-slate-600 dark:text-zinc-300">
        {errorMessage ||
          pickText(
            {
              ar: 'خدمة سجل الحضور غير متاحة حالياً على الخادم.',
              fr: 'Service d’historique des présences indisponible.',
              en: 'Attendance history service is unavailable.',
              es: 'El servicio de historial de asistencia no está disponible.',
              de: 'Der Anwesenheitsverlaufsdienst ist derzeit nicht verfügbar.',
              pt: 'O serviço de histórico de assiduidade está indisponível.',
            },
            language,
          )}
      </div>
    )}

    {effectiveStatus === 'ERROR' && isRangeValid && (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {errorMessage ||
              pickText(
                {
                  ar: 'تعذر تحميل سجل الحضور من الخادم.',
                  fr: 'Impossible de charger l’historique des présences.',
                  en: 'Failed to load attendance history from the server.',
                  es: 'Error al cargar el historial de asistencia desde el servidor.',
                  de: 'Anwesenheitsverlauf konnte nicht vom Server geladen werden.',
                  pt: 'Falha ao carregar o histórico de assiduidade do servidor.',
                },
                language,
              )}
          </span>
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-red-700 hover:bg-red-800 px-3 py-1.5 text-white text-xs font-bold"
        >
          {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
        </button>
      </div>
    )}

    {effectiveStatus === 'READY' && visibleItems.length === 0 && (
      <div
        data-testid={`${testId}-empty`}
        className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 px-4 py-6 text-center text-xs font-semibold text-slate-500 dark:text-zinc-400"
      >
        {pickText(
          {
            ar: 'لا توجد سجلات حضور معتمدة في الفترة المحددة.',
            fr: 'Aucun enregistrement de présence soumis pour cette période.',
            en: 'No submitted attendance records found for this date range.',
            es: 'No se encontraron registros de asistencia enviados para este rango de fechas.',
            de: 'Keine eingereichten Anwesenheitsdaten für diesen Zeitraum gefunden.',
            pt: 'Nenhum registo de assiduidade submetido encontrado para este período.',
          },
          language,
        )}
      </div>
    )}

    {effectiveStatus === 'READY' && visibleItems.length > 0 && (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
        <table className="w-full text-start text-xs">
          <thead className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-extrabold">
            <tr>
              <th className="py-2.5 px-3 text-start">{pickText({ ar: 'التاريخ', fr: 'Date', en: 'Date', es: 'Fecha', de: 'Datum', pt: 'Data' }, language)}</th>
              <th className="py-2.5 px-3 text-start">{pickText({ ar: 'القسم', fr: 'Classe', en: 'Class', es: 'Clase', de: 'Klasse', pt: 'Turma' }, language)}</th>
              <th className="py-2.5 px-3 text-start">{pickText({ ar: 'المربي المسؤول', fr: 'Enseignant responsable', en: 'Responsible Teacher', es: 'Docente responsable', de: 'Verantwortliche Lehrkraft', pt: 'Professor responsável' }, language)}</th>
              <th className="py-2.5 px-3 text-start">{pickText({ ar: 'الحالة', fr: 'Statut', en: 'Mark', es: 'Estado', de: 'Status', pt: 'Estado' }, language)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {visibleItems.map((row) => (
              <tr key={row.registerId} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40">
                <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  <div>{row.schoolDate}</div>
                  <div className="text-[10px] font-sans font-normal text-slate-500 dark:text-zinc-400">
                    {formatAttendanceDateLabel(row.schoolDate, language)}
                  </div>
                </td>
                <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-zinc-200">
                  {resolveClassLabel(row.classId)}
                </td>
                <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                  {resolveTeacherLabel(row.classId, row.teacherUserId)}
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${getAttendanceMarkBadgeClass(row.mark)}`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{getAttendanceMarkLabel(row.mark, language)}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </>
);
