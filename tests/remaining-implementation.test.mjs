import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';

const {
  isSafeExternalOrAssetUrl,
  countUnreadThreads,
  PARENT_NOTES_DAILY_QUOTA,
} = await import('../src/lib/schoolContent.ts');

const {
  createParentNotesQuotaBoundaryController,
  getNextTunisBoundaryDelayMs,
} = await import('../src/lib/parentNotesBoundary.ts');

const require = createRequire(import.meta.url);
const tempDir = await mkdtemp(path.join(tmpdir(), 'kristou-remaining-impl-'));
after(() => rm(tempDir, { recursive: true, force: true }));

async function bundleComponent(relPath, outName) {
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
        name: 'context-and-external-deps',
        setup(builder) {
          builder.onResolve({ filter: /context\/AppContext$/ }, () => ({
            path: 'context',
            namespace: 'fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents:
              'export const useApp = () => ({ ...globalThis.__REM_IMPL_CTX__, t: (key) => key });',
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

const [
  { PublicHomePage },
  { ClassCommunityView },
  { MessagesView },
  { ParentHomePage },
  { TeacherHomePage },
  { ManagerHomePage },
  { AdministrativePersonnelHomePage },
  { SchoolStaffHomePage },
  { ClassesManagementView },
  { SchoolCalendarPanel },
  { ParentNotesPanel },
] = await Promise.all([
  bundleComponent('../src/components/homepages/PublicHomePage.tsx', 'public-home.cjs'),
  bundleComponent('../src/components/views/ClassCommunityView.tsx', 'class-community.cjs'),
  bundleComponent('../src/components/views/MessagesView.tsx', 'messages-view.cjs'),
  bundleComponent('../src/components/homepages/ParentHomePage.tsx', 'parent-home.cjs'),
  bundleComponent('../src/components/homepages/TeacherHomePage.tsx', 'teacher-home.cjs'),
  bundleComponent('../src/components/homepages/ManagerHomePage.tsx', 'manager-home.cjs'),
  bundleComponent(
    '../src/components/homepages/AdministrativePersonnelHomePage.tsx',
    'admin-personnel-home.cjs',
  ),
  bundleComponent('../src/components/homepages/SchoolStaffHomePage.tsx', 'school-staff-home.cjs'),
  bundleComponent('../src/components/views/ClassesManagementView.tsx', 'classes-mgmt.cjs'),
  bundleComponent('../src/components/views/Shared/SchoolCalendarPanel.tsx', 'calendar-panel.cjs'),
  bundleComponent('../src/components/views/Shared/ParentNotesPanel.tsx', 'parent-notes-panel.cjs'),
]);

const FORBIDDEN_INTERNAL_UI_TOKENS = [
  'Codex',
  'Storage bucket',
  'no fake local',
  'upsert_school_public_content',
  'create_class_document',
  'create_class_gallery_item',
  'mark_operational_thread_read',
  'list_assignable_school_accounts',
];

function assertNoInternalTokens(text, label) {
  for (const token of FORBIDDEN_INTERNAL_UI_TOKENS) {
    assert.ok(!text.includes(token), `${label} must not expose internal token "${token}"`);
  }
}

function withMockedNow(isoTimestamp, fn) {
  const RealDate = globalThis.Date;
  const fixedMs = new RealDate(isoTimestamp).getTime();
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedMs);
      } else {
        super(...args);
      }
    }
    static now() {
      return fixedMs;
    }
  }
  globalThis.Date = MockDate;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    username: 'tester',
    fullName: 'Test Account',
    role: 'PARENT',
    accountStatus: 'APPROVED',
    capabilities: [],
    linkedChildrenIds: ['child-1'],
    assignedClassIds: ['class-1'],
    ...overrides,
  };
}

function baseCtx(overrides = {}) {
  return {
    language: 'en',
    currentUser: makeUser(),
    announcements: [],
    broadcasts: [],
    broadcastsStatus: 'READY',
    broadcastsError: null,
    homeworkList: [],
    classDocuments: [],
    classGallery: [],
    calendarEvents: [],
    calendarStatus: 'READY',
    calendarError: null,
    classQuestions: [],
    communityStatus: 'READY',
    communityError: null,
    parentNotes: [],
    notesStatus: 'READY',
    notesError: null,
    remainingParentNotesToday: 11,
    isRefreshingParentNotesQuota: false,
    parentNotesQuotaStale: false,
    messages: [],
    messagesStatus: 'READY',
    messagesError: null,
    foodMenu: { id: 'm-1', weekRange: 'Week 1', items: [], isDemoPreview: false },
    foodMenuStatus: 'READY',
    foodMenuError: null,
    publicContent: {},
    publicContentStatus: 'READY',
    publicContentError: null,
    childrenList: [{ id: 'child-1', fullName: 'Lina', classId: 'class-1', className: 'CP-A', level: 'CP', pickupAuthorizedNames: [] }],
    classesList: [{ id: 'class-1', name: 'CP-A', level: 'CP', teacherId: 't-1', teacherName: 'Mme Salma', academicYear: '2026-2027', studentCount: 20 }],
    classRosters: [],
    operationalCounts: {},
    operationalCountsLoaded: true,
    isHydratingSchoolData: false,
    isLoadingClassCommunity: false,
    schoolContextError: null,
    publicInquiries: [],
    inquiriesStatus: 'READY',
    selectedClassId: 'class-1',
    setSelectedClassId() {},
    selectedChildId: 'child-1',
    setSelectedChildId() {},
    refreshSchoolData: async () => true,
    refreshParentNotesQuota: async () => true,
    addParentNote: async () => ({ success: true, status: 'READY' }),
    replyParentNote: async () => ({ ok: true, status: 'READY' }),
    addClassQuestion: async () => ({ success: true, status: 'READY' }),
    replyClassQuestion: async () => ({ ok: true, status: 'READY' }),
    moderateClassQuestion: async () => ({ ok: true, status: 'READY' }),
    ...overrides,
  };
}

