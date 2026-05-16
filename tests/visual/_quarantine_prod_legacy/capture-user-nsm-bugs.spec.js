// tests/visual/capture-user-nsm-bugs.spec.js
// One-shot evidence capture for 4 user-reported NSM bugs (2026-05-11).
// Logs in with real credentials against local dev server (port 4000) and
// captures homepage stats + NSM history offcanvas + restore-click landing +
// NSM phase 1 back-button presence at 3 viewports.
//
// Run: npx playwright test --config=tests/visual/playwright.config.js \
//   tests/visual/capture-user-nsm-bugs.spec.js \
//   --project=Mobile-360 --project=iPad --project=Desktop-1280

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '..', '..', 'audit', 'png-user-nsm-bugs');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

function vpSlug(testInfo) {
  return testInfo.project.name; // e.g. Mobile-360 / iPad / Desktop-1280
}

async function shot(page, name, testInfo) {
  const file = path.join(OUT_DIR, `${name}-${vpSlug(testInfo)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function loginAndLand(page) {
  await page.goto('/');
  // Wait for app to mount (qcard appears in default circles view, OR auth-card if not logged in)
  await page.waitForSelector('.qcard, .auth-card', { timeout: 15000 });

  // If we landed on a logged-in view (cookie persisted), force logout via state to ensure clean login flow.
  const authCardVisible = await page.locator('.auth-card').count();
  if (!authCardVisible) {
    // Open auth view via state — guarantees fresh login form.
    await page.evaluate(() => {
      window.AppState.accessToken = null;
      window.AppState.userEmail = null;
      window.AppState.view = 'auth';
      window.AppState.authTab = 'login';
      window.AppState.authLoading = false;
      window.AppState.authError = null;
      window.render();
    });
    await page.waitForSelector('.auth-card', { timeout: 5000 });
  }

  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pw').fill(PASSWORD);
  await page.locator('#auth-submit').click();

  // Wait for auth to complete — auth-card disappears, navbar email or qcard shows.
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('.qcard', { timeout: 10000 });
  // Give SSE / sessions list a moment to populate stats-strip + offcanvas data.
  await page.waitForTimeout(1500);
}

test.describe('User NSM bug visual evidence — login flow', () => {
  test.setTimeout(120000);

  test('capture 4 evidence PNGs (homepage stats / offcanvas / restore-click / nsm phase 1 back)', async ({ page }, testInfo) => {
    // ── Step 0: log in ─────────────────────────────────────────────────────
    await loginAndLand(page);

    // ── Step 1: homepage stats (CIRCLES + NSM strips, 進行中 X/Y) ──────────
    // Navigate to CIRCLES home first
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.render();
    });
    await page.waitForSelector('.qcard', { timeout: 5000 });
    await page.waitForTimeout(800);
    const shot1Circles = await shot(page, 'homepage-stats-circles', testInfo);
    console.log('PNG saved:', shot1Circles);

    // Switch to NSM home to capture NSM strip
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 1;
      window.render();
    });
    await page.waitForTimeout(800);
    const shot1Nsm = await shot(page, 'homepage-stats-nsm', testInfo);
    console.log('PNG saved:', shot1Nsm);

    // Combined homepage screenshot under canonical name (per task — uses NSM view since bug is about NSM count)
    const shot1Combined = await shot(page, 'homepage-stats', testInfo);
    console.log('PNG saved:', shot1Combined);

    // ── Step 2: open offcanvas history drawer ──────────────────────────────
    // Open via navbar offcanvas button
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-drawer', { timeout: 5000 });
    await page.waitForTimeout(800); // let drawer slide + items render
    const shot2 = await shot(page, 'nsm-history-offcanvas', testInfo);
    console.log('PNG saved:', shot2);

    // Capture record-count info for later report
    const offcanvasInfo = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.offcanvas-item'));
      return items.map(el => ({
        id: el.getAttribute('data-id'),
        title: el.querySelector('.offcanvas-item__title')?.textContent?.trim() || '',
        meta: el.querySelector('.offcanvas-item__meta')?.textContent?.trim() || '',
        date: el.querySelector('.offcanvas-item__date')?.textContent?.trim() || '',
      }));
    });
    console.log('OFFCANVAS_ITEMS_JSON:', JSON.stringify(offcanvasInfo));

    // Find the FIRST NSM item (meta contains "NSM")
    const nsmItemIndex = offcanvasInfo.findIndex(it => it.meta.includes('NSM'));
    if (nsmItemIndex === -1) {
      console.log('NO_NSM_ITEM_FOUND — skipping restore-click capture');
      return;
    }

    // ── Step 3: click first NSM record → capture landing ──────────────────
    await page.locator('.offcanvas-item').nth(nsmItemIndex).click();
    await page.waitForTimeout(1500); // allow restore navigation
    const shot3 = await shot(page, 'nsm-restore-after-click', testInfo);
    console.log('PNG saved:', shot3);

    // Capture landing-state diagnostic
    const landingState = await page.evaluate(() => {
      return {
        view: window.AppState?.view,
        nsmStep: window.AppState?.nsmStep,
        circlesView: window.AppState?.circlesView,
        nsmSessionId: window.AppState?.nsmSession?.id,
        visibleHeading: document.querySelector('.phase-head__title')?.textContent?.trim()
          || document.querySelector('h1, h2')?.textContent?.trim() || '',
        dataView: document.querySelector('[data-view]')?.getAttribute('data-view') || '',
        nsmStepAttr: document.querySelector('[data-nsm-step]')?.getAttribute('data-nsm-step') || '',
        backBtnPresent: !!document.querySelector('[data-nav="back"], .navbar__back, button[aria-label*="返回"], button[aria-label*="back" i]'),
        url: location.href,
      };
    });
    console.log('LANDING_STATE_JSON:', JSON.stringify(landingState));

    // ── Step 4: back button check at NSM phase 1 ───────────────────────────
    // If we did NOT land in phase 1, force navigate to phase 1 to inspect the back button design.
    if (landingState.view !== 'nsm' || landingState.nsmStep !== 1) {
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 1;
        window.render();
      });
      await page.waitForTimeout(600);
    }
    const shot4 = await shot(page, 'nsm-phase1-back-button', testInfo);
    console.log('PNG saved:', shot4);

    const backBtnState = await page.evaluate(() => {
      const candidates = [
        ...document.querySelectorAll('button, a'),
      ].filter(el => /返回|回|back|←|‹|chevron-left|arrow-left/i.test(
        (el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + el.className
      ));
      return candidates.slice(0, 6).map(el => ({
        text: el.textContent?.trim().slice(0, 30) || '',
        aria: el.getAttribute('aria-label') || '',
        cls: el.className,
        dataNav: el.getAttribute('data-nav') || '',
      }));
    });
    console.log('BACK_BTN_CANDIDATES_JSON:', JSON.stringify(backBtnState));
  });
});
