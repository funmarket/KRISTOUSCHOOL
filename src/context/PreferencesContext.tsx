import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { BackendOpResult, Language, NotificationSoundOption, ThemeMode } from '../types';
import { translations, type TranslationKey } from '../i18n/translations';
import { loadMyPreferences, saveMyPreferences } from '../lib/domains/preferences';
import {
  isMatchingApprovedAccountContext,
  resolvePreferencesPersistOutcome,
  type AccountIdentityContext,
  type PreferencesSyncStatus,
} from '../lib/appStateGuards';

export interface PreferencesContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  t: (key: TranslationKey) => string;
  dir: 'rtl' | 'ltr';
  notificationSound: NotificationSoundOption;
  setNotificationSound: (sound: NotificationSoundOption) => void;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (enabled: boolean) => void;
  preferencesError: string | null;
  preferencesSyncStatus: PreferencesSyncStatus;
  syncPreferencesIdentity: (identity: AccountIdentityContext) => void;
  hydratePreferencesForAccount: (origin: AccountIdentityContext) => Promise<void>;
  resetPreferencesState: () => void;
}

export const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const SOUND_OPTIONS: readonly NotificationSoundOption[] = [
  'Kristou Bell',
  'Soft Chime',
  'Classroom Bell',
  'Gentle Pop',
  'Silent',
];

function sanitizeSound(raw: string | null): NotificationSoundOption {
  if (raw && (SOUND_OPTIONS as readonly string[]).includes(raw)) {
    return raw as NotificationSoundOption;
  }
  return 'Kristou Bell';
}

function readStorage(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage write errors in restricted environments.
  }
}

