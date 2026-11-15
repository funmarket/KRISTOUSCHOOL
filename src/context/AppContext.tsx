import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
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
  PickupRecord,
  PublicContentEntry,
  PublicInquiryItem,
  SchoolBroadcastItem,
  TeacherDirectoryMember,
  ThemeMode,
  User,
} from '../types';
import {
  MOCK_ANNOUNCEMENTS,
  MOCK_FOOD_MENU,
  MOCK_TEACHERS,
  MOCK_ADMIN,
} from '../data/mockData';
import { translations, type TranslationKey } from '../i18n/translations';
import {
  classifySignInError,
  classifySignUpError,
  resolveSignInErrorMessage,
  resolveSignUpErrorMessage,
  type SignInErrorCode,
  type SignUpErrorCode,
} from '../i18n/authMessages';
import { contentT } from '../i18n/content';
import { supabase } from '../lib/supabase';
import {
  loadCanonicalUser,
  signInAccount,
  signOutAccount,
  signUpAccount,
  createTelegramLinkChallenge,
  authenticateTelegramInitData,
  type SignupRole,
} from '../lib/auth';
import { getTelegramWebAppInitData, initializeTelegramWebApp } from '../lib/telegram';
import {
  fetchMySchoolContext,
  fetchSchoolClassesWithRosters,
  listEnrollmentApplications,
  listPublicInquiries,
  type SchoolClassWithRoster,
} from '../lib/schoolOperations';
import {
  fetchActiveFoodMenu,
  fetchPublicContent,
  listClassCommunityContent,
  listMessageThreads,
  listMyNotifications,
  listParentNotes,
  listPublicDirectory,
  listSchoolBroadcasts,
  listSchoolCalendarEvents,
  loadMyPreferences,
  markAllNotificationsReadOnServer,
  markNotificationReadOnServer,
  moderateClassQuestion as moderateClassQuestionRpc,
  postClassQuestion as postClassQuestionRpc,
  replyClassQuestion as replyClassQuestionRpc,
  replyParentNote as replyParentNoteRpc,
  saveMyPreferences,
  sendParentNote as sendParentNoteRpc,
} from '../lib/schoolContent';
import {
  createParentNotesQuotaBoundaryController,
  getNextTunisBoundaryDelayMs,
  type ParentNotesBoundarySnapshot,
} from '../lib/parentNotesBoundary';
import {
  applyAllNotificationsOptimisticRead,
  applySingleNotificationOptimisticRead,
  isMatchingApprovedAccountContext,
  mergeRefreshedNotifications,
  captureNotificationReadSnapshot,
  reconcileFailedMarkAllNotificationsRead,
  reconcileFailedSingleNotificationRead,
  resolvePreferencesPersistOutcome,
  type AccountIdentityContext,
  type PendingNotificationSnapshot,
  type PreferencesSyncStatus,
} from '../lib/appStateGuards';
import { canReviewOrdinaryAccountsUi } from '../components/homepages/homepageAccess';

const PUBLIC_PREVIEW_ANNOUNCEMENTS: Announcement[] = MOCK_ANNOUNCEMENTS.filter((a) => !a.classId).map((a) => ({
  ...a,
  isDemoPreview: true,
}));

const PUBLIC_PREVIEW_FOOD_MENU: FoodMenuWeek = {
  ...MOCK_FOOD_MENU,
  isDemoPreview: true,
};

interface AppContextType {
  currentUser: User | null;
  currentRole: AccountRole | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  t: (key: TranslationKey) => string;
  dir: 'rtl' | 'ltr';

  // Operational & public data state
  childrenList: Child[];
  classesList: ClassItem[];
  classRosters: SchoolClassWithRoster[];
  classesBackendStatus: BackendOpStatus;
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
  pickupRecords: PickupRecord[];
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
  notificationsError: string | null;
  markingNotificationIds: string[];
  markingAllNotifications: boolean;
  preferencesError: string | null;
  preferencesSyncStatus: PreferencesSyncStatus;

