import React from 'react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  Images,
  Megaphone,
  MessageSquare,
  School,
  Settings,
  ShieldCheck,
  Users,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Language, UserRole } from '../../types';

type Localized = Record<Language, string>;
const label = (en: string, fr: string, ar: string): Localized => ({ en, fr, ar });

type Destination = 'community' | 'notes' | 'pickup' | 'foodMenu' | 'directory' | 'registration';
type Tile = { title: Localized; icon: LucideIcon; destination?: Destination };

const tiles = {
  children: { title: label('My Children', 'Mes enfants', 'أبنائي'), icon: Users },
  classes: { title: label('My Classes', 'Mes classes', 'أقسامي'), icon: School, destination: 'community' },
  homework: { title: label('Homework & Classwork', 'Devoirs et travaux', 'الواجبات والأعمال'), icon: BookOpen, destination: 'community' },
  calendar: { title: label('Calendar', 'Calendrier', 'التقويم'), icon: CalendarDays, destination: 'community' },
  messages: { title: label('Messages', 'Messages', 'الرسائل'), icon: MessageSquare },
  parentNotes: { title: label('Parent Notes', 'Notes des parents', 'ملاحظات الأولياء'), icon: FileText, destination: 'notes' },
  pickup: { title: label('Pickup', 'Sortie et sécurité', 'استلام التلاميذ'), icon: ShieldCheck, destination: 'pickup' },
  food: { title: label('Food Menu', 'Menu de la cantine', 'قائمة الطعام'), icon: Utensils, destination: 'foodMenu' },
  teachers: { title: label('Teachers', 'Enseignants', 'المعلمون'), icon: GraduationCap, destination: 'directory' },
  administration: { title: label('Administration', 'Administration', 'الإدارة'), icon: School, destination: 'directory' },
  registration: { title: label('Registration', 'Inscription', 'التسجيل'), icon: ClipboardList, destination: 'registration' },
  gallery: { title: label('Gallery', 'Galerie', 'المعرض'), icon: Images },
  announcements: { title: label('Announcements', 'Annonces', 'الإعلانات'), icon: Megaphone, destination: 'community' },
  classQuestions: { title: label('Class Questions', 'Questions de classe', 'أسئلة القسم'), icon: MessageSquare, destination: 'community' },
  documents: { title: label('Class Documents', 'Documents de classe', 'وثائق القسم'), icon: FileText, destination: 'community' },
  controlCenter: { title: label('Control Center', 'Centre de contrôle', 'مركز التحكم'), icon: Settings },
  broadcasts: { title: label('Broadcasts', 'Communiqués', 'البلاغات'), icon: Megaphone },
  publicContent: { title: label('Public Content', 'Contenu public', 'المحتوى العام'), icon: Images },
  accessControl: { title: label('Users & Access', 'Utilisateurs et accès', 'المستخدمون والصلاحيات'), icon: ShieldCheck },
  staffTasks: { title: label('My Tasks', 'Mes tâches', 'مهامي'), icon: ClipboardList },
  facilities: { title: label('Facilities', 'Locaux et entretien', 'المرافق والصيانة'), icon: Wrench },
  requests: { title: label('Requests', 'Demandes', 'الطلبات'), icon: FileText },
  reports: { title: label('Reports', 'Rapports', 'التقارير'), icon: ClipboardList },
  studentRecords: { title: label('Student Records', 'Dossiers des élèves', 'ملفات التلاميذ'), icon: Users },
  papers: { title: label('Papers & Certificates', 'Documents et attestations', 'الوثائق والشهادات'), icon: FileText },
} satisfies Record<string, Tile>;

type TileKey = keyof typeof tiles;
type SchoolRole = Exclude<UserRole, 'GENERAL_USER'>;
type Workspace = { heading: Localized; intro: Localized; cards: TileKey[] };

