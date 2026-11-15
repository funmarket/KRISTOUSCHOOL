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
  isMatchingApprovedAccountContext,
  applySingleNotificationOptimisticRead,
  applyAllNotificationsOptimisticRead,
  reconcileFailedSingleNotificationRead,
  reconcileFailedMarkAllNotificationsRead,
  mergeRefreshedNotifications,
  resolvePreferencesPersistOutcome,
  reconcileSelectedRecipientId,
} = await import('../src/lib/appStateGuards.ts');

const {
  PARENT_NOTES_DAILY_QUOTA,
  SHORT_MESSAGE_MAX_CHARS,
  isWithinParentNotesTunisWindow,
  getParentNotesQuotaDay,
  getRemainingParentNotesQuota,
  validateParentNoteSubmission,
  validateShortMessageContent,
  canParticipantMessage,
  getMonthCalendarRange,
  sortCalendarEvents,
  getEventsForCalendarDate,
  listSchoolCalendarEvents,
} = await import('../src/lib/schoolContent.ts');

const {
  canAccessAppTab,
  attemptPickupOperation,
} = await import('../src/components/homepages/homepageAccess.ts');

const require = createRequire(import.meta.url);
const tempDir = await mkdtemp(path.join(tmpdir(), 'kristou-p1-followup-'));
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
              'export const useApp = () => ({ ...globalThis.__P1_FOLLOWUP_CTX__, t: (key) => key });',
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
  { ParentNotesPanel },
  { SchoolCalendarPanel },
  { GlobalAnnouncementsCalendarView },
  { ClassCommunityView },
  { MessagesView },
  { RegistrationView },
  { DirectoryView },
  { FoodMenuView },
  { ClassesManagementView },
  { PublicHomePage },
] = await Promise.all([
  bundleComponent('../src/components/views/Shared/ParentNotesPanel.tsx', 'parent-notes-panel.cjs'),
  bundleComponent('../src/components/views/Shared/SchoolCalendarPanel.tsx', 'school-calendar-panel.cjs'),
  bundleComponent('../src/components/views/GlobalAnnouncementsCalendarView.tsx', 'global-ann-cal.cjs'),
  bundleComponent('../src/components/views/ClassCommunityView.tsx', 'class-community.cjs'),
  bundleComponent('../src/components/views/MessagesView.tsx', 'messages-view.cjs'),
  bundleComponent('../src/components/views/RegistrationView.tsx', 'registration-view.cjs'),
  bundleComponent('../src/components/views/DirectoryView.tsx', 'directory-view.cjs'),
  bundleComponent('../src/components/views/FoodMenuView.tsx', 'food-menu-view.cjs'),
  bundleComponent('../src/components/views/ClassesManagementView.tsx', 'classes-mgmt-view.cjs'),
  bundleComponent('../src/components/homepages/PublicHomePage.tsx', 'public-home.cjs'),
]);

function makeUser(overrides = {}) {
  return {
    id: 'user-parent-1',
    name: 'Amira Ben Ali',
    email: 'amira@kristou.test',
    role: 'PARENT',
    accountStatus: 'APPROVED',
    capabilities: [],
    linkedChildrenIds: ['child-1', 'child-2'],
    assignedClassIds: ['class-1'],
    ...overrides,
  };
}

function baseCtx(overrides = {}) {
  return {
    currentUser: makeUser(),
    language: 'en',
    theme: 'light',
    childrenList: [
      { id: 'child-1', fullName: 'Youssef Ben Ali', classId: 'class-1', className: 'CP-A' },
      { id: 'child-2', fullName: 'Lina Ben Ali', classId: 'class-2', className: 'CE1-B' },
    ],
    classesList: [
      { id: 'class-1', name: 'CP-A', level: 'CP', levelCode: 'CP', academicYear: '2026-2027', teacherName: 'Mme Nadia' },
      { id: 'class-2', name: 'CE1-B', level: 'CE1', levelCode: 'CE1', academicYear: '2026-2027', teacherName: 'M. Karim' },
    ],
    classRosters: [
      { id: 'class-1', name: 'CP-A', level: 'CP', levelCode: 'CP', academicYear: '2026-2027', teacherName: 'Mme Nadia', students: [] },
    ],
    parentNotes: [],
    notesStatus: 'READY',
    notesError: null,
    remainingParentNotesToday: 11,
    selectedChildId: 'child-1',
    setSelectedChildId() {},
    addParentNote: async () => ({ success: true }),
    replyParentNote: async () => ({ ok: true, status: 'READY' }),
    selectedClassId: 'class-1',
    setSelectedClassId() {},
    announcements: [],
    homeworkList: [],
    classDocuments: [],
    classGallery: [],
    classQuestions: [],
    communityStatus: 'READY',
    communityError: null,
    isLoadingClassCommunity: false,
    addClassQuestion: async () => ({ success: true }),
    replyClassQuestion: async () => ({ ok: true }),
    moderateClassQuestion: async () => ({ ok: true }),
    broadcasts: [],
    broadcastsStatus: 'READY',
    broadcastsError: null,
    calendarEvents: [],
    calendarStatus: 'READY',
    calendarError: null,
    messages: [],
    messagesStatus: 'READY',
    messagesError: null,
    enrollmentApplications: [],
    enrollmentsStatus: 'READY',
    enrollmentsError: null,
    teachers: [],
    admins: [],
    directoryStatus: 'READY',
    directoryError: null,
    foodMenu: {
      id: 'menu-1',
      weekRange: '16–20 Nov 2026',
      providerName: 'La Toque Gourmande',
      items: [],
      isDemoPreview: false,
    },
    foodMenuStatus: 'READY',
    foodMenuError: null,
    publicContent: {},
    isHydratingSchoolData: false,
    refreshSchoolData: async () => true,
    ...overrides,
  };
}

