import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const dir = await mkdtemp(path.join(tmpdir(), 'kristou-footer-'));
after(() => rm(dir, { recursive: true, force: true }));
const outfile = path.join(dir, 'footer.cjs');
await build({ entryPoints: [new URL('../src/components/Footer.tsx', import.meta.url).pathname], outfile, bundle: true, platform: 'node', format: 'cjs',
  plugins: [{ name: 'context-fixture', setup(b) {
    b.onResolve({ filter: /context\/AppContext$/ }, () => ({ path: 'context', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export const useApp = () => ({language: 'en', t: key => key});" }));
    b.onResolve({ filter: /^[^./]/ }, args => ({ path: require.resolve(args.path), external: true }));
  } }],
});
const { Footer } = require(outfile);
function links(node) {
  if (Array.isArray(node)) return node.flatMap(links);
  if (!node || typeof node !== 'object') return [];
  return [...(node.type === 'a' ? [node] : []), ...links(node.props?.children)];
}
test('footer links invoke canonical page navigation rather than only changing hash', () => {
  const navigated = [];
  const anchors = links(Footer({ onNavigate: tab => navigated.push(tab) }));
  for (const a of anchors) {
    let prevented = false;
    a.props.onClick?.({ button: 0, preventDefault() { prevented = true; } });
    assert.equal(prevented, true, `${a.props.href} prevents hash-only navigation`);
  }
  assert.deepEqual(navigated, ['home', 'directory', 'foodMenu', 'registration']);
});
test('modified link clicks retain native browser navigation', () => {
  const anchors = links(Footer({ onNavigate() { assert.fail('must preserve modified click'); } }));
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    anchors[0].props.onClick?.({ button: 0, ...modifiers, preventDefault() { assert.fail('modified click prevented'); } });
  }
});
