// tests/e2e/bug4-offcanvas-delete-cache-reproduce.spec.js
// Bug 4 reproduce harness — investigator-only, NO production fix here.
// User report: 「offcanvas 把所有練習紀錄刪除後，下次再點擊 offcanvas 時，
//               還是會出現已經刪除的練習紀錄」
//
// Existing B4-E1/E2 (offcanvas-delete.spec.js) cover:
//   • single delete → close → reopen (B4-E1) GREEN
//   • DELETE 500 → rollback (B4-E2) GREEN
// Gaps probed here:
//   R1  delete ALL items (not just one) → close → reopen — exact user wording
//   R2  delete all → navigate to home (renderRecentItem rail) → reopen offcanvas
//   R3  delete all → reload page → reopen offcanvas (server cache 5s TTL)
//   R4  Tab A delete all + Tab B reopen offcanvas (cross-tab cache; per-user server cache)
//   R5  delete all → open via see-all CTA from home (different code path)
//   R6  delete all → wait > 5s (let cache TTL expire) → reopen
//   R7  mobile viewport — same as R1 but iPhone-SE (touch + sticky drawer concerns)
//
// Pitfall 11 (when-to-mock.md): NEVER mock own API. All requests hit real
// Supabase via apiFetch. Real DELETE + real GET list every time.
//
// IL-3 framing (TDD): each test is RED if bug reproduces (assertion fails on
// stale item still visible); GREEN here would mean we could not reproduce.

// Note: NOT using auto-cleanup.fixture — its `request` context lacks the JWT
// (storageState only attaches cookies to `page`, not to the top-level request
// fixture), causing 401 cleanup failures. Cleanup is handled inside bootApp()
// which drains pre-existing sessions via authenticated page.evaluate apiFetch.
const { test, expect } = require('@playwright/test');

// ── Selectors (mirror existing B4 spec for consistency) ──────────────────────
const SELECTORS = {
  offcanvasOpen: '[data-nav="offcanvas"]',
  offcanvasItem: '[data-offcanvas="item"]',
  offcanvasItemById: (id) => `[data-offcanvas="item"][data-id="${id}"]`,
  deleteBtn: (id) => `[data-offcanvas="delete"][data-id="${id}"]`,
  modeSelector: '[data-circles-mode="drill"]',
  offcanvasBody: '.offcanvas-body',
  offcanvasEmpty: '.offcanvas-body .empty-state, .offcanvas-body [data-offcanvas-empty]',
  seeAll: '[data-circles="see-all"]',
  recentRail: '.recent-rail',
  recentItem: '[data-circles="recent-item"]',
};

// ── Boot helper — clean LS, no stubs (real backend throughout) ───────────────
// Also drains any pre-existing sessions for the test user so tryResumeLatestSession
// does not auto-jump into a stale session and hide the mode-selector.
async function bootApp(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });
  await page.goto('/');

  // First: wait for app to boot enough that apiFetch is available.
  await page.waitForFunction(() => typeof window.apiFetch === 'function', { timeout: 15_000 });

  // Drain any pre-existing sessions (pollution from prior runs) — must hit real BE.
  await page.evaluate(async () => {
    const A = window.AppState;
    const circlesPath = A.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';
    const nsmPath = A.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    const [cRes, nRes] = await Promise.all([window.apiFetch(circlesPath), window.apiFetch(nsmPath)]);
    if (cRes.ok) {
      const circles = await cRes.json();
      for (const s of circles) {
        const p = A.accessToken ? `/api/circles-sessions/${s.id}` : `/api/guest-circles-sessions/${s.id}`;
        try { await window.apiFetch(p, { method: 'DELETE' }); } catch (_) {}
      }
    }
    if (nRes.ok) {
      const nsm = await nRes.json();
      for (const s of nsm) {
        const p = A.accessToken ? `/api/nsm-sessions/${s.id}` : `/api/guest/nsm-sessions/${s.id}`;
        try { await window.apiFetch(p, { method: 'DELETE' }); } catch (_) {}
      }
    }
  });

  // Reload so the app re-runs tryResumeLatestSession against the now-empty list,
  // ensuring the mode-selector shows (home view, no active session).
  await page.reload();
  await page.locator(SELECTORS.modeSelector).waitFor({ state: 'visible', timeout: 15_000 });
}

