// tests/e2e/auth-flow-real.spec.js
// F-P02 — Auth flow real E2E (Group A — replace dead spec)
//
// Closes: audit/findings-slice-cross-2026-05-17.md F-P02
// Skills cited:
//   auth-flows.md  Recipe 1 (basic login), Recipe 8 (logout)
//   auth-flows.md  lines 928-949 (API login / seeding pattern)
//   authentication.md lines 29-70 (storageState reuse — NOT used here;
//     this spec deliberately skips storageState to test the auth UI itself)
//
// Iron Laws applied:
//   IL-1: root-cause each assertion (selector → app.js line cited)
//   IL-2: no storageState shortcut — real UI flows only
//   IL-3: tests written to fail before implementation existed (dead spec was pure skip)
//
// e2e Red Lines:
//   - No stub timestamps in test data
//   - No mock of own API endpoints
//   - Prod URL + real account forbidden (env-guard enforced)

const { test, expect } = require('@playwright/test');
const { assertNotProdWithRealAccount } = require('../helpers/env-guard');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

// ── Selectors (discovered from public/app.js renderAuth area) ─────────────────
// auth-nav trigger  : button[data-nav="auth"]        app.js:2982
// email input       : #auth-email                    app.js:2623, 2659
// password input    : #auth-pw                       app.js:2629, 2667
// submit button     : #auth-submit                   app.js:2633, 2674
// post-login signal : .navbar__email                 app.js:2985
// logout button     : button[data-nav="logout"]      app.js:2984
// register tab      : button[data-auth-tab="register"] app.js:2595
// auth view root    : [data-view="auth"]             app.js:2574

const SEL = {
  authTrigger:   'button[data-nav="auth"]',
  email:         '#auth-email',
  pw:            '#auth-pw',
  submit:        '#auth-submit',
  navEmail:      '.navbar__email',
  logoutBtn:     'button[data-nav="logout"]',
  registerTab:   'button[data-auth-tab="register"]',
  authView:      '[data-view="auth"]',
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── Pre-flight guard — refuse to run against prod with real account ────────────
test.beforeAll(() => {
  assertNotProdWithRealAccount({
    baseUrl: BASE_URL,
    email: process.env.TEST_EMAIL,
  });
});

// ── Test 1: register flow — POST /api/auth/register ───────────────────────────
// Uses the API-layer request fixture to hit the real register endpoint.
// A timestamp-unique email is used so each run creates a new account without
// colliding with prior runs. The Supabase admin.createUser (email_confirm:true)
// path is exercised; response shape { ok: true, userId: string } is asserted.
//
// Note: this test creates a real Supabase user each run. The e2e Supabase project
// is isolated (e2e@first-principle.test env); production is never touched.
test('Test 1 — register: POST /api/auth/register returns { ok, userId }', async ({ request }) => {
  const uniqueEmail = `e2e-reg-${Date.now()}@first-principle.test`;
  const password    = 'TestPass99!';

  const res = await request.post(`${BASE_URL}/api/auth/register`, {
    data: { email: uniqueEmail, password },
  });

  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  // Shape: { ok: true, userId: '<uuid>' } — routes/auth.js:22
  expect(body).toHaveProperty('ok', true);
  expect(body).toHaveProperty('userId');
  expect(typeof body.userId).toBe('string');
  expect(body.userId.length).toBeGreaterThan(0);
});

// ── Test 2: login via UI (Supabase SDK signInWithPassword) ────────────────────
// Fills email + password fields, clicks submit, asserts the post-login signal
// (.navbar__email) appears. Uses the dedicated E2E test account; real Supabase
// SDK signInWithPassword fires (app.js:2807).
//
// Per auth-flows.md Recipe 1 (Basic Login) — JS variant.
test('Test 2 — login UI: fill credentials → .navbar__email appears', async ({ page }) => {
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
    test.skip(true, 'TEST_EMAIL / TEST_PASSWORD not set in .env.local');
    return;
  }

  // Playwright storageState (AUTH_FILE) is maintained at browser-context level and
  // re-applied on every navigation — localStorage.clear() + reload does NOT escape it.
  // The pmDrillState key (set by setup/auth.setup.js) stores accessToken, which is
  // re-injected after each reload from the context-level storageState.
  //
  // Solution: use addInitScript to strip accessToken/userEmail from pmDrillState
  // BEFORE app.js reads it on page load. addInitScript fires before any page script.
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem('pmDrillState');
      if (raw) {
        const s = JSON.parse(raw);
        s.accessToken = null;
        s.userEmail = null;
        localStorage.setItem('pmDrillState', JSON.stringify(s));
      }
      // Also remove Supabase SDK token key so SDK does not auto-restore session
      const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (sbKey) localStorage.removeItem(sbKey);
    } catch (_) {}
  });

  await page.goto('/');

  // Guest state: sign-in trigger button must be visible
  await expect(page.locator(SEL.authTrigger)).toBeVisible({ timeout: 8_000 });

  // Open auth view
  await page.locator(SEL.authTrigger).click();

  // Auth view rendered — wait for email field
  await expect(page.locator(SEL.email)).toBeVisible({ timeout: 5_000 });

  // Fill credentials
  await page.locator(SEL.email).fill(process.env.TEST_EMAIL);
  await page.locator(SEL.pw).fill(process.env.TEST_PASSWORD);

  // Click submit (text "登入", id="auth-submit", app.js:2633)
  await page.locator(SEL.submit).click();

  // Post-login: .navbar__email renders the authenticated user's email (app.js:2985)
  // Supabase signInWithPassword resolves → AppState.userEmail set → render()
  await expect(page.locator(SEL.navEmail)).toBeVisible({ timeout: 15_000 });

  // Auth view should no longer be shown — replaced by circles home
  await expect(page.locator(SEL.authView)).not.toBeVisible();
});

