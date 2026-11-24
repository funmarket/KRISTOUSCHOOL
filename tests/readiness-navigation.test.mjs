import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { translations } from '../src/i18n/translations.ts';

const require = createRequire(import.meta.url);
const dir = await mkdtemp(path.join(tmpdir(), 'kristou-shell-about-'));
after(() => rm(dir, { recursive: true, force: true }));
const outfile = path.join(dir, 'public-home.cjs');

await build({
  entryPoints: [new URL('../src/components/homepages/PublicHomePage.tsx', import.meta.url).pathname],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  loader: { '.css': 'empty' },
  define: { __KRISTOU_SUPABASE_URL__: '""', __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '""' },
  plugins: [
    {
      name: 'context-fixture',
      setup(b) {
        b.onResolve({ filter: /context\/AppContext$/ }, () => ({ path: 'context', namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
          contents: 'export const useApp = () => globalThis.__UI_SHELL_ABOUT_CTX__;',
        }));
        b.onResolve({ filter: /^[^./]/ }, (args) => ({ path: require.resolve(args.path), external: true }));
      },
    },
  ],
});

const { PublicHomePage } = require(outfile);

function makeCtx(language, publicContent = {}) {
  const dict = translations[language];
  return {
    language,
    t: (key) => dict[key] ?? key,
    announcements: [],
    broadcastsStatus: 'READY',
    broadcastsError: null,
    foodMenu: { weekRange: '2026-09-14', items: [], isDemoPreview: false },
    foodMenuStatus: 'READY',
    foodMenuError: null,
    publicContent,
    publicContentStatus: 'READY',
    publicContentError: null,
    currentUser: null,
    refreshSchoolData: async () => true,
  };
}

test('AppShell removes the bottom website footer component', () => {
  assert.equal(
    fs.existsSync(new URL('../src/components/Footer.tsx', import.meta.url)),
    false,
    'src/components/Footer.tsx must be deleted',
  );
  const shellSrc = fs.readFileSync(new URL('../src/app/AppShell.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(shellSrc, /Footer/, 'AppShell.tsx must not import or mount Footer');
});

test('About KRISTOU section renders migrated Contact & Location and Web/Telegram/Security cards across EN/FR/AR without duplicating footer Navigation', () => {
  for (const lang of ['en', 'fr', 'ar']) {
    globalThis.__UI_SHELL_ABOUT_CTX__ = makeCtx(lang, {
      about: {
        slug: 'about',
        titleAr: 'نبذة معتمدة عن كريستو',
        titleFr: 'À propos approuvé KRISTOU',
        titleEn: 'Approved About KRISTOU',
        bodyAr: 'محتوى معتمد من إدارة المدرسة.',
        bodyFr: 'Contenu officiel approuvé par la direction.',
        bodyEn: 'Official school-approved introduction content.',
        isPublished: true,
      },
    });
    const rawHtml = renderToStaticMarkup(
      React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
    );
    const html = rawHtml.replaceAll('&amp;', '&');
    const dict = translations[lang];
    assert.ok(html.includes('data-testid="about-kristou-section"'), `${lang}: missing about-kristou-section`);
    assert.ok(html.includes('data-testid="about-kristou-intro-card"'), `${lang}: missing about-kristou-intro-card`);
    assert.ok(html.includes('data-testid="about-contact-location-card"'), `${lang}: missing about-contact-location-card`);
    assert.ok(html.includes('data-testid="about-platform-security-card"'), `${lang}: missing about-platform-security-card`);
    assert.ok(html.includes(globalThis.__UI_SHELL_ABOUT_CTX__.publicContent.about[lang === 'ar' ? 'titleAr' : lang === 'fr' ? 'titleFr' : 'titleEn']));
    assert.ok(html.includes(dict.contactLocation), `${lang}: missing contactLocation`);
    assert.ok(html.includes(dict.tunis), `${lang}: missing tunis`);
    assert.ok(html.includes('contact@kristou.edu.tn'), `${lang}: missing official email`);
    assert.ok(html.includes(dict.platformAccess), `${lang}: missing platformAccess`);
    assert.ok(html.includes(dict.platformDescription), `${lang}: missing platformDescription`);
    assert.ok(html.includes(dict.securityActive), `${lang}: missing securityActive`);
    assert.ok(html.includes('Web & Telegram'), `${lang}: missing Web & Telegram badge`);
    assert.ok(!html.includes('<footer'), `${lang}: must not render <footer>`);
    assert.ok(!html.includes(dict.allRights), `${lang}: must not render footer copyright`);
  }
});
