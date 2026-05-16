// tests/e2e/persist-retry-browser-real.spec.js
//
// Real Playwright e2e proving window.persistRetry is wired into app.js and that
// retry behavior is observable end-to-end in the browser.
//
// Skill refs applied:
//   - network-mocking.md lines 906-933: intermittent-failure simulation pattern
//     (requestCount counter + route.fulfill 503 for first N, then route.continue)
//   - network-mocking.md lines 1012-1027: page.waitForRequest predicate
//     (used to count PATCH attempts observed by route handler)
//   - when-to-mock.md carve-out (own-API mock OK for error states impossible to
//     reproduce against real BE — transient 503 cannot be deterministically injected
//     at the Supabase layer from the browser; page.route intercepts browser→server
//     calls, which is the correct layer to test persistRetry wiring)
//   - fixtures-and-hooks.md lines 19-60: test-scoped fixture teardown pattern
//     (bootApp clears state + tears down stubs; browser-side cleanupSession in finally)
//
// BOUNDARY RATIONALE
// ──────────────────
// window.persistRetry wraps window.apiFetch() (browser→server PATCH calls).
// page.route() intercepts exactly those calls. The 503-503-200 sequence tests
// that persistRetry's retry loop retries transient failures and eventually
// delivers the write to the real server (route.continue() on attempt 3+).
// This proves the helper IS loaded in the browser (wiring) + IS retrying (math)
// at the integration boundary — neither the unit test nor the route smoke test
// can prove both together.
//
// ISOLATION NOTE
// ──────────────
// Tests use different CIRCLES_QUESTIONS indices (3/4/5) to avoid POST /draft
// idempotent collision: same (question_id, mode, drill_step) → same session row.
// Per auto-cleanup.fixture.js: request context lacks Supabase auth headers, so
// cleanup is done via page.evaluate + window.apiFetch (carries browser auth token).

'use strict';

const { test, expect } = require('@playwright/test');

// ── Boot helper ───────────────────────────────────────────────────────────────
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

  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });

  // Un-stub — real API flows for PATCH/GET assertions
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// ── Session seed helper ───────────────────────────────────────────────────────
// qIndex: CIRCLES_QUESTIONS index — use different index per test to avoid
// idempotent collision (same question_id + mode + drill_step = same session row).
async function seedRealSession(page, qIndex) {
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  const result = await page.evaluate(async (idx) => {
    const q = window.CIRCLES_QUESTIONS[idx] || window.CIRCLES_QUESTIONS[0];
    const A = window.AppState;
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
    A.circlesSession = session;
    return { id: session.id, questionId: q.id };
  }, qIndex);

  expect(result && result.id, `POST /draft failed: ${JSON.stringify(result)}`).toBeTruthy();
  return result;
}

// ── Cleanup helper ────────────────────────────────────────────────────────────
// Browser-side: window.apiFetch carries auth token from storageState.
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
  } catch (_) {}
}

