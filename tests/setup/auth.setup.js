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

// Phase A prep #3 — per-lane auth files for Wave 2 parallel implementers
// (lanes 1-4) so drainSessions helpers operating on one lane's user cannot
// 互殺 sessions on a sibling lane (per #199 verify finding).
const C_DRIFT_LANES = [
  {
    name: 'c-drift-1',
    email: 'e2e+c-drift-1@first-principle.test',
    file: path.join(__dirname, '..', '..', 'playwright', '.auth', 'c-drift-1-user.json'),
  },
  {
    name: 'c-drift-2',
    email: 'e2e+c-drift-2@first-principle.test',
    file: path.join(__dirname, '..', '..', 'playwright', '.auth', 'c-drift-2-user.json'),
  },
  {
    name: 'c-drift-3',
    email: 'e2e+c-drift-3@first-principle.test',
    file: path.join(__dirname, '..', '..', 'playwright', '.auth', 'c-drift-3-user.json'),
  },
  {
    name: 'c-drift-4',
    email: 'e2e+c-drift-4@first-principle.test',
    file: path.join(__dirname, '..', '..', 'playwright', '.auth', 'c-drift-4-user.json'),
  },
];

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

  // Defensive preflight: poll /health before goto to handle server warm-up race
  // (P1-#264 Option B-1). Under burst load (3 concurrent CLI runs), the webServer
  // process.env.BASE_URL may still be binding its port when auth.setup runs.
  // Poll up to 30 s with 500 ms intervals; throw a descriptive error if not ready.
  {
    const BASE = process.env.BASE_URL || 'http://localhost:3000';
    const TIMEOUT_MS = 30_000;
    const INTERVAL_MS = 500;
    const deadline = Date.now() + TIMEOUT_MS;
    let serverReady = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok) { serverReady = true; break; }
      } catch (_) { /* not yet up */ }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
    if (!serverReady) {
      throw new Error(`auth.setup: server at ${BASE} did not become healthy within ${TIMEOUT_MS}ms`);
    }
  }

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

// Phase A prep #3 — register one setup test per c-drift lane.
// Each lane logs in with its own unique email (provisioned by
// scripts/register-c-drift-test-accounts.js) and saves storageState to
// its own playwright/.auth/c-drift-N-user.json file. Wave 2 implementers
// can then attach storageState per-project so drainSessions on lane N
// never touches lane M.
//
// All four setups share the same env-guard / preflight / atomic-write
// disciplines as the baseline e2e@ setup above. We do NOT factor this
// into a shared helper because Playwright's `setup('name', fn)` must be
// declared at top level — wrapping it in a forEach over an array keeps
// each call site clearly attributable.
for (const lane of C_DRIFT_LANES) {
  setup(`authenticate as ${lane.email}`, async ({ page, context }) => {
    // Defense-in-depth: refuse UI-login against prod with the lane account.
    // c-drift-* still ends with @first-principle.test so this is permissive
    // by design; the guard exists to catch accidental TEST_EMAIL override.
    assertNotProdWithRealAccount({
      baseUrl: process.env.BASE_URL,
      email: lane.email,
    });

    if (!process.env.TEST_PASSWORD) {
      throw new Error(`auth.setup[${lane.name}]: TEST_PASSWORD required in .env.local`);
    }

    fs.mkdirSync(path.dirname(lane.file), { recursive: true });

    // Health preflight — same 30 s budget as baseline.
    {
      const BASE = process.env.BASE_URL || 'http://localhost:3000';
      const TIMEOUT_MS = 30_000;
      const INTERVAL_MS = 500;
      const deadline = Date.now() + TIMEOUT_MS;
      let serverReady = false;
      while (Date.now() < deadline) {
        try {
          const r = await fetch(`${BASE}/health`);
          if (r.ok) { serverReady = true; break; }
        } catch (_) { /* not yet up */ }
        await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
      }
      if (!serverReady) {
        throw new Error(`auth.setup[${lane.name}]: server at ${BASE} did not become healthy within ${TIMEOUT_MS}ms`);
      }
    }

    // Force guest state
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await page.reload();

    await expect(page.locator('button[data-nav="auth"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('button[data-nav="auth"]').click();
    await page.locator('#auth-email').fill(lane.email);
    await page.locator('#auth-pw').fill(process.env.TEST_PASSWORD);
    await page.locator('#auth-submit').click();
    await expect(page.locator('.navbar__email')).toBeVisible({ timeout: 15_000 });

    // Atomic write (same pattern as baseline)
    const TEMP_FILE = lane.file + '.tmp';
    await page.context().storageState({ path: TEMP_FILE });
    const stat = fs.statSync(TEMP_FILE);
    expect(stat.size).toBeGreaterThan(100);
    const parsed = JSON.parse(fs.readFileSync(TEMP_FILE, 'utf8'));
    expect(parsed).toHaveProperty('cookies');
    expect(Array.isArray(parsed.cookies)).toBe(true);
    fs.renameSync(TEMP_FILE, lane.file);
  });
}
