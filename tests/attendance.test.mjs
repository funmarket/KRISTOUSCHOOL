import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React, { act } from 'react';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';

import { canAccessAppTab } from '../src/components/homepages/homepageAccess.ts';
import {
  addDaysIso,
  diffIsoDays,
  getNextTunisMidnightDelayMs,
  getTunisTodayIsoDate,
  isTeacherCorrectionWindowOpen,
  isValidIsoDate,
  isWithinAttendanceHistoryRange,
} from '../src/lib/attendance/dateUtils.ts';
import {
  applyMarkAllPresentToNotRecorded,
  buildAttendanceActorScopeKey,
  buildAttendanceEntriesPayload,
  canCallFamilyAttendanceHistory,
  canCallStaffAttendanceEndpoints,
  classifyAttendanceError,
  cloneAttendanceDraft,
  countAttendanceMarks,
  hasDirtyAttendanceDraft,
  isAttendanceAuditStateApplicable,
  isAttendanceHistoryResultApplicable,
  isAttendanceRegisterResultApplicable,
  MAX_ATTENDANCE_PATCH_ITEMS,
  MAX_ATTENDANCE_TEXT_LENGTH,
  reconcileConflictWithFreshRegister,
  resolveAttendanceAccessMode,
  resolveAttendanceSaveIntent,
  resolveRegisterActionAvailability,
} from '../src/lib/attendance/logic.ts';
globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';

const {
  parseAttendanceAuditList,
  parseAttendanceRegisterResponse,
  parseAttendanceSaveReceipt,
  parseStudentAttendanceList,
} = await import('../src/lib/attendance/api.ts');

const dom = installNodeDomShim();
const classSet = new Set();
dom.document.documentElement.classList = {
  add: (...cls) => cls.forEach((c) => classSet.add(c)),
  remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
  contains: (c) => classSet.has(c),
};
const { renderToStaticMarkup } = await import('react-dom/server');
const { createRoot } = await import('react-dom/client');