// ============================================================================
// Section 2A: Notification Rollback & Account Isolation
// ============================================================================

test('2A: concurrent single mark-read A+B (B succeeds then A fails) never reverts B or resurrects logged-out state', () => {
  const initial = [
    { id: 'notif-A', title: 'A', message: 'msg A', time: '09:00', read: false, type: 'info' },
    { id: 'notif-B', title: 'B', message: 'msg B', time: '09:01', read: false, type: 'info' },
    { id: 'notif-C', title: 'C', message: 'msg C', time: '09:02', read: false, type: 'info' },
  ];
  const originCtx = { userId: 'user-1', accountStatus: 'APPROVED', generation: 1 };

  // Start optimistic read A (seq 1) and B (seq 2)
  const snapA = {
    originUserId: 'user-1',
    originGeneration: 1,
    requestSeq: 1,
    targetIds: ['notif-A'],
    previouslyUnreadIds: ['notif-A'],
  };
  let state = applySingleNotificationOptimisticRead(initial, 'notif-A');
  state = applySingleNotificationOptimisticRead(state, 'notif-B');

  // A refresh adds notif-D while A & B are pending
  state = mergeRefreshedNotifications(
    [
      ...initial,
      { id: 'notif-D', title: 'D', message: 'added', time: '09:03', read: false, type: 'info' },
    ],
    new Set(['notif-A', 'notif-B']),
    new Map(),
  );
  assert.equal(state.find((n) => n.id === 'notif-D')?.read, false);
  assert.equal(state.find((n) => n.id === 'notif-B')?.read, true);

  // B succeeds at seq 2
  const confirmedSeq = new Map([['notif-B', 2]]);
  // A fails at seq 1: only notif-A becomes unread; B stays read; D stays preserved
  const afterAFail = reconcileFailedSingleNotificationRead(
    state,
    snapA,
    originCtx,
    confirmedSeq,
    0,
    true,
  );
  assert.equal(afterAFail.applied, true);
  assert.equal(afterAFail.notifications.find((n) => n.id === 'notif-A')?.read, false);
  assert.equal(afterAFail.notifications.find((n) => n.id === 'notif-B')?.read, true);
  assert.equal(afterAFail.notifications.find((n) => n.id === 'notif-C')?.read, false);
  assert.equal(afterAFail.notifications.find((n) => n.id === 'notif-D')?.id, 'notif-D');

  // If user logs out before A fails, reconciliation must drop and keep cleared []
  const loggedOutRes = reconcileFailedSingleNotificationRead(
    [],
    snapA,
    { userId: null, accountStatus: null, generation: 2 },
    new Map(),
    0,
    true,
  );
  assert.equal(loggedOutRes.applied, false);
  assert.deepEqual(loggedOutRes.notifications, []);

  // If account switched to another user at same or new generation, reconciliation drops
  const switchedRes = reconcileFailedSingleNotificationRead(
    [{ id: 'other-user-notif', title: 'X', message: 'Y', time: '10:00', read: false, type: 'info' }],
    snapA,
    { userId: 'user-2', accountStatus: 'APPROVED', generation: 2 },
    new Map(),
    0,
    true,
  );
  assert.equal(switchedRes.applied, false);
  assert.equal(switchedRes.notifications.length, 1);
  assert.equal(switchedRes.notifications[0].id, 'other-user-notif');
});

