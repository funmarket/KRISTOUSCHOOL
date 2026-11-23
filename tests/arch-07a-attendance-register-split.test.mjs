import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ATTENDANCE_DIR = path.join(ROOT, 'src/components/views/attendance');

const NEW_ARCH_07A_FILES = [
  'useOfficeAttendanceDiscovery.ts',
  'useRegisterDraftAndSave.ts',
  'useStaffAttendanceRegister.ts',
  'RegisterHistorySelector.tsx',
  'RegisterHeaderControls.tsx',
  'RegisterRosterTable.tsx',
  'RegisterAuditTrailPanel.tsx',
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

test('ARCH-07a: StaffAttendanceRegisterPanel.tsx is <= 450 lines and every extracted attendance register file is <= 400 lines', () => {
  const panelPath = path.join(ATTENDANCE_DIR, 'StaffAttendanceRegisterPanel.tsx');
  const panelLines = countLines(panelPath);
  assert.ok(
    panelLines <= 450,
    `Expected StaffAttendanceRegisterPanel.tsx <= 450 lines, got ${panelLines}`,
  );

  for (const rel of NEW_ARCH_07A_FILES) {
    const fullPath = path.join(ATTENDANCE_DIR, rel);
    assert.ok(fs.existsSync(fullPath), `Expected extracted file ${rel} to exist`);
    const lines = countLines(fullPath);
    assert.ok(
      lines <= 400,
      `Expected ${rel} <= 400 lines, got ${lines}`,
    );
  }
});

test('ARCH-07a: zero direct .from() or .rpc() calls exist in src/components/views/attendance/*', () => {
  const files = fs.readdirSync(ATTENDANCE_DIR).filter((f) => /\.(ts|tsx)$/.test(f));
  for (const file of files) {
    const content = fs.readFileSync(path.join(ATTENDANCE_DIR, file), 'utf8');
    assert.equal(
      /\.(from|rpc)\s*\(/.test(content),
      false,
      `Expected zero direct .from() or .rpc() calls in ${file}`,
    );
  }
});

test('ARCH-07a: AttendanceView.tsx actively imports and mounts StaffAttendanceRegisterPanel', () => {
  const attendanceView = fs.readFileSync(
    path.join(ROOT, 'src/components/views/AttendanceView.tsx'),
    'utf8',
  );
  assert.match(
    attendanceView,
    /import\s*\{\s*StaffAttendanceRegisterPanel\s*\}\s*from\s*['"]\.\/attendance\/StaffAttendanceRegisterPanel['"]/,
  );
  assert.match(attendanceView, /<StaffAttendanceRegisterPanel\b/);
});
