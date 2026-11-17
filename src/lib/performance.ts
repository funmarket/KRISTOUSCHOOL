import { supabase, classifySupabaseError } from './supabase.ts';
import {
  resolveParentLinkedChildren,
  resolveTeacherAssignedClasses,
} from '../components/homepages/homepageAccess.ts';
import type {
  BackendOpResult,
  BackendOpStatus,
  Child,
  ClassItem,
  ClassStudentRosterItem,
  Language,
  TeacherAllocatedSubjectItem,
  TeacherSubjectComponentSummary,
  User,
} from '../types.ts';
import type { SchoolClassWithRoster } from './schoolOperations.ts';

export interface TeacherPerformanceScope {
  authorizedClasses: ClassItem[];
  activeClassId: string;
  activeClass: ClassItem | null;
  authorizedStudents: ClassStudentRosterItem[];
  activeStudentId: string;
  activeStudent: ClassStudentRosterItem | null;
}

export interface ParentPerformanceScope {
  linkedChildren: Child[];
  activeChildId: string;
  activeChild: Child | null;
}

export type TeacherAllocationsFetchPlan =
  | { shouldFetch: true; classId: string; teacherUserId: string }
  | { shouldFetch: false; status: 'READY' | 'UNAUTHORIZED'; reason: string };

export interface TeacherAllocationsState {
  actorScopeKey: string;
  classId: string;
  status: BackendOpStatus | 'LOADING';
  items: TeacherAllocatedSubjectItem[];
  errorMessage: string | null;
}

export interface VisibleTeacherAllocations {
  status: BackendOpStatus | 'LOADING';
  items: TeacherAllocatedSubjectItem[];
  errorMessage: string | null;
  hasConfirmedNoClasses: boolean;
}

export interface PerformanceActorSnapshot {
  actorScopeKey: string;
  userId: string;
  isTeacher: boolean;
  canReadTeacherScope: boolean;
  activeClassId: string;
  currentUser: User | null | undefined;
}

export type PostRefreshAction =
  | { action: 'ABORT_UNMOUNTED' }
  | { action: 'ABORT_SCOPE_CHANGED' }
  | { action: 'SURFACE_REFRESH_ERROR' }
  | { action: 'SKIP_FETCH' }
  | {
      action: 'FETCH_TEACHER_ALLOCATIONS';
      actorScopeKey: string;
      classId: string;
      teacherUserId: string;
    };

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateComponent(raw: unknown): TeacherSubjectComponentSummary | null {
  if (!isPlainObject(raw)) return null;
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.code)) return null;
  if (
    typeof raw.labelAr !== 'string' ||
    typeof raw.labelFr !== 'string' ||
    typeof raw.labelEn !== 'string'
  ) {
    return null;
  }
  if (!raw.labelAr.trim() && !raw.labelFr.trim() && !raw.labelEn.trim()) {
    return null;
  }
  if (typeof raw.sortOrder !== 'number' || !Number.isFinite(raw.sortOrder)) {
    return null;
  }

  return {
    id: raw.id,
    code: raw.code,
    labelAr: raw.labelAr,
    labelFr: raw.labelFr,
    labelEn: raw.labelEn,
    sortOrder: raw.sortOrder,
  };
}

/**
 * Strictly validates the JSON array payload returned by
 * `public.list_my_teacher_subject_allocations(p_class_id uuid)` against the
 * installed T4A schema contract. Rejects non-array payloads, missing/non-boolean
 * `active` flags, inactive rows, malformed fields, or scope mismatches rather than
 * coercing values or silently dropping invalid records.
 */
