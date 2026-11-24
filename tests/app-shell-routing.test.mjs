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

async function bundleAppShellAndRoutes() {
  const outdir = path.join('/tmp', 'kristou-arch03-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, 'app-shell.cjs');
  const routeOutfile = path.join(outdir, 'route-model.cjs');

  await build({
    entryPoints: [path.resolve(__dirname, '../src/app/routeModel.ts')],
    outfile: routeOutfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });

  await build({
    entryPoints: [path.resolve(__dirname, '../src/app/AppShell.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    plugins: [
      {
        name: 'arch03-shell-mocks',
        setup(builder) {
          builder.onResolve({ filter: /context\/AppContext(\.tsx)?$/ }, () => ({
            path: 'mock-app-ctx',
            namespace: 'arch03',
          }));
          builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'arch03' }, () => ({
            contents: `
              export const useApp = () => globalThis.__ARCH03_APP_CTX__;
            `,
          }));
          builder.onResolve({ filter: /components\/Navbar(\.tsx)?$/ }, () => ({
            path: 'mock-navbar',
            namespace: 'arch03',
          }));
          builder.onLoad({ filter: /^mock-navbar$/, namespace: 'arch03' }, () => ({
            contents: `
              import React from 'react';
              export function Navbar(props) {
                globalThis.__ARCH03_NAVBAR_PROPS__ = props;
                return React.createElement('nav', { 'data-testid': 'mock-navbar', 'data-active-tab': props.activeTab });
              }
            `,
          }));
          builder.onResolve({ filter: /components\/AuthModal(\.tsx)?$/ }, () => ({
            path: 'mock-auth-modal',
            namespace: 'arch03',
          }));
          builder.onLoad({ filter: /^mock-auth-modal$/, namespace: 'arch03' }, () => ({
            contents: `
              import React from 'react';
              export function AuthModal(props) {
                return React.createElement('div', { 'data-testid': 'mock-auth-modal', onClick: props.onClose });
              }
            `,
          }));
          builder.onResolve({ filter: /components\/homepages\/HomePageResolver(\.tsx)?$/ }, () => ({
            path: 'mock-home-resolver',
            namespace: 'arch03',
          }));
          builder.onLoad({ filter: /^mock-home-resolver$/, namespace: 'arch03' }, () => ({
            contents: `
              import React from 'react';
              export function HomePageResolver(props) {
                globalThis.__ARCH03_HOME_PROPS__ = props;
                return React.createElement('div', { 'data-testid': 'mock-home-resolver' });
              }
            `,
          }));
          builder.onResolve({ filter: /components\/homepages\/PublicHomePage(\.tsx)?$/ }, () => ({
            path: 'mock-public-home',
            namespace: 'arch03',
          }));
          builder.onLoad({ filter: /^mock-public-home$/, namespace: 'arch03' }, () => ({
            contents: `
              import React from 'react';
              export function PublicHomePage() {
                return React.createElement('div', { 'data-testid': 'mock-public-home' });
              }
            `,
          }));
          builder.onResolve({ filter: /components\/views\/(.*)$/ }, (args) => ({
            path: args.path,
            namespace: 'arch03-views',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'arch03-views' }, (args) => {
            const viewName = path.basename(args.path, '.tsx');
            return {
              contents: `
                import React from 'react';
                export function ${viewName}(props) {
                  globalThis.__ARCH03_VIEW_PROPS__ = globalThis.__ARCH03_VIEW_PROPS__ || {};
                  globalThis.__ARCH03_VIEW_PROPS__[${JSON.stringify(viewName)}] = props;
                  return React.createElement('div', { 'data-testid': ${JSON.stringify('view-' + viewName)} });
                }
              `,
            };
          });
          builder.onResolve({ filter: /^[^./]/ }, (args) => ({
            path: require.resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  });
  return { ...require(outfile), ...require(routeOutfile) };
}

const {
  AppShell,
  buildClassRostersRecord,
  mapClassesBackendStatus,
  resolveNotificationTargetRoute,
  resolveSubTabTransition,
  resolveTabTransition,
  shouldInterceptDirtyAttendanceLeave,
} = await bundleAppShellAndRoutes();

function makeUser(overrides = {}) {
  return {
    id: 'owner-1',
    username: 'owner.kristou',
    fullName: 'Kristou Owner',
    role: 'APP_ADMIN',
    accountStatus: 'APPROVED',
    capabilities: ['APP_ADMIN'],
    ...overrides,
  };
}

test('ARCH-03 Gate 1: Line-count reduction (App.tsx <= 150, routeModel.ts <= 200, AppShell.tsx <= 350) and zero direct .from/.rpc calls', () => {
  const appPath = path.resolve(__dirname, '../src/App.tsx');
  const routeModelPath = path.resolve(__dirname, '../src/app/routeModel.ts');
  const appShellPath = path.resolve(__dirname, '../src/app/AppShell.tsx');

  const appSrc = fs.readFileSync(appPath, 'utf8');
  const routeModelSrc = fs.readFileSync(routeModelPath, 'utf8');
  const appShellSrc = fs.readFileSync(appShellPath, 'utf8');

  const countLines = (txt) => txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0);
  const appLines = countLines(appSrc);
  const routeModelLines = countLines(routeModelSrc);
  const appShellLines = countLines(appShellSrc);

  assert.ok(appLines <= 150, `src/App.tsx must be <= 150 lines (got ${appLines})`);
  assert.ok(routeModelLines <= 200, `src/app/routeModel.ts must be <= 200 lines (got ${routeModelLines})`);
  assert.ok(appShellLines <= 350, `src/app/AppShell.tsx must be <= 350 lines (got ${appShellLines})`);

  for (const [name, src] of [
    ['src/App.tsx', appSrc],
    ['src/app/routeModel.ts', routeModelSrc],
    ['src/app/AppShell.tsx', appShellSrc],
  ]) {
    assert.doesNotMatch(src, /\.(from|rpc)\(/, `${name} must not contain direct .from( or .rpc( calls`);
  }
});

test('ARCH-03 Gate 2: routeModel.ts tab transitions, sub-tab resolution, notification target routing, and attendance guard rules', () => {
  const owner = makeUser();
  const student = makeUser({ role: 'STUDENT', capabilities: ['STUDENT'] });

  // Tab transition allowed vs fallback to home
  assert.deepEqual(resolveTabTransition(owner, 'classes'), { activeTab: 'classes' });
  assert.deepEqual(resolveTabTransition(owner, 'announcements'), {
    activeTab: 'announcements',
    resetAnnouncementsSubTab: 'broadcasts',
  });
  assert.deepEqual(resolveTabTransition(student, 'classes'), { activeTab: 'home' });
  assert.deepEqual(resolveTabTransition(null, 'foodMenu'), { activeTab: 'foodMenu' });
  assert.deepEqual(resolveTabTransition(null, 'messages'), { activeTab: 'home' });

  // Sub-tab transitions
  assert.deepEqual(resolveSubTabTransition(owner, 'community', 'homework'), {
    activeTab: 'community',
    communitySubTab: 'homework',
  });
  assert.deepEqual(resolveSubTabTransition(owner, 'announcements', 'calendar'), {
    activeTab: 'announcements',
    announcementsSubTab: 'calendar',
  });
  assert.deepEqual(resolveSubTabTransition(null, 'directory', 'administration'), {
    activeTab: 'directory',
    directorySubTab: 'administration',
  });
  assert.deepEqual(resolveSubTabTransition(null, 'community', 'homework'), {
    activeTab: 'home',
  });

  // Notification target route resolution
  const notesNotification = {
    id: 'n-note-1',
    title: 'Parent Note Submitted',
    body: 'Absence note waiting review',
    category: 'note',
    time: '09:00',
    read: false,
    targetTab: 'notes',
    targetRefId: '550e8400-e29b-41d4-a716-446655440011',
  };
  const ownerIntent = resolveNotificationTargetRoute(owner, notesNotification, 1);
  assert.ok(ownerIntent);
  assert.equal(ownerIntent.tab, 'notes');
  assert.equal(resolveNotificationTargetRoute(student, notesNotification, 2), null);
  assert.equal(resolveNotificationTargetRoute(null, notesNotification, 3), null);

  // Dirty attendance guard
  assert.equal(shouldInterceptDirtyAttendanceLeave('attendance', true, 'classes'), true);
  assert.equal(shouldInterceptDirtyAttendanceLeave('attendance', true, 'attendance'), false);
  assert.equal(shouldInterceptDirtyAttendanceLeave('attendance', false, 'classes'), false);
  assert.equal(shouldInterceptDirtyAttendanceLeave('classes', true, 'home'), false);

  // Classes backend status & roster map helpers
  assert.equal(mapClassesBackendStatus(true, 'READY'), 'LOADING');
  assert.equal(mapClassesBackendStatus(false, 'READY'), 'READY');
  assert.equal(mapClassesBackendStatus(false, 'UNAUTHORIZED'), 'UNAUTHORIZED');
  assert.equal(mapClassesBackendStatus(false, 'ERROR'), 'ERROR');
  assert.equal(mapClassesBackendStatus(false, 'BLOCKED_BACKEND'), 'BACKEND_NOT_IMPLEMENTED');
  assert.deepEqual(
    buildClassRostersRecord([{ id: 'c-1', roster: [{ studentId: 's-1', studentCode: 'K1', fullName: 'A', enrollmentStatus: 'ACTIVE', enrolledAt: '2026-09-01' }] }]),
    { 'c-1': [{ studentId: 's-1', studentCode: 'K1', fullName: 'A', enrollmentStatus: 'ACTIVE', enrolledAt: '2026-09-01' }] },
  );
});

test('ARCH-03 Gate 3: AppShell orchestrates dirty attendance confirmation modal and class-to-student dossier handoff', async () => {
  globalThis.__ARCH03_VIEW_PROPS__ = {};
  globalThis.__ARCH03_APP_CTX__ = {
    currentUser: makeUser(),
    language: 'en',
    t: (key) => key,
    classRosters: [],
    classesBackendStatus: 'READY',
    classesError: null,
    setSelectedClassId: () => {},
    isHydratingSchoolData: false,
    refreshSchoolData: async () => true,
  };

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(AppShell));
  });

  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'home');
  assert.equal(container.querySelector('footer'), null, 'AppShell must not render a bottom website footer');

  // Approved logged-in user sees BottomNavBar and main bottom clearance
  const bottomNav = container.querySelector('[data-testid="bottom-nav-bar"]');
  assert.ok(bottomNav, 'AppShell must render BottomNavBar for approved logged-in users');
  assert.ok(
    container.querySelector('main')?.className.includes('pb-24'),
    'AppShell <main> must include pb-24 clearance when BottomNavBar is active',
  );

  // Clicking Calendar and Teachers on BottomNavBar delegates through AppShell handleNavigateToSubTab
  await act(async () => {
    container.querySelector('[data-testid="bottom-nav-item-announcements"]').click();
  });
  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'announcements');
  assert.equal(globalThis.__ARCH03_VIEW_PROPS__.GlobalAnnouncementsCalendarView.initialSubTab, 'calendar');

  await act(async () => {
    container.querySelector('[data-testid="bottom-nav-item-directory"]').click();
  });
  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'directory');
  assert.equal(globalThis.__ARCH03_VIEW_PROPS__.DirectoryView.initialSubTab, 'teachers');

  await act(async () => {
    container.querySelector('[data-testid="bottom-nav-item-home"]').click();
  });
  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'home');

  // Navigate to attendance, mark dirty, and try to navigate to classes -> modal intercepts
  await act(async () => {
    globalThis.__ARCH03_NAVBAR_PROPS__.setActiveTab('attendance');
  });
  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'attendance');

  await act(async () => {
    globalThis.__ARCH03_VIEW_PROPS__.AttendanceView.onDirtyChange(true);
  });

  await act(async () => {
    globalThis.__ARCH03_NAVBAR_PROPS__.setActiveTab('classes');
  });
  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'attendance');
  const modal = container.querySelector('[data-testid="attendance-leave-confirm-modal"]');
  assert.ok(modal, 'Expected attendance-leave-confirm-modal when leaving dirty attendance');

  // Confirm discard & leave -> transitions to classes
  const discardBtn = container.querySelector('[data-testid="attendance-discard-leave-btn"]');
  await act(async () => {
    discardBtn.click();
  });
  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'classes');

  // Hand off from class roster to student detail -> opens students view with roster origin, and back returns to classes
  await act(async () => {
    globalThis.__ARCH03_VIEW_PROPS__.ClassesManagementView.onOpenStudentDetail('student-42');
  });
  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'students');
  assert.equal(globalThis.__ARCH03_VIEW_PROPS__.StudentsManagementView.initialSelectedStudentId, 'student-42');
  assert.equal(globalThis.__ARCH03_VIEW_PROPS__.StudentsManagementView.navOrigin, 'roster');

  await act(async () => {
    globalThis.__ARCH03_VIEW_PROPS__.StudentsManagementView.onBackToOrigin();
  });
  assert.equal(globalThis.__ARCH03_NAVBAR_PROPS__.activeTab, 'classes');

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('UI-BOTTOM-NAV: AppShell hides BottomNavBar and pb-24 clearance when logged out or pending', async () => {
  for (const user of [null, makeUser({ accountStatus: 'PENDING' })]) {
    globalThis.__ARCH03_VIEW_PROPS__ = {};
    globalThis.__ARCH03_APP_CTX__ = {
      currentUser: user,
      language: 'en',
      t: (key) => key,
      classRosters: [],
      classesBackendStatus: 'READY',
      classesError: null,
      setSelectedClassId: () => {},
      isHydratingSchoolData: false,
      refreshSchoolData: async () => true,
    };

    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(AppShell));
    });

    assert.equal(
      container.querySelector('[data-testid="bottom-nav-bar"]'),
      null,
      `BottomNavBar must not render when user is ${user ? user.accountStatus : 'null'}`,
    );
    assert.equal(
      container.querySelector('main')?.className.includes('pb-24'),
      false,
      `AppShell <main> must not add pb-24 when user is ${user ? user.accountStatus : 'null'}`,
    );

    await act(async () => {
      root.unmount();
    });
    dom.document.body.removeChild(container);
  }
});
