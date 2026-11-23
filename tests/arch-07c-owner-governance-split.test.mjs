import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const WORKSPACE_SHELL = path.join(ROOT, 'src/components/homepages/OwnerGovernanceWorkspace.tsx');
const GOV_DIR = path.join(ROOT, 'src/components/homepages/owner-governance');
const OWNER_HOMEPAGE = path.join(ROOT, 'src/components/homepages/OwnerHomePage.tsx');
const MANAGER_HOMEPAGE = path.join(ROOT, 'src/components/homepages/ManagerHomePage.tsx');

const EXPECTED_SUBMODULES = [
  'governanceDisplayConfig.ts',
  'useOwnerGovernanceController.ts',
  'GovernanceControlCenterSection.tsx',
  'PendingAccountApprovalsSection.tsx',
  'GovernanceUserDirectorySection.tsx',
  'ManagerCapabilityDelegationSection.tsx',
  'PrivilegedRoleGovernanceSection.tsx',
  'GovernanceAuditLogDrawer.tsx',
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

test('ARCH-07c: OwnerGovernanceWorkspace.tsx is a thin governance shell <= 450 lines', () => {
  assert.equal(fs.existsSync(WORKSPACE_SHELL), true, 'OwnerGovernanceWorkspace.tsx must exist');
  const lines = countLines(WORKSPACE_SHELL);
  assert.ok(
    lines <= 450,
    `Expected OwnerGovernanceWorkspace.tsx to be <= 450 lines, found ${lines} lines`,
  );

  const source = fs.readFileSync(WORKSPACE_SHELL, 'utf8');
  assert.doesNotMatch(
    source,
    /\.from\s*\(|\.rpc\s*\(/,
    'OwnerGovernanceWorkspace.tsx must not contain direct .from() or .rpc() calls',
  );

  for (const modName of [
    'GovernanceControlCenterSection',
    'PendingAccountApprovalsSection',
    'GovernanceUserDirectorySection',
    'ManagerCapabilityDelegationSection',
    'PrivilegedRoleGovernanceSection',
    'GovernanceAuditLogDrawer',
    'useOwnerGovernanceController',
  ]) {
    assert.match(
      source,
      new RegExp(modName),
      `OwnerGovernanceWorkspace.tsx must import and compose ${modName}`,
    );
  }
});

test('ARCH-07c: every file in src/components/homepages/owner-governance/ is <= 400 lines, single-responsibility, and has zero direct Supabase queries', () => {
  assert.equal(fs.existsSync(GOV_DIR), true, 'owner-governance directory must exist');
  const files = fs.readdirSync(GOV_DIR).sort();
  assert.deepEqual(
    files,
    [...EXPECTED_SUBMODULES].sort(),
    'owner-governance directory must contain the exact single-responsibility modules',
  );

  for (const file of files) {
    assert.doesNotMatch(
      file,
      /^(helpers|utils|common|misc|shared)\./i,
      `Catch-all filename forbidden: ${file}`,
    );
    const fullPath = path.join(GOV_DIR, file);
    const lines = countLines(fullPath);
    assert.ok(lines <= 400, `Expected ${file} to be <= 400 lines, found ${lines} lines`);

    const content = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotMatch(
      content,
      /\.from\s*\(|\.rpc\s*\(/,
      `${file} must delegate all data access to accountGovernance.ts with zero direct .from() or .rpc() calls`,
    );
  }
});

test('ARCH-07c: OwnerHomePage.tsx and ManagerHomePage.tsx actively import and mount OwnerGovernanceWorkspace', () => {
  const ownerSource = fs.readFileSync(OWNER_HOMEPAGE, 'utf8');
  const managerSource = fs.readFileSync(MANAGER_HOMEPAGE, 'utf8');

  assert.match(ownerSource, /OwnerGovernanceWorkspace/, 'OwnerHomePage must import OwnerGovernanceWorkspace');
  assert.match(ownerSource, /<OwnerGovernanceWorkspace[\s/>]/, 'OwnerHomePage must mount <OwnerGovernanceWorkspace />');

  assert.match(managerSource, /OwnerGovernanceWorkspace/, 'ManagerHomePage must import OwnerGovernanceWorkspace');
  assert.match(managerSource, /<OwnerGovernanceWorkspace[\s/>]/, 'ManagerHomePage must mount <OwnerGovernanceWorkspace />');
});
