// tests/visual/nsm-step4-drift-fix.spec.js
// Phase A audit + Phase B TDD — NSM Step 4 drift fixes vs mockup 14
//
// DRIFT-S4-1 🔴 BLOCKING: renderNSMStep4 called renderNSMProgress(4) — adds 4-dot
//   workshop stepper above nsm-nav. Mockup 14 has NO nsm-progress on Step 4 report.
//
// DRIFT-S4-2 ✅ ALREADY FIXED (line 7277): loadCirclesSessionFromHistory sets
//   AppState.nsmEvalResult = item.scores_json || null. Covered by nsm-step4-restore-scores.spec.js.
//
// DRIFT-S4-3 🟡 CSS: Production .nsm-body clamps to max-width:720px at tablet (≥768px).
//   Mockup 14 §body: max-width:920px base, max-width:1180px ≥1024px. No 720px cap.
//   Fix: add [data-nsm-step4] .nsm-body override in style.css.

const { test, expect } = require('@playwright/test');

// ── Shared fixtures ──────────────────────────────────────────────────────────

async function mockApis(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

const MOCK_EVAL = {
  scores: { alignment: 4, leading: 4, actionability: 5, simplicity: 4, sensitivity: 3 },
  totalScore: 80,
  coachComments: {
    alignment: '與商業價值連結清楚。', leading: '是領先指標。',
    actionability: '定義具體可量測。', simplicity: '指標名稱清楚。',
    sensitivity: '對週期敏感度尚可。',
  },
  coachTree: { nsm: '教練版 NSM', reach: '教練版觸及', depth: '教練版深度', frequency: '教練版頻率', impact: '教練版影響' },
  coachRationale: { nsm: '理由 nsm', reach: '理由 reach', depth: '理由 depth', frequency: '理由 freq', impact: '理由 impact' },
  bestMove: '最佳策略說明', mainTrap: '主要陷阱說明', summary: '整體總評說明',
};

const Q = {
  id: 'q-spotify', company: 'Spotify', industry: '音樂串流',
  scenario: 'Spotify Podcast NSM 訓練題目', product: 'Spotify Podcast',
};

async function setupStep4(page, { tab = 'overview', viewport = { width: 1280, height: 900 } } = {}) {
  await page.setViewportSize(viewport);
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard', { timeout: 10000 });
  await page.evaluate(({ q, evalResult, activeTab }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 4;
    window.AppState.nsmReportTab = activeTab;
    window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmEvalResult = evalResult;
    window.AppState.nsmActiveCompareNode = null;
    window.AppState.nsmDefinition = { nsm: '用戶定義', explanation: '說明', businessLink: '業務連結' };
    window.AppState.nsmBreakdown = { reach: '觸及', depth: '深度', frequency: '頻率', impact: '影響' };
    window.render();
  }, { q: Q, evalResult: MOCK_EVAL, activeTab: tab });
  await page.waitForSelector('[data-nsm-step4]', { timeout: 5000 });
}

// ── DRIFT-S4-1: NO nsm-progress on Step 4 ───────────────────────────────────

test.describe('DRIFT-S4-1: renderNSMProgress(4) removed from Step 4', () => {
  test('Step 4 does NOT render .nsm-progress element (was incorrectly added)', async ({ page }) => {
    await setupStep4(page);
    // nsm-progress must NOT appear — it belongs to Step 1/2/3 workshop flow only
    await expect(page.locator('[data-nsm-step4] .nsm-progress')).toHaveCount(0);
  });

  test('Step 4 starts directly with .nsm-nav (back button + NSM 報告 title)', async ({ page }) => {
    await setupStep4(page);
    const nsmNav = page.locator('[data-nsm-step4] .nsm-nav');
    await expect(nsmNav).toBeVisible();
    await expect(nsmNav.locator('.nsm-nav__title')).toHaveText('NSM 報告');
  });

  test('nsm-nav is the first significant child of [data-nsm-step4] (no stepper before it)', async ({ page }) => {
    await setupStep4(page);
    // First child of data-nsm-step4 must NOT be .nsm-progress
    const firstChildTag = await page.evaluate(() => {
      const el = document.querySelector('[data-nsm-step4]');
      return el ? el.firstElementChild.className : '';
    });
    expect(firstChildTag).not.toContain('nsm-progress');
    expect(firstChildTag).toContain('nsm-nav');
  });

  test('nsm-summary follows nsm-nav with score display', async ({ page }) => {
    await setupStep4(page);
    await expect(page.locator('[data-nsm-step4] .nsm-summary')).toBeVisible();
    await expect(page.locator('.nsm-summary__score')).toHaveText('80');
  });
});

// ── DRIFT-S4-3: nsm-body width scoping for Step 4 ──────────────────────────

test.describe('DRIFT-S4-3: nsm-body not clamped to 720px on Step 4 tablet', () => {
  test('Step 4 .nsm-body at tablet (768px) width is NOT clamped to 720px', async ({ page }) => {
    await setupStep4(page, { viewport: { width: 768, height: 1024 } });
    const nsmBody = page.locator('[data-nsm-step4] .nsm-body');
    await expect(nsmBody).toBeVisible();
    // offsetWidth of the nsm-body should be wider than 720px at 768px viewport
    // (with padding s-5 = 20px * 2 sides = inner at least 728px content width)
    const width = await nsmBody.evaluate(el => el.getBoundingClientRect().width);
    // 768px viewport - padding should give ~728px, definitely > 720px (the wrong old cap)
    expect(width).toBeGreaterThan(720);
  });

  test('Step 4 .nsm-body at desktop (1280px) has adequate width for 2-col radar layout', async ({ page }) => {
    await setupStep4(page);
    const nsmBody = page.locator('[data-nsm-step4] .nsm-body');
    const width = await nsmBody.evaluate(el => el.getBoundingClientRect().width);
    // Should be much wider than 720px at desktop — at least 900px
    expect(width).toBeGreaterThan(900);
  });
});

// ── Regression: all 4 tabs still render correctly after fix ─────────────────

test.describe('Regression: 4 tabs render correctly after drift fixes', () => {
  test('總覽 tab: nsm-overview, radar SVG, 5 score rows', async ({ page }) => {
    await setupStep4(page, { tab: 'overview' });
    await expect(page.locator('.nsm-overview')).toBeVisible();
    await expect(page.locator('.nsm-radar-svg')).toBeVisible();
    await expect(page.locator('.nsm-score-row')).toHaveCount(5);
  });

  test('對比 tab: desktop nsm-compare--grid with 5 rows', async ({ page }) => {
    await setupStep4(page, { tab: 'comparison' });
    await expect(page.locator('.nsm-compare--grid')).toBeVisible();
    await expect(page.locator('.nsm-compare-grid__row')).toHaveCount(5);
  });

  test('亮點 tab: 4 highlight cards (best / trap / next / summary)', async ({ page }) => {
    await setupStep4(page, { tab: 'highlights' });
    await expect(page.locator('.nsm-highlight')).toHaveCount(4);
    await expect(page.locator('.nsm-highlight--best')).toBeVisible();
    await expect(page.locator('.nsm-highlight--trap')).toBeVisible();
    await expect(page.locator('.nsm-highlight--next')).toBeVisible();
    await expect(page.locator('.nsm-highlight--summary')).toBeVisible();
  });

  test('完成 tab: done-panel with check-circle, 再練一題 button, tip card', async ({ page }) => {
    await setupStep4(page, { tab: 'done' });
    await expect(page.locator('.done-panel')).toBeVisible();
    await expect(page.locator('.done-panel__icon .ph-check-circle')).toBeVisible();
    await expect(page.locator('[data-nsm4-action="retry"]')).toBeVisible();
    await expect(page.locator('.done-secondary')).toBeVisible();
  });

  test('mobile: no nsm-progress, nsm-nav visible, 對比 renders stack', async ({ page }) => {
    await setupStep4(page, { tab: 'comparison', viewport: { width: 360, height: 800 } });
    await expect(page.locator('[data-nsm-step4] .nsm-progress')).toHaveCount(0);
    await expect(page.locator('.nsm-nav')).toBeVisible();
    await expect(page.locator('.nsm-compare--stack')).toBeVisible();
  });
});
