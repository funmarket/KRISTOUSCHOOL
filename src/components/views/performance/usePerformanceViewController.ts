import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import {
  buildPerformanceActorScopeKey,
  fetchMyTeacherSubjectAllocations,
  isAllocationResultApplicable,
  reconcileSelectedSubjectId,
  resolveParentPerformanceScope,
  resolvePostRefreshAction,
  resolveTeacherAllocationsFetchPlan,
  resolveTeacherPerformanceScope,
  resolveVisibleTeacherAllocations,
  type PerformanceActorSnapshot,
  type TeacherAllocationsState,
} from '../../../lib/performance';
import type { TeacherAllocatedSubjectItem } from '../../../types';

export function usePerformanceViewController() {
  const {
    currentUser, language, t, childrenList, classesList, classRosters,
    classesBackendStatus, classesError, schoolContextError, isHydratingSchoolData,
    selectedClassId, setSelectedClassId, selectedChildId, setSelectedChildId, refreshSchoolData,
  } = useApp();

  const isApproved = currentUser?.accountStatus === 'APPROVED';
  const isTeacher = Boolean(isApproved && currentUser?.role === 'TEACHER');
  const isParent = Boolean(isApproved && currentUser?.role === 'PARENT');
  const isAuthorizedRole = isTeacher || isParent;
  const canReadTeacherScope = isTeacher && !isHydratingSchoolData && classesBackendStatus === 'READY';

  const actorScopeKey = useMemo(() => buildPerformanceActorScopeKey(currentUser), [currentUser]);

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
  const refreshLockRef = useRef<{ id: number; actorScopeKey: string; promise: Promise<void> } | null>(null);

  const teacherScope = useMemo(
    () =>
      resolveTeacherPerformanceScope({
        currentUser, classesList, classRosters, selectedClassId, selectedStudentId,
      }),
    [currentUser, classesList, classRosters, selectedClassId, selectedStudentId],
  );

  const parentScope = useMemo(
    () => resolveParentPerformanceScope({ currentUser, childrenList, selectedChildId }),
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
      currentUser, actorScopeKey, teacherScope.activeClassId, teacherScope.activeClass,
      isHydratingSchoolData, classesBackendStatus, classesError, allocationsState,
    ],
  );

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
        actorScopeKey, classId: '', status: 'UNAUTHORIZED', items: [], errorMessage: null,
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
    isTeacher, actorScopeKey, currentUser, teacherScope.activeClassId,
    isHydratingSchoolData, classesBackendStatus, classesError, executeTeacherAllocationsFetch,
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

      if (refreshId !== refreshSeqRef.current) return;

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

    refreshLockRef.current = { id: refreshId, actorScopeKey: originActorScopeKey, promise: run };
    return run;
  }, [refreshSchoolData, executeTeacherAllocationsFetch]);

  const domainSubjectGroups = useMemo(() => {
    const map = new Map<string, TeacherAllocatedSubjectItem[]>();
    for (const item of visibleAllocations.items) {
      const domain = item.domainCode || 'GENERAL';
      const group = map.get(domain) || [];
      group.push(item);
      map.set(domain, group);
    }
    return [...map.entries()];
  }, [visibleAllocations.items]);

  const showTeacherDetails = isTeacher && canReadTeacherScope;
  const activeSubject =
    visibleAllocations.status === 'READY'
      ? visibleAllocations.items.find((item) => item.subjectId === selectedSubjectId) ?? null
      : null;

  const hasRefreshError = refreshErrorScopeKey === actorScopeKey;

  const unavailableBadgeLabel = pickText(
    { ar: 'غير متاح حالياً', fr: 'Indisponible pour le moment', en: 'Currently unavailable' },
    language,
  );
  const readOnlyBadgeLabel = pickText(
    { ar: 'عرض للقراءة فقط', fr: 'Consultation seule', en: 'Read-only view' },
    language,
  );
  const serviceUnavailableLabel = pickText(
    { ar: 'الخدمة غير متاحة حالياً', fr: 'Service actuellement indisponible', en: 'Service currently unavailable' },
    language,
  );
  const retryLabel = pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language);

  return {
    currentUser, language, t, isTeacher, isParent, isAuthorizedRole, actorScopeKey,
    classesBackendStatus, classesError, schoolContextError, isHydratingSchoolData,
    setSelectedClassId, setSelectedChildId, setSelectedStudentId, setSelectedSubjectId,
    isRefreshing, teacherScope, parentScope, visibleAllocations, domainSubjectGroups,
    showTeacherDetails, activeSubject, hasRefreshError, unavailableBadgeLabel,
    readOnlyBadgeLabel, serviceUnavailableLabel, retryLabel,
    executeTeacherAllocationsFetch, handleRefresh,
  };
}
