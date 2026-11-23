import React from 'react';
import type { SchoolStudentIdentityDetail } from '../../../lib/schoolOperations';
import {
  ArrowLeft,
  GraduationCap,
  RotateCw,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

export interface StudentDossierDrawerProps {
  language: string;
  navOrigin: 'students' | 'roster';
  loadingDetail: boolean;
  detailError: string | null;
  studentDetail: SchoolStudentIdentityDetail | null;
  listViewRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onRetryDetail: () => void;
}

export function StudentDossierDrawer({
  language,
  navOrigin,
  loadingDetail,
  detailError,
  studentDetail,
  listViewRef,
  onBack,
  onRetryDetail,
}: StudentDossierDrawerProps) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6 px-4 sm:px-6" ref={listViewRef}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>
            {navOrigin === 'roster'
              ? language === 'ar'
                ? 'العودة إلى القسم'
                : language === 'fr'
                ? 'Retour à la classe'
                : 'Back to Class Roster'
              : language === 'ar'
              ? 'العودة إلى قائمة التلاميذ'
              : language === 'fr'
              ? 'Retour aux élèves'
              : 'Back to Students List'}
          </span>
        </button>
      </div>

      {loadingDetail ? (
        <div className="p-12 text-center bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <RotateCw className="w-8 h-8 animate-spin mx-auto text-k-brand mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {language === 'ar'
              ? 'جاري تحميل ملف التلميذ...'
              : language === 'fr'
              ? 'Chargement du dossier élève...'
              : 'Loading student dossier...'}
          </p>
        </div>
      ) : detailError ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-700 dark:text-red-300 space-y-3">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{detailError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryDetail}
            className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            {language === 'ar' ? 'إعادة المحاولة' : language === 'fr' ? 'Réessayer' : 'Retry'}
          </button>
        </div>
      ) : studentDetail ? (
        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Header info */}
          <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-mono text-gray-500 dark:text-gray-400">
                <span>{studentDetail.studentCode}</span>
                <span>·</span>
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    studentDetail.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  }`}
                >
                  {studentDetail.status}
                </span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                {studentDetail.fullName}
              </h1>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                <span className="text-gray-500 dark:text-gray-400 block">
                  {language === 'ar'
                    ? 'تاريخ الميلاد'
                    : language === 'fr'
                    ? 'Date de naissance'
                    : 'Birth Date'}
                </span>
                <span className="font-bold text-gray-900 dark:text-white font-mono">
                  {studentDetail.birthDate}
                </span>
              </div>
              <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                <span className="text-gray-500 dark:text-gray-400 block">
                  {language === 'ar'
                    ? 'حساب التلميذ المرتبط'
                    : language === 'fr'
                    ? 'Compte élève lié'
                    : 'Linked Student Account'}
                </span>
                <span
                  className={`font-bold ${
                    studentDetail.hasLinkedStudentAccount
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {studentDetail.hasLinkedStudentAccount
                    ? language === 'ar'
                      ? 'مرتبط'
                      : language === 'fr'
                      ? 'Lié'
                      : 'Linked'
                    : language === 'ar'
                    ? 'غير مرتبط'
                    : language === 'fr'
                    ? 'Non lié'
                    : 'Not Linked'}
                </span>
              </div>
            </div>
          </div>

          {/* Memberships & Enrollment History */}
          <div className="p-6 sm:p-8 space-y-6">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-k-brand" />
              <span>
                {language === 'ar'
                  ? 'سجل الأقسام والتسجيل'
                  : language === 'fr'
                  ? 'Historique des classes et inscriptions'
                  : 'Class Membership & Enrollment History'}
              </span>
            </h3>

            {!studentDetail.memberships || studentDetail.memberships.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-4">
                {language === 'ar'
                  ? 'لا توجد تسجيلات مسجلة لهذا التلميذ.'
                  : language === 'fr'
                  ? 'Aucune inscription enregistrée pour cet élève.'
                  : 'No class memberships recorded for this student.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                      <th className="py-3 px-4 font-semibold text-start">
                        {language === 'ar' ? 'السنة الدراسية' : language === 'fr' ? 'Année académique' : 'Academic Year'}
                      </th>
                      <th className="py-3 px-4 font-semibold text-start">
                        {language === 'ar' ? 'القسم' : language === 'fr' ? 'Classe' : 'Class'}
                      </th>
                      <th className="py-3 px-4 font-semibold text-start">
                        {language === 'ar' ? 'المستوى' : language === 'fr' ? 'Niveau' : 'Level'}
                      </th>
                      <th className="py-3 px-4 font-semibold text-start">
                        {language === 'ar' ? 'حالة التسجيل' : language === 'fr' ? 'Statut inscription' : 'Enrollment Status'}
                      </th>
                      <th className="py-3 px-4 font-semibold text-start">
                        {language === 'ar' ? 'الفترة' : language === 'fr' ? 'Période' : 'Period'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {studentDetail.memberships.map((m) => (
                      <tr
                        key={m.membershipId}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-gray-900 dark:text-white">
                          {m.academicYearCode}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{m.className}</span>
                            {m.classArchived && (
                              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">
                                {language === 'ar' ? 'مؤرشف' : language === 'fr' ? 'Archivé' : 'Archived'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-300">
                          {m.levelCode}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              m.enrollmentStatus === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            {m.enrollmentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500 dark:text-gray-400 text-[11px]">
                          {m.startedAt} {m.endedAt ? `→ ${m.endedAt}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Academic Performance & Progress Summary (Honest Empty State) */}
            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-k-brand" />
                <span>
                  {language === 'ar'
                    ? 'ملخص الأداء الأكاديمي والنتائج'
                    : language === 'fr'
                    ? 'Résumé des performances et résultats'
                    : 'Academic Performance & Results Summary'}
                </span>
              </h3>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                {language === 'ar'
                  ? 'النتائج الدراسية غير متاحة حاليًا. ستظهر الأعداد وتطور مستوى التلميذ هنا بعد تفعيل نظام التقييم المدرسي والتحقق منه.'
                  : language === 'fr'
                  ? 'Les résultats scolaires ne sont pas encore disponibles. Les notes et la progression apparaîtront ici après la mise en place et la vérification du système d’évaluation.'
                  : "Academic performance records are not available yet. Grades and progress will appear here when the school's assessment system is configured and verified."}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
