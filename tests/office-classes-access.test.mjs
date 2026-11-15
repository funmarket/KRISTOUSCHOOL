import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessAppTab, canManageClassesUi } from '../src/components/homepages/homepageAccess.ts';

function user(role, capabilities = undefined, accountStatus = 'APPROVED') {
  return {
    id: `fixture-${role}`,
    username: 'fixture',
    fullName: 'Fixture',
    role,
    accountStatus,
    ...(capabilities === undefined ? {} : { capabilities }),
  };
}

test('Packet C: approved Office account can enter Classes without synthetic delegated capabilities', () => {
  for (const capabilities of [undefined, [], ['ADMINISTRATIVE_PERSONNEL']]) {
    const office = user('ADMINISTRATIVE_PERSONNEL', capabilities);
    assert.equal(canAccessAppTab(office, 'classes'), true, 'Shared navigation/direct-tab guard must allow approved Office');
    assert.equal(canManageClassesUi(office), true, 'Classes management controls must remain available for approved Office');
  }
});

test('Packet C: unapproved Office accounts cannot access Classes or management', () => {
  for (const status of ['PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED']) {
    const office = user('ADMINISTRATIVE_PERSONNEL', ['CLASSES_ROSTER_VIEW', 'CLASSES_MANAGE'], status);
    assert.equal(canAccessAppTab(office, 'classes'), false, `Classes denied to ${status} Office`);
    assert.equal(canManageClassesUi(office), false, `Management denied to ${status} Office`);
  }
  assert.equal(canAccessAppTab(null, 'classes'), false);
  const unknownApproval = user('ADMINISTRATIVE_PERSONNEL', []);
  delete unknownApproval.accountStatus;
  assert.equal(canAccessAppTab(unknownApproval, 'classes'), false);
  assert.equal(canManageClassesUi(unknownApproval), false);
});

test('Packet C: Managers preserve delegated read, manage, and FULL_ACCESS boundaries', () => {
  const cases = [
    { caps: [], canEnter: false, canManage: false },
    { caps: ['MANAGER'], canEnter: false, canManage: false },
    { caps: ['CLASSES_ROSTER_VIEW'], canEnter: true, canManage: false },
    { caps: ['CLASSES_MANAGE'], canEnter: true, canManage: true },
    { caps: ['FULL_ACCESS'], canEnter: true, canManage: true },
    { caps: ['ACCOUNT_APPROVAL_REVIEW'], canEnter: false, canManage: false },
  ];
  for (const item of cases) {
    const manager = user('MANAGER', item.caps);
    assert.equal(canAccessAppTab(manager, 'classes'), item.canEnter, item.caps.join(',') || 'no delegation');
    assert.equal(canManageClassesUi(manager), item.canManage, item.caps.join(',') || 'no delegation');
  }
});

test('Packet C: other roles retain existing Classes scope', () => {
  assert.equal(canAccessAppTab(user('APP_ADMIN', []), 'classes'), true);
  assert.equal(canManageClassesUi(user('APP_ADMIN', [])), true);
  for (const role of ['PARENT', 'STUDENT', 'TEACHER']) {
    assert.equal(canAccessAppTab(user(role, ['CLASSES_MANAGE']), 'classes'), false, `No implicit Classes admin: ${role}`);
    assert.equal(canManageClassesUi(user(role, ['CLASSES_MANAGE'])), false);
  }
  assert.equal(canAccessAppTab(user('SCHOOL_STAFF', []), 'classes'), false);
  assert.equal(canAccessAppTab(user('SCHOOL_STAFF', ['CLASSES_ROSTER_VIEW']), 'classes'), true);
  assert.equal(canManageClassesUi(user('SCHOOL_STAFF', ['CLASSES_ROSTER_VIEW'])), false);
  assert.equal(canAccessAppTab(user('GENERAL_USER', ['CLASSES_MANAGE']), 'classes'), false);
});
