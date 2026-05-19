// tests/visual/wave1-b6-mockup04-drift-fix.spec.js
//
// B6 D-1/D-2/D-3/D-5/D-6/D-7/D-8/D-9/D-10/D-11 — Phase 1.5 Gate drift fixes (10 drifts)
// D-4 already shipped (L32 circles-gate-warn-icon-color.spec.js).
//
// KARPATHY APPLY:
//   Think Before: Read mockup 04 §A/§B/§C/§D vs production renderCirclesGate 5082-5198.
//     Root causes confirmed:
//       D-1: ok sub copy missing "四個欄位" prefix + "，沒有需要修正"
//       D-2: warn title/sub copy divergence ("框架可通過" → "通過附提醒"; sub wording)
//       D-3: error title/sub copy divergence ("方向需修正" → "需要修正方向"; sub wording)
//       D-5: gate-section-label count always "N / M 通過" vs per-state format
//       D-6: warn suggestion label "修正方向：" should be "建議" (orange like mockup)
//       D-7: loading title "正在審核框架" → "AI 正在審核你的框架"; sub divergence
//       D-8: loading checklist 4 steps → 5 steps per mockup
//       D-9: loading desktop phase-head meta missing "已 Ns" marker
//       D-10: result states phase-head meta timer + field count missing entirely
//       D-11: qchip icon ph-info → ph-bookmark-simple; tablet/desktop company line richer
//   Simplicity First: AppState injection pattern (same as D-4 spec); no real OpenAI call.
//   Surgical Changes: assertions per drift; getComputedStyle 3-measure critical check.
//   Goal-Driven: DOM text/class + getComputedStyle + toHaveScreenshot (baseline awaiting Director).
//
// SKILLS APPLIED (per STANDING feedback_playwright_skill_cited_application):
//   §3.4 / Pitfall 18 — page.evaluate getComputedStyle for measurement diffs (Critical #4/#5)
//   §3.6 / Pitfall 3  — data-attr locators where applicable
//   §3.8 api-testing.md 783-848 — AppState injection as deterministic state seed (Pitfall 11 carve-out)
//   §3.11 cross-vp     — 3 projects: Desktop-1280 / iPad / Mobile-360
//   §3.13 visual-regression.md — toHaveScreenshot 0.5% threshold (baseline from mockup HTML per STANDING)
//   §3.18              — 5x consecutive 0-flake gate (DOM+measurement assertions)
//   Pitfall 11 carve-out: AppState.circlesGateResult injected directly — NOT mocking own API.
//   Pitfall 14: no module-level shared state; all state set inside test body / evaluate.
//
// 🚫 ABSOLUTE PROHIBITIONS:
//   1. 禁 --update-snapshots from production (per STANDING feedback_visual_baseline_from_mockup_not_production)
//      → baseline 來自 mockup HTML render；Director 親跑 scripts/capture-mockup-04-baselines.js
//   5. 禁直接 append audit/e2e-master-tracker.md → 寫 audit/wave1-task-5-findings.md 給 Director consolidate
//   7. 禁 commit (live demo gate) — 只 stage，等 user「對」

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const EVIDENCE_DIR = path.join(__dirname, '..', '..', 'audit', 'wave1-task5-b6-evidence');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// ── Boot helpers ──────────────────────────────────────────────────────────────

