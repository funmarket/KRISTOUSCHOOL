import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AuthModal } from './AuthModal';
import {
  Bell,
  Moon,
  Sun,
  User as UserIcon,
  LogOut,
  Menu,
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
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#090909]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0" onClick={() => setActiveTab('home')}>
          <img
            src="/assets/kristou-logo.png"
            alt="KRISTOU SCHOOL"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain bg-white dark:bg-gray-800 p-0.5 shadow-md border border-gray-200 dark:border-gray-700 shrink-0"
          />
          <div>
            <span className="font-bold text-gray-900 dark:text-white tracking-wide text-sm sm:text-lg block leading-none">
              KRISTOU
            </span>
            <span className="hidden sm:block text-xs text-k-brand font-medium">
              École Primaire Privée
            </span>
          </div>
        </div>

        {/* Right Actions: Language, Theme, Notifications, Profile */}
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

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'pitch-black' : 'light')}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === 'light' ? t('pitchBlack') : t('lightMode')}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
          </button>

          {/* Notifications Bell */}
          <div className="relative" onMouseLeave={() => setShowNotifications(false)}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 sm:right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-3 z-50">
                <div className="px-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('notifications')}</h3>
                  <span className="text-xs text-k-brand dark:text-k-brand font-medium">{unreadCount} non lues</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">Aucune notification</div>
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
                aria-label={currentUser ? t('home') : 'Menu'}
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
                    {(currentRole === 'PARENT' || currentRole === 'STUDENT' || currentRole === 'TEACHER' || currentRole === 'ADMIN') && (
                      <button
                        onClick={() => { setActiveTab('community'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        <span>📚 {t('classCommunity')}</span>
                      </button>
                    )}
                    {(currentRole === 'PARENT' || currentRole === 'TEACHER' || currentRole === 'ADMIN') && (
                      <button
                        onClick={() => { setActiveTab('notes'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        <span>📝 {t('parentNotes')}</span>
                      </button>
                    )}
                    {(currentRole === 'PARENT' || currentRole === 'TEACHER' || currentRole === 'MANAGER' || currentRole === 'ADMIN') && (
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

                  {currentUser && <div className="py-1">
                    <button
                      onClick={() => { setActiveTab('home'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span>Mon Profil & Enfants</span>
                    </button>

                  </div>}

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
    </header>
  );
};
