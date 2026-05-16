// tests/e2e/circles-delete-rollback-real.spec.js
// Testing Trophy retrofit: Tier 2 → Tier 4 promotion.
// Replaces hollow vm.createContext unit test (tests/unit/circles-delete-rollback.test.js).
// Spec ref: Trophy audit 2026-05-16 §Tier 2 + Stage 1B §6 B4-U1..U4.
//
// Skill refs:
//   - playwright-skill/core/test-architecture.md  (Trophy E2E layer)
//   - playwright-skill/core/when-to-mock.md       (carve-out: route.fulfill 500 for error states)
//   - playwright-skill/core/crud-testing.md       (Recipe 4: delete with confirmation)
//   - playwright-skill/core/assertions-and-waiting (web-first retry)

'use strict';

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');

// Run tests serially within each project to avoid intra-project idempotent key collisions.
// (The /draft endpoint idempotency + DB unique constraint prevent parallel creation of the
// same question+mode+step for the same user.)
test.describe.configure({ mode: 'serial' });

// ── Question index allocation ─────────────────────────────────────────────────
// Each project gets a non-overlapping block of question indices to avoid inter-project
// DB unique constraint collisions (all projects share the same e2e user).
// Indices are stable across runs; we pick from different buckets per project.
// TC1 = projectBase+0, TC2 = projectBase+1, TC3 = projectBase+2.
function getProjectQuestionBase(projectName) {
  if (projectName.includes('mobile-safari')) return 10;
  if (projectName.includes('mobile-chrome')) return 6;
  return 2; // e2e-desktop (default)
}

// ── Selectors ─────────────────────────────────────────────────────────────────
// Mirror offcanvas-delete.spec.js exemplar selectors (app.js:7745, 3067, 2995).
const SEL = {
  offcanvasOpen:  '[data-nav="offcanvas"]',
  offcanvasBody:  '.offcanvas-body',
  offcanvasItem:  (id) => `[data-offcanvas="item"][data-id="${id}"]`,
  deleteBtn:      (id) => `[data-offcanvas="delete"][data-id="${id}"]`,
  toastWrap:      '[data-resume-landing-toast]',
  toastBody:      '[data-resume-landing-toast] .resume-toast__body',
  modeSelector:   '[data-circles-mode="drill"]',
};