// ── Assert helper ──────────────────────────────────────────────────────────────
async function assertPersistRetryLoaded(page) {
  const loaded = await page.evaluate(() =>
    typeof window.persistRetry === 'object' &&
    typeof window.persistRetry.persistRetry === 'function'
  );
  expect(loaded, 'window.persistRetry must be loaded — check <script src="/lib/persistRetry.js"> in index.html').toBe(true);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('persist-retry-browser-real — window.persistRetry wired + retry observable', () => {

  // ── Test 1: Recovery — 503-503-200 → final 200 persisted + 3 attempts observed ──
  //
  // Applies network-mocking.md lines 906-933 intermittent-failure pattern:
  //   requestCount++ inside route handler; first 2 return 503; 3rd → route.continue().
  // Proves:
  //   (a) window.persistRetry is loaded in the browser (wiring works)
  //   (b) persistRetry retries on 503 (retry math works end-to-end)
  //   (c) 3rd attempt reaches real Express + real Supabase (data actually persists)
  test('recovery: 503-503-200 → 3 attempts observed + data persisted in real DB', async ({ page }) => {
    await bootApp(page);
    // Use qIndex=3 for this test only — avoids idempotent collision with other tests.
    const sessionInfo = await seedRealSession(page, 3);
    const sessionId = sessionInfo.id;

    try {
      await assertPersistRetryLoaded(page);

      // Intermittent-failure pattern per network-mocking.md lines 906-933.
      // First 2 PATCH /progress calls → 503; 3rd → real Express (route.continue).
      let patchAttempts = 0;
      await page.route('**/api/circles-sessions/*/progress', async (route) => {
        if (route.request().method() !== 'PATCH') return route.continue();
        patchAttempts++;
        if (patchAttempts <= 2) {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Service Unavailable (injected fault)' }),
          });
        } else {
          await route.continue(); // 3rd attempt hits real Express + Supabase
        }
      });

      const uniqueTag = `retry-recovery-${Date.now()}`;

      await page.evaluate(async (args) => {
        const A = window.AppState;
        const patchPath = A.accessToken
          ? '/api/circles-sessions/' + args.sessionId + '/progress'
          : '/api/guest-circles-sessions/' + args.sessionId + '/progress';
        await window.persistRetry.persistRetry(function () {
          return window.apiFetch(patchPath, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              frameworkDraft: {
                C1: {
                  '問題範圍': `[${args.tag}] persistRetry 503-503-200 回復測試`,
                  '影響對象': '重試測試目標族群',
                  '核心衝突': '瞬時 503 導致首兩次失敗',
                  '目標結果': '第三次成功寫入 Supabase',
                }
              },
            }),
          });
        }, { maxAttempts: 4, backoff: [100, 200, 400] });
      }, { sessionId, tag: uniqueTag });

      // Iron Law 2: retry counter proves retries happened
      // (network-mocking.md lines 906-933: requestCount proves all N calls were made)
      expect(patchAttempts, 'Expected 3 PATCH attempts (2 faults + 1 success)').toBe(3);

      // Unroute so GET below flows to real server
      await page.unrouteAll({ behavior: 'ignoreErrors' });

      // Verify persistence: GET session, confirm unique tag in framework_draft
      const persisted = await page.evaluate(async (sid) => {
        const A = window.AppState;
        const getPath = A.accessToken
          ? `/api/circles-sessions/${sid}`
          : `/api/guest-circles-sessions/${sid}`;
        const res = await window.apiFetch(getPath);
        if (!res.ok) return { error: res.status };
        return res.json();
      }, sessionId);

      expect(persisted.error, `GET session failed: ${JSON.stringify(persisted)}`).toBeUndefined();
      expect(persisted.framework_draft).toBeTruthy();
      expect(persisted.framework_draft.C1['問題範圍']).toContain(uniqueTag);
    } finally {
      await cleanupSession(page, sessionId);
    }
  });

  // ── Test 2: Exhaustion — persistent 503 → RetryExhausted after maxAttempts ──
  //
  // Proves persistRetry stops retrying after maxAttempts and surfaces the error.
  // All PATCH calls return 503; persistRetry throws RetryExhausted after 3 attempts.
  test('exhaustion: persistent 503 × maxAttempts → RetryExhausted thrown, attempts = maxAttempts', async ({ page }) => {
    await bootApp(page);
    // Use qIndex=4 — different question from recovery test (avoids idempotent collision).
    const sessionInfo = await seedRealSession(page, 4);
    const sessionId = sessionInfo.id;

    try {
      await assertPersistRetryLoaded(page);

      let patchAttempts = 0;
      await page.route('**/api/circles-sessions/*/progress', async (route) => {
        if (route.request().method() !== 'PATCH') return route.continue();
        patchAttempts++;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service Unavailable (sustained fault)' }),
        });
      });

      const outcome = await page.evaluate(async (args) => {
        const A = window.AppState;
        const patchPath = A.accessToken
          ? '/api/circles-sessions/' + args.sessionId + '/progress'
          : '/api/guest-circles-sessions/' + args.sessionId + '/progress';
        try {
          await window.persistRetry.persistRetry(function () {
            return window.apiFetch(patchPath, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ frameworkDraft: { C1: { '問題範圍': 'exhaustion-test' } } }),
            });
          }, { maxAttempts: 3, backoff: [50, 100, 200] });
          return { threw: false };
        } catch (err) {
          return { threw: true, name: err.name, attempts: err.attempts };
        }
      }, { sessionId });

      expect(outcome.threw, 'persistRetry must throw RetryExhausted after exhaustion').toBe(true);
      expect(outcome.name).toBe('RetryExhausted');
      expect(outcome.attempts).toBe(3);
      expect(patchAttempts, 'Route must have been called maxAttempts times').toBe(3);
    } finally {
      await cleanupSession(page, sessionId);
    }
  });

  // ── Test 3: Happy path — no intercept → 1 attempt, normal save ──────────────
  //
  // Proves the no-error path: persistRetry resolves on first attempt when server
  // responds 200. No route interception = real Express + real Supabase.
  // Verifies counter = 1 (no spurious retries on success).
  test('happy: no intercept → 1 attempt, data persists normally', async ({ page }) => {
    await bootApp(page);
    // Use qIndex=5 — different question from tests 1+2.
    const sessionInfo = await seedRealSession(page, 5);
    const sessionId = sessionInfo.id;

    try {
      await assertPersistRetryLoaded(page);

      // Count PATCH attempts via a pass-through route (no fault injection).
      // network-mocking.md lines 1012-1027: route handler to count requests.
      let patchAttempts = 0;
      await page.route('**/api/circles-sessions/*/progress', async (route) => {
        if (route.request().method() !== 'PATCH') return route.continue();
        patchAttempts++;
        await route.continue(); // always pass through — happy path
      });

      const uniqueTag = `happy-${Date.now()}`;

      await page.evaluate(async (args) => {
        const A = window.AppState;
        const patchPath = A.accessToken
          ? '/api/circles-sessions/' + args.sessionId + '/progress'
          : '/api/guest-circles-sessions/' + args.sessionId + '/progress';
        await window.persistRetry.persistRetry(function () {
          return window.apiFetch(patchPath, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              frameworkDraft: {
                C1: {
                  '問題範圍': `[${args.tag}] happy-path 直接成功，無重試`,
                  '影響對象': '全體正常網路使用者',
                  '核心衝突': '無衝突',
                  '目標結果': '一次成功',
                }
              },
            }),
          });
        }, { maxAttempts: 4, backoff: [100, 200, 400] });
      }, { sessionId, tag: uniqueTag });

      // Exactly 1 attempt — no spurious retry on 200
      expect(patchAttempts, 'Expected exactly 1 attempt on happy path').toBe(1);

      await page.unrouteAll({ behavior: 'ignoreErrors' });

      const persisted = await page.evaluate(async (sid) => {
        const A = window.AppState;
        const getPath = A.accessToken
          ? `/api/circles-sessions/${sid}`
          : `/api/guest-circles-sessions/${sid}`;
        const res = await window.apiFetch(getPath);
        if (!res.ok) return { error: res.status };
        return res.json();
      }, sessionId);

      expect(persisted.error).toBeUndefined();
      expect(persisted.framework_draft).toBeTruthy();
      expect(persisted.framework_draft.C1['問題範圍']).toContain(uniqueTag);
    } finally {
      await cleanupSession(page, sessionId);
    }
  });

});
