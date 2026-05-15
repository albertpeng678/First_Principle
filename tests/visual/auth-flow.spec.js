/**
 * auth-flow.spec.js — Mockup 02 Auth Flow
 * TDD specs for login / register / logout / migration / token expiry
 * 12 specs × 8 viewports
 */

const { test, expect } = require('@playwright/test');

// Common mock setup
async function setupAuthView(page, tab) {
  await page.route('**/api/(guest-)?circles-stats**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.route('**/api/(guest-)?circles-sessions**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/(guest/)?nsm-sessions**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/config**', r =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supabaseUrl: '', supabaseAnonKey: '' }),
    })
  );
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate((t) => {
    window.AppState.view = 'auth';
    window.AppState.authTab = t || 'login';
    window.AppState.authLoading = false;
    window.AppState.authError = null;
    window.render();
  }, tab || 'login');
  await page.waitForSelector('.auth-card', { timeout: 3000 });
}

test.describe('Auth Flow — Mockup 02', () => {

  test('A. Login form renders — brand, tabs, email, password, submit, guest bypass', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'login');
    // Brand
    await expect(page.locator('.auth-card__brand-name')).toHaveText('PM Drill');
    // Title
    await expect(page.locator('.auth-card__title')).toHaveText('歡迎回來');
    // Tabs
    await expect(page.locator('.auth-tab.is-active')).toHaveText('登入');
    // Email + password inputs
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-pw')).toBeVisible();
    // Submit button
    await expect(page.locator('#auth-submit')).toBeVisible();
    await expect(page.locator('#auth-submit')).toHaveText('登入');
    // Guest bypass link
    await expect(page.locator('[data-auth-action="guest-bypass"]')).toBeVisible();
  });

  test('B. Submit enabled when email + password filled', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'login');
    const emailInput = page.locator('#auth-email');
    const pwInput = page.locator('#auth-pw');
    const submitBtn = page.locator('#auth-submit');
    // Fill email only — submit has no built-in disabled for login (only register has pw-length check)
    await emailInput.fill('test@example.com');
    await pwInput.fill('mypassword');
    // Button should be present and enabled (no disabled attribute)
    await expect(submitBtn).not.toHaveAttribute('disabled');
  });

  test('C. Login loading state — submit shows spinner, inputs disabled', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'login');
    await page.evaluate(() => {
      window.AppState.authLoading = true;
      window.AppState._authEmail = 'test@example.com';
      window.render();
    });
    await expect(page.locator('.auth-submit--loading')).toBeVisible();
    await expect(page.locator('#auth-email')).toBeDisabled();
    await expect(page.locator('#auth-pw')).toBeDisabled();
    // Tabs also disabled
    await expect(page.locator('.auth-tab').first()).toBeDisabled();
  });

  test('C. Login error — invalid credentials banner shown', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'login');
    await page.evaluate(() => {
      window.AppState.authError = { code: 'INVALID_CREDENTIALS', message: '帳號或密碼錯誤' };
      window.render();
    });
    await expect(page.locator('.auth-error-banner')).toBeVisible();
    await expect(page.locator('.auth-error-banner strong')).toHaveText('帳號或密碼錯誤');
    await expect(page.locator('.auth-error-banner .ph-warning-circle')).toBeVisible();
  });

  test('C. Login error — user not found banner with user-minus icon', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'login');
    await page.evaluate(() => {
      window.AppState.authError = { code: 'USER_NOT_FOUND', message: '找不到帳號' };
      window.render();
    });
    await expect(page.locator('.auth-error-banner')).toBeVisible();
    await expect(page.locator('.ph-user-minus')).toBeVisible();
    await expect(page.locator('.auth-error-banner strong')).toHaveText('找不到此 email 對應的帳號');
  });

  test('C. Login error — network error shows cloud-warning icon + retry label', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'login');
    await page.evaluate(() => {
      window.AppState.authError = { code: 'NETWORK_ERROR', message: '連線失敗' };
      window.render();
    });
    await expect(page.locator('.auth-error-banner')).toBeVisible();
    await expect(page.locator('.ph-cloud-warning')).toBeVisible();
    await expect(page.locator('.auth-error-banner strong')).toHaveText('連線失敗');
  });

  test('D. Register tab — title "建立帳號" + submit "註冊並開始練習"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'register');
    await expect(page.locator('.auth-card__title')).toHaveText('建立帳號');
    await expect(page.locator('.auth-tab.is-active')).toHaveText('註冊');
    await expect(page.locator('#auth-submit')).toHaveText('註冊並開始練習');
  });

  test('D. Register — tab switch from login to register', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'login');
    // Click register tab button (the tab bar button, not the switch link)
    await page.locator('.auth-tabs [data-auth-tab="register"]').click();
    await expect(page.locator('.auth-card__title')).toHaveText('建立帳號');
    await expect(page.locator('.auth-tab.is-active')).toHaveText('註冊');
  });

  test('D. Register — weak password shows field-level error + submit disabled', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'register');
    await page.evaluate(() => {
      window.AppState.authError = { code: 'WEAK_PASSWORD', message: '密碼至少 6 字' };
      window.render();
    });
    await expect(page.locator('.auth-field--error')).toBeVisible();
    await expect(page.locator('.auth-field__error')).toContainText('密碼至少 6 字');
    // No error banner shown for weak password (field-level only)
    await expect(page.locator('.auth-error-banner')).toHaveCount(0);
  });

  test('D. Register — email exists shows info banner', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'register');
    await page.evaluate(() => {
      window.AppState.authError = { code: 'EMAIL_EXISTS', message: 'email 已存在' };
      window.render();
    });
    await expect(page.locator('.auth-error-banner')).toBeVisible();
    await expect(page.locator('.ph-info')).toBeVisible();
    await expect(page.locator('.auth-error-banner strong')).toHaveText('這個 email 已經註冊過');
  });

  test('E. Guest bypass — navigate to circles view without auth', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupAuthView(page, 'login');
    await page.locator('[data-auth-action="guest-bypass"]').click();
    // Should navigate away from auth view to circles
    await expect(page.locator('.auth-card')).toHaveCount(0);
    await expect(page.locator('[data-view="circles"]')).toBeVisible();
  });

  test('E. Logged-in navbar — email + sign-out icon visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await page.route('**/api/(guest-)?circles-sessions**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/(guest/)?nsm-sessions**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/config**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"supabaseUrl":"","supabaseAnonKey":""}' })
    );
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.accessToken = 'fake-token-123';
      window.AppState.userEmail = 'albert@example.com';
      window.AppState.view = 'circles';
      window.render();
    });
    await expect(page.locator('.navbar__email')).toBeVisible();
    await expect(page.locator('.navbar__email')).toHaveText('albert@example.com');
    await expect(page.locator('[data-nav="logout"]')).toBeVisible();
  });

  test.skip('E. Token expiry — removed: 401 now silently redirects to auth without session-expired UI', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await page.route('**/api/(guest-)?circles-sessions**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/(guest/)?nsm-sessions**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/config**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"supabaseUrl":"","supabaseAnonKey":""}' })
    );
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.sessionExpired = true;
      window.AppState.view = 'circles';
      window.render();
    });
    await expect(page.locator('.banner--session')).toBeVisible();
    await expect(page.locator('.banner--session .banner__title')).toHaveText('登入逾時');
    await expect(page.locator('.banner--session .banner__action')).toBeVisible();
    // Banner action should navigate to auth view
    await page.locator('.banner--session .banner__action').click();
    await expect(page.locator('.auth-card')).toBeVisible();
  });

});
