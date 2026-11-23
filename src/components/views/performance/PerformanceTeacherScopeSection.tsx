import React from 'react';
import { BookOpen, CheckCircle2, Users } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import {
  getLocalizedSubjectLabel,
  type resolveTeacherPerformanceScope,
  type resolveVisibleTeacherAllocations,
} from '../../../lib/performance';
import type { useApp } from '../../../context/AppContext';
import type { Language, TeacherAllocatedSubjectItem } from '../../../types';

export interface PerformanceTeacherScopeSectionProps {
  language: Language;
  t: ReturnType<typeof useApp>['t'];
  actorScopeKey: string;
  currentUserId: string;
  isHydratingSchoolData: boolean;
  classesBackendStatus: string;
  classesError: string | null;
  teacherScope: ReturnType<typeof resolveTeacherPerformanceScope>;
  visibleAllocations: ReturnType<typeof resolveVisibleTeacherAllocations>;
  activeSubject: TeacherAllocatedSubjectItem | null;
  showTeacherDetails: boolean;
  retryLabel: string;
  serviceUnavailableLabel: string;
  setSelectedClassId: (classId: string) => void;
  setSelectedStudentId: (studentId: string) => void;
  setSelectedSubjectId: (subjectId: string) => void;
  handleRefresh: () => Promise<void>;
  executeTeacherAllocationsFetch: (
    originActorScopeKey: string,
    originClassId: string,
    originTeacherUserId: string,
  ) => Promise<void>;
}

