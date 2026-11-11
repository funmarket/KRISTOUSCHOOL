import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidUsername } from '../src/lib/username.ts';

test('accepts usernames matching the case-insensitive database format', () => {
  assert.equal(isValidUsername('bashir_2026'), true);
  assert.equal(isValidUsername('Teacher.Name-1'), true);
  assert.equal(isValidUsername('  user.name  '), true);
});

test('rejects usernames that trigger the database check constraint', () => {
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('not a username'), false);
  assert.equal(isValidUsername('.starts-with-punctuation'), false);
  assert.equal(isValidUsername('école'), false);
  assert.equal(isValidUsername('a'.repeat(51)), false);
});
