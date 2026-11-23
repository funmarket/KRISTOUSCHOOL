import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act, useState } from 'react';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';

const dom = installNodeDomShim();
const classSet = new Set();
dom.document.documentElement.classList = {
  add: (...cls) => cls.forEach((c) => classSet.add(c)),
  remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
  contains: (c) => classSet.has(c),
};
dom.document.visibilityState = 'visible';

const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function sha256File(relPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relPath))).digest('hex');
}

function countLines(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8').split(/\r?\n/).length;
}

async function bundleArch09Modules() {
  const outdir = path.join('/tmp', 'kristou-arch09-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const notesHookOut = path.join(outdir, 'useParentNotesState.cjs');
  const appCtxOut = path.join(outdir, 'AppContext.cjs');

  const domainsParentNotesAbs = path.resolve(ROOT, 'src/lib/domains/parentNotes.ts');
  const mocksPlugin = {
    name: 'arch09-mocks',
    setup(builder) {
      builder.onResolve({ filter: /lib\/supabase(\.ts)?$/ }, () => ({
        path: 'mock-supabase',
        namespace: 'arch09',
      }));
      builder.onLoad({ filter: /^mock-supabase$/, namespace: 'arch09' }, () => ({
        contents: `
          export const supabase = {
            auth: {
              getSession: (...args) => globalThis.__ARCH09_SUPABASE__.auth.getSession(...args),
              onAuthStateChange: (...args) => globalThis.__ARCH09_SUPABASE__.auth.onAuthStateChange(...args),
            },
          };
        `,
        resolveDir: ROOT,
      }));
      builder.onResolve({ filter: /lib\/auth(\.ts)?$/ }, () => ({
        path: 'mock-auth',
        namespace: 'arch09',
      }));
      builder.onLoad({ filter: /^mock-auth$/, namespace: 'arch09' }, () => ({
        contents: `
          export const loadCanonicalUser = (...args) => globalThis.__ARCH09_AUTH__.loadCanonicalUser(...args);
          export const signInAccount = (...args) => globalThis.__ARCH09_AUTH__.signInAccount(...args);
          export const signOutAccount = (...args) => globalThis.__ARCH09_AUTH__.signOutAccount(...args);
          export const signUpAccount = (...args) => globalThis.__ARCH09_AUTH__.signUpAccount(...args);
          export const createTelegramLinkChallenge = (...args) => globalThis.__ARCH09_AUTH__.createTelegramLinkChallenge(...args);
          export const authenticateTelegramInitData = (...args) => globalThis.__ARCH09_AUTH__.authenticateTelegramInitData(...args);
        `,
        resolveDir: ROOT,
      }));
      builder.onResolve({ filter: /lib\/telegram(\.ts)?$/ }, () => ({
        path: 'mock-telegram',
        namespace: 'arch09',
      }));
      builder.onLoad({ filter: /^mock-telegram$/, namespace: 'arch09' }, () => ({
        contents: `
          export const initializeTelegramWebApp = () => {};
          export const getTelegramWebAppInitData = () => null;
        `,
        resolveDir: ROOT,
      }));
      builder.onResolve({ filter: /lib\/schoolContent(\.ts)?$/ }, () => ({
        path: 'mock-school-content',
        namespace: 'arch09',
      }));
      builder.onLoad({ filter: /^mock-school-content$/, namespace: 'arch09' }, () => ({
        contents: `
          export {
            getParentNotesQuotaDay,
            getRemainingParentNotesQuota,
            getTunisTimeParts,
            isWithinParentNotesTunisWindow,
            PARENT_NOTES_DAILY_QUOTA,
          } from ${JSON.stringify(domainsParentNotesAbs)};
          export const listParentNotes = (...args) => globalThis.__ARCH09_CONTENT__.listParentNotes(...args);
          export const sendParentNote = (...args) => globalThis.__ARCH09_CONTENT__.sendParentNote(...args);
          export const replyParentNote = (...args) => globalThis.__ARCH09_CONTENT__.replyParentNote(...args);
          export const listMessageThreads = (...args) => globalThis.__ARCH09_CONTENT__.listMessageThreads(...args);
          export const listClassAnnouncements = async () => ({ ok: true, status: 'READY', data: [] });
          export const listClassHomework = async () => ({ ok: true, status: 'READY', data: [] });
          export const listClassDocuments = async () => ({ ok: true, status: 'READY', data: [] });
          export const listClassGallery = async () => ({ ok: true, status: 'READY', data: [] });
          export const listClassQuestions = async () => ({ ok: true, status: 'READY', data: [] });
          export const postClassQuestion = async () => ({ ok: false, status: 'ERROR', errorCode: 'unused' });
          export const replyClassQuestion = async () => ({ ok: false, status: 'ERROR', errorCode: 'unused' });
          export const moderateClassQuestion = async () => ({ ok: false, status: 'ERROR', errorCode: 'unused' });
          export const listPublicAnnouncements = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listSchoolBroadcasts = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listPublicCalendarEvents = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listSchoolCalendarEvents = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listPublicFoodMenu = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const fetchActiveFoodMenu = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listPublicTeachers = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listPublicAdmins = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listPublicDirectory = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listPublicContent = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const fetchPublicContent = async () => ({ ok: true, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable' });
          export const listClassCommunityContent = async () => ({ ok: true, status: 'READY', data: { announcements: [], homework: [], documents: [], gallery: [], questions: [] } });
        `,
        resolveDir: ROOT,
      }));
      builder.onResolve({ filter: /lib\/schoolOperations(\.ts)?$/ }, () => ({
        path: 'mock-school-ops',
        namespace: 'arch09',
      }));
      builder.onLoad({ filter: /^mock-school-ops$/, namespace: 'arch09' }, () => ({
        contents: `
          export const fetchMySchoolContext = async () => ({
            ok: true,
            status: 'READY',
            data: { children: [], classes: [], operationalCounts: {}, linkedChildrenIds: ['child-1'], assignedClassIds: ['cls-1'] },
          });
          export const fetchSchoolClassesWithRosters = async () => ({ ok: true, status: 'READY', data: [] });
          export const listEnrollmentApplications = async () => ({ ok: true, status: 'READY', data: [] });
          export const listPublicInquiries = async () => ({ ok: true, status: 'UNAUTHORIZED', errorCode: 'unauthorized' });
        `,
        resolveDir: ROOT,
      }));
      builder.onResolve({ filter: /^[^./]/ }, (args) => ({
        path: require.resolve(args.path),
        external: true,
      }));
    },
  };

  await Promise.all([
    build({
      entryPoints: [path.resolve(ROOT, 'src/context/useParentNotesState.ts')],
      outfile: notesHookOut,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      jsx: 'automatic',
      plugins: [mocksPlugin],
    }),
    build({
      entryPoints: [path.resolve(ROOT, 'src/context/AppContext.tsx')],
      outfile: appCtxOut,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      jsx: 'automatic',
      plugins: [mocksPlugin],
    }),
  ]);

  return {
    notesHookMod: require(notesHookOut),
    appCtxMod: require(appCtxOut),
  };
}

const { notesHookMod, appCtxMod } = await bundleArch09Modules();
const { useParentNotesState } = notesHookMod;
const { AppProvider, useApp } = appCtxMod;

function flushAsync(ms = 25) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeUser(overrides = {}) {
  return {
    id: 'parent-1',
    username: 'sami.parent',
    fullName: 'Sami Trabelsi',
    role: 'PARENT',
    accountStatus: 'APPROVED',
    linkedChildrenIds: ['child-1'],
    assignedClassIds: ['cls-1'],
    capabilities: ['PARENT'],
    ...overrides,
  };
}

function makeNote(overrides = {}) {
  const nowIso = new Date().toISOString();
  return {
    id: 'note-1',
    parentId: 'parent-1',
    parentName: 'Sami Trabelsi',
    childId: 'child-1',
    childName: 'Yasmine Trabelsi',
    classId: 'cls-1',
    topic: 'ABSENCE',
    content: 'Absent this morning.',
    schoolDay: nowIso.slice(0, 10),
    createdAt: nowIso,
    status: 'SENT',
    ...overrides,
  };
}

function installDefaultGlobalMocks(contentOverrides = {}) {
  globalThis.__ARCH09_SUPABASE__ = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
  globalThis.__ARCH09_AUTH__ = {
    loadCanonicalUser: async () => makeUser(),
    signInAccount: async () => ({ user: { id: 'parent-1' } }),
    signOutAccount: async () => {},
    signUpAccount: async () => ({ session: null, secondaryPhoneVerificationRequired: false }),
    createTelegramLinkChallenge: async () => ({ linkUrl: '' }),
    authenticateTelegramInitData: async () => ({ user: null, linked: false }),
  };
  globalThis.__ARCH09_CONTENT__ = {
    listParentNotes: async () => ({ ok: true, status: 'READY', data: [makeNote()] }),
    sendParentNote: async () => ({ ok: true, status: 'READY', data: { note: makeNote({ id: 'note-new' }), remainingToday: 9 } }),
    replyParentNote: async () => ({ ok: true, status: 'READY', data: makeNote({ status: 'REPLIED', replyContent: 'Noted' }) }),
    listMessageThreads: async () => ({ ok: true, status: 'READY', data: [] }),
    ...contentOverrides,
  };
}

test('ARCH-09 Gate 7 (Structural): Parent Notes ownership moved to useParentNotesState.ts and domain files unchanged', () => {
  const appCtxSrc = fs.readFileSync(path.join(ROOT, 'src/context/AppContext.tsx'), 'utf8');
  const notesStateSrc = fs.readFileSync(path.join(ROOT, 'src/context/useParentNotesState.ts'), 'utf8');
  const actionsSrc = fs.readFileSync(path.join(ROOT, 'src/context/useCommunityAndNotesActions.ts'), 'utf8');
  const hydrationSrc = fs.readFileSync(path.join(ROOT, 'src/context/useSchoolDataHydration.ts'), 'utf8');

  assert.ok(countLines('src/context/AppContext.tsx') <= 450, 'AppContext.tsx must stay <= 450 lines');
  assert.ok(countLines('src/context/useParentNotesState.ts') <= 400, 'useParentNotesState.ts must stay <= 400 lines');
  assert.ok(countLines('src/context/useCommunityAndNotesActions.ts') <= 400, 'useCommunityAndNotesActions.ts must stay <= 400 lines');
  assert.ok(countLines('src/context/useSchoolDataHydration.ts') <= 400, 'useSchoolDataHydration.ts must stay <= 400 lines');

  for (const [label, src] of [
    ['AppContext.tsx', appCtxSrc],
    ['useParentNotesState.ts', notesStateSrc],
    ['useCommunityAndNotesActions.ts', actionsSrc],
    ['useSchoolDataHydration.ts', hydrationSrc],
  ]) {
    assert.doesNotMatch(src, /\.(from|rpc)\s*\(/, `${label} must contain zero direct .from() or .rpc() calls`);
  }

  // AppContext.tsx must have ZERO boundary controller instantiation, Parent Notes useState, or DOM listeners
  assert.doesNotMatch(appCtxSrc, /createParentNotesQuotaBoundaryController/);
  assert.doesNotMatch(appCtxSrc, /getNextTunisBoundaryDelayMs/);
  assert.doesNotMatch(appCtxSrc, /visibilitychange/);
  assert.doesNotMatch(appCtxSrc, /\bpageshow\b/);
  assert.doesNotMatch(appCtxSrc, /addEventListener\(\s*['"]focus['"]/);
  assert.doesNotMatch(appCtxSrc, /useState<ParentNote\[]>/);
  assert.doesNotMatch(appCtxSrc, /\[\s*(?:parentNotes|notesStatus|notesError)\s*,/);
  assert.doesNotMatch(appCtxSrc, /\bsetNotesStatus\b|\bsetNotesError\b/);

  // Extracted hook owns the shared controller, hydration guards, and window/document listeners
  assert.match(notesStateSrc, /createParentNotesQuotaBoundaryController/);
  assert.match(notesStateSrc, /getNextTunisBoundaryDelayMs/);
  assert.match(notesStateSrc, /visibilitychange/);
  assert.match(notesStateSrc, /pageshow/);
  assert.match(notesStateSrc, /beginHydrationRequest\(/);
  assert.match(notesStateSrc, /isRequestCurrent\(/);

  // Actions and hydration hooks do not import or own parentNotesBoundary controller
  assert.doesNotMatch(actionsSrc, /parentNotesBoundary|createParentNotesQuotaBoundaryController/);
  assert.doesNotMatch(hydrationSrc, /parentNotesBoundary|createParentNotesQuotaBoundaryController/);

  // Domain files preserved byte-for-byte
  assert.equal(
    sha256File('src/lib/parentNotesBoundary.ts'),
    '2dcf4a89e1cf7998d79c82462af75ffacb18ded6388233ca5fee643a3db3c43d',
  );
  assert.equal(
    sha256File('src/lib/domains/parentNotes.ts'),
    '960c969224d52afd6c9af25b666675fe5abf7ce5b728e2b263916946fbb07bc0',
  );
});

test('ARCH-09 Gate 1 & 2: Approved hydration succeeds and unauthorized/unapproved roles fail closed without loading notes', async () => {
  let listCalls = 0;
  installDefaultGlobalMocks({
    listParentNotes: async () => {
      listCalls += 1;
      return { ok: true, status: 'READY', data: [makeNote({ id: 'n-ok', content: 'Approved note' })] };
    },
  });

  const user = makeUser();
  let identity = { userId: user.id, accountStatus: 'APPROVED', generation: 1 };
  let hookResult = null;

  function Harness({ activeUser, ident }) {
    hookResult = useParentNotesState({
      currentUser: activeUser,
      identityContext: ident,
      getCurrentIdentity: () => identity,
    });
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(Harness, { activeUser: user, ident: identity }));
    await flushAsync();
  });

  await act(async () => {
    await hookResult.hydrateParentNotesForUser(user, identity, () => true);
  });

  assert.equal(listCalls, 1);
  assert.equal(hookResult.notesStatus, 'READY');
  assert.equal(hookResult.notesError, null);
  assert.equal(hookResult.parentNotes.length, 1);
  assert.equal(hookResult.parentNotes[0].id, 'n-ok');
  assert.equal(hookResult.parentNotesQuotaVerified, true);
  assert.equal(typeof hookResult.remainingParentNotesToday, 'number');

  // Unapproved parent must clear state & block quota refresh
  const pendingUser = makeUser({ id: 'parent-pending', accountStatus: 'PENDING_REVIEW' });
  identity = { userId: pendingUser.id, accountStatus: 'PENDING_REVIEW', generation: 2 };
  await act(async () => {
    root.render(React.createElement(Harness, { activeUser: pendingUser, ident: identity }));
    await flushAsync();
  });
  assert.deepEqual(hookResult.parentNotes, []);
  assert.equal(hookResult.notesStatus, 'BLOCKED_BACKEND');
  assert.equal(hookResult.remainingParentNotesToday, null);
  const refreshPending = await hookResult.refreshParentNotesQuota();
  assert.equal(refreshPending, false);
  assert.equal(listCalls, 1);

  // STUDENT and SCHOOL_STAFF fail closed without hitting listParentNotes
  for (const deniedRole of ['STUDENT', 'SCHOOL_STAFF']) {
    const deniedUser = makeUser({ id: `u-${deniedRole}`, role: deniedRole, accountStatus: 'APPROVED' });
    identity = { userId: deniedUser.id, accountStatus: 'APPROVED', generation: deniedRole === 'STUDENT' ? 3 : 4 };
    await act(async () => {
      root.render(React.createElement(Harness, { activeUser: deniedUser, ident: identity }));
      await flushAsync();
    });
    await act(async () => {
      await hookResult.hydrateParentNotesForUser(deniedUser, identity, () => true);
    });
    assert.equal(listCalls, 1, `${deniedRole} must never trigger listParentNotes()`);
    assert.equal(hookResult.notesStatus, 'UNAUTHORIZED');
    assert.deepEqual(hookResult.parentNotes, []);
    assert.ok(hookResult.notesError);
    assert.equal(hookResult.remainingParentNotesToday, null);
  }

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ARCH-09 Gate 3: Identity switch drops stale in-flight Parent Notes responses and clearParentNotesState resets on logout', async () => {
  let resolveSlowFetch = null;
  installDefaultGlobalMocks({
    listParentNotes: () =>
      new Promise((resolve) => {
        resolveSlowFetch = resolve;
      }),
  });

  const userA = makeUser({ id: 'parent-a' });
  const userB = makeUser({ id: 'parent-b' });
  let identity = { userId: userA.id, accountStatus: 'APPROVED', generation: 10 };
  let hookResult = null;

  function Harness({ activeUser, ident }) {
    hookResult = useParentNotesState({
      currentUser: activeUser,
      identityContext: ident,
      getCurrentIdentity: () => identity,
    });
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(Harness, { activeUser: userA, ident: identity }));
    await flushAsync();
  });

  const originA = { ...identity };
  let inflightPromise;
  await act(async () => {
    inflightPromise = hookResult.hydrateParentNotesForUser(userA, originA, () => identity.generation === originA.generation);
    await flushAsync(5);
  });
  assert.ok(resolveSlowFetch, 'Slow fetch for Parent A should be in flight');

  // Switch identity to Parent B before Parent A response arrives
  identity = { userId: userB.id, accountStatus: 'APPROVED', generation: 11 };
  await act(async () => {
    root.render(React.createElement(Harness, { activeUser: userB, ident: identity }));
    await flushAsync();
  });

  await act(async () => {
    resolveSlowFetch({
      ok: true,
      status: 'READY',
      data: [makeNote({ id: 'secret-a', parentId: 'parent-a', content: 'Parent A secret' })],
    });
    await inflightPromise;
  });

  // Stale Parent A payload must never leak into Parent B state
  assert.deepEqual(hookResult.parentNotes, []);
  assert.equal(hookResult.notesStatus, 'BLOCKED_BACKEND');

  // Hydrate Parent B cleanly, then clear on logout
  installDefaultGlobalMocks({
    listParentNotes: async () => ({
      ok: true,
      status: 'READY',
      data: [makeNote({ id: 'note-b', parentId: 'parent-b', content: 'Parent B note' })],
    }),
  });
  await act(async () => {
    await hookResult.hydrateParentNotesForUser(userB, identity, () => true);
  });
  assert.equal(hookResult.parentNotes.length, 1);
  assert.equal(hookResult.parentNotes[0].id, 'note-b');
  assert.equal(hookResult.notesStatus, 'READY');

  await act(async () => {
    hookResult.clearParentNotesState();
  });
  assert.deepEqual(hookResult.parentNotes, []);
  assert.equal(hookResult.notesStatus, 'BLOCKED_BACKEND');
  assert.equal(hookResult.notesError, null);
  assert.equal(hookResult.remainingParentNotesToday, null);

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ARCH-09 Gate 4: Boundary timer, visibilitychange/focus/pageshow listeners dedupe across re-renders and clean up on unmount', async () => {
  let fetchCount = 0;
  installDefaultGlobalMocks({
    listParentNotes: async () => {
      fetchCount += 1;
      return { ok: true, status: 'READY', data: [makeNote({ id: `n-${fetchCount}` })] };
    },
  });

  const origDocAdd = dom.document.addEventListener.bind(dom.document);
  const origDocRemove = dom.document.removeEventListener.bind(dom.document);
  const origWinAdd = dom.window.addEventListener.bind(dom.window);
  const origWinRemove = dom.window.removeEventListener.bind(dom.window);
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;

  const activeDocListeners = new Set();
  const activeWinListeners = new Set();
  const activeTimers = new Set();
  let boundaryTimerCallback = null;

  dom.document.addEventListener = (type, fn, opts) => {
    if (type === 'visibilitychange') activeDocListeners.add(fn);
    return origDocAdd(type, fn, opts);
  };
  dom.document.removeEventListener = (type, fn, opts) => {
    if (type === 'visibilitychange') activeDocListeners.delete(fn);
    return origDocRemove(type, fn, opts);
  };
  dom.window.addEventListener = (type, fn, opts) => {
    if (type === 'focus' || type === 'pageshow') activeWinListeners.add(`${type}:${activeWinListeners.size}`);
    return origWinAdd(type, fn, opts);
  };
  dom.window.removeEventListener = (type, fn, opts) => {
    if (type === 'focus' || type === 'pageshow') {
      for (const k of [...activeWinListeners]) {
        if (k.startsWith(`${type}:`)) {
          activeWinListeners.delete(k);
          break;
        }
      }
    }
    return origWinRemove(type, fn, opts);
  };

  let nextTimerId = 9000;
  globalThis.setTimeout = (fn, delay, ...args) => {
    if (typeof delay === 'number' && delay >= 250 && delay <= 30_000) {
      const id = ++nextTimerId;
      activeTimers.add(id);
      boundaryTimerCallback = () => {
        activeTimers.delete(id);
        fn(...args);
      };
      return id;
    }
    return origSetTimeout(fn, delay, ...args);
  };
  globalThis.clearTimeout = (id) => {
    if (activeTimers.has(id)) {
      activeTimers.delete(id);
      return;
    }
    return origClearTimeout(id);
  };

  try {
    const user = makeUser();
    const identity = { userId: user.id, accountStatus: 'APPROVED', generation: 1 };
    let hookResult = null;
    let triggerRerender = null;

    function Harness() {
      const [, setTick] = useState(0);
      triggerRerender = () => setTick((x) => x + 1);
      hookResult = useParentNotesState({
        currentUser: user,
        identityContext: identity,
        getCurrentIdentity: () => identity,
      });
      return null;
    }

    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(Harness));
      await flushAsync();
    });

    assert.equal(activeDocListeners.size, 1, 'Expected exactly one visibilitychange listener');
    assert.equal(activeWinListeners.size, 2, 'Expected focus + pageshow listeners');
    assert.equal(activeTimers.size, 1, 'Expected one scheduled boundary timeout');
    assert.equal(typeof boundaryTimerCallback, 'function');

    // Re-render component multiple times -> must NOT duplicate timers or listeners
    await act(async () => {
      triggerRerender();
      triggerRerender();
      await flushAsync();
    });
    assert.equal(activeDocListeners.size, 1);
    assert.equal(activeWinListeners.size, 2);
    assert.equal(activeTimers.size, 1);

    // Since quota is currently unverified/stale (never hydrated yet), visibilitychange / focus / pageshow trigger refresh
    await act(async () => {
      dom.document.visibilityState = 'visible';
      dom.document.dispatchEvent(new dom.window.Event('visibilitychange'));
      await flushAsync();
    });
    assert.equal(fetchCount, 1);
    assert.equal(hookResult.parentNotesQuotaVerified, true);

    // Now simulate timer tick when quota is already fresh -> no extra redundant network call
    await act(async () => {
      boundaryTimerCallback();
      await flushAsync();
    });
    assert.equal(fetchCount, 1);
    assert.equal(activeTimers.size, 1, 'Boundary loop reschedules cleanly');

    // Manual refresh triggers listParentNotes once more
    await act(async () => {
      const refreshed = await hookResult.refreshParentNotesQuota();
      assert.equal(refreshed, true);
    });
    assert.equal(fetchCount, 2);

    // Unmount removes all timers and listeners cleanly
    await act(async () => {
      root.unmount();
      await flushAsync();
    });
    assert.equal(activeDocListeners.size, 0, 'visibilitychange listener must be removed on unmount');
    assert.equal(activeWinListeners.size, 0, 'focus & pageshow listeners must be removed on unmount');
    assert.equal(activeTimers.size, 0, 'boundary timeout must be cleared on unmount');
    dom.document.body.removeChild(container);
  } finally {
    dom.document.addEventListener = origDocAdd;
    dom.document.removeEventListener = origDocRemove;
    dom.window.addEventListener = origWinAdd;
    dom.window.removeEventListener = origWinRemove;
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }
});

test('ARCH-09 Gate 5 & 6: AppProvider + useApp() preserve contract, send/reply state updates, server error propagation, and logout reset', async () => {
  const initialNote = makeNote({ id: 'n-init', content: 'Initial note', status: 'SENT' });
  const createdNote = makeNote({ id: 'n-created', content: 'Created note', status: 'SENT' });
  const repliedNote = { ...createdNote, status: 'REPLIED', replyContent: 'Teacher received it' };

  let sendMode = 'ok';
  let replyMode = 'ok';
  let authSignOutCount = 0;

  installDefaultGlobalMocks({
    listParentNotes: async () => ({ ok: true, status: 'READY', data: [initialNote] }),
    sendParentNote: async () =>
      sendMode === 'ok'
        ? { ok: true, status: 'READY', data: { note: createdNote, remainingToday: 9 } }
        : { ok: false, status: 'ERROR', errorCode: 'daily_quota_exceeded', errorMessage: 'Daily limit reached' },
    replyParentNote: async () =>
      replyMode === 'ok'
        ? { ok: true, status: 'READY', data: repliedNote }
        : { ok: false, status: 'ERROR', errorCode: 'reply_failed', errorMessage: 'Server rejected reply' },
  });
  globalThis.__ARCH09_SUPABASE__ = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'parent-1', email: 'sami@kristou.test' } } },
        error: null,
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
  globalThis.__ARCH09_AUTH__.signOutAccount = async () => {
    authSignOutCount += 1;
  };

  let appCtx = null;
  function Probe() {
    appCtx = useApp();
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(AppProvider, null, React.createElement(Probe)));
    await flushAsync(60);
  });

  // Contract verification for useApp()
  for (const key of [
    'currentUser', 'currentRole', 'isAuthenticated', 'isAuthLoading', 'authError',
    'language', 'setLanguage', 'theme', 'setTheme', 't', 'dir',
    'childrenList', 'classesList', 'classRosters', 'classesBackendStatus', 'classesError',
    'selectedClassId', 'setSelectedClassId', 'selectedChildId', 'setSelectedChildId',
    'operationalCounts', 'operationalCountsLoaded', 'isHydratingSchoolData', 'isLoadingClassCommunity', 'schoolContextError',
    'announcements', 'broadcasts', 'broadcastsStatus', 'broadcastsError',
    'homeworkList', 'classDocuments', 'classGallery', 'calendarEvents', 'calendarStatus', 'calendarError',
    'classQuestions', 'communityStatus', 'communityError',
    'parentNotes', 'notesStatus', 'notesError', 'remainingParentNotesToday',
    'isRefreshingParentNotesQuota', 'parentNotesQuotaStale', 'parentNotesQuotaVerified',
    'messages', 'messagesStatus', 'messagesError', 'pickupRecords',
    'foodMenu', 'foodMenuStatus', 'foodMenuError',
    'teachers', 'admins', 'directoryStatus', 'directoryError',
    'publicContent', 'publicContentStatus', 'publicContentError',
    'enrollmentApplications', 'enrollmentsStatus', 'enrollmentsError',
    'publicInquiries', 'inquiriesStatus',
    'notifications', 'unreadNotificationsCount', 'notificationsError',
    'markingNotificationIds', 'markingAllNotifications', 'preferencesError', 'preferencesSyncStatus',
    'login', 'signIn', 'signup', 'register', 'signUp', 'logout', 'signOut',
    'refreshCurrentUser', 'refreshSession', 'connectTelegram', 'telegramLinkNotice', 'dismissTelegramLinkNotice',
    'refreshSchoolData', 'refreshParentNotesQuota', 'addParentNote', 'replyParentNote',
    'addClassQuestion', 'replyClassQuestion', 'moderateClassQuestion',
    'markPickupArrived', 'confirmPickupRelease',
    'markNotificationRead', 'markAllNotificationsRead',
    'notificationSound', 'setNotificationSound', 'soundMuted', 'setSoundMuted', 'vibrationEnabled', 'setVibrationEnabled',
  ]) {
    assert.ok(key in appCtx, `useApp() must expose "${key}"`);
  }

  assert.equal(appCtx.notesStatus, 'READY');
  assert.equal(appCtx.parentNotes.length, 1);
  assert.equal(appCtx.remainingParentNotesToday, 10);

  // addParentNote updates state and quota cleanly
  let addRes;
  await act(async () => {
    addRes = await appCtx.addParentNote('child-1', 'ABSENCE', 'Created note');
  });
  assert.equal(addRes.success, true);
  assert.equal(appCtx.parentNotes.length, 2);
  assert.equal(appCtx.parentNotes[0].id, 'n-created');
  assert.equal(appCtx.remainingParentNotesToday, 9);

  // Server failure on addParentNote propagates error without fabricating local note
  sendMode = 'fail';
  let addFailRes;
  await act(async () => {
    addFailRes = await appCtx.addParentNote('child-1', 'ABSENCE', 'Should fail');
  });
  assert.equal(addFailRes.success, false);
  assert.equal(addFailRes.errorCode, 'daily_quota_exceeded');
  assert.equal(addFailRes.error, 'Daily limit reached');
  assert.equal(appCtx.parentNotes.length, 2);

  // replyParentNote updates target note in place and propagates server error cleanly
  let replyOkRes;
  await act(async () => {
    replyOkRes = await appCtx.replyParentNote('n-created', 'Teacher received it');
  });
  assert.equal(replyOkRes.ok, true);
  assert.equal(appCtx.parentNotes[0].status, 'REPLIED');
  assert.equal(appCtx.parentNotes[0].replyContent, 'Teacher received it');

  replyMode = 'fail';
  let replyFailRes;
  await act(async () => {
    replyFailRes = await appCtx.replyParentNote('n-init', 'Bad reply');
  });
  assert.equal(replyFailRes.ok, false);
  assert.equal(replyFailRes.errorCode, 'reply_failed');
  assert.equal(appCtx.parentNotes[1].status, 'SENT');

  // logout clears private parent notes immediately
  await act(async () => {
    appCtx.logout();
    await flushAsync();
  });
  assert.equal(authSignOutCount, 1);
  assert.deepEqual(appCtx.parentNotes, []);
  assert.equal(appCtx.notesStatus, 'BLOCKED_BACKEND');
  assert.equal(appCtx.notesError, null);
  assert.equal(appCtx.remainingParentNotesToday, null);

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});
