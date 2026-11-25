import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.ts';

const REQUIRED_HOMEPAGE_FILES = [
  '../src/components/homepages/PublicHomePage.tsx',
  '../src/components/homepages/ParentHomePage.tsx',
  '../src/components/homepages/StudentHomePage.tsx',
  '../src/components/homepages/TeacherHomePage.tsx',
  '../src/components/homepages/SchoolStaffHomePage.tsx',
  '../src/components/homepages/AdministrativePersonnelHomePage.tsx',
  '../src/components/homepages/ManagerHomePage.tsx',
  '../src/components/homepages/OwnerHomePage.tsx',
  '../src/components/homepages/ApplicationStatusScreen.tsx',
  '../src/components/homepages/HomePageResolver.tsx',
];

const SEVEN_ROLES = [
  'PARENT',
  'STUDENT',
  'TEACHER',
  'SCHOOL_STAFF',
  'ADMINISTRATIVE_PERSONNEL',
  'MANAGER',
  'APP_ADMIN',
];

const ROLE_TO_HOME_KEY = {
  PARENT: 'PARENT_HOME',
  STUDENT: 'STUDENT_HOME',
  TEACHER: 'TEACHER_HOME',
  SCHOOL_STAFF: 'SCHOOL_STAFF_HOME',
  ADMINISTRATIVE_PERSONNEL: 'ADMINISTRATIVE_PERSONNEL_HOME',
  MANAGER: 'MANAGER_HOME',
  APP_ADMIN: 'OWNER_HOME',
};

test('Task 1.1 — Eight separate homepage components and resolver exist and App.tsx no longer routes all roles to shared HomeView', () => {
  for (const relPath of REQUIRED_HOMEPAGE_FILES) {
    const exists = fs.existsSync(new URL(relPath, import.meta.url));
    assert.equal(exists, true, `Expected separate homepage file ${relPath} to exist`);
  }

  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(appSource, /<HomeView\b/, 'App.tsx must not render the old shared <HomeView /> for all roles');
  assert.match(appSource, /HomePageResolver/, 'App.tsx must route home through HomePageResolver');
});

test('Task 1.2 — Homepage resolution matrix: anonymous, pending, rejected, revoked, and all 7 approved roles', async () => {
  const resolverUrl = new URL('../src/components/homepages/homepageAccess.ts', import.meta.url);
  assert.equal(fs.existsSync(resolverUrl), true, 'Expected src/components/homepages/homepageAccess.ts to exist');
  const accessModule = await import(resolverUrl.href);

  // 1. Anonymous visitor -> PUBLIC_HOME with actorRole === null
  const anonDecision = accessModule.resolveHomePage({ user: null });
  assert.equal(anonDecision.targetPage, 'PUBLIC_HOME');
  assert.equal(anonDecision.oversightMode, false);
  assert.equal(anonDecision.actorRole, null);

  // 2. Pending applicant -> APPLICATION_STATUS (even if requestedRole is APP_ADMIN or PARENT)
  for (const requestedRole of SEVEN_ROLES) {
    const pendingDecision = accessModule.resolveHomePage({
      user: {
        id: 'u-pending',
        username: 'pending_user',
        fullName: 'Pending Applicant',
        role: requestedRole,
        accountStatus: 'PENDING',
        requestedRole,
      },
    });
    assert.equal(
      pendingDecision.targetPage,
      'APPLICATION_STATUS',
      `Pending applicant requesting ${requestedRole} must resolve to APPLICATION_STATUS, never ${ROLE_TO_HOME_KEY[requestedRole]}`,
    );

    // Pending applicant may explicitly visit PUBLIC_HOME
    const pendingPublic = accessModule.resolveHomePage({
      user: {
        id: 'u-pending',
        username: 'pending_user',
        fullName: 'Pending Applicant',
        role: requestedRole,
        accountStatus: 'PENDING',
        requestedRole,
      },
      requestedPage: 'PUBLIC_HOME',
    });
    assert.equal(pendingPublic.targetPage, 'PUBLIC_HOME');
    assert.equal(pendingPublic.allowed, true);
  }

  // 3. Rejected and Revoked accounts -> APPLICATION_STATUS (restricted screen), never private role homepages
  for (const status of ['REJECTED', 'REVOKED']) {
    const restricted = accessModule.resolveHomePage({
      user: {
        id: `u-${status.toLowerCase()}`,
        username: 'restricted_user',
        fullName: 'Restricted User',
        role: 'PARENT',
        accountStatus: status,
        requestedRole: 'PARENT',
      },
      requestedPage: 'PARENT_HOME',
    });
    assert.equal(restricted.allowed, false);
    assert.equal(restricted.targetPage, 'APPLICATION_STATUS');
  }

  // 4. Each of the 7 approved roles resolves to its own distinct homepage
  for (const role of SEVEN_ROLES) {
    const approved = accessModule.resolveHomePage({
      user: {
        id: `u-${role.toLowerCase()}`,
        username: `${role.toLowerCase()}_user`,
        fullName: `Approved ${role}`,
        role,
        accountStatus: 'APPROVED',
        capabilities: [role],
      },
    });
    assert.equal(approved.targetPage, ROLE_TO_HOME_KEY[role]);
    assert.equal(approved.allowed, true);
    assert.equal(approved.oversightMode, false);
  }
});

