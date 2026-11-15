import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeRefreshedNotifications, reconcileFailedMarkAllNotificationsRead, reconcileFailedSingleNotificationRead, captureNotificationReadSnapshot } from '../src/lib/appStateGuards.ts';

const old = { id: 'old', read: false };
const arrival = { id: 'arrival', read: false };
test('mark-all refresh and failure never consume a later unread arrival', () => {
  const pending = new Map([[1, new Set(['old'])]]);
  const refreshed = mergeRefreshedNotifications([old, arrival], new Set(), pending);
  assert.equal(refreshed[0].read, true);
  assert.equal(refreshed[1].read, false);
  const result = reconcileFailedMarkAllNotificationsRead(refreshed,
    { originUserId: 'u', originGeneration: 1, requestSeq: 1, targetIds: ['old'], previouslyUnreadIds: ['old'] },
    { userId: 'u', accountStatus: 'APPROVED', generation: 1 }, new Map(), 0);
  assert.deepEqual(result.notifications.map(n => n.read), [false, false]);
});

test('overlapping mark-all requests retain only their own targets after either completes', () => {
  const pending = new Map([[1, new Set(['old'])], [2, new Set(['old', 'arrival'])]]);
  const later = { id: 'later', read: false };
  for (const completed of [1, 2]) {
    const remaining = new Map(pending);
    remaining.delete(completed);
    const merged = mergeRefreshedNotifications([old, arrival, later], new Set(['single']), remaining);
    assert.equal(merged[0].read, true);
    assert.equal(merged[1].read, completed === 1);
    assert.equal(merged[2].read, false);
  }
});

test('stale refresh cannot undo a confirmed single read or mark an unrelated arrival read', () => {
  const merged = mergeRefreshedNotifications([old, arrival], new Set(), new Map(), new Map([['old', 2]]));
  assert.deepEqual(merged.map(n => n.read), [true, false]);
});

test('single failure followed by successful mark-all reconciles captured IDs and preserves later arrivals', () => {
  const pending = new Map([[2, new Set(['old', 'second'])]]);
  // A failed single-read has rolled the old target back before mark-all completes.
  const rolledBack = [old, { id: 'second', read: true }, arrival];
  const during = mergeRefreshedNotifications(rolledBack, new Set(), pending, new Map());
  assert.deepEqual(during.map(n => n.read), [true, true, false]);
  pending.delete(2);
  // AppContext uses this same merge on successful completion with captured confirmations.
  const after = mergeRefreshedNotifications(rolledBack, new Set(), pending, new Map([['old', 2], ['second', 2]]));
  assert.deepEqual(after.map(n => n.read), [true, true, false]);
});


test('overlapping single and mark-all failures restore every originally unread target in either order', () => {
  for (const order of [['single', 'all'], ['all', 'single']]) {
    const identity = { userId: 'u', accountStatus: 'APPROVED', generation: 1 };
    const snapshots = new Map(), pendingAll = new Map(), singles = new Set();
    let state = [old, { id: 'second', read: false }, { id: 'already-read', read: true }];
    const single = captureNotificationReadSnapshot(state, ['old'], snapshots.values(), identity, 1);
    snapshots.set(1, single); singles.add('old');
    state = state.map(n => n.id === 'old' ? { ...n, read: true } : n);
    const all = captureNotificationReadSnapshot(state, state.map(n => n.id), snapshots.values(), identity, 2);
    snapshots.set(2, all); pendingAll.set(2, new Set(all.targetIds));
    state = state.map(n => ({ ...n, read: true }));
    state.push(arrival);
    for (const kind of order) {
      if (kind === 'single') {
        snapshots.delete(1); singles.delete('old');
        state = reconcileFailedSingleNotificationRead(state, single, identity, new Map(), 0).notifications;
      } else {
        snapshots.delete(2); pendingAll.delete(2);
        state = reconcileFailedMarkAllNotificationsRead(state, all, identity, new Map(), 0).notifications;
      }
      state = mergeRefreshedNotifications(state, singles, pendingAll, new Map());
    }
    assert.deepEqual(state.map(n => n.read), [false, false, true, false], order.join(' then '));
  }
});
