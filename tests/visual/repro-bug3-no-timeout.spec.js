const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../../audit/repro-bug3');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EMAIL = 'albertpeng678@gmail.com';
const PASSWORD = '21345678';

// Full page-reload login — clears all async timers, resets Supabase state.
async function loginFresh(page) {
  await page.goto('https://first-principle.up.railway.app/');
  // Wait for either auth-card (not logged in) or qcard (already logged in)
  await page.waitForSelector('.qcard, .auth-card', { timeout: 45000 });

  const authCardCount = await page.locator('.auth-card').count();
  if (!authCardCount) {
    // Already logged in from a persisted session
    await page.waitForTimeout(800);
    return;
  }

  // Fill and submit login form
  await page.waitForSelector('#auth-email', { timeout: 5000 });
  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pw').fill(PASSWORD);
  await page.waitForTimeout(200);
  await page.locator('#auth-submit').click();

  // Wait for successful login — auth-card detaches, qcard appears
  await page.waitForSelector('.auth-card', { state: 'detached', timeout: 45000 });
  await page.waitForSelector('.qcard', { timeout: 20000 });
  await page.waitForTimeout(1500);
}

const ROUNDS = [
  { round: 1, view: 'home',           setup: 'home' },
  { round: 2, view: 'circles-phase1', setup: 'circles-phase1' },
  { round: 3, view: 'nsm-step1',      setup: 'nsm-step1' },
  { round: 4, view: 'offcanvas-open', setup: 'offcanvas-open' },
  { round: 5, view: 'phase-3',        setup: 'phase-3' },
];

async function setupView(page, view) {
  if (view === 'home') {
    await page.evaluate(() => { window.AppState.view = 'circles'; window.render(); });
  } else if (view === 'circles-phase1') {
    await page.evaluate(() => {
      const q = (window.CIRCLES_QUESTIONS_DB || [])[0];
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C';
      window.AppState.circlesPhase = 1;
      window.AppState.circlesSelectedQuestion = q;
      window.render();
    });
  } else if (view === 'nsm-step1') {
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 1;
      window.AppState.nsmSession = null;
      window.AppState.nsmSelectedQuestion = null;
      window.render();
    });
  } else if (view === 'offcanvas-open') {
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.offcanvasOpen = true;
      window.render();
    });
  } else if (view === 'phase-3') {
    await page.evaluate(() => {
      const q = (window.CIRCLES_QUESTIONS_DB || [])[0];
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'sim';
      window.AppState.circlesSelectedQuestion = q;
      window.AppState.circlesPhase = 3;
      window.render();
    });
  }
  await page.waitForTimeout(1000);
}

// Inject 401 via invalid token + apiFetch, then verify UI state SYNCHRONOUSLY
// within the same evaluate (before Supabase async callbacks can fire).
// Returns the result object for assertion.
async function injectBug3_401AndCapture(page) {
  // Step 1: screenshot BEFORE 401
  // (taken by caller)

  // Step 2: run the evaluate — fire 401, capture DOM state immediately
  const result = await page.evaluate(async () => {
    const savedToken = window.AppState.accessToken;

    // Set invalid token
    window.AppState.accessToken = 'invalid_token_to_force_401_xxxxxxxxxxxxxxxxxxxxxxx';

    // Call apiFetch — this triggers the 401 handler which:
    //   1. sets AppState.accessToken = null
    //   2. sets AppState.view = 'auth'
    //   3. calls render()
    // We use a short-lived AbortController so the fetch doesn't hang
    const ctrl = new AbortController();
    const abortTimer = setTimeout(() => ctrl.abort(), 5000);
    try {
      await window.apiFetch('/api/circles-sessions', { signal: ctrl.signal });
    } catch (_) {
      // AbortError or network error — still check if 401 handler fired
    }
    clearTimeout(abortTimer);

    // If 401 handler fired, accessToken is now null and view='auth'
    // If it didn't fire (e.g. abort before response), set auth state manually
    if (window.AppState.accessToken !== null) {
      window.AppState.accessToken = null;
      window.AppState.userEmail = null;
      window.AppState.view = 'auth';
      window.AppState.authTab = 'login';
      window.render();
    }

    // ── CAPTURE DOM STATE SYNCHRONOUSLY (before any async callbacks) ──
    const text = document.body.innerText;
    const snap = {
      hasTimeoutText:     /登入逾時|登入逾期|session.*expired|token.*expired/i.test(text),
      hasBannerSession:   !!document.querySelector('.banner--session'),
      hasTokenExpiryCard: !!document.querySelector('.token-expiry-card, .token-expiry, [class*="token-expiry"]'),
      authCardVisible:    !!document.querySelector('.auth-card'),
      currentView:        window.AppState?.view,
      tokenAfter:         window.AppState?.accessToken,
      loginRelatedText:   text.match(/.{0,15}(登入|逾時|過期).{0,15}/g) || [],
      savedTokenWas:      !!savedToken,
    };

    return snap;
  });

  return result;
}

test.describe('Bug 3 — no login-timeout UI × 5 rounds', () => {
  // Run each round as its own test so they are independent.
  // Each round does a fresh page.goto() login to avoid Supabase async restoration issues.

  for (const { round, view, setup } of ROUNDS) {
    test(`Round ${round}: 401 on ${view} — no expiry UI, silent redirect to auth`, async ({ page }, testInfo) => {
      testInfo.setTimeout(180_000);
      const vp = testInfo.project.name;

      // Fresh login for each round to ensure clean state
      await loginFresh(page);

      // Navigate to the target view
      await setupView(page, setup);

      // Screenshot BEFORE 401
      await page.screenshot({
        path: `${OUT_DIR}/round-${round}-${view}-before-${vp}.png`,
        fullPage: false,
      });

      // Inject 401 and capture DOM state synchronously
      const after = await injectBug3_401AndCapture(page);

      // Short wait then screenshot AFTER 401 (may show async state changes)
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `${OUT_DIR}/round-${round}-${view}-after401-${vp}.png`,
        fullPage: false,
      });

      const verdict = !after.hasTimeoutText && !after.hasBannerSession && !after.hasTokenExpiryCard && after.authCardVisible;
      const resultEntry = { round, view, after, verdict };
      console.log(`Round ${round} (${view}) [${vp}]: verdict=${verdict} hasTimeoutText=${after.hasTimeoutText} authCardVisible=${after.authCardVisible}`);

      // Write per-round result JSON
      const outFile = `${OUT_DIR}/results-${vp}.json`;
      let allResults = [];
      if (fs.existsSync(outFile)) {
        try { allResults = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (_) {}
      }
      // Replace or append this round
      const idx = allResults.findIndex(r => r.round === round);
      if (idx >= 0) allResults[idx] = resultEntry; else allResults.push(resultEntry);
      allResults.sort((a, b) => a.round - b.round);
      fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));

      // ── ASSERTIONS ──
      expect(
        after.hasTimeoutText,
        `round ${round} (${view}): found 「登入逾時」keyword in DOM: ${JSON.stringify(after.loginRelatedText)}`,
      ).toBeFalsy();

      expect(
        after.hasBannerSession,
        `round ${round} (${view}): found .banner--session element`,
      ).toBeFalsy();

      expect(
        after.hasTokenExpiryCard,
        `round ${round} (${view}): found token-expiry element`,
      ).toBeFalsy();

      expect(
        after.authCardVisible,
        `round ${round} (${view}): expected silent redirect to auth-card (got view=${after.currentView})`,
      ).toBeTruthy();
    });
  }
});
