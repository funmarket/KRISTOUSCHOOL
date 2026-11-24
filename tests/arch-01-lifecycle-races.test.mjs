import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';

const dom = installNodeDomShim();
const classSet = new Set();
dom.document.documentElement.classList = {
  add: (...cls) => cls.forEach((c) => classSet.add(c)),
  remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
  contains: (c) => classSet.has(c),
};
const { createRoot } = await import('react-dom/client');

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function installStorageMock() {
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
  };
  return storageMap;
}

async function bundleComposedAppProvider() {
  const outdir = path.join('/tmp', 'kristou-arch01-races-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, 'app-context.cjs');
  const domainsParentNotesAbs = path.resolve(ROOT, 'src/lib/domains/parentNotes.ts');

  await build({
    entryPoints: [path.resolve(ROOT, 'src/context/AppContext.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    plugins: [
      {
        name: 'arch01-composed-mocks',
        setup(builder) {
          builder.onResolve({ filter: /lib\/supabase(\.ts)?$/ }, () => ({
            path: 'mock-supabase',
            namespace: 'arch01race',
          }));
          builder.onLoad({ filter: /^mock-supabase$/, namespace: 'arch01race' }, () => ({
            contents: `
              export const supabase = {
                auth: {
                  getSession: (...args) => globalThis.__ARCH01_RACE_SUPABASE__.auth.getSession(...args),
                  onAuthStateChange: (...args) => globalThis.__ARCH01_RACE_SUPABASE__.auth.onAuthStateChange(...args),
                },
              };
            `,
            resolveDir: ROOT,
          }));

          builder.onResolve({ filter: /lib\/auth(\.ts)?$/ }, () => ({
            path: 'mock-auth',
            namespace: 'arch01race',
          }));
          builder.onLoad({ filter: /^mock-auth$/, namespace: 'arch01race' }, () => ({
            contents: `
              export const loadCanonicalUser = (...args) => globalThis.__ARCH01_RACE_AUTH__.loadCanonicalUser(...args);
              export const signInAccount = (...args) => globalThis.__ARCH01_RACE_AUTH__.signInAccount(...args);
              export const signOutAccount = (...args) => globalThis.__ARCH01_RACE_AUTH__.signOutAccount(...args);
              export const signUpAccount = (...args) => globalThis.__ARCH01_RACE_AUTH__.signUpAccount(...args);
              export const createTelegramLinkChallenge = async () => ({ linkUrl: '' });
              export const authenticateTelegramInitData = async () => ({ user: null, linked: false });
            `,
            resolveDir: ROOT,
          }));

          builder.onResolve({ filter: /lib\/telegram(\.ts)?$/ }, () => ({
            path: 'mock-telegram',
            namespace: 'arch01race',
          }));
          builder.onLoad({ filter: /^mock-telegram$/, namespace: 'arch01race' }, () => ({
            contents: `
              export const initializeTelegramWebApp = () => {};
              export const getTelegramWebAppInitData = () => null;
            `,
            resolveDir: ROOT,
          }));

          builder.onResolve({ filter: /lib\/domains\/preferences(\.ts)?$/ }, () => ({
            path: 'mock-preferences',
            namespace: 'arch01race',
          }));
          builder.onLoad({ filter: /^mock-preferences$/, namespace: 'arch01race' }, () => ({
            contents: `
              export const loadMyPreferences = (...args) => globalThis.__ARCH01_RACE_PREFS__.loadMyPreferences(...args);
              export const saveMyPreferences = (...args) => globalThis.__ARCH01_RACE_PREFS__.saveMyPreferences(...args);
              export const fetchUserPreferences = loadMyPreferences;
              export const updateUserPreferences = saveMyPreferences;
            `,
            resolveDir: ROOT,
          }));

          builder.onResolve({ filter: /lib\/domains\/notifications(\.ts)?$/ }, () => ({
            path: 'mock-notifications',
            namespace: 'arch01race',
          }));
          builder.onLoad({ filter: /^mock-notifications$/, namespace: 'arch01race' }, () => ({
            contents: `
              export const listMyNotifications = (...args) => globalThis.__ARCH01_RACE_NOTIFS__.listMyNotifications(...args);
              export const listNotifications = listMyNotifications;
              export const markNotificationReadOnServer = (...args) => globalThis.__ARCH01_RACE_NOTIFS__.markNotificationReadOnServer(...args);
              export const markAllNotificationsReadOnServer = (...args) => globalThis.__ARCH01_RACE_NOTIFS__.markAllNotificationsReadOnServer(...args);
            `,
            resolveDir: ROOT,
          }));

          builder.onResolve({ filter: /lib\/schoolContent(\.ts)?$/ }, () => ({
            path: 'mock-school-content',
            namespace: 'arch01race',
          }));
          builder.onLoad({ filter: /^mock-school-content$/, namespace: 'arch01race' }, () => ({
            contents: `
              export {
                getParentNotesQuotaDay,
                getRemainingParentNotesQuota,
                getTunisTimeParts,
                isWithinParentNotesTunisWindow,
                PARENT_NOTES_DAILY_QUOTA,
              } from ${JSON.stringify(domainsParentNotesAbs)};
              export const listParentNotes = async () => ({ ok: true, status: 'READY', data: [] });
              export const sendParentNote = async () => ({ ok: false, status: 'ERROR', errorCode: 'unused' });
              export const replyParentNote = async () => ({ ok: false, status: 'ERROR', errorCode: 'unused' });
              export const listMessageThreads = async () => ({ ok: true, status: 'READY', data: [] });
              export const listClassAnnouncements = async () => ({ ok: true, status: 'READY', data: [] });
              export const listClassHomework = async () => ({ ok: true, status: 'READY', data: [] });
              export const listClassDocuments = async () => ({ ok: true, status: 'READY', data: [] });
              export const listClassGallery = async () => ({ ok: true, status: 'READY', data: [] });
              export const listClassQuestions = async () => ({ ok: true, status: 'READY', data: [] });
              export const postClassQuestion = async () => ({ ok: false, status: 'ERROR', errorCode: 'unused' });
              export const replyClassQuestion = async () => ({ ok: false, status: 'ERROR', errorCode: 'unused' });
              export const moderateClassQuestion = async () => ({ ok: false, status: 'ERROR', errorCode: 'unused' });
              export const listPublicAnnouncements = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listSchoolBroadcasts = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listPublicCalendarEvents = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listSchoolCalendarEvents = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listPublicFoodMenu = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const fetchActiveFoodMenu = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listPublicTeachers = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listPublicAdmins = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listPublicDirectory = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listPublicContent = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const fetchPublicContent = async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
              export const listClassCommunityContent = async () => ({ ok: true, status: 'READY', data: { announcements: [], homework: [], documents: [], gallery: [], questions: [] } });
            `,
            resolveDir: ROOT,
          }));

          builder.onResolve({ filter: /lib\/schoolOperations(\.ts)?$/ }, () => ({
            path: 'mock-school-ops',
            namespace: 'arch01race',
          }));
          builder.onLoad({ filter: /^mock-school-ops$/, namespace: 'arch01race' }, () => ({
            contents: `
              export const fetchMySchoolContext = async () => ({
                ok: true,
                status: 'READY',
                data: { children: [], classes: [], operationalCounts: {}, linkedChildrenIds: [], assignedClassIds: [] },
              });
              export const fetchSchoolClassesWithRosters = async () => ({ ok: true, status: 'READY', data: [] });
              export const listEnrollmentApplications = async () => ({ ok: true, status: 'READY', data: [] });
              export const listPublicInquiries = async () => ({ ok: false, status: 'UNAUTHORIZED', errorCode: 'unauthorized' });
            `,
            resolveDir: ROOT,
          }));

          builder.onResolve({ filter: /^[^./]/ }, (args) => ({
            path: require.resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  });

  return require(outfile);
}

const { AppProvider, useApp } = await bundleComposedAppProvider();

function flushAsync(ms = 25) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeUser(id) {
  return {
    id,
    username: `${id}.user`,
    fullName: `User ${id}`,
    role: 'PARENT',
    accountStatus: 'APPROVED',
    capabilities: ['PARENT'],
  };
}

function makeDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test('ARCH-01 Issue 1: Microtask settling between synchronous logout() and React commit cannot mutate cleared state', async () => {
  installStorageMock();
  let authListener = null;

  globalThis.__ARCH01_RACE_SUPABASE__ = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (cb) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
  globalThis.__ARCH01_RACE_AUTH__ = {
    loadCanonicalUser: async (u) => makeUser(u.id),
    signInAccount: async (identifier) => ({ user: { id: 'user-a', email: identifier } }),
    signOutAccount: async () => {},
    signUpAccount: async () => ({ session: null }),
  };

  let deferredPrefsLoad = null;
  globalThis.__ARCH01_RACE_PREFS__ = {
    loadMyPreferences: async () => {
      if (deferredPrefsLoad) return deferredPrefsLoad.promise;
      return {
        ok: true,
        status: 'READY',
        data: {
          language: 'ar',
          theme: 'pitch-black',
          notificationSound: 'Soft Chime',
          soundMuted: false,
          vibrationEnabled: true,
        },
      };
    },
    saveMyPreferences: async (patch) => ({
      ok: true,
      status: 'READY',
      data: {
        language: patch.language ?? 'fr',
        theme: patch.theme ?? 'light',
        notificationSound: 'Kristou Bell',
        soundMuted: false,
        vibrationEnabled: true,
      },
    }),
  };

  let deferredMarkRead = null;
  globalThis.__ARCH01_RACE_NOTIFS__ = {
    listMyNotifications: async () => ({
      ok: true,
      status: 'READY',
      data: [{ id: 'note-a', title: 'Notice A', message: 'Body A', time: '09:00', read: false, type: 'system' }],
    }),
    markNotificationReadOnServer: async () => deferredMarkRead.promise,
    markAllNotificationsReadOnServer: async () => ({ ok: true, status: 'READY', data: 0 }),
  };

  let latestApp = null;
  function Probe() {
    latestApp = useApp();
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(AppProvider, null, React.createElement(Probe)));
    await flushAsync();
  });

  await act(async () => {
    await latestApp.login('usera@kristou.test', 'Password123!');
    await flushAsync();
  });

  assert.equal(latestApp.currentUser?.id, 'user-a');
  assert.equal(latestApp.notifications.length, 1);
  assert.equal(latestApp.preferencesSyncStatus, 'SAVED');

  deferredMarkRead = makeDeferred();
  deferredPrefsLoad = makeDeferred();

  await act(async () => {
    latestApp.markNotificationRead('note-a');
    void latestApp.refreshSchoolData();
  });

  // Resolve in-flight RPCs inside a microtask queued immediately after synchronous logout(),
  // BEFORE React commits the logout re-render / useSchoolDataHydration useEffect.
  await act(async () => {
    latestApp.logout();
    deferredMarkRead.resolve({
      ok: false,
      status: 'UNAUTHORIZED',
      errorCode: 'access_denied',
      errorMessage: 'access_denied',
    });
    deferredPrefsLoad.resolve({
      ok: true,
      status: 'READY',
      data: {
        language: 'en',
        theme: 'light',
        notificationSound: 'Kristou Bell',
        soundMuted: false,
        vibrationEnabled: true,
      },
    });
    await flushAsync();
  });

  assert.equal(latestApp.currentUser, null);
  assert.deepEqual(latestApp.notifications, []);
  assert.equal(latestApp.notificationsError, null);
  assert.equal(latestApp.preferencesSyncStatus, 'LOCAL_ONLY');
  assert.equal(latestApp.preferencesError, null);
  assert.ok(typeof authListener === 'function');

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ARCH-01 Issue 2: Slower hydratePreferencesForAccount cannot overwrite newer local mutation, and data: null settles to LOCAL_ONLY', async () => {
  const storageMap = installStorageMock();

  globalThis.__ARCH01_RACE_SUPABASE__ = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
  globalThis.__ARCH01_RACE_AUTH__ = {
    loadCanonicalUser: async (u) => makeUser(u.id),
    signInAccount: async (identifier) => ({ user: { id: identifier.includes('new') ? 'user-new' : 'user-a', email: identifier } }),
    signOutAccount: async () => {},
    signUpAccount: async () => ({ session: null }),
  };

  let deferredLoad = makeDeferred();
  let nullRowMode = false;
  globalThis.__ARCH01_RACE_PREFS__ = {
    loadMyPreferences: async () => {
      if (nullRowMode) return { ok: true, status: 'READY', data: null };
      return deferredLoad.promise;
    },
    saveMyPreferences: async (patch) => ({
      ok: true,
      status: 'READY',
      data: {
        language: patch.language ?? 'ar',
        theme: patch.theme ?? 'pitch-black',
        notificationSound: 'Kristou Bell',
        soundMuted: false,
        vibrationEnabled: true,
      },
    }),
  };

  globalThis.__ARCH01_RACE_NOTIFS__ = {
    listMyNotifications: async () => ({ ok: true, status: 'READY', data: [] }),
    markNotificationReadOnServer: async () => ({ ok: true, status: 'READY', data: true }),
    markAllNotificationsReadOnServer: async () => ({ ok: true, status: 'READY', data: 0 }),
  };

  let latestApp = null;
  function Probe() {
    latestApp = useApp();
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(AppProvider, null, React.createElement(Probe)));
    await flushAsync();
  });

  // Start login while loadMyPreferences is still pending
  await act(async () => {
    await latestApp.login('usera@kristou.test', 'Password123!');
  });

  // User changes language & theme while initial hydration load is still in flight
  await act(async () => {
    latestApp.setLanguage('ar');
    latestApp.setTheme('pitch-black');
    await flushAsync();
  });

  assert.equal(latestApp.language, 'ar');
  assert.equal(latestApp.theme, 'pitch-black');
  assert.equal(latestApp.preferencesSyncStatus, 'SAVED');

  // Now the slower initial hydration resolves with older DB values ('en', 'light')
  await act(async () => {
    deferredLoad.resolve({
      ok: true,
      status: 'READY',
      data: {
        language: 'en',
        theme: 'light',
        notificationSound: 'Silent',
        soundMuted: true,
        vibrationEnabled: false,
      },
    });
    await flushAsync();
  });

  assert.equal(latestApp.language, 'ar');
  assert.equal(latestApp.theme, 'pitch-black');
  assert.equal(storageMap.get('kristou_lang'), 'ar');
  assert.equal(storageMap.get('kristou_theme'), 'pitch-black');
  assert.equal(latestApp.preferencesSyncStatus, 'SAVED');

  // Verify new user with no saved user_preferences row (data: null) settles cleanly without error
  nullRowMode = true;
  await act(async () => {
    latestApp.logout();
    await latestApp.login('newuser@kristou.test', 'Password123!');
    await flushAsync();
  });

  assert.equal(latestApp.currentUser?.id, 'user-new');
  assert.equal(latestApp.preferencesError, null);
  assert.equal(latestApp.preferencesSyncStatus, 'LOCAL_ONLY');

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ARCH-01 Issue 3: Direct APPROVED A -> APPROVED B switch clears Account A notifications even when B fetch fails with ERROR or BLOCKED_BACKEND', async () => {
  installStorageMock();
  let authListener = null;

  globalThis.__ARCH01_RACE_SUPABASE__ = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (cb) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
  globalThis.__ARCH01_RACE_AUTH__ = {
    loadCanonicalUser: async (u) => makeUser(u.id),
    signInAccount: async () => ({ user: { id: 'user-a' } }),
    signOutAccount: async () => {},
    signUpAccount: async () => ({ session: null }),
  };
  globalThis.__ARCH01_RACE_PREFS__ = {
    loadMyPreferences: async () => ({ ok: true, status: 'READY', data: null }),
    saveMyPreferences: async () => ({ ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' }),
  };

  let activeFetchMode = 'user-a';
  globalThis.__ARCH01_RACE_NOTIFS__ = {
    listMyNotifications: async () => {
      if (activeFetchMode === 'user-a') {
        return {
          ok: true,
          status: 'READY',
          data: [{ id: 'secret-note-a', title: 'Private A', message: 'For A only', time: '09:00', read: false, type: 'system' }],
        };
      }
      if (activeFetchMode === 'b-error') {
        return { ok: false, status: 'ERROR', errorCode: 'notif_failed', errorMessage: 'Load failed for B' };
      }
      return { ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' };
    },
    markNotificationReadOnServer: async () => ({ ok: true, status: 'READY', data: true }),
    markAllNotificationsReadOnServer: async () => ({ ok: true, status: 'READY', data: 0 }),
  };

  let latestApp = null;
  function Probe() {
    latestApp = useApp();
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(AppProvider, null, React.createElement(Probe)));
    await flushAsync();
  });

  // 1. Account A logs in and loads private notification
  await act(async () => {
    await latestApp.login('usera@kristou.test', 'Password123!');
    await flushAsync();
  });
  assert.equal(latestApp.currentUser?.id, 'user-a');
  assert.deepEqual(latestApp.notifications.map((n) => n.id), ['secret-note-a']);

  // 2. Direct switch APPROVED A -> APPROVED B where B's listMyNotifications returns ERROR
  activeFetchMode = 'b-error';
  await act(async () => {
    await authListener('SIGNED_IN', { user: { id: 'user-b' } });
    await flushAsync();
  });
  assert.equal(latestApp.currentUser?.id, 'user-b');
  assert.deepEqual(latestApp.notifications, []);
  assert.equal(latestApp.notificationsError, 'Load failed for B');

  // 3. Direct switch APPROVED B -> APPROVED C where C's listMyNotifications returns BLOCKED_BACKEND
  activeFetchMode = 'b-blocked';
  await act(async () => {
    await authListener('SIGNED_IN', { user: { id: 'user-c' } });
    await flushAsync();
  });
  assert.equal(latestApp.currentUser?.id, 'user-c');
  assert.deepEqual(latestApp.notifications, []);
  assert.equal(latestApp.notificationsError, null);

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});
