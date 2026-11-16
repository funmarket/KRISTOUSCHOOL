import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterLoadedNotifications, NOTIFICATION_CATEGORIES } from '../src/lib/notificationFilters.ts';

const sample = [
  { id: '1', type: 'note', read: false },
  { id: '2', type: 'message', read: true },
  { id: '3', type: 'note', read: true },
  { id: '4', type: 'calendar', read: false },
];

test('All leaves the loaded 40-record client window untouched, in order', () => {
  assert.deepEqual(filterLoadedNotifications(sample, 'all'), sample);
});

test('category filter keeps only canonical matching loaded records, in original order', () => {
  assert.deepEqual(filterLoadedNotifications(sample, 'note').map(n => n.id), ['1', '3']);
  assert.deepEqual(filterLoadedNotifications(sample, 'message').map(n => n.id), ['2']);
  assert.deepEqual(filterLoadedNotifications(sample, 'pickup'), []);
});

test('filter changes do not mark records read or alter the backing array', () => {
  const snapshot = JSON.stringify(sample);
  filterLoadedNotifications(sample, 'system');
  assert.equal(JSON.stringify(sample), snapshot);
});

test('only six supported server categories are advertised', () => {
  assert.deepEqual(NOTIFICATION_CATEGORIES, ['pickup', 'note', 'announcement', 'message', 'calendar', 'system']);
});
