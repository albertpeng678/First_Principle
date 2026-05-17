// tests/e2e/offcanvas-delete.spec.js
// Stage 1B B4 — offcanvas delete + cache race E2E specs.
// Spec ref: 2026-05-16-stage-1b §6 B4-E1..E3 + §7 B4-AC1..AC6.
// Pattern: B4-E1 real DELETE + real loadHistory (no mock — per memory
// feedback_e2e_real_data_only); B4-E2 page.route intercept returns 500 to
// drive rollback + toast; B4-E3 NSM real seed helper (L20 2026-05-17).
// Skill refs:
//   - playwright-skill/core/assertions-and-waiting.md (web-first retry on .not.toBeVisible)
//   - playwright-skill/playwright-cli/request-mocking.md (page.route 500 stub)
//   - playwright-skill/core/api-testing.md:783-848 (service-role seed pattern)

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
//
// After the draft POST (lifecycle='created'), a PATCH /progress with substantive
// frameworkDraft content promotes lifecycle → 'editing' so the T5 list filter
// (GET /api/circles-sessions excludes lifecycle='created' rows) returns the
// session in offcanvas loadHistory.
// Skill ref: test-data-management.md §API Seeding; when-to-mock.md Pitfall 11.
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
  const sessionId = String(id);

  // PATCH /progress — promote lifecycle 'created' → 'editing' so the T5 list
  // filter (which excludes lifecycle='created' rows) includes this session.
  // Must hit real BE — never mock own API (when-to-mock.md Pitfall 11 carve-out).
  await page.evaluate(async (sid) => {
    const A = window.AppState;
    const progressPath = A.accessToken
      ? `/api/circles-sessions/${sid}/progress`
      : `/api/guest-circles-sessions/${sid}/progress`;
    await window.apiFetch(progressPath, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frameworkDraft: { C1: { '問題範圍': '測試用問題範圍內容' } },
      }),
    });
  }, sessionId);

  return sessionId;
}

// ── NSM session creation helper ───────────────────────────────────────────────
// Create a real NSM session via POST /api/nsm-sessions. Returns session id.
// Mirrors createRealSession() above but for the NSM flow.
//
// NSM lifecycle promotion: POST creates row with lifecycle='created'; the GET
// list endpoint filters out lifecycle='created' rows (routes/nsm-sessions.js:59).
// A PATCH /progress with substantive userNsm advances lifecycle → 'editing' so
// loadHistory returns this session in the offcanvas list.
//
// Per memory feedback_e2e_real_data_only: no mocking of own API / no stub timestamps.
// Skill ref: api-testing.md:783-848 §API Seeding; when-to-mock.md Pitfall 11.
// Substantive userNsm — passes hasSubstantiveContent (lib/session-lifecycle.js:86)
// so lifecycle promotes 'created' → 'editing'; mirrors lifecycle-nsm.spec.js line 32.
const NSM_SUBSTANTIVE = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';

async function createRealNsmSession(page) {
  // Generate a unique question_id per worker invocation so dedupSessions
  // (lib/session-dedup.js — deduplicates by question_id) never merges
  // this test's session with any other concurrent worker's session.
  // Three browser workers run B4-E3 in parallel; each must see its own item.
  const uniqueQid = await page.evaluate(() => {
    // Crypto UUID available in all modern browsers + Node ≥ 16.
    return 'nsm_b4e3_' + (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + '_' + Date.now());
  });

  const NSM_QUESTION_JSON = {
    id: uniqueQid,
    problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
    product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
  };

  // POST /api/nsm-sessions — creates row with lifecycle='created'.
  const id = await page.evaluate(async ({ qid, qjson }) => {
    const A = window.AppState;
    const path = A.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, questionJson: qjson }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sessionId || data.id;
  }, { qid: uniqueQid, qjson: NSM_QUESTION_JSON });

  expect(id).toBeTruthy();
  const sessionId = String(id);

  // PATCH /progress — promote lifecycle 'created' → 'editing' via substantive userNsm
  // so the GET list filter (nsm-sessions.js:59 excludes lifecycle='created') returns
  // this session in offcanvas loadHistory.
  await page.evaluate(async ({ sid, userNsm }) => {
    const A = window.AppState;
    const path = A.accessToken
      ? `/api/nsm-sessions/${sid}/progress`
      : `/api/guest/nsm-sessions/${sid}/progress`;
    await window.apiFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNsm }),
    });
  }, { sid: sessionId, userNsm: NSM_SUBSTANTIVE });

  return sessionId;
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
    // L20 2026-05-17: NSM seed helper implemented — mirrors B4-E1 pattern for NSM.
    // Closes O-7 (master tracker §6) + F-P16 spec gap.
    await bootApp(page);
    const id = await createRealNsmSession(page);
    await openOffcanvasAndAwaitItem(page, id);

    // Delete the NSM item.
    await page.locator(SELECTORS.deleteBtn(id)).click();

    // Web-first retry: item gone immediately (optimistic filter, same as B4-E1).
    await expect(page.locator(SELECTORS.offcanvasItem(id))).not.toBeVisible();

    // Close offcanvas immediately (Escape) — the race window starts here.
    await page.keyboard.press('Escape');
    // Wait for offcanvas to close.
    await expect(page.locator(SELECTORS.offcanvasBody)).not.toBeVisible({ timeout: 3_000 });

    // Re-open offcanvas immediately (before DELETE response may have settled).
    await page.locator(SELECTORS.offcanvasOpen).click();
    await page.locator(SELECTORS.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });

    // Auto-retry until loadHistory GET settles — deleted NSM item must NOT come back.
    // Validates cache-invalidation path for NSM delete (nsm-sessions route + app.js:8394).
    await expect(page.locator(SELECTORS.offcanvasItem(id))).not.toBeVisible({ timeout: 10_000 });
  });
});
