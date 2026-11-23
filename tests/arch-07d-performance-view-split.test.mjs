import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const PERF_VIEW = path.join(ROOT, 'src/components/views/PerformanceView.tsx');
const PERF_DIR = path.join(ROOT, 'src/components/views/performance');
const APP_SHELL = path.join(ROOT, 'src/app/AppShell.tsx');

const EXPECTED_SUBMODULES = [
  'usePerformanceViewController.ts',
  'PerformanceTeacherScopeSection.tsx',
  'PerformanceParentScopeSection.tsx',
  'AcademicSubjectDashboardSection.tsx',
  'ReadOnlyAssessmentPanelsGrid.tsx',
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

test('ARCH-07d: PerformanceView.tsx is a thin view composition shell <= 450 lines', () => {
  assert.equal(fs.existsSync(PERF_VIEW), true, 'PerformanceView.tsx must exist');
  const lines = countLines(PERF_VIEW);
  assert.ok(
    lines <= 450,
    `Expected PerformanceView.tsx to be <= 450 lines, found ${lines} lines`,
  );

  const source = fs.readFileSync(PERF_VIEW, 'utf8');
  assert.doesNotMatch(
    source,
    /\.from\s*\(|\.rpc\s*\(/,
    'PerformanceView.tsx must not contain direct .from() or .rpc() calls',
  );

  for (const modName of [
    'usePerformanceViewController',
    'PerformanceTeacherScopeSection',
    'PerformanceParentScopeSection',
    'AcademicSubjectDashboardSection',
    'ReadOnlyAssessmentPanelsGrid',
  ]) {
    assert.match(
      source,
      new RegExp(modName),
      `PerformanceView.tsx must import and compose ${modName}`,
    );
  }
});

test('ARCH-07d: every file in src/components/views/performance/ is <= 400 lines, single-responsibility, and has zero direct Supabase queries', () => {
  assert.equal(fs.existsSync(PERF_DIR), true, 'src/components/views/performance directory must exist');
  const files = fs.readdirSync(PERF_DIR).sort();
  assert.deepEqual(
    files,
    [...EXPECTED_SUBMODULES].sort(),
    'src/components/views/performance must contain the exact single-responsibility modules',
  );

  for (const file of files) {
    assert.doesNotMatch(
      file,
      /^(helpers|utils|common|misc|shared)\./i,
      `Catch-all filename forbidden: ${file}`,
    );
    const fullPath = path.join(PERF_DIR, file);
    const lines = countLines(fullPath);
    assert.ok(lines <= 400, `Expected ${file} to be <= 400 lines, found ${lines} lines`);

    const content = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotMatch(
      content,
      /\.from\s*\(|\.rpc\s*\(/,
      `${file} must delegate all data access to src/lib/performance.ts with zero direct .from() or .rpc() calls`,
    );
  }
});

test('ARCH-07d: AppShell.tsx actively imports and mounts PerformanceView', () => {
  const shellSource = fs.readFileSync(APP_SHELL, 'utf8');
  assert.match(shellSource, /PerformanceView/, 'AppShell.tsx must import PerformanceView');
  assert.match(shellSource, /<PerformanceView\s*\/>/, 'AppShell.tsx must mount <PerformanceView />');
});
