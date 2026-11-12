import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

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
  } = useApp();

  // Strictly scope teacher classes to the authenticated teacher's server-verified assignedClassIds.
  // Never fall back to MOCK_CLASSES or unassigned class records.
  const teacherClasses = resolveTeacherAssignedClasses(currentUser, classesList);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    teacherClasses[0]?.id ?? null,
  );
  const [selectedUpcomingFeature, setSelectedUpcomingFeature] = useState<string | null>(null);

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
                },
                language,
              )}
            </span>
          </div>
        )}
      </HomePageHeader>

      {selectedUpcomingFeature && (
        <EmptyFeatureState
          state="COMING_SOON"
          title={selectedUpcomingFeature}
          description={pickText(
            {
              ar: 'سيتم تفعيل وحدة تسجيل الغيابات المعتمدة على الخادم بمجرد ربط جدول الحضور في قاعدة البيانات.',
              fr: 'Le module de présence enseignant sera activé dès que le contrat serveur de présence sera déployé.',
              en: 'The teacher attendance roster write workflow is marked Coming Soon until the backend attendance contract is verified.',
            },
            language,
          )}
          onClose={() => setSelectedUpcomingFeature(null)}
        />
      )}

      {/* Group 1: My Teaching (matching Screenshot 6 primary cards + Section 8.2) */}
      <HomeSection
        title={pickText(
          { ar: 'التدريس والأقسام', fr: 'Mon enseignement & Classes', en: 'My Teaching' },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="Teacher primary cards">
          <HomeShortcutCard
            id="teacher-my-classes"
            title={pickText({ ar: 'أقسامي', fr: 'Mes classes', en: 'My Classes' }, language)}
            actionLabel={openActionLabel}
            icon="🏫"
            tone="blue"
            onClick={() => openCommunitySubTab('announcements')}
          />

          <HomeShortcutCard
            id="teacher-pickup"
            title={pickText({ ar: 'الاستلام المدرسي', fr: 'Sortie & Pickup', en: 'Pickup' }, language)}
            actionLabel={openActionLabel}
            icon="🚸"
            tone="green"
            onClick={() => setActiveTab('pickup')}
          />

          <HomeShortcutCard
            id="teacher-homework"
            title={pickText(
              { ar: 'الواجبات والعمل الفصلي', fr: 'Devoirs & Travaux', en: 'Homework & Classwork' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="📚"
            tone="orange"
            onClick={() => openCommunitySubTab('homework')}
          />

          <HomeShortcutCard
            id="teacher-messages"
            title={pickText({ ar: 'الرسائل', fr: 'Messages', en: 'Messages' }, language)}
            actionLabel={openActionLabel}
            icon="💬"
            tone="purple"
            onClick={() => setActiveTab('notes')}
          />

          <HomeShortcutCard
            id="teacher-parent-notes"
            title={pickText(
              { ar: 'ملاحظات الأولياء', fr: 'Notes des parents', en: 'Parent Notes' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="✉️"
            tone="red"
            onClick={() => setActiveTab('notes')}
          />

          <HomeShortcutCard
            id="teacher-food-menu"
            title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu' }, language)}
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
          },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="Teacher secondary cards">
          <HomeShortcutCard
            id="teacher-class-announcements"
            title={pickText(
              { ar: 'إعلانات القسم', fr: 'Annonces de classe', en: 'Class Announcements' },
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
              { ar: 'روزنامة القسم', fr: 'Calendrier de classe', en: 'Class Calendar' },
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
              { ar: 'وثائق القسم', fr: 'Documents de classe', en: 'Class Documents' },
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
              { ar: 'الحضور والغياب', fr: 'Présences & Absences', en: 'Attendance / Absence' },
              language,
            )}
            actionLabel={pickText(HOMEPAGE_COMMON_TEXT.comingSoonBadge, language)}
            statusBadge={pickText(HOMEPAGE_COMMON_TEXT.comingSoonBadge, language)}
            state="COMING_SOON"
            icon="📋"
            tone="purple"
            onClick={() =>
              setSelectedUpcomingFeature(
                pickText(
                  { ar: 'سجل الحضور والغياب', fr: 'Registre de présence', en: 'Attendance / Absence Roster' },
                  language,
                ),
              )
            }
          />
        </HomeCardGrid>
      </HomeSection>
    </div>
  );
};
