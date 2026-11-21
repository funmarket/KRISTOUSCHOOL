import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PreferencesProvider, usePreferences } from '../../src/context/PreferencesContext';
import { NotificationProvider, useNotifications } from '../../src/context/NotificationContext';
import type { BackendOpResult, NotificationItem, User, UserPreferencesState } from '../../src/types';
import type { AccountIdentityContext } from '../../src/lib/appStateGuards';

// All service responses below are controlled browser-test boundaries, not live Supabase evidence.
const identityRef = { current: { userId: 'arch-user-a', accountStatus: 'APPROVED', generation: 1 } as AccountIdentityContext };
const currentUserRef = { current: { id: 'arch-user-a', accountStatus: 'APPROVED' } as User | null };
let preferenceMode: 'ready' | 'save-error' | 'load-blocked' | 'load-denied' = 'ready';
let notificationMode: 'ready' | 'mark-denied' | 'pending' = 'ready';
let resolvePendingRead: ((value: BackendOpResult<boolean>) => void) | null = null;

const makePrefs = (language: 'en' | 'fr'): UserPreferencesState => ({
  language, theme: 'light', notificationSound: 'Kristou Bell',
  soundMuted: false, vibrationEnabled: true,
});
const mkItem = (id: string): NotificationItem => ({
  id, title: 'Controlled notice', message: 'Transport boundary fixture', time: '2026-11-21',
  read: false, type: 'system',
});
const prefsServices = {
  loadMyPreferences: async (): Promise<BackendOpResult<UserPreferencesState | null>> => {
    if (preferenceMode === 'load-blocked') {
      return { ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' };
    }
    if (preferenceMode === 'load-denied') {
      return { ok: false, status: 'UNAUTHORIZED', errorCode: 'access_denied' };
    }
    return { ok: true, status: 'READY', data: makePrefs(currentUserRef.current?.id === 'arch-user-b' ? 'en' : 'fr') };
  },
  saveMyPreferences: async (): Promise<BackendOpResult<UserPreferencesState>> =>
    preferenceMode === 'save-error'
      ? { ok: false, status: 'ERROR', errorCode: 'save_failed' }
      : { ok: true, status: 'READY', data: makePrefs('fr') },
};
const notificationServices = {
  listMyNotifications: async (): Promise<BackendOpResult<NotificationItem[]>> => ({
    ok: true, status: 'READY', data: [
      mkItem(currentUserRef.current?.id === 'arch-user-b' ? 'note-b' : 'note-a'),
    ],
  }),
  markNotificationReadOnServer: async (): Promise<BackendOpResult<boolean>> => {
    if (notificationMode === 'pending') {
      return new Promise<BackendOpResult<boolean>>(resolve => { resolvePendingRead = resolve; });
    }
    if (notificationMode === 'mark-denied') {
      return { ok: false, status: 'UNAUTHORIZED', errorCode: 'access_denied' };
    }
    return { ok: true, status: 'READY', data: true };
  },
  markAllNotificationsReadOnServer: async (): Promise<BackendOpResult<number>> =>
    notificationMode === 'mark-denied'
      ? { ok: false, status: 'UNAUTHORIZED', errorCode: 'access_denied' }
      : { ok: true, status: 'READY', data: 1 },
};

function Probe({ onSwitch }: { onSwitch: () => void }) {
  const p = usePreferences();
  const n = useNotifications();
  useEffect(() => {
    (window as any).__arch01 = {
      setPreferenceMode: (mode: typeof preferenceMode) => { preferenceMode = mode; },
      setNotificationMode: (mode: typeof notificationMode) => { notificationMode = mode; },
      hydratePreferences: () => p.hydrate(identityRef.current.userId!, () => true),
      hydrateNotifications: () => n.hydrate(() => true),
      setLanguage: p.setLanguage,
      markRead: n.markNotificationRead,
      markAllRead: n.markAllNotificationsRead,
      completePendingRead: () => {
        const resolve = resolvePendingRead;
        resolvePendingRead = null;
        resolve?.({ ok: true, status: 'READY', data: true });
      },
      switchActorB: () => {
        currentUserRef.current = { id: 'arch-user-b', accountStatus: 'APPROVED' } as User;
        identityRef.current = { userId: 'arch-user-b', accountStatus: 'APPROVED', generation: identityRef.current.generation + 1 };
        p.clear(); n.clear(); onSwitch();
      },
      logout: () => {
        currentUserRef.current = null;
        identityRef.current = { userId: null, accountStatus: null, generation: identityRef.current.generation + 1 };
        p.clear(); n.clear(); onSwitch();
      },
    };
    (window as any).__arch01Ready = true;
  }, [p, n, onSwitch]);
  return <pre data-testid="arch01-state">{JSON.stringify({
    language: p.language, theme: p.theme, preferenceStatus: p.preferencesSyncStatus,
    preferenceError: p.preferencesError, notifications: n.notifications,
    notificationError: n.notificationsError, markingAll: n.markingAllNotifications,
  })}</pre>;
}

function Fixture() {
  const [generation, setGeneration] = useState(1);
  const identity = {
    generation,
    getUser: () => currentUserRef.current,
    getIdentity: () => identityRef.current,
    isMounted: () => true,
  };
  return (
    <PreferencesProvider identity={identity} services={prefsServices}>
      <NotificationProvider identity={identity} services={notificationServices}>
        <Probe onSwitch={() => setGeneration(value => value + 1)} />
      </NotificationProvider>
    </PreferencesProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);

