import assert from 'node:assert/strict';
import { test } from 'node:test';
globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';
const { listSchoolCalendarEvents, getTunisSchoolDay } = await import('../src/lib/schoolContent.ts');

function calendarClient(rows, { failPage = -1, failResponses = false } = {}) {
  const calls = [];
  return { calls, from(table) {
    calls.push(['table', table]);
    let filtered = [...rows], start = 0, end = Infinity;
    const orders = [];
    const q = {
      select(cols) { calls.push(['select', cols]); return q; },
      order(column) { orders.push(column); return q; },
      lte(column, value) { filtered = filtered.filter(r => r[column] <= value); calls.push(['lte', column, value]); return q; },
      gte(column, value) { filtered = filtered.filter(r => r[column] >= value); calls.push(['gte', column, value]); return q; },
      or(filter) { calls.push(['scope', filter]); return q; },
      eq() { return q; }, in() { return q; },
      limit(n) { end = n - 1; return q; },
      range(a, b) { start = a; end = b; calls.push(['range', a, b]); return q; },
      then(resolve, reject) {
        calls.push(['orders', ...orders]);
        const response = table === 'school_calendar_responses';
        return Promise.resolve({ data: response ? [{ event_id: 'e-299', response: 'ACKNOWLEDGED' }] : filtered.slice(start, end + 1),
          error: (response ? failResponses : start === failPage) ? { message: 'read failed' } : null }).then(resolve, reject);
      },
    };
    return q;
  } };
}
function row(id, start, end = start, extra = {}) {
  return {
    id,
    title: id,
    start_date: start,
    end_date: end,
    category: 'EVENT',
    audience_mode: 'WHOLE_SCHOOL',
    class_id: null,
    target_class_ids: [],
    is_public: false,
    status: 'SCHEDULED',
    ...extra,
  };
}

test('default calendar hydration is bounded to the current Tunis month, not earliest history', async () => {
  const today = getTunisSchoolDay();
  const client = calendarClient([...Array.from({ length: 250 }, (_, i) => row(`history-${i}`, '2000-01-01')), row('today', today)]);
  const result = await listSchoolCalendarEvents(null, client);
  assert.deepEqual(result.data.map(e => e.id), ['today']);
  assert.ok(client.calls.some(c => c[0] === 'gte' && c[2].slice(0, 7) === today.slice(0, 7)));
});

test('displayed month reads all pages from school_calendar_event_feed, includes overlapping multi-day events and loads responses', async () => {
  const client = calendarClient([...Array.from({ length: 300 }, (_, i) => row(`e-${String(i).padStart(3, '0')}`, '2026-11-15')), row('overlap', '2026-10-30', '2026-11-02'), row('outside', '2026-12-01')]);
  const result = await listSchoolCalendarEvents('user', client, { startDate: '2026-11-01', endDate: '2026-11-30', classId: 'class-1' });
  assert.equal(result.ok, true);
  assert.equal(result.data.length, 301);
  assert.equal(result.data.find(e => e.id === 'e-299').myResponse, 'ACKNOWLEDGED');
  assert.ok(client.calls.some(c => c[0] === 'table' && c[1] === 'school_calendar_event_feed'));
  const feedSelect = client.calls.find(c => c[0] === 'select' && typeof c[1] === 'string' && c[1].includes('audience_mode'));
  assert.ok(feedSelect);
  assert.ok(!feedSelect[1].includes('created_at'));
  assert.ok(!feedSelect[1].includes('created_by'));
  assert.ok(!feedSelect[1].includes('updated_at'));
  assert.ok(client.calls.some(c => c[0] === 'range' && c[1] === 250));
  assert.ok(client.calls.some(c => c[0] === 'orders' && c.includes('id')));
  assert.ok(client.calls.some(c => c[0] === 'scope' && c[1] === 'audience_mode.eq.WHOLE_SCHOOL,target_class_ids.cs.{class-1}'));
});

test('later page or RSVP query errors fail the whole read rather than presenting a partial month', async () => {
  const rows = Array.from({ length: 300 }, (_, i) => row(String(i), '2026-11-15'));
  for (const failure of [{ failPage: 250 }, { failResponses: true }]) {
    const result = await listSchoolCalendarEvents('user', calendarClient(rows, failure), { startDate: '2026-11-01', endDate: '2026-11-30' });
    assert.equal(result.ok, false);
    assert.equal(result.status, 'ERROR');
    assert.equal(result.data, undefined);
  }
});

test('malformed feed rows and unsafe classId filter fail closed instead of coercing to WHOLE_SCHOOL', async () => {
  const missingAudience = calendarClient([
    { id: 'bad-1', title: 'Bad', start_date: '2026-11-10', end_date: '2026-11-10', category: 'EVENT', status: 'SCHEDULED', is_public: false, target_class_ids: [] },
  ]);
  const res1 = await listSchoolCalendarEvents(null, missingAudience, { startDate: '2026-11-01', endDate: '2026-11-30' });
  assert.equal(res1.ok, false);
  assert.equal(res1.status, 'ERROR');

  const badTargets = calendarClient([
    row('bad-2', '2026-11-10', '2026-11-10', { audience_mode: 'TEACHER_CLASSES', target_class_ids: null }),
  ]);
  const res2 = await listSchoolCalendarEvents(null, badTargets, { startDate: '2026-11-01', endDate: '2026-11-30' });
  assert.equal(res2.ok, false);
  assert.equal(res2.status, 'ERROR');

  const safeClient = calendarClient([]);
  const res3 = await listSchoolCalendarEvents(null, safeClient, {
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    classId: 'class-1,audience_mode.eq.SINGLE_CLASS',
  });
  assert.equal(res3.ok, false);
  assert.equal(res3.status, 'ERROR');
  assert.equal(res3.errorCode, 'invalid_class_id');
  assert.equal(safeClient.calls.length, 0);
});
