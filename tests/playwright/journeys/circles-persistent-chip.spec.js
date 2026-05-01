const { test, expect } = require('@playwright/test');

test.describe('CIRCLES persistent question chip', () => {
  test('chip is present on Phase 1 after entering practice', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-mode="simulation"]');
    await page.locator('.circles-q-card').first().click();
    await page.locator('.circles-q-confirm-btn').click();
    await expect(page.locator('#circles-qchip-slot .qchip')).toBeVisible();
    await page.screenshot({ path: 'test-results/chip-phase1.png' });

    // Expand → panel
    await page.locator('.qchip').click();
    await expect(page.locator('.qchip-panel')).toBeVisible();
    await expect(page.locator('.qchip-panel .ana-row')).toHaveCount(4);
    await page.screenshot({ path: 'test-results/chip-expanded.png' });

    // Collapse
    await page.locator('.qchip-panel-close').click();
    await expect(page.locator('.qchip')).toBeVisible();
  });

  test('chip ellipsis on long problem_statement', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.AppState.circlesSelectedQuestion = {
        ...window.CIRCLES_QUESTIONS[0],
        problem_statement: '設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並大幅增加用戶在每日通勤時段、週末休閒時段以及跨情境的黏著度，同時要兼顧訂閱率與廣告營收的平衡',
      };
      window.AppState.circlesPhase = 1;
      window.render && window.render();
    });
    const text = page.locator('.qchip-text');
    await expect(text).toBeVisible();
    const overflow = await text.evaluate(el => getComputedStyle(el).textOverflow);
    expect(overflow).toBe('ellipsis');
    await page.screenshot({ path: 'test-results/chip-long-text.png' });
  });

  test('chip panel fallback when analysis missing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const q = { ...window.CIRCLES_QUESTIONS[0] };
      delete q.analysis;
      window.AppState.circlesSelectedQuestion = q;
      window.AppState.circlesPhase = 1;
      window.AppState.circlesChipExpanded = true;
      window.render && window.render();
    });
    await expect(page.locator('.ana-val.muted')).toBeVisible();
    await page.screenshot({ path: 'test-results/chip-no-analysis.png' });
  });
});