test('Packet B: PublicHomePage surfaces publicContentError, suppresses stale publicContent on ERROR, and gates CMS banner', () => {
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: null,
    publicContentStatus: 'ERROR',
    publicContentError: 'Public CMS read failed',
    publicContent: {
      hero: {
        slug: 'hero',
        titleAr: '',
        titleFr: '',
        titleEn: '',
        bodyAr: '',
        bodyFr: '',
        bodyEn: 'STALE HERO COPY',
        isPublished: true,
      },
    },
  });
  const errHtml = renderToStaticMarkup(
    React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
  );
  assert.ok(errHtml.includes('data-testid="public-content-error-banner"'));
  assert.ok(errHtml.includes('Public CMS read failed'));
  assert.ok(!errHtml.includes('STALE HERO COPY'), 'Stale publicContent must not display in ERROR state');
  assert.ok(!errHtml.includes('data-testid="public-cms-management-banner"'), 'Anonymous visitors must not see CMS banner');

  // Manager WITHOUT PUBLIC_CONTENT_MANAGE must NOT see CMS banner
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ role: 'MANAGER', capabilities: ['CLASSES_MANAGE'] }),
    publicContentStatus: 'READY',
  });
  const mgrNoCapHtml = renderToStaticMarkup(
    React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
  );
  assert.ok(!mgrNoCapHtml.includes('data-testid="public-cms-management-banner"'));

  // Verify explicit CMS status classification for BOTH APP_ADMIN and authorized MANAGER
  const authorizedActors = [
    { label: 'APP_ADMIN', user: makeUser({ role: 'APP_ADMIN' }) },
    { label: 'MANAGER(PUBLIC_CONTENT_MANAGE)', user: makeUser({ role: 'MANAGER', capabilities: ['PUBLIC_CONTENT_MANAGE'] }) },
  ];

  for (const actor of authorizedActors) {
    // 1. READY
    globalThis.__REM_IMPL_CTX__ = baseCtx({
      currentUser: actor.user,
      publicContentStatus: 'READY',
      publicContent: {
        hero: { slug: 'hero', titleAr: '', titleFr: '', titleEn: '', bodyAr: '', bodyFr: '', bodyEn: 'Official Hero', isPublished: true },
      },
    });
    const readyHtml = renderToStaticMarkup(
      React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
    );
    assert.ok(readyHtml.includes('data-testid="public-cms-management-banner"'), `${actor.label} READY banner`);
    assert.ok(readyHtml.includes('Published: 1'), `${actor.label} READY count`);
    assert.ok(!readyHtml.includes('Backend Pending'), `${actor.label} READY must never say Backend Pending`);
    assertNoInternalTokens(readyHtml, `${actor.label} PublicHomePage READY`);

    // 2. ERROR
    globalThis.__REM_IMPL_CTX__ = baseCtx({
      currentUser: actor.user,
      publicContentStatus: 'ERROR',
      publicContentError: 'Network failure',
    });
    const cmsErrorHtml = renderToStaticMarkup(
      React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
    );
    assert.ok(cmsErrorHtml.includes('data-testid="public-content-error-banner"'), `${actor.label} ERROR preserves top error banner`);
    assert.ok(cmsErrorHtml.includes('data-testid="public-cms-status-badge"'), `${actor.label} ERROR CMS badge`);
    assert.ok(cmsErrorHtml.includes('Loading Failed'), `${actor.label} ERROR explicit label`);
    assert.ok(cmsErrorHtml.includes('data-testid="public-cms-retry-btn"'), `${actor.label} ERROR retry button`);
    assert.ok(!cmsErrorHtml.includes('Backend Pending'), `${actor.label} ERROR must NEVER display Backend Pending`);
    assertNoInternalTokens(cmsErrorHtml, `${actor.label} PublicHomePage ERROR`);

    // 3. UNAUTHORIZED
    globalThis.__REM_IMPL_CTX__ = baseCtx({
      currentUser: actor.user,
      publicContentStatus: 'UNAUTHORIZED',
      publicContentError: 'Access denied',
    });
    const cmsUnauthHtml = renderToStaticMarkup(
      React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
    );
    assert.ok(cmsUnauthHtml.includes('data-testid="public-cms-status-badge"'), `${actor.label} UNAUTHORIZED CMS badge`);
    assert.ok(cmsUnauthHtml.includes('Access Denied'), `${actor.label} UNAUTHORIZED explicit label`);
    assert.ok(!cmsUnauthHtml.includes('data-testid="public-cms-retry-btn"'), `${actor.label} UNAUTHORIZED has no retry button in CMS badge`);
    assert.ok(!cmsUnauthHtml.includes('Backend Pending'), `${actor.label} UNAUTHORIZED must NEVER display Backend Pending`);
    assertNoInternalTokens(cmsUnauthHtml, `${actor.label} PublicHomePage UNAUTHORIZED`);

    // 4. BLOCKED_BACKEND
    globalThis.__REM_IMPL_CTX__ = baseCtx({
      currentUser: actor.user,
      publicContentStatus: 'BLOCKED_BACKEND',
    });
    const cmsBlockedHtml = renderToStaticMarkup(
      React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
    );
    assert.ok(cmsBlockedHtml.includes('Feature Unavailable'), `${actor.label} BLOCKED_BACKEND explicit label`);
    assert.ok(!cmsBlockedHtml.includes('Backend Pending'), `${actor.label} BLOCKED_BACKEND avoids stale label`);
    assertNoInternalTokens(cmsBlockedHtml, `${actor.label} PublicHomePage BLOCKED_BACKEND`);

    // 5. Reachable initial/hydrating state (AppContext initializes publicContentStatus to BLOCKED_BACKEND)
    globalThis.__REM_IMPL_CTX__ = baseCtx({
      currentUser: actor.user,
      isHydratingSchoolData: true,
      publicContentStatus: 'BLOCKED_BACKEND',
      publicContent: {},
    });
    const cmsLoadingHtml = renderToStaticMarkup(
      React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
    );
    assert.ok(cmsLoadingHtml.includes('Feature Unavailable'), `${actor.label} reachable initial/hydrating state`);
    assert.ok(!cmsLoadingHtml.includes('Loading public content status...'), `${actor.label} no unreachable undefined loading copy`);
    assert.ok(!cmsLoadingHtml.includes('Backend Pending'), `${actor.label} loading must never show Backend Pending`);
  }

  // Verify AppContext.tsx clears stale publicContent and sets publicContentError on failure
  const appCtxSrc = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  assert.match(appCtxSrc, /setPublicContentError\(\s*contentRes\.errorMessage \|\| contentRes\.errorCode/);
  assert.match(appCtxSrc, /setPublicContent\(\{\}\);/);
});

