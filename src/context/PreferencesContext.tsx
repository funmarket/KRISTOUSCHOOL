import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BackendOpResult, Language, NotificationSoundOption, ThemeMode, User, UserPreferencesState } from '../types';
import { loadMyPreferences, saveMyPreferences } from '../lib/domains/preferences';
import {
  isMatchingApprovedAccountContext,
  resolvePreferencesPersistOutcome,
  type AccountIdentityContext,
  type PreferencesSyncStatus,
} from '../lib/appStateGuards';

export interface PreferencesIdentityAccess {
  readonly generation: number;
  getUser: () => User | null;
  getIdentity: () => AccountIdentityContext;
  isMounted: () => boolean;
}
export interface PreferencesServices {
  loadMyPreferences: (userId: string) => Promise<BackendOpResult<UserPreferencesState | null>>;
  saveMyPreferences: (patch: Partial<UserPreferencesState>) => Promise<BackendOpResult<UserPreferencesState>>;
}
export interface PreferencesActions {
  hydrate: (userId: string, isStillValid: () => boolean) => Promise<void>;
  clear: () => void;
  getLanguage: () => Language;
}
export interface PreferencesContextValue extends PreferencesActions {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  notificationSound: NotificationSoundOption;
  setNotificationSound: (sound: NotificationSoundOption) => void;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (enabled: boolean) => void;
  preferencesError: string | null;
  preferencesSyncStatus: PreferencesSyncStatus;
}
const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const defaultServices: PreferencesServices = { loadMyPreferences, saveMyPreferences };
const SOUND_OPTIONS: readonly NotificationSoundOption[] = [
  'Kristou Bell', 'Soft Chime', 'Classroom Bell', 'Gentle Pop', 'Silent',
];
function sanitizeSound(raw: string | null): NotificationSoundOption {
  if (raw && (SOUND_OPTIONS as readonly string[]).includes(raw)) return raw as NotificationSoundOption;
  return 'Kristou Bell';
}

