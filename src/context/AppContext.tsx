import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
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
  MOCK_CHILDREN,
  MOCK_CLASSES,
  MOCK_ANNOUNCEMENTS,
  MOCK_HOMEWORK,
  MOCK_CALENDAR,
  MOCK_QUESTIONS,
  MOCK_PARENT_NOTES,
  MOCK_MESSAGES,
  MOCK_PICKUP_RECORDS,
  MOCK_FOOD_MENU,
  MOCK_TEACHERS,
  MOCK_ADMIN,
} from '../data/mockData';
import { translations } from '../i18n/translations';

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
  currentRole: UserRole;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  t: (key: keyof typeof translations['en']) => string;
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
  login: (username: string, pass: string) => boolean;
  logout: () => void;
  connectTelegram: () => void;
  addParentNote: (childId: string, topic: ParentNote['topic'], content: string, teacherId?: string) => { success: boolean; error?: string };
  addClassQuestion: (classId: string, content: string) => { success: boolean; error?: string };
  replyClassQuestion: (questionId: string, content: string) => void;
  markPickupArrived: (childId: string) => void;
  confirmPickupRelease: (recordId: string) => void;
  markNotificationRead: (id: string) => void;
  notificationSound: string;
  setNotificationSound: (sound: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRoleState] = useState<UserRole>('PUBLIC');
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('kristou_lang') as Language) || 'fr';
  });
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('kristou_theme') as ThemeMode) || 'light';
  });
  const [notificationSound, setNotificationSound] = useState<string>('Kristou Bell');

  const [childrenList] = useState<Child[]>(MOCK_CHILDREN);
  const [classesList] = useState<ClassItem[]>(MOCK_CLASSES);
  const [announcements, setAnnouncements] = useState<Announcement[]>(MOCK_ANNOUNCEMENTS);
  const [homeworkList] = useState<Homework[]>(MOCK_HOMEWORK);
  const [calendarEvents] = useState<CalendarEvent[]>(MOCK_CALENDAR);
  const [classQuestions, setClassQuestions] = useState<ClassQuestion[]>(MOCK_QUESTIONS);
  const [parentNotes, setParentNotes] = useState<ParentNote[]>(MOCK_PARENT_NOTES);
  const [messages] = useState<MessageThread[]>(MOCK_MESSAGES);
  const [pickupRecords, setPickupRecords] = useState<PickupRecord[]>(MOCK_PICKUP_RECORDS);
  const [foodMenu] = useState<FoodMenuWeek>(MOCK_FOOD_MENU);
  const [teachers] = useState<TeacherDirectoryMember[]>(MOCK_TEACHERS);
  const [admins] = useState<AdminDirectoryMember[]>(MOCK_ADMIN);

  // No mock notifications are presented as live school events.
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

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('kristou_lang', lang);
  };

  const setTheme = (thm: ThemeMode) => {
    setThemeState(thm);
    localStorage.setItem('kristou_theme', thm);
  };

  const t = (key: keyof typeof translations['en']): string => {
    const dict = translations[language] || translations.en;
    return (dict as any)[key] || translations.en[key] || key;
  };

  // R1 containment: no trusted credential/session API exists yet.
  // Never authenticate from example users or accept a client-provided role.
  const login = (_username: string, _pass: string): boolean => false;

  const logout = () => {
    setCurrentUser(null);
    setCurrentRoleState('PUBLIC');
  };

  // R2 will implement validated initData and explicit account linking.
  // R1 must not claim Telegram linkage from client-side state.
  const connectTelegram = (): void => {};

  const addParentNote = (childId: string, topic: ParentNote['topic'], content: string, teacherId?: string) => {
    if (!currentUser) return { success: false, error: 'Authentification scolaire indisponible.' };
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
    if (!currentUser) return { success: false, error: 'Authentification scolaire indisponible.' };
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
    if (!currentUser) return;
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

  const markPickupArrived = (childId: string) => {
    if (!currentUser) return;
    const targetChild = childrenList.find(c => c.id === childId);
    if (!targetChild) return;

    setPickupRecords(prev => {
      const existing = prev.find(p => p.childId === childId);
      if (existing) {
        return prev.map(p =>
          p.childId === childId
            ? { ...p, state: 'PARENT_ARRIVED', parentArrivedAt: new Date().toISOString() }
            : p
        );
      } else {
        return [
          ...prev,
          {
            id: `pick-${Date.now()}`,
            childId,
            childName: targetChild.fullName,
            classId: targetChild.classId,
            className: targetChild.className,
            state: 'PARENT_ARRIVED',
            parentArrivedAt: new Date().toISOString(),
            authorizedPerson: targetChild.pickupAuthorizedNames[0] || 'Parent',
          },
        ];
      }
    });

    setNotifications(prev => [
      {
        id: `n-${Date.now()}`,
        title: 'Arrivée signalée',
        message: `Votre arrivée pour ${targetChild.fullName} a été transmise à l'école.`,
        time: "À l'instant",
        read: false,
        type: 'pickup',
      },
      ...prev,
    ]);
  };

  const confirmPickupRelease = (recordId: string) => {
    if (!currentUser) return;
    setPickupRecords(prev =>
      prev.map(p =>
        p.id === recordId
          ? {
              ...p,
              state: 'RELEASED',
              releasedAt: new Date().toISOString(),
              releasedBy: currentUser?.fullName || 'Enseignant',
            }
          : p
      )
    );
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
        announcements,
        homeworkList,
        calendarEvents,
        classQuestions,
        parentNotes,
        messages,
        pickupRecords,
        foodMenu,
        teachers,
        admins,
        notifications,
        login,
        logout,
        connectTelegram,
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