test('Packet C: isSafeExternalOrAssetUrl rejects dangerous URLs and ClassCommunityView guards documents & gallery with clean copy', () => {
  assert.equal(isSafeExternalOrAssetUrl('https://cdn.kristou.tn/doc.pdf'), true);
  assert.equal(isSafeExternalOrAssetUrl('http://localhost:3000/file.pdf'), true);
  assert.equal(isSafeExternalOrAssetUrl('/assets/kristou-home/school-building.png'), true);
  assert.equal(isSafeExternalOrAssetUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalOrAssetUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeExternalOrAssetUrl('vbscript:msgbox(1)'), false);
  assert.equal(isSafeExternalOrAssetUrl('//evil.example.com/payload.png'), false);
  assert.equal(isSafeExternalOrAssetUrl(''), false);
  assert.equal(isSafeExternalOrAssetUrl(null), false);

  // Documents tab: Teacher sees disabled upload + clean blocked notice, unsafe doc URL blocked
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ role: 'TEACHER' }),
    classDocuments: [
      { id: 'doc-safe', classId: 'class-1', title: 'Syllabus', description: '', documentUrl: 'https://example.org/syllabus.pdf', fileType: 'PDF', createdAt: '2026-11-15' },
      { id: 'doc-bad', classId: 'class-1', title: 'Malicious', description: '', documentUrl: 'javascript:alert(1)', fileType: 'PDF', createdAt: '2026-11-15' },
    ],
  });
  const docsTeacherHtml = renderToStaticMarkup(
    React.createElement(ClassCommunityView, { initialSubTab: 'documents' }),
  );
  assert.ok(docsTeacherHtml.includes('data-testid="class-documents-upload-disabled-btn"'));
  assert.ok(docsTeacherHtml.includes('data-testid="class-documents-blocked-actions"'));
  assert.ok(docsTeacherHtml.includes('Uploading and deleting class documents is currently unavailable'));
  assert.ok(docsTeacherHtml.includes('href="https://example.org/syllabus.pdf"'));
  assert.ok(docsTeacherHtml.includes('data-testid="class-document-unsafe-blocked-doc-bad"'));
  assert.ok(!docsTeacherHtml.includes('href="javascript:alert(1)"'));
  assertNoInternalTokens(docsTeacherHtml, 'ClassCommunityView documents');

  // Gallery tab: Teacher sees disabled upload + clean blocked notice
  const galleryTeacherHtml = renderToStaticMarkup(
    React.createElement(ClassCommunityView, { initialSubTab: 'gallery' }),
  );
  assert.ok(galleryTeacherHtml.includes('data-testid="class-gallery-upload-disabled-btn"'));
  assert.ok(galleryTeacherHtml.includes('data-testid="class-gallery-blocked-actions"'));
  assert.ok(galleryTeacherHtml.includes('Uploading and deleting gallery photos is currently unavailable'));
  assertNoInternalTokens(galleryTeacherHtml, 'ClassCommunityView gallery (teacher)');

  // Parent does NOT see moderation upload controls
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ role: 'PARENT' }),
    classGallery: [
      { id: 'gal-safe', classId: 'class-1', title: 'Science Fair', caption: '', imageUrl: '/assets/kristou-home/school-building.png', isPublic: false, createdAt: '2026-11-15' },
      { id: 'gal-bad', classId: 'class-1', title: 'Bad Img', caption: '', imageUrl: 'data:text/html,boom', isPublic: false, createdAt: '2026-11-15' },
    ],
  });
  const galleryParentHtml = renderToStaticMarkup(
    React.createElement(ClassCommunityView, { initialSubTab: 'gallery' }),
  );
  assert.ok(!galleryParentHtml.includes('data-testid="class-gallery-upload-disabled-btn"'));
  assert.ok(!galleryParentHtml.includes('data-testid="class-gallery-blocked-actions"'));
  assert.ok(galleryParentHtml.includes('src="/assets/kristou-home/school-building.png"'));
  assert.ok(galleryParentHtml.includes('data-testid="class-gallery-unsafe-blocked-gal-bad"'));
  assert.ok(!galleryParentHtml.includes('src="data:text/html'));
  assertNoInternalTokens(galleryParentHtml, 'ClassCommunityView gallery (parent)');
});

test('Packet D: unread count helper, clean MessagesView unread sync notice, and role homepage message card badges', () => {
  const sampleThreads = [
    { id: 'th-1', subject: 'Pickup note', recipientId: 't-1', recipientName: 'Teacher', recipientRole: 'TEACHER', lastMessage: 'Hello', updatedAt: '2026-11-15', unread: true, messages: [] },
    { id: 'th-2', subject: 'Homework', recipientId: 't-1', recipientName: 'Teacher', recipientRole: 'TEACHER', lastMessage: 'Done', updatedAt: '2026-11-15', unread: false, messages: [] },
    { id: 'th-3', subject: 'Bus change', recipientId: 't-1', recipientName: 'Teacher', recipientRole: 'TEACHER', lastMessage: 'Wait', updatedAt: '2026-11-15', unread: true, messages: [] },
  ];
  assert.equal(countUnreadThreads(sampleThreads, 'READY'), 2);
  assert.equal(countUnreadThreads(sampleThreads, 'UNAUTHORIZED'), 0);
  assert.equal(countUnreadThreads(sampleThreads, 'ERROR'), 0);
  assert.equal(countUnreadThreads(sampleThreads, 'BLOCKED_BACKEND'), 0);

  globalThis.__REM_IMPL_CTX__ = baseCtx({
    messages: sampleThreads,
    messagesStatus: 'READY',
  });
  const msgHtml = renderToStaticMarkup(React.createElement(MessagesView));
  assert.ok(msgHtml.includes('data-testid="messages-unread-count-badge"'));
  assert.ok(msgHtml.includes('2 unread'));
  assertNoInternalTokens(msgHtml, 'MessagesView');

  // Role homepages render unread pill when READY
  for (const Comp of [
    ParentHomePage,
    TeacherHomePage,
    ManagerHomePage,
    AdministrativePersonnelHomePage,
    SchoolStaffHomePage,
  ]) {
    const html = renderToStaticMarkup(React.createElement(Comp, { setActiveTab() {} }));
    assert.ok(html.includes('kh-shortcut-status-pill'), 'Role homepage should render unread pill');
    assert.ok(html.includes('>2<'), 'Unread badge count 2 must be shown');
  }

  // MessagesView source includes clean server-owned read-sync notice without internal RPC names
  const msgSrc = fs.readFileSync(new URL('../src/components/views/MessagesView.tsx', import.meta.url), 'utf8');
  assert.match(msgSrc, /data-testid="messages-unread-sync-notice"/);
  assert.match(msgSrc, /Unread status is managed by the school server/);
  assertNoInternalTokens(msgSrc, 'MessagesView source');
});

test('Packet E: ClassesManagementView role-scopes directory fetches and shows clean delegated manager notice', () => {
  const src = fs.readFileSync(
    new URL('../src/components/views/ClassesManagementView.tsx', import.meta.url),
    'utf8',
  );
  assert.match(src, /listAccountDirectory\(\{ status: 'APPROVED', role: 'TEACHER', limit: 100 \}\)/);
  assert.match(src, /listAccountDirectory\(\{ status: 'APPROVED', role: 'PARENT', limit: 100 \}\)/);
  assert.match(src, /listAccountDirectory\(\{ status: 'APPROVED', role: 'STUDENT', limit: 100 \}\)/);
  assert.match(src, /data-testid="assignable-accounts-blocked-notice"/);
  assertNoInternalTokens(src, 'ClassesManagementView source');
  assert.ok(
    !src.includes('ACCOUNT_APPROVAL_REVIEW'),
    'ClassesManagementView user copy must not leak internal capability keys',
  );

  // Delegated MANAGER with CLASSES_MANAGE (without ACCOUNT_APPROVAL_REVIEW) sees UUID inputs, not error
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ role: 'MANAGER', capabilities: ['CLASSES_MANAGE', 'CLASSES_ROSTER_VIEW'] }),
  });
  const mgrHtml = renderToStaticMarkup(
    React.createElement(ClassesManagementView, { initialClasses: [], backendStatus: 'READY' }),
  );
  assert.ok(mgrHtml.includes('data-testid="toggle-enroll-student-btn"'));
  assert.ok(mgrHtml.includes('data-testid="toggle-assign-teacher-btn"'));
  assertNoInternalTokens(mgrHtml, 'ClassesManagementView HTML');
});