test('Task 1.3 — Cross-role denial matrix across all 7 roles, Manager delegation rules, and Owner non-impersonating oversight', async () => {
  const resolverUrl = new URL('../src/components/homepages/homepageAccess.ts', import.meta.url);
  assert.equal(fs.existsSync(resolverUrl), true, 'Expected src/components/homepages/homepageAccess.ts to exist');
  const { resolveHomePage } = await import(resolverUrl.href);

  const ordinaryRoles = ['PARENT', 'STUDENT', 'TEACHER', 'SCHOOL_STAFF', 'ADMINISTRATIVE_PERSONNEL'];

  // Every ordinary role is denied access to every other role's private homepage
  for (const actorRole of ordinaryRoles) {
    for (const targetRole of SEVEN_ROLES) {
      if (actorRole === targetRole) continue;
      const targetHomeKey = ROLE_TO_HOME_KEY[targetRole];
      const decision = resolveHomePage({
        user: {
          id: `u-${actorRole.toLowerCase()}`,
          username: `${actorRole.toLowerCase()}_user`,
          fullName: `Actor ${actorRole}`,
          role: actorRole,
          accountStatus: 'APPROVED',
          capabilities: [actorRole],
        },
        requestedPage: targetHomeKey,
      });
      assert.equal(
        decision.allowed,
        false,
        `Ordinary role ${actorRole} must be denied access to ${targetHomeKey}`,
      );
      assert.equal(
        decision.targetPage,
        ROLE_TO_HOME_KEY[actorRole],
        `Denied cross-role request by ${actorRole} must stay on ${ROLE_TO_HOME_KEY[actorRole]}`,
      );
    }
  }

  // Manager without cross-role oversight delegation is denied access to all other role homepages
  for (const targetRole of SEVEN_ROLES) {
    if (targetRole === 'MANAGER') continue;
    const targetHomeKey = ROLE_TO_HOME_KEY[targetRole];
    const decision = resolveHomePage({
      user: {
        id: 'u-manager',
        username: 'manager_user',
        fullName: 'Manager User',
        role: 'MANAGER',
        accountStatus: 'APPROVED',
        capabilities: ['MANAGER', 'CAN_MANAGE_FOOD_MENU'],
      },
      requestedPage: targetHomeKey,
    });
    assert.equal(
      decision.allowed,
      false,
      `Manager without oversight grant must be denied access to ${targetHomeKey}`,
    );
    assert.equal(decision.targetPage, 'MANAGER_HOME');
  }

  // Manager with narrow oversight grant (e.g. OVERSIGHT:TEACHER_HOME) can oversee TEACHER_HOME only, never OWNER_HOME or PARENT_HOME
  const managerTeacherOversight = resolveHomePage({
    user: {
      id: 'u-manager',
      username: 'manager_user',
      fullName: 'Manager User',
      role: 'MANAGER',
      accountStatus: 'APPROVED',
      capabilities: ['MANAGER', 'OVERSIGHT:TEACHER_HOME'],
    },
    requestedPage: 'TEACHER_HOME',
  });
  assert.equal(managerTeacherOversight.allowed, true);
  assert.equal(managerTeacherOversight.targetPage, 'TEACHER_HOME');
  assert.equal(managerTeacherOversight.oversightMode, true);
  assert.equal(managerTeacherOversight.actorRole, 'MANAGER');

  const managerOwnerAttempt = resolveHomePage({
    user: {
      id: 'u-manager',
      username: 'manager_user',
      fullName: 'Manager User',
      role: 'MANAGER',
      accountStatus: 'APPROVED',
      capabilities: ['MANAGER', 'OVERSIGHT:OWNER_HOME'], // Even if present, Manager can never oversee Owner Home
    },
    requestedPage: 'OWNER_HOME',
  });
  assert.equal(managerOwnerAttempt.allowed, false);
  assert.equal(managerOwnerAttempt.targetPage, 'MANAGER_HOME');

  // Owner (APP_ADMIN) can oversee another role workspace while preserving actorRole === 'APP_ADMIN' and oversightMode === true
  for (const targetRole of ['PARENT', 'STUDENT', 'TEACHER', 'SCHOOL_STAFF', 'ADMINISTRATIVE_PERSONNEL', 'MANAGER']) {
    const targetHomeKey = ROLE_TO_HOME_KEY[targetRole];
    const ownerOversight = resolveHomePage({
      user: {
        id: 'u-owner',
        username: 'owner_user',
        fullName: 'School Owner',
        role: 'APP_ADMIN',
        accountStatus: 'APPROVED',
        capabilities: ['APP_ADMIN'],
      },
      requestedPage: targetHomeKey,
    });
    assert.equal(ownerOversight.allowed, true);
    assert.equal(ownerOversight.targetPage, targetHomeKey);
    assert.equal(ownerOversight.oversightMode, true);
    assert.equal(ownerOversight.actorRole, 'APP_ADMIN');
  }
});

