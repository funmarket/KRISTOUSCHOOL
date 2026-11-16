import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveStudentOverviewSelection, formatSafeEnrollmentDate } from '../src/lib/classes/studentOverview.ts';

test('Teacher T2 Student Overview Selection & Authorization Rules (Delta Corrections)', () => {
  const sampleClass = {
    id: 'class-1',
    name: 'CP-A',
    level: 'CP',
    academicYear: '2026-2027',
    homeroomTeacherName: 'Mme Nadia',
    activeStudentCount: 1,
    roomLabel: 'Room 101',
  };

  const sampleStudent = {
    studentId: 'stud-1',
    studentCode: 'KS-2026-001',
    fullName: 'Youssef Ben Ali',
    enrollmentStatus: 'ACTIVE',
    enrolledAt: '2026-09-01',
    primaryGuardianName: 'Amine Ben Ali',
  };

  const rosters = {
    'class-1': [sampleStudent],
  };
  const classes = [sampleClass];

  const teacherUserA = {
    id: 't-1',
    role: 'TEACHER',
    accountStatus: 'APPROVED',
    assignedClassIds: ['class-1'],
  };

  // 1. Valid selection with matching actor ID and READY backend status succeeds
  const resValid = resolveStudentOverviewSelection({
    currentUser: teacherUserA,
    selectedClassId: 'class-1',
    selectedStudentId: 'stud-1',
    selectionActorId: 't-1',
    classes,
    rosters,
    backendStatus: 'READY',
  });
  assert.equal(resValid.allowed, true);
  assert.equal(resValid.schoolClass?.id, 'class-1');
  assert.equal(resValid.student?.studentId, 'stud-1');

  // 2. Missing/null values or non-READY backend status deny access
  const resNotReady = resolveStudentOverviewSelection({
    currentUser: teacherUserA,
    selectedClassId: 'class-1',
    selectedStudentId: 'stud-1',
    selectionActorId: 't-1',
    classes,
    rosters,
    backendStatus: 'LOADING',
  });
  assert.equal(resNotReady.allowed, false);

  const resMissingActor = resolveStudentOverviewSelection({
    currentUser: teacherUserA,
    selectedClassId: 'class-1',
    selectedStudentId: 'stud-1',
    selectionActorId: null,
    classes,
    rosters,
    backendStatus: 'READY',
  });
  assert.equal(resMissingActor.allowed, false);

  // 3. Account B with same class and student IDs as account A is rejected if actor ID mismatches
  const teacherUserB = {
    id: 't-2',
    role: 'TEACHER',
    accountStatus: 'APPROVED',
    assignedClassIds: ['class-1'],
  };
  const resActorMismatch = resolveStudentOverviewSelection({
    currentUser: teacherUserB,
    selectedClassId: 'class-1',
    selectedStudentId: 'stud-1',
    selectionActorId: 't-1', // Opened by t-1, viewed by t-2
    classes,
    rosters,
    backendStatus: 'READY',
  });
  assert.equal(resActorMismatch.allowed, false);

  // 4. Temporary loading (roster not an array) vs confirmed removal (empty roster)
  const resLoadingRoster = resolveStudentOverviewSelection({
    currentUser: teacherUserA,
    selectedClassId: 'class-1',
    selectedStudentId: 'stud-1',
    selectionActorId: 't-1',
    classes,
    rosters: { 'class-1': undefined },
    backendStatus: 'READY',
  });
  assert.equal(resLoadingRoster.allowed, false);

  const resRemovedStudent = resolveStudentOverviewSelection({
    currentUser: teacherUserA,
    selectedClassId: 'class-1',
    selectedStudentId: 'stud-1',
    selectionActorId: 't-1',
    classes,
    rosters: { 'class-1': [] }, // confirmed removal
    backendStatus: 'READY',
  });
  assert.equal(resRemovedStudent.allowed, false);

  // 5. Date-only calendar component validation before formatting (impossible dates return fallback)
  assert.equal(formatSafeEnrollmentDate('2026-09-01', 'en'), 'September 1, 2026');
  assert.equal(formatSafeEnrollmentDate('2026-02-31', 'en'), '2026-02-31'); // Impossible date returned as honest fallback
  assert.equal(formatSafeEnrollmentDate('malformed-date', 'en'), 'malformed-date');
  assert.equal(formatSafeEnrollmentDate(null, 'en'), '—');
});