test('2A: mark-all optimistic read preserves concurrent single-read success and refreshed items on failure', () => {
  const initial = [
    { id: 'n1', title: '1', message: 'm1', time: '08:00', read: false, type: 'info' },
    { id: 'n2', title: '2', message: 'm2', time: '08:05', read: false, type: 'info' },
  ];
  const { nextNotifications, previouslyUnreadIds } = applyAllNotificationsOptimisticRead(initial);
  assert.deepEqual(previouslyUnreadIds, ['n1', 'n2']);
  assert.ok(nextNotifications.every((n) => n.read));

  // Concurrent refresh adds n3 (unread) while mark-all is in flight, and single read succeeds for n2 at seq 5
  const merged = mergeRefreshedNotifications(
    [
      ...initial,
      { id: 'n3', title: '3', message: 'm3', time: '08:10', read: false, type: 'info' },
    ],
    new Set(),
    new Map(),
  );
  const currentWithN2Read = merged.map((n) => (n.id === 'n1' || n.id === 'n2' ? { ...n, read: true } : n));
  const confirmedById = new Map([['n2', 5]]);

  const res = reconcileFailedMarkAllNotificationsRead(
    currentWithN2Read,
    {
      originUserId: 'user-1',
      originGeneration: 1,
      requestSeq: 4,
      targetIds: ['n1', 'n2'],
      previouslyUnreadIds,
    },
    { userId: 'user-1', accountStatus: 'APPROVED', generation: 1 },
    confirmedById,
    0,
    true,
  );

  assert.equal(res.applied, true);
  assert.equal(res.notifications.find((n) => n.id === 'n1')?.read, false, 'n1 reverts');
  assert.equal(res.notifications.find((n) => n.id === 'n2')?.read, true, 'n2 confirmed at newer seq stays read');
  assert.equal(res.notifications.find((n) => n.id === 'n3')?.id, 'n3', 'n3 added by refresh preserved');

  // Unmounted component must ignore late rejection
  assert.equal(
    isMatchingApprovedAccountContext(
      { userId: 'user-1', accountStatus: 'APPROVED', generation: 1 },
      { userId: 'user-1', accountStatus: 'APPROVED', generation: 1 },
      false,
    ),
    false,
  );
});

// ============================================================================
// Section 2C: Preferences & Recipients Guards
// ============================================================================

test('2C: resolvePreferencesPersistOutcome handles out-of-order responses, BLOCKED_BACKEND error preservation, and account switch', () => {
  const origin = { userId: 'u1', accountStatus: 'APPROVED', generation: 1 };
  const current = { userId: 'u1', accountStatus: 'APPROVED', generation: 1 };

  // Out-of-order request (seq 1 arrives when latest is seq 2)
  const stale = resolvePreferencesPersistOutcome({
    result: { ok: false, status: 'ERROR', errorMessage: 'old fail' },
    origin,
    current,
    requestSeq: 1,
    latestRequestSeq: 2,
    previousError: null,
  });
  assert.equal(stale.ignored, true);

  // Genuine save error recorded
  const genuineErr = resolvePreferencesPersistOutcome({
    result: { ok: false, status: 'ERROR', errorMessage: 'DB constraint error' },
    origin,
    current,
    requestSeq: 2,
    latestRequestSeq: 2,
    previousError: null,
  });
  assert.equal(genuineErr.ignored, false);
  assert.equal(genuineErr.syncStatus, 'ERROR');
  assert.equal(genuineErr.error, 'DB constraint error');

  // Subsequent BLOCKED_BACKEND must NOT erase genuine error
  const blockedAfterErr = resolvePreferencesPersistOutcome({
    result: { ok: false, status: 'BLOCKED_BACKEND', errorMessage: 'unavailable' },
    origin,
    current,
    requestSeq: 3,
    latestRequestSeq: 3,
    previousError: genuineErr.error,
  });
  assert.equal(blockedAfterErr.syncStatus, 'UNAVAILABLE');
  assert.equal(blockedAfterErr.error, 'DB constraint error');

  // Account switch ignores late response
  const switched = resolvePreferencesPersistOutcome({
    result: { ok: true, status: 'READY' },
    origin,
    current: { userId: 'u2', accountStatus: 'APPROVED', generation: 2 },
    requestSeq: 4,
    latestRequestSeq: 4,
    previousError: 'x',
  });
  assert.equal(switched.ignored, true);
});

