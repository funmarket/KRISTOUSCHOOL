import type { AppTab, User } from '../../../types.ts';
import { isCanonicalAccountRole } from './homePageResolution.ts';

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

  if (!user || user.accountStatus !== 'APPROVED') {
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
        return (
          caps.includes('CLASSES_ROSTER_VIEW') ||
          caps.includes('CLASSES_MANAGE') ||
          caps.includes('FULL_ACCESS')
        );
      }
      if (user.role === 'ADMINISTRATIVE_PERSONNEL' || user.role === 'TEACHER') {
        return true;
      }
      if (user.role === 'SCHOOL_STAFF') {
        return caps.includes('CLASSES_ROSTER_VIEW');
      }
      return false;
    }

    case 'students': {
      if (user.role === 'APP_ADMIN' || user.role === 'ADMINISTRATIVE_PERSONNEL') {
        return true;
      }
      if (user.role === 'MANAGER') {
        return (
          caps.includes('CLASSES_ROSTER_VIEW') ||
          caps.includes('CLASSES_MANAGE') ||
          caps.includes('FULL_ACCESS')
        );
      }
      return false;
    }

    case 'announcements': {
      // School-wide broadcasts and campus calendar are visible to all 7 approved roles
      return true;
    }

    case 'performance': {
      // Read-only academic Performance view strictly for approved Teachers and Parents
      return user.role === 'TEACHER' || user.role === 'PARENT';
    }

    case 'attendance': {
      // Daily Attendance tab: Teacher, Parent, Student, Owner (APP_ADMIN), Office (ADMINISTRATIVE_PERSONNEL) only
      return (
        user.role === 'TEACHER' ||
        user.role === 'PARENT' ||
        user.role === 'STUDENT' ||
        user.role === 'APP_ADMIN' ||
        user.role === 'ADMINISTRATIVE_PERSONNEL'
      );
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

    case 'messages': {
      // Operational short messaging (COM-04): strictly excludes STUDENT private DMs
      return (
        user.role === 'APP_ADMIN' ||
        user.role === 'MANAGER' ||
        user.role === 'ADMINISTRATIVE_PERSONNEL' ||
        user.role === 'TEACHER' ||
        user.role === 'PARENT' ||
        user.role === 'SCHOOL_STAFF'
      );
    }

    case 'pickup': {
      if (
        user.role === 'APP_ADMIN' ||
        user.role === 'MANAGER' ||
        user.role === 'PARENT' ||
        user.role === 'TEACHER' ||
        user.role === 'ADMINISTRATIVE_PERSONNEL'
      ) {
        return true;
      }
      if (user.role === 'SCHOOL_STAFF') {
        return (
          caps.includes('PICKUP_VIEW') ||
          caps.includes('PICKUP_DESK') ||
          caps.includes('PICKUP_RELEASE')
        );
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

export { attemptPickupOperation } from '../../../lib/domains/pickup.ts';