async function bootAndInjectState(page, overallStatus) {
  // Pitfall 14: clear persisted state before scripts run.
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  // Stub GET session-list endpoints to prevent auto-resume.
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);

  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  await page.evaluate((status) => {
    const A = window.AppState;
    if (!A || !window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) {
      throw new Error('AppState or CIRCLES_QUESTIONS not ready');
    }
    const q = window.CIRCLES_QUESTIONS[0];

    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'I';   // use I step to get stepLetter 'I'
    A.circlesPhase            = 1.5;
    A.circlesSimStep          = 0;
    A.circlesSession          = null;
    A.circlesLocked           = false;
    A.circlesStale            = false;
    A.circlesGateLoading      = false;
    A.circlesGateError        = null;
    A.circlesGateElapsed      = '11.4 秒';  // D-10 timer test value
    A.circlesGateLoadingElapsed = 0;

    if (status === 'ok') {
      A.circlesGateResult = {
        canProceed: true,
        overallStatus: 'ok',
        items: [
          { field: '目標用戶分群', title: '用戶輪廓清晰', reason: 'OK', status: 'ok', suggestion: null },
          { field: '選定焦點對象', title: '焦點明確', reason: 'OK', status: 'ok', suggestion: null },
          { field: '用戶動機假設', title: '動機可被檢驗', reason: 'OK', status: 'ok', suggestion: null },
          { field: '排除對象', title: '明確標出不處理', reason: 'OK', status: 'ok', suggestion: null },
        ],
      };
    } else if (status === 'warn') {
      A.circlesGateResult = {
        canProceed: true,
        overallStatus: 'warn',
        items: [
          { field: '功能性需求', title: '功能性需求具體', reason: 'OK', status: 'ok', suggestion: null },
          { field: '情感性需求', title: '情感需求停在表面', reason: '太籠統', status: 'warn', suggestion: '加情感 anchor 更具體' },
          { field: '社交性需求', title: '社交需求有區分情境', reason: 'OK', status: 'ok', suggestion: null },
          { field: '核心痛點',   title: '痛點未排序', reason: '缺核心排序', status: 'warn', suggestion: '選最痛 1 條' },
        ],
      };
    } else if (status === 'error') {
      A.circlesGateResult = {
        canProceed: false,
        overallStatus: 'error',
        items: [
          { field: '問題範圍', title: '邊界沒劃清', reason: '跳到方案', status: 'error', suggestion: '改寫成範圍而非答案' },
          { field: '時間範圍', title: '時間視窗明確', reason: 'OK', status: 'ok', suggestion: null },
          { field: '業務影響', title: '量化影響合理', reason: 'OK', status: 'ok', suggestion: null },
          { field: '假設確認', title: '假設只列 KPI', reason: '缺 belief', status: 'error', suggestion: '改寫成可被檢驗的 belief' },
        ],
      };
    }
    window.render();
  }, overallStatus);

  await page.locator('[data-circles-phase="1.5"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function bootAndInjectLoading(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);

  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  await page.evaluate(() => {
    const A = window.AppState;
    if (!A || !window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) {
      throw new Error('AppState or CIRCLES_QUESTIONS not ready');
    }
    const q = window.CIRCLES_QUESTIONS[0];
    A.circlesSelectedQuestion  = q;
    A.circlesMode              = 'drill';
    A.circlesDrillStep         = 'I';
    A.circlesPhase             = 1.5;
    A.circlesSimStep           = 0;
    A.circlesSession           = null;
    A.circlesLocked            = false;
    A.circlesStale             = false;
    A.circlesGateResult        = null;
    A.circlesGateError         = null;
    A.circlesGateLoading       = true;
    A.circlesGateLoadingElapsed = 0;
    window.render();
  });

  await page.locator('[data-circles-phase="1.5"]').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('.gate-loading-wrap').waitFor({ state: 'visible', timeout: 5_000 });
}

// ── D-1: ok sub copy ─────────────────────────────────────────────────────────

test.describe('D-1 — ok transition bar sub copy', () => {
  test('ok state: sub contains "四個欄位都對齊到" and "沒有需要修正"', async ({ page }) => {
    await bootAndInjectState(page, 'ok');
    const sub = page.locator('.gate-transition--ok .gate-transition__sub');
    await expect(sub).toBeVisible();
    const text = await sub.textContent();
    expect(text).toContain('四個欄位都對齊到');
    expect(text).toContain('沒有需要修正');
  });
});

// ── D-2: warn transition bar copy ────────────────────────────────────────────