test('Packet F: SchoolCalendarPanel renders Load More pagination trigger when day events exceed page size', () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  const manyEvents = Array.from({ length: 12 }, (_, idx) => ({
    id: `ev-${idx + 1}`,
    title: `Event ${idx + 1}`,
    description: '',
    category: 'EVENT',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: true,
    status: 'SCHEDULED',
  }));
  globalThis.__REM_IMPL_CTX__ = baseCtx({ currentUser: makeUser({ role: 'APP_ADMIN' }) });
  const calHtml = renderToStaticMarkup(
    React.createElement(SchoolCalendarPanel, {
      events: manyEvents,
      backendStatus: 'READY',
      canManage: true,
      canRespond: true,
      onRefresh: async () => true,
    }),
  );
  assert.ok(calHtml.includes('data-testid="calendar-load-more-btn"'));
  assert.ok(calHtml.includes('Show more (2)'));
});

test('Packet G (UI & Helpers): Tunis boundary delay helper and ParentNotesPanel window/no-child guards', () => {
  assert.ok(getNextTunisBoundaryDelayMs(new Date('2026-11-15T06:59:50.000Z')) <= 10_500);
  assert.ok(getNextTunisBoundaryDelayMs(new Date('2026-11-15T16:59:55.000Z')) <= 5_500);
  assert.equal(getNextTunisBoundaryDelayMs(new Date('2026-11-15T11:00:00.000Z')), 30_000);

  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ role: 'PARENT', linkedChildrenIds: ['child-1'] }),
    childrenList: [{ id: 'child-1', fullName: 'Lina', classId: 'class-1', className: 'CP-A', level: 'CP', pickupAuthorizedNames: [] }],
  });
  const mismatchHtml = renderToStaticMarkup(
    React.createElement(ParentNotesPanel, {
      classId: 'class-other',
      classNameLabel: 'CE1-B',
      embeddedUnderCalendar: true,
    }),
  );
  assert.ok(mismatchHtml.includes('data-testid="parent-note-no-child-hint"'));
  assert.ok(mismatchHtml.includes('No linked child in this class'));

  const appCtxSrc = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const parentNotesStateSrc = fs.readFileSync(new URL('../src/context/useParentNotesState.ts', import.meta.url), 'utf8');
  assert.match(parentNotesStateSrc, /createParentNotesQuotaBoundaryController/);
  assert.match(parentNotesStateSrc, /visibilitychange/);
  assert.match(parentNotesStateSrc, /pageshow/);
  assert.match(appCtxSrc, /useParentNotesState/);
  assert.match(appCtxSrc, /isRefreshingParentNotesQuota/);
  assert.match(appCtxSrc, /parentNotesQuotaStale/);
});

test('Packet G Scenario 1: Exhausted panel crossing 07:59 -> 08:00 Tunis (and 07:55 -> 09:10 suspension) refreshes once and never manufactures local reset', async () => {
  const makeNote = (idx, createdAt) => ({
    id: `n-${idx}`,
    parentId: 'parent-a',
    parentName: 'Parent A',
    childId: 'child-1',
    childName: 'Lina',
    classId: 'class-1',
    topic: 'ABSENCE',
    content: `Note ${idx}`,
    createdAt,
    schoolDay: createdAt.slice(0, 10),
    status: 'SENT',
  });

  const yesterdayNotes = Array.from({ length: PARENT_NOTES_DAILY_QUOTA }, (_, i) =>
    makeNote(i + 1, `2026-11-14T10:${String(i).padStart(2, '0')}:00.000Z`),
  );

  let fakeNow = new Date('2026-11-14T22:55:00.000Z'); // 23:55 Africa/Tunis on Nov 14 (quota day 2026-11-14)
  let currentNotes = [...yesterdayNotes];
  let identity = { userId: 'parent-a', accountStatus: 'APPROVED' };
  let fetchCount = 0;
  let resolveDeferred;

  const controller = createParentNotesQuotaBoundaryController({
    now: () => fakeNow,
    getCurrentIdentity: () => identity,
    fetchNotes: () => {
      fetchCount += 1;
      return new Promise((resolve) => {
        resolveDeferred = resolve;
      });
    },
    onApplyNotes: (next) => {
      currentNotes = next;
    },
    onClearNotes: () => {
      currentNotes = [];
    },
  });

  controller.setIdentity(true);
  controller.recordHydratedResult(identity, { ok: true, status: 'READY', data: yesterdayNotes }, fakeNow, true);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, '2026-11-14');
  assert.equal(controller.getSnapshot().quotaStale, false);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 0);

  // Cross 00:00 Africa/Tunis calendar midnight (23:00:05 UTC on Nov 14 -> 00:00:05 Tunis on Nov 15)
  fakeNow = new Date('2026-11-14T23:00:05.000Z');
  const p1 = controller.checkBoundaryAndRefresh();
  const p2 = controller.checkBoundaryAndRefresh();

  // Single-flight deduplication and NO premature local reset while server read is in-flight
  assert.equal(fetchCount, 1);
  assert.equal(controller.getSnapshot().refreshing, true);
  assert.equal(controller.getSnapshot().quotaStale, true);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 0);

  // Resolve with yesterday's notes -> quota is now server-verified for 2026-11-15 -> 11 remaining
  resolveDeferred({ ok: true, status: 'READY', data: yesterdayNotes });
  const [res1, res2] = await Promise.all([p1, p2]);
  assert.equal(res1.quotaDayChanged, true);
  assert.equal(res1.refreshed, true);
  assert.equal(res2.refreshed, true);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, '2026-11-15');
  assert.equal(controller.getSnapshot().quotaStale, false);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 11);

  // Browser suspension jump: 23:55 on 2026-11-15 Tunis -> 01:10 on 2026-11-16 Tunis (server already has 2 notes for new day)
  fakeNow = new Date('2026-11-15T22:55:00.000Z'); // 23:55 Tunis on Nov 15 (still 2026-11-15 quota day)
  assert.equal((await controller.checkBoundaryAndRefresh()).refreshed, false);
  fakeNow = new Date('2026-11-16T00:10:00.000Z'); // 01:10 Tunis on Nov 16 (quota day 2026-11-16)
  const jumpPromise = controller.checkBoundaryAndRefresh();
  assert.equal(fetchCount, 2);
  const newDayNotes = [
    ...yesterdayNotes,
    makeNote(101, '2026-11-16T00:10:00.000Z'),
    makeNote(102, '2026-11-16T00:20:00.000Z'),
  ];
  resolveDeferred({ ok: true, status: 'READY', data: newDayNotes });
  const jumpRes = await jumpPromise;
  assert.equal(jumpRes.refreshed, true);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, '2026-11-16');
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 9);
});

