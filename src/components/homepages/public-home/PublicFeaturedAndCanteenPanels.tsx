import React from 'react';
import { Bell, GraduationCap, UsersRound, Utensils } from 'lucide-react';
import type { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import type { Announcement, Language, User } from '../../../types';
import { ASSET } from './usePublicHomePage';

export interface PublicFeaturedAndCanteenPanelsProps {
  language: Language;
  t: ReturnType<typeof useApp>['t'];
  currentUser: User | null;
  broadcastsHasError: boolean;
  broadcastsError: string | null;
  publicAnnouncements: Announcement[];
  foodMenu: ReturnType<typeof useApp>['foodMenu'];
  foodMenuHasError: boolean;
  foodMenuError: string | null;
  announcementsPreviewBadge: React.ReactNode;
  canteenPreviewBadge: React.ReactNode;
  refreshSchoolData?: () => Promise<boolean>;
  setActiveTab: (tab: string) => void;
  onOpenAuth: (mode?: 'signin' | 'register') => void;
  onScrollToAnnouncements: () => void;
}

const LEVEL_COLORS = ['#d8f0ff', '#d4f7eb', '#ffeab5', '#ffdfd2', '#e8dcff', '#ffdfe8'];
const LEVEL_INK = ['#15539d', '#007965', '#815008', '#8a542e', '#4b35a3', '#a92b5a'];

export const PublicFeaturedAndCanteenPanels: React.FC<PublicFeaturedAndCanteenPanelsProps> = ({
  language,
  t,
  currentUser,
  broadcastsHasError,
  broadcastsError,
  publicAnnouncements,
  foodMenu,
  foodMenuHasError,
  foodMenuError,
  announcementsPreviewBadge,
  canteenPreviewBadge,
  refreshSchoolData,
  setActiveTab,
  onOpenAuth,
  onScrollToAnnouncements,
}) => {
  const levelLabels = [
    [t('levelCp'), t('level1')],
    [t('levelCe1'), t('level2')],
    [t('levelCe2'), t('level3')],
    [t('levelCm1'), t('level4')],
    [t('levelCm2'), t('level5')],
    [t('levelSix'), t('level6')],
  ] as const;

  return (
    <>
      <div className="kr-info-grid">
        <section className="kr-panel">
          <div className="kr-panel-head">
            <h2>
              <Bell size={20} color="#119fff" /> {t('featuredTitle')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {announcementsPreviewBadge}
              <button
                type="button"
                className="kr-link"
                onClick={onScrollToAnnouncements}
              >
                {t('featuredLink')} →
              </button>
            </div>
          </div>
          {broadcastsHasError && (
            <div
              role="alert"
              data-testid="public-announcements-error-banner"
              className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 flex items-center justify-between gap-2"
            >
              <span>
                {broadcastsError ||
                  pickText(
                    {
                      ar: 'تعذر تحميل الإعلانات العامة من الخادم.',
                      fr: 'Impossible de charger les annonces publiques.',
                      en: 'Unable to load live public announcements.',
                    },
                    language,
                  )}
              </span>
              {typeof refreshSchoolData === 'function' && (
                <button
                  type="button"
                  onClick={() => void refreshSchoolData()}
                  className="rounded-lg bg-red-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-800 shrink-0"
                >
                  {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
                </button>
              )}
            </div>
          )}
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
                    {new Date(ann.createdAt).toLocaleDateString()}
                    {ann.isDemoPreview ? ` • ${t('demoPreview')}` : ''}
                  </time>
                  <p>{ann.body}</p>
                </div>
              </article>
            ))
          ) : (
            !broadcastsHasError && <p>{t('noItems')}</p>
          )}
        </section>

        <section className="kr-panel kr-canteen">
          <div className="kr-panel-head">
            <h2>
              <Utensils color="#f6a400" size={20} /> {t('canteenTitle')}
            </h2>
            <span className="kr-chip">{t('canteenBrand')}</span>
          </div>
          {foodMenuHasError ? (
            <div
              role="alert"
              data-testid="public-food-menu-error-banner"
              className="my-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 flex items-center justify-between gap-2"
            >
              <span>
                {foodMenuError ||
                  pickText(
                    {
                      ar: 'تعذر تحميل قائمة الطعام من الخادم.',
                      fr: 'Impossible de charger le menu de la cantine.',
                      en: 'Unable to load live canteen menu.',
                    },
                    language,
                  )}
              </span>
              {typeof refreshSchoolData === 'function' && (
                <button
                  type="button"
                  onClick={() => void refreshSchoolData()}
                  className="rounded-lg bg-red-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-800 shrink-0"
                >
                  {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
                </button>
              )}
            </div>
          ) : (
            canteenPreviewBadge
          )}
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
                    '--lvbg': LEVEL_COLORS[index],
                    '--lvink': LEVEL_INK[index],
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
    </>
  );
};
