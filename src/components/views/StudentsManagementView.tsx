import React from 'react';
import { HomePageHeader } from '../homepages/shared/HomePageHeader';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { useStudentsManagement } from './students/useStudentsManagement';
import { StudentDossierDrawer } from './students/StudentDossierDrawer';
import { StudentDirectoryList } from './students/StudentDirectoryList';
import { pickText } from '../../i18n/homepages';
import '../homepages/shared/HomePageLayout.css';

export interface StudentsManagementViewProps {
  onOpenClass?: (classId: string) => void;
  initialSelectedStudentId?: string | null;
  navOrigin?: 'students' | 'roster';
  onBackToOrigin?: () => void;
}

export function StudentsManagementView({
  onOpenClass: _onOpenClass,
  initialSelectedStudentId,
  navOrigin = 'students',
  onBackToOrigin,
}: StudentsManagementViewProps) {
  const {
    language,
    isAuthorized,
    searchQuery,
    setSearchQuery,
    academicYears,
    selectedYearId,
    setSelectedYearId,
    availableClasses,
    selectedClassId,
    setSelectedClassId,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    pageSize,
    studentsData,
    totalCount,
    loadingList,
    listError,
    loadStudents,
    selectedStudentId,
    setSelectedStudentId,
    studentDetail,
    setStudentDetail,
    loadingDetail,
    detailError,
    setDetailRetrySeq,
    listViewRef,
  } = useStudentsManagement({ initialSelectedStudentId });

  if (!isAuthorized) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8 px-4">
        <EmptyFeatureState
          state="UNAUTHORIZED"
          title={pickText({ ar: 'صلاحية الإدارة المطلوبة', fr: 'Accès administratif requis', en: 'Administrative Access Required', es: 'Acceso administrativo requerido', de: 'Administrativer Zugriff erforderlich', pt: 'Acesso administrativo necessário' }, language)}
          description={pickText({ ar: 'هذه المنطقة مخصصة لمسؤولي المدرسة ومديري النظام والموظفين المفوضين فقط.', fr: 'Cette zone est réservée aux administrateurs scolaires et au personnel autorisé.', en: 'This school-wide students area is restricted to authorized school administrators, office personnel, and delegated managers.', es: 'Esta área escolar de alumnos está restringida a administradores autorizados, personal de oficina y responsables delegados.', de: 'Dieser schulweite Schülerbereich ist auf autorisierte Schulleitung, Sekretariat und beauftragte Leiter beschränkt.', pt: 'Esta área escolar de alunos é restrita a administradores autorizados, pessoal administrativo e gestores delegados.' }, language)}
        />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (selectedStudentId) {
    return (
      <StudentDossierDrawer
        language={language}
        navOrigin={navOrigin}
        loadingDetail={loadingDetail}
        detailError={detailError}
        studentDetail={studentDetail}
        listViewRef={listViewRef}
        onBack={() => {
          setSelectedStudentId(null);
          setStudentDetail(null);
          if (onBackToOrigin) {
            onBackToOrigin();
          }
        }}
        onRetryDetail={() => setDetailRetrySeq((s) => s + 1)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8" ref={listViewRef}>
      <HomePageHeader
        badgeText={pickText({ ar: 'إدارة التلاميذ', fr: 'Élèves', en: 'School Students', es: 'Alumnos', de: 'Schüler', pt: 'Alunos' }, language)}
        title={pickText({ ar: 'إدارة التلاميذ وسجلهم المدرسي', fr: 'Gestion des élèves & Dossiers', en: 'School Students Directory & Overview', es: 'Directorio y expedientes de alumnos', de: 'Schülerverzeichnis & Übersicht', pt: 'Diretório e processos dos alunos' }, language)}
        subtitle={pickText({ ar: 'البحث في جميع تلاميذ المدرسة، تصفية الأقسام والسنوات، ومراجعة الهوية والتاريخ الدراسي.', fr: 'Recherche globale des élèves, filtres par année/classe, et consultation des dossiers.', en: 'School-wide pupil search, academic year and class filtering, and administrative identity records.', es: 'Búsqueda general de alumnos, filtros por año y clase, y consulta de expedientes.', de: 'Schulweite Schülersuche, Filter nach Schuljahr und Klasse sowie Verwaltungsakten.', pt: 'Pesquisa global de alunos, filtros por ano e turma e consulta de processos.' }, language)}
      />

      <StudentDirectoryList
        language={language}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        academicYears={academicYears}
        selectedYearId={selectedYearId}
        onSelectedYearIdChange={setSelectedYearId}
        availableClasses={availableClasses}
        selectedClassId={selectedClassId}
        onSelectedClassIdChange={setSelectedClassId}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        loadingList={loadingList}
        listError={listError}
        onRetryList={() => void loadStudents()}
        studentsData={studentsData}
        totalCount={totalCount}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onSelectStudent={setSelectedStudentId}
      />
    </div>
  );
}
