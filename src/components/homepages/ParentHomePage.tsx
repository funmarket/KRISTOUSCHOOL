import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export interface ParentHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
}

export function resolveParentLinkedChildren<T extends { id: string }>(
  user: { linkedChildrenIds?: string[] } | null | undefined,
  allChildren: readonly T[],
): T[] {
  if (!user?.linkedChildrenIds || user.linkedChildrenIds.length === 0) {
    return [];
  }
  return allChildren.filter((child) => user.linkedChildrenIds?.includes(child.id));
}

export const ParentHomePage: React.FC<ParentHomePageProps> = ({
  setActiveTab,
  onNavigateToSubTab,
}) => {
  const { language, currentUser, childrenList } = useApp();

  // Strictly scope linked children to the authenticated parent's server-verified linkedChildrenIds.
  // Never fall back to MOCK_CHILDREN or unlinked child records.
  const linkedChildren = resolveParentLinkedChildren(currentUser, childrenList);

  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    linkedChildren[0]?.id ?? null,
  );
  const [showChildrenSummary, setShowChildrenSummary] = useState(false);

  const activeChild =
    linkedChildren.find((c) => c.id === selectedChildId) || linkedChildren[0] || null;

  const openCommunitySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('community', subTab);
    } else {
      setActiveTab('community');
    }
  };

  const openDirectorySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('directory', subTab);
    } else {
      setActiveTab('directory');
    }
  };

  const openActionLabel = pickText(HOMEPAGE_COMMON_TEXT.openAction, language);

  return (
    <div className="kh-role-page" data-testid="homepage-PARENT_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.PARENT_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={pickText(
          {
            ar: 'تابع أطفالك، الواجبات، الملاحظات، الاستلام المدرسي، وقائمة الطعام من مكان واحد.',
            fr: 'Suivez vos enfants, les devoirs, les notes aux enseignants, la sortie sécurisée et la cantine.',
            en: 'Follow your linked children, classwork, parent notes, secure pickup, and school services.',
          },
          language,
        )}
      >
        {linkedChildren.length > 1 && (
          <div className="kh-selector-bar" aria-label="Select child">
            {linkedChildren.map((child) => {
              const isSelected = activeChild?.id === child.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedChildId(child.id)}
                  className={`kh-selector-pill ${isSelected ? 'kh-selector-pill-active' : ''}`}
                >
                  👦 {child.fullName} ({child.className})
                </button>
              );
            })}
          </div>
        )}
      </HomePageHeader>

      {/* Honest empty state when an approved parent has no linked children yet */}
      {linkedChildren.length === 0 && (
        <EmptyFeatureState
          state="AVAILABLE_READ_ONLY"
          title={pickText(
            {
              ar: 'لا يوجد أطفال مرتبطون بحسابك حالياً',
              fr: 'Aucun enfant lié à votre compte pour le moment',
              en: 'No linked children assigned yet',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'يرجى التواصل مع إدارة مدرسة كريستو أو تقديم ملف تسجيل لربط حسابك بملف طفلك الدراسي.',
              fr: 'Veuillez contacter l’administration KRISTOU ou soumettre un dossier d’inscription pour lier votre enfant.',
              en: 'Please contact KRISTOU School administration or submit a registration application to link your child to your parent account.',
            },
            language,
          )}
          actionLabel={pickText(
            {
              ar: 'فتح بوابة التسجيل',
              fr: 'Ouvrir les inscriptions',
              en: 'Open Registration',
            },
            language,
          )}
          onAction={() => setActiveTab('registration')}
        />
      )}

      {/* Selected child summary drawer when clicking "My Children" */}
      {showChildrenSummary && activeChild && (
        <div className="kh-info-panel mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="kh-info-chip">{activeChild.level}</span>
              <h2 className="kh-info-panel-title mt-1.5">
                {activeChild.fullName} — {activeChild.className}
              </h2>
              <p className="kh-info-panel-body mt-1">
                {pickText(
                  {
                    ar: `المخولون بالاستلام: ${activeChild.pickupAuthorizedNames.join('، ')}`,
                    fr: `Personnes autorisées à la sortie : ${activeChild.pickupAuthorizedNames.join(', ')}`,
                    en: `Authorized pickup persons: ${activeChild.pickupAuthorizedNames.join(', ')}`,
                  },
                  language,
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowChildrenSummary(false)}
              className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold"
            >
              {pickText({ ar: 'إخفاء', fr: 'Masquer', en: 'Hide' }, language)}
            </button>
          </div>
        </div>
      )}

      {/* 12 Primary Cards matching Screenshot 3 (PARENT HOME) and Section 6.2 */}
      <HomeCardGrid ariaLabel="Parent shortcuts">
        <HomeShortcutCard
          id="parent-my-children"
          title={pickText({ ar: 'أطفالي', fr: 'Mes enfants', en: 'My Children' }, language)}
          actionLabel={openActionLabel}
          icon="👦"
          tone="orange"
          onClick={() => setShowChildrenSummary((prev) => !prev)}
        />

        <HomeShortcutCard
          id="parent-my-classes"
          title={pickText({ ar: 'أقسامي', fr: 'Mes classes', en: 'My Classes' }, language)}
          actionLabel={openActionLabel}
          icon="🏫"
          tone="blue"
          onClick={() => openCommunitySubTab('announcements')}
        />

        <HomeShortcutCard
          id="parent-homework"
          title={pickText(
            { ar: 'الواجبات والعمل الفصلي', fr: 'Devoirs & Travaux', en: 'Homework & Classwork' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📚"
          tone="green"
          onClick={() => openCommunitySubTab('homework')}
        />

        <HomeShortcutCard
          id="parent-calendar"
          title={pickText({ ar: 'الروزنامة', fr: 'Calendrier', en: 'Calendar' }, language)}
          actionLabel={openActionLabel}
          icon="📅"
          tone="yellow"
          onClick={() => openCommunitySubTab('calendar')}
        />

        <HomeShortcutCard
          id="parent-messages"
          title={pickText({ ar: 'الرسائل', fr: 'Messages', en: 'Messages' }, language)}
          actionLabel={openActionLabel}
          icon="💬"
          tone="purple"
          onClick={() => setActiveTab('notes')}
        />

        <HomeShortcutCard
          id="parent-notes"
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
          id="parent-pickup"
          title={pickText({ ar: 'الاستلام المدرسي', fr: 'Sortie & Pickup', en: 'Pickup' }, language)}
          actionLabel={openActionLabel}
          icon="🚸"
          tone="teal"
          onClick={() => setActiveTab('pickup')}
        />

        <HomeShortcutCard
          id="parent-food-menu"
          title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu' }, language)}
          actionLabel={openActionLabel}
          icon="🍽️"
          tone="yellow"
          onClick={() => setActiveTab('foodMenu')}
        />

        <HomeShortcutCard
          id="parent-teachers"
          title={pickText({ ar: 'المربون', fr: 'Enseignants', en: 'Teachers' }, language)}
          actionLabel={openActionLabel}
          icon="👩‍🏫"
          tone="blue"
          onClick={() => openDirectorySubTab('teachers')}
        />

        <HomeShortcutCard
          id="parent-administration"
          title={pickText({ ar: 'الإدارة', fr: 'Administration', en: 'Administration' }, language)}
          actionLabel={openActionLabel}
          icon="🏛️"
          tone="slate"
          onClick={() => openDirectorySubTab('admin')}
        />

        <HomeShortcutCard
          id="parent-registration"
          title={pickText({ ar: 'التسجيل', fr: 'Inscription', en: 'Registration' }, language)}
          actionLabel={openActionLabel}
          icon="📋"
          tone="orange"
          onClick={() => setActiveTab('registration')}
        />

        <HomeShortcutCard
          id="parent-gallery"
          title={pickText({ ar: 'معرض الصور', fr: 'Galerie', en: 'Gallery' }, language)}
          actionLabel={openActionLabel}
          icon="🖼️"
          tone="purple"
          onClick={() => openCommunitySubTab('gallery')}
        />
      </HomeCardGrid>
    </div>
  );
};
