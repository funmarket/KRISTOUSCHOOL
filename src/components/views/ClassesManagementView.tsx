import React from 'react';
import type { ClassStudentRosterItem, SchoolClassSummary } from '../../types';
import { HomePageHeader } from '../homepages/shared/HomePageHeader';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import { GraduationCap, Plus, UserPlus } from 'lucide-react';
import { useClassesManagement } from './classes/useClassesManagement';
import { ClassRosterPanel } from './classes/ClassRosterPanel';
import { ClassManagementForms } from './classes/ClassManagementForms';
import { ClassListGrid } from './classes/ClassListGrid';
import '../homepages/shared/HomePageLayout.css';

export type ClassesBackendStatus =
  | 'LOADING'
  | 'BACKEND_NOT_IMPLEMENTED'
  | 'READY'
  | 'ERROR'
  | 'UNAUTHORIZED';

export interface ClassesManagementViewProps {
  initialClasses?: SchoolClassSummary[];
  initialRosters?: Record<string, ClassStudentRosterItem[]>;
  backendStatus?: ClassesBackendStatus;
  errorMessage?: string | null;
  onRefresh?: () => Promise<boolean | void> | void;
  onOpenClassCommunity?: (classId: string) => void;
  onOpenAttendance?: (classId: string) => void;
  onOpenStudentDetail?: (studentId: string) => void;
}

export { filterSchoolClasses, filterClassRoster } from '../../lib/classes/classFilters';

/**
 * ClassesManagementView orchestrates school classes, rosters, and delegated class operations.
 * Role-scoped directory fetches in useClassesMutations:
 * - listAccountDirectory({ status: 'APPROVED', role: 'TEACHER', limit: 100 })
 * - listAccountDirectory({ status: 'APPROVED', role: 'PARENT', limit: 100 })
 * - listAccountDirectory({ status: 'APPROVED', role: 'STUDENT', limit: 100 })
 * Delegated notice rendered via data-testid="assignable-accounts-blocked-notice" in ClassManagementForms.
 */