test('2C: reconcileSelectedRecipientId clears stale recipients and MessagesView tracks full identityKey', () => {
  const fresh = [
    { id: 'rec-2', name: 'Teacher B', role: 'TEACHER' },
    { id: 'rec-3', name: 'Director', role: 'APP_ADMIN' },
  ];
  assert.equal(reconcileSelectedRecipientId('rec-old-account', fresh), 'rec-2');
  assert.equal(reconcileSelectedRecipientId('rec-3', fresh), 'rec-3');
  assert.equal(reconcileSelectedRecipientId('rec-2', []), '');

  const messagesSrc = fs.readFileSync(
    new URL('../src/components/views/MessagesView.tsx', import.meta.url),
    'utf8',
  );
  assert.match(messagesSrc, /identityKey\s*=\s*`\$\{currentUser\?\.id \?\? 'anon'\}::\$\{currentUser\?\.accountStatus \?\? 'none'\}`/);
  assert.match(messagesSrc, /\[identityKey,\s*isAuthorized,\s*isBackendUnauthorized,\s*currentUser\?\.accountStatus,\s*loadRecipients\]/);
});

// ============================================================================
// Section 2B: Visible Error & Unauthorized States Even With Cached Records
// ============================================================================

test('2B: ERROR and UNAUTHORIZED banners render even with cached records; UNAUTHORIZED hides private data and demoPreview never masks errors', () => {
  const cachedNote = {
    id: 'note-cached',
    parentId: 'user-parent-1',
    parentName: 'Amira',
    childId: 'child-1',
    childName: 'Youssef Ben Ali',
    classId: 'class-1',
    topic: 'ABSENCE',
    content: 'Cached confidential absence note',
    status: 'SENT',
    createdAt: '2026-11-15T09:00:00Z',
  };

  // ParentNotesPanel ERROR with cached note
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    notesStatus: 'ERROR',
    notesError: 'Network timeout refreshing notes',
    parentNotes: [cachedNote],
  });
  const notesErrHtml = renderToStaticMarkup(React.createElement(ParentNotesPanel));
  assert.ok(notesErrHtml.includes('data-testid="parent-notes-error-state"'));
  assert.ok(notesErrHtml.includes('Network timeout refreshing notes'));

  // ParentNotesPanel UNAUTHORIZED hides private cached note
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    notesStatus: 'UNAUTHORIZED',
    notesError: 'Access revoked',
    parentNotes: [cachedNote],
  });
  const notesUnauthHtml = renderToStaticMarkup(React.createElement(ParentNotesPanel));
  assert.ok(notesUnauthHtml.includes('data-testid="parent-notes-unauthorized-state"'));
  assert.ok(!notesUnauthHtml.includes('Cached confidential absence note'));

  // RegistrationView ERROR & UNAUTHORIZED with cached application
  const cachedApp = {
    id: 'app-1',
    referenceCode: 'REF-001',
    studentFullName: 'Secret Applicant',
    birthDate: '2019-01-01',
    desiredLevelCode: 'CP',
    parentFullName: 'Parent X',
    phone: '22000000',
    status: 'SUBMITTED',
    version: 1,
    createdAt: '2026-11-15T08:00:00Z',
  };
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    enrollmentsStatus: 'ERROR',
    enrollmentsError: 'Enrollments query failed',
    enrollmentApplications: [cachedApp],
  });
  const regErrHtml = renderToStaticMarkup(React.createElement(RegistrationView));
  assert.ok(regErrHtml.includes('data-testid="enrollments-error-state"'));

  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    enrollmentsStatus: 'UNAUTHORIZED',
    enrollmentsError: 'Forbidden queue',
    enrollmentApplications: [cachedApp],
  });
  const regUnauthHtml = renderToStaticMarkup(React.createElement(RegistrationView));
  assert.ok(regUnauthHtml.includes('data-testid="enrollments-unauthorized-state"'));
  assert.ok(!regUnauthHtml.includes('Secret Applicant'));

  // DirectoryView ERROR & UNAUTHORIZED must NOT show demoPreview
  const cachedTeacher = {
    id: 't-1',
    name: 'Mme Nadia',
    title: 'CP Teacher',
    photoUrl: '/assets/kristou-logo.png',
    bio: 'Bio',
    classes: ['CP-A'],
    languages: ['FR'],
    isPublished: true,
  };
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    directoryStatus: 'ERROR',
    directoryError: 'Directory error',
    teachers: [cachedTeacher],
  });
  const dirErrHtml = renderToStaticMarkup(React.createElement(DirectoryView));
  assert.ok(dirErrHtml.includes('data-testid="directory-error-banner"'));
  assert.ok(!dirErrHtml.includes('data-testid="directory-preview-badge"'));

  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    directoryStatus: 'UNAUTHORIZED',
    directoryError: 'Directory unauthorized',
    teachers: [cachedTeacher],
  });
  const dirUnauthHtml = renderToStaticMarkup(React.createElement(DirectoryView));
  assert.ok(dirUnauthHtml.includes('data-testid="directory-unauthorized-banner"'));
  assert.ok(!dirUnauthHtml.includes('Mme Nadia'));

  // FoodMenuView ERROR & UNAUTHORIZED must NOT show demoPreview even if foodMenu.isDemoPreview is true
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    foodMenuStatus: 'ERROR',
    foodMenuError: 'Menu fetch failed',
    foodMenu: { id: 'm1', weekRange: 'W1', providerName: 'La Toque', items: [{ day: 'Monday', starter: 'S', main: 'Couscous', side: 'X', dessert: 'F' }], isDemoPreview: true },
  });
  const foodErrHtml = renderToStaticMarkup(React.createElement(FoodMenuView));
  assert.ok(foodErrHtml.includes('data-testid="food-menu-error-banner"'));
  assert.ok(!foodErrHtml.includes('data-testid="food-menu-preview-badge"'));

  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    foodMenuStatus: 'UNAUTHORIZED',
    foodMenuError: 'Menu unauthorized',
    foodMenu: { id: 'm1', weekRange: 'W1', providerName: 'La Toque', items: [{ day: 'Monday', starter: 'S', main: 'SecretMenu', side: 'X', dessert: 'F' }], isDemoPreview: true },
  });
  const foodUnauthHtml = renderToStaticMarkup(React.createElement(FoodMenuView));
  assert.ok(foodUnauthHtml.includes('data-testid="food-menu-unauthorized-banner"'));
  assert.ok(!foodUnauthHtml.includes('SecretMenu'));

  // PublicHomePage ERROR must NOT show demoPreview
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    currentUser: null,
    broadcastsStatus: 'ERROR',
    broadcastsError: 'DB 500',
    foodMenuStatus: 'ERROR',
    foodMenuError: 'DB 500',
    announcements: [{ id: 'd1', title: 'Demo Item', body: 'B', priority: 'NORMAL', isDemoPreview: true, authorName: 'X', authorRole: 'Y', createdAt: '2026-11-15' }],
  });
  const pubErrHtml = renderToStaticMarkup(React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }));
  assert.ok(!pubErrHtml.includes('demoPreview'));

  // MessagesView UNAUTHORIZED & ERROR with cached threads
  const cachedThread = {
    id: 'th-1',
    subject: 'Confidential Subject',
    recipientId: 't-1',
    recipientName: 'Teacher',
    recipientRole: 'TEACHER',
    lastMessage: 'Secret message body',
    updatedAt: '2026-11-15T10:00:00Z',
    unread: false,
    messages: [{ id: 'm-1', senderId: 't-1', senderName: 'Teacher', content: 'Secret message body', createdAt: '2026-11-15T10:00:00Z' }],
  };
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    messagesStatus: 'ERROR',
    messagesError: 'Messages failed',
    messages: [cachedThread],
  });
  const msgErrHtml = renderToStaticMarkup(React.createElement(MessagesView));
  assert.ok(msgErrHtml.includes('data-testid="messages-error-state"'));

  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    messagesStatus: 'UNAUTHORIZED',
    messagesError: 'Messages denied',
    messages: [cachedThread],
  });
  const msgUnauthHtml = renderToStaticMarkup(React.createElement(MessagesView));
  assert.ok(msgUnauthHtml.includes('data-testid="messages-unauthorized-state"'));
  assert.ok(!msgUnauthHtml.includes('Secret message body'));

  // ClassesManagementView ERROR with cached classes & UNAUTHORIZED hiding cards
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    currentUser: makeUser({ role: 'APP_ADMIN' }),
  });
  const cachedClasses = [
    { id: 'c1', name: 'CP-A', level: 'CP', levelCode: 'CP', academicYear: '2026-2027', studentCount: 15 },
  ];
  const clsErrHtml = renderToStaticMarkup(
    React.createElement(ClassesManagementView, { initialClasses: cachedClasses, backendStatus: 'ERROR' }),
  );
  assert.ok(clsErrHtml.includes('data-testid="classes-error-state"'));

  const clsUnauthHtml = renderToStaticMarkup(
    React.createElement(ClassesManagementView, { initialClasses: cachedClasses, backendStatus: 'UNAUTHORIZED' }),
  );
  assert.ok(clsUnauthHtml.includes('data-testid="classes-unauthorized-state"'));
  assert.ok(!clsUnauthHtml.includes('data-testid="classes-card-grid"'));
});

