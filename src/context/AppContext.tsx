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
  getTunisSchoolDay,
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
  PARENT_NOTES_DAILY_QUOTA,
  postClassQuestion as postClassQuestionRpc,
  replyClassQuestion as replyClassQuestionRpc,
  replyParentNote as replyParentNoteRpc,
  saveMyPreferences,
  sendParentNote as sendParentNoteRpc,
} from '../lib/schoolContent';
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

  announcements: Announcement[];
  broadcasts: SchoolBroadcastItem[];
  broadcastsStatus: BackendOpStatus;
  homeworkList: Homework[];
  classDocuments: ClassDocumentItem[];
  classGallery: ClassGalleryItem[];
  calendarEvents: CalendarEvent[];
  calendarStatus: BackendOpStatus;
  classQuestions: ClassQuestion[];
  communityStatus: BackendOpStatus;
  parentNotes: ParentNote[];
  notesStatus: BackendOpStatus;
  remainingParentNotesToday: number;
  messages: MessageThread[];
  messagesStatus: BackendOpStatus;
  pickupRecords: PickupRecord[];
  foodMenu: FoodMenuWeek;
  foodMenuStatus: BackendOpStatus;
  teachers: TeacherDirectoryMember[];
  admins: AdminDirectoryMember[];
  directoryStatus: BackendOpStatus;
  enrollmentApplications: EnrollmentApplication[];
  enrollmentsStatus: BackendOpStatus;
  publicInquiries: PublicInquiryItem[];
  inquiriesStatus: BackendOpStatus;
  notifications: NotificationItem[];

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
  refreshSchoolData: () => Promise<void>;
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
  const [telegramLinkNotice, setTelegramLinkNotice] = useState<'success' | 'error' | null>(null);

  // Private operational state starts strictly empty (zero mock private records).
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [classRosters, setClassRosters] = useState<SchoolClassWithRoster[]>([]);
  const [classesBackendStatus, setClassesBackendStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [operationalCounts, setOperationalCounts] = useState<OperationalCounts>({});

  const [broadcasts, setBroadcasts] = useState<SchoolBroadcastItem[]>([]);
  const [broadcastsStatus, setBroadcastsStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [classAnnouncements, setClassAnnouncements] = useState<Announcement[]>([]);
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [classDocuments, setClassDocuments] = useState<ClassDocumentItem[]>([]);
  const [classGallery, setClassGallery] = useState<ClassGalleryItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [classQuestions, setClassQuestions] = useState<ClassQuestion[]>([]);
  const [communityStatus, setCommunityStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [parentNotes, setParentNotes] = useState<ParentNote[]>([]);
  const [notesStatus, setNotesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [pickupRecords] = useState<PickupRecord[]>([]);

  // Public content (directory / canteen / public highlights) hydrates from Supabase when deployed,
  // falling back honestly to demo preview only for public unauthenticated showcase.
  const [foodMenu, setFoodMenu] = useState<FoodMenuWeek>(PUBLIC_PREVIEW_FOOD_MENU);
  const [foodMenuStatus, setFoodMenuStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [teachers, setTeachers] = useState<TeacherDirectoryMember[]>(MOCK_TEACHERS);
  const [admins, setAdmins] = useState<AdminDirectoryMember[]>(MOCK_ADMIN);
  const [directoryStatus, setDirectoryStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');

  const [enrollmentApplications, setEnrollmentApplications] = useState<EnrollmentApplication[]>([]);
  const [enrollmentsStatus, setEnrollmentsStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [publicInquiries, setPublicInquiries] = useState<PublicInquiryItem[]>([]);
  const [inquiriesStatus, setInquiriesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

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
    setChildrenList([]);
    setClassesList([]);
    setClassRosters([]);
    setClassesBackendStatus('BLOCKED_BACKEND');
    setSelectedClassId('');
    setSelectedChildId('');
    setOperationalCounts({});
    setClassAnnouncements([]);
    setHomeworkList([]);
    setClassDocuments([]);
    setClassGallery([]);
    setClassQuestions([]);
    setCommunityStatus('BLOCKED_BACKEND');
    setParentNotes([]);
    setNotesStatus('BLOCKED_BACKEND');
    setMessages([]);
    setMessagesStatus('BLOCKED_BACKEND');
    setEnrollmentApplications([]);
    setEnrollmentsStatus('BLOCKED_BACKEND');
    setPublicInquiries([]);
    setInquiriesStatus('BLOCKED_BACKEND');
    setNotifications([]);
  }, []);

  const hydratePublicData = useCallback(async () => {
    const [bRes, calRes, menuRes, dirRes] = await Promise.all([
      listSchoolBroadcasts(),
      listSchoolCalendarEvents(currentUser?.id ?? null),
      fetchActiveFoodMenu(),
      listPublicDirectory(),
    ]);

    setBroadcastsStatus(bRes.status);
    if (bRes.ok && bRes.data) {
      setBroadcasts(bRes.data);
    }

    setCalendarStatus(calRes.status);
    if (calRes.ok && calRes.data) {
      setCalendarEvents(calRes.data);
    }

    setFoodMenuStatus(menuRes.status);
    if (menuRes.ok && menuRes.data) {
      setFoodMenu({ ...menuRes.data, isDemoPreview: false });
    } else if (menuRes.status === 'READY' && !menuRes.data) {
      setFoodMenu({ id: 'menu-empty', weekRange: '—', published: false, items: [], isDemoPreview: false });
    } else {
      setFoodMenu(PUBLIC_PREVIEW_FOOD_MENU);
    }

    setDirectoryStatus(dirRes.status);
    if (dirRes.ok && dirRes.data && (dirRes.data.teachers.length > 0 || dirRes.data.admins.length > 0)) {
      setTeachers(dirRes.data.teachers);
      setAdmins(dirRes.data.admins);
    } else if (dirRes.status === 'READY' && dirRes.data) {
      setTeachers(dirRes.data.teachers);
      setAdmins(dirRes.data.admins);
    } else {
      setTeachers(MOCK_TEACHERS);
      setAdmins(MOCK_ADMIN);
    }
  }, [currentUser?.id]);

  const hydrateAuthenticatedData = useCallback(
    async (user: User, activeClassFilter?: string) => {
      if (user.accountStatus !== 'APPROVED') {
        clearPrivateState();
        return;
      }

      const [ctxRes, prefsRes, notifRes] = await Promise.all([
        fetchMySchoolContext(),
        loadMyPreferences(user.id),
        listMyNotifications(),
      ]);

      if (prefsRes.ok && prefsRes.data) {
        setLanguageState(prefsRes.data.language);
        localStorage.setItem('kristou_lang', prefsRes.data.language);
        setThemeState(prefsRes.data.theme);
        localStorage.setItem('kristou_theme', prefsRes.data.theme);
        setNotificationSoundState(prefsRes.data.notificationSound);
        localStorage.setItem('kristou_notification_sound', prefsRes.data.notificationSound);
      }

      if (notifRes.ok && notifRes.data) {
        setNotifications(notifRes.data);
      }

      let resolvedClassIds = user.assignedClassIds ?? [];
      if (ctxRes.ok && ctxRes.data) {
        setChildrenList(ctxRes.data.children);
        setClassesList(ctxRes.data.classes);
        setOperationalCounts(ctxRes.data.operationalCounts);
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
        }
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
        const commRes = await listClassCommunityContent(targetClassId || undefined);
        setCommunityStatus(commRes.status);
        if (commRes.ok && commRes.data) {
          setClassAnnouncements(commRes.data.announcements);
          setHomeworkList(commRes.data.homework);
          setClassQuestions(commRes.data.questions);
          setClassDocuments(commRes.data.documents);
          setClassGallery(commRes.data.gallery);
        }
      }

      // Parent Notes
      if (user.role !== 'STUDENT' && user.role !== 'SCHOOL_STAFF') {
        const notesRes = await listParentNotes();
        setNotesStatus(notesRes.status);
        if (notesRes.ok && notesRes.data) {
          setParentNotes(notesRes.data);
        }
      }

      // Operational Direct Messages (all except STUDENT)
      if (user.role !== 'STUDENT') {
        const msgRes = await listMessageThreads(user.id);
        setMessagesStatus(msgRes.status);
        if (msgRes.ok && msgRes.data) {
          setMessages(msgRes.data);
        }
      }

      // Enrollment applications & Public Inquiries
      const enrRes = await listEnrollmentApplications();
      setEnrollmentsStatus(enrRes.status);
      if (enrRes.ok && enrRes.data) {
        setEnrollmentApplications(enrRes.data);
      }

      if (canReviewOrdinaryAccountsUi(user) || user.role === 'MANAGER') {
        const inqRes = await listPublicInquiries();
        setInquiriesStatus(inqRes.status);
        if (inqRes.ok && inqRes.data) {
          setPublicInquiries(inqRes.data);
        }
      }
    },
    [clearPrivateState, selectedClassId],
  );

  const refreshSchoolData = useCallback(async () => {
    await hydratePublicData();
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      await hydrateAuthenticatedData(currentUser, selectedClassId || undefined);
    }
  }, [currentUser, hydrateAuthenticatedData, hydratePublicData, selectedClassId]);

  useEffect(() => {
    void hydratePublicData();
  }, [hydratePublicData]);

  useEffect(() => {
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      void hydrateAuthenticatedData(currentUser, selectedClassId || undefined);
    } else {
      clearPrivateState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.accountStatus]);

  useEffect(() => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED' || !selectedClassId) return;
    void listClassCommunityContent(selectedClassId).then((commRes) => {
      setCommunityStatus(commRes.status);
      if (commRes.ok && commRes.data) {
        setClassAnnouncements(commRes.data.announcements);
        setHomeworkList(commRes.data.homework);
        setClassQuestions(commRes.data.questions);
        setClassDocuments(commRes.data.documents);
        setClassGallery(commRes.data.gallery);
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
        if (!active) return;
        telegramIdentityUser.current = user;
        setCurrentUser(user);
        setCurrentRoleState(user.role);
        if (isLinkAttempt && linked) setTelegramLinkNotice('success');
      })
      .catch(() => {
        if (!active) return;
        telegramIdentityUser.current = null;
        setCurrentUser(null);
        setCurrentRoleState(null);
        if (isLinkAttempt) setTelegramLinkNotice('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (telegramIdentityUser.current) {
        setCurrentUser(telegramIdentityUser.current);
        setCurrentRoleState(telegramIdentityUser.current.role);
        return;
      }
      if (!data.session?.user) return;
      try {
        const user = await loadCanonicalUser(data.session.user);
        if (active) {
          setCurrentUser(user);
          setCurrentRoleState(user.role);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'account_not_approved') {
          void signOutAccount();
        }
        if (active) {
          setCurrentUser(null);
          setCurrentRoleState(null);
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      if (telegramIdentityUser.current) {
        setCurrentUser(telegramIdentityUser.current);
        setCurrentRoleState(telegramIdentityUser.current.role);
        return;
      }
      if (!session?.user) {
        setCurrentUser(null);
        setCurrentRoleState(null);
        return;
      }
      try {
        const user = await loadCanonicalUser(session.user);
        if (active) {
          setCurrentUser(user);
          setCurrentRoleState(user.role);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'account_not_approved') {
          void signOutAccount();
        }
        if (active) {
          setCurrentUser(null);
          setCurrentRoleState(null);
        }
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('kristou_lang', lang);
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      void saveMyPreferences({ language: lang });
    }
  };

  const setTheme = (thm: ThemeMode) => {
    setThemeState(thm);
    localStorage.setItem('kristou_theme', thm);
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      void saveMyPreferences({ theme: thm });
    }
  };

  const setNotificationSound = (sound: NotificationSoundOption) => {
    setNotificationSoundState(sound);
    localStorage.setItem('kristou_notification_sound', sound);
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      void saveMyPreferences({ notificationSound: sound });
    }
  };

  const t = (key: TranslationKey): string => {
    const dict = translations[language] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  // Merge school-wide broadcasts (or honest public demo preview if backend isn't deployed yet) + class announcements
  const combinedAnnouncements: Announcement[] = [
    ...(broadcastsStatus === 'READY' ? broadcasts : PUBLIC_PREVIEW_ANNOUNCEMENTS),
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
      : teachers.map((item) => ({
          ...item,
          title: contentT(language, 'teachers', item.id, 'title', item.title),
          bio: contentT(language, 'teachers', item.id, 'bio', item.bio),
        }));

  const localizedAdmins =
    directoryStatus === 'READY'
      ? admins
      : admins.map((item) => ({
          ...item,
          title: contentT(language, 'admins', item.id, 'title', item.title),
          bio: contentT(language, 'admins', item.id, 'bio', item.bio),
        }));

  const login = async (identifier: string, pass: string) => {
    try {
      const { user } = await signInAccount(identifier, pass);
      const canonicalUser = await loadCanonicalUser(user);
      setCurrentUser(canonicalUser);
      setCurrentRoleState(canonicalUser.role);
      return { success: true };
    } catch (error) {
      await signOutAccount();
      setCurrentUser(null);
      setCurrentRoleState(null);
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
    setCurrentUser(null);
    setCurrentRoleState(null);
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

  const tunisToday = getTunisSchoolDay();
  const usedToday = parentNotes.filter(
    (n) =>
      n.parentId === currentUser?.id &&
      (n.schoolDay ? n.schoolDay === tunisToday : n.createdAt.slice(0, 10) === tunisToday),
  ).length;
  const remainingParentNotesToday = Math.max(0, PARENT_NOTES_DAILY_QUOTA - usedToday);

  const addParentNote = async (
    childId: string,
    topic: ParentNote['topic'],
    content: string,
    _teacherId?: string,
  ) => {
    const res = await sendParentNoteRpc(childId, topic, content);
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
    const res = await replyParentNoteRpc(noteId, replyContent);
    if (res.ok && res.data) {
      setParentNotes((prev) => prev.map((n) => (n.id === noteId ? res.data! : n)));
    }
    return res;
  };

  const addClassQuestion = async (classId: string, content: string) => {
    const res = await postClassQuestionRpc(classId, content);
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
    const res = await replyClassQuestionRpc(questionId, content);
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
    const res = await moderateClassQuestionRpc(questionId, hidden);
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

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      void markNotificationReadOnServer(id);
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      void markAllNotificationsReadOnServer();
    }
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
        announcements: localizedAnnouncements,
        broadcasts,
        broadcastsStatus,
        homeworkList,
        classDocuments,
        classGallery,
        calendarEvents,
        calendarStatus,
        classQuestions,
        communityStatus,
        parentNotes,
        notesStatus,
        remainingParentNotesToday,
        messages,
        messagesStatus,
        pickupRecords,
        foodMenu: localizedFoodMenu,
        foodMenuStatus,
        teachers: localizedTeachers,
        admins: localizedAdmins,
        directoryStatus,
        enrollmentApplications,
        enrollmentsStatus,
        publicInquiries,
        inquiriesStatus,
        notifications,
        login,
        signup,
        logout,
        connectTelegram,
        telegramLinkNotice,
        dismissTelegramLinkNotice: () => setTelegramLinkNotice(null),
        refreshSchoolData,
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
