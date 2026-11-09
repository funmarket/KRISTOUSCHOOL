import {
  User,
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

export const MOCK_USERS: User[] = [
  {
    id: 'user-parent-1',
    username: 'parent_karim',
    fullName: 'Karim Ben Salah',
    role: 'PARENT',
    email: 'karim.bensalah@example.tn',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    linkedChildrenIds: ['child-1', 'child-2'],
    telegramLinked: true,
  },
  {
    id: 'user-student-1',
    username: 'student_yasmine',
    fullName: 'Yasmine Ben Salah',
    role: 'STUDENT',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    assignedClassIds: ['class-3a'],
  },
  {
    id: 'user-teacher-1',
    username: 'teacher_fatma',
    fullName: 'Fatma Jaziri',
    role: 'TEACHER',
    email: 'fatma.jaziri@kristou.edu.tn',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    assignedClassIds: ['class-3a', 'class-4b'],
    capabilities: ['CAN_TEACH'],
  },
  {
    id: 'user-manager-1',
    username: 'manager_anis',
    fullName: 'Anis Gharbi',
    role: 'MANAGER',
    email: 'anis.gharbi@kristou.edu.tn',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    capabilities: ['CAN_MANAGE_PICKUP', 'CAN_BROADCAST', 'CAN_MANAGE_FOOD_MENU'],
  },
  {
    id: 'user-admin-1',
    username: 'admin_kristou',
    fullName: 'Direction Kristou',
    role: 'ADMIN',
    email: 'direction@kristou.edu.tn',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    capabilities: ['ALL'],
  },
];

export const MOCK_CHILDREN: Child[] = [
  {
    id: 'child-1',
    fullName: 'Yasmine Ben Salah',
    classId: 'class-3a',
    className: '3ème Année A',
    level: 'Primaire 3',
    birthDate: '2016-04-12',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    medicalNotes: 'Allergique aux arachides',
    pickupAuthorizedNames: ['Karim Ben Salah (Père)', 'Leila Ben Salah (Mère)', 'Grand-mère Hedia'],
  },
  {
    id: 'child-2',
    fullName: 'Mehdi Ben Salah',
    classId: 'class-4b',
    className: '4ème Année B',
    level: 'Primaire 4',
    birthDate: '2015-09-20',
    photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    pickupAuthorizedNames: ['Karim Ben Salah (Père)', 'Leila Ben Salah (Mère)'],
  },
];

export const MOCK_CLASSES: ClassItem[] = [
  {
    id: 'class-3a',
    name: '3ème Année A',
    level: 'Primaire 3',
    teacherId: 'user-teacher-1',
    teacherName: 'Fatma Jaziri',
    academicYear: '2025-2026',
    studentCount: 22,
  },
  {
    id: 'class-4b',
    name: '4ème Année B',
    level: 'Primaire 4',
    teacherId: 'user-teacher-1',
    teacherName: 'Fatma Jaziri',
    academicYear: '2025-2026',
    studentCount: 24,
  },
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    classId: 'class-3a',
    title: 'Excursion pédagogique au Musée Bardo',
    body: 'Chers parents, notre visite au musée national du Bardo aura lieu ce jeudi. Veuillez munir les élèves d’une gourde d’eau et de la tenue officielle de l’école.',
    authorName: 'Fatma Jaziri',
    authorRole: 'Enseignante',
    createdAt: '2026-11-08T09:00:00Z',
    priority: 'URGENT',
  },
  {
    id: 'ann-2',
    title: 'Rassemblement de la rentrée et directives sanitaires',
    body: 'Rappel important concernant les horaires d’entrée et de sortie des élèves. Merci de respecter les zones de stationnement désignées.',
    authorName: 'Direction Kristou',
    authorRole: 'Administration',
    createdAt: '2026-11-07T08:30:00Z',
    priority: 'NORMAL',
  },
];

export const MOCK_HOMEWORK: Homework[] = [
  {
    id: 'hw-1',
    classId: 'class-3a',
    title: 'Mathématiques : Exercices sur les fractions',
    description: 'Résoudre les exercices 4, 5 et 6 page 42 du livre de calcul.',
    dueDate: '2026-11-10',
    teacherName: 'Fatma Jaziri',
    createdAt: '2026-11-08T10:00:00Z',
  },
  {
    id: 'hw-2',
    classId: 'class-3a',
    title: 'Production Écrite : Mon animal préféré',
    description: 'Rédiger 5 lignes en français décrivant votre animal favori.',
    dueDate: '2026-11-11',
    teacherName: 'Fatma Jaziri',
    createdAt: '2026-11-08T10:05:00Z',
  },
];

export const MOCK_CALENDAR: CalendarEvent[] = [
  {
    id: 'cal-1',
    classId: 'class-3a',
    title: 'Évaluation de Dictée',
    date: '2026-11-12',
    category: 'TEST',
    description: 'Dictée préparée sur les mots de la semaine 8.',
  },
  {
    id: 'cal-2',
    title: 'Conseil des Maîtres',
    date: '2026-11-15',
    category: 'MEETING',
    description: 'Réunion pédagogique mensuelle du corps enseignant.',
  },
];

