import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const PUBLIC_HOME = path.join(ROOT, 'src/components/homepages/PublicHomePage.tsx');
const PUBLIC_HOME_DIR = path.join(ROOT, 'src/components/homepages/public-home');
const RESOLVER = path.join(ROOT, 'src/components/homepages/HomePageResolver.tsx');

const EXPECTED_SUBMODULES = [
  'usePublicHomePage.ts',
  'PublicFeaturedAndCanteenPanels.tsx',
  'PublicSchoolContentSections.tsx',
  'PublicInquiryContactSection.tsx',
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

test('ARCH-07e: PublicHomePage.tsx is a thin public homepage root <= 450 lines with zero direct Supabase queries', () => {
  assert.equal(fs.existsSync(PUBLIC_HOME), true, 'PublicHomePage.tsx must exist');
  const lines = countLines(PUBLIC_HOME);
  assert.ok(
    lines <= 450,
    `Expected PublicHomePage.tsx to be <= 450 lines, found ${lines} lines`,
  );

  const source = fs.readFileSync(PUBLIC_HOME, 'utf8');
  assert.doesNotMatch(
    source,
    /\.from\s*\(|\.rpc\s*\(/,
    'PublicHomePage.tsx must not contain direct .from() or .rpc() calls',
  );

  for (const modName of [
    'usePublicHomePage',
    'PublicFeaturedAndCanteenPanels',
    'PublicSchoolContentSections',
    'PublicInquiryContactSection',
  ]) {
    assert.match(
      source,
      new RegExp(modName),
      `PublicHomePage.tsx must import and compose ${modName}`,
    );
  }
});

test('ARCH-07e: every file in src/components/homepages/public-home/ is <= 400 lines, single-responsibility, and has zero direct Supabase queries', () => {
  assert.equal(fs.existsSync(PUBLIC_HOME_DIR), true, 'src/components/homepages/public-home directory must exist');
  const files = fs.readdirSync(PUBLIC_HOME_DIR).sort();
  assert.deepEqual(
    files,
    [...EXPECTED_SUBMODULES].sort(),
    'src/components/homepages/public-home must contain the exact single-responsibility modules',
  );

  for (const file of files) {
    assert.doesNotMatch(
      file,
      /^(helpers|utils|common|misc|shared)\./i,
      `Catch-all filename forbidden: ${file}`,
    );
    const fullPath = path.join(PUBLIC_HOME_DIR, file);
    const lines = countLines(fullPath);
    assert.ok(lines <= 400, `Expected ${file} to be <= 400 lines, found ${lines} lines`);

    const content = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotMatch(
      content,
      /\.from\s*\(|\.rpc\s*\(/,
      `${file} must delegate all data access to public domain owners with zero direct .from() or .rpc() calls`,
    );
  }
});

test('ARCH-07e: HomePageResolver.tsx actively imports and mounts PublicHomePage', () => {
  const resolverSource = fs.readFileSync(RESOLVER, 'utf8');
  assert.match(resolverSource, /PublicHomePage/, 'HomePageResolver.tsx must import PublicHomePage');
  assert.match(resolverSource, /<PublicHomePage[\s/>]/, 'HomePageResolver.tsx must mount <PublicHomePage />');
});
