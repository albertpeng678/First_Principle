// tests/playwright/journeys/guest-pm.spec.js
// Journey: Guest user → CIRCLES home renders immediately (PM removed)
// Verifies: no .diff-item or .home-tab-btn (PM UI is gone),
//           CIRCLES home loads as the default view, no overflow.

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('Guest Default View Journey', () => {
  test('default view is CIRCLES (no PM tabs or difficulty cards)', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    const consoleErrors = collectConsoleErrors(page);

    await page.goto('/');

    // CIRCLES mode cards must load — this is now the default home
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    // PM UI must not exist
    const diffItems = page.locator('.diff-item[data-difficulty]');
    expect(await diffItems.count()).toBe(0);

    const homeTabs = page.locator('.home-tab-btn');
    expect(await homeTabs.count()).toBe(0);

    // CIRCLES question cards loaded
    await page.waitForSelector('.circles-q-card', { timeout: 5000 });
    const qCards = page.locator('.circles-q-card');
    expect(await qCards.count()).toBeGreaterThan(0);

    // 375px extra check: no horizontal overflow on circles-home-wrap
    if (device === 'iPhone-SE') {
      const homeOverflow = await page.evaluate(() => {
        const wrap = document.querySelector('.circles-home-wrap');
        if (!wrap) return false;
        return wrap.scrollWidth > window.innerWidth;
      });
      if (homeOverflow) {
        issues.push(createIssue('guest-default', device, 'circles-home-wrap', 'overflow',
          '.circles-home-wrap wider than viewport'));
      }
    }

    // Page health check
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('guest-default', device, 'circles-view', hi.type, hi.detail));
    }

    const critical = consoleErrors.filter(e =>
      !e.includes('supabase') && !e.includes('net::ERR')
    );
    if (critical.length > 0) {
      issues.push(createIssue('guest-default', device, 'console', 'js-error', critical.join(' | ')));
    }

    if (issues.length > 0) console.warn('\n' + formatIssues(issues));
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
    expect(issues.filter(i => i.type === 'cls')).toHaveLength(0);
  });

  test('PM API routes are gone (404)', async ({ page }) => {
    // /api/sessions should return 404
    const res = await page.request.get('/api/sessions');
    expect(res.status()).toBe(404);

    const res2 = await page.request.get('/api/guest/sessions');
    expect(res2.status()).toBe(404);
  });
});
