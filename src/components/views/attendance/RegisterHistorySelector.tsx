import React from 'react';
import { Calendar } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import {
  OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT,
  type OfficeAttendanceContextResult,
} from '../../../lib/attendance/api';
import { isValidIsoDate } from '../../../lib/attendance/dateUtils';
import type { Language, OfficeAttendanceTeacherOption } from '../../../types';
import type {
  PendingContextSwitch,
  ScopedOfficeRegistersState,
} from './useOfficeAttendanceDiscovery';

export interface RegisterHistorySelectorProps {
  language: Language;
  t: (key: any) => string;
  activeClassId: string;
  activeTeacherUserIdParam: string;
  schoolDate: string;
  officeSyncedData: OfficeAttendanceContextResult | null;
  officeTeachersForActiveClass: OfficeAttendanceTeacherOption[];
  syncedOfficeRegistersPage: ScopedOfficeRegistersState | null;
  officeHistoryTeacherFilter: string;
  setOfficeHistoryTeacherFilter: (val: string) => void;
  officeHistoryFromDate: string;
  setOfficeHistoryFromDate: (val: string) => void;
  officeHistoryToDate: string;
  setOfficeHistoryToDate: (val: string) => void;
  officeHistoryOffset: number;
  setOfficeHistoryOffset: React.Dispatch<React.SetStateAction<number>>;
  setOfficeHistoryReloadSeq: React.Dispatch<React.SetStateAction<number>>;
  requestContextSwitch: (nextSwitch: PendingContextSwitch) => void;
}

