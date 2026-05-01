// tests/playwright/journeys/circles-question-analysis.spec.js
// Analysis card visual gate: expanding 看完整題目 shows 4 analysis rows

const { test, expect } = require('@playwright/test');

test.describe('CIRCLES home — question analysis card', () => {
  test('expanding 看完整題目 shows 4 analysis rows', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    const firstCard = page.locator('.circles-q-card').first();
    await firstCard.locator('.circles-q-card-more').click();
    const analysis = firstCard.locator('.qcard-analysis');
    await expect(analysis).toBeVisible();
    await expect(analysis.locator('.ana-row')).toHaveCount(4);
    const labels = await analysis.locator('.ana-label').allInnerTexts();
    expect(labels.join(' ')).toContain('商業背景');
    expect(labels.join(' ')).toContain('用戶輪廓');
    expect(labels.join(' ')).toContain('常見誤區');
    expect(labels.join(' ')).toContain('破題切入');
    await page.screenshot({ path: 'test-results/analysis-happy.png' });
  });

  test('does not duplicate problem_statement', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('.circles-q-card').first();
    const stmt = await firstCard.locator('.circles-q-card-stmt').innerText();
    await firstCard.locator('.circles-q-card-more').click();
    const expandHtml = await firstCard.locator('.circles-q-card-expand-area').innerHTML();
    expect(expandHtml).not.toContain('class="circles-q-card-full-text"');
  });

  test('fallback when analysis missing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const q = window.CIRCLES_QUESTIONS[0];
      delete q.analysis;
      window.AppState.circlesDisplayedQuestions = [q];
      window.render && window.render();
    });
    await page.locator('.circles-q-card .circles-q-card-more').first().click();
    await expect(page.locator('.ana-val.muted')).toBeVisible();
    await page.screenshot({ path: 'test-results/analysis-fallback.png' });
  });
});
