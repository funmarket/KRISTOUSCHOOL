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
  MOCK_USERS,
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
import { translations, type TranslationKey } from '../i18n/translations';
import { contentT } from '../i18n/content';

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
  setCurrentRole: (role: UserRole) => void;
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
  const [currentUser, setCurrentUser] = useState<User | null>(MOCK_USERS[0]); // default parent Karim
  const [currentRole, setCurrentRoleState] = useState<UserRole>('PARENT');
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
    if (theme === 'pitch-black') {
      document.documentElement.classList.add('dark', 'pitch-black');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark', 'pitch-black');
    }
    localStorage.setItem('kristou_theme', theme);
  }, [theme]);

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    const matched = MOCK_USERS.find(u => u.role === role) || {
      id: `user-${role.toLowerCase()}`,
      username: `${role.toLowerCase()}_user`,
      fullName: `Utilisateur ${role}`,
      role,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      linkedChildrenIds: role === 'PARENT' ? ['child-1'] : undefined,
      assignedClassIds: role === 'STUDENT' ? ['class-3a'] : role === 'TEACHER' ? ['class-3a'] : undefined,
    };
    setCurrentUser(matched as User);
  };

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

  const login = (username: string, _pass: string): boolean => {
    const found = MOCK_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (found) {
      setCurrentUser(found);
      setCurrentRoleState(found.role);
      return true;
    }
    // Generic fallback login
    const newUser: User = {
      id: 'user-custom',
      username,
      fullName: username,
      role: 'PARENT',
      linkedChildrenIds: ['child-1'],
    };
    setCurrentUser(newUser);
    setCurrentRoleState('PARENT');
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentRoleState('PUBLIC');
  };

  const connectTelegram = () => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, telegramLinked: true });
      setNotifications(prev => [
        {
          id: `n-${Date.now()}`,
          title: 'Telegram Connect',
          message: 'Votre compte a été lié avec succès à Telegram.',
          time: "À l'instant",
          read: false,
          type: 'system',
        },
        ...prev,
      ]);
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

  const markPickupArrived = (childId: string) => {
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
        setCurrentRole,
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
