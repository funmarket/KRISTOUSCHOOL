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
              es: 'Acceso no autorizado a Asistencia',
              de: 'Unbefugter Zugriff auf Anwesenheit',
              pt: 'Acesso não autorizado à Assiduidade',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'هذه الوحدة مخصصة للمعلمين المعتمدين، والأولياء، والتلاميذ، ومالك المدرسة، والطاقم الإداري فقط.',
              fr: 'Cet espace est strictement réservé aux comptes approuvés : enseignants, parents, élèves, direction et administration.',
              en: 'Attendance is restricted to approved Teachers, Parents, Students, School Owner, and Administrative Office accounts.',
              es: 'La asistencia está restringida a cuentas aprobadas de docentes, padres, alumnos, propietario y oficina administrativa.',
              de: 'Die Anwesenheit ist auf genehmigte Lehrkräfte, Eltern, Schüler, Schulleitung und Verwaltungsbüro beschränkt.',
              pt: 'A assiduidade é restrita a contas aprovadas de professores, pais, alunos, direção e secretaria.',
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
      ? pickText({ ar: 'سجل القسم اليومي', fr: 'REGISTRE DE CLASSE', en: 'DAILY CLASS REGISTER', es: 'REGISTRO DIARIO DE CLASE', de: 'TÄGLICHES KLASSENBUCH', pt: 'REGISTO DIÁRIO DE TURMA' }, language)
      : accessMode === 'STAFF_OFFICE'
      ? pickText({ ar: 'إشراف وتصحيح الحضور', fr: 'SUPERVISION PRÉSENCES', en: 'OFFICE ATTENDANCE', es: 'SUPERVISIÓN DE ASISTENCIA', de: 'ANWESENHEITSAUFSICHT', pt: 'SUPERVISÃO DE ASSIDUIDADE' }, language)
      : pickText({ ar: 'متابعة الحضور المعتمد', fr: 'HISTORIQUE PRÉSENCES', en: 'ATTENDANCE HISTORY', es: 'HISTORIAL DE ASISTENCIA', de: 'ANWESENHEITSVERLAUF', pt: 'HISTÓRICO DE ASSIDUIDADE' }, language);

  const titleText =
    accessMode === 'STAFF_TEACHER'
      ? pickText({ ar: 'الحضور والغياب اليومي', fr: 'Présences & Absences du jour', en: 'Daily Class Attendance', es: 'Asistencia diaria de clase', de: 'Tägliche Klassenanwesenheit', pt: 'Assiduidade diária da turma' }, language)
      : accessMode === 'STAFF_OFFICE'
      ? pickText({ ar: 'متابعة وتصحيح سجلات الحضور', fr: 'Supervision & Corrections des présences', en: 'Attendance Oversight & Corrections', es: 'Supervisión y correcciones de asistencia', de: 'Anwesenheitsaufsicht & Korrekturen', pt: 'Supervisão e correções de assiduidade' }, language)
      : pickText({ ar: 'سجل الحضور والغياب', fr: 'Relevé des présences', en: 'Attendance Record', es: 'Registro de asistencia', de: 'Anwesenheitsnachweis', pt: 'Registo de assiduidade' }, language);

  const subtitleText =
    accessMode === 'STAFF_TEACHER'
      ? pickText(
          {
            ar: 'سجل يومي موحد لكل قسم بتوقيت تونس (Africa/Tunis) مع حفظ مسودة أو اعتماد نهائي.',
            fr: 'Registre quotidien par classe (heure de Tunis) : enregistrez un brouillon ou soumettez le relevé complet.',
            en: 'Daily register per assigned class (Africa/Tunis). Save incomplete drafts or submit when every pupil is marked.',
            es: 'Registro diario por clase asignada (Africa/Tunis). Guarde borradores incompletos o envíe cuando todos los alumnos estén marcados.',
            de: 'Tägliches Klassenbuch pro zugewiesener Klasse (Africa/Tunis). Entwürfe speichern oder nach Erfassung aller Schüler einreichen.',
            pt: 'Registo diário por turma atribuída (Africa/Tunis). Guarde rascunhos incompletos ou submeta quando todos os alunos estiverem marcados.',
          },
          language,
        )
      : accessMode === 'STAFF_OFFICE'
      ? pickText(
          {
            ar: 'مراجعة السجلات المسجلة حسب القسم والمربي المسؤول وتوثيق أي تصحيح تاريخي بسبب إلزامي.',
            fr: 'Consultez les registres par classe et enseignant responsable, et documentez toute correction historique.',
            en: 'Review daily registers by class and responsible Teacher, and document historical corrections with an audit reason.',
            es: 'Revise registros diarios por clase y docente responsable, y documente correcciones históricas con motivo de auditoría.',
            de: 'Überprüfen Sie Tagesregister nach Klasse und Lehrkraft und dokumentieren Sie Korrekturen mit Audit-Begründung.',
            pt: 'Reveja registos diários por turma e professor responsável e documente correções históricas com motivo de auditoria.',
          },
          language,
        )
      : pickText(
          {
            ar: 'عرض سجلات الحضور المعتمدة رسمياً فقط (بدون ملاحظات طاقم المدرسة الداخلية).',
            fr: 'Consultation en lecture seule des présences officiellement soumises.',
            en: 'Read-only view of officially submitted attendance records.',
            es: 'Vista de solo lectura de los registros de asistencia enviados oficialmente.',
            de: 'Schreibgeschützte Ansicht der offiziell eingereichten Anwesenheitsdaten.',
            pt: 'Vista só de leitura dos registos de assiduidade oficialmente submetidos.',
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
