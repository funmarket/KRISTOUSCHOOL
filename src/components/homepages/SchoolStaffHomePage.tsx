import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export interface SchoolStaffHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
}

export const SchoolStaffHomePage: React.FC<SchoolStaffHomePageProps> = ({
  setActiveTab,
  onNavigateToSubTab,
}) => {
  const { language, currentUser } = useApp();
  const [selectedNotice, setSelectedNotice] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const capabilities = Array.isArray(currentUser?.capabilities) ? currentUser.capabilities : [];
  const hasPickupCapability =
    capabilities.includes('PICKUP_RELEASE') || capabilities.includes('PICKUP_DESK');

  const openDirectorySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('directory', subTab);
    } else {
      setActiveTab('directory');
    }
  };

  const openActionLabel = pickText(HOMEPAGE_COMMON_TEXT.openAction, language);
  const comingSoonLabel = pickText(HOMEPAGE_COMMON_TEXT.comingSoonBadge, language);

  return (
    <div className="kh-role-page" data-testid="homepage-SCHOOL_STAFF_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.SCHOOL_STAFF_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={pickText(
          {
            ar: 'بوابة العمليات اليومية لأعوان المدرسة، الخدمات، والمهام الميدانية دون كشف الملفات الأكاديمية الخاصة.',
            fr: 'Espace opérationnel quotidien du personnel scolaire : annonces internes, cantine, annuaire et services assignés.',
            en: 'Daily operational workspace for school support staff without exposing private academic or family records.',
          },
          language,
        )}
      />

      {selectedNotice && (
        <EmptyFeatureState
          state="COMING_SOON"
          title={selectedNotice.title}
          description={selectedNotice.description}
          onClose={() => setSelectedNotice(null)}
        />
      )}

      {/* Core Staff Cards matching Screenshot 2 + Section 9.2 */}
      <HomeCardGrid ariaLabel="School staff core cards">
        <HomeShortcutCard
          id="staff-internal-announcements"
          title={pickText(
            { ar: 'البلاغات الداخلية', fr: 'Annonces internes', en: 'Internal Announcements' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📢"
          tone="blue"
          onClick={() =>
            setSelectedNotice({
              title: pickText(
                { ar: 'البلاغات الداخلية للأعوان', fr: 'Annonces internes du personnel', en: 'Internal Staff Announcements' },
                language,
              ),
              description: pickText(
                {
                  ar: 'لا توجد بلاغات تشغيلية عاجلة اليوم. مواعيد العمل الاعتيادية من 07:30 إلى 17:30.',
                  fr: 'Aucune alerte opérationnelle urgente aujourd’hui. Horaires de service habituels : 07h30 – 17h30.',
                  en: 'No urgent operational alerts today. Standard campus service hours: 07:30 – 17:30.',
                },
                language,
              ),
            })
          }
        />

        <HomeShortcutCard
          id="staff-school-calendar"
          title={pickText(
            { ar: 'الروزنامة المدرسية', fr: 'Calendrier scolaire', en: 'School Calendar' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📅"
          tone="yellow"
          onClick={() =>
            setSelectedNotice({
              title: pickText(
                { ar: 'الروزنامة التشغيلية للمدرسة', fr: 'Calendrier opérationnel', en: 'Operational School Calendar' },
                language,
              ),
              description: pickText(
                {
                  ar: 'تُعرض هنا مواعيد الأنشطة المدرسية والعطل الرسمية المعتمدة لأعوان المدرسة.',
                  fr: 'Consultez ici les dates des événements scolaires et jours fériés pour l’organisation des services.',
                  en: 'Operational school event dates and campus schedules for support teams.',
                },
                language,
              ),
            })
          }
        />

        <HomeShortcutCard
          id="staff-food-menu"
          title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu' }, language)}
          actionLabel={openActionLabel}
          icon="🍽️"
          tone="green"
          onClick={() => setActiveTab('foodMenu')}
        />

        <HomeShortcutCard
          id="staff-teachers-directory"
          title={pickText({ ar: 'المربون', fr: 'Enseignants', en: 'Teachers' }, language)}
          actionLabel={openActionLabel}
          icon="👩‍🏫"
          tone="purple"
          onClick={() => openDirectorySubTab('teachers')}
        />

        <HomeShortcutCard
          id="staff-administration-directory"
          title={pickText({ ar: 'الإدارة', fr: 'Administration', en: 'Administration' }, language)}
          actionLabel={openActionLabel}
          icon="🏛️"
          tone="slate"
          onClick={() => openDirectorySubTab('admin')}
        />

        <HomeShortcutCard
          id="staff-my-tasks"
          title={pickText(
            { ar: 'مهامي والطلبات', fr: 'Mes tâches & Demandes', en: 'My Tasks / Requests' },
            language,
          )}
          actionLabel={comingSoonLabel}
          statusBadge={comingSoonLabel}
          state="COMING_SOON"
          icon="🛠️"
          tone="orange"
          onClick={() =>
            setSelectedNotice({
              title: pickText(
                { ar: 'مهامي وطلبات الصيانة', fr: 'Mes tâches & Demandes', en: 'My Tasks / Service Requests' },
                language,
              ),
              description: pickText(
                {
                  ar: 'وحدة مهام الأعوان وطلبات الصيانة قيد الربط مع الخادم (Coming Soon).',
                  fr: 'Le suivi des tâches opérationnelles sera activé avec le contrat serveur dédié.',
                  en: 'Operational task assignment and facility ticket persistence is marked Coming Soon pending backend tables.',
                },
                language,
              ),
            })
          }
        />
      </HomeCardGrid>

      {/* Capability-gated operational service modules (Section 9.3) */}
      <HomeSection
        title={pickText(
          {
            ar: 'الوحدات الميدانية حسب التكليف',
            fr: 'Services opérationnels par habilitation',
            en: 'Assigned Operational Modules',
          },
          language,
        )}
        subtitle={pickText(
          {
            ar: 'تُفتح وحدات الاستلام أو المطعم أو المرافق حسب الصلاحيات المسندة لحسابك.',
            fr: 'Modules activés selon les habilitations attribuées à votre poste.',
            en: 'Modules unlocked according to your staff assignment and server capabilities.',
          },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="School staff capability modules">
          {hasPickupCapability && (
            <HomeShortcutCard
              id="staff-pickup-desk"
              title={pickText(
                { ar: 'مكتب الاستلام المدرسي', fr: 'Poste de sortie (Pickup)', en: 'Pickup Desk' },
                language,
              )}
              actionLabel={openActionLabel}
              icon="🚸"
              tone="teal"
              onClick={() => setActiveTab('pickup')}
            />
          )}

          <HomeShortcutCard
            id="staff-cafeteria"
            title={pickText(
              { ar: 'المطعم المدرسي', fr: 'Service Cantine', en: 'Cafeteria' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🥗"
            tone="green"
            onClick={() => setActiveTab('foodMenu')}
          />

          <HomeShortcutCard
            id="staff-facilities"
            title={pickText(
              { ar: 'المرافق والصيانة', fr: 'Locaux & Maintenance', en: 'Facilities' },
              language,
            )}
            actionLabel={comingSoonLabel}
            statusBadge={comingSoonLabel}
            state="COMING_SOON"
            icon="🧰"
            tone="orange"
            onClick={() =>
              setSelectedNotice({
                title: pickText({ ar: 'المرافق والصيانة', fr: 'Locaux & Maintenance', en: 'Facilities' }, language),
                description: pickText(
                  {
                    ar: 'وحدة صيانة المرافق المدرسية ستتوفر قريباً.',
                    fr: 'Le module de maintenance des locaux sera bientôt disponible.',
                    en: 'Facilities maintenance reporting is marked Coming Soon.',
                  },
                  language,
                ),
              })
            }
          />

          <HomeShortcutCard
            id="staff-library-transport"
            title={pickText(
              { ar: 'المكتبة والنقل والأمن', fr: 'Bibliothèque, Transport & Sécurité', en: 'Library / Transport / Security' },
              language,
            )}
            actionLabel={comingSoonLabel}
            statusBadge={comingSoonLabel}
            state="COMING_SOON"
            icon="🚌"
            tone="slate"
            onClick={() =>
              setSelectedNotice({
                title: pickText(
                  { ar: 'خدمات المكتبة والنقل والأمن', fr: 'Services Bibliothèque, Transport & Sécurité', en: 'Library, Transport & Security Desk' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'هذه الوحدات الميدانية قيد الإعداد ولا تقوم بأي تعديل وهمي للبيانات.',
                    fr: 'Ces modules spécialisés sont en préparation (aucune fausse écriture locale).',
                    en: 'Specialized support desk modules are marked Coming Soon with no fake local mutations.',
                  },
                  language,
                ),
              })
            }
          />
        </HomeCardGrid>
      </HomeSection>
    </div>
  );
};