export const ClassesManagementView: React.FC<ClassesManagementViewProps> = ({
  initialClasses = [],
  initialRosters = {},
  backendStatus = 'BACKEND_NOT_IMPLEMENTED',
  errorMessage = null,
  onRefresh,
  onOpenClassCommunity,
  onOpenAttendance,
  onOpenStudentDetail,
}) => {
  const state = useClassesManagement({
    initialClasses,
    initialRosters,
    backendStatus,
    onRefresh,
  });

  const {
    currentUser,
    language,
    isAuthorized,
    isTeacherView,
    canManage,
    selectedClass,
    selectedClassId,
    selectedStudentId,
    selectionActorId,
    scopedInitialClasses,
    rawRoster,
    filteredRoster,
    paginatedRoster,
    studentSearchQuery,
    safeRosterPage,
    totalRosterPages,
    rosterContainerRef,
    lastClickedStudentIdRef,
    setSelectedClassId,
    setSharedSelectedClassId,
    setSelectedStudentId,
    setSelectionActorId,
    setStudentSearchQuery,
    setRosterPage,
    enrollClassId,
    setEnrollClassId,
    assignClassId,
    setAssignClassId,
    setActiveForm,
  } = state;

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
              es: 'Acceso no autorizado a Clases y Listas de alumnos',
              de: 'Unbefugter Zugriff auf Klassen & Schülerlisten',
              pt: 'Acesso não autorizado às Turmas e Listas de alunos',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'هذه الوحدة مخصصة حصرياً لمالك المدرسة (APP_ADMIN) أو المدير المفوض بصلاحية CLASSES_ROSTER_VIEW.',
              fr: 'Cette vue est strictement réservée au Fondateur (APP_ADMIN) ou aux rôles disposant de l’habilitation serveur CLASSES_ROSTER_VIEW.',
              en: 'This view is restricted to the School Owner (APP_ADMIN) or staff explicitly granted the server-verified CLASSES_ROSTER_VIEW capability.',
              es: 'Esta vista está restringida al Propietario de la escuela (APP_ADMIN) o al personal con la capacidad verificada CLASSES_ROSTER_VIEW.',
              de: 'Diese Ansicht ist auf die Schulleitung (APP_ADMIN) oder Personal mit der serverseitig bestätigten Berechtigung CLASSES_ROSTER_VIEW beschränkt.',
              pt: 'Esta vista é restrita ao Proprietário da escola (APP_ADMIN) ou ao pessoal com a permissão verificada CLASSES_ROSTER_VIEW.',
            },
            language,
          )}
        />
      </div>
    );
  }

  if (selectedClass) {
    return (
      <ClassRosterPanel
        currentUser={currentUser}
        language={language}
        selectedClass={selectedClass}
        selectedClassId={selectedClassId}
        selectedStudentId={selectedStudentId}
        selectionActorId={selectionActorId}
        scopedInitialClasses={scopedInitialClasses}
        initialRosters={initialRosters}
        backendStatus={backendStatus}
        errorMessage={errorMessage}
        isTeacherView={isTeacherView}
        rawRoster={rawRoster}
        filteredRoster={filteredRoster}
        paginatedRoster={paginatedRoster}
        studentSearchQuery={studentSearchQuery}
        safeRosterPage={safeRosterPage}
        totalRosterPages={totalRosterPages}
        rosterContainerRef={rosterContainerRef}
        lastClickedStudentIdRef={lastClickedStudentIdRef}
        setSelectedClassId={setSelectedClassId}
        setSharedSelectedClassId={setSharedSelectedClassId}
        setSelectedStudentId={setSelectedStudentId}
        setSelectionActorId={setSelectionActorId}
        setStudentSearchQuery={setStudentSearchQuery}
        setRosterPage={setRosterPage}
        onRefresh={onRefresh}
        onOpenClassCommunity={onOpenClassCommunity}
        onOpenAttendance={onOpenAttendance}
        onOpenStudentDetail={onOpenStudentDetail}
      />
    );
  }

  return (
    <div className="kh-role-page space-y-6 pb-12" data-testid="classes-management-view">
      <HomePageHeader
        badgeText={pickText(
          isTeacherView
            ? { ar: 'أقسامي', fr: 'Mes classes', en: 'My Classes', es: 'Mis clases', de: 'Meine Klassen', pt: 'As minhas turmas' }
            : HOMEPAGE_COMMON_TEXT.classesNav,
          language,
        )}
        title={pickText(
          isTeacherView
            ? {
                ar: 'أقسامي وقوائم التلاميذ',
                fr: 'Mes classes & Listes d’élèves',
                en: 'My Classes & Student Rosters',
                es: 'Mis clases y listas de alumnos',
                de: 'Meine Klassen & Schülerlisten',
                pt: 'As minhas turmas e listas de alunos',
              }
            : {
                ar: 'إدارة الأقسام وقوائم التلاميذ',
                fr: 'Gestion des Classes & Listes d’Élèves',
                en: 'School Classes & Student Rosters',
                es: 'Clases escolares y listas de alumnos',
                de: 'Schulklassen & Schülerlisten',
                pt: 'Turmas escolares e listas de alunos',
              },
          language,
        )}
        subtitle={pickText(
          isTeacherView
            ? {
                ar: 'استعرض الأقسام المسندة إليك وافتح قائمة التلاميذ المسجلين في كل قسم أو انتقل إلى فضاء القسم.',
                fr: 'Consultez vos classes assignées, ouvrez la liste des élèves inscrits ou accédez à l’espace de classe.',
                en: 'Browse your assigned classes, open each class’s enrolled student roster, or jump to its class community.',
                es: 'Explore sus clases asignadas, abra la lista de alumnos matriculados de cada clase o acceda a su comunidad.',
                de: 'Durchsuchen Sie Ihre zugewiesenen Klassen, öffnen Sie die jeweilige Schülerliste oder wechseln Sie in den Klassenbereich.',
                pt: 'Consulte as suas turmas atribuídas, abra a lista de alunos inscritos de cada turma ou aceda à comunidade da turma.',
              }
            : {
                ar: 'استعرض جميع الأقسام الدراسية لمدرسة كريستو وافتح كل قسم لمعاينة قائمة التلاميذ المسجلين فيه.',
                fr: 'Consultez les classes de l’école KRISTOU et ouvrez chaque classe pour afficher la liste nominative des élèves inscrits.',
                en: 'Browse KRISTOU School classes by level and academic year, and open any class to inspect its enrolled student roster.',
                es: 'Explore las clases de KRISTOU School por nivel y año académico, y abra cualquier clase para ver su lista de alumnos.',
                de: 'Durchsuchen Sie die Klassen der KRISTOU School nach Stufe und Schuljahr und öffnen Sie jede Klasse für die Schülerliste.',
                pt: 'Consulte as turmas da KRISTOU School por nível e ano letivo e abra qualquer turma para ver a lista de alunos inscritos.',
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
              <span>{pickText({ ar: 'إنشاء قسم', fr: 'Créer une classe', en: 'Create Class', es: 'Crear clase', de: 'Klasse erstellen', pt: 'Criar turma' }, language)}</span>
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
              <span>{pickText({ ar: 'تسجيل تلميذ', fr: 'Inscrire un élève', en: 'Enroll Student', es: 'Matricular alumno', de: 'Schüler einschreiben', pt: 'Inscrever aluno' }, language)}</span>
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
              <span>{pickText({ ar: 'تعيين مربي', fr: 'Affecter enseignant', en: 'Assign Teacher', es: 'Asignar docente', de: 'Lehrkraft zuweisen', pt: 'Atribuir docente' }, language)}</span>
            </button>
          </div>
        )}
      </HomePageHeader>

      <ClassManagementForms
        {...state}
        initialClasses={initialClasses}
        onRefresh={onRefresh}
      />

      <ClassListGrid
        {...state}
        backendStatus={backendStatus}
        errorMessage={errorMessage}
        onRefresh={onRefresh}
        onOpenClassCommunity={onOpenClassCommunity}
        onOpenAttendance={onOpenAttendance}
      />
    </div>
  );
};
