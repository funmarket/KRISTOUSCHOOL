import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterSchoolClasses, filterClassRoster } from '../src/lib/classes/classFilters.ts';
import { ClassOperationGate, getClassCreationScope, classifyClassCreationResult, classifyClassRefreshResult, resolveClassReadback } from '../src/lib/classes/classCreation.ts';

const actor = { id: 'actor-a', role: 'MANAGER', accountStatus: 'APPROVED', capabilities: ['CLASSES_MANAGE'] };

test('Class filters match name, level, year and guardian without mutating input', () => {
  const classes = [{ id: 'c1', name: '1ère A', level: 'CP', levelCode: 'CP', academicYear: '2026-2027', homeroomTeacherName: null, activeStudentCount: 0 }];
  assert.deepEqual(filterSchoolClasses(classes, '1ère', 'CP', '2026-2027'), classes);
  assert.deepEqual(filterSchoolClasses(classes, '', 'CE1', 'ALL'), []);
  assert.deepEqual(filterSchoolClasses(classes, '', 'ALL', '2025-2026'), []);
  const roster = [{ studentId: 's1', studentCode: 'KS-001', fullName: 'Youssef', primaryGuardianName: 'Guardian' }];
  assert.deepEqual(filterClassRoster(roster, 'guardian'), roster);
  assert.deepEqual(filterClassRoster(roster, 'KS-001'), roster);
  assert.notEqual(filterClassRoster(roster, ''), roster);
});

test('Class scope invalidates on actor, role, approval, capability or effective authority changes', () => {
  const key = getClassCreationScope(actor, true);
  assert.equal(getClassCreationScope({ ...actor, capabilities: ['CLASSES_MANAGE', 'CLASSES_MANAGE'] }, true), key);
  for (const changed of [{ ...actor, id: 'b' }, { ...actor, role: 'APP_ADMIN' }, { ...actor, capabilities: [] }]) {
    assert.notEqual(getClassCreationScope(changed, true), key);
  }
  assert.equal(getClassCreationScope({ ...actor, accountStatus: 'SUSPENDED' }, true), null);
  assert.equal(getClassCreationScope(actor, false), null);
});

test('Operation gate excludes repeated create/retry starts synchronously', () => {
  const gate = new ClassOperationGate();
  assert.equal(gate.begin(), null);
  gate.configure(getClassCreationScope(actor, true));
  const first = gate.begin();
  assert.ok(first);
  assert.equal(gate.begin(), null);
  assert.equal(gate.release(first), true);
  assert.ok(gate.begin());
});

test('Actor switch and return cannot revive an old operation or release the newer lock', () => {
  const gate = new ClassOperationGate();
  gate.configure('actor-a'); const first = gate.begin();
  gate.configure('actor-b'); const second = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.release(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.configure('actor-a'); const third = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.release(second), false);
  assert.equal(gate.isCurrent(third), true);
});

test('Revocation and unmount invalidate operations; remount cannot revive them', () => {
  const gate = new ClassOperationGate(); gate.configure('actor-a');
  const first = gate.begin(); gate.configure(null);
  assert.equal(gate.release(first), false); assert.equal(gate.begin(), null);
  gate.configure('actor-a'); const second = gate.begin(); gate.dispose();
  assert.equal(gate.isCurrent(second), false); assert.equal(gate.begin(), null);
  gate.resume(); const third = gate.begin();
  assert.equal(gate.release(second), false); assert.equal(gate.isCurrent(third), true);
});

test('Refresh classification never turns undefined into success or a boolean into identity readback', () => {
  assert.equal(classifyClassRefreshResult(undefined), 'unverified');
  assert.equal(classifyClassRefreshResult(false), 'failed');
  assert.equal(classifyClassRefreshResult(true), 'refreshed');
});

test('Creation confirmation requires the actual receipt, not a malformed successful response', () => {
  const receipt = { id: 'class-1', name: 'Class A', levelCode: 'CP' };
  assert.deepEqual(classifyClassCreationResult({ ok: true, status: 'READY', data: receipt }), { outcome: 'confirmed', receipt });
  for (const data of [undefined, {}, { ...receipt, id: '' }]) {
    assert.equal(classifyClassCreationResult({ ok: true, status: 'READY', data }).outcome, 'unknown');
  }
});

test('Explicit server rejections differ from uncertain transport or server outcomes', () => {
  for (const errorCode of ['invalid_class_name', 'invalid_academic_year', '23505', 'duplicate key value violates unique constraint "school_classes_unique"']) {
    assert.equal(classifyClassCreationResult({ ok: false, status: 'ERROR', errorCode }).outcome, 'failed');
  }
  for (const errorCode of ['TypeError: Failed to fetch', 'operation_failed', 'fetch failed']) {
    assert.equal(classifyClassCreationResult({ ok: false, status: 'ERROR', errorCode }).outcome, 'unknown');
  }
  assert.equal(classifyClassCreationResult({ ok: false, status: 'UNAUTHORIZED' }).outcome, 'failed');
});

test('Readback requires the exact persisted identity and READY class domain, independently of aggregate refresh success', () => {
  const receipt = { id: 'new-class', name: 'Class A', levelCode: 'CP' };
  assert.equal(resolveClassReadback(receipt, 'refreshed', 'READY', [{ id: 'old-class' }]), 'unverified');
  assert.equal(resolveClassReadback(receipt, 'unverified', 'READY', [{ id: 'new-class' }]), 'confirmed');
  assert.equal(resolveClassReadback(receipt, 'refreshed', 'ERROR', [{ id: 'new-class' }]), 'failed');
  assert.equal(resolveClassReadback(receipt, 'pending', 'READY', [{ id: 'new-class' }]), 'pending');
  assert.equal(resolveClassReadback(receipt, 'refreshed', 'LOADING', [{ id: 'new-class' }]), 'unverified');
});
