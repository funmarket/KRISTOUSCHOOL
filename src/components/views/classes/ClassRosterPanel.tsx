import React from 'react';
import type { ClassStudentRosterItem, Language, SchoolClassSummary, User } from '../../../types';
import { canAccessAppTab } from '../../homepages/homepageAccess';
import { StudentOverviewPanel } from '../Shared/StudentOverviewPanel';
import { resolveStudentOverviewSelection } from '../../../lib/classes/studentOverview';
import { HomePageHeader } from '../../homepages/shared/HomePageHeader';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../../../i18n/homepages';
import { AlertCircle, ArrowLeft, ClipboardCheck, MessageSquare, Search } from 'lucide-react';
import type { ClassesBackendStatus } from '../ClassesManagementView';

interface ClassRosterPanelProps {
  currentUser: User | null;
  language: Language;
  selectedClass: SchoolClassSummary;
  selectedClassId: string | null;
  selectedStudentId: string | null;
  selectionActorId: string | null;
  scopedInitialClasses: SchoolClassSummary[];
  initialRosters: Record<string, ClassStudentRosterItem[]>;
  backendStatus: ClassesBackendStatus;
  errorMessage: string | null;
  isTeacherView: boolean;
  rawRoster: ClassStudentRosterItem[];
  filteredRoster: ClassStudentRosterItem[];
  paginatedRoster: ClassStudentRosterItem[];
  studentSearchQuery: string;
  safeRosterPage: number;
  totalRosterPages: number;
  rosterContainerRef: React.RefObject<HTMLDivElement | null>;
  lastClickedStudentIdRef: React.MutableRefObject<string | null>;
  setSelectedClassId: (id: string | null) => void;
  setSharedSelectedClassId?: (id: string) => void;
  setSelectedStudentId: (id: string | null) => void;
  setSelectionActorId: (id: string | null) => void;
  setStudentSearchQuery: (q: string) => void;
  setRosterPage: React.Dispatch<React.SetStateAction<number>>;
  onRefresh?: () => Promise<boolean | void> | void;
  onOpenClassCommunity?: (classId: string) => void;
  onOpenAttendance?: (classId: string) => void;
  onOpenStudentDetail?: (studentId: string) => void;
}