export const RegisterHistorySelector: React.FC<RegisterHistorySelectorProps> = ({
  language,
  t,
  activeClassId,
  activeTeacherUserIdParam,
  schoolDate,
  officeSyncedData,
  officeTeachersForActiveClass,
  syncedOfficeRegistersPage,
  officeHistoryTeacherFilter,
  setOfficeHistoryTeacherFilter,
  officeHistoryFromDate,
  setOfficeHistoryFromDate,
  officeHistoryToDate,
  setOfficeHistoryToDate,
  officeHistoryOffset,
  setOfficeHistoryOffset,
  setOfficeHistoryReloadSeq,
  requestContextSwitch,
}) => {
  const officeHistoryPageItems =
    syncedOfficeRegistersPage?.status === 'READY' ? syncedOfficeRegistersPage.items : [];
  const officeHistoryHasFilters = Boolean(
    officeHistoryTeacherFilter || officeHistoryFromDate || officeHistoryToDate,
  );
  const officeHistoryRangeStart = officeHistoryPageItems.length > 0 ? officeHistoryOffset + 1 : 0;
  const officeHistoryRangeEnd = officeHistoryOffset + officeHistoryPageItems.length;
  const officeHistoryTotalCount =
    syncedOfficeRegistersPage?.status === 'READY' ? syncedOfficeRegistersPage.totalCount : null;

  return (
    <div
      data-testid="office-historical-registers-panel"
      className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            {pickText(
              {
                ar: 'السجلات المحفوظة لهذا القسم (بحث وترقيم من الخادم):',
                fr: 'Registres enregistrés pour cette classe (filtres et pagination serveur) :',
                en: 'Saved registers for this class (server-filtered & paginated):',
                es: 'Registros guardados para esta clase (filtrados y paginados en servidor):',
                de: 'Gespeicherte Klassenbücher für diese Klasse (serverseitig gefiltert & paginiert):',
                pt: 'Registos guardados para esta turma (filtrados e paginados no servidor):',
              },
              language,
            )}
          </span>
        </div>
        {officeHistoryPageItems.length > 0 && (
          <span
            data-testid="office-registers-range-label"
            className="text-[11px] font-mono tabular-nums font-bold text-slate-500 dark:text-zinc-400"
          >
            {officeHistoryRangeStart}–{officeHistoryRangeEnd}
            {officeHistoryTotalCount !== null ? ` / ${officeHistoryTotalCount}` : ''}
          </span>
        )}
      </div>

      {officeSyncedData?.hasMoreSavedRegisters && (
        <p
          data-testid="office-registers-bounded-notice"
          className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:text-amber-200"
        >
          {pickText(
            {
              ar: `الفهرس الأولي للمعلمين غطى أحدث ${officeSyncedData.savedRegisters.length} سجلاً من أصل ${officeSyncedData.totalSavedRegistersCount ?? '2000+'}. استخدم البحث والترقيم أدناه للوصول إلى جميع السجلات التاريخية من الخادم.`,
              fr: `L’aperçu initial des enseignants couvre les ${officeSyncedData.savedRegisters.length} registres les plus récents sur ${officeSyncedData.totalSavedRegistersCount ?? '2000+'}. La liste paginée ci-dessous interroge l’historique complet côté serveur.`,
              en: `Initial teacher-summary pre-index loaded the newest ${officeSyncedData.savedRegisters.length} of ${officeSyncedData.totalSavedRegistersCount ?? '2000+'} school registers. Use the server filters and pagination below to reach all historical registers.`,
              es: `El índice inicial cargó los ${officeSyncedData.savedRegisters.length} registros más recientes de ${officeSyncedData.totalSavedRegistersCount ?? '2000+'}. Use los filtros y la paginación del servidor abajo para consultar el historial completo.`,
              de: `Der Vorab-Index hat die neuesten ${officeSyncedData.savedRegisters.length} von ${officeSyncedData.totalSavedRegistersCount ?? '2000+'} Schulregistern geladen. Nutzen Sie unten Filter und Seitennavigation für alle historischen Register.`,
              pt: `O índice inicial carregou os ${officeSyncedData.savedRegisters.length} registos mais recentes de ${officeSyncedData.totalSavedRegistersCount ?? '2000+'}. Use os filtros e a paginação do servidor abaixo para aceder ao histórico completo.`,
            },
            language,
          )}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <select
          aria-label={pickText({ ar: 'تصفية حسب المربي', fr: 'Filtrer par enseignant', en: 'Filter by teacher', es: 'Filtrar por docente', de: 'Nach Lehrkraft filtern', pt: 'Filtrar por professor' }, language)}
          data-testid="office-history-teacher-filter"
          value={officeHistoryTeacherFilter}
          onChange={(e) => {
            setOfficeHistoryTeacherFilter(e.target.value);
            setOfficeHistoryOffset(0);
          }}
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-zinc-100"
        >
          <option value="">
            {pickText({ ar: 'جميع المربين', fr: 'Tous les enseignants', en: 'All Teachers', es: 'Todos los docentes', de: 'Alle Lehrkräfte', pt: 'Todos os professores' }, language)}
          </option>
          {officeTeachersForActiveClass.map((tOpt) => (
            <option key={tOpt.userId} value={tOpt.userId}>
              {tOpt.fullName}
              {tOpt.accountStatus && tOpt.accountStatus !== 'APPROVED' ? ` (${tOpt.accountStatus})` : ''}
            </option>
          ))}
        </select>

        <input
          type="date"
          aria-label={pickText({ ar: 'من تاريخ', fr: 'Du', en: 'From date', es: 'Desde', de: 'Von Datum', pt: 'Desde' }, language)}
          data-testid="office-history-from-date"
          value={officeHistoryFromDate}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || isValidIsoDate(val)) {
              setOfficeHistoryFromDate(val);
              setOfficeHistoryOffset(0);
            }
          }}
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-mono tabular-nums font-bold text-slate-800 dark:text-zinc-100"
        />

        <input
          type="date"
          aria-label={pickText({ ar: 'إلى تاريخ', fr: 'Au', en: 'To date', es: 'Hasta', de: 'Bis Datum', pt: 'Até' }, language)}
          data-testid="office-history-to-date"
          value={officeHistoryToDate}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || isValidIsoDate(val)) {
              setOfficeHistoryToDate(val);
              setOfficeHistoryOffset(0);
            }
          }}
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-mono tabular-nums font-bold text-slate-800 dark:text-zinc-100"
        />

        {officeHistoryHasFilters && (
          <button
            type="button"
            data-testid="office-history-clear-filters-btn"
            onClick={() => {
              setOfficeHistoryTeacherFilter('');
              setOfficeHistoryFromDate('');
              setOfficeHistoryToDate('');
              setOfficeHistoryOffset(0);
            }}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200"
          >
            {pickText({ ar: 'مسح التصفية', fr: 'Réinitialiser', en: 'Clear Filters', es: 'Limpiar filtros', de: 'Filter löschen', pt: 'Limpar filtros' }, language)}
          </button>
        )}
      </div>

      {!syncedOfficeRegistersPage || syncedOfficeRegistersPage.status === 'LOADING' ? (
        <p data-testid="office-registers-loading" className="text-xs font-semibold text-slate-500">
          {t('loading')}
        </p>
      ) : syncedOfficeRegistersPage.status !== 'READY' ? (
        <div
          data-testid="office-registers-error"
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-red-700 dark:text-red-300"
        >
          <span>{syncedOfficeRegistersPage.errorMessage || t('error')}</span>
          <button
            type="button"
            onClick={() => setOfficeHistoryReloadSeq((n) => n + 1)}
            className="rounded-lg bg-red-700 hover:bg-red-800 px-2.5 py-1 text-white text-[11px] font-bold"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
          </button>
        </div>
      ) : officeHistoryPageItems.length === 0 ? (
        <p data-testid="office-registers-empty" className="text-xs text-slate-500 dark:text-zinc-400">
          {pickText(
            {
              ar: 'لا توجد سجلات حضور مطابقة لمعايير البحث في هذا القسم.',
              fr: 'Aucun registre enregistré ne correspond aux filtres sélectionnés.',
              en: 'No saved attendance registers match the selected filters for this class.',
              es: 'Ningún registro de asistencia guardado coincide con los filtros seleccionados para esta clase.',
              de: 'Keine gespeicherten Klassenbücher entsprechen den ausgewählten Filtern für diese Klasse.',
              pt: 'Nenhum registo de assiduidade guardado corresponde aos filtros selecionados para esta turma.',
            },
            language,
          )}
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {officeHistoryPageItems.map((reg) => {
              const teacherName =
                officeSyncedData?.accountNamesById[reg.teacherUserId] ||
                `@${reg.teacherUserId.slice(0, 8)}`;
              const isActive =
                reg.classId === activeClassId &&
                reg.teacherUserId === activeTeacherUserIdParam &&
                reg.schoolDate === schoolDate;
              return (
                <button
                  key={reg.registerId}
                  type="button"
                  data-testid={`office-saved-register-${reg.registerId}`}
                  onClick={() =>
                    requestContextSwitch({
                      kind: 'preset',
                      classId: reg.classId,
                      teacherUserId: reg.teacherUserId,
                      schoolDate: reg.schoolDate,
                    })
                  }
                  className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold font-mono tabular-nums transition-colors ${
                    isActive
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {reg.schoolDate} • {teacherName} • {reg.status} v{reg.version}
                </button>
              );
            })}
          </div>

          {(officeHistoryOffset > 0 || syncedOfficeRegistersPage.hasMore) && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                data-testid="office-registers-prev-btn"
                disabled={officeHistoryOffset === 0}
                onClick={() =>
                  setOfficeHistoryOffset((prev) =>
                    Math.max(0, prev - OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT),
                  )
                }
                className="min-h-[34px] rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1 text-[11px] font-bold text-slate-700 dark:text-zinc-200 disabled:opacity-40"
              >
                {pickText({ ar: 'الأحدث (السابق)', fr: 'Plus récents', en: 'Newer', es: 'Más recientes', de: 'Neuer', pt: 'Mais recentes' }, language)}
              </button>
              <button
                type="button"
                data-testid="office-registers-next-btn"
                disabled={!syncedOfficeRegistersPage.hasMore}
                onClick={() =>
                  setOfficeHistoryOffset((prev) => prev + OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT)
                }
                className="min-h-[34px] rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1 text-[11px] font-bold text-slate-700 dark:text-zinc-200 disabled:opacity-40"
              >
                {pickText({ ar: 'الأقدم (التالي)', fr: 'Plus anciens', en: 'Older', es: 'Más antiguos', de: 'Älter', pt: 'Mais antigos' }, language)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
