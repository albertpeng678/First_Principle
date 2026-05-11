/**
 * Bug 1 Round 4 — hint modal behavior on Vintage B (OLD pre-backfill snapshot).
 *
 * User confirmed in 2026-05-11 chat: hint bug surfaces primarily when reviewing
 * past results from offcanvas restore — i.e. on snapshots whose question_json
 * lacks q.context + q.field_examples. Round 3 only tested FRESH q3 + empty
 * draft (returned directional content correctly). Round 4 isolates the
 * restore-path hint behavior.
 *
 * Matrix: 3 vp × Step 2/3 × empty/filled draft = 12 PNG
 *
 * Wait 15s per state to allow gpt-4o full response (matches Round 3 spec).
 */
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT_DIR = path.join(__dirname, '../../audit/png-nsm-bug1-vintageB');

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 780,  isMobile: true  },
  { name: 'iPad',          width: 768,  height: 1024, isMobile: true  },
  { name: 'Desktop-1280',  width: 1280, height: 800,  isMobile: false },
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function gotoApp(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/Cannot GET/i.test(bodyText)) throw new Error('Server returned 404');
}

// Inject Vintage B (OLD snapshot — q.context + q.field_examples stripped)
async function injectOldSnapshot(page, step, filled) {
  await page.evaluate(({ step, filled }) => {
    var questions = window.NSM_QUESTIONS || [];
    var fresh = questions.find(function (x) { return x.id === 'q3'; }) || questions[0];
    // synthesize OLD pre-backfill snapshot
    var q = {
      id: fresh.id || 'q3',
      company: fresh.company || 'Slack',
      industry: fresh.industry || 'B2B SaaS',
      scenario: fresh.scenario || '企業付費是為了效率，若只註冊未發言將導致高退訂率。',
      coach_nsm: fresh.coach_nsm || '',
      anti_patterns: fresh.anti_patterns || [],
      // context: undefined  <-- pre-backfill omission
      // field_examples: undefined  <-- pre-backfill omission
    };
    var AS = window.AppState;
    AS.view = 'nsm';
    AS.nsmStep = step;
    AS.nsmSelectedQuestion = q;
    AS.nsmDefinition = filled
      ? { nsm: '每月活躍發言的工作區數', explanation: '發言才代表真正使用', businessLink: '發言用戶 ↑ → 留存率 ↑ → 退訂 ↓' }
      : { nsm: '', explanation: '', businessLink: '' };
    AS.nsmBreakdown = filled
      ? { reach: '60% MAU 比例', depth: '20 message/user/月', frequency: 'DAU/MAU 50%+', impact: 'NRR 110% 擴張' }
      : { reach: '', depth: '', frequency: '', impact: '' };
    AS.nsmEvalResult = null;
    AS.nsmGateResult = null;
    AS.nsmGateLoading = false;
    AS.nsmEvalLoading = false;
    AS.nsmExampleExpanded = {};
    AS.nsmHintExpanded = {};
    AS.nsmDimExampleExpanded = {};
    AS.nsmContextExpanded = false;
  }, { step, filled });
  await page.evaluate(() => { if (typeof window.render === 'function') window.render(); });
  await page.waitForTimeout(400);
}

async function waitForHintResolved(page) {
  try {
    await page.waitForFunction(() => {
      var host = document.getElementById('nsm-hint-modal-host')
              || document.getElementById('nsm-step3-hint-modal-host');
      if (!host) return false;
      var spinner = host.querySelector('.hint-spinner');
      return !spinner;
    }, { timeout: 15000 });
  } catch (e) { /* timeout — capture as-is */ }
  await page.waitForTimeout(500);
}

for (const vp of VIEWPORTS) {
  // ─── Step 2 — empty draft on OLD snapshot ──────────────────────────────
  test(`OLD-Step2-hint-empty — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectOldSnapshot(page, 2, false);
    await page.locator('[data-nsm-hint="nsm"]').first().click();
    await waitForHintResolved(page);
    await page.screenshot({ path: path.join(OUT_DIR, `OLD-step2-hint-empty-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  // ─── Step 2 — filled draft on OLD snapshot ─────────────────────────────
  test(`OLD-Step2-hint-filled — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectOldSnapshot(page, 2, true);
    await page.locator('[data-nsm-hint="nsm"]').first().click();
    await waitForHintResolved(page);
    await page.screenshot({ path: path.join(OUT_DIR, `OLD-step2-hint-filled-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  // ─── Step 3 — empty draft on OLD snapshot ──────────────────────────────
  test(`OLD-Step3-hint-empty — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectOldSnapshot(page, 3, false);
    await page.locator('[data-nsm-step3-hint="reach"]').first().click();
    await waitForHintResolved(page);
    await page.screenshot({ path: path.join(OUT_DIR, `OLD-step3-hint-empty-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  // ─── Step 3 — filled draft on OLD snapshot ─────────────────────────────
  test(`OLD-Step3-hint-filled — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectOldSnapshot(page, 3, true);
    await page.locator('[data-nsm-step3-hint="reach"]').first().click();
    await waitForHintResolved(page);
    await page.screenshot({ path: path.join(OUT_DIR, `OLD-step3-hint-filled-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });
}
