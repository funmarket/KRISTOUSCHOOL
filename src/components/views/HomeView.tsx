import React from 'react';
import { Bell, BookOpen, CalendarDays, Images, Megaphone, UsersRound, Utensils, GraduationCap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './KristouHome.css';

type HomeViewProps = { setActiveTab: (tab: string) => void };
const ASSET = '/assets/kristou-home/';

export const HomeView: React.FC<HomeViewProps> = ({ setActiveTab }) => {
  const { currentUser, currentRole, childrenList, announcements, foodMenu, t } = useApp();
  const isParent = currentRole === 'PARENT' && !!currentUser;
  const myChildren = isParent ? childrenList.filter(child => currentUser?.linkedChildrenIds?.includes(child.id)) : [];

  const shortcuts = [
    { title: t('schedule'), subtitle: t('scheduleHint'), icon: CalendarDays, shade: '#dff4ff', color: '#159af4', tab: null },
    { title: t('homework'), subtitle: t('homeworkHint'), icon: BookOpen, shade: '#f1e4ff', color: '#9234f0', tab: 'community' },
    { title: t('foodMenu'), subtitle: t('menuHint'), icon: Utensils, shade: '#fff2d0', color: '#f8ae08', tab: 'foodMenu' },
    { title: t('classCommunity'), subtitle: t('communityHint'), icon: UsersRound, shade: '#dff9e9', color: '#09ab7d', tab: 'community' },
    { title: t('gallery'), subtitle: t('galleryHint'), icon: Images, shade: '#ffe8ef', color: '#ff496d', tab: null },
    { title: t('announcements'), subtitle: t('announcementsHint'), icon: Megaphone, shade: '#dff4ff', color: '#1699df', tab: 'community' },
  ] as const;
  const levelLabels = [
    [t('levelCp'), t('level1')], [t('levelCe1'), t('level2')], [t('levelCe2'), t('level3')],
    [t('levelCm1'), t('level4')], [t('levelCm2'), t('level5')], [t('levelSix'), t('level6')],
  ];
  const levelColors = ['#d8f0ff', '#d4f7eb', '#ffeab5', '#ffdfd2', '#e8dcff', '#ffdfe8'];
  const levelInk = ['#15539d', '#007965', '#815008', '#8a542e', '#4b35a3', '#a92b5a'];

  return <section className="kr-home" aria-label={t('home')}>
    <div className="kr-hero">
      <div className="kr-hero-copy">
        <div className="kr-eyebrow">{t('heroSchoolType')}</div>
        <h1>Kristou <strong>School</strong></h1>
        <p>{t('heroDescription')}</p>
        <div className="kr-actions">
          <button type="button" className="kr-btn" onClick={() => setActiveTab('registration')}>{t('heroSecondary')} <span aria-hidden="true">→</span></button>
          <button type="button" className="kr-btn ghost" onClick={() => setActiveTab('directory')}>{t('discoverTeam')} <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      <img className="kr-hero-photo" src={`${ASSET}hero-schoolchildren.png`} alt={t('heroImageAlt')} />
    </div>

    <div className="kr-shortcuts" aria-label={t('quickTitle')}>
      {shortcuts.map(({ title, subtitle, icon: Icon, shade, color, tab }) => <button
        className="kr-shortcut" type="button" key={title} disabled={!tab}
        title={tab ? undefined : t('comingSoon')}
        onClick={tab ? () => setActiveTab(tab) : undefined}>
        <span className="ico" style={{ '--shade': shade, '--accent': color } as React.CSSProperties}><Icon size={23} strokeWidth={2.5} /></span>
        <strong>{title}</strong><small>{subtitle}</small>{!tab && <em>{t('comingSoon')}</em>}
      </button>)}
    </div>

    <div className="kr-info-grid">
      <section className="kr-panel">
        <div className="kr-panel-head"><h2><Bell size={20} color="#119fff" /> {t('featuredTitle')}</h2><button type="button" className="kr-link" onClick={() => setActiveTab('community')}>{t('featuredLink')} →</button></div>
        {announcements.length ? announcements.slice(0, 2).map((ann, index) => <article className="kr-announcement" key={ann.id}>
          <img src={`${ASSET}${index === 0 ? 'announcement-school' : 'announcement-bardo'}.png`} alt={t('announcementImageAlt')} />
          <div>{ann.priority === 'URGENT' && <span className="kr-urgent">{t('urgent')}</span>}<h3>{ann.title}</h3>
            <time dateTime={ann.createdAt}>{new Date(ann.createdAt).toLocaleDateString()}</time><p>{ann.body}</p></div>
        </article>) : <p>{t('noItems')}</p>}
      </section>

      <section className="kr-panel kr-canteen">
        <div className="kr-panel-head"><h2><Utensils color="#f6a400" size={20} /> {t('canteenTitle')}</h2><span className="kr-chip">{t('canteenBrand')}</span></div>
        <p className="kr-week">{foodMenu.weekRange}</p>
        <div className="kr-meals"><img src={`${ASSET}canteen-meal.png`} alt={t('canteenImageAlt')} /><div>
          {foodMenu.items.slice(0, 5).map((item, index) => <div className="kr-meal" key={`${item.day}-${index}`}><b>{item.day}</b><span>{item.main}</span></div>)}
        </div></div>
        <button type="button" className="kr-meal-action" onClick={() => setActiveTab('foodMenu')}>{t('fullMenu')} →</button>
      </section>

      {isParent ? <section className="kr-panel kr-kids">
        <div className="kr-panel-head"><h2><UsersRound size={21} color="#00a595" /> {t('myChildren')}</h2></div>
        <div className="kr-children-grid">{myChildren.length ? myChildren.map((child, index) => <button type="button" className="kr-child" key={child.id} onClick={() => setActiveTab('pickup')}>
          <img src={child.photoUrl || `${ASSET}${index ? 'child-second' : 'child-yasmine'}.png`} alt={child.fullName} />
          <span><strong>{child.fullName}</strong><small>{child.className}</small></span><span className="kr-chevron" aria-hidden="true">›</span>
        </button>) : <p>{t('noLinkedChildren')}</p>}</div>
      </section> : <section className="kr-panel kr-kids"><div className="kr-panel-head"><h2><UsersRound size={21} color="#00a595" /> {t('familySpace')}</h2></div><p>{t('familySpaceBody')}</p><button type="button" className="kr-btn" onClick={() => setActiveTab('registration')}>{t('registration')} →</button></section>}
    </div>

    <div className="kr-lower">
      <div className="kr-campus"><img src={`${ASSET}school-building.png`} alt={t('schoolBuildingAlt')} /><button type="button" className="kr-video" onClick={() => setActiveTab('directory')}>{t('discoverSchool')} →</button></div>
      <section className="kr-levels"><h2><GraduationCap size={23} color="#009d92" style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('levelsTitle')}</h2><p>{t('levelsBody')}</p><div className="kr-level-row">{levelLabels.map(([name, desc], index) => <div className="kr-level" key={name} style={{ '--lvbg': levelColors[index], '--lvink': levelInk[index] } as React.CSSProperties}>{name}<small>{desc}</small></div>)}</div></section>
      <section className="kr-enroll"><img src={`${ASSET}enrollment-children.png`} alt={t('enrollmentImageAlt')} /><div><h2>{t('enrollmentTitle')}</h2><button type="button" className="kr-btn" onClick={() => setActiveTab('registration')}>{t('heroSecondary')} →</button></div></section>
    </div>
    <div className="kr-foot-stripe"><div>🎓 &nbsp; {t('featureQualified')}</div><div>📊 &nbsp; {t('featureTracking')}</div><div>🎨 &nbsp; {t('featureActivities')}</div><div>🛡️ &nbsp; {t('featureSafe')}</div></div>
  </section>;
};
