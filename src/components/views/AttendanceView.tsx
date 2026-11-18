import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { pickText } from '../../i18n/homepages';
import { HomePageHeader } from '../homepages/shared/HomePageHeader';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { canAccessAppTab } from '../homepages/homepageAccess';
import { resolveAttendanceAccessMode } from '../../lib/attendance/logic';
import { StaffAttendanceRegisterPanel } from './attendance/StaffAttendanceRegisterPanel';
import { FamilyAttendanceHistoryPanel } from './attendance/FamilyAttendanceHistoryPanel';
import '../homepages/shared/HomePageLayout.css';

export interface AttendanceViewProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ onDirtyChange }) => {
  const { currentUser, language } = useApp();
  const [hasDirtyDraft, setHasDirtyDraft] = useState(false);

  const isAuthorized = canAccessAppTab(currentUser, 'attendance');
  const accessMode = resolveAttendanceAccessMode(currentUser);
  const isStaff = accessMode === 'STAFF_TEACHER' || accessMode === 'STAFF_OFFICE';
  const isFamily = accessMode === 'FAMILY_PARENT' || accessMode === 'FAMILY_STUDENT';

  useEffect(() => {
    const activeDirty = isAuthorized && isStaff && hasDirtyDraft;
    onDirtyChange?.(activeDirty);
    if (!activeDirty || typeof window === 'undefined') {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthorized, isStaff, hasDirtyDraft, onDirtyChange]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  if (!isAuthorized || accessMode === 'UNAUTHORIZED') {
    return (
      <div className="kh-role-page" data-testid="attendance-view-unauthorized">
        <EmptyFeatureState
          state="UNAUTHORIZED"
          title={pickText(
            {
              ar: 'غير مصرح بالدخول إلى الحضور والغياب',
              fr: 'Accès non autorisé aux présences',
              en: 'Unauthorized Access to Attendance',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'هذه الوحدة مخصصة للمعلمين المعتمدين، والأولياء، والتلاميذ، ومالك المدرسة، والطاقم الإداري فقط.',
              fr: 'Cet espace est strictement réservé aux comptes approuvés : enseignants, parents, élèves, direction et administration.',
              en: 'Attendance is restricted to approved Teachers, Parents, Students, School Owner, and Administrative Office accounts.',
            },
            language,
          )}
        />
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <Lock className="w-3.5 h-3.5" />
          <span>KRISTOU SCHOOL</span>
        </div>
      </div>
    );
  }

  const badgeText =
    accessMode === 'STAFF_TEACHER'
      ? pickText({ ar: 'سجل القسم اليومي', fr: 'REGISTRE DE CLASSE', en: 'DAILY CLASS REGISTER' }, language)
      : accessMode === 'STAFF_OFFICE'
      ? pickText({ ar: 'إشراف وتصحيح الحضور', fr: 'SUPERVISION PRÉSENCES', en: 'OFFICE ATTENDANCE' }, language)
      : pickText({ ar: 'متابعة الحضور المعتمد', fr: 'HISTORIQUE PRÉSENCES', en: 'ATTENDANCE HISTORY' }, language);

  const titleText =
    accessMode === 'STAFF_TEACHER'
      ? pickText({ ar: 'الحضور والغياب اليومي', fr: 'Présences & Absences du jour', en: 'Daily Class Attendance' }, language)
      : accessMode === 'STAFF_OFFICE'
      ? pickText({ ar: 'متابعة وتصحيح سجلات الحضور', fr: 'Supervision & Corrections des présences', en: 'Attendance Oversight & Corrections' }, language)
      : pickText({ ar: 'سجل الحضور والغياب', fr: 'Relevé des présences', en: 'Attendance Record' }, language);

  const subtitleText =
    accessMode === 'STAFF_TEACHER'
      ? pickText(
          {
            ar: 'سجل يومي موحد لكل قسم بتوقيت تونس (Africa/Tunis) مع حفظ مسودة أو اعتماد نهائي.',
            fr: 'Registre quotidien par classe (heure de Tunis) : enregistrez un brouillon ou soumettez le relevé complet.',
            en: 'Daily register per assigned class (Africa/Tunis). Save incomplete drafts or submit when every pupil is marked.',
          },
          language,
        )
      : accessMode === 'STAFF_OFFICE'
      ? pickText(
          {
            ar: 'مراجعة السجلات المسجلة حسب القسم والمربي المسؤول وتوثيق أي تصحيح تاريخي بسبب إلزامي.',
            fr: 'Consultez les registres par classe et enseignant responsable, et documentez toute correction historique.',
            en: 'Review daily registers by class and responsible Teacher, and document historical corrections with an audit reason.',
          },
          language,
        )
      : pickText(
          {
            ar: 'عرض سجلات الحضور المعتمدة رسمياً فقط (بدون ملاحظات طاقم المدرسة الداخلية).',
            fr: 'Consultation en lecture seule des présences officiellement soumises.',
            en: 'Read-only view of officially submitted attendance records.',
          },
          language,
        );

  return (
    <div className="kh-role-page space-y-5 pb-12" data-testid="attendance-view">
      <HomePageHeader
        badgeText={badgeText}
        title={titleText}
        subtitle={subtitleText}
      />

      {isStaff && <StaffAttendanceRegisterPanel onDirtyChange={setHasDirtyDraft} />}
      {isFamily && <FamilyAttendanceHistoryPanel />}
    </div>
  );
};
