// @ts-check
const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

async function gotoFinalReport(page) {
  await page.goto(BASE_URL + '/?onboarding=0');
  await page.waitForFunction(() => !!window.AppState && typeof window.renderCirclesFinalReport === 'function', null, { timeout: 10000 });
  await page.evaluate(() => {
    window.AppState.circlesFinalReport = {
      grade: 'B',
      overallScore: 78,
      headline: '完整走完 CIRCLES 流程',
      strengths: ['R 步驟訪談打到核心痛點', 'L 提出三個差異化方案'],
      improvements: ['I 用戶分群可再細', 'E 風險評估缺實施面'],
      coachVerdict: '整體掌握 CIRCLES 七步框架。',
    };
    window.AppState.circlesStepScores = {
      C1: { totalScore: 78 }, I:  { totalScore: 65 }, R: { totalScore: 80 },
      C2: { totalScore: 70 }, L:  { totalScore: 85 }, E: { totalScore: 60 },
      S:  { totalScore: 78 },
    };
    window.AppState.circlesFrameworkDraft = {
      tracking: {
        reach: '情境式升級提示曝光人數 / 月活',
        depth: '看到提示後點擊進入試用頁的轉化率',
        // frequency 故意不填 → placeholder
        impact: '試用到期後 30 日內訂閱轉換率',
      },
    };
    window.AppState.circlesPhase = 4;
    const main = document.querySelector('#main') || document.body;
    main.innerHTML = window.renderCirclesFinalReport();
    if (typeof window.bindCirclesFinalReport === 'function') {
      window.bindCirclesFinalReport();
    }
  });
}

test.describe('MASTER-004 final-report 7 軸雷達圖', () => {
  test('radar SVG 渲染含 7 軸 + 7 dot + 7 label', async ({ page }) => {
    await gotoFinalReport(page);
    const svg = page.locator('.radar-svg');
    await expect(svg).toBeVisible({ timeout: 5000 });
    await expect(svg).toHaveAttribute('viewBox', '0 0 240 220');
    const axisCount = await page.locator('.radar-svg .radar-axis').count();
    expect(axisCount).toBe(7);
    const dotCount = await page.locator('.radar-svg .radar-dot').count();
    expect(dotCount).toBe(7);
    const labelCount = await page.locator('.radar-svg .radar-label').count();
    expect(labelCount).toBe(7);
    const polyCount = await page.locator('.radar-svg .radar-poly').count();
    expect(polyCount).toBe(1);
  });
});

test.describe('MASTER-005 NSM tracking 4-dim 卡', () => {
  test('tracking-card 含 4 個 dim 子卡', async ({ page }) => {
    await gotoFinalReport(page);
    await expect(page.locator('.tracking-card')).toBeVisible({ timeout: 5000 });
    expect(await page.locator('.tracking-card .tracking-dim').count()).toBe(4);
    await expect(page.locator('.tracking-card .tracking-dim.reach')).toBeVisible();
    await expect(page.locator('.tracking-card .tracking-dim.depth')).toBeVisible();
    await expect(page.locator('.tracking-card .tracking-dim.frequency')).toBeVisible();
    await expect(page.locator('.tracking-card .tracking-dim.impact')).toBeVisible();
  });

  test('frequency 沒填顯示「（未填寫）」', async ({ page }) => {
    await gotoFinalReport(page);
    const freq = page.locator('.tracking-card .tracking-dim.frequency');
    await expect(freq.locator('.dim-placeholder')).toContainText('（未填寫）');
  });

  test('reach 顯示使用者填入文字', async ({ page }) => {
    await gotoFinalReport(page);
    await expect(page.locator('.tracking-card .tracking-dim.reach .dim-content'))
      .toContainText('情境式升級提示曝光人數');
  });
});

test.describe('段落順序', () => {
  test('grade → radar → step-rows → tracking → strengths → improvements → verdict', async ({ page }) => {
    await gotoFinalReport(page);
    const order = await page.evaluate(() => {
      const els = [
        document.querySelector('.circles-final-report .grade-card'),
        document.querySelector('.circles-final-report .radar-card'),
        document.querySelector('.circles-final-report .step-rows'),
        document.querySelector('.circles-final-report .tracking-card'),
        document.querySelector('.circles-final-report .strength-card'),
        document.querySelector('.circles-final-report .improve-card'),
        document.querySelector('.circles-final-report .verdict-card'),
      ];
      return els.map(el => el ? el.getBoundingClientRect().top : -1);
    });
    // order[0]=grade, [1]=radar, [2]=step-rows, [3]=tracking, [4]=strength, [5]=improve, [6]=verdict
    for (let i = 0; i < order.length; i++) {
      expect(order[i]).toBeGreaterThanOrEqual(0);
    }
    // radar (1) and step-rows (2) may be side-by-side on desktop ≥1024 → allow equal top
    expect(order[1]).toBeGreaterThan(order[0]);            // radar > grade
    expect(order[2]).toBeGreaterThanOrEqual(order[1]);     // step-rows >= radar (grid OK)
    expect(order[3]).toBeGreaterThan(order[2]);            // tracking > step-rows
    expect(order[3]).toBeGreaterThan(order[1]);            // tracking > radar
    expect(order[4]).toBeGreaterThan(order[3]);
    expect(order[5]).toBeGreaterThan(order[4]);
    expect(order[6]).toBeGreaterThan(order[5]);
  });
});
