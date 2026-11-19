import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  listSchoolStudents,
  getSchoolStudentIdentity,
  listAcademicYears,
  fetchSchoolClassesWithRosters,
  type SchoolStudentSummary,
  type SchoolStudentIdentityDetail,
  type AcademicYearItem,
} from '../../lib/schoolOperations';
import { canAccessAppTab } from '../homepages/homepageAccess';
import { HomePageHeader } from '../homepages/shared/HomePageHeader';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import {
  Users,
  Search,
  ArrowLeft,
  GraduationCap,
  ShieldAlert,
  RotateCw,
  Eye,
  AlertCircle,
  Building2,
  TrendingUp,
} from 'lucide-react';
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
  const { currentUser, language } = useApp();
  const isAuthorized = canAccessAppTab(currentUser, 'students');

  // List filters & state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('ALL');
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string; levelCode: string; academicYear?: string }>>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ALL');
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const [studentsData, setStudentsData] = useState<SchoolStudentSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  // Detail view state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialSelectedStudentId || null);
  const [studentDetail, setStudentDetail] = useState<SchoolStudentIdentityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRetrySeq, setDetailRetrySeq] = useState<number>(0);

  const actorScopeKey = `${currentUser?.id ?? 'anonymous'}:${currentUser?.role ?? ''}:${currentUser?.accountStatus ?? ''}:${(currentUser?.capabilities ?? []).slice().sort().join(',')}`;
  const previousActorScopeRef = useRef(actorScopeKey);
  const actorKeyRef = useRef(currentUser?.id || 'anonymous');
  const requestSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const listViewRef = useRef<HTMLDivElement>(null);
  const listFocusStudentRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialSelectedStudentId !== undefined) {
      setSelectedStudentId(initialSelectedStudentId || null);
    }
  }, [initialSelectedStudentId]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().slice(0, 100));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedYearId, selectedClassId, statusFilter]);

  // Load metadata under the current authorized actor; never invent filter options on error.
  useEffect(() => {
    if (!isAuthorized) return;
    let active = true;
    async function loadMetadata() {
      setMetadataError(null);
      try {
        const [yearsRes, classesRes] = await Promise.all([
          listAcademicYears(),
          fetchSchoolClassesWithRosters(),
        ]);
        if (!active) return;
        if (!yearsRes.ok || !yearsRes.data || !classesRes.ok || !classesRes.data) {
          setMetadataError(yearsRes.errorMessage || classesRes.errorMessage || 'Unable to load academic filter options.');
        }
        setAcademicYears(yearsRes.ok && yearsRes.data ? yearsRes.data : []);
        setAvailableClasses(classesRes.ok && classesRes.data
          ? classesRes.data.map((c) => ({
              id: c.id,
              name: c.name,
              levelCode: c.levelCode || 'CP',
              academicYear: c.academicYear,
            }))
          : []);
      } catch (error) {
        if (!active) return;
        setAcademicYears([]);
        setAvailableClasses([]);
        setMetadataError(error instanceof Error ? error.message : 'Unable to load academic filter options.');
      }
    }
    void loadMetadata();
    return () => { active = false; };
  }, [isAuthorized, actorScopeKey]);

  // Server-owned search; response generation prevents stale search/page writes.
  const loadStudents = async () => {
    if (!isAuthorized) return;
    const currentActor = currentUser?.id || 'anonymous';
    const reqId = ++requestSeqRef.current;
    setLoadingList(true);
    setListError(null);
    try {
      const res = await listSchoolStudents({
        p_search: debouncedQuery || null,
        p_academic_year_id: selectedYearId === 'ALL' ? null : selectedYearId,
        p_class_id: selectedClassId === 'ALL' ? null : selectedClassId,
        p_status: statusFilter,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });
      if (reqId !== requestSeqRef.current || actorKeyRef.current !== currentActor) return;
      setLoadingList(false);
      if (!res.ok || !res.data) {
        setListError(res.errorMessage || 'Failed to load school students.');
        setStudentsData([]);
        setTotalCount(0);
        return;
      }
      setStudentsData(res.data.items || []);
      setTotalCount(res.data.total ?? 0);
    } catch (error) {
      if (reqId !== requestSeqRef.current || actorKeyRef.current !== currentActor) return;
      setLoadingList(false);
      setStudentsData([]);
      setTotalCount(0);
      setListError(error instanceof Error ? error.message : 'Failed to load school students.');
    }
  };

  useEffect(() => {
    void loadStudents();
    return () => { requestSeqRef.current++; };
  }, [debouncedQuery, selectedYearId, selectedClassId, statusFilter, page, actorScopeKey, isAuthorized]);

  // Fetch student detail when selectedStudentId changes
  useEffect(() => {
    if (!selectedStudentId) {
      setStudentDetail(null);
      setDetailError(null);
      return;
    }
    const currentActor = currentUser?.id || 'anonymous';
    const reqId = ++detailSeqRef.current;
    let active = true;

    async function loadDetail() {
      setLoadingDetail(true);
      setDetailError(null);
      setStudentDetail(null);
      try {
        const res = await getSchoolStudentIdentity(selectedStudentId!);
        if (!active || reqId !== detailSeqRef.current || actorKeyRef.current !== currentActor) return;
        setLoadingDetail(false);
        if (!res.ok || !res.data) {
          setDetailError(res.errorMessage || 'Failed to load student identity details.');
          return;
        }
        if (res.data.studentId !== selectedStudentId) {
          setDetailError('Student identity mismatch detected.');
          return;
        }
        setStudentDetail(res.data);
      } catch (error) {
        if (!active || reqId !== detailSeqRef.current || actorKeyRef.current !== currentActor) return;
        setLoadingDetail(false);
        setDetailError(error instanceof Error ? error.message : 'Failed to load student identity details.');
      }
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedStudentId, actorScopeKey, detailRetrySeq]);

  // Reset only on an actual actor/authority change. Initial mount must preserve a deep link.
  useEffect(() => {
    if (previousActorScopeRef.current === actorScopeKey) return;
    previousActorScopeRef.current = actorScopeKey;
    actorKeyRef.current = currentUser?.id || 'anonymous';
    requestSeqRef.current++;
    detailSeqRef.current++;
    setSelectedStudentId(null);
    setStudentDetail(null);
    setStudentsData([]);
    setTotalCount(0);
    setSearchQuery('');
    setDebouncedQuery('');
    setAcademicYears([]);
    setAvailableClasses([]);
    setMetadataError(null);
    setSelectedYearId('ALL');
    setSelectedClassId('ALL');
    setStatusFilter('ALL');
    setPage(1);
    listFocusStudentRef.current = null;
    setListError(null);
    setDetailError(null);
    setLoadingList(false);
    setLoadingDetail(false);
  }, [actorScopeKey]);

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

  // Restore list keyboard focus after returning from a locally opened dossier.
  useEffect(() => {
    if (selectedStudentId || loadingList || !listFocusStudentRef.current) return;
    const id = listFocusStudentRef.current;
    const target = listViewRef.current?.querySelector<HTMLElement>(`[data-testid="students-view-${id}"]`);
    (target ?? listViewRef.current?.querySelector<HTMLElement>('input[type="text"]'))?.focus();
    listFocusStudentRef.current = null;
  }, [selectedStudentId, loadingList]);

  // If a student is selected, render the administrative student overview panel
  if (selectedStudentId) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-6 px-4 sm:px-6" ref={listViewRef}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setSelectedStudentId(null);
              setStudentDetail(null);
              if (onBackToOrigin) {
                onBackToOrigin();
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>
              {navOrigin === 'roster'
                ? (language === 'ar' ? 'العودة إلى القسم' : language === 'fr' ? 'Retour à la classe' : 'Back to Class Roster')
                : (language === 'ar' ? 'العودة إلى قائمة التلاميذ' : language === 'fr' ? 'Retour aux élèves' : 'Back to Students List')}
            </span>
          </button>
        </div>

        {loadingDetail ? (
          <div className="p-12 text-center bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <RotateCw className="w-8 h-8 animate-spin mx-auto text-k-brand mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {language === 'ar' ? 'جاري تحميل ملف التلميذ...' : language === 'fr' ? 'Chargement du dossier élève...' : 'Loading student dossier...'}
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
              onClick={() => setDetailRetrySeq((s) => s + 1)}
              className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
              {language === 'ar' ? 'إعادة المحاولة' : language === 'fr' ? 'Réessayer' : 'Retry'}
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
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${studentDetail.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
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
                    {language === 'ar' ? 'تاريخ الميلاد' : language === 'fr' ? 'Date de naissance' : 'Birth Date'}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">{studentDetail.birthDate}</span>
                </div>
                <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                  <span className="text-gray-500 dark:text-gray-400 block">
                    {language === 'ar' ? 'حساب التلميذ المرتبط' : language === 'fr' ? 'Compte élève lié' : 'Linked Student Account'}
                  </span>
                  <span className={`font-bold ${studentDetail.hasLinkedStudentAccount ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {studentDetail.hasLinkedStudentAccount
                      ? (language === 'ar' ? 'مرتبط' : language === 'fr' ? 'Lié' : 'Linked')
                      : (language === 'ar' ? 'غير مرتبط' : language === 'fr' ? 'Non lié' : 'Not Linked')}
                  </span>
                </div>
              </div>
            </div>

            {/* Memberships & Enrollment History */}
            <div className="p-6 sm:p-8 space-y-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-k-brand" />
                <span>
                  {language === 'ar' ? 'سجل الأقسام والتسجيل' : language === 'fr' ? 'Historique des classes et inscriptions' : 'Class Membership & Enrollment History'}
                </span>
              </h3>

              {(!studentDetail.memberships || studentDetail.memberships.length === 0) ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 py-4">
                  {language === 'ar' ? 'لا توجد تسجيلات مسجلة لهذا التلميذ.' : language === 'fr' ? 'Aucune inscription enregistrée pour cet élève.' : 'No class memberships recorded for this student.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                        <th className="py-3 px-4 font-semibold text-start">
                          {language === 'ar' ? 'السنة الدراسية' : language === 'fr' ? 'Année académique' : 'Academic Year'}
                        </th>
                        <th className="py-3 px-4 font-semibold text-start">
                          {language === 'ar' ? 'القسم' : language === 'fr' ? 'Classe' : 'Class'}
                        </th>
                        <th className="py-3 px-4 font-semibold text-start">
                          {language === 'ar' ? 'المستوى' : language === 'fr' ? 'Niveau' : 'Level'}
                        </th>
                        <th className="py-3 px-4 font-semibold text-start">
                          {language === 'ar' ? 'حالة التسجيل' : language === 'fr' ? 'Statut inscription' : 'Enrollment Status'}
                        </th>
                        <th className="py-3 px-4 font-semibold text-start">
                          {language === 'ar' ? 'الفترة' : language === 'fr' ? 'Période' : 'Period'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {studentDetail.memberships.map((m) => (
                        <tr key={m.membershipId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-gray-900 dark:text-white">
                            {m.academicYearCode}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>{m.className}</span>
                              {m.classArchived && (
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">
                                  {language === 'ar' ? 'مؤرشف' : language === 'fr' ? 'Archivé' : 'Archived'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-300">
                            {m.levelCode}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${m.enrollmentStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
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
                    {language === 'ar'
                      ? 'ملخص الأداء الأكاديمي والنتائج'
                      : language === 'fr'
                      ? 'Résumé des performances et résultats'
                      : 'Academic Performance & Results Summary'}
                  </span>
                </h3>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {language === 'ar'
                    ? 'النتائج الدراسية غير متاحة حاليًا. ستظهر الأعداد وتطور مستوى التلميذ هنا بعد تفعيل نظام التقييم المدرسي والتحقق منه.'
                    : language === 'fr'
                    ? 'Les résultats scolaires ne sont pas encore disponibles. Les notes et la progression apparaîtront ici après la mise en place et la vérification du système d’évaluation.'
                    : 'Academic performance records are not available yet. Grades and progress will appear here when the school\'s assessment system is configured and verified.'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
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

      {metadataError && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{metadataError}</p>}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111] p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'بحث بالاسم أو رمز التلميذ...'
                  : language === 'fr'
                  ? 'Rechercher par nom ou code...'
                  : 'Search by name or student code...'
              }
              maxLength={100}
              className="w-full ps-10 pe-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
            />
          </div>

          {/* Academic Year Filter */}
          <div className="relative">
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              aria-label={language === 'ar' ? 'السنة الدراسية' : language === 'fr' ? 'Année académique' : 'Academic Year'}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-k-brand cursor-pointer"
            >
              <option value="ALL">
                {language === 'ar' ? 'جميع السنوات الدراسية' : language === 'fr' ? 'Toutes les années' : 'All Academic Years'}
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
              onChange={(e) => setSelectedClassId(e.target.value)}
              aria-label={language === 'ar' ? 'القسم' : language === 'fr' ? 'Classe' : 'Class'}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-k-brand cursor-pointer"
            >
              <option value="ALL">
                {language === 'ar' ? 'جميع الأقسام (بما فيها غير المعينين)' : language === 'fr' ? 'Toutes les classes' : 'All Classes & Unassigned'}
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
              onChange={(e) => setStatusFilter(e.target.value as 'ACTIVE' | 'ARCHIVED' | 'ALL')}
              aria-label={language === 'ar' ? 'الحالة' : language === 'fr' ? 'Statut' : 'Status'}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-k-brand cursor-pointer"
            >
              <option value="ALL">
                {language === 'ar' ? 'جميع الحالات' : language === 'fr' ? 'Tous les statuts' : 'All Statuses'}
              </option>
              <option value="ACTIVE">
                {language === 'ar' ? 'نشط فقط' : language === 'fr' ? 'Actifs seulement' : 'Active Only'}
              </option>
              <option value="ARCHIVED">
                {language === 'ar' ? 'مؤرشف فقط' : language === 'fr' ? 'Archivés seulement' : 'Archived Only'}
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
            {language === 'ar' ? 'جاري البحث في تلاميذ المدرسة...' : language === 'fr' ? 'Recherche des élèves en cours...' : 'Searching school pupils...'}
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
            onClick={() => void loadStudents()}
            className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            {language === 'ar' ? 'إعادة المحاولة' : language === 'fr' ? 'Réessayer' : 'Retry'}
          </button>
        </div>
      ) : studentsData.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
          <Users className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'لم يتم العثور على تلاميذ مطابقة' : language === 'fr' ? 'Aucun élève trouvé' : 'No students found'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {language === 'ar'
              ? 'جرب تعديل كلمات البحث أو تغيير مرشحات السنوات والأقسام.'
              : language === 'fr'
              ? 'Essayez de modifier vos critères de recherche ou de réinitialiser les filtres.'
              : 'Try adjusting your search query or academic filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>
              {totalCount} {language === 'ar' ? 'تلميذ مطابق' : language === 'fr' ? 'élèves correspondants' : 'matching pupils'}
            </span>
            <span>
              {language === 'ar' ? `الصفحة ${page} من ${totalPages}` : language === 'fr' ? `Page ${page} sur ${totalPages}` : `Page ${page} of ${totalPages}`}
            </span>
          </div>

          <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-900/75 text-gray-500 dark:text-gray-400">
                    <th className="py-3.5 px-4 font-semibold text-start">
                      {language === 'ar' ? 'التلميذ والرمز' : language === 'fr' ? 'Élève et code' : 'Student & Code'}
                    </th>
                    <th className="py-3.5 px-4 font-semibold text-start">
                      {language === 'ar' ? 'الحالة' : language === 'fr' ? 'Statut' : 'Status'}
                    </th>
                    <th className="py-3.5 px-4 font-semibold text-start">
                      {language === 'ar' ? 'الأقسام الحالية' : language === 'fr' ? 'Classes actuelles' : 'Current Classes'}
                    </th>
                    <th className="py-3.5 px-4 font-semibold text-end">
                      {language === 'ar' ? 'الإجراء' : language === 'fr' ? 'Action' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {studentsData.map((stu) => (
                    <tr key={stu.studentId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          data-testid={`students-view-${stu.studentId}`}
                          onClick={() => { listFocusStudentRef.current = stu.studentId; setSelectedStudentId(stu.studentId); }}
                          className="font-bold text-gray-900 dark:text-white hover:text-k-brand text-start transition-colors block"
                        >
                          {stu.fullName}
                        </button>
                        <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 block mt-0.5">
                          {stu.studentCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${stu.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                          {stu.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {!stu.classes || stu.classes.length === 0 ? (
                          <span className="text-gray-400 italic text-[11px]">
                            {language === 'ar' ? 'غير مسجل في قسم' : language === 'fr' ? 'Non assigné' : 'Unassigned'}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {stu.classes.map((c) => (
                              <span key={c.membershipId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-[11px] font-medium">
                                <Building2 className="w-3 h-3 text-k-brand" />
                                <span>{c.className}</span>
                                <span className="text-gray-400">·</span>
                                <span className="font-mono text-[10px] text-gray-500">{c.academicYearCode}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-end">
                        <button
                          type="button"
                          onClick={() => { listFocusStudentRef.current = stu.studentId; setSelectedStudentId(stu.studentId); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-k-brand/10 hover:bg-k-brand/20 text-k-brand rounded-xl font-bold text-xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{language === 'ar' ? 'عرض الملف' : language === 'fr' ? 'Consulter' : 'View'}</span>
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-xs"
                >
                  {language === 'ar' ? 'السابق' : language === 'fr' ? 'Précédent' : 'Previous'}
                </button>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-xs"
                >
                  {language === 'ar' ? 'التالي' : language === 'fr' ? 'Suivant' : 'Next'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