// ── Boot helper ───────────────────────────────────────────────────────────────
// Clear localStorage + stub history GET endpoints → navigate → wait for boot.
// Un-stubs after boot so real API calls flow (per feedback_e2e_real_data_only).
async function bootApp(page) {
  // TC1 fix: guard against BASE_URL being undefined when spec is run without
  // --config (env load order race). playwright.config.js sets baseURL to
  // process.env.BASE_URL || 'http://localhost:3000', but that default only
  // applies when Playwright resolves the config. When page.goto('/') is used
  // (relative), Playwright uses the configured baseURL. The guard below ensures
  // we fail fast with a clear message rather than "Cannot navigate to invalid URL".
  const baseURL = page.context()._options?.baseURL || 'http://localhost:3000';
  if (!baseURL.startsWith('http')) {
    throw new Error(`BASE_URL must be an http(s) URL, got: ${baseURL}`);
  }

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

  // Wait for mode-selector → app booted + tryResume settled.
  await page.locator(SEL.modeSelector).waitFor({ state: 'visible', timeout: 15_000 });

  // Un-stub → real POST (session create) + real GET (history) must flow.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// ── Session seed helper ───────────────────────────────────────────────────────
// Create a real CIRCLES session via /draft endpoint (idempotent — returns existing
// session for same question+mode+step if one exists). Since we assign different
// question indices per project+test, parallel runs on different projects don't collide.
// POST /draft → PATCH /progress (lifecycle: 'created' → 'editing') so the
// T5 list filter includes the session in offcanvas loadHistory.
// Returns session id (string). Caller performs explicit cleanup via cleanupSession.
async function seedRealCirclesSession(page, questionIdx) {
  // Wait for CIRCLES_QUESTIONS to be available.
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  // First: delete any existing session for this question slot (from prior test run leakage)
  // so the /draft idempotent endpoint creates a fresh session.
  await page.evaluate(async (qIdx) => {
    const A = window.AppState;
    if (!A.accessToken) return;
    const q = window.CIRCLES_QUESTIONS[qIdx] || window.CIRCLES_QUESTIONS[0];
    // Check if an existing session exists for this slot and delete it first.
    const listRes = await window.apiFetch('/api/circles-sessions');
    if (!listRes.ok) return;
    const sessions = await listRes.json();
    const existing = sessions.filter(s => s.question_id === q.id && s.mode === 'drill' && s.drill_step === 'C1');
    for (const s of existing) {
      await window.apiFetch(`/api/circles-sessions/${s.id}`, { method: 'DELETE' });
    }
  }, questionIdx);

  // POST /draft — idempotent; creates new session (existing was cleaned above).
  const result = await page.evaluate(async (qIdx) => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[qIdx] || window.CIRCLES_QUESTIONS[0];
    const draftPath = A.accessToken
      ? '/api/circles-sessions/draft'
      : '/api/guest-circles-sessions/draft';
    const res = await window.apiFetch(draftPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
    });
    if (!res.ok) return { error: 'post_failed_' + res.status };
    const session = await res.json();
    if (!session || !session.id) return { error: 'no_session_id' };
    // Note: do NOT set A.circlesSession here — avoids triggering renders that
    // may interfere with the offcanvas loadHistory flow.
    return { id: session.id };
  }, questionIdx);

  expect(result && result.id, `POST /draft failed: ${JSON.stringify(result)}`).toBeTruthy();
  const sessionId = String(result.id);

  // PATCH /progress → lifecycle 'created' → 'editing' so list filter returns it.
  const patchOk = await page.evaluate(async (sid) => {
    const A = window.AppState;
    const progressPath = A.accessToken
      ? `/api/circles-sessions/${sid}/progress`
      : `/api/guest-circles-sessions/${sid}/progress`;
    const res = await window.apiFetch(progressPath, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frameworkDraft: { C1: { '問題範圍': '測試刪除回滾功能 — 真實 E2E 資料' } },
      }),
    });
    return { ok: res.ok, status: res.status };
  }, sessionId);

  expect(patchOk.ok, `PATCH /progress failed with status ${patchOk.status}`).toBe(true);

  // ── Seed propagation guard ─────────────────────────────────────────────────
  // BUG-GB-001 fix: After POST /draft + PATCH /progress return 200, there is a
  // brief window where a subsequent GET /api/circles-sessions may return a list
  // that does NOT yet include the new row (DB read-after-write visibility lag
  // under load, or response handler not yet flushed). The offcanvas loadHistory()
  // fires exactly such a GET when the drawer opens — if it races ahead of
  // propagation, the rendered list omits the seeded session and the test fails
  // with "item not found" even though everything succeeded.
  //
  // Per playwright-skill/core/common-pitfalls.md Pitfall 1 (lines 9-66):
  // "wait for a specific condition" rather than fixed sleep. We poll the same
  // GET endpoint the UI will call, asserting the seeded session is present
  // before we let the UI fetch it. expect.poll retries until truthy or timeout
  // — no hardcoded delay, no retry-loop, no sleep.
  await expect
    .poll(
      async () => {
        return await page.evaluate(async (sid) => {
          const A = window.AppState;
          const path = A.accessToken
            ? '/api/circles-sessions'
            : '/api/guest-circles-sessions';
          try {
            const res = await window.apiFetch(path);
            if (!res.ok) return false;
            const list = await res.json();
            return Array.isArray(list) && list.some((s) => String(s.id) === sid);
          } catch (_) {
            return false;
          }
        }, sessionId);
      },
      {
        message: `Seeded session ${sessionId} did not appear in GET list within 15s — propagation failure, not flake`,
        timeout: 15_000,
        intervals: [200, 400, 800, 1000, 1500],
      }
    )
    .toBe(true);

  return sessionId;
}

// ── Cleanup helper ────────────────────────────────────────────────────────────
// Perform cleanup via the authenticated browser context (page.evaluate uses the
// app's apiFetch which carries the Supabase auth token from localStorage).
// The auto-cleanup fixture's request context does not share storageState auth,
// so we use the browser path for authenticated sessions instead.
async function cleanupSession(page, sessionId) {
  try {
    await page.evaluate(async (sid) => {
      try {
        const A = window.AppState;
        const path = A.accessToken
          ? `/api/circles-sessions/${sid}`
          : `/api/guest-circles-sessions/${sid}`;
        await window.apiFetch(path, { method: 'DELETE' });
      } catch (_) {}
    }, sessionId);
  } catch (_) {
    // Ignore — may already be deleted or page may be closed.
  }
}

