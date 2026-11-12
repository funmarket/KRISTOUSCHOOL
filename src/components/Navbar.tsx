import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AuthModal } from './AuthModal';
import { getTelegramLinkCopy } from '../i18n/telegram-link';
import {
  Bell,
  Globe,
  Moon,
  Sun,
  User as UserIcon,
  LogOut,
  Shield,
  Send,
  Menu,
  BookOpen,
  Utensils,
  GraduationCap,
  Users,
  Calendar,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    currentUser,
    currentRole,
    language,
    setLanguage,
    theme,
    setTheme,
    t,
    logout,
    notifications,
    markNotificationRead,
    connectTelegram,
    telegramLinkNotice,
    dismissTelegramLinkNotice,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const [showTelegramLinkDialog, setShowTelegramLinkDialog] = useState(false);
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const telegramCopy = getTelegramLinkCopy(language);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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
    if (!showProfileMenu) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setShowProfileMenu(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowProfileMenu(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [showProfileMenu]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header dir="ltr" className="sticky top-0 z-50 bg-white/95 dark:bg-[#090909]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
      <div dir="ltr" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0" onClick={() => setActiveTab('home')}>
          <img
            src="/assets/kristou-logo.png"
            alt={t('school')}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain bg-white dark:bg-gray-800 p-0.5 shadow-md border border-gray-200 dark:border-gray-700 shrink-0"
          />
          <div>
            <span className="font-bold text-gray-900 dark:text-white tracking-wide text-sm sm:text-lg block leading-none">
              KRISTOU
            </span>
            <span className="hidden sm:block text-xs text-k-brand font-medium">
              {t('school')}
            </span>
          </div>
        </div>

        {/* Right Actions: Language, Theme, Notifications, Profile, Role Switcher */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Language Dropdown */}
          <div className="relative flex items-center">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as any)}
              className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-k-brand cursor-pointer uppercase"
            >
              <option value="ar">AR</option>
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </div>

          {/* Notifications Bell */}
          <div className="relative" onMouseLeave={() => setShowNotifications(false)}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute end-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-3 z-50">
                <div className="px-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('notifications')}</h3>
                  <span className="text-xs text-k-brand dark:text-k-brand font-medium">{unreadCount} {t('unread')}</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">{t('noNotifications')}</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer ${!n.read ? 'bg-k-brand/10 dark:bg-k-brand/10' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-gray-900 dark:text-white">{n.title}</span>
                          <span className="text-[10px] text-gray-400">{n.time}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile / Auth */}
          <div ref={profileMenuRef} className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-label={currentUser ? t('account') : t('login')}
                aria-expanded={showProfileMenu}
                onMouseEnter={() => setShowProfileMenu(true)}
                className="flex items-center space-x-2 rtl:space-x-reverse p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {currentUser ? (
                  <img
                    src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={currentUser.fullName}
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                  />
                ) : <Menu className="w-6 h-6" />}
                {currentUser && (
                  <span className="hidden lg:inline text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {currentUser.fullName}
                  </span>
                )}
              </button>

              {/* Profile Dropdown with Hover Bridge */}
              {showProfileMenu && (
                <div
                  className="absolute end-0 top-full pt-1.5 w-[min(18rem,calc(100vw-1rem))] z-50"
                  onMouseLeave={() => setShowProfileMenu(false)}
                >
                  <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-2">
                  {currentUser && (
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{currentUser.fullName}</p>
                      <p className="text-xs text-gray-500 uppercase font-mono mt-0.5">{currentUser.role}</p>
                    </div>
                  )}

                  {/* Navigation Menu Links */}
                  <div className="py-1 border-b border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => { setActiveTab('home'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <span>🏠 {t('home')}</span>
                    </button>
                    {(currentRole === 'PARENT' || currentRole === 'STUDENT' || currentRole === 'TEACHER' || currentRole === 'MANAGER' || currentRole === 'APP_ADMIN') && (
                      <button
                        onClick={() => { setActiveTab('community'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        <span>📚 {t('classCommunity')}</span>
                      </button>
                    )}
                    {(currentRole === 'PARENT' || currentRole === 'TEACHER' || currentRole === 'MANAGER' || currentRole === 'APP_ADMIN') && (
                      <button
                        onClick={() => { setActiveTab('notes'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        <span>📝 {t('parentNotes')}</span>
                      </button>
                    )}
                    {(currentRole === 'PARENT' || currentRole === 'TEACHER' || currentRole === 'MANAGER' || currentRole === 'APP_ADMIN') && (
                      <button
                        onClick={() => { setActiveTab('pickup'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        <span>🛡️ {t('pickup')}</span>
                      </button>
                    )}
                    <button
                      onClick={() => { setActiveTab('foodMenu'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <span>🍲 {t('foodMenu')}</span>
                    </button>
                    <button
                      onClick={() => { setActiveTab('directory'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <span>👨‍🏫 {t('teachers')}</span>
                    </button>
                    <button
                      onClick={() => { setActiveTab('registration'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <span>📝 {t('registration')}</span>
                    </button>
                  </div>

                  <div className="py-1">
                    <div className="px-4 py-2 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t('appearance')}</span>
                      <button
                        onClick={() => setTheme(theme === 'light' ? 'pitch-black' : 'light')}
                        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        title={theme === 'light' ? t('pitchBlack') : t('lightMode')}
                      >
                        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
                        <span>{theme === 'light' ? t('pitchBlack') : t('lightMode')}</span>
                      </button>
                    </div>
                    {currentUser && <>
                    <button
                      onClick={() => { setActiveTab('home'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span>{t('profile')}</span>
                    </button>
                    {!currentUser.telegramLinked && (
                      <button
                        onClick={() => { void startTelegramLink(); setShowProfileMenu(false); }}
                        disabled={connectingTelegram}
                        className="w-full text-start px-4 py-2 text-xs font-medium text-k-brand dark:text-k-brand hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        <Send className="w-4 h-4" />
                        <span>{connectingTelegram ? t('loading') : t('telegramConnect')}</span>
                      </button>
                    )}
                    </>}
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 py-1">
                    {currentUser ? <button
                      onClick={() => { logout(); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('logout')}</span>
                    </button> : <button
                      onClick={() => { setShowAuthModal(true); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-k-brand hover:bg-k-brand/10"
                    >
                      {t('login')}
                    </button>}
                  </div>
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showTelegramLinkDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowTelegramLinkDialog(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="telegram-link-title" className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-[#111111]">
            <h2 id="telegram-link-title" className="text-base font-bold text-gray-900 dark:text-white">{telegramCopy.title}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{telegramLinkUrl ? telegramCopy.instructions : telegramCopy.startFailed}</p>
            {telegramLinkUrl && <>
              <a href={telegramLinkUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1e8bc3]">
                <Send className="h-4 w-4" />{telegramCopy.open}
              </a>
              <p className="mt-3 text-xs text-gray-500">{telegramCopy.expires}</p>
            </>}
            <button type="button" onClick={() => setShowTelegramLinkDialog(false)} className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200">{telegramCopy.close}</button>
          </div>
        </div>
      )}

      {telegramLinkNotice && (
        <div className={`fixed bottom-4 left-1/2 z-[80] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-xl border p-4 shadow-xl ${telegramLinkNotice === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'}`} role="status">
          <p className="flex-1 text-sm">{telegramLinkNotice === 'success' ? telegramCopy.complete : telegramCopy.failed}</p>
          <button type="button" onClick={dismissTelegramLinkNotice} aria-label={telegramCopy.close} className="text-sm font-semibold">×</button>
        </div>
      )}
    </header>
  );
};
