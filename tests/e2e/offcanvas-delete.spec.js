// tests/e2e/offcanvas-delete.spec.js
// Stage 1B B4 — offcanvas delete + cache race E2E specs.
// Spec ref: 2026-05-16-stage-1b §6 B4-E1..E3 + §7 B4-AC1..AC6.
// Pattern: B4-E1 real DELETE + real loadHistory (no mock — per memory
// feedback_e2e_real_data_only); B4-E2 page.route intercept returns 500 to
// drive rollback + toast; B4-E3 NSM skipped pending seed helper.
// Skill refs:
//   - playwright-skill/core/assertions-and-waiting.md (web-first retry on .not.toBeVisible)
//   - playwright-skill/playwright-cli/request-mocking.md (page.route 500 stub)

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');
const factory = require('../factories/circles-phase1.factory');

// ── Selectors ─────────────────────────────────────────────────────────────────
const SELECTORS = {
  // Offcanvas open: navbar icon — [data-nav="offcanvas"] (app.js:2995)
  offcanvasOpen: '[data-nav="offcanvas"]',
  // Offcanvas items: rendered by renderOffcanvasItem (app.js:7697)
  offcanvasItem: (id) => `[data-offcanvas="item"][data-id="${id}"]`,
  deleteBtn: (id) => `[data-offcanvas="delete"][data-id="${id}"]`,
  // Delete-failure toast: _resumeToastShow=true renders data-resume-landing-toast (app.js:3067)
  toastWrap: '[data-resume-landing-toast]',
  toastBody: '[data-resume-landing-toast] .resume-toast__body',
  // Mode selector — sentinel for "app booted + tryResume settled"
  modeSelector: '[data-circles-mode="drill"]',
  // Offcanvas body — appears only when offcanvas is open
  offcanvasBody: '.offcanvas-body',
  // Loading state inside offcanvas (historyList === null → historyLoading)
  offcanvasLoading: '.offcanvas-body .loading-wrap, .offcanvas-body [data-offcanvas="retry"]',
};

// ── Boot helper ───────────────────────────────────────────────────────────────
// Clear LS + stub GET list endpoints → navigate → wait for app boot.
// After boot: un-stub so real POST (session create) + real GET (history) flow.
// Mirrors bootToPhase1Drill from circles-gate.spec.js without the draft injection.
async function bootApp(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);

  await page.goto('/');

  // Wait until mode-selector visible → app booted + tryResume settled.
  await page.locator(SELECTORS.modeSelector).waitFor({ state: 'visible', timeout: 15_000 });

  // Un-stub → real POST (session create) + real GET (history) must flow.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// ── Session creation helper ───────────────────────────────────────────────────
// Create a real DB session via POST /api/circles-sessions/draft (no OpenAI call
// needed — draft POST just creates the row; gate is not required). Returns id.
// Per memory feedback_e2e_real_data_only: no mocking of session data.
// Note: ensureCirclesDraftSession is a local function inside the app IIFE and
// not exposed on window, so we replicate its minimal POST directly via apiFetch.
async function createRealSession(page) {
  // Wait for CIRCLES_QUESTIONS to be available.
  await page.waitForFunction(() => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0, {
    timeout: 10_000,
  });

  // POST /api/circles-sessions/draft — minimal session row, no AI call.
  const id = await page.evaluate(async () => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[0];
    // path mirrors ensureCirclesDraftSession (app.js:3721).
    const path = A.accessToken ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
    });
    if (!res.ok) return null;
    const session = await res.json();
    // Inject into AppState so offcanvas loadHistory will include this session.
    A.circlesSession = session;
    return session.id;
  });

  expect(id).toBeTruthy();
  return String(id);
}

// ── Offcanvas open + await item helper ────────────────────────────────────────
// Open offcanvas by clicking navbar icon, wait for historyList to load,
// then assert the given session item is visible.
async function openOffcanvasAndAwaitItem(page, id) {
  await page.locator(SELECTORS.offcanvasOpen).click();
  // Wait for offcanvas drawer to appear.
  await page.locator(SELECTORS.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });
  // Wait for the specific item (web-first auto-retry covers loadHistory latency).
  await expect(page.locator(SELECTORS.offcanvasItem(id))).toBeVisible({ timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Stage 1B B4 — offcanvas delete + cache race', () => {
  test('B4-E1: real DELETE → immediate re-open → deleted item absent (core regression)', async ({ page }) => {
    await bootApp(page);
    const id = await createRealSession(page);
    await openOffcanvasAndAwaitItem(page, id);

    // Delete the item.
    await page.locator(SELECTORS.deleteBtn(id)).click();

    // Web-first retry: item gone immediately (optimistic filter in B4 impl).
    await expect(page.locator(SELECTORS.offcanvasItem(id))).not.toBeVisible();

    // Close offcanvas immediately (Escape) — the race window starts here.
    await page.keyboard.press('Escape');
    // Wait for offcanvas to close.
    await expect(page.locator(SELECTORS.offcanvasBody)).not.toBeVisible({ timeout: 3_000 });

    // Re-open offcanvas immediately (before DELETE response may have settled).
    await page.locator(SELECTORS.offcanvasOpen).click();
    await page.locator(SELECTORS.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });

    // Auto-retry until loadHistory GET settles — deleted item must NOT come back.
    // B4 fix: snapshotHistoryBeforeOptimistic ensures cache is not restored on re-open.
    await expect(page.locator(SELECTORS.offcanvasItem(id))).not.toBeVisible({ timeout: 10_000 });
  });

  test('B4-E2: intercept DELETE → 500 → item reappears + toast visible', async ({ page }) => {
    await bootApp(page);
    const id = await createRealSession(page);
    await openOffcanvasAndAwaitItem(page, id);

    // Intercept JUST this DELETE — return 500 to drive rollback.
    // Skill ref: playwright-skill/playwright-cli/request-mocking.md
    await page.route('**/api/circles-sessions/' + id, (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });
    await page.route('**/api/guest-circles-sessions/' + id, (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });

    await page.locator(SELECTORS.deleteBtn(id)).click();

    // Web-first retry: item reappears after rollback fires (B4 impl: catch → restore list + render).
    await expect(page.locator(SELECTORS.offcanvasItem(id))).toBeVisible({ timeout: 5_000 });

    // Toast visible with zh-TW copy (app.js:8150 — _resumeToastMsg = '刪除失敗，請再試一次').
    await expect(page.locator(SELECTORS.toastWrap)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(SELECTORS.toastBody)).toContainText('刪除失敗，請再試一次');

    // Cleanup: real DELETE succeeds now (route unregistered after page.unroute or page close).
    // Playwright auto-cleanup fixture handles session deletion via apiFetch from page context.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.evaluate(async (sessionId) => {
      try {
        await window.apiFetch('/api/circles-sessions/' + sessionId, { method: 'DELETE' });
      } catch (_) {}
    }, id);
  });

  test('B4-E3: NSM session DELETE → immediate re-open → deleted item absent', async ({ page }) => {
    // TODO: NSM seed helper TBD — track in P3 follow-ups (plan §Pre-Flight).
    // Create a real NSM session (mirror pattern from any existing NSM E2E or via
    // API seed) then identical flow to B4-E1 against /api/nsm-sessions/:id.
    test.skip(true, 'NSM seed helper TBD — track in P3 follow-ups');
  });
});
