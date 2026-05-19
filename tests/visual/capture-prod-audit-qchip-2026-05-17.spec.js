// Capture-only spec for director audit (2026-05-17).
// Sonnet capture lane — DRIVE PROD CODE ONLY (no app code changes).
//
// Skill anchors:
//   /Users/albertpeng/.claude/skills/playwright-skill/core/authentication.md
//     (storageState login via UI — single Supabase signIn, reuse across viewports)
//   /Users/albertpeng/.claude/skills/playwright-skill/core/common-pitfalls.md
//     Pitfall 11 (no own-API mock; only stat/session list mocks to keep rail empty)
//
// What this captures (per director matrix):
//   A. Phase 1 qchip — collapsed + expanded (4-block analysis) × 3 vp
//   B. Phase 2 qchip — collapsed + expanded × 3 vp
//   C. Phase 2 input bar full-region × 3 vp (上一步 location)
//   D. Each CIRCLES drill step (I / R / C2 / L / E / S) Phase 2 entry × desktop
//
// Output: /tmp/prod-audit/<group>-<vp>.png

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = '/tmp/prod-audit';
const STORAGE_PATH = path.join(OUT_DIR, '.auth-storage.json');

const EMAIL = process.env.TEST_EMAIL || 'e2e@first-principle.test';
const PASSWORD = process.env.TEST_PASSWORD;