export const PreferencesProvider: React.FC<{
  children: React.ReactNode;
  initialIdentity?: AccountIdentityContext;
}> = ({ children, initialIdentity }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = readStorage('kristou_lang');
    return saved === 'ar' || saved === 'fr' || saved === 'en' || saved === 'es' || saved === 'de' || saved === 'pt' ? saved : 'fr';
  });
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = readStorage('kristou_theme');
    return saved === 'pitch-black' ? 'pitch-black' : 'light';
  });
  const [notificationSound, setNotificationSoundState] = useState<NotificationSoundOption>(() =>
    sanitizeSound(readStorage('kristou_notification_sound')),
  );
  const [soundMuted, setSoundMutedState] = useState<boolean>(
    () => readStorage('kristou_sound_muted') === 'true',
  );
  const [vibrationEnabled, setVibrationEnabledState] = useState<boolean>(
    () => readStorage('kristou_vibration_enabled') !== 'false',
  );
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesSyncStatus, setPreferencesSyncStatus] = useState<PreferencesSyncStatus>('LOCAL_ONLY');

  const mountedRef = useRef<boolean>(true);
  const identityRef = useRef<AccountIdentityContext>(
    initialIdentity ?? {
      userId: null,
      accountStatus: null,
      generation: 1,
    },
  );
  const prefsGenRef = useRef<number>(0);
  const preferencesErrorRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    preferencesErrorRef.current = preferencesError;
  }, [preferencesError]);

  const dir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
    }
  }, [dir, language]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'pitch-black') {
        document.documentElement.classList.add('dark', 'pitch-black');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark', 'pitch-black');
      }
    }
    writeStorage('kristou_theme', theme);
  }, [theme]);

  const syncPreferencesIdentity = useCallback((identity: AccountIdentityContext) => {
    const prev = identityRef.current;
    const changed =
      prev.generation !== identity.generation ||
      prev.userId !== identity.userId ||
      prev.accountStatus !== identity.accountStatus;
    identityRef.current = identity;
    if (changed) {
      prefsGenRef.current += 1;
      preferencesErrorRef.current = null;
      setPreferencesError(null);
      if (!identity.userId || identity.accountStatus !== 'APPROVED') {
        setPreferencesSyncStatus('LOCAL_ONLY');
      }
    }
  }, []);

  const resetPreferencesState = useCallback(() => {
    prefsGenRef.current += 1;
    preferencesErrorRef.current = null;
    setPreferencesError(null);
    setPreferencesSyncStatus('LOCAL_ONLY');
  }, []);

  const hydratePreferencesForAccount = useCallback(
    async (origin: AccountIdentityContext) => {
      if (!origin.userId || origin.accountStatus !== 'APPROVED') {
        return;
      }
      syncPreferencesIdentity(origin);
      const hydrateSeq = ++prefsGenRef.current;
      const prefsRes = await loadMyPreferences(origin.userId);
      if (
        !isMatchingApprovedAccountContext(origin, identityRef.current, mountedRef.current) ||
        hydrateSeq !== prefsGenRef.current
      ) {
        return;
      }
      if (prefsRes.ok && prefsRes.data) {
        setLanguageState(prefsRes.data.language);
        writeStorage('kristou_lang', prefsRes.data.language);
        setThemeState(prefsRes.data.theme);
        writeStorage('kristou_theme', prefsRes.data.theme);
        setNotificationSoundState(prefsRes.data.notificationSound);
        writeStorage('kristou_notification_sound', prefsRes.data.notificationSound);
        setSoundMutedState(prefsRes.data.soundMuted);
        writeStorage('kristou_sound_muted', String(prefsRes.data.soundMuted));
        setVibrationEnabledState(prefsRes.data.vibrationEnabled);
        writeStorage('kristou_vibration_enabled', String(prefsRes.data.vibrationEnabled));
        preferencesErrorRef.current = null;
        setPreferencesError(null);
        setPreferencesSyncStatus('SAVED');
      } else if (prefsRes.ok && !prefsRes.data) {
        preferencesErrorRef.current = null;
        setPreferencesError(null);
        setPreferencesSyncStatus('LOCAL_ONLY');
      } else if (prefsRes.status === 'BLOCKED_BACKEND') {
        setPreferencesSyncStatus('UNAVAILABLE');
      } else if (!prefsRes.ok) {
        setPreferencesSyncStatus('ERROR');
        setPreferencesError(prefsRes.errorMessage || prefsRes.errorCode || 'Unable to load preferences.');
      }
    },
    [syncPreferencesIdentity],
  );

  const persistPreferencesUpdate = useCallback(
    (patch: {
      language?: Language;
      theme?: ThemeMode;
      notificationSound?: NotificationSoundOption;
      soundMuted?: boolean;
      vibrationEnabled?: boolean;
    }) => {
      const current = identityRef.current;
      if (!current.userId || current.accountStatus !== 'APPROVED') {
        setPreferencesSyncStatus('LOCAL_ONLY');
        return;
      }

      const origin: AccountIdentityContext = {
        userId: current.userId,
        accountStatus: current.accountStatus,
        generation: current.generation,
      };
      const requestSeq = ++prefsGenRef.current;
      setPreferencesSyncStatus('SAVING');

      void saveMyPreferences(patch)
        .catch((err): BackendOpResult<unknown> => ({
          ok: false,
          status: 'ERROR',
          errorCode: 'preference_save_failed',
          errorMessage: err instanceof Error ? err.message : 'Failed to save preferences.',
        }))
        .then((result) => {
          const outcome = resolvePreferencesPersistOutcome({
            result,
            origin,
            current: identityRef.current,
            requestSeq,
            latestRequestSeq: prefsGenRef.current,
            previousError: preferencesErrorRef.current,
            isMounted: mountedRef.current,
          });
          if (outcome.ignored) return;
          setPreferencesSyncStatus(outcome.syncStatus);
          setPreferencesError(outcome.error);
        });
    },
    [],
  );

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      writeStorage('kristou_lang', lang);
      persistPreferencesUpdate({ language: lang });
    },
    [persistPreferencesUpdate],
  );

  const setTheme = useCallback(
    (thm: ThemeMode) => {
      setThemeState(thm);
      writeStorage('kristou_theme', thm);
      persistPreferencesUpdate({ theme: thm });
    },
    [persistPreferencesUpdate],
  );

  const setNotificationSound = useCallback(
    (sound: NotificationSoundOption) => {
      setNotificationSoundState(sound);
      writeStorage('kristou_notification_sound', sound);
      persistPreferencesUpdate({ notificationSound: sound });
    },
    [persistPreferencesUpdate],
  );

  const setSoundMuted = useCallback(
    (muted: boolean) => {
      setSoundMutedState(muted);
      writeStorage('kristou_sound_muted', String(muted));
      persistPreferencesUpdate({ soundMuted: muted });
    },
    [persistPreferencesUpdate],
  );

  const setVibrationEnabled = useCallback(
    (enabled: boolean) => {
      setVibrationEnabledState(enabled);
      writeStorage('kristou_vibration_enabled', String(enabled));
      persistPreferencesUpdate({ vibrationEnabled: enabled });
    },
    [persistPreferencesUpdate],
  );

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = translations[language] || translations.en;
      return dict[key] || translations.en[key] || key;
    },
    [language],
  );

  return (
    <PreferencesContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        t,
        dir,
        notificationSound,
        setNotificationSound,
        soundMuted,
        setSoundMuted,
        vibrationEnabled,
        setVibrationEnabled,
        preferencesError,
        preferencesSyncStatus,
        syncPreferencesIdentity,
        hydratePreferencesForAccount,
        resetPreferencesState,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
