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

async function bundleStudentsManagementView() {
  const outdir = path.join('/tmp', 'kristou-arch05-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, 'students-management-view.cjs');

  await build({
    entryPoints: [path.resolve(__dirname, '../src/components/views/StudentsManagementView.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    define: { __KRISTOU_SUPABASE_URL__: '""', __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '""' },
    plugins: [
      {
        name: 'arch05-mocks',
        setup(builder) {
          builder.onResolve({ filter: /context\/AppContext(\.tsx)?$/ }, () => ({
            path: 'mock-app-ctx',
            namespace: 'arch05',
          }));
          builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'arch05' }, () => ({
            contents: `
              export const useApp = () => globalThis.__ARCH05_APP_CTX__;
            `,
          }));
          builder.onResolve({ filter: /lib\/schoolOperations(\.ts)?$/ }, () => ({
            path: 'mock-school-ops',
            namespace: 'arch05',
          }));
          builder.onLoad({ filter: /^mock-school-ops$/, namespace: 'arch05' }, () => ({
            contents: `
              export const listSchoolStudents = (...args) => globalThis.__ARCH05_OPS__.listSchoolStudents(...args);
              export const getSchoolStudentIdentity = (...args) => globalThis.__ARCH05_OPS__.getSchoolStudentIdentity(...args);
              export const listAcademicYears = (...args) => globalThis.__ARCH05_OPS__.listAcademicYears(...args);
              export const fetchSchoolClassesWithRosters = (...args) => globalThis.__ARCH05_OPS__.fetchSchoolClassesWithRosters(...args);
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

const { StudentsManagementView } = await bundleStudentsManagementView();

test('ARCH-05 Gate 1: StudentsManagementView.tsx <= 320 lines, every file in src/components/views/students/ <= 350 lines, and zero direct .from/.rpc calls', () => {
  const mainViewPath = path.resolve(__dirname, '../src/components/views/StudentsManagementView.tsx');
  const subDir = path.resolve(__dirname, '../src/components/views/students');

  const countLines = (txt) => txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0);

  const mainSrc = fs.readFileSync(mainViewPath, 'utf8');
  const mainLines = countLines(mainSrc);
  assert.ok(mainLines <= 320, `StudentsManagementView.tsx must be <= 320 lines (got ${mainLines})`);
  assert.doesNotMatch(
    mainSrc,
    /\.(from|rpc)\(/,
    'StudentsManagementView.tsx must not contain direct .from( or .rpc( calls',
  );

  const subFiles = fs
    .readdirSync(subDir)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .sort();
  assert.ok(subFiles.length >= 3, 'Expected extracted subcomponents/hooks under src/components/views/students/');

  for (const file of subFiles) {
    const fullPath = path.join(subDir, file);
    const src = fs.readFileSync(fullPath, 'utf8');
    const lines = countLines(src);
    assert.ok(lines <= 350, `src/components/views/students/${file} must be <= 350 lines (got ${lines})`);
    assert.doesNotMatch(
      src,
      /\.(from|rpc)\(/,
      `src/components/views/students/${file} must not contain direct .from( or .rpc( calls`,
    );
  }
});

test('ARCH-05 Gate 2: Role access guard, directory rendering, dossier opening, and roster-to-dossier back navigation handoff', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  // 1. Unauthorized role (TEACHER) renders UNAUTHORIZED EmptyFeatureState
  globalThis.__ARCH05_APP_CTX__ = {
    currentUser: { id: 'teacher-1', role: 'TEACHER', accountStatus: 'APPROVED' },
    language: 'en',
  };
  globalThis.__ARCH05_OPS__ = {
    listAcademicYears: async () => ({ ok: true, data: [] }),
    fetchSchoolClassesWithRosters: async () => ({ ok: true, data: [] }),
    listSchoolStudents: async () => ({ ok: true, data: { items: [], total: 0 } }),
    getSchoolStudentIdentity: async () => ({ ok: true, data: null }),
  };

  await act(async () => {
    root.render(React.createElement(StudentsManagementView));
  });

  assert.ok(
    container.textContent?.includes('Administrative Access Required'),
    'Unauthorized role must see Administrative Access Required state',
  );

  // 2. Authorized role (APP_ADMIN) loads student directory and opens dossier drawer
  let backToOriginCalled = 0;
  globalThis.__ARCH05_APP_CTX__ = {
    currentUser: { id: 'admin-1', role: 'APP_ADMIN', accountStatus: 'APPROVED', capabilities: ['APP_ADMIN'] },
    language: 'en',
  };
  globalThis.__ARCH05_OPS__ = {
    listAcademicYears: async () => ({
      ok: true,
      data: [{ id: 'ay-1', code: '2026-2027', name: '2026-2027', isCurrent: true }],
    }),
    fetchSchoolClassesWithRosters: async () => ({
      ok: true,
      data: [{ id: 'cls-1', name: 'CP-A', levelCode: 'CP', academicYear: '2026-2027' }],
    }),
    listSchoolStudents: async () => ({
      ok: true,
      data: {
        items: [
          {
            studentId: 'stu-101',
            studentCode: 'KRS-101',
            fullName: 'Yasmine Mansouri',
            status: 'ACTIVE',
            classes: [
              {
                membershipId: 'm-1',
                classId: 'cls-1',
                className: 'CP-A',
                academicYearCode: '2026-2027',
              },
            ],
          },
        ],
        total: 1,
      },
    }),
    getSchoolStudentIdentity: async (studentId) => ({
      ok: true,
      data: {
        studentId,
        studentCode: 'KRS-101',
        fullName: 'Yasmine Mansouri',
        birthDate: '2018-04-12',
        status: 'ACTIVE',
        hasLinkedStudentAccount: true,
        memberships: [
          {
            membershipId: 'm-1',
            academicYearCode: '2026-2027',
            classId: 'cls-1',
            className: 'CP-A',
            levelCode: 'CP',
            classArchived: false,
            enrollmentStatus: 'ACTIVE',
            startedAt: '2026-09-01',
            endedAt: null,
          },
        ],
      },
    }),
  };

  await act(async () => {
    root.render(
      React.createElement(StudentsManagementView, {
        navOrigin: 'roster',
        onBackToOrigin: () => {
          backToOriginCalled++;
        },
      }),
    );
  });

  assert.ok(container.textContent?.includes('Yasmine Mansouri'), 'Directory list must display student fullName');
  assert.ok(container.textContent?.includes('KRS-101'), 'Directory list must display studentCode');

  // Click student button to open dossier
  const buttons = [...container.querySelectorAll('button')];
  const studentBtn = buttons.find((b) => b.textContent?.includes('Yasmine Mansouri'));
  assert.ok(studentBtn, 'Expected clickable student button');

  await act(async () => {
    studentBtn.click();
  });

  assert.ok(container.textContent?.includes('2018-04-12'), 'Dossier drawer must display student birthDate');
  assert.ok(
    container.textContent?.includes('Back to Class Roster'),
    'Dossier drawer with navOrigin="roster" must display Back to Class Roster',
  );

  // Click Back button and verify onBackToOrigin handoff
  const backBtn = [...container.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Back to Class Roster'),
  );
  assert.ok(backBtn, 'Expected Back to Class Roster button');

  await act(async () => {
    backBtn.click();
  });

  assert.equal(backToOriginCalled, 1, 'Clicking Back in dossier must invoke onBackToOrigin');

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ARCH-05 Gate 3: Stale in-flight request cancellation, actor-scope protection, and dossier identity mismatch guard', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  let resolveFirstList;
  const firstListPromise = new Promise((resolve) => {
    resolveFirstList = resolve;
  });

  let callCount = 0;
  globalThis.__ARCH05_APP_CTX__ = {
    currentUser: { id: 'admin-A', role: 'APP_ADMIN', accountStatus: 'APPROVED', capabilities: ['APP_ADMIN'] },
    language: 'en',
  };
  globalThis.__ARCH05_OPS__ = {
    listAcademicYears: async () => ({ ok: true, data: [] }),
    fetchSchoolClassesWithRosters: async () => ({ ok: true, data: [] }),
    listSchoolStudents: async () => {
      callCount++;
      if (callCount === 1) {
        return firstListPromise;
      }
      return {
        ok: true,
        data: {
          items: [
            {
              studentId: 'stu-B',
              studentCode: 'KRS-B',
              fullName: 'Fresh Actor Student',
              status: 'ACTIVE',
              classes: [],
            },
          ],
          total: 1,
        },
      };
    },
    getSchoolStudentIdentity: async () => ({
      ok: true,
      data: {
        studentId: 'WRONG-ID',
        studentCode: 'KRS-ERR',
        fullName: 'Wrong Student',
        birthDate: '2019-01-01',
        status: 'ACTIVE',
        hasLinkedStudentAccount: false,
        memberships: [],
      },
    }),
  };

  await act(async () => {
    root.render(React.createElement(StudentsManagementView));
  });

  // Switch actor to admin-B before admin-A's request resolves
  globalThis.__ARCH05_APP_CTX__ = {
    currentUser: { id: 'admin-B', role: 'ADMINISTRATIVE_PERSONNEL', accountStatus: 'APPROVED', capabilities: ['ADMINISTRATIVE_PERSONNEL'] },
    language: 'en',
  };

  await act(async () => {
    root.render(React.createElement(StudentsManagementView));
  });

  // Now resolve the stale first request from admin-A
  await act(async () => {
    resolveFirstList({
      ok: true,
      data: {
        items: [
          {
            studentId: 'stu-A-stale',
            studentCode: 'KRS-STALE',
            fullName: 'Stale Actor Student',
            status: 'ACTIVE',
            classes: [],
          },
        ],
        total: 1,
      },
    });
  });

  assert.ok(
    container.textContent?.includes('Fresh Actor Student'),
    'Fresh actor student list must remain rendered',
  );
  assert.ok(
    !container.textContent?.includes('Stale Actor Student'),
    'Stale in-flight response from previous actor/sequence must be ignored',
  );

  // Open student dossier where backend returns a mismatched studentId
  await act(async () => {
    root.render(
      React.createElement(StudentsManagementView, {
        initialSelectedStudentId: 'stu-B',
      }),
    );
  });

  assert.ok(
    container.textContent?.includes('Student identity mismatch detected.'),
    'Dossier view must reject mismatched studentId payload',
  );

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});
