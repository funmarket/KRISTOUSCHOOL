/**
 * Real browser acceptance against the built application: no mocked components,
 * DOM scroll dimensions, account state or network responses.
 *
 * First run npm run build. Install Playwright/browser tooling outside the app,
 * then run node tests/browser/navbar-scroll-acceptance.mjs.
 * KRISTOU_PLAYWRIGHT_MODULE optionally points to that Playwright module.
 * KRISTOU_CHROMIUM_MODULE optionally supplies a headless Chromium distribution
 * exporting executablePath() and args (for restricted execution environments).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.KRISTOU_PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = await mkdtemp(path.join(tmpdir(), 'kristou-navbar-browser-'));
const port = Number(process.env.KRISTOU_TEST_PORT || 4177);
const url = `http://127.0.0.1:${port}`;
const launch = { headless: true };
if (process.env.KRISTOU_CHROMIUM_MODULE) {
  const { default: distribution } = await import(pathToFileURL(process.env.KRISTOU_CHROMIUM_MODULE).href);
  launch.executablePath = await distribution.executablePath();
  launch.args = distribution.args;
}
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
{ cwd: root, stdio: 'inherit' });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
let passed = 0;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error('Production preview server failed');
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await pause(100);
  }
  assert.ok(ready, 'Production preview must start');
  browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1024, height: 200 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  assert.match(await page.title(), /KRISTOU/);
  for (const language of ['fr', 'en', 'ar']) {
    await page.locator('header select').selectOption(language);
    for (const index of [1, 0]) {
      const trigger = page.locator('header button[aria-expanded]').nth(index);
      await trigger.hover();
      await page.waitForFunction((i) => document.querySelectorAll('header button[aria-expanded]')[i]
        .getAttribute('aria-expanded') === 'true', index);
      const card = trigger.locator('..').locator('.overflow-y-auto');
      const read = () => card.evaluate((element) => ({
        top: element.scrollTop, height: element.clientHeight, total: element.scrollHeight,
        focused: element === document.activeElement,
      }));
      const initial = await read();
      assert.ok(initial.total > initial.height, 'Short viewport must exercise actual overflow');
      assert.ok(initial.focused, 'Opening the menu must focus its native scroll region');
      await page.keyboard.press('ArrowDown');
      await pause(200);
      assert.ok((await read()).top > 0, 'Native ArrowDown must move the menu');
      await page.keyboard.press('ArrowUp');
      await pause(200);
      assert.equal((await read()).top, 0, 'Native ArrowUp must return to the top');
      await page.keyboard.press('PageDown');
      await pause(200);
      const afterPageDown = (await read()).top;
      assert.ok(afterPageDown > 0, 'Native PageDown must move the menu');
      await page.keyboard.press('PageUp');
      await pause(200);
      assert.ok((await read()).top < afterPageDown, 'Native PageUp must move upwards');
      await page.keyboard.press('Home');
      await pause(200);
      assert.equal((await read()).top, 0, 'Home must reach the top');
      await card.hover();
      await page.mouse.wheel(0, 120);
      await pause(200);
      assert.ok((await read()).top > 0, 'Real wheel input must move the menu');
      await page.keyboard.press('End');
      await pause(200);
      const bottom = await read();
      assert.equal(bottom.top, bottom.total - bottom.height, 'End must reach the bottom');
      await page.mouse.wheel(0, 600);
      await pause(200);
      assert.equal(await page.evaluate(() => window.scrollY), 0, 'Bottom boundary must not scroll the page');
      await page.keyboard.press('Home');
      await pause(200);
      await page.mouse.wheel(0, -600);
      await pause(200);
      assert.equal(await page.evaluate(() => window.scrollY), 0, 'Top boundary must not scroll the page');
      await page.screenshot({ path: path.join(evidence, `${language}-menu-${index}.png`) });
      await page.keyboard.press('Escape');
      await page.waitForFunction((i) => document.querySelectorAll('header button[aria-expanded]')[i]
        .getAttribute('aria-expanded') === 'false', index);
      assert.ok(await trigger.evaluate((element) => element === document.activeElement));
      await page.mouse.move(400, 180);
      console.log(`PASS ${language}: ${index === 1 ? 'profile' : 'notifications'} wheel, native keys, bounds and Escape`);
      passed++;
    }
  }
  await page.mouse.wheel(0, 300);
  await pause(200);
  assert.ok(await page.evaluate(() => window.scrollY) > 0, 'Page scrolling must resume after closing');
  assert.deepEqual(errors, []);
  await page.keyboard.press('Control+Home');
  await pause(200);
  await page.setViewportSize({ width: 1024, height: 600 });
  const desktopTrigger = page.locator('header button[aria-expanded]').nth(1);
  await desktopTrigger.hover();
  const desktopCard = desktopTrigger.locator('..').locator('.overflow-y-auto');
  await desktopCard.hover();
  await page.mouse.wheel(0, 300);
  await pause(200);
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  assert.ok((await desktopCard.boundingBox()).y + (await desktopCard.boundingBox()).height <= 600);
  await page.screenshot({ path: path.join(evidence, 'desktop-profile.png') });
  await page.keyboard.press('Escape');
  console.log('PASS normal desktop: menu remains in viewport; background stays still');
  passed++;
  await browser.close();
  browser = await chromium.launch(launch);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 320 }, isMobile: true, hasTouch: true });
  await mobile.goto(url);
  const trigger = mobile.locator('header button[aria-expanded]').nth(1);
  await trigger.tap();
  const card = trigger.locator('..').locator('.overflow-y-auto');
  await card.waitFor({ state: 'visible' });
  const box = await card.boundingBox();
  const cdp = await mobile.context().newCDPSession(mobile);
  const x = box.x + box.width / 2;
  const y = box.y + box.height - 25;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 15 }] });
    await pause(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(250);
  assert.ok(await card.evaluate((element) => element.scrollTop) > 0, 'Native touch gesture must move the menu');
  assert.equal(await mobile.evaluate(() => window.scrollY), 0);
  await mobile.screenshot({ path: path.join(evidence, 'mobile-profile.png') });
  console.log('PASS mobile: tap opens menu, native touch gesture scrolls it without moving page');
  passed++;
  console.log(`${passed} real browser scenarios passed; screenshots: ${evidence}`);
} finally {
  await browser?.close();
  server.kill();
}