test('Packet G Scenario 2: Crossing 17:59 -> 18:00 Tunis closes submit in ParentNotesPanel while keeping history readable', async () => {
  let fakeNow = new Date('2026-11-15T16:59:00.000Z'); // 17:59 Tunis (open)
  let fetchCalls = 0;
  const controller = createParentNotesQuotaBoundaryController({
    now: () => fakeNow,
    getCurrentIdentity: () => ({ userId: 'parent-a', accountStatus: 'APPROVED' }),
    fetchNotes: async () => {
      fetchCalls += 1;
      return { ok: true, status: 'READY', data: [] };
    },
    onApplyNotes: () => {},
    onClearNotes: () => {},
  });
  controller.setIdentity(true);
  controller.recordHydratedResult(
    { userId: 'parent-a', accountStatus: 'APPROVED' },
    { ok: true, status: 'READY', data: [] },
    fakeNow,
    true,
  );
  assert.equal(controller.getSnapshot().withinTunisWindow, true);

  // Advance across 18:00 Tunis -> window closes, quota day does NOT reset (no unnecessary fetch)
  fakeNow = new Date('2026-11-15T17:00:05.000Z'); // 18:00:05 Tunis
  const check = await controller.checkBoundaryAndRefresh();
  assert.equal(check.windowChanged, true);
  assert.equal(check.quotaDayChanged, false);
  assert.equal(check.refreshed, false);
  assert.equal(fetchCalls, 0);
  assert.equal(controller.getSnapshot().withinTunisWindow, false);

  // Render ParentNotesPanel at 18:00:05 Tunis -> closed notice rendered, submit disabled, history readable
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ id: 'parent-a', role: 'PARENT', linkedChildrenIds: ['child-1'] }),
    parentNotes: [
      {
        id: 'note-hist-1',
        parentId: 'parent-a',
        parentName: 'Parent A',
        childId: 'child-1',
        childName: 'Lina',
        classId: 'class-1',
        topic: 'ABSENCE',
        content: 'Existing readable note after 18:00',
        createdAt: '2026-11-15T10:00:00.000Z',
        schoolDay: '2026-11-15',
        status: 'SENT',
      },
    ],
    remainingParentNotesToday: 10,
  });

  const closedHtml = withMockedNow('2026-11-15T17:00:05.000Z', () =>
    renderToStaticMarkup(React.createElement(ParentNotesPanel, { classId: 'class-1' })),
  );
  assert.ok(closedHtml.includes('data-testid="parent-notes-window-closed-notice"'));
  assert.ok(closedHtml.includes('Closed Outside 08:00–18:00 Tunis'));
  assert.ok(closedHtml.includes('Existing readable note after 18:00'));
  assert.match(closedHtml, /<button[^>]*data-testid="parent-note-submit-btn"[^>]*disabled=""/);
});

test('Packet G Scenario 3: Failed boundary refresh never manufactures 11/11 reset, surfaces retryable error, and handles UNAUTHORIZED', async () => {
  const exhaustedNotes = Array.from({ length: PARENT_NOTES_DAILY_QUOTA }, (_, i) => ({
    id: `n-${i + 1}`,
    parentId: 'parent-a',
    parentName: 'Parent A',
    childId: 'child-1',
    childName: 'Lina',
    classId: 'class-1',
    topic: 'OTHER',
    content: `Note ${i + 1}`,
    createdAt: `2026-11-14T11:${String(i).padStart(2, '0')}:00.000Z`,
    schoolDay: '2026-11-14',
    status: 'SENT',
  }));

  let fakeNow = new Date('2026-11-14T22:55:00.000Z');
  let mode = 'ERROR_RESULT';
  let currentNotes = [...exhaustedNotes];
  let statusEvents = [];
  const identity = { userId: 'parent-a', accountStatus: 'APPROVED' };

  const controller = createParentNotesQuotaBoundaryController({
    now: () => fakeNow,
    getCurrentIdentity: () => identity,
    fetchNotes: async () => {
      if (mode === 'THROW') throw new Error('Offline timeout');
      if (mode === 'ERROR_RESULT') return { ok: false, status: 'ERROR', errorMessage: 'Server unreachable' };
      if (mode === 'UNAUTH') return { ok: false, status: 'UNAUTHORIZED', errorMessage: 'Session expired' };
      return { ok: true, status: 'READY', data: exhaustedNotes };
    },
    onApplyNotes: (next) => {
      currentNotes = next;
    },
    onClearNotes: () => {
      currentNotes = [];
    },
    onStatusChange: (s, err) => statusEvents.push({ s, err }),
  });

  controller.setIdentity(true);
  controller.recordHydratedResult(identity, { ok: true, status: 'READY', data: exhaustedNotes }, fakeNow, true);

  // Cross 00:00 Tunis midnight with ERROR result
  fakeNow = new Date('2026-11-14T23:05:00.000Z');
  const errCheck = await controller.checkBoundaryAndRefresh();
  assert.equal(errCheck.refreshed, false);
  assert.equal(controller.getSnapshot().status, 'ERROR');
  assert.equal(controller.getSnapshot().quotaStale, true);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 0);

  // Thrown network error also preserves 0 remaining and records ERROR
  mode = 'THROW';
  assert.equal(await controller.refreshNow(), false);
  assert.equal(controller.getSnapshot().status, 'ERROR');
  assert.equal(controller.getSnapshot().error, 'Offline timeout');
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 0);

  // Render ParentNotesPanel during failed/stale boundary -> retry banner visible & submit disabled
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ id: 'parent-a', role: 'PARENT', linkedChildrenIds: ['child-1'] }),
    notesStatus: 'ERROR',
    notesError: 'Offline timeout',
    remainingParentNotesToday: 0,
    parentNotesQuotaStale: true,
    isRefreshingParentNotesQuota: false,
  });
  const errPanelHtml = withMockedNow('2026-11-14T23:05:00.000Z', () =>
    renderToStaticMarkup(React.createElement(ParentNotesPanel, { classId: 'class-1' })),
  );
  assert.ok(errPanelHtml.includes('data-testid="parent-notes-error-state"'));
  assert.ok(errPanelHtml.includes('data-testid="parent-notes-retry-btn"'));
  assert.ok(errPanelHtml.includes('Offline timeout'));
  assert.match(errPanelHtml, /<button[^>]*data-testid="parent-note-submit-btn"[^>]*disabled=""/);

  // Successful retry updates verified quota day -> 11 remaining
  mode = 'OK';
  assert.equal(await controller.refreshNow(), true);
  assert.equal(controller.getSnapshot().status, 'READY');
  assert.equal(controller.getSnapshot().quotaStale, false);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 11);

  // UNAUTHORIZED clears notes & verified baseline
  mode = 'UNAUTH';
  assert.equal(await controller.refreshNow(), false);
  assert.equal(controller.getSnapshot().status, 'UNAUTHORIZED');
  assert.equal(currentNotes.length, 0);
  assert.equal(statusEvents.at(-1)?.s, 'UNAUTHORIZED');
});

