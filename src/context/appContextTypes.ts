import type {
  AccountRole,
  AdminDirectoryMember,
  Announcement,
  BackendOpResult,
  BackendOpStatus,
  CalendarEvent,
  Child,
  ClassDocumentItem,
  ClassGalleryItem,
  ClassItem,
  ClassQuestion,
  EnrollmentApplication,
  FoodMenuWeek,
  Homework,
  Language,
  MessageThread,
  NotificationItem,
  NotificationSoundOption,
  OperationalCounts,
  ParentNote,
  PickupAvailabilityStatus,
  PickupCycleRecord,
  PickupMutationEntry,
  PickupReadResult,
  PickupReasonCode,
  PickupRecord,
  PublicContentEntry,
  PublicInquiryItem,
  SchoolBroadcastItem,
  TeacherDirectoryMember,
  ThemeMode,
  User,
} from '../types';
import type { TranslationKey } from '../i18n/translations';
import type { SignInErrorCode, SignUpErrorCode } from '../i18n/authMessages';
import type { SignupRole } from '../lib/auth';
import type { SchoolClassWithRoster } from '../lib/schoolOperations';
import type { PreferencesSyncStatus } from '../lib/appStateGuards';
import type {
  AnnounceArrivalInput,
  ConfirmReleaseInput,
  PickupProvisionResult,
  PickupReleaseAuthorityResult,
} from '../lib/domains/pickup';
import type { PickupAdminNotice, PickupMutationResponse } from './usePickupState';
import type { SignupInput, SignupOutcome } from './IdentityContext';
import { MOCK_ANNOUNCEMENTS, MOCK_FOOD_MENU } from '../data/mockData';
import { contentT } from '../i18n/content';

export const PUBLIC_PREVIEW_ANNOUNCEMENTS: Announcement[] = MOCK_ANNOUNCEMENTS
  .filter((a) => !a.classId)
  .map((a) => ({ ...a, isDemoPreview: true }));

export const PUBLIC_PREVIEW_FOOD_MENU: FoodMenuWeek = {
  ...MOCK_FOOD_MENU,
  isDemoPreview: true,
};

export interface AppContextType {
  currentUser: User | null;
  currentRole: AccountRole | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  t: (key: TranslationKey) => string;
  dir: 'rtl' | 'ltr';
  childrenList: Child[];
  classesList: ClassItem[];
  classRosters: SchoolClassWithRoster[];
  classesBackendStatus: BackendOpStatus;
  classesError: string | null;
  selectedClassId: string;
  setSelectedClassId: (classId: string) => void;
  selectedChildId: string;
  setSelectedChildId: (childId: string) => void;
  operationalCounts: OperationalCounts;
  operationalCountsLoaded: boolean;
  isHydratingSchoolData: boolean;
  isLoadingClassCommunity: boolean;
  schoolContextError: string | null;
  announcements: Announcement[];
  broadcasts: SchoolBroadcastItem[];
  broadcastsStatus: BackendOpStatus;
  broadcastsError: string | null;
  homeworkList: Homework[];
  classDocuments: ClassDocumentItem[];
  classGallery: ClassGalleryItem[];
  calendarEvents: CalendarEvent[];
  calendarStatus: BackendOpStatus;
  calendarError: string | null;
  classQuestions: ClassQuestion[];
  communityStatus: BackendOpStatus;
  communityError: string | null;
  parentNotes: ParentNote[];
  notesStatus: BackendOpStatus;
  notesError: string | null;
  remainingParentNotesToday: number | null;
  isRefreshingParentNotesQuota: boolean;
  parentNotesQuotaStale: boolean;
  parentNotesQuotaVerified: boolean;
  messages: MessageThread[];
  messagesStatus: BackendOpStatus;
  messagesError: string | null;
  pickupCycles: PickupCycleRecord[];
  pickupRecords: PickupRecord[];
  pickupStatus: BackendOpStatus;
  pickupAvailability: PickupAvailabilityStatus;
  pickupError: string | null;
  pickupErrorCode: PickupReasonCode | null;
  pickupLastSyncedAt: string | null;
  pickupMutationState: Record<string, PickupMutationEntry>;
  isLoadingPickup: boolean;
  isProvisioningPickup?: boolean;
  isUpdatingReleaseAuthority?: boolean;
  pickupAdminNotice?: PickupAdminNotice | null;
  foodMenu: FoodMenuWeek;
  foodMenuStatus: BackendOpStatus;
  foodMenuError: string | null;
  teachers: TeacherDirectoryMember[];
  admins: AdminDirectoryMember[];
  directoryStatus: BackendOpStatus;
  directoryError: string | null;
  publicContent: Record<string, PublicContentEntry>;
  publicContentStatus: BackendOpStatus;
  publicContentError: string | null;
  enrollmentApplications: EnrollmentApplication[];
  enrollmentsStatus: BackendOpStatus;
  enrollmentsError: string | null;
  publicInquiries: PublicInquiryItem[];
  inquiriesStatus: BackendOpStatus;
  notifications: NotificationItem[];
  unreadNotificationsCount?: number;
  notificationsError: string | null;
  markingNotificationIds: string[];
  markingAllNotifications: boolean;
  preferencesError: string | null;
  preferencesSyncStatus: PreferencesSyncStatus;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string; errorCode?: SignInErrorCode }>;
  signIn: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string; errorCode?: SignInErrorCode }>;
  signup: (input: {
    username?: string;
    password: string;
    email?: string;
    phone?: string;
    fullName: string;
    requestedRole: SignupRole;
    staffId?: string;
    admissionId?: string;
  }) => Promise<{
    success: boolean;
    confirmationRequired?: boolean;
    secondaryPhoneVerificationRequired?: boolean;
    error?: string;
    errorCode?: SignUpErrorCode;
  }>;
  register: (input: SignupInput) => Promise<SignupOutcome>;
  signUp: (input: SignupInput) => Promise<SignupOutcome>;
  logout: () => void;
  signOut: () => void;
  refreshCurrentUser: () => Promise<User | null>;
  refreshSession: () => Promise<User | null>;
  connectTelegram: () => Promise<{ linkUrl?: string; error?: string }>;
  telegramLinkNotice: 'success' | 'error' | null;
  dismissTelegramLinkNotice: () => void;
  refreshSchoolData: () => Promise<boolean>;
  refreshParentNotesQuota: () => Promise<boolean>;
  addParentNote: (
    childId: string,
    topic: ParentNote['topic'],
    content: string,
    teacherId?: string,
  ) => Promise<{ success: boolean; error?: string; errorCode?: string; status?: BackendOpStatus }>;
  replyParentNote: (noteId: string, replyContent: string) => Promise<BackendOpResult<ParentNote>>;
  addClassQuestion: (
    classId: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string; errorCode?: string; status?: BackendOpStatus }>;
  replyClassQuestion: (questionId: string, content: string) => Promise<BackendOpResult<unknown>>;
  moderateClassQuestion: (questionId: string, hidden: boolean) => Promise<BackendOpResult<unknown>>;
  refreshPickupBoard: (classId?: string | null) => Promise<PickupReadResult>;
  verifyPickupOperationReceipt: (cycleId: string) => Promise<PickupMutationResponse>;
  markPickupArrived: (
    inputOrChildId: AnnounceArrivalInput | string,
    collectorId?: string,
  ) => Promise<PickupMutationResponse>;
  confirmPickupRelease: (
    inputOrRecordId: ConfirmReleaseInput | string,
  ) => Promise<PickupMutationResponse>;
  provisionTodayPickupCycles?: (schoolDate?: string | null) => Promise<PickupProvisionResult>;
  revokePickupReleaseAuthority?: (targetUserId: string, reason: string) => Promise<PickupReleaseAuthorityResult>;
  reinstatePickupReleaseAuthority?: (targetUserId: string, reason: string) => Promise<PickupReleaseAuthorityResult>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  notificationSound: NotificationSoundOption;
  setNotificationSound: (sound: NotificationSoundOption) => void;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (enabled: boolean) => void;
}

