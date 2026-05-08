// tests/visual/capture-prod-mockup-03-pngs.spec.js
// Capture production Phase 1 Form renders across 8 viewports.
// Output: audit/png-prod-mockup-03/section-{A,B,C,D}-{vp}.png — 32 PNGs.
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html
//
// Sections:
//   A — drill mode C1 step (empty fields) — 4 standard fields visible
//   B — sim mode C1 step (filled fields) — content entered, save-indicator idle
//   C — sim mode L step (3 sol-cards) — L 提出方案 with 3 solutions
//   D — sim mode S step (4 tracking-cards) — S 量化策略 with tracking section

const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../audit/png-prod-mockup-03');

const SAMPLE_QUESTION = {
  id: 'circles_001',
  company: 'Spotify',
  product: 'Spotify Podcast',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並增加用戶的黏著度。',
};

const FILLED_DRAFT = {
  '問題範圍': '聚焦免費版的 Podcast 廣告體驗，排除付費訂閱和音樂部分。',
  '時間範圍': '60 天，廣告活動以月為週期，2 個月可看到穩定數據。',
  '業務影響': '廣告收入和免費→付費轉換率不能下降超過 3%，DAU 不能下跌。',
  '假設確認': '用戶廣告負感主要來自廣告打斷時機，而非廣告本身存在。',
};

const THREE_SOLUTIONS = [
  { name: '智慧廣告時機', mechanism: '偵測用戶暫停或節目章節分界點自動插廣，避免打斷心流，基於收聽行為 ML 模型。' },
  { name: '廣告免除卡', mechanism: '每月 3 次「跳過廣告」權益，用戶主動選擇在最不舒服的時刻使用，保留廣告曝光總量。' },
  { name: '品牌 Podcast 整合', mechanism: '廣告主將產品故事包裝成 podcast 節目，以內容形式呈現，不打斷收聽體驗。' },
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

test.describe('capture-prod-mockup-03 — 32 production PNGs', () => {
  test.setTimeout(240000);

  test('Section A — drill mode C1 empty × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      await page.evaluate((q) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'drill',
          circlesDrillStep: 'C1',
          circlesSimStep: 0,
          circlesSelectedQuestion: q,
          circlesSession: { id: 'test-session-drill-c1' },
          accessToken: null,
          guestId: 'guest-test-001',
          circlesFrameworkDraft: {},
          circlesChipExpanded: false,
          circlesPhase1SaveState: 'idle',
          circlesPhase1EmptyHint: false,
          circlesLocked: false,
          circlesStale: false,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, SAMPLE_QUESTION);

      await page.waitForSelector('[data-view="circles"]', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-A-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section B — sim mode C1 filled × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      await page.evaluate(({ q, draft }) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesDrillStep: null,
          circlesSimStep: 0, // C1 is step index 0
          circlesSelectedQuestion: q,
          circlesSession: { id: 'test-session-sim-c1' },
          accessToken: null,
          guestId: 'guest-test-001',
          circlesFrameworkDraft: { C1: draft },
          circlesChipExpanded: false,
          circlesPhase1SaveState: 'idle',
          circlesPhase1EmptyHint: false,
          circlesLocked: false,
          circlesStale: false,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, { q: SAMPLE_QUESTION, draft: FILLED_DRAFT });

      await page.waitForSelector('[data-view="circles"]', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-B-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section C — sim mode L step (3 sol-cards) × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // circlesSimStep: 4 → index 4 = 'L' in ['C1','I','R','C2','L','E','S']
      await page.evaluate(({ q, sols }) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesDrillStep: null,
          circlesSimStep: 4, // L step (index 4)
          circlesSelectedQuestion: q,
          circlesSession: { id: 'test-session-sim-l' },
          accessToken: null,
          guestId: 'guest-test-001',
          circlesFrameworkDraft: {},
          circlesChipExpanded: false,
          circlesPhase1SaveState: 'idle',
          circlesPhase1EmptyHint: false,
          circlesLocked: false,
          circlesStale: false,
          circlesPhase1Solutions: sols,
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, { q: SAMPLE_QUESTION, sols: THREE_SOLUTIONS });

      await page.waitForSelector('.sol-card', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-C-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section D — sim mode S step (4 tracking-cards) × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // circlesSimStep: 6 → index 6 = 'S' in ['C1','I','R','C2','L','E','S']
      await page.evaluate(({ q, sols }) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 1,
          circlesMode: 'simulation',
          circlesDrillStep: null,
          circlesSimStep: 6, // S step (index 6)
          circlesSelectedQuestion: q,
          circlesSession: { id: 'test-session-sim-s' },
          accessToken: null,
          guestId: 'guest-test-001',
          circlesFrameworkDraft: {},
          circlesChipExpanded: false,
          circlesPhase1SaveState: 'idle',
          circlesPhase1EmptyHint: false,
          circlesLocked: false,
          circlesStale: false,
          circlesPhase1Solutions: sols,
          circlesPhase1S: {
            recommendation: '建議優先推出智慧廣告時機功能，預計 60 天內將廣告負感率降低 15%。',
            reasoning: '廣告時機控制同時滿足用戶體驗和廣告主需求，實作成本中等且可快速 A/B 測試驗證效果。',
            nsm: '免費用戶月廣告完播率（目前 62% → 目標 75%）',
            tracking: {
              reach: '每月觸及廣告的活躍免費用戶數（MAU）',
              depth: '每次廣告平均完播率（完整聽完比例）',
              frequency: '每用戶每週平均收聽廣告次數',
              impact: '廣告體驗 NPS 分數（目標 +20 分）',
            },
          },
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, { q: SAMPLE_QUESTION, sols: THREE_SOLUTIONS });

      await page.waitForSelector('.tracking-section', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-D-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });
});
