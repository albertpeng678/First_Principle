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
//   IL-3: This is regression coverage for pre-existing auth functionality;
//         TDD red-evidence step does not apply (no new production code is
//         introduced — only test coverage on shipped auth surfaces).
//
// e2e Red Lines:
//   - No stub timestamps in test data
//   - No mock of own API endpoints
//   - Prod URL + real account forbidden (env-guard enforced)
//
// Stage 0 B7 cleanup mandate:
//   Test 1 creates a real Supabase user. The user is deleted in afterEach
//   via the service-role admin client (see deleteAuthUser below). Per
//   feedback_e2e_real_data_only STANDING memory + B7 prevention infra.

const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');
const { assertNotProdWithRealAccount } = require('../helpers/env-guard');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

// ── Selectors (discovered from public/app.js renderAuth area) ─────────────────
// auth-nav trigger  : button[data-nav="auth"]        app.js:2982 (guest-only)
// email input       : #auth-email                    app.js:2623, 2659
// password input    : #auth-pw                       app.js:2629, 2667
// submit button     : #auth-submit                   app.js:2633, 2674
// logout button     : button[data-nav="logout"]      app.js:2984 (logged-in only)
// register tab      : button[data-auth-tab="register"] app.js:2595
// auth view root    : [data-view="auth"]             app.js:2574
//
// Post-login signal: we assert logoutBtn visible + authTrigger NOT visible.
// We deliberately avoid `.navbar__email` because style.css:61 hides it on
// `max-width:480px` (mobile-chrome / mobile-safari projects). Render branch
// at app.js:2997-3003 guarantees these two buttons toggle on `accessToken`.
const SEL = {
  authTrigger:   'button[data-nav="auth"]',
  email:         '#auth-email',
  pw:            '#auth-pw',
  submit:        '#auth-submit',
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

// ── Service-role admin client for register-test cleanup (Stage 0 B7) ──────────
// We instantiate lazily inside the helper so unrelated tests can still run if
// the service-role key is missing (the register test will skip in that case).
function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function deleteAuthUser(userId) {
  if (!userId) return;
  const admin = getAdminClient();
  if (!admin) {
    console.warn(`auth-cleanup: skipped delete of ${userId} (SUPABASE_SERVICE_ROLE_KEY missing)`);
    return;
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // 404 (already gone) is acceptable; anything else surfaces as a warning so
    // we never silently leak orphan accounts.
    console.warn(`auth-cleanup: deleteUser(${userId}) failed: ${error.message}`);
  }
}

// ── Test 1: register flow — POST /api/auth/register ───────────────────────────
// Uses Playwright's request fixture to hit the real register endpoint. A
// timestamp-unique email avoids collision with prior runs. Shape asserted per
// routes/auth.js:22 → { ok: true, userId: '<uuid>' }.
//
// Stage 0 B7 mandate: the created Supabase user is deleted in the test's
// finally block via service-role admin.deleteUser. No orphan accounts.
test('Test 1 — register: POST /api/auth/register returns { ok, userId }', async ({ request }) => {
  const uniqueEmail = `e2e-reg-${Date.now()}@first-principle.test`;
  const password    = 'TestPass99!';
  let createdUserId = null;

  try {
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
    createdUserId = body.userId;
  } finally {
    // Always attempt cleanup even if assertions failed — orphan prevention.
    await deleteAuthUser(createdUserId);
  }
});

// ── Test 2: login via UI (Supabase SDK signInWithPassword) ────────────────────
// Fills email + password fields, clicks submit, asserts that the logout button
// (data-nav="logout") becomes visible and the sign-in trigger (data-nav="auth")
// disappears. These two signals work on every viewport (the email span is CSS-
// hidden on mobile per style.css:61).
//
// Per auth-flows.md Recipe 1 (Basic Login) — JS variant.
test('Test 2 — login UI: fill credentials → logout button visible', async ({ page }) => {
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
    test.skip(true, 'TEST_EMAIL / TEST_PASSWORD not set in .env.local');
    return;
  }

  // P2 follow-up: the cleanest fix is a 4th project 'e2e-auth-guest' with no
  // storageState that this spec routes to. Until then we use this addInitScript
  // hack — Playwright's context-level storageState re-applies on every
  // navigation, so localStorage.clear() + reload does NOT escape it. The
  // pmDrillState key (set by setup/auth.setup.js) stores accessToken, which is
  // re-injected after each reload from the context-level storageState.
  // addInitScript fires before any page script, so we strip accessToken from
  // pmDrillState and remove the Supabase SDK token key on each page load.
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

  // Post-login: app.js:2997-2998 renders logoutBtn ONLY when accessToken is
  // set, and authTrigger ONLY when it is not. Both are mobile-safe (no CSS
  // viewport gating). Supabase signInWithPassword resolves → AppState.userEmail
  // + accessToken set → render() swaps the navbar action group.
  await expect(page.locator(SEL.logoutBtn)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(SEL.authTrigger)).not.toBeVisible();

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

  // Same storageState-escape hack as Test 2 — see Test 2 comment block for the
  // P2 follow-up to replace this with a dedicated `e2e-auth-guest` project.
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
  // Logged-in signal — see Test 2 rationale for why logoutBtn (not navEmail).
  await expect(page.locator(SEL.logoutBtn)).toBeVisible({ timeout: 15_000 });

  // Click sign-out icon (data-nav="logout", app.js:2984)
  await page.locator(SEL.logoutBtn).click();

  // doLogout() clears token + navigates to circles as guest (app.js:3236).
  // After clearing accessToken, render() flips back to the guest navbar: the
  // logout button disappears and the sign-in trigger re-appears.
  await expect(page.locator(SEL.logoutBtn)).not.toBeVisible({ timeout: 8_000 });
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
