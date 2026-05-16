/**
 * NSM Full-Flow Exhaustive Scan — 2026-05-11
 *
 * THROWAWAY spec — comprehensive end-to-end button-click scan of every NSM
 * scenario A1-I4 from the audit checklist. Captures PNG per scenario × 3 vp
 * (Mobile-360 / iPad / Desktop-1280).
 *
 * Login: real account (user authorized) → tests authenticated NSM flow.
 *
 * Output dir: audit/png-nsm-full-scan/{scenario}-{viewport}.png
 *
 * Read-only — never mutates production code.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT_DIR  = path.join(__dirname, '../../audit/png-nsm-full-scan');
const EMAIL    = 'albertpeng678@gmail.com';
const PW       = '21345678';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'Mobile-360',   width: 360,  height: 780,  isMobile: true  },
  { name: 'iPad',         width: 768,  height: 1024, isMobile: true  },
  { name: 'Desktop-1280', width: 1280, height: 800,  isMobile: false },
];

test.describe.configure({ mode: 'parallel' });

// ── Helpers ──────────────────────────────────────────────────────────────────
async function gotoApp(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}

async function loginIfAuthShown(page) {
  // If auth form visible, log in. Else assume token already in localStorage.
  const emailIn = page.locator('#auth-email');
  if (await emailIn.isVisible().catch(() => false)) {
    await emailIn.fill(EMAIL);
    await page.locator('#auth-pw').fill(PW);
    await page.locator('#auth-submit').click();
    await page.waitForTimeout(2000);
  }
}

async function gotoNSM(page) {
  // Click nav tab
  const tab = page.locator('[data-nav="nsm"]').first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(800);
  } else {
    // fallback: set state directly
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 1;
      window.render && window.render();
    });
    await page.waitForTimeout(400);
  }
}

async function snap(page, vp, label) {
  const p = path.join(OUT_DIR, `${label}-${vp.name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function injectStep(page, step, opts = {}) {
  // Force-seed AppState onto a specific NSM step with q3 Slack (B2B SaaS).
  await page.evaluate(([step, opts]) => {
    const questions = window.NSM_QUESTIONS || [];
    const q = questions.find(x => x.id === 'q3') || questions[0];
    if (!q) return;
    const AS = window.AppState;
    AS.view = 'nsm';
    AS.nsmStep = step;
    AS.nsmSelectedQuestion = q;
    AS.nsmDefinition = opts.def
      || (opts.fillDef ? { nsm: '每月活躍發言的工作區數', explanation: '發言代表真正使用 Slack 是核心 AHA 行為', businessLink: '發言↑→留存↑→ARR↑ 這是公司收入引擎' } : { nsm: '', explanation: '', businessLink: '' });
    AS.nsmBreakdown = opts.breakdown
      || (opts.fillBreakdown ? { reach: '60% 月活躍工作區', depth: '20 條 message/人/週', frequency: 'DAU/MAU 50%', impact: 'NRR 110% 留存率' } : { reach: '', depth: '', frequency: '', impact: '' });
    AS.nsmGateResult = opts.gateResult || null;
    AS.nsmEvalResult = opts.evalResult || null;
    AS.nsmGateLoading = !!opts.gateLoading;
    AS.nsmEvalLoading = !!opts.evalLoading;
    AS.nsmGateError = opts.gateError || null;
    AS.nsmEvalError = opts.evalError || null;
    AS.nsmGateLoadingStep = opts.loadingStep || 0;
    AS.nsmSubTab = opts.subTab || (step === 3 ? 'nsm-step3' : 'nsm-step2');
    AS.nsmExampleExpanded = opts.exampleExpanded || {};
    AS.nsmHintExpanded = {};
    AS.nsmDimExampleExpanded = opts.dimExampleExpanded || {};
    AS.nsmContextExpanded = !!opts.contextExpanded;
  }, [step, opts]);
  await page.evaluate(() => window.render && window.render());
  await page.waitForTimeout(500);
}

for (const vp of VIEWPORTS) {
  test.describe(`vp:${vp.name}`, () => {

    test.beforeEach(async ({ browser }, testInfo) => {
      testInfo.setTimeout(120000);
    });

    // ─── A. 入口 ─────────────────────────────────────────────────────────
    test(`A1-navbar-tab-nsm — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page);
      await loginIfAuthShown(page);
      await snap(page, vp, 'A1-before-click-nsm-tab');
      const tab = page.locator('[data-nav="nsm"]').first();
      if (await tab.isVisible().catch(() => false)) await tab.click();
      await page.waitForTimeout(800);
      await snap(page, vp, 'A1-after-click-nsm-tab');
      await ctx.close();
    });

    test(`A2-circles-home-nsm-cta — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page);
      await loginIfAuthShown(page);
      await page.waitForTimeout(500);
      const cta = page.locator('[data-circles="nsm-promo"]').first();
      const visible = await cta.isVisible().catch(() => false);
      await snap(page, vp, 'A2-before-cta-visible-' + visible);
      if (visible) {
        await cta.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await cta.click();
        await page.waitForTimeout(800);
      }
      await snap(page, vp, 'A2-after-cta');
      await ctx.close();
    });

    test(`A3-offcanvas-history-open — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page);
      await loginIfAuthShown(page);
      const burger = page.locator('[data-nav="offcanvas"]').first();
      if (await burger.isVisible().catch(() => false)) await burger.click();
      await page.waitForTimeout(800);
      await snap(page, vp, 'A3-offcanvas-open');
      await ctx.close();
    });

    // ─── B. Step 1 — 選題 ─────────────────────────────────────────────────
    test(`B1-step1-filter-all — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await snap(page, vp, 'B1-step1-default');
      // Click 4 product type filters in turn (desktop has rail; mobile no rail)
      const filters = ['attention', 'transaction', 'creator', 'saas', 'all'];
      for (const f of filters) {
        const row = page.locator(`[data-nsm-filter="${f}"]`).first();
        if (await row.isVisible().catch(() => false)) {
          await row.click();
          await page.waitForTimeout(400);
          await snap(page, vp, `B1-filter-${f}`);
        }
      }
      await ctx.close();
    });

    test(`B2-step1-search — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      const tryQueries = ['Slack', '中文公司', '\'"<>', '   ', 'zzzzzz'];
      for (const q of tryQueries) {
        const si = page.locator('[data-nsm="search"]').first();
        if (await si.isVisible().catch(() => false)) {
          await si.fill('');
          await si.fill(q);
          await page.waitForTimeout(500);
          await snap(page, vp, `B2-search-${encodeURIComponent(q).slice(0, 16)}`);
        } else {
          await snap(page, vp, `B2-search-not-visible-${vp.name}`);
          break;
        }
      }
      await ctx.close();
    });

    test(`B3-step1-reshuffle-x3 — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      const ids0 = await page.$$eval('.nsm-q-card[data-qid]', els => els.map(e => e.dataset.qid));
      await snap(page, vp, `B3-initial-ids-${ids0.join(',').slice(0,40)}`);
      for (let i = 1; i <= 3; i++) {
        const btn = page.locator('[data-nsm="shuffle"]').first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(400);
          const ids = await page.$$eval('.nsm-q-card[data-qid]', els => els.map(e => e.dataset.qid));
          await snap(page, vp, `B3-reshuffle-${i}-${ids.join(',').slice(0,40)}`);
        }
      }
      await ctx.close();
    });

    test(`B5-step1-card-select — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await page.waitForTimeout(500);
      const cards = page.locator('.nsm-q-card[data-qid]');
      const n = await cards.count();
      await snap(page, vp, `B5-cards-${n}`);
      if (n > 0) {
        await cards.first().click();
        await page.waitForTimeout(1000); // context may fetch
        await snap(page, vp, 'B5-card-selected');
      }
      await ctx.close();
    });

    test(`B6-step1-start-disabled-then-enabled — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      const startBtn = page.locator('[data-nsm="start"]').first();
      const isDisabled = await startBtn.evaluate(b => b.disabled).catch(() => null);
      await snap(page, vp, `B6-start-disabled-${isDisabled}`);
      // Now select a card and re-check
      const cards = page.locator('.nsm-q-card[data-qid]');
      if (await cards.count() > 0) {
        await cards.first().click();
        await page.waitForTimeout(600);
        const isDisabled2 = await startBtn.evaluate(b => b.disabled).catch(() => null);
        await snap(page, vp, `B6-after-select-disabled-${isDisabled2}`);
        if (!isDisabled2) {
          await startBtn.click();
          await page.waitForTimeout(1500);
          await snap(page, vp, 'B6-after-start-clicked');
        }
      }
      await ctx.close();
    });

    // ─── C. Step 2 — 定義 NSM ────────────────────────────────────────────
    test(`C1-step2-empty-submit — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2);
      const submit = page.locator('[data-nsm-submit]').first();
      const dis = await submit.evaluate(b => b.disabled).catch(() => null);
      await snap(page, vp, `C1-step2-empty-submit-disabled-${dis}`);
      // try force click
      if (await submit.isVisible().catch(() => false)) {
        await submit.click({ force: true }).catch(() => {});
        await page.waitForTimeout(800);
        await snap(page, vp, 'C1-step2-after-force-click');
      }
      await ctx.close();
    });

    test(`C2-step2-fill-all-submit — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2, { fillDef: true });
      await snap(page, vp, 'C2-step2-all-filled');
      // we're not actually clicking submit (which would call API) — just confirming button enabled
      const submit = page.locator('[data-nsm-submit]').first();
      const dis = await submit.evaluate(b => b.disabled).catch(() => null);
      await snap(page, vp, `C2-step2-submit-disabled-${dis}`);
      await ctx.close();
    });

    test(`C3-step2-hint-modals — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2);
      for (const f of ['nsm', 'explanation', 'businessLink']) {
        const hint = page.locator(`[data-nsm-hint="${f}"]`).first();
        if (await hint.isVisible().catch(() => false)) {
          await hint.scrollIntoViewIfNeeded();
          await hint.click();
          await page.waitForTimeout(2500); // hint API can be slow
          await snap(page, vp, `C3-hint-${f}-empty-draft`);
          // close modal (X)
          const closeX = page.locator('[data-nsm-modal-close="x"]').first();
          if (await closeX.isVisible().catch(() => false)) {
            await closeX.click();
            await page.waitForTimeout(300);
          }
        }
      }
      // hint with filled draft
      await injectStep(page, 2, { fillDef: true });
      for (const f of ['nsm', 'explanation', 'businessLink']) {
        const hint = page.locator(`[data-nsm-hint="${f}"]`).first();
        if (await hint.isVisible().catch(() => false)) {
          await hint.scrollIntoViewIfNeeded();
          await hint.click();
          await page.waitForTimeout(2500);
          await snap(page, vp, `C3-hint-${f}-filled-draft`);
          const closeX = page.locator('[data-nsm-modal-close="x"]').first();
          if (await closeX.isVisible().catch(() => false)) { await closeX.click(); await page.waitForTimeout(300); }
        }
      }
      await ctx.close();
    });

    test(`C4-step2-example-toggles — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2);
      for (const f of ['nsm', 'explanation', 'businessLink']) {
        const toggle = page.locator(`[data-nsm-example-toggle="${f}"]`).first();
        if (await toggle.isVisible().catch(() => false)) {
          await toggle.scrollIntoViewIfNeeded();
          await toggle.click();
          await page.waitForTimeout(400);
          await snap(page, vp, `C4-example-${f}-expand`);
          const closeBtn = page.locator(`[data-nsm-example-close="${f}"]`).first();
          if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); await page.waitForTimeout(300); }
        }
      }
      await ctx.close();
    });

    test(`C5-step2-back-button — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2, { fillDef: true });
      await snap(page, vp, 'C5-before-back');
      const back = page.locator('[data-nsm-action="back"]').first();
      if (await back.isVisible().catch(() => false)) {
        await back.click();
        await page.waitForTimeout(800);
        await snap(page, vp, 'C5-after-back');
        // Check current state
        const state = await page.evaluate(() => ({
          step: window.AppState.nsmStep,
          def: window.AppState.nsmDefinition,
        }));
        await page.evaluate((s) => {
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;top:0;left:0;background:yellow;padding:8px;z-index:99999;font-size:12px';
          overlay.textContent = 'after back: step=' + s.step + ' def.nsm=' + (s.def && s.def.nsm ? s.def.nsm.slice(0,20) : 'EMPTY');
          document.body.appendChild(overlay);
        }, state);
        await snap(page, vp, 'C5-back-state-overlay');
      }
      await ctx.close();
    });

    test(`C6-step2-nav-circles-tab — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2, { fillDef: true });
      await snap(page, vp, 'C6-step2-filled-before-leave');
      const circlesTab = page.locator('[data-nav="circles"]').first();
      if (await circlesTab.isVisible().catch(() => false)) {
        await circlesTab.click();
        await page.waitForTimeout(800);
        await snap(page, vp, 'C6-after-circles-click');
        // back to nsm to see if data persisted
        const nsmTab = page.locator('[data-nav="nsm"]').first();
        if (await nsmTab.isVisible().catch(() => false)) {
          await nsmTab.click();
          await page.waitForTimeout(800);
          await snap(page, vp, 'C6-back-to-nsm');
        }
      }
      await ctx.close();
    });

    // ─── D. Step 3 — 拆解 ────────────────────────────────────────────────
    test(`D1-step3-hint-modals — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 3);
      for (const d of ['reach', 'depth', 'frequency', 'impact']) {
        const hint = page.locator(`[data-nsm-step3-hint="${d}"]`).first();
        if (await hint.isVisible().catch(() => false)) {
          await hint.scrollIntoViewIfNeeded();
          await hint.click();
          await page.waitForTimeout(3000);
          await snap(page, vp, `D1-step3-hint-${d}`);
          const closeX = page.locator('[data-nsm-modal-close="x"]').first();
          if (await closeX.isVisible().catch(() => false)) { await closeX.click(); await page.waitForTimeout(300); }
        }
      }
      await ctx.close();
    });

    test(`D2-step3-example-toggles — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 3);
      for (const d of ['reach', 'depth', 'frequency', 'impact']) {
        const t = page.locator(`[data-nsm-dim-example-toggle="${d}"]`).first();
        if (await t.isVisible().catch(() => false)) {
          await t.scrollIntoViewIfNeeded();
          await t.click();
          await page.waitForTimeout(400);
          await snap(page, vp, `D2-step3-example-${d}`);
          const c = page.locator(`[data-nsm-dim-example-close="${d}"]`).first();
          if (await c.isVisible().catch(() => false)) { await c.click(); await page.waitForTimeout(300); }
        }
      }
      await ctx.close();
    });

    test(`D3-step3-empty-submit — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 3);
      const s = page.locator('[data-nsm-submit]').first();
      const dis = await s.evaluate(b => b.disabled).catch(() => null);
      await snap(page, vp, `D3-step3-empty-submit-disabled-${dis}`);
      await ctx.close();
    });

    test(`D5-step3-full-fill — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 3, { fillBreakdown: true });
      await snap(page, vp, 'D5-step3-all-filled');
      const s = page.locator('[data-nsm-submit]').first();
      const dis = await s.evaluate(b => b.disabled).catch(() => null);
      await snap(page, vp, `D5-step3-submit-disabled-${dis}`);
      await ctx.close();
    });

    test(`D6-step3-back-button — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 3, { fillBreakdown: true });
      const back = page.locator('[data-nsm-action="back-to-step2"]').first();
      if (await back.isVisible().catch(() => false)) {
        await back.click();
        await page.waitForTimeout(800);
        await snap(page, vp, 'D6-after-step3-back');
        const st = await page.evaluate(() => window.AppState.nsmStep);
        await page.evaluate((step) => {
          const o = document.createElement('div');
          o.style.cssText = 'position:fixed;top:0;left:0;background:yellow;padding:8px;z-index:99999';
          o.textContent = 'after step3 back: step=' + step;
          document.body.appendChild(o);
        }, st);
        await snap(page, vp, 'D6-back-state-overlay');
      }
      await ctx.close();
    });

    // ─── E. Gate states ──────────────────────────────────────────────────
    test(`E1-gate-ok-state — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2, {
        fillDef: true,
        subTab: 'nsm-gate',
        gateResult: {
          overall_status: 'ok',
          items: [
            { id: 'measurable',  label: '可量化',   status: 'ok', comment: '可清楚計算' },
            { id: 'aha',         label: 'AHA',     status: 'ok', comment: '抓住核心' },
            { id: 'value',       label: '價值連結', status: 'ok', comment: '反映用戶價值' },
            { id: 'business',    label: '商業相關', status: 'ok', comment: '與 ARR 連動' },
            { id: 'vanity',      label: '非虛榮',  status: 'ok', comment: '不會被廣告灌水' },
          ],
        },
      });
      await snap(page, vp, 'E1-gate-ok');
      await ctx.close();
    });

    test(`E1b-gate-warn-state — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2, {
        fillDef: true,
        subTab: 'nsm-gate',
        gateResult: {
          overall_status: 'warn',
          items: [
            { id: 'measurable',  label: '可量化',   status: 'ok',   comment: '可清楚計算' },
            { id: 'aha',         label: 'AHA',     status: 'warn', comment: '有些模糊建議再精確' },
            { id: 'value',       label: '價值連結', status: 'ok',   comment: 'OK' },
            { id: 'business',    label: '商業相關', status: 'warn', comment: '連結較弱' },
            { id: 'vanity',      label: '非虛榮',  status: 'ok',   comment: 'OK' },
          ],
        },
      });
      await snap(page, vp, 'E1b-gate-warn');
      await ctx.close();
    });

    test(`E1c-gate-error-state — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2, {
        fillDef: true,
        subTab: 'nsm-gate',
        gateResult: {
          overall_status: 'error',
          items: [
            { id: 'measurable',  label: '可量化',   status: 'error', comment: '無法計算' },
            { id: 'aha',         label: 'AHA',     status: 'error', comment: '未抓住核心行為' },
            { id: 'value',       label: '價值連結', status: 'ok',    comment: 'OK' },
            { id: 'business',    label: '商業相關', status: 'error', comment: '看不出商業相關性' },
            { id: 'vanity',      label: '非虛榮',  status: 'warn',  comment: '有部分風險' },
          ],
        },
      });
      await snap(page, vp, 'E1c-gate-error');
      // Verify no proceed btn (red blocks)
      const proceedBtn = page.locator('[data-nsm-gate-action="proceed"]').first();
      const proceedVisible = await proceedBtn.isVisible().catch(() => false);
      await page.evaluate((v) => {
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;top:0;left:0;background:yellow;padding:8px;z-index:99999';
        o.textContent = 'proceed visible: ' + v;
        document.body.appendChild(o);
      }, proceedVisible);
      await snap(page, vp, 'E1c-gate-error-overlay');
      await ctx.close();
    });

    test(`E2-gate-loading — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2, {
        fillDef: true,
        subTab: 'nsm-gate',
        gateLoading: true,
        loadingStep: 1,
      });
      await snap(page, vp, 'E2-gate-loading');
      await ctx.close();
    });

    // ─── F. Step 4 — 報告 ────────────────────────────────────────────────
    test(`F-step4-full-report — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 4, {
        fillDef: true,
        fillBreakdown: true,
        evalResult: {
          totalScore: 78,
          scores: { nsm: 4, reach: 3, depth: 4, frequency: 4, impact: 3 },
          coachComments: {
            nsm: '抓住核心，建議再具體',
            reach: '範圍清楚',
            depth: '深度有量化',
            frequency: '頻率合理',
            impact: '影響可量化',
          },
          coachRationale: {
            nsm: '因為發言反映真實使用',
            reach: '60% 是合理 benchmark',
            depth: '20 訊息/週是 healthy',
            frequency: 'DAU/MAU 50% 是 SaaS 標準',
            impact: 'NRR 110% 是健康成長',
          },
          coachTree: {
            nsm: '每週活躍工作區數',
            reach: '60% MAU',
            depth: '20 訊息/週/人',
            frequency: 'DAU/MAU 50%',
            impact: 'NRR 110%',
          },
          bestMove: '抓住 Slack 核心是發言頻率，正確聚焦',
          mainTrap: '小心 DAU 被會議室人潮稀釋',
          summary: '整體扎實，可進一步加深 30/60/90 milestone',
        },
      });
      // Tab 1: overview
      await snap(page, vp, 'F1-step4-overview');
      // Tab 2: comparison
      const tabCmp = page.locator('[data-nsm4-tab="comparison"]').first();
      if (await tabCmp.isVisible().catch(() => false)) {
        await tabCmp.click();
        await page.waitForTimeout(500);
        await snap(page, vp, 'F2-step4-comparison');
        // Click first coach card to expand
        const coach = page.locator('[data-nsm4-compare-node]').first();
        if (await coach.isVisible().catch(() => false)) {
          await coach.scrollIntoViewIfNeeded();
          await coach.click();
          await page.waitForTimeout(400);
          await snap(page, vp, 'F2b-step4-coach-expand');
          // close
          const closeC = page.locator('[data-nsm4-action="close-coach"]').first();
          if (await closeC.isVisible().catch(() => false)) {
            await closeC.click();
            await page.waitForTimeout(300);
            await snap(page, vp, 'F2c-step4-coach-closed');
          }
        }
      }
      const tabHL = page.locator('[data-nsm4-tab="highlights"]').first();
      if (await tabHL.isVisible().catch(() => false)) {
        await tabHL.click();
        await page.waitForTimeout(400);
        await snap(page, vp, 'F3-step4-highlights');
      }
      const tabDone = page.locator('[data-nsm4-tab="done"]').first();
      if (await tabDone.isVisible().catch(() => false)) {
        await tabDone.click();
        await page.waitForTimeout(400);
        await snap(page, vp, 'F4-step4-done');
      }
      // Back button check (should be hidden on done tab per Bug C fix)
      const backBtn = page.locator('[data-nsm4-action="back"]').first();
      const backVisible = await backBtn.isVisible().catch(() => false);
      await page.evaluate((v) => {
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;top:0;left:0;background:yellow;padding:8px;z-index:99999';
        o.textContent = 'on done tab — back visible: ' + v;
        document.body.appendChild(o);
      }, backVisible);
      await snap(page, vp, 'F4b-step4-done-back-check');
      // Retry button click — should go home & reshuffle (per comment line 6488)
      const retry = page.locator('[data-nsm4-action="retry"]').first();
      if (await retry.isVisible().catch(() => false)) {
        await retry.click();
        await page.waitForTimeout(1000);
        await snap(page, vp, 'F4c-step4-after-retry');
      }
      await ctx.close();
    });

    // ─── G. Modal ESC + Backdrop ────────────────────────────────────────
    test(`G1-modal-esc-and-backdrop — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      await injectStep(page, 2);
      // Open
      const hint = page.locator('[data-nsm-hint="nsm"]').first();
      if (await hint.isVisible().catch(() => false)) {
        await hint.click();
        await page.waitForTimeout(2500);
        await snap(page, vp, 'G1-modal-open');
        // try ESC
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        await snap(page, vp, 'G1-after-esc');
        // re-open + backdrop click
        await hint.click();
        await page.waitForTimeout(2500);
        const backdrop = page.locator('[data-nsm-modal-close="backdrop"]').first();
        if (await backdrop.isVisible().catch(() => false)) {
          await backdrop.click({ position: { x: 10, y: 10 } });
          await page.waitForTimeout(400);
          await snap(page, vp, 'G1-after-backdrop');
        }
      }
      await ctx.close();
    });

    // ─── I. Edge cases ──────────────────────────────────────────────────
    test(`I1-long-input — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      const long = '測試超長字串'.repeat(500); // ~3000 chars
      await injectStep(page, 2, { def: { nsm: long, explanation: long, businessLink: long } });
      await snap(page, vp, 'I1-long-input-step2');
      await injectStep(page, 3, { breakdown: { reach: long, depth: long, frequency: long, impact: long } });
      await snap(page, vp, 'I1-long-input-step3');
      await ctx.close();
    });

    test(`I2-emoji-special-chars — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      const page = await ctx.newPage();
      await gotoApp(page); await loginIfAuthShown(page); await gotoNSM(page);
      const ev = '🚀 emoji test 中文 & < > " \' / \\ DROP TABLE';
      await injectStep(page, 2, { def: { nsm: ev, explanation: ev + ev, businessLink: ev + ev } });
      await snap(page, vp, 'I2-emoji-step2');
      await ctx.close();
    });
  });
}
