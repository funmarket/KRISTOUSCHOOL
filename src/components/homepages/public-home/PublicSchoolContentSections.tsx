import React from 'react';
import type { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import type { Announcement, Language } from '../../../types';
import { HomeSection } from '../shared/HomeSection';
import { PUBLIC_CAMPUS_PHOTOS } from './usePublicHomePage';

export interface PublicSchoolContentSectionsProps {
  language: Language;
  t: ReturnType<typeof useApp>['t'];
  publicContentStatus: string;
  publicContentError: string | null;
  publicContentHasError: boolean;
  canManagePublicContent: boolean;
  publishedCmsSlugs: string[];
  broadcastsStatus: string;
  broadcastsHasError: boolean;
  isAnnouncementsDemo: boolean;
  publicAnnouncements: Announcement[];
  pickPublicEntry: (slug: string, field: 'title' | 'body') => string | null;
  refreshSchoolData?: () => Promise<boolean>;
  levelsSectionRef: React.RefObject<HTMLDivElement | null>;
  activitiesSectionRef: React.RefObject<HTMLDivElement | null>;
  gallerySectionRef: React.RefObject<HTMLDivElement | null>;
  announcementsSectionRef: React.RefObject<HTMLDivElement | null>;
  serviceCardsGrid: React.ReactNode;
}

export const PublicSchoolContentSections: React.FC<PublicSchoolContentSectionsProps> = ({
  language,
  t,
  publicContentStatus,
  publicContentError,
  publicContentHasError,
  canManagePublicContent,
  publishedCmsSlugs,
  broadcastsStatus,
  broadcastsHasError,
  isAnnouncementsDemo,
  publicAnnouncements,
  pickPublicEntry,
  refreshSchoolData,
  levelsSectionRef,
  activitiesSectionRef,
  gallerySectionRef,
  announcementsSectionRef,
  serviceCardsGrid,
}) => {
  return (
    <>
      {publicContentHasError && (
        <div
          role="alert"
          data-testid="public-content-error-banner"
          className="mb-4 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-3"
        >
          <span>
            {publicContentError ||
              pickText(
                {
                  ar: 'تعذر تحميل نصوص الموقع العام المعتمدة من الخادم.',
                  fr: 'Impossible de charger le contenu public officiel depuis le serveur.',
                  en: 'Unable to load school-approved public content from server.',
                },
                language,
              )}
          </span>
          {typeof refreshSchoolData === 'function' && (
            <button
              type="button"
              onClick={() => void refreshSchoolData()}
              className="rounded-xl bg-red-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-800 shrink-0"
            >
              {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
            </button>
          )}
        </div>
      )}

      {canManagePublicContent && (
        <div
          data-testid="public-cms-management-banner"
          className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 space-y-1.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="font-extrabold">
              {pickText(
                {
                  ar: 'إدارة المحتوى العام (قراءة فقط)',
                  fr: 'Gestion du contenu public (lecture seule)',
                  en: 'Public Content Management (Read-Only)',
                },
                language,
              )}
            </strong>
            <div className="flex items-center gap-2">
              <span
                data-testid="public-cms-status-badge"
                className="rounded-lg bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-extrabold uppercase"
              >
                {publicContentStatus === 'READY'
                  ? pickText(
                      {
                        ar: `منشور: ${publishedCmsSlugs.length}`,
                        fr: `Publiés : ${publishedCmsSlugs.length}`,
                        en: `Published: ${publishedCmsSlugs.length}`,
                      },
                      language,
                    )
                  : publicContentStatus === 'ERROR'
                  ? pickText(
                      {
                        ar: 'تعذر التحميل',
                        fr: 'Échec du chargement',
                        en: 'Loading Failed',
                      },
                      language,
                    )
                  : publicContentStatus === 'UNAUTHORIZED'
                  ? pickText(
                      {
                        ar: 'غير مصرح',
                        fr: 'Accès refusé',
                        en: 'Access Denied',
                      },
                      language,
                    )
                  : pickText(
                      {
                        ar: 'غير متاح حالياً',
                        fr: 'Service indisponible',
                        en: 'Feature Unavailable',
                      },
                      language,
                    )}
              </span>
              {publicContentStatus === 'ERROR' && typeof refreshSchoolData === 'function' && (
                <button
                  type="button"
                  data-testid="public-cms-retry-btn"
                  onClick={() => void refreshSchoolData()}
                  className="rounded-lg bg-red-700 px-2.5 py-0.5 text-[10px] font-bold text-white hover:bg-red-800"
                >
                  {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] font-medium">
            {publicContentStatus === 'ERROR'
              ? pickText(
                  {
                    ar: 'تعذر تحميل حالة المحتوى العام من الخادم. يمكنك إعادة المحاولة لتحديث العرض.',
                    fr: 'Impossible de charger le contenu public depuis le serveur. Vous pouvez réessayer.',
                    en: 'Could not load public content from the server. Please try again.',
                  },
                  language,
                )
              : publicContentStatus === 'UNAUTHORIZED'
              ? pickText(
                  {
                    ar: 'تم رفض الوصول إلى إعدادات المحتوى العام لهذا الحساب.',
                    fr: 'L’accès au contenu public a été refusé pour ce compte.',
                    en: 'Access to public content management was denied for this account.',
                  },
                  language,
                )
              : publicContentStatus === 'READY'
              ? pickText(
                  {
                    ar: 'نصوص الصفحة الرئيسية معروضة حالياً للقراءة فقط؛ التعديل والنشر عبر الويب غير مفعّلين بعد.',
                    fr: 'Le contenu public est affiché en lecture seule ; la modification et la publication en ligne ne sont pas encore activées.',
                    en: 'Public homepage content is currently read-only; online editing and publishing are not yet enabled.',
                  },
                  language,
                )
              : pickText(
                  {
                    ar: 'ميزة تعديل ونشر نصوص الصفحة الرئيسية غير متاحة حالياً لأن خدمة النشر لم تُفعّل بعد.',
                    fr: 'La modification et la publication du contenu public sont actuellement indisponibles car le service de publication n’est pas encore activé.',
                    en: 'Public content editing and publishing are currently unavailable because the publishing service is not yet enabled.',
                  },
                  language,
                )}
          </p>
        </div>
      )}

      <div className="kh-info-panels">
        <article className="kh-info-panel">
          <div className="space-y-2">
            <h2 className="kh-info-panel-title">
              {pickPublicEntry('about', 'title') ??
                pickText(
                  {
                    ar: 'حول مدرسة كريستو (KRISTOU)',
                    fr: 'À propos de KRISTOU',
                    en: 'About KRISTOU',
                  },
                  language,
                )}
            </h2>
            <p className="kh-info-panel-body">
              {pickPublicEntry('about', 'body') ??
                pickText(
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
              {broadcastsStatus === 'READY' && publicAnnouncements[0]
                ? publicAnnouncements[0].title
                : pickText(
                    {
                      ar: 'أحدث إعلان عام',
                      fr: 'Dernière annonce publique',
                      en: 'Latest announcement',
                    },
                    language,
                  )}
            </h2>
            <p className="kh-info-panel-body">
              {broadcastsStatus === 'READY' && publicAnnouncements[0]
                ? publicAnnouncements[0].body
                : pickText(
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

      {serviceCardsGrid}

      <div ref={levelsSectionRef}>
        <HomeSection title={t('levelsTitle')} subtitle={t('levelsBody')}>
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
                <h3 className="kh-info-panel-title text-sm sm:text-base mt-1">{lvl.label}</h3>
              </div>
            ))}
          </div>
        </HomeSection>
      </div>

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
              { icon: '👩‍🏫', title: t('featureQualified'), body: t('directoryDescription') },
              { icon: '📚', title: t('featureTracking'), body: t('growthBody') },
              { icon: '🎨', title: t('featureActivities'), body: t('creativityBody') },
              { icon: '🛡️', title: t('featureSafe'), body: t('storyBody') },
            ].map((pillar, idx) => (
              <div key={idx} className="kh-info-panel">
                <span className="text-2xl">{pillar.icon}</span>
                <h3 className="kh-info-panel-title text-sm sm:text-base mt-1">{pillar.title}</h3>
                <p className="kh-info-panel-body mt-1">{pillar.body}</p>
              </div>
            ))}
          </div>
        </HomeSection>
      </div>

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
          subtitle={
            broadcastsHasError
              ? t('error')
              : isAnnouncementsDemo
              ? t('demoPreview')
              : pickText(
                  {
                    ar: 'بلاغات المدرسة المعتمدة',
                    fr: 'Annonces officielles publiées',
                    en: 'Published school notices',
                  },
                  language,
                )
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {publicAnnouncements.map((item) => (
              <article key={item.id} className="kh-info-panel">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="kh-info-chip">
                      {item.createdAt}
                      {item.isDemoPreview ? ` • ${t('demoPreview')}` : ''}
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
    </>
  );
};