// ============================================================================
// Section 4: Calendar Mechanics & Contract Fidelity
// ============================================================================

test('4: calendar month range, deterministic sorting, bounded adapter query, RSVP semantics & CANCELLED safety', async () => {
  assert.deepEqual(getMonthCalendarRange(2026, 1), { startDate: '2026-02-01', endDate: '2026-02-28' });
  assert.deepEqual(getMonthCalendarRange(2024, 1), { startDate: '2024-02-01', endDate: '2024-02-29' });

  const sorted = sortCalendarEvents([
    { id: 'e2', title: 'Afternoon Meeting', description: '', category: 'MEETING', date: '2026-11-20', isAllDay: false, startTime: '14:00', isPublic: false },
    { id: 'e1', title: 'All Day Trip', description: '', category: 'TRIP', date: '2026-11-20', isAllDay: true, isPublic: true },
    { id: 'e3', title: 'Morning Exam', description: '', category: 'EXAM', date: '2026-11-20', isAllDay: false, startTime: '08:30', isPublic: false },
  ]);
  assert.deepEqual(sorted.map((e) => e.id), ['e1', 'e3', 'e2']);

  const dayEvents = getEventsForCalendarDate(
    [
      { id: 'multi', title: 'Science Week', description: '', category: 'ACTIVITY', date: '2026-11-18', endDate: '2026-11-20', isAllDay: true, isPublic: true },
    ],
    '2026-11-19',
  );
  assert.equal(dayEvents.length, 1);

  // Verify bounded range options & error propagation
  const recorded = {};
  const mockClient = {
    from: (table) => {
      if (table === 'school_calendar_events') {
        const q = {
          select: () => q,
          order: () => q,
          lte: (col, val) => { recorded.lte = [col, val]; return q; },
          gte: (col, val) => { recorded.gte = [col, val]; return q; },
          range: async (start, end) => {
            recorded.range = [start, end];
            return {
              data: [
                { id: 'ev-1', title: 'Bounded Event', category: 'EVENT', start_date: '2026-11-15', end_date: '2026-11-15', status: 'SCHEDULED', timezone: 'Africa/Tunis' },
              ],
              error: null,
            };
          },
        };
        return q;
      }
      const rq = {
        select: () => rq,
        eq: () => rq,
        in: async (_col, ids) => {
          recorded.respIds = ids;
          return { data: [{ event_id: 'ev-1', response: 'ACKNOWLEDGED' }], error: null };
        },
      };
      return rq;
    },
  };
  const calRes = await listSchoolCalendarEvents('u-1', mockClient, {
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    limit: 100,
  });
  assert.equal(calRes.ok, true);
  assert.deepEqual(recorded.lte, ['start_date', '2026-11-30']);
  assert.deepEqual(recorded.gte, ['end_date', '2026-11-01']);
  assert.deepEqual(recorded.range, [0, 99]);
  assert.deepEqual(recorded.respIds, ['ev-1']);
  assert.equal(calRes.data[0].myResponse, 'ACKNOWLEDGED');

  // Render check: ATTENDING / ACKNOWLEDGED / DECLINED (no "Maybe" relabel), CANCELLED event hides RSVP & shows safety notice
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx();
  const calHtml = renderToStaticMarkup(
    React.createElement(SchoolCalendarPanel, {
      events: [
        { id: 'ev-open', title: 'Open House', description: 'Welcome', category: 'EVENT', date: todayTunis, endDate: todayTunis, isAllDay: true, isPublic: true, status: 'SCHEDULED', myResponse: 'ACKNOWLEDGED' },
        { id: 'ev-cancel', title: 'Cancelled Outing', description: 'Rain', category: 'TRIP', date: todayTunis, endDate: todayTunis, isAllDay: true, isPublic: false, status: 'CANCELLED', cancellationReason: 'Heavy rain' },
      ],
      backendStatus: 'READY',
      canManage: true,
      canRespond: true,
      onRefresh: async () => true,
    }),
  );
  assert.ok(calHtml.includes('Attending'));
  assert.ok(calHtml.includes('Acknowledge'));
  assert.ok(calHtml.includes('Decline'));
  assert.ok(!calHtml.includes('Maybe'), 'ACKNOWLEDGED must never be relabeled as Maybe');
  assert.ok(calHtml.includes('data-testid="calendar-event-cancelled-badge"'));
  assert.ok(calHtml.includes('does not record pupil absence, school closure, or pickup release'));
  assert.ok(calHtml.includes('data-testid="calendar-timezone-badge"'));

  // Public visitor / unapproved user cannot see RSVP buttons or Add Event
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({ currentUser: null });
  const anonCalHtml = renderToStaticMarkup(
    React.createElement(SchoolCalendarPanel, {
      events: [
        { id: 'ev-open', title: 'Open House', description: '', category: 'EVENT', date: todayTunis, isAllDay: true, isPublic: true, status: 'SCHEDULED' },
      ],
      backendStatus: 'READY',
      canManage: false,
      canRespond: false,
      onRefresh: async () => true,
    }),
  );
  assert.ok(!anonCalHtml.includes('Attending'));
  assert.ok(!anonCalHtml.includes('data-testid="calendar-add-event-btn"'));
});

