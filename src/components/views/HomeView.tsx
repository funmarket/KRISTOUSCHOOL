import React from 'react';
import { ArrowRight, Bell, BookOpen, CalendarDays, ChefHat, ClipboardList, Heart, Mail, MessageCircle, Sparkles, Users, Utensils } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HomeViewProps { setActiveTab: (tab: string) => void; }

export const HomeView: React.FC<HomeViewProps> = ({ setActiveTab }) => {
  const { currentUser, currentRole, childrenList, announcements, homeworkList, foodMenu, t } = useApp();
  const userChildren = childrenList.filter(child => currentUser?.linkedChildrenIds?.includes(child.id));
  const visibleAnnouncements = announcements.slice(0, 2);
  const visibleMenu = foodMenu.items.slice(0, 3);
  const shortcuts = [
    { icon: Users, label: t('quickChildren'), hint: t('quickChildrenHint'), color: 'sky', action: () => currentRole === 'PARENT' ? setActiveTab('pickup') : setActiveTab('directory'), gated: true },
    { icon: ClipboardList, label: t('quickPickup'), hint: t('quickPickupHint'), color: 'amber', action: () => setActiveTab('pickup') },
    { icon: BookOpen, label: t('quickHomework'), hint: t('quickHomeworkHint'), color: 'violet', action: () => setActiveTab('community') },
    { icon: MessageCircle, label: t('quickCommunity'), hint: t('quickCommunityHint'), color: 'rose', action: () => setActiveTab('community') },
    { icon: Utensils, label: t('quickMenu'), hint: t('quickMenuHint'), color: 'mint', action: () => setActiveTab('foodMenu') },
    { icon: Mail, label: t('quickNotes'), hint: t('quickNotesHint'), color: 'gold', action: () => setActiveTab('notes') },
  ];

  return (
    <div className="kristou-home pb-12">
      <section className="k-home-hero">
        <div className="k-hero-copy">
          <span className="k-eyebrow"><Sparkles className="h-4 w-4" />{t('heroEyebrow')}</span>
          <h1>{t('heroTitleLead')}<br /><em>{t('heroTitleAccent')}</em></h1>
          <p>{t('heroDescription')}</p>
          <div className="k-hero-actions">
            <button className="k-btn k-btn-primary" onClick={() => currentUser ? setActiveTab('community') : setActiveTab('registration')}>{t('heroPrimary')} <ArrowRight className="h-4 w-4" /></button>
            <button className="k-btn k-btn-secondary" onClick={() => setActiveTab('registration')}>{t('heroSecondary')}</button>
          </div>
        </div>
        <div className="k-hero-art">
          <img src="/assets/kristou-home/children_hero.jpg" alt={t('heroEyebrow')} />
          <span className="k-sun" /><span className="k-blob" />
          <div className="k-hero-stamp"><span>🌈</span><strong>{t('heroBadge')}</strong></div>
        </div>
      </section>

      <section className="k-section">
        <div className="k-section-heading"><div><span className="k-kicker">{t('quickKicker')}</span><h2>{t('quickTitle')}</h2></div><p>{t('quickSubtitle')}</p></div>
        <div className="k-shortcuts">
          {shortcuts.map(({ icon: Icon, label, hint, color, action, gated }) => (
            (!gated || currentRole === 'PARENT') && <button key={label} className={`k-shortcut k-${color}`} onClick={action}><span className="k-shortcut-icon"><Icon className="h-6 w-6" /></span><strong>{label}</strong><small>{hint}</small></button>
          ))}
        </div>
      </section>

      <section className="k-main-grid">
        <div className="k-panel">
          <div className="k-panel-heading"><h3><Bell className="h-5 w-5 text-rose-500" />{t('featuredTitle')}</h3><button onClick={() => setActiveTab('community')}>{t('featuredLink')} <ArrowRight className="h-3.5 w-3.5" /></button></div>
          {visibleAnnouncements.length === 0 ? <div className="k-empty">{t('noItems')}</div> : visibleAnnouncements.map((announcement, index) => (
            <article className="k-notice" key={announcement.id}><span className={`k-notice-icon ${index ? 'mint' : 'peach'}`}>{index ? '📣' : '🚌'}</span><div><span className="k-meta">{announcement.authorRole} · {announcement.authorName}</span><h4>{announcement.title}</h4><p>{announcement.body}</p></div>{announcement.priority === 'URGENT' && <span className="k-pill">{t('urgent')}</span>}</article>
          ))}
        </div>
        <div className="k-panel k-meal-panel">
          <div className="k-panel-heading"><h3><ChefHat className="h-5 w-5 text-amber-500" />{t('canteenTitle')}</h3><span className="k-brand-pill">{t('canteenBrand')}</span></div>
          <p className="k-muted k-menu-range">{foodMenu.weekRange}</p>
          {visibleMenu.map((item, index) => <div className="k-dish" key={`${item.day}-${index}`}><span>{item.day.slice(0, 3)}</span><div><strong>{item.main}</strong><small>{item.dessert}</small></div></div>)}
          <button className="k-meal-link" onClick={() => setActiveTab('foodMenu')}>{t('fullMenu')} <ArrowRight className="h-4 w-4" /></button>
        </div>
      </section>

      {currentRole === 'PARENT' && (
        <section className="k-family-grid">
          <div className="k-panel k-children-panel"><div className="k-panel-heading"><h3><Heart className="h-5 w-5 text-rose-500" />{t('myChildren')}</h3><span className="k-small-tag">{t('parentArea')}</span></div>{userChildren.length === 0 ? <div className="k-empty">{t('noItems')}</div> : userChildren.map(child => <div className="k-child" key={child.id}><img src={child.photoUrl} alt={child.fullName} /><div><strong>{child.fullName}</strong><small>{child.className} · {child.level}</small></div><button onClick={() => setActiveTab('pickup')}>{t('pickup')}</button></div>)}</div>
          <div className="k-panel"><div className="k-panel-heading"><h3><BookOpen className="h-5 w-5 text-sky-500" />{t('homework')}</h3><button onClick={() => setActiveTab('community')}>{t('seeAll')}</button></div>{homeworkList.slice(0, 2).map(item => <div className="k-homework" key={item.id}><strong>{item.title}</strong><small>{item.description}</small></div>)}</div>
        </section>
      )}

      <section className="k-editorial"><div className="k-section-heading"><div><span className="k-kicker">{t('schoolLifeKicker')}</span><h2>{t('schoolLifeTitle')}</h2></div><p>{t('schoolLifeSubtitle')}</p></div><div className="k-feature-grid"><article><img src="/assets/kristou-home/reading.jpg" alt={t('curiosityTitle')} /><div><span>{t('curiosity')}</span><h3>{t('curiosityTitle')}</h3><p>{t('curiosityBody')}</p></div></article><article><img src="/assets/kristou-home/learning.jpg" alt={t('growthTitle')} /><div><span>{t('growth')}</span><h3>{t('growthTitle')}</h3><p>{t('growthBody')}</p></div></article><article><img src="/assets/kristou-home/craft.jpg" alt={t('creativityTitle')} /><div><span>{t('creativity')}</span><h3>{t('creativityTitle')}</h3><p>{t('creativityBody')}</p></div></article></div></section>

      <section className="k-story"><div className="k-story-images"><img className="k-story-main" src="/assets/kristou-home/children_running.jpg" alt={t('storyTitle')} /><img className="k-story-small" src="/assets/kristou-home/teachers.jpg" alt={t('discoverTeam')} /></div><div className="k-story-copy"><span className="k-kicker">{t('storyKicker')}</span><h2>{t('storyTitle')}</h2><p>{t('storyBody')}</p><div className="k-hero-actions"><button className="k-btn k-btn-primary" onClick={() => setActiveTab('directory')}>{t('discoverTeam')} <ArrowRight className="h-4 w-4" /></button><button className="k-btn k-btn-secondary" onClick={() => setActiveTab('registration')}>{t('joinUs')}</button></div></div></section>

      <section className="k-contact"><div><h2>{t('contactTitle')}</h2><p>{t('contactBody')}</p></div><button className="k-btn k-btn-white" onClick={() => setActiveTab('registration')}>{t('joinSchool')} <ArrowRight className="h-4 w-4" /></button></section>
    </div>
  );
};
