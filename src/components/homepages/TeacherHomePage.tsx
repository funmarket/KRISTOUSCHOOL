import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import { countUnreadThreads } from '../../lib/schoolContent';

export interface TeacherHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
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

export const TeacherHomePage: React.FC<TeacherHomePageProps> = ({
  setActiveTab,
  onNavigateToSubTab,
}) => {
  const {
    language,
    currentUser,
    classesList,
    selectedClassId,
    setSelectedClassId,
    messages,
    messagesStatus,
  } = useApp();
  const unreadMessagesCount = countUnreadThreads(messages, messagesStatus);

  // Strictly scope teacher classes to the authenticated teacher's server-verified assignedClassIds.
  // Never fall back to MOCK_CLASSES or unassigned class records.
  const teacherClasses = resolveTeacherAssignedClasses(currentUser, classesList);

  useEffect(() => {
    if (teacherClasses.length > 0 && !teacherClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(teacherClasses[0].id);
    }
  }, [teacherClasses, selectedClassId, setSelectedClassId]);

  const openCommunitySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('community', subTab);
    } else {
      setActiveTab('community');
    }
  };

  const openActionLabel = pickText(HOMEPAGE_COMMON_TEXT.openAction, language);

  return (
    <div className="kh-role-page" data-testid="homepage-TEACHER_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.TEACHER_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={pickText(
          {
            ar: 'إدارة أقسامك، الواجبات، الاستلام المدرسي، والتواصل مع الأولياء بوضوح.',
            fr: 'Gérez vos classes assignées, les devoirs, la sortie des élèves et les échanges avec les parents.',
            en: 'Manage your assigned classes, homework, student release, and parent communication.',
            es: 'Gestiona tus clases asignadas, deberes, recogida de alumnos y comunicación con las familias.',
            de: 'Verwalten Sie Ihre zugewiesenen Klassen, Hausaufgaben, Schülerabholung und Elternkommunikation.',
            pt: 'Gerir as suas turmas atribuídas, trabalhos de casa, saída dos alunos e comunicação com os pais.',
          },
          language,
        )}
      >
        {teacherClasses.length > 0 ? (
          <div className="kh-selector-bar" aria-label="Select assigned class">
            {teacherClasses.map((cls) => {
              const isSelected = selectedClassId === cls.id;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`kh-selector-pill ${isSelected ? 'kh-selector-pill-active' : ''}`}
                >
                  🏫 {cls.name} ({cls.studentCount})
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
            <span>🏫</span>
            <span>
              {pickText(
                {
                  ar: 'لا توجد أقسام مسندة لحسابك حالياً — سيتم عرض أقسامك فور ربطها من قبل الإدارة.',
                  fr: 'Aucune classe assignée à votre compte pour le moment — vos classes apparaîtront dès leur affectation par la direction.',
                  en: 'No assigned classes linked to your teacher account yet — classes will appear once assigned by school administration.',
                  es: 'Aún no hay clases asignadas a tu cuenta docente — aparecerán en cuanto la administración las asigne.',
                  de: 'Ihrem Lehrkräftekonto sind noch keine Klassen zugewiesen — diese erscheinen nach Zuweisung durch die Schulleitung.',
                  pt: 'Ainda não há turmas associadas à sua conta docente — aparecerão assim que forem atribuídas pela direção.',
                },
                language,
              )}
            </span>
          </div>
        )}
      </HomePageHeader>

      {/* Group 1: My Teaching (matching Screenshot 6 primary cards + Section 8.2) */}
      <HomeSection
        title={pickText(
          { ar: 'التدريس والأقسام', fr: 'Mon enseignement & Classes', en: 'My Teaching', es: 'Mi docencia', de: 'Mein Unterricht', pt: 'A minha docência' },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="Teacher primary cards">
          <HomeShortcutCard
            id="teacher-my-classes"
            title={pickText({ ar: 'أقسامي', fr: 'Mes classes', en: 'My Classes', es: 'Mis clases', de: 'Meine Klassen', pt: 'As minhas turmas' }, language)}
            actionLabel={openActionLabel}
            icon="🏫"
            tone="blue"
            onClick={() => setActiveTab('classes')}
          />

          <HomeShortcutCard
            id="teacher-pickup"
            title={pickText({ ar: 'الاستلام المدرسي', fr: 'Sortie & Pickup', en: 'Pickup', es: 'Recogida', de: 'Abholung', pt: 'Recolha' }, language)}
            actionLabel={openActionLabel}
            icon="🚸"
            tone="green"
            onClick={() => setActiveTab('pickup')}
          />

          <HomeShortcutCard
            id="teacher-homework"
            title={pickText(
              { ar: 'الواجبات والعمل الفصلي', fr: 'Devoirs & Travaux', en: 'Homework & Classwork', es: 'Deberes y tareas', de: 'Hausaufgaben & Aufgaben', pt: 'Trabalhos de casa e aula' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="📚"
            tone="orange"
            onClick={() => openCommunitySubTab('homework')}
          />

          <HomeShortcutCard
            id="teacher-messages"
            title={pickText({ ar: 'الرسائل', fr: 'Messages', en: 'Messages', es: 'Mensajes', de: 'Nachrichten', pt: 'Mensagens' }, language)}
            actionLabel={openActionLabel}
            statusBadge={unreadMessagesCount > 0 ? String(unreadMessagesCount) : undefined}
            icon="💬"
            tone="purple"
            onClick={() => setActiveTab('messages')}
          />

          <HomeShortcutCard
            id="teacher-parent-notes"
            title={pickText(
              { ar: 'ملاحظات الأولياء', fr: 'Notes des parents', en: 'Parent Notes', es: 'Notas de los padres', de: 'Elternhinweise', pt: 'Notas dos pais' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="✉️"
            tone="red"
            onClick={() => setActiveTab('notes')}
          />

          <HomeShortcutCard
            id="teacher-food-menu"
            title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu', es: 'Menú del comedor', de: 'Speiseplan', pt: 'Ementa da cantina' }, language)}
            actionLabel={openActionLabel}
            icon="🍽️"
            tone="yellow"
            onClick={() => setActiveTab('foodMenu')}
          />
        </HomeCardGrid>
      </HomeSection>

      {/* Group 2: Communication & School Services (remaining Section 8.2 teacher tools) */}
      <HomeSection
        title={pickText(
          {
            ar: 'التواصل والخدمات البيداغوجية',
            fr: 'Communication & Services pédagogiques',
            en: 'Communication & School Services',
            es: 'Comunicación y servicios escolares',
            de: 'Kommunikation & Schuldienste',
            pt: 'Comunicação e serviços escolares',
          },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="Teacher secondary cards">
          <HomeShortcutCard
            id="teacher-class-announcements"
            title={pickText(
              { ar: 'إعلانات القسم', fr: 'Annonces de classe', en: 'Class Announcements', es: 'Anuncios de clase', de: 'Klassenankündigungen', pt: 'Anúncios da turma' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="📢"
            tone="blue"
            onClick={() => openCommunitySubTab('announcements')}
          />

          <HomeShortcutCard
            id="teacher-class-calendar"
            title={pickText(
              { ar: 'روزنامة القسم', fr: 'Calendrier de classe', en: 'Class Calendar', es: 'Calendario de clase', de: 'Klassenkalender', pt: 'Calendário da turma' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="📅"
            tone="teal"
            onClick={() => openCommunitySubTab('calendar')}
          />

          <HomeShortcutCard
            id="teacher-class-documents"
            title={pickText(
              { ar: 'وثائق القسم', fr: 'Documents de classe', en: 'Class Documents', es: 'Documentos de clase', de: 'Klassendokumente', pt: 'Documentos da turma' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="📄"
            tone="slate"
            onClick={() => openCommunitySubTab('documents')}
          />

          <HomeShortcutCard
            id="teacher-attendance"
            title={pickText(
              { ar: 'الحضور والغياب', fr: 'Présences & Absences', en: 'Attendance / Absence', es: 'Asistencia y ausencias', de: 'Anwesenheit & Fehlzeiten', pt: 'Presenças e faltas' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="📋"
            tone="purple"
            onClick={() => setActiveTab('attendance')}
          />
        </HomeCardGrid>
      </HomeSection>
    </div>
  );
};
