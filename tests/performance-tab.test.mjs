import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';

const { canAccessAppTab } = await import('../src/components/homepages/homepageAccess.ts');
const { translations } = await import('../src/i18n/translations.ts');
const {
  buildPerformanceActorScopeKey,
  getLocalizedSubjectLabel,
  isAllocationResultApplicable,
  parseTeacherSubjectAllocationsResponse,
  reconcileSelectedSubjectId,
  resolveParentPerformanceScope,
  resolvePostRefreshAction,
  resolveTeacherAllocationsFetchPlan,
  resolveTeacherPerformanceScope,
  resolveVisibleTeacherAllocations,
} = await import('../src/lib/performance.ts');

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    username: 'amel.benali',
    fullName: 'Amel Ben Ali',
    role: 'TEACHER',
    accountStatus: 'APPROVED',
    assignedClassIds: ['cls-1'],
    linkedChildrenIds: [],
    capabilities: ['TEACHER'],
    ...overrides,
  };
}

function makeValidAllocationRow(overrides = {}) {
  return {
    allocationId: 'al-1',
    assignmentId: 'as-1',
    teacherUserId: 'user-1',
    classId: 'cls-1',
    className: 'CP-A',
    levelCode: 'CP',
    academicYear: '2026-2027',
    isHomeroom: true,
    subjectId: 'sub-math',
    subjectCode: 'MATH',
    domainCode: 'STEM',
    labelAr: 'الرياضيات',
    labelFr: 'Mathématiques',
    labelEn: 'Mathematics',
    offeringId: 'off-1',
    active: true,
    allocatedAt: '2026-11-17T10:00:00Z',
    version: 1,
    components: [
      {
        id: 'comp-1',
        code: 'CALC',
        labelAr: 'الحساب الذهني',
        labelFr: 'Calcul mental',
        labelEn: 'Mental Calculation',
        sortOrder: 1,
      },
    ],
    ...overrides,
  };
}

test('Performance-1 (Pure): Access guard allows only approved TEACHER and PARENT and denies all other roles/statuses', () => {
  assert.equal(canAccessAppTab(null, 'performance'), false);
  assert.equal(canAccessAppTab(makeUser({ role: 'TEACHER', accountStatus: 'APPROVED' }), 'performance'), true);
  assert.equal(canAccessAppTab(makeUser({ role: 'PARENT', accountStatus: 'APPROVED' }), 'performance'), true);

  for (const status of ['PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED']) {
    assert.equal(canAccessAppTab(makeUser({ role: 'TEACHER', accountStatus: status }), 'performance'), false);
    assert.equal(canAccessAppTab(makeUser({ role: 'PARENT', accountStatus: status }), 'performance'), false);
  }

  for (const deniedRole of ['STUDENT', 'SCHOOL_STAFF', 'ADMINISTRATIVE_PERSONNEL', 'MANAGER', 'APP_ADMIN']) {
    assert.equal(
      canAccessAppTab(makeUser({ role: deniedRole, accountStatus: 'APPROVED' }), 'performance'),
      false,
      `${deniedRole} must be denied on performance tab`,
    );
  }
});