export function parseTeacherSubjectAllocationsResponse(
  data: unknown,
  expectedClassId: string,
  expectedTeacherUserId?: string,
): BackendOpResult<TeacherAllocatedSubjectItem[]> {
  if (!Array.isArray(data)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_rpc_payload',
      errorMessage: 'Subject allocation response format is invalid.',
    };
  }

  const parsed: TeacherAllocatedSubjectItem[] = [];

  for (const raw of data) {
    if (!isPlainObject(raw)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation record is malformed.',
      };
    }

    if (
      !isNonEmptyString(raw.allocationId) ||
      !isNonEmptyString(raw.assignmentId) ||
      !isNonEmptyString(raw.teacherUserId) ||
      !isNonEmptyString(raw.classId) ||
      !isNonEmptyString(raw.className) ||
      !isNonEmptyString(raw.levelCode) ||
      !isNonEmptyString(raw.academicYear) ||
      !isNonEmptyString(raw.subjectId) ||
      !isNonEmptyString(raw.subjectCode) ||
      !isNonEmptyString(raw.domainCode) ||
      !isNonEmptyString(raw.offeringId) ||
      !isNonEmptyString(raw.allocatedAt)
    ) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation record is missing required identifiers.',
      };
    }

    if (typeof raw.isHomeroom !== 'boolean' || typeof raw.active !== 'boolean') {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation status flags are invalid.',
      };
    }

    if (raw.active !== true) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_allocation_state',
        errorMessage: 'Inactive subject allocation returned unexpectedly.',
      };
    }

    if (
      typeof raw.labelAr !== 'string' ||
      typeof raw.labelFr !== 'string' ||
      typeof raw.labelEn !== 'string' ||
      (!raw.labelAr.trim() && !raw.labelFr.trim() && !raw.labelEn.trim())
    ) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation labels are invalid.',
      };
    }

    if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation version is invalid.',
      };
    }

    if (!Array.isArray(raw.components)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject components payload is invalid.',
      };
    }

    const components: TeacherSubjectComponentSummary[] = [];
    for (const rawComp of raw.components) {
      const validated = validateComponent(rawComp);
      if (!validated) {
        return {
          ok: false,
          status: 'ERROR',
          errorCode: 'malformed_rpc_payload',
          errorMessage: 'Subject component entry is malformed.',
        };
      }
      components.push(validated);
    }

    if (expectedClassId && raw.classId !== expectedClassId) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'mismatched_class_scope',
        errorMessage: 'Subject allocation class does not match the selected class.',
      };
    }

    if (expectedTeacherUserId && raw.teacherUserId !== expectedTeacherUserId) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'mismatched_teacher_scope',
        errorMessage: 'Subject allocation teacher does not match the active account.',
      };
    }

    parsed.push({
      allocationId: raw.allocationId,
      assignmentId: raw.assignmentId,
      teacherUserId: raw.teacherUserId,
      classId: raw.classId,
      className: raw.className,
      levelCode: raw.levelCode,
      academicYear: raw.academicYear,
      isHomeroom: raw.isHomeroom,
      subjectId: raw.subjectId,
      subjectCode: raw.subjectCode,
      domainCode: raw.domainCode,
      labelAr: raw.labelAr,
      labelFr: raw.labelFr,
      labelEn: raw.labelEn,
      offeringId: raw.offeringId,
      active: true,
      allocatedAt: raw.allocatedAt,
      version: raw.version,
      components,
    });
  }

  return { ok: true, status: 'READY', data: parsed };
}

/**
 * Reads the authenticated Teacher's active subject allocations via the installed
 * T4A RPC `list_my_teacher_subject_allocations(p_class_id)`.
 */
export async function fetchMyTeacherSubjectAllocations(
  classId: string,
  expectedTeacherUserId?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<TeacherAllocatedSubjectItem[]>> {
  if (!classId) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'class_id_required',
      errorMessage: 'Class selection is required.',
    };
  }
  if (!client) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Subject allocation service is unavailable.',
    };
  }
  try {
    const { data, error } = await client.rpc('list_my_teacher_subject_allocations', {
      p_class_id: classId,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return parseTeacherSubjectAllocationsResponse(data, classId, expectedTeacherUserId);
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export function getLocalizedSubjectLabel(
  item: { labelAr: string; labelFr: string; labelEn: string },
  language: Language,
): string {
  if (language === 'ar') return item.labelAr || item.labelFr || item.labelEn;
  if (language === 'fr') return item.labelFr || item.labelEn || item.labelAr;
  return item.labelEn || item.labelFr || item.labelAr;
}
