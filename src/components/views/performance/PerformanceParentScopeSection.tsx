import React from 'react';
import { Clock, UserCheck } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import type { resolveParentPerformanceScope } from '../../../lib/performance';
import type { useApp } from '../../../context/AppContext';
import type { Language } from '../../../types';

export interface PerformanceParentScopeSectionProps {
  language: Language;
  t: ReturnType<typeof useApp>['t'];
  isHydratingSchoolData: boolean;
  schoolContextError: string | null;
  parentScope: ReturnType<typeof resolveParentPerformanceScope>;
  retryLabel: string;
  unavailableBadgeLabel: string;
  setSelectedChildId: (childId: string) => void;
  handleRefresh: () => Promise<void>;
}

export const PerformanceParentScopeSection: React.FC<PerformanceParentScopeSectionProps> = ({
  language,
  t,
  isHydratingSchoolData,
  schoolContextError,
  parentScope,
  retryLabel,
  unavailableBadgeLabel,
  setSelectedChildId,
  handleRefresh,
}) => {
  return (
    <section
      data-testid="performance-parent-scope-card"
      className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-k-brand" />
          <span>
            {pickText(
              {
                ar: 'أطفالك المرتبطون بالحساب',
                fr: 'Vos enfants liés au compte',
                en: 'Linked Children',
                es: 'Hijos vinculados',
                de: 'Verknüpfte Kinder',
                pt: 'Crianças associadas',
              },
              language,
            )}
          </span>
        </h2>
      </div>

      {isHydratingSchoolData ? (
        <div
          data-testid="performance-parent-loading"
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 text-xs text-gray-600 dark:text-gray-400"
        >
          {t('loading')}
        </div>
      ) : schoolContextError ? (
        <div
          data-testid="performance-parent-error"
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3"
        >
          <span>{schoolContextError}</span>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 font-extrabold underline"
          >
            {retryLabel}
          </button>
        </div>
      ) : parentScope.linkedChildren.length === 0 ? (
        <div
          data-testid="performance-parent-no-children"
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 text-xs text-gray-600 dark:text-gray-400"
        >
          {t('noLinkedChildren')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="performance-child-select"
              className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
            >
              {t('childConcerned')}
            </label>
            <select
              id="performance-child-select"
              data-testid="performance-child-select"
              value={parentScope.activeChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
            >
              {parentScope.linkedChildren.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.fullName} — {child.className} ({child.level})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {pickText(
                { ar: 'مواد الطفل', fr: 'Matières de l’élève', en: 'Student Subjects', es: 'Asignaturas del alumno', de: 'Schülerfächer', pt: 'Disciplinas do aluno' },
                language,
              )}
            </span>
            <div
              data-testid="performance-parent-subjects-unavailable"
              className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{unavailableBadgeLabel}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
