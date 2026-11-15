import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCalendarReadOwner } from '../src/lib/calendar/calendarReadOwner.ts';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const ready = id => ({ ok: true, status: 'READY', data: [{ id }] });

test('old reload after delayed school refresh cannot invalidate the new month/class/account request', async () => {
  const owner = createCalendarReadOwner();
  const states = [], newer = deferred(), older = deferred();
  owner.setScope('old'); owner.activate();
  const oldInFlight = owner.load('old', () => older.promise, state => states.push(state));
  owner.setScope('new'); owner.deactivate(); owner.activate();
  const newInFlight = owner.load('new', () => newer.promise, state => states.push(state));
  const before = states.length;
  assert.equal(await owner.load('old', () => { assert.fail('stale callback sent a request'); }, state => states.push(state)), false);
  assert.equal(states.length, before, 'stale callback cannot write old-scope loading');
  older.resolve(ready('old')); await oldInFlight;
  newer.resolve(ready('new')); assert.equal(await newInFlight, true);
  assert.equal(states.at(-1).key, 'new');
  assert.equal(states.at(-1).loading, false);
  assert.equal(states.at(-1).result.data[0].id, 'new');
});

test('unmounted and out-of-order reads cannot publish or strand later requests', async () => {
  const owner = createCalendarReadOwner(); const states = [];
  owner.setScope('same'); owner.activate();
  const first = deferred(), second = deferred();
  const one = owner.load('same', () => first.promise, s => states.push(s));
  const two = owner.load('same', () => second.promise, s => states.push(s));
  second.resolve(ready('second')); await two;
  first.resolve(ready('first')); await one;
  assert.equal(states.at(-1).result.data[0].id, 'second');
  owner.deactivate();
  const count = states.length;
  assert.equal(await owner.load('same', () => { assert.fail('unmounted request'); }, s => states.push(s)), false);
  assert.equal(states.length, count);
});
