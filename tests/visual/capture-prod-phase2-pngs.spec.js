// Capture production Phase 2 Chat renders for Sections A + B across 3 viewports.
// Output: audit/png-prod-mockup-05/section-{A,B}-{mobile,tablet,desktop}.png — 6 PNGs.
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../audit/png-prod-mockup-05');

const SAMPLE_QUESTION = {
  id: 'q-test-01',
  company: 'Spotify',
  product: 'Podcast',
  industry: 'streaming',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存',
};

const SAMPLE_CONVERSATION = [
  {
    userMessage: '這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？',
    interviewee: '只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。',
    coaching: '好的開頭問題。同時釐清「涵蓋範圍」與「目標族群」，避免後續分析展開時邊界模糊。',
    hint: '可追問「為什麼是新用戶 而不是 power user」。',
  },
  {
    userMessage: '那我們希望看到的具體行為改變是什麼？是 DAU、收聽時長、還是完播率？',
    interviewee: '7 日留存率（從 18% 到 25%）。次指標是平均收聽時長 ≥ 15 分鐘的用戶比例。',
    coaching: '指標問得很到位 — 主+次的層次分明。下一輪可以追問「目前哪些行為先發生才能達到 7 日留存？」',
    hint: '可問「新用戶 Day 1 通常會做什麼動作」。',
  },
];

const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'desktop', width: 1280, height: 900 },
];

async function mockApis(page) {
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe.configure({ mode: 'serial' });

const SAMPLE_CONVERSATION_3 = [
  ...SAMPLE_CONVERSATION,
  {
    userMessage: '那業務上有什麼限制？例如不能改首頁、不能動付費機制？',
    interviewee: '主要限制是不能動付費訂閱流程，首頁可以改但需要設計審核。不可改的還有 podcast 授權協議相關功能。',
    coaching: '很好，已經把業務約束框清楚了。',
    hint: '可以再問預算和時間 constraint。',
  },
];

const CONCLUSION_DRAFT = '問題範圍：聚焦免費 podcast 用戶在新用戶階段的 7 日留存（不含付費 / 不含音樂類）；時間框架：H2 內看到 18%→25% 提升；業務約束：不可動付費機制。';

test('capture production Phase 2 Sections A + B — 6 PNGs', async ({ page }) => {
  test.setTimeout(120000);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  await mockApis(page);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await page.waitForSelector('.navbar');

    // ── Section A: empty chat ──
    await page.evaluate((q) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 'test-session' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: [],
        circlesMode: 'drill',
        circlesPhase2CoachHintExpanded: {},
      });
      window.renderApp();
    }, SAMPLE_QUESTION);
    await page.waitForSelector('[data-view="circles"][data-phase="2"]', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'section-A-' + vp.name + '.png'), fullPage: false });

    // ── Section B: 2-turn conversation ──
    await page.evaluate((conv) => {
      window.AppState.circlesConversation = conv;
      window.renderApp();
    }, SAMPLE_CONVERSATION);
    await page.waitForSelector('.bubble--user', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'section-B-' + vp.name + '.png'), fullPage: false });
  }
});

test('capture production Phase 2 Sections C + D + E + F — 12 PNGs', async ({ page }) => {
  test.setTimeout(120000);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  await mockApis(page);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await page.waitForSelector('.navbar');

    // ── Section C: streaming state (3-dot bubble) ──
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 'test-session' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2CoachHintExpanded: {},
        circlesPhase2Streaming: true,
        circlesPhase2StreamingTurn: { userMessage: '那業務上有什麼限制？例如不能改首頁、不能動付費機制？', deltaText: '' },
        circlesPhase2StreamError: false,
        circlesPhase2ConclusionMode: false,
        circlesStepScores: {},
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION });
    await page.waitForSelector('.bubble__streaming', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'section-C-' + vp.name + '.png'), fullPage: false });

    // ── Section D: turns ≥ 3, submit pill ──
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 'test-session' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2CoachHintExpanded: {},
        circlesPhase2Streaming: false,
        circlesPhase2StreamingTurn: null,
        circlesPhase2StreamError: false,
        circlesPhase2ConclusionMode: false,
        circlesStepScores: {},
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3 });
    await page.waitForSelector('.submit-row__btn', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'section-D-' + vp.name + '.png'), fullPage: false });

    // ── Section E: conclusion mode ──
    await page.evaluate(({ q, conv, draft }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 'test-session' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2CoachHintExpanded: {},
        circlesPhase2Streaming: false,
        circlesPhase2StreamingTurn: null,
        circlesPhase2StreamError: false,
        circlesPhase2ConclusionMode: true,
        circlesPhase2ConclusionDraft: draft,
        circlesPhase2ExampleOpen: false,
        circlesStepScores: {},
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3, draft: CONCLUSION_DRAFT });
    await page.waitForSelector('.conclusion-box', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'section-E-' + vp.name + '.png'), fullPage: false });

    // ── Section F: locked (step already scored) ──
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 'test-session' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2CoachHintExpanded: {},
        circlesPhase2Streaming: false,
        circlesPhase2StreamingTurn: null,
        circlesPhase2StreamError: false,
        circlesPhase2ConclusionMode: false,
        circlesStepScores: { C1: { totalScore: 78, dimensions: [] } },
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3 });
    await page.waitForSelector('.locked-banner', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'section-F-' + vp.name + '.png'), fullPage: false });
  }
});
