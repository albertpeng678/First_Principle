// Capture mockup 02 PNGs — Auth Flow (Login / Register / Error States / Token Expiry)
// 5 state × 8 viewport = 40 PNGs total → audit/png-mockup-02/
const { test } = require('@playwright/test');
const fs = require('fs');

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.route('**/api/guest-circles-stats**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.route('**/api/guest-circles-sessions', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/circles-sessions', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/guest/nsm-sessions', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/nsm-sessions', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/config**', r =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supabaseUrl: '', supabaseAnonKey: '' }),
    })
  );
}

async function gotoAuthView(page, overrides) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate((ov) => {
    window.AppState.view = 'auth';
    window.AppState.authTab = ov.authTab || 'login';
    window.AppState.authLoading = ov.authLoading || false;
    window.AppState.authError = ov.authError || null;
    window.AppState.sessionExpired = ov.sessionExpired || false;
    window.AppState._authEmail = ov.email || '';
    window.AppState._authPw = ov.pw || '';
    window.render();
  }, overrides || {});
  await page.waitForSelector('.auth-card', { timeout: 5000 });
}

test.describe('Capture mockup 02 PNGs', () => {
  fs.mkdirSync('audit/png-mockup-02', { recursive: true });

  // §A Login default
  test('auth-login-default', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await gotoAuthView(page, { authTab: 'login' });
    await page.screenshot({ path: `audit/png-mockup-02/auth-login-default-${testInfo.project.name}.png`, fullPage: true });
  });

  // §B Login filled (email+pw)
  test('auth-login-filled', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await gotoAuthView(page, { authTab: 'login', email: 'albert@example.com', pw: 'password123' });
    // Fill the inputs
    await page.evaluate(() => {
      var em = document.getElementById('auth-email');
      var pw = document.getElementById('auth-pw');
      if (em) em.value = 'albert@example.com';
      if (pw) pw.value = '••••••••••';
    });
    await page.screenshot({ path: `audit/png-mockup-02/auth-login-filled-${testInfo.project.name}.png`, fullPage: true });
  });

  // §C Login error — invalid credentials
  test('auth-login-error-credentials', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await gotoAuthView(page, {
      authTab: 'login',
      email: 'albert@example.com',
      authError: { code: 'INVALID_CREDENTIALS', message: '帳號或密碼錯誤' },
    });
    await page.screenshot({ path: `audit/png-mockup-02/auth-login-error-credentials-${testInfo.project.name}.png`, fullPage: true });
  });

  // §D Register default
  test('auth-register-default', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await gotoAuthView(page, { authTab: 'register' });
    await page.screenshot({ path: `audit/png-mockup-02/auth-register-default-${testInfo.project.name}.png`, fullPage: true });
  });

  // §E Token expiry — sessionExpired shown on auth view
  test('auth-token-expiry', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await gotoAuthView(page, { authTab: 'login', sessionExpired: true });
    await page.screenshot({ path: `audit/png-mockup-02/auth-token-expiry-${testInfo.project.name}.png`, fullPage: true });
  });

});
