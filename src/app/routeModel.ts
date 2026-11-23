import type {
  AppTab,
  BackendOpStatus,
  ClassStudentRosterItem,
  CommunitySubTab,
  DirectorySubTab,
  NotificationItem,
  User,
} from '../types';
import { canAccessAppTab } from '../components/homepages/homepageAccess';
import {
  createNotificationTargetIntent,
  getNotificationActorKey,
  type NotificationTargetIntent,
} from '../lib/notificationTargetNavigation';

export type AnnouncementsSubTab = 'broadcasts' | 'calendar';
export type SubTabTargetTab = 'community' | 'directory' | 'announcements';
export type StudentNavOrigin = 'students' | 'roster';
export type ClassesViewBackendStatus =
  | 'LOADING'
  | 'READY'
  | 'UNAUTHORIZED'
  | 'ERROR'
  | 'BACKEND_NOT_IMPLEMENTED';

export type PendingAttendanceLeaveNav =
  | { kind: 'tab'; tab: string }
  | { kind: 'subtab'; tab: SubTabTargetTab; subTab: string }
  | { kind: 'notification'; notification: NotificationItem };

export interface TabTransitionResolution {
  activeTab: string;
  resetAnnouncementsSubTab?: AnnouncementsSubTab;
}

export interface SubTabTransitionResolution {
  activeTab: string;
  communitySubTab?: CommunitySubTab;
  announcementsSubTab?: AnnouncementsSubTab;
  directorySubTab?: DirectorySubTab;
}

export function shouldInterceptDirtyAttendanceLeave(
  activeTab: string,
  isAttendanceDirty: boolean,
  nextTab?: string,
): boolean {
  if (activeTab !== 'attendance' || !isAttendanceDirty) {
    return false;
  }
  if (nextTab !== undefined && nextTab === 'attendance') {
    return false;
  }
  return true;
}

export function resolveTabTransition(
  currentUser: User | null,
  nextTab: string,
): TabTransitionResolution {
  if (canAccessAppTab(currentUser, nextTab as AppTab)) {
    if (nextTab === 'announcements') {
      return { activeTab: 'announcements', resetAnnouncementsSubTab: 'broadcasts' };
    }
    return { activeTab: nextTab };
  }
  return { activeTab: 'home' };
}

export function resolveSubTabTransition(
  currentUser: User | null,
  tab: SubTabTargetTab,
  subTab: string,
): SubTabTransitionResolution {
  if (tab === 'community') {
    if (!canAccessAppTab(currentUser, 'community')) {
      return { activeTab: 'home' };
    }
    return {
      activeTab: 'community',
      communitySubTab: subTab as CommunitySubTab,
    };
  }

  if (tab === 'announcements') {
    if (!canAccessAppTab(currentUser, 'announcements')) {
      return { activeTab: 'home' };
    }
    return {
      activeTab: 'announcements',
      announcementsSubTab: subTab === 'calendar' ? 'calendar' : 'broadcasts',
    };
  }

  return {
    activeTab: 'directory',
    directorySubTab: subTab as DirectorySubTab,
  };
}

export function resolveNotificationTargetRoute(
  currentUser: User | null,
  notification: NotificationItem,
  requestSeq: number,
): NotificationTargetIntent | null {
  const actorKey = getNotificationActorKey(currentUser);
  const intent = createNotificationTargetIntent(notification, actorKey, requestSeq);
  if (!intent || !canAccessAppTab(currentUser, intent.tab)) {
    return null;
  }
  return intent;
}

export function mapClassesBackendStatus(
  isHydratingSchoolData: boolean,
  classesBackendStatus: BackendOpStatus,
): ClassesViewBackendStatus {
  if (isHydratingSchoolData) return 'LOADING';
  if (classesBackendStatus === 'READY') return 'READY';
  if (classesBackendStatus === 'UNAUTHORIZED') return 'UNAUTHORIZED';
  if (classesBackendStatus === 'ERROR') return 'ERROR';
  return 'BACKEND_NOT_IMPLEMENTED';
}

export function buildClassRostersRecord(
  classRosters: ReadonlyArray<{ id: string; roster: ClassStudentRosterItem[] }>,
): Record<string, ClassStudentRosterItem[]> {
  const map: Record<string, ClassStudentRosterItem[]> = {};
  for (const cls of classRosters) {
    map[cls.id] = cls.roster;
  }
  return map;
}
