import React from 'react';
import { useApp } from '../../context/AppContext';
import { pickText } from '../../i18n/homepages';
import { NotificationSoundOption } from '../../types';
import {
  Moon,
  Sun,
  User as UserIcon,
  LogOut,
  Send,
  Volume2,
  VolumeX,
  Smartphone,
} from 'lucide-react';

interface NavbarProfileMenuProps {
  setShowProfileMenu: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
  setShowAuthModal: (show: boolean) => void;
  startTelegramLink: () => void;
  connectingTelegram: boolean;
  NOTIFICATION_SOUNDS: readonly NotificationSoundOption[];
}

export const NavbarProfileMenu: React.FC<NavbarProfileMenuProps> = ({
  setShowProfileMenu,
  setActiveTab,
  setShowAuthModal,
  startTelegramLink,
  connectingTelegram,
  NOTIFICATION_SOUNDS,
}) => {
  const {
    currentUser,
    language,
    theme,
    setTheme,
    t,
    logout,
    notificationSound,
    setNotificationSound,
    soundMuted,
    setSoundMuted,
    vibrationEnabled,
    setVibrationEnabled,
    preferencesError,
    preferencesSyncStatus,
  } = useApp();

  return (
    <>
      {/* Preferences: Appearance & Notification Sound */}
      <div className="py-1">
        <div className="px-4 py-2 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t('appearance')}</span>
          <button
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'pitch-black' : 'light')}
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            title={theme === 'light' ? t('pitchBlack') : t('lightMode')}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            <span>{theme === 'light' ? t('pitchBlack') : t('lightMode')}</span>
          </button>
        </div>

        <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <Volume2 className="w-3.5 h-3.5 text-gray-400" />
            <span>{pickText({ ar: 'النغمة', fr: 'Son', en: 'Sound' }, language)}</span>
          </span>
          <button
            type="button"
            aria-label="Notification sound"
            onClick={() => {
              const idx = NOTIFICATION_SOUNDS.indexOf(notificationSound);
              setNotificationSound(NOTIFICATION_SOUNDS[(idx + 1) % NOTIFICATION_SOUNDS.length]);
            }}
            className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
          >
            {notificationSound}
          </button>
        </div>

        <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
            {soundMuted ? <VolumeX className="w-3.5 h-3.5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5 text-gray-400" />}
            <span>{pickText({ ar: 'كتم الصوت', fr: 'Muet', en: 'Mute' }, language)}</span>
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
            <span>{pickText({ ar: 'الاهتزاز', fr: 'Vibration', en: 'Vibration' }, language)}</span>
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
              onClick={() => { setActiveTab('home'); setShowProfileMenu(false); }}
              className="w-full text-start px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4 text-gray-400" />
              <span>{t('profile')}</span>
            </button>
            {!currentUser.telegramLinked && (
              <button
                type="button"
                onClick={() => { startTelegramLink(); setShowProfileMenu(false); }}
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
            onClick={() => { logout(); setShowProfileMenu(false); }}
            className="w-full text-start px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setShowAuthModal(true); setShowProfileMenu(false); }}
            className="w-full text-start px-4 py-2 text-xs font-semibold text-k-brand hover:bg-k-brand/10"
          >
            {t('login')}
          </button>
        )}
      </div>
    </>
  );
};
