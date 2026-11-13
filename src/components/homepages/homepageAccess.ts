import {
  AccountRole,
  AppTab,
  ClassStudentRosterItem,
  HomePageKey,
  SchoolClassSummary,
  User,
} from '../../types';

export const ROLE_TO_HOMEPAGE: Record<AccountRole, HomePageKey> = {
  APP_ADMIN: 'OWNER_HOME',
  MANAGER: 'MANAGER_HOME',
  PARENT: 'PARENT_HOME',
  STUDENT: 'STUDENT_HOME',
  TEACHER: 'TEACHER_HOME',
  SCHOOL_STAFF: 'SCHOOL_STAFF_HOME',
  ADMINISTRATIVE_PERSONNEL: 'ADMINISTRATIVE_PERSONNEL_HOME',
};

export const ALL_ROLE_HOMEPAGE_KEYS: HomePageKey[] = [
  'OWNER_HOME',
  'MANAGER_HOME',
  'PARENT_HOME',
  'STUDENT_HOME',
  'TEACHER_HOME',
  'SCHOOL_STAFF_HOME',
  'ADMINISTRATIVE_PERSONNEL_HOME',
];

export interface HomePageResolution {
  homePage: HomePageKey;
  targetPage: HomePageKey;
  allowed: boolean;
  oversightMode: boolean;
  actorRole: AccountRole | null;
  deniedReason?: string;
}

export interface ResolveHomePageOptions {
  user?: User | null;
  requestedPage?: HomePageKey | null;
}

function isCanonicalAccountRole(role: unknown): role is AccountRole {
  return typeof role === 'string' && Object.prototype.hasOwnProperty.call(ROLE_TO_HOMEPAGE, role);
}

function isOptionsObject(
  arg: User | ResolveHomePageOptions | null | undefined,
): arg is ResolveHomePageOptions {
  if (!arg || typeof arg !== 'object') return false;
  return 'user' in arg || 'requestedPage' in arg;
}

function makeDecision(
  targetPage: HomePageKey,
  allowed: boolean,
  oversightMode: boolean,
  actorRole: AccountRole | null,
  deniedReason?: string,
): HomePageResolution {
  return {
    homePage: targetPage,
    targetPage,
    allowed,
    oversightMode,
    actorRole,
    deniedReason,
  };
}

/**
 * Returns the list of role homepages an approved user may inspect via non-impersonating oversight.
 * - APP_ADMIN (School Owner) can inspect all 7 role homepages.
 * - MANAGER can inspect only homepages explicitly delegated via `OVERSIGHT:<HOME_KEY>` or `OVERSIGHT:ALL`.
 * - No other role has cross-role homepage oversight.
 */
export function getDelegatedOversightTargets(user: User | null | undefined): HomePageKey[] {
  if (!user) return [];
  const status = user.accountStatus ?? 'APPROVED';
  if (status !== 'APPROVED') return [];

  if (user.role === 'APP_ADMIN') {
    return [...ALL_ROLE_HOMEPAGE_KEYS];
  }

  if (user.role === 'MANAGER') {
    const caps = Array.isArray(user.capabilities) ? user.capabilities : [];
    if (caps.includes('OVERSIGHT:ALL')) {
      return ALL_ROLE_HOMEPAGE_KEYS.filter((key) => key !== 'OWNER_HOME');
    }
    return ALL_ROLE_HOMEPAGE_KEYS.filter(
      (key) => key !== 'OWNER_HOME' && caps.includes(`OVERSIGHT:${key}`),
    );
  }

  return [];
}

/**
 * Single authoritative frontend boundary for resolving which homepage component renders.
 * Never mutates `user` or `user.role`.
 * Supports both `resolveHomePage(user, requestedPage)` and `resolveHomePage({ user, requestedPage })`.
 */
