import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';

const dom = installNodeDomShim();
const { createRoot } = await import('react-dom/client');

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function bundleBottomNavAndTranslations() {
  const outdir = path.join('/tmp', 'kristou-bottom-nav-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const navOutfile = path.join(outdir, 'bottom-nav.cjs');
  const i18nOutfile = path.join(outdir, 'translations.cjs');

  await build({
    entryPoints: [path.join(ROOT, 'src/i18n/translations.ts')],
    outfile: i18nOutfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });

  await build({
    entryPoints: [path.join(ROOT, 'src/components/BottomNavBar.tsx')],
    outfile: navOutfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    plugins: [
      {
        name: 'external-pkgs',
        setup(builder) {
          builder.onResolve({ filter: /^[^./]/ }, (args) => ({
            path: require.resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  });

  return { ...require(navOutfile), ...require(i18nOutfile) };
}

const { BottomNavBar, translations } = await bundleBottomNavAndTranslations();

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    username: 'parent.kristou',
    fullName: 'Parent User',
    role: 'PARENT',
    accountStatus: 'APPROVED',
    capabilities: [],
    ...overrides,
  };
}

function makeTranslator(locale) {
  return (key) => translations[locale][key];
}

function dispatchWindowScroll(y, { innerHeight = 800, scrollHeight = 2400 } = {}) {
  dom.window.scrollY = y;
  dom.window.innerHeight = innerHeight;
  dom.document.documentElement.scrollTop = y;
  dom.document.documentElement.scrollHeight = scrollHeight;
  dom.window.dispatchEvent(new dom.window.Event('scroll'));
}

test('BottomNavBar ownership boundaries and line-count constraints', () => {
  const srcPath = path.join(ROOT, 'src/components/BottomNavBar.tsx');
  const src = fs.readFileSync(srcPath, 'utf8');
  const lines = src.split('\n').length - (src.endsWith('\n') ? 1 : 0);

  assert.ok(lines <= 220, `BottomNavBar.tsx must be <= 220 lines (got ${lines})`);
  assert.doesNotMatch(src, /useApp\(/, 'BottomNavBar.tsx must not call useApp()');
  assert.doesNotMatch(src, /from ['"].*\/context\//, 'BottomNavBar.tsx must not import from src/context/');
  assert.doesNotMatch(src, /from ['"].*\/lib\//, 'BottomNavBar.tsx must not import from src/lib/');
  assert.doesNotMatch(src, /localStorage/, 'BottomNavBar.tsx must not touch localStorage');
  assert.doesNotMatch(src, /\.(from|rpc)\(/, 'BottomNavBar.tsx must not contain direct .from( or .rpc( calls');
});

test('BottomNavBar renders EN, FR, and AR labels in fixed left-to-right dir="ltr" order', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  const expectedByLocale = {
    en: ['Home', 'Pick-Up', 'Calendar', 'Teachers'],
    fr: ['Accueil', 'Sorties', 'Calendrier', 'Enseignants'],
    ar: ['الرئيسية', 'استلام', 'التقويم', 'المعلمون'],
  };

  for (const [locale, expectedLabels] of Object.entries(expectedByLocale)) {
    await act(async () => {
      root.render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          currentUser: makeUser(),
          t: makeTranslator(locale),
          onSelectTab: () => {},
          onNavigateToSubTab: () => {},
        }),
      );
    });

    const nav = container.querySelector('[data-testid="bottom-nav-bar"]');
    assert.ok(nav, `Expected bottom-nav-bar for locale ${locale}`);
    assert.equal(nav.getAttribute('dir'), 'ltr', `BottomNavBar dir must stay ltr for locale ${locale}`);

    const buttons = [...nav.querySelectorAll('button')];
    assert.deepEqual(
      buttons.map((b) => b.textContent),
      expectedLabels,
      `Expected exact left-to-right labels for locale ${locale}`,
    );
    assert.equal(buttons[0].getAttribute('aria-current'), 'page');
  }

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('BottomNavBar invokes exact routing callbacks and marks active destination', async () => {
  const tabCalls = [];
  const subTabCalls = [];
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  const renderWithTab = async (activeTab) => {
    await act(async () => {
      root.render(
        React.createElement(BottomNavBar, {
          activeTab,
          currentUser: makeUser({ role: 'TEACHER' }),
          t: makeTranslator('en'),
          onSelectTab: (tab) => tabCalls.push(tab),
          onNavigateToSubTab: (tab, subTab) => subTabCalls.push([tab, subTab]),
        }),
      );
    });
  };

  await renderWithTab('home');
  await act(async () => {
    container.querySelector('[data-testid="bottom-nav-item-home"]').click();
    container.querySelector('[data-testid="bottom-nav-item-pickup"]').click();
    container.querySelector('[data-testid="bottom-nav-item-announcements"]').click();
    container.querySelector('[data-testid="bottom-nav-item-directory"]').click();
  });

  assert.deepEqual(tabCalls, ['home', 'pickup']);
  assert.deepEqual(subTabCalls, [
    ['announcements', 'calendar'],
    ['directory', 'teachers'],
  ]);

  await renderWithTab('pickup');
  assert.equal(
    container.querySelector('[data-testid="bottom-nav-item-pickup"]').getAttribute('aria-current'),
    'page',
  );
  await renderWithTab('announcements');
  assert.equal(
    container.querySelector('[data-testid="bottom-nav-item-announcements"]').getAttribute('aria-current'),
    'page',
  );
  await renderWithTab('directory');
  assert.equal(
    container.querySelector('[data-testid="bottom-nav-item-directory"]').getAttribute('aria-current'),
    'page',
  );

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('BottomNavBar enforces role and accountStatus visibility gates', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  for (const user of [
    null,
    makeUser({ accountStatus: 'PENDING' }),
    makeUser({ accountStatus: 'REJECTED' }),
    makeUser({ accountStatus: 'REVOKED' }),
  ]) {
    await act(async () => {
      root.render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          currentUser: user,
          t: makeTranslator('en'),
          onSelectTab: () => {},
          onNavigateToSubTab: () => {},
        }),
      );
    });
    assert.equal(container.querySelector('[data-testid="bottom-nav-bar"]'), null);
  }

  for (const role of ['PARENT', 'TEACHER', 'APP_ADMIN']) {
    await act(async () => {
      root.render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          currentUser: makeUser({ role }),
          t: makeTranslator('en'),
          onSelectTab: () => {},
          onNavigateToSubTab: () => {},
        }),
      );
    });
    const buttons = [...container.querySelectorAll('[data-testid="bottom-nav-bar"] button')];
    assert.deepEqual(
      buttons.map((b) => b.textContent),
      ['Home', 'Pick-Up', 'Calendar', 'Teachers'],
      `Expected 4 tabs for ${role}`,
    );
  }

  await act(async () => {
    root.render(
      React.createElement(BottomNavBar, {
        activeTab: 'home',
        currentUser: makeUser({ role: 'STUDENT', capabilities: ['STUDENT'] }),
        t: makeTranslator('en'),
        onSelectTab: () => {},
        onNavigateToSubTab: () => {},
      }),
    );
  });
  const studentButtons = [...container.querySelectorAll('[data-testid="bottom-nav-bar"] button')];
  assert.deepEqual(
    studentButtons.map((b) => b.textContent),
    ['Home', 'Calendar', 'Teachers'],
    'STUDENT without pickup access must see 3 tabs without Pick-Up',
  );
  assert.equal(container.querySelector('[data-testid="bottom-nav-item-pickup"]'), null);

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('BottomNavBar hides on window scroll-down, reveals on scroll-up/bottom, and resets on activeTab change', async () => {
  dom.window.scrollY = 0;
  dom.window.innerHeight = 800;
  dom.document.documentElement.scrollTop = 0;
  dom.document.documentElement.scrollHeight = 2400;

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  const renderTab = async (activeTab) => {
    await act(async () => {
      root.render(
        React.createElement(BottomNavBar, {
          activeTab,
          currentUser: makeUser(),
          t: makeTranslator('en'),
          onSelectTab: () => {},
          onNavigateToSubTab: () => {},
        }),
      );
    });
  };

  await renderTab('home');
  const getNav = () => container.querySelector('[data-testid="bottom-nav-bar"]');
  assert.equal(getNav().getAttribute('data-hidden'), 'false');

  // Scroll down past threshold -> hides
  await act(async () => {
    dispatchWindowScroll(140);
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(getNav().getAttribute('data-hidden'), 'true');

  // Scroll up -> reveals
  await act(async () => {
    dispatchWindowScroll(110);
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(getNav().getAttribute('data-hidden'), 'false');

  // Scroll down again -> hides, then scroll to bottom -> reveals
  await act(async () => {
    dispatchWindowScroll(300);
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(getNav().getAttribute('data-hidden'), 'true');

  await act(async () => {
    dispatchWindowScroll(1590, { innerHeight: 800, scrollHeight: 2400 });
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(getNav().getAttribute('data-hidden'), 'false');

  // Scroll back near top, then scroll down again to hide, then change activeTab -> resets to visible
  await act(async () => {
    dispatchWindowScroll(100, { innerHeight: 800, scrollHeight: 2400 });
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    dispatchWindowScroll(400, { innerHeight: 800, scrollHeight: 2400 });
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(getNav().getAttribute('data-hidden'), 'true');

  await renderTab('directory');
  assert.equal(getNav().getAttribute('data-hidden'), 'false');

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ADMIN-PICKUP-01 — BottomNavBar renders Pick-Up tab for approved ADMINISTRATIVE_PERSONNEL regardless of capabilities and denies non-approved', async () => {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);
  const tabCalls = [];

  for (const capabilities of [['ADMINISTRATIVE_PERSONNEL'], [], undefined]) {
    await act(async () => {
      root.render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          currentUser: makeUser({ role: 'ADMINISTRATIVE_PERSONNEL', capabilities }),
          t: makeTranslator('en'),
          onSelectTab: (tab) => tabCalls.push(tab),
          onNavigateToSubTab: () => {},
        }),
      );
    });

    const buttons = [...container.querySelectorAll('[data-testid="bottom-nav-bar"] button')];
    assert.deepEqual(
      buttons.map((b) => b.textContent),
      ['Home', 'Pick-Up', 'Calendar', 'Teachers'],
      `Expected Pick-Up tab for APPROVED ADMINISTRATIVE_PERSONNEL with capabilities=${JSON.stringify(capabilities)}`,
    );
    assert.ok(container.querySelector('[data-testid="bottom-nav-item-pickup"]'));
  }

  await act(async () => {
    container.querySelector('[data-testid="bottom-nav-item-pickup"]').click();
  });
  assert.deepEqual(tabCalls, ['pickup']);

  for (const accountStatus of ['PENDING', 'SUSPENDED', 'REJECTED', 'REVOKED']) {
    await act(async () => {
      root.render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          currentUser: makeUser({ role: 'ADMINISTRATIVE_PERSONNEL', accountStatus, capabilities: [] }),
          t: makeTranslator('en'),
          onSelectTab: () => {},
          onNavigateToSubTab: () => {},
        }),
      );
    });
    assert.equal(container.querySelector('[data-testid="bottom-nav-bar"]'), null);
  }

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});
