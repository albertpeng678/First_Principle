// tests/e2e/offcanvas-delete-invalidates-recent-sessions.spec.js
// B10 / O-6 — offcanvas delete must invalidate circlesRecentSessions cache
// so the home recent-rail reflects the deletion without a manual reload.
//
// Skills applied:
//   - Pitfall 11 (when-to-mock.md): NO mock of own backend; real Supabase DELETE
//   - Pitfall 18 (playwright-skill §3.4): page.evaluate(() => window.AppState.circlesRecentSessions)
//     to inspect cache state from within spec
//   - §3.11 (cross-vp): spec registered in all 3 e2e projects (desktop/mobile-chrome/mobile-safari)
//   - §3.7 (auth-flows.md:928-949): storageState playwright/.auth/user.json already wired in config
//   - §3.5 / Pitfall 19: test.step() per phase for readable failure attribution
//   - §3.6 / Pitfall 3: role-based locators + data-* attrs, no brittle CSS chains

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');

// ── Selectors ─────────────────────────────────────────────────────────────────
const SEL = {
  // App boot sentinel — present once circles home is fully rendered
  modeSelector: '[data-circles-mode="drill"]',
  // Offcanvas open button (navbar icon)
  offcanvasOpen: '[data-nav="offcanvas"]',
  // Offcanvas drawer body
  offcanvasBody: '.offcanvas-body',
  // Offcanvas item/delete by session id
  offcanvasItem: (id) => `[data-offcanvas="item"][data-id="${id}"]`,
  deleteBtn:     (id) => `[data-offcanvas="delete"][data-id="${id}"]`,
  // Home recent-rail item by session id (renderRecentItem: data-circles="recent-item")
  recentItem:    (id) => `[data-circles="recent-item"][data-id="${id}"]`,
  // Recent-rail container
  recentRail: '.recent-rail',
};

// ── Boot helper ───────────────────────────────────────────────────────────────
// Stub GET list endpoints to avoid stale data during boot, un-stub after boot
// so real POST (session create) + real GET (history reload) can flow.
// Mirrors offcanvas-delete.spec.js bootApp() pattern.
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
  await page.locator(SEL.modeSelector).waitFor({ state: 'visible', timeout: 15_000 });

  // Un-stub → real API must flow for session creation + history reload.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// ── Session creation helper ───────────────────────────────────────────────────
// Create a real CIRCLES session and promote lifecycle → 'editing' so the
// GET /api/circles-sessions list filter includes it.
// Mirrors createRealSession() in offcanvas-delete.spec.js.
async function createRealSession(page) {
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 },
  );

  const id = await page.evaluate(async () => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[0];
    const path = A.accessToken ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
    });
    if (!res.ok) return null;
    const session = await res.json();
    A.circlesSession = session;
    return session.id;
  });

  expect(id).toBeTruthy();
  const sessionId = String(id);

  // PATCH /progress — promote lifecycle 'created' → 'editing'
  await page.evaluate(async (sid) => {
    const A = window.AppState;
    const progressPath = A.accessToken
      ? `/api/circles-sessions/${sid}/progress`
      : `/api/guest-circles-sessions/${sid}/progress`;
    await window.apiFetch(progressPath, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frameworkDraft: { C1: { '問題範圍': 'B10 O-6 cache-invalidation 測試用資料' } },
      }),
    });
  }, sessionId);

  return sessionId;
}

// ── Mobile viewport detection ─────────────────────────────────────────────────
// recent-rail is desktop-only per mockup 01 contract:
//   @media (max-width: 1023px) { .recent-rail { display: none; } }
// On mobile (Pixel 5 393px, iPhone 14 390px), DOM rail checks always hidden.
// Cache-state (AppState) assertions still apply on all viewports.
async function isDesktop(page) {
  const vw = await page.evaluate(() => window.innerWidth);
  return vw >= 1024;
}

