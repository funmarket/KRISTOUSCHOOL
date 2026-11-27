import React from 'react';
import type { Language } from '../../../types';
import { pickText } from '../../../i18n/homepages';
import type {
  SchoolStudentSummary,
  AcademicYearItem,
} from '../../../lib/schoolOperations';
import type { AvailableStudentClassItem } from './useStudentsManagement';
import {
  Users,
  Search,
  RotateCw,
  Eye,
  AlertCircle,
  Building2,
} from 'lucide-react';

export interface StudentDirectoryListProps {
  language: Language;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  academicYears: AcademicYearItem[];
  selectedYearId: string;
  onSelectedYearIdChange: (val: string) => void;
  availableClasses: AvailableStudentClassItem[];
  selectedClassId: string;
  onSelectedClassIdChange: (val: string) => void;
  statusFilter: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  onStatusFilterChange: (val: 'ACTIVE' | 'ARCHIVED' | 'ALL') => void;
  loadingList: boolean;
  listError: string | null;
  onRetryList: () => void;
  studentsData: SchoolStudentSummary[];
  totalCount: number;
  page: number;
  totalPages: number;
  onPageChange: (updater: (prev: number) => number) => void;
  onSelectStudent: (studentId: string) => void;
}

export function StudentDirectoryList({
  language,
  searchQuery,
  onSearchQueryChange,
  academicYears,
  selectedYearId,
  onSelectedYearIdChange,
  availableClasses,
  selectedClassId,
  onSelectedClassIdChange,
  statusFilter,
  onStatusFilterChange,
  loadingList,
  listError,
  onRetryList,
  studentsData,
  totalCount,
  page,
  totalPages,
  onPageChange,
  onSelectStudent,
}: StudentDirectoryListProps) {
  return (
    <>
      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111] p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={pickText({ ar: 'بحث بالاسم أو رمز التلميذ...', fr: 'Rechercher par nom ou code...', en: 'Search by name or student code...', es: 'Buscar por nombre o código...', de: 'Nach Name oder Schülercode suchen...', pt: 'Pesquisar por nome ou código...' }, language)}
              maxLength={100}
              className="w-full ps-10 pe-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
            />
          </div>

          {/* Academic Year Filter */}
          <div className="relative">
            <select
              value={selectedYearId}
              onChange={(e) => onSelectedYearIdChange(e.target.value)}
              aria-label={pickText({ ar: 'السنة الدراسية', fr: 'Année académique', en: 'Academic Year', es: 'Año académico', de: 'Schuljahr', pt: 'Ano letivo' }, language)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-k-brand cursor-pointer"
            >
              <option value="ALL">
                {pickText({ ar: 'جميع السنوات الدراسية', fr: 'Toutes les années', en: 'All Academic Years', es: 'Todos los años académicos', de: 'Alle Schuljahre', pt: 'Todos os anos letivos' }, language)}
              </option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.code} {y.name ? `— ${y.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div className="relative">
            <select
              value={selectedClassId}
              onChange={(e) => onSelectedClassIdChange(e.target.value)}
              aria-label={pickText({ ar: 'القسم', fr: 'Classe', en: 'Class', es: 'Clase', de: 'Klasse', pt: 'Turma' }, language)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-k-brand cursor-pointer"
            >
              <option value="ALL">
                {pickText({ ar: 'جميع الأقسام (بما فيها غير المعينين)', fr: 'Toutes les classes', en: 'All Classes & Unassigned', es: 'Todas las clases y sin asignar', de: 'Alle Klassen & Nicht zugewiesen', pt: 'Todas as turmas e não atribuídos' }, language)}
              </option>
              {availableClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.levelCode})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) =>
                onStatusFilterChange(e.target.value as 'ACTIVE' | 'ARCHIVED' | 'ALL')
              }
              aria-label={pickText({ ar: 'الحالة', fr: 'Statut', en: 'Status', es: 'Estado', de: 'Status', pt: 'Estado' }, language)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-k-brand cursor-pointer"
            >
              <option value="ALL">
                {pickText({ ar: 'جميع الحالات', fr: 'Tous les statuts', en: 'All Statuses', es: 'Todos los estados', de: 'Alle Status', pt: 'Todos os estados' }, language)}
              </option>
              <option value="ACTIVE">
                {pickText({ ar: 'نشط فقط', fr: 'Actifs seulement', en: 'Active Only', es: 'Solo activos', de: 'Nur aktive', pt: 'Apenas ativos' }, language)}
              </option>
              <option value="ARCHIVED">
                {pickText({ ar: 'مؤرشف فقط', fr: 'Archivés seulement', en: 'Archived Only', es: 'Solo archivados', de: 'Nur archivierte', pt: 'Apenas arquivados' }, language)}
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Display */}
      {loadingList ? (
        <div className="p-16 text-center bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <RotateCw className="w-8 h-8 animate-spin mx-auto text-k-brand mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {pickText({ ar: 'جاري البحث في تلاميذ المدرسة...', fr: 'Recherche des élèves en cours...', en: 'Searching school pupils...', es: 'Buscando alumnos de la escuela...', de: 'Schüler werden gesucht...', pt: 'A pesquisar alunos da escola...' }, language)}
          </p>
        </div>
      ) : listError ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-700 dark:text-red-300 space-y-3">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{listError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryList}
            className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
          </button>
        </div>
      ) : studentsData.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
          <Users className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {pickText({ ar: 'لم يتم العثور على تلاميذ مطابقة', fr: 'Aucun élève trouvé', en: 'No students found', es: 'No se encontraron alumnos', de: 'Keine Schüler gefunden', pt: 'Nenhum aluno encontrado' }, language)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {pickText({ ar: 'جرب تعديل كلمات البحث أو تغيير مرشحات السنوات والأقسام.', fr: 'Essayez de modifier vos critères de recherche ou de réinitialiser les filtres.', en: 'Try adjusting your search query or academic filters.', es: 'Pruebe a ajustar su búsqueda o los filtros académicos.', de: 'Passen Sie Ihre Suche oder die akademischen Filter an.', pt: 'Experimente ajustar a pesquisa ou os filtros académicos.' }, language)}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>
              {totalCount}{' '}
              {pickText({ ar: 'تلميذ مطابق', fr: 'élèves correspondants', en: 'matching pupils', es: 'alumnos coincidentes', de: 'passende Schüler', pt: 'alunos correspondentes' }, language)}
            </span>
            <span>
              {pickText({ ar: `الصفحة ${page} من ${totalPages}`, fr: `Page ${page} sur ${totalPages}`, en: `Page ${page} of ${totalPages}`, es: `Página ${page} de ${totalPages}`, de: `Seite ${page} von ${totalPages}`, pt: `Página ${page} de ${totalPages}` }, language)}
            </span>
          </div>

          <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-900/75 text-gray-500 dark:text-gray-400">
                    <th className="py-3.5 px-4 font-semibold text-start">
                      {pickText({ ar: 'التلميذ والرمز', fr: 'Élève et code', en: 'Student & Code', es: 'Alumno y código', de: 'Schüler & Code', pt: 'Aluno e código' }, language)}
                    </th>
                    <th className="py-3.5 px-4 font-semibold text-start">
                      {pickText({ ar: 'الحالة', fr: 'Statut', en: 'Status', es: 'Estado', de: 'Status', pt: 'Estado' }, language)}
                    </th>
                    <th className="py-3.5 px-4 font-semibold text-start">
                      {pickText({ ar: 'الأقسام الحالية', fr: 'Classes actuelles', en: 'Current Classes', es: 'Clases actuales', de: 'Aktuelle Klassen', pt: 'Turmas atuais' }, language)}
                    </th>
                    <th className="py-3.5 px-4 font-semibold text-end">
                      {pickText({ ar: 'الإجراء', fr: 'Action', en: 'Action', es: 'Acción', de: 'Aktion', pt: 'Ação' }, language)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {studentsData.map((stu) => (
                    <tr
                      key={stu.studentId}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(stu.studentId)}
                          className="font-bold text-gray-900 dark:text-white hover:text-k-brand text-start transition-colors block"
                        >
                          {stu.fullName}
                        </button>
                        <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 block mt-0.5">
                          {stu.studentCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            stu.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                          }`}
                        >
                          {stu.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {!stu.classes || stu.classes.length === 0 ? (
                          <span className="inline-block px-2 py-1 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 font-bold text-[11px]">
                            {pickText({ ar: 'غير مسجل في قسم', fr: 'Non assigné', en: 'Unassigned', es: 'Sin asignar', de: 'Nicht zugewiesen', pt: 'Não atribuído' }, language)}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {stu.classes.map((c) => (
                              <span
                                key={c.membershipId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-[11px] font-medium"
                              >
                                <Building2 className="w-3 h-3 text-k-brand" />
                                <span>{c.className}</span>
                                <span className="text-gray-400">·</span>
                                <span className="font-mono text-[10px] text-gray-500">
                                  {c.academicYearCode}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-end">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(stu.studentId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-k-brand/10 hover:bg-k-brand/20 text-k-brand rounded-xl font-bold text-xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {pickText({ ar: 'عرض الملف', fr: 'Consulter', en: 'View', es: 'Ver', de: 'Anzeigen', pt: 'Ver' }, language)}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onPageChange((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-xs"
                >
                  {pickText({ ar: 'السابق', fr: 'Précédent', en: 'Previous', es: 'Anterior', de: 'Zurück', pt: 'Anterior' }, language)}
                </button>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-xs"
                >
                  {pickText({ ar: 'التالي', fr: 'Suivant', en: 'Next', es: 'Siguiente', de: 'Weiter', pt: 'Seguinte' }, language)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