// ── Offcanvas open + await item helper ────────────────────────────────────────
// BUG-GB-001 robustness: seedRealCirclesSession now guarantees the session is
// readable via GET before returning, so opening the offcanvas + waiting for the
// item is deterministic. Web-first toBeVisible retry covers the in-flight
// loadHistory() network round-trip only — no propagation race remains.
// Per playwright-skill/core/common-pitfalls.md Pitfall 1 (lines 9-66): rely on
// auto-retrying assertions, not fixed timeouts.
async function openOffcanvasAndAwaitItem(page, id) {
  await page.locator(SEL.offcanvasOpen).click();
  await page.locator(SEL.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });
  // 15s ceiling: GET round-trip on a slow CI/mobile project rarely exceeds 5s;
  // generous headroom prevents false-flake without masking real bugs (a missing
  // item after 15s with a propagation-verified seed = genuine regression).
  await expect(page.locator(SEL.offcanvasItem(id))).toBeVisible({ timeout: 15_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('circles-delete-rollback-real — Trophy Tier 4', () => {

  // TC1: Happy path — real DELETE succeeds → item removed optimistically + stays gone
  test('happy: real DELETE 200 → item removed + does not reappear on re-open', async ({ page }) => {
    // Allocate unique question slot per project to avoid DB unique constraint collision.
    const qIdx = getProjectQuestionBase(test.info().project.name) + 0;
    let sessionId;

    await test.step('boot app to home page', async () => {
      await bootApp(page);
    });

    await test.step('seed real CIRCLES session via API', async () => {
      sessionId = await seedRealCirclesSession(page, qIdx);
    });

    await test.step('open offcanvas and confirm item visible', async () => {
      await openOffcanvasAndAwaitItem(page, sessionId);
    });

    await test.step('click delete → optimistic removal fires immediately', async () => {
      await page.locator(SEL.deleteBtn(sessionId)).click();
      // Optimistic filter: item gone immediately (no await — web-first retry).
      await expect(page.locator(SEL.offcanvasItem(sessionId))).not.toBeVisible({ timeout: 5_000 });
    });

    await test.step('close + re-open offcanvas → deleted item still absent', async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator(SEL.offcanvasBody)).not.toBeVisible({ timeout: 3_000 });

      await page.locator(SEL.offcanvasOpen).click();
      await page.locator(SEL.offcanvasBody).waitFor({ state: 'visible', timeout: 5_000 });

      // Wait for loadHistory GET to settle — item must NOT reappear.
      // B4 fix: snapshotHistoryBeforeOptimistic prevents cache restoration on re-open.
      await expect(page.locator(SEL.offcanvasItem(sessionId))).not.toBeVisible({ timeout: 10_000 });
    });

    await test.step('verify no error toast appeared', async () => {
      await expect(page.locator(SEL.toastWrap)).not.toBeVisible();
    });

    // Session was actually deleted — no cleanup needed (already gone from DB).
  });

  // TC2: Rollback — route.fulfill 500 → item reappears + error toast
  // Carve-out per when-to-mock.md: simulate 500 that is hard to reproduce against real BE.
  test('rollback: DELETE 500 → item reappears + error toast shown', async ({ page }) => {
    const qIdx = getProjectQuestionBase(test.info().project.name) + 1;
    let sessionId;

    await test.step('boot app to home page', async () => {
      await bootApp(page);
    });

    await test.step('seed real CIRCLES session via API', async () => {
      sessionId = await seedRealCirclesSession(page, qIdx);
    });

    await test.step('open offcanvas and confirm item visible', async () => {
      await openOffcanvasAndAwaitItem(page, sessionId);
    });

    await test.step('intercept DELETE → return 500 to force rollback', async () => {
      // Mock only the DELETE for this specific session id — all other requests real.
      // Per when-to-mock.md carve-out: 500 error states are hard to reproduce against real BE.
      await page.route(`**/api/circles-sessions/${sessionId}`, (route) => {
        if (route.request().method() === 'DELETE') {
          return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        }
        return route.continue();
      });
      await page.route(`**/api/guest-circles-sessions/${sessionId}`, (route) => {
        if (route.request().method() === 'DELETE') {
          return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        }
        return route.continue();
      });
    });

    await test.step('click delete → optimistic removal → then rollback fires', async () => {
      await page.locator(SEL.deleteBtn(sessionId)).click();
      // After rollback: item reappears (B4 impl: catch → restore __originalList + render).
      await expect(page.locator(SEL.offcanvasItem(sessionId))).toBeVisible({ timeout: 5_000 });
    });

    await test.step('error toast visible with correct zh-TW copy', async () => {
      // Toast (data-resume-landing-toast) must appear with '刪除失敗，請再試一次'.
      await expect(page.locator(SEL.toastWrap)).toBeVisible({ timeout: 5_000 });
      await expect(page.locator(SEL.toastBody)).toContainText('刪除失敗，請再試一次');
    });

    await test.step('cleanup: remove mock + real DELETE so DB row is cleaned up', async () => {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await cleanupSession(page, sessionId);
    });
  });

  // TC3: Inflight guard — rapid double-click → only 1 DELETE request fires
  test('inflight guard: rapid double-click DELETE → only 1 request fires', async ({ page }) => {
    const qIdx = getProjectQuestionBase(test.info().project.name) + 2;
    let sessionId;

    await test.step('boot app to home page', async () => {
      await bootApp(page);
    });

    await test.step('seed real CIRCLES session via API', async () => {
      sessionId = await seedRealCirclesSession(page, qIdx);
    });

    await test.step('open offcanvas and confirm item visible', async () => {
      await openOffcanvasAndAwaitItem(page, sessionId);
    });

    // Use page.on('request') to count DELETE calls before they're intercepted.
    // This is the correct pattern when the element may disappear after first click.
    let deleteRequestCount = 0;
    await test.step('install request listener to count DELETE calls', async () => {
      page.on('request', (req) => {
        if (
          req.method() === 'DELETE' &&
          (req.url().includes(`/api/circles-sessions/${sessionId}`) ||
           req.url().includes(`/api/guest-circles-sessions/${sessionId}`))
        ) {
          deleteRequestCount++;
        }
      });
    });

    await test.step('add artificial delay via route to widen inflight window', async () => {
      // TC3 mocks DELETE 200 with 500ms delay to widen the inflight window
      // (controlled deviation from "real DELETE" — required for deterministic
      // inflight-guard assertion). Per when-to-mock.md carve-out for timing control.
      await page.route(`**/api/circles-sessions/${sessionId}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          await new Promise((r) => setTimeout(r, 500));
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        return route.continue();
      });
      await page.route(`**/api/guest-circles-sessions/${sessionId}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          await new Promise((r) => setTimeout(r, 500));
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        return route.continue();
      });
    });

    await test.step('dispatch 2 rapid synchronous clicks via DOM to avoid viewport-reflow race', async () => {
      const deleteSelector = SEL.deleteBtn(sessionId);
      const deleteBtn = page.locator(deleteSelector);

      // First click: use Playwright locator click (auto-waits for actionability).
      await deleteBtn.click();

      // Second click: use page.evaluate with a CSS selector string — per
      // common-pitfalls.md Pitfall 3 (lines 131-185) using page.mouse.click(coords)
      // is fragile because viewport reflow between boundingBox() capture and the
      // second click can mis-target. page.evaluate with querySelector is a one-shot
      // DOM lookup (no Playwright auto-waiting) so it does not hang if the element
      // is already removed by the optimistic filter after the first click.
      // Per Pitfall 18 (lines 1034-1097): page.evaluate is appropriate here because
      // we genuinely need a raw synchronous DOM click on a potentially-detached node.
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
        // If element is already gone (optimistic filter removed it), the inflight guard
        // in AppState._deleteInflight must still block any duplicate DELETE request.
      }, deleteSelector);
    });

    await test.step('wait for first delete to settle (delayed 500 ms)', async () => {
      // Item should be gone after optimistic filter.
      await expect(page.locator(SEL.offcanvasItem(sessionId))).not.toBeVisible({ timeout: 5_000 });
      // Wait for the delayed response + a bit more to capture any duplicate.
      await page.waitForTimeout(800);
    });

    await test.step('assert only 1 DELETE request fired (inflight guard blocked duplicate)', async () => {
      expect(deleteRequestCount).toBe(1);
    });

    // Session deleted by real 200 response — no further cleanup needed.
  });
});
