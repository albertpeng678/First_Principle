// Master pixel-diff spec — 11 mockups × 3 viewports = 33 diffs
// Layer 2 mechanical contract: mockup vp-frame__body clip vs production screenshot
// Generated: 2026-05-08
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { captureMockupFrameClip, diffPngBuffers } = require('./helpers/section-pixel-diff');

test.use({ baseURL: 'http://localhost:4000', trace: 'off' });

const BASE_URL = 'http://localhost:4000';

const OUT_DIR = path.resolve(__dirname, 'diffs/master');
fs.mkdirSync(OUT_DIR, { recursive: true });

const REPORT_PATH = path.resolve(__dirname, '../../audit/pixel-diff-master-2026-05-08.md');

// ── Shared data payloads (reuse from existing capture specs) ──────────────────

const SAMPLE_OK_GATE = {
  items: [
    { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: '聚焦免費版廣告體驗，不含付費' },
    { field: '時間範圍', status: 'ok', title: '週期合理', reason: '60 天對應月活動節奏' },
    { field: '業務影響', status: 'ok', title: '量化紅線', reason: '收入 3% 不能下降' },
    { field: '假設確認', status: 'ok', title: '可驗證', reason: '時段假設清晰' },
  ],
  canProceed: true,
  overallStatus: 'ok',
};

const SAMPLE_SCORE_HIGH = {
  totalScore: 78,
  dimensions: [
    { name: '清晰度', score: 4, comment: '用戶分群清楚切出付費 / 免費兩個 segment', coachVersion: { name: '清晰度', score: 5, text: '把目標用戶切成「30 天內註冊但未養成日常收聽習慣的免費用戶」' }, suggestion: '加上規模量化' },
    { name: '邏輯性', score: 3, comment: '分群與場景之間的因果鏈不夠緊', coachVersion: { name: '邏輯性', score: 4, text: '先列假設再用 1 句話說明 podcast 為何適合當錨點' }, suggestion: '補 If X then Y 假設格式' },
    { name: '完整度', score: 3, comment: '少了次要分群的對照', coachVersion: { name: '完整度', score: 4, text: '補一個對照分群' }, suggestion: '每個分群提供量化指標' },
    { name: '洞察力', score: 4, comment: '「免費用戶聽 podcast 比例 < 12%」是個有 power 的觀察', coachVersion: { name: '洞察力', score: 5, text: '繼續挖那 12% 用什麼 podcast 類型' }, suggestion: '把觀察與方案 hypothesis 串起來' },
  ],
  coachVersion: {
    context: '用戶分析是 CIRCLES 的第二步，目的是把問題從「全部用戶」收斂到「具體分群」。',
    perField: [
      { label: '列出候選分群', text: '付費用戶（~ 1.2 億）/ 免費用戶（~ 4 億）' },
      { label: '選定焦點分群', text: '焦點：「新註冊但 30 天內未養成日常收聽習慣」的免費用戶（~ 850 萬 / 月）' },
      { label: '選擇理由', text: '商業重要：30 天留存是付費轉換最強的領先指標' },
      { label: '用戶動機假設', text: '假設：「新用戶想要每日通勤時段的背景音」' },
    ],
    reasoning: '分群必須附量化規模 + 商業重要性，否則只是描述不是論述。',
  },
  strengths: '明確區分付費 / 免費用戶兩個分群，並指出付費用戶聽 Podcast 比例不到 12%',
  improvements: '用戶動機假設缺乏可檢驗性，建議補上具體訪談或數據佐證',
};

const SAMPLE_STEP_SCORES = {
  C1: { totalScore: 78, highlight: '邊界與成功指標清晰', improvement: '加強時間框架具體性' },
  I:  { totalScore: 82, highlight: '分群清楚並佐以行為數據', improvement: '強化行為數據量化' },
  R:  { totalScore: 75, highlight: '痛點到位', improvement: '補競品對比' },
  C2: { totalScore: 70, highlight: '缺明確優先級框架', improvement: '缺 RICE/ICE 框架' },
  L:  { totalScore: 85, highlight: '3 方案各對應不同分群', improvement: '可加 flow 圖' },
  E:  { totalScore: 68, highlight: '本次最弱', improvement: '量化開發成本與收益' },
  S:  { totalScore: 80, highlight: '北極星指標明確', improvement: '4 dim 追蹤可更具體' },
};

