import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AuthModal } from './AuthModal';
import { getTelegramLinkCopy } from '../i18n/telegram-link';
import { canAccessAppTab } from './homepages/homepageAccess';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../i18n/homepages';
import { AppTab, NotificationItem, NotificationSoundOption } from '../types';
import { filterLoadedNotifications, NOTIFICATION_CATEGORIES, type NotificationFilter } from '../lib/notificationFilters';
import {
  Bell,
  Moon,
  Sun,
  User as UserIcon,
  LogOut,
  Send,
  Menu,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCheck,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory' | 'announcements', subTab: string) => void;
  onNavigateToNotificationTarget?: (notification: NotificationItem) => boolean;
}

const NOTIFICATION_SOUNDS: readonly NotificationSoundOption[] = [
  'Kristou Bell',
  'Soft Chime',
  'Classroom Bell',
  'Gentle Pop',
  'Silent',
];

const NOTIFICATION_FILTER_LABELS: Record<NotificationFilter, { ar: string; fr: string; en: string }> = {
  all: { ar: 'الكل', fr: 'Tout', en: 'All' },
  pickup: { ar: 'الاستلام', fr: 'Sortie', en: 'Pickup' },
  note: { ar: 'ملاحظات', fr: 'Notes', en: 'Notes' },
  announcement: { ar: 'الإعلانات', fr: 'Annonces', en: 'Announcements' },
  message: { ar: 'الرسائل', fr: 'Messages', en: 'Messages' },
  calendar: { ar: 'التقويم', fr: 'Calendrier', en: 'Calendar' },
  system: { ar: 'النظام', fr: 'Système', en: 'System' },
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab: _activeTab,
  setActiveTab,
  onNavigateToSubTab,
  onNavigateToNotificationTarget,
}) => {
  const {
    currentUser,
    language,
    setLanguage,
    theme,
    setTheme,
    t,
    logout,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    notificationSound,
    setNotificationSound,
    soundMuted,
    setSoundMuted,
    vibrationEnabled,
    setVibrationEnabled,
    notificationsError,
    markingNotificationIds,
    markingAllNotifications,
    preferencesError,
    preferencesSyncStatus,
    refreshSchoolData,
    connectTelegram,
    telegramLinkNotice,
    dismissTelegramLinkNotice,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const [showTelegramLinkDialog, setShowTelegramLinkDialog] = useState(false);
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const telegramCopy = getTelegramLinkCopy(language);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const navbarMenuOpen = showProfileMenu || showNotifications;

  const startTelegramLink = async () => {
    setConnectingTelegram(true);
    const result = await connectTelegram();
    setConnectingTelegram(false);
    if (!result.linkUrl) {
      setTelegramLinkUrl(null);
      setShowTelegramLinkDialog(true);
      return;
    }
    setTelegramLinkUrl(result.linkUrl);
    setShowTelegramLinkDialog(true);
  };

  useEffect(() => {
    if (!navbarMenuOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setShowProfileMenu(false);
      if (!notificationsMenuRef.current?.contains(event.target as Node)) setShowNotifications(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [navbarMenuOpen]);

  useEffect(() => {
    if (!navbarMenuOpen) return;
    // Containment on a list alone cannot protect the page when scrolling its header
    // or an empty panel. Lock both document scroll owners until every menu closes.
    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const htmlOverflow = htmlStyle.overflowY;
    const bodyOverflow = bodyStyle.overflowY;
    htmlStyle.overflowY = 'hidden';
    bodyStyle.overflowY = 'hidden';
    return () => {
      htmlStyle.overflowY = htmlOverflow;
      bodyStyle.overflowY = bodyOverflow;
    };
  }, [navbarMenuOpen]);

  useEffect(() => {
    setNotificationFilter('all');
  }, [currentUser?.id, currentUser?.accountStatus]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = filterLoadedNotifications(notifications, notificationFilter);

  return (
    <header
      dir="ltr"
      className="sticky top-0 z-50 bg-white/95 dark:bg-[#090909]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors"
    >
      <div
        dir="ltr"
        className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between"
      >
        {/* Brand Logo & Name */}
        <div
          className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0"
          onClick={() => setActiveTab('home')}
        >
          <img
            src="/assets/kristou-logo.png"
            alt={t('school')}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain bg-white dark:bg-gray-800 p-0.5 shadow-md border border-gray-200 dark:border-gray-700 shrink-0"
          />
          <div>
            <span className="font-bold text-gray-900 dark:text-white tracking-wide text-sm sm:text-lg block leading-none">
              KRISTOU
            </span>
            <span className="hidden sm:block text-xs text-k-brand font-medium">{t('school')}</span>
          </div>
        </div>

        {/* Right Actions: Language, Notifications, Profile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Language Dropdown */}
          <div className="relative flex items-center">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'ar' | 'fr' | 'en')}
              aria-label={t('language')}
              className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-k-brand cursor-pointer uppercase"
            >
              <option value="ar">AR</option>
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </div>

          {/* Notifications Bell */}
          <div
            ref={notificationsMenuRef}
            className="relative"
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setShowNotifications(true);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') setShowNotifications(false);
            }}
          >
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label={t('notifications')}
              aria-expanded={showNotifications}
              aria-controls="navbar-notifications"
              className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div id="navbar-notifications" className="absolute end-0 top-full pt-2 w-80 max-w-[calc(100vw-2rem)] z-50">
                <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-3">
                <div className="px-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    {t('notifications')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-k-brand font-medium">
                      {unreadCount} {t('unread')}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        disabled={markingAllNotifications}
                        onClick={markAllNotificationsRead}
                        title={pickText(
                          { ar: 'تحديد الكل كمقروء', fr: 'Tout lire', en: 'Mark all read' },
                          language,
                        )}
                        className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-3 pt-2" aria-label={pickText({ ar: 'تصفية الإشعارات', fr: 'Filtrer les notifications', en: 'Filter notifications' }, language)} role="group">
                  <div className="flex gap-1.5 overflow-x-auto pb-1" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    {(['all', ...NOTIFICATION_CATEGORIES] as NotificationFilter[]).map((category) => (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={notificationFilter === category}
                        onClick={() => setNotificationFilter(category)}
                        className={notificationFilter === category
                          ? 'shrink-0 rounded-full bg-k-brand px-2.5 py-1 text-[11px] font-semibold text-white'
                          : 'shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'}
                      >
                        {pickText(NOTIFICATION_FILTER_LABELS[category], language)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                    {pickText({ ar: 'التصفية تشمل آخر 40 إشعاراً محمّلاً كحد أقصى', fr: 'Filtres sur les 40 dernières notifications chargées au maximum', en: 'Filters apply to up to 40 most recent loaded notifications' }, language)}
                  </p>
                </div>
                {notificationsError && (
                  <div
                    role="alert"
                    data-testid="notifications-error-alert"
                    className="mx-3 mt-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-[11px] font-semibold text-red-700 dark:text-red-300 flex items-center justify-between gap-2"
                  >
                    <span>{notificationsError}</span>
                    <button
                      type="button"
                      onClick={() => void refreshSchoolData()}
                      className="rounded-md bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-800 shrink-0"
                    >
                      {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
                    </button>
                  </div>
                )}
                <div className="max-h-80 overflow-y-auto overscroll-contain divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      {notificationsError
                        ? pickText({ ar: 'تعذر تحميل الإشعارات', fr: 'Notifications indisponibles', en: 'Notifications unavailable' }, language)
                        : notifications.length === 0
                          ? t('noNotifications')
                          : pickText({ ar: 'لا توجد إشعارات في هذه الفئة ضمن العناصر المحمّلة', fr: 'Aucune notification de cette catégorie parmi les éléments chargés', en: 'No notifications in this category among loaded items' }, language)}
                    </div>
                  ) : (
                    filteredNotifications.map((n) => {
                      const isBusy = markingAllNotifications || markingNotificationIds.includes(n.id);
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read && !isBusy) {
                              markNotificationRead(n.id);
                            }
                            if (onNavigateToNotificationTarget?.(n)) {
                              setShowNotifications(false);
                            } else if (n.targetTab === 'calendar' && canAccessAppTab(currentUser, 'announcements')) {
                              if (onNavigateToSubTab) {
                                onNavigateToSubTab('announcements', 'calendar');
                              } else {
                                setActiveTab('announcements');
                              }
                              setShowNotifications(false);
                            } else if (n.targetTab && canAccessAppTab(currentUser, n.targetTab as AppTab)) {
                              setActiveTab(n.targetTab);
                              setShowNotifications(false);
                            }
                          }}
                          className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer ${
                            !n.read ? 'bg-k-brand/10 dark:bg-k-brand/10' : ''
                          } ${isBusy ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-gray-900 dark:text-white">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {isBusy ? t('loading') : n.time}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              </div>
            )}
          </div>

          {/* User Profile / Navigation Menu */}
          <div
            ref={profileMenuRef}
            className="relative"
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setShowProfileMenu(true);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') setShowProfileMenu(false);
            }}
          >
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label={currentUser ? t('account') : t('login')}
              aria-expanded={showProfileMenu}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {currentUser ? (
                <img
                  src={currentUser.avatarUrl || '/assets/kristou-logo.png'}
                  alt={currentUser.fullName}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700 bg-white"
                />
              ) : (
                <Menu className="w-6 h-6" />
              )}
              {currentUser && (
                <span className="hidden lg:inline text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {currentUser.fullName}
                </span>
              )}
            </button>

            {showProfileMenu && (
              <div
                className="absolute end-0 top-full pt-1.5 w-[min(19rem,calc(100vw-1rem))] z-50"
              >
                <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-2">
                  {currentUser && (
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <p className="font-bold text-sm text-gray-900 dark:text-white">
                        {currentUser.fullName}
                      </p>
                      <p className="text-xs text-gray-500 uppercase font-mono mt-0.5">
                        {currentUser.role}
                      </p>
                    </div>
                  )}

                  {/* Navigation Menu Links (Teachers -> Classes -> Registration order preserved) */}
                  <div className="py-1 border-b border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('home');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span>🏠 {t('home')}</span>
                    </button>
                    {currentUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('publicSite');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>🌐 {pickText(HOMEPAGE_COMMON_TEXT.publicSiteNav, language)}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'announcements') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('announcements');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>
                          📢 {t('announcements')} & {t('calendar')}
                        </span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'community') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('community');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>📚 {t('classCommunity')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'notes') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('notes');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>📝 {t('parentNotes')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'messages') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('messages');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>💬 {t('messages')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'pickup') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('pickup');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>🛡️ {t('pickup')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('foodMenu');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span>🍲 {t('foodMenu')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('directory');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span>👨‍🏫 {t('teachers')}</span>
                    </button>
                    {canAccessAppTab(currentUser, 'classes') && (
                      <button
                        type="button"
                        data-testid="navbar-menu-classes"
                        onClick={() => {
                          setActiveTab('classes');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>🏫 {pickText(HOMEPAGE_COMMON_TEXT.classesNav, language)}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('registration');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span>📝 {t('registration')}</span>
                    </button>
                  </div>

                  {/* Preferences: Appearance & Notification Sound */}
                  <div className="py-1">
                    <div className="px-4 py-2 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('appearance')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTheme(theme === 'light' ? 'pitch-black' : 'light')}
                        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        title={theme === 'light' ? t('pitchBlack') : t('lightMode')}
                      >
                        {theme === 'light' ? (
                          <Moon className="w-4 h-4" />
                        ) : (
                          <Sun className="w-4 h-4 text-amber-400" />
                        )}
                        <span>{theme === 'light' ? t('pitchBlack') : t('lightMode')}</span>
                      </button>
                    </div>

                    <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {pickText({ ar: 'النغمة', fr: 'Son', en: 'Sound' }, language)}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Notification sound"
                        onClick={() => {
                          const idx = NOTIFICATION_SOUNDS.indexOf(notificationSound);
                          const next = NOTIFICATION_SOUNDS[(idx + 1) % NOTIFICATION_SOUNDS.length];
                          setNotificationSound(next);
                        }}
                        className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
                      >
                        {notificationSound}
                      </button>
                    </div>

                    <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {soundMuted ? (
                          <VolumeX className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        <span>
                          {pickText({ ar: 'كتم الصوت', fr: 'Muet', en: 'Mute' }, language)}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Toggle sound mute"
                        aria-pressed={soundMuted}
                        onClick={() => setSoundMuted(!soundMuted)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                          soundMuted
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {soundMuted
                          ? pickText({ ar: 'مكتوم', fr: 'Activé', en: 'Muted' }, language)
                          : pickText({ ar: 'مفعّل', fr: 'Désactivé', en: 'On' }, language)}
                      </button>
                    </div>

                    <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {pickText({ ar: 'الاهتزاز', fr: 'Vibration', en: 'Vibration' }, language)}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Toggle notification vibration"
                        aria-pressed={vibrationEnabled}
                        onClick={() => setVibrationEnabled(!vibrationEnabled)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                          vibrationEnabled
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {vibrationEnabled
                          ? pickText({ ar: 'مفعّل', fr: 'Activé', en: 'On' }, language)
                          : pickText({ ar: 'معطّل', fr: 'Désactivé', en: 'Off' }, language)}
                      </button>
                    </div>

                    <div className="px-4 py-1.5 flex items-center justify-between gap-2 text-[10px] font-bold">
                      <span className="text-gray-400">
                        {pickText({ ar: 'حالة التفضيلات:', fr: 'Préférences :', en: 'Sync status:' }, language)}
                      </span>
                      <span
                        data-testid="preferences-sync-status"
                        className={`px-2 py-0.5 rounded-md ${
                          preferencesSyncStatus === 'SAVED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : preferencesSyncStatus === 'SAVING'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : preferencesSyncStatus === 'ERROR'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {preferencesSyncStatus === 'SAVING'
                          ? t('loading')
                          : preferencesSyncStatus === 'SAVED'
                          ? pickText({ ar: 'محفوظة', fr: 'Enregistré', en: 'Saved' }, language)
                          : preferencesSyncStatus === 'UNAVAILABLE'
                          ? pickText({ ar: 'محلي (دون خادم)', fr: 'Local (hors serveur)', en: 'Local (backend pending)' }, language)
                          : preferencesSyncStatus === 'ERROR'
                          ? t('error')
                          : pickText({ ar: 'عرض محلي', fr: 'Affichage local', en: 'Local display' }, language)}
                      </span>
                    </div>

                    {preferencesError && (
                      <div
                        role="alert"
                        data-testid="preferences-error-alert"
                        className="mx-3 my-1.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 dark:text-red-300"
                      >
                        {preferencesError}
                      </div>
                    )}

                    {currentUser && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('home');
                            setShowProfileMenu(false);
                          }}
                          className="w-full text-start px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                        >
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <span>{t('profile')}</span>
                        </button>
                        {!currentUser.telegramLinked && (
                          <button
                            type="button"
                            onClick={() => {
                              void startTelegramLink();
                              setShowProfileMenu(false);
                            }}
                            disabled={connectingTelegram}
                            className="w-full text-start px-4 py-2 text-xs font-medium text-k-brand hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            <span>{connectingTelegram ? t('loading') : t('telegramConnect')}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 py-1">
                    {currentUser ? (
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t('logout')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAuthModal(true);
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-k-brand hover:bg-k-brand/10"
                      >
                        {t('login')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {showTelegramLinkDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowTelegramLinkDialog(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="telegram-link-title"
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-[#111111]"
          >
            <h2
              id="telegram-link-title"
              className="text-base font-bold text-gray-900 dark:text-white"
            >
              {telegramCopy.title}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {telegramLinkUrl ? telegramCopy.instructions : telegramCopy.startFailed}
            </p>
            {telegramLinkUrl && (
              <>
                <a
                  href={telegramLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1e8bc3]"
                >
                  <Send className="h-4 w-4" />
                  {telegramCopy.open}
                </a>
                <p className="mt-3 text-xs text-gray-500">{telegramCopy.expires}</p>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowTelegramLinkDialog(false)}
              className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              {telegramCopy.close}
            </button>
          </div>
        </div>
      )}

      {telegramLinkNotice && (
        <div
          className={`fixed bottom-4 left-1/2 z-[80] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-xl border p-4 shadow-xl ${
            telegramLinkNotice === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
          }`}
          role="status"
        >
          <p className="flex-1 text-sm">
            {telegramLinkNotice === 'success' ? telegramCopy.complete : telegramCopy.failed}
          </p>
          <button
            type="button"
            onClick={dismissTelegramLinkNotice}
            aria-label={telegramCopy.close}
            className="text-sm font-semibold"
          >
            ×
          </button>
        </div>
      )}
    </header>
  );
};
