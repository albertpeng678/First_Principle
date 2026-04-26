// tests/playwright/journeys/nsm.spec.js
// Journey: CIRCLES home → click NSM (navbar or banner) → question list → select card → step 2

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('NSM Journey', () => {
  test('NSM question list loads and card selection works', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    const consoleErrors = collectConsoleErrors(page);

    await page.goto('/');

    // Wait for CIRCLES home (new default)
    await page.waitForSelector('#navbar-actions button', { timeout: 10000 });

    // Click NSM in navbar (no more .home-tab-btn)
    const nsmNavBtn = page.locator('#navbar-actions').getByText('北極星指標', { exact: true });
    await expect(nsmNavBtn).toBeVisible();
    await nsmNavBtn.click();

    // NSM step 1: question list container must exist
    await page.waitForSelector('.nsm-question-list', { timeout: 10000 });
    await page.waitForSelector('.nsm-question-card', { timeout: 5000 });

    // Confirm more than 0 cards rendered
    const cards = page.locator('.nsm-question-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Scroll the nsm-body to load more cards
    await page.evaluate(() => {
      const body = document.querySelector('.nsm-body');
      if (body) body.scrollTop = body.scrollHeight;
    });
    await page.waitForFunction(() => document.querySelectorAll('.nsm-question-card').length > 0);

    // Scroll back to top and click first visible card
    await page.evaluate(() => {
      const body = document.querySelector('.nsm-body');
      if (body) body.scrollTop = 0;
    });

    const firstCard = page.locator('.nsm-question-card').first();
    await firstCard.click();

    // After selecting a card, the "Next" button should become enabled
    const nextBtn = page.locator('#btn-nsm-step1-next');
    await expect(nextBtn).toBeEnabled({ timeout: 5000 });

    // Page health
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('nsm', device, 'step1', hi.type, hi.detail));
    }

    const critical = consoleErrors.filter(e => !e.includes('supabase') && !e.includes('net::ERR'));
    if (critical.length > 0) {
      issues.push(createIssue('nsm', device, 'console', 'js-error', critical.join(' | ')));
    }

    if (issues.length > 0) console.warn('\n' + formatIssues(issues));
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
    expect(issues.filter(i => i.type === 'cls')).toHaveLength(0);
  });

  test('NSM back from step 1 returns to CIRCLES home', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#navbar-actions button', { timeout: 10000 });

    await page.locator('#navbar-actions').getByText('北極星指標', { exact: true }).click();
    await page.waitForSelector('.nsm-question-list', { timeout: 10000 });

    // Back button from step 1 should go to circles
    const backBtn = page.locator('#btn-nsm-back');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    await page.waitForSelector('.circles-mode-card', { timeout: 5000 });
  });

  test('NSM banner on CIRCLES home links to NSM', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#circles-nsm-banner-btn', { timeout: 10000 });

    await page.click('#circles-nsm-banner-btn');
    await page.waitForSelector('.nsm-question-list', { timeout: 10000 });
  });
});
