import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Layers,
  Lock,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { pickText } from '../../i18n/homepages';
import {
  buildPerformanceActorScopeKey,
  fetchMyTeacherSubjectAllocations,
  getLocalizedSubjectLabel,
  isAllocationResultApplicable,
  reconcileSelectedSubjectId,
  resolveParentPerformanceScope,
  resolvePostRefreshAction,
  resolveTeacherAllocationsFetchPlan,
  resolveTeacherPerformanceScope,
  resolveVisibleTeacherAllocations,
  type PerformanceActorSnapshot,
  type TeacherAllocationsState,
} from '../../lib/performance';
import type { TeacherAllocatedSubjectItem } from '../../types';

export const PerformanceView: React.FC = () => {
  const {
    currentUser,
    language,
    t,
    childrenList,
    classesList,
    classRosters,
    classesBackendStatus,
    classesError,
    schoolContextError,
    isHydratingSchoolData,
    selectedClassId,
    setSelectedClassId,
    selectedChildId,
    setSelectedChildId,
    refreshSchoolData,
  } = useApp();

  const isApproved = currentUser?.accountStatus === 'APPROVED';
  const isTeacher = Boolean(isApproved && currentUser?.role === 'TEACHER');
  const isParent = Boolean(isApproved && currentUser?.role === 'PARENT');
  const isAuthorizedRole = isTeacher || isParent;
  const canReadTeacherScope = isTeacher && !isHydratingSchoolData && classesBackendStatus === 'READY';

  const actorScopeKey = useMemo(
    () => buildPerformanceActorScopeKey(currentUser),
    [currentUser],
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshErrorScopeKey, setRefreshErrorScopeKey] = useState<string | null>(null);
  const [allocationsState, setAllocationsState] = useState<TeacherAllocationsState>(() => ({
    actorScopeKey,
    classId: '',
    status: 'LOADING',
    items: [],
    errorMessage: null,
  }));

  const mountedRef = useRef<boolean>(false);
  const requestSeqRef = useRef<number>(0);
  const refreshSeqRef = useRef<number>(0);
  const refreshLockRef = useRef<{
    id: number;
    actorScopeKey: string;
    promise: Promise<void>;
  } | null>(null);

  const teacherScope = useMemo(
    () =>
      resolveTeacherPerformanceScope({
        currentUser,
        classesList,
        classRosters,
        selectedClassId,
        selectedStudentId,
      }),
    [currentUser, classesList, classRosters, selectedClassId, selectedStudentId],
  );

  const parentScope = useMemo(
    () =>
      resolveParentPerformanceScope({
        currentUser,
        childrenList,
        selectedChildId,
      }),
    [currentUser, childrenList, selectedChildId],
  );

  const currentSnapshot: PerformanceActorSnapshot = {
    actorScopeKey,
    userId: currentUser?.id ?? '',
    isTeacher,
    canReadTeacherScope,
    activeClassId: teacherScope.activeClassId,
    currentUser,
  };
  const latestSnapshotRef = useRef<PerformanceActorSnapshot>(currentSnapshot);
  latestSnapshotRef.current = currentSnapshot;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSeqRef.current += 1;
      refreshSeqRef.current += 1;
      refreshLockRef.current = null;
    };
  }, []);

  // Clear transient selections and refresh error immediately when actor scope changes.
  const prevActorScopeKeyRef = useRef<string>(actorScopeKey);
  useEffect(() => {
    if (prevActorScopeKeyRef.current !== actorScopeKey) {
      prevActorScopeKeyRef.current = actorScopeKey;
      requestSeqRef.current += 1;
      setSelectedStudentId('');
      setSelectedSubjectId('');
      setRefreshErrorScopeKey(null);
      setIsRefreshing(false);
    }
  }, [actorScopeKey]);

  // Clear student & subject selection whenever the active class or linked child changes.
  useEffect(() => {
    setSelectedStudentId('');
    setSelectedSubjectId('');
  }, [teacherScope.activeClassId, parentScope.activeChildId]);

  const visibleAllocations = useMemo(
    () =>
      resolveVisibleTeacherAllocations({
        currentUser,
        currentActorScopeKey: actorScopeKey,
        activeClassId: teacherScope.activeClassId,
        activeClass: teacherScope.activeClass,
        isHydratingSchoolData,
        classesBackendStatus,
        classesError,
        allocationsState,
      }),
    [
      currentUser,
      actorScopeKey,
      teacherScope.activeClassId,
      teacherScope.activeClass,
      isHydratingSchoolData,
      classesBackendStatus,
      classesError,
      allocationsState,
    ],
  );

  // Keep selectedSubjectId strictly reconciled against current visible allocated subjects.
  useEffect(() => {
    const nextSubjectId = reconcileSelectedSubjectId(selectedSubjectId, visibleAllocations.items);
    if (nextSubjectId !== selectedSubjectId) {
      setSelectedSubjectId(nextSubjectId);
    }
  }, [visibleAllocations.items, selectedSubjectId]);

  const executeTeacherAllocationsFetch = useCallback(
    async (originActorScopeKey: string, originClassId: string, originTeacherUserId: string) => {
      const snapshot = latestSnapshotRef.current;
      if (
        !mountedRef.current ||
        !snapshot.isTeacher ||
        !snapshot.canReadTeacherScope ||
        snapshot.actorScopeKey !== originActorScopeKey ||
        snapshot.activeClassId !== originClassId
      ) {
        return;
      }

      const plan = resolveTeacherAllocationsFetchPlan(snapshot.currentUser, originClassId);
      const seq = ++requestSeqRef.current;

      if (!plan.shouldFetch) {
        setAllocationsState({
          actorScopeKey: originActorScopeKey,
          classId: originClassId,
          status: plan.status,
          items: [],
          errorMessage: null,
        });
        return;
      }

      setAllocationsState({
        actorScopeKey: originActorScopeKey,
        classId: originClassId,
        status: 'LOADING',
        items: [],
        errorMessage: null,
      });

      const res = await fetchMyTeacherSubjectAllocations(plan.classId, originTeacherUserId);
      if (
        !isAllocationResultApplicable({
          isMounted: mountedRef.current,
          requestSeq: seq,
          currentRequestSeq: requestSeqRef.current,
          originActorScopeKey,
          originClassId: plan.classId,
          currentSnapshot: latestSnapshotRef.current,
        })
      ) {
        return;
      }

      if (!res.ok) {
        setAllocationsState({
          actorScopeKey: originActorScopeKey,
          classId: plan.classId,
          status: res.status,
          items: [],
          errorMessage: res.errorMessage || res.errorCode || null,
        });
        return;
      }

      setAllocationsState({
        actorScopeKey: originActorScopeKey,
        classId: plan.classId,
        status: 'READY',
        items: res.data ?? [],
        errorMessage: null,
      });
    },
    [],
  );

  useEffect(() => {
    if (!isTeacher) {
      requestSeqRef.current += 1;
      setAllocationsState({
        actorScopeKey,
        classId: '',
        status: 'UNAUTHORIZED',
        items: [],
        errorMessage: null,
      });
      return;
    }

    if (isHydratingSchoolData) {
      requestSeqRef.current += 1;
      return;
    }

    if (classesBackendStatus !== 'READY') {
      requestSeqRef.current += 1;
      setAllocationsState({
        actorScopeKey,
        classId: teacherScope.activeClassId,
        status: classesBackendStatus,
        items: [],
        errorMessage: classesError || null,
      });
      return;
    }

    const plan = resolveTeacherAllocationsFetchPlan(currentUser, teacherScope.activeClassId);
    if (!plan.shouldFetch) {
      requestSeqRef.current += 1;
      setAllocationsState({
        actorScopeKey,
        classId: teacherScope.activeClassId,
        status: plan.status,
        items: [],
        errorMessage: null,
      });
      return;
    }

    void executeTeacherAllocationsFetch(actorScopeKey, plan.classId, plan.teacherUserId);
  }, [
    isTeacher,
    actorScopeKey,
    currentUser,
    teacherScope.activeClassId,
    isHydratingSchoolData,
    classesBackendStatus,
    classesError,
    executeTeacherAllocationsFetch,
  ]);

  const handleRefresh = useCallback(() => {
    const startSnapshot = latestSnapshotRef.current;
    if (refreshLockRef.current && refreshLockRef.current.actorScopeKey === startSnapshot.actorScopeKey) {
      return refreshLockRef.current.promise;
    }

    const originActorScopeKey = startSnapshot.actorScopeKey;
    const refreshId = ++refreshSeqRef.current;
    setRefreshErrorScopeKey(null);
    setIsRefreshing(true);

    const run = (async () => {
      let refreshSucceeded = false;
      try {
        refreshSucceeded = await refreshSchoolData();
      } catch {
        refreshSucceeded = false;
      }

      if (refreshId !== refreshSeqRef.current) {
        return;
      }

      const postAction = resolvePostRefreshAction({
        isMounted: mountedRef.current,
        originActorScopeKey,
        currentSnapshot: latestSnapshotRef.current,
        refreshSucceeded,
      });

      if (postAction.action === 'ABORT_UNMOUNTED' || postAction.action === 'ABORT_SCOPE_CHANGED') {
        return;
      }

      if (postAction.action === 'SURFACE_REFRESH_ERROR') {
        setRefreshErrorScopeKey(originActorScopeKey);
        return;
      }

      if (postAction.action === 'FETCH_TEACHER_ALLOCATIONS') {
        await executeTeacherAllocationsFetch(
          postAction.actorScopeKey,
          postAction.classId,
          postAction.teacherUserId,
        );
      }
    })().finally(() => {
      if (refreshLockRef.current?.id === refreshId) {
        refreshLockRef.current = null;
      }
      if (mountedRef.current && refreshId === refreshSeqRef.current) {
        setIsRefreshing(false);
      }
    });

    refreshLockRef.current = {
      id: refreshId,
      actorScopeKey: originActorScopeKey,
      promise: run,
    };

    return run;
  }, [refreshSchoolData, executeTeacherAllocationsFetch]);

  const subjectsGroupedByDomain = useMemo(() => {
    const map = new Map<string, TeacherAllocatedSubjectItem[]>();
    for (const item of visibleAllocations.items) {
      const domain = item.domainCode || 'GENERAL';
      const group = map.get(domain) || [];
      group.push(item);
      map.set(domain, group);
    }
    return map;
  }, [visibleAllocations.items]);

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
            },
            language,
          )}
        </p>
      </div>
    );
  }

  const showTeacherDetails = isTeacher && canReadTeacherScope;
  const activeSubject =
    visibleAllocations.status === 'READY'
      ? visibleAllocations.items.find((item) => item.subjectId === selectedSubjectId) ?? null
      : null;

  const hasRefreshError = refreshErrorScopeKey === actorScopeKey;

  const unavailableBadgeLabel = pickText(
    {
      ar: 'غير متاح حالياً',
      fr: 'Indisponible pour le moment',
      en: 'Currently unavailable',
    },
    language,
  );

  const readOnlyBadgeLabel = pickText(
    {
      ar: 'عرض للقراءة فقط',
      fr: 'Consultation seule',
      en: 'Read-only view',
    },
    language,
  );

  const serviceUnavailableLabel = pickText(
    {
      ar: 'الخدمة غير متاحة حالياً',
      fr: 'Service actuellement indisponible',
      en: 'Service currently unavailable',
    },
    language,
  );

  const retryLabel = pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language);

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
          {pickText({ ar: 'لا توجد أقسام مسندة', fr: 'Aucune classe assignée', en: 'No assigned classes' }, language)}
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
          {pickText({ ar: 'مادة مسندة', fr: 'matières attribuées', en: 'allocated subjects' }, language)}
        </span>
      </span>
    );
  };

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      data-testid="performance-view"
      className="space-y-6 pb-12"
    >
      {/* Top Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-k-brand/10 text-k-brand px-3 py-1 rounded-full text-xs font-bold">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>
                {isTeacher
                  ? pickText(
                      { ar: 'فضاء المربي', fr: 'Espace Enseignant', en: 'Teacher Scope' },
                      language,
                    )
                  : pickText(
                      { ar: 'فضاء الولي', fr: 'Espace Parent', en: 'Parent Scope' },
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
                  },
                  language,
                )
              : pickText(
                  {
                    ar: 'متابعة أطفالك المرتبطين بحسابك وحالة إتاحة النتائج والمنحنيات البيانية وملاحظات المربين حسب المادة.',
                    fr: 'Consultez vos enfants liés et la disponibilité des notes, graphiques de progression et appréciations par matière.',
                    en: 'View your linked children and the availability of published subject grades, academic progress charts, and teacher feedback.',
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
              {pickText({ ar: 'تحديث', fr: 'Actualiser', en: 'Refresh' }, language)}
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

      {/* Assessment Availability Notice */}
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
              },
              language,
            )}
          </p>
        </div>
      </div>

      {/* Authorized Scope Selectors */}
      {isTeacher && (
        <section
          data-testid="performance-teacher-scope-card"
          className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-k-brand" />
              <span>
                {pickText(
                  {
                    ar: 'نطاق التدريس المخوّل (الأقسام، التلاميذ، والمواد المسندة)',
                    fr: 'Périmètre enseignant autorisé (classes, élèves et matières attribuées)',
                    en: 'Authorized Teaching Scope (Assigned Classes, Class Students & Subjects)',
                  },
                  language,
                )}
              </span>
            </h2>
          </div>

          {isHydratingSchoolData ? (
            <div
              data-testid="performance-teacher-scope-loading"
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 text-xs text-gray-600 dark:text-gray-400"
            >
              {t('loading')}
            </div>
          ) : classesBackendStatus === 'ERROR' ? (
            <div
              data-testid="performance-teacher-scope-error"
              className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3"
            >
              <span>{classesError || t('error')}</span>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="shrink-0 font-extrabold underline"
              >
                {retryLabel}
              </button>
            </div>
          ) : classesBackendStatus === 'UNAUTHORIZED' ? (
            <div
              data-testid="performance-teacher-scope-unauthorized"
              className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300"
            >
              {t('unauthorized')}
            </div>
          ) : classesBackendStatus === 'BLOCKED_BACKEND' ? (
            <div
              data-testid="performance-teacher-scope-blocked"
              className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs font-semibold text-amber-800 dark:text-amber-300"
            >
              {serviceUnavailableLabel}
            </div>
          ) : teacherScope.authorizedClasses.length === 0 ? (
            <div
              data-testid="performance-teacher-no-classes"
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 text-xs text-gray-600 dark:text-gray-400"
            >
              {pickText(
                {
                  ar: 'لا توجد أقسام مسندة لحسابك حالياً. عند إسناد قسم لك ستظهر قائمة التلاميذ والمواد المسندة هنا.',
                  fr: 'Aucune classe assignée à votre compte pour le moment. Vos classes, élèves et matières attribuées apparaîtront ici après affectation.',
                  en: 'No classes are currently assigned to your teacher account. Assigned classes, class students, and subject allocations will appear once assigned.',
                },
                language,
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Assigned Class Picker */}
              <div className="space-y-1.5">
                <label
                  htmlFor="performance-class-select"
                  className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
                >
                  {t('classLabel')}
                </label>
                <select
                  id="performance-class-select"
                  data-testid="performance-class-select"
                  value={teacherScope.activeClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
                >
                  {teacherScope.authorizedClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.level} • {cls.academicYear})
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Roster Student Picker */}
              <div className="space-y-1.5">
                <label
                  htmlFor="performance-student-select"
                  className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
                >
                  {t('studentName')}
                </label>
                {teacherScope.authorizedStudents.length === 0 ? (
                  <div
                    data-testid="performance-roster-empty"
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-500"
                  >
                    {pickText(
                      {
                        ar: 'لا يوجد تلاميذ مسجلون في هذا القسم.',
                        fr: 'Aucun élève inscrit dans cette classe.',
                        en: 'No enrolled students in this class.',
                      },
                      language,
                    )}
                  </div>
                ) : (
                  <select
                    id="performance-student-select"
                    data-testid="performance-student-select"
                    value={teacherScope.activeStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
                  >
                    {teacherScope.authorizedStudents.map((stu) => (
                      <option key={stu.studentId} value={stu.studentId}>
                        {stu.fullName} ({stu.studentCode})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Allocated Subject Picker */}
              <div className="space-y-1.5">
                <label
                  htmlFor="performance-subject-select"
                  className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
                >
                  {pickText(
                    { ar: 'المادة المسندة', fr: 'Matière attribuée', en: 'Allocated Subject' },
                    language,
                  )}
                </label>

                {visibleAllocations.status === 'LOADING' ? (
                  <div
                    data-testid="performance-subjects-loading"
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-500"
                  >
                    {t('loading')}
                  </div>
                ) : visibleAllocations.status === 'UNAUTHORIZED' ? (
                  <div
                    data-testid="performance-subjects-unauthorized"
                    className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300"
                  >
                    {t('unauthorized')}
                  </div>
                ) : visibleAllocations.status === 'ERROR' ? (
                  <div
                    data-testid="performance-subjects-error"
                    className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3.5 py-2 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{visibleAllocations.errorMessage || t('error')}</span>
                    <button
                      type="button"
                      data-testid="performance-subjects-retry-btn"
                      onClick={() =>
                        void executeTeacherAllocationsFetch(
                          actorScopeKey,
                          teacherScope.activeClassId,
                          currentUser?.id ?? '',
                        )
                      }
                      className="shrink-0 font-extrabold underline"
                    >
                      {retryLabel}
                    </button>
                  </div>
                ) : visibleAllocations.status === 'BLOCKED_BACKEND' ? (
                  <div
                    data-testid="performance-subjects-blocked"
                    className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300"
                  >
                    {serviceUnavailableLabel}
                  </div>
                ) : visibleAllocations.items.length === 0 ? (
                  <div
                    data-testid="performance-subjects-empty"
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-500"
                  >
                    {pickText(
                      {
                        ar: 'لا توجد مواد مسندة لك في هذا القسم.',
                        fr: 'Aucune matière attribuée dans cette classe.',
                        en: 'No subjects allocated to you in this class.',
                      },
                      language,
                    )}
                  </div>
                ) : (
                  <select
                    id="performance-subject-select"
                    data-testid="performance-subject-select"
                    value={activeSubject?.subjectId ?? ''}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
                  >
                    {visibleAllocations.items.map((sub) => (
                      <option key={sub.subjectId} value={sub.subjectId}>
                        {getLocalizedSubjectLabel(sub, language)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Active Teacher Scope Summary & Subject Components (only when context & allocations are ready) */}
          {showTeacherDetails && teacherScope.activeClass && (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3 text-xs">
              <span
                data-testid="performance-active-scope-badge"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-gray-900 px-3 py-1.5 font-semibold text-gray-800 dark:text-gray-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-k-brand" />
                <span>
                  {teacherScope.activeClass.name}
                  {teacherScope.activeStudent ? ` — ${teacherScope.activeStudent.fullName}` : ''}
                </span>
              </span>

              {activeSubject && (
                <span
                  data-testid="performance-active-subject-badge"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-k-brand/10 px-3 py-1.5 font-bold text-k-brand"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{getLocalizedSubjectLabel(activeSubject, language)}</span>
                </span>
              )}

              {activeSubject && activeSubject.components.length > 0 && (
                <div
                  data-testid="performance-subject-components"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {activeSubject.components.map((comp) => (
                    <span
                      key={comp.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300"
                    >
                      {getLocalizedSubjectLabel(comp, language)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {isParent && (
        <section
          data-testid="performance-parent-scope-card"
          className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-k-brand" />
              <span>
                {pickText(
                  {
                    ar: 'أطفالك المرتبطون بالحساب',
                    fr: 'Vos enfants liés au compte',
                    en: 'Linked Children',
                  },
                  language,
                )}
              </span>
            </h2>
          </div>

          {isHydratingSchoolData ? (
            <div
              data-testid="performance-parent-loading"
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 text-xs text-gray-600 dark:text-gray-400"
            >
              {t('loading')}
            </div>
          ) : schoolContextError ? (
            <div
              data-testid="performance-parent-error"
              className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3"
            >
              <span>{schoolContextError}</span>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="shrink-0 font-extrabold underline"
              >
                {retryLabel}
              </button>
            </div>
          ) : parentScope.linkedChildren.length === 0 ? (
            <div
              data-testid="performance-parent-no-children"
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 text-xs text-gray-600 dark:text-gray-400"
            >
              {t('noLinkedChildren')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="performance-child-select"
                  className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
                >
                  {t('childConcerned')}
                </label>
                <select
                  id="performance-child-select"
                  data-testid="performance-child-select"
                  value={parentScope.activeChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-k-brand"
                >
                  {parentScope.linkedChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.fullName} — {child.className} ({child.level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {pickText(
                    { ar: 'مواد الطفل', fr: 'Matières de l’élève', en: 'Student Subjects' },
                    language,
                  )}
                </span>
                <div
                  data-testid="performance-parent-subjects-unavailable"
                  className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2"
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{unavailableBadgeLabel}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Status-Aware Academic Dashboard Grouped by Subject & Domain */}
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
                      },
                      language,
                    )
                  : pickText(
                      {
                        ar: 'عرض المواد المسندة ومكوّناتها الفرعية مجمّعة حسب المجال الدراسي',
                        fr: 'Affichage des matières attribuées et de leurs composantes par domaine',
                        en: 'Allocated subjects and their subject components grouped by learning domain',
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
                void (classesBackendStatus === 'READY' && teacherScope.activeClassId
                  ? executeTeacherAllocationsFetch(
                      actorScopeKey,
                      teacherScope.activeClassId,
                      currentUser?.id ?? '',
                    )
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
                },
                language,
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from(subjectsGroupedByDomain.entries()).map(([domainCode, subjects]) => (
              <div
                key={domainCode}
                data-testid={`dashboard-domain-group-${domainCode}`}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-k-brand font-mono">
                    {pickText({ ar: 'مجال:', fr: 'Domaine :', en: 'Domain:' }, language)} {domainCode}
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    {subjects.length}{' '}
                    {pickText({ ar: 'مادة', fr: 'matières', en: 'subjects' }, language)}
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
                          {pickText({ ar: 'نشط', fr: 'Actif', en: 'Active' }, language)}
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

      {/* Read-Only Assessment Displays (Unavailable Until School Assessment Tracking Is Enabled) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Student Grades Panel */}
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
                    { ar: 'النتائج والدرجات حسب المادة', fr: 'Notes par matière', en: 'Subject Grades' },
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
                },
                language,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between gap-2 tabular-nums">
            <span>
              {pickText(
                { ar: 'سجل التقييمات المنشورة', fr: 'Relevé d’évaluations', en: 'Published assessments' },
                language,
              )}
            </span>
            <span className="font-mono font-bold text-gray-700 dark:text-gray-300">—</span>
          </div>
        </section>

        {/* Academic Progress Chart Panel */}
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
                },
                language,
              )}
            </span>
          </div>
        </section>

        {/* Teacher Subject Feedback Panel */}
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
                  },
                  language,
                )
              : pickText(
                  {
                    ar: 'ملاحظات المواد غير متاحة للعرض حالياً. هذه الواجهة مخصّصة للقراءة فقط.',
                    fr: 'La consultation des appréciations par matière n’est pas encore disponible. Cette vue est en lecture seule.',
                    en: 'Subject-level teacher feedback is not yet available. This view is read-only.',
                  },
                  language,
                )}
          </p>
        </section>
      </div>
    </div>
  );
};
