import type {
  AccountRole,
  HomePageKey,
  User,
} from '../../../types.ts';

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

export function isCanonicalAccountRole(role: unknown): role is AccountRole {
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
  if (!user || user.accountStatus !== 'APPROVED') return [];

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

  const status = user.accountStatus;
  if (status !== 'APPROVED') {
    const actor = isCanonicalAccountRole(user.role) ? user.role : null;
    if (requestedHomePage === 'PUBLIC_HOME') {
      return makeDecision('PUBLIC_HOME', true, false, actor);
    }
    const explicitlyRequestedPrivate =
      Boolean(requestedHomePage) && requestedHomePage !== 'APPLICATION_STATUS';
    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : 'unverified';
    return makeDecision(
      'APPLICATION_STATUS',
      !explicitlyRequestedPrivate,
      false,
      actor,
      explicitlyRequestedPrivate ? `account_status_${normalizedStatus}` : undefined,
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
