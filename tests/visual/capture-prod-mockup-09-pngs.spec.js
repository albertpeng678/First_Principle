// tests/visual/capture-prod-mockup-09-pngs.spec.js
// Capture production Offcanvas History renders across 8 viewports.
// Output: audit/png-prod-mockup-09/section-{A,B,C,D}-{vp}.png — 32 PNGs.
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/09-offcanvas-history.html
//
// Sections:
//   A — list with 4 badge variants (CIRCLES完成/NSM完成/drafts進行中/一般進行中)
//   B — empty state (no sessions)
//   C — loading state (historyLoading = true)
//   D — error state (historyError set)

const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../audit/png-prod-mockup-09');

// 4 badge variants per mockup 09 line 304:
// - CIRCLES 完成 navy (scored / step_scores.S.totalScore)
// - NSM 完成 navy (scores_json.totalScore)
// - drafts 進行中 yellow (status: active, mode: drill/sim)
// - 一般進行中 blue (status: active, NSM 4步進行中)
const SAMPLE_HISTORY_ITEMS = [
  // CIRCLES 完成 (navy score badge) — simulation completed
  {
    id: 'session-completed-circles',
    mode: 'simulation',
    drill_step: null,
    status: 'completed',
    total_score: null,
    step_scores: { S: { totalScore: 86, dimensions: [] } },
    scores_json: null,
    question_json: { company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
    currentQuestion: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // NSM 完成 (navy score badge) — NSM session scored
  {
    id: 'session-completed-nsm',
    mode: null,
    drill_step: null,
    status: 'completed',
    total_score: 92,
    step_scores: null,
    scores_json: { totalScore: 92, scores: {} },
    question_json: { company: 'Netflix', industry: '內容訂閱制' },
    currentQuestion: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // CIRCLES 進行中 drill (active draft badge)
  {
    id: 'session-active-drill',
    mode: 'drill',
    drill_step: 'C1',
    status: 'active',
    total_score: null,
    step_scores: null,
    scores_json: null,
    question_json: { company: 'Notion', product: '工作協作', question_type: 'design' },
    currentQuestion: null,
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  // NSM 進行中 (active NSM session badge)
  {
    id: 'session-active-nsm',
    mode: null,
    drill_step: null,
    status: 'active',
    total_score: null,
    step_scores: null,
    scores_json: null,
    question_json: { company: 'Airbnb', industry: '短期租賃平台' },
    currentQuestion: null,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  // CIRCLES simulation 進行中 (active sim session)
  {
    id: 'session-active-sim',
    mode: 'simulation',
    drill_step: null,
    status: 'active',
    total_score: null,
    step_scores: null,
    scores_json: null,
    question_json: { company: 'Line', product: 'Line Pay', question_type: 'improve' },
    currentQuestion: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  // CIRCLES drill 完成 with score (navy badge)
  {
    id: 'session-completed-drill',
    mode: 'drill',
    drill_step: 'I',
    status: 'scored',
    total_score: 78,
    step_scores: null,
    scores_json: null,
    question_json: { company: 'Grab', product: 'Food Delivery', question_type: 'improve' },
    currentQuestion: null,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

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

async function mockBaseApis(page) {
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('capture-prod-mockup-09 — 32 production PNGs', () => {
  test.setTimeout(240000);

  test('Section A — offcanvas list with 4 badge variants × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockBaseApis(page);
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAMPLE_HISTORY_ITEMS) }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAMPLE_HISTORY_ITEMS) }));

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      await page.evaluate((items) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: null,
          guestId: 'guest-test-001',
          offcanvasOpen: true,
          historyList: items,
          historyLoading: false,
          historyError: null,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, SAMPLE_HISTORY_ITEMS);

      await page.waitForSelector('.offcanvas-item', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-A-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section B — offcanvas empty state × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockBaseApis(page);
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      await page.evaluate(() => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: null,
          guestId: 'guest-test-001',
          offcanvasOpen: true,
          historyList: [],       // empty array = empty state
          historyLoading: false,
          historyError: null,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      });

      await page.waitForSelector('.offcanvas-empty', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-B-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section C — offcanvas loading state × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockBaseApis(page);
    await page.route('**/api/guest-circles-sessions**', () => { /* intentionally hang for loading state */ });
    await page.route('**/api/circles-sessions**', () => { /* intentionally hang for loading state */ });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // historyLoading = true → shows loading spinner
      await page.evaluate(() => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: null,
          guestId: 'guest-test-001',
          offcanvasOpen: true,
          historyList: null,     // null = not yet loaded
          historyLoading: true,
          historyError: null,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      });

      await page.waitForSelector('.offcanvas-loading', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-C-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section D — offcanvas error state × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockBaseApis(page);
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server error"}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server error"}' }));

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // historyError set → shows error panel
      await page.evaluate(() => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesSelectedQuestion: null,
          circlesSession: null,
          accessToken: null,
          guestId: 'guest-test-001',
          offcanvasOpen: true,
          historyList: null,
          historyLoading: false,
          historyError: 'LOAD_ERROR',
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      });

      await page.waitForSelector('.offcanvas-error', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-D-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });
});
