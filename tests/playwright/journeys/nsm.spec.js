// tests/playwright/journeys/nsm.spec.js
// Journey: Home → NSM tab → question list → select card → step 2

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('NSM Journey', () => {
  test('NSM tab shows question list and card selection works', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    const consoleErrors = collectConsoleErrors(page);

    await page.goto('/');

    // Wait for app to init (guest mode)
    await page.waitForSelector('.home-tab-btn', { timeout: 10000 });

    // Click NSM tab
    const nsmTabBtn = page.locator('.home-tab-btn[data-tab="nsm"]');
    await expect(nsmTabBtn).toBeVisible();
    await nsmTabBtn.click();

    // NSM start button should appear
    const startBtn = page.locator('#btn-nsm-start');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // NSM step 1: question list container must exist
    await page.waitForSelector('.nsm-question-list', { timeout: 10000 });
    await page.waitForSelector('.nsm-question-card', { timeout: 5000 });

    // Confirm more than 0 cards rendered (virtual scroll renders visible subset)
    const cards = page.locator('.nsm-question-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Scroll the nsm-body to load more cards (virtual scroll)
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

    if (issues.length > 0) {
      console.warn('\n' + formatIssues(issues));
    }
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
    expect(issues.filter(i => i.type === 'cls')).toHaveLength(0);
  });
});
