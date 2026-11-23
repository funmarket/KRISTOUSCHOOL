import {
  resolveParentLinkedChildren,
  resolveTeacherAssignedClasses,
} from '../../components/homepages/homepageAccess.ts';
import type {
  BackendOpStatus,
  Child,
  ClassItem,
  TeacherAllocatedSubjectItem,
  User,
} from '../../types.ts';
import type { SchoolClassWithRoster } from '../schoolOperations.ts';
import type {
  ParentPerformanceScope,
  PerformanceActorSnapshot,
  PostRefreshAction,
  TeacherAllocationsFetchPlan,
  TeacherAllocationsState,
  TeacherPerformanceScope,
  VisibleTeacherAllocations,
} from './performanceTypes.ts';

/**
 * Deterministic key capturing actor identity and authorized scopes so any account,
 * approval status, role, class assignment, or linked child change invalidates stale state.
 */
export function buildPerformanceActorScopeKey(user: User | null | undefined): string {
  if (!user) return 'anonymous';
  const assigned = Array.isArray(user.assignedClassIds)
    ? [...user.assignedClassIds].sort().join(',')
    : '';
  const linked = Array.isArray(user.linkedChildrenIds)
    ? [...user.linkedChildrenIds].sort().join(',')
    : '';
  return `${user.id}|${user.role}|${user.accountStatus ?? 'UNKNOWN'}|cls:${assigned}|ch:${linked}`;
}

export function resolveTeacherPerformanceScope(params: {
  currentUser: User | null | undefined;
  classesList: readonly ClassItem[];
  classRosters: readonly SchoolClassWithRoster[];
  selectedClassId: string;
  selectedStudentId: string;
}): TeacherPerformanceScope {
  const { currentUser, classesList, classRosters, selectedClassId, selectedStudentId } = params;

  if (!currentUser || currentUser.accountStatus !== 'APPROVED' || currentUser.role !== 'TEACHER') {
    return {
      authorizedClasses: [],
      activeClassId: '',
      activeClass: null,
      authorizedStudents: [],
      activeStudentId: '',
      activeStudent: null,
    };
  }

  const authorizedClasses = resolveTeacherAssignedClasses(currentUser, classesList);
  const authorizedClassIds = new Set(authorizedClasses.map((cls) => cls.id));
  const activeClass =
    (selectedClassId && authorizedClassIds.has(selectedClassId)
      ? authorizedClasses.find((cls) => cls.id === selectedClassId)
      : authorizedClasses[0]) ?? null;
  const activeClassId = activeClass ? activeClass.id : '';

  const activeRosterEntry = activeClassId
    ? classRosters.find((cls) => cls.id === activeClassId && authorizedClassIds.has(cls.id))
    : undefined;
  const authorizedStudents = Array.isArray(activeRosterEntry?.roster)
    ? activeRosterEntry.roster
    : [];

  const activeStudent =
    (selectedStudentId
      ? authorizedStudents.find((stu) => stu.studentId === selectedStudentId)
      : authorizedStudents[0]) ?? null;

  return {
    authorizedClasses,
    activeClassId,
    activeClass,
    authorizedStudents,
    activeStudentId: activeStudent ? activeStudent.studentId : '',
    activeStudent,
  };
}

export function resolveParentPerformanceScope(params: {
  currentUser: User | null | undefined;
  childrenList: readonly Child[];
  selectedChildId: string;
}): ParentPerformanceScope {
  const { currentUser, childrenList, selectedChildId } = params;

  if (!currentUser || currentUser.accountStatus !== 'APPROVED' || currentUser.role !== 'PARENT') {
    return {
      linkedChildren: [],
      activeChildId: '',
      activeChild: null,
    };
  }

  const linkedChildren = resolveParentLinkedChildren(currentUser, childrenList);
  const activeChild =
    (selectedChildId && linkedChildren.some((child) => child.id === selectedChildId)
      ? linkedChildren.find((child) => child.id === selectedChildId)
      : linkedChildren[0]) ?? null;

  return {
    linkedChildren,
    activeChildId: activeChild ? activeChild.id : '',
    activeChild,
  };
}

export function reconcileSelectedSubjectId(
  selectedSubjectId: string,
  allocatedSubjects: readonly TeacherAllocatedSubjectItem[],
): string {
  if (!allocatedSubjects || allocatedSubjects.length === 0) {
    return '';
  }
  if (selectedSubjectId && allocatedSubjects.some((item) => item.subjectId === selectedSubjectId)) {
    return selectedSubjectId;
  }
  return allocatedSubjects[0].subjectId;
}

export function resolveTeacherAllocationsFetchPlan(
  user: User | null | undefined,
  classId: string,
): TeacherAllocationsFetchPlan {
  if (!user || user.accountStatus !== 'APPROVED' || user.role !== 'TEACHER') {
    return { shouldFetch: false, status: 'UNAUTHORIZED', reason: 'teacher_access_required' };
  }
  const assigned = Array.isArray(user.assignedClassIds) ? user.assignedClassIds : [];
  if (assigned.length === 0) {
    return { shouldFetch: false, status: 'READY', reason: 'no_assigned_classes' };
  }
  if (!classId || !assigned.includes(classId)) {
    return { shouldFetch: false, status: 'READY', reason: 'no_authorized_class_selected' };
  }
  return { shouldFetch: true, classId, teacherUserId: user.id };
}