// ── Seed N real CIRCLES sessions via real POST /draft + PATCH /progress ──────
// Mirrors createRealSession from offcanvas-delete.spec.js — promotes lifecycle
// 'created' → 'editing' so T5 list filter includes the row.
async function seedRealSessions(page, count, cleanupTracker) {
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length >= 3,
    { timeout: 10_000 }
  );

  const ids = [];
  for (let i = 0; i < count; i++) {
    const id = await page.evaluate(async (idx) => {
      const A = window.AppState;
      const q = window.CIRCLES_QUESTIONS[idx];
      const path = A.accessToken ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
      const res = await window.apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
      });
      if (!res.ok) return null;
      const session = await res.json();
      const progressPath = A.accessToken
        ? `/api/circles-sessions/${session.id}/progress`
        : `/api/guest-circles-sessions/${session.id}/progress`;
      await window.apiFetch(progressPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frameworkDraft: { C1: { '問題範圍': `bug4-seed-${idx}` } } }),
      });
      return session.id;
    }, i);
    expect(id, `seed[${i}] returned id`).toBeTruthy();
    ids.push(String(id));
    if (cleanupTracker) cleanupTracker.track('circles', id);
  }
  return ids;
}

async function openOffcanvas(page) {
  await page.locator(SELECTORS.offcanvasOpen).click();
  await page.locator(SELECTORS.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });
}

async function closeOffcanvas(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator(SELECTORS.offcanvasBody)).not.toBeVisible({ timeout: 3_000 });
}

