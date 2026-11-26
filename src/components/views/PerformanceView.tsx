import React from 'react';
import {
  AlertTriangle,
  Eye,
  GraduationCap,
  Lock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { pickText } from '../../i18n/homepages';
import { AcademicSubjectDashboardSection } from './performance/AcademicSubjectDashboardSection';
import { PerformanceParentScopeSection } from './performance/PerformanceParentScopeSection';
import { PerformanceTeacherScopeSection } from './performance/PerformanceTeacherScopeSection';
import { ReadOnlyAssessmentPanelsGrid } from './performance/ReadOnlyAssessmentPanelsGrid';
import { usePerformanceViewController } from './performance/usePerformanceViewController';

export const PerformanceView: React.FC = () => {
  const {
    currentUser,
    language,
    t,
    isTeacher,
    isParent,
    isAuthorizedRole,
    actorScopeKey,
    classesBackendStatus,
    classesError,
    schoolContextError,
    isHydratingSchoolData,
    setSelectedClassId,
    setSelectedChildId,
    setSelectedStudentId,
    setSelectedSubjectId,
    isRefreshing,
    teacherScope,
    parentScope,
    visibleAllocations,
    domainSubjectGroups,
    showTeacherDetails,
    activeSubject,
    hasRefreshError,
    unavailableBadgeLabel,
    readOnlyBadgeLabel,
    serviceUnavailableLabel,
    retryLabel,
    executeTeacherAllocationsFetch,
    handleRefresh,
  } = usePerformanceViewController();

  if (!isAuthorizedRole) {
    return (
      <div
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        data-testid="performance-view-unauthorized"
        className="bg-white dark:bg-[#111111] rounded-3xl border border-gray-200 dark:border-gray-800 p-8 text-center space-y-3"
      >
        <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-extrabold text-gray-900 dark:text-white">
          {t('unauthorized')}
        </h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          {pickText(
            {
              ar: 'مساحة الأداء الدراسي مخصّصة فقط لحسابات المربين والأولياء المعتمدة.',
              fr: 'L’espace Performance est réservé aux comptes Enseignant et Parent approuvés.',
              en: 'Academic Performance viewing is restricted to approved Teacher and Parent accounts.',
              es: 'La consulta del rendimiento académico está restringida a cuentas aprobadas de docentes y padres.',
              de: 'Die Leistungsansicht ist auf genehmigte Lehrkräfte- und Elternkonten beschränkt.',
              pt: 'A consulta do desempenho académico é restrita a contas aprovadas de docentes e encarregados.',
            },
            language,
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      data-testid="performance-view"
      className="space-y-6 pb-12"
    >
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-k-brand/10 text-k-brand px-3 py-1 rounded-full text-xs font-bold">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>
                {isTeacher
                  ? pickText(
                      { ar: 'فضاء المربي', fr: 'Espace Enseignant', en: 'Teacher Scope', es: 'Ámbito docente', de: 'Lehrkräftebereich', pt: 'Espaço docente' },
                      language,
                    )
                  : pickText(
                      { ar: 'فضاء الولي', fr: 'Espace Parent', en: 'Parent Scope', es: 'Ámbito familiar', de: 'Elternbereich', pt: 'Espaço encarregado' },
                      language,
                    )}
              </span>
            </span>
            <span
              data-testid="performance-readonly-badge"
              className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-semibold"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{readOnlyBadgeLabel}</span>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {t('performance')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
            {isTeacher
              ? pickText(
                  {
                    ar: 'استعراض أقسامك وتلاميذك والمواد المسندة إليك، مع حالة إتاحة النتائج والمنحنيات والتقييمات.',
                    fr: 'Consultez vos classes assignées, leurs élèves et vos matières attribuées, ainsi que la disponibilité des notes, graphiques et appréciations.',
                    en: 'View your assigned classes, class students, and allocated subjects alongside the availability of grades, progress charts, and subject feedback.',
                    es: 'Consulte sus clases asignadas, alumnos y asignaturas junto con la disponibilidad de calificaciones, gráficos y observaciones.',
                    de: 'Sehen Sie Ihre zugewiesenen Klassen, Schüler und Fächer sowie die Verfügbarkeit von Noten, Diagrammen und Rückmeldungen.',
                    pt: 'Consulte as suas turmas atribuídas, alunos e disciplinas juntamente com a disponibilidade de notas, gráficos e observações.',
                  },
                  language,
                )
              : pickText(
                  {
                    ar: 'متابعة أطفالك المرتبطين بحسابك وحالة إتاحة النتائج والمنحنيات البيانية وملاحظات المربين حسب المادة.',
                    fr: 'Consultez vos enfants liés et la disponibilité des notes, graphiques de progression et appréciations par matière.',
                    en: 'View your linked children and the availability of published subject grades, academic progress charts, and teacher feedback.',
                    es: 'Consulte a sus hijos vinculados y la disponibilidad de calificaciones, gráficos de progreso y observaciones docentes.',
                    de: 'Sehen Sie Ihre verknüpften Kinder sowie die Verfügbarkeit von Fachnoten, Verlaufsdiagrammen und Lehrkräfte-Feedback.',
                    pt: 'Consulte os seus filhos associados e a disponibilidade de notas publicadas, gráficos de progresso e observações docentes.',
                  },
                  language,
                )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            data-testid="performance-assessment-status-badge"
            className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3.5 py-2 rounded-2xl text-xs font-bold"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{unavailableBadgeLabel}</span>
          </span>

          <button
            type="button"
            data-testid="performance-refresh-btn"
            disabled={isRefreshing || isHydratingSchoolData}
            onClick={() => void handleRefresh()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 text-xs font-bold text-gray-800 dark:text-gray-200 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing || isHydratingSchoolData ? 'animate-spin' : ''}`}
            />
            <span>
              {pickText({ ar: 'تحديث', fr: 'Actualiser', en: 'Refresh', es: 'Actualizar', de: 'Aktualisieren', pt: 'Atualizar' }, language)}
            </span>
          </button>
        </div>
      </div>

      {hasRefreshError && (
        <div
          data-testid="performance-refresh-error-banner"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300"
        >
          <span>
            {pickText(
              {
                ar: 'تعذّر تحديث البيانات المدرسية. يرجى المحاولة مجدداً.',
                fr: 'Impossible d’actualiser les données scolaires. Veuillez réessayer.',
                en: 'Could not refresh school data. Please try again.',
                es: 'No se pudieron actualizar los datos escolares. Inténtelo de nuevo.',
                de: 'Schuldaten konnten nicht aktualisiert werden. Bitte versuchen Sie es erneut.',
                pt: 'Não foi possível atualizar os dados escolares. Tente novamente.',
              },
              language,
            )}
          </span>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 font-extrabold underline"
          >
            {retryLabel}
          </button>
        </div>
      )}

      <div
        data-testid="performance-assessments-unavailable-banner"
        className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 p-5 rounded-3xl flex items-start gap-3.5"
      >
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-xs">
          <h2 className="font-extrabold text-amber-900 dark:text-amber-200 text-sm">
            {pickText(
              {
                ar: 'النتائج ومنحنيات التقدم وملاحظات المواد غير متاحة حالياً',
                fr: 'Notes, graphiques de progression et appréciations indisponibles pour le moment',
                en: 'Grades, progress charts, and subject feedback are not yet available',
                es: 'Calificaciones, gráficos de progreso y observaciones aún no disponibles',
                de: 'Noten, Verlaufsdiagramme und Fachfeedback sind noch nicht verfügbar',
                pt: 'Notas, gráficos de progresso e observações ainda não estão disponíveis',
              },
              language,
            )}
          </h2>
          <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
            {pickText(
              {
                ar: 'ستظهر العلامات ومنحنيات التطوّر والملاحظات التربوية المنشورة هنا فور تفعيل نظام التقييمات المدرسية.',
                fr: 'Les notes, courbes d’évolution et appréciations publiées apparaîtront ici dès l’activation du suivi des évaluations scolaires.',
                en: 'Published marks, progress series, and subject feedback will appear here once school assessment tracking is enabled.',
                es: 'Las notas, series de progreso y observaciones publicadas aparecerán aquí cuando se active el seguimiento de evaluaciones.',
                de: 'Veröffentlichte Noten, Verläufe und Rückmeldungen erscheinen hier, sobald das schulische Bewertungssystem aktiviert ist.',
                pt: 'As notas publicadas, séries de progresso e observações aparecerão aqui assim que o acompanhamento das avaliações for ativado.',
              },
              language,
            )}
          </p>
        </div>
      </div>

      {isTeacher && (
        <PerformanceTeacherScopeSection
          language={language}
          t={t}
          actorScopeKey={actorScopeKey}
          currentUserId={currentUser?.id ?? ''}
          isHydratingSchoolData={isHydratingSchoolData}
          classesBackendStatus={classesBackendStatus}
          classesError={classesError}
          teacherScope={teacherScope}
          visibleAllocations={visibleAllocations}
          activeSubject={activeSubject}
          showTeacherDetails={showTeacherDetails}
          retryLabel={retryLabel}
          serviceUnavailableLabel={serviceUnavailableLabel}
          setSelectedClassId={setSelectedClassId}
          setSelectedStudentId={setSelectedStudentId}
          setSelectedSubjectId={setSelectedSubjectId}
          handleRefresh={handleRefresh}
          executeTeacherAllocationsFetch={executeTeacherAllocationsFetch}
        />
      )}

      {isParent && (
        <PerformanceParentScopeSection
          language={language}
          t={t}
          isHydratingSchoolData={isHydratingSchoolData}
          schoolContextError={schoolContextError}
          parentScope={parentScope}
          retryLabel={retryLabel}
          unavailableBadgeLabel={unavailableBadgeLabel}
          setSelectedChildId={setSelectedChildId}
          handleRefresh={handleRefresh}
        />
      )}

      <AcademicSubjectDashboardSection
        language={language}
        t={t}
        isParent={isParent}
        actorScopeKey={actorScopeKey}
        currentUserId={currentUser?.id ?? ''}
        classesBackendStatus={classesBackendStatus}
        activeClassId={teacherScope.activeClassId}
        visibleAllocations={visibleAllocations}
        domainSubjectGroups={domainSubjectGroups}
        unavailableBadgeLabel={unavailableBadgeLabel}
        serviceUnavailableLabel={serviceUnavailableLabel}
        retryLabel={retryLabel}
        handleRefresh={handleRefresh}
        executeTeacherAllocationsFetch={executeTeacherAllocationsFetch}
      />

      <ReadOnlyAssessmentPanelsGrid
        language={language}
        isParent={isParent}
        unavailableBadgeLabel={unavailableBadgeLabel}
      />
    </div>
  );
};