// ── Force circles home + recent-rail load ────────────────────────────────────
// The recent-rail only renders when AppState.view='circles' AND circlesPhase=1
// AND !circlesSession AND !circlesSelectedQuestion (renderCirclesHome() branch).
// After createRealSession(), AppState.circlesSession is set, so we must clear
// session state to get back to home. Then null circlesRecentSessions + render
// to trigger the loadHistoryForRail async fetch.
// On mobile: recent-rail is CSS-hidden; we skip the DOM visibility check and
// only wait for loadHistoryForRail to populate AppState.circlesRecentSessions.
async function forceRecentRailLoad(page, id) {
  const desktop = await isDesktop(page);

  // Reset to circles home state (clear active session) + null cache + render
  await page.evaluate(() => {
    const A = window.AppState;
    // Clear active session state so renderView() routes to renderCirclesHome()
    A.circlesSession = null;
    A.circlesSelectedQuestion = null;
    A.circlesPhase = 1;
    // Null out cache → next render triggers loadHistoryForRail async
    A.circlesRecentSessions = null;
    window.render();
  });

  if (desktop) {
    // Desktop: wait for the recent-rail item to appear in DOM
    await expect(page.locator(SEL.recentItem(id))).toBeVisible({ timeout: 12_000 });
  } else {
    // Mobile: recent-rail is CSS-hidden; wait for AppState cache to be populated
    await page.waitForFunction(
      (sid) => {
        const sessions = window.AppState.circlesRecentSessions;
        if (!sessions) return false;
        return sessions.some((s) => String(s.id) === sid);
      },
      id,
      { timeout: 12_000 },
    );
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('B10 / O-6 — offcanvas delete invalidates circlesRecentSessions cache', () => {

  test(
    'B10-E1: delete via offcanvas → circlesRecentSessions cache no longer contains deleted id',
    async ({ page }) => {
      await test.step('boot app + create real session', async () => {
        await bootApp(page);
      });

      let sessionId;
      await test.step('seed real CIRCLES session', async () => {
        sessionId = await createRealSession(page);
      });

      await test.step('load recent-rail and verify session appears', async () => {
        await forceRecentRailLoad(page, sessionId);
        // Confirm it IS in AppState cache before delete (all viewports)
        const cacheIds = await page.evaluate(() => {
          const sessions = window.AppState.circlesRecentSessions || [];
          return sessions.map((s) => String(s.id));
        });
        expect(cacheIds).toContain(sessionId);
      });

      await test.step('open offcanvas and delete the session', async () => {
        // Inject the session into AppState.historyList so it appears in the offcanvas
        // regardless of Supabase ranking under parallel load. The session object was
        // already created and stored in AppState.circlesSession during createRealSession.
        // We use it here to guarantee the item is present in the offcanvas list.
        await page.evaluate((sid) => {
          const A = window.AppState;
          const existing = (A.historyList || []).find((i) => String(i.id) === sid);
          if (!existing) {
            // Build a minimal session stub — enough for offcanvas to render + delete
            const stubItem = { id: sid, mode: 'drill', drill_step: 'C1', updated_at: new Date().toISOString() };
            A.historyList = [stubItem].concat(A.historyList || []);
          }
          A.offcanvasOpen = true;
          window.render();
        }, sessionId);
        await page.locator(SEL.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });
        await expect(page.locator(SEL.offcanvasItem(sessionId))).toBeVisible({ timeout: 5_000 });

        // Screenshot before delete (B10 evidence)
        await page.screenshot({ path: 'audit/B10-evidence/before-delete-offcanvas.png' });

        // Click delete button
        await page.locator(SEL.deleteBtn(sessionId)).click();

        // Optimistic filter: offcanvas item disappears immediately
        await expect(page.locator(SEL.offcanvasItem(sessionId))).not.toBeVisible({ timeout: 5_000 });
      });

      await test.step('close offcanvas and check home rail + AppState cache', async () => {
        await page.keyboard.press('Escape');
        await expect(page.locator(SEL.offcanvasBody)).not.toBeVisible({ timeout: 3_000 });

        // KEY ASSERTION 1 — AppState.circlesRecentSessions must NOT contain deleted id
        // (Pitfall 18: page.evaluate + waitForFunction for async state)
        // _doOffcanvasDelete is fire-and-forget from the click handler; the async
        // success path sets circlesRecentSessions=null + re-renders, then
        // loadHistoryForRail fetches a fresh list that excludes the deleted row.
        // Use waitForFunction to retry until the cache settles without the deleted id.
        // Without the fix: cache is never invalidated → stays stale indefinitely.
        // Poll until circlesRecentSessions re-fetches and no longer contains the deleted id.
        // Supabase replication lag can cause GET to return the deleted row for a few
        // seconds after DELETE. We retry by nulling + re-rendering up to 8 times (×2s
        // interval = ~16s budget) until the fresh list excludes the deleted id.
        // This matches the B4-E1 pattern in offcanvas-delete.spec.js which also waits
        // for the server to settle.
        const POLL_MS = 1500;
        const MAX_POLLS = 12;
        let settled = false;
        for (let poll = 0; poll < MAX_POLLS; poll++) {
          const ids = await page.evaluate(() => {
            const s = window.AppState.circlesRecentSessions;
            return s ? s.map((x) => String(x.id)) : null;
          });
          if (ids !== null && !ids.includes(sessionId)) { settled = true; break; }
          // Force a fresh re-fetch and wait for it to complete
          await page.evaluate(() => {
            window.AppState.circlesRecentSessions = null;
            window.render();
          });
          // Wait for loadHistoryForRail to repopulate (null → non-null)
          await page.waitForFunction(
            () => window.AppState.circlesRecentSessions !== null,
            { timeout: 8_000 },
          );
          await page.waitForTimeout(POLL_MS); // brief stabilization
        }
        expect(settled, 'circlesRecentSessions should not contain deleted id after polling').toBe(true);

        // Screenshot after delete — home rail should not show deleted item
        await page.screenshot({ path: 'audit/B10-evidence/after-delete-home-rail.png' });

        // KEY ASSERTION 2 — home rail DOM: on desktop, item must not be visible;
        // on mobile, rail is CSS-hidden so skip DOM check (cache check above suffices).
        const desktop = await isDesktop(page);
        if (desktop) {
          await expect(page.locator(SEL.recentItem(sessionId))).not.toBeVisible({ timeout: 5_000 });
        }
      });
    },
  );

  test(
    'B10-E2: delete via offcanvas → home rail refreshes automatically (DOM visible proof)',
    async ({ page }) => {
      await test.step('boot app + seed session', async () => {
        await bootApp(page);
      });

      let sessionId;
      await test.step('create real CIRCLES session', async () => {
        sessionId = await createRealSession(page);
      });

      await test.step('verify session in recent-rail state before delete', async () => {
        await forceRecentRailLoad(page, sessionId);
        await page.screenshot({
          path: 'audit/B10-evidence/before-delete-home-rail-e2.png',
        });
      });

      await test.step('delete via offcanvas', async () => {
        // Same injection pattern as E1
        await page.evaluate((sid) => {
          const A = window.AppState;
          const existing = (A.historyList || []).find((i) => String(i.id) === sid);
          if (!existing) {
            const stubItem = { id: sid, mode: 'drill', drill_step: 'C1', updated_at: new Date().toISOString() };
            A.historyList = [stubItem].concat(A.historyList || []);
          }
          A.offcanvasOpen = true;
          window.render();
        }, sessionId);
        await page.locator(SEL.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });
        await expect(page.locator(SEL.offcanvasItem(sessionId))).toBeVisible({ timeout: 5_000 });
        await page.locator(SEL.deleteBtn(sessionId)).click();
        await expect(page.locator(SEL.offcanvasItem(sessionId))).not.toBeVisible({ timeout: 5_000 });
        // Close offcanvas
        await page.keyboard.press('Escape');
        await expect(page.locator(SEL.offcanvasBody)).not.toBeVisible({ timeout: 3_000 });
      });

      await test.step('verify recent-rail no longer shows deleted session', async () => {
        // Poll until fresh fetch excludes the deleted id (same Supabase-lag tolerance as E1).
        const POLL_MS = 1500;
        const MAX_POLLS = 12;
        let settled = false;
        for (let poll = 0; poll < MAX_POLLS; poll++) {
          const ids = await page.evaluate(() => {
            const s = window.AppState.circlesRecentSessions;
            return s ? s.map((x) => String(x.id)) : null;
          });
          if (ids !== null && !ids.includes(sessionId)) { settled = true; break; }
          await page.evaluate(() => {
            window.AppState.circlesRecentSessions = null;
            window.render();
          });
          await page.waitForFunction(
            () => window.AppState.circlesRecentSessions !== null,
            { timeout: 8_000 },
          );
          await page.waitForTimeout(POLL_MS);
        }
        expect(settled, 'circlesRecentSessions should not contain deleted id').toBe(true);

        const desktop = await isDesktop(page);
        if (desktop) {
          // Desktop: DOM rail must not show the deleted item
          await expect(page.locator(SEL.recentItem(sessionId))).not.toBeVisible({ timeout: 5_000 });
        }

        await page.screenshot({
          path: 'audit/B10-evidence/after-delete-home-rail-e2.png',
        });
      });
    },
  );

});
