import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageKey } from '../../types';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { getDelegatedOversightTargets } from './homepageAccess';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export interface ManagerHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
  onInspectRoleHome?: (homeKey: HomePageKey | null) => void;
}

export const ManagerHomePage: React.FC<ManagerHomePageProps> = ({
  setActiveTab,
  onNavigateToSubTab,
  onInspectRoleHome,
}) => {
  const { language, currentUser } = useApp();
  const [selectedManagerNotice, setSelectedManagerNotice] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const capabilities = Array.isArray(currentUser?.capabilities) ? currentUser.capabilities : [];
  const delegatedOversightTargets = getDelegatedOversightTargets(currentUser);

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

      {selectedManagerNotice && (
        <EmptyFeatureState
          state="BLOCKED_BACKEND"
          title={selectedManagerNotice.title}
          description={selectedManagerNotice.description}
          onClose={() => setSelectedManagerNotice(null)}
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
          onClick={() =>
            setSelectedManagerNotice({
              title: pickText(
                { ar: 'ملخص الصلاحيات المفوضة للمسير', fr: 'Périmètre de délégation Manager', en: 'Manager Operational Scope' },
                language,
              ),
              description:
                capabilities.length > 0
                  ? pickText(
                      {
                        ar: `الصلاحيات المفعلة لحسابك: ${capabilities.join('، ')}. تعديل الأدوار السيادية يبقى حصرياً لمالك المدرسة (APP_ADMIN).`,
                        fr: `Habilitations actives : ${capabilities.join(', ')}. La gouvernance propriétaire reste réservée à APP_ADMIN.`,
                        en: `Active delegated capabilities: ${capabilities.join(', ')}. Owner governance remains exclusive to APP_ADMIN.`,
                      },
                      language,
                    )
                  : pickText(
                      {
                        ar: 'حسابك مفعل بدور مسير (MANAGER) للصلاحيات التشغيلية اليومية. تفويض اعتماد الحسابات يتطلب ربط الخادم من مالك المدرسة.',
                        fr: 'Votre compte Manager dispose du suivi opérationnel quotidien. Les approbations de comptes nécessitent une délégation serveur APP_ADMIN.',
                        en: 'Your Manager account has daily operational access. Account approval mutations require explicit server-verified delegation from APP_ADMIN.',
                      },
                      language,
                    ),
            })
          }
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
          onClick={() => openCommunitySubTab('announcements')}
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
            onClick={() => openCommunitySubTab('calendar')}
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
        </HomeCardGrid>
      </HomeSection>
    </div>
  );
};