test('Task 1.4 — Shared feature tab access guards and Public site access without role mutation', async () => {
  const resolverUrl = new URL('../src/components/homepages/homepageAccess.ts', import.meta.url);
  assert.equal(fs.existsSync(resolverUrl), true, 'Expected src/components/homepages/homepageAccess.ts to exist');
  const { canAccessAppTab } = await import(resolverUrl.href);

  // Anonymous visitor can access public tabs, denied on private tabs
  assert.equal(canAccessAppTab(null, 'home'), true);
  assert.equal(canAccessAppTab(null, 'publicSite'), true);
  assert.equal(canAccessAppTab(null, 'directory'), true);
  assert.equal(canAccessAppTab(null, 'foodMenu'), true);
  assert.equal(canAccessAppTab(null, 'registration'), true);
  assert.equal(canAccessAppTab(null, 'community'), false);
  assert.equal(canAccessAppTab(null, 'notes'), false);
  assert.equal(canAccessAppTab(null, 'pickup'), false);
  assert.equal(canAccessAppTab(null, 'classes'), false);

  // Student can access community and foodMenu, denied on notes, pickup, and classes
  const student = { id: 's-1', username: 'stu', fullName: 'Student', role: 'STUDENT', accountStatus: 'APPROVED', assignedClassIds: ['class-3a'] };
  assert.equal(canAccessAppTab(student, 'community'), true);
  assert.equal(canAccessAppTab(student, 'notes'), false);
  assert.equal(canAccessAppTab(student, 'pickup'), false);
  assert.equal(canAccessAppTab(student, 'classes'), false);

  // School Staff without pickup capability denied on pickup, community, notes, classes
  const staffNoCap = { id: 'st-1', username: 'staff', fullName: 'Staff', role: 'SCHOOL_STAFF', accountStatus: 'APPROVED', capabilities: ['SCHOOL_STAFF'] };
  assert.equal(canAccessAppTab(staffNoCap, 'pickup'), false);
  assert.equal(canAccessAppTab(staffNoCap, 'community'), false);
  assert.equal(canAccessAppTab(staffNoCap, 'notes'), false);
  assert.equal(canAccessAppTab(staffNoCap, 'classes'), false);
  assert.equal(canAccessAppTab(staffNoCap, 'foodMenu'), true);
});

