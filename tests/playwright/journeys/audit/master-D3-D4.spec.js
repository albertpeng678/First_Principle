// master-D3-D4.spec.js — Wave D fix-D2.
// D-3: Drill 移除上一步；Drill 完成顯示鼓勵卡（再練 / 回首頁）；
//      Simulation 從 step 2+ 才允許跨步上一步（reverses Wave A M-012）。
// D-4: 首頁 (.btn-home-icon) 視覺修 — 圓底 + margin-left:auto + .circles-nav
//      中間 title 區塊 flex:1 讓首頁鈕釘在右側。

const { test, expect } = require('@playwright/test');

const TARGET = ['Desktop-1280'];
function only(testInfo, names) {
  test.skip(!names.includes(testInfo.project.name), `only ${names.join(',')}`);
}

const STUB_QUESTION = {
  id: 'd2-test-q',
  company: 'WaveDCo',
  product: 'WaveDApp',
  problem_statement: 'How to validate the wave-D fix?',
};

async function gotoCirclesPhase1(page, mode, opts) {
  opts = opts || {};
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((args) => {
    window.AppState.circlesMode = args.mode;
    window.AppState.circlesDrillStep = args.drillStep;
    window.AppState.circlesSimStep = args.simStep || 0;
    window.AppState.circlesSelectedQuestion = args.q;
    window.AppState.circlesPhase = 1;
    window.render();
  }, { mode, drillStep: opts.drillStep || 'C1', simStep: opts.simStep || 0, q: STUB_QUESTION });
  await page.waitForSelector('.circles-submit-bar', { timeout: 5000 });
}

async function gotoCirclesScore(page, mode, opts) {
  opts = opts || {};
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((args) => {
    window.AppState.circlesMode = args.mode;
    window.AppState.circlesDrillStep = args.drillStep;
    window.AppState.circlesSimStep = args.simStep || 0;
    window.AppState.circlesSelectedQuestion = args.q;
    window.AppState.circlesPhase = 3;
    window.AppState.circlesScoreResult = {
      totalScore: 80,
      dimensions: [
        { name: '結構', score: 4, comment: 'good' },
        { name: '深度', score: 4, comment: 'ok' },
      ],
      highlight: '清楚',
      improvement: '可加細節',
      coachVersion: 'demo answer',
    };
    window.render();
  }, { mode, drillStep: opts.drillStep || 'C1', simStep: opts.simStep || 0, q: STUB_QUESTION });
  await page.waitForSelector('[data-view="circles"]', { timeout: 5000 });
}

test.describe('Wave D fix-D2 D-3 — drill prev removed / simulation prev present', () => {
  test('D-3 [P1] drill mode step I no longer renders #circles-p1-prev', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesPhase1(page, 'drill', { drillStep: 'I' });
    const prev = page.locator('#circles-p1-prev');
    const visible = await prev.isVisible().catch(() => false);
    expect(visible, 'drill mode 不應再有跨步 上一步 按鈕').toBeFalsy();
  });

  test('D-3 [P1] simulation mode step 2+ shows 上一步 and clicking moves back to step 1', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesPhase1(page, 'simulation', { simStep: 1, drillStep: 'I' });
    const prev = page.locator('#circles-p1-prev');
    await expect(prev, 'simulation 第二步開始應有上一步按鈕').toBeVisible();
    await prev.click();
    await page.waitForTimeout(150);
    const sim = await page.evaluate(() => window.AppState.circlesSimStep);
    expect(sim).toBe(0);
  });

  test('D-3 [P1] simulation mode step 1 (C1) hides 上一步', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesPhase1(page, 'simulation', { simStep: 0, drillStep: 'C1' });
    const prev = page.locator('#circles-p1-prev');
    const visible = await prev.isVisible().catch(() => false);
    expect(visible, 'simulation 第一步應隱藏上一步').toBeFalsy();
  });
});

test.describe('Wave D fix-D2 D-3 — drill complete encourage card', () => {
  test('D-3 [P1] drill mode score view renders .drill-encourage-card with 再練 + 回首頁', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesScore(page, 'drill', { drillStep: 'C1' });
    const card = page.locator('.drill-encourage-card');
    await expect(card, 'drill 完成鼓勵卡必須顯示').toBeVisible();
    await expect(page.locator('#drill-encourage-again')).toBeVisible();
    await expect(page.locator('#drill-encourage-home')).toBeVisible();
  });

  test('D-3 [P1] simulation mode score view does NOT render .drill-encourage-card', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesScore(page, 'simulation', { drillStep: 'C1', simStep: 0 });
    const card = page.locator('.drill-encourage-card');
    const visible = await card.isVisible().catch(() => false);
    expect(visible, 'simulation 不應顯示 drill 鼓勵卡').toBeFalsy();
  });
});

test.describe('Wave D fix-D2 D-4 — home icon visual chrome', () => {
  test('D-4 [P1] .btn-home-icon in .circles-nav has margin-left:auto + 圓底 (border-radius:50%)', async ({ page }, testInfo) => {
    only(testInfo, TARGET);
    await gotoCirclesPhase1(page, 'drill', { drillStep: 'C1' });
    const homeBtn = page.locator('.circles-nav .btn-home-icon').first();
    await expect(homeBtn, '.btn-home-icon 必須出現在 .circles-nav').toBeVisible();
    const info = await homeBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      const navRect = el.parentElement.getBoundingClientRect();
      const btnRect = el.getBoundingClientRect();
      return {
        borderRadius: cs.borderTopLeftRadius,
        background: cs.backgroundColor,
        navRight: navRect.right,
        btnRight: btnRect.right,
        navLeft: navRect.left,
        btnLeft: btnRect.left,
        navWidth: navRect.width,
        btnWidth: btnRect.width,
      };
    });
    // The home icon must be visually pinned to the RIGHT edge of the nav bar
    // (within nav padding). i.e. distance from btn-right to nav-right ≤ 24px.
    const rightGap = info.navRight - info.btnRight;
    expect(rightGap, 'home icon 應釘住 nav 右側 (margin-left:auto 或 flex 中段佔位)').toBeLessThanOrEqual(24);
    // And it must be far from the LEFT edge — i.e. it isn't squashed against
    // the back arrow / title.
    const leftGap = info.btnLeft - info.navLeft;
    expect(leftGap, 'home icon 不應黏左（中段需有 flex:1 佔位）').toBeGreaterThan(info.navWidth / 2);
    // Round chrome — border-radius should be ≥ 20px (so it reads as a circle).
    const radiusPx = parseFloat(info.borderRadius);
    expect(radiusPx, '應為圓底（border-radius ≥ 20px）').toBeGreaterThanOrEqual(20);
    // background must not be fully transparent (we gave it a soft surface).
    expect(info.background, '應有底色而非完全透明').not.toBe('rgba(0, 0, 0, 0)');
  });
});