  // Actions
  login: (
    identifier: string,
    pass: string,
  ) => Promise<{ success: boolean; error?: string; errorCode?: SignInErrorCode }>;
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
  logout: () => void;
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
  markPickupArrived: (childId: string) => { success: boolean; error?: string };
  confirmPickupRelease: (recordId: string) => { success: boolean; error?: string };
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  notificationSound: NotificationSoundOption;
  setNotificationSound: (sound: NotificationSoundOption) => void;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (enabled: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SOUND_OPTIONS: readonly NotificationSoundOption[] = [
  'Kristou Bell',
  'Soft Chime',
  'Classroom Bell',
  'Gentle Pop',
  'Silent',
];

function sanitizeSound(raw: string | null): NotificationSoundOption {
  if (raw && (SOUND_OPTIONS as readonly string[]).includes(raw)) {
    return raw as NotificationSoundOption;
  }
  return 'Kristou Bell';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const telegramIdentityUser = useRef<User | null>(null);
  const [currentRole, setCurrentRoleState] = useState<AccountRole | null>(null);
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('kristou_lang');
    return saved === 'ar' || saved === 'fr' || saved === 'en' ? saved : 'fr';
  });
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('kristou_theme');
    return saved === 'pitch-black' ? 'pitch-black' : 'light';
  });
  const [notificationSound, setNotificationSoundState] = useState<NotificationSoundOption>(() =>
    sanitizeSound(localStorage.getItem('kristou_notification_sound')),
  );
  const [soundMuted, setSoundMutedState] = useState<boolean>(
    () => localStorage.getItem('kristou_sound_muted') === 'true',
  );
  const [vibrationEnabled, setVibrationEnabledState] = useState<boolean>(
    () => localStorage.getItem('kristou_vibration_enabled') !== 'false',
  );
  const [telegramLinkNotice, setTelegramLinkNotice] = useState<'success' | 'error' | null>(null);

  // Private operational state starts strictly empty (zero mock private records).
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [classRosters, setClassRosters] = useState<SchoolClassWithRoster[]>([]);
  const [classesBackendStatus, setClassesBackendStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [operationalCounts, setOperationalCounts] = useState<OperationalCounts>({});
  const [operationalCountsLoaded, setOperationalCountsLoaded] = useState<boolean>(false);
  const [isHydratingSchoolData, setIsHydratingSchoolData] = useState<boolean>(false);
  const [isLoadingClassCommunity, setIsLoadingClassCommunity] = useState<boolean>(false);
  const [schoolContextError, setSchoolContextError] = useState<string | null>(null);

  const [broadcasts, setBroadcasts] = useState<SchoolBroadcastItem[]>([]);
  const [broadcastsStatus, setBroadcastsStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [broadcastsError, setBroadcastsError] = useState<string | null>(null);
  const [classAnnouncements, setClassAnnouncements] = useState<Announcement[]>([]);
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [classDocuments, setClassDocuments] = useState<ClassDocumentItem[]>([]);
  const [classGallery, setClassGallery] = useState<ClassGalleryItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [classQuestions, setClassQuestions] = useState<ClassQuestion[]>([]);
  const [communityStatus, setCommunityStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [parentNotes, setParentNotes] = useState<ParentNote[]>([]);
  const [notesStatus, setNotesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [pickupRecords] = useState<PickupRecord[]>([]);

  // Public content (directory / canteen / public highlights) hydrates from Supabase when deployed,
  // falling back honestly to demo preview only for BLOCKED_BACKEND public showcase.
  const [foodMenu, setFoodMenu] = useState<FoodMenuWeek>(PUBLIC_PREVIEW_FOOD_MENU);
  const [foodMenuStatus, setFoodMenuStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [foodMenuError, setFoodMenuError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherDirectoryMember[]>(MOCK_TEACHERS);
  const [admins, setAdmins] = useState<AdminDirectoryMember[]>(MOCK_ADMIN);
  const [directoryStatus, setDirectoryStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [publicContent, setPublicContent] = useState<Record<string, PublicContentEntry>>({});
  const [publicContentStatus, setPublicContentStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [publicContentError, setPublicContentError] = useState<string | null>(null);

  const [enrollmentApplications, setEnrollmentApplications] = useState<EnrollmentApplication[]>([]);
  const [enrollmentsStatus, setEnrollmentsStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);
  const [publicInquiries, setPublicInquiries] = useState<PublicInquiryItem[]>([]);
  const [inquiriesStatus, setInquiriesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [markingNotificationIds, setMarkingNotificationIds] = useState<string[]>([]);
  const [markingAllNotifications, setMarkingAllNotifications] = useState<boolean>(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesSyncStatus, setPreferencesSyncStatus] = useState<PreferencesSyncStatus>('LOCAL_ONLY');

  // Concurrency, identity-generation, and unmount guards
  const mountedRef = useRef<boolean>(true);
  const authGenerationRef = useRef<number>(1);
  const currentIdentityRef = useRef<AccountIdentityContext>({
    userId: null,
    accountStatus: null,
    generation: 1,
  });
  const publicHydrationGenRef = useRef<number>(0);
  const authHydrationGenRef = useRef<number>(0);
  const classCommGenRef = useRef<number>(0);
  const prefsGenRef = useRef<number>(0);
  const preferencesErrorRef = useRef<string | null>(null);
  const notificationsRef = useRef<NotificationItem[]>([]);
  const notifSeqRef = useRef<number>(0);
  const inFlightSingleReadsRef = useRef<Set<string>>(new Set());
  const pendingNotificationSnapshotsRef = useRef<Map<number, PendingNotificationSnapshot>>(new Map());
  const pendingMarkAllReadsRef = useRef<Map<number, ReadonlySet<string>>>(new Map());
  const confirmedReadSeqByIdRef = useRef<Map<string, number>>(new Map());
  const latestMarkAllConfirmedSeqRef = useRef<number>(0);
  const notesBoundaryControllerRef = useRef<ReturnType<typeof createParentNotesQuotaBoundaryController> | null>(null);
  if (!notesBoundaryControllerRef.current) {
    notesBoundaryControllerRef.current = createParentNotesQuotaBoundaryController({
      fetchNotes: () => listParentNotes(),
      getCurrentIdentity: () => currentIdentityRef.current,
      onApplyNotes: (notes) => {
        if (!mountedRef.current) return;
        setParentNotes(notes);
      },
      onClearNotes: () => {
        if (!mountedRef.current) return;
        setParentNotes([]);
      },
      onStatusChange: (status, err) => {
        if (!mountedRef.current) return;
        setNotesStatus(status);
        setNotesError(err);
      },
      onSnapshotChange: (snapshot) => {
        if (!mountedRef.current) return;
        setNotesBoundarySnapshot(snapshot);
      },
    });
  }
  const [notesBoundarySnapshot, setNotesBoundarySnapshot] = useState<ParentNotesBoundarySnapshot>(() =>
    notesBoundaryControllerRef.current!.getSnapshot(),
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    preferencesErrorRef.current = preferencesError;
  }, [preferencesError]);

  const updateNotificationsState = useCallback(
    (updater: NotificationItem[] | ((prev: NotificationItem[]) => NotificationItem[])) => {
      setNotifications((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        notificationsRef.current = next;
        return next;
      });
    },
    [],
  );

  const resetNotificationTracking = useCallback(() => {
    inFlightSingleReadsRef.current.clear();
    pendingMarkAllReadsRef.current.clear();
    pendingNotificationSnapshotsRef.current.clear();
    confirmedReadSeqByIdRef.current.clear();
    latestMarkAllConfirmedSeqRef.current = 0;
    setMarkingNotificationIds([]);
    setMarkingAllNotifications(false);
  }, []);

  const syncAccountIdentity = useCallback(
    (nextUser: User | null) => {
      const prevId = currentIdentityRef.current.userId;
      const prevStatus = currentIdentityRef.current.accountStatus;
      const nextId = nextUser?.id ?? null;
      const nextStatus = nextUser?.accountStatus ?? null;
      if (prevId !== nextId || prevStatus !== nextStatus) {
        authGenerationRef.current += 1;
        currentIdentityRef.current = {
          userId: nextId,
          accountStatus: nextStatus,
          generation: authGenerationRef.current,
        };
        resetNotificationTracking();
        setParentNotes([]);
        setNotesStatus('BLOCKED_BACKEND');
        setNotesError(null);
        const eligibleForNotes = Boolean(
          nextUser &&
            nextUser.accountStatus === 'APPROVED' &&
            nextUser.role !== 'STUDENT' &&
            nextUser.role !== 'SCHOOL_STAFF',
        );
        notesBoundaryControllerRef.current?.setIdentity(eligibleForNotes);
      }
      setCurrentUser(nextUser);
      setCurrentRoleState(nextUser ? nextUser.role : null);
    },
    [resetNotificationTracking],
  );

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  useEffect(() => {
    if (theme === 'pitch-black') {
      document.documentElement.classList.add('dark', 'pitch-black');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark', 'pitch-black');
    }
    localStorage.setItem('kristou_theme', theme);
  }, [theme]);

  const clearPrivateState = useCallback(() => {
    authHydrationGenRef.current += 1;
    classCommGenRef.current += 1;
    prefsGenRef.current += 1;
    resetNotificationTracking();
    setIsHydratingSchoolData(false);
    setIsLoadingClassCommunity(false);
    setChildrenList([]);
    setClassesList([]);
    setClassRosters([]);
    setClassesBackendStatus('BLOCKED_BACKEND');
    setSelectedClassId('');
    setSelectedChildId('');
    setOperationalCounts({});
    setOperationalCountsLoaded(false);
    setSchoolContextError(null);
    setClassAnnouncements([]);
    setHomeworkList([]);
    setClassDocuments([]);
    setClassGallery([]);
    setClassQuestions([]);
    setCommunityStatus('BLOCKED_BACKEND');
    setCommunityError(null);
    setParentNotes([]);
    setNotesStatus('BLOCKED_BACKEND');
    setNotesError(null);
    notesBoundaryControllerRef.current?.setIdentity(false);
    setMessages([]);
    setMessagesStatus('BLOCKED_BACKEND');
    setMessagesError(null);
    setEnrollmentApplications([]);
    setEnrollmentsStatus('BLOCKED_BACKEND');
    setEnrollmentsError(null);
    setPublicInquiries([]);
    setInquiriesStatus('BLOCKED_BACKEND');
    updateNotificationsState([]);
    setNotificationsError(null);
    setPreferencesError(null);
    setPreferencesSyncStatus('LOCAL_ONLY');
  }, [resetNotificationTracking, updateNotificationsState]);

  const hydratePublicData = useCallback(async (targetUserId?: string | null): Promise<boolean> => {
    const reqGen = ++publicHydrationGenRef.current;
    const effectiveUserId = targetUserId !== undefined ? targetUserId : currentUser?.id ?? null;

    try {
      const [bRes, calRes, menuRes, dirRes, contentRes] = await Promise.all([
        listSchoolBroadcasts(),
        listSchoolCalendarEvents(effectiveUserId),
        fetchActiveFoodMenu(),
        listPublicDirectory(),
        fetchPublicContent(),
      ]);

      if (!mountedRef.current || reqGen !== publicHydrationGenRef.current) {
        return false;
      }

      setBroadcastsStatus(bRes.status);
      if (bRes.ok && bRes.data) {
        setBroadcasts(bRes.data);
        setBroadcastsError(null);
      } else if (bRes.status === 'UNAUTHORIZED') {
        setBroadcasts([]);
        setBroadcastsError(bRes.errorMessage || bRes.errorCode || 'Unauthorized to load broadcasts.');
      } else if (bRes.status === 'ERROR') {
        setBroadcastsError(bRes.errorMessage || bRes.errorCode || 'Failed to load broadcasts.');
      } else {
        setBroadcastsError(null);
      }

      setCalendarStatus(calRes.status);
      if (calRes.ok && calRes.data) {
        setCalendarEvents(calRes.data);
        setCalendarError(null);
      } else if (calRes.status === 'UNAUTHORIZED') {
        setCalendarEvents([]);
        setCalendarError(calRes.errorMessage || calRes.errorCode || 'Unauthorized to load calendar.');
      } else if (calRes.status === 'ERROR') {
        setCalendarError(calRes.errorMessage || calRes.errorCode || 'Failed to load calendar events.');
      } else {
        setCalendarError(null);
      }

      setFoodMenuStatus(menuRes.status);
      if (menuRes.ok && menuRes.data) {
        setFoodMenu({ ...menuRes.data, isDemoPreview: false });
        setFoodMenuError(null);
      } else if (menuRes.status === 'READY' && !menuRes.data) {
        setFoodMenu({ id: 'menu-empty', weekRange: '—', published: false, items: [], isDemoPreview: false });
        setFoodMenuError(null);
      } else if (menuRes.status === 'BLOCKED_BACKEND') {
        setFoodMenu(PUBLIC_PREVIEW_FOOD_MENU);
        setFoodMenuError(null);
      } else {
        setFoodMenu({ id: 'menu-error', weekRange: '—', published: false, items: [], isDemoPreview: false });
        setFoodMenuError(menuRes.errorMessage || menuRes.errorCode || 'Failed to load food menu.');
      }

      setDirectoryStatus(dirRes.status);
      if (dirRes.ok && dirRes.data) {
        setTeachers(dirRes.data.teachers);
        setAdmins(dirRes.data.admins);
        setDirectoryError(null);
      } else if (dirRes.status === 'BLOCKED_BACKEND') {
        setTeachers(MOCK_TEACHERS);
        setAdmins(MOCK_ADMIN);
        setDirectoryError(null);
      } else {
        setTeachers([]);
        setAdmins([]);
        setDirectoryError(dirRes.errorMessage || dirRes.errorCode || 'Failed to load directory.');
      }

      setPublicContentStatus(contentRes.status);
      if (contentRes.ok && contentRes.data) {
        setPublicContent(contentRes.data);
        setPublicContentError(null);
      } else if (contentRes.status === 'BLOCKED_BACKEND') {
        setPublicContent({});
        setPublicContentError(null);
      } else {
        setPublicContent({});
        setPublicContentError(
          contentRes.errorMessage || contentRes.errorCode || 'Failed to load public content.',
        );
      }

      return calRes.ok || calRes.status === 'BLOCKED_BACKEND';
    } catch (err) {
      if (!mountedRef.current || reqGen !== publicHydrationGenRef.current) {
        return false;
      }
      const message = err instanceof Error ? err.message : 'Unable to refresh public school data.';
      setCalendarStatus('ERROR');
      setCalendarError(message);
      setBroadcastsStatus('ERROR');
      setBroadcastsError(message);
      setPublicContentStatus('ERROR');
      setPublicContent({});
      setPublicContentError(message);
      return false;
    }
  }, [currentUser?.id]);

  const hydrateAuthenticatedData = useCallback(
    async (user: User, activeClassFilter?: string): Promise<boolean> => {
      if (user.accountStatus !== 'APPROVED') {
        clearPrivateState();
        return false;
      }

      const origin: AccountIdentityContext = {
        userId: user.id,
        accountStatus: user.accountStatus,
        generation: currentIdentityRef.current.generation,
      };
      if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
        return false;
      }

      const reqGen = ++authHydrationGenRef.current;
      const isStillValid = () =>
        mountedRef.current &&
        reqGen === authHydrationGenRef.current &&
        isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current);

      setIsHydratingSchoolData(true);
      setSchoolContextError(null);
      setNotificationsError(null);

      try {
        const [ctxRes, prefsRes, notifRes] = await Promise.all([
          fetchMySchoolContext(),
          loadMyPreferences(user.id),
          listMyNotifications(),
        ]);

        if (!isStillValid()) return false;

        if (prefsRes.ok && prefsRes.data) {
          setLanguageState(prefsRes.data.language);
          localStorage.setItem('kristou_lang', prefsRes.data.language);
          setThemeState(prefsRes.data.theme);
          localStorage.setItem('kristou_theme', prefsRes.data.theme);
          setNotificationSoundState(prefsRes.data.notificationSound);
          localStorage.setItem('kristou_notification_sound', prefsRes.data.notificationSound);
          setSoundMutedState(prefsRes.data.soundMuted);
          localStorage.setItem('kristou_sound_muted', String(prefsRes.data.soundMuted));
          setVibrationEnabledState(prefsRes.data.vibrationEnabled);
          localStorage.setItem('kristou_vibration_enabled', String(prefsRes.data.vibrationEnabled));
          setPreferencesError(null);
          setPreferencesSyncStatus('SAVED');
        } else if (prefsRes.status === 'BLOCKED_BACKEND') {
          setPreferencesSyncStatus('UNAVAILABLE');
        } else if (!prefsRes.ok) {
          setPreferencesSyncStatus('ERROR');
          setPreferencesError(prefsRes.errorMessage || prefsRes.errorCode || 'Unable to load preferences.');
        }

        if (notifRes.ok && notifRes.data) {
          updateNotificationsState(
            mergeRefreshedNotifications(
              notifRes.data,
              inFlightSingleReadsRef.current,
              pendingMarkAllReadsRef.current,
              confirmedReadSeqByIdRef.current,
            ),
          );
          setNotificationsError(null);
        } else if (notifRes.status === 'UNAUTHORIZED') {
          updateNotificationsState([]);
          setNotificationsError(notifRes.errorMessage || notifRes.errorCode || 'Not authorized to load notifications.');
        } else if (!notifRes.ok && notifRes.status !== 'BLOCKED_BACKEND') {
          setNotificationsError(notifRes.errorMessage || notifRes.errorCode || 'Unable to load notifications.');
        }

        let resolvedClassIds = user.assignedClassIds ?? [];
        if (ctxRes.ok && ctxRes.data) {
          setChildrenList(ctxRes.data.children);
          setClassesList(ctxRes.data.classes);
          setOperationalCounts(ctxRes.data.operationalCounts);
          setOperationalCountsLoaded(true);
          if (ctxRes.data.children.length > 0) {
            setSelectedChildId((prev) =>
              ctxRes.data!.children.some((c) => c.id === prev) ? prev : ctxRes.data!.children[0].id,
            );
          } else {
            setSelectedChildId('');
          }
          resolvedClassIds = ctxRes.data.assignedClassIds;
          setCurrentUser((prev) =>
            prev && prev.id === user.id
              ? {
                  ...prev,
                  linkedChildrenIds: ctxRes.data!.linkedChildrenIds,
                  assignedClassIds: ctxRes.data!.assignedClassIds,
                }
              : prev,
          );
        } else {
          setOperationalCountsLoaded(false);
          if (ctxRes.status === 'UNAUTHORIZED') {
            setChildrenList([]);
            setClassesList([]);
          }
          if (ctxRes.status !== 'BLOCKED_BACKEND') {
            setSchoolContextError(ctxRes.errorMessage || ctxRes.errorCode || 'Unable to load school context.');
          }
        }

        // Classes & Rosters for Owner / Admin / Teachers / delegated Managers
        if (
          user.role === 'APP_ADMIN' ||
          user.role === 'ADMINISTRATIVE_PERSONNEL' ||
          user.role === 'TEACHER' ||
          (user.role === 'MANAGER' &&
            (user.capabilities?.includes('CLASSES_ROSTER_VIEW') ||
              user.capabilities?.includes('CLASSES_MANAGE') ||
              user.capabilities?.includes('FULL_ACCESS')))
        ) {
          const rostersRes = await fetchSchoolClassesWithRosters();
          if (!isStillValid()) return false;
          setClassesBackendStatus(rostersRes.status);
          if (rostersRes.ok && rostersRes.data) {
            setClassRosters(rostersRes.data);
            if (user.role === 'APP_ADMIN' || user.role === 'ADMINISTRATIVE_PERSONNEL' || user.role === 'MANAGER') {
              setClassesList((prev) =>
                prev.length > 0
                  ? prev
                  : rostersRes.data!.map((r) => ({
                      id: r.id,
                      name: r.name,
                      level: r.level,
                      teacherId: '',
                      teacherName: r.homeroomTeacherName || '',
                      academicYear: r.academicYear,
                      studentCount: r.activeStudentCount,
                    })),
              );
            }
            if (resolvedClassIds.length === 0 && rostersRes.data.length > 0) {
              resolvedClassIds = rostersRes.data.map((r) => r.id);
            }
          } else if (rostersRes.status === 'UNAUTHORIZED') {
            setClassRosters([]);
          }
        } else {
          setClassesBackendStatus('UNAUTHORIZED');
          setClassRosters([]);
        }

        const targetClassId =
          activeClassFilter && resolvedClassIds.includes(activeClassFilter)
            ? activeClassFilter
            : resolvedClassIds[0] || '';
        if (targetClassId && targetClassId !== selectedClassId) {
          setSelectedClassId(targetClassId);
        }

        // Class community content (skip if SCHOOL_STAFF without class support)
        const canSeeCommunity =
          user.role !== 'SCHOOL_STAFF' ||
          Boolean(user.capabilities?.some((c) => c === 'ANNOUNCEMENTS_READ' || c === 'CALENDAR_READ' || c === 'CLASS_SUPPORT'));
        if (canSeeCommunity) {
          setIsLoadingClassCommunity(true);
          const commRes = await listClassCommunityContent(targetClassId || undefined);
          if (!isStillValid()) return false;
          setIsLoadingClassCommunity(false);
          setCommunityStatus(commRes.status);
          if (commRes.ok && commRes.data) {
            setClassAnnouncements(commRes.data.announcements);
            setHomeworkList(commRes.data.homework);
            setClassQuestions(commRes.data.questions);
            setClassDocuments(commRes.data.documents);
            setClassGallery(commRes.data.gallery);
            setCommunityError(null);
          } else if (commRes.status === 'UNAUTHORIZED') {
            setClassAnnouncements([]);
            setHomeworkList([]);
            setClassQuestions([]);
            setClassDocuments([]);
            setClassGallery([]);
            setCommunityError(commRes.errorMessage || commRes.errorCode || 'Unauthorized for class community.');
          } else if (commRes.status === 'ERROR') {
            setCommunityError(commRes.errorMessage || commRes.errorCode || 'Unable to load class community.');
          } else {
            setCommunityError(null);
          }
        } else {
          setCommunityStatus('UNAUTHORIZED');
          setClassAnnouncements([]);
          setHomeworkList([]);
          setClassQuestions([]);
          setClassDocuments([]);
          setClassGallery([]);
          setCommunityError('Unauthorized for class community.');
        }

        // Parent Notes
        if (user.role !== 'STUDENT' && user.role !== 'SCHOOL_STAFF') {
          const notesReq = notesBoundaryControllerRef.current?.beginHydrationRequest(
            origin,
            mountedRef.current,
          );
          const notesRes = await listParentNotes();
          if (!isStillValid()) return false;
          if (
            notesReq &&
            notesBoundaryControllerRef.current?.isRequestCurrent(notesReq, mountedRef.current)
          ) {
            setNotesStatus(notesRes.status);
            const certifiedCurrentCycle = notesBoundaryControllerRef.current.recordHydratedResult(
              origin,
              notesRes,
              notesReq.startedAt,
              mountedRef.current,
              notesReq,
            );
            if (notesRes.ok && notesRes.data) {
              setParentNotes(notesRes.data);
              setNotesError(null);
              if (!certifiedCurrentCycle) {
                void notesBoundaryControllerRef.current.checkBoundaryAndRefresh();
              }
            } else if (notesRes.status === 'UNAUTHORIZED') {
              setParentNotes([]);
              setNotesError(notesRes.errorMessage || notesRes.errorCode || 'Not authorized to view parent notes.');
            } else if (notesRes.status === 'ERROR') {
              setNotesError(notesRes.errorMessage || notesRes.errorCode || 'Failed to load parent notes.');
            } else {
              setNotesError(null);
            }
          }
        } else {
          setNotesStatus('UNAUTHORIZED');
          setParentNotes([]);
          setNotesError('Parent notes are unavailable for this role.');
          notesBoundaryControllerRef.current?.setIdentity(false);
        }

        // Operational Direct Messages (all except STUDENT)
        if (user.role !== 'STUDENT') {
          const msgRes = await listMessageThreads(user.id);
          if (!isStillValid()) return false;
          setMessagesStatus(msgRes.status);
          if (msgRes.ok && msgRes.data) {
            setMessages(msgRes.data);
            setMessagesError(null);
          } else if (msgRes.status === 'UNAUTHORIZED') {
            setMessages([]);
            setMessagesError(msgRes.errorMessage || msgRes.errorCode || 'Not authorized to view messages.');
          } else if (msgRes.status === 'ERROR') {
            setMessagesError(msgRes.errorMessage || msgRes.errorCode || 'Failed to load messages.');
          } else {
            setMessagesError(null);
          }
        } else {
          setMessagesStatus('UNAUTHORIZED');
          setMessages([]);
          setMessagesError('Direct messaging is unavailable for student accounts.');
        }

        // Enrollment applications & Public Inquiries
        const enrRes = await listEnrollmentApplications();
        if (!isStillValid()) return false;
        setEnrollmentsStatus(enrRes.status);
        if (enrRes.ok && enrRes.data) {
          setEnrollmentApplications(enrRes.data);
          setEnrollmentsError(null);
        } else if (enrRes.status === 'UNAUTHORIZED') {
          setEnrollmentApplications([]);
          setEnrollmentsError(enrRes.errorMessage || enrRes.errorCode || 'Not authorized to view enrollment queue.');
        } else if (enrRes.status === 'ERROR') {
          setEnrollmentsError(enrRes.errorMessage || enrRes.errorCode || 'Failed to load enrollment queue.');
        } else {
          setEnrollmentsError(null);
        }

        if (canReviewOrdinaryAccountsUi(user) || user.role === 'MANAGER') {
          const inqRes = await listPublicInquiries();
          if (!isStillValid()) return false;
          setInquiriesStatus(inqRes.status);
          if (inqRes.ok && inqRes.data) {
            setPublicInquiries(inqRes.data);
          } else if (inqRes.status === 'UNAUTHORIZED') {
            setPublicInquiries([]);
          }
        } else {
          setInquiriesStatus('UNAUTHORIZED');
          setPublicInquiries([]);
        }
        return true;
      } catch (err) {
        if (isStillValid()) {
          setSchoolContextError(err instanceof Error ? err.message : 'Unable to load school data.');
        }
        return false;
      } finally {
        if (mountedRef.current && reqGen === authHydrationGenRef.current) {
          setIsHydratingSchoolData(false);
          setIsLoadingClassCommunity(false);
        }
      }
    },
    [clearPrivateState, selectedClassId, updateNotificationsState],
  );

  const refreshSchoolData = useCallback(async (): Promise<boolean> => {
    const publicOk = await hydratePublicData(currentUser?.id ?? null);
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      const authOk = await hydrateAuthenticatedData(currentUser, selectedClassId || undefined);
      return publicOk && authOk;
    }
    return publicOk;
  }, [currentUser, hydrateAuthenticatedData, hydratePublicData, selectedClassId]);

  useEffect(() => {
    void hydratePublicData(currentUser?.id ?? null);
  }, [hydratePublicData, currentUser?.id]);

  useEffect(() => {
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      void hydrateAuthenticatedData(currentUser, selectedClassId || undefined);
    } else {
      clearPrivateState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.accountStatus]);

  useEffect(() => {
    const eligible = Boolean(
      currentUser &&
        currentUser.accountStatus === 'APPROVED' &&
        currentUser.role !== 'STUDENT' &&
        currentUser.role !== 'SCHOOL_STAFF',
    );
    if (!eligible) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const controller = notesBoundaryControllerRef.current;
    if (!controller) return;

    const runBoundaryCheck = () => {
      if (cancelled) return;
      void controller.checkBoundaryAndRefresh();
    };

    const scheduleNext = () => {
      if (cancelled) return;
      timerId = setTimeout(() => {
        runBoundaryCheck();
        scheduleNext();
      }, getNextTunisBoundaryDelayMs());
    };

    scheduleNext();

    const handleVisibility = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        runBoundaryCheck();
      }
    };
    const handleFocus = () => runBoundaryCheck();
    const handlePageShow = () => runBoundaryCheck();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      window.addEventListener('pageshow', handlePageShow);
    }

    return () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('pageshow', handlePageShow);
      }
    };
  }, [currentUser?.id, currentUser?.accountStatus, currentUser?.role]);

  useEffect(() => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED' || !selectedClassId) return;
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const reqGen = ++classCommGenRef.current;
    setIsLoadingClassCommunity(true);
    void listClassCommunityContent(selectedClassId)
      .then((commRes) => {
        if (
          !mountedRef.current ||
          reqGen !== classCommGenRef.current ||
          !isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)
        ) {
          return;
        }
        setCommunityStatus(commRes.status);
        if (commRes.ok && commRes.data) {
          setClassAnnouncements(commRes.data.announcements);
          setHomeworkList(commRes.data.homework);
          setClassQuestions(commRes.data.questions);
          setClassDocuments(commRes.data.documents);
          setClassGallery(commRes.data.gallery);
          setCommunityError(null);
        } else if (commRes.status === 'UNAUTHORIZED') {
          setClassAnnouncements([]);
          setHomeworkList([]);
          setClassQuestions([]);
          setClassDocuments([]);
          setClassGallery([]);
          setCommunityError(commRes.errorMessage || commRes.errorCode || 'Unauthorized for class community.');
        } else if (commRes.status === 'ERROR') {
          setCommunityError(commRes.errorMessage || commRes.errorCode || 'Unable to load class community.');
        } else {
          setCommunityError(null);
        }
      })
      .catch((err) => {
        if (
          !mountedRef.current ||
          reqGen !== classCommGenRef.current ||
          !isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)
        ) {
          return;
        }
        setCommunityStatus('ERROR');
        setCommunityError(err instanceof Error ? err.message : 'Unable to load class community.');
      })
      .finally(() => {
        if (mountedRef.current && reqGen === classCommGenRef.current) {
          setIsLoadingClassCommunity(false);
        }
      });
  }, [currentUser, selectedClassId]);

  useEffect(() => {
    initializeTelegramWebApp();
    const initData = getTelegramWebAppInitData();
    if (!initData) return;
    const isLinkAttempt = Boolean(new URLSearchParams(initData).get('start_param'));

    let active = true;
    void authenticateTelegramInitData(initData)
      .then(({ user, linked }) => {
        if (!active || !mountedRef.current) return;
        telegramIdentityUser.current = user;
        syncAccountIdentity(user);
        if (isLinkAttempt && linked) setTelegramLinkNotice('success');
      })
      .catch(() => {
        if (!active || !mountedRef.current) return;
        telegramIdentityUser.current = null;
        syncAccountIdentity(null);
        if (isLinkAttempt) setTelegramLinkNotice('error');
      });
    return () => {
      active = false;
    };
  }, [syncAccountIdentity]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !mountedRef.current) return;
      if (telegramIdentityUser.current) {
        syncAccountIdentity(telegramIdentityUser.current);
        return;
      }
      if (!data.session?.user) return;
      try {
        const user = await loadCanonicalUser(data.session.user);
        if (active && mountedRef.current) {
          syncAccountIdentity(user);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'account_not_approved') {
          void signOutAccount();
        }
        if (active && mountedRef.current) {
          syncAccountIdentity(null);
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active || !mountedRef.current) return;
      if (telegramIdentityUser.current) {
        syncAccountIdentity(telegramIdentityUser.current);
        return;
      }
      if (!session?.user) {
        syncAccountIdentity(null);
        return;
      }
      try {
        const user = await loadCanonicalUser(session.user);
        if (active && mountedRef.current) {
          syncAccountIdentity(user);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'account_not_approved') {
          void signOutAccount();
        }
        if (active && mountedRef.current) {
          syncAccountIdentity(null);
        }
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [syncAccountIdentity]);

  const persistPreferencesUpdate = (patch: {
    language?: Language;
    theme?: ThemeMode;
    notificationSound?: NotificationSoundOption;
    soundMuted?: boolean;
    vibrationEnabled?: boolean;
  }) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      setPreferencesSyncStatus('LOCAL_ONLY');
      return;
    }

    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const requestSeq = ++prefsGenRef.current;
    setPreferencesSyncStatus('SAVING');

    void saveMyPreferences(patch)
      .catch((err): BackendOpResult<unknown> => ({
        ok: false,
        status: 'ERROR',
        errorCode: 'preference_save_failed',
        errorMessage: err instanceof Error ? err.message : 'Failed to save preferences.',
      }))
      .then((result) => {
        const outcome = resolvePreferencesPersistOutcome({
          result,
          origin,
          current: currentIdentityRef.current,
          requestSeq,
          latestRequestSeq: prefsGenRef.current,
          previousError: preferencesErrorRef.current,
          isMounted: mountedRef.current,
        });
        if (outcome.ignored) return;
        setPreferencesSyncStatus(outcome.syncStatus);
        setPreferencesError(outcome.error);
      });
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('kristou_lang', lang);
    persistPreferencesUpdate({ language: lang });
  };

  const setTheme = (thm: ThemeMode) => {
    setThemeState(thm);
    localStorage.setItem('kristou_theme', thm);
    persistPreferencesUpdate({ theme: thm });
  };

  const setNotificationSound = (sound: NotificationSoundOption) => {
    setNotificationSoundState(sound);
    localStorage.setItem('kristou_notification_sound', sound);
    persistPreferencesUpdate({ notificationSound: sound });
  };

  const setSoundMuted = (muted: boolean) => {
    setSoundMutedState(muted);
    localStorage.setItem('kristou_sound_muted', String(muted));
    persistPreferencesUpdate({ soundMuted: muted });
  };

  const setVibrationEnabled = (enabled: boolean) => {
    setVibrationEnabledState(enabled);
    localStorage.setItem('kristou_vibration_enabled', String(enabled));
    persistPreferencesUpdate({ vibrationEnabled: enabled });
  };

  const t = (key: TranslationKey): string => {
    const dict = translations[language] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  // Merge school-wide broadcasts (only show demo preview when status === 'BLOCKED_BACKEND',
  // never when an ordinary network/permission ERROR or UNAUTHORIZED occurred) + class announcements.
  const combinedAnnouncements: Announcement[] = [
    ...(broadcastsStatus === 'READY'
      ? broadcasts
      : broadcastsStatus === 'BLOCKED_BACKEND'
      ? PUBLIC_PREVIEW_ANNOUNCEMENTS
      : []),
    ...classAnnouncements,
  ];

  const localizedAnnouncements = combinedAnnouncements.map((item) =>
    item.isDemoPreview
      ? {
          ...item,
          title: contentT(language, 'announcements', item.id, 'title', item.title),
          body: contentT(language, 'announcements', item.id, 'body', item.body),
          authorRole: contentT(language, 'announcements', item.id, 'authorRole', item.authorRole),
        }
      : item,
  );

  const localizedFoodMenu = foodMenu.isDemoPreview
    ? {
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
      }
    : foodMenu;

  const localizedTeachers =
    directoryStatus === 'READY'
      ? teachers
      : directoryStatus === 'BLOCKED_BACKEND'
      ? teachers.map((item) => ({
          ...item,
          title: contentT(language, 'teachers', item.id, 'title', item.title),
          bio: contentT(language, 'teachers', item.id, 'bio', item.bio),
        }))
      : [];

  const localizedAdmins =
    directoryStatus === 'READY'
      ? admins
      : directoryStatus === 'BLOCKED_BACKEND'
      ? admins.map((item) => ({
          ...item,
          title: contentT(language, 'admins', item.id, 'title', item.title),
          bio: contentT(language, 'admins', item.id, 'bio', item.bio),
        }))
      : [];

  const login = async (identifier: string, pass: string) => {
    try {
      const { user } = await signInAccount(identifier, pass);
      const canonicalUser = await loadCanonicalUser(user);
      syncAccountIdentity(canonicalUser);
      return { success: true };
    } catch (error) {
      await signOutAccount();
      syncAccountIdentity(null);
      const errorCode = classifySignInError(error);
      return {
        success: false,
        errorCode,
        error: resolveSignInErrorMessage(language, errorCode),
      };
    }
  };

  const signup = async (input: {
    username?: string;
    password: string;
    email?: string;
    phone?: string;
    fullName: string;
    requestedRole: SignupRole;
    staffId?: string;
    admissionId?: string;
  }) => {
    try {
      const data = await signUpAccount(input);
      return {
        success: true,
        confirmationRequired: !data.session,
        secondaryPhoneVerificationRequired: Boolean(data.secondaryPhoneVerificationRequired),
      };
    } catch (error) {
      const errorCode = classifySignUpError(error);
      return {
        success: false,
        errorCode,
        error: resolveSignUpErrorMessage(language, errorCode),
      };
    }
  };

  const logout = () => {
    telegramIdentityUser.current = null;
    void signOutAccount();
    syncAccountIdentity(null);
    clearPrivateState();
  };

  const connectTelegram = async () => {
    if (!currentUser) return { error: 'Authentication required' };
    try {
      const challenge = await createTelegramLinkChallenge();
      return { linkUrl: challenge.linkUrl };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to start Telegram linking' };
    }
  };

  const refreshParentNotesQuota = useCallback(async (): Promise<boolean> => {
    if (!notesBoundaryControllerRef.current) return false;
    return notesBoundaryControllerRef.current.refreshNow();
  }, []);

  const remainingParentNotesToday =
    notesBoundarySnapshot && notesBoundaryControllerRef.current
      ? notesBoundaryControllerRef.current.computeRemainingQuota(parentNotes, currentUser?.id)
      : null;

  const addParentNote = async (
    childId: string,
    topic: ParentNote['topic'],
    content: string,
    _teacherId?: string,
  ) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return { success: false, status: 'UNAUTHORIZED' as const, errorCode: 'actor_not_approved', error: 'Approved account required.' };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const res = await sendParentNoteRpc(childId, topic, content);
    if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
      return { success: false, status: 'ERROR' as const, errorCode: 'session_changed', error: 'Account session changed.' };
    }
    if (!res.ok || !res.data) {
      return {
        success: false,
        status: res.status,
        errorCode: res.errorCode,
        error: res.errorMessage,
      };
    }
    setParentNotes((prev) => [res.data!.note, ...prev]);
    return { success: true, status: res.status };
  };

  const replyParentNote = async (noteId: string, replyContent: string) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return { ok: false, status: 'UNAUTHORIZED' as const, errorCode: 'actor_not_approved', errorMessage: 'Approved account required.' };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const res = await replyParentNoteRpc(noteId, replyContent);
    if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
      return { ok: false, status: 'ERROR' as const, errorCode: 'session_changed', errorMessage: 'Account session changed.' };
    }
    if (res.ok && res.data) {
      setParentNotes((prev) => prev.map((n) => (n.id === noteId ? res.data! : n)));
    }
    return res;
  };

  const addClassQuestion = async (classId: string, content: string) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return { success: false, status: 'UNAUTHORIZED' as const, errorCode: 'actor_not_approved', error: 'Approved account required.' };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const res = await postClassQuestionRpc(classId, content);
    if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
      return { success: false, status: 'ERROR' as const, errorCode: 'session_changed', error: 'Account session changed.' };
    }
    if (!res.ok || !res.data) {
      return {
        success: false,
        status: res.status,
        errorCode: res.errorCode,
        error: res.errorMessage,
      };
    }
    setClassQuestions((prev) => [res.data!, ...prev]);
    return { success: true, status: res.status };
  };

  const replyClassQuestion = async (questionId: string, content: string) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return { ok: false, status: 'UNAUTHORIZED' as const, errorCode: 'actor_not_approved', errorMessage: 'Approved account required.' };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const res = await replyClassQuestionRpc(questionId, content);
    if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
      return { ok: false, status: 'ERROR' as const, errorCode: 'session_changed', errorMessage: 'Account session changed.' };
    }
    if (res.ok && res.data) {
      setClassQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const nextReplies = [...(q.replies || []), res.data!];
          return { ...q, replies: nextReplies, repliesCount: nextReplies.length };
        }),
      );
    }
    return res;
  };

  const moderateClassQuestion = async (questionId: string, hidden: boolean) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return { ok: false, status: 'UNAUTHORIZED' as const, errorCode: 'actor_not_approved', errorMessage: 'Approved account required.' };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const res = await moderateClassQuestionRpc(questionId, hidden);
    if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
      return { ok: false, status: 'ERROR' as const, errorCode: 'session_changed', errorMessage: 'Account session changed.' };
    }
    if (res.ok) {
      setClassQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, isHidden: hidden } : q)),
      );
    }
    return res;
  };

  // Safety lock: Pickup arrival and physical child release require server-verified Supabase persistence
  // (`pickup_events` + atomic RPCs). Never simulate local arrival or release success in production mode.
  const markPickupArrived = (_childId: string) => ({
    success: false,
    error: 'pickup_backend_unavailable',
  });

  const confirmPickupRelease = (_recordId: string) => ({
    success: false,
    error: 'pickup_backend_unavailable',
  });

  const reconcileNotificationsFromServer = async (origin: AccountIdentityContext) => {
    try {
      const readback = await listMyNotifications();
      if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
        return;
      }
      if (readback.ok && readback.data) {
        updateNotificationsState(
          mergeRefreshedNotifications(
            readback.data,
            inFlightSingleReadsRef.current,
            pendingMarkAllReadsRef.current,
            confirmedReadSeqByIdRef.current,
          ),
        );
      }
    } catch {
      // Keep the deterministic local reconciliation state if readback itself cannot complete.
    }
  };

  const markNotificationRead = (id: string) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') return;

    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const requestSeq = ++notifSeqRef.current;
    const snapshot = captureNotificationReadSnapshot(
      notificationsRef.current, [id], pendingNotificationSnapshotsRef.current.values(), origin, requestSeq,
    );
    pendingNotificationSnapshotsRef.current.set(requestSeq, snapshot);

    inFlightSingleReadsRef.current.add(id);
    setMarkingNotificationIds(Array.from(inFlightSingleReadsRef.current));
    setNotificationsError(null);
    updateNotificationsState((prev) => applySingleNotificationOptimisticRead(prev, id));

    void (async () => {
      let res: BackendOpResult<boolean>;
      try {
        res = await markNotificationReadOnServer(id);
      } catch (err) {
        res = {
          ok: false,
          status: 'ERROR',
          errorCode: 'notification_mark_failed',
          errorMessage: err instanceof Error ? err.message : 'Unable to update notification status.',
        };
      }

      if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
        return;
      }

      pendingNotificationSnapshotsRef.current.delete(requestSeq);
      inFlightSingleReadsRef.current.delete(id);
      setMarkingNotificationIds(Array.from(inFlightSingleReadsRef.current));

      if (res.ok) {
        const prevSeq = confirmedReadSeqByIdRef.current.get(id) ?? 0;
        if (requestSeq > prevSeq) {
          confirmedReadSeqByIdRef.current.set(id, requestSeq);
        }
        updateNotificationsState((prev) => mergeRefreshedNotifications(
          prev, inFlightSingleReadsRef.current, pendingMarkAllReadsRef.current, confirmedReadSeqByIdRef.current,
        ));
        return;
      }

      updateNotificationsState((prev) => mergeRefreshedNotifications(
        reconcileFailedSingleNotificationRead(
          prev,
          snapshot,
          currentIdentityRef.current,
          confirmedReadSeqByIdRef.current,
          latestMarkAllConfirmedSeqRef.current,
          mountedRef.current,
        ).notifications,
        inFlightSingleReadsRef.current,
        pendingMarkAllReadsRef.current,
        confirmedReadSeqByIdRef.current,
      ));

      if (res.status !== 'BLOCKED_BACKEND') {
        setNotificationsError(
          res.errorMessage || res.errorCode || 'Unable to update notification status.',
        );
        if (res.status !== 'UNAUTHORIZED') {
          await reconcileNotificationsFromServer(origin);
        }
      }
    })();
  };

  const markAllNotificationsRead = () => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') return;

    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: currentIdentityRef.current.generation,
    };
    const requestSeq = ++notifSeqRef.current;
    const snapshot = captureNotificationReadSnapshot(
      notificationsRef.current, notificationsRef.current.map(item => item.id),
      pendingNotificationSnapshotsRef.current.values(), origin, requestSeq,
    );
    pendingNotificationSnapshotsRef.current.set(requestSeq, snapshot);

    pendingMarkAllReadsRef.current.set(requestSeq, new Set(snapshot.targetIds));
    setMarkingAllNotifications(true);
    setNotificationsError(null);
    updateNotificationsState((prev) => applyAllNotificationsOptimisticRead(prev).nextNotifications);

    void (async () => {
      let res: BackendOpResult<number>;
      try {
        res = await markAllNotificationsReadOnServer();
      } catch (err) {
        res = {
          ok: false,
          status: 'ERROR',
          errorCode: 'notifications_mark_all_failed',
          errorMessage: err instanceof Error ? err.message : 'Unable to mark notifications read.',
        };
      }

      if (!isMatchingApprovedAccountContext(origin, currentIdentityRef.current, mountedRef.current)) {
        return;
      }

      pendingNotificationSnapshotsRef.current.delete(requestSeq);
      pendingMarkAllReadsRef.current.delete(requestSeq);
      setMarkingAllNotifications(pendingMarkAllReadsRef.current.size > 0);

      if (res.ok) {
        for (const id of snapshot.targetIds) {
          confirmedReadSeqByIdRef.current.set(id, Math.max(requestSeq, confirmedReadSeqByIdRef.current.get(id) ?? 0));
        }
        if (requestSeq > latestMarkAllConfirmedSeqRef.current) {
          latestMarkAllConfirmedSeqRef.current = requestSeq;
        }
        updateNotificationsState((prev) => mergeRefreshedNotifications(
          prev, inFlightSingleReadsRef.current, pendingMarkAllReadsRef.current, confirmedReadSeqByIdRef.current,
        ));
        return;
      }

      updateNotificationsState((prev) => mergeRefreshedNotifications(
        reconcileFailedMarkAllNotificationsRead(
          prev,
          snapshot,
          currentIdentityRef.current,
          confirmedReadSeqByIdRef.current,
          latestMarkAllConfirmedSeqRef.current,
          mountedRef.current,
        ).notifications,
        inFlightSingleReadsRef.current,
        pendingMarkAllReadsRef.current,
        confirmedReadSeqByIdRef.current,
      ));

      if (res.status !== 'BLOCKED_BACKEND') {
        setNotificationsError(
          res.errorMessage || res.errorCode || 'Unable to mark notifications read.',
        );
        if (res.status !== 'UNAUTHORIZED') {
          await reconcileNotificationsFromServer(origin);
        }
      }
    })();
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentRole,
        language,
        setLanguage,
        theme,
        setTheme,
        t,
        dir,
        childrenList,
        classesList,
        classRosters,
        classesBackendStatus,
        selectedClassId,
        setSelectedClassId,
        selectedChildId,
        setSelectedChildId,
        operationalCounts,
        operationalCountsLoaded,
        isHydratingSchoolData,
        isLoadingClassCommunity,
        schoolContextError,
        announcements: localizedAnnouncements,
        broadcasts,
        broadcastsStatus,
        broadcastsError,
        homeworkList,
        classDocuments,
        classGallery,
        calendarEvents,
        calendarStatus,
        calendarError,
        classQuestions,
        communityStatus,
        communityError,
        parentNotes,
        notesStatus,
        notesError,
        remainingParentNotesToday,
        isRefreshingParentNotesQuota: notesBoundarySnapshot.refreshing,
        parentNotesQuotaStale: notesBoundarySnapshot.quotaStale,
        parentNotesQuotaVerified: notesBoundarySnapshot.quotaVerified,
        messages,
        messagesStatus,
        messagesError,
        pickupRecords,
        foodMenu: localizedFoodMenu,
        foodMenuStatus,
        foodMenuError,
        teachers: localizedTeachers,
        admins: localizedAdmins,
        directoryStatus,
        directoryError,
        publicContent,
        publicContentStatus,
        publicContentError,
        enrollmentApplications,
        enrollmentsStatus,
        enrollmentsError,
        publicInquiries,
        inquiriesStatus,
        notifications,
        notificationsError,
        markingNotificationIds,
        markingAllNotifications,
        preferencesError,
        preferencesSyncStatus,
        login,
        signup,
        logout,
        connectTelegram,
        telegramLinkNotice,
        dismissTelegramLinkNotice: () => setTelegramLinkNotice(null),
        refreshSchoolData,
        refreshParentNotesQuota,
        addParentNote,
        replyParentNote,
        addClassQuestion,
        replyClassQuestion,
        moderateClassQuestion,
        markPickupArrived,
        confirmPickupRelease,
        markNotificationRead,
        markAllNotificationsRead,
        notificationSound,
        setNotificationSound,
        soundMuted,
        setSoundMuted,
        vibrationEnabled,
        setVibrationEnabled,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
