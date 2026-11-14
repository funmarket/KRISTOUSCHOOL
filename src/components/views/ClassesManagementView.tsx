import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClassStudentRosterItem, SchoolClassSummary } from '../../types';
import { canAccessAppTab, canManageClassesUi } from '../homepages/homepageAccess';
import { HomePageHeader } from '../homepages/shared/HomePageHeader';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import {
  CANONICAL_SCHOOL_LEVELS,
  assignTeacherToClass,
  createAndEnrollStudent,
  createSchoolClass,
} from '../../lib/schoolOperations';
import {
  ArrowLeft,
  Search,
  Users,
  GraduationCap,
  Calendar,
  Plus,
  UserPlus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import '../homepages/shared/HomePageLayout.css';

export type ClassesBackendStatus =
  | 'LOADING'
  | 'BACKEND_NOT_IMPLEMENTED'
  | 'READY'
  | 'ERROR';

export interface ClassesManagementViewProps {
  initialClasses?: SchoolClassSummary[];
  initialRosters?: Record<string, ClassStudentRosterItem[]>;
  backendStatus?: ClassesBackendStatus;
  onRefresh?: () => Promise<void> | void;
}

const ROSTER_PAGE_SIZE = 25;

export function filterSchoolClasses(
  classes: readonly SchoolClassSummary[],
  query: string,
  levelFilter: string,
  yearFilter: string,
): SchoolClassSummary[] {
  const q = query.trim().toLowerCase();
  return classes.filter((cls) => {
    if (levelFilter !== 'ALL' && cls.level !== levelFilter && cls.levelCode !== levelFilter) return false;
    if (yearFilter !== 'ALL' && cls.academicYear !== yearFilter) return false;
    if (!q) return true;
    return (
      cls.name.toLowerCase().includes(q) ||
      cls.level.toLowerCase().includes(q) ||
      (cls.homeroomTeacherName?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function filterClassRoster(
  students: readonly ClassStudentRosterItem[],
  query: string,
): ClassStudentRosterItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...students];
  return students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      (s.primaryGuardianName?.toLowerCase().includes(q) ?? false),
  );
}

export const ClassesManagementView: React.FC<ClassesManagementViewProps> = ({
  initialClasses = [],
  initialRosters = {},
  backendStatus = 'BACKEND_NOT_IMPLEMENTED',
  onRefresh,
}) => {
  const { currentUser, language, t } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [rosterPage, setRosterPage] = useState(1);

  const [activeForm, setActiveForm] = useState<'none' | 'create-class' | 'enroll-student' | 'assign-teacher'>('none');
  const [opFeedback, setOpFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create class state
  const [academicYearCode, setAcademicYearCode] = useState('2026-2027');
  const [levelCode, setLevelCode] = useState('CP');
  const [className, setClassName] = useState('');
  const [capacity, setCapacity] = useState(28);
  const [roomLabel, setRoomLabel] = useState('');

  // Enroll student state
  const [studentCode, setStudentCode] = useState('');
  const [studentFullName, setStudentFullName] = useState('');
  const [studentBirthDate, setStudentBirthDate] = useState('');
  const [enrollClassId, setEnrollClassId] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('Parent');

  // Assign teacher state
  const [teacherUserId, setTeacherUserId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [isHomeroom, setIsHomeroom] = useState(true);

  const isAuthorized = canAccessAppTab(currentUser, 'classes');
  const canManage = canManageClassesUi(currentUser);

  const levelOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { value: string; label: string }[] = [];
    for (const lbl of [t('level1'), t('level2'), t('level3'), t('level4'), t('level5'), t('level6')]) {
      if (lbl && !seen.has(lbl)) {
        seen.add(lbl);
        list.push({ value: lbl, label: lbl });
      }
    }
    for (const lvl of CANONICAL_SCHOOL_LEVELS) {
      if (!seen.has(lvl.code)) {
        seen.add(lvl.code);
        list.push({
          value: lvl.code,
          label: language === 'ar' ? lvl.labelAr : language === 'fr' ? lvl.labelFr : lvl.labelEn,
        });
      }
    }
    for (const cls of initialClasses) {
      if (cls.level && !seen.has(cls.level)) {
        seen.add(cls.level);
        list.push({ value: cls.level, label: cls.level });
      }
    }
    return list;
  }, [initialClasses, language, t]);

  const yearOptions = useMemo(() => {
    const seen = new Set<string>(['2025-2026', '2026-2027']);
    for (const cls of initialClasses) {
      if (cls.academicYear) seen.add(cls.academicYear);
    }
    return Array.from(seen);
  }, [initialClasses]);

  const filteredClasses = useMemo(
    () => filterSchoolClasses(initialClasses, searchQuery, selectedLevel, selectedYear),
    [initialClasses, searchQuery, selectedLevel, selectedYear],
  );

  const selectedClass = useMemo(
    () => initialClasses.find((cls) => cls.id === selectedClassId) ?? null,
    [initialClasses, selectedClassId],
  );

  const rawRoster = useMemo(
    () => (selectedClassId ? initialRosters[selectedClassId] ?? [] : []),
    [initialRosters, selectedClassId],
  );

  const filteredRoster = useMemo(
    () => filterClassRoster(rawRoster, studentSearchQuery),
    [rawRoster, studentSearchQuery],
  );

  const totalRosterPages = Math.max(1, Math.ceil(filteredRoster.length / ROSTER_PAGE_SIZE));
  const paginatedRoster = useMemo(() => {
    const start = (rosterPage - 1) * ROSTER_PAGE_SIZE;
    return filteredRoster.slice(start, start + ROSTER_PAGE_SIZE);
  }, [filteredRoster, rosterPage]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpFeedback(null);
    setSubmitting(true);
    const res = await createSchoolClass({
      academicYearCode,
      levelCode,
      name: className,
      capacity,
      roomLabel,
    });
    setSubmitting(false);
    if (!res.ok) {
      setOpFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
      return;
    }
    setClassName('');
    setRoomLabel('');
    setActiveForm('none');
    setOpFeedback({
      type: 'success',
      text: pickText(
        { ar: 'تم إنشاء القسم بنجاح.', fr: 'Classe créée avec succès.', en: 'Class created on server.' },
        language,
      ),
    });
    await onRefresh?.();
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpFeedback(null);
    setSubmitting(true);
    const targetClassId = enrollClassId || initialClasses[0]?.id || '';
    const res = await createAndEnrollStudent({
      studentCode,
      fullName: studentFullName,
      birthDate: studentBirthDate,
      classId: targetClassId,
      relationshipLabel,
    });
    setSubmitting(false);
    if (!res.ok) {
      setOpFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
      return;
    }
    setStudentCode('');
    setStudentFullName('');
    setStudentBirthDate('');
    setActiveForm('none');
    setOpFeedback({
      type: 'success',
      text: pickText(
        { ar: 'تم تسجيل التلميذ في القسم بنجاح.', fr: 'Élève inscrit dans la classe.', en: 'Student created and enrolled.' },
        language,
      ),
    });
    await onRefresh?.();
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpFeedback(null);
    setSubmitting(true);
    const targetClassId = assignClassId || initialClasses[0]?.id || '';
    const res = await assignTeacherToClass({
      teacherUserId: teacherUserId.trim(),
      classId: targetClassId,
      isHomeroom,
      active: true,
    });
    setSubmitting(false);
    if (!res.ok) {
      setOpFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
      return;
    }
    setTeacherUserId('');
    setActiveForm('none');
    setOpFeedback({
      type: 'success',
      text: pickText(
        { ar: 'تم تعيين المربي للقسم بنجاح.', fr: 'Enseignant affecté à la classe.', en: 'Teacher assigned to class.' },
        language,
      ),
    });
    await onRefresh?.();
  };

  if (!isAuthorized) {
    return (
      <div className="kh-role-page" data-testid="classes-view-unauthorized">
        <EmptyFeatureState
          state="UNAUTHORIZED"
          title={pickText(
            {
              ar: 'غير مصرح بالدخول إلى إدارة الأقسام والتلاميذ',
              fr: 'Accès non autorisé aux Classes & Listes d’élèves',
              en: 'Unauthorized Access to Classes & Student Rosters',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'هذه الوحدة مخصصة حصرياً لمالك المدرسة (APP_ADMIN) أو المدير المفوض بصلاحية CLASSES_ROSTER_VIEW.',
              fr: 'Cette vue est strictement réservée au Fondateur (APP_ADMIN) ou aux rôles disposant de l’habilitation serveur CLASSES_ROSTER_VIEW.',
              en: 'This view is restricted to the School Owner (APP_ADMIN) or staff explicitly granted the server-verified CLASSES_ROSTER_VIEW capability.',
            },
            language,
          )}
        />
      </div>
    );
  }

  // Screen 2: Class Detail -> Student Roster View
  if (selectedClass) {
    return (
      <div className="kh-role-page space-y-6 pb-12" data-testid="class-detail-roster-view">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            data-testid="back-to-classes-btn"
            onClick={() => {
              setSelectedClassId(null);
              setStudentSearchQuery('');
              setRosterPage(1);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] px-4 py-2.5 text-xs font-extrabold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>
              {pickText(
                {
                  ar: 'العودة إلى قائمة الأقسام',
                  fr: 'Retour aux classes',
                  en: 'Back to Classes',
                },
                language,
              )}
            </span>
          </button>

          <span className="kh-info-chip">
            {selectedClass.academicYear} • {selectedClass.level}
          </span>
        </div>

        <HomePageHeader
          badgeText={pickText(HOMEPAGE_COMMON_TEXT.classesNav, language)}
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

        {/* Roster Search Bar */}
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
                  ar: 'البحث عن تلميذ بالاسم أو المعرف المدرسي...',
                  fr: 'Rechercher un élève par nom ou code élève...',
                  en: 'Search student by full name or student code...',
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

        {/* Student Roster Table / Empty State */}
        {paginatedRoster.length === 0 ? (
          <EmptyFeatureState
            state="AVAILABLE_READ_ONLY"
            title={pickText(
              {
                ar: 'لا يوجد تلاميذ مسجلون في هذا القسم حالياً',
                fr: 'Aucun élève inscrit dans cette classe',
                en: 'No students enrolled in this class',
              },
              language,
            )}
            description={pickText(
              {
                ar: 'تظهر هنا قائمة التلاميذ الفعليين المسجلين في هذا القسم من جدول التسجيلات المدرسية دون أي بيانات تجريبية.',
                fr: 'La liste nominative affiche uniquement les élèves réellement inscrits dans cette classe via la base de données.',
                en: 'Only verified student enrollments for this class are displayed here. No mock children are ever substituted.',
              },
              language,
            )}
          />
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
                      <td className="py-3 px-4 text-gray-500">
                        {student.enrolledAt}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-xl text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {student.enrollmentStatus}
                        </span>
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
                  disabled={rosterPage <= 1}
                  onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 font-bold disabled:opacity-40"
                >
                  {pickText({ ar: 'السابق', fr: 'Précédent', en: 'Previous' }, language)}
                </button>
                <span className="font-bold text-gray-600 dark:text-gray-400">
                  {rosterPage} / {totalRosterPages}
                </span>
                <button
                  type="button"
                  disabled={rosterPage >= totalRosterPages}
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
  }

  // Screen 1: Classes List View
  return (
    <div className="kh-role-page space-y-6 pb-12" data-testid="classes-management-view">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_COMMON_TEXT.classesNav, language)}
        title={pickText(
          {
            ar: 'إدارة الأقسام وقوائم التلاميذ',
            fr: 'Gestion des Classes & Listes d’Élèves',
            en: 'School Classes & Student Rosters',
          },
          language,
        )}
        subtitle={pickText(
          {
            ar: 'استعرض جميع الأقسام الدراسية لمدرسة كريستو وافتح كل قسم لمعاينة قائمة التلاميذ المسجلين فيه.',
            fr: 'Consultez les classes de l’école KRISTOU et ouvrez chaque classe pour afficher la liste nominative des élèves inscrits.',
            en: 'Browse KRISTOU School classes by level and academic year, and open any class to inspect its enrolled student roster.',
          },
          language,
        )}
      >
        {canManage && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              data-testid="toggle-create-class-btn"
              onClick={() => setActiveForm((prev) => (prev === 'create-class' ? 'none' : 'create-class'))}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'إنشاء قسم', fr: 'Créer une classe', en: 'Create Class' }, language)}</span>
            </button>
            <button
              type="button"
              data-testid="toggle-enroll-student-btn"
              onClick={() => {
                if (!enrollClassId && initialClasses[0]) setEnrollClassId(initialClasses[0].id);
                setActiveForm((prev) => (prev === 'enroll-student' ? 'none' : 'enroll-student'));
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'تسجيل تلميذ', fr: 'Inscrire un élève', en: 'Enroll Student' }, language)}</span>
            </button>
            <button
              type="button"
              data-testid="toggle-assign-teacher-btn"
              onClick={() => {
                if (!assignClassId && initialClasses[0]) setAssignClassId(initialClasses[0].id);
                setActiveForm((prev) => (prev === 'assign-teacher' ? 'none' : 'assign-teacher'));
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 text-xs font-bold shadow-xs"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'تعيين مربي', fr: 'Affecter enseignant', en: 'Assign Teacher' }, language)}</span>
            </button>
          </div>
        )}
      </HomePageHeader>

      {opFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            opFeedback.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}
        >
          {opFeedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{opFeedback.text}</span>
        </div>
      )}

      {/* Admin Create / Enroll / Assign Forms */}
      {canManage && activeForm === 'create-class' && (
        <form
          onSubmit={handleCreateClass}
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
        >
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'قسم دراسي جديد', fr: 'Nouvelle classe scolaire', en: 'New School Class' }, language)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              required
              value={academicYearCode}
              onChange={(e) => setAcademicYearCode(e.target.value)}
              placeholder="2026-2027"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <select
              value={levelCode}
              onChange={(e) => setLevelCode(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {CANONICAL_SCHOOL_LEVELS.map((lvl) => (
                <option key={lvl.code} value={lvl.code}>
                  {language === 'ar' ? lvl.labelAr : language === 'fr' ? lvl.labelFr : lvl.labelEn}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder={pickText({ ar: 'اسم القسم (مثال: 1 أ)', fr: 'Nom (ex: 1ère A)', en: 'Class name (e.g. 1A)' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="number"
              min={1}
              max={60}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value) || 28)}
              placeholder="28"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="text"
              value={roomLabel}
              onChange={(e) => setRoomLabel(e.target.value)}
              placeholder={pickText({ ar: 'القاعة', fr: 'Salle', en: 'Room' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveForm('none')}
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

      {canManage && activeForm === 'enroll-student' && (
        <form
          onSubmit={handleEnrollStudent}
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-emerald-200 dark:border-emerald-900 shadow-sm space-y-4"
        >
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'إضافة وتسجيل تلميذ في قسم', fr: 'Créer et inscrire un élève', en: 'Create & Enroll Student' }, language)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              required
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="KS-2026-001"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="text"
              required
              value={studentFullName}
              onChange={(e) => setStudentFullName(e.target.value)}
              placeholder={pickText({ ar: 'الاسم الكامل للتلميذ', fr: 'Nom complet', en: 'Full name' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="date"
              required
              value={studentBirthDate}
              onChange={(e) => setStudentBirthDate(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <select
              required
              value={enrollClassId}
              onChange={(e) => setEnrollClassId(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {initialClasses.length === 0 ? (
                <option value="">—</option>
              ) : (
                initialClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear})
                  </option>
                ))
              )}
            </select>
            <input
              type="text"
              value={relationshipLabel}
              onChange={(e) => setRelationshipLabel(e.target.value)}
              placeholder="Parent"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveForm('none')}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || initialClasses.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {canManage && activeForm === 'assign-teacher' && (
        <form
          onSubmit={handleAssignTeacher}
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4"
        >
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'تعيين مربي للقسم', fr: 'Affecter un enseignant à la classe', en: 'Assign Teacher to Class' }, language)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <input
              type="text"
              required
              value={teacherUserId}
              onChange={(e) => setTeacherUserId(e.target.value)}
              placeholder="Teacher User UUID"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-mono"
            />
            <select
              required
              value={assignClassId}
              onChange={(e) => setAssignClassId(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {initialClasses.length === 0 ? (
                <option value="">—</option>
              ) : (
                initialClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear})
                  </option>
                ))
              )}
            </select>
            <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isHomeroom}
                onChange={(e) => setIsHomeroom(e.target.checked)}
              />
              <span>{pickText({ ar: 'مربي رئيسي', fr: 'Enseignant principal', en: 'Homeroom teacher' }, language)}</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveForm('none')}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || initialClasses.length === 0}
              className="px-4 py-2 rounded-xl bg-[#1E3A6D] hover:bg-[#162C54] text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-[#111111] p-4 sm:p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-3" />
          <input
            type="search"
            data-testid="classes-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={pickText(
              {
                ar: 'بحث باسم القسم أو المربي...',
                fr: 'Rechercher une classe ou un enseignant...',
                en: 'Search by class name or teacher...',
              },
              language,
            )}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 ps-10 pe-4 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            aria-label="Filter by level"
            data-testid="classes-level-filter"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 px-3.5 text-xs font-semibold text-gray-900 dark:text-white"
          >
            <option value="ALL">
              {pickText({ ar: 'جميع المستويات', fr: 'Tous les niveaux', en: 'All Levels' }, language)}
            </option>
            {levelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            aria-label="Filter by academic year"
            data-testid="classes-year-filter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 px-3.5 text-xs font-semibold text-gray-900 dark:text-white"
          >
            <option value="ALL">
              {pickText(
                { ar: 'جميع السنوات الدراسية', fr: 'Toutes les années scolaires', en: 'All Academic Years' },
                language,
              )}
            </option>
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* State 1: Loading */}
      {backendStatus === 'LOADING' && (
        <div
          data-testid="classes-loading-state"
          className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs font-bold text-gray-500"
        >
          {t('loading')}
        </div>
      )}

      {/* State 2: Backend Not Implemented (Honest Default until Supabase tables are deployed) */}
      {backendStatus === 'BACKEND_NOT_IMPLEMENTED' && initialClasses.length === 0 && (
        <div data-testid="classes-backend-pending-state">
          <EmptyFeatureState
            state="BLOCKED_BACKEND"
            title={pickText(
              {
                ar: 'جداول الأقسام وقوائم التلاميذ بانتظار التفعيل في الخادم (Pending Backend)',
                fr: 'Tables des classes et listes d’élèves en attente du contrat serveur (Pending Backend)',
                en: 'Classes & Student Roster Persistence Pending Backend Deployment',
              },
              language,
            )}
            description={pickText(
              {
                ar: 'واجهة إدارة الأقسام جاهزة ومحمية بصلاحيات مالك المدرسة (APP_ADMIN)، ولكن لم يتم بعد نشر جداول school_classes و students و class_enrollments في قاعدة بيانات Supabase. التزاماً بقواعد الأمان، لا يتم عرض أي أقسام أو تلاميذ وهميين (Mock Data).',
                fr: 'L’interface Classes → Élèves est prête et protégée pour APP_ADMIN, mais les tables Supabase school_classes, students et class_enrollments ne sont pas encore déployées. Conformément aux règles de sécurité, aucune classe ni liste d’élèves fictive n’est affichée.',
                en: 'The Owner Classes → Student Roster UI is wired and access-controlled, but the Supabase tables (public.school_classes, public.students, public.class_enrollments) and RLS policies have not been deployed yet. Zero mock classes or mock student records are fabricated.',
              },
              language,
            )}
          />
        </div>
      )}

      {/* State 3: Ready but 0 matching classes */}
      {backendStatus === 'READY' && filteredClasses.length === 0 && (
        <div data-testid="classes-empty-state">
          <EmptyFeatureState
            state="AVAILABLE_READ_ONLY"
            title={pickText(
              {
                ar: 'لا توجد أقسام مطابقة للبحث',
                fr: 'Aucune classe trouvée',
                en: 'No classes found',
              },
              language,
            )}
            description={pickText(
              {
                ar: 'لم يتم العثور على أقسام مسجلة تطابق معايير التصفية الحالية.',
                fr: 'Aucune classe enregistrée ne correspond aux filtres sélectionnés.',
                en: 'No server-verified classes match the current search or filter criteria.',
              },
              language,
            )}
          />
        </div>
      )}

      {/* State 4: Ready with verified class cards */}
      {filteredClasses.length > 0 && (
        <div
          data-testid="classes-card-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredClasses.map((cls) => (
            <article
              key={cls.id}
              data-testid={`class-card-${cls.id}`}
              className="kh-info-panel flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="kh-info-chip">{cls.level}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-zinc-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{cls.academicYear}</span>
                  </span>
                </div>

                <h2 className="kh-info-panel-title text-lg">{cls.name}</h2>

                <div className="space-y-1 text-xs text-slate-600 dark:text-zinc-300">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>
                      {t('teacherLabel')} :{' '}
                      <strong>{cls.homeroomTeacherName || '—'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {pickText(
                        {
                          ar: `التلاميذ المسجلون: ${cls.activeStudentCount}`,
                          fr: `Élèves inscrits : ${cls.activeStudentCount}`,
                          en: `Enrolled students: ${cls.activeStudentCount}`,
                        },
                        language,
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid={`view-class-students-${cls.id}`}
                onClick={() => {
                  setSelectedClassId(cls.id);
                  setStudentSearchQuery('');
                  setRosterPage(1);
                }}
                className="w-full rounded-2xl bg-[#1E3A6D] hover:bg-[#162C54] text-white font-extrabold text-xs py-3 px-4 transition-colors flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>
                  {pickText(
                    {
                      ar: 'عرض قائمة التلاميذ',
                      fr: 'Voir les élèves',
                      en: 'View Students',
                    },
                    language,
                  )}
                </span>
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
