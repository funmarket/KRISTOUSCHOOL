import React from 'react';
import {
  BookOpen,
  CalendarDays,
  Images,
  Megaphone,
  UsersRound,
  Utensils,
} from 'lucide-react';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import { PublicFeaturedAndCanteenPanels } from './public-home/PublicFeaturedAndCanteenPanels';
import { PublicInquiryContactSection } from './public-home/PublicInquiryContactSection';
import { PublicSchoolContentSections } from './public-home/PublicSchoolContentSections';
import { ASSET, usePublicHomePage } from './public-home/usePublicHomePage';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import '../views/KristouHome.css';

export interface PublicHomePageProps {
  setActiveTab: (tab: string) => void;
  onOpenAuth: (mode?: 'signin' | 'register') => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
}

export const PublicHomePage: React.FC<PublicHomePageProps> = ({
  setActiveTab,
  onOpenAuth,
  onNavigateToSubTab,
}) => {
  const {
    language,
    t,
    currentUser,
    refreshSchoolData,
    broadcastsStatus,
    broadcastsError,
    broadcastsHasError,
    publicAnnouncements,
    isAnnouncementsDemo,
    foodMenu,
    foodMenuError,
    foodMenuHasError,
    isMenuDemo,
    publicContentStatus,
    publicContentError,
    publicContentHasError,
    canManagePublicContent,
    publishedCmsSlugs,
    pickPublicEntry,
    inquiryForm,
    setInquiryForm,
    inquirySubmitting,
    inquiryFeedback,
    handleInquirySubmit,
    exploreSectionRef,
    levelsSectionRef,
    activitiesSectionRef,
    gallerySectionRef,
    announcementsSectionRef,
    contactSectionRef,
    scrollToRef,
    openTeachers,
    openAdministration,
    openPrivateCommunityShortcut,
  } = usePublicHomePage({
    setActiveTab,
    onOpenAuth,
    onNavigateToSubTab,
  });

  const schoolWidePublicAnnouncements = publicAnnouncements.filter((a) => !a.classId);

  const shortcuts = [
    {
      title: t('schedule'),
      subtitle: t('scheduleHint'),
      icon: CalendarDays,
      shade: '#dff4ff',
      color: '#159af4',
      onClick: undefined,
    },
    {
      title: t('homework'),
      subtitle: t('homeworkHint'),
      icon: BookOpen,
      shade: '#f1e4ff',
      color: '#9234f0',
      onClick: () => openPrivateCommunityShortcut('homework'),
    },
    {
      title: t('foodMenu'),
      subtitle: t('menuHint'),
      icon: Utensils,
      shade: '#fff2d0',
      color: '#f8ae08',
      onClick: () => setActiveTab('foodMenu'),
    },
    {
      title: t('classCommunity'),
      subtitle: t('communityHint'),
      icon: UsersRound,
      shade: '#dff9e9',
      color: '#09ab7d',
      onClick: () => openPrivateCommunityShortcut('announcements'),
    },
    {
      title: t('gallery'),
      subtitle: t('galleryHint'),
      icon: Images,
      shade: '#ffe8ef',
      color: '#ff496d',
      onClick: () => scrollToRef(gallerySectionRef),
    },
    {
      title: t('announcements'),
      subtitle: t('announcementsHint'),
      icon: Megaphone,
      shade: '#dff4ff',
      color: '#1699df',
      onClick: () => scrollToRef(announcementsSectionRef),
    },
  ] as const;

  const announcementsPreviewBadge = (
    <span className="kr-chip" data-testid="announcements-preview-badge">
      {broadcastsHasError
        ? t('error')
        : isAnnouncementsDemo
        ? t('demoPreview')
        : pickText({ ar: 'منشور', fr: 'Publié', en: 'Published' }, language)}
    </span>
  );

  const canteenPreviewBadge = (
    <p className="kr-week" data-testid="canteen-preview-badge">
      {foodMenu.weekRange}
      {isMenuDemo ? ` • ${t('demoPreview')}` : ''}
    </p>
  );

  const serviceCardsGrid = (
    <HomeCardGrid ariaLabel="Public school services">
      <HomeShortcutCard
        id="public-teachers"
        title={pickText({ ar: 'المربون', fr: 'Enseignants', en: 'Teachers' }, language)}
        actionLabel={pickText(
          {
            ar: 'ملفات تعريف معتمدة',
            fr: 'Profils approuvés par l’école',
            en: 'School-approved profiles',
          },
          language,
        )}
        icon="👩‍🏫"
        tone="blue"
        onClick={openTeachers}
      />

      <HomeShortcutCard
        id="public-food-menu"
        title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu' }, language)}
        actionLabel="La Toque Gourmande"
        icon="🍽️"
        tone="green"
        onClick={() => setActiveTab('foodMenu')}
      />

      <HomeShortcutCard
        id="public-administration"
        title={pickText({ ar: 'الإدارة', fr: 'Administration', en: 'Administration' }, language)}
        actionLabel={pickText(
          { ar: 'الهيئة الإدارية', fr: 'Direction de l’école', en: 'School Board' },
          language,
        )}
        icon="🏛️"
        tone="purple"
        onClick={openAdministration}
      />

      <HomeShortcutCard
        id="public-admissions"
        title={pickText(
          { ar: 'القبول والتسجيل', fr: 'Admissions', en: 'Admissions' },
          language,
        )}
        actionLabel={pickText(
          { ar: 'بوابة التسجيل', fr: 'Entrée des demandes', en: 'Application entry' },
          language,
        )}
        icon="📋"
        tone="orange"
        onClick={() => setActiveTab('registration')}
      />

      <HomeShortcutCard
        id="public-levels-classes"
        title={pickText(
          { ar: 'المستويات والأقسام', fr: 'Niveaux & Classes', en: 'Levels & Classes' },
          language,
        )}
        actionLabel={pickText(
          {
            ar: 'السنة الأولى إلى السادسة ابتدائي',
            fr: 'De la 1ère à la 6ème année',
            en: 'Year 1 through Year 6',
          },
          language,
        )}
        icon="🎓"
        tone="teal"
        onClick={() => scrollToRef(levelsSectionRef)}
      />

      <HomeShortcutCard
        id="public-activities-clubs"
        title={pickText(
          { ar: 'الأنشطة والنوادي', fr: 'Activités & Clubs', en: 'Activities & Clubs' },
          language,
        )}
        actionLabel={pickText(
          { ar: 'الحياة المدرسية', fr: 'Vie scolaire', en: 'School life' },
          language,
        )}
        icon="🎨"
        tone="yellow"
        onClick={() => scrollToRef(activitiesSectionRef)}
      />

      <HomeShortcutCard
        id="public-gallery"
        title={pickText(
          { ar: 'المعرض العام', fr: 'Galerie publique', en: 'Public Gallery' },
          language,
        )}
        actionLabel={pickText(
          {
            ar: 'صور معتمدة فقط',
            fr: 'Médias approuvés uniquement',
            en: 'Approved media only',
          },
          language,
        )}
        icon="🖼️"
        tone="slate"
        onClick={() => scrollToRef(gallerySectionRef)}
      />

      <HomeShortcutCard
        id="public-apply-register"
        title={pickText(
          { ar: 'قدّم طلب تسجيل', fr: 'Postuler / S’inscrire', en: 'Apply / Register' },
          language,
        )}
        actionLabel={pickText(
          { ar: 'ابدأ ملف التسجيل', fr: 'Démarrer un dossier', en: 'Start an application' },
          language,
        )}
        icon="✨"
        tone="red"
        onClick={() => setActiveTab('registration')}
      />

      <HomeShortcutCard
        id="public-announcements"
        title={pickText(
          { ar: 'البلاغات العامة', fr: 'Annonces publiques', en: 'Announcements' },
          language,
        )}
        actionLabel={pickText(
          { ar: 'أخبار المدرسة', fr: 'Actualités de l’école', en: 'Public school notices' },
          language,
        )}
        icon="📢"
        tone="blue"
        onClick={() => scrollToRef(announcementsSectionRef)}
      />

      <HomeShortcutCard
        id="public-contact"
        title={pickText(
          { ar: 'الاتصال والموقع', fr: 'Contact & Accès', en: 'Contact' },
          language,
        )}
        actionLabel={t('tunis')}
        icon="📍"
        tone="teal"
        onClick={() => scrollToRef(contactSectionRef)}
      />
    </HomeCardGrid>
  );

  return (
    <div className="kh-role-page" data-testid="homepage-PUBLIC_HOME">
      <section className="kr-home" aria-label={t('home')} data-testid="original-kristou-homepage">
        <div className="kr-hero">
          <div className="kr-hero-copy">
            <div className="kr-eyebrow">{t('heroSchoolType')}</div>
            <h1>
              Kristou <strong>School</strong>
            </h1>
            <p>{pickPublicEntry('hero', 'body') ?? t('heroDescription')}</p>
            <div className="kr-actions">
              <button
                type="button"
                className="kr-btn"
                onClick={() => setActiveTab('registration')}
              >
                {t('heroSecondary')} <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                className="kr-btn ghost"
                onClick={() => setActiveTab('directory')}
              >
                {t('discoverTeam')} <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
          <img
            className="kr-hero-photo"
            src={`${ASSET}hero-schoolchildren.png`}
            alt={t('heroImageAlt')}
          />
        </div>

        <div className="kr-shortcuts" aria-label={t('quickTitle')}>
          {shortcuts.map(({ title, subtitle, icon: Icon, shade, color, onClick }) => (
            <button
              className="kr-shortcut"
              type="button"
              key={title}
              disabled={!onClick}
              title={onClick ? undefined : t('comingSoon')}
              onClick={onClick}
            >
              <span
                className="ico"
                style={{ '--shade': shade, '--accent': color } as React.CSSProperties}
              >
                <Icon size={23} strokeWidth={2.5} />
              </span>
              <strong>{title}</strong>
              <small>{subtitle}</small>
              {!onClick && <em>{t('comingSoon')}</em>}
            </button>
          ))}
        </div>

        <PublicFeaturedAndCanteenPanels
          language={language}
          t={t}
          currentUser={currentUser}
          broadcastsHasError={broadcastsHasError}
          broadcastsError={broadcastsError}
          publicAnnouncements={schoolWidePublicAnnouncements}
          foodMenu={foodMenu}
          foodMenuHasError={foodMenuHasError}
          foodMenuError={foodMenuError}
          announcementsPreviewBadge={announcementsPreviewBadge}
          canteenPreviewBadge={canteenPreviewBadge}
          refreshSchoolData={refreshSchoolData}
          setActiveTab={setActiveTab}
          onOpenAuth={onOpenAuth}
          onScrollToAnnouncements={() => scrollToRef(announcementsSectionRef)}
        />
      </section>

      <div
        ref={exploreSectionRef}
        className="kr-secondary-divider"
        data-testid="public-secondary-content"
      >
        <HomePageHeader
          badgeText={pickText(HOMEPAGE_BADGE_LABELS.PUBLIC_HOME, language)}
          title={pickText(HOMEPAGE_COMMON_TEXT.publicHeadline, language)}
          subtitle={pickText(HOMEPAGE_COMMON_TEXT.publicSubtitle, language)}
        >
          {!currentUser && (
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className="rounded-xl bg-[#1E3A6D] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-[#162C54] transition-colors"
              >
                {t('login')}
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="rounded-xl border border-[#0D8AE8] bg-[#0D8AE8]/10 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#0D8AE8] hover:bg-[#0D8AE8]/20 transition-colors"
              >
                {pickText(
                  {
                    ar: 'إنشاء حساب / طلب انضمام',
                    fr: 'Créer un compte / Postuler',
                    en: 'Create Account / Apply',
                  },
                  language,
                )}
              </button>
            </div>
          )}
        </HomePageHeader>

        <PublicSchoolContentSections
          language={language}
          t={t}
          publicContentStatus={publicContentStatus}
          publicContentError={publicContentError}
          publicContentHasError={publicContentHasError}
          canManagePublicContent={canManagePublicContent}
          publishedCmsSlugs={publishedCmsSlugs}
          broadcastsStatus={broadcastsStatus}
          broadcastsHasError={broadcastsHasError}
          isAnnouncementsDemo={isAnnouncementsDemo}
          publicAnnouncements={schoolWidePublicAnnouncements}
          pickPublicEntry={pickPublicEntry}
          refreshSchoolData={refreshSchoolData}
          levelsSectionRef={levelsSectionRef}
          activitiesSectionRef={activitiesSectionRef}
          gallerySectionRef={gallerySectionRef}
          announcementsSectionRef={announcementsSectionRef}
          serviceCardsGrid={serviceCardsGrid}
        />

        <PublicInquiryContactSection
          language={language}
          t={t}
          contactSectionRef={contactSectionRef}
          pickPublicEntry={pickPublicEntry}
          inquiryForm={inquiryForm}
          setInquiryForm={setInquiryForm}
          inquirySubmitting={inquirySubmitting}
          inquiryFeedback={inquiryFeedback}
          handleInquirySubmit={handleInquirySubmit}
        />
      </div>
    </div>
  );
};
