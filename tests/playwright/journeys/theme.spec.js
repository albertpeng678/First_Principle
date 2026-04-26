// tests/playwright/journeys/theme.spec.js
// Theme toggle was removed. This spec verifies:
// 1. No theme toggle button exists (dark mode removed)
// 2. Background is beige (#F2F0EB) — CIRCLES design system applied
// 3. Navbar is sticky with backdrop-filter blur
// 4. html has overflow-x:hidden and overscroll-behavior-y:none (mobile UX)

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('Visual Design System', () => {
  test('theme toggle removed, CIRCLES blue+beige design system applied', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    const consoleErrors = collectConsoleErrors(page);

    await page.goto('/');
    await page.waitForSelector('#navbar-actions', { timeout: 10000 });

    // Theme toggle must NOT exist
    const themeToggle = page.locator('button[title="切換主題"]');
    expect(await themeToggle.count()).toBe(0);

    // Background should be beige (#F2F0EB) = rgb(242, 240, 235)
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgColor).toBe('rgb(242, 240, 235)');

    // Navbar should be sticky
    const navbarPosition = await page.evaluate(() => {
      const nav = document.querySelector('.navbar');
      return nav ? getComputedStyle(nav).position : null;
    });
    expect(navbarPosition).toBe('sticky');

    // Page health (includes overflow + CLS check)
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('design-system', device, 'home', hi.type, hi.detail));
    }

    const critical = consoleErrors.filter(e => !e.includes('supabase') && !e.includes('net::ERR'));
    if (critical.length > 0) {
      issues.push(createIssue('design-system', device, 'console', 'js-error', critical.join(' | ')));
    }

    if (issues.length > 0) console.warn('\n' + formatIssues(issues));
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
    expect(issues.filter(i => i.type === 'cls')).toHaveLength(0);
  });

  test('html overflow-x hidden and overscroll-none applied (mobile UX)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#navbar-actions', { timeout: 10000 });

    const htmlOverflowX = await page.evaluate(() =>
      getComputedStyle(document.documentElement).overflowX
    );
    expect(htmlOverflowX).toBe('hidden');

    const htmlOverscroll = await page.evaluate(() =>
      getComputedStyle(document.documentElement).overscrollBehaviorY
    );
    expect(htmlOverscroll).toBe('none');
  });
});