const require = createRequire(import.meta.url);
const tempDir = await mkdtemp(path.join(tmpdir(), 'kristou-attendance-'));
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
        name: 'attendance-ui-test-resolver',
        setup(builder) {
          builder.onResolve({ filter: /context\/AppContext$/ }, () => ({
            path: 'context',
            namespace: 'fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents:
              'const stableT = (key) => key;\nexport const useApp = () => ({ ...globalThis.__ATTENDANCE_CTX__, t: stableT });',
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
  { AttendanceView },
  { Navbar },
  { TeacherHomePage },
  { AdministrativePersonnelHomePage },
  { ClassesManagementView, filterSchoolClasses, filterClassRoster },
  { StudentOverviewPanel },
] = await Promise.all([
  bundleComponent('../src/components/views/AttendanceView.tsx', 'attendance-view.cjs'),
  bundleComponent('../src/components/Navbar.tsx', 'navbar.cjs'),
  bundleComponent('../src/components/homepages/TeacherHomePage.tsx', 'teacher-home.cjs'),
  bundleComponent('../src/components/homepages/AdministrativePersonnelHomePage.tsx', 'admin-personnel-home.cjs'),
  bundleComponent('../src/components/views/ClassesManagementView.tsx', 'classes-view.cjs'),
  bundleComponent('../src/components/views/Shared/StudentOverviewPanel.tsx', 'student-overview.cjs'),
]);

const UUID_CLASS_1 = '11111111-1111-4111-8111-111111111111';
const UUID_YEAR_1 = '22222222-2222-4222-8222-222222222222';
const UUID_TEACHER_1 = '33333333-3333-4333-8333-333333333333';
const UUID_REGISTER_1 = '44444444-4444-4444-8444-444444444444';
const UUID_STUDENT_1 = '55555555-5555-4555-8555-555555555551';
const UUID_STUDENT_2 = '55555555-5555-4555-8555-555555555552';
const UUID_STUDENT_3 = '55555555-5555-4555-8555-555555555553';
const UUID_MEMBERSHIP_1 = '66666666-6666-4666-8666-666666666661';
const UUID_MEMBERSHIP_2 = '66666666-6666-4666-8666-666666666662';
const UUID_MEMBERSHIP_3 = '66666666-6666-4666-8666-666666666663';
const UUID_REQUEST_1 = '77777777-7777-4777-8777-777777777771';

function makeUser(overrides = {}) {
  return {
    id: UUID_TEACHER_1,
    username: 'amel.teacher',
    fullName: 'Amel Teacher',
    role: 'TEACHER',
    accountStatus: 'APPROVED',
    assignedClassIds: [UUID_CLASS_1],
    linkedChildrenIds: [],
    capabilities: ['TEACHER'],
    ...overrides,
  };
}

function makeAppCtx(overrides = {}) {
  return {
    currentUser: makeUser(),
    language: 'en',
    setLanguage: () => {},
    theme: 'light',
    setTheme: () => {},
    logout: () => {},
    notifications: [],
    unreadNotificationCount: 0,
    markNotificationRead: async () => {},
    markAllNotificationsRead: async () => {},
    refreshSchoolData: async () => false,
    classesList: [],
    classRosters: [],
    childrenList: [],
    selectedClassId: UUID_CLASS_1,
    setSelectedClassId: () => {},
    selectedChildId: '',
    setSelectedChildId: () => {},
    isHydratingSchoolData: false,
    classesBackendStatus: 'READY',
    classesError: null,
    schoolContextError: null,
    messages: [],
    messagesStatus: 'READY',
    ...overrides,
  };
}

test('Attendance authorization matrix denies MANAGER, SCHOOL_STAFF, CLASSES_MANAGE, unapproved, and anonymous', () => {
  for (const allowedRole of ['TEACHER', 'APP_ADMIN', 'ADMINISTRATIVE_PERSONNEL', 'PARENT', 'STUDENT']) {
    const user = makeUser({ role: allowedRole, accountStatus: 'APPROVED' });
    assert.equal(canAccessAppTab(user, 'attendance'), true);
    assert.notEqual(resolveAttendanceAccessMode(user), 'UNAUTHORIZED');
  }

  for (const deniedUser of [
    null,
    makeUser({ role: 'MANAGER', capabilities: ['CLASSES_MANAGE', 'CLASSES_ROSTER_VIEW', 'FULL_ACCESS'] }),
    makeUser({ role: 'SCHOOL_STAFF', capabilities: ['CLASSES_ROSTER_VIEW', 'ANNOUNCEMENTS_PUBLISH'] }),
    makeUser({ role: 'TEACHER', accountStatus: 'PENDING' }),
    makeUser({ role: 'TEACHER', accountStatus: 'SUSPENDED' }),
    makeUser({ role: 'TEACHER', accountStatus: 'REVOKED' }),
    makeUser({ role: 'PARENT', accountStatus: 'REJECTED' }),
    makeUser({ role: 'STUDENT', accountStatus: 'PENDING' }),
    makeUser({ role: 'APP_ADMIN', accountStatus: 'SUSPENDED' }),
  ]) {
    assert.equal(canAccessAppTab(deniedUser, 'attendance'), false);
    assert.equal(resolveAttendanceAccessMode(deniedUser), 'UNAUTHORIZED');
    assert.equal(canCallStaffAttendanceEndpoints(deniedUser), false);
    assert.equal(canCallFamilyAttendanceHistory(deniedUser), false);
  }

  assert.equal(canCallStaffAttendanceEndpoints(makeUser({ role: 'PARENT' })), false);
  assert.equal(canCallStaffAttendanceEndpoints(makeUser({ role: 'STUDENT' })), false);
  assert.equal(canCallFamilyAttendanceHistory(makeUser({ role: 'PARENT' })), true);
  assert.equal(canCallFamilyAttendanceHistory(makeUser({ role: 'STUDENT' })), true);
  assert.equal(canCallFamilyAttendanceHistory(makeUser({ role: 'TEACHER' })), false);
});

test('Africa/Tunis date helpers enforce strict calendar validation, 366-day cap, and midnight cutoff', () => {
  // 2026-11-18T23:30:00Z is already 2026-11-19 00:30:00 in Africa/Tunis (UTC+1)
  const lateUtc = new Date('2026-11-18T23:30:00.000Z');
  assert.equal(getTunisTodayIsoDate(lateUtc), '2026-11-19');

  assert.equal(isValidIsoDate('2026-11-18'), true);
  assert.equal(isValidIsoDate('2024-02-29'), true);
  assert.equal(isValidIsoDate('2025-02-29'), false);
  assert.equal(isValidIsoDate('2026-02-31'), false);
  assert.equal(isValidIsoDate('2026-13-01'), false);
  assert.equal(isValidIsoDate('2026/11/18'), false);
  assert.equal(isValidIsoDate(null), false);

  assert.equal(addDaysIso('2026-11-18', -30), '2026-10-19');
  assert.equal(addDaysIso('2026-11-30', 1), '2026-12-01');
  assert.equal(diffIsoDays('2026-01-01', '2026-01-31'), 30);

  assert.equal(isWithinAttendanceHistoryRange('2026-11-18', '2026-11-18'), true);
  assert.equal(isWithinAttendanceHistoryRange('2025-11-17', '2026-11-18'), true); // exactly 366 days
  assert.equal(isWithinAttendanceHistoryRange('2025-11-16', '2026-11-18'), false); // 367 days
  assert.equal(isWithinAttendanceHistoryRange('2026-11-19', '2026-11-18'), false); // inverted

  // Teacher cutoff: end of Tunis calendar day
  assert.equal(isTeacherCorrectionWindowOpen('2026-11-18', new Date('2026-11-18T22:59:59.000Z')), true);
  assert.equal(isTeacherCorrectionWindowOpen('2026-11-18', new Date('2026-11-18T23:00:00.000Z')), false);

  const delayMs = getNextTunisMidnightDelayMs(new Date('2026-11-18T22:59:00.000Z'));
  assert.ok(delayMs >= 60_000 && delayMs <= 61_000, `Unexpected delay ms: ${delayMs}`);
});

test('Strict RPC response parsers reject malformed payloads, mismatched scopes, and invalid rows', () => {
  const validRegister = {
    registerId: null,
    academicYearId: UUID_YEAR_1,
    classId: UUID_CLASS_1,
    teacherUserId: UUID_TEACHER_1,
    schoolDate: '2026-11-18',
    status: 'DRAFT',
    version: 0,
    rosterFingerprint: 'fp-123',
    submittedAt: null,
    entries: [
      {
        studentId: UUID_STUDENT_1,
        membershipId: UUID_MEMBERSHIP_1,
        fullName: 'Ines Trabelsi',
        studentCode: 'KS-001',
        mark: null,
        internalComment: null,
      },
      {
        studentId: UUID_STUDENT_2,
        membershipId: UUID_MEMBERSHIP_2,
        fullName: 'Youssef Gharbi',
        studentCode: 'KS-002',
        mark: 'ABSENT',
        internalComment: 'Arrived with fever notice',
      },
    ],
  };

  const okReg = parseAttendanceRegisterResponse(validRegister, {
    classId: UUID_CLASS_1,
    schoolDate: '2026-11-18',
    teacherUserId: UUID_TEACHER_1,
  });
  assert.equal(okReg.ok, true);
  assert.equal(okReg.data.entries[0].internalComment, '');

  const mismatchClass = parseAttendanceRegisterResponse(validRegister, {
    classId: '99999999-9999-4999-8999-999999999999',
    schoolDate: '2026-11-18',
  });
  assert.equal(mismatchClass.ok, false);
  assert.equal(mismatchClass.errorCode, 'mismatched_register_scope');

  const mismatchTeacher = parseAttendanceRegisterResponse(validRegister, {
    classId: UUID_CLASS_1,
    schoolDate: '2026-11-18',
    teacherUserId: '99999999-9999-4999-8999-999999999999',
  });
  assert.equal(mismatchTeacher.ok, false);
  assert.equal(mismatchTeacher.errorCode, 'mismatched_teacher_scope');

  const duplicatePupil = parseAttendanceRegisterResponse(
    {
      ...validRegister,
      entries: [validRegister.entries[0], validRegister.entries[0]],
    },
    { classId: UUID_CLASS_1, schoolDate: '2026-11-18' },
  );
  assert.equal(duplicatePupil.ok, false);

  const okReceipt = parseAttendanceSaveReceipt(
    { registerId: UUID_REGISTER_1, version: 1, status: 'DRAFT', requestId: UUID_REQUEST_1 },
    UUID_REQUEST_1,
  );
  assert.equal(okReceipt.ok, true);

  const badReceiptId = parseAttendanceSaveReceipt(
    { registerId: UUID_REGISTER_1, version: 1, status: 'DRAFT', requestId: UUID_REGISTER_1 },
    UUID_REQUEST_1,
  );
  assert.equal(badReceiptId.ok, false);
  assert.equal(badReceiptId.errorCode, 'mismatched_request_receipt');

  const okHistory = parseStudentAttendanceList([
    {
      register_id: UUID_REGISTER_1,
      class_id: UUID_CLASS_1,
      teacher_user_id: UUID_TEACHER_1,
      school_date: '2026-11-18',
      mark: 'PRESENT',
    },
  ]);
  assert.equal(okHistory.ok, true);

  // Student history must NEVER accept null mark (DRAFT leaks)
  const nullMarkHistory = parseStudentAttendanceList([
    {
      register_id: UUID_REGISTER_1,
      class_id: UUID_CLASS_1,
      teacher_user_id: UUID_TEACHER_1,
      school_date: '2026-11-18',
      mark: null,
    },
  ]);
  assert.equal(nullMarkHistory.ok, false);

  const okAudit = parseAttendanceAuditList(
    [
      {
        id: 1,
        register_id: UUID_REGISTER_1,
        register_version: 2,
        responsible_teacher_user_id: UUID_TEACHER_1,
        actor_user_id: UUID_TEACHER_1,
        event_type: 'SUBMITTED_CORRECTED',
        reason: 'Parent confirmed late arrival',
        before_state: {},
        after_state: {},
        recorded_at: '2026-11-18T10:00:00Z',
      },
    ],
    UUID_REGISTER_1,
  );
  assert.equal(okAudit.ok, true);
  assert.equal(
    parseAttendanceAuditList([], UUID_REGISTER_1).ok,
    true,
  );
  assert.equal(
    parseAttendanceAuditList(
      [
        {
          id: 1,
          register_id: UUID_CLASS_1,
          register_version: 1,
          responsible_teacher_user_id: UUID_TEACHER_1,
          actor_user_id: UUID_TEACHER_1,
          event_type: 'DRAFT_CREATED',
          reason: null,
          recorded_at: '2026-11-18T10:00:00Z',
        },
      ],
      UUID_REGISTER_1,
    ).errorCode,
    'mismatched_register_scope',
  );
});

test('Draft marking, Mark all Present, explicit comment clearing, action gating, single-flight idempotency & conflict reconciliation', () => {
  const entries = [
    {
      studentId: UUID_STUDENT_1,
      membershipId: UUID_MEMBERSHIP_1,
      fullName: 'Ines Trabelsi',
      studentCode: 'KS-001',
      mark: null,
      internalComment: '',
    },
    {
      studentId: UUID_STUDENT_2,
      membershipId: UUID_MEMBERSHIP_2,
      fullName: 'Youssef Gharbi',
      studentCode: 'KS-002',
      mark: 'ABSENT',
      internalComment: 'Existing note',
    },
  ];

  // Manual edits preserve ABSENT while Not Recorded becomes PRESENT
  const markedDraft = applyMarkAllPresentToNotRecorded(entries, {});
  assert.equal(markedDraft[UUID_STUDENT_1].mark, 'PRESENT');
  assert.equal(markedDraft[UUID_STUDENT_2], undefined); // untouched ABSENT preserved

  const counts = countAttendanceMarks(entries, {});
  assert.deepEqual(counts, {
    total: 2,
    notRecorded: 1,
    present: 0,
    absent: 1,
    late: 0,
    excused: 0,
  });

  // Clearing a comment sends explicit empty string "", whereas unchanged comment omits internalComment
  const editWithClear = {
    [UUID_STUDENT_1]: { mark: 'LATE', internalComment: '' },
    [UUID_STUDENT_2]: { mark: 'EXCUSED', internalComment: '' }, // cleared 'Existing note'
  };
  assert.equal(hasDirtyAttendanceDraft(entries, editWithClear, ''), true);
  const patchRes = buildAttendanceEntriesPayload(entries, editWithClear);
  assert.equal(patchRes.ok, true);
  assert.deepEqual(patchRes.patches, [
    { studentId: UUID_STUDENT_1, mark: 'LATE' },
    { studentId: UUID_STUDENT_2, mark: 'EXCUSED', internalComment: '' },
  ]);

  // Comment > 1000 chars and > 100 entries rejected locally before RPC
  const overComment = buildAttendanceEntriesPayload(entries, {
    [UUID_STUDENT_1]: { mark: 'PRESENT', internalComment: 'x'.repeat(MAX_ATTENDANCE_TEXT_LENGTH + 1) },
  });
  assert.equal(overComment.ok, false);
  assert.equal(overComment.errorCode, 'invalid_attendance_input');

  const bigEntries = Array.from({ length: MAX_ATTENDANCE_PATCH_ITEMS + 1 }, (_, idx) => ({
    studentId: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
    membershipId: null,
    fullName: `Pupil ${idx + 1}`,
    studentCode: `KS-${idx + 1}`,
    mark: null,
    internalComment: '',
  }));
  const allMarkedBig = applyMarkAllPresentToNotRecorded(bigEntries, {});
  const tooMany = buildAttendanceEntriesPayload(bigEntries, allMarkedBig);
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.errorCode, 'max_patch_items_exceeded');

  // Action gating: Draft incomplete permits Save Draft (when dirty), blocks Submit
  const draftReg = {
    registerId: UUID_REGISTER_1,
    academicYearId: UUID_YEAR_1,
    classId: UUID_CLASS_1,
    teacherUserId: UUID_TEACHER_1,
    schoolDate: '2026-11-18',
    status: 'DRAFT',
    version: 1,
    rosterFingerprint: 'fp-1',
    submittedAt: null,
    entries,
  };
  const incompleteAvail = resolveRegisterActionAvailability({
    register: draftReg,
    accessMode: 'STAFF_TEACHER',
    draftByStudentId: { [UUID_STUDENT_2]: { mark: 'LATE', internalComment: 'Existing note' } },
    reasonText: '',
    now: new Date('2026-11-18T12:00:00Z'),
  });
  assert.equal(incompleteAvail.canSaveDraft, true);
  assert.equal(incompleteAvail.canSubmitOrCorrect, false);

  // Submitted past-date register: Teacher cutoff closed, Office still allowed with reason
  const submittedPastReg = {
    ...draftReg,
    status: 'SUBMITTED',
    entries: [
      { ...entries[0], mark: 'PRESENT' },
      { ...entries[1], mark: 'ABSENT' },
    ],
  };
  const teacherPast = resolveRegisterActionAvailability({
    register: submittedPastReg,
    accessMode: 'STAFF_TEACHER',
    draftByStudentId: { [UUID_STUDENT_1]: { mark: 'ABSENT', internalComment: '' } },
    reasonText: 'Trying late change',
    now: new Date('2026-11-18T23:05:00Z'), // past Tunis midnight
  });
  assert.equal(teacherPast.isTeacherCutoffClosed, true);
  assert.equal(teacherPast.canEditFields, false);
  assert.equal(teacherPast.canSubmitOrCorrect, false);

  const officePastNoReason = resolveRegisterActionAvailability({
    register: submittedPastReg,
    accessMode: 'STAFF_OFFICE',
    draftByStudentId: { [UUID_STUDENT_1]: { mark: 'ABSENT', internalComment: '' } },
    reasonText: '   ',
    now: new Date('2026-11-18T23:05:00Z'),
  });
  assert.equal(officePastNoReason.canEditFields, true);
  assert.equal(officePastNoReason.canSubmitOrCorrect, false);

  const officePastWithReason = resolveRegisterActionAvailability({
    register: submittedPastReg,
    accessMode: 'STAFF_OFFICE',
    draftByStudentId: { [UUID_STUDENT_1]: { mark: 'ABSENT', internalComment: '' } },
    reasonText: 'Office verified medical leave',
    now: new Date('2026-11-18T23:05:00Z'),
  });
  assert.equal(officePastWithReason.canSubmitOrCorrect, true);

  // Single-flight idempotency UUID reuse vs rotation
  let seq = 0;
  const nextUuid = () => `99999999-9999-4999-8999-${String(++seq).padStart(12, '0')}`;
  const intent1 = resolveAttendanceSaveIntent(
    null,
    {
      classId: UUID_CLASS_1,
      schoolDate: '2026-11-18',
      teacherUserId: null,
      expectedVersion: 1,
      rosterFingerprint: 'fp-1',
      submit: true,
      reason: null,
      entries: [{ studentId: UUID_STUDENT_1, mark: 'PRESENT' }],
    },
    nextUuid,
  );
  const retrySame = resolveAttendanceSaveIntent(
    intent1,
    {
      classId: UUID_CLASS_1,
      schoolDate: '2026-11-18',
      teacherUserId: null,
      expectedVersion: 1,
      rosterFingerprint: 'fp-1',
      submit: true,
      reason: null,
      entries: [{ studentId: UUID_STUDENT_1, mark: 'PRESENT' }],
    },
    nextUuid,
  );
  assert.equal(retrySame.requestId, intent1.requestId);

  const newIntentDifferentMark = resolveAttendanceSaveIntent(
    intent1,
    {
      classId: UUID_CLASS_1,
      schoolDate: '2026-11-18',
      teacherUserId: null,
      expectedVersion: 1,
      rosterFingerprint: 'fp-1',
      submit: true,
      reason: null,
      entries: [{ studentId: UUID_STUDENT_1, mark: 'ABSENT' }],
    },
    nextUuid,
  );
  assert.notEqual(newIntentDifferentMark.requestId, intent1.requestId);

  // Conflict reconciliation preserves surviving student edit, flags removed student & new student
  const freshRegister = {
    ...draftReg,
    version: 2,
    rosterFingerprint: 'fp-2',
    entries: [
      entries[0], // Ines stays
      {
        studentId: UUID_STUDENT_3,
        membershipId: UUID_MEMBERSHIP_3,
        fullName: 'Salma New',
        studentCode: 'KS-003',
        mark: null,
        internalComment: '',
      },
    ],
  };
  const reconciled = reconcileConflictWithFreshRegister(
    freshRegister,
    {
      [UUID_STUDENT_1]: { mark: 'LATE', internalComment: '' },
      [UUID_STUDENT_2]: { mark: 'EXCUSED', internalComment: 'Existing note' },
    },
    entries,
  );
  assert.deepEqual(reconciled.preservedDraftByStudentId, {
    [UUID_STUDENT_1]: { mark: 'LATE', internalComment: '' },
  });
  assert.deepEqual(reconciled.droppedStudentIds, [UUID_STUDENT_2]);
  assert.deepEqual(reconciled.addedUnmarkedStudentNames, ['Salma New']);
});

test('Async stale-completion guards and P0001/transport error classification reject stale/unauthorized data', () => {
  const scopeA = buildAttendanceActorScopeKey(makeUser({ id: 't1', assignedClassIds: ['c1'] }));
  const scopeB = buildAttendanceActorScopeKey(makeUser({ id: 't1', assignedClassIds: [] }));
  assert.notEqual(scopeA, scopeB);

  assert.equal(
    isAttendanceRegisterResultApplicable({
      isMounted: true,
      requestSeq: 2,
      currentRequestSeq: 2,
      originActorScopeKey: scopeA,
      originClassId: UUID_CLASS_1,
      originSchoolDate: '2026-11-18',
      originTeacherUserId: '',
      currentActorScopeKey: scopeA,
      currentAccessMode: 'STAFF_TEACHER',
      currentClassId: UUID_CLASS_1,
      currentSchoolDate: '2026-11-18',
      currentTeacherUserId: '',
    }),
    true,
  );

  // Mid-flight assignment revocation rejects stale register completion
  assert.equal(
    isAttendanceRegisterResultApplicable({
      isMounted: true,
      requestSeq: 2,
      currentRequestSeq: 2,
      originActorScopeKey: scopeA,
      originClassId: UUID_CLASS_1,
      originSchoolDate: '2026-11-18',
      originTeacherUserId: '',
      currentActorScopeKey: scopeB,
      currentAccessMode: 'STAFF_TEACHER',
      currentClassId: UUID_CLASS_1,
      currentSchoolDate: '2026-11-18',
      currentTeacherUserId: '',
    }),
    false,
  );

  assert.equal(
    isAttendanceHistoryResultApplicable({
      isMounted: true,
      requestSeq: 1,
      currentRequestSeq: 2,
      originActorScopeKey: scopeA,
      originStudentId: UUID_STUDENT_1,
      originFromDate: '2026-10-19',
      originToDate: '2026-11-18',
      currentActorScopeKey: scopeA,
      currentAccessAllowed: true,
      currentStudentId: UUID_STUDENT_1,
      currentFromDate: '2026-10-19',
      currentToDate: '2026-11-18',
    }),
    false,
  );

  assert.equal(
    classifyAttendanceError({ code: 'P0001', message: 'teacher_assignment_required' }, 'en').status,
    'UNAUTHORIZED',
  );
  assert.equal(
    classifyAttendanceError({ code: 'P0001', message: 'version_conflict' }, 'fr').errorCode,
    'version_conflict',
  );
  assert.equal(
    classifyAttendanceError({ code: 'P0001', message: 'attendance_correction_window_closed' }, 'ar').status,
    'ERROR',
  );
  assert.equal(
    classifyAttendanceError({ code: 'PGRST202', message: 'Could not find the function' }, 'en').status,
    'BLOCKED_BACKEND',
  );
});

test('Mounted UI checks: AttendanceView hook stability & fail-closed gating, homepages, Navbar order, Classes CTA & StudentOverview', async () => {
  // 1. AttendanceView maintains stable React hooks when identity/status transitions dynamically on the SAME root
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  try {
    const transitions = [
      makeAppCtx({ currentUser: null }),
      makeAppCtx({ currentUser: makeUser({ role: 'MANAGER', capabilities: ['CLASSES_MANAGE', 'FULL_ACCESS'] }) }),
      makeAppCtx({ currentUser: makeUser({ role: 'SCHOOL_STAFF', capabilities: ['CLASSES_ROSTER_VIEW'] }) }),
      makeAppCtx({ currentUser: makeUser({ role: 'TEACHER', accountStatus: 'PENDING' }) }),
      makeAppCtx({ currentUser: makeUser({ role: 'TEACHER', accountStatus: 'APPROVED' }) }),
      makeAppCtx({ currentUser: makeUser({ role: 'TEACHER', accountStatus: 'REVOKED' }) }),
      makeAppCtx({ currentUser: makeUser({ role: 'PARENT', linkedChildrenIds: [] }) }),
      makeAppCtx({ currentUser: makeUser({ role: 'APP_ADMIN', assignedClassIds: [] }) }),
    ];

    for (const ctx of transitions) {
      globalThis.__ATTENDANCE_CTX__ = ctx;
      await act(async () => {
        root.render(React.createElement(AttendanceView));
      });
      const authorized = canAccessAppTab(ctx.currentUser, 'attendance');
      if (authorized) {
        assert.ok(container.querySelector('[data-testid="attendance-view"]'));
      } else {
        assert.ok(container.querySelector('[data-testid="attendance-view-unauthorized"]'));
      }
    }

    // 2. AdministrativePersonnelHomePage Attendance card navigates to 'attendance' while Work Queue remains COMING_SOON
    const adminVisitedTabs = [];
    globalThis.__ATTENDANCE_CTX__ = makeAppCtx({
      currentUser: makeUser({ role: 'ADMINISTRATIVE_PERSONNEL', assignedClassIds: [] }),
    });
    await act(async () => {
      root.render(
        React.createElement(AdministrativePersonnelHomePage, {
          setActiveTab: (tab) => adminVisitedTabs.push(tab),
          onNavigateToSubTab: () => {},
        }),
      );
    });
    const officeAttCard = container.querySelector('[data-testid="shortcut-card-admin-personnel-attendance"]');
    assert.ok(officeAttCard);
    await act(async () => {
      officeAttCard.click();
    });
    assert.deepEqual(adminVisitedTabs, ['attendance']);

    const workQueueCard = container.querySelector('[data-testid="shortcut-card-admin-personnel-work-queue"]');
    assert.ok(workQueueCard);
    await act(async () => {
      workQueueCard.click();
    });
    const statusBanner = container.querySelector('[role="status"]');
    assert.ok(statusBanner);
    assert.match(statusBanner.textContent, /Coming soon/i);
    assert.deepEqual(adminVisitedTabs, ['attendance']);

    // 3. ClassesManagementView Teacher Take Attendance buttons work without altering T1 roster columns
    const openedAttendanceClassIds = [];
    const sampleClasses = [
      {
        id: UUID_CLASS_1,
        name: 'CP-A',
        level: 'CP',
        levelCode: 'CP',
        academicYear: '2026-2027',
        homeroomTeacherName: 'Amel Teacher',
        activeStudentCount: 1,
      },
    ];
    const sampleRosters = {
      [UUID_CLASS_1]: [
        {
          studentId: UUID_STUDENT_1,
          studentCode: 'KS-001',
          fullName: 'Ines Trabelsi',
          enrollmentStatus: 'ACTIVE',
          enrolledAt: '2026-09-01',
          primaryGuardianName: 'Sami Trabelsi',
        },
      ],
    };
    globalThis.__ATTENDANCE_CTX__ = makeAppCtx({ currentUser: makeUser() });
    await act(async () => {
      root.render(
        React.createElement(ClassesManagementView, {
          initialClasses: sampleClasses,
          initialRosters: sampleRosters,
          backendStatus: 'READY',
          onOpenAttendance: (id) => openedAttendanceClassIds.push(id),
        }),
      );
    });
    const takeAttendanceCardBtn = container.querySelector(`[data-testid="take-attendance-${UUID_CLASS_1}"]`);
    assert.ok(takeAttendanceCardBtn);
    await act(async () => {
      takeAttendanceCardBtn.click();
    });
    assert.deepEqual(openedAttendanceClassIds, [UUID_CLASS_1]);

    // 4. StudentOverviewPanel mounts StudentAttendanceHistoryPanel while preserving student identity UI
    globalThis.__ATTENDANCE_CTX__ = makeAppCtx({ currentUser: makeUser() });
    const overviewHtml = renderToStaticMarkup(
      React.createElement(StudentOverviewPanel, {
        student: sampleRosters[UUID_CLASS_1][0],
        schoolClass: sampleClasses[0],
        onBack: () => {},
        language: 'en',
      }),
    );
    assert.match(overviewHtml, /data-testid="student-overview-panel"/);
    assert.match(overviewHtml, /data-testid="student-overview-attendance-panel"/);

    // 5. Navbar renders attendance entry only for approved allowed roles and preserves Owner order
    globalThis.__ATTENDANCE_CTX__ = makeAppCtx({
      currentUser: makeUser({ role: 'APP_ADMIN', assignedClassIds: [] }),
    });
    await act(async () => {
      root.render(
        React.createElement(Navbar, {
          activeTab: 'home',
          setActiveTab: () => {},
          onNavigateToSubTab: () => {},
        }),
      );
    });
    const menuToggle = container.querySelector('[aria-label="account"]');
    assert.ok(menuToggle);
    await act(async () => {
      menuToggle.click();
    });
    assert.ok(container.querySelector('[data-testid="navbar-menu-attendance"]'));
    const html = container.innerHTML;
    const teachersIdx = html.indexOf('teachers');
    const classesIdx = html.indexOf('Classes');
    const regIdx = html.indexOf('registration');
    assert.ok(teachersIdx >= 0 && classesIdx > teachersIdx && regIdx > classesIdx);

    // Denied role in Navbar hides attendance item
    globalThis.__ATTENDANCE_CTX__ = makeAppCtx({
      currentUser: makeUser({ role: 'MANAGER', capabilities: ['CLASSES_MANAGE'] }),
    });
    await act(async () => {
      root.render(
        React.createElement(Navbar, {
          activeTab: 'home',
          setActiveTab: () => {},
          onNavigateToSubTab: () => {},
        }),
      );
    });
    assert.equal(container.querySelector('[data-testid="navbar-menu-attendance"]'), null);
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

async function bundleStaffRegisterPanel() {
  const outfile = path.join(tempDir, 'staff-attendance-panel-c.cjs');
  await build({
    entryPoints: [
      new URL('../src/components/views/attendance/StaffAttendanceRegisterPanel.tsx', import.meta.url).pathname,
    ],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    loader: { '.css': 'empty' },
    define: { __KRISTOU_SUPABASE_URL__: '""', __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '""' },
    plugins: [
      {
        name: 'staff-panel-test-resolver',
        setup(builder) {
          builder.onResolve({ filter: /context\/AppContext$/ }, () => ({
            path: 'context',
            namespace: 'panel-ctx-fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'panel-ctx-fixture' }, () => ({
            contents:
              'const stableT = (key) => key;\nexport const useApp = () => ({ ...globalThis.__ATTENDANCE_CTX__, t: stableT });',
          }));
          builder.onResolve({ filter: /lib\/attendance\/api$/ }, () => ({
            path: 'api',
            namespace: 'panel-api-fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'panel-api-fixture' }, () => ({
            contents: `
              export const OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT = 12;
              export const fetchAttendanceRegister = (...args) => globalThis.__STAFF_API_STUB__.fetchAttendanceRegister(...args);
              export const saveAttendanceRegister = (...args) => globalThis.__STAFF_API_STUB__.saveAttendanceRegister(...args);
              export const fetchAttendanceAudit = (...args) => globalThis.__STAFF_API_STUB__.fetchAttendanceAudit(...args);
              export const fetchOfficeAttendanceContext = (...args) => globalThis.__STAFF_API_STUB__.fetchOfficeAttendanceContext(...args);
              export const fetchOfficeSavedRegisters = (...args) => globalThis.__STAFF_API_STUB__.fetchOfficeSavedRegisters(...args);
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

async function bundleAttendanceApiWithFakeSupabase() {
  const outfile = path.join(tempDir, 'attendance-api-sb.cjs');
  await build({
    entryPoints: [new URL('../src/lib/attendance/api.ts', import.meta.url).pathname],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    define: { __KRISTOU_SUPABASE_URL__: '"https://test.supabase.co"', __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '"anon"' },
    plugins: [
      {
        name: 'attendance-api-sb-resolver',
        setup(builder) {
          builder.onResolve({ filter: /supabase(?:\.ts)?$/ }, () => ({
            path: 'supabase',
            namespace: 'sb-fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'sb-fixture' }, () => ({
            contents: `
              export const isSupabaseConfigured = true;
              export const supabase = {
                from: (table) => globalThis.__ATTENDANCE_SB_STUB__.from(table),
                rpc: (fn, args) => globalThis.__ATTENDANCE_SB_STUB__.rpc(fn, args),
              };
            `,
          }));
          builder.onResolve({ filter: /accountGovernance(?:\.ts)?$/ }, () => ({
            path: 'accountGovernance',
            namespace: 'gov-fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'gov-fixture' }, () => ({
            contents: `
              export const listAccountDirectory = (...args) => globalThis.__ATTENDANCE_SB_STUB__.listAccountDirectory(...args);
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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('C1 regression: StaffAttendanceRegisterPanel preserves marks, explicit comment-clearing, and reason across conflict + multiple failed refreshes, reconciles on retry without stale save replay, and isolates scopes', async () => {
  const { StaffAttendanceRegisterPanel } = await bundleStaffRegisterPanel();
  const today = getTunisTodayIsoDate();
  const UUID_TEACHER_2 = '33333333-3333-4333-8333-333333333344';

  const registerV1 = {
    registerId: UUID_REGISTER_1,
    academicYearId: UUID_YEAR_1,
    classId: UUID_CLASS_1,
    teacherUserId: UUID_TEACHER_1,
    schoolDate: today,
    status: 'DRAFT',
    version: 1,
    rosterFingerprint: 'fp-1',
    submittedAt: null,
    entries: [
      {
        studentId: UUID_STUDENT_1,
        membershipId: UUID_MEMBERSHIP_1,
        fullName: 'Ines Trabelsi',
        studentCode: 'KS-001',
        mark: 'PRESENT',
        internalComment: 'Old server note',
      },
      {
        studentId: UUID_STUDENT_2,
        membershipId: UUID_MEMBERSHIP_2,
        fullName: 'Youssef Gharbi',
        studentCode: 'KS-002',
        mark: null,
        internalComment: '',
      },
    ],
  };

  const registerV2 = {
    ...registerV1,
    version: 2,
    rosterFingerprint: 'fp-2',
    entries: [
      registerV1.entries[0],
      {
        studentId: UUID_STUDENT_3,
        membershipId: UUID_MEMBERSHIP_3,
        fullName: 'Salma New',
        studentCode: 'KS-003',
        mark: null,
        internalComment: '',
      },
    ],
  };

  const registerSubmittedV3 = {
    ...registerV2,
    status: 'SUBMITTED',
    version: 3,
    submittedAt: '2026-11-18T11:00:00Z',
    entries: [
      { ...registerV2.entries[0], mark: 'ABSENT', internalComment: '' },
      { ...registerV2.entries[1], mark: 'PRESENT', internalComment: '' },
    ],
  };

  const cloneReg = (reg) => ({
    ...reg,
    entries: reg.entries.map((e) => ({ ...e })),
  });

  const saveCalls = [];
  const registerQueue = [
    async () => ({ ok: true, status: 'READY', data: cloneReg(registerV1) }),
    async () => ({ ok: false, status: 'ERROR', errorCode: 'network_error', errorMessage: 'Temporary read timeout' }),
    async () => ({ ok: false, status: 'ERROR', errorCode: 'network_error', errorMessage: 'Still offline on refresh' }),
    async () => ({ ok: true, status: 'READY', data: cloneReg(registerV2) }),
    async () => ({ ok: true, status: 'READY', data: cloneReg(registerSubmittedV3) }),
    async () => ({ ok: false, status: 'ERROR', errorCode: 'network_error', errorMessage: 'Roster refresh failed' }),
    // Teacher 2 loads cleanly without Teacher 1's draft
    async () => ({ ok: true, status: 'READY', data: cloneReg({ ...registerSubmittedV3, teacherUserId: UUID_TEACHER_2 }) }),
    // Switching back to Teacher 1 starts fresh from server without reviving old draft
    async () => ({ ok: true, status: 'READY', data: cloneReg(registerSubmittedV3) }),
    async () => ({ ok: false, status: 'ERROR', errorCode: 'network_error', errorMessage: 'Second conflict refresh failed' }),
    async () => ({ ok: false, status: 'UNAUTHORIZED', errorCode: 'teacher_assignment_required', errorMessage: 'Assignment revoked' }),
  ];

  const saveQueue = [
    async () => ({ ok: false, status: 'ERROR', errorCode: 'version_conflict', errorMessage: 'Version conflict' }),
    async (payload) => ({
      ok: true,
      status: 'READY',
      data: {
        registerId: UUID_REGISTER_1,
        version: 3,
        status: 'SUBMITTED',
        requestId: payload.requestId,
      },
    }),
    async () => ({ ok: false, status: 'ERROR', errorCode: 'roster_conflict', errorMessage: 'Roster changed' }),
    async () => ({ ok: false, status: 'ERROR', errorCode: 'roster_conflict', errorMessage: 'Roster changed again' }),
  ];

  globalThis.__STAFF_API_STUB__ = {
    fetchAttendanceRegister: async () => {
      const next = registerQueue.shift();
      assert.ok(next, 'Unexpected extra fetchAttendanceRegister call');
      return next();
    },
    saveAttendanceRegister: async (payload) => {
      saveCalls.push(payload);
      const next = saveQueue.shift();
      assert.ok(next, 'Unexpected extra saveAttendanceRegister call');
      return next(payload);
    },
    fetchAttendanceAudit: async () => ({ ok: true, status: 'READY', data: [] }),
    fetchOfficeAttendanceContext: async () => ({ ok: false, status: 'UNAUTHORIZED' }),
    fetchOfficeSavedRegisters: async () => ({ ok: false, status: 'UNAUTHORIZED' }),
  };

  const teacher1Ctx = makeAppCtx({
    currentUser: makeUser({ id: UUID_TEACHER_1, role: 'TEACHER', assignedClassIds: [UUID_CLASS_1] }),
    classesList: [
      { id: UUID_CLASS_1, name: 'CP-A', level: 'CP', levelCode: 'CP', academicYear: '2026-2027' },
    ],
  });
  globalThis.__ATTENDANCE_CTX__ = teacher1Ctx;

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(React.createElement(StaffAttendanceRegisterPanel));
    });

    // Mark both pupils + explicitly clear pre-existing internalComment on student 1 ('Old server note' -> '')
    await act(async () => {
      container.querySelector(`[data-testid="mark-btn-${UUID_STUDENT_1}-ABSENT"]`).click();
      container.querySelector(`[data-testid="mark-btn-${UUID_STUDENT_2}-PRESENT"]`).click();
    });
    const commentInput = container.querySelector(`[data-testid="attendance-row-${UUID_STUDENT_1}"] input`);
    assert.ok(commentInput);
    assert.equal(commentInput.value, 'Old server note');
    await act(async () => {
      dom.setInputValue(commentInput, '');
    });

    // Click Submit -> triggers version_conflict + failed auto-refresh (#2)
    await act(async () => {
      container.querySelector('[data-testid="attendance-submit-btn"]').click();
    });
    assert.equal(saveCalls.length, 1);
    assert.equal(saveCalls[0].expectedVersion, 1);

    // Recoverable snapshot + draft (including cleared '') remain visible, error banner is shown, stale save/mark controls disabled
    const recoveryBanner = container.querySelector('[data-testid="attendance-conflict-refresh-failed-banner"]');
    assert.ok(recoveryBanner);
    assert.match(recoveryBanner.textContent, /Temporary read timeout/);
    assert.equal(container.querySelector('[data-testid="attendance-register-error"]'), null);
    assert.equal(
      container.querySelector(`[data-testid="attendance-row-badge-${UUID_STUDENT_1}"]`).textContent,
      'Absent',
    );
    assert.equal(
      container.querySelector(`[data-testid="attendance-row-${UUID_STUDENT_1}"] input`).value,
      '',
    );
    assert.equal(container.querySelector('[data-testid="attendance-save-draft-btn"]').disabled, true);
    assert.equal(container.querySelector('[data-testid="attendance-submit-btn"]').disabled, true);
    assert.equal(container.querySelector(`[data-testid="mark-btn-${UUID_STUDENT_1}-LATE"]`).disabled, true);

    // Clicking ordinary Refresh button when read fails again STILL keeps unsaved draft + cleared comment intact
    await act(async () => {
      container.querySelector('[data-testid="attendance-refresh-btn"]').click();
    });
    assert.match(
      container.querySelector('[data-testid="attendance-conflict-refresh-failed-banner"]').textContent,
      /Still offline on refresh/,
    );
    assert.equal(
      container.querySelector(`[data-testid="attendance-row-badge-${UUID_STUDENT_1}"]`).textContent,
      'Absent',
    );
    assert.equal(
      container.querySelector(`[data-testid="attendance-row-${UUID_STUDENT_1}"] input`).value,
      '',
    );

    // Retry succeeds with v2 (student 2 dropped, student 3 added unrecorded)
    await act(async () => {
      container.querySelector('[data-testid="attendance-conflict-retry-btn"]').click();
    });
    assert.equal(container.querySelector('[data-testid="attendance-conflict-refresh-failed-banner"]'), null);
    const conflictBanner = container.querySelector('[data-testid="attendance-conflict-banner"]');
    assert.ok(conflictBanner);
    assert.match(conflictBanner.textContent, /Salma New/);
    assert.match(conflictBanner.textContent, /1 pupil\(s\) removed/);
    assert.equal(
      container.querySelector(`[data-testid="attendance-row-badge-${UUID_STUDENT_1}"]`).textContent,
      'Absent',
    );
    assert.equal(
      container.querySelector(`[data-testid="attendance-row-${UUID_STUDENT_1}"] input`).value,
      '',
    );
    assert.equal(
      container.querySelector(`[data-testid="attendance-row-badge-${UUID_STUDENT_3}"]`).textContent,
      'Not Recorded',
    );
    assert.equal(container.querySelector('[data-testid="attendance-submit-btn"]').disabled, true);

    // Mark added pupil and submit cleanly with v2 / fp-2, fresh requestId, and explicit internalComment: '' clearing
    await act(async () => {
      container.querySelector(`[data-testid="mark-btn-${UUID_STUDENT_3}-PRESENT"]`).click();
    });
    await act(async () => {
      container.querySelector('[data-testid="attendance-submit-btn"]').click();
    });
    assert.equal(saveCalls.length, 2);
    assert.equal(saveCalls[1].expectedVersion, 2);
    assert.equal(saveCalls[1].rosterFingerprint, 'fp-2');
    assert.notEqual(saveCalls[1].requestId, saveCalls[0].requestId);
    const student1Patch = saveCalls[1].entries.find((e) => e.studentId === UUID_STUDENT_1);
    assert.deepEqual(student1Patch, { studentId: UUID_STUDENT_1, mark: 'ABSENT', internalComment: '' });
    assert.equal(container.querySelector('[data-testid="attendance-conflict-banner"]'), null);

    // Submitted register roster_conflict preserves correction reason across failed refresh
    await act(async () => {
      container.querySelector(`[data-testid="mark-btn-${UUID_STUDENT_1}-LATE"]`).click();
      dom.setInputValue(
        container.querySelector('[data-testid="attendance-correction-reason-input"]'),
        'Parent confirmed late bus',
      );
    });
    await act(async () => {
      container.querySelector('[data-testid="attendance-submit-btn"]').click();
    });
    assert.ok(container.querySelector('[data-testid="attendance-conflict-refresh-failed-banner"]'));
    assert.equal(
      container.querySelector('[data-testid="attendance-correction-reason-input"]').value,
      'Parent confirmed late bus',
    );
    assert.equal(container.querySelector('[data-testid="attendance-submit-btn"]').disabled, true);

    // Switching authenticated actor immediately clears Teacher 1's recoverable draft & never leaks across accounts
    globalThis.__ATTENDANCE_CTX__ = makeAppCtx({
      currentUser: makeUser({ id: UUID_TEACHER_2, username: 'other.teacher', role: 'TEACHER', assignedClassIds: [UUID_CLASS_1] }),
      classesList: [
        { id: UUID_CLASS_1, name: 'CP-A', level: 'CP', levelCode: 'CP', academicYear: '2026-2027' },
      ],
    });
    await act(async () => {
      root.render(React.createElement(StaffAttendanceRegisterPanel));
    });
    assert.equal(container.querySelector('[data-testid="attendance-conflict-refresh-failed-banner"]'), null);
    assert.equal(
      container.querySelector(`[data-testid="attendance-row-badge-${UUID_STUDENT_1}"]`).textContent,
      'Absent',
    );
    assert.equal(container.querySelector('[data-testid="attendance-correction-reason-input"]').value, '');

    // Switching back to Teacher 1 starts clean; triggering conflict + UNAUTHORIZED retry fails closed and drops private snapshot
    globalThis.__ATTENDANCE_CTX__ = teacher1Ctx;
    await act(async () => {
      root.render(React.createElement(StaffAttendanceRegisterPanel));
    });
    await act(async () => {
      container.querySelector(`[data-testid="mark-btn-${UUID_STUDENT_1}-LATE"]`).click();
      dom.setInputValue(
        container.querySelector('[data-testid="attendance-correction-reason-input"]'),
        'Retry auth loss check',
      );
    });
    await act(async () => {
      container.querySelector('[data-testid="attendance-submit-btn"]').click();
    });
    assert.ok(container.querySelector('[data-testid="attendance-conflict-refresh-failed-banner"]'));
    await act(async () => {
      container.querySelector('[data-testid="attendance-conflict-retry-btn"]').click();
    });
    assert.ok(container.querySelector('[data-testid="attendance-register-unauthorized"]'));
    assert.equal(container.querySelector('[data-testid="attendance-conflict-refresh-failed-banner"]'), null);
    assert.equal(container.querySelector(`[data-testid="attendance-row-${UUID_STUDENT_1}"]`), null);
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

test('C2 regression: Audit trail enforces synchronous registerId & actorScopeKey match, blocks cross-register / late audit leaks, hides on permission change, and supports refresh', async () => {
  const REG_A = 'aaaa1111-1111-4111-8111-111111111111';
  const REG_B = 'bbbb2222-2222-4222-8222-222222222222';
  const today = getTunisTodayIsoDate();

  assert.equal(
    isAttendanceAuditStateApplicable({
      actorScopeKey: 'scope-1',
      visibleRegisterId: REG_A,
      auditActorScopeKey: 'scope-1',
      auditRegisterId: REG_A,
    }),
    true,
  );
  assert.equal(
    isAttendanceAuditStateApplicable({
      actorScopeKey: 'scope-1',
      visibleRegisterId: REG_B,
      auditActorScopeKey: 'scope-1',
      auditRegisterId: REG_A,
    }),
    false,
  );
  assert.equal(
    isAttendanceAuditStateApplicable({
      actorScopeKey: 'scope-2',
      visibleRegisterId: REG_A,
      auditActorScopeKey: 'scope-1',
      auditRegisterId: REG_A,
    }),
    false,
  );
  assert.equal(
    isAttendanceAuditStateApplicable({
      actorScopeKey: 'scope-1',
      visibleRegisterId: null,
      auditActorScopeKey: 'scope-1',
      auditRegisterId: REG_A,
    }),
    false,
  );

  const { StaffAttendanceRegisterPanel } = await bundleStaffRegisterPanel();

  const makeReg = (registerId, schoolDate) => ({
    registerId,
    academicYearId: UUID_YEAR_1,
    classId: UUID_CLASS_1,
    teacherUserId: UUID_TEACHER_1,
    schoolDate,
    status: 'SUBMITTED',
    version: 2,
    rosterFingerprint: `fp-${registerId}`,
    submittedAt: `${schoolDate}T10:00:00Z`,
    entries: [
      {
        studentId: UUID_STUDENT_1,
        membershipId: UUID_MEMBERSHIP_1,
        fullName: 'Ines Trabelsi',
        studentCode: 'KS-001',
        mark: 'PRESENT',
        internalComment: '',
      },
    ],
  });

  const auditADeferred1 = createDeferred();
  const auditBDeferred = createDeferred();
  let regAAuditCount = 0;
  let regBAuditCount = 0;

  globalThis.__STAFF_API_STUB__ = {
    fetchAttendanceRegister: async ({ schoolDate }) => ({
      ok: true,
      status: 'READY',
      data: makeReg(schoolDate === today ? REG_A : REG_B, schoolDate),
    }),
    saveAttendanceRegister: async () => ({ ok: false, status: 'ERROR', errorMessage: 'unused' }),
    fetchAttendanceAudit: async ({ registerId }) => {
      if (registerId === REG_A) {
        regAAuditCount += 1;
        if (regAAuditCount === 1) {
          return {
            ok: true,
            status: 'READY',
            data: [
              {
                id: 1,
                registerId: REG_A,
                registerVersion: 2,
                responsibleTeacherUserId: UUID_TEACHER_1,
                actorUserId: UUID_TEACHER_1,
                eventType: 'SUBMITTED_CORRECTED',
                reason: 'Audit Event A Loaded',
                recordedAt: '2026-11-18T10:00:00Z',
              },
            ],
          };
        }
        return auditADeferred1.promise;
      }
      regBAuditCount += 1;
      if (regBAuditCount === 1) {
        return auditBDeferred.promise;
      }
      return {
        ok: true,
        status: 'READY',
        data: [
          {
            id: 3,
            registerId: REG_B,
            registerVersion: 3,
            responsibleTeacherUserId: UUID_TEACHER_1,
            actorUserId: UUID_TEACHER_1,
            eventType: 'SUBMITTED_CORRECTED',
            reason: 'Audit Event B Refreshed',
            recordedAt: '2026-11-10T11:00:00Z',
          },
        ],
      };
    },
    fetchOfficeAttendanceContext: async () => ({ ok: false, status: 'UNAUTHORIZED' }),
    fetchOfficeSavedRegisters: async () => ({ ok: false, status: 'UNAUTHORIZED' }),
  };

  globalThis.__ATTENDANCE_CTX__ = makeAppCtx({
    currentUser: makeUser({ role: 'TEACHER', assignedClassIds: [UUID_CLASS_1] }),
    classesList: [
      { id: UUID_CLASS_1, name: 'CP-A', level: 'CP', levelCode: 'CP', academicYear: '2026-2027' },
    ],
  });

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(React.createElement(StaffAttendanceRegisterPanel));
    });

    // 1. Open audit panel on Register A and verify Audit Event A Loaded renders
    await act(async () => {
      container.querySelector('[data-testid="attendance-toggle-audit-btn"]').click();
    });
    assert.match(container.querySelector('[data-testid="attendance-audit-panel"]').textContent, /Audit Event A Loaded/);

    // Trigger an additional pending audit refresh on Register A before switching to Register B
    await act(async () => {
      const auditButtons = container.querySelectorAll('[data-testid="attendance-audit-panel"] button');
      auditButtons[0].click();
    });

    // 2. Switch date to Register B while Register A's second request and Register B's request are pending
    await act(async () => {
      dom.setInputValue(container.querySelector('[data-testid="attendance-school-date-input"]'), '2026-11-10');
    });

    // 3. A's entries are never displayed under B
    const auditPanelDuringLoad = container.querySelector('[data-testid="attendance-audit-panel"]');
    assert.ok(auditPanelDuringLoad);
    assert.ok(container.querySelector('[data-testid="attendance-audit-loading"]'));
    assert.doesNotMatch(auditPanelDuringLoad.textContent, /Audit Event A Loaded/);

    // 5. Delayed response from A cannot overwrite B
    await act(async () => {
      auditADeferred1.resolve({
        ok: true,
        status: 'READY',
        data: [
          {
            id: 99,
            registerId: REG_A,
            registerVersion: 3,
            responsibleTeacherUserId: UUID_TEACHER_1,
            actorUserId: UUID_TEACHER_1,
            eventType: 'SUBMITTED_CORRECTED',
            reason: 'Late Stale Event A',
            recordedAt: '2026-11-18T12:00:00Z',
          },
        ],
      });
    });
    assert.doesNotMatch(container.textContent, /Late Stale Event A/);
    assert.ok(container.querySelector('[data-testid="attendance-audit-loading"]'));

    // 4. B's audit response arrives and displays correctly
    await act(async () => {
      auditBDeferred.resolve({
        ok: true,
        status: 'READY',
        data: [
          {
            id: 2,
            registerId: REG_B,
            registerVersion: 2,
            responsibleTeacherUserId: UUID_TEACHER_1,
            actorUserId: UUID_TEACHER_1,
            eventType: 'SUBMITTED_CORRECTED',
            reason: 'Audit Event B Verified',
            recordedAt: '2026-11-10T10:00:00Z',
          },
        ],
      });
    });
    const auditPanelReady = container.querySelector('[data-testid="attendance-audit-panel"]');
    assert.match(auditPanelReady.textContent, /Audit Event B Verified/);
    assert.doesNotMatch(auditPanelReady.textContent, /Audit Event A Loaded/);
    assert.doesNotMatch(auditPanelReady.textContent, /Late Stale Event A/);

    // 7. Refreshing current register's audit history works
    await act(async () => {
      const auditButtons = container.querySelectorAll('[data-testid="attendance-audit-panel"] button');
      auditButtons[0].click();
    });
    assert.match(container.querySelector('[data-testid="attendance-audit-panel"]').textContent, /Audit Event B Refreshed/);

    // 6. Actor/permission change immediately hides previously loaded audit data
    globalThis.__ATTENDANCE_CTX__ = makeAppCtx({
      currentUser: makeUser({ role: 'TEACHER', accountStatus: 'REVOKED', assignedClassIds: [] }),
      classesList: [],
    });
    await act(async () => {
      root.render(React.createElement(StaffAttendanceRegisterPanel));
    });
    assert.ok(container.querySelector('[data-testid="staff-attendance-unauthorized"]'));
    assert.doesNotMatch(container.textContent, /Audit Event B Refreshed/);
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});

test('C3 regression: Real Office API & panel discover >200 historical registers deterministically, surface partial-page failures, enforce role boundaries, and preserve revoked-teacher registers', async () => {
  const apiMod = await bundleAttendanceApiWithFakeSupabase();
  const { StaffAttendanceRegisterPanel } = await bundleStaffRegisterPanel();

  const UUID_CLASS_2 = '11111111-1111-4111-8111-111111111112';
  const UUID_TEACHER_REVOKED = '33333333-3333-4333-8333-333333333399';
  const TOTAL_REGISTERS = 235;
  const today = getTunisTodayIsoDate();

  const pad = (n) => String(n).padStart(12, '0');
  const seededRegisters = Array.from({ length: TOTAL_REGISTERS }, (_, idx) => {
    // 235 chronological dates from 2026-01-01 upward; oldest indices (idx 0..19) belong to REVOKED teacher on class 1
    const base = new Date(Date.UTC(2026, 0, 1 + idx));
    const school_date = base.toISOString().slice(0, 10);
    const isOldRevoked = idx < 20;
    const class_id = isOldRevoked || idx % 2 === 0 ? UUID_CLASS_1 : UUID_CLASS_2;
    const teacher_user_id = isOldRevoked ? UUID_TEACHER_REVOKED : UUID_TEACHER_1;
    return {
      id: `88888888-8888-4888-8888-${pad(idx + 1)}`,
      class_id,
      teacher_user_id,
      school_date,
      status: 'SUBMITTED',
      version: 1,
      submitted_at: `${school_date}T15:00:00Z`,
    };
  });

  let failAttendancePageAtOffset = null;

  const makeQueryBuilder = (table) => {
    const state = {
      filters: [],
      orders: [],
      rangeFrom: null,
      rangeTo: null,
      countExact: false,
    };
    const execute = async () => {
      if (table === 'school_classes') {
        return {
          data: [
            {
              id: UUID_CLASS_1,
              name: 'CP-A',
              level_code: 'CP',
              is_archived: false,
              academic_years: { code: '2025-2026' },
              school_levels: { label_ar: 'CP', label_fr: 'CP', label_en: 'CP' },
            },
            {
              id: UUID_CLASS_2,
              name: 'CE1-A',
              level_code: 'CE1',
              is_archived: false,
              academic_years: { code: '2025-2026' },
              school_levels: { label_ar: 'CE1', label_fr: 'CE1', label_en: 'CE1' },
            },
          ],
          error: null,
        };
      }
      if (table === 'teacher_class_assignments') {
        // Note: REVOKED teacher has NO active assignment row here
        return {
          data: [{ class_id: UUID_CLASS_1, teacher_user_id: UUID_TEACHER_1, is_homeroom: true, active: true }],
          error: null,
        };
      }
      if (table === 'attendance_registers') {
        if (failAttendancePageAtOffset !== null && state.rangeFrom === failAttendancePageAtOffset) {
          return { data: null, error: { code: 'PGRST000', message: 'Simulated page 2 read timeout' }, count: null };
        }
        let rows = [...seededRegisters];
        for (const f of state.filters) {
          if (f.op === 'eq') rows = rows.filter((r) => r[f.col] === f.val);
          if (f.op === 'gte') rows = rows.filter((r) => r[f.col] >= f.val);
          if (f.op === 'lte') rows = rows.filter((r) => r[f.col] <= f.val);
        }
        rows.sort((a, b) => {
          if (a.school_date !== b.school_date) return b.school_date.localeCompare(a.school_date);
          return b.id.localeCompare(a.id);
        });
        const total = rows.length;
        const sliced =
          state.rangeFrom !== null && state.rangeTo !== null
            ? rows.slice(state.rangeFrom, state.rangeTo + 1)
            : rows;
        return {
          data: sliced,
          error: null,
          count: state.countExact ? total : null,
        };
      }
      return { data: [], error: null };
    };

    const builder = {
      select(_cols, opts) {
        if (opts?.count === 'exact') state.countExact = true;
        return builder;
      },
      eq(col, val) {
        state.filters.push({ op: 'eq', col, val });
        return builder;
      },
      gte(col, val) {
        state.filters.push({ op: 'gte', col, val });
        return builder;
      },
      lte(col, val) {
        state.filters.push({ op: 'lte', col, val });
        return builder;
      },
      order(col, opts) {
        state.orders.push({ col, opts });
        return builder;
      },
      range(from, to) {
        state.rangeFrom = from;
        state.rangeTo = to;
        return execute();
      },
      then(onFulfilled, onRejected) {
        return execute().then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  globalThis.__ATTENDANCE_SB_STUB__ = {
    from: makeQueryBuilder,
    rpc: async () => ({ data: null, error: null }),
    listAccountDirectory: async () => ({
      ok: true,
      status: 'READY',
      data: {
        items: [
          {
            id: UUID_TEACHER_1,
            fullName: 'Amel Teacher',
            username: 'amel.teacher',
            accountStatus: 'APPROVED',
            activeRoles: ['TEACHER'],
            requestedRole: 'TEACHER',
          },
          {
            id: UUID_TEACHER_REVOKED,
            fullName: 'Karim Former Teacher',
            username: 'karim.former',
            accountStatus: 'REVOKED',
            activeRoles: [],
            requestedRole: 'TEACHER',
          },
        ],
        totalCount: 2,
      },
    }),
  };

  // 1 & 2 & 3. fetchOfficeAttendanceContext paginates past 200 rows in deterministic order without duplicates/gaps
  const expectedOrderedIds = [...seededRegisters]
    .sort((a, b) => (a.school_date !== b.school_date ? b.school_date.localeCompare(a.school_date) : b.id.localeCompare(a.id)))
    .map((r) => r.id);

  const ctxRes = await apiMod.fetchOfficeAttendanceContext('en');
  assert.equal(ctxRes.ok, true);
  assert.equal(ctxRes.data.savedRegisters.length, TOTAL_REGISTERS);
  assert.equal(ctxRes.data.totalSavedRegistersCount, TOTAL_REGISTERS);
  assert.equal(ctxRes.data.hasMoreSavedRegisters, false);
  const actualOrderedIds = ctxRes.data.savedRegisters.map((r) => r.registerId);
  assert.equal(new Set(actualOrderedIds).size, TOTAL_REGISTERS);
  assert.deepEqual(actualOrderedIds, expectedOrderedIds);
  // Register #235 in descending order corresponds to index 0 (2026-01-01, past the 200-row mark)
  assert.equal(ctxRes.data.savedRegisters[234].schoolDate, '2026-01-01');

  // 4. REVOKED former teacher with saved registers remains discoverable
  const revokedOpt = ctxRes.data.teachers.find((t) => t.userId === UUID_TEACHER_REVOKED);
  assert.ok(revokedOpt);
  assert.equal(revokedOpt.accountStatus, 'REVOKED');
  assert.equal(revokedOpt.hasSavedRegisterInClass[UUID_CLASS_1], true);

  // Bounded cap sets explicit truncation metadata (never silent)
  const boundedCtxRes = await apiMod.fetchOfficeAttendanceContext('en', {
    pageSize: 100,
    maxRegisters: 210,
  });
  assert.equal(boundedCtxRes.ok, true);
  assert.equal(boundedCtxRes.data.savedRegisters.length, 210);
  assert.equal(boundedCtxRes.data.totalSavedRegistersCount, TOTAL_REGISTERS);
  assert.equal(boundedCtxRes.data.hasMoreSavedRegisters, true);

  // 5. Partial-page failure on page 2 fails explicitly instead of returning truncated page 1 as complete
  failAttendancePageAtOffset = 200;
  const partialFailRes = await apiMod.fetchOfficeAttendanceContext('en');
  assert.equal(partialFailRes.ok, false);
  assert.equal(partialFailRes.status, 'ERROR');
  failAttendancePageAtOffset = null;

  // Deterministic multi-page traversal across all 235 registers via fetchOfficeSavedRegisters
  const pagedCollectedIds = [];
  let pageOffset = 0;
  while (true) {
    const p = await apiMod.fetchOfficeSavedRegisters({ limit: 50, offset: pageOffset, language: 'en' });
    assert.equal(p.ok, true);
    pagedCollectedIds.push(...p.data.items.map((r) => r.registerId));
    if (!p.data.hasMore) break;
    pageOffset += 50;
  }
  assert.equal(new Set(pagedCollectedIds).size, TOTAL_REGISTERS);
  assert.deepEqual(pagedCollectedIds, expectedOrderedIds);

  // Server-side filtered pagination reaches oldest REVOKED teacher register (#1 on 2026-01-01)
  const oldestPage = await apiMod.fetchOfficeSavedRegisters({
    classId: UUID_CLASS_1,
    teacherUserId: UUID_TEACHER_REVOKED,
    fromDate: '2026-01-01',
    toDate: '2026-01-20',
    limit: 12,
    offset: 12,
    language: 'en',
  });
  assert.equal(oldestPage.ok, true);
  assert.equal(oldestPage.data.totalCount, 20);
  assert.equal(oldestPage.data.hasMore, false);
  assert.equal(oldestPage.data.items.length, 8);
  assert.equal(oldestPage.data.items[oldestPage.data.items.length - 1].schoolDate, '2026-01-01');

  const invertedDates = await apiMod.fetchOfficeSavedRegisters({
    classId: UUID_CLASS_1,
    fromDate: '2026-02-01',
    toDate: '2026-01-01',
    language: 'en',
  });
  assert.equal(invertedDates.ok, false);
  assert.equal(invertedDates.errorCode, 'invalid_attendance_date');

  // 6. Unauthorized roles (including MANAGER with generic class permissions, revoked Office, Parent, Student) never call Office APIs
  let officeApiTouchCount = 0;
  globalThis.__STAFF_API_STUB__ = {
    fetchOfficeAttendanceContext: async () => {
      officeApiTouchCount += 1;
      return { ok: false, status: 'UNAUTHORIZED' };
    },
    fetchOfficeSavedRegisters: async () => {
      officeApiTouchCount += 1;
      return { ok: false, status: 'UNAUTHORIZED' };
    },
    fetchAttendanceRegister: async () => ({ ok: false, status: 'UNAUTHORIZED' }),
    saveAttendanceRegister: async () => ({ ok: false, status: 'UNAUTHORIZED' }),
    fetchAttendanceAudit: async () => ({ ok: false, status: 'UNAUTHORIZED' }),
  };

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  try {
    for (const deniedUser of [
      makeUser({ role: 'MANAGER', capabilities: ['CLASSES_MANAGE', 'CLASSES_ROSTER_VIEW', 'FULL_ACCESS'] }),
      makeUser({ role: 'ADMINISTRATIVE_PERSONNEL', accountStatus: 'SUSPENDED', assignedClassIds: [] }),
      makeUser({ role: 'PARENT', assignedClassIds: [] }),
      makeUser({ role: 'STUDENT', assignedClassIds: [] }),
    ]) {
      globalThis.__ATTENDANCE_CTX__ = makeAppCtx({ currentUser: deniedUser });
      await act(async () => {
        root.render(React.createElement(StaffAttendanceRegisterPanel));
      });
      assert.ok(container.querySelector('[data-testid="staff-attendance-unauthorized"]'));
    }
    assert.equal(officeApiTouchCount, 0);

    // 7. Authorized ADMINISTRATIVE_PERSONNEL & APP_ADMIN load today's register, browse >200 historical/revoked-teacher registers, and see explicit page errors
    const registerCalls = [];
    const historyCalls = [];
    let simulateSavedPageError = false;
    globalThis.__STAFF_API_STUB__ = {
      fetchOfficeAttendanceContext: async () => ({
        ...ctxRes,
        data: {
          ...ctxRes.data,
          savedRegisters: ctxRes.data.savedRegisters.slice(0, 210),
          hasMoreSavedRegisters: true,
        },
      }),
      fetchOfficeSavedRegisters: async (params) => {
        historyCalls.push(params);
        if (simulateSavedPageError) {
          return { ok: false, status: 'ERROR', errorCode: 'page_error', errorMessage: 'Page 2 network error' };
        }
        return apiMod.fetchOfficeSavedRegisters(params);
      },
      fetchAttendanceRegister: async (params) => {
        registerCalls.push(params);
        return {
          ok: true,
          status: 'READY',
          data: {
            registerId: `99999999-9999-4999-8999-${pad(registerCalls.length)}`,
            academicYearId: UUID_YEAR_1,
            classId: params.classId,
            teacherUserId: params.teacherUserId || UUID_TEACHER_1,
            schoolDate: params.schoolDate,
            status: 'SUBMITTED',
            version: 1,
            rosterFingerprint: 'fp-hist',
            submittedAt: `${params.schoolDate}T15:00:00Z`,
            entries: [
              {
                studentId: UUID_STUDENT_1,
                membershipId: UUID_MEMBERSHIP_1,
                fullName: 'Ines Trabelsi',
                studentCode: 'KS-001',
                mark: 'PRESENT',
                internalComment: '',
              },
            ],
          },
        };
      },
      saveAttendanceRegister: async () => ({ ok: false, status: 'ERROR', errorMessage: 'unused' }),
      fetchAttendanceAudit: async () => ({ ok: true, status: 'READY', data: [] }),
    };

    globalThis.__ATTENDANCE_CTX__ = makeAppCtx({
      currentUser: makeUser({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        role: 'ADMINISTRATIVE_PERSONNEL',
        fullName: 'School Secretary',
        assignedClassIds: [],
        capabilities: ['ATTENDANCE_OFFICE'],
      }),
    });

    await act(async () => {
      root.render(React.createElement(StaffAttendanceRegisterPanel));
    });

    // Current-day register loads cleanly on mount
    assert.ok(registerCalls.length >= 1);
    assert.equal(registerCalls[0].schoolDate, today);
    assert.ok(container.querySelector('[data-testid="office-historical-registers-panel"]'));
    assert.ok(container.querySelector('[data-testid="office-registers-bounded-notice"]'));

    // Filter historical list by REVOKED teacher
    await act(async () => {
      dom.setInputValue(
        container.querySelector('[data-testid="office-history-teacher-filter"]'),
        UUID_TEACHER_REVOKED,
      );
    });
    assert.equal(container.querySelector('[data-testid="office-registers-range-label"]').textContent, '1–12 / 20');

    // Simulate page 2 fetch failure -> renders explicit office-registers-error, then Retry recovers page 2
    simulateSavedPageError = true;
    await act(async () => {
      container.querySelector('[data-testid="office-registers-next-btn"]').click();
    });
    const pageErrEl = container.querySelector('[data-testid="office-registers-error"]');
    assert.ok(pageErrEl);
    assert.match(pageErrEl.textContent, /Page 2 network error/);

    simulateSavedPageError = false;
    await act(async () => {
      pageErrEl.querySelector('button').click();
    });
    assert.equal(container.querySelector('[data-testid="office-registers-range-label"]').textContent, '13–20 / 20');

    const oldestRegId = seededRegisters[0].id;
    const oldestBtn = container.querySelector(`[data-testid="office-saved-register-${oldestRegId}"]`);
    assert.ok(oldestBtn);
    await act(async () => {
      oldestBtn.click();
    });

    const lastRegCall = registerCalls[registerCalls.length - 1];
    assert.equal(lastRegCall.classId, UUID_CLASS_1);
    assert.equal(lastRegCall.teacherUserId, UUID_TEACHER_REVOKED);
    assert.equal(lastRegCall.schoolDate, '2026-01-01');
    assert.ok(historyCalls.some((c) => c.teacherUserId === UUID_TEACHER_REVOKED && c.offset === 12));
  } finally {
    await act(async () => root.unmount());
    dom.document.body.removeChild(container);
  }
});