test('Performance-2 (Static Source Check): Navigation, translations, hook order, RPC allowlist, and removal of test bypasses', () => {
  const navbarSrc = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  assert.match(navbarSrc, /canAccessAppTab\(currentUser,\s*'performance'\)/);
  assert.match(navbarSrc, /setActiveTab\('performance'\)/);
  assert.match(navbarSrc, /dir="ltr"/);

  // Preserve Teachers -> Classes -> Registration navigation ordering
  const teachersIdx = navbarSrc.indexOf("setActiveTab('directory')");
  const classesIdx = navbarSrc.indexOf("setActiveTab('classes')");
  const registrationIdx = navbarSrc.indexOf("setActiveTab('registration')");
  assert.ok(teachersIdx > 0 && classesIdx > teachersIdx && registrationIdx > classesIdx);

  // Trilingual labels
  assert.equal(translations.ar.performance, 'الأداء والنتائج');
  assert.equal(translations.fr.performance, 'Performance');
  assert.equal(translations.en.performance, 'Performance');

  // App wires zero-prop <PerformanceView /> behind canAccessAppTab
  const appSrc = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSrc, /activeTab === 'performance'/);
  assert.match(appSrc, /canAccessAppTab\(currentUser,\s*'performance'\)/);
  assert.match(appSrc, /<PerformanceView\s*\/>/);

  const perfLibSrc = fs.readFileSync(new URL('../src/lib/performance.ts', import.meta.url), 'utf8');
  const perfViewSrc = fs.readFileSync(new URL('../src/components/views/PerformanceView.tsx', import.meta.url), 'utf8');

  // Zero mocks, second clients, localStorage grades, or test-only injection props
  for (const src of [perfLibSrc, perfViewSrc]) {
    assert.doesNotMatch(src, /mockData|MOCK_CHILDREN|MOCK_CLASSES|MOCK_/);
    assert.doesNotMatch(src, /createClient\s*\(/);
    assert.doesNotMatch(src, /localStorage/);
  }
  assert.doesNotMatch(
    perfViewSrc,
    /initialAllocations|initialAllocationsStatus|initialAllocationsError|PerformanceViewProps/,
  );

  // Arabic typo corrected and no "parent-linked components" ambiguity
  assert.doesNotMatch(perfViewSrc, /النطرق/);
  assert.doesNotMatch(perfViewSrc, /parent-linked/i);

  // Every hook in PerformanceView appears before early unauthorized return
  const earlyReturnIdx = perfViewSrc.indexOf('if (!isAuthorizedRole)');
  assert.ok(earlyReturnIdx > 0);
  const afterEarlyReturn = perfViewSrc.slice(earlyReturnIdx);
  assert.doesNotMatch(afterEarlyReturn, /\b(useState|useRef|useMemo|useCallback|useEffect|useApp)\s*\(/);

  // Only allowed RPC in performance.ts is list_my_teacher_subject_allocations
  const rpcCalls = [...perfLibSrc.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual(rpcCalls, ['list_my_teacher_subject_allocations']);
});

test('Performance-3 (Pure): Scope resolution, render-time visibility gate, and localization helpers', () => {
  const teacher = makeUser({ role: 'TEACHER', assignedClassIds: ['cls-1'] });
  const classesList = [
    {
      id: 'cls-1',
      name: 'CP-A',
      level: 'CP',
      teacherId: 'user-1',
      teacherName: 'Amel Ben Ali',
      academicYear: '2026-2027',
      studentCount: 1,
    },
    {
      id: 'cls-unassigned',
      name: 'CM2-Z',
      level: 'CM2',
      teacherId: 'other-teacher',
      teacherName: 'Other Teacher',
      academicYear: '2026-2027',
      studentCount: 1,
    },
  ];
  const classRosters = [
    {
      id: 'cls-1',
      name: 'CP-A',
      level: 'CP',
      academicYear: '2026-2027',
      homeroomTeacherName: 'Amel Ben Ali',
      activeStudentCount: 1,
      roster: [
        {
          studentId: 'stu-1',
          studentCode: 'KS-2026-001',
          fullName: 'Ines Trabelsi',
          enrollmentStatus: 'ACTIVE',
          enrolledAt: '2026-09-15',
          primaryGuardianName: 'Sami Trabelsi',
        },
      ],
    },
    {
      id: 'cls-unassigned',
      name: 'CM2-Z',
      level: 'CM2',
      academicYear: '2026-2027',
      homeroomTeacherName: 'Other Teacher',
      activeStudentCount: 1,
      roster: [
        {
          studentId: 'stu-secret',
          studentCode: 'KS-2026-999',
          fullName: 'Unassigned Secret Student',
          enrollmentStatus: 'ACTIVE',
          enrolledAt: '2026-09-15',
          primaryGuardianName: 'Other Parent',
        },
      ],
    },
  ];

  // Teacher receives strictly assigned class and its roster
  const tScope = resolveTeacherPerformanceScope({
    currentUser: teacher,
    classesList,
    classRosters,
    selectedClassId: 'cls-unassigned',
    selectedStudentId: 'stu-secret',
  });
  assert.deepEqual(tScope.authorizedClasses.map((c) => c.id), ['cls-1']);
  assert.equal(tScope.activeClassId, 'cls-1');
  assert.deepEqual(tScope.authorizedStudents.map((s) => s.studentId), ['stu-1']);
  assert.equal(tScope.activeStudentId, '');

  // Parent receives strictly linked children
  const parent = makeUser({ role: 'PARENT', linkedChildrenIds: ['child-1'], assignedClassIds: [] });
  const childrenList = [
    {
      id: 'child-1',
      fullName: 'Lina Ben Ali',
      classId: 'cls-1',
      className: 'CP-A',
      level: 'CP',
      birthDate: '2020-03-10',
      photoUrl: '',
      pickupAuthorizedNames: [],
    },
    {
      id: 'child-unlinked',
      fullName: 'Other Child',
      classId: 'cls-99',
      className: 'CM2-Z',
      level: 'CM2',
      birthDate: '2016-05-01',
      photoUrl: '',
      pickupAuthorizedNames: [],
    },
  ];
  const pScope = resolveParentPerformanceScope({
    currentUser: parent,
    childrenList,
    selectedChildId: 'child-unlinked',
  });
  assert.deepEqual(pScope.linkedChildren.map((c) => c.id), ['child-1']);
  assert.equal(pScope.activeChildId, 'child-1');

  // Render-time visibility gate suppresses stale, hydrating, error, or unauthorized data
  const teacherScopeKey = buildPerformanceActorScopeKey(teacher);
  const validItem = makeValidAllocationRow();
  const readyState = {
    actorScopeKey: teacherScopeKey,
    classId: 'cls-1',
    status: 'READY',
    items: [validItem],
    errorMessage: null,
  };

  assert.equal(
    resolveVisibleTeacherAllocations({
      currentUser: teacher,
      currentActorScopeKey: teacherScopeKey,
      activeClassId: 'cls-1',
      activeClass: classesList[0],
      isHydratingSchoolData: true,
      classesBackendStatus: 'READY',
      classesError: null,
      allocationsState: readyState,
    }).status,
    'LOADING',
  );

  assert.deepEqual(
    resolveVisibleTeacherAllocations({
      currentUser: teacher,
      currentActorScopeKey: teacherScopeKey,
      activeClassId: 'cls-1',
      activeClass: classesList[0],
      isHydratingSchoolData: false,
      classesBackendStatus: 'ERROR',
      classesError: 'network_down',
      allocationsState: readyState,
    }),
    {
      status: 'ERROR',
      items: [],
      errorMessage: 'network_down',
      hasConfirmedNoClasses: false,
    },
  );

  // Stale state from another actorScopeKey or classId is suppressed during render (returns LOADING, items: [])
  const teacher2 = makeUser({ id: 'user-2', assignedClassIds: ['cls-1'] });
  const teacher2Key = buildPerformanceActorScopeKey(teacher2);
  assert.deepEqual(
    resolveVisibleTeacherAllocations({
      currentUser: teacher2,
      currentActorScopeKey: teacher2Key,
      activeClassId: 'cls-1',
      activeClass: classesList[0],
      isHydratingSchoolData: false,
      classesBackendStatus: 'READY',
      classesError: null,
      allocationsState: readyState,
    }),
    {
      status: 'LOADING',
      items: [],
      errorMessage: null,
      hasConfirmedNoClasses: false,
    },
  );

  // Confirmed 0-class Teacher is marked hasConfirmedNoClasses: true
  const noClassTeacher = makeUser({ assignedClassIds: [] });
  assert.equal(
    resolveVisibleTeacherAllocations({
      currentUser: noClassTeacher,
      currentActorScopeKey: buildPerformanceActorScopeKey(noClassTeacher),
      activeClassId: '',
      activeClass: null,
      isHydratingSchoolData: false,
      classesBackendStatus: 'READY',
      classesError: null,
      allocationsState: readyState,
    }).hasConfirmedNoClasses,
    true,
  );

  // Localization and subject reconciliation
  assert.equal(reconcileSelectedSubjectId('stale-sub', [validItem]), 'sub-math');
  assert.equal(reconcileSelectedSubjectId('sub-math', [validItem]), 'sub-math');
  assert.equal(reconcileSelectedSubjectId('sub-math', []), '');
  assert.equal(getLocalizedSubjectLabel(validItem, 'ar'), 'الرياضيات');
  assert.equal(getLocalizedSubjectLabel(validItem, 'fr'), 'Mathématiques');
  assert.equal(getLocalizedSubjectLabel(validItem, 'en'), 'Mathematics');
});

test('Performance-4 (Pure): Strict RPC payload validator rejects non-arrays, coerced booleans, inactive/malformed rows, and mismatched scopes', () => {
  // Valid empty array is confirmed READY empty
  assert.deepEqual(parseTeacherSubjectAllocationsResponse([], 'cls-1', 'user-1'), {
    ok: true,
    status: 'READY',
    data: [],
  });

  // Valid populated row passes with components intact
  const valid = makeValidAllocationRow();
  const validResult = parseTeacherSubjectAllocationsResponse([valid], 'cls-1', 'user-1');
  assert.equal(validResult.ok, true);
  assert.equal(validResult.status, 'READY');
  assert.equal(validResult.data?.length, 1);
  assert.equal(validResult.data?.[0].components.length, 1);

  // Non-array responses are ERROR, never empty success
  for (const nonArray of [null, undefined, {}, '[]', 42, true]) {
    const res = parseTeacherSubjectAllocationsResponse(nonArray, 'cls-1', 'user-1');
    assert.equal(res.ok, false);
    assert.equal(res.status, 'ERROR');
  }

  // Missing `active`, string "false", or `active: false` must be rejected
  for (const badActive of [undefined, 'false', 'true', 1, 0, false]) {
    const row = makeValidAllocationRow({ active: badActive });
    const res = parseTeacherSubjectAllocationsResponse([row], 'cls-1', 'user-1');
    assert.equal(res.ok, false, `active=${String(badActive)} must reject`);
    assert.equal(res.status, 'ERROR');
  }

  // Missing required identifiers or wrong types reject whole payload (even alongside a valid row)
  const missingSubjectId = makeValidAllocationRow({ subjectId: '' });
  const mixedRes = parseTeacherSubjectAllocationsResponse([valid, missingSubjectId], 'cls-1', 'user-1');
  assert.equal(mixedRes.ok, false);
  assert.equal(mixedRes.status, 'ERROR');

  // Malformed component entry rejects whole payload
  const badComponent = makeValidAllocationRow({
    components: [{ id: 'c1', code: '', labelAr: 'x', labelFr: 'x', labelEn: 'x', sortOrder: 1 }],
  });
  assert.equal(parseTeacherSubjectAllocationsResponse([badComponent], 'cls-1', 'user-1').status, 'ERROR');

  // Mismatched classId or teacherUserId rejects payload
  assert.equal(
    parseTeacherSubjectAllocationsResponse([makeValidAllocationRow({ classId: 'cls-other' })], 'cls-1', 'user-1').status,
    'ERROR',
  );
  assert.equal(
    parseTeacherSubjectAllocationsResponse([makeValidAllocationRow({ teacherUserId: 'user-other' })], 'cls-1', 'user-1').status,
    'ERROR',
  );
});

test('Performance-5 (Pure): Fetch plans, async result applicability, and post-refresh lifecycle decisions', () => {
  const teacherA = makeUser({ id: 'teacher-a', assignedClassIds: ['cls-1'] });
  const teacherAKey = buildPerformanceActorScopeKey(teacherA);
  const teacherB = makeUser({ id: 'teacher-b', assignedClassIds: ['cls-2'] });
  const teacherBKey = buildPerformanceActorScopeKey(teacherB);
  const parent = makeUser({ id: 'parent-1', role: 'PARENT', assignedClassIds: [], linkedChildrenIds: ['child-1'] });

  // Parents never fetch Teacher allocations
  assert.deepEqual(resolveTeacherAllocationsFetchPlan(parent, 'cls-1'), {
    shouldFetch: false,
    status: 'UNAUTHORIZED',
    reason: 'teacher_access_required',
  });

  // Late result discarded if unmounted, superseded seq, scope changed, class changed, or context not ready
  const snapshotA = {
    actorScopeKey: teacherAKey,
    userId: teacherA.id,
    isTeacher: true,
    canReadTeacherScope: true,
    activeClassId: 'cls-1',
    currentUser: teacherA,
  };
  assert.equal(
    isAllocationResultApplicable({
      isMounted: true,
      requestSeq: 3,
      currentRequestSeq: 3,
      originActorScopeKey: teacherAKey,
      originClassId: 'cls-1',
      currentSnapshot: snapshotA,
    }),
    true,
  );
  assert.equal(
    isAllocationResultApplicable({
      isMounted: false,
      requestSeq: 3,
      currentRequestSeq: 3,
      originActorScopeKey: teacherAKey,
      originClassId: 'cls-1',
      currentSnapshot: snapshotA,
    }),
    false,
  );
  assert.equal(
    isAllocationResultApplicable({
      isMounted: true,
      requestSeq: 2,
      currentRequestSeq: 3,
      originActorScopeKey: teacherAKey,
      originClassId: 'cls-1',
      currentSnapshot: snapshotA,
    }),
    false,
  );
  assert.equal(
    isAllocationResultApplicable({
      isMounted: true,
      requestSeq: 3,
      currentRequestSeq: 3,
      originActorScopeKey: teacherAKey,
      originClassId: 'cls-1',
      currentSnapshot: {
        actorScopeKey: teacherBKey,
        userId: teacherB.id,
        isTeacher: true,
        canReadTeacherScope: true,
        activeClassId: 'cls-2',
        currentUser: teacherB,
      },
    }),
    false,
  );

  // Post-refresh lifecycle revalidates current snapshot after await refreshSchoolData()
  assert.deepEqual(
    resolvePostRefreshAction({
      isMounted: false,
      originActorScopeKey: teacherAKey,
      currentSnapshot: snapshotA,
      refreshSucceeded: true,
    }),
    { action: 'ABORT_UNMOUNTED' },
  );
  assert.deepEqual(
    resolvePostRefreshAction({
      isMounted: true,
      originActorScopeKey: teacherAKey,
      currentSnapshot: {
        actorScopeKey: teacherBKey,
        userId: teacherB.id,
        isTeacher: true,
        canReadTeacherScope: true,
        activeClassId: 'cls-2',
        currentUser: teacherB,
      },
      refreshSucceeded: true,
    }),
    { action: 'ABORT_SCOPE_CHANGED' },
  );
  assert.deepEqual(
    resolvePostRefreshAction({
      isMounted: true,
      originActorScopeKey: teacherAKey,
      currentSnapshot: snapshotA,
      refreshSucceeded: false,
    }),
    { action: 'SURFACE_REFRESH_ERROR' },
  );
  assert.deepEqual(
    resolvePostRefreshAction({
      isMounted: true,
      originActorScopeKey: teacherAKey,
      currentSnapshot: snapshotA,
      refreshSucceeded: true,
    }),
    {
      action: 'FETCH_TEACHER_ALLOCATIONS',
      actorScopeKey: teacherAKey,
      classId: 'cls-1',
      teacherUserId: 'teacher-a',
    },
  );
});
