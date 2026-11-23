import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

test('FIX-03: Pickup operations fail closed with pickup_backend_unavailable and zero direct .from/.rpc calls', () => {
  const pickupViewSrc = fs.readFileSync(path.join(ROOT, 'src/components/views/PickupBoardView.tsx'), 'utf8');
  assert.match(pickupViewSrc, /pickup_backend_unavailable/);
  assert.doesNotMatch(pickupViewSrc, /\.from\s*\(|\.rpc\s*\(/);
});

test('FIX-03: PerformanceView and performance/* components render fail-closed unavailable state with zero write mutations', () => {
  const perfDir = path.join(ROOT, 'src/components/views/performance');
  assert.equal(fs.existsSync(perfDir), true);

  const files = fs.readdirSync(perfDir);
  for (const file of files) {
    const fullPath = path.join(perfDir, file);
    if (fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.doesNotMatch(content, /\.from\s*\(|\.rpc\s*\(/, `${file} must not contain direct database queries`);
      assert.doesNotMatch(content, /insert\s*\(|update\s*\(|delete\s*\(/i, `${file} must contain zero assessment write mutations`);
    }
  }

  const perfViewSrc = fs.readFileSync(path.join(ROOT, 'src/components/views/PerformanceView.tsx'), 'utf8');
  assert.doesNotMatch(perfViewSrc, /\.from\s*\(|\.rpc\s*\(/);
  assert.doesNotMatch(perfViewSrc, /insert\s*\(|update\s*\(|delete\s*\(/i);
});
