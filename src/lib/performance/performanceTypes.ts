import type {
  BackendOpStatus,
  Child,
  ClassItem,
  ClassStudentRosterItem,
  TeacherAllocatedSubjectItem,
  User,
} from '../../types.ts';

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