export const MOCK_QUESTIONS: ClassQuestion[] = [
  {
    id: 'q-1',
    classId: 'class-3a',
    studentId: 'user-student-1',
    studentName: 'Yasmine Ben Salah',
    content: 'Est-ce que quelqu’un peut m’aider avec le problème numéro 5 en maths ?',
    createdAt: '2026-11-08T14:20:00Z',
    repliesCount: 1,
    replies: [
      {
        id: 'r-1',
        questionId: 'q-1',
        authorId: 'student-2',
        authorName: 'Amine Trabelsi',
        content: 'Oui Yasmine ! Il faut diviser par 4 d’abord.',
        createdAt: '2026-11-08T14:30:00Z',
      },
    ],
  },
];

export const MOCK_PARENT_NOTES: ParentNote[] = [
  {
    id: 'note-1',
    parentId: 'user-parent-1',
    parentName: 'Karim Ben Salah',
    childId: 'child-1',
    childName: 'Yasmine Ben Salah',
    teacherId: 'user-teacher-1',
    topic: 'ABSENCE',
    content: 'Yasmine aura un rendez-vous médical ce mercredi à 10h et arrivera en retard.',
    createdAt: '2026-11-08T11:15:00Z',
    status: 'READ',
    replyContent: 'Bien reçu, merci de nous avoir prévenus.',
  },
];

export const MOCK_MESSAGES: MessageThread[] = [
  {
    id: 'msg-1',
    recipientId: 'user-teacher-1',
    recipientName: 'Fatma Jaziri (Enseignante)',
    recipientRole: 'TEACHER',
    lastMessage: 'Merci pour votre suivi.',
    updatedAt: '2026-11-08T12:00:00Z',
    unread: false,
    messages: [
      {
        id: 'm-1',
        senderId: 'user-parent-1',
        content: 'Bonjour maîtresse, Yasmine a bien compris son devoir.',
        createdAt: '2026-11-08T11:50:00Z',
      },
      {
        id: 'm-2',
        senderId: 'user-teacher-1',
        content: 'Parfait ! Merci pour votre suivi.',
        createdAt: '2026-11-08T12:00:00Z',
      },
    ],
  },
];

export const MOCK_PICKUP_RECORDS: PickupRecord[] = [
  {
    id: 'pick-1',
    childId: 'child-1',
    childName: 'Yasmine Ben Salah',
    classId: 'class-3a',
    className: '3ème Année A',
    state: 'PARENT_ARRIVED',
    parentArrivedAt: '2026-11-08T15:30:00Z',
    authorizedPerson: 'Karim Ben Salah (Père)',
  },
  {
    id: 'pick-2',
    childId: 'child-2',
    childName: 'Mehdi Ben Salah',
    classId: 'class-4b',
    className: '4ème Année B',
    state: 'WAITING',
    authorizedPerson: 'Leila Ben Salah (Mère)',
  },
];

export const MOCK_FOOD_MENU: FoodMenuWeek = {
  id: 'menu-current',
  weekRange: '10 Novembre - 14 Novembre 2026',
  published: true,
  items: [
    {
      day: 'Lundi',
      starter: 'Salade tunisienne fraîche',
      main: 'Couscous au poulet fermier',
      side: 'Légumes de saison',
      dessert: 'Fruits de saison',
      notes: 'Préparé avec soin par La Toque Gourmande',
    },
    {
      day: 'Mardi',
      starter: 'Soupe de légumes veloutée',
      main: 'Escalope de dinde panée',
      side: 'Purée de pommes de terre',
      dessert: 'Yaourt nature bio',
    },
    {
      day: 'Mercredi',
      starter: 'Brick au thon croustillante',
      main: 'Spaghetti bolognaise au parmesan',
      side: 'Sauce tomate maison',
      dessert: 'Salade de fruits frais',
    },
    {
      day: 'Jeudi',
      starter: 'Salade verte et maïs',
      main: 'Ojja merguez (version douce)',
      side: 'Pain tounsi frais',
      dessert: 'Crème dessert vanille',
    },
    {
      day: 'Vendredi',
      starter: 'Velouté de potiron',
      main: 'Filet de poisson du jour',
      side: 'Riz basmati aux petits pois',
      dessert: 'Pâtisserie traditionnelle (gargoulette)',
    },
  ],
};

export const MOCK_TEACHERS: TeacherDirectoryMember[] = [
  {
    id: 'teach-1',
    name: 'Fatma Jaziri',
    title: 'Enseignante Principal - Primaire',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    bio: '12 ans d’expérience en enseignement primaire bilingue (Arabe/Français).',
    classes: ['3ème Année A', '4ème Année B'],
    languages: ['Arabe', 'Français', 'Anglais'],
  },
  {
    id: 'teach-2',
    name: 'Mohamed Salah Khelifi',
    title: 'Professeur de Mathématiques & Sciences',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    bio: 'Passionné par l’initiation scientifique et le calcul logique ludique.',
    classes: ['5ème Année', '6ème Année'],
    languages: ['Arabe', 'Français'],
  },
];

export const MOCK_ADMIN: AdminDirectoryMember[] = [
  {
    id: 'admin-1',
    name: 'Mourad Kristou',
    title: 'Fondateur & Directeur Général',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio: 'Engagé pour l’excellence éducative et l’épanouissement des enfants depuis la fondation de l’école.',
    responsibilities: ['Direction générale', 'Relations institutionnelles', 'Pédagogie'],
  },
  {
    id: 'admin-2',
    name: 'Sonia Bouazizi',
    title: 'Coordinatrice Pédagogique',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    bio: 'Supervision des programmes bilingues et suivi personnalisé des élèves.',
    responsibilities: ['Suivi des classes', 'Orientation des parents', 'Formation continue'],
  },
];