export function localizePublicAnnouncements(
  combined: Announcement[],
  language: Language,
): Announcement[] {
  return combined.map((item) =>
    item.isDemoPreview
      ? {
          ...item,
          title: contentT(language, 'announcements', item.id, 'title', item.title),
          body: contentT(language, 'announcements', item.id, 'body', item.body),
          authorRole: contentT(language, 'announcements', item.id, 'authorRole', item.authorRole),
        }
      : item,
  );
}

export function localizeFoodMenuWeek(foodMenu: FoodMenuWeek, language: Language): FoodMenuWeek {
  if (!foodMenu.isDemoPreview) return foodMenu;
  return {
    ...foodMenu,
    weekRange: contentT(language, 'menu', foodMenu.id, 'weekRange', foodMenu.weekRange),
    items: foodMenu.items.map((item, index) => ({
      ...item,
      day: contentT(language, 'menu', String(index), 'day', item.day),
      starter: contentT(language, 'menu', String(index), 'starter', item.starter),
      main: contentT(language, 'menu', String(index), 'main', item.main),
      side: contentT(language, 'menu', String(index), 'side', item.side),
      dessert: contentT(language, 'menu', String(index), 'dessert', item.dessert),
      notes: item.notes ? contentT(language, 'menu', String(index), 'notes', item.notes) : item.notes,
    })),
  };
}

export function localizeDirectoryTeachers(
  teachers: TeacherDirectoryMember[],
  directoryStatus: BackendOpStatus,
  language: Language,
): TeacherDirectoryMember[] {
  if (directoryStatus === 'READY') return teachers;
  if (directoryStatus === 'BLOCKED_BACKEND') {
    return teachers.map((item) => ({
      ...item,
      title: contentT(language, 'teachers', item.id, 'title', item.title),
      bio: contentT(language, 'teachers', item.id, 'bio', item.bio),
    }));
  }
  return [];
}

export function localizeDirectoryAdmins(
  admins: AdminDirectoryMember[],
  directoryStatus: BackendOpStatus,
  language: Language,
): AdminDirectoryMember[] {
  if (directoryStatus === 'READY') return admins;
  if (directoryStatus === 'BLOCKED_BACKEND') {
    return admins.map((item) => ({
      ...item,
      title: contentT(language, 'admins', item.id, 'title', item.title),
      bio: contentT(language, 'admins', item.id, 'bio', item.bio),
    }));
  }
  return [];
}
