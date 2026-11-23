import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const COMMUNITY_VIEW = path.join(ROOT, 'src/components/views/ClassCommunityView.tsx');
const COMMUNITY_DIR = path.join(ROOT, 'src/components/views/class-community');
const APP_SHELL = path.join(ROOT, 'src/app/AppShell.tsx');

const EXPECTED_SUBMODULES = [
  'useClassCommunityView.ts',
  'ClassAnnouncementsHomeworkTabs.tsx',
  'ClassQuestionsTab.tsx',
  'ClassDocumentsGalleryTab.tsx',
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

test('ARCH-07f: ClassCommunityView.tsx is a thin class community root <= 450 lines with zero direct Supabase queries', () => {
  assert.equal(fs.existsSync(COMMUNITY_VIEW), true, 'ClassCommunityView.tsx must exist');
  const lines = countLines(COMMUNITY_VIEW);
  assert.ok(
    lines <= 450,
    `Expected ClassCommunityView.tsx to be <= 450 lines, found ${lines} lines`,
  );

  const source = fs.readFileSync(COMMUNITY_VIEW, 'utf8');
  assert.doesNotMatch(
    source,
    /\.from\s*\(|\.rpc\s*\(/,
    'ClassCommunityView.tsx must not contain direct .from() or .rpc() calls',
  );

  for (const modName of [
    'useClassCommunityView',
    'ClassAnnouncementsTab',
    'ClassHomeworkTab',
    'ClassQuestionsTab',
    'ClassDocumentsTab',
    'ClassGalleryTab',
  ]) {
    assert.match(
      source,
      new RegExp(modName),
      `ClassCommunityView.tsx must import and compose ${modName}`,
    );
  }
});

test('ARCH-07f: every file in src/components/views/class-community/ is <= 400 lines, single-responsibility, and has zero direct Supabase queries', () => {
  assert.equal(fs.existsSync(COMMUNITY_DIR), true, 'src/components/views/class-community directory must exist');
  const files = fs.readdirSync(COMMUNITY_DIR).sort();
  assert.deepEqual(
    files,
    [...EXPECTED_SUBMODULES].sort(),
    'src/components/views/class-community must contain the exact single-responsibility modules',
  );

  for (const file of files) {
    assert.doesNotMatch(
      file,
      /^(helpers|utils|common|misc|shared)\./i,
      `Catch-all filename forbidden: ${file}`,
    );
    const fullPath = path.join(COMMUNITY_DIR, file);
    const lines = countLines(fullPath);
    assert.ok(lines <= 400, `Expected ${file} to be <= 400 lines, found ${lines} lines`);

    const content = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotMatch(
      content,
      /\.from\s*\(|\.rpc\s*\(/,
      `${file} must delegate all data access to domains/classCommunity.ts with zero direct .from() or .rpc() calls`,
    );
  }
});

test('ARCH-07f: AppShell.tsx actively imports and mounts ClassCommunityView', () => {
  const shellSource = fs.readFileSync(APP_SHELL, 'utf8');
  assert.match(shellSource, /ClassCommunityView/, 'AppShell.tsx must import ClassCommunityView');
  assert.match(shellSource, /<ClassCommunityView\s*[\s\S]*?\/>/, 'AppShell.tsx must mount <ClassCommunityView />');
});
