import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Clock,
  Layers,
  Lock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import {
  getLocalizedSubjectLabel,
  type resolveVisibleTeacherAllocations,
} from '../../../lib/performance';
import type { useApp } from '../../../context/AppContext';
import type { Language, TeacherAllocatedSubjectItem } from '../../../types';

export interface AcademicSubjectDashboardSectionProps {
  language: Language;
  t: ReturnType<typeof useApp>['t'];
  isParent: boolean;
  actorScopeKey: string;
  currentUserId: string;
  classesBackendStatus: string;
  activeClassId: string;
  visibleAllocations: ReturnType<typeof resolveVisibleTeacherAllocations>;
  domainSubjectGroups: Array<[string, TeacherAllocatedSubjectItem[]]>;
  unavailableBadgeLabel: string;
  serviceUnavailableLabel: string;
  retryLabel: string;
  handleRefresh: () => Promise<void>;
  executeTeacherAllocationsFetch: (
    originActorScopeKey: string,
    originClassId: string,
    originTeacherUserId: string,
  ) => Promise<void>;
}

export const AcademicSubjectDashboardSection: React.FC<AcademicSubjectDashboardSectionProps> = ({
  language,
  t,
  isParent,
  actorScopeKey,
  currentUserId,
  classesBackendStatus,
  activeClassId,
  visibleAllocations,
  domainSubjectGroups,
  unavailableBadgeLabel,
  serviceUnavailableLabel,
  retryLabel,
  handleRefresh,
  executeTeacherAllocationsFetch,
}) => {
  const renderAllocationCountBadge = () => {
    if (isParent) {
      return (
        <span
          data-testid="academic-dashboard-count-badge"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{unavailableBadgeLabel}</span>
        </span>
      );
    }

    if (visibleAllocations.status === 'LOADING') {
      return (
        <span
          data-testid="academic-dashboard-count-badge"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-gray-100 dark:bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300"
        >
          {t('loading')}
        </span>
      );
    }

    if (visibleAllocations.status === 'ERROR') {
      return (
        <span
          data-testid="academic-dashboard-count-badge"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-300"
        >
          {t('error')}
        </span>
      );
    }

    if (visibleAllocations.status === 'UNAUTHORIZED') {
      return (
        <span
          data-testid="academic-dashboard-count-badge"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-300"
        >
          {t('unauthorized')}
        </span>
      );
    }

    if (visibleAllocations.status === 'BLOCKED_BACKEND') {
      return (
        <span
          data-testid="academic-dashboard-count-badge"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300"
        >
          {serviceUnavailableLabel}
        </span>
      );
    }

    if (visibleAllocations.hasConfirmedNoClasses) {
      return (
        <span
          data-testid="academic-dashboard-count-badge"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-gray-100 dark:bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300"
        >
          {pickText(
            { ar: 'لا توجد أقسام مسندة', fr: 'Aucune classe assignée', en: 'No assigned classes', es: 'Sin clases asignadas', de: 'Keine zugewiesenen Klassen', pt: 'Sem turmas atribuídas' },
            language,
          )}
        </span>
      );
    }

    return (
      <span
        data-testid="academic-dashboard-count-badge"
        className="inline-flex items-center gap-1.5 rounded-2xl bg-gray-100 dark:bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-gray-800 dark:text-gray-200"
      >
        <span>
          {visibleAllocations.items.length}{' '}
          {pickText(
            { ar: 'مادة مسندة', fr: 'matières attribuées', en: 'allocated subjects', es: 'asignaturas asignadas', de: 'zugewiesene Fächer', pt: 'disciplinas atribuídas' },
            language,
          )}
        </span>
      </span>
    );
  };

  return (
    <section
      data-testid="academic-dashboard-section"
      className="bg-white dark:bg-[#111111] p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-k-brand/10 text-k-brand flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
              {pickText(
                {
                  ar: 'لوحة المواد الدراسية حسب المجال',
                  fr: 'Tableau académique par matière et domaine',
                  en: 'Academic Dashboard by Subject and Domain',
                  es: 'Panel académico por asignatura y área',
                  de: 'Akademisches Dashboard nach Fach und Bereich',
                  pt: 'Painel académico por disciplina e área',
                },
                language,
              )}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isParent
                ? pickText(
                    {
                      ar: 'متابعة المواد الدراسية الخاصة بأطفالك غير متاحة بعد',
                      fr: 'La vue détaillée par matière pour les parents n’est pas encore disponible',
                      en: 'Subject-level detail view for parents is not yet available',
                      es: 'La vista detallada por asignatura para padres aún no está disponible',
                      de: 'Die Fachdetailansicht für Eltern ist noch nicht verfügbar',
                      pt: 'A vista detalhada por disciplina para encarregados ainda não está disponível',
                    },
                    language,
                  )
                : pickText(
                    {
                      ar: 'عرض المواد المسندة ومكوّناتها الفرعية مجمّعة حسب المجال الدراسي',
                      fr: 'Affichage des matières attribuées et de leurs composantes par domaine',
                      en: 'Allocated subjects and their subject components grouped by learning domain',
                      es: 'Asignaturas asignadas y sus componentes agrupados por área de aprendizaje',
                      de: 'Zugewiesene Fächer und ihre Teilbereiche nach Lernbereich gruppiert',
                      pt: 'Disciplinas atribuídas e respetivos componentes agrupados por área de aprendizagem',
                    },
                    language,
                  )}
            </p>
          </div>
        </div>

        {renderAllocationCountBadge()}
      </div>

      {isParent ? (
        <div
          data-testid="academic-dashboard-parent-unavailable"
          className="rounded-2xl border border-dashed border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-8 text-center space-y-2 text-xs text-amber-800 dark:text-amber-300"
        >
          <Clock className="w-8 h-8 mx-auto text-amber-500" />
          <p className="font-bold">
            {pickText(
              {
                ar: 'بيانات المواد الدراسية لأولياء الأمور غير متاحة حالياً.',
                fr: 'Les informations par matière pour les parents ne sont pas encore disponibles.',
                en: 'Subject information for parents is not yet available.',
                es: 'La información por asignatura para padres aún no está disponible.',
                de: 'Fachinformationen für Eltern sind noch nicht verfügbar.',
                pt: 'A informação por disciplina para encarregados ainda não está disponível.',
              },
              language,
            )}
          </p>
        </div>
      ) : visibleAllocations.status === 'LOADING' ? (
        <div
          data-testid="academic-dashboard-loading"
          className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center space-y-2 text-xs text-gray-500"
        >
          <RefreshCw className="w-7 h-7 mx-auto text-k-brand animate-spin" />
          <p className="font-bold">{t('loading')}</p>
        </div>
      ) : visibleAllocations.status === 'ERROR' ? (
        <div
          data-testid="academic-dashboard-error"
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-8 text-center space-y-3 text-xs text-red-700 dark:text-red-300"
        >
          <AlertTriangle className="w-7 h-7 mx-auto" />
          <p className="font-bold">{visibleAllocations.errorMessage || t('error')}</p>
          <button
            type="button"
            data-testid="academic-dashboard-retry-btn"
            onClick={() =>
              void (classesBackendStatus === 'READY' && activeClassId
                ? executeTeacherAllocationsFetch(actorScopeKey, activeClassId, currentUserId)
                : handleRefresh())
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-bold transition-colors"
          >
            {retryLabel}
          </button>
        </div>
      ) : visibleAllocations.status === 'UNAUTHORIZED' ? (
        <div
          data-testid="academic-dashboard-unauthorized"
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-8 text-center space-y-2 text-xs text-red-700 dark:text-red-300"
        >
          <ShieldAlert className="w-7 h-7 mx-auto" />
          <p className="font-bold">{t('unauthorized')}</p>
        </div>
      ) : visibleAllocations.status === 'BLOCKED_BACKEND' ? (
        <div
          data-testid="academic-dashboard-blocked"
          className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-8 text-center space-y-2 text-xs text-amber-800 dark:text-amber-300"
        >
          <Lock className="w-7 h-7 mx-auto text-amber-500" />
          <p className="font-bold">{serviceUnavailableLabel}</p>
        </div>
      ) : visibleAllocations.hasConfirmedNoClasses ? (
        <div
          data-testid="academic-dashboard-no-classes"
          className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center space-y-2 text-xs text-gray-500"
        >
          <BookOpen className="w-8 h-8 mx-auto text-gray-400" />
          <p className="font-bold">
            {pickText(
              {
                ar: 'لا توجد أقسام مسندة لحسابك حالياً.',
                fr: 'Aucune classe n’est assignée à votre compte pour le moment.',
                en: 'No classes are currently assigned to your account.',
                es: 'Actualmente no hay clases asignadas a su cuenta.',
                de: 'Ihrem Konto sind derzeit keine Klassen zugewiesen.',
                pt: 'Atualmente não existem turmas atribuídas à sua conta.',
              },
              language,
            )}
          </p>
        </div>
      ) : visibleAllocations.items.length === 0 ? (
        <div
          data-testid="academic-dashboard-empty"
          className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center space-y-2 text-xs text-gray-500"
        >
          <BookOpen className="w-8 h-8 mx-auto text-gray-400" />
          <p className="font-bold">
            {pickText(
              {
                ar: 'لا توجد مواد مسندة لك في هذا النطاق حالياً.',
                fr: 'Aucune matière attribuée dans ce périmètre pour le moment.',
                en: 'No subjects allocated in this scope.',
                es: 'No hay asignaturas asignadas en este ámbito.',
                de: 'In diesem Bereich sind keine Fächer zugewiesen.',
                pt: 'Não existem disciplinas atribuídas neste âmbito.',
              },
              language,
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {domainSubjectGroups.map(([domainCode, subjects]) => (
            <div
              key={domainCode}
              data-testid={`dashboard-domain-group-${domainCode}`}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-k-brand font-mono">
                  {pickText({ ar: 'مجال:', fr: 'Domaine :', en: 'Domain:', es: 'Área:', de: 'Bereich:', pt: 'Área:' }, language)} {domainCode}
                </span>
                <span className="text-xs font-bold text-gray-500">
                  {subjects.length}{' '}
                  {pickText({ ar: 'مادة', fr: 'matières', en: 'subjects', es: 'asignaturas', de: 'Fächer', pt: 'disciplinas' }, language)}
                </span>
              </div>

              <div className="space-y-3">
                {subjects.map((sub) => (
                  <div
                    key={sub.subjectId}
                    data-testid={`dashboard-subject-card-${sub.subjectCode}`}
                    className="bg-white dark:bg-[#111111] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                          {getLocalizedSubjectLabel(sub, language)}
                        </h3>
                        <p className="text-[11px] font-mono text-gray-400">
                          {sub.subjectCode} • {sub.className}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                        {pickText({ ar: 'نشط', fr: 'Actif', en: 'Active', es: 'Activo', de: 'Aktiv', pt: 'Ativo' }, language)}
                      </span>
                    </div>

                    {sub.components.length > 0 && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
                        {sub.components.map((comp) => (
                          <span
                            key={comp.id}
                            className="rounded-lg bg-gray-100 dark:bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:text-gray-300"
                          >
                            {getLocalizedSubjectLabel(comp, language)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
