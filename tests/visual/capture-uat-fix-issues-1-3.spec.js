// capture-uat-fix-issues-1-3.spec.js
// Captures PNGs for UAT fixes:
//   Issue 1 — Onboarding coachmark positioned near spotlight target
//   Issue 3 — Mobile navbar email hidden (no logo crush)
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '../../audit/png-uat-fix');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function setupCirclesHome(page, opts = {}) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.history || []) }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.history || []) }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // Add a fake user for navbar email test
  await page.route('**/api/me**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'albertpeng678@gmail.com' }) }));
  await page.addInitScript((flag) => {
    if (flag) localStorage.setItem('circles_onboarding_done', '1');
    else localStorage.removeItem('circles_onboarding_done');
  }, opts.flagSet || false);
  await page.goto('/');
  await page.waitForSelector('.qcard');
}

// ── Issue 3: navbar email hidden on mobile ────────────────────────────────────

test('Issue3 navbar mobile-360 — email hidden no logo crush', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('Mobile-360') && !testInfo.project.name.includes('iPhone-SE')) return;
  await page.setViewportSize({ width: 360, height: 780 });
  await setupCirclesHome(page, { flagSet: true });
  await page.screenshot({ path: path.join(OUT, 'issue-3-navbar-mobile.png') });
});

test('Issue3 navbar desktop-1280 — email visible control', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('Desktop-1280')) return;
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupCirclesHome(page, { flagSet: true });
  await page.screenshot({ path: path.join(OUT, 'issue-3-navbar-desktop.png') });
});

// ── Issue 1: coachmark positioned near spotlight target ───────────────────────

test('Issue1 coachmark step1 mobile-360 — tooltip near mode-section', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('Mobile-360') && !testInfo.project.name.includes('iPhone-SE')) return;
  await page.setViewportSize({ width: 360, height: 780 });
  await setupCirclesHome(page);
  await page.locator('[data-onb-action="start"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'issue-1-coachmark-step1-mobile.png') });
});

test('Issue1 coachmark step1 desktop-1280 — tooltip near mode-section', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('Desktop-1280')) return;
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupCirclesHome(page);
  await page.locator('[data-onb-action="start"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'issue-1-coachmark-step1-desktop.png') });
});

test('Issue1 coachmark step3 mobile-360 — tooltip near qcard', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('Mobile-360') && !testInfo.project.name.includes('iPhone-SE')) return;
  await page.setViewportSize({ width: 360, height: 780 });
  await setupCirclesHome(page);
  await page.locator('[data-onb-action="start"]').click();
  await page.waitForTimeout(200);
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-onb-action="next"]').click();
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: path.join(OUT, 'issue-1-coachmark-step3-mobile.png') });
});

test('Issue1 coachmark step3 desktop-1280 — tooltip near qcard', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('Desktop-1280')) return;
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupCirclesHome(page);
  await page.locator('[data-onb-action="start"]').click();
  await page.waitForTimeout(200);
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-onb-action="next"]').click();
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: path.join(OUT, 'issue-1-coachmark-step3-desktop.png') });
});
