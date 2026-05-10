// UAT fix Issue-A — NSM Step 1 empty-search width preservation
// Search is only in desktop shell (>=1024px). Bug (width collapse) only affects desktop.
// We capture: Desktop-1280 normal + empty-search (the bug viewport),
//             iPad + Mobile-360 normal state (reference, no search interaction).
const { test } = require('@playwright/test');
const fs = require('fs');

const TARGET_VIEWPORTS = ['Mobile-360', 'iPad', 'Desktop-1280'];

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function goToNSMStep1(page) {
  // Inject: skip onboarding + force view=nsm on init
  await page.addInitScript(() => {
    try { localStorage.setItem('circles_onboarding_done', '1'); } catch (_) {}
    // Patch AppState before first render by monkey-patching Object.defineProperty
    // Simpler: override via initScript to set state after load
    window.__FORCE_NSM_VIEW__ = true;
  });
  await page.goto('/');
  await page.waitForSelector('.qcard', { timeout: 8000 });
  // Try clicking NSM tab if visible; otherwise use JS to set AppState
  const nsmTabVisible = await page.locator('[data-nav="nsm"]').first().isVisible();
  if (nsmTabVisible) {
    await page.locator('[data-nav="nsm"]').first().click();
  } else {
    // Mobile: navbar tabs hidden — trigger view change via JS
    await page.evaluate(() => {
      if (window.AppState) {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 1;
        if (typeof window.__render === 'function') window.__render();
        else if (typeof window.render === 'function') window.render();
      }
    });
  }
  await page.waitForSelector('[data-nsm-step="1"]', { timeout: 5000 });
  await page.waitForTimeout(200);
}

test.describe('UAT Fix Issue-A — NSM Step 1 search empty width', () => {
  fs.mkdirSync('audit/png-uat-fix', { recursive: true });

  test('normal-state (no search)', async ({ page }, testInfo) => {
    if (!TARGET_VIEWPORTS.includes(testInfo.project.name)) return;
    await setupRoutes(page);
    await goToNSMStep1(page);
    await page.screenshot({
      path: `audit/png-uat-fix/issue-A-search-normal-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test('empty-search (0 results)', async ({ page }, testInfo) => {
    if (!TARGET_VIEWPORTS.includes(testInfo.project.name)) return;
    await setupRoutes(page);
    await goToNSMStep1(page);
    if (testInfo.project.name === 'Desktop-1280') {
      // Search only available on desktop
      const searchInput = page.locator('[data-nsm="search"]').first();
      await searchInput.fill('Lz99xyz');
      await page.waitForTimeout(300);
    }
    await page.screenshot({
      path: `audit/png-uat-fix/issue-A-search-empty-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});
