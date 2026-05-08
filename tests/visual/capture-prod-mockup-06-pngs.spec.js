// tests/visual/capture-prod-mockup-06-pngs.spec.js
// Capture production NSM Step 1 renders across 8 viewports.
// Output: audit/png-prod-mockup-06/section-{A,B,C}-{vp}.png — 24 PNGs.
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/06-nsm-step-1.html
//
// Sections:
//   A — 5 q-cards, no selection (list empty state — choose a question)
//   B — 1 q-card selected and expanded (in-place context block + start button enabled)
//   C — question selected with context loaded (4-field context block visible)

const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../audit/png-prod-mockup-06');

// Use first 5 NSM questions from nsm-db.js data structure
// These will be seeded via nsmDisplayedQuestions
const SAMPLE_NSM_QUESTIONS = [
  {
    id: 'q1',
    company: 'Netflix',
    industry: '內容訂閱制',
    scenario: '影音串流平台競爭激烈，必須確保用戶持續感受到內容價值以維持自動扣款。',
    coach_nsm: '訂閱用戶每月活躍觀看時長',
    anti_patterns: ['App下載數', '註冊數'],
    context: {
      model: 'Netflix 透過訂閱制向用戶收取月費，提供無限次觀看其豐富的影音內容庫。',
      users: '主要用戶群是尋求娛樂的消費者，他們使用 Netflix 來觀看電影和電視劇，滿足休閒娛樂需求。',
      traps: '把「DAU」或「App 打開次數」當 NSM——這些指標只顯示用戶進入平台，但無法證明他們實際消費了內容或感受到價值。',
      insight: '真正的價值來自於用戶花費時間深度消費內容，這直接指向 NSM 應該捕捉用戶在平台上觀看內容的持續時間，而非僅僅是訪問次數。',
    },
  },
  {
    id: 'q2',
    company: '蝦皮購物',
    industry: '雙邊電商平台',
    scenario: '已過補貼獲客期，現需提升買賣雙方黏著度，確保平台真實交易流通。',
    coach_nsm: '每月成功完成無退貨訂單數',
    anti_patterns: ['DAU', '總流量', '商品上架數'],
    context: {
      model: '蝦皮購物是連結買家和賣家的雙邊電商平台，通過交易成功後的佣金抽成獲得收入。',
      users: '買家希望找到物美價廉的商品，賣家希望增加銷售額和曝光，平台需平衡兩端需求。',
      traps: '只看 DAU 或流量容易被補貼驅動的虛假活躍誤導，真實健康指標必須體現實際交易完成度。',
      insight: '電商平台價值在交易撮合，NSM 必須反映真正完成的健康交易數量，而非表面的訪問量或商品上架。',
    },
  },
  {
    id: 'q3',
    company: 'Booking.com',
    industry: '旅遊預訂平台',
    scenario: '旅遊市場競爭白熱化，需要找到衡量真實用戶價值的核心指標，超越純訂房轉換。',
    coach_nsm: '每月完成住宿並無取消的訂房數',
    anti_patterns: ['網頁瀏覽量', '搜尋次數'],
    context: {
      model: 'Booking.com 作為旅遊預訂中介，連接旅行者和住宿提供者，按成功預訂抽取佣金。',
      users: '計畫旅行的用戶希望找到合適的住宿並完成預訂，住宿提供者希望提高入住率。',
      traps: '看搜尋次數或頁面瀏覽忽略了真正的轉換——用戶可能瀏覽很多卻不訂房，或訂了卻取消。',
      insight: '旅遊平台的核心是促成真實的旅行發生，NSM 必須捕捉實際完成且未取消的住宿預訂。',
    },
  },
  {
    id: 'q5',
    company: 'Notion',
    industry: 'SaaS 知識協作',
    scenario: '工作場所數位化加速，Notion 需要超越純「筆記軟體」定位，鞏固團隊協作入口地位。',
    coach_nsm: '每月完成跨成員協作互動的工作區數',
    anti_patterns: ['總頁面數', '用戶登入次數', 'DAU'],
    context: {
      model: 'Notion 是 SaaS 協作工具，採用席次計費，核心價值在於讓團隊在統一平台上管理知識和工作流。',
      users: '知識工作者和團隊，從個人筆記用戶到大型企業團隊，需要組織信息並協作完成工作。',
      traps: '只看登入次數或頁面數會被單人使用者稀釋，Notion 的核心差異在於協作，NSM 需捕捉真實的多人互動。',
      insight: 'SaaS 工具的黏著力體現在「嵌入工作流」，Notion 的 NSM 必須反映跨成員的真實協作行為。',
    },
  },
  {
    id: 'q7',
    company: 'Descript',
    industry: '創作者工具',
    scenario: '音頻和視頻內容創作市場快速增長，Descript 需要找到能衡量其核心價值主張的 NSM。',
    coach_nsm: '每月完成並發佈至少一個音/視頻項目的創作者數',
    anti_patterns: ['項目創建數', '登入次數'],
    context: {
      model: 'Descript 是面向播客和視頻創作者的編輯工具，以訂閱制收費，核心功能是簡化音視頻編輯流程。',
      users: '播客主持人、YouTuber、企業內容團隊，他們需要高效地編輯和發布音視頻內容。',
      traps: '只看項目創建數會包含大量從未完成的草稿，真正的價值在於創作者能成功發布和分享內容。',
      insight: '創作工具的核心價值在於幫助用戶完成完整的創作閉環，NSM 必須捕捉從創建到發布的完整流程。',
    },
  },
];