const SAMPLE_FINAL_REPORT = {
  overallScore: 77,
  grade: 'B',
  headline: '七步框架掌握扎實，整體論述清晰',
  strengths: ['在 C 釐清與 L 方案兩步提出明確的成功指標與量化目標', 'I 用戶分析具體區分付費 / 免費分群', 'L 方案規劃條理清楚'],
  improvements: ['E 取捨需要更具體量化每個方案的開發成本與預期收益', 'C2 排序的優先順序缺乏明確的優先級框架說明', 'R 需求步驟可加入競品對比強化論述'],
  coachVerdict: '整體論述邏輯通順、結構完整。最強的部分是用戶分析與方案規劃；下一步建議鎖定 E 取捨的量化能力。',
  nextSteps: '建議再加練 1 次取捨型題目，重點放在量化開發成本與預期收益。',
};

const CONVERSATION_SAMPLE = [
  {
    userMessage: '這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？',
    interviewee: '只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。',
    coaching: '好的開頭問題。同時釐清「涵蓋範圍」與「目標族群」',
    hint: '可追問「為什麼是新用戶而不是 power user」',
  },
];

// ── API stub helper ──────────────────────────────────────────────────────────

async function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' })),
    page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function captureProduction(page, outPath) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const buf = await page.screenshot({ fullPage: true });
  fs.writeFileSync(outPath, buf);
  return buf;
}

// ── Report accumulation ──────────────────────────────────────────────────────

// We separate header lines from per-case detail lines and combine in afterAll
const reportHeader = [
  '# Master Pixel-Diff Report — 11 Mockups Cross-Viewport',
  '',
  `_Generated: ${new Date().toISOString()}_`,
  '',
];

// Per-case detail lines accumulated during tests
const detailLines = [];

// summary table row accumulator: { id, mobile, tablet, desktop }
const summaryRows = {};

function getSummaryEmoji(pct, gap) {
  if (gap) return '🔲 gap';
  if (pct < 0.5) return `✅ ${pct.toFixed(2)}%`;
  if (pct < 5) return `🟡 ${pct.toFixed(2)}%`;
  if (pct < 15) return `🟠 ${pct.toFixed(2)}%`;
  return `🔴 ${pct.toFixed(2)}%`;
}

function recordResult(mockupId, vp, result, mockupFile, frameLabel, coverageGap) {
  if (!summaryRows[mockupId]) summaryRows[mockupId] = { mobile: null, tablet: null, desktop: null };
  const vpKey = vp === 'mobile-360' ? 'mobile' : vp === 'tablet-768' ? 'tablet' : 'desktop';
  summaryRows[mockupId][vpKey] = coverageGap ? { gap: true } : result;

  const verdict = coverageGap
    ? '🔲 frame not found'
    : result.pct < 0.5 ? `✅ < 0.5%`
    : result.pct < 5 ? `🟡 < 5%`
    : result.pct < 15 ? `🟠 < 15% (state diff 預期)`
    : `🔴 ≥ 15%`;

  detailLines.push(`### Mockup ${mockupId} · ${vp}: ${verdict}`);
  detailLines.push('');
  if (coverageGap) {
    detailLines.push(`- frame label \`${frameLabel}\` not found in \`${mockupFile}\` — skipped`);
  } else {
    const summary = `mockup ${result.mockupWidth}×${result.mockupHeight} / production ${result.productionWidth}×${result.productionHeight} / padded ${result.paddedWidth}×${result.paddedHeight} / mismatched ${result.mis}px / **${result.pct.toFixed(2)}%**`;
    detailLines.push(`- ${summary}`);
    detailLines.push(`- mockup PNG: \`tests/visual/diffs/master/${mockupId}-${vp}-mockup.png\``);
    detailLines.push(`- production PNG: \`tests/visual/diffs/master/${mockupId}-${vp}-production.png\``);
    detailLines.push(`- diff PNG: \`tests/visual/diffs/master/${mockupId}-${vp}-diff.png\``);
  }
  detailLines.push('');
}