test('Packet G Scenario 4: Account change during in-flight boundary refresh discards stale completion', async () => {
  let fakeNow = new Date('2026-11-14T22:55:00.000Z');
  let identity = { userId: 'parent-a', accountStatus: 'APPROVED' };
  let appliedForCurrentAccount = null;
  let cleared = false;
  let resolveA;

  const controller = createParentNotesQuotaBoundaryController({
    now: () => fakeNow,
    getCurrentIdentity: () => identity,
    fetchNotes: () =>
      new Promise((resolve) => {
        resolveA = resolve;
      }),
    onApplyNotes: (notes) => {
      appliedForCurrentAccount = notes;
    },
    onClearNotes: () => {
      cleared = true;
    },
  });

  controller.setIdentity(true);
  controller.recordHydratedResult(identity, { ok: true, status: 'READY', data: [] }, fakeNow, true);

  // Start refresh as Account A at 00:00 Tunis
  fakeNow = new Date('2026-11-14T23:00:05.000Z');
  const inFlightA = controller.checkBoundaryAndRefresh();
  assert.equal(controller.getSnapshot().refreshing, true);

  // Switch to Account B before Account A's network request finishes
  identity = { userId: 'parent-b', accountStatus: 'APPROVED' };
  controller.setIdentity(true);

  // Account A's stale payload arrives late
  resolveA({
    ok: true,
    status: 'READY',
    data: [
      {
        id: 'stale-a-note',
        parentId: 'parent-a',
        parentName: 'Parent A',
        childId: 'child-a',
        childName: 'Child A',
        classId: 'class-1',
        topic: 'OTHER',
        content: 'Must never leak to Parent B',
        createdAt: '2026-11-15T07:00:01.000Z',
        schoolDay: '2026-11-15',
        status: 'SENT',
      },
    ],
  });

  const aOutcome = await inFlightA;
  assert.equal(aOutcome.refreshed, false);
  assert.equal(appliedForCurrentAccount, null);
  assert.equal(cleared, false);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, null);
  assert.equal(controller.getSnapshot().refreshing, false);
});

test('Final Correction A: New or switched approved account starts unverified with null estimate and guarded submit until its own server read succeeds', async () => {
  let fakeNow = new Date('2026-11-15T09:00:00.000Z'); // 10:00 Tunis (within window)
  let identity = { userId: 'parent-a', accountStatus: 'APPROVED', generation: 1 };
  let currentNotes = [];
  let appliedNotesCount = 0;

  let resolveAccountA;
  let resolveAccountB;
  let fetchMode = 'DEFER_A';

  const controller = createParentNotesQuotaBoundaryController({
    now: () => fakeNow,
    getCurrentIdentity: () => identity,
    fetchNotes: () => {
      if (fetchMode === 'DEFER_A') {
        return new Promise((resolve) => {
          resolveAccountA = resolve;
        });
      }
      if (fetchMode === 'DEFER_B') {
        return new Promise((resolve) => {
          resolveAccountB = resolve;
        });
      }
      return Promise.resolve({ ok: false, status: 'ERROR', errorMessage: 'Initial hydration failed' });
    },
    onApplyNotes: (notes) => {
      appliedNotesCount += 1;
      currentNotes = notes;
    },
    onClearNotes: () => {
      currentNotes = [];
    },
  });

  // Account A verified with 1 note
  controller.setIdentity(true);
  const noteA = {
    id: 'note-a-1',
    parentId: 'parent-a',
    parentName: 'Parent A',
    childId: 'child-a',
    childName: 'Adam',
    classId: 'class-1',
    topic: 'OTHER',
    content: 'Account A note',
    createdAt: '2026-11-15T08:00:00.000Z',
    schoolDay: '2026-11-15',
    status: 'SENT',
  };
  controller.recordHydratedResult(identity, { ok: true, status: 'READY', data: [noteA] }, fakeNow, true);
  currentNotes = [noteA];
  assert.equal(controller.getSnapshot().quotaVerified, true);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 10);

  // Start a refresh on Account A, then switch to Account B before A completes
  const pendingA = controller.refreshNow();
  identity = { userId: 'parent-b', accountStatus: 'APPROVED', generation: 2 };
  controller.setIdentity(true);
  currentNotes = [];

  // A1: Immediately after switching to Account B (no hydrated records yet), quota MUST be unverified & null (never 11)
  const snapBInit = controller.getSnapshot();
  assert.equal(snapBInit.quotaVerified, false);
  assert.equal(snapBInit.quotaStale, true);
  assert.equal(snapBInit.verifiedQuotaDay, null);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-b'), null);

  // Rendered ParentNotesPanel for unverified Account B must disable submit and NOT display 11 / 11
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ id: 'parent-b', role: 'PARENT', linkedChildrenIds: ['child-b'] }),
    childrenList: [{ id: 'child-b', fullName: 'Sami', classId: 'class-1', className: 'CP-A', level: 'CP', pickupAuthorizedNames: [] }],
    selectedChildId: 'child-b',
    parentNotes: [],
    notesStatus: 'BLOCKED_BACKEND',
    remainingParentNotesToday: controller.computeRemainingQuota(currentNotes, 'parent-b'),
    parentNotesQuotaStale: snapBInit.quotaStale,
    parentNotesQuotaVerified: snapBInit.quotaVerified,
  });
  const unverifiedHtml = withMockedNow('2026-11-15T09:00:00.000Z', () =>
    renderToStaticMarkup(React.createElement(ParentNotesPanel, { classId: 'class-1' })),
  );
  assert.match(unverifiedHtml, /<button[^>]*data-testid="parent-note-submit-btn"[^>]*disabled=""/);
  assert.ok(!unverifiedHtml.includes('11 / 11'), 'Unverified account must not fabricate 11 / 11');

  // A2: Account A's late response completes after switch -> MUST be completely ignored
  resolveAccountA({ ok: true, status: 'READY', data: [noteA] });
  assert.equal(await pendingA, false);
  assert.equal(appliedNotesCount, 0);
  assert.equal(controller.getSnapshot().quotaVerified, false);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-b'), null);

  // A3: Account B's initial hydration fails -> stays unverified with null allowance & error/retry UI
  const tokenFailB = controller.beginHydrationRequest(identity, true);
  assert.ok(tokenFailB);
  controller.recordHydratedResult(
    identity,
    { ok: false, status: 'ERROR', errorMessage: 'Network error loading B' },
    fakeNow,
    true,
    tokenFailB,
  );
  assert.equal(controller.getSnapshot().quotaVerified, false);
  assert.equal(controller.getSnapshot().status, 'ERROR');
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-b'), null);

  globalThis.__REM_IMPL_CTX__ = baseCtx({
    currentUser: makeUser({ id: 'parent-b', role: 'PARENT', linkedChildrenIds: ['child-b'] }),
    childrenList: [{ id: 'child-b', fullName: 'Sami', classId: 'class-1', className: 'CP-A', level: 'CP', pickupAuthorizedNames: [] }],
    selectedChildId: 'child-b',
    notesStatus: 'ERROR',
    notesError: 'Network error loading B',
    remainingParentNotesToday: null,
    parentNotesQuotaStale: true,
    parentNotesQuotaVerified: false,
  });
  const failedBHtml = withMockedNow('2026-11-15T09:00:00.000Z', () =>
    renderToStaticMarkup(React.createElement(ParentNotesPanel, { classId: 'class-1' })),
  );
  assert.ok(failedBHtml.includes('data-testid="parent-notes-error-state"'));
  assert.ok(failedBHtml.includes('data-testid="parent-notes-retry-btn"'));
  assert.ok(!failedBHtml.includes('11 / 11'));
  assert.match(failedBHtml, /<button[^>]*data-testid="parent-note-submit-btn"[^>]*disabled=""/);

  // Successful retry for Account B with 3 notes today -> derived estimate = 8 / 11
  fetchMode = 'DEFER_B';
  const retryBPromise = controller.refreshNow();
  const bNotes = [1, 2, 3].map((i) => ({
    id: `note-b-${i}`,
    parentId: 'parent-b',
    parentName: 'Parent B',
    childId: 'child-b',
    childName: 'Sami',
    classId: 'class-1',
    topic: 'ABSENCE',
    content: `Note B ${i}`,
    createdAt: `2026-11-15T08:0${i}:00.000Z`,
    schoolDay: '2026-11-15',
    status: 'SENT',
  }));
  resolveAccountB({ ok: true, status: 'READY', data: bNotes });
  assert.equal(await retryBPromise, true);
  assert.equal(controller.getSnapshot().quotaVerified, true);
  assert.equal(controller.getSnapshot().quotaStale, false);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-b'), 8);
});

