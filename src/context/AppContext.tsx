import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  AccountRole,
  User,
  Language,
  ThemeMode,
  Child,
  ClassItem,
  Announcement,
  Homework,
  CalendarEvent,
  ClassQuestion,
  ParentNote,
  MessageThread,
  PickupRecord,
  FoodMenuWeek,
  TeacherDirectoryMember,
  AdminDirectoryMember,
} from '../types';
import {
  MOCK_ANNOUNCEMENTS,
  MOCK_HOMEWORK,
  MOCK_CALENDAR,
  MOCK_QUESTIONS,
  MOCK_PARENT_NOTES,
  MOCK_MESSAGES,
  MOCK_FOOD_MENU,
  MOCK_TEACHERS,
  MOCK_ADMIN,
} from '../data/mockData';
import { translations, type TranslationKey } from '../i18n/translations';
import { usernameRuleMessage, usernameUnavailableMessage } from '../i18n/authMessages';
import { contentT } from '../i18n/content';
import { loadCanonicalUser, signInAccount, signOutAccount, signUpAccount, createTelegramLinkChallenge, authenticateTelegramInitData, type SignupRole } from '../lib/auth';
import { getTelegramWebAppInitData, initializeTelegramWebApp } from '../lib/telegram';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'pickup' | 'note' | 'announcement' | 'message' | 'system';
}

interface AppContextType {
  currentUser: User | null;
  currentRole: AccountRole | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  t: (key: TranslationKey) => string;
  dir: 'rtl' | 'ltr';
  
  // Data state
  childrenList: Child[];
  classesList: ClassItem[];
  announcements: Announcement[];
  homeworkList: Homework[];
  calendarEvents: CalendarEvent[];
  classQuestions: ClassQuestion[];
  parentNotes: ParentNote[];
  messages: MessageThread[];
  pickupRecords: PickupRecord[];
  foodMenu: FoodMenuWeek;
  teachers: TeacherDirectoryMember[];
  admins: AdminDirectoryMember[];
  notifications: NotificationItem[];

