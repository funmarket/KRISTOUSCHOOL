import React, { useEffect, useRef } from 'react';
import { ArrowLeft, User, Calendar, BookOpen, MapPin, ShieldCheck } from 'lucide-react';
import { ClassStudentRosterItem, SchoolClassSummary, Language } from '../../../types.ts';
import { pickText } from '../../../i18n/homepages';
import { formatSafeEnrollmentDate } from '../../../lib/classes/studentOverview.ts';
import { StudentAttendanceHistoryPanel } from '../attendance/StudentAttendanceHistoryPanel';

export interface StudentOverviewPanelProps {
  student: ClassStudentRosterItem;
  schoolClass: SchoolClassSummary;
  onBack: () => void;
  language?: Language;
}

export const StudentOverviewPanel: React.FC<StudentOverviewPanelProps> = ({
  student,
  schoolClass,
  onBack,
  language = 'en',
}) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const formatStatus = (status: ClassStudentRosterItem['enrollmentStatus']) => {
    switch (status) {
      case 'ACTIVE':
        return pickText({ ar: 'نشط', fr: 'Actif', en: 'Active' }, language);
      case 'TRANSFERRED':
        return pickText({ ar: 'منقول', fr: 'Transféré', en: 'Transferred' }, language);
      case 'WITHDRAWN':
        return pickText({ ar: 'منسحب', fr: 'Retiré', en: 'Withdrawn' }, language);
      case 'COMPLETED':
        return pickText({ ar: 'مكمل', fr: 'Terminé', en: 'Completed' }, language);
      default:
        return status;
    }
  };

  const safeEnrolledDate = formatSafeEnrollmentDate(student.enrolledAt, language);

  return (
    <div className="space-y-6 pb-12" data-testid="student-overview-panel">
      <div className="flex items-center justify-between">
        <button
          type="button"
          data-testid="back-to-roster-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] px-4 py-2.5 text-xs font-extrabold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {pickText(
              {
                ar: 'العودة إلى قائمة التلاميذ',
                fr: 'Retour à la liste des élèves',
                en: 'Back to student list',
              },
              language,
            )}
          </span>
        </button>

        <span className="kh-info-chip">
          {schoolClass.name} • {schoolClass.academicYear}
        </span>
      </div>

      <div className="bg-white dark:bg-[#111111] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold text-lg shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-extrabold text-gray-900 dark:text-white outline-none"
              data-testid="student-overview-name"
            >
              {student.fullName}
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 font-mono" data-testid="student-overview-code">
              {pickText({ ar: 'المعرف المدرسي:', fr: 'Code élève :', en: 'Student Code:' }, language)} {student.studentCode}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/80 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-zinc-500">
              {pickText({ ar: 'حالة التسجيل', fr: 'Statut d’inscription', en: 'Enrollment Status' }, language)}
            </span>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-gray-900 dark:text-white" data-testid="student-overview-status">
                {formatStatus(student.enrollmentStatus)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/80 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-zinc-500">
              {pickText({ ar: 'تاريخ التسجيل', fr: 'Date d’inscription', en: 'Enrollment Date' }, language)}
            </span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-gray-900 dark:text-white" data-testid="student-overview-date">
                {safeEnrolledDate}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/80 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-zinc-500">
              {pickText({ ar: 'القسم الدراسي', fr: 'Classe scolaire', en: 'School Class' }, language)}
            </span>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-gray-900 dark:text-white" data-testid="student-overview-class">
                {schoolClass.name} ({schoolClass.level} • {schoolClass.academicYear})
              </span>
            </div>
          </div>

          {schoolClass.roomLabel && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/80 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-zinc-500">
                {pickText({ ar: 'القاعة', fr: 'Salle', en: 'Room' }, language)}
              </span>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-gray-900 dark:text-white" data-testid="student-overview-room">
                  {schoolClass.roomLabel}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <StudentAttendanceHistoryPanel
        studentId={student.studentId}
        studentName={student.fullName}
        scopeClassId={schoolClass.id}
        language={language}
        testId="student-overview-attendance-panel"
      />
    </div>
  );
};