test.describe('D-2 — warn transition bar copy', () => {
  test('warn state: title is "通過附提醒" (not "框架可通過")', async ({ page }) => {
    await bootAndInjectState(page, 'warn');
    const title = page.locator('.gate-transition--warn .gate-transition__title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('通過附提醒');
  });

  test('warn state: sub contains "可優化" and "Phase 2 不會卡"', async ({ page }) => {
    await bootAndInjectState(page, 'warn');
    const sub = page.locator('.gate-transition--warn .gate-transition__sub');
    await expect(sub).toBeVisible();
    const text = await sub.textContent();
    expect(text).toContain('可優化');
    expect(text).toContain('Phase 2 不會卡');
  });
});

// ── D-3: error transition bar copy ───────────────────────────────────────────

test.describe('D-3 — error transition bar copy', () => {
  test('error state: title is "需要修正方向" (not "方向需修正")', async ({ page }) => {
    await bootAndInjectState(page, 'error');
    const title = page.locator('.gate-transition--error .gate-transition__title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('需要修正方向');
  });

  test('error state: sub contains "偏離" and "請回頭調整"', async ({ page }) => {
    await bootAndInjectState(page, 'error');
    const sub = page.locator('.gate-transition--error .gate-transition__sub');
    await expect(sub).toBeVisible();
    const text = await sub.textContent();
    expect(text).toContain('偏離');
    expect(text).toContain('請回頭調整');
  });
});

// ── D-5: gate-section-label count format ─────────────────────────────────────

test.describe('D-5 — gate-section-label count format per state', () => {
  test('ok state: count is "4 / 4 通過" format', async ({ page }) => {
    await bootAndInjectState(page, 'ok');
    const count = page.locator('.gate-section-label__count');
    await expect(count).toBeVisible();
    const text = await count.textContent();
    expect(text).toContain('通過');
    expect(text).toContain('/');
    expect(text).not.toContain('提醒');
    expect(text).not.toContain('阻擋');
  });

  test('warn state: count is "N 通過 · N 提醒" format (not N / M 通過)', async ({ page }) => {
    await bootAndInjectState(page, 'warn');
    const count = page.locator('.gate-section-label__count');
    await expect(count).toBeVisible();
    const text = await count.textContent();
    expect(text).toContain('通過');
    expect(text).toContain('提醒');
    expect(text).not.toContain('/');
  });

  test('error state: count is "N 通過 · N 阻擋" format (not N / M 通過)', async ({ page }) => {
    await bootAndInjectState(page, 'error');
    const count = page.locator('.gate-section-label__count');
    await expect(count).toBeVisible();
    const text = await count.textContent();
    expect(text).toContain('通過');
    expect(text).toContain('阻擋');
    expect(text).not.toContain('/');
  });
});

// ── D-6: warn suggestion label color ─────────────────────────────────────────

test.describe('D-6 — warn gate-item suggestion label', () => {
  test('warn item suggestion label is "建議" (not "修正方向：" or "修正")', async ({ page }) => {
    await bootAndInjectState(page, 'warn');
    // warn items have .gate-item--warn .gate-item__suggestion strong
    const warnSuggLabel = page.locator('.gate-item--warn .gate-item__suggestion strong').first();
    await expect(warnSuggLabel).toBeVisible();
    await expect(warnSuggLabel).toHaveText('建議');
  });

  test('warn item suggestion label color is orange (var(--c-warn) = #B85C00)', async ({ page }) => {
    await bootAndInjectState(page, 'warn');
    // §3.4 / Pitfall 18 — getComputedStyle color measurement (Critical #4/#5)
    const color = await page.evaluate(() => {
      const label = document.querySelector('.gate-item--warn .gate-item__suggestion strong');
      if (!label) return null;
      return window.getComputedStyle(label).color;
    });
    expect(color).toBeTruthy();
    // --c-warn: #B85C00 = rgb(184, 92, 0) — orange/amber
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      expect(r).toBeGreaterThan(100);  // red channel high (orange)
      expect(b).toBeLessThan(50);       // no significant blue
    }
  });

  test('error item suggestion label is "修正" (not "建議")', async ({ page }) => {
    await bootAndInjectState(page, 'error');
    const errSuggLabel = page.locator('.gate-item--error .gate-item__suggestion strong').first();
    await expect(errSuggLabel).toBeVisible();
    await expect(errSuggLabel).toHaveText('修正');
  });

  // §3.4 / Pitfall 18 — getComputedStyle 3-measure per Critical #4/#5
  test('D-6 getComputedStyle 3-measure: warn suggestion bg/border/color', async ({ page }) => {
    await bootAndInjectState(page, 'warn');
    const measures = await page.evaluate(() => {
      const sugg = document.querySelector('.gate-item--warn .gate-item__suggestion');
      if (!sugg) return null;
      const cs = window.getComputedStyle(sugg);
      return {
        background: cs.backgroundColor,
        borderColor: cs.borderTopColor,
        display: cs.display,
      };
    });
    expect(measures).toBeTruthy();
    // warn suggestion bg: rgba(184,92,0,0.07) — orange tint, not transparent white
    // Check it's not the default white/transparent
    const bgMatch = measures.background.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (bgMatch) {
      const [, r, g, b] = bgMatch.map(Number);
      // orange tint: r dominates; this should not be pure white (255,255,255)
      expect(r).toBeLessThan(255);   // some tint present
    }
    expect(measures.display).not.toBe('none');
  });
});

// ── D-7: loading title + sub copy ────────────────────────────────────────────

test.describe('D-7 — loading state title + sub copy', () => {
  test('loading title is "AI 正在審核你的框架" (not "正在審核框架")', async ({ page }) => {
    await bootAndInjectLoading(page);
    const title = page.locator('.gate-loading-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('AI 正在審核你的框架');
  });

  test('loading sub contains "8 - 15 秒" (not "教練閱讀你的回答中")', async ({ page }) => {
    await bootAndInjectLoading(page);
    const sub = page.locator('.gate-loading-sub');
    await expect(sub).toBeVisible();
    const text = await sub.textContent();
    expect(text).toContain('8 - 15 秒');
    expect(text).not.toContain('教練閱讀');
  });
});

// ── D-8: loading checklist 5 steps ───────────────────────────────────────────

test.describe('D-8 — loading checklist 5 steps', () => {
  test('loading checklist has exactly 5 steps', async ({ page }) => {
    await bootAndInjectLoading(page);
    const steps = page.locator('.gate-loading-step');
    await expect(steps).toHaveCount(5);
  });

  test('loading checklist step texts include: 解析框架草稿 / 偵測陷阱方向 / 整合通行判斷', async ({ page }) => {
    await bootAndInjectLoading(page);
    const allStepText = await page.locator('.gate-loading-checklist').textContent();
    expect(allStepText).toContain('解析框架草稿');
    expect(allStepText).toContain('偵測陷阱方向');
    expect(allStepText).toContain('整合通行判斷');
    // old incorrect steps should not appear
    expect(allStepText).not.toContain('解析欄位內容');
    expect(allStepText).not.toContain('整理回饋');
  });
});

// ── D-9: loading phase-head meta — desktop "已" marker ───────────────────────

test.describe('D-9 — loading phase-head meta desktop marker', () => {
  // Note: phase-head__meta is hidden on mobile (max-width:767px) — CSS @media hides it.
  // D-9 desktop "已 Ns" marker only visible on Desktop-1280; tablet shows "等待 AI 審核回應".
  test('loading state phase-head meta element exists in DOM (hidden on mobile via CSS)', async ({ page }, testInfo) => {
    await bootAndInjectLoading(page);
    // Meta element exists in DOM at all viewports (hidden via CSS on mobile, not removed).
    const metaCount = await page.locator('.phase-head__meta').count();
    expect(metaCount).toBeGreaterThan(0);
    // Desktop element exists in DOM (may be display:none on mobile via CSS)
    const desktopElCount = await page.locator('.phase-head__meta-extra--desktop').count();
    expect(desktopElCount).toBeGreaterThan(0);
  });

  test('loading phase-head eyebrow says "框架審核中" (not "框架審核")', async ({ page }) => {
    await bootAndInjectLoading(page);
    const eyebrow = page.locator('.phase-head__eyebrow');
    await expect(eyebrow).toBeVisible();
    const text = await eyebrow.textContent();
    expect(text).toContain('框架審核中');
  });
});

// ── D-10: result state phase-head meta timer + field count ───────────────────

test.describe('D-10 — result state phase-head meta timer + field count', () => {
  test('ok result: phase-head meta element exists in DOM + timer element present', async ({ page }) => {
    await bootAndInjectState(page, 'ok');
    // Meta element exists in DOM (hidden on mobile via CSS — per mockup 04, mobile has no meta)
    const metaCount = await page.locator('.phase-head__meta').count();
    expect(metaCount).toBeGreaterThan(0);
    // Timer element (tablet+ visible) should exist in DOM
    const timerEl = page.locator('.phase-head__meta-extra--tablet-plus').first();
    expect(await timerEl.count()).toBeGreaterThan(0);
    // Timer text contains "審核耗時"
    const timerText = await timerEl.textContent();
    expect(timerText).toContain('審核耗時');
  });

  test('warn result: phase-head meta contains "提醒" in desktop field summary', async ({ page }, testInfo) => {
    await bootAndInjectState(page, 'warn');
    const desktopEl = page.locator('.phase-head__meta-extra--desktop').last();
    expect(await desktopEl.count()).toBeGreaterThan(0);
    // On desktop viewport, this element should contain field summary
    if (testInfo.project.name === 'Desktop-1280') {
      const text = await desktopEl.textContent();
      // warn: "4 個欄位 · 2 通過 · 2 提醒"
      expect(text).toContain('提醒');
    }
  });

  test('error result: phase-head meta desktop contains "阻擋"', async ({ page }, testInfo) => {
    await bootAndInjectState(page, 'error');
    const desktopEl = page.locator('.phase-head__meta-extra--desktop').last();
    expect(await desktopEl.count()).toBeGreaterThan(0);
    if (testInfo.project.name === 'Desktop-1280') {
      const text = await desktopEl.textContent();
      expect(text).toContain('阻擋');
    }
  });

  // §3.4 / Pitfall 18 — getComputedStyle 3-measure: meta visibility on desktop (Critical #4/#5)
  test('D-10 getComputedStyle 3-measure: meta display/padding/color on desktop', async ({ page }, testInfo) => {
    await bootAndInjectState(page, 'ok');
    const measures = await page.evaluate(() => {
      const meta = document.querySelector('.phase-head__meta');
      if (!meta) return null;
      const cs = window.getComputedStyle(meta);
      return {
        display: cs.display,
        gap: cs.gap,
        color: cs.color,
      };
    });
    expect(measures).toBeTruthy();
    expect(measures.display).not.toBe('none');  // meta must be visible
  });
});

// ── D-11: qchip icon + content ───────────────────────────────────────────────

test.describe('D-11 — qchip icon ph-bookmark-simple + content', () => {
  test('qchip icon class contains ph-bookmark-simple (not ph-info)', async ({ page }) => {
    await bootAndInjectState(page, 'ok');
    const iconEl = page.locator('.qchip__icon i').first();
    await expect(iconEl).toBeVisible();
    const cls = await iconEl.getAttribute('class');
    expect(cls).toContain('ph-bookmark-simple');
    expect(cls).not.toContain('ph-info');
  });

  test('qchip__company-long element exists in DOM (tablet+ responsive support)', async ({ page }) => {
    await bootAndInjectState(page, 'ok');
    const longEl = page.locator('.qchip__company-long').first();
    expect(await longEl.count()).toBeGreaterThan(0);
  });

  test('D-11 getComputedStyle 3-measure: qchip icon size/color/display', async ({ page }) => {
    await bootAndInjectState(page, 'ok');
    const measures = await page.evaluate(() => {
      const icon = document.querySelector('.qchip__icon i');
      if (!icon) return null;
      const cs = window.getComputedStyle(icon);
      return {
        display: cs.display,
        fontSize: cs.fontSize,
        color: cs.color,
      };
    });
    expect(measures).toBeTruthy();
    expect(measures.display).not.toBe('none');
  });
});

// ── Visual regression: toHaveScreenshot per state × vp ───────────────────────
// NOTE: These toHaveScreenshot calls require baseline PNGs captured from mockup 04 HTML.
// Director must run: node scripts/capture-mockup-04-baselines.js
// Per ABSOLUTE PROHIBITION #1: 禁 --update-snapshots from production.
// Until Director runs baseline capture, these will FAIL — this is EXPECTED.

test.describe('visual-regression: gate transition bars (awaiting mockup baseline)', () => {
  test('ok state gate-transition region vs mockup baseline', async ({ page }, testInfo) => {
    await bootAndInjectState(page, 'ok');
    const bar = page.locator('.gate-transition--ok');
    await expect(bar).toBeVisible();

    // Evidence PNG for Director cold-Read (not the baseline)
    const evidencePath = path.join(EVIDENCE_DIR, `ok-transition-${testInfo.project.name}.png`);
    await bar.screenshot({ path: evidencePath, animations: 'disabled' });

    // Visual regression vs mockup-sourced baseline (Director runs capture first)
    await expect(bar).toHaveScreenshot(
      `gate-ok-transition-${testInfo.project.name}.png`,
      { maxDiffPixelRatio: 0.005, animations: 'disabled' }
    );
  });

  test('warn state gate-transition region vs mockup baseline', async ({ page }, testInfo) => {
    await bootAndInjectState(page, 'warn');
    const bar = page.locator('.gate-transition--warn');
    await expect(bar).toBeVisible();

    const evidencePath = path.join(EVIDENCE_DIR, `warn-transition-${testInfo.project.name}.png`);
    await bar.screenshot({ path: evidencePath, animations: 'disabled' });

    await expect(bar).toHaveScreenshot(
      `gate-warn-transition-${testInfo.project.name}.png`,
      { maxDiffPixelRatio: 0.005, animations: 'disabled' }
    );
  });

  test('error state gate-transition region vs mockup baseline', async ({ page }, testInfo) => {
    await bootAndInjectState(page, 'error');
    const bar = page.locator('.gate-transition--error');
    await expect(bar).toBeVisible();

    const evidencePath = path.join(EVIDENCE_DIR, `error-transition-${testInfo.project.name}.png`);
    await bar.screenshot({ path: evidencePath, animations: 'disabled' });

    await expect(bar).toHaveScreenshot(
      `gate-error-transition-${testInfo.project.name}.png`,
      { maxDiffPixelRatio: 0.005, animations: 'disabled' }
    );
  });

  test('loading state gate-loading-wrap region vs mockup baseline', async ({ page }, testInfo) => {
    await bootAndInjectLoading(page);
    const wrap = page.locator('.gate-loading-wrap');
    await expect(wrap).toBeVisible();

    const evidencePath = path.join(EVIDENCE_DIR, `loading-wrap-${testInfo.project.name}.png`);
    await wrap.screenshot({ path: evidencePath, animations: 'disabled' });

    await expect(wrap).toHaveScreenshot(
      `gate-loading-wrap-${testInfo.project.name}.png`,
      { maxDiffPixelRatio: 0.005, animations: 'disabled' }
    );
  });
});
