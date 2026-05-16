// tests/setup/auth.setup.js
// Stage 1A Task 1 — UI-login once via Playwright setup project.
// Saves storageState to playwright/.auth/user.json for downstream specs.
//
// Selectors discovered from public/app.js:
//   login-trigger : button[data-nav="auth"]  (aria-label="登入", navbar icon btn)
//   email         : #auth-email              (input type="email", id="auth-email")
//   password      : #auth-pw                 (input type="password", id="auth-pw")
//   submit        : #auth-submit             (button id="auth-submit", text "登入")
//   post-login    : .navbar__email           (span showing userEmail after login)

const { test: setup, expect } = require('@playwright/test');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });
const path = require('path');
const fs = require('fs');
const { assertNotProdWithRealAccount } = require('../helpers/env-guard');

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

setup('authenticate as e2e@first-principle.test', async ({ page, context }) => {
  // Defense-in-depth: refuse UI-login against prod with real account
  assertNotProdWithRealAccount({
    baseUrl: process.env.BASE_URL,
    email: process.env.TEST_EMAIL,
  });

  // Pre-flight: required creds (avoid silent .fill(undefined) downstream)
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
    throw new Error('auth.setup: TEST_EMAIL and TEST_PASSWORD required in .env.local');
  }

  // Pre-flight: scrub stale storageState file so a prior bad run cannot leak
  // a valid-looking auth state into downstream specs (per code-review #9).
  if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE);

  // Ensure .auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // Force guest state — clear any cookies/localStorage from prior session that
  // might already render .navbar__email and false-positive the post-login wait
  // (per code-review #7).
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await page.reload();

  // Sanity: guest state has the sign-in icon visible
  await expect(page.locator('button[data-nav="auth"]')).toBeVisible({ timeout: 5_000 });

  // Click the navbar sign-in icon button (data-nav="auth", aria-label="登入")
  await page.locator('button[data-nav="auth"]').click();

  // Fill email — input#auth-email (type="email")
  await page.locator('#auth-email').fill(process.env.TEST_EMAIL);

  // Fill password — input#auth-pw (type="password")
  await page.locator('#auth-pw').fill(process.env.TEST_PASSWORD);

  // Click submit — button#auth-submit (text "登入")
  await page.locator('#auth-submit').click();

  // Wait for post-login signal: .navbar__email span appears with the user's email
  await expect(page.locator('.navbar__email')).toBeVisible({ timeout: 15_000 });

  // Save storageState (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE });

  // IL-2 evidence: verify file written and contains meaningful data
  const stat = fs.statSync(AUTH_FILE);
  expect(stat.size).toBeGreaterThan(100);
  const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  expect(parsed).toHaveProperty('cookies');
  expect(Array.isArray(parsed.cookies)).toBe(true);
});
