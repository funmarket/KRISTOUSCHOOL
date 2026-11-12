import React from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageKey } from '../../types';
import { resolveHomePage } from './homepageAccess';
import { PublicHomePage } from './PublicHomePage';
import { ParentHomePage } from './ParentHomePage';
import { StudentHomePage } from './StudentHomePage';
import { TeacherHomePage } from './TeacherHomePage';
import { SchoolStaffHomePage } from './SchoolStaffHomePage';
import { AdministrativePersonnelHomePage } from './AdministrativePersonnelHomePage';
import { ManagerHomePage } from './ManagerHomePage';
import { OwnerHomePage } from './OwnerHomePage';
import { ApplicationStatusScreen } from './ApplicationStatusScreen';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export interface HomePageResolverProps {
  setActiveTab: (tab: string) => void;
  onOpenAuth: (mode?: 'signin' | 'register') => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
  requestedHomePage?: HomePageKey | null;
  onInspectRoleHome?: (homeKey: HomePageKey | null) => void;
}

export const HomePageResolver: React.FC<HomePageResolverProps> = ({
  setActiveTab,
  onOpenAuth,
  onNavigateToSubTab,
  requestedHomePage,
  onInspectRoleHome,
}) => {
  const { currentUser, language } = useApp();

  const resolution = resolveHomePage(currentUser, requestedHomePage);

  const renderResolvedHome = () => {
    switch (resolution.homePage) {
      case 'PUBLIC_HOME':
        return (
          <PublicHomePage
            setActiveTab={setActiveTab}
            onOpenAuth={onOpenAuth}
            onNavigateToSubTab={onNavigateToSubTab}
          />
        );

      case 'PARENT_HOME':
        return (
          <ParentHomePage
            setActiveTab={setActiveTab}
            onNavigateToSubTab={onNavigateToSubTab}
          />
        );

      case 'STUDENT_HOME':
        return (
          <StudentHomePage
            setActiveTab={setActiveTab}
            onNavigateToSubTab={onNavigateToSubTab}
          />
        );

      case 'TEACHER_HOME':
        return (
          <TeacherHomePage
            setActiveTab={setActiveTab}
            onNavigateToSubTab={onNavigateToSubTab}
          />
        );

      case 'SCHOOL_STAFF_HOME':
        return (
          <SchoolStaffHomePage
            setActiveTab={setActiveTab}
            onNavigateToSubTab={onNavigateToSubTab}
          />
        );

      case 'ADMINISTRATIVE_PERSONNEL_HOME':
        return (
          <AdministrativePersonnelHomePage
            setActiveTab={setActiveTab}
            onNavigateToSubTab={onNavigateToSubTab}
          />
        );

      case 'MANAGER_HOME':
        return (
          <ManagerHomePage
            setActiveTab={setActiveTab}
            onNavigateToSubTab={onNavigateToSubTab}
            onInspectRoleHome={onInspectRoleHome}
          />
        );

      case 'OWNER_HOME':
        return (
          <OwnerHomePage
            setActiveTab={setActiveTab}
            onNavigateToSubTab={onNavigateToSubTab}
            onInspectRoleHome={onInspectRoleHome}
          />
        );

      case 'APPLICATION_STATUS':
        return (
          <ApplicationStatusScreen
            onOpenPublicSite={() => setActiveTab('publicSite')}
          />
        );

      default:
        return (
          <PublicHomePage
            setActiveTab={setActiveTab}
            onOpenAuth={onOpenAuth}
            onNavigateToSubTab={onNavigateToSubTab}
          />
        );
    }
  };

  return (
    <div data-testid="homepage-resolver" data-resolved-home={resolution.homePage}>
      {resolution.oversightMode && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3">
          <div className="kh-oversight-banner" data-testid="oversight-mode-banner">
            <div className="text-xs sm:text-sm font-extrabold">
              👁️ {pickText(HOMEPAGE_COMMON_TEXT.oversightBannerPrefix, language)}{' '}
              <span className="underline">
                {pickText(HOMEPAGE_BADGE_LABELS[resolution.homePage], language)}
              </span>{' '}
              ({resolution.actorRole})
            </div>
            {onInspectRoleHome && (
              <button
                type="button"
                onClick={() => onInspectRoleHome(null)}
                className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-amber-800 transition-colors"
              >
                {pickText(HOMEPAGE_COMMON_TEXT.returnToMyHome, language)}
              </button>
            )}
          </div>
        </div>
      )}
      {renderResolvedHome()}
    </div>
  );
};
