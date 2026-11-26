import React from 'react';
import type { Language } from '../../../types';
import { pickText } from '../../../i18n/homepages';
import type { SchoolStudentIdentityDetail } from '../../../lib/schoolOperations';
import {
  ArrowLeft,
  GraduationCap,
  RotateCw,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

export interface StudentDossierDrawerProps {
  language: Language;
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
            {pickText(
              navOrigin === 'roster'
                ? { ar: 'العودة إلى القسم', fr: 'Retour à la classe', en: 'Back to Class Roster', es: 'Volver a la clase', de: 'Zurück zur Klassenliste', pt: 'Voltar à turma' }
                : { ar: 'العودة إلى قائمة التلاميذ', fr: 'Retour aux élèves', en: 'Back to Students List', es: 'Volver a la lista de alumnos', de: 'Zurück zur Schülerliste', pt: 'Voltar à lista de alunos' },
              language,
            )}
          </span>
        </button>
      </div>

      {loadingDetail ? (
        <div className="p-12 text-center bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <RotateCw className="w-8 h-8 animate-spin mx-auto text-k-brand mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {pickText({ ar: 'جاري تحميل ملف التلميذ...', fr: 'Chargement du dossier élève...', en: 'Loading student dossier...', es: 'Cargando expediente del alumno...', de: 'Schülerakte wird geladen...', pt: 'A carregar dossier do aluno...' }, language)}
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
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
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
                  {pickText({ ar: 'تاريخ الميلاد', fr: 'Date de naissance', en: 'Birth Date', es: 'Fecha de nacimiento', de: 'Geburtsdatum', pt: 'Data de nascimento' }, language)}
                </span>
                <span className="font-bold text-gray-900 dark:text-white font-mono">
                  {studentDetail.birthDate}
                </span>
              </div>
              <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                <span className="text-gray-500 dark:text-gray-400 block">
                  {pickText({ ar: 'حساب التلميذ المرتبط', fr: 'Compte élève lié', en: 'Linked Student Account', es: 'Cuenta de alumno vinculada', de: 'Verknüpftes Schülerkonto', pt: 'Conta de aluno associada' }, language)}
                </span>
                <span
                  className={`font-bold ${
                    studentDetail.hasLinkedStudentAccount
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {pickText(
                    studentDetail.hasLinkedStudentAccount
                      ? { ar: 'مرتبط', fr: 'Lié', en: 'Linked', es: 'Vinculada', de: 'Verknüpft', pt: 'Associada' }
                      : { ar: 'غير مرتبط', fr: 'Non lié', en: 'Not Linked', es: 'Sin vincular', de: 'Nicht verknüpft', pt: 'Não associada' },
                    language,
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Memberships & Enrollment History */}
          <div className="p-6 sm:p-8 space-y-6">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-k-brand" />
              <span>
                {pickText({ ar: 'سجل الأقسام والتسجيل', fr: 'Historique des classes et inscriptions', en: 'Class Membership & Enrollment History', es: 'Historial de clases y matrícula', de: 'Klassen- und Einschreibehistorie', pt: 'Histórico de turmas e inscrição' }, language)}
              </span>
            </h3>

            {!studentDetail.memberships || studentDetail.memberships.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-4">
                {pickText({ ar: 'لا توجد تسجيلات مسجلة لهذا التلميذ.', fr: 'Aucune inscription enregistrée pour cet élève.', en: 'No class memberships recorded for this student.', es: 'No hay matrículas registradas para este alumno.', de: 'Für diesen Schüler sind keine Einschreibungen verzeichnet.', pt: 'Não há inscrições registadas para este aluno.' }, language)}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                      <th className="py-3 px-4 font-semibold text-start">
                        {pickText({ ar: 'السنة الدراسية', fr: 'Année académique', en: 'Academic Year', es: 'Año académico', de: 'Schuljahr', pt: 'Ano letivo' }, language)}
                      </th>
                      <th className="py-3 px-4 font-semibold text-start">
                        {pickText({ ar: 'القسم', fr: 'Classe', en: 'Class', es: 'Clase', de: 'Klasse', pt: 'Turma' }, language)}
                      </th>
                      <th className="py-3 px-4 font-semibold text-start">
                        {pickText({ ar: 'المستوى', fr: 'Niveau', en: 'Level', es: 'Nivel', de: 'Stufe', pt: 'Nível' }, language)}
                      </th>
                      <th className="py-3 px-4 font-semibold text-start">
                        {pickText({ ar: 'حالة التسجيل', fr: 'Statut inscription', en: 'Enrollment Status', es: 'Estado de matrícula', de: 'Einschreibestatus', pt: 'Estado da inscrição' }, language)}
                      </th>
                      <th className="py-3 px-4 font-semibold text-start">
                        {pickText({ ar: 'الفترة', fr: 'Période', en: 'Period', es: 'Periodo', de: 'Zeitraum', pt: 'Período' }, language)}
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
                                {pickText({ ar: 'مؤرشف', fr: 'Archivé', en: 'Archived', es: 'Archivado', de: 'Archiviert', pt: 'Arquivado' }, language)}
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
                  {pickText({ ar: 'ملخص الأداء الأكاديمي والنتائج', fr: 'Résumé des performances et résultats', en: 'Academic Performance & Results Summary', es: 'Resumen de rendimiento y resultados', de: 'Übersicht über Leistung und Ergebnisse', pt: 'Resumo de desempenho e resultados' }, language)}
                </span>
              </h3>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                {pickText({ ar: 'النتائج الدراسية غير متاحة حاليًا. ستظهر الأعداد وتطور مستوى التلميذ هنا بعد تفعيل نظام التقييم المدرسي والتحقق منه.', fr: 'Les résultats scolaires ne sont pas encore disponibles. Les notes et la progression apparaîtront ici après la mise en place et la vérification du système d’évaluation.', en: "Academic performance records are not available yet. Grades and progress will appear here when the school's assessment system is configured and verified.", es: 'Los registros académicos aún no están disponibles. Las notas y el progreso aparecerán aquí cuando se configure y verifique el sistema de evaluación.', de: 'Leistungsnachweise sind noch nicht verfügbar. Noten und Fortschritte erscheinen hier, sobald das Bewertungssystem eingerichtet und bestätigt ist.', pt: 'Os registos académicos ainda não estão disponíveis. As notas e o progresso aparecerão aqui quando o sistema de avaliação estiver configurado e verificado.' }, language)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