const VPS = [
  { name: 'mobile-360',  width: 360,  height: 900 },
  { name: 'tablet-768',  width: 768,  height: 1000 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];

// Sample question with full analysis block (qchip-expand needs analysis.business/users/traps/insight)
const SAMPLE_Q = {
  id: 'circles_001',
  company: 'Spotify',
  product: 'Spotify Podcast',
  industry: 'streaming',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並增加用戶的黏著度。',
  analysis: {
    business: '商業背景：Spotify 的收入主要來自訂閱服務和廣告，而 Podcast 是其擴展內容類型的重要部分。本題情境中，設計新功能能提高用戶黏著度，進而提升整體平台的用戶留存與付費轉換率。',
    users:    '用戶輪廓：Spotify 的典型用戶包括音樂愛好者與 Podcast 聽眾，他們追求多樣化的內容和個性化的體驗。在這樣的情境中，用戶希望能輕鬆找到符合他們興趣的 Podcast，並享受流暢的聆聽體驗。',
    traps:    '忽略用戶的內容偏好、只專注於界面設計、忽視音質和下載速度',
    insight:  '破題切入：學員應該優先思考 CIRCLES 模型中的 "C"（客戶），深入分析用戶需求與內容偏好，並考慮如何透過新功能滿足這些需求，以提升用戶的整體聽覺體驗與平台黏著度。',
  },
};

const SAMPLE_CONV = [
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

async function mockListsOnly(page) {
  // Only stub list/stats endpoints (keep dashboard clean & deterministic). Do NOT
  // intercept any other own-API endpoints — Pitfall 11.
  await page.route('**/api/guest-circles-stats**',     r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/circles-stats**',           r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions**',  r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**',      r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**',            r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function ensureLoggedIn(browser) {
  // One-shot UI login → save storage state for reuse.
  if (fs.existsSync(STORAGE_PATH)) return;
  if (!PASSWORD) throw new Error('TEST_PASSWORD env not set');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await mockListsOnly(page);
  await page.goto('/');
  await page.waitForSelector('.navbar, .auth-card, .qcard', { timeout: 15000 });

  // Open auth view if not already (navbar sign-in icon)
  const onAuth = await page.locator('#auth-email').count();
  if (onAuth === 0) {
    await page.locator('[data-nav="auth"]').first().click();
    await page.waitForSelector('#auth-email', { timeout: 10000 });
  }

  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pw').fill(PASSWORD);
  await page.locator('#auth-submit').click();

  // Wait for circles view to render (post-login) — qcard or navbar user state
  await expect(page.locator('.qcard').first()).toBeVisible({ timeout: 20000 });

  await ctx.storageState({ path: STORAGE_PATH });
  await ctx.close();
}

async function newAuthedPage(browser, vp) {
  const ctx = await browser.newContext({
    storageState: STORAGE_PATH,
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await ctx.newPage();
  await mockListsOnly(page);
  return { ctx, page };
}

async function setupPhase1(page, drillStep) {
  await page.goto('/');
  await page.waitForSelector('.navbar', { timeout: 15000 });
  await page.evaluate(({ q, step }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesMode: 'drill',
      circlesPhase: 1,
      circlesDrillStep: step,
      circlesSession: { id: 'audit-session-' + step },
      circlesSelectedQuestion: q,
      circlesChipExpanded: false,
    });
    window.renderApp();
  }, { q: SAMPLE_Q, step: drillStep });
  await page.waitForSelector('[data-phase1="qchip-toggle"]', { timeout: 10000 });
  await page.waitForTimeout(200);
}

async function setupPhase2(page, drillStep, conv) {
  await page.goto('/');
  await page.waitForSelector('.navbar', { timeout: 15000 });
  await page.evaluate(({ q, step, c }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesMode: 'drill',
      circlesPhase: 2,
      circlesDrillStep: step,
      circlesSession: { id: 'audit-session-p2-' + step },
      circlesSelectedQuestion: q,
      circlesConversation: c || [],
      circlesPhase2Streaming: false,
      circlesPhase2StreamingTurn: null,
      circlesPhase2StreamError: false,
      circlesPhase2ConclusionMode: false,
      circlesPhase2CoachHintExpanded: {},
      circlesStepScores: {},
    });
    window.renderApp();
  }, { q: SAMPLE_Q, step: drillStep, c: conv });
  await page.waitForSelector('[data-phase2="qchip"]', { timeout: 10000 });
  await page.waitForTimeout(200);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await ensureLoggedIn(browser);
});

test('A + B + C: qchip + input-bar captures × 3 viewports', async ({ browser }) => {
  test.setTimeout(180000);

  for (const vp of VPS) {
    const { ctx, page } = await newAuthedPage(browser, vp);
    try {
      // ── A1: Phase 1 qchip collapsed ──
      await setupPhase1(page, 'C1');
      await page.screenshot({ path: path.join(OUT_DIR, `A1-phase1-qchip-collapsed-${vp.name}.png`), fullPage: true });

      // ── A2: Phase 1 qchip expanded (4-block) ──
      await page.evaluate(() => { window.AppState.circlesChipExpanded = true; window.renderApp(); });
      await page.waitForSelector('.qchip-expand', { timeout: 5000 });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT_DIR, `A2-phase1-qchip-expanded-${vp.name}.png`), fullPage: true });

      // ── B1: Phase 2 qchip collapsed (with 2-turn conv to see chat surface) ──
      await setupPhase2(page, 'C1', SAMPLE_CONV);
      await page.screenshot({ path: path.join(OUT_DIR, `B1-phase2-qchip-collapsed-${vp.name}.png`), fullPage: true });

      // ── B2: Phase 2 qchip expanded ──
      await page.locator('[data-phase2="qchip"]').first().click();
      await expect(page.locator('[data-phase2="qchip"]').first()).toHaveAttribute('aria-expanded', 'true');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT_DIR, `B2-phase2-qchip-expanded-${vp.name}.png`), fullPage: true });

      // ── C1: Phase 2 input-bar region (collapse qchip first, scroll to bottom) ──
      await page.locator('[data-phase2="qchip-panel-close"]').first().click().catch(() => {});
      await page.waitForTimeout(150);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT_DIR, `C1-phase2-inputbar-region-${vp.name}.png`), fullPage: false });
    } finally {
      await ctx.close();
    }
  }
});

test('D: each CIRCLES drill step Phase 2 (I / R / C2 / L / E / S) × desktop-1280', async ({ browser }) => {
  test.setTimeout(120000);
  const vp = VPS[2]; // desktop-1280
  const steps = ['I', 'R', 'C2', 'L', 'E', 'S'];
  const labels = { I: 'D1-I', R: 'D2-R', C2: 'D3-C2', L: 'D4-L', E: 'D5-E', S: 'D6-S' };

  const { ctx, page } = await newAuthedPage(browser, vp);
  try {
    for (const step of steps) {
      await setupPhase2(page, step, SAMPLE_CONV);
      await page.screenshot({ path: path.join(OUT_DIR, `${labels[step]}-phase2-${vp.name}.png`), fullPage: true });
    }
  } finally {
    await ctx.close();
  }
});