export function resolveHomePage(
  userOrOptions: User | ResolveHomePageOptions | null | undefined,
  requestedHomePageArg?: HomePageKey | null,
): HomePageResolution {
  const user = isOptionsObject(userOrOptions) ? userOrOptions.user : userOrOptions;
  const requestedHomePage = isOptionsObject(userOrOptions)
    ? userOrOptions.requestedPage ?? requestedHomePageArg
    : requestedHomePageArg;

  if (!user) {
    if (requestedHomePage && requestedHomePage !== 'PUBLIC_HOME') {
      return makeDecision(
        'PUBLIC_HOME',
        false,
        false,
        null,
        'anonymous_access_denied',
      );
    }
    return makeDecision('PUBLIC_HOME', true, false, null);
  }

  const status = user.accountStatus ?? 'APPROVED';
  if (
    status === 'PENDING' ||
    status === 'REJECTED' ||
    status === 'SUSPENDED' ||
    status === 'REVOKED'
  ) {
    const actor = isCanonicalAccountRole(user.role) ? user.role : null;
    if (requestedHomePage === 'PUBLIC_HOME') {
      return makeDecision('PUBLIC_HOME', true, false, actor);
    }
    const explicitlyRequestedPrivate =
      Boolean(requestedHomePage) && requestedHomePage !== 'APPLICATION_STATUS';
    return makeDecision(
      'APPLICATION_STATUS',
      !explicitlyRequestedPrivate,
      false,
      actor,
      explicitlyRequestedPrivate ? `account_status_${status.toLowerCase()}` : undefined,
    );
  }

  if (!isCanonicalAccountRole(user.role)) {
    if (requestedHomePage && requestedHomePage !== 'PUBLIC_HOME') {
      return makeDecision(
        'PUBLIC_HOME',
        false,
        false,
        null,
        'unrecognized_role_fail_closed',
      );
    }
    return makeDecision('PUBLIC_HOME', true, false, null);
  }

  const canonicalHome = ROLE_TO_HOMEPAGE[user.role];

  if (!requestedHomePage || requestedHomePage === canonicalHome) {
    return makeDecision(canonicalHome, true, false, user.role);
  }

  // Any authenticated user may explicitly view the Public School Site without mutating role.
  if (requestedHomePage === 'PUBLIC_HOME') {
    return makeDecision('PUBLIC_HOME', true, false, user.role);
  }

  // Owner (APP_ADMIN) non-impersonating oversight
  if (user.role === 'APP_ADMIN' && ALL_ROLE_HOMEPAGE_KEYS.includes(requestedHomePage)) {
    return makeDecision(
      requestedHomePage,
      true,
      requestedHomePage !== 'OWNER_HOME',
      'APP_ADMIN',
    );
  }

  // Manager explicitly delegated oversight (never OWNER_HOME unless user is APP_ADMIN)
  if (user.role === 'MANAGER' && requestedHomePage !== 'OWNER_HOME') {
    const allowedTargets = getDelegatedOversightTargets(user);
    if (allowedTargets.includes(requestedHomePage)) {
      return makeDecision(
        requestedHomePage,
        true,
        requestedHomePage !== 'MANAGER_HOME',
        'MANAGER',
      );
    }
    return makeDecision(
      canonicalHome,
      false,
      false,
      'MANAGER',
      'manager_delegation_required',
    );
  }

  // All other cross-role requests fail closed to the user's own canonical homepage
  return makeDecision(
    canonicalHome,
    false,
    false,
    user.role,
    'cross_role_access_denied',
  );
}

/**
 * Checks whether the current user is allowed to open a shared application tab.
 * Enforces role and capability boundaries so restricted features cannot be opened via tab state.
 */
