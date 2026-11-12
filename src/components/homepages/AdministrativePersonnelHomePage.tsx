import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export interface AdministrativePersonnelHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
}

export const AdministrativePersonnelHomePage: React.FC<
  AdministrativePersonnelHomePageProps
> = ({ setActiveTab, onNavigateToSubTab }) => {
  const { language, currentUser } = useApp();
  const [selectedOfficeFeature, setSelectedOfficeFeature] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const capabilities = Array.isArray(currentUser?.capabilities) ? currentUser.capabilities : [];
  const hasPickupAssist =
    capabilities.includes('PICKUP_RELEASE') || capabilities.includes('PICKUP_DESK');

  const openCommunitySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('community', subTab);
    } else {
      setActiveTab('community');
    }
  };

  const openActionLabel = pickText(HOMEPAGE_COMMON_TEXT.openAction, language);
  const comingSoonLabel = pickText(HOMEPAGE_COMMON_TEXT.comingSoonBadge, language);

  return (
    <div className="kh-role-page" data-testid="homepage-ADMINISTRATIVE_PERSONNEL_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.ADMINISTRATIVE_PERSONNEL_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={pickText(
          {
            ar: 'مكتب الإدارة المدرسية لمتابعة ملفات التسجيل، استفسارات العائلات، الوثائق، والروزنامة الإدارية.',
            fr: 'Espace secrétariat et administration : dossiers d’admission, demandes des familles, documents et calendrier.',
            en: 'School office administration workspace for admissions intake, family inquiries, documents, and notices.',
          },
          language,
        )}
      />

      {selectedOfficeFeature && (
        <EmptyFeatureState
          state="COMING_SOON"
          title={selectedOfficeFeature.title}
          description={selectedOfficeFeature.description}
          onClose={() => setSelectedOfficeFeature(null)}
        />
      )}

      {/* 8 Required Administrative Office Cards (Section 10.2) — strictly separated from Owner/Manager governance */}
      <HomeCardGrid ariaLabel="Administrative personnel cards">
        <HomeShortcutCard
          id="admin-personnel-office-desk"
          title={pickText(
            { ar: 'مكتب الاستقبال والإدارة', fr: 'Bureau d’accueil', en: 'Office Desk' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="🗂️"
          tone="slate"
          onClick={() =>
            setSelectedOfficeFeature({
              title: pickText(
                { ar: 'مكتب الاستقبال والإدارة', fr: 'Bureau d’accueil administratif', en: 'Administrative Office Desk' },
                language,
              ),
              description: pickText(
                {
                  ar: 'يتيح مكتب الاستقبال متابعة المراجعات اليومية وتوجيه الأولياء دون صلاحيات مالك المدرسة.',
                  fr: 'Suivi de l’accueil quotidien et orientation des familles (sans privilèges de gouvernance propriétaire).',
                  en: 'Daily front-office intake and reception overview (strictly separated from Owner/Manager governance).',
                },
                language,
              ),
            })
          }
        />

        <HomeShortcutCard
          id="admin-personnel-admission-files"
          title={pickText(
            { ar: 'ملفات القبول والتسجيل', fr: 'Dossiers d’admission', en: 'Admission Files' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📋"
          tone="orange"
          onClick={() => setActiveTab('registration')}
        />

        <HomeShortcutCard
          id="admin-personnel-family-inquiries"
          title={pickText(
            { ar: 'استفسارات العائلات', fr: 'Demandes des familles', en: 'Family Inquiries' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="✉️"
          tone="purple"
          onClick={() => setActiveTab('notes')}
        />

        <HomeShortcutCard
          id="admin-personnel-attendance"
          title={pickText(
            { ar: 'متابعة الحضور', fr: 'Suivi des présences', en: 'Attendance' },
            language,
          )}
          actionLabel={comingSoonLabel}
          statusBadge={comingSoonLabel}
          state="COMING_SOON"
          icon="📅"
          tone="green"
          onClick={() =>
            setSelectedOfficeFeature({
              title: pickText(
                { ar: 'سجل الحضور الإداري', fr: 'Registre administratif des présences', en: 'Administrative Attendance Log' },
                language,
              ),
              description: pickText(
                {
                  ar: 'وحدة المتابعة الإدارية للغيابات والتأخير ستتوفر عند ربط جدول الحضور في الخادم.',
                  fr: 'Le suivi administratif des absences sera activé avec le contrat serveur correspondant.',
                  en: 'Administrative attendance tracking is marked Coming Soon pending backend attendance persistence.',
                },
                language,
              ),
            })
          }
        />

        <HomeShortcutCard
          id="admin-personnel-forms-documents"
          title={pickText(
            { ar: 'الاستمارات والوثائق', fr: 'Formulaires & Documents', en: 'Forms & Documents' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📄"
          tone="blue"
          onClick={() => openCommunitySubTab('documents')}
        />

        <HomeShortcutCard
          id="admin-personnel-school-calendar"
          title={pickText(
            { ar: 'الروزنامة المدرسية', fr: 'Calendrier scolaire', en: 'School Calendar' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="🗓️"
          tone="yellow"
          onClick={() => openCommunitySubTab('calendar')}
        />

        <HomeShortcutCard
          id="admin-personnel-notices"
          title={pickText(
            { ar: 'المذكرات والإعلانات', fr: 'Notes & Annonces', en: 'Notices' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📢"
          tone="red"
          onClick={() => openCommunitySubTab('announcements')}
        />

        <HomeShortcutCard
          id="admin-personnel-work-queue"
          title={pickText(
            { ar: 'قائمة عملي اليومية', fr: 'Ma file de traitement', en: 'My Work Queue' },
            language,
          )}
          actionLabel={comingSoonLabel}
          statusBadge={comingSoonLabel}
          state="COMING_SOON"
          icon="📌"
          tone="teal"
          onClick={() =>
            setSelectedOfficeFeature({
              title: pickText(
                { ar: 'قائمة المعاملات الإدارية', fr: 'Ma file de traitement administratif', en: 'My Administrative Work Queue' },
                language,
              ),
              description: pickText(
                {
                  ar: 'قائمة المعاملات الإدارية المخصصة قيد الربط بالخادم دون أي تعديل محلي وهمي.',
                  fr: 'La file de traitement administratif sera connectée au contrat serveur Supabase.',
                  en: 'Administrative work queue persistence is marked Coming Soon until the backend contract is deployed.',
                },
                language,
              ),
            })
          }
        />

        {hasPickupAssist && (
          <HomeShortcutCard
            id="admin-personnel-pickup-assist"
            title={pickText(
              { ar: 'مساندة الاستلام المدرسي', fr: 'Assistance Sortie', en: 'Pickup Assistance' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🚸"
            tone="green"
            onClick={() => setActiveTab('pickup')}
          />
        )}
      </HomeCardGrid>
    </div>
  );
};
