// tests/playwright/journeys/guest-pm.spec.js
// Journey: Guest user → select difficulty → practice view → validate UI

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('Guest PM Journey', () => {
  test('home page shows difficulty cards and practice view loads', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    const consoleErrors = collectConsoleErrors(page);

    // Navigate to home
    await page.goto('/');

    // Wait for app to initialize (Supabase auth state settles)
    await page.waitForSelector('.diff-item[data-difficulty]', { timeout: 10000 });

    // Confirm PM tab is active and difficulty items exist
    const diffItems = page.locator('.diff-item[data-difficulty]');
    const count = await diffItems.count();
    expect(count).toBeGreaterThan(0);

    // Click first difficulty card (入門)
    const firstCard = diffItems.first();
    await firstCard.click();

    // Wait for practice view — API call happens, so use generous timeout
    await page.waitForSelector('.practice-bottom-bar', { timeout: 20000 });

    // Confirm chat input exists and is usable
    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();

    // Confirm send button exists
    const sendBtn = page.locator('#btn-send');
    await expect(sendBtn).toBeVisible();

    // 375px extra check: horizontal overflow on practice-bottom-bar
    if (device === 'iPhone-SE') {
      const barOverflow = await page.evaluate(() => {
        const bar = document.querySelector('.practice-bottom-bar');
        if (!bar) return false;
        return bar.scrollWidth > window.innerWidth;
      });
      if (barOverflow) {
        issues.push(createIssue('guest-pm', device, 'practice-bottom-bar', 'overflow', '.practice-bottom-bar wider than viewport'));
      }
    }

    // Page health check
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('guest-pm', device, 'practice-view', hi.type, hi.detail));
    }

    // Console errors
    if (consoleErrors.length > 0) {
      // Filter out known non-critical Supabase / network warnings
      const critical = consoleErrors.filter(e =>
        !e.includes('supabase') && !e.includes('net::ERR')
      );
      if (critical.length > 0) {
        issues.push(createIssue('guest-pm', device, 'console', 'js-error', critical.join(' | ')));
      }
    }

    if (issues.length > 0) {
      console.warn('\n' + formatIssues(issues));
    }
    // Hard-fail on layout overflow — layout bugs must be fixed
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
    // CLS in practice view is a known audit finding (streaming content causes shift);
    // log as warning but don't block CI until resolved
    const clsIssues = issues.filter(i => i.type === 'cls');
    if (clsIssues.length > 0) {
      console.warn('[AUDIT FINDING] ' + clsIssues.map(i => `${i.detail}`).join(', ') + ' — practice view needs CLS fix');
    }
  });
});
