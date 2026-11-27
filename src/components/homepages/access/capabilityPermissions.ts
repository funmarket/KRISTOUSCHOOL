import type {
  ClassStudentRosterItem,
  SchoolClassSummary,
  User,
} from '../../../types.ts';

export function canReviewOrdinaryAccountsUi(user: User | null | undefined): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
  return (
    user.role === 'APP_ADMIN' ||
    user.role === 'ADMINISTRATIVE_PERSONNEL' ||
    (user.role === 'MANAGER' &&
      (caps.includes('ACCOUNT_APPROVAL_REVIEW') || caps.includes('FULL_ACCESS')))
  );
}

export function canManageClassesUi(user: User | null | undefined): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
  return (
    user.role === 'APP_ADMIN' ||
    user.role === 'ADMINISTRATIVE_PERSONNEL' ||
    (user.role === 'MANAGER' &&
      (caps.includes('CLASSES_MANAGE') || caps.includes('FULL_ACCESS')))
  );
}

export function canReviewEnrollmentsUi(user: User | null | undefined): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
  return (
    user.role === 'APP_ADMIN' ||
    user.role === 'ADMINISTRATIVE_PERSONNEL' ||
    user.role === 'MANAGER' ||
    (user.role === 'SCHOOL_STAFF' && caps.includes('ENROLLMENT_REVIEW'))
  );
}

export function canManageBroadcastsUi(user: User | null | undefined): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
  return (
    user.role === 'APP_ADMIN' ||
    user.role === 'ADMINISTRATIVE_PERSONNEL' ||
    (user.role === 'MANAGER' &&
      (caps.includes('BROADCAST_MANAGE') || caps.includes('FULL_ACCESS')))
  );
}

export function canManageCalendarUi(user: User | null | undefined): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
  return (
    user.role === 'APP_ADMIN' ||
    user.role === 'ADMINISTRATIVE_PERSONNEL' ||
    (user.role === 'MANAGER' &&
      (caps.includes('CALENDAR_MANAGE') || caps.includes('FULL_ACCESS')))
  );
}

export function canCreateWholeSchoolCalendarUi(user: User | null | undefined): boolean {
  return canManageCalendarUi(user);
}

export function canCancelCalendarEventUi(user: User | null | undefined): boolean {
  // SQL cancel_school_calendar_event permits APP_ADMIN, ADMINISTRATIVE_PERSONNEL, CALENDAR_MANAGE (incl. FULL_ACCESS)
  return canManageCalendarUi(user);
}

export function canCreateCalendarEventUi(
  user: User | null | undefined,
  options?: {
    targetClassId?: string | null;
    assignedClassIds?: readonly string[];
  },
): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  if (canManageCalendarUi(user)) return true;
  if (user.role === 'TEACHER') {
    const assigned =
      options?.assignedClassIds ??
      (Array.isArray(user.assignedClassIds) ? user.assignedClassIds : []);
    if (assigned.length === 0) return false;
    if (options && 'targetClassId' in options) {
      return typeof options.targetClassId === 'string' && assigned.includes(options.targetClassId);
    }
    return true;
  }
  return false;
}

export interface CalendarPermissionsUi {
  canManageCalendar: boolean;
  canCreateWholeSchool: boolean;
  canCreate: boolean;
  canCancel: boolean;
  canRespond: boolean;
  hasTeacherClassAssignments: boolean;
  isTeacherWithoutAssignments: boolean;
}

export function getCalendarPermissionsUi(
  user: User | null | undefined,
  options?: {
    classId?: string | null;
    assignedClassIds?: readonly string[];
  },
): CalendarPermissionsUi {
  if (!user || user.accountStatus !== 'APPROVED') {
    return {
      canManageCalendar: false,
      canCreateWholeSchool: false,
      canCreate: false,
      canCancel: false,
      canRespond: false,
      hasTeacherClassAssignments: false,
      isTeacherWithoutAssignments: false,
    };
  }

  const canManageCalendar = canManageCalendarUi(user);
  const assigned =
    options?.assignedClassIds ??
    (Array.isArray(user.assignedClassIds) ? user.assignedClassIds : []);
  const isTeacher = user.role === 'TEACHER';
  const hasTeacherClassAssignments = isTeacher && assigned.length > 0;
  const isTeacherWithoutAssignments = isTeacher && assigned.length === 0;

  let canCreate = false;
  if (canManageCalendar) {
    canCreate = true;
  } else if (isTeacher && assigned.length > 0) {
    canCreate = options?.classId ? assigned.includes(options.classId) : true;
  }

  return {
    canManageCalendar,
    canCreateWholeSchool: canManageCalendar,
    canCreate,
    canCancel: canCancelCalendarEventUi(user),
    canRespond: true,
    hasTeacherClassAssignments,
    isTeacherWithoutAssignments,
  };
}

export function canManageFoodMenuUi(user: User | null | undefined): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
  return (
    user.role === 'APP_ADMIN' ||
    user.role === 'ADMINISTRATIVE_PERSONNEL' ||
    (user.role === 'MANAGER' &&
      (caps.includes('CAN_MANAGE_FOOD_MENU') ||
        caps.includes('PUBLIC_CONTENT_MANAGE') ||
        caps.includes('FULL_ACCESS')))
  );
}

export function canManagePublicContentUi(user: User | null | undefined): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
  return (
    user.role === 'APP_ADMIN' ||
    user.role === 'ADMINISTRATIVE_PERSONNEL' ||
    (user.role === 'MANAGER' &&
      (caps.includes('PUBLIC_CONTENT_MANAGE') || caps.includes('FULL_ACCESS')))
  );
}

export function canModerateCommunityUi(user: User | null | undefined): boolean {
  if (!user || user.accountStatus !== 'APPROVED') return false;
  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
  return (
    user.role === 'APP_ADMIN' ||
    user.role === 'TEACHER' ||
    (user.role === 'MANAGER' &&
      (caps.includes('COMMUNITY_MODERATE') || caps.includes('FULL_ACCESS')))
  );
}

export function filterSchoolClasses(
  classes: readonly SchoolClassSummary[],
  query: string,
  levelFilter: string,
  yearFilter: string,
): SchoolClassSummary[] {
  const q = query.trim().toLowerCase();
  return classes.filter((cls) => {
    if (levelFilter !== 'ALL' && cls.level !== levelFilter) return false;
    if (yearFilter !== 'ALL' && cls.academicYear !== yearFilter) return false;
    if (!q) return true;
    return (
      cls.name.toLowerCase().includes(q) ||
      cls.level.toLowerCase().includes(q) ||
      (cls.homeroomTeacherName?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function filterClassRoster(
  students: readonly ClassStudentRosterItem[],
  query: string,
): ClassStudentRosterItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...students];
  return students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      (s.primaryGuardianName?.toLowerCase().includes(q) ?? false),
  );
}
