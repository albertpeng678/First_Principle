/**
 * Capture PNG — NSM Step 3 hint+example button row regression fix — full 8-vp × 3-state matrix
 *
 * Verifies:
 *   - 提示 + 範例答案 buttons both visible + right-aligned (.field__hint-row { justify-content: flex-end })
 *   - margin-bottom from textarea applied (.nsm-dim__body .field__hint-row { margin-bottom: var(--s-2) })
 *   - state-B: 範例答案 expands inline correctly (example-expand block renders)
 *   - state-C: 提示 modal opens (loading shell visible; actual AI content may not load in headless)
 *
 * Question: Slack (q3, B2B SaaS → type=saas) — 4 dims: reach/depth/frequency/impact
 *   All 4 dims have field_examples.step3 entries → 範例答案 button rendered for each dim.
 *
 * Output: audit/png-uat-r5-fullmatrix/state-{A|B|C}-{viewport-name}.png (24 PNGs)
 */
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT_DIR = path.join(__dirname, '../../audit/png-uat-r5-fullmatrix');

// 8 canonical viewports — match playwright.config.js projects exactly
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

// Shared AppState injection: NSM Step 3 unlocked with Slack (q3, saas type)
// nsmDefinition.nsm must be non-empty so banner renders; nsmBreakdown left empty so
// textarea is blank (default state) and submit remains disabled — correct for state-A.
async function injectNSMStep3(page) {
  await page.evaluate(() => {
    // Find Slack (q3) from the global NSM_QUESTIONS array
    var questions = window.NSM_QUESTIONS || [];
    var q = questions.find(function (x) { return x.id === 'q3'; });
    if (!q) {
      // Fallback: pick first question with SaaS/B2B in industry
      q = questions.find(function (x) {
        return x.industry && /saas|b2b/i.test(x.industry);
      }) || questions[0];
    }

    if (!q) return; // guard against empty DB

    var AS = window.AppState;
    AS.view = 'nsm';
    AS.nsmStep = 3;
    AS.nsmSelectedQuestion = q;
    AS.nsmDefinition = {
      nsm: '每月活躍發言的工作區數',
      explanation: '發言才代表真正使用，不是只登入',
      businessLink: '發言用戶增加 → 企業留存率提升 → 降低退訂',
    };
    AS.nsmBreakdown = { reach: '', depth: '', frequency: '', impact: '' };
    AS.nsmEvalResult = null;    // unlocked — user can edit
    AS.nsmEvalError = null;
    AS.nsmGateResult = null;
    AS.nsmGateError = null;
    AS.nsmGateLoading = false;
    AS.nsmEvalLoading = false;
    AS.nsmDimExampleExpanded = {};
    AS.nsmHintExpanded = {};
    AS.nsmContextExpanded = false;
  });
  // Trigger re-render
  await page.evaluate(() => {
    if (typeof window.renderApp === 'function') window.renderApp();
    else if (typeof window.render === 'function') window.render();
  });
  // Wait for DOM to settle
  await page.waitForTimeout(600);
}

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const vp of VIEWPORTS) {
  // ── State A: default — Step 3 just loaded, no interaction ──────────────────
  test(`NSM Step 3 state-A-default — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    // Smoke gate: fail loudly if server doesn't serve the app
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/Cannot GET/i.test(bodyText)) throw new Error('Server returned 404 page — base URL wrong');
    await injectNSMStep3(page);

    await page.screenshot({
      path: path.join(OUT_DIR, `state-A-default-${vp.name}.png`),
      fullPage: true,
    });
    await ctx.close();
  });

  // ── State B: 範例答案 open — click first card's example toggle ──────────────
  test(`NSM Step 3 state-B-example-open — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    // Smoke gate: fail loudly if server doesn't serve the app
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/Cannot GET/i.test(bodyText)) throw new Error('Server returned 404 page — base URL wrong');
    await injectNSMStep3(page);

    // Click the first 「範例答案」 button — data-nsm-dim-example-toggle="reach"
    // Fallback: click any .field-example-toggle if reach-specific selector misses
    const exBtn = page.locator('[data-nsm-dim-example-toggle="reach"]').first();
    const anyExBtn = page.locator('.field-example-toggle').first();

    const exBtnVisible = await exBtn.isVisible().catch(() => false);
    if (exBtnVisible) {
      await exBtn.click();
    } else {
      const anyVisible = await anyExBtn.isVisible().catch(() => false);
      if (anyVisible) {
        await anyExBtn.click();
      }
      // If neither visible: capture state as-is and note the absence
    }

    // Wait for example-expand block to appear
    await page.waitForTimeout(400);

    await page.screenshot({
      path: path.join(OUT_DIR, `state-B-example-open-${vp.name}.png`),
      fullPage: true,
    });
    await ctx.close();
  });

  // ── State C: 提示 modal — click first card's 提示 button ───────────────────
  // The modal makes a backend API call to /api/nsm-public/step3-hint.
  // In headless with real server at localhost:4000 the call will fire; we capture
  // the loading shell (教練思考中…) which appears immediately.
  // If the API returns before our screenshot the full hint is shown — both are valid captures.
  test(`NSM Step 3 state-C-hint-modal — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    // Smoke gate: fail loudly if server doesn't serve the app
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/Cannot GET/i.test(bodyText)) throw new Error('Server returned 404 page — base URL wrong');
    await injectNSMStep3(page);

    // Click the first 「提示」 button — data-nsm-step3-hint="reach"
    const hintBtn = page.locator('[data-nsm-step3-hint="reach"]').first();
    const anyHintBtn = page.locator('.field__hint-link').first();

    const hintBtnVisible = await hintBtn.isVisible().catch(() => false);
    if (hintBtnVisible) {
      await hintBtn.click();
    } else {
      const anyVisible = await anyHintBtn.isVisible().catch(() => false);
      if (anyVisible) await anyHintBtn.click();
    }

    // Wait 500ms — long enough for loading shell to appear but short enough to
    // capture it before a fast API response replaces it.
    // We intentionally do NOT await API response; loading shell is sufficient for regression audit.
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(OUT_DIR, `state-C-hint-modal-${vp.name}.png`),
      fullPage: true,
    });
    await ctx.close();
  });
}
