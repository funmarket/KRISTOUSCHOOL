import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

const GENERATED_FILES = new Set([
  'src/lib/database.types.ts',
  'src/types/database.types.ts',
  'src/database.types.ts',
]);

const FORBIDDEN_FILENAMES = new Set([
  'helpers.ts',
  'utils.ts',
  'common.ts',
  'misc.ts',
  'schoolService.ts',
]);

const EXTRACTED_SUBMODULE_DIRS = [
  'src/components/homepages/access/',
  'src/components/homepages/owner/',
  'src/components/homepages/owner-governance/',
  'src/components/homepages/public-home/',
  'src/components/navbar/',
  'src/components/views/announcements/',
  'src/components/views/attendance/',
  'src/components/views/calendar/',
  'src/components/views/class-community/',
  'src/components/views/classes/',
  'src/components/views/directory/',
  'src/components/views/messages/',
  'src/components/views/parent-notes/',
  'src/components/views/performance/',
  'src/components/views/registration/',
  'src/components/views/students/',
  'src/lib/attendance/',
  'src/lib/governance/',
  'src/lib/performance/',
];

const EXTRACTED_CONTEXT_SUBMODULES = new Set([
  'src/context/appContextTypes.ts',
  'src/context/usePublicDataHydration.ts',
  'src/context/useSchoolDataHydration.ts',
  'src/context/useCommunityAndNotesActions.ts',
]);

function walkSrcFiles(dir = SRC_DIR) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkSrcFiles(full));
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function toRel(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function isExtractedSubmodule(rel) {
  if (EXTRACTED_CONTEXT_SUBMODULES.has(rel)) return true;
  if (rel === 'src/components/views/attendance/StaffAttendanceRegisterPanel.tsx') return false;
  return EXTRACTED_SUBMODULE_DIRS.some((prefix) => rel.startsWith(prefix));
}

test('ARCH-08 Gate 1: All hand-written src/*.ts(x) files <= 450 lines and extracted submodules <= 400 lines', () => {
  const files = walkSrcFiles();
  const rootViolations = [];
  const submoduleViolations = [];

  for (const absPath of files) {
    const rel = toRel(absPath);
    if (GENERATED_FILES.has(rel)) continue;
    const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/).length;
    if (lines > 450) {
      rootViolations.push(`${rel} (${lines}L)`);
    }
    if (isExtractedSubmodule(rel) && lines > 400) {
      submoduleViolations.push(`${rel} (${lines}L)`);
    }
  }

  assert.deepEqual(
    rootViolations,
    [],
    `Files exceeding 450-line global cap: ${rootViolations.join(', ')}`,
  );
  assert.deepEqual(
    submoduleViolations,
    [],
    `Extracted submodules exceeding 400-line cap: ${submoduleViolations.join(', ')}`,
  );
});

test('ARCH-08 Gate 2: Zero direct Supabase .from() or .rpc() calls outside src/lib/', () => {
  const files = walkSrcFiles();
  const violations = [];

  for (const absPath of files) {
    const rel = toRel(absPath);
    if (rel.startsWith('src/lib/')) continue;
    const content = fs.readFileSync(absPath, 'utf8');
    // Strip standard JS/DOM Array.from / Object.fromEntries / Buffer.from before scanning
    const sanitized = content.replace(/\b(?:Array|Buffer|Uint8Array|Set|Int8Array)\.from\s*\(/g, '');
    if (/\.(from|rpc)\s*\(/.test(sanitized)) {
      violations.push(rel);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Direct .from()/.rpc() calls outside src/lib/ found in: ${violations.join(', ')}`,
  );
});

test('ARCH-08 Gate 3: Zero forbidden catch-all filenames in src/', () => {
  const files = walkSrcFiles();
  const violations = [];

  for (const absPath of files) {
    if (FORBIDDEN_FILENAMES.has(path.basename(absPath))) {
      violations.push(toRel(absPath));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Forbidden catch-all filenames found: ${violations.join(', ')}`,
  );
});

test('ARCH-08 Gate 4: Zero runtime circular import cycles and zero unreachable modules from src/main.tsx', () => {
  const files = walkSrcFiles();
  const fileSet = new Set(files.map((f) => path.resolve(f)));

  function resolveRelativeImport(fromFile, spec) {
    if (!spec.startsWith('.')) return null;
    const base = path.resolve(path.dirname(fromFile), spec);
    for (const cand of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
    ]) {
      if (fileSet.has(cand)) return cand;
    }
    return null;
  }

  const allAdj = new Map();
  const runtimeAdj = new Map();
  const importRegex = /(?:^|\n)\s*(import|export)\s+(?!type\b)[^;\n]*?\bfrom\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const anyImportRegex = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const absPath of files) {
    const resolvedFrom = path.resolve(absPath);
    const txt = fs.readFileSync(absPath, 'utf8');

    const rtDeps = new Set();
    let m;
    while ((m = importRegex.exec(txt)) !== null) {
      const target = resolveRelativeImport(absPath, m[2] || m[3]);
      if (target) rtDeps.add(target);
    }
    runtimeAdj.set(resolvedFrom, [...rtDeps]);

    const allDeps = new Set();
    while ((m = anyImportRegex.exec(txt)) !== null) {
      const target = resolveRelativeImport(absPath, m[1] || m[2]);
      if (target) allDeps.add(target);
    }
    allAdj.set(resolvedFrom, [...allDeps]);
  }

  // 1. Cycle check on runtime edges
  const color = new Map();
  const stack = [];
  const cycles = [];

  function dfs(node) {
    color.set(node, 1);
    stack.push(node);
    for (const next of runtimeAdj.get(node) || []) {
      const state = color.get(next) || 0;
      if (state === 1) {
        cycles.push(stack.slice(stack.indexOf(next)).concat(next).map(toRel));
      } else if (state === 0) {
        dfs(next);
      }
    }
    stack.pop();
    color.set(node, 2);
  }

  for (const absPath of files) {
    const node = path.resolve(absPath);
    if ((color.get(node) || 0) === 0) dfs(node);
  }

  assert.deepEqual(
    cycles,
    [],
    `Runtime circular dependency cycles detected: ${JSON.stringify(cycles)}`,
  );

  // 2. Reachability check from src/main.tsx
  const visited = new Set();
  const queue = [path.resolve(SRC_DIR, 'main.tsx')];
  while (queue.length > 0) {
    const cur = queue.pop();
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of allAdj.get(cur) || []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  const unreachable = files
    .map((f) => path.resolve(f))
    .filter((f) => !visited.has(f))
    .map(toRel);

  assert.deepEqual(
    unreachable,
    [],
    `Unreachable dead modules from src/main.tsx: ${unreachable.join(', ')}`,
  );
});
