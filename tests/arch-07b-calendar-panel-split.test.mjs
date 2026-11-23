import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PANEL_PATH = 'src/components/views/Shared/SchoolCalendarPanel.tsx';
const CALENDAR_DIR = 'src/components/views/calendar';

const EXPECTED_CALENDAR_FILES = [
  'CalendarCreateEventForm.tsx',
  'CalendarDayAgendaPanel.tsx',
  'CalendarMonthGrid.tsx',
  'calendarDisplayConfig.ts',
  'useCalendarEventMutations.ts',
  'useSchoolCalendarController.ts',
  'useTeacherDirectoryOptions.ts',
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

test('ARCH-07b: SchoolCalendarPanel.tsx is <= 450 lines and every extracted calendar file is <= 400 lines', () => {
  const panelLines = countLines(PANEL_PATH);
  assert.ok(
    panelLines <= 450,
    `Expected ${PANEL_PATH} <= 450 lines, got ${panelLines}`,
  );

  for (const file of EXPECTED_CALENDAR_FILES) {
    const fullPath = path.join(CALENDAR_DIR, file);
    assert.ok(fs.existsSync(fullPath), `Missing expected file ${fullPath}`);
    const lines = countLines(fullPath);
    assert.ok(
      lines <= 400,
      `Expected ${fullPath} <= 400 lines, got ${lines}`,
    );
  }
});

test('ARCH-07b: zero direct .from() or .rpc() calls exist in SchoolCalendarPanel.tsx and src/components/views/calendar/*', () => {
  const filesToCheck = [
    PANEL_PATH,
    ...fs.readdirSync(CALENDAR_DIR).map((f) => path.join(CALENDAR_DIR, f)),
  ];
  for (const fullPath of filesToCheck) {
    if (!fs.statSync(fullPath).isFile()) continue;
    const src = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotMatch(
      src,
      /\.(from|rpc)\s*\(/,
      `Unexpected direct .from() or .rpc() call in ${fullPath}`,
    );
  }
});

test('ARCH-07b: GlobalAnnouncementsCalendarView.tsx and ClassCommunityView.tsx actively import and mount SchoolCalendarPanel', () => {
  const globalSrc = fs.readFileSync('src/components/views/GlobalAnnouncementsCalendarView.tsx', 'utf8');
  assert.match(globalSrc, /import\s+\{\s*SchoolCalendarPanel\s*\}\s+from\s+['"]\.\/Shared\/SchoolCalendarPanel['"]/);
  assert.match(globalSrc, /<SchoolCalendarPanel\b/);

  const classSrc = fs.readFileSync('src/components/views/ClassCommunityView.tsx', 'utf8');
  assert.match(classSrc, /import\s+\{\s*SchoolCalendarPanel\s*\}\s+from\s+['"]\.\/Shared\/SchoolCalendarPanel['"]/);
  assert.match(classSrc, /<SchoolCalendarPanel\b/);
});
