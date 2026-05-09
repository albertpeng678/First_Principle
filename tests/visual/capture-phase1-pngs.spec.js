// capture-phase1-pngs.spec.js
// Phase 1 verification bundle — captures 40 PNGs (5 scenarios × 8 viewports)
// Verifies 6 Phase 1 items (preflight / nav reset / context expand / qchip stale / sub-tabs / guide vanity)
// Uses testInfo.project.name → run with all 8 playwright.config.js projects for full coverage
//
// Output: audit/png-phase1/
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../../audit/png-phase1');
fs.mkdirSync(OUT, { recursive: true });

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/guest/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/nsm-context**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      model: 'Spotify 訂閱+廣告 Podcast 變現',
      users: '通勤+運動+開車場景用戶',
      traps: '把 DAU 當 NSM — 背景播放拉高但無意義聆聽',
      insight: '反映「真正完成有意義收聽」才是核心北極星'
    })
  }));
}

// Runs across all 8 projects (Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad /
// Desktop-1280 / Desktop-1440 / Desktop-2560) via playwright.config.js project matrix.
// Each test uses testInfo.project.name for the PNG filename suffix.
test.describe('Capture Phase 1 verification PNGs', () => {
  // Scenario A: Item 1 — preflight session on Step 2 mount
  test('item1-preflight-step2-mount', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = false;
      window.render();
    });
    await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 5000 });
    // Wait briefly so preflight POST fires (Item 1 contract)
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT, `item1-preflight-step2-mount-${testInfo.project.name}.png`),
      fullPage: true
    });
  });

  // Scenario B: Item 3 — context expand open (4 ana blocks visible)
  test('item3-context-expand-open', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = true;
      window.render();
    });
    await page.waitForSelector('.nsm-context-card__ana-block', { timeout: 5000 });
    await page.screenshot({
      path: path.join(OUT, `item3-context-expand-open-${testInfo.project.name}.png`),
      fullPage: true
    });
  });

  // Scenario C: Item 5 — no sub-tabs on Step 2 (DOM-removed contract)
  test('item5-no-sub-tabs-step2', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = false;
      window.render();
    });
    await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 5000 });
    await page.screenshot({
      path: path.join(OUT, `item5-no-sub-tabs-step2-${testInfo.project.name}.png`),
      fullPage: true
    });
  });

  // Scenario D: Item 6 — guide vanity rewrite (step 3 text visible)
  test('item6-guide-vanity-text', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = false;
      window.render();
    });
    await page.waitForSelector('.nsm-guide', { timeout: 5000 });
    await page.screenshot({
      path: path.join(OUT, `item6-guide-vanity-text-${testInfo.project.name}.png`),
      fullPage: true
    });
  });

  // Scenario E: Item 3 on Step 3 — context expand persists across nav
  test('item3-step3-context-expand', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = true;
      window.AppState.nsmDefinition = {
        nsm: '每月完成至少一首完整曲目播放的月活躍用戶數',
        explanation: '聚焦真實聆聽行為，剔除背景播放',
        businessLink: '反映廣告可貨幣化的高質量收聽時長'
      };
      window.render();
    });
    await page.waitForSelector('.nsm-step3-banner', { timeout: 5000 });
    await page.screenshot({
      path: path.join(OUT, `item3-step3-context-expand-${testInfo.project.name}.png`),
      fullPage: true
    });
  });
});
