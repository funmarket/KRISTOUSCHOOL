import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the real component. Only its context transport is substituted so no
// Auth sessions, hosted queries or browser storage are needed for this test.
const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(tmpdir(), 'kristou-public-home-'));
after(() => rm(temp, { recursive: true, force: true }));
const bundle = path.join(temp, 'public-home.cjs');
await build({
  entryPoints: [new URL('../src/components/homepages/PublicHomePage.tsx', import.meta.url).pathname],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  loader: { '.css': 'empty' },
  define: { __KRISTOU_SUPABASE_URL__: '""', __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '""' },
  plugins: [{
    name: 'context-and-external-dependencies',
    setup(builder) {
      builder.onResolve({ filter: /context\/AppContext$/ }, () => ({ path: 'context', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: 'export const useApp = () => ({...globalThis.__PUBLIC_HOME_TEST_CONTEXT__, t: (key) => key});',
      }));
      builder.onResolve({ filter: /^[^./]/ }, (args) => ({ path: require.resolve(args.path), external: true }));
    },
  }],
});
const { PublicHomePage } = require(bundle);

const notice = (id, extra = {}) => ({
  id, title: `NOTICE_${id}`, body: `BODY_${id}`, priority: 'NORMAL',
  authorName: 'School Office', authorRole: 'Administration', createdAt: '2026-11-14',
  status: 'PUBLISHED', audienceScope: 'PUBLIC_SITE', isPublic: true, ...extra,
});
function render(announcements, currentUser = null) {
  globalThis.__PUBLIC_HOME_TEST_CONTEXT__ = {
    language: 'en', announcements, broadcastsStatus: 'READY', currentUser,
    foodMenu: { id: 'empty', weekRange: 'Review', items: [], isDemoPreview: false },
  };
  return renderToStaticMarkup(React.createElement(PublicHomePage, {
    setActiveTab() {}, onOpenAuth() {},
  }));
}

test('Public Site excludes internal, draft, scheduled, revoked and class notices from signed-in data', () => {
  const hidden = [
    notice('internal', { audienceScope: 'ALL_SCHOOL', isPublic: false }),
    notice('level', { audienceScope: 'SELECTED_LEVELS', isPublic: false }),
    notice('draft', { status: 'DRAFT' }),
    notice('scheduled', { status: 'SCHEDULED' }),
    notice('revoked', { status: 'REVOKED' }),
    notice('class', { classId: 'private-class' }),
    notice('unapproved', { isPublic: false }),
    notice('legacy', { status: undefined, audienceScope: undefined, isPublic: undefined }),
  ];
  const html = render([notice('published'), ...hidden], {
    id: 'owner', role: 'APP_ADMIN', accountStatus: 'APPROVED',
  });
  assert.ok(html.includes('NOTICE_published'));
  for (const item of hidden) {
    assert.ok(!html.includes(item.title), `${item.id} must not appear on the Public Site`);
    assert.ok(!html.includes(item.body), `${item.id} body must not appear on the Public Site`);
  }
});

test('Public Site preserves labelled school-wide demo previews and excludes class demo content', () => {
  const html = render([
    notice('demo', { status: undefined, audienceScope: undefined, isPublic: undefined, isDemoPreview: true }),
    notice('class_demo', { classId: 'private-class', isDemoPreview: true }),
  ]);
  assert.ok(html.includes('NOTICE_demo'));
  assert.ok(!html.includes('NOTICE_class_demo'));
});

test('Public Site uses the same publication rules for visitors and approved school members', () => {
  const items = [notice('public'), notice('private', { audienceScope: 'ALL_SCHOOL', isPublic: false })];
  for (const actor of [null, { id: 'parent', role: 'PARENT', accountStatus: 'APPROVED' }]) {
    const html = render(items, actor);
    assert.ok(html.includes('NOTICE_public'));
    assert.ok(!html.includes('NOTICE_private'));
  }
});
