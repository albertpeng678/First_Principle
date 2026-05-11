/**
 * Comprehensive NSM bug audit capture (2026-05-11)
 * 4 user-reported bugs × 8 viewports × multi-state matrix.
 *
 * Bug 1: NSM hint requires input (should give directional hint when empty, mirror CIRCLES)
 * Bug 2: NSM no example button visible / no example data shows
 * Bug 3: NSM 「深入了解問題」expand renders empty 4-block
 * Bug 4: Data loss on session restore — manual scenario captures
 *
 * Output: audit/png-nsm-audit-2026-05-11/{step,state,viewport}.png
 *
 * Question seeded: q3 Slack (B2B SaaS) — confirmed has full context + field_examples
 * for both Step 2 (3 fields) and Step 3 (4 dims).
 */
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT_DIR = path.join(__dirname, '../../audit/png-nsm-audit-2026-05-11');

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 780,  isMobile: true  },
  { name: 'iPhone-SE',     width: 375,  height: 667,  isMobile: true  },
  { name: 'iPhone-14',     width: 390,  height: 844,  isMobile: true  },
  { name: 'iPhone-15-Pro', width: 430,  height: 932,  isMobile: true  },
  { name: 'iPad',          width: 768,  height: 1024, isMobile: true  },
  { name: 'Desktop-1280',  width: 1280, height: 800,  isMobile: false },
  { name: 'Desktop-1440',  width: 1440, height: 900,  isMobile: false },
  { name: 'Desktop-2560',  width: 2560, height: 1440, isMobile: false },
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function gotoApp(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/Cannot GET/i.test(bodyText)) throw new Error('Server returned 404 — base URL wrong');
}

// Seed AppState to land on NSM Step 2 with q3 Slack
async function injectStep2(page, opts = {}) {
  await page.evaluate((opts) => {
    var questions = window.NSM_QUESTIONS || [];
    var q = questions.find(function (x) { return x.id === 'q3'; }) || questions[0];
    if (!q) return;
    var AS = window.AppState;
    AS.view = 'nsm';
    AS.nsmStep = 2;
    AS.nsmSelectedQuestion = q;
    AS.nsmDefinition = opts.filled
      ? { nsm: '每月活躍發言的工作區數', explanation: '發言代表真正使用', businessLink: '發言↑→留存↑' }
      : { nsm: '', explanation: '', businessLink: '' };
    AS.nsmBreakdown = { reach: '', depth: '', frequency: '', impact: '' };
    AS.nsmEvalResult = null;
    AS.nsmGateResult = null;
    AS.nsmGateLoading = false;
    AS.nsmEvalLoading = false;
    AS.nsmExampleExpanded = opts.exampleExpanded || {};
    AS.nsmHintExpanded = {};
    AS.nsmDimExampleExpanded = {};
    AS.nsmContextExpanded = !!opts.contextExpanded;
  }, opts);
  await page.evaluate(() => { if (typeof window.render === 'function') window.render(); });
  await page.waitForTimeout(500);
}

async function injectStep3(page, opts = {}) {
  await page.evaluate((opts) => {
    var questions = window.NSM_QUESTIONS || [];
    var q = questions.find(function (x) { return x.id === 'q3'; }) || questions[0];
    if (!q) return;
    var AS = window.AppState;
    AS.view = 'nsm';
    AS.nsmStep = 3;
    AS.nsmSelectedQuestion = q;
    AS.nsmDefinition = { nsm: '每月活躍發言的工作區數', explanation: '發言代表真正使用', businessLink: '發言↑→留存↑' };
    AS.nsmBreakdown = opts.filled
      ? { reach: '60% MAU', depth: '20 message/user', frequency: 'DAU/MAU 50%', impact: 'NRR 110%' }
      : { reach: '', depth: '', frequency: '', impact: '' };
    AS.nsmEvalResult = null;
    AS.nsmGateResult = null;
    AS.nsmGateLoading = false;
    AS.nsmEvalLoading = false;
    AS.nsmExampleExpanded = {};
    AS.nsmHintExpanded = {};
    AS.nsmDimExampleExpanded = opts.exampleExpanded || {};
    AS.nsmContextExpanded = !!opts.contextExpanded;
  }, opts);
  await page.evaluate(() => { if (typeof window.render === 'function') window.render(); });
  await page.waitForTimeout(500);
}

async function injectStep1(page) {
  await page.evaluate(() => {
    var AS = window.AppState;
    AS.view = 'nsm';
    AS.nsmStep = 1;
    AS.nsmSelectedQuestion = null;
    AS.nsmContextExpanded = false;
  });
  await page.evaluate(() => { if (typeof window.render === 'function') window.render(); });
  await page.waitForTimeout(500);
}

for (const vp of VIEWPORTS) {
  // ─────── STEP 2 capture matrix ──────────────────────────────────────────
  test(`Step2-A-default-empty — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep2(page);
    await page.screenshot({ path: path.join(OUT_DIR, `step2-A-default-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`Step2-B-hint-modal-empty-draft — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep2(page);
    // Click 「提示」on first field (nsm) with empty draft → Bug 1 verification
    const hintBtn = page.locator('[data-nsm-hint="nsm"]').first();
    if (await hintBtn.isVisible().catch(() => false)) await hintBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `step2-B-hint-empty-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`Step2-C-example-expanded — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep2(page, { exampleExpanded: { nsm: true } });
    await page.screenshot({ path: path.join(OUT_DIR, `step2-C-example-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`Step2-D-context-expanded — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep2(page, { contextExpanded: true });
    await page.screenshot({ path: path.join(OUT_DIR, `step2-D-context-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  // ─────── STEP 3 capture matrix (parity with Step 2 to surface Bug 1+2+3) ──
  test(`Step3-B-hint-modal-empty-draft — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep3(page);
    const hintBtn = page.locator('[data-nsm-step3-hint="reach"]').first();
    if (await hintBtn.isVisible().catch(() => false)) await hintBtn.click();
    await page.waitForTimeout(1500); // wait longer for API call to potentially settle
    await page.screenshot({ path: path.join(OUT_DIR, `step3-B-hint-empty-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`Step3-D-context-expanded — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep3(page, { contextExpanded: true });
    await page.screenshot({ path: path.join(OUT_DIR, `step3-D-context-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  // ─────── STEP 1 q-card with selected + context expand (Bug 3 origin) ──────
  test(`Step1-context-after-select — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep1(page);
    // Click q3 card if present, then capture the auto-expanded context block
    const q3Card = page.locator('[data-nsm-qid="q3"]').first();
    if (await q3Card.isVisible().catch(() => false)) await q3Card.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `step1-context-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });
}
