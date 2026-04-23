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

    // Wait for guest mode to initialize
    await page.waitForSelector('.btn.btn-ghost', { timeout: 10000 });

    // Click the login button in the navbar (guest mode shows "登入" button)
    const loginBtn = page.locator('#navbar-actions .btn.btn-ghost').first();
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();

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
});
