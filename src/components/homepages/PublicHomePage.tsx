import React, { useRef } from 'react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Images,
  Megaphone,
  UsersRound,
  Utensils,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { canAccessAppTab } from './homepageAccess';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import '../views/KristouHome.css';

export interface PublicHomePageProps {
  setActiveTab: (tab: string) => void;
  onOpenAuth: (mode?: 'signin' | 'register') => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
}

const ASSET = '/assets/kristou-home/';

const PUBLIC_CAMPUS_PHOTOS = [
  `${ASSET}school-building.png`,
  `${ASSET}hero-schoolchildren.png`,
  `${ASSET}enrollment-children.png`,
  `${ASSET}canteen-meal.png`,
  `${ASSET}announcement-school.png`,
  `${ASSET}announcement-bardo.png`,
];

export const PublicHomePage: React.FC<PublicHomePageProps> = ({
  setActiveTab,
  onOpenAuth,
  onNavigateToSubTab,
}) => {
  const { language, t, announcements, foodMenu, currentUser } = useApp();
  const exploreSectionRef = useRef<HTMLDivElement | null>(null);
  const levelsSectionRef = useRef<HTMLDivElement | null>(null);
  const activitiesSectionRef = useRef<HTMLDivElement | null>(null);
  const gallerySectionRef = useRef<HTMLDivElement | null>(null);
  const announcementsSectionRef = useRef<HTMLDivElement | null>(null);
  const contactSectionRef = useRef<HTMLDivElement | null>(null);

  // Strict privacy filter: only school-wide public announcements (no classId)
  const publicAnnouncements = announcements.filter((a) => !a.classId);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openTeachers = () => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('directory', 'teachers');
    } else {
      setActiveTab('directory');
    }
  };

  const openAdministration = () => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('directory', 'admin');
    } else {
      setActiveTab('directory');
    }
  };

  const openPrivateCommunityShortcut = (subTab: 'homework' | 'announcements') => {
    if (canAccessAppTab(currentUser, 'community')) {
      if (onNavigateToSubTab) {
        onNavigateToSubTab('community', subTab);
      } else {
        setActiveTab('community');
      }
    } else {
      onOpenAuth('signin');
    }
  };

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

  const levelLabels = [
    [t('levelCp'), t('level1')],
    [t('levelCe1'), t('level2')],
    [t('levelCe2'), t('level3')],
    [t('levelCm1'), t('level4')],
    [t('levelCm2'), t('level5')],
    [t('levelSix'), t('level6')],
  ] as const;
  const levelColors = ['#d8f0ff', '#d4f7eb', '#ffeab5', '#ffdfd2', '#e8dcff', '#ffdfe8'];
  const levelInk = ['#15539d', '#007965', '#815008', '#8a542e', '#4b35a3', '#a92b5a'];

  return (
    <div className="kh-role-page" data-testid="homepage-PUBLIC_HOME">
      {/* 1. RESTORED ORIGINAL KRISTOU PUBLIC HOMEPAGE (IMAGE 1 SOURCE OF TRUTH) */}
      <section className="kr-home" aria-label={t('home')} data-testid="original-kristou-homepage">
        <div className="kr-hero">
          <div className="kr-hero-copy">
            <div className="kr-eyebrow">{t('heroSchoolType')}</div>
            <h1>
              Kristou <strong>School</strong>
            </h1>
            <p>{t('heroDescription')}</p>
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

        <div className="kr-info-grid">
          <section className="kr-panel">
            <div className="kr-panel-head">
              <h2>
                <Bell size={20} color="#119fff" /> {t('featuredTitle')}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="kr-chip" data-testid="announcements-preview-badge">
                  {t('demoPreview')}
                </span>
                <button
                  type="button"
                  className="kr-link"
                  onClick={() => scrollToRef(announcementsSectionRef)}
                >
                  {t('featuredLink')} →
                </button>
              </div>
            </div>
            {publicAnnouncements.length ? (
              publicAnnouncements.slice(0, 2).map((ann, index) => (
                <article className="kr-announcement" key={ann.id}>
                  <img
                    src={`${ASSET}${index === 0 ? 'announcement-school' : 'announcement-bardo'}.png`}
                    alt={t('announcementImageAlt')}
                  />
                  <div>
                    {ann.priority === 'URGENT' && (
                      <span className="kr-urgent">{t('urgent')}</span>
                    )}
                    <h3>{ann.title}</h3>
                    <time dateTime={ann.createdAt}>
                      {new Date(ann.createdAt).toLocaleDateString()} • {t('demoPreview')}
                    </time>
                    <p>{ann.body}</p>
                  </div>
                </article>
              ))
            ) : (
              <p>{t('noItems')}</p>
            )}
          </section>

          <section className="kr-panel kr-canteen">
            <div className="kr-panel-head">
              <h2>
                <Utensils color="#f6a400" size={20} /> {t('canteenTitle')}
              </h2>
              <span className="kr-chip">{t('canteenBrand')}</span>
            </div>
            <p className="kr-week" data-testid="canteen-preview-badge">
              {foodMenu.weekRange} • {t('demoPreview')}
            </p>
            <div className="kr-meals">
              <img src={`${ASSET}canteen-meal.png`} alt={t('canteenImageAlt')} />
              <div>
                {foodMenu.items.slice(0, 5).map((item, index) => (
                  <div className="kr-meal" key={`${item.day}-${index}`}>
                    <b>{item.day}</b>
                    <span>{item.main}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="kr-meal-action"
              onClick={() => setActiveTab('foodMenu')}
            >
              {t('fullMenu')} →
            </button>
          </section>

          <section className="kr-panel kr-kids">
            <div className="kr-panel-head">
              <h2>
                <UsersRound size={21} color="#00a595" /> {t('familySpace')}
              </h2>
            </div>
            <p>{t('familySpaceBody')}</p>
            <div className="kr-actions" style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="kr-btn"
                onClick={() => setActiveTab('registration')}
              >
                {t('registration')} →
              </button>
              {!currentUser && (
                <button
                  type="button"
                  className="kr-btn ghost"
                  onClick={() => onOpenAuth('signin')}
                >
                  {t('login')}
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="kr-lower">
          <div className="kr-campus">
            <img src={`${ASSET}school-building.png`} alt={t('schoolBuildingAlt')} />
            <button
              type="button"
              className="kr-video"
              onClick={() => setActiveTab('directory')}
            >
              {t('discoverSchool')} →
            </button>
          </div>

          <section className="kr-levels">
            <h2>
              <GraduationCap
                size={23}
                color="#009d92"
                style={{ display: 'inline', verticalAlign: 'middle' }}
              />{' '}
              {t('levelsTitle')}
            </h2>
            <p>{t('levelsBody')}</p>
            <div className="kr-level-row">
              {levelLabels.map(([name, desc], index) => (
                <div
                  className="kr-level"
                  key={name}
                  style={
                    {
                      '--lvbg': levelColors[index],
                      '--lvink': levelInk[index],
                    } as React.CSSProperties
                  }
                >
                  {name}
                  <small>{desc}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="kr-enroll">
            <img src={`${ASSET}enrollment-children.png`} alt={t('enrollmentImageAlt')} />
            <div>
              <h2>{t('enrollmentTitle')}</h2>
              <button
                type="button"
                className="kr-btn"
                onClick={() => setActiveTab('registration')}
              >
                {t('heroSecondary')} →
              </button>
            </div>
          </section>
        </div>

        <div className="kr-foot-stripe">
          <div>🎓 &nbsp; {t('featureQualified')}</div>
          <div>📊 &nbsp; {t('featureTracking')}</div>
          <div>🎨 &nbsp; {t('featureActivities')}</div>
          <div>🛡️ &nbsp; {t('featureSafe')}</div>
        </div>
      </section>

      {/* 2. SECONDARY SUPPORTING CONTENT (IMAGE 2 ADDITIONS MOVED LOWER) */}
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

        {/* Two clean public overview panels */}
        <div className="kh-info-panels">
          <article className="kh-info-panel">
            <div className="space-y-2">
              <h2 className="kh-info-panel-title">
                {pickText(
                  {
                    ar: 'حول مدرسة كريستو (KRISTOU)',
                    fr: 'À propos de KRISTOU',
                    en: 'About KRISTOU',
                  },
                  language,
                )}
              </h2>
              <p className="kh-info-panel-body">
                {pickText(
                  {
                    ar: 'تجدون هنا التقديم المعتمد للمدرسة، مقاربتنا التربوية، ومعلومات التواصل العامة لمدرسة كريستو في تونس. يتم نشر المعطيات العامة كمحتوى مدرسي معتمد دون كشف أي بيانات خاصة بالتلاميذ.',
                    fr: 'Présentation approuvée par l’école, approche pédagogique et informations de contact générales figurent ici. Les données publiques sont gérées indépendamment des dossiers privés des élèves.',
                    en: 'School-approved introduction, educational approach and contact information live here. Public facts are maintained as school content rather than inferred from private data.',
                  },
                  language,
                )}
              </p>
            </div>
          </article>

          <article className="kh-info-panel">
            <div className="space-y-2">
              <h2 className="kh-info-panel-title">
                {pickText(
                  {
                    ar: 'أحدث إعلان عام',
                    fr: 'Dernière annonce publique',
                    en: 'Latest announcement',
                  },
                  language,
                )}
              </h2>
              <p className="kh-info-panel-body">
                {pickText(
                  {
                    ar: 'معلومات التسجيل للسنة الدراسية والأنشطة المدرسية العامة القادمة تُعرض هنا للعموم.',
                    fr: 'Les informations d’inscription et la prochaine activité publique de l’école sont mises en avant ici.',
                    en: 'Registration information and the next public school activity can be highlighted here.',
                  },
                  language,
                )}
              </p>
            </div>
            <span className="kh-info-chip">
              {pickText({ ar: 'عام', fr: 'Public', en: 'Public' }, language)}
            </span>
          </article>
        </div>

        {/* Supporting Explore Kristou Public Service Card Grid */}
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

      {/* Public Educational Levels Overview using approved translations.ts copy */}
      <div ref={levelsSectionRef}>
        <HomeSection
          title={t('levelsTitle')}
          subtitle={t('levelsBody')}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { code: 'CP', label: t('level1') },
              { code: 'CE1', label: t('level2') },
              { code: 'CE2', label: t('level3') },
              { code: 'CM1', label: t('level4') },
              { code: 'CM2', label: t('level5') },
              { code: '6ème', label: t('level6') },
            ].map((lvl) => (
              <div key={lvl.code} className="kh-info-panel">
                <span className="kh-info-chip">{lvl.code}</span>
                <h3 className="kh-info-panel-title text-sm sm:text-base mt-1">
                  {lvl.label}
                </h3>
              </div>
            ))}
          </div>
        </HomeSection>
      </div>

      {/* Public School Pillars & Activities Overview using approved translations.ts copy */}
      <div ref={activitiesSectionRef}>
        <HomeSection
          title={pickText(
            {
              ar: 'ركائز المدرسة والأنشطة التربوية',
              fr: 'Piliers éducatifs & Vie scolaire',
              en: 'Educational Pillars & School Life',
            },
            language,
          )}
          subtitle={t('heroDescription')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                icon: '👩‍🏫',
                title: t('featureQualified'),
                body: t('directoryDescription'),
              },
              {
                icon: '📚',
                title: t('featureTracking'),
                body: t('growthBody'),
              },
              {
                icon: '🎨',
                title: t('featureActivities'),
                body: t('creativityBody'),
              },
              {
                icon: '🛡️',
                title: t('featureSafe'),
                body: t('storyBody'),
              },
            ].map((pillar, idx) => (
              <div key={idx} className="kh-info-panel">
                <span className="text-2xl">{pillar.icon}</span>
                <h3 className="kh-info-panel-title text-sm sm:text-base mt-1">
                  {pillar.title}
                </h3>
                <p className="kh-info-panel-body mt-1">{pillar.body}</p>
              </div>
            ))}
          </div>
        </HomeSection>
      </div>

      {/* Public Approved Gallery */}
      <div ref={gallerySectionRef}>
        <HomeSection
          title={pickText(
            {
              ar: 'المعرض العام لمدرسة كريستو',
              fr: 'Galerie publique du campus KRISTOU',
              en: 'KRISTOU Campus Public Gallery',
            },
            language,
          )}
          subtitle={pickText(
            {
              ar: 'صور معتمدة من فضاءات المدرسة والأنشطة العامة.',
              fr: 'Photos officielles approuvées du campus et de la vie scolaire.',
              en: 'School-approved campus and public activity media only.',
            },
            language,
          )}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PUBLIC_CAMPUS_PHOTOS.map((src, index) => (
              <div
                key={src}
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 aspect-[4/3] bg-slate-100 dark:bg-zinc-900"
              >
                <img
                  src={src}
                  alt={`KRISTOU School campus ${index + 1}`}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </HomeSection>
      </div>

      {/* Public School-Wide Announcements */}
      <div ref={announcementsSectionRef}>
        <HomeSection
          title={pickText(
            {
              ar: 'البلاغات المدرسية العامة',
              fr: 'Annonces officielles de l’école',
              en: 'Public School Announcements',
            },
            language,
          )}
          subtitle={t('demoPreview')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {publicAnnouncements.map((item) => (
              <article key={item.id} className="kh-info-panel">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="kh-info-chip">
                      {item.createdAt} • {t('demoPreview')}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{item.authorName}</span>
                  </div>
                  <h3 className="kh-info-panel-title">{item.title}</h3>
                  <p className="kh-info-panel-body">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </HomeSection>
      </div>

      {/* Public Contact & Location — using approved location and neutral verification notice */}
      <div ref={contactSectionRef}>
        <HomeSection
          title={pickText(
            {
              ar: `معلومات الاتصال — ${t('school')}`,
              fr: `Coordonnées — ${t('school')}`,
              en: `Contact & Location — ${t('school')}`,
            },
            language,
          )}
        >
          <div className="kh-info-panel">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <strong className="block text-[#1E3A6D] dark:text-white mb-1">
                  📍 {pickText({ ar: 'الموقع', fr: 'Localisation', en: 'Location' }, language)}
                </strong>
                <span className="kh-info-panel-body">
                  {t('school')} — {t('tunis')}
                </span>
              </div>
              <div>
                <strong className="block text-[#1E3A6D] dark:text-white mb-1">
                  📞 {pickText({ ar: 'الاستقبال والإدارة', fr: 'Accueil & Secrétariat', en: 'Reception & Office' }, language)}
                </strong>
                <span className="kh-info-panel-body">
                  {pickText(
                    {
                      ar: 'بيانات الهاتف والعنوان التفصيلي تُنشر بعد التحديث الرسمي من إدارة المدرسة.',
                      fr: 'Les coordonnées téléphoniques et l’adresse précise sont publiées après validation officielle par la direction.',
                      en: 'Official street address and reception telephone details are published upon school administration verification.',
                    },
                    language,
                  )}
                </span>
              </div>
              <div>
                <strong className="block text-[#1E3A6D] dark:text-white mb-1">
                  📋 {pickText({ ar: 'القبول والتسجيل', fr: 'Inscriptions', en: 'Admissions' }, language)}
                </strong>
                <span className="kh-info-panel-body">
                  {t('enrollmentTitle')}
                </span>
              </div>
            </div>
          </div>
        </HomeSection>
      </div>
      </div>
    </div>
  );
};
