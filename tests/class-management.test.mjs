import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import {
  ClassesManagementView,
  filterSchoolClasses,
  filterClassRoster,
} from '../src/components/views/ClassesManagementView.tsx';

test('Class Management C3 pure filter and helper logic', () => {
  const sampleClasses = [
    {
      id: 'c1',
      name: '1ère A',
      level: 'CP',
      levelCode: 'CP',
      academicYear: '2026-2027',
      homeroomTeacherName: 'Mme. Fatima',
      activeStudentCount: 22,
      capacity: 28,
      roomLabel: 'Room 101',
    },
  ];
  const filtered = filterSchoolClasses(sampleClasses, '1ère', 'ALL', 'ALL');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'c1');

  const roster = [
    {
      studentId: 's1',
      studentCode: 'KS-2026-001',
      fullName: 'Youssef',
      enrollmentStatus: 'ACTIVE',
      enrolledAt: '2026-09-01',
    },
  ];
  const filteredRoster = filterClassRoster(roster, 'Youssef');
  assert.equal(filteredRoster.length, 1);
});