// ============================================================================
// Section 5: Under-Calendar Parent Notes Rules & Isolation
// ============================================================================

test('5: Africa/Tunis [08:00, 18:00) window, 08:00 quota reset, 11/day shared cross-child quota, and validation rules', () => {
  // November in Africa/Tunis is UTC+1 year-round (no DST).
  // 07:59 Tunis == 06:59Z -> closed; 08:00 Tunis == 07:00Z -> open
  const tunis0759 = new Date('2026-11-15T06:59:59Z');
  const tunis0800 = new Date('2026-11-15T07:00:00Z');
  const tunis1759 = new Date('2026-11-15T16:59:59Z');
  const tunis1800 = new Date('2026-11-15T17:00:00Z');

  assert.equal(isWithinParentNotesTunisWindow(tunis0759), false);
  assert.equal(isWithinParentNotesTunisWindow(tunis0800), true);
  assert.equal(isWithinParentNotesTunisWindow(tunis1759), true);
  assert.equal(isWithinParentNotesTunisWindow(tunis1800), false);

  assert.equal(validateParentNoteSubmission('Hello teacher', tunis0759).errorCode, 'parent_notes_outside_window');
  assert.equal(validateParentNoteSubmission('Hello teacher', tunis1800).errorCode, 'parent_notes_outside_window');
  assert.equal(validateParentNoteSubmission('Hello teacher', tunis0800).valid, true);
  assert.equal(validateParentNoteSubmission('Hello teacher', tunis1759).valid, true);
  assert.equal(validateParentNoteSubmission('   ', tunis0800).errorCode, 'invalid_note_content');
  assert.equal(validateParentNoteSubmission('x'.repeat(1001), tunis0800).errorCode, 'invalid_note_content');
  assert.equal(validateParentNoteSubmission('x'.repeat(1000), tunis0800).valid, true);

  // 08:00 Africa/Tunis quota cycle reset:
  // A note sent on 2026-11-15 at 15:00 Tunis (14:00Z) belongs to cycle 2026-11-15.
  // At 2026-11-16 07:59 Tunis (06:59Z), the active quota day is STILL 2026-11-15!
  // At 2026-11-16 08:00 Tunis (07:00Z), the active quota day resets to 2026-11-16!
  assert.equal(getParentNotesQuotaDay(new Date('2026-11-16T06:59:00Z')), '2026-11-15');
  assert.equal(getParentNotesQuotaDay(new Date('2026-11-16T07:00:00Z')), '2026-11-16');

  // 11 notes across 2 linked children share one daily parent quota
  const notes = Array.from({ length: PARENT_NOTES_DAILY_QUOTA }, (_, idx) => ({
    id: `n-${idx}`,
    parentId: 'parent-1',
    parentName: 'Amira',
    childId: idx % 2 === 0 ? 'child-1' : 'child-2',
    childName: idx % 2 === 0 ? 'Youssef' : 'Lina',
    classId: idx % 2 === 0 ? 'class-1' : 'class-2',
    topic: 'OTHER',
    content: `Note ${idx}`,
    status: 'SENT',
    createdAt: '2026-11-15T14:00:00Z',
  }));
  assert.equal(getRemainingParentNotesQuota(notes, 'parent-1', new Date('2026-11-16T06:59:00Z')), 0);
  assert.equal(getRemainingParentNotesQuota(notes, 'parent-1', new Date('2026-11-16T07:00:00Z')), 11);

  // Strict separation from 200-char Messages & Student DM exclusion
  assert.equal(SHORT_MESSAGE_MAX_CHARS, 200);
  assert.equal(validateShortMessageContent('x'.repeat(201)).valid, false);
  assert.equal(validateShortMessageContent('x'.repeat(200)).valid, true);
  assert.equal(canParticipantMessage('STUDENT', 'TEACHER'), false);
  assert.equal(canParticipantMessage('TEACHER', 'STUDENT'), false);
  assert.equal(canParticipantMessage('PARENT', 'SCHOOL_STAFF'), false);
  assert.equal(canParticipantMessage('PARENT', 'TEACHER'), true);

  // Pickup remains safety-locked
  const pickupLock = attemptPickupOperation('RELEASE', 'child-1');
  assert.equal(pickupLock.allowed, false);
  assert.equal(pickupLock.status, 'BLOCKED_BACKEND');
});