test('Final Correction B: Dedicated refresh and ordinary hydration crossing 08:00 Tunis cannot certify new cycle, and older hydration cannot overwrite newer read', async () => {
  const makeNote = (id, createdAt) => ({
    id,
    parentId: 'parent-a',
    parentName: 'Parent A',
    childId: 'child-1',
    childName: 'Lina',
    classId: 'class-1',
    topic: 'OTHER',
    content: `Note ${id}`,
    createdAt,
    schoolDay: createdAt.slice(0, 10),
    status: 'SENT',
  });

  const yesterdayNotes = Array.from({ length: PARENT_NOTES_DAILY_QUOTA }, (_, i) =>
    makeNote(`y-${i}`, `2026-11-14T12:${String(i).padStart(2, '0')}:00.000Z`),
  );

  // 1. Dedicated refreshNow() starts at 23:59:59 Tunis (22:59:59Z) and completes at 00:00:02 Tunis (23:00:02Z on Nov 14 -> 00:00:02 Tunis on Nov 15)
  let fakeNow = new Date('2026-11-14T22:59:59.000Z');
  const identity = { userId: 'parent-a', accountStatus: 'APPROVED', generation: 1 };
  let currentNotes = [...yesterdayNotes];
  let fetchCount = 0;
  const pendingResolvers = [];

  const controller = createParentNotesQuotaBoundaryController({
    now: () => fakeNow,
    getCurrentIdentity: () => identity,
    fetchNotes: () => {
      fetchCount += 1;
      return new Promise((resolve) => {
        pendingResolvers.push(resolve);
      });
    },
    onApplyNotes: (next) => {
      currentNotes = next;
    },
    onClearNotes: () => {
      currentNotes = [];
    },
  });

  controller.setIdentity(true);
  controller.recordHydratedResult(identity, { ok: true, status: 'READY', data: yesterdayNotes }, fakeNow, true);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, '2026-11-14');
  assert.equal(controller.getSnapshot().quotaVerified, true);

  // Start dedicated refresh BEFORE 00:00 midnight
  const preBoundaryRefresh = controller.refreshNow();
  assert.equal(fetchCount, 1);

  // Cross 00:00 Tunis midnight while in-flight; concurrent boundary checks must NOT spawn a fetch storm
  fakeNow = new Date('2026-11-14T23:00:01.000Z'); // 00:00:01 Tunis on Nov 15
  const concurrentCheck1 = controller.checkBoundaryAndRefresh();
  const concurrentCheck2 = controller.checkBoundaryAndRefresh();
  assert.equal(fetchCount, 1, 'Single-flight must deduplicate concurrent boundary triggers');

  // Pre-boundary request settles at 00:00:02 Tunis -> MUST NOT certify 2026-11-15
  fakeNow = new Date('2026-11-14T23:00:02.000Z');
  pendingResolvers.shift()({ ok: true, status: 'READY', data: yesterdayNotes });
  assert.equal(await preBoundaryRefresh, false);
  const [c1, c2] = await Promise.all([concurrentCheck1, concurrentCheck2]);
  assert.equal(c1.refreshed, false);
  assert.equal(c2.refreshed, false);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, '2026-11-14');
  assert.equal(controller.getSnapshot().quotaVerified, false);
  assert.equal(controller.getSnapshot().quotaStale, true);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 0);

  // Subsequent genuine post-boundary read at 08:00:03 succeeds and certifies 2026-11-15
  fakeNow = new Date('2026-11-15T07:00:03.000Z');
  const postBoundaryCheck = controller.checkBoundaryAndRefresh();
  assert.equal(fetchCount, 2);
  pendingResolvers.shift()({ ok: true, status: 'READY', data: yesterdayNotes });
  assert.equal((await postBoundaryCheck).refreshed, true);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, '2026-11-15');
  assert.equal(controller.getSnapshot().quotaVerified, true);
  assert.equal(controller.getSnapshot().quotaStale, false);
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 11);

  // 2. Ordinary hydration crossing 08:00 AND stale older hydration arriving after newer post-boundary refresh
  fakeNow = new Date('2026-11-16T06:59:59.000Z'); // 07:59:59 Tunis on 2026-11-16 (cycle 2026-11-15)
  const olderHydrationReq = controller.beginHydrationRequest(identity, true);
  assert.ok(olderHydrationReq);

  // Clock crosses 08:00 Tunis on 2026-11-16 (cycle 2026-11-16)
  fakeNow = new Date('2026-11-16T07:00:01.000Z');
  const newerRefreshPromise = controller.refreshNow();
  const todayNotes = [...yesterdayNotes, makeNote('t-1', '2026-11-16T07:00:00.500Z')];
  pendingResolvers.shift()({ ok: true, status: 'READY', data: todayNotes });
  assert.equal(await newerRefreshPromise, true);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, '2026-11-16');
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 10);

  // Now the older hydration (started at 07:59:59) finishes at 08:00:03 -> MUST be rejected cleanly
  fakeNow = new Date('2026-11-16T07:00:03.000Z');
  assert.equal(controller.isRequestCurrent(olderHydrationReq, true), false);
  const olderApplied = controller.recordHydratedResult(
    identity,
    { ok: true, status: 'READY', data: yesterdayNotes },
    fakeNow,
    true,
    olderHydrationReq,
  );
  assert.equal(olderApplied, false);
  assert.equal(controller.getSnapshot().verifiedQuotaDay, '2026-11-16');
  assert.equal(controller.computeRemainingQuota(currentNotes, 'parent-a'), 10);

  // 3. Ordinary hydration alone crossing 08:00 without an intervening refresh cannot certify new cycle
  const ctrl2 = createParentNotesQuotaBoundaryController({
    now: () => fakeNow,
    getCurrentIdentity: () => identity,
    fetchNotes: async () => ({ ok: true, status: 'READY', data: yesterdayNotes }),
    onApplyNotes: () => {},
    onClearNotes: () => {},
  });
  ctrl2.setIdentity(true);
  fakeNow = new Date('2026-11-16T22:59:59.000Z'); // 23:59:59 Tunis on Nov 16 (cycle 2026-11-16)
  const crossReq = ctrl2.beginHydrationRequest(identity, true);
  assert.ok(crossReq);
  fakeNow = new Date('2026-11-16T23:00:02.000Z'); // 00:00:02 Tunis on Nov 17 (cycle 2026-11-17)
  const crossCertified = ctrl2.recordHydratedResult(
    identity,
    { ok: true, status: 'READY', data: yesterdayNotes },
    fakeNow,
    true,
    crossReq,
  );
  assert.equal(crossCertified, false, 'Pre-boundary ordinary hydration must not certify post-midnight cycle');
  assert.equal(ctrl2.getSnapshot().verifiedQuotaDay, '2026-11-16');
  assert.equal(ctrl2.getSnapshot().quotaVerified, false);
  assert.equal(ctrl2.getSnapshot().quotaStale, true);

  // Verify useParentNotesState wires beginHydrationRequest + isRequestCurrent around listParentNotes() and AppContext delegates to it
  const appCtxSrc = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const parentNotesStateSrc = fs.readFileSync(new URL('../src/context/useParentNotesState.ts', import.meta.url), 'utf8');
  assert.match(appCtxSrc, /useParentNotesState/);
  assert.match(parentNotesStateSrc, /beginHydrationRequest\(/);
  assert.match(parentNotesStateSrc, /isRequestCurrent\(/);
});

