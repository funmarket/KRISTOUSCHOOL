import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AuthModal } from './AuthModal';
import { getTelegramLinkCopy } from '../i18n/telegram-link';
import { canAccessAppTab } from './homepages/homepageAccess';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../i18n/homepages';
import { Language, NotificationItem, NotificationSoundOption } from '../types';
import { Menu } from 'lucide-react';
import { NavbarNotificationMenu } from './navbar/NavbarNotificationMenu';
import { NavbarProfileMenu } from './navbar/NavbarProfileMenu';
import { NavbarTelegramDialog } from './navbar/NavbarTelegramDialog';

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
    t,
    connectTelegram,
    telegramLinkNotice,
    dismissTelegramLinkNotice,
  } = useApp();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const [showTelegramLinkDialog, setShowTelegramLinkDialog] = useState(false);
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const telegramCopy = getTelegramLinkCopy(language);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileScrollRef = useRef<HTMLDivElement>(null);

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
      if (event.key === 'Escape') {
        setShowProfileMenu(false);
        profileMenuRef.current?.querySelector('button')?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [showProfileMenu]);

  useEffect(() => {
    if (showProfileMenu) profileScrollRef.current?.focus({ preventScroll: true });
  }, [showProfileMenu]);

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
              onChange={(e) => setLanguage(e.target.value as Language)}
              aria-label={t('language')}
              className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-k-brand cursor-pointer uppercase"
            >
              <option value="ar">AR</option>
              <option value="fr">FR</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="de">DE</option>
              <option value="pt">PT</option>
            </select>
          </div>

          {/* Notifications Bell */}
          <NavbarNotificationMenu
            setActiveTab={setActiveTab}
            onNavigateToSubTab={onNavigateToSubTab}
            onNavigateToNotificationTarget={onNavigateToNotificationTarget}
          />

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
              <div className="absolute end-0 top-full pt-1.5 w-[min(19rem,calc(100vw-1rem))] z-50">
                <div
                  ref={profileScrollRef}
                  role="region"
                  tabIndex={0}
                  aria-label={currentUser ? t('account') : t('login')}
                  className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-k-brand"
                >
                  {currentUser && (
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{currentUser.fullName}</p>
                      <p className="text-xs text-gray-500 uppercase font-mono mt-0.5">{currentUser.role}</p>
                    </div>
                  )}

                  {/* Navigation Menu Links */}
                  <div className="py-1 border-b border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('home'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span>🏠 {t('home')}</span>
                    </button>
                    {currentUser && (
                      <button
                        type="button"
                        onClick={() => { setActiveTab('publicSite'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>🌐 {pickText(HOMEPAGE_COMMON_TEXT.publicSiteNav, language)}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'announcements') && (
                      <button
                        type="button"
                        onClick={() => { setActiveTab('announcements'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>📢 {t('announcements')} & {t('calendar')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'community') && (
                      <button
                        type="button"
                        onClick={() => { setActiveTab('community'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>📚 {t('classCommunity')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'performance') && (
                      <button
                        type="button"
                        data-testid="navbar-menu-performance"
                        onClick={() => { setActiveTab('performance'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>📊 {t('performance')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'attendance') && (
                      <button
                        type="button"
                        data-testid="navbar-menu-attendance"
                        onClick={() => { setActiveTab('attendance'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>📋 {t('attendance')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'notes') && (
                      <button
                        type="button"
                        onClick={() => { setActiveTab('notes'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>📝 {t('parentNotes')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'messages') && (
                      <button
                        type="button"
                        onClick={() => { setActiveTab('messages'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>💬 {t('messages')}</span>
                      </button>
                    )}
                    {canAccessAppTab(currentUser, 'pickup') && (
                      <button
                        type="button"
                        onClick={() => { setActiveTab('pickup'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>🛡️ {t('pickup')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setActiveTab('foodMenu'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span>🍲 {t('foodMenu')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab('directory'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span>👨‍🏫 {t('teachers')}</span>
                    </button>
                    {canAccessAppTab(currentUser, 'classes') && (
                      <button
                        type="button"
                        data-testid="navbar-menu-classes"
                        onClick={() => { setActiveTab('classes'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>🏫 {pickText(HOMEPAGE_COMMON_TEXT.classesNav, language)}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setActiveTab('registration'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span>📝 {t('registration')}</span>
                    </button>
                    {canAccessAppTab(currentUser, 'students') && (
                      <button
                        type="button"
                        data-testid="navbar-menu-students"
                        onClick={() => { setActiveTab('students'); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>🎓 {pickText({ ar: 'التلاميذ', fr: 'Élèves', en: 'Students', es: 'Estudiantes', de: 'Schüler', pt: 'Alunos' }, language)}</span>
                      </button>
                    )}
                  </div>

                  <NavbarProfileMenu
                    setShowProfileMenu={setShowProfileMenu}
                    setActiveTab={setActiveTab}
                    setShowAuthModal={setShowAuthModal}
                    startTelegramLink={() => void startTelegramLink()}
                    connectingTelegram={connectingTelegram}
                    NOTIFICATION_SOUNDS={NOTIFICATION_SOUNDS}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <NavbarTelegramDialog
        showTelegramLinkDialog={showTelegramLinkDialog}
        setShowTelegramLinkDialog={setShowTelegramLinkDialog}
        telegramLinkUrl={telegramLinkUrl}
        telegramCopy={telegramCopy}
        telegramLinkNotice={telegramLinkNotice === 'error' ? 'failed' : telegramLinkNotice}
        dismissTelegramLinkNotice={dismissTelegramLinkNotice}
      />
    </header>
  );
};
