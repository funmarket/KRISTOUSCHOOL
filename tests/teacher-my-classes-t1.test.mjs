import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
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
const { renderToStaticMarkup } = await import('react-dom/server');
const { createRoot } = await import('react-dom/client');

import {
  canAccessAppTab,
  canManageClassesUi,
  resolveTeacherAssignedClasses,
} from '../src/components/homepages/homepageAccess.ts';
import {
  reconcileSelectedClassId,
  resolveClassesRosterFetchStrategy,
} from '../src/lib/appStateGuards.ts';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';

const require = createRequire(import.meta.url);
const tempDir = await mkdtemp(path.join(tmpdir(), 'kristou-teacher-t1-'));
after(() => rm(tempDir, { recursive: true, force: true }));

async function bundleComponent(relPath, outName, options = {}) {
  const outfile = path.join(tempDir, outName);
  await build({
    entryPoints: [new URL(relPath, import.meta.url).pathname],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    loader: { '.css': 'empty' },
    define: { __KRISTOU_SUPABASE_URL__: '""', __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '""' },
    plugins: [
      {
        name: 't1-test-resolver',
        setup(builder) {
          if (options.mockContext !== false) {
            builder.onResolve({ filter: /context\/AppContext$/ }, () => ({
              path: 'context',
              namespace: 'fixture',
            }));
            builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
              contents:
                'const stableT = (key) => key;\nexport const useApp = () => ({ ...globalThis.__T1_CTX__, t: stableT });',
            }));
          }
          if (options.mockSupabase) {
            builder.onResolve({ filter: /(?:^|\/)supabase(\.ts)?$/ }, () => ({
              path: 'supabase-mock',
              namespace: 'supa-fixture',
            }));
            builder.onLoad({ filter: /.*/, namespace: 'supa-fixture' }, () => ({
              contents: `
                export const isSupabaseConfigured = true;
                export const supabase = new Proxy({}, {
                  get(_, prop) {
                    return globalThis.__T1_SUPABASE__?.[prop];
                  }
                });
                export const requireSupabaseClient = () => supabase;
                export const classifySupabaseError = (err) => {
                  const code = String(err?.code || '');
                  const msg = String(err?.message || '').toLowerCase();
                  if (code === 'PGRST202' || code === '42P01') return { status: 'BLOCKED_BACKEND', errorCode: code, errorMessage: err?.message || code };
                  if (code === '42501' || msg.includes('insufficient_authority') || msg.includes('actor_not_approved') || msg.includes('jwt')) {
                    return { status: 'UNAUTHORIZED', errorCode: code || 'unauthorized', errorMessage: err?.message || 'Unauthorized' };
                  }
                  return { status: 'ERROR', errorCode: code || 'error', errorMessage: err?.message || 'Error' };
                };
              `,
            }));
          }
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

const [{ TeacherHomePage }, { ClassesManagementView }, { AppProvider, useApp }] = await Promise.all([
  bundleComponent('../src/components/homepages/TeacherHomePage.tsx', 'teacher-home.cjs'),
  bundleComponent('../src/components/views/ClassesManagementView.tsx', 'classes-view.cjs'),
  bundleComponent('../src/context/AppContext.tsx', 'app-context.cjs', {
    mockContext: false,
    mockSupabase: true,
  }),
]);

function makeUser(overrides = {}) {
  return {
    id: 'teacher-1',
    username: 'amel.benali',
    fullName: 'Amel Ben Ali',
    role: 'TEACHER',
    accountStatus: 'APPROVED',
    assignedClassIds: ['cls-1', 'cls-2'],
    capabilities: ['TEACHER'],
    ...overrides,
  };
}

function baseCtx(overrides = {}) {
  return {
    currentUser: makeUser(),
    language: 'en',
    classesList: [
      { id: 'cls-1', name: 'CP-A', level: '1ère année (CP)', teacherId: 'teacher-1', teacherName: 'Amel Ben Ali', academicYear: '2026-2027', studentCount: 2 },
      { id: 'cls-2', name: 'CE1-B', level: '2ème année (CE1)', teacherId: 'teacher-1', teacherName: 'Amel Ben Ali', academicYear: '2025-2026', studentCount: 0 },
    ],
    selectedClassId: 'cls-1',
    setSelectedClassId: () => {},
    messages: [],
    messagesStatus: 'READY',
    ...overrides,
  };
}

const SAMPLE_CLASSES = [
  {
    id: 'cls-1',
    name: 'CP-A',
    level: '1ère année (CP)',
    levelCode: 'CP',
    academicYear: '2026-2027',
    homeroomTeacherName: 'Amel Ben Ali',
    activeStudentCount: 2,
    roomLabel: 'Room 101',
  },
  {
    id: 'cls-2',
    name: 'CE1-B',
    level: '2ème année (CE1)',
    levelCode: 'CE1',
    academicYear: '2025-2026',
    homeroomTeacherName: 'Amel Ben Ali',
    activeStudentCount: 0,
  },
  {
    id: 'cls-unassigned',
    name: 'CM2-Z',
    level: '5ème année (CM2)',
    levelCode: 'CM2',
    academicYear: '2026-2027',
    homeroomTeacherName: 'Other Teacher',
    activeStudentCount: 19,
  },
];

const SAMPLE_ROSTERS = {
  'cls-1': [
    {
      studentId: '550e8400-e29b-41d4-a716-446655440001',
      studentCode: 'KS-2026-001',
      fullName: 'Ines Trabelsi',
      enrollmentStatus: 'ACTIVE',
      enrolledAt: '2026-09-15',
      primaryGuardianName: 'Sami Trabelsi',
    },
    {
      studentId: '550e8400-e29b-41d4-a716-446655440002',
      studentCode: 'KS-2026-002',
      fullName: 'Youssef Gharbi',
      enrollmentStatus: 'ACTIVE',
      enrolledAt: '2026-09-16',
      primaryGuardianName: null,
    },
  ],
  'cls-2': [],
  'cls-unassigned': [
    {
      studentId: '550e8400-e29b-41d4-a716-446655449999',
      studentCode: 'KS-2026-999',
      fullName: 'Secret Other Student',
      enrollmentStatus: 'ACTIVE',
      enrolledAt: '2026-09-15',
      primaryGuardianName: 'Secret Parent',
    },
  ],
};

function findButtonByTestId(root, testId) {
  return root.querySelector(`[data-testid="${testId}"]`);
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

test('T1-1: TeacherHomePage My Classes card navigates to classes tab while preserving sibling routes', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);
  const visitedTabs = [];
  const visitedSubTabs = [];

  globalThis.__T1_CTX__ = baseCtx();

  try {
    await act(async () => {
      root.render(
        React.createElement(TeacherHomePage, {
          setActiveTab: (tab) => visitedTabs.push(tab),
          onNavigateToSubTab: (tab, subTab) => visitedSubTabs.push([tab, subTab]),
        }),
      );
    });

    const myClassesCard = container.querySelector('[data-testid="shortcut-card-teacher-my-classes"]');
    assert.ok(myClassesCard, 'TeacherHomePage must render shortcut-card-teacher-my-classes');
    await act(async () => {
      myClassesCard.click();
    });
    assert.deepEqual(visitedTabs, ['classes'], 'Clicking My Classes must open classes tab');
    assert.deepEqual(visitedSubTabs, [], 'Clicking My Classes must not route to community announcements');

    // Class announcements shortcut remains intact
    const classAnnCard = container.querySelector('[data-testid="shortcut-card-teacher-class-announcements"]');
    await act(async () => {
      classAnnCard.click();
    });
    assert.deepEqual(visitedSubTabs, [['community', 'announcements']]);

    // Attendance shortcut now opens the real Attendance view
    const attendanceCard = container.querySelector('[data-testid="shortcut-card-teacher-attendance"]');
    assert.ok(attendanceCard, 'TeacherHomePage must render shortcut-card-teacher-attendance');
    await act(async () => {
      attendanceCard.click();
    });
    assert.deepEqual(visitedTabs, ['classes', 'attendance'], 'Clicking Attendance must navigate to attendance tab');
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

test('T1-2: Role & capability boundaries — approved Teacher allowed read-only, non-Teacher/unapproved denied, Navbar includes classes for Teacher', () => {
  const teacher = makeUser();
  assert.equal(canAccessAppTab(teacher, 'classes'), true);
  assert.equal(canManageClassesUi(teacher), false);
  assert.equal(canManageClassesUi(makeUser({ capabilities: ['CLASSES_MANAGE', 'FULL_ACCESS'] })), false);

  for (const status of ['PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED']) {
    assert.equal(canAccessAppTab(makeUser({ accountStatus: status }), 'classes'), false);
  }
  assert.equal(canAccessAppTab(makeUser({ role: 'PARENT' }), 'classes'), false);
  assert.equal(canAccessAppTab(makeUser({ role: 'STUDENT' }), 'classes'), false);
  assert.equal(canAccessAppTab(null, 'classes'), false);

  // Verify Navbar.tsx respects canAccessAppTab for classes without needing modification
  const navbarSrc = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  assert.match(navbarSrc, /canAccessAppTab\(currentUser,\s*'classes'\)/);

  // Unauthorized roles render classes-view-unauthorized in ClassesManagementView
  for (const deniedRole of ['PARENT', 'STUDENT']) {
    globalThis.__T1_CTX__ = baseCtx({ currentUser: makeUser({ role: deniedRole }) });
    const html = renderToStaticMarkup(
      React.createElement(ClassesManagementView, {
        initialClasses: SAMPLE_CLASSES,
        initialRosters: SAMPLE_ROSTERS,
        backendStatus: 'READY',
      }),
    );
    assert.match(html, /data-testid="classes-view-unauthorized"/);
    assert.ok(!html.includes('data-testid="classes-card-grid"'));
  }
});

test('T1-3: Teacher opens assigned-class list first, keeps shared selection highlight, excludes unassigned classes & admin controls, scopes filter options', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);
  const sharedUpdates = [];
  const communityOpens = [];

  globalThis.__T1_CTX__ = baseCtx({
    selectedClassId: 'cls-2',
    setSelectedClassId: (id) => sharedUpdates.push(id),
  });

  try {
    await act(async () => {
      root.render(
        React.createElement(ClassesManagementView, {
          initialClasses: SAMPLE_CLASSES,
          initialRosters: SAMPLE_ROSTERS,
          backendStatus: 'READY',
          onOpenClassCommunity: (id) => communityOpens.push(id),
        }),
      );
    });

    // Entry shows assigned-class list first (never auto-skipping to roster even when shared selectedClassId is cls-2)
    assert.ok(container.querySelector('[data-testid="classes-management-view"]'));
    assert.equal(container.querySelector('[data-testid="class-detail-roster-view"]'), null);

    // Assigned classes shown, unassigned excluded
    assert.ok(container.querySelector('[data-testid="class-card-cls-1"]'));
    assert.ok(container.querySelector('[data-testid="class-card-cls-2"]'));
    assert.equal(container.querySelector('[data-testid="class-card-cls-unassigned"]'), null);
    assert.ok(!container.innerHTML.includes('CM2-Z'));

    // Shared selected class highlighted
    assert.equal(container.querySelector('[data-testid="class-card-cls-2"]').getAttribute('data-selected'), 'true');
    assert.ok(container.querySelector('[data-testid="class-selected-badge-cls-2"]'));
    assert.equal(container.querySelector('[data-testid="class-card-cls-1"]').getAttribute('data-selected'), 'false');

    // No admin/management buttons in Teacher view
    assert.equal(container.querySelector('[data-testid="toggle-create-class-btn"]'), null);
    assert.equal(container.querySelector('[data-testid="toggle-enroll-student-btn"]'), null);
    assert.equal(container.querySelector('[data-testid="toggle-assign-teacher-btn"]'), null);

    // Level & year filter options derived ONLY from Teacher's authorized classes
    const levelOpts = Array.from(container.querySelectorAll('[data-testid="classes-level-filter"] option')).map((o) => o.textContent);
    assert.deepEqual(levelOpts, ['All Levels', '1ère année (CP)', '2ème année (CE1)']);
    const yearOpts = Array.from(container.querySelectorAll('[data-testid="classes-year-filter"] option')).map((o) => o.textContent);
    assert.deepEqual(yearOpts, ['All Academic Years', '2026-2027', '2025-2026']);

    // Distinct card actions: "Open Class Community" navigates to community without opening roster
    await act(async () => {
      findButtonByTestId(container, 'open-class-community-cls-1').click();
    });
    assert.deepEqual(communityOpens, ['cls-1']);
    assert.deepEqual(sharedUpdates, ['cls-1']);
    assert.equal(container.querySelector('[data-testid="class-detail-roster-view"]'), null);

    // "View Students" updates shared selection & opens that class's student roster
    await act(async () => {
      findButtonByTestId(container, 'view-class-students-cls-1').click();
    });
    assert.ok(container.querySelector('[data-testid="class-detail-roster-view"]'));
    assert.ok(container.innerHTML.includes('KS-2026-001'));
    assert.ok(container.innerHTML.includes('Ines Trabelsi'));
    assert.ok(container.innerHTML.includes('Sami Trabelsi'));
    assert.ok(container.innerHTML.includes('Youssef Gharbi'));
    // Must not expose raw studentId UUID as visible cell text
    assert.ok(!container.querySelector('tbody').textContent.includes('550e8400-e29b-41d4-a716-446655440001'));
    // Strictly T1 columns — no T2/T3 fake Attendance/Grades/Medical/At-Risk/Student Detail UI
    assert.doesNotMatch(container.querySelector('thead').textContent, /Attendance|Grades|Medical|At Risk|Behavior/i);

    // Back button returns to assigned-class list
    await act(async () => {
      findButtonByTestId(container, 'back-to-classes-btn').click();
    });
    assert.ok(container.querySelector('[data-testid="classes-management-view"]'));
    assert.equal(container.querySelector('[data-testid="class-detail-roster-view"]'), null);
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

test('T1-4: Roster search (name/code/guardian) and 25-row pagination', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  const manyStudents = Array.from({ length: 30 }, (_, idx) => ({
    studentId: `uuid-${idx + 1}`,
    studentCode: `KS-2026-${String(idx + 1).padStart(3, '0')}`,
    fullName: idx === 28 ? 'Zayd Special' : `Student Name ${idx + 1}`,
    enrollmentStatus: 'ACTIVE',
    enrolledAt: '2026-09-15',
    primaryGuardianName: idx === 28 ? 'Nadia Guardian' : `Guardian ${idx + 1}`,
  }));

  globalThis.__T1_CTX__ = baseCtx();

  try {
    await act(async () => {
      root.render(
        React.createElement(ClassesManagementView, {
          initialClasses: [SAMPLE_CLASSES[0]],
          initialRosters: { 'cls-1': manyStudents },
          backendStatus: 'READY',
        }),
      );
    });

    await act(async () => {
      findButtonByTestId(container, 'view-class-students-cls-1').click();
    });

    assert.equal(container.querySelectorAll('tbody tr').length, 25);
    assert.equal(container.querySelector('[data-testid="roster-page-indicator"]').textContent.trim(), '1 / 2');

    // Page 2 shows remaining 5 students
    await act(async () => {
      findButtonByTestId(container, 'roster-next-page-btn').click();
    });
    assert.equal(container.querySelectorAll('tbody tr').length, 5);
    assert.equal(container.querySelector('[data-testid="roster-page-indicator"]').textContent.trim(), '2 / 2');

    // Search resets pagination to page 1 and filters by code/guardian/name
    const searchInput = container.querySelector('[data-testid="roster-student-search"]');
    await act(async () => {
      dom.setInputValue(searchInput, 'KS-2026-029');
    });
    assert.equal(container.querySelectorAll('tbody tr').length, 1);
    assert.ok(container.querySelector('tbody').textContent.includes('Zayd Special'));

    await act(async () => {
      dom.setInputValue(searchInput, 'Nadia Guardian');
    });
    assert.equal(container.querySelectorAll('tbody tr').length, 1);
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

test('T1-5: All distinct Teacher states — LOADING, zero-assignment EMPTY, 0-student roster EMPTY, ERROR+Retry, UNAUTHORIZED, BLOCKED_BACKEND', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);
  let retryCalls = 0;

  try {
    // 1. LOADING (never renders "No classes assigned")
    globalThis.__T1_CTX__ = baseCtx({ currentUser: makeUser({ assignedClassIds: [] }) });
    const loadingHtml = renderToStaticMarkup(
      React.createElement(ClassesManagementView, {
        initialClasses: [],
        initialRosters: {},
        backendStatus: 'LOADING',
      }),
    );
    assert.match(loadingHtml, /data-testid="classes-loading-state"/);
    assert.ok(!loadingHtml.includes('data-testid="classes-empty-state"'));

    // 2. Zero-assignment READY (explicit empty Teacher classes)
    const zeroAssignHtml = renderToStaticMarkup(
      React.createElement(ClassesManagementView, {
        initialClasses: [],
        initialRosters: {},
        backendStatus: 'READY',
      }),
    );
    assert.match(zeroAssignHtml, /data-testid="classes-empty-state"/);
    assert.match(zeroAssignHtml, /No classes assigned yet/);

    // 3. Assigned class with zero enrolled students (distinct from zero assignments)
    globalThis.__T1_CTX__ = baseCtx({ currentUser: makeUser({ assignedClassIds: ['cls-2'] }) });
    await act(async () => {
      root.render(
        React.createElement(ClassesManagementView, {
          initialClasses: [SAMPLE_CLASSES[1]],
          initialRosters: { 'cls-2': [] },
          backendStatus: 'READY',
        }),
      );
    });
    await act(async () => {
      findButtonByTestId(container, 'view-class-students-cls-2').click();
    });
    assert.ok(container.querySelector('[data-testid="roster-empty-state"]'));
    assert.match(container.innerHTML, /No students enrolled in this class/);

    // 4. ERROR with Retry button (never mislabeled as empty)
    globalThis.__T1_CTX__ = baseCtx({ currentUser: makeUser({ assignedClassIds: [] }) });
    await act(async () => {
      root.render(
        React.createElement(ClassesManagementView, {
          initialClasses: [],
          initialRosters: {},
          backendStatus: 'ERROR',
          errorMessage: 'Network timeout while fetching classes.',
          onRefresh: async () => {
            retryCalls += 1;
            return false;
          },
        }),
      );
    });
    assert.ok(container.querySelector('[data-testid="classes-error-state"]'));
    assert.equal(container.querySelector('[data-testid="classes-empty-state"]'), null);
    assert.match(container.innerHTML, /Network timeout while fetching classes\./);
    await act(async () => {
      findButtonByTestId(container, 'classes-retry-btn').click();
    });
    assert.equal(retryCalls, 1);

    // 5. UNAUTHORIZED hides cards and closes detail view
    const unauthHtml = renderToStaticMarkup(
      React.createElement(ClassesManagementView, {
        initialClasses: SAMPLE_CLASSES,
        initialRosters: SAMPLE_ROSTERS,
        backendStatus: 'UNAUTHORIZED',
      }),
    );
    assert.match(unauthHtml, /data-testid="classes-unauthorized-state"/);
    assert.ok(!unauthHtml.includes('data-testid="classes-card-grid"'));
    assert.ok(!unauthHtml.includes('data-testid="classes-empty-state"'));

    // 6. BLOCKED_BACKEND displays backend pending notice cleanly with zero SQL/internal tokens in Teacher copy
    const blockedHtml = renderToStaticMarkup(
      React.createElement(ClassesManagementView, {
        initialClasses: [],
        initialRosters: {},
        backendStatus: 'BACKEND_NOT_IMPLEMENTED',
      }),
    );
    assert.match(blockedHtml, /data-testid="classes-backend-pending-state"/);
    assert.doesNotMatch(blockedHtml, /school_classes|teacher_class_assignments|Codex|list_school_classes_with_rosters/);
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

test('T1-6: Mid-session assignment revocation and account switch immediately close stale roster & clear inaccessible class', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  globalThis.__T1_CTX__ = baseCtx({ currentUser: makeUser({ id: 'teacher-1', assignedClassIds: ['cls-1', 'cls-2'] }) });

  try {
    await act(async () => {
      root.render(
        React.createElement(ClassesManagementView, {
          initialClasses: SAMPLE_CLASSES,
          initialRosters: SAMPLE_ROSTERS,
          backendStatus: 'READY',
        }),
      );
    });

    await act(async () => {
      findButtonByTestId(container, 'view-class-students-cls-1').click();
    });
    assert.ok(container.querySelector('[data-testid="class-detail-roster-view"]'));

    // Assignment for cls-1 removed mid-session -> roster view closes immediately!
    globalThis.__T1_CTX__ = baseCtx({ currentUser: makeUser({ id: 'teacher-1', assignedClassIds: ['cls-2'] }) });
    await act(async () => {
      root.render(
        React.createElement(ClassesManagementView, {
          initialClasses: [SAMPLE_CLASSES[1]],
          initialRosters: { 'cls-2': [] },
          backendStatus: 'READY',
        }),
      );
    });
    assert.equal(container.querySelector('[data-testid="class-detail-roster-view"]'), null);
    assert.ok(container.querySelector('[data-testid="class-card-cls-2"]'));
    assert.equal(container.querySelector('[data-testid="class-card-cls-1"]'), null);

    // Open cls-2 then switch to another Teacher account -> detail state resets cleanly
    await act(async () => {
      findButtonByTestId(container, 'view-class-students-cls-2').click();
    });
    assert.ok(container.querySelector('[data-testid="class-detail-roster-view"]'));

    globalThis.__T1_CTX__ = baseCtx({ currentUser: makeUser({ id: 'teacher-2', assignedClassIds: ['cls-2'] }) });
    await act(async () => {
      root.render(
        React.createElement(ClassesManagementView, {
          initialClasses: [SAMPLE_CLASSES[1]],
          initialRosters: { 'cls-2': [] },
          backendStatus: 'READY',
        }),
      );
    });
    assert.equal(container.querySelector('[data-testid="class-detail-roster-view"]'), null);
    assert.ok(container.querySelector('[data-testid="classes-management-view"]'));
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

test('T1-7: AppContext hydration & pure state guards — zero-assignment Teacher skips failing roster RPC, failed context never fakes empty, stale async completions dropped', async () => {
  // Unit checks for pure hydration guards
  assert.deepEqual(
    resolveClassesRosterFetchStrategy(makeUser(), { ok: true, status: 'READY', data: { assignedClassIds: [] } }),
    { action: 'SKIP_CONFIRMED_ZERO_ASSIGNMENTS' },
  );
  assert.deepEqual(
    resolveClassesRosterFetchStrategy(makeUser(), { ok: false, status: 'ERROR', errorCode: '500' }),
    { action: 'FETCH_ROSTERS' },
  );
  assert.deepEqual(
    resolveClassesRosterFetchStrategy(makeUser(), { ok: false, status: 'UNAUTHORIZED', errorCode: 'actor_not_approved' }),
    { action: 'SKIP_UNAUTHORIZED', reason: 'actor_not_approved' },
  );
  assert.deepEqual(
    resolveClassesRosterFetchStrategy(makeUser({ role: 'APP_ADMIN' }), { ok: true, status: 'READY', data: { assignedClassIds: [] } }),
    { action: 'FETCH_ROSTERS' },
  );
  // Roles without administrative roster access skip only the roster RPC when school context is valid
  for (const nonRosterRole of ['PARENT', 'STUDENT', 'MANAGER', 'SCHOOL_STAFF']) {
    assert.deepEqual(
      resolveClassesRosterFetchStrategy(
        makeUser({ role: nonRosterRole, capabilities: [] }),
        { ok: true, status: 'READY', data: { assignedClassIds: ['cls-1'] } },
      ),
      { action: 'SKIP_ROLE_NO_ROSTER_PERMISSION' },
    );
    // Actual context denial (UNAUTHORIZED) still fails closed for every role
    assert.deepEqual(
      resolveClassesRosterFetchStrategy(
        makeUser({ role: nonRosterRole, capabilities: [] }),
        { ok: false, status: 'UNAUTHORIZED', errorCode: 'actor_not_approved' },
      ),
      { action: 'SKIP_UNAUTHORIZED', reason: 'actor_not_approved' },
    );
  }

  assert.equal(reconcileSelectedClassId('cls-1', ['cls-1', 'cls-2']), 'cls-1');
  assert.equal(reconcileSelectedClassId('cls-1', ['cls-2']), 'cls-2');
  assert.equal(reconcileSelectedClassId('cls-1', []), '');

  // Full AppProvider async hydration integration tests with mocked Supabase
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
  };
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  let rosterRpcCalls = 0;
  let contextScenario = 'zero_assignments';
  let rosterScenario = 'ok';
  let authCallback = null;
  let delayedRosterResolve = null;

  const sessionForTeacher = {
    user: {
      id: 'teacher-1',
      email: 'teacher1@kristou.test',
      user_metadata: { full_name: 'Amel Ben Ali' },
    },
  };

  globalThis.__T1_SUPABASE__ = {
    auth: {
      getSession: async () => ({ data: { session: sessionForTeacher }, error: null }),
      onAuthStateChange: (cb) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => ({ error: null }),
    },
    from: (table) => {
      const makeBuilder = (singleMode = false) => {
        const resolveResult = () => {
          if (table === 'profiles') {
            return {
              data: {
                id: 'teacher-1',
                username: 'amel',
                full_name: 'Amel Ben Ali',
                email: 'teacher1@kristou.test',
                account_status: 'APPROVED',
                requested_role: 'TEACHER',
              },
              error: null,
            };
          }
          if (table === 'role_assignments') {
            return { data: [{ role: 'TEACHER' }], error: null };
          }
          if (table === 'telegram_identities') {
            return { data: null, error: null };
          }
          return { data: singleMode ? null : [], error: null };
        };
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          gte: () => builder,
          lte: () => builder,
          or: () => builder,
          order: () => builder,
          limit: () => builder,
          single: async () => resolveResult(),
          maybeSingle: async () => resolveResult(),
          then: (resolve, reject) => Promise.resolve(resolveResult()).then(resolve, reject),
        };
        return builder;
      };
      return makeBuilder(false);
    },
    rpc: async (fnName) => {
      if (fnName === 'get_my_school_context') {
        if (contextScenario === 'zero_assignments') {
          return {
            data: { linkedChildrenIds: [], assignedClassIds: [], children: [], classes: [], operationalCounts: {} },
            error: null,
          };
        }
        if (contextScenario === 'error') {
          return { data: null, error: { code: '500', message: 'context_network_failure' } };
        }
        if (contextScenario === 'one_class') {
          return {
            data: {
              linkedChildrenIds: [],
              assignedClassIds: ['cls-1'],
              children: [],
              classes: [{ id: 'cls-1', name: 'CP-A', level: 'CP', teacherId: 'teacher-1', teacherName: 'Amel', academicYear: '2026-2027', studentCount: 2 }],
              operationalCounts: {},
            },
            error: null,
          };
        }
      }
      if (fnName === 'list_school_classes_with_rosters') {
        rosterRpcCalls += 1;
        if (rosterScenario === 'error') {
          return { data: null, error: { code: '500', message: 'roster_network_failure' } };
        }
        if (rosterScenario === 'unauth') {
          return { data: null, error: { code: '42501', message: 'insufficient_authority' } };
        }
        if (rosterScenario === 'delayed') {
          return await new Promise((resolve) => {
            delayedRosterResolve = resolve;
          });
        }
        return { data: [SAMPLE_CLASSES[0]], error: null };
      }
      return { data: null, error: { code: 'PGRST202', message: 'missing_rpc' } };
    },
  };

  let latestAppCtx = null;
  function Probe() {
    latestAppCtx = useApp();
    return React.createElement('div', null, latestAppCtx.classesBackendStatus);
  }

  try {
    await act(async () => {
      root.render(React.createElement(AppProvider, null, React.createElement(Probe)));
      await flushMicrotasks();
    });

    // Case A: zero-assignment Teacher confirmed via get_my_school_context -> READY empty without calling list_school_classes_with_rosters
    assert.equal(latestAppCtx.currentUser?.role, 'TEACHER');
    assert.equal(latestAppCtx.classesBackendStatus, 'READY');
    assert.deepEqual(latestAppCtx.classRosters, []);
    assert.equal(latestAppCtx.selectedClassId, '');
    assert.equal(rosterRpcCalls, 0, 'Must skip list_school_classes_with_rosters when context confirms zero Teacher assignments');

    // Case B: Failed context + ERROR/UNAUTHORIZED roster NEVER turns into empty READY
    contextScenario = 'error';
    rosterScenario = 'error';
    await act(async () => {
      await latestAppCtx.refreshSchoolData();
    });
    assert.equal(rosterRpcCalls, 1);
    assert.equal(latestAppCtx.classesBackendStatus, 'ERROR');
    assert.match(latestAppCtx.classesError || '', /roster_network_failure/);

    rosterScenario = 'unauth';
    await act(async () => {
      await latestAppCtx.refreshSchoolData();
    });
    assert.equal(latestAppCtx.classesBackendStatus, 'UNAUTHORIZED');

    // Case C: Assign class cls-1 -> loads cls-1 and selects it; then revoke assignment -> clears selectedClassId
    contextScenario = 'one_class';
    rosterScenario = 'ok';
    await act(async () => {
      await latestAppCtx.refreshSchoolData();
    });
    assert.equal(latestAppCtx.classesBackendStatus, 'READY');
    assert.equal(latestAppCtx.selectedClassId, 'cls-1');

    contextScenario = 'zero_assignments';
    await act(async () => {
      await latestAppCtx.refreshSchoolData();
    });
    assert.equal(latestAppCtx.classesBackendStatus, 'READY');
    assert.equal(latestAppCtx.selectedClassId, '');
    assert.deepEqual(latestAppCtx.currentUser?.assignedClassIds, []);

    // Case D: Stale async roster completion arriving after logout is ignored
    contextScenario = 'one_class';
    rosterScenario = 'delayed';
    let refreshPromise;
    await act(async () => {
      refreshPromise = latestAppCtx.refreshSchoolData();
      await flushMicrotasks();
    });
    assert.ok(delayedRosterResolve, 'Expected delayed roster RPC in flight');
    await act(async () => {
      latestAppCtx.logout();
      delayedRosterResolve({ data: [SAMPLE_CLASSES[0]], error: null });
      await refreshPromise;
    });
    assert.equal(latestAppCtx.currentUser, null);
    assert.deepEqual(latestAppCtx.classRosters, []);
    assert.equal(latestAppCtx.selectedClassId, '');
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

test('T1-8: AR (RTL), FR, EN localization, responsive layout classes, and Admin/Office/Manager preservation', () => {
  // Localization & zero internal tokens across AR / FR / EN
  const langExpectations = [
    { lang: 'ar', heading: 'أقسامي وقوائم التلاميذ', action: 'عرض قائمة التلاميذ' },
    { lang: 'fr', heading: 'Mes classes & Listes d’élèves', action: 'Voir les élèves' },
    { lang: 'en', heading: 'My Classes & Student Rosters', action: 'View Students' },
  ];
  for (const item of langExpectations) {
    globalThis.__T1_CTX__ = baseCtx({ language: item.lang });
    const html = renderToStaticMarkup(
      React.createElement(ClassesManagementView, {
        initialClasses: SAMPLE_CLASSES,
        initialRosters: SAMPLE_ROSTERS,
        backendStatus: 'READY',
        onOpenClassCommunity: () => {},
      }),
    );
    const normalizedHtml = html.replace(/&amp;/g, '&');
    assert.ok(normalizedHtml.includes(item.heading), `Expected ${item.lang} Teacher heading`);
    assert.ok(normalizedHtml.includes(item.action), `Expected ${item.lang} View Students CTA`);
    assert.match(html, /grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/, 'Responsive mobile-first class card grid');
  }

  // Admin & delegated Manager retain management UI unchanged
  for (const adminUser of [
    makeUser({ role: 'APP_ADMIN', capabilities: ['APP_ADMIN'] }),
    makeUser({ role: 'ADMINISTRATIVE_PERSONNEL', capabilities: [] }),
    makeUser({ role: 'MANAGER', capabilities: ['CLASSES_MANAGE', 'CLASSES_ROSTER_VIEW'] }),
  ]) {
    globalThis.__T1_CTX__ = baseCtx({ currentUser: adminUser });
    const html = renderToStaticMarkup(
      React.createElement(ClassesManagementView, {
        initialClasses: SAMPLE_CLASSES,
        initialRosters: SAMPLE_ROSTERS,
        backendStatus: 'READY',
      }),
    );
    assert.ok(html.includes('data-testid="toggle-create-class-btn"'));
    assert.ok(html.includes('data-testid="toggle-enroll-student-btn"'));
    assert.ok(html.includes('data-testid="toggle-assign-teacher-btn"'));
    assert.ok(html.includes('data-testid="class-card-cls-unassigned"'), 'Admin still sees all school classes');
  }

  // Source invariant: resolveTeacherAssignedClasses helper returns strictly assigned items
  assert.deepEqual(resolveTeacherAssignedClasses({ assignedClassIds: ['cls-2'] }, SAMPLE_CLASSES).map((c) => c.id), ['cls-2']);
});

test('T1-9: Pure guards separate roster permission from non-roster class membership, keep tab boundaries closed, and fail closed on unauthorized context', () => {
  // 1. Approved non-roster roles (Parent, Student, un-delegated Manager/School Staff) skip ONLY roster RPC on non-UNAUTHORIZED context
  for (const role of ['PARENT', 'STUDENT', 'MANAGER', 'SCHOOL_STAFF']) {
    for (const status of ['READY', 'ERROR', 'BLOCKED_BACKEND']) {
      const res = resolveClassesRosterFetchStrategy(
        makeUser({ role, capabilities: [] }),
        status === 'READY'
          ? { ok: true, status: 'READY', data: { assignedClassIds: ['cls-a', 'cls-b'] } }
          : { ok: false, status, errorCode: status.toLowerCase() },
      );
      assert.deepEqual(res, { action: 'SKIP_ROLE_NO_ROSTER_PERMISSION' });
    }
    // Actual context denial fails closed even for non-roster roles
    assert.deepEqual(
      resolveClassesRosterFetchStrategy(
        makeUser({ role, capabilities: [] }),
        { ok: false, status: 'UNAUTHORIZED', errorCode: 'actor_not_approved' },
      ),
      { action: 'SKIP_UNAUTHORIZED', reason: 'actor_not_approved' },
    );
  }

  // 2. Roster-permitted Manager/School Staff delegations and non-approved accounts
  for (const cap of ['CLASSES_ROSTER_VIEW', 'CLASSES_MANAGE', 'FULL_ACCESS']) {
    assert.deepEqual(
      resolveClassesRosterFetchStrategy(
        makeUser({ role: 'MANAGER', capabilities: [cap] }),
        { ok: true, status: 'READY', data: { assignedClassIds: [] } },
      ),
      { action: 'FETCH_ROSTERS' },
    );
  }
  assert.deepEqual(
    resolveClassesRosterFetchStrategy(
      makeUser({ role: 'SCHOOL_STAFF', capabilities: ['CLASSES_ROSTER_VIEW'] }),
      { ok: true, status: 'READY', data: { assignedClassIds: [] } },
    ),
    { action: 'FETCH_ROSTERS' },
  );
  for (const role of ['PARENT', 'STUDENT', 'TEACHER']) {
    assert.deepEqual(
      resolveClassesRosterFetchStrategy(
        makeUser({ role, accountStatus: 'PENDING' }),
        { ok: true, status: 'READY', data: { assignedClassIds: ['cls-a'] } },
      ),
      { action: 'SKIP_UNAUTHORIZED', reason: 'actor_not_approved' },
    );
  }

  // 3. Preserved Teacher behavior: confirmed 0 assignments skips roster RPC; assigned/ERROR/BLOCKED fetches; UNAUTHORIZED skips fail-closed
  assert.deepEqual(
    resolveClassesRosterFetchStrategy(makeUser({ role: 'TEACHER' }), {
      ok: true,
      status: 'READY',
      data: { assignedClassIds: ['cls-1'] },
    }),
    { action: 'FETCH_ROSTERS' },
  );
  assert.deepEqual(
    resolveClassesRosterFetchStrategy(makeUser({ role: 'TEACHER' }), {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
    }),
    { action: 'FETCH_ROSTERS' },
  );

  // 4. Selection reconciliation preserves Parent multi-class choice & Student class ID, clears only when authorized list is empty
  assert.equal(reconcileSelectedClassId('', ['cls-parent-1', 'cls-parent-2']), 'cls-parent-1');
  assert.equal(reconcileSelectedClassId('cls-parent-2', ['cls-parent-1', 'cls-parent-2']), 'cls-parent-2');
  assert.equal(reconcileSelectedClassId('cls-removed', ['cls-parent-1', 'cls-parent-2']), 'cls-parent-1');
  assert.equal(reconcileSelectedClassId('', ['cls-student-1']), 'cls-student-1');
  assert.equal(reconcileSelectedClassId('cls-student-1', []), '');

  // 5. Parents & Students retain community access without gaining Classes-tab or roster management access
  for (const role of ['PARENT', 'STUDENT']) {
    const member = makeUser({ role, capabilities: [] });
    assert.equal(canAccessAppTab(member, 'community'), true);
    assert.equal(canAccessAppTab(member, 'classes'), false);
    assert.equal(canManageClassesUi(member), false);
  }
});
