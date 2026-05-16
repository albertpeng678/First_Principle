// @ts-check
// Stage 1C Task 3 — Visual regression spec (RED phase)
// B5-AC5: 6 snapshot (closed/open × 3 vp) pixel-diff 0.005 baseline.
// Snapshots NOT generated yet; RED until Task 6 GREEN capture.
const { test, expect } = require('@playwright/test');
const { CirclesPhase2QchipComponent } = require('../page-objects/circles-phase2-qchip.component');

const SAMPLE_QUESTION = {
  id: 'q-test-visual-01',
  company: 'Spotify',
  product: 'Podcast',
  industry: 'streaming',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個新功能，提升 Spotify Podcast 黏著度',
};

async function mockApis(page) {
  await page.route('**/api/guest-circles-stats**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/circles-stats**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

/** Navigate to Phase 2 normal state (C1, no prior conversation). */
async function enterPhase2Normal(page) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate((q) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 2,
      circlesSession: { id: 'visual-test-session-001' },
      circlesSelectedQuestion: q,
      circlesDrillStep: 'C1',
      circlesConversation: [],
      circlesMode: 'drill',
    });
    window.renderApp();
  }, SAMPLE_QUESTION);
  await expect(page.locator('[data-view="circles"][data-phase="2"]')).toBeVisible({ timeout: 5000 });
}

const VIEWPORTS = [
  { name: 'mobile',  width: 360,  height: 880 },
  { name: 'tablet',  width: 768,  height: 880 },
  { name: 'desktop', width: 1280, height: 880 },
];

for (const vp of VIEWPORTS) {
  test.describe(`phase2 qchip — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`closed snapshot — ${vp.name}`, async ({ page }) => {
      await enterPhase2Normal(page);
      await expect(page).toHaveScreenshot(`phase2-qchip-closed-${vp.name}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: 'disabled',
        fullPage: false,
      });
    });

    test(`open snapshot — ${vp.name}`, async ({ page }) => {
      await enterPhase2Normal(page);
      const q = new CirclesPhase2QchipComponent(page);
      await q.open();
      await expect(page).toHaveScreenshot(`phase2-qchip-open-${vp.name}.png`, {
        maxDiffPixelRatio: 0.005,
        animations: 'disabled',
        fullPage: false,
      });
    });
  });
}