test('Final Correction C & D: AR/FR/EN quota wording explicitly marks estimate as estimated, distinguishes outdated/unverified states, and keeps UNAUTHORIZED locked', () => {
  // 1. Fresh verified estimate (8 / 11) in EN, FR, AR
  const expectedLabels = [
    { lang: 'en', token: 'Estimated', digits: '8 / 11' },
    { lang: 'fr', token: 'Estimation', digits: '8 / 11' },
    { lang: 'ar', token: 'تقديريًا', digits: '8 / 11' },
  ];
  for (const { lang, token, digits } of expectedLabels) {
    globalThis.__REM_IMPL_CTX__ = baseCtx({
      language: lang,
      currentUser: makeUser({ id: 'parent-a', role: 'PARENT', linkedChildrenIds: ['child-1'] }),
      remainingParentNotesToday: 8,
      parentNotesQuotaStale: false,
      parentNotesQuotaVerified: true,
    });
    const html = withMockedNow('2026-11-15T10:00:00.000Z', () =>
      renderToStaticMarkup(React.createElement(ParentNotesPanel, { classId: 'class-1' })),
    );
    assert.ok(html.includes(token), `${lang} quota badge must clearly indicate estimate ("${token}")`);
    assert.ok(html.includes(digits), `${lang} quota badge must include "${digits}"`);
    const submitBtnTag = html.match(/<button[^>]*data-testid="parent-note-submit-btn"[^>]*>/)?.[0] ?? '';
    assert.ok(submitBtnTag.length > 0 && !submitBtnTag.includes('disabled='), `${lang} submit button must be enabled when verified`);
  }

  // 2. Post-boundary failed refresh preserves outdated prior-cycle 0 / 11 as outdated (never 11/11) and disables submit
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    language: 'en',
    currentUser: makeUser({ id: 'parent-a', role: 'PARENT', linkedChildrenIds: ['child-1'] }),
    notesStatus: 'ERROR',
    notesError: 'Boundary refresh failed',
    remainingParentNotesToday: 0,
    parentNotesQuotaStale: true,
    parentNotesQuotaVerified: false,
  });
  const outdatedHtml = withMockedNow('2026-11-15T10:00:00.000Z', () =>
    renderToStaticMarkup(React.createElement(ParentNotesPanel, { classId: 'class-1' })),
  );
  assert.ok(outdatedHtml.includes('Outdated'), 'Stale post-boundary estimate must be clearly marked Outdated');
  assert.ok(outdatedHtml.includes('0 / 11'));
  assert.ok(!outdatedHtml.includes('11 / 11'));
  assert.match(outdatedHtml, /<button[^>]*data-testid="parent-note-submit-btn"[^>]*disabled=""/);

  // 3. UNAUTHORIZED hides cached notes, shows unavailable estimate and keeps send disabled/hidden
  globalThis.__REM_IMPL_CTX__ = baseCtx({
    language: 'en',
    currentUser: makeUser({ id: 'parent-a', role: 'PARENT', linkedChildrenIds: ['child-1'] }),
    notesStatus: 'UNAUTHORIZED',
    notesError: 'Session unauthorized',
    parentNotes: [
      {
        id: 'secret-note',
        parentId: 'parent-a',
        parentName: 'Parent A',
        childId: 'child-1',
        childName: 'Lina',
        classId: 'class-1',
        topic: 'OTHER',
        content: 'Cached private note that must not appear',
        createdAt: '2026-11-15T09:00:00.000Z',
        schoolDay: '2026-11-15',
        status: 'SENT',
      },
    ],
    remainingParentNotesToday: null,
    parentNotesQuotaStale: true,
    parentNotesQuotaVerified: false,
  });
  const unauthHtml = withMockedNow('2026-11-15T10:00:00.000Z', () =>
    renderToStaticMarkup(React.createElement(ParentNotesPanel, { classId: 'class-1' })),
  );
  assert.ok(unauthHtml.includes('data-testid="parent-notes-unauthorized-state"'));
  assert.ok(!unauthHtml.includes('Cached private note that must not appear'));
  assert.ok(!unauthHtml.includes('data-testid="parent-note-submit-btn"'));
});