const SELECTED_QUESTION = SAMPLE_NSM_QUESTIONS[0]; // Netflix selected

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
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // Block context API to avoid loading state
  await page.route('**/api/nsm-context**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

test.describe('capture-prod-mockup-06 — 24 production PNGs', () => {
  test.setTimeout(180000);

  test('Section A — NSM Step 1: 5 q-cards no selection × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      await page.evaluate((qs) => {
        Object.assign(window.AppState, {
          view: 'nsm',
          nsmStep: 1,
          nsmSelectedQuestion: null,
          nsmDisplayedQuestions: qs,
          nsmContext: null,
          nsmContextLoading: false,
          nsmTypeFilter: 'all',
          nsmSearchText: '',
          accessToken: null,
          guestId: 'guest-test-001',
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, SAMPLE_NSM_QUESTIONS);

      await page.waitForSelector('[data-nsm-step="1"]', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-A-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section B — NSM Step 1: 1 q-card selected (in-place expand) × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // Selected question has pregenerated context (model/users/traps/insight),
      // so context block shows immediately without fetch
      await page.evaluate(({ qs, sel }) => {
        Object.assign(window.AppState, {
          view: 'nsm',
          nsmStep: 1,
          nsmSelectedQuestion: sel,
          nsmDisplayedQuestions: qs,
          nsmContext: null,       // pregenerated context via sel.context
          nsmContextLoading: false,
          nsmTypeFilter: 'all',
          nsmSearchText: '',
          accessToken: null,
          guestId: 'guest-test-001',
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, { qs: SAMPLE_NSM_QUESTIONS, sel: SELECTED_QUESTION });

      await page.waitForSelector('[data-nsm-step="1"][data-nsm-selected]', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-B-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });

  test('Section C — NSM Step 1: selected + context block visible × 8 viewports', async ({ page }) => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    await mockApis(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('.navbar');

      // Use Booking.com (index 2) — transaction type for variety
      const bookingQ = SAMPLE_NSM_QUESTIONS[2];
      await page.evaluate(({ qs, sel }) => {
        Object.assign(window.AppState, {
          view: 'nsm',
          nsmStep: 1,
          nsmSelectedQuestion: sel,
          nsmDisplayedQuestions: qs,
          nsmContext: null,       // pregenerated context via sel.context
          nsmContextLoading: false,
          nsmTypeFilter: 'all',
          nsmSearchText: '',
          accessToken: null,
          guestId: 'guest-test-001',
          onboardingComplete: true,
          onboardingActive: false,
        });
        window.renderApp();
      }, { qs: SAMPLE_NSM_QUESTIONS, sel: bookingQ });

      await page.waitForSelector('[data-nsm-step="1"][data-nsm-selected]', { timeout: 5000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'section-C-' + vp.name + '.png'),
        fullPage: false,
      });
    }
  });
});
