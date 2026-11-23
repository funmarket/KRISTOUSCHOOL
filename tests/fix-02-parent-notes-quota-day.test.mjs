import assert from 'node:assert/strict';
import test from 'node:test';

const { getParentNotesQuotaDay, isWithinParentNotesTunisWindow } = await import('../src/lib/domains/parentNotes.ts');

test('FIX-02: Quota cycle resets at 00:00 Africa/Tunis calendar midnight (not 08:00)', () => {
  // 07:59:59 Africa/Tunis on Nov 15, 2026 (06:59:59 UTC)
  const beforeMidnight = new Date('2026-11-15T06:59:59.000Z');
  assert.equal(getParentNotesQuotaDay(beforeMidnight), '2026-11-15');

  // Exactly 00:00:00 Africa/Tunis on Nov 15, 2026 (23:00:00 UTC on Nov 14)
  const atMidnight = new Date('2026-11-14T23:00:00.000Z');
  assert.equal(getParentNotesQuotaDay(atMidnight), '2026-11-15');

  // 07:30:00 Africa/Tunis on Nov 15, 2026 (before old 08:00 reset, now belongs to Nov 15 calendar day)
  const earlyMorning = new Date('2026-11-15T06:30:00.000Z');
  assert.equal(getParentNotesQuotaDay(earlyMorning), '2026-11-15');
});

test('FIX-02: 08:00–18:00 Africa/Tunis sending window remains strictly enforced independently of quota day', () => {
  // 07:30 Africa/Tunis (outside 08:00-18:00 sending window)
  const outsideWindow = new Date('2026-11-15T06:30:00.000Z');
  assert.equal(isWithinParentNotesTunisWindow(outsideWindow), false);

  // 12:00 Africa/Tunis (inside 08:00-18:00 sending window)
  const insideWindow = new Date('2026-11-15T11:00:00.000Z');
  assert.equal(isWithinParentNotesTunisWindow(insideWindow), true);

  // 18:30 Africa/Tunis (outside 08:00-18:00 sending window)
  const eveningOutside = new Date('2026-11-15T17:30:00.000Z');
  assert.equal(isWithinParentNotesTunisWindow(eveningOutside), false);
});