test('5: GlobalAnnouncementsCalendarView & ClassCommunityView mount ParentNotesPanel under calendar ONLY for authorized approved roles', () => {
  const sampleNote = {
    id: 'pn-1',
    parentId: 'user-parent-1',
    parentName: 'Amira Ben Ali',
    childId: 'child-1',
    childName: 'Youssef Ben Ali',
    classId: 'class-1',
    topic: 'HEALTH',
    content: 'Allergy reminder for today',
    schoolDay: '2026-11-15',
    status: 'REPLIED',
    replyContent: 'Noted by teacher',
    repliedByName: 'Mme Nadia',
    createdAt: '2026-11-15T09:00:00Z',
  };

  // Approved PARENT on GlobalAnnouncementsCalendarView calendar subTab -> sees under-calendar ParentNotesPanel + read-only teacher tag + quota + correspondence
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    parentNotes: [sampleNote],
    remainingParentNotesToday: 9,
  });
  const globalParentHtml = renderToStaticMarkup(
    React.createElement(GlobalAnnouncementsCalendarView, { initialSubTab: 'calendar' }),
  );
  assert.ok(globalParentHtml.includes('data-testid="school-calendar-panel"'));
  assert.ok(globalParentHtml.includes('data-testid="under-calendar-parent-notes"'));
  assert.ok(globalParentHtml.includes('data-testid="parent-note-teacher-tag"'));
  assert.ok(globalParentHtml.includes('Mme Nadia'));
  assert.ok(globalParentHtml.includes('9 / 11'));
  assert.ok(globalParentHtml.includes('Allergy reminder for today'));
  assert.ok(globalParentHtml.includes('Noted by teacher'));

  // Approved PARENT on ClassCommunityView calendar subTab -> sees under-calendar ParentNotesPanel scoped to active class
  const classParentHtml = renderToStaticMarkup(
    React.createElement(ClassCommunityView, { initialSubTab: 'calendar' }),
  );
  assert.ok(classParentHtml.includes('data-testid="school-calendar-panel"'));
  assert.ok(classParentHtml.includes('data-testid="under-calendar-parent-notes"'));
  assert.ok(classParentHtml.includes('Allergy reminder for today'));

  // Approved TEACHER on ClassCommunityView calendar subTab -> sees correspondence & reply input without consuming parent quota
  globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
    currentUser: makeUser({ id: 'teacher-1', role: 'TEACHER', linkedChildrenIds: [], assignedClassIds: ['class-1'] }),
    parentNotes: [sampleNote],
  });
  const classTeacherHtml = renderToStaticMarkup(
    React.createElement(ClassCommunityView, { initialSubTab: 'calendar' }),
  );
  assert.ok(classTeacherHtml.includes('data-testid="under-calendar-parent-notes"'));
  assert.ok(classTeacherHtml.includes('Allergy reminder for today'));
  assert.ok(!classTeacherHtml.includes('data-testid="parent-notes-quota-badge"'), 'Staff replies do not show parent quota');

  // STUDENT, PENDING user, SCHOOL_STAFF, and anonymous visitor must NOT mount under-calendar Parent Notes
  for (const deniedUser of [
    null,
    makeUser({ accountStatus: 'PENDING' }),
    makeUser({ id: 'stu-1', role: 'STUDENT', linkedChildrenIds: [] }),
    makeUser({ id: 'staff-1', role: 'SCHOOL_STAFF', linkedChildrenIds: [], capabilities: ['CALENDAR_READ'] }),
  ]) {
    globalThis.__P1_FOLLOWUP_CTX__ = baseCtx({
      currentUser: deniedUser,
      parentNotes: [sampleNote],
    });
    assert.equal(canAccessAppTab(deniedUser, 'notes'), false);
    const deniedGlobalHtml = renderToStaticMarkup(
      React.createElement(GlobalAnnouncementsCalendarView, { initialSubTab: 'calendar' }),
    );
    assert.ok(!deniedGlobalHtml.includes('data-testid="under-calendar-parent-notes"'));
    assert.ok(!deniedGlobalHtml.includes('Allergy reminder for today'));

    const deniedClassHtml = renderToStaticMarkup(
      React.createElement(ClassCommunityView, { initialSubTab: 'calendar' }),
    );
    assert.ok(!deniedClassHtml.includes('data-testid="under-calendar-parent-notes"'));
    assert.ok(!deniedClassHtml.includes('Allergy reminder for today'));
  }
});
