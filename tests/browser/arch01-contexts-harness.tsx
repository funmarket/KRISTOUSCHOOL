import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IdentityProvider } from '../../src/context/IdentityContext';
import { PreferencesProvider, usePreferences } from '../../src/context/PreferencesContext';
import { NotificationProvider, useNotifications } from '../../src/context/NotificationContext';
import type { Language, User } from '../../src/types';
import type { AccountIdentityContext } from '../../src/lib/appStateGuards';

// Controlled browser-test fetch boundary for https://example.supabase.co; not live Supabase evidence.
type PreferenceMode = 'ready' | 'save-error' | 'load-blocked' | 'load-denied';
type NotificationMode = 'ready' | 'mark-denied' | 'pending';

interface Arch01Bridge {
  setPreferenceMode: (mode: PreferenceMode) => void;
  setNotificationMode: (mode: NotificationMode) => void;
  hydratePreferences: () => Promise<void>;
  hydrateNotifications: () => Promise<void>;
  setLanguage: (lang: Language) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  completePendingRead: () => void;
  switchActorB: () => void;
  logout: () => void;
}

interface Arch01Window extends Window {
  __arch01?: Arch01Bridge;
  __arch01Ready?: boolean;
}

const INITIAL_IDENTITY: AccountIdentityContext = {
  userId: 'arch-user-a',
  accountStatus: 'APPROVED',
  generation: 1,
};

const identityRef: { current: AccountIdentityContext } = { current: { ...INITIAL_IDENTITY } };
const currentUserRef: { current: User | null } = {
  current: { id: 'arch-user-a', accountStatus: 'APPROVED' } as User,
};
let preferenceMode: PreferenceMode = 'ready';
let notificationMode: NotificationMode = 'ready';
let resolvePendingRead: ((res: Response) => void) | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makePrefsRow(language: 'en' | 'fr') {
  return {
    language,
    theme: 'light',
    notification_sound: 'Kristou Bell',
    sound_muted: false,
    vibration_enabled: true,
  };
}

function makeNotificationRow(id: string) {
  return {
    id,
    category: 'system',
    title: 'Controlled notice',
    body: 'Transport boundary fixture',
    target_tab: null,
    target_ref_id: null,
    is_read: false,
    created_at: '2026-11-21T09:00:00Z',
  };
}

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (!url.startsWith('https://example.supabase.co/rest/v1/')) {
    return nativeFetch(input, init);
  }

  if (url.includes('/rest/v1/user_preferences')) {
    if (preferenceMode === 'load-blocked') {
      return jsonResponse(
        { code: 'PGRST205', message: "Could not find the table 'public.user_preferences' in the schema cache" },
        404,
      );
    }
    if (preferenceMode === 'load-denied') {
      return jsonResponse({ code: '42501', message: 'access_denied' }, 403);
    }
    return jsonResponse(makePrefsRow(currentUserRef.current?.id === 'arch-user-b' ? 'en' : 'fr'));
  }

  if (url.includes('/rest/v1/rpc/upsert_my_preferences')) {
    if (preferenceMode === 'save-error') {
      return jsonResponse({ code: 'P0001', message: 'save_failed' }, 400);
    }
    return jsonResponse(makePrefsRow('fr'));
  }

  if (url.includes('/rest/v1/user_notifications')) {
    return jsonResponse([
      makeNotificationRow(currentUserRef.current?.id === 'arch-user-b' ? 'note-b' : 'note-a'),
    ]);
  }

  if (url.includes('/rest/v1/rpc/mark_user_notification_read')) {
    if (notificationMode === 'pending') {
      return new Promise<Response>((resolve) => {
        resolvePendingRead = resolve;
      });
    }
    if (notificationMode === 'mark-denied') {
      return jsonResponse({ code: '42501', message: 'access_denied' }, 403);
    }
    return jsonResponse(true);
  }

  if (url.includes('/rest/v1/rpc/mark_all_user_notifications_read')) {
    if (notificationMode === 'mark-denied') {
      return jsonResponse({ code: '42501', message: 'access_denied' }, 403);
    }
    return jsonResponse(1);
  }

  return jsonResponse({ code: 'PGRST202', message: 'Unexpected test endpoint' }, 404);
};

function Probe({ onSwitch }: { onSwitch: () => void }) {
  const p = usePreferences();
  const n = useNotifications();

  useEffect(() => {
    const win = window as Arch01Window;
    win.__arch01 = {
      setPreferenceMode: (mode) => {
        preferenceMode = mode;
      },
      setNotificationMode: (mode) => {
        notificationMode = mode;
      },
      hydratePreferences: () => p.hydratePreferencesForAccount(identityRef.current),
      hydrateNotifications: () => n.hydrateNotificationsForAccount(identityRef.current),
      setLanguage: p.setLanguage,
      markRead: n.markNotificationRead,
      markAllRead: n.markAllNotificationsRead,
      completePendingRead: () => {
        const resolve = resolvePendingRead;
        resolvePendingRead = null;
        resolve?.(jsonResponse(true));
      },
      switchActorB: () => {
        currentUserRef.current = { id: 'arch-user-b', accountStatus: 'APPROVED' } as User;
        identityRef.current = {
          userId: 'arch-user-b',
          accountStatus: 'APPROVED',
          generation: identityRef.current.generation + 1,
        };
        p.syncPreferencesIdentity(identityRef.current);
        n.syncNotificationsIdentity(identityRef.current);
        p.resetPreferencesState();
        onSwitch();
      },
      logout: () => {
        currentUserRef.current = null;
        identityRef.current = {
          userId: null,
          accountStatus: null,
          generation: identityRef.current.generation + 1,
        };
        p.syncPreferencesIdentity(identityRef.current);
        n.syncNotificationsIdentity(identityRef.current);
        p.resetPreferencesState();
        n.clearNotificationsState();
        onSwitch();
      },
    };
    win.__arch01Ready = true;
  }, [p, n, onSwitch]);

  return (
    <pre data-testid="arch01-state">
      {JSON.stringify({
        language: p.language,
        theme: p.theme,
        preferenceStatus: p.preferencesSyncStatus,
        preferenceError: p.preferencesError,
        notifications: n.notifications,
        notificationError: n.notificationsError,
        markingAll: n.markingAllNotifications,
      })}
    </pre>
  );
}

function Fixture() {
  const [, setRevision] = useState(1);
  return (
    <PreferencesProvider initialIdentity={INITIAL_IDENTITY}>
      <IdentityProvider>
        <NotificationProvider initialIdentity={INITIAL_IDENTITY}>
          <Probe onSwitch={() => setRevision((value) => value + 1)} />
        </NotificationProvider>
      </IdentityProvider>
    </PreferencesProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