async function deleteAllAndWaitGone(page, ids) {
  for (const id of ids) {
    await page.locator(SELECTORS.deleteBtn(id)).click();
    // optimistic filter — item removed from DOM immediately
    await expect(page.locator(SELECTORS.offcanvasItemById(id))).not.toBeVisible({ timeout: 5_000 });
  }
  // Drain inflight DELETEs — wait until AppState._deleteInflight is empty
  await page.waitForFunction(() => {
    const s = window.AppState && window.AppState._deleteInflight;
    return !s || s.size === 0;
  }, { timeout: 10_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test cases
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Bug 4 reproduce — offcanvas delete cache (multi-scenario)', () => {

  test('R1: delete ALL 3 items → close → reopen → all absent (user-wording)', async ({ page }) => {
    await bootApp(page);
    const ids = await seedRealSessions(page, 3);

    await openOffcanvas(page);
    for (const id of ids) {
      await expect(page.locator(SELECTORS.offcanvasItemById(id))).toBeVisible({ timeout: 10_000 });
    }

    await deleteAllAndWaitGone(page, ids);

    await page.screenshot({ path: 'audit/bug4-reproduce/R1-after-delete-before-close.png', fullPage: true });

    await closeOffcanvas(page);
    await openOffcanvas(page);

    // Wait for loadHistory GET to settle (historyLoading=false).
    await page.waitForFunction(() => window.AppState && window.AppState.historyLoading === false, { timeout: 10_000 });

    // STRONG assertion: offcanvas is open AND zero items rendered AND deleted ids absent.
    await expect(page.locator(SELECTORS.offcanvasBody)).toBeVisible();
    // Diagnostic — record state at moment of screenshot.
    const diag = await page.evaluate(() => ({
      offcanvasOpen: window.AppState.offcanvasOpen,
      historyList: (window.AppState.historyList || []).map(i => i.id),
      historyLoading: window.AppState.historyLoading,
    }));
    console.log('[R1-diag]', JSON.stringify(diag));
    // Take screenshot immediately while offcanvas open (before count() side effects).
    await page.screenshot({ path: 'audit/bug4-reproduce/R1-after-reopen.png', fullPage: true });
    const itemCount = await page.locator(SELECTORS.offcanvasItem).count();
    expect(itemCount, 'reopened offcanvas should have zero items after delete-all').toBe(0);

    for (const id of ids) {
      await expect(page.locator(SELECTORS.offcanvasItemById(id))).toHaveCount(0);
    }
  });

  test('R2: delete all → go home → reopen offcanvas — recent-rail cache leak?', async ({ page }) => {
    await bootApp(page);
    const ids = await seedRealSessions(page, 3);

    await openOffcanvas(page);
    await deleteAllAndWaitGone(page, ids);
    await closeOffcanvas(page);

    // Render home — circlesRecentSessions is a SEPARATE state (app.js:74).
    // _doOffcanvasDelete only filters historyList, never touches recent rail.
    // Force home render by ensuring view='circles' phase=1.
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.circlesPhase = 1;
      window.AppState.circlesSelectedQuestion = null;
      // Force recent rail to refetch on next render
      window.AppState.circlesRecentSessions = null;
      window.render && window.render();
    });

    // Wait for recent-rail to load (kicks loadHistoryForRail via setTimeout 0)
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'audit/bug4-reproduce/R2-home-after-delete.png', fullPage: true });

    // Reopen offcanvas
    await openOffcanvas(page);
    for (const id of ids) {
      await expect(page.locator(SELECTORS.offcanvasItemById(id))).not.toBeVisible({ timeout: 10_000 });
    }
    await page.screenshot({ path: 'audit/bug4-reproduce/R2-reopen-after-home.png', fullPage: true });
  });

  test('R3: delete all → page.reload() → reopen — server cache 5s TTL?', async ({ page }) => {
    await bootApp(page);
    const ids = await seedRealSessions(page, 3);

    await openOffcanvas(page);
    await deleteAllAndWaitGone(page, ids);
    await closeOffcanvas(page);

    // Hard reload — fresh AppState, fresh window. Server cache might still be warm
    // (TTL 5s, lib/session-cache.js:3) BUT _doOffcanvasDelete should have invalidated.
    await page.reload();
    await page.locator(SELECTORS.modeSelector).waitFor({ state: 'visible', timeout: 15_000 });

    await openOffcanvas(page);
    for (const id of ids) {
      await expect(page.locator(SELECTORS.offcanvasItemById(id))).not.toBeVisible({ timeout: 10_000 });
    }
    await page.screenshot({ path: 'audit/bug4-reproduce/R3-after-reload.png', fullPage: true });
  });

  test('R4: Tab A delete all → Tab B fresh open offcanvas — server-side cache cross-tab', async ({ browser }) => {
    // Reuse storageState so both tabs are the same authed user.
    const pathMod = require('path');
    const AUTH_FILE = pathMod.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

    const ctxA = await browser.newContext({ storageState: AUTH_FILE });
    const ctxB = await browser.newContext({ storageState: AUTH_FILE });
    const tabA = await ctxA.newPage();
    const tabB = await ctxB.newPage();

    try {
      await bootApp(tabA);
      const ids = await seedRealSessions(tabA, 3);

      // Tab A deletes all via offcanvas.
      await openOffcanvas(tabA);
      await deleteAllAndWaitGone(tabA, ids);
      await closeOffcanvas(tabA);

      // Tab B cold-boots AFTER Tab A's delete completed. No drain — we want a
      // pristine read of what server returns post-delete. If cache invalidation
      // worked (routes/circles-sessions.js:172), Tab B sees an empty list and
      // mode-selector renders. If cache is stale, Tab B's tryResumeLatestSession
      // auto-jumps into a deleted session — that itself is a different bug,
      // but indicates server returned stale data.
      await tabB.addInitScript(() => {
        try { localStorage.removeItem('pmDrillState'); } catch (_) {}
      });
      await tabB.goto('/');

      // Wait for boot — mode-selector OR a session view appearing both signal boot.
      await tabB.waitForFunction(() => {
        return !!document.querySelector('[data-circles-mode="drill"]')
            || !!document.querySelector('[data-resume-landing-toast]')
            || !!document.querySelector('.phase-head');
      }, { timeout: 15_000 });

      // Take diagnostic screenshot first — covers both pass and fail paths.
      await tabB.screenshot({ path: 'audit/bug4-reproduce/R4-tabB-after-tabA-delete-cold-boot.png', fullPage: true });

      // Now navigate to offcanvas via navbar (or recover to home first).
      await tabB.locator('[data-nav="offcanvas"]').click();
      await tabB.locator(SELECTORS.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });

      // RED if bug: any of the deleted ids appears in Tab B's offcanvas.
      for (const id of ids) {
        await expect(tabB.locator(SELECTORS.offcanvasItemById(id))).not.toBeVisible({ timeout: 10_000 });
      }
      await tabB.screenshot({ path: 'audit/bug4-reproduce/R4-tabB-offcanvas-final.png', fullPage: true });
    } finally {
      await ctxA.close().catch(() => {});
      await ctxB.close().catch(() => {});
    }
  });

  test('R5: delete all → open via see-all CTA from home (different open path)', async ({ page }) => {
    await bootApp(page);
    const ids = await seedRealSessions(page, 3);

    await openOffcanvas(page);
    await deleteAllAndWaitGone(page, ids);
    await closeOffcanvas(page);

    // The home see-all opens offcanvas via a different code path (app.js:5736).
    // Force home render so see-all is visible.
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.circlesPhase = 1;
      window.AppState.circlesSelectedQuestion = null;
      window.AppState.circlesRecentSessions = null;
      window.render && window.render();
    });
    await page.waitForTimeout(500);

    const seeAll = page.locator(SELECTORS.seeAll).first();
    if (await seeAll.count() === 0) {
      test.skip(true, 'see-all CTA not rendered on this viewport — covered by R1');
    }
    await seeAll.click();
    await page.locator(SELECTORS.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });

    for (const id of ids) {
      await expect(page.locator(SELECTORS.offcanvasItemById(id))).not.toBeVisible({ timeout: 10_000 });
    }
    await page.screenshot({ path: 'audit/bug4-reproduce/R5-after-see-all.png', fullPage: true });
  });

  test('R7: PHANTOM-PREFLIGHT — delete all → navigate to Phase 1 → reopen offcanvas (likely real-world Bug 4 root cause)', async ({ page }) => {
    // Scenario: user finishes/leaves a session, returns home (circlesSession cleared
    // OR question selected from q-card), enters Phase 1 → preflightDraftSession
    // (app.js:7025) auto-creates a NEW draft session. If user then deletes "all"
    // records via offcanvas but is STILL on Phase 1, the next offcanvas open may
    // show the auto-created phantom session — which user reads as "deleted records
    // came back" even though it's technically a new auto-created session.
    await bootApp(page);
    const ids = await seedRealSessions(page, 3);

    // Delete all via offcanvas.
    await openOffcanvas(page);
    await deleteAllAndWaitGone(page, ids);
    await closeOffcanvas(page);

    // Simulate user being on Phase 1 with a selected question (most common state
    // after a drill: they're partway through and click offcanvas to delete history).
    // Clear circlesSession (mimic 回首頁 + re-enter Phase 1 or completed-session-leave).
    await page.evaluate(() => {
      const A = window.AppState;
      A.circlesSession = null;
      A.circlesSelectedQuestion = window.CIRCLES_QUESTIONS[5]; // a fresh question
      A.circlesSelectedQuestion = Object.assign({}, A.circlesSelectedQuestion);
      A.circlesPhase = 1;
      A.circlesMode = 'drill';
      A.circlesDrillStep = 'C1';
      A.view = 'circles';
      window.render && window.render();
    });

    // Give the Phase 1 mount time to run preflightDraftSession (POST /draft).
    await page.waitForTimeout(2500);

    // Reopen offcanvas — does a phantom session appear?
    await openOffcanvas(page);
    await page.waitForFunction(() => window.AppState && window.AppState.historyLoading === false, { timeout: 10_000 });

    const itemCount = await page.locator(SELECTORS.offcanvasItem).count();
    const historyDiag = await page.evaluate(() => ({
      historyList: (window.AppState.historyList || []).map(i => ({ id: i.id, lifecycle: i.lifecycle, qid: i.question_id })),
      circlesSessionId: (window.AppState.circlesSession || {}).id || null,
      circlesSessionLifecycle: (window.AppState.circlesSession || {}).lifecycle || null,
    }));
    console.log('[R7-diag]', JSON.stringify(historyDiag));

    await page.screenshot({ path: 'audit/bug4-reproduce/R7-phantom-preflight.png', fullPage: true });

    // RED if bug: itemCount > 0 means a phantom session was auto-created and now appears.
    // Note: the T5 list filter excludes lifecycle='created' rows — preflight creates with
    // lifecycle='created', so only a follow-up PATCH that promotes to 'editing' would surface it.
    expect(itemCount, 'after delete-all + Phase 1 mount, offcanvas should still be empty (no phantom auto-created session)').toBe(0);
  });

  test('R6: delete all → wait 6s (TTL expire) → reopen', async ({ page }) => {
    await bootApp(page);
    const ids = await seedRealSessions(page, 3);

    await openOffcanvas(page);
    await deleteAllAndWaitGone(page, ids);
    await closeOffcanvas(page);

    // Wait > 5s TTL — server cache entry expires regardless of invalidate call.
    await page.waitForTimeout(6000);

    await openOffcanvas(page);
    for (const id of ids) {
      await expect(page.locator(SELECTORS.offcanvasItemById(id))).not.toBeVisible({ timeout: 10_000 });
    }
    await page.screenshot({ path: 'audit/bug4-reproduce/R6-after-ttl-wait.png', fullPage: true });
  });

});