const workspaces: Record<SchoolRole, Workspace> = {
  APP_ADMIN: {
    heading: label('School Owner / Principal', 'Propriétaire / Direction', 'مالك المدرسة / المدير'),
    intro: label('School-wide oversight and ultimate access authority. Access-rule editing is not connected yet.', 'Supervision générale et autorité sur les accès. La modification des autorisations reste à connecter.', 'الإشراف العام والصلاحيات العليا. إدارة الصلاحيات غير موصولة بعد.'),
    cards: ['controlCenter', 'accessControl', 'registration', 'pickup', 'broadcasts', 'food', 'publicContent', 'classes', 'parentNotes', 'teachers', 'administration', 'reports'],
  },
  MANAGER: {
    heading: label('Manager / Director', 'Responsable / Directeur', 'المسؤول / المدير'),
    intro: label('Coordinated school operations and services. Owner-only role grants are separate.', 'Coordination des opérations scolaires. Les attributions de rôles restent réservées au propriétaire.', 'تنسيق العمليات المدرسية. تعيين الأدوار من اختصاص مالك المدرسة.'),
    cards: ['controlCenter', 'pickup', 'registration', 'broadcasts', 'food', 'publicContent', 'classes', 'parentNotes', 'teachers', 'administration', 'reports'],
  },
  PARENT: {
    heading: label('Parent Home', 'Espace parents', 'فضاء الأولياء'),
    intro: label('Follow your linked children and their school life.', 'Suivez vos enfants liés et leur vie scolaire.', 'تابع أبناءك المرتبطين بحسابك وحياتهم المدرسية.'),
    cards: ['children', 'classes', 'homework', 'calendar', 'messages', 'parentNotes', 'pickup', 'food', 'teachers', 'administration', 'registration', 'gallery'],
  },
  STUDENT: {
    heading: label('Student Home', 'Espace élève', 'فضاء التلميذ'),
    intro: label('Your class, assignments and school news.', 'Votre classe, vos devoirs et les actualités scolaires.', 'قسمك وواجباتك وأخبار المدرسة.'),
    cards: ['announcements', 'homework', 'classQuestions', 'food', 'calendar', 'documents'],
  },
  TEACHER: {
    heading: label('Teacher Home', 'Espace enseignant', 'فضاء المعلم'),
    intro: label('Assigned classes, learning materials and authorized school communication.', 'Classes attribuées, supports pédagogiques et communication scolaire autorisée.', 'الأقسام المسندة والمواد التعليمية والتواصل المدرسي المسموح.'),
    cards: ['classes', 'pickup', 'homework', 'messages', 'parentNotes', 'food'],
  },
  SCHOOL_STAFF: {
    heading: label('School Staff Home', 'Espace personnel scolaire', 'فضاء أعوان المدرسة'),
    intro: label('Daily duties and school support services for your assigned job.', 'Tâches quotidiennes et services liés à votre fonction.', 'المهام اليومية والخدمات المرتبطة بعملك.'),
    cards: ['staffTasks', 'food', 'facilities', 'requests', 'messages'],
  },
  ADMINISTRATIVE_PERSONNEL: {
    heading: label('Administrative Office', 'Espace administratif', 'فضاء الموظفين الإداريين'),
    intro: label('School-office work under your own account and activity history.', 'Travail administratif avec votre propre compte et historique des actions.', 'أعمال الإدارة المدرسية باستخدام حسابك الخاص وسجل نشاطك.'),
    cards: ['registration', 'studentRecords', 'papers', 'reports', 'administration', 'messages'],
  },
};

const openLabel = label('Open', 'Ouvrir', 'فتح');
const plannedLabel = label('Not connected yet', 'Pas encore connecté', 'غير موصول بعد');
const linkedChildrenLabel = label('My linked children', 'Mes enfants liés', 'أبنائي المرتبطون');
const assignedClassesLabel = label('Assigned classes', 'Classes attribuées', 'الأقسام المسندة');
const noChildrenLabel = label('No linked children found for this account.', 'Aucun enfant lié à ce compte.', 'لا يوجد أبناء مرتبطون بهذا الحساب.');
const noClassesLabel = label('No class assignment found for this account.', 'Aucune classe attribuée à ce compte.', 'لا توجد أقسام مسندة إلى هذا الحساب.');

export const RoleWorkspaceView: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { currentUser, currentRole, childrenList, classesList, language, dir } = useApp();

  // The established Public Home remains the GENERAL_USER experience.
  if (!currentUser || currentRole === 'GENERAL_USER') return null;

  const workspace = workspaces[currentRole];
  const linkedChildren = currentRole === 'PARENT'
    ? childrenList.filter(child => currentUser.linkedChildrenIds?.includes(child.id))
    : [];
  const assignedClasses = currentRole === 'TEACHER' || currentRole === 'STUDENT'
    ? classesList.filter(schoolClass => currentUser.assignedClassIds?.includes(schoolClass.id))
    : [];

  return (
    <section dir={dir} className="space-y-5 pb-12">
      <header className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#111111] sm:p-7">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-k-brand">{workspace.heading[language]}</p>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{currentUser.fullName}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">{workspace.intro[language]}</p>
      </header>

      {currentRole === 'PARENT' && (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#111111]">
          <h2 className="mb-3 text-base font-bold text-gray-900 dark:text-white">{linkedChildrenLabel[language]}</h2>
          {linkedChildren.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {linkedChildren.map(child => (
                <article key={child.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
                  <img src={child.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{child.fullName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{child.className}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">{noChildrenLabel[language]}</p>}
        </section>
      )}

      {(currentRole === 'TEACHER' || currentRole === 'STUDENT') && (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#111111]">
          <h2 className="mb-3 text-base font-bold text-gray-900 dark:text-white">{assignedClassesLabel[language]}</h2>
          {assignedClasses.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {assignedClasses.map(schoolClass => (
                <article key={schoolClass.id} className="rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{schoolClass.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{schoolClass.academicYear}</p>
                </article>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">{noClassesLabel[language]}</p>}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workspace.cards.map(key => {
          const tile = tiles[key];
          const Icon = tile.icon;
          return (
            <button
              key={key}
              type="button"
              disabled={!tile.destination}
              onClick={() => { if (tile.destination) setActiveTab(tile.destination); }}
              className={'flex min-h-36 flex-col items-start rounded-3xl border border-gray-200 bg-white p-5 text-start shadow-sm transition-colors dark:border-gray-800 dark:bg-[#111111] ' +
                (tile.destination ? 'hover:border-k-brand hover:bg-k-brand/5 focus-visible:outline-2 focus-visible:outline-k-brand' : 'cursor-not-allowed opacity-70')}
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-k-brand/10 text-k-brand"><Icon size={20} /></span>
              <span className="text-sm font-extrabold text-gray-900 dark:text-white">{tile.title[language]}</span>
              <span className="mt-2 text-xs font-semibold text-k-brand">{tile.destination ? openLabel[language] : plannedLabel[language]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