test('Task 1.5 — Structural & privacy isolation across the 8 separate homepage files and public factual accuracy', () => {
  for (const relPath of REQUIRED_HOMEPAGE_FILES.slice(0, 8)) {
    const src = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.match(src, /HomePageHeader/, `${relPath} must use shared HomePageHeader`);
    assert.match(src, /HomeCardGrid/, `${relPath} must use phone-first HomeCardGrid`);
    assert.match(src, /HomeShortcutCard/, `${relPath} must use HomeShortcutCard`);
  }

  const publicSrc = fs.readFileSync(new URL('../src/components/homepages/PublicHomePage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(publicSrc, /childrenList|pickupRecords|parentNotes/, 'PublicHomePage must never read private child, pickup, or parent note lists');
  assert.match(publicSrc, /!a\.classId/, 'PublicHomePage must filter announcements to public school-wide items only');
  assert.doesNotMatch(publicSrc, /Hammamet|الحمامات|280\s*000/, 'PublicHomePage must not contain unverified Hammamet address or phone numbers');

  const appStatusSrc = fs.readFileSync(new URL('../src/components/homepages/ApplicationStatusScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(appStatusSrc, /Hammamet|الحمامات/, 'ApplicationStatusScreen must not contain unverified Hammamet location');

  const adminPersonnelSrc = fs.readFileSync(new URL('../src/components/homepages/AdministrativePersonnelHomePage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(adminPersonnelSrc, /owner-manager-delegation|owner-role-governance|owner-pending-approvals/, 'AdministrativePersonnelHomePage must not expose Owner governance controls');
});

test('Task 1.6 — Zero production mock-data fallbacks for authenticated Parent, Teacher, and Student accounts without links', async () => {
  const { MOCK_CHILDREN, MOCK_CLASSES } = await import('../src/data/mockData.ts');
  const {
    resolveParentLinkedChildren,
    resolveTeacherAssignedClasses,
    resolveStudentAssignedClass,
  } = await import('../src/components/homepages/homepageAccess.ts');

  // Authenticated Parent with undefined or empty linkedChildrenIds never receives MOCK_CHILDREN
  assert.deepEqual(
    resolveParentLinkedChildren({ id: 'p-1', role: 'PARENT', linkedChildrenIds: undefined }, MOCK_CHILDREN),
    [],
  );
  assert.deepEqual(
    resolveParentLinkedChildren({ id: 'p-1', role: 'PARENT', linkedChildrenIds: [] }, MOCK_CHILDREN),
    [],
  );

  // Authenticated Teacher with undefined or empty assignedClassIds never receives MOCK_CLASSES
  assert.deepEqual(
    resolveTeacherAssignedClasses({ id: 't-1', role: 'TEACHER', assignedClassIds: undefined }, MOCK_CLASSES),
    [],
  );
  assert.deepEqual(
    resolveTeacherAssignedClasses({ id: 't-1', role: 'TEACHER', assignedClassIds: [] }, MOCK_CLASSES),
    [],
  );

  // Authenticated Student with undefined or empty assignedClassIds never receives MOCK_CLASSES[0]
  assert.equal(
    resolveStudentAssignedClass({ id: 's-1', role: 'STUDENT', assignedClassIds: undefined }, MOCK_CLASSES),
    null,
  );
  assert.equal(
    resolveStudentAssignedClass({ id: 's-1', role: 'STUDENT', assignedClassIds: [] }, MOCK_CLASSES),
    null,
  );

  // Verify AppContext.tsx does not initialize childrenList, classesList, or pickupRecords with MOCK_CHILDREN, MOCK_CLASSES, or MOCK_PICKUP_RECORDS
  const appContextSrc = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(appContextSrc, /\bMOCK_CHILDREN\b/, 'AppContext.tsx must not expose MOCK_CHILDREN in production state');
  assert.doesNotMatch(appContextSrc, /\bMOCK_CLASSES\b/, 'AppContext.tsx must not expose MOCK_CLASSES in production state');
  assert.doesNotMatch(appContextSrc, /\bMOCK_PICKUP_RECORDS\b/, 'AppContext.tsx must not expose MOCK_PICKUP_RECORDS in production state');
});

test('Task 1.7 — Pickup prototype safety lock: no false Live update indicator and unimplemented arrival/release operations fail closed', async () => {
  const { attemptPickupOperation } = await import('../src/components/homepages/homepageAccess.ts');
  const pickupSrc = fs.readFileSync(new URL('../src/components/views/PickupBoardView.tsx', import.meta.url), 'utf8');
  const appContextSrc = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');

  // 1. PickupBoardView must not display the false Live update indicator
  assert.doesNotMatch(pickupSrc, /t\('liveUpdate'\)/, 'PickupBoardView must not render the false liveUpdate indicator');
  assert.match(pickupSrc, /pickup-backend-status-badge/, 'PickupBoardView must render the Pending Backend status badge');
  assert.match(pickupSrc, /pickup-safety-lock-banner/, 'PickupBoardView must render the student safety lock banner');

  // 2. Pickup operations return blocked status and never mutate local state to PARENT_ARRIVED or RELEASED
  const arrivalAttempt = attemptPickupOperation('ARRIVAL', 'child-1');
  assert.equal(arrivalAttempt.allowed, false);
  assert.equal(arrivalAttempt.status, 'BLOCKED_BACKEND');
  assert.equal(arrivalAttempt.reason, 'pickup_backend_unavailable');

  const releaseAttempt = attemptPickupOperation('RELEASE', 'pick-1');
  assert.equal(releaseAttempt.allowed, false);
  assert.equal(releaseAttempt.status, 'BLOCKED_BACKEND');
  assert.equal(releaseAttempt.reason, 'pickup_backend_unavailable');

  assert.doesNotMatch(appContextSrc, /title:\s*'Arrivée signalée'/, 'AppContext must not push fake local arrival notifications');
});

test('Task 1.8 — Owner Classes -> Students requirement: menu placement (Teachers -> Classes -> Registration), access control, and zero mock data', async () => {
  const {
    canAccessAppTab,
    filterSchoolClasses,
    filterClassRoster,
  } = await import('../src/components/homepages/homepageAccess.ts');

  // 1. Navbar menu order: Teachers -> Classes -> Registration
  const navbarSrc = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  const teachersIdx = navbarSrc.indexOf("setActiveTab('directory')");
  const classesIdx = navbarSrc.indexOf("setActiveTab('classes')");
  const registrationIdx = navbarSrc.indexOf("setActiveTab('registration')");
  assert.ok(teachersIdx > 0, 'Expected Teachers (directory) button in Navbar.tsx');
  assert.ok(classesIdx > teachersIdx, 'Expected Classes button directly after Teachers in Navbar.tsx');
  assert.ok(registrationIdx > classesIdx, 'Expected Registration button directly after Classes in Navbar.tsx');

  // 2. Access control: APP_ADMIN allowed; MANAGER allowed only with CLASSES_ROSTER_VIEW or FULL_ACCESS; approved TEACHER allowed read-only (T1); PARENT/STUDENT denied
  const { canManageClassesUi } = await import('../src/components/homepages/homepageAccess.ts');
  const owner = { id: 'o-1', username: 'owner', fullName: 'Owner', role: 'APP_ADMIN', accountStatus: 'APPROVED', capabilities: ['APP_ADMIN'] };
  const managerNoCap = { id: 'm-1', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: ['MANAGER'] };
  const managerWithCap = { id: 'm-2', username: 'mgr2', fullName: 'Manager 2', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: ['MANAGER', 'CLASSES_ROSTER_VIEW'] };
  const teacher = { id: 't-1', username: 'tch', fullName: 'Teacher', role: 'TEACHER', accountStatus: 'APPROVED', capabilities: ['TEACHER'] };
  const parent = { id: 'p-1', username: 'par', fullName: 'Parent', role: 'PARENT', accountStatus: 'APPROVED', capabilities: ['PARENT'] };

  assert.equal(canAccessAppTab(owner, 'classes'), true);
  assert.equal(canAccessAppTab(managerNoCap, 'classes'), false);
  assert.equal(canAccessAppTab(managerWithCap, 'classes'), true);
  assert.equal(canAccessAppTab(teacher, 'classes'), true);
  assert.equal(canManageClassesUi(teacher), false);
  assert.equal(canAccessAppTab(parent, 'classes'), false);

  // 3. ClassesManagementView never imports or references MOCK_CLASSES or MOCK_CHILDREN
  const classesViewSrc = fs.readFileSync(new URL('../src/components/views/ClassesManagementView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(classesViewSrc, /MOCK_CLASSES|MOCK_CHILDREN/, 'ClassesManagementView must never use mock classes or mock children');

  // 4. Filter and roster helpers work on verified records
  const sampleClasses = [
    { id: 'c-1', name: '1ère Année A', level: '1ère année', academicYear: '2025-2026', homeroomTeacherName: 'Mme Amira', activeStudentCount: 18 },
    { id: 'c-2', name: '6ème Année B', level: '6ème année', academicYear: '2025-2026', homeroomTeacherName: 'M. Karim', activeStudentCount: 21 },
  ];
  assert.equal(filterSchoolClasses(sampleClasses, '6ème', 'ALL', 'ALL').length, 1);
  assert.equal(filterSchoolClasses(sampleClasses, '', '1ère année', '2025-2026').length, 1);

  const sampleRoster = [
    { studentId: 'st-1', studentCode: 'KS-2026-001', fullName: 'Ines Trabelsi', enrollmentStatus: 'ACTIVE', enrolledAt: '2025-09-15', primaryGuardianName: 'Sami Trabelsi' },
    { studentId: 'st-2', studentCode: 'KS-2026-002', fullName: 'Fares Mansouri', enrollmentStatus: 'ACTIVE', enrolledAt: '2025-09-15', primaryGuardianName: 'Leila Mansouri' },
  ];
  assert.equal(filterClassRoster(sampleRoster, 'KS-2026-002').length, 1);
  assert.equal(filterClassRoster(sampleRoster, 'Ines').length, 1);
});

test('Task 1.9 — Restored original KRISTOU homepage, Emploi du temps À venir state, verified image assets, and honest demoPreview badges', () => {
  const publicSrc = fs.readFileSync(new URL('../src/components/homepages/PublicHomePage.tsx', import.meta.url), 'utf8');

  // 1. Original homepage (.kr-home) appears before secondary content
  const originalIdx = publicSrc.indexOf('data-testid="original-kristou-homepage"');
  const secondaryIdx = publicSrc.indexOf('data-testid="public-secondary-content"');
  assert.ok(originalIdx > 0, 'Expected restored original-kristou-homepage section in PublicHomePage.tsx');
  assert.ok(secondaryIdx > originalIdx, 'Expected public-secondary-content to appear below original-kristou-homepage');

  // 2. Emploi du temps (schedule) shortcut restores comingSoon (À venir) disabled state
  assert.match(
    publicSrc,
    /title:\s*t\('schedule'\)[\s\S]*?onClick:\s*undefined/,
    'Expected schedule (Emploi du temps) shortcut to have onClick: undefined',
  );
  assert.match(publicSrc, /disabled=\{!onClick\}/, 'Expected shortcuts without onClick to be disabled');
  assert.match(publicSrc, /\{!onClick && <em>\{t\('comingSoon'\)\}<\/em>\}/, 'Expected disabled shortcuts to display comingSoon');

  // 3. All restored homepage image assets exist on disk and are non-empty
  const expectedAssets = [
    '../public/assets/kristou-home/hero-schoolchildren.png',
    '../public/assets/kristou-home/announcement-school.png',
    '../public/assets/kristou-home/announcement-bardo.png',
    '../public/assets/kristou-home/canteen-meal.png',
    '../public/assets/kristou-home/school-building.png',
    '../public/assets/kristou-home/enrollment-children.png',
  ];
  for (const relAsset of expectedAssets) {
    const assetUrl = new URL(relAsset, import.meta.url);
    assert.equal(fs.existsSync(assetUrl), true, `Expected homepage image asset ${relAsset} to exist`);
    const stat = fs.statSync(assetUrl);
    assert.ok(stat.size > 1000, `Expected homepage image asset ${relAsset} to be non-empty`);
  }
  assert.doesNotMatch(publicSrc, /kristou-2026-0[1-6]\.jpg/, 'PublicHomePage must not reference nonexistent /kristou-2026-*.jpg paths');

  // 4. Announcements and canteen preview blocks display honest demoPreview indicators
  assert.match(publicSrc, /data-testid="announcements-preview-badge"/, 'Expected announcements preview badge on À la une de Kristou');
  assert.match(publicSrc, /data-testid="canteen-preview-badge"/, 'Expected canteen preview badge on À la cantine');
});

test('ADMIN-PICKUP-01 — ADMINISTRATIVE_PERSONNEL receives pickup tab access and AdministrativePersonnelHomePage shortcut while preserving fail-closed locks', async () => {
  const { createRequire } = await import('node:module');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { build } = await import('esbuild');
  const React = (await import('react')).default;
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { installNodeDomShim } = await import('./helpers/nodeDomShim.mjs');

  const { canAccessAppTab, attemptPickupOperation } = await import('../src/components/homepages/access/appTabAccess.ts');

  // 1. Approved ADMINISTRATIVE_PERSONNEL with standard, empty, and undefined capabilities all get pickup access
  for (const capabilities of [['ADMINISTRATIVE_PERSONNEL'], [], undefined]) {
    assert.equal(
      canAccessAppTab(
        {
          id: 'office-1',
          username: 'office.staff',
          fullName: 'Office Staff',
          role: 'ADMINISTRATIVE_PERSONNEL',
          accountStatus: 'APPROVED',
          capabilities,
        },
        'pickup',
      ),
      true,
      `Expected APPROVED ADMINISTRATIVE_PERSONNEL with capabilities=${JSON.stringify(capabilities)} to access pickup`,
    );
  }

  // 2. Non-approved ADMINISTRATIVE_PERSONNEL, null visitor, STUDENT, and SCHOOL_STAFF without pickup caps stay denied
  for (const accountStatus of ['PENDING', 'SUSPENDED', 'REJECTED', 'REVOKED']) {
    assert.equal(
      canAccessAppTab(
        {
          id: `office-${accountStatus}`,
          username: 'office.blocked',
          fullName: 'Blocked Office',
          role: 'ADMINISTRATIVE_PERSONNEL',
          accountStatus,
          capabilities: ['ADMINISTRATIVE_PERSONNEL'],
        },
        'pickup',
      ),
      false,
      `Expected ${accountStatus} ADMINISTRATIVE_PERSONNEL to be denied pickup`,
    );
  }
  assert.equal(canAccessAppTab(null, 'pickup'), false);
  assert.equal(
    canAccessAppTab(
      { id: 'stu-1', username: 'stu', fullName: 'Student', role: 'STUDENT', accountStatus: 'APPROVED', capabilities: ['STUDENT'] },
      'pickup',
    ),
    false,
  );
  assert.equal(
    canAccessAppTab(
      { id: 'st-no', username: 'st', fullName: 'Staff', role: 'SCHOOL_STAFF', accountStatus: 'APPROVED', capabilities: ['SCHOOL_STAFF'] },
      'pickup',
    ),
    false,
  );

  // 3. SCHOOL_STAFF with pickup capabilities and MANAGER rules remain unchanged
  for (const cap of ['PICKUP_RELEASE', 'PICKUP_DESK']) {
    assert.equal(
      canAccessAppTab(
        { id: `st-${cap}`, username: 'st', fullName: 'Staff', role: 'SCHOOL_STAFF', accountStatus: 'APPROVED', capabilities: [cap] },
        'pickup',
      ),
      true,
    );
  }
  for (const caps of [[], ['PICKUP_RELEASE'], ['PICKUP_VIEW'], ['FULL_ACCESS']]) {
    assert.equal(
      canAccessAppTab(
        { id: 'mgr-ok', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: caps },
        'pickup',
      ),
      true,
    );
  }
  assert.equal(
    canAccessAppTab(
      { id: 'mgr-no', username: 'mgr', fullName: 'Manager', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: ['MANAGER'] },
      'pickup',
    ),
    false,
  );

  // 4. Render actual AdministrativePersonnelHomePage and verify shortcut visibility, i18n title, and setActiveTab('pickup')
  const dom = installNodeDomShim();
  const require = createRequire(import.meta.url);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outdir = path.join('/tmp', 'kristou-admin-pickup-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, 'admin-home.cjs');

  await build({
    entryPoints: [path.resolve(__dirname, '../src/components/homepages/AdministrativePersonnelHomePage.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    plugins: [
      {
        name: 'admin-pickup-test-mocks',
        setup(builder) {
          builder.onResolve({ filter: /context\/AppContext$/ }, () => ({
            path: 'mock-app-ctx',
            namespace: 'adminpickup',
          }));
          builder.onLoad({ filter: /^mock-app-ctx$/, namespace: 'adminpickup' }, () => ({
            contents: `
              export const useApp = () => globalThis.__ADMIN_PICKUP_APP_CTX__;
            `,
          }));
          builder.onResolve({ filter: /lib\/schoolOperations$/ }, () => ({
            path: 'mock-school-ops',
            namespace: 'adminpickup',
          }));
          builder.onLoad({ filter: /^mock-school-ops$/, namespace: 'adminpickup' }, () => ({
            contents: `
              export const respondPublicInquiry = async () => ({ ok: true });
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

  const { AdministrativePersonnelHomePage } = require(outfile);
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  const expectedTitles = { en: 'Pickup', fr: 'Sortie & Pickup', ar: 'الاستلام المدرسي' };
  const tabCalls = [];

  for (const [language, expectedTitle] of Object.entries(expectedTitles)) {
    globalThis.__ADMIN_PICKUP_APP_CTX__ = {
      language,
      currentUser: {
        id: 'office-1',
        username: 'office.staff',
        fullName: 'Office Staff',
        role: 'ADMINISTRATIVE_PERSONNEL',
        accountStatus: 'APPROVED',
        capabilities: [],
      },
      operationalCounts: {},
      operationalCountsLoaded: true,
      schoolContextError: null,
      publicInquiries: [],
      inquiriesStatus: 'READY',
      messages: [],
      messagesStatus: 'READY',
      refreshSchoolData: async () => {},
    };

    await act(async () => {
      root.render(
        React.createElement(AdministrativePersonnelHomePage, {
          setActiveTab: (tab) => tabCalls.push(tab),
        }),
      );
    });

    const pickupCard = container.querySelector('[data-testid="shortcut-card-admin-personnel-pickup-assist"]');
    assert.ok(pickupCard, `Expected admin-personnel-pickup-assist card to render in ${language}`);
    const titleEl = pickupCard.querySelector('.kh-shortcut-title');
    assert.equal(titleEl?.textContent, expectedTitle);

    if (language === 'en') {
      await act(async () => {
        pickupCard.click();
      });
    }
  }
  assert.deepEqual(tabCalls, ['pickup']);

  // Non-approved ADMINISTRATIVE_PERSONNEL must not render the shortcut card
  globalThis.__ADMIN_PICKUP_APP_CTX__ = {
    ...globalThis.__ADMIN_PICKUP_APP_CTX__,
    language: 'en',
    currentUser: {
      id: 'office-suspended',
      username: 'office.suspended',
      fullName: 'Suspended Office',
      role: 'ADMINISTRATIVE_PERSONNEL',
      accountStatus: 'SUSPENDED',
      capabilities: ['ADMINISTRATIVE_PERSONNEL'],
    },
  };
  await act(async () => {
    root.render(React.createElement(AdministrativePersonnelHomePage, { setActiveTab: () => {} }));
  });
  assert.equal(container.querySelector('[data-testid="shortcut-card-admin-personnel-pickup-assist"]'), null);

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
  fs.rmSync(outdir, { recursive: true, force: true });

  // 5. Pickup backend safety lock remains enforced
  const arrivalLock = attemptPickupOperation('ARRIVAL', 'child-1');
  assert.equal(arrivalLock.allowed, false);
  assert.equal(arrivalLock.status, 'BLOCKED_BACKEND');
  const releaseLock = attemptPickupOperation('RELEASE', 'pick-1');
  assert.equal(releaseLock.allowed, false);
  assert.equal(releaseLock.status, 'BLOCKED_BACKEND');
});