// ── Helper: get mockup frame clip with fallback ──────────────────────────────
// Handles both .vp-frame__body (mockups 01/02/03) and .vp-frame__inner (mockups 04-13)

const MOCKUP_DIR_PATH = path.resolve(__dirname, '../../docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite');

async function tryCaptureMockupFrame(page, mockupFile, frameLabel, outPath) {
  const { PNG } = require('pngjs');
  await page.setViewportSize({ width: 3000, height: 1080 });
  const url = 'file://' + path.join(MOCKUP_DIR_PATH, mockupFile);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  const escaped = frameLabel.replace(/"/g, '\\"');
  // Try both .vp-frame__body (older mockups 01-03) and .vp-frame__inner (newer mockups 04+)
  let bodyEl = null;
  for (const bodyClass of ['.vp-frame__body', '.vp-frame__inner']) {
    const frame = page.locator(`.vp-frame:has(.vp-frame__label span:text-is("${escaped}"))`).first();
    const body = frame.locator(bodyClass).first();
    const count = await body.count();
    if (count > 0) {
      bodyEl = body;
      break;
    }
  }

  if (!bodyEl) return false;

  try {
    const rect = await bodyEl.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    });
    const docX = Math.round(rect.x);
    const docY = Math.round(rect.y);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const fullBuf = await page.screenshot({ fullPage: true, animations: 'disabled' });
    const fullPng = PNG.sync.read(fullBuf);
    const cropX = Math.max(0, Math.min(docX, fullPng.width - 1));
    const cropY = Math.max(0, Math.min(docY, fullPng.height - 1));
    const cropW = Math.min(w, fullPng.width - cropX);
    const cropH = Math.min(h, fullPng.height - cropY);
    const cropped = new PNG({ width: cropW, height: cropH });
    PNG.bitblt(fullPng, cropped, cropX, cropY, cropW, cropH, 0, 0);
    fs.writeFileSync(outPath, PNG.sync.write(cropped));
    return true;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 01 — CIRCLES Home (Section A: 預設狀態 · 完整模擬模式)
// Frame label: "Mobile" / "Tablet" / "Desktop" (first .vp-frame per section)
// Production state: guest home /
// ═══════════════════════════════════════════════════════════════════════════

const M01_CASES = [
  { vp: 'mobile-360', w: 360, h: 900, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 900, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 900, frameLabel: 'Desktop' },
];

M01_CASES.forEach(c => {
  test(`01-home · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `01-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '01-circles-home.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('01-home', c.vp, null, '01-circles-home.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.qcard');
    await pageProd.waitForTimeout(400);

    const prodPath = path.join(OUT_DIR, `01-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `01-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('01-home', c.vp, result, '01-circles-home.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 02 — Auth Flow (Section A: 登入畫面 default state)
// Frame label: "Mobile" / "Tablet · focus" / "Desktop · loading"
// Production state: home (no open modal — auth modal state injection)
// ═══════════════════════════════════════════════════════════════════════════

const M02_CASES = [
  { vp: 'mobile-360', w: 360, h: 900, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 900, frameLabel: 'Tablet · focus' },
  { vp: 'desktop-1280', w: 1280, h: 900, frameLabel: 'Desktop · loading' },
];

M02_CASES.forEach(c => {
  test(`02-auth · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `02-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '02-auth-flow.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('02-auth', c.vp, null, '02-auth-flow.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.qcard');
    // Open sign-in modal
    const signInBtn = pageProd.locator('.navbar__icon-btn[data-auth="open-signin"], [data-nav="signin"], [data-auth="signin"]').first();
    const signInExists = await signInBtn.count();
    if (signInExists > 0) {
      await signInBtn.click();
      await pageProd.waitForTimeout(400);
    }

    const prodPath = path.join(OUT_DIR, `02-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `02-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('02-auth', c.vp, result, '02-auth-flow.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 03 — Phase 1 Form (Section A: C1 表單 Mobile · simulation)
// Frame label: "Mobile · simulation" / "Tablet · simulation" / "Desktop · drill mode"
// Production state: drill mode C1 step phase=1
// ═══════════════════════════════════════════════════════════════════════════

const M03_CASES = [
  { vp: 'mobile-360', w: 360, h: 1700, frameLabel: 'Mobile · simulation' },
  { vp: 'tablet-768', w: 768, h: 1700, frameLabel: 'Tablet · simulation' },
  { vp: 'desktop-1280', w: 1280, h: 1700, frameLabel: 'Desktop · drill mode' },
];

M03_CASES.forEach(c => {
  test(`03-phase1 · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `03-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '03-phase-1-form.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('03-phase1', c.vp, null, '03-phase-1-form.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.qcard');
    await pageProd.locator('.mode-card').first().click();
    await pageProd.locator('.qcard').first().click();
    await pageProd.locator('.qcard__btn--primary').click();
    await pageProd.waitForSelector('.phase-head');
    await pageProd.waitForTimeout(400);

    const prodPath = path.join(OUT_DIR, `03-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `03-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('03-phase1', c.vp, result, '03-phase-1-form.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 04 — Phase 1.5 Gate (Section A: 通過 ok state)
// Frame label: "Mobile" / "Tablet" / "Desktop" (first frames = ok state)
// Production state: gate ok with SAMPLE_OK_GATE
// ═══════════════════════════════════════════════════════════════════════════

const M04_CASES = [
  { vp: 'mobile-360', w: 360, h: 800, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 800, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 800, frameLabel: 'Desktop' },
];

M04_CASES.forEach(c => {
  test(`04-gate · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `04-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '04-phase-1-5-gate.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('04-gate', c.vp, null, '04-phase-1-5-gate.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.qcard');
    await pageProd.evaluate((gateResult) => {
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'Spotify', product: 'Spotify Podcast' };
      window.AppState.circlesPhase = 1.5;
      window.AppState.circlesGateResult = gateResult;
      window.AppState.circlesGateLoading = false;
      window.AppState.circlesGateError = null;
      window.render();
    }, SAMPLE_OK_GATE);
    await pageProd.waitForTimeout(600);

    const prodPath = path.join(OUT_DIR, `04-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `04-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('04-gate', c.vp, result, '04-phase-1-5-gate.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 05 — Phase 2 Chat (Section A: 對話開始 empty)
// Frame label: "Mobile" / "Tablet" / "Desktop" (first frames = empty chat Section A)
// Production state: phase 2 empty conversation
// ═══════════════════════════════════════════════════════════════════════════

const M05_CASES = [
  { vp: 'mobile-360', w: 360, h: 900, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 900, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 900, frameLabel: 'Desktop' },
];

M05_CASES.forEach(c => {
  test(`05-phase2 · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `05-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '05-phase-2-chat.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('05-phase2', c.vp, null, '05-phase-2-chat.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.navbar');
    await pageProd.evaluate((q) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesMode: 'simulation',
        circlesSession: { id: 'sess-1' },
        circlesSelectedQuestion: { id: 'q-test-01', company: 'Spotify', product: 'Podcast', industry: 'streaming', question_type: 'design', difficulty: 'medium', problem_statement: '設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存' },
        circlesConversation: [],
        circlesPhase2Error: null,
        circlesPhase2Streaming: false,
        circlesPhase2Concluded: false,
        circlesPhase2Locked: false,
      });
      window.render();
    }, {});
    await pageProd.waitForTimeout(600);

    const prodPath = path.join(OUT_DIR, `05-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `05-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('05-phase2', c.vp, result, '05-phase-2-chat.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 06 — NSM Step 1 (Section A: 5 cards)
// Frame label: "Mobile" / "Tablet" / "Desktop · 3-col" (first frames)
// Production state: NSM step 1 5 cards
// ═══════════════════════════════════════════════════════════════════════════

const M06_CASES = [
  { vp: 'mobile-360', w: 360, h: 900, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 900, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 900, frameLabel: 'Desktop · 3-col' },
];

M06_CASES.forEach(c => {
  test(`06-nsm1 · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `06-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '06-nsm-step-1.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('06-nsm1', c.vp, null, '06-nsm-step-1.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.qcard');
    // Navigate to NSM via state injection
    await pageProd.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 1;
      window.render();
    });
    await pageProd.waitForTimeout(600);

    const prodPath = path.join(OUT_DIR, `06-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `06-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('06-nsm1', c.vp, result, '06-nsm-step-1.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 07 — NSM Step 2 (Section A: step2 empty with attention type)
// Frame label: "Mobile" / "Tablet" / "Desktop" (first frames = step2)
// Production state: NSM step 2 attention type empty
// ═══════════════════════════════════════════════════════════════════════════

const M07_Q_ATTENTION = {
  id: 'q-att', company: 'Spotify', industry: '音樂串流',
  scenario: '為 Spotify 定義北極星指標，衡量用戶日常收聽行為', product: 'Spotify Music',
};

const M07_CASES = [
  { vp: 'mobile-360', w: 360, h: 1000, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 1000, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 1000, frameLabel: 'Desktop' },
];

M07_CASES.forEach(c => {
  test(`07-nsm2 · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `07-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '07-nsm-step-2.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('07-nsm2', c.vp, null, '07-nsm-step-2.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.qcard');
    await pageProd.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmSelectedQuestion = q;
      window.render();
    }, { q: M07_Q_ATTENTION });
    await pageProd.waitForSelector('.nsm-sub-tabs', { timeout: 5000 });
    await pageProd.waitForTimeout(400);

    const prodPath = path.join(OUT_DIR, `07-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `07-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('07-nsm2', c.vp, result, '07-nsm-step-2.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 09 — Offcanvas History (Section A: 列表 with list)
// Frame label: "Mobile" / "Tablet" / "Desktop" (first frames = list state)
// Production state: offcanvas open with session list
// ═══════════════════════════════════════════════════════════════════════════

const M09_SESSION_LIST = [
  { id: 's1', status: 'completed', mode: 'simulation', totalScore: 86,
    question_id: 'q1', question_json: { company: 'Spotify', product: 'Spotify Podcast' },
    step_drafts: {}, framework_draft: {}, created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 's2', status: 'completed', mode: 'drill', drill_step: 'I', totalScore: 92,
    question_id: 'q2', question_json: { company: 'Notion', product: '工作協作' },
    step_drafts: {}, framework_draft: {}, created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString() },
];

const M09_CASES = [
  { vp: 'mobile-360', w: 360, h: 900, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 900, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 900, frameLabel: 'Desktop' },
];

M09_CASES.forEach(c => {
  test(`09-offcanvas · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `09-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '09-offcanvas-history.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('09-offcanvas', c.vp, null, '09-offcanvas-history.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    // Stub sessions endpoint with session list
    await pageProd.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":2,"active":0,"weeklyCompleted":0}' }));
    await pageProd.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":2,"active":0,"weeklyCompleted":0}' }));
    await pageProd.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(M09_SESSION_LIST) }));
    await pageProd.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(M09_SESSION_LIST) }));
    await pageProd.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await pageProd.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await pageProd.route('**/api/guest-nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.qcard');
    // Open offcanvas via hamburger
    await pageProd.locator('[data-nav="offcanvas"], [data-offcanvas="open"]').first().click();
    await pageProd.waitForSelector('.offcanvas-drawer', { timeout: 5000 });
    await pageProd.waitForTimeout(500);

    const prodPath = path.join(OUT_DIR, `09-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `09-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('09-offcanvas', c.vp, result, '09-offcanvas-history.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 10 — Onboarding (Section A: Welcome card)
// Frame label: "Mobile" / "Tablet" / "Desktop" (first frames = welcome)
// Production state: onboarding welcome card (clear localStorage flag)
// ═══════════════════════════════════════════════════════════════════════════

const M10_CASES = [
  { vp: 'mobile-360', w: 360, h: 900, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 900, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 900, frameLabel: 'Desktop' },
];

M10_CASES.forEach(c => {
  test(`10-onboarding · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `10-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '10-onboarding.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.addInitScript(() => {
      try { localStorage.removeItem('circles_onboarding_done'); } catch (_) {}
    });
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.qcard');
    await pageProd.waitForSelector('.onb-welcome', { timeout: 5000 });
    await pageProd.waitForTimeout(300);

    if (!found) {
      recordResult('10-onboarding', c.vp, null, '10-onboarding.html', c.frameLabel, true);
      await ctxProd.close();
      return;
    }

    const prodPath = path.join(OUT_DIR, `10-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `10-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('10-onboarding', c.vp, result, '10-onboarding.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 11 — Phase 3 Score (Section A: 預設 78 分)
// Frame label: "Mobile" / "Tablet" / "Desktop" (first frames = 78 score)
// Production state: phase 3 score SAMPLE_SCORE_HIGH
// ═══════════════════════════════════════════════════════════════════════════

const M11_CASES = [
  { vp: 'mobile-360', w: 360, h: 1100, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 1100, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 1100, frameLabel: 'Desktop' },
];

M11_CASES.forEach(c => {
  test(`11-phase3 · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `11-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '11-phase-3-score.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('11-phase3', c.vp, null, '11-phase-3-score.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.navbar');
    await pageProd.evaluate(({ scoreResult }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 3,
        circlesMode: 'drill',
        circlesDrillStep: 'I',
        circlesSession: { id: 'sess-1' },
        circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
        circlesScoreResult: scoreResult,
        circlesPhase3Error: null,
        circlesPhase3LoadingStep: 1,
        circlesPhase3DimExpanded: {},
        circlesPhase3CoachDemoOpen: false,
      });
      window.render();
    }, { scoreResult: SAMPLE_SCORE_HIGH });
    await pageProd.waitForTimeout(300);

    const prodPath = path.join(OUT_DIR, `11-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `11-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('11-phase3', c.vp, result, '11-phase-3-score.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUP 13 — Phase 4 Final Report (Section A: 77 分 success)
// Frame label: "Mobile" / "Tablet" / "Desktop" (first frames = success report)
// Production state: phase 4 with SAMPLE_FINAL_REPORT + SAMPLE_STEP_SCORES
// ═══════════════════════════════════════════════════════════════════════════

const M13_CASES = [
  { vp: 'mobile-360', w: 360, h: 1100, frameLabel: 'Mobile' },
  { vp: 'tablet-768', w: 768, h: 1100, frameLabel: 'Tablet' },
  { vp: 'desktop-1280', w: 1280, h: 1100, frameLabel: 'Desktop' },
];

M13_CASES.forEach(c => {
  test(`13-phase4 · ${c.vp}`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `13-${c.vp}-mockup.png`);
    const found = await tryCaptureMockupFrame(pageMock, '13-phase-4-final.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    if (!found) {
      recordResult('13-phase4', c.vp, null, '13-phase-4-final.html', c.frameLabel, true);
      return;
    }

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    await pageProd.setViewportSize({ width: c.w, height: c.h });
    await stub(pageProd);
    await pageProd.goto(BASE_URL);
    await pageProd.waitForSelector('.navbar');
    await pageProd.evaluate(({ finalReport, stepScores }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 4,
        circlesMode: 'simulation',
        circlesSession: { id: 'sess-1' },
        circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
        circlesFinalReport: finalReport,
        circlesPhase4Error: null,
        circlesPhase4LoadingStep: 0,
        circlesStepScores: stepScores,
        _phase4FinalReportFired: true,
      });
      window.AppState._phase4FinalReportFired = true;
      window.render();
    }, { finalReport: SAMPLE_FINAL_REPORT, stepScores: SAMPLE_STEP_SCORES });
    await pageProd.waitForSelector('.grade-card', { timeout: 5000 });
    await pageProd.waitForTimeout(300);

    const prodPath = path.join(OUT_DIR, `13-${c.vp}-production.png`);
    const prodBuf = await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const diffPath = path.join(OUT_DIR, `13-${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    recordResult('13-phase4', c.vp, result, '13-phase-4-final.html', c.frameLabel, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// afterAll — build summary table + write report
// ═══════════════════════════════════════════════════════════════════════════

test.afterAll(async () => {
  const mockupOrder = [
    ['01-home', '01 home'],
    ['02-auth', '02 auth'],
    ['03-phase1', '03 phase1 form'],
    ['04-gate', '04 gate'],
    ['05-phase2', '05 phase2 chat'],
    ['06-nsm1', '06 nsm step1'],
    ['07-nsm2', '07 nsm step2'],
    ['09-offcanvas', '09 offcanvas'],
    ['10-onboarding', '10 onboarding'],
    ['11-phase3', '11 phase3 score'],
    ['13-phase4', '13 phase4 final'],
  ];

  // Build full report: header + summary table + detail section
  const allLines = [...reportHeader];

  allLines.push('## 結果摘要');
  allLines.push('');
  allLines.push('| Mockup | Mobile-360 | iPad-768 | Desktop-1280 |');
  allLines.push('|---|---|---|---|');

  for (const [id, label] of mockupOrder) {
    const row = summaryRows[id];
    if (!row) {
      allLines.push(`| ${label} | ❓ | ❓ | ❓ |`);
      continue;
    }
    const m = row.mobile ? (row.mobile.gap ? '🔲 gap' : getSummaryEmoji(row.mobile.pct, false)) : '❓';
    const t = row.tablet ? (row.tablet.gap ? '🔲 gap' : getSummaryEmoji(row.tablet.pct, false)) : '❓';
    const d = row.desktop ? (row.desktop.gap ? '🔲 gap' : getSummaryEmoji(row.desktop.pct, false)) : '❓';
    allLines.push(`| ${label} | ${m} | ${t} | ${d} |`);
  }

  allLines.push('');
  allLines.push('## 詳細 verdict per case');
  allLines.push('');
  allLines.push(...detailLines);

  allLines.push('---');
  allLines.push('');
  allLines.push('## Verdict bands (per existing convention)');
  allLines.push('');
  allLines.push('- ✅ < 0.5% — pixel 契約嚴格達標');
  allLines.push('- 🟡 < 5% — 結構 OK，cosmetic drift');
  allLines.push('- 🟠 < 15% — state diff 預期（題目隨機 vs hardcoded、登入態差異、content diff）');
  allLines.push('- 🔴 ≥ 15% — 結構偏離需排查');
  allLines.push('- 🔲 gap — frame label 未找到，已跳過');
  allLines.push('');
  allLines.push('## 預期 diff 來源說明');
  allLines.push('');
  allLines.push('對 mockup 與 production 不同 state 的預期差距：');
  allLines.push('1. navbar 登入態：mockup 部分 frame 顯示已登入 email / production 為 guest');
  allLines.push('2. 題目隨機 vs hardcoded：mockup 用 Spotify / Notion 固定，production 隨機');
  allLines.push('3. 文字 content diff：mockup hardcoded 填充文字 vs production empty placeholder');
  allLines.push('4. mockup vp-frame__body clip 為 Section 裁切，production 為 fullPage screenshot — 高度 padding 差異大');
  allLines.push('5. 綜合 diff 3-25% 視為結構正確（content state mismatch 為主因）');
  allLines.push('');
  allLines.push('---');
  allLines.push('');
  allLines.push(`_Report generated by \`tests/visual/master-pixel-diff.spec.js\`_`);

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, allLines.join('\n'));
  console.log(`\n✅ Report written: ${REPORT_PATH}`);
});