export const ClassRosterPanel: React.FC<ClassRosterPanelProps> = ({
  currentUser, language, selectedClass, selectedClassId, selectedStudentId, selectionActorId,
  scopedInitialClasses, initialRosters, backendStatus, errorMessage, isTeacherView,
  rawRoster, filteredRoster, paginatedRoster, studentSearchQuery, safeRosterPage, totalRosterPages,
  rosterContainerRef, lastClickedStudentIdRef, setSelectedClassId, setSharedSelectedClassId,
  setSelectedStudentId, setSelectionActorId, setStudentSearchQuery, setRosterPage,
  onRefresh, onOpenClassCommunity, onOpenAttendance, onOpenStudentDetail,
}) => {
  const selectionAuth = resolveStudentOverviewSelection({
    currentUser,
    selectedClassId,
    selectedStudentId,
    selectionActorId,
    classes: scopedInitialClasses,
    rosters: initialRosters,
    backendStatus,
  });

  if (selectionAuth.allowed && selectionAuth.schoolClass && selectionAuth.student) {
    return (
      <div className="kh-role-page space-y-6 pb-12" data-testid="student-overview-view">
        <StudentOverviewPanel
          student={selectionAuth.student}
          schoolClass={selectionAuth.schoolClass}
          onBack={() => {
            setSelectedStudentId(null);
            setSelectionActorId(null);
          }}
          language={language}
        />
      </div>
    );
  }

  const isZeroStudentsEnrolled = rawRoster.length === 0;
  return (
    <div ref={rosterContainerRef} className="kh-role-page space-y-6 pb-12" data-testid="class-detail-roster-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="back-to-classes-btn"
            onClick={() => {
              setSelectedClassId(null);
              setSelectedStudentId(null);
              setSelectionActorId(null);
              setStudentSearchQuery('');
              setRosterPage(1);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] px-4 py-2.5 text-xs font-extrabold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>
              {pickText(
                isTeacherView
                  ? { ar: 'العودة إلى أقسامي', fr: 'Retour à mes classes', en: 'Back to My Classes' }
                  : { ar: 'العودة إلى قائمة الأقسام', fr: 'Retour aux classes', en: 'Back to Classes' },
                language,
              )}
            </span>
          </button>

          {onOpenClassCommunity && (
            <button
              type="button"
              data-testid={`open-class-community-from-roster-${selectedClass.id}`}
              onClick={() => {
                setSharedSelectedClassId?.(selectedClass.id);
                onOpenClassCommunity(selectedClass.id);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 text-xs font-extrabold text-[#1E3A6D] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>
                {pickText({ ar: 'فتح فضاء القسم', fr: 'Ouvrir l’espace classe', en: 'Open Class Community' }, language)}
              </span>
            </button>
          )}
          {isTeacherView && onOpenAttendance && (
            <button
              type="button"
              data-testid={`take-attendance-from-roster-${selectedClass.id}`}
              onClick={() => {
                setSharedSelectedClassId?.(selectedClass.id);
                onOpenAttendance(selectedClass.id);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>
                {pickText({ ar: 'تسجيل الحضور والغياب', fr: 'Faire l’appel', en: 'Take Attendance' }, language)}
              </span>
            </button>
          )}
        </div>

        <span className="kh-info-chip">
          {selectedClass.academicYear} • {selectedClass.level}
        </span>
      </div>

      <div id="roster-heading" tabIndex={-1} className="outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl">
        <HomePageHeader
          badgeText={pickText(
            isTeacherView
              ? { ar: 'أقسامي', fr: 'Mes classes', en: 'My Classes' }
              : HOMEPAGE_COMMON_TEXT.classesNav,
            language,
          )}
          title={selectedClass.name}
          subtitle={pickText(
            {
              ar: `المربي الرئيسي: ${selectedClass.homeroomTeacherName || 'غير معين'} • عدد التلاميذ المسجلين: ${selectedClass.activeStudentCount}`,
              fr: `Enseignant principal : ${selectedClass.homeroomTeacherName || 'Non assigné'} • Élèves inscrits : ${selectedClass.activeStudentCount}`,
              en: `Homeroom Teacher: ${selectedClass.homeroomTeacherName || 'Unassigned'} • Enrolled Students: ${selectedClass.activeStudentCount}`,
            },
            language,
          )}
        />
      </div>

      {backendStatus === 'ERROR' && (
        <div
          data-testid="classes-error-state"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {errorMessage ||
                pickText(
                  {
                    ar: 'تعذر تحديث قائمة التلاميذ من الخادم.',
                    fr: 'Impossible de rafraîchir la liste des élèves depuis le serveur.',
                    en: 'Failed to refresh student roster from the server.',
                  },
                  language,
                )}
            </span>
          </div>
          {onRefresh && (
            <button
              type="button"
              data-testid="classes-retry-btn"
              onClick={() => void onRefresh()}
              className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
            >
              {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
            </button>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-[#111111] p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-3" />
          <input
            type="search"
            data-testid="roster-student-search"
            value={studentSearchQuery}
            onChange={(e) => {
              setStudentSearchQuery(e.target.value);
              setRosterPage(1);
            }}
            placeholder={pickText(
              {
                ar: 'البحث عن تلميذ بالاسم أو المعرف المدرسي أو الولي...',
                fr: 'Rechercher un élève par nom, code élève ou parent...',
                en: 'Search student by full name, student code, or guardian...',
              },
              language,
            )}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 ps-10 pe-4 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="text-xs font-bold text-slate-600 dark:text-zinc-300 px-2">
          {pickText(
            {
              ar: `النتائج: ${filteredRoster.length}`,
              fr: `Élèves affichés : ${filteredRoster.length}`,
              en: `Showing: ${filteredRoster.length} students`,
            },
            language,
          )}
        </div>
      </div>

      {paginatedRoster.length === 0 ? (
        <div data-testid="roster-empty-state">
          <EmptyFeatureState
            state="AVAILABLE_READ_ONLY"
            title={pickText(
              isZeroStudentsEnrolled
                ? {
                    ar: 'لا يوجد تلاميذ مسجلون في هذا القسم حالياً',
                    fr: 'Aucun élève inscrit dans cette classe',
                    en: 'No students enrolled in this class',
                  }
                : {
                    ar: 'لا يوجد تلاميذ مطابقون للبحث',
                    fr: 'Aucun élève ne correspond à la recherche',
                    en: 'No matching students found',
                  },
              language,
            )}
            description={pickText(
              isZeroStudentsEnrolled
                ? {
                    ar: 'لم يتم تسجيل أي تلميذ في هذا القسم حتى الآن. ستظهر القائمة بمجرد تأكيد التسجيل من الإدارة.',
                    fr: 'Aucun élève n’est encore inscrit dans cette classe. La liste apparaîtra dès la validation par la direction.',
                    en: 'No student enrollments are linked to this class yet. Verified students will appear here once enrolled.',
                  }
                : {
                    ar: 'جرّب تعديل كلمات البحث لعرض التلاميذ المسجلين في هذا القسم.',
                    fr: 'Modifiez votre recherche pour afficher les élèves inscrits dans cette classe.',
                    en: 'Try adjusting your search query to view enrolled students in this class.',
                  },
              language,
            )}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111111] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-900/80 border-b border-gray-200 dark:border-gray-800 text-slate-600 dark:text-zinc-400 uppercase font-extrabold">
                <tr>
                  <th className="py-3.5 px-4 text-start">
                    {pickText({ ar: 'المعرف', fr: 'Code élève', en: 'Student Code' }, language)}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {pickText({ ar: 'اسم التلميذ', fr: 'Nom complet', en: 'Student Name' }, language)}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {pickText({ ar: 'الولي الرئيسي', fr: 'Parent / Tuteur', en: 'Primary Guardian' }, language)}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {pickText({ ar: 'تاريخ التسجيل', fr: 'Date d’inscription', en: 'Enrolled Date' }, language)}
                  </th>
                  <th className="py-3.5 px-4 text-start">
                    {pickText({ ar: 'الحالة', fr: 'Statut', en: 'Status' }, language)}
                  </th>
                  {isTeacherView && (
                    <th className="py-3.5 px-4 text-end">
                      {pickText({ ar: 'إجراءات', fr: 'Actions', en: 'Actions' }, language)}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {paginatedRoster.map((student) => (
                  <tr
                    key={student.studentId}
                    data-testid={`roster-student-row-${student.studentId}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-600 dark:text-zinc-400">
                      {student.studentCode}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-gray-900 dark:text-white">
                      {student.fullName}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {student.primaryGuardianName || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{student.enrolledAt}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-xl text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {student.enrollmentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-end">
                      <button
                        type="button"
                        data-testid={`view-student-${student.studentId}`}
                        onClick={() => {
                          lastClickedStudentIdRef.current = student.studentId;
                          if (onOpenStudentDetail && !isTeacherView && canAccessAppTab(currentUser, 'students')) {
                            onOpenStudentDetail(student.studentId);
                          } else {
                            setSelectedStudentId(student.studentId);
                            setSelectionActorId(currentUser?.id ?? null);
                          }
                        }}
                        aria-label={pickText(
                          {
                            ar: `عرض ملف التلميذ ${student.fullName}`,
                            fr: `Afficher le profil de l’élève ${student.fullName}`,
                            en: `View student profile for ${student.fullName}`,
                          },
                          language,
                        )}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/70 text-[#1E3A6D] dark:text-blue-300 font-extrabold text-[11px] transition-colors"
                      >
                        <span>{pickText({ ar: 'عرض', fr: 'Voir', en: 'View' }, language)}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalRosterPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
              <button
                type="button"
                data-testid="roster-prev-page-btn"
                disabled={safeRosterPage <= 1}
                onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 font-bold disabled:opacity-40"
              >
                {pickText({ ar: 'السابق', fr: 'Précédent', en: 'Previous' }, language)}
              </button>
              <span data-testid="roster-page-indicator" className="font-bold text-gray-600 dark:text-gray-400">
                {safeRosterPage} / {totalRosterPages}
              </span>
              <button
                type="button"
                data-testid="roster-next-page-btn"
                disabled={safeRosterPage >= totalRosterPages}
                onClick={() => setRosterPage((p) => Math.min(totalRosterPages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 font-bold disabled:opacity-40"
              >
                {pickText({ ar: 'التالي', fr: 'Suivant', en: 'Next' }, language)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