  // Actions
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signup: (input: { username: string; password: string; email?: string; phone?: string; fullName: string; requestedRole: SignupRole; staffId?: string; admissionId?: string }) => Promise<{ success: boolean; confirmationRequired?: boolean; error?: string }>;
  logout: () => void;
  connectTelegram: () => Promise<{ linkUrl?: string; error?: string }>;
  telegramLinkNotice: 'success' | 'error' | null;
  dismissTelegramLinkNotice: () => void;
  addParentNote: (childId: string, topic: ParentNote['topic'], content: string, teacherId?: string) => { success: boolean; error?: string };
  addClassQuestion: (classId: string, content: string) => { success: boolean; error?: string };
  replyClassQuestion: (questionId: string, content: string) => void;
  markPickupArrived: (childId: string) => { success: boolean; error?: string };
  confirmPickupRelease: (recordId: string) => { success: boolean; error?: string };
  markNotificationRead: (id: string) => void;
  notificationSound: string;
  setNotificationSound: (sound: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const telegramIdentityUser = useRef<User | null>(null);
  const [currentRole, setCurrentRoleState] = useState<AccountRole | null>(null);
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('kristou_lang') as Language) || 'fr';
  });
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('kristou_theme') as ThemeMode) || 'light';
  });
  const [notificationSound, setNotificationSound] = useState<string>('Kristou Bell');
  const [telegramLinkNotice, setTelegramLinkNotice] = useState<'success' | 'error' | null>(null);

  const [childrenList] = useState<Child[]>([]);
  const [classesList] = useState<ClassItem[]>([]);
  const [announcements] = useState<Announcement[]>(MOCK_ANNOUNCEMENTS);
  const [homeworkList] = useState<Homework[]>(MOCK_HOMEWORK);
  const [calendarEvents] = useState<CalendarEvent[]>(MOCK_CALENDAR);
  const [classQuestions, setClassQuestions] = useState<ClassQuestion[]>(MOCK_QUESTIONS);
  const [parentNotes, setParentNotes] = useState<ParentNote[]>(MOCK_PARENT_NOTES);
  const [messages] = useState<MessageThread[]>(MOCK_MESSAGES);
  const [pickupRecords] = useState<PickupRecord[]>([]);
  const [foodMenu] = useState<FoodMenuWeek>(MOCK_FOOD_MENU);
  const [teachers] = useState<TeacherDirectoryMember[]>(MOCK_TEACHERS);
  const [admins] = useState<AdminDirectoryMember[]>(MOCK_ADMIN);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n-1',
      title: 'Sortie scolaire - Musée Bardo',
      message: 'Rappel pour la visite de ce jeudi.',
      time: 'Il y a 10 min',
      read: false,
      type: 'announcement',
    },
    {
      id: 'n-2',
      title: 'Cantine La Toque Gourmande',
      message: 'Le menu de la semaine est en ligne.',
      time: 'Il y a 1 heure',
      read: true,
      type: 'system',
    },
  ]);

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

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
    return () => { active = false; };
  }, []);

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

  useEffect(() => {
    let active = true;
    import('../lib/supabase').then(({ supabase }) => {
      if (!supabase) return;
      supabase.auth.getSession().then(async ({ data }) => {
        if (!active) return;
        if (telegramIdentityUser.current) {
          setCurrentUser(telegramIdentityUser.current);
          setCurrentRoleState(telegramIdentityUser.current.role);
          return;
        }
        if (!data.session?.user) return;
        try {
          const user = await loadCanonicalUser(data.session.user);
          if (active) { setCurrentUser(user); setCurrentRoleState(user.role); }
        } catch (error) {
          if (error instanceof Error && error.message === 'account_not_approved') {
            void signOutAccount();
          }
          if (active) { setCurrentUser(null); setCurrentRoleState(null); }
        }
      });
      const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!active) return;
        if (telegramIdentityUser.current) {
          setCurrentUser(telegramIdentityUser.current);
          setCurrentRoleState(telegramIdentityUser.current.role);
          return;
        }
        if (!session?.user) { setCurrentUser(null); setCurrentRoleState(null); return; }
        try {
          const user = await loadCanonicalUser(session.user);
          if (active) { setCurrentUser(user); setCurrentRoleState(user.role); }
        } catch (error) {
          if (error instanceof Error && error.message === 'account_not_approved') {
            void signOutAccount();
          }
          if (active) { setCurrentUser(null); setCurrentRoleState(null); }
        }
      });
      return () => listener.subscription.unsubscribe();
    });
    return () => { active = false; };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('kristou_lang', lang);
  };

  const setTheme = (thm: ThemeMode) => {
    setThemeState(thm);
    localStorage.setItem('kristou_theme', thm);
  };

  const t = (key: TranslationKey): string => {
    const dict = translations[language] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  const localizedAnnouncements = announcements.map(item => ({
    ...item,
    title: contentT(language, 'announcements', item.id, 'title', item.title),
    body: contentT(language, 'announcements', item.id, 'body', item.body),
    authorRole: contentT(language, 'announcements', item.id, 'authorRole', item.authorRole),
  }));
  const localizedHomework = homeworkList.map(item => ({
    ...item,
    title: contentT(language, 'homework', item.id, 'title', item.title),
    description: contentT(language, 'homework', item.id, 'description', item.description),
  }));
  const localizedCalendar = calendarEvents.map(item => ({
    ...item,
    title: contentT(language, 'calendar', item.id, 'title', item.title),
    description: contentT(language, 'calendar', item.id, 'description', item.description),
    category: contentT(language, 'calendar', item.id, 'category', item.category) as typeof item.category,
  }));
  const localizedFoodMenu = {
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
  const localizedTeachers = teachers.map(item => ({
    ...item,
    title: contentT(language, 'teachers', item.id, 'title', item.title),
    bio: contentT(language, 'teachers', item.id, 'bio', item.bio),
  }));
  const localizedAdmins = admins.map(item => ({
    ...item,
    title: contentT(language, 'admins', item.id, 'title', item.title),
    bio: contentT(language, 'admins', item.id, 'bio', item.bio),
  }));
  const localizedNotifications = notifications.map(item => ({
    ...item,
    title: contentT(language, 'notifications', item.id, 'title', item.title),
    message: contentT(language, 'notifications', item.id, 'message', item.message),
    time: contentT(language, 'notifications', item.id, 'time', item.time),
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
      return { success: false, error: error instanceof Error ? error.message : 'Invalid credentials' };
    }
  };

  const signup = async (input: { username: string; password: string; email?: string; phone?: string; fullName: string; requestedRole: SignupRole; staffId?: string; admissionId?: string }) => {
    try {
      const data = await signUpAccount(input);
      return { success: true, confirmationRequired: !data.session };
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'invalid_username_format') return { success: false, error: usernameRuleMessage(language) };
      if (code === 'username_unavailable_or_invalid') return { success: false, error: usernameUnavailableMessage(language) };
      return { success: false, error: code || 'Unable to create account' };
    }
  };

  const logout = () => {
    telegramIdentityUser.current = null;
    void signOutAccount();
    setCurrentUser(null);
    setCurrentRoleState(null);
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

  const addParentNote = (childId: string, topic: ParentNote['topic'], content: string, teacherId?: string) => {
    // Check quota (11 per day)
    const todayNotes = parentNotes.filter(n => n.parentId === currentUser?.id);
    if (todayNotes.length >= 11) {
      return { success: false, error: 'Quota journalier atteint (11 notes maximum par jour).' };
    }
    const targetChild = childrenList.find(c => c.id === childId);
    const newNote: ParentNote = {
      id: `note-${Date.now()}`,
      parentId: currentUser?.id || 'parent-1',
      parentName: currentUser?.fullName || 'Parent',
      childId,
      childName: targetChild?.fullName || 'Enfant',
      teacherId,
      topic,
      content,
      createdAt: new Date().toISOString(),
      status: 'SENT',
    };
    setParentNotes([newNote, ...parentNotes]);
    setNotifications(prev => [
      {
        id: `n-${Date.now()}`,
        title: 'Note envoyée',
        message: `Votre note concernant ${targetChild?.fullName} a été transmise.`,
        time: "À l'instant",
        read: false,
        type: 'note',
      },
      ...prev,
    ]);
    return { success: true };
  };

  const addClassQuestion = (classId: string, content: string) => {
    if (content.length > 200) {
      return { success: false, error: 'Maximum 200 caractères.' };
    }
    const newQ: ClassQuestion = {
      id: `q-${Date.now()}`,
      classId,
      studentId: currentUser?.id || 'stu-1',
      studentName: currentUser?.fullName || 'Élève',
      content,
      createdAt: new Date().toISOString(),
      repliesCount: 0,
      replies: [],
    };
    setClassQuestions([newQ, ...classQuestions]);
    return { success: true };
  };

  const replyClassQuestion = (questionId: string, content: string) => {
    setClassQuestions(prev =>
      prev.map(q => {
        if (q.id === questionId) {
          const newReplies = [
            ...(q.replies || []),
            {
              id: `r-${Date.now()}`,
              questionId,
              authorId: currentUser?.id || 'u-1',
              authorName: currentUser?.fullName || 'Utilisateur',
              content,
              createdAt: new Date().toISOString(),
            },
          ];
          return { ...q, repliesCount: newReplies.length, replies: newReplies };
        }
        return q;
      })
    );
  };

  // Safety lock: Pickup arrival and physical child release require server-verified Supabase persistence
  // (`pickup_events` + atomic RPCs). Never simulate local arrival or release success in production mode.
  const markPickupArrived = (_childId: string) => {
    return {
      success: false,
      error: 'pickup_backend_unavailable',
    };
  };

  const confirmPickupRelease = (_recordId: string) => {
    return {
      success: false,
      error: 'pickup_backend_unavailable',
    };
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
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
        announcements: localizedAnnouncements,
        homeworkList: localizedHomework,
        calendarEvents: localizedCalendar,
        classQuestions,
        parentNotes,
        messages,
        pickupRecords,
        foodMenu: localizedFoodMenu,
        teachers: localizedTeachers,
        admins: localizedAdmins,
        notifications: localizedNotifications,
        login,
        signup,
        logout,
        connectTelegram,
        telegramLinkNotice,
        dismissTelegramLinkNotice: () => setTelegramLinkNotice(null),
        addParentNote,
        addClassQuestion,
        replyClassQuestion,
        markPickupArrived,
        confirmPickupRelease,
        markNotificationRead,
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
