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

async function bundleContext(entryRelPath, outfileName) {
  const outdir = path.join('/tmp', 'kristou-arch01-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, outfileName);

  await build({
    entryPoints: [path.resolve(__dirname, entryRelPath)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    plugins: [
      {
        name: 'arch01-domain-mocks',
        setup(builder) {
          builder.onResolve({ filter: /lib\/domains\/preferences(\.ts)?$/ }, () => ({
            path: 'mock-preferences',
            namespace: 'arch01',
          }));
          builder.onLoad({ filter: /^mock-preferences$/, namespace: 'arch01' }, () => ({
            contents: `
              export const loadMyPreferences = (...args) => globalThis.__ARCH01_PREFS_MOCK__.loadMyPreferences(...args);
              export const saveMyPreferences = (...args) => globalThis.__ARCH01_PREFS_MOCK__.saveMyPreferences(...args);
              export const fetchUserPreferences = loadMyPreferences;
              export const updateUserPreferences = saveMyPreferences;
            `,
          }));
          builder.onResolve({ filter: /lib\/domains\/notifications(\.ts)?$/ }, () => ({
            path: 'mock-notifications',
            namespace: 'arch01',
          }));
          builder.onLoad({ filter: /^mock-notifications$/, namespace: 'arch01' }, () => ({
            contents: `
              export const listMyNotifications = (...args) => globalThis.__ARCH01_NOTIFS_MOCK__.listMyNotifications(...args);
              export const listNotifications = listMyNotifications;
              export const markNotificationReadOnServer = (...args) => globalThis.__ARCH01_NOTIFS_MOCK__.markNotificationReadOnServer(...args);
              export const markAllNotificationsReadOnServer = (...args) => globalThis.__ARCH01_NOTIFS_MOCK__.markAllNotificationsReadOnServer(...args);
            `,
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

const { PreferencesProvider, usePreferences } = await bundleContext(
  '../src/context/PreferencesContext.tsx',
  'preferences-context.cjs',
);
const { NotificationProvider, useNotifications } = await bundleContext(
  '../src/context/NotificationContext.tsx',
  'notification-context.cjs',
);

test('ARCH-01 Gate 1: Line count and domain-boundary invariants for PreferencesContext, NotificationContext, and AppContext', () => {
  const appCtxPath = path.resolve(__dirname, '../src/context/AppContext.tsx');
  const prefsCtxPath = path.resolve(__dirname, '../src/context/PreferencesContext.tsx');
  const notifCtxPath = path.resolve(__dirname, '../src/context/NotificationContext.tsx');

  const appCtxSrc = fs.readFileSync(appCtxPath, 'utf8');
  const prefsCtxSrc = fs.readFileSync(prefsCtxPath, 'utf8');
  const notifCtxSrc = fs.readFileSync(notifCtxPath, 'utf8');

  const countLines = (txt) => txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0);
  const appLines = countLines(appCtxSrc);
  const prefsLines = countLines(prefsCtxSrc);
  const notifLines = countLines(notifCtxSrc);

  assert.ok(appLines <= 1500, `AppContext.tsx must be <= 1,500 lines (got ${appLines})`);
  assert.ok(prefsLines <= 350, `PreferencesContext.tsx must be <= 350 lines (got ${prefsLines})`);
  assert.ok(notifLines <= 350, `NotificationContext.tsx must be <= 350 lines (got ${notifLines})`);

  // Zero direct Supabase .from(...) or .rpc(...) calls in any of the three context files
  for (const [name, src] of [
    ['AppContext.tsx', appCtxSrc],
    ['PreferencesContext.tsx', prefsCtxSrc],
    ['NotificationContext.tsx', notifCtxSrc],
  ]) {
    assert.doesNotMatch(src, /\.(from|rpc)\(/, `${name} must not contain direct .from( or .rpc( calls`);
  }
});

test('ARCH-01 Gate 2: PreferencesContext hydrates, updates localStorage/DOM, and persists via domain contract', async () => {
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
  };

  let savedPayloads = [];
  globalThis.__ARCH01_PREFS_MOCK__ = {
    loadMyPreferences: async (userId) => ({
      ok: true,
      status: 'READY',
      data: {
        userId,
        language: 'ar',
        theme: 'pitch-black',
        notificationSound: 'Soft Chime',
        soundMuted: true,
        vibrationEnabled: false,
      },
    }),
    saveMyPreferences: async (patch) => {
      savedPayloads.push(patch);
      return {
        ok: true,
        status: 'READY',
        data: {
          language: patch.language ?? 'ar',
          theme: patch.theme ?? 'pitch-black',
          notificationSound: patch.notificationSound ?? 'Soft Chime',
          soundMuted: patch.soundMuted ?? true,
          vibrationEnabled: patch.vibrationEnabled ?? false,
        },
      };
    },
  };

  let latestPrefs = null;
  function Probe() {
    latestPrefs = usePreferences();
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(PreferencesProvider, null, React.createElement(Probe)));
  });

  assert.equal(latestPrefs.language, 'fr');
  assert.equal(latestPrefs.dir, 'ltr');
  assert.equal(latestPrefs.preferencesSyncStatus, 'LOCAL_ONLY');

  // Hydrate for approved user
  await act(async () => {
    await latestPrefs.hydratePreferencesForAccount({
      userId: 'user-1',
      accountStatus: 'APPROVED',
      generation: 1,
    });
  });

  assert.equal(latestPrefs.language, 'ar');
  assert.equal(latestPrefs.dir, 'rtl');
  assert.equal(latestPrefs.theme, 'pitch-black');
  assert.equal(latestPrefs.notificationSound, 'Soft Chime');
  assert.equal(latestPrefs.soundMuted, true);
  assert.equal(latestPrefs.vibrationEnabled, false);
  assert.equal(latestPrefs.preferencesSyncStatus, 'SAVED');
  assert.equal(dom.document.documentElement.dir, 'rtl');
  assert.equal(dom.document.documentElement.lang, 'ar');

  // Trigger a preference update while approved
  await act(async () => {
    latestPrefs.setLanguage('en');
  });

  assert.equal(latestPrefs.language, 'en');
  assert.equal(storageMap.get('kristou_lang'), 'en');
  assert.deepEqual(savedPayloads, [{ language: 'en' }]);
  assert.equal(latestPrefs.preferencesSyncStatus, 'SAVED');

  // Switch through es, de, pt: verify LTR dir, html lang, localStorage, translations, and persistence
  for (const [lang, expectedHome] of [
    ['es', 'Inicio'],
    ['de', 'Startseite'],
    ['pt', 'Início'],
  ]) {
    await act(async () => {
      latestPrefs.setLanguage(lang);
    });
    assert.equal(latestPrefs.language, lang);
    assert.equal(latestPrefs.dir, 'ltr');
    assert.equal(dom.document.documentElement.dir, 'ltr');
    assert.equal(dom.document.documentElement.lang, lang);
    assert.equal(storageMap.get('kristou_lang'), lang);
    assert.equal(latestPrefs.t('home'), expectedHome);
    assert.equal(latestPrefs.preferencesSyncStatus, 'SAVED');
  }
  assert.deepEqual(savedPayloads, [
    { language: 'en' },
    { language: 'es' },
    { language: 'de' },
    { language: 'pt' },
  ]);

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ARCH-01 Gate 3: NotificationContext tracks unread count, optimistic single/all reads, and rollback on failure', async () => {
  let markSingleResult = { ok: true, status: 'READY', data: true };
  let markAllResult = { ok: false, status: 'ERROR', errorCode: 'rpc_failed', errorMessage: 'Mark all failed' };

  globalThis.__ARCH01_NOTIFS_MOCK__ = {
    listMyNotifications: async () => ({
      ok: true,
      status: 'READY',
      data: [
        { id: 'n-1', title: 'First', body: 'B1', category: 'announcement', time: '09:00', read: false },
        { id: 'n-2', title: 'Second', body: 'B2', category: 'message', time: '09:05', read: false },
      ],
    }),
    markNotificationReadOnServer: async () => markSingleResult,
    markAllNotificationsReadOnServer: async () => markAllResult,
  };

  let latestNotifs = null;
  function Probe() {
    latestNotifs = useNotifications();
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(NotificationProvider, null, React.createElement(Probe)));
  });

  const approvedIdentity = { userId: 'user-1', accountStatus: 'APPROVED', generation: 1 };
  await act(async () => {
    await latestNotifs.hydrateNotificationsForAccount(approvedIdentity);
  });

  assert.equal(latestNotifs.notifications.length, 2);
  assert.equal(latestNotifs.unreadNotificationsCount, 2);

  // Mark n-1 read (succeeds)
  await act(async () => {
    latestNotifs.markNotificationRead('n-1');
  });

  assert.equal(latestNotifs.notifications.find((n) => n.id === 'n-1').read, true);
  assert.equal(latestNotifs.unreadNotificationsCount, 1);
  assert.equal(latestNotifs.notificationsError, null);

  // Mark all read (server returns ERROR -> rolls back unconfirmed n-2 while keeping confirmed n-1 read)
  await act(async () => {
    latestNotifs.markAllNotificationsRead();
  });

  assert.equal(latestNotifs.notifications.find((n) => n.id === 'n-1').read, true);
  assert.equal(latestNotifs.notifications.find((n) => n.id === 'n-2').read, false);
  assert.equal(latestNotifs.unreadNotificationsCount, 1);
  assert.equal(latestNotifs.notificationsError, 'Mark all failed');

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});
