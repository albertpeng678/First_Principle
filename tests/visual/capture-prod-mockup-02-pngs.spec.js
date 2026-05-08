// tests/visual/capture-prod-mockup-02-pngs.spec.js
// Capture production Auth flow renders across 8 viewports.
// Output: audit/png-prod-mockup-02/section-{A,B,C}-{vp}.png — 24 PNGs.
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/02-auth-flow.html
//
// Sections:
//   A — guest home with sign-in icon visible in navbar (home view, guest state)
//   B — guest deep view (Phase 1 form entry) with sign-in icon + home icon visible
//   C — session-expired banner + sign-in prompt (banner--session displayed)

const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../audit/png-prod-mockup-02');

const SAMPLE_QUESTION = {
  id: 'circles_001',
  company: 'Spotify',
  product: 'Spotify Podcast',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並增加用戶的黏著度。',
};

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 900 },
  { name: 'iPhone-SE',     width: 375,  height: 900 },
  { name: 'iPhone-14',     width: 390,  height: 900 },
  { name: 'iPhone-15-Pro', width: 430,  height: 900 },
  { name: 'iPad',          width: 768,  height: 900 },
  { name: 'Desktop-1280',  width: 1280, height: 900 },
  { name: 'Desktop-1440',  width: 1440, height: 900 },
  { name: 'Desktop-2560',  width: 2560, height: 900 },
];

async function mockApis(page) {
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ completed: 0, active: 0, thisWeek: 0 }),
  }));
  await page.route('**/api/circles-stats**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ completed: 0, active: 0, thisWeek: 0 }),
  }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('capture-prod-mockup-02 — 24 production PNGs', () => {
  test.setTimeout(180000);

  test('Section A — guest home: sign-in icon in navbar × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // Guest home: no accessToken, no selectedQuestion, no session
      // Navbar should show sign-in icon (ph-sign-in) per mockup 01 line 1457-1493
      await page.evaluate(() => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesDrillStep: null,
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: null,
          guestId: 'guest-test-001',
          sessionExpired: false,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      });

      await page.waitForSelector('[data-nav="auth"]', { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-A-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section B — guest deep view (Phase 1 form): sign-in + home icons × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // Deep view guest: both sign-in + home visible (per app.js line 1495)
      await page.evaluate((q) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'drill',
          circlesDrillStep: 'C1',
          circlesSelectedQuestion: q,
          circlesSession: { id: 'test-session-01' },
          accessToken: null,
          guestId: 'guest-test-001',
          sessionExpired: false,
          circlesFrameworkDraft: {},
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, SAMPLE_QUESTION);

      await page.waitForSelector('[data-view="circles"]', { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-B-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section C — session-expired banner displayed × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // Session expired state: banner--session shown with 重新登入 CTA
      await page.evaluate(() => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesDrillStep: null,
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: null,
          guestId: null,
          sessionExpired: true,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      });

      await page.waitForSelector('.banner--session', { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-C-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });
});