export function canAccessAppTab(user: User | null | undefined, tab: AppTab): boolean {
  // Public tabs accessible to everyone (anonymous, pending, and approved accounts)
  if (
    tab === 'home' ||
    tab === 'publicSite' ||
    tab === 'foodMenu' ||
    tab === 'directory' ||
    tab === 'registration'
  ) {
    return true;
  }

  if (!user) {
    return false;
  }

  const status = user.accountStatus ?? 'APPROVED';
  if (status !== 'APPROVED') {
    return false;
  }

  if (!isCanonicalAccountRole(user.role)) {
    return false;
  }

  const caps = Array.isArray(user.capabilities) ? user.capabilities : [];

  switch (tab) {
    case 'classes': {
      if (user.role === 'APP_ADMIN') {
        return true;
      }
      if (user.role === 'MANAGER') {
        return caps.includes('CLASSES_ROSTER_VIEW') || caps.includes('FULL_ACCESS');
      }
      if (user.role === 'ADMINISTRATIVE_PERSONNEL' || user.role === 'SCHOOL_STAFF') {
        return caps.includes('CLASSES_ROSTER_VIEW');
      }
      return false;
    }

    case 'community': {
      if (
        user.role === 'APP_ADMIN' ||
        user.role === 'MANAGER' ||
        user.role === 'PARENT' ||
        user.role === 'STUDENT' ||
        user.role === 'TEACHER' ||
        user.role === 'ADMINISTRATIVE_PERSONNEL'
      ) {
        return true;
      }
      if (user.role === 'SCHOOL_STAFF') {
        return (
          caps.includes('ANNOUNCEMENTS_READ') ||
          caps.includes('CALENDAR_READ') ||
          caps.includes('CLASS_SUPPORT')
        );
      }
      return false;
    }

    case 'notes': {
      return (
        user.role === 'APP_ADMIN' ||
        user.role === 'MANAGER' ||
        user.role === 'PARENT' ||
        user.role === 'TEACHER' ||
        user.role === 'ADMINISTRATIVE_PERSONNEL'
      );
    }

    case 'pickup': {
      if (
        user.role === 'APP_ADMIN' ||
        user.role === 'PARENT' ||
        user.role === 'TEACHER'
      ) {
        return true;
      }
      if (user.role === 'MANAGER') {
        return (
          caps.length === 0 ||
          caps.includes('PICKUP_RELEASE') ||
          caps.includes('PICKUP_VIEW') ||
          caps.includes('FULL_ACCESS')
        );
      }
      if (user.role === 'SCHOOL_STAFF' || user.role === 'ADMINISTRATIVE_PERSONNEL') {
        return caps.includes('PICKUP_RELEASE') || caps.includes('PICKUP_DESK');
      }
      return false;
    }

    default:
      return false;
  }
}

export function resolveParentLinkedChildren<T extends { id: string }>(
  user: { linkedChildrenIds?: string[] } | null | undefined,
  allChildren: readonly T[],
): T[] {
  if (!user?.linkedChildrenIds || user.linkedChildrenIds.length === 0) {
    return [];
  }
  return allChildren.filter((child) => user.linkedChildrenIds?.includes(child.id));
}

export function resolveTeacherAssignedClasses<T extends { id: string }>(
  user: { assignedClassIds?: string[] } | null | undefined,
  allClasses: readonly T[],
): T[] {
  if (!user?.assignedClassIds || user.assignedClassIds.length === 0) {
    return [];
  }
  return allClasses.filter((cls) => user.assignedClassIds?.includes(cls.id));
}

export function resolveStudentAssignedClass<T extends { id: string }>(
  user: { assignedClassIds?: string[] } | null | undefined,
  allClasses: readonly T[],
): T | null {
  if (!user?.assignedClassIds || user.assignedClassIds.length === 0) {
    return null;
  }
  return allClasses.find((cls) => user.assignedClassIds?.includes(cls.id)) ?? null;
}

export function attemptPickupOperation(
  operation: 'ARRIVAL' | 'RELEASE',
  targetId: string,
): {
  allowed: false;
  status: 'BLOCKED_BACKEND';
  operation: 'ARRIVAL' | 'RELEASE';
  targetId: string;
  reason: string;
} {
  return {
    allowed: false,
    status: 'BLOCKED_BACKEND',
    operation,
    targetId,
    reason: 'pickup_backend_unavailable',
  };
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

