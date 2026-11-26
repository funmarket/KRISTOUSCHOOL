import React from 'react';
import { BarChart3, Clock, Lock, MessageSquareText, TrendingUp } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import type { Language } from '../../../types';

export interface ReadOnlyAssessmentPanelsGridProps {
  language: Language;
  isParent: boolean;
  unavailableBadgeLabel: string;
}

export const ReadOnlyAssessmentPanelsGrid: React.FC<ReadOnlyAssessmentPanelsGridProps> = ({
  language,
  isParent,
  unavailableBadgeLabel,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section
        data-testid="performance-grades-section"
        className="lg:col-span-6 bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 flex flex-col justify-between"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-k-brand">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                {pickText(
                  {
                    ar: 'النتائج والدرجات حسب المادة',
                    fr: 'Notes par matière',
                    en: 'Subject Grades',
                    es: 'Calificaciones por asignatura',
                    de: 'Noten nach Fach',
                    pt: 'Notas por disciplina',
                  },
                  language,
                )}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <Lock className="w-3 h-3" />
              <span>{unavailableBadgeLabel}</span>
            </span>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {pickText(
              {
                ar: 'نتائج التقييمات لكل مادة غير متاحة حالياً، ولا يُعد غياب السجلات صفراً في التحصيل.',
                fr: 'Les notes par matière ne sont pas encore disponibles. L’absence de relevé ne signifie pas une note nulle.',
                en: 'Subject grades are not yet available. Missing records never represent zero achievement.',
                es: 'Las calificaciones por asignatura aún no están disponibles. La ausencia de registros nunca representa un cero.',
                de: 'Fachnoten sind noch nicht verfügbar. Fehlende Einträge bedeuten niemals null Leistung.',
                pt: 'As notas por disciplina ainda não estão disponíveis. A ausência de registos nunca representa zero aproveitamento.',
              },
              language,
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between gap-2 tabular-nums">
          <span>
            {pickText(
              {
                ar: 'سجل التقييمات المنشورة',
                fr: 'Relevé d’évaluations',
                en: 'Published assessments',
                es: 'Evaluaciones publicadas',
                de: 'Veröffentlichte Bewertungen',
                pt: 'Avaliações publicadas',
              },
              language,
            )}
          </span>
          <span className="font-mono font-bold text-gray-700 dark:text-gray-300">—</span>
        </div>
      </section>

      <section
        data-testid="performance-progress-section"
        className="lg:col-span-6 bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 flex flex-col justify-between"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-k-brand">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                {pickText(
                  {
                    ar: 'منحنى التقدم الأكاديمي',
                    fr: 'Graphique de progression académique',
                    en: 'Academic Progress Chart',
                    es: 'Gráfico de progreso académico',
                    de: 'Akademisches Verlaufsdiagramm',
                    pt: 'Gráfico de progresso académico',
                  },
                  language,
                )}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <Lock className="w-3 h-3" />
              <span>{unavailableBadgeLabel}</span>
            </span>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {pickText(
              {
                ar: 'سيعرض هذا الرسم البياني تطوّر الأداء عبر الفترات الدراسية فور تفعيل متابعة التقييمات.',
                fr: 'Ce graphique affichera l’évolution chronologique par matière dès l’activation du suivi des périodes scolaires.',
                en: 'Subject progress trends across reporting periods will appear here once assessment tracking is active.',
                es: 'Las tendencias de progreso por asignatura aparecerán aquí cuando el seguimiento de evaluaciones esté activo.',
                de: 'Leistungsverläufe nach Fach erscheinen hier, sobald die Bewertungsverfolgung aktiv ist.',
                pt: 'As tendências de progresso por disciplina aparecerão aqui quando o acompanhamento de avaliações estiver ativo.',
              },
              language,
            )}
          </p>
        </div>

        <div
          aria-label={pickText(
            {
              ar: 'مخطط التقدم غير متاح حالياً',
              fr: 'Graphique de progression indisponible',
              en: 'Progress chart unavailable',
              es: 'Gráfico de progreso no disponible',
              de: 'Verlaufsdiagramm nicht verfügbar',
              pt: 'Gráfico de progresso indisponível',
            },
            language,
          )}
          className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[112px]"
        >
          <Clock className="w-5 h-5 text-amber-500" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
            {pickText(
              {
                ar: 'لا توجد بيانات زمنية متاحة للرسم البياني بعد',
                fr: 'Aucune série chronologique disponible pour le moment',
                en: 'No progress series available yet',
                es: 'Aún no hay datos cronológicos disponibles',
                de: 'Noch keine Verlaufsdaten verfügbar',
                pt: 'Ainda não existem séries de progresso disponíveis',
              },
              language,
            )}
          </span>
        </div>
      </section>

      <section
        data-testid="performance-feedback-section"
        className="lg:col-span-12 bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-k-brand">
              <MessageSquareText className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
              {pickText(
                {
                  ar: 'ملاحظات وتوصيات المربي حسب المادة',
                  fr: 'Appréciations des enseignants par matière',
                  en: 'Teacher Subject Feedback',
                  es: 'Observaciones docentes por asignatura',
                  de: 'Lehrkräfte-Feedback nach Fach',
                  pt: 'Observações docentes por disciplina',
                },
                language,
              )}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
            <Lock className="w-3 h-3" />
            <span>{unavailableBadgeLabel}</span>
          </span>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl">
          {isParent
            ? pickText(
                {
                  ar: 'تظهر هنا فقط ملاحظات المربين المنشورة للأولياء فور تفعيلها. لا تُعرض الملاحظات الداخلية.',
                  fr: 'Seules les appréciations publiées pour les parents apparaîtront ici dès leur activation. Les notes internes ne sont jamais affichées.',
                  en: 'Only published teacher feedback for parents will appear here once enabled. Private teacher notes are never shown.',
                  es: 'Solo aparecerán aquí las observaciones publicadas para los padres una vez activadas. Nunca se muestran notas internas.',
                  de: 'Hier erscheinen nach Aktivierung nur für Eltern veröffentlichte Rückmeldungen. Interne Notizen werden nie angezeigt.',
                  pt: 'Apenas as observações publicadas para os encarregados aparecerão aqui após ativação. Notas internas nunca são mostradas.',
                },
                language,
              )
            : pickText(
                {
                  ar: 'ملاحظات المواد غير متاحة للعرض حالياً. هذه الواجهة مخصّصة للقراءة فقط.',
                  fr: 'La consultation des appréciations par matière n’est pas encore disponible. Cette vue est en lecture seule.',
                  en: 'Subject-level teacher feedback is not yet available. This view is read-only.',
                  es: 'Las observaciones por asignatura aún no están disponibles. Esta vista es de solo lectura.',
                  de: 'Fachbezogene Rückmeldungen sind noch nicht verfügbar. Diese Ansicht ist schreibgeschützt.',
                  pt: 'As observações por disciplina ainda não estão disponíveis. Esta vista é apenas de leitura.',
                },
                language,
              )}
        </p>
      </section>
    </div>
  );
};