/**
 * Render-time visibility gate binding allocation results to the current approved Teacher,
 * school context readiness, and active authorized class. Never displays stale scope data
 * or definitive empty counts while context is loading, failed, or unauthorized.
 */
export function resolveVisibleTeacherAllocations(params: {
  currentUser: User | null | undefined;
  currentActorScopeKey: string;
  activeClassId: string;
  activeClass: ClassItem | null;
  isHydratingSchoolData: boolean;
  classesBackendStatus: BackendOpStatus;
  classesError: string | null;
  allocationsState: TeacherAllocationsState;
}): VisibleTeacherAllocations {
  const {
    currentUser,
    currentActorScopeKey,
    activeClassId,
    activeClass,
    isHydratingSchoolData,
    classesBackendStatus,
    classesError,
    allocationsState,
  } = params;

  if (!currentUser || currentUser.accountStatus !== 'APPROVED' || currentUser.role !== 'TEACHER') {
    return {
      status: 'UNAUTHORIZED',
      items: [],
      errorMessage: null,
      hasConfirmedNoClasses: false,
    };
  }

  if (isHydratingSchoolData) {
    return {
      status: 'LOADING',
      items: [],
      errorMessage: null,
      hasConfirmedNoClasses: false,
    };
  }

  if (classesBackendStatus === 'ERROR') {
    return {
      status: 'ERROR',
      items: [],
      errorMessage: classesError || null,
      hasConfirmedNoClasses: false,
    };
  }

  if (classesBackendStatus === 'UNAUTHORIZED') {
    return {
      status: 'UNAUTHORIZED',
      items: [],
      errorMessage: classesError || null,
      hasConfirmedNoClasses: false,
    };
  }

  if (classesBackendStatus === 'BLOCKED_BACKEND') {
    return {
      status: 'BLOCKED_BACKEND',
      items: [],
      errorMessage: null,
      hasConfirmedNoClasses: false,
    };
  }

  const assigned = Array.isArray(currentUser.assignedClassIds) ? currentUser.assignedClassIds : [];
  if (assigned.length === 0 || !activeClassId || !activeClass || !assigned.includes(activeClassId)) {
    return {
      status: 'READY',
      items: [],
      errorMessage: null,
      hasConfirmedNoClasses: true,
    };
  }

  if (
    allocationsState.actorScopeKey !== currentActorScopeKey ||
    allocationsState.classId !== activeClassId
  ) {
    return {
      status: 'LOADING',
      items: [],
      errorMessage: null,
      hasConfirmedNoClasses: false,
    };
  }

  if (allocationsState.status !== 'READY') {
    return {
      status: allocationsState.status,
      items: [],
      errorMessage: allocationsState.errorMessage,
      hasConfirmedNoClasses: false,
    };
  }

  const scopedItems = allocationsState.items.filter(
    (item) =>
      item.active === true &&
      item.classId === activeClassId &&
      item.teacherUserId === currentUser.id,
  );

  return {
    status: 'READY',
    items: scopedItems,
    errorMessage: null,
    hasConfirmedNoClasses: false,
  };
}

export function isAllocationResultApplicable(params: {
  isMounted: boolean;
  requestSeq: number;
  currentRequestSeq: number;
  originActorScopeKey: string;
  originClassId: string;
  currentSnapshot: PerformanceActorSnapshot;
}): boolean {
  const {
    isMounted,
    requestSeq,
    currentRequestSeq,
    originActorScopeKey,
    originClassId,
    currentSnapshot,
  } = params;
  if (!isMounted) return false;
  if (requestSeq !== currentRequestSeq) return false;
  if (!currentSnapshot.isTeacher || !currentSnapshot.canReadTeacherScope) return false;
  if (originActorScopeKey !== currentSnapshot.actorScopeKey) return false;
  if (!originClassId || originClassId !== currentSnapshot.activeClassId) return false;
  const plan = resolveTeacherAllocationsFetchPlan(currentSnapshot.currentUser, originClassId);
  return plan.shouldFetch && plan.classId === originClassId;
}

export function resolvePostRefreshAction(params: {
  isMounted: boolean;
  originActorScopeKey: string;
  currentSnapshot: PerformanceActorSnapshot;
  refreshSucceeded: boolean;
}): PostRefreshAction {
  const { isMounted, originActorScopeKey, currentSnapshot, refreshSucceeded } = params;
  if (!isMounted) {
    return { action: 'ABORT_UNMOUNTED' };
  }
  if (originActorScopeKey !== currentSnapshot.actorScopeKey) {
    return { action: 'ABORT_SCOPE_CHANGED' };
  }
  if (!refreshSucceeded) {
    return { action: 'SURFACE_REFRESH_ERROR' };
  }
  if (!currentSnapshot.isTeacher || !currentSnapshot.canReadTeacherScope) {
    return { action: 'SKIP_FETCH' };
  }
  const plan = resolveTeacherAllocationsFetchPlan(
    currentSnapshot.currentUser,
    currentSnapshot.activeClassId,
  );
  if (!plan.shouldFetch) {
    return { action: 'SKIP_FETCH' };
  }
  return {
    action: 'FETCH_TEACHER_ALLOCATIONS',
    actorScopeKey: currentSnapshot.actorScopeKey,
    classId: plan.classId,
    teacherUserId: plan.teacherUserId,
  };
}
