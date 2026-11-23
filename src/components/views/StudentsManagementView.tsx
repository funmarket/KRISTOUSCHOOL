import React from 'react';
import { HomePageHeader } from '../homepages/shared/HomePageHeader';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { useStudentsManagement } from './students/useStudentsManagement';
import { StudentDossierDrawer } from './students/StudentDossierDrawer';
import { StudentDirectoryList } from './students/StudentDirectoryList';
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
          title={
            language === 'ar'
              ? 'صلاحية الإدارة المطلوبة'
              : language === 'fr'
              ? 'Accès administratif requis'
              : 'Administrative Access Required'
          }
          description={
            language === 'ar'
              ? 'هذه المنطقة مخصصة لمسؤولي المدرسة ومديري النظام والموظفين المفوضين فقط.'
              : language === 'fr'
              ? 'Cette zone est réservée aux administrateurs scolaires et au personnel autorisé.'
              : 'This school-wide students area is restricted to authorized school administrators, office personnel, and delegated managers.'
          }
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
        badgeText={language === 'ar' ? 'إدارة التلاميذ' : language === 'fr' ? 'Élèves' : 'School Students'}
        title={
          language === 'ar'
            ? 'إدارة التلاميذ وسجلهم المدرسي'
            : language === 'fr'
            ? 'Gestion des élèves & Dossiers'
            : 'School Students Directory & Overview'
        }
        subtitle={
          language === 'ar'
            ? 'البحث في جميع تلاميذ المدرسة، تصفية الأقسام والسنوات، ومراجعة الهوية والتاريخ الدراسي.'
            : language === 'fr'
            ? 'Recherche globale des élèves, filtres par année/classe, et consultation des dossiers.'
            : 'School-wide pupil search, academic year and class filtering, and administrative identity records.'
        }
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