// ── Test 3: logout flow — click logout, assert auth trigger re-appears ────────
// Starts from the logged-in state established within the test (no storageState),
// clicks the sign-out icon (data-nav="logout"), and asserts that doLogout()
// (app.js:3213) clears the session and returns to circles home as guest.
//
// Per auth-flows.md Recipe 8 (Logout).
test('Test 3 — logout: click sign-out → auth trigger re-appears', async ({ page }) => {
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
    test.skip(true, 'TEST_EMAIL / TEST_PASSWORD not set in .env.local');
    return;
  }

  // Same storageState escape pattern as Test 2 — addInitScript strips accessToken
  // from pmDrillState and the Supabase SDK token key before app.js reads them.
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem('pmDrillState');
      if (raw) {
        const s = JSON.parse(raw);
        s.accessToken = null;
        s.userEmail = null;
        localStorage.setItem('pmDrillState', JSON.stringify(s));
      }
      const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (sbKey) localStorage.removeItem(sbKey);
    } catch (_) {}
  });

  await page.goto('/');

  // Log in via UI
  await expect(page.locator(SEL.authTrigger)).toBeVisible({ timeout: 8_000 });
  await page.locator(SEL.authTrigger).click();
  await expect(page.locator(SEL.email)).toBeVisible({ timeout: 5_000 });
  await page.locator(SEL.email).fill(process.env.TEST_EMAIL);
  await page.locator(SEL.pw).fill(process.env.TEST_PASSWORD);
  await page.locator(SEL.submit).click();
  await expect(page.locator(SEL.navEmail)).toBeVisible({ timeout: 15_000 });

  // Click sign-out icon (data-nav="logout", app.js:2984)
  await page.locator(SEL.logoutBtn).click();

  // doLogout() clears token + navigates to circles as guest (app.js:3236)
  // .navbar__email is gone; sign-in trigger re-appears
  await expect(page.locator(SEL.navEmail)).not.toBeVisible({ timeout: 8_000 });
  await expect(page.locator(SEL.authTrigger)).toBeVisible({ timeout: 8_000 });
});

// ── Test 4: protected route redirect — stale token → 401 → auth view ──────────
// Simulates an expired session: injects a fake (invalid) access token into
// localStorage so the app boots thinking the user is authenticated.
// The app fires tryResumeLatestSession() → GET /api/circles-sessions with the
// invalid Bearer token → server returns 401 → apiFetch 401-handler (app.js:283-290)
// clears the token and sets AppState.view = 'auth'.
//
// Per auth-flows.md lines 709-733 (session timeout / expiry redirect pattern).
test('Test 4 — protected redirect: stale token → 401 → auth view shown', async ({ page }) => {
  // Inject a syntactically-valid-but-server-rejected JWT as the persisted accessToken.
  // The value is fabricated — Supabase will reject it with 401.
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJleHAiOjE2MDAwMDAwMDB9.FAKE_SIGNATURE';

  // Inject the stale state BEFORE the app script runs (addInitScript fires before page JS)
  await page.addInitScript((token) => {
    try {
      localStorage.setItem('pmDrillState', JSON.stringify({
        view: 'circles',
        accessToken: token,
        userEmail: 'stale@first-principle.test',
      }));
    } catch (_) {}
  }, fakeToken);

  await page.goto('/');

  // The app boots with a stale token. tryResumeLatestSession() fires and hits
  // GET /api/circles-sessions with 'Authorization: Bearer <fakeToken>'.
  // Server returns 401 → apiFetch handler (app.js:283) → AppState.view = 'auth'.
  //
  // Wait for the auth view to appear — the 401 cycle is async but bounded by the
  // fetch roundtrip to localhost (<<1s). Use a generous but not infinite timeout.
  await expect(page.locator(SEL.authView)).toBeVisible({ timeout: 15_000 });

  // The sign-in trigger is hidden when auth view is rendered
  // (it's inside navbar, which is still rendered, but nav icon is data-nav="auth"
  // which is only shown in guest mode — after 401 the token is cleared, so guest mode)
  // Assert the auth view is in login tab by default (authTab reset to 'login')
  await expect(page.locator(SEL.email)).toBeVisible({ timeout: 5_000 });
});
