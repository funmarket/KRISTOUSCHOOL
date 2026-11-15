import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getNotificationActorKey,
  createNotificationTargetIntent,
  getCurrentNotificationTarget,
  resolveNotificationTarget,
} from '../src/lib/notificationTargetNavigation.ts';

const threadId = '11111111-1111-4111-8111-111111111111';
const noteId = '22222222-2222-4222-8222-222222222222';
const appId = '33333333-3333-4333-8333-333333333333';
const makeActor = (id = 'approved-1', status = 'APPROVED') => ({ id, role: 'PARENT', accountStatus: status });
const toNotif = (targetTab, targetRefId) => ({ id: 'notif-1', targetTab, targetRefId, read: false });

test('N2 targets exactly the three verified producer destinations with immutable UUIDs', () => {
  const actor = getNotificationActorKey(makeActor());
  for (const [tab, id] of [['messages', threadId], ['notes', noteId], ['registration', appId]]) {
    const event = toNotif(tab, id);
    const intent = createNotificationTargetIntent(event, actor, 17);
    assert.deepEqual(intent, { tab, refId: id, actorKey: actor, requestId: 17 });
    assert.equal(event.read, false, 'Creating a destination never acknowledges a notification');
  }
  assert.equal(createNotificationTargetIntent(toNotif('calendar', noteId), actor, 1), null);
  assert.equal(createNotificationTargetIntent(toNotif('messages', 'injected; DROP TABLE'), actor, 1), null);
  assert.equal(createNotificationTargetIntent(toNotif('messages', null), actor, 1), null);
});

test('N2 actor identity is fail-closed before approval and on account/role changes', () => {
  const approved = getNotificationActorKey(makeActor());
  assert.equal(getNotificationActorKey(makeActor('approved-1', 'SUSPENDED')), null);
  assert.equal(getNotificationActorKey(null), null);
  const intent = createNotificationTargetIntent(toNotif('notes', noteId), approved, 1);
  assert.equal(getCurrentNotificationTarget(intent, approved, 'notes'), intent);
  assert.equal(getCurrentNotificationTarget(intent, getNotificationActorKey(makeActor('approved-2')), 'notes'), null);
  assert.equal(getCurrentNotificationTarget(intent, approved, 'registration'), null);
  assert.equal(getCurrentNotificationTarget(intent, null, 'notes'), null);
  assert.equal(getCurrentNotificationTarget(intent, getNotificationActorKey({ ...makeActor(), role: 'TEACHER' }), 'notes'), null);
});

test('N2 waits for actual authorized readback, handles missing records and fails closed on server errors', () => {
  const actor = getNotificationActorKey(makeActor());
  const intent = createNotificationTargetIntent(toNotif('messages', threadId), actor, 1);
  const rows = [{ id: noteId }, { id: threadId, subject: 'authorized server-loaded thread' }];
  assert.equal(resolveNotificationTarget(intent, actor, 'READY', true, rows).state, 'loading');
  assert.equal(resolveNotificationTarget(intent, actor, 'READY', false, rows).state, 'found');
  assert.equal(resolveNotificationTarget(intent, actor, 'READY', false, rows).record?.id, threadId);
  assert.equal(resolveNotificationTarget(intent, actor, 'READY', false, [{ id: noteId }]).state, 'unavailable');
  assert.equal(resolveNotificationTarget(intent, actor, 'UNAUTHORIZED', false, rows).state, 'unavailable');
  assert.equal(resolveNotificationTarget(intent, actor, 'ERROR', false, rows).state, 'unavailable');
  assert.equal(resolveNotificationTarget(intent, getNotificationActorKey(makeActor('other')), 'READY', false, rows).state, 'idle');
  assert.equal(resolveNotificationTarget(null, actor, 'READY', false, rows).state, 'idle');
  assert.deepEqual(rows, [{ id: noteId }, { id: threadId, subject: 'authorized server-loaded thread' }]);
});

test('N2 rapid selections keep the newest requested record, including repeated same-ID clicks', () => {
  const actor = getNotificationActorKey(makeActor());
  const first = createNotificationTargetIntent(toNotif('notes', noteId), actor, 1);
  const last = createNotificationTargetIntent(toNotif('notes', appId), actor, 2);
  const again = createNotificationTargetIntent(toNotif('notes', appId), actor, 3);
  assert.ok(first && last && again);
  assert.notDeepEqual(first, last);
  assert.notDeepEqual(last, again);
  const readback = [{ id: appId }, { id: noteId }];
  assert.equal(resolveNotificationTarget(last, actor, 'READY', false, readback).record?.id, appId);
  assert.equal(resolveNotificationTarget(again, actor, 'READY', false, readback).record?.id, appId);
});
