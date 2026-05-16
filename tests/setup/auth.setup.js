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

  // Ensure .auth directory exists (idempotent — recursive)
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // NOTE: stale-state scrub previously used `fs.unlinkSync(AUTH_FILE)` here,
  // which created a race window — Playwright's project scheduler dispatches
  // dependent e2e workers as soon as the setup project signals; if a worker
  // read storageState between unlink + write it would hit ENOENT (~30% flake
  // observed on e2e-mobile-safari project, see Stage 1A T5 review report).
  // Fix: atomic write — write to temp file + fs.renameSync (atomic on same FS).
  // rename() overwrites the destination atomically, so no unlink needed and
  // no window where AUTH_FILE is missing. Per code-review #9 the stale-state
  // concern is still addressed because rename replaces the file in one op.

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

  // Save storageState atomically: write to temp file, then rename.
  // fs.renameSync is atomic on the same filesystem (POSIX guarantee), so
  // downstream e2e workers reading AUTH_FILE will see either the prior
  // valid file or the new valid file — never a missing/partial file.
  const TEMP_FILE = AUTH_FILE + '.tmp';
  await page.context().storageState({ path: TEMP_FILE });

  // IL-2 evidence: verify temp file written and contains meaningful data
  // BEFORE the rename, so a malformed write cannot poison the live file.
  const stat = fs.statSync(TEMP_FILE);
  expect(stat.size).toBeGreaterThan(100);
  const parsed = JSON.parse(fs.readFileSync(TEMP_FILE, 'utf8'));
  expect(parsed).toHaveProperty('cookies');
  expect(Array.isArray(parsed.cookies)).toBe(true);

  // Atomic swap — overwrites AUTH_FILE in a single FS op (no ENOENT window).
  fs.renameSync(TEMP_FILE, AUTH_FILE);
});