export const PreferencesProvider: React.FC<{
  children: React.ReactNode;
  identity: PreferencesIdentityAccess;
  services?: PreferencesServices;
  onRegister?: (actions: PreferencesActions | null) => void;
}> = ({ children, identity, services = defaultServices, onRegister }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('kristou_lang');
    return saved === 'ar' || saved === 'fr' || saved === 'en' ? saved : 'fr';
  });
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    localStorage.getItem('kristou_theme') === 'pitch-black' ? 'pitch-black' : 'light',
  );
  const [notificationSound, setNotificationSoundState] = useState<NotificationSoundOption>(() =>
    sanitizeSound(localStorage.getItem('kristou_notification_sound')),
  );
  const [soundMuted, setSoundMutedState] = useState<boolean>(
    () => localStorage.getItem('kristou_sound_muted') === 'true',
  );
  const [vibrationEnabled, setVibrationEnabledState] = useState<boolean>(
    () => localStorage.getItem('kristou_vibration_enabled') !== 'false',
  );
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesSyncStatus, setPreferencesSyncStatus] = useState<PreferencesSyncStatus>('LOCAL_ONLY');
  const prefsGenRef = useRef(0);
  const preferencesErrorRef = useRef<string | null>(null);

  useEffect(() => { preferencesErrorRef.current = preferencesError; }, [preferencesError]);
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    if (theme === 'pitch-black') {
      document.documentElement.classList.add('dark', 'pitch-black');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark', 'pitch-black');
    }
    localStorage.setItem('kristou_theme', theme);
  }, [theme]);

  const clear = useCallback(() => {
    prefsGenRef.current += 1;
    preferencesErrorRef.current = null;
    setPreferencesError(null);
    setPreferencesSyncStatus('LOCAL_ONLY');
  }, []);

  useLayoutEffect(() => { clear(); }, [identity.generation, clear]);

  const hydrate = useCallback(async (userId: string, isStillValid: () => boolean) => {
    const origin = identity.getIdentity();
    const sequence = prefsGenRef.current;
    const res = await services.loadMyPreferences(userId);
    if (!isStillValid() || sequence !== prefsGenRef.current ||
      !isMatchingApprovedAccountContext(origin, identity.getIdentity(), identity.isMounted())) return;
    if (res.ok && res.data) {
      setLanguageState(res.data.language);
      localStorage.setItem('kristou_lang', res.data.language);
      setThemeState(res.data.theme);
      localStorage.setItem('kristou_theme', res.data.theme);
      setNotificationSoundState(res.data.notificationSound);
      localStorage.setItem('kristou_notification_sound', res.data.notificationSound);
      setSoundMutedState(res.data.soundMuted);
      localStorage.setItem('kristou_sound_muted', String(res.data.soundMuted));
      setVibrationEnabledState(res.data.vibrationEnabled);
      localStorage.setItem('kristou_vibration_enabled', String(res.data.vibrationEnabled));
      preferencesErrorRef.current = null;
      setPreferencesError(null);
      setPreferencesSyncStatus('SAVED');
    } else if (res.status === 'BLOCKED_BACKEND') {
      setPreferencesSyncStatus('UNAVAILABLE');
    } else if (!res.ok) {
      setPreferencesSyncStatus('ERROR');
      setPreferencesError(res.errorMessage || res.errorCode || 'Unable to load preferences.');
    }
  }, [identity, services]);

  const persistPreferencesUpdate = (patch: Partial<UserPreferencesState>) => {
    const user = identity.getUser();
    if (!user || user.accountStatus !== 'APPROVED' || user.id !== identity.getIdentity().userId) {
      setPreferencesSyncStatus('LOCAL_ONLY');
      return;
    }
    const origin = identity.getIdentity();
    const requestSeq = ++prefsGenRef.current;
    setPreferencesSyncStatus('SAVING');
    void services.saveMyPreferences(patch)
      .catch((err): BackendOpResult<unknown> => ({
        ok: false, status: 'ERROR', errorCode: 'preference_save_failed',
        errorMessage: err instanceof Error ? err.message : 'Failed to save preferences.',
      }))
      .then((result) => {
        const outcome = resolvePreferencesPersistOutcome({
          result, origin, current: identity.getIdentity(),
          requestSeq, latestRequestSeq: prefsGenRef.current,
          previousError: preferencesErrorRef.current,
          isMounted: identity.isMounted(),
        });
        if (outcome.ignored) return;
        preferencesErrorRef.current = outcome.error;
        setPreferencesSyncStatus(outcome.syncStatus);
        setPreferencesError(outcome.error);
      });
  };

  const setLanguage = (value: Language) => {
    setLanguageState(value);
    localStorage.setItem('kristou_lang', value);
    persistPreferencesUpdate({ language: value });
  };
  const setTheme = (value: ThemeMode) => {
    setThemeState(value);
    localStorage.setItem('kristou_theme', value);
    persistPreferencesUpdate({ theme: value });
  };
  const setNotificationSound = (value: NotificationSoundOption) => {
    setNotificationSoundState(value);
    localStorage.setItem('kristou_notification_sound', value);
    persistPreferencesUpdate({ notificationSound: value });
  };
  const setSoundMuted = (value: boolean) => {
    setSoundMutedState(value);
    localStorage.setItem('kristou_sound_muted', String(value));
    persistPreferencesUpdate({ soundMuted: value });
  };
  const setVibrationEnabled = (value: boolean) => {
    setVibrationEnabledState(value);
    localStorage.setItem('kristou_vibration_enabled', String(value));
    persistPreferencesUpdate({ vibrationEnabled: value });
  };

  useLayoutEffect(() => {
    onRegister?.({ hydrate, clear, getLanguage: () => language });
    return () => onRegister?.(null);
  }, [hydrate, clear, language, onRegister]);

  return (
    <PreferencesContext.Provider value={{
      language, setLanguage, theme, setTheme,
      notificationSound, setNotificationSound, soundMuted, setSoundMuted,
      vibrationEnabled, setVibrationEnabled, preferencesError, preferencesSyncStatus,
      hydrate, clear, getLanguage: () => language,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
}

