import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

function countLines(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').length : -1;
}

test('FIX-04: Remaining oversized modules decomposed to <= 450 lines roots/facades and <= 400 lines submodules', () => {
  const parentNotesPanel = path.join(ROOT, 'src/components/views/Shared/ParentNotesPanel.tsx');
  const parentNotesDir = path.join(ROOT, 'src/components/views/parent-notes');

  const navbar = path.join(ROOT, 'src/components/Navbar.tsx');
  const navbarDir = path.join(ROOT, 'src/components/navbar');

  const govFacade = path.join(ROOT, 'src/lib/accountGovernance.ts');
  const govDir = path.join(ROOT, 'src/lib/governance');

  const attFacade = path.join(ROOT, 'src/lib/attendance/api.ts');
  const attDir = path.join(ROOT, 'src/lib/attendance');

  assert.ok(countLines(parentNotesPanel) <= 450, `ParentNotesPanel.tsx must be <= 450 lines, found ${countLines(parentNotesPanel)}`);
  assert.ok(countLines(navbar) <= 450, `Navbar.tsx must be <= 450 lines, found ${countLines(navbar)}`);
  assert.ok(countLines(govFacade) <= 450, `accountGovernance.ts must be <= 450 lines, found ${countLines(govFacade)}`);
  assert.ok(countLines(attFacade) <= 450, `attendance/api.ts must be <= 450 lines, found ${countLines(attFacade)}`);

  for (const dir of [parentNotesDir, navbarDir, govDir, attDir]) {
    assert.equal(fs.existsSync(dir), true, `${dir} must exist`);
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isFile()) {
        const lines = countLines(fullPath);
        assert.ok(lines <= 400, `Submodule ${file} must be <= 400 lines, found ${lines}`);
        assert.doesNotMatch(file, /^(helpers|utils|common|misc)\./i, `Catch-all filename forbidden: ${file}`);
      }
    }
  }

  // Verify UI files contain zero direct .from() or .rpc() calls
  for (const uiPath of [parentNotesPanel, navbar]) {
    const src = fs.readFileSync(uiPath, 'utf8');
    assert.doesNotMatch(src, /\.from\s*\(|\.rpc\s*\(/, `${path.basename(uiPath)} must not contain direct database queries`);
  }
});
