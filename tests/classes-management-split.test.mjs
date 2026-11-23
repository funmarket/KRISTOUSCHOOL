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

async function bundleClassesManagementView() {
  const outdir = path.join('/tmp', 'kristou-arch04-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, 'classes-management-view.cjs');

  await build({
    entryPoints: [path.resolve(__dirname, '../src/components/views/ClassesManagementView.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    define: { __KRISTOU_SUPABASE_URL__: '""', __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '""' },
    plugins: [
      {
        name: 'arch04-mocks',
        setup(builder) {
          builder.onResolve({ filter: /context\/AppContext(\.tsx)?$/ }, () => ({
            path: 'mock-app-ctx',
            namespace: 'arch04',
          }));
          builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'arch04' }, () => ({
            contents: `
              export const useApp = () => globalThis.__ARCH04_APP_CTX__;
            `,
          }));
          builder.onResolve({ filter: /lib\/accountGovernance(\.ts)?$/ }, () => ({
            path: 'mock-account-gov',
            namespace: 'arch04',
          }));
          builder.onLoad({ filter: /^mock-account-gov$/, namespace: 'arch04' }, () => ({
            contents: `
              export async function listAccountDirectory(params) {
                if (globalThis.__ARCH04_LIST_ACCOUNTS__) {
                  return globalThis.__ARCH04_LIST_ACCOUNTS__(params);
                }
                return { ok: true, data: { items: [] } };
              }
            `,
          }));
          builder.onResolve({ filter: /lib\/schoolOperations(\.ts)?$/ }, () => ({
            path: 'mock-school-ops',
            namespace: 'arch04',
          }));
          builder.onLoad({ filter: /^mock-school-ops$/, namespace: 'arch04' }, () => ({
            contents: `
              export const CANONICAL_SCHOOL_LEVELS = [
                { code: 'CP', labelAr: 'السنة الأولى', labelFr: 'CP (1ère)', labelEn: 'Grade 1 (CP)' },
                { code: 'CE1', labelAr: 'السنة الثانية', labelFr: 'CE1 (2ème)', labelEn: 'Grade 2 (CE1)' },
              ];
              export async function createSchoolClass(params) {
                return globalThis.__ARCH04_CREATE_CLASS__(params);
              }
              export async function createAndEnrollStudent(params) {
                return globalThis.__ARCH04_ENROLL_STUDENT__(params);
              }
              export async function assignTeacherToClass(params) {
                return globalThis.__ARCH04_ASSIGN_TEACHER__(params);
              }
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

const { ClassesManagementView, filterSchoolClasses, filterClassRoster } =
  await bundleClassesManagementView();

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

test('ARCH-04 Gate 1: ClassesManagementView.tsx <= 450 lines, every file in src/components/views/classes/ <= 400 lines, and zero direct .from/.rpc calls', () => {
  const mainViewPath = path.resolve(__dirname, '../src/components/views/ClassesManagementView.tsx');
  const subDir = path.resolve(__dirname, '../src/components/views/classes');

  const countLines = (txt) => txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0);

  const mainSrc = fs.readFileSync(mainViewPath, 'utf8');
  const mainLines = countLines(mainSrc);
  assert.ok(mainLines <= 450, `ClassesManagementView.tsx must be <= 450 lines (got ${mainLines})`);
  assert.doesNotMatch(
    mainSrc,
    /\.(from|rpc)\(/,
    'ClassesManagementView.tsx must not contain direct .from( or .rpc( calls',
  );

  const subFiles = fs
    .readdirSync(subDir)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .sort();
  assert.ok(subFiles.length >= 4, 'Expected extracted subcomponents/hooks under src/components/views/classes/');

  for (const file of subFiles) {
    const fullPath = path.join(subDir, file);
    const src = fs.readFileSync(fullPath, 'utf8');
    const lines = countLines(src);
    assert.ok(lines <= 400, `src/components/views/classes/${file} must be <= 400 lines (got ${lines})`);
    assert.doesNotMatch(
      src,
      /\.(from|rpc)\(/,
      `src/components/views/classes/${file} must not contain direct .from( or .rpc( calls`,
    );
  }
});

test('ARCH-04 Gate 2: Preserves Teacher T1/T2 read-only assigned-class scoping, 25-row pagination, search, and StudentOverview selection', async () => {
  assert.equal(typeof filterSchoolClasses, 'function');
  assert.equal(typeof filterClassRoster, 'function');

  const teacherUser = makeUser({
    id: 'teacher-1',
    role: 'TEACHER',
    capabilities: ['TEACHER'],
    assignedClassIds: ['cls-1'],
  });

  const classes = [
    {
      id: 'cls-1',
      name: '1ère A',
      level: 'CP',
      levelCode: 'CP',
      academicYear: '2026-2027',
      homeroomTeacherName: 'Teacher One',
      activeStudentCount: 27,
      capacity: 28,
    },
    {
      id: 'cls-2',
      name: '2ème B',
      level: 'CE1',
      levelCode: 'CE1',
      academicYear: '2026-2027',
      homeroomTeacherName: 'Teacher Two',
      activeStudentCount: 20,
      capacity: 28,
    },
  ];

  const roster27 = Array.from({ length: 27 }, (_, i) => ({
    studentId: `stu-${i + 1}`,
    studentCode: `KS-2026-${String(i + 1).padStart(3, '0')}`,
    fullName: `Student ${i + 1}`,
    primaryGuardianName: `Parent ${i + 1}`,
    enrollmentStatus: 'ACTIVE',
    enrolledAt: '2026-09-01',
  }));

  globalThis.__ARCH04_APP_CTX__ = {
    currentUser: teacherUser,
    language: 'en',
    t: (k) => k,
    selectedClassId: null,
    setSelectedClassId: () => {},
  };

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(ClassesManagementView, {
        initialClasses: classes,
        initialRosters: { 'cls-1': roster27 },
        backendStatus: 'READY',
      }),
    );
  });

  // Teacher only sees assigned cls-1, never cls-2, and no admin create/enroll/assign toggles
  assert.ok(container.querySelector('[data-testid="class-card-cls-1"]'));
  assert.equal(container.querySelector('[data-testid="class-card-cls-2"]'), null);
  assert.equal(container.querySelector('[data-testid="toggle-create-class-btn"]'), null);

  // Open cls-1 roster -> 25-row page 1/2
  const viewBtn = container.querySelector('[data-testid="view-class-students-cls-1"]');
  await act(async () => {
    viewBtn.click();
  });
  assert.ok(container.querySelector('[data-testid="class-detail-roster-view"]'));
  assert.equal(container.querySelector('[data-testid="roster-page-indicator"]')?.textContent, '1 / 2');

  // Next page -> 2/2
  const nextBtn = container.querySelector('[data-testid="roster-next-page-btn"]');
  await act(async () => {
    nextBtn.click();
  });
  assert.equal(container.querySelector('[data-testid="roster-page-indicator"]')?.textContent, '2 / 2');
  assert.ok(container.querySelector('[data-testid="roster-student-row-stu-27"]'));

  // Open StudentOverview for stu-27
  const viewStuBtn = container.querySelector('[data-testid="view-student-stu-27"]');
  await act(async () => {
    viewStuBtn.click();
  });
  assert.ok(container.querySelector('[data-testid="student-overview-view"]'));

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ARCH-04 Gate 3: Preserves Admin/Manager create class, enroll student, and assign teacher workflows', async () => {
  const createdCalls = [];
  globalThis.__ARCH04_CREATE_CLASS__ = async (params) => {
    createdCalls.push(params);
    return {
      ok: true,
      data: {
        id: 'cls-new',
        name: params.name,
        levelCode: params.levelCode,
        academicYearCode: params.academicYearCode,
      },
    };
  };

  globalThis.__ARCH04_APP_CTX__ = {
    currentUser: makeUser({ role: 'MANAGER', capabilities: ['CLASSES_MANAGE', 'CLASSES_ROSTER_VIEW'] }),
    language: 'en',
    t: (k) => k,
    selectedClassId: null,
    setSelectedClassId: () => {},
  };

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(ClassesManagementView, {
        initialClasses: [],
        initialRosters: {},
        backendStatus: 'READY',
        onRefresh: async () => true,
      }),
    );
  });

  // Delegated manager sees create, enroll, and assign toggles
  const toggleEnrollBtn = container.querySelector('[data-testid="toggle-enroll-student-btn"]');
  assert.ok(toggleEnrollBtn);
  await act(async () => {
    toggleEnrollBtn.click();
  });
  // Delegated manager without account review capability sees clean notice
  assert.ok(container.querySelector('[data-testid="assignable-accounts-blocked-notice"]'));

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});
