import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visibleDirectoryEntries } from '../src/lib/directoryVisibility.ts';

const publicEntry = { id: 'public-1', name: 'Approved teacher', isPublished: true };
const draftEntry = { id: 'draft-1', name: 'Internal draft', isPublished: false };
const ambiguousEntry = { id: 'unknown-1', name: 'Unverified publication' };

test('anonymous only sees explicitly published Directory records on READY reads', () => {
  const records = [publicEntry, draftEntry, ambiguousEntry];
  assert.deepEqual(visibleDirectoryEntries(records, 'READY', false), [publicEntry]);
  assert.equal(records.length, 3, 'client projection never mutates its source');
});

test('authorized editors retain unpublished cards for clearly labeled previews', () => {
  assert.deepEqual(visibleDirectoryEntries([publicEntry, draftEntry], 'READY', true), [publicEntry, draftEntry]);
});

test('fail-closed error and denial never retain stale Directory records', () => {
  for (const status of ['ERROR', 'UNAUTHORIZED']) {
    assert.deepEqual(visibleDirectoryEntries([publicEntry, draftEntry], status, true), []);
  }
});

test('historical BLOCKED_BACKEND preview cards remain displayed but cannot be opened as live records', () => {
  assert.deepEqual(visibleDirectoryEntries([ambiguousEntry], 'BLOCKED_BACKEND', false), [ambiguousEntry]);
});
