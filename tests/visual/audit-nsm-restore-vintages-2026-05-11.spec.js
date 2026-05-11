/**
 * NSM offcanvas-restore vintage matrix audit (2026-05-11)
 *
 * 3 vintages × 8 viewports × multi-state to surface Bug 2/3/4 in real-world flow:
 *
 * Vintage A (fresh): question with full context + field_examples (already captured separately)
 *
 * Vintage B (OLD snapshot — pre-backfill): question_json lacks context + field_examples
 *   → reproduces Bug 2 (Step 2 example button silent fail; Step 3 button missing)
 *   → reproduces Bug 3 (4-block context expand all empty)
 *
 * Vintage C (locked): nsmEvalResult present, full text data, simulates evaluated session
 *   → verifies locked state hint/example buttons remain available (per
 *     mockup 07 v3 §D + memory feedback_lock_state_hint_example_always_available.md)
 *
 * Race scenario: AppState seeded as empty initial restore (mid-async-fetch) then later
 *   filled to simulate keystroke-overwrite risk.
 *
 * Output: audit/png-nsm-restore-vintages-2026-05-11/
 */
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT_DIR = path.join(__dirname, '../../audit/png-nsm-restore-vintages-2026-05-11');

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

// Build a question with selectable vintage profile.
// vintage = 'fresh' | 'old' | 'locked'
function makeQuestion(vintage, partialData) {
  const fresh = (window.NSM_QUESTIONS || []).find(x => x.id === 'q3') || {};
  if (vintage === 'fresh') return fresh;
  if (vintage === 'old') {
    // simulate pre-backfill snapshot: keep core fields, drop context + field_examples
    return {
      id: fresh.id,
      company: fresh.company || 'Slack',
      industry: fresh.industry || 'B2B SaaS',
      scenario: fresh.scenario || '企業付費是為了效率，若只註冊未發言將導致高退訂率。',
      coach_nsm: fresh.coach_nsm || '',
      anti_patterns: fresh.anti_patterns || [],
      // context: undefined  <-- intentionally omitted
      // field_examples: undefined  <-- intentionally omitted
    };
  }
  if (vintage === 'locked') return fresh; // use full snapshot but with eval result
  return fresh;
}

async function injectRestoredSession(page, vintage, step, opts = {}) {
  await page.evaluate(({ vintage, step, opts }) => {
    var questions = window.NSM_QUESTIONS || [];
    var fresh = questions.find(function (x) { return x.id === 'q3'; }) || questions[0];
    var q;
    if (vintage === 'fresh' || vintage === 'locked') {
      q = fresh;
    } else if (vintage === 'old') {
      // synthesize old snapshot (pre-backfill)
      q = {
        id: fresh.id || 'q3',
        company: fresh.company || 'Slack',
        industry: fresh.industry || 'B2B SaaS',
        scenario: fresh.scenario || '企業付費是為了效率，若只註冊未發言將導致高退訂率。',
        coach_nsm: fresh.coach_nsm || '',
        anti_patterns: fresh.anti_patterns || [],
        // context omitted
        // field_examples omitted
      };
    }
    var AS = window.AppState;
    AS.view = 'nsm';
    AS.nsmStep = step;
    AS.nsmSelectedQuestion = q;
    AS.nsmDefinition = vintage === 'locked' || opts.filled
      ? { nsm: '每月活躍發言的工作區數', explanation: '發言才代表真正使用，不是只登入', businessLink: '發言用戶 ↑ → 留存率 ↑ → 退訂 ↓' }
      : { nsm: '', explanation: '', businessLink: '' };
    AS.nsmBreakdown = vintage === 'locked' || opts.filled
      ? { reach: '60% MAU 比例', depth: '20 message/user/月', frequency: 'DAU/MAU 50%+', impact: 'NRR 110% 擴張' }
      : { reach: '', depth: '', frequency: '', impact: '' };
    AS.nsmEvalResult = vintage === 'locked'
      ? {
          dimensions: {
            reach: { score: 4, reasoning: '聚焦活躍用戶比例，避免虛榮註冊數', strengths: ['排除僵屍'], weaknesses: ['未指定時間窗'] },
            depth: { score: 4, reasoning: '聚焦每用戶發言量', strengths: ['量化清楚'], weaknesses: [] },
            frequency: { score: 5, reasoning: 'DAU/MAU 是 SaaS 黏著黃金指標', strengths: ['行業共識'], weaknesses: [] },
            impact: { score: 4, reasoning: 'NRR 連結商業留存', strengths: ['擴張信號'], weaknesses: [] },
          },
          overall_score: 4.25,
          summary: '指標定義清楚連結業務目標',
        }
      : null;
    AS.nsmGateResult = null;
    AS.nsmGateLoading = false;
    AS.nsmEvalLoading = false;
    AS.nsmExampleExpanded = opts.exampleExpanded || {};
    AS.nsmHintExpanded = {};
    AS.nsmDimExampleExpanded = opts.dimExampleExpanded || {};
    AS.nsmContextExpanded = !!opts.contextExpanded;
  }, { vintage, step, opts });
  await page.evaluate(() => { if (typeof window.render === 'function') window.render(); });
  await page.waitForTimeout(500);
}

for (const vp of VIEWPORTS) {
  // ─────── VINTAGE B: OLD snapshot (no ctx, no examples) ──────────────────────

  test(`B-step2-default-OLD — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectRestoredSession(page, 'old', 2);
    await page.screenshot({ path: path.join(OUT_DIR, `B-step2-default-OLD-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`B-step2-example-OLD-toggled — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    // simulate user click of example button on old snapshot — should silent-fail per Bug 2
    await injectRestoredSession(page, 'old', 2, { exampleExpanded: { nsm: true } });
    await page.screenshot({ path: path.join(OUT_DIR, `B-step2-example-OLD-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`B-step2-context-OLD-expanded — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectRestoredSession(page, 'old', 2, { contextExpanded: true });
    await page.screenshot({ path: path.join(OUT_DIR, `B-step2-context-OLD-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`B-step3-default-OLD — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectRestoredSession(page, 'old', 3);
    await page.screenshot({ path: path.join(OUT_DIR, `B-step3-default-OLD-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`B-step3-context-OLD-expanded — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectRestoredSession(page, 'old', 3, { contextExpanded: true });
    await page.screenshot({ path: path.join(OUT_DIR, `B-step3-context-OLD-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  // ─────── VINTAGE C: LOCKED session (evaluated, full data) ───────────────────

  test(`C-step2-locked — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectRestoredSession(page, 'locked', 2);
    await page.screenshot({ path: path.join(OUT_DIR, `C-step2-locked-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`C-step2-locked-example-open — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectRestoredSession(page, 'locked', 2, { exampleExpanded: { nsm: true } });
    await page.screenshot({ path: path.join(OUT_DIR, `C-step2-locked-example-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`C-step3-locked — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectRestoredSession(page, 'locked', 3);
    await page.screenshot({ path: path.join(OUT_DIR, `C-step3-locked-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`C-step4-locked-report — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectRestoredSession(page, 'locked', 4);
    await page.screenshot({ path: path.join(OUT_DIR, `C-step4-locked-report-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });
}
