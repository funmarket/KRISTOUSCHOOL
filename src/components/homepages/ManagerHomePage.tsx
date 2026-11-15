import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageKey } from '../../types';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import {
  canAccessAppTab,
  canReviewOrdinaryAccountsUi,
  getDelegatedOversightTargets,
} from './homepageAccess';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import {
  OwnerGovernanceSection,
  OwnerGovernanceWorkspace,
} from './OwnerGovernanceWorkspace';

export interface ManagerHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory' | 'announcements', subTab: string) => void;
  onInspectRoleHome?: (homeKey: HomePageKey | null) => void;
}

export const ManagerHomePage: React.FC<ManagerHomePageProps> = ({
  setActiveTab,
  onNavigateToSubTab,
  onInspectRoleHome,
}) => {
  const {
    language,
    currentUser,
    operationalCounts,
    operationalCountsLoaded,
    schoolContextError,
    refreshSchoolData,
  } = useApp();
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [govSection, setGovSection] = useState<OwnerGovernanceSection | null>(null);

  const capabilities = Array.isArray(currentUser?.capabilities) ? currentUser.capabilities : [];
  const delegatedOversightTargets = getDelegatedOversightTargets(currentUser);
  const canReviewAccounts = canReviewOrdinaryAccountsUi(currentUser);
  const canViewClasses = canAccessAppTab(currentUser, 'classes');

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
    <div className="kh-role-page" data-testid="homepage-MANAGER_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.MANAGER_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={pickText(
          {
            ar: 'لوحة التسيير العملياتي للمدير المساعد ضمن الصلاحيات المفوضة من طرف مالك المدرسة (APP_ADMIN).',
            fr: 'Pilotage opérationnel de la direction dans le cadre des délégations accordées par le fondateur (APP_ADMIN).',
            en: 'Operational management dashboard scoped to capabilities delegated by the School Owner (APP_ADMIN).',
          },
          language,
        )}
      >
        {delegatedOversightTargets.length > 0 && onInspectRoleHome && (
          <div className="kh-selector-bar" aria-label="Delegated role workspace inspection">
            {delegatedOversightTargets.map((targetKey) => (
              <button
                key={targetKey}
                type="button"
                onClick={() => onInspectRoleHome(targetKey)}
                className="kh-selector-pill"
              >
                🔍 {pickText(HOMEPAGE_BADGE_LABELS[targetKey], language)}
              </button>
            ))}
          </div>
        )}
      </HomePageHeader>

      {showControlCenter && (
        <div className="kh-info-panel mb-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="kh-info-panel-title">
              {pickText(
                { ar: 'مركز متابعة المسير والصلاحيات المفوضة', fr: 'Périmètre opérationnel Manager', en: 'Manager Operational Control Center' },
                language,
              )}
            </h2>
            <button
              type="button"
              onClick={() => setShowControlCenter(false)}
              className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold"
            >
              {pickText({ ar: 'إغلاق', fr: 'Fermer', en: 'Close' }, language)}
            </button>
          </div>
          {schoolContextError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between gap-2"
            >
              <span>{schoolContextError}</span>
              <button
                type="button"
                onClick={() => void refreshSchoolData()}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-white text-[11px] font-bold hover:bg-red-700"
              >
                {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
              <span className="text-slate-500 font-bold">{pickText({ ar: 'الأقسام', fr: 'Classes', en: 'Classes' }, language)}</span>
              <div className="text-lg font-black mt-0.5">{operationalCountsLoaded ? (operationalCounts.activeClasses ?? 0) : '—'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
              <span className="text-slate-500 font-bold">{pickText({ ar: 'التلاميذ', fr: 'Élèves', en: 'Students' }, language)}</span>
              <div className="text-lg font-black mt-0.5">{operationalCountsLoaded ? (operationalCounts.activeStudents ?? 0) : '—'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
              <span className="text-slate-500 font-bold">{pickText({ ar: 'التسجيلات المعلقة', fr: 'Admissions', en: 'Pending Admissions' }, language)}</span>
              <div className="text-lg font-black mt-0.5">{operationalCountsLoaded ? (operationalCounts.pendingAdmissions ?? 0) : '—'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
              <span className="text-slate-500 font-bold">{pickText({ ar: 'الاستفسارات', fr: 'Demandes', en: 'Open Inquiries' }, language)}</span>
              <div className="text-lg font-black mt-0.5">{operationalCountsLoaded ? (operationalCounts.openInquiries ?? 0) : '—'}</div>
            </div>
          </div>
          <p className="kh-info-panel-body text-xs">
            {capabilities.length > 0
              ? pickText(
                  {
                    ar: `الصلاحيات المفوضة من الخادم: ${capabilities.join('، ')}`,
                    fr: `Habilitations actives déléguées : ${capabilities.join(', ')}`,
                    en: `Server-verified delegated capabilities: ${capabilities.join(', ')}`,
                  },
                  language,
                )
              : pickText(
                  {
                    ar: 'لا توجد صلاحيات إضافية مفوضة حالياً؛ يمكنك متابعة التشغيل اليومي ضمن دورك الأساسي.',
                    fr: 'Aucune délégation additionnelle active ; vous disposez des vues opérationnelles de base.',
                    en: 'No extra Owner capability grants active yet; standard operational modules are enabled.',
                  },
                  language,
                )}
          </p>
        </div>
      )}

      {govSection && canReviewAccounts && (
        <OwnerGovernanceWorkspace
          ordinaryReviewOnly
          activeSection={govSection}
          onSelectSection={(sec) => setGovSection(sec)}
          onClose={() => setGovSection(null)}
        />
      )}

      {/* 6 Primary Cards matching Screenshot 5 (MANAGER HOME) and Section 11.2 */}
      <HomeCardGrid ariaLabel="Manager primary operational cards">
        <HomeShortcutCard
          id="manager-control-center"
          title={pickText(
            { ar: 'مركز المتابعة', fr: 'Centre de contrôle', en: 'Control Center' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="🛠️"
          tone="slate"
          onClick={() => setShowControlCenter((prev) => !prev)}
        />

        <HomeShortcutCard
          id="manager-pickup"
          title={pickText({ ar: 'الاستلام المدرسي', fr: 'Sortie & Pickup', en: 'Pickup' }, language)}
          actionLabel={openActionLabel}
          icon="🚸"
          tone="green"
          onClick={() => setActiveTab('pickup')}
        />

        <HomeShortcutCard
          id="manager-registration"
          title={pickText(
            { ar: 'التسجيل والمراجعات', fr: 'Inscriptions & Dossiers', en: 'Registration' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📋"
          tone="orange"
          onClick={() => setActiveTab('registration')}
        />

        <HomeShortcutCard
          id="manager-broadcasts"
          title={pickText({ ar: 'البلاغات العامة', fr: 'Diffusions & Annonces', en: 'Broadcasts' }, language)}
          actionLabel={openActionLabel}
          icon="📢"
          tone="red"
          onClick={() => setActiveTab('announcements')}
        />

        <HomeShortcutCard
          id="manager-food-menu"
          title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu' }, language)}
          actionLabel={openActionLabel}
          icon="🍽️"
          tone="yellow"
          onClick={() => setActiveTab('foodMenu')}
        />

        <HomeShortcutCard
          id="manager-public-content"
          title={pickText(
            { ar: 'المحتوى العام', fr: 'Contenu public', en: 'Public content' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="🌐"
          tone="blue"
          onClick={() => setActiveTab('publicSite')}
        />
      </HomeCardGrid>

      {/* Delegated Directory, Calendar & Moderation Modules (Section 11.2) */}
      <HomeSection
        title={pickText(
          {
            ar: 'الإشراف التربوي والدليل المدرسي',
            fr: 'Supervision pédagogique & Annuaires',
            en: 'Directory, Calendar & Class Moderation',
          },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="Manager secondary operational cards">
          <HomeShortcutCard
            id="manager-teacher-directory"
            title={pickText(
              { ar: 'دليل المربين', fr: 'Annuaire des enseignants', en: 'Teacher Directory' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="👩‍🏫"
            tone="purple"
            onClick={() => openDirectorySubTab('teachers')}
          />

          <HomeShortcutCard
            id="manager-admin-directory"
            title={pickText(
              { ar: 'دليل الإدارة', fr: 'Annuaire administratif', en: 'Admin Directory' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🏛️"
            tone="slate"
            onClick={() => openDirectorySubTab('admin')}
          />

          <HomeShortcutCard
            id="manager-calendar"
            title={pickText({ ar: 'الروزنامة المدرسية', fr: 'Calendrier', en: 'Calendar' }, language)}
            actionLabel={openActionLabel}
            icon="📅"
            tone="teal"
            onClick={() =>
              onNavigateToSubTab
                ? onNavigateToSubTab('announcements', 'calendar')
                : setActiveTab('announcements')
            }
          />

          <HomeShortcutCard
            id="manager-moderation"
            title={pickText(
              { ar: 'إشراف النقاشات', fr: 'Modération des classes', en: 'Moderation' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🛡️"
            tone="blue"
            onClick={() => openCommunitySubTab('questions')}
          />

          <HomeShortcutCard
            id="manager-messages"
            title={pickText({ ar: 'الرسائل', fr: 'Messages', en: 'Messages' }, language)}
            actionLabel={openActionLabel}
            icon="💬"
            tone="purple"
            onClick={() => setActiveTab('messages')}
          />

          {canViewClasses && (
            <HomeShortcutCard
              id="manager-classes"
              title={pickText(
                { ar: 'الأقسام وقوائم التلاميذ', fr: 'Classes & Élèves', en: 'Classes & Rosters' },
                language,
              )}
              actionLabel={openActionLabel}
              icon="🏫"
              tone="teal"
              onClick={() => setActiveTab('classes')}
            />
          )}

          {canReviewAccounts && (
            <HomeShortcutCard
              id="manager-pending-approvals"
              title={pickText(
                { ar: 'مراجعة الحسابات المفوضة', fr: 'Approbations déléguées', en: 'Delegated Account Review' },
                language,
              )}
              actionLabel={openActionLabel}
              icon="✅"
              tone="green"
              onClick={() => setGovSection('pending-approvals')}
            />
          )}
        </HomeCardGrid>
      </HomeSection>
    </div>
  );
};