export const PerformanceTeacherScopeSection: React.FC<PerformanceTeacherScopeSectionProps> = ({
  language,
  t,
  actorScopeKey,
  currentUserId,
  isHydratingSchoolData,
  classesBackendStatus,
  classesError,
  teacherScope,
  visibleAllocations,
  activeSubject,
  showTeacherDetails,
  retryLabel,
  serviceUnavailableLabel,
  setSelectedClassId,
  setSelectedStudentId,
  setSelectedSubjectId,
  handleRefresh,
  executeTeacherAllocationsFetch,
}) => {
  return (
    <section
      data-testid="performance-teacher-scope-card"
      className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-k-brand" />
          <span>
            {pickText(
              {
                ar: 'نطاق التدريس المخوّل (الأقسام، التلاميذ، والمواد المسندة)',
                fr: 'Périmètre enseignant autorisé (classes, élèves et matières attribuées)',
                en: 'Authorized Teaching Scope (Assigned Classes, Class Students & Subjects)',
              },
              language,
            )}
          </span>
        </h2>
      </div>

      {isHydratingSchoolData ? (
        <div
          data-testid="performance-teacher-scope-loading"
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 text-xs text-gray-600 dark:text-gray-400"
        >
          {t('loading')}
        </div>
      ) : classesBackendStatus === 'ERROR' ? (
        <div
          data-testid="performance-teacher-scope-error"
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3"
        >
          <span>{classesError || t('error')}</span>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 font-extrabold underline"
          >
            {retryLabel}
          </button>
        </div>
      ) : classesBackendStatus === 'UNAUTHORIZED' ? (
        <div
          data-testid="performance-teacher-scope-unauthorized"
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300"
        >
          {t('unauthorized')}
        </div>
      ) : classesBackendStatus === 'BLOCKED_BACKEND' ? (
        <div
          data-testid="performance-teacher-scope-blocked"
          className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs font-semibold text-amber-800 dark:text-amber-300"
        >
          {serviceUnavailableLabel}
        </div>
      ) : teacherScope.authorizedClasses.length === 0 ? (
        <div
          data-testid="performance-teacher-no-classes"
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 text-xs text-gray-600 dark:text-gray-400"
        >
          {pickText(
            {
              ar: 'لا توجد أقسام مسندة لحسابك حالياً. عند إسناد قسم لك ستظهر قائمة التلاميذ والمواد المسندة هنا.',
              fr: 'Aucune classe assignée à votre compte pour le moment. Vos classes, élèves et matières attribuées apparaîtront ici après affectation.',
              en: 'No classes are currently assigned to your teacher account. Assigned classes, class students, and subject allocations will appear once assigned.',
            },
            language,
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="performance-class-select"
              className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
            >
              {t('classLabel')}
            </label>
            <select
              id="performance-class-select"
              data-testid="performance-class-select"
              value={teacherScope.activeClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
            >
              {teacherScope.authorizedClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.level} • {cls.academicYear})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="performance-student-select"
              className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
            >
              {t('studentName')}
            </label>
            {teacherScope.authorizedStudents.length === 0 ? (
              <div
                data-testid="performance-roster-empty"
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-500"
              >
                {pickText(
                  {
                    ar: 'لا يوجد تلاميذ مسجلون في هذا القسم.',
                    fr: 'Aucun élève inscrit dans cette classe.',
                    en: 'No enrolled students in this class.',
                  },
                  language,
                )}
              </div>
            ) : (
              <select
                id="performance-student-select"
                data-testid="performance-student-select"
                value={teacherScope.activeStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
              >
                {teacherScope.authorizedStudents.map((stu) => (
                  <option key={stu.studentId} value={stu.studentId}>
                    {stu.fullName} ({stu.studentCode})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="performance-subject-select"
              className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
            >
              {pickText(
                { ar: 'المادة المسندة', fr: 'Matière attribuée', en: 'Allocated Subject' },
                language,
              )}
            </label>

            {visibleAllocations.status === 'LOADING' ? (
              <div
                data-testid="performance-subjects-loading"
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-500"
              >
                {t('loading')}
              </div>
            ) : visibleAllocations.status === 'UNAUTHORIZED' ? (
              <div
                data-testid="performance-subjects-unauthorized"
                className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300"
              >
                {t('unauthorized')}
              </div>
            ) : visibleAllocations.status === 'ERROR' ? (
              <div
                data-testid="performance-subjects-error"
                className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3.5 py-2 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2"
              >
                <span className="truncate">{visibleAllocations.errorMessage || t('error')}</span>
                <button
                  type="button"
                  data-testid="performance-subjects-retry-btn"
                  onClick={() =>
                    void executeTeacherAllocationsFetch(
                      actorScopeKey,
                      teacherScope.activeClassId,
                      currentUserId,
                    )
                  }
                  className="shrink-0 font-extrabold underline"
                >
                  {retryLabel}
                </button>
              </div>
            ) : visibleAllocations.status === 'BLOCKED_BACKEND' ? (
              <div
                data-testid="performance-subjects-blocked"
                className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300"
              >
                {serviceUnavailableLabel}
              </div>
            ) : visibleAllocations.items.length === 0 ? (
              <div
                data-testid="performance-subjects-empty"
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-500"
              >
                {pickText(
                  {
                    ar: 'لا توجد مواد مسندة لك في هذا القسم.',
                    fr: 'Aucune matière attribuée dans cette classe.',
                    en: 'No subjects allocated to you in this class.',
                  },
                  language,
                )}
              </div>
            ) : (
              <select
                id="performance-subject-select"
                data-testid="performance-subject-select"
                value={activeSubject?.subjectId ?? ''}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
              >
                {visibleAllocations.items.map((sub) => (
                  <option key={sub.subjectId} value={sub.subjectId}>
                    {getLocalizedSubjectLabel(sub, language)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {showTeacherDetails && teacherScope.activeClass && (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3 text-xs">
          <span
            data-testid="performance-active-scope-badge"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-gray-900 px-3 py-1.5 font-semibold text-gray-800 dark:text-gray-200"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-k-brand" />
            <span>
              {teacherScope.activeClass.name}
              {teacherScope.activeStudent ? ` — ${teacherScope.activeStudent.fullName}` : ''}
            </span>
          </span>

          {activeSubject && (
            <span
              data-testid="performance-active-subject-badge"
              className="inline-flex items-center gap-1.5 rounded-xl bg-k-brand/10 px-3 py-1.5 font-bold text-k-brand"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{getLocalizedSubjectLabel(activeSubject, language)}</span>
            </span>
          )}

          {activeSubject && activeSubject.components.length > 0 && (
            <div
              data-testid="performance-subject-components"
              className="flex flex-wrap items-center gap-1.5"
            >
              {activeSubject.components.map((comp) => (
                <span
                  key={comp.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300"
                >
                  {getLocalizedSubjectLabel(comp, language)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
