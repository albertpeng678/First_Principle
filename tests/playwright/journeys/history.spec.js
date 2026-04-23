// tests/playwright/journeys/history.spec.js
// Journey: History requires auth — verify history-related UI (offcanvas) exists
// Full auth flow is skipped; we confirm the hamburger/offcanvas mechanism
// is present and no overflow occurs.

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('History Journey', () => {
  test('offcanvas history panel accessible and no overflow', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    collectConsoleErrors(page);

    await page.goto('/');

    // Wait for app to initialize
    await page.waitForSelector('#btn-hamburger', { timeout: 10000 });

    // Open offcanvas (练习记录 panel)
    const hamburger = page.locator('#btn-hamburger');
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Offcanvas should open (allow generous timeout for animation)
    await page.waitForSelector('#offcanvas.open', { timeout: 10000 });
    const offcanvas = page.locator('#offcanvas');
    await expect(offcanvas).toBeVisible();

    // Offcanvas list area should exist
    const listEl = page.locator('#offcanvas-list');
    await expect(listEl).toBeVisible();

    // Close offcanvas
    const closeBtn = page.locator('#btn-offcanvas-close');
    await closeBtn.click();
    await page.waitForSelector('#offcanvas:not(.open)', { timeout: 3000 });

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    if (hasOverflow) {
      issues.push(createIssue('history', device, 'home', 'overflow', 'horizontal scroll on home page'));
    }

    // Page health
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('history', device, 'home', hi.type, hi.detail));
    }

    if (issues.length > 0) {
      console.warn('\n' + formatIssues(issues));
    }
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
    expect(issues.filter(i => i.type === 'cls')).toHaveLength(0);
  });
});
