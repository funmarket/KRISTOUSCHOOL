import React from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export interface StudentHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
}

export function resolveStudentAssignedClass<T extends { id: string }>(
  user: { assignedClassIds?: string[] } | null | undefined,
  allClasses: readonly T[],
): T | null {
  if (!user?.assignedClassIds || user.assignedClassIds.length === 0) {
    return null;
  }
  return allClasses.find((cls) => user.assignedClassIds?.includes(cls.id)) ?? null;
}

export const StudentHomePage: React.FC<StudentHomePageProps> = ({
  setActiveTab,
  onNavigateToSubTab,
}) => {
  const { language, currentUser, classesList } = useApp();

  // Strictly scope student class to the authenticated student's server-verified assignedClassIds.
  // Never fall back to classesList[0] or MOCK_CLASSES.
  const assignedClass = resolveStudentAssignedClass(currentUser, classesList);

  const openCommunitySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('community', subTab);
    } else {
      setActiveTab('community');
    }
  };

  const openActionLabel = pickText(HOMEPAGE_COMMON_TEXT.openAction, language);

  return (
    <div className="kh-role-page" data-testid="homepage-STUDENT_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.STUDENT_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={
          assignedClass
            ? pickText(
                {
                  ar: `قسمك الدراسي: ${assignedClass.name} (${assignedClass.level}) — ${assignedClass.teacherName}`,
                  fr: `Votre classe : ${assignedClass.name} (${assignedClass.level}) — ${assignedClass.teacherName}`,
                  en: `Assigned class: ${assignedClass.name} (${assignedClass.level}) — ${assignedClass.teacherName}`,
                },
                language,
              )
            : pickText(
                {
                  ar: 'فضاء التلميذ للمتابعة اليومية للواجبات، الإعلانات، والوثائق المدرسية.',
                  fr: 'Votre espace élève pour les annonces, devoirs, questions de classe et documents.',
                  en: 'Your student workspace for class announcements, homework, questions, and documents.',
                },
                language,
              )
        }
      >
        {!assignedClass && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
            <span>🎓</span>
            <span>
              {pickText(
                {
                  ar: 'لم يتم ربط حسابك بقسم دراسي بعد — يرجى مراجعة إدارة المدرسة لتأكيد تسجيلك في القسم.',
                  fr: 'Aucune classe liée à votre compte élève pour le moment — contactez l’administration pour l’affectation de classe.',
                  en: 'No class is linked to your student account yet — please contact school administration for class enrollment.',
                },
                language,
              )}
            </span>
          </div>
        )}
      </HomePageHeader>

      {/* 6 Primary Cards matching Screenshot 4 (STUDENT HOME) and Section 7.2 */}
      <HomeCardGrid ariaLabel="Student shortcuts">
        <HomeShortcutCard
          id="student-announcements"
          title={pickText({ ar: 'الإعلانات', fr: 'Annonces', en: 'Announcements' }, language)}
          actionLabel={openActionLabel}
          icon="📢"
          tone="blue"
          onClick={() => openCommunitySubTab('announcements')}
        />

        <HomeShortcutCard
          id="student-homework"
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
          id="student-questions"
          title={pickText(
            { ar: 'أسئلة القسم', fr: 'Questions de classe', en: 'Class Questions' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="💬"
          tone="purple"
          onClick={() => openCommunitySubTab('questions')}
        />

        <HomeShortcutCard
          id="student-food-menu"
          title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu' }, language)}
          actionLabel={openActionLabel}
          icon="🍽️"
          tone="green"
          onClick={() => setActiveTab('foodMenu')}
        />

        <HomeShortcutCard
          id="student-calendar"
          title={pickText({ ar: 'الروزنامة', fr: 'Calendrier', en: 'Calendar' }, language)}
          actionLabel={openActionLabel}
          icon="📅"
          tone="yellow"
          onClick={() => openCommunitySubTab('calendar')}
        />

        <HomeShortcutCard
          id="student-documents"
          title={pickText({ ar: 'الوثائق', fr: 'Documents', en: 'Documents' }, language)}
          actionLabel={openActionLabel}
          icon="📄"
          tone="slate"
          onClick={() => openCommunitySubTab('documents')}
        />
      </HomeCardGrid>
    </div>
  );
};
