// Diagnostic test for scroll bug — collects computed overflow and scroll
// state on each major view, prints to stdout.
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:4000';

async function snapshot(page, label) {
  const data = await page.evaluate(() => {
    const b = document.body;
    const h = document.documentElement;
    const app = document.getElementById('app');
    const main = document.getElementById('main');
    return {
      body_inline_overflow: b.style.overflow || '(none)',
      body_computed_overflow: getComputedStyle(b).overflow,
      body_computed_overflowY: getComputedStyle(b).overflowY,
      body_dataView: b.dataset.view || '(unset)',
      html_computed_overflow: getComputedStyle(h).overflow,
      html_computed_overflowY: getComputedStyle(h).overflowY,
      app_computed_overflow: app ? getComputedStyle(app).overflow : '(no app)',
      main_computed_overflow: main ? getComputedStyle(main).overflow : '(no main)',
      body_height: Math.round(b.getBoundingClientRect().height),
      app_height: app ? Math.round(app.getBoundingClientRect().height) : 0,
      main_height: main ? Math.round(main.getBoundingClientRect().height) : 0,
      viewportInner: window.innerHeight,
      docScrollTop: h.scrollTop,
      bodyScrollTop: b.scrollTop,
      scrollMax: h.scrollHeight - h.clientHeight,
    };
  });
  console.log(`\n──── ${label} ────`);
  console.table(data);
}

async function tryWheel(page, label) {
  // Take note of html scroll position before/after wheel event
  const before = await page.evaluate(() => document.documentElement.scrollTop);
  await page.mouse.move(400, 300);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => document.documentElement.scrollTop);
  console.log(`[${label}] wheel test: scrollTop ${before} → ${after} (delta ${after - before})`);
}

test('diagnose scroll on home view', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await snapshot(page, 'HOME (initial)');
  await tryWheel(page, 'HOME');
});

test('diagnose scroll on circles view', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.navigate && window.navigate('circles'));
  await page.waitForTimeout(800);
  await snapshot(page, 'CIRCLES (home)');
  await tryWheel(page, 'CIRCLES');

  // Click first question card → enter Phase 1 form
  const firstCard = page.locator('.circles-q-card').first();
  if (await firstCard.count()) {
    await firstCard.click();
    await page.waitForTimeout(300);
    // confirm/start drill — try clicking confirm if present
    const confirm = page.locator('button:has-text("開始")').first();
    if (await confirm.count()) {
      await confirm.click();
      await page.waitForTimeout(600);
      await snapshot(page, 'CIRCLES (phase 1 form)');
      await tryWheel(page, 'CIRCLES P1');
    }
  }
});

test('diagnose scroll after offcanvas open/close cycle', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.openOffcanvas && window.openOffcanvas());
  await page.waitForTimeout(300);
  await snapshot(page, 'OFFCANVAS OPEN');
  await page.evaluate(() => window.closeOffcanvas && window.closeOffcanvas());
  await page.waitForTimeout(300);
  await snapshot(page, 'OFFCANVAS CLOSED');
  await tryWheel(page, 'AFTER OFFCANVAS');
});
