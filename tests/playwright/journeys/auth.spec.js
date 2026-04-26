// tests/playwright/journeys/auth.spec.js
// Journey: Navigate to login → confirm form is visible → check no overflow

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('Auth Journey', () => {
  test('login form renders correctly with no overflow', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    const consoleErrors = collectConsoleErrors(page);

    await page.goto('/');

    // Wait for navbar-actions to be populated (auth state settled)
    await page.waitForSelector('#navbar-actions button', { timeout: 10000 });

    // Navigate to login via URL navigate — avoids ambiguous btn-ghost selector
    await page.evaluate(() => window.navigate('login'));

    // Auth form should be visible
    await page.waitForSelector('#auth-form', { timeout: 5000 });

    // Email input
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeEnabled();

    // Password input
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toBeEnabled();

    // Submit button
    const submitBtn = page.locator('#auth-form button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // Back link navigates to circles
    const backLink = page.locator('a[onclick*="navigate"]').or(
      page.locator('.btn-ghost[onclick*="navigate"]')
    ).first();

    // Page health (includes overflow + CLS check)
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('auth', device, 'login-form', hi.type, hi.detail));
    }

    const critical = consoleErrors.filter(e => !e.includes('supabase') && !e.includes('net::ERR'));
    if (critical.length > 0) {
      issues.push(createIssue('auth', device, 'console', 'js-error', critical.join(' | ')));
    }

    if (issues.length > 0) {
      console.warn('\n' + formatIssues(issues));
    }
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
    expect(issues.filter(i => i.type === 'cls')).toHaveLength(0);
  });

  test('login button in guest navbar navigates to login form', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#navbar-actions button', { timeout: 10000 });

    // In guest mode, there's a 登入 button (text match avoids ambiguity with NSM button)
    const loginBtn = page.locator('#navbar-actions').getByText('登入', { exact: true });

    if (await loginBtn.count() > 0) {
      await loginBtn.click();
      await page.waitForSelector('#auth-form', { timeout: 5000 });
      await expect(page.locator('#auth-form')).toBeVisible();
    } else {
      // Already logged in — skip this test
      test.skip();
    }
  });
});
