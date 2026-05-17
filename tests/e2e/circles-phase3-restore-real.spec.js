// tests/e2e/circles-phase3-restore-real.spec.js
// Trophy audit Tier 2 retrofit — replace vm.createContext hollow unit test with
// a REAL E2E: seed session via real API, inject step_scores via Supabase REST,
// trigger restore via window._loadCirclesSessionItem (real GET + real
// restoreCirclesPhase1FromSession), then assert Phase 3 score UI vs spinner.
//
// Spec ref: docs/superpowers/specs/2026-05-16-stage-1b-state-cache-design.md §6 B3
// Audit ref: audit/testing-trophy-audit-2026-05-16.md Tier 2
// Pitfall 11 compliance: NO route.fulfill on /api/circles-sessions/**
//   Only OpenAI mocking allowed — not needed here (no AI calls in restore path).
//
// Auth note: cleanup uses page.request (shares browser cookies) not standalone
// request (which is unauthenticated), per offcanvas-delete.spec.js §B4-E2 pattern.
//
// Skill refs:
//   - playwright-skill/core/test-architecture.md (Testing Trophy E2E 10%)
//   - playwright-skill/core/when-to-mock.md (Pitfall 11: never mock own API)
//   - playwright-skill/core/api-testing.md (request.patch patterns)
//   - playwright-skill/core/assertions-and-waiting.md (web-first toBeVisible)

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Selectors ─────────────────────────────────────────────────────────────────
const SEL = {
  // Phase 3 score UI (renderPhase3Score) — only present when circlesScoreResult set
  scoreTotal: '.score-total',
  // Phase 3 loading spinner (renderPhase3Loading) — when circlesScoreResult === null
  loadingWrap: '.loading-wrap',
  // Mode selector: boot signal (app booted + tryResume settled)
  modeSelector: '[data-circles-mode="drill"]',
};

// ── Boot helper ───────────────────────────────────────────────────────────────
// Clear pmDrillState + stub GET list endpoints → navigate → wait for app boot.
// Mirrors bootApp from offcanvas-delete.spec.js.
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

  // Wait until mode-selector visible = app booted + home page rendered.
  await page.locator(SEL.modeSelector).waitFor({ state: 'visible', timeout: 15_000 });

  // Un-stub so real POST (session create) and real GET (restore) flow through.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// ── waitForAuth: wait until AppState.accessToken is set (Supabase session ready) ──
// The Supabase auth session restores asynchronously via CDN script + getSession().
// Mirrors the pattern from circles-gate.spec.js: wait for navbar email signal.
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

// Per-project question ID map: 3 tests × 3 projects = 9 unique IDs.
// Offsets from circles_031 to avoid colliding with bug3-spinner-stuck-reproduce.spec.js
// which uses circles_021..circles_023 (3 projects × 1 test).
// Each (test slot, project) pair gets its own question so parallel workers never
// share a draft-endpoint session (the draft endpoint is idempotent per user+question).
const QUESTION_BY_SLOT_AND_PROJECT = {
  // B3-R1 happy (slot 0)
  0: { 'e2e-desktop': 'circles_031', 'e2e-mobile-chrome': 'circles_032', 'e2e-mobile-safari': 'circles_033' },
  // B3-R2 sad (slot 1)
  1: { 'e2e-desktop': 'circles_034', 'e2e-mobile-chrome': 'circles_035', 'e2e-mobile-safari': 'circles_036' },
  // B3-R3 regression guard (slot 2)
  2: { 'e2e-desktop': 'circles_037', 'e2e-mobile-chrome': 'circles_038', 'e2e-mobile-safari': 'circles_039' },
};
function questionIdForSlot(testInfo, slot) {
  const byProject = QUESTION_BY_SLOT_AND_PROJECT[slot] || QUESTION_BY_SLOT_AND_PROJECT[0];
  return byProject[testInfo.project.name] || byProject['e2e-desktop'];
}

// ── createRealSession: POST /api/circles-sessions/draft via apiFetch ─────────
// questionId: explicit circles_XXX ID so each (test slot, browser project) pair
// uses a unique question → draft endpoint never deduplicates across parallel workers.
// Returns { sessionId: string, isAuth: boolean }.
async function createRealSession(page, questionId) {
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  const result = await page.evaluate(async (qid) => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS.find(function (x) { return x.id === qid; })
      || window.CIRCLES_QUESTIONS[0];
    const isAuth = !!A.accessToken;
    const path = isAuth ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
    });
    if (!res.ok) return null;
    const session = await res.json();
    // Store in AppState so the dedup guard in loadCirclesSessionFromHistory
    // recognises it exists (we will clear this before triggering restore).
    A.circlesSession = session;
    return { sessionId: session.id, isAuth };
  }, questionId);

  expect(result).toBeTruthy();
  expect(result.sessionId).toBeTruthy();
  return result;
}

// ── promoteLifecycle: PATCH /progress with frameworkDraft → lifecycle 'editing' ──
async function promoteLifecycle(page, sessionId, isAuth) {
  await page.evaluate(async ({ sid, auth }) => {
    const A = window.AppState;
    const path = auth
      ? `/api/circles-sessions/${sid}/progress`
      : `/api/guest-circles-sessions/${sid}/progress`;
    await window.apiFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frameworkDraft: { C1: { '問題範圍': 'E2E B3 restore test — 問題範圍內容 for lifecycle promote' } },
      }),
    });
  }, { sid: sessionId, auth: isAuth });
}

// ── seedStepScores: Supabase PostgREST PATCH to inject step_scores ────────────
// Test DATA SEEDING — writes fixture data directly to DB using service role key.
// NOT mocking the app's own API (Pitfall 11 compliant).
// The app's GET /api/circles-sessions/:id will serve this from the REAL DB.
async function seedStepScores(pageRequest, sessionId, stepScores) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('seedStepScores: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required in .env');
  }

  const url = `${SUPABASE_URL}/rest/v1/circles_sessions?id=eq.${sessionId}`;
  const res = await pageRequest.patch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    data: { step_scores: stepScores },
  });

  // 204 No Content = success for Prefer: return=minimal
  const status = res.status();
  if (status !== 204 && status !== 200) {
    const body = await res.text();
    throw new Error(`seedStepScores: Supabase PATCH returned ${status}. Body: ${body}`);
  }
}

// ── cleanupSession: DELETE session via page.request (authenticated browser cookies) ──
// page.request shares the browser context's auth cookies — mirrors B4-E2 pattern.
async function cleanupSession(page, sessionId, isAuth) {
  try {
    const path = isAuth
      ? `/api/circles-sessions/${sessionId}`
      : `/api/guest-circles-sessions/${sessionId}`;
    await page.request.delete(path);
  } catch (_) {
    // best-effort cleanup — don't fail the test
  }
}

// ── triggerRealRestore: call window._loadCirclesSessionItem ──────────────────
// Calls the real loadCirclesSessionFromHistory which:
//   1. Makes real GET /api/circles-sessions/:id
//   2. Calls restoreCirclesPhase1FromSession(fullItem)
//   3. B3 fix: derives circlesScoreResult from step_scores in DB response
// window._loadCirclesSessionItem is exposed at app.js:8162.
//
// DEDUP GUARD: app.js:8120 returns early if circlesSession.id === item.id.
// createRealSession sets circlesSession, so we MUST clear it before calling.
async function triggerRealRestore(page, sessionId) {
  await page.waitForFunction(
    () => typeof window._loadCirclesSessionItem === 'function',
    { timeout: 10_000 }
  );

  // Clear circlesSession to bypass the dedup guard (app.js:8120):
  //   "already in same form? no-op" — guard checks circlesSession.id === item.id
  await page.evaluate(() => {
    const A = window.AppState;
    A.circlesSession = null;
    A.circlesPhase = 0;
  });

  // Trigger the real restore — this does a real GET /api/circles-sessions/:id
  // and calls restoreCirclesPhase1FromSession with the DB response.
  //
  // ROUTING FIX: loadCirclesSessionFromHistory routes by item.mode presence (app.js:8045):
  //   var isNsm = !item.mode && !item.drill_step;
  // Pass mode + drill_step so it takes the CIRCLES path (not the NSM path).
  await page.evaluate(async (sid) => {
    await window._loadCirclesSessionItem({ id: sid, mode: 'drill', drill_step: 'C1' });
  }, sessionId);

  // Wait for restore to settle: view=circles + phase=1 + session.id matches
  await page.waitForFunction(
    (sid) => {
      const A = window.AppState;
      return A && A.view === 'circles' && A.circlesPhase === 1
        && A.circlesSession && String(A.circlesSession.id) === String(sid);
    },
    sessionId,
    { timeout: 15_000 }
  );
}

// ── navigateToPhase3: set circlesPhase=3 + render ────────────────────────────
// Mirrors the "回評分" button click (data-phase2="go-phase3" → sets circlesPhase=3).
// Resets Phase 3 timers to start from clean state.
async function navigateToPhase3(page) {
  await page.evaluate(() => {
    const A = window.AppState;
    A.circlesPhase = 3;
    A.circlesPhase3Error = null;
    A.circlesPhase3LoadingStep = 0;
    A.circlesPhase3LoadingSlow = false;
    A.circlesPhase3DimExpanded = {};
    A.circlesPhase3CoachDemoOpen = false;
    A._phase3CoachDemoInitialized = false;
    window.render && window.render();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('B3 Phase 3 restore — real Supabase seed + real browser restore', () => {

  // B3-R1: happy path — step_scores present → circlesScoreResult set → Phase 3 shows score
  test('B3-R1 happy: step_scores in DB → restore sets circlesScoreResult → Phase 3 shows score UI', async ({ page }, testInfo) => {
    await test.step('boot app + wait for auth', async () => {
      await bootApp(page);
      await waitForAuth(page);
    });

    let sessionId, isAuth;
    await test.step('seed real session (per-project unique question, slot 0, drill C1)', async () => {
      const result = await createRealSession(page, questionIdForSlot(testInfo, 0));
      sessionId = result.sessionId;
      isAuth = result.isAuth;
      await promoteLifecycle(page, sessionId, isAuth);
    });

    await test.step('inject step_scores via Supabase REST (test data seeding)', async () => {
      await seedStepScores(page.request, sessionId, {
        C1: {
          totalScore: 78,
          dimensions: [
            { name: '問題澄清', score: 4, comment: '邊界定義清晰' },
            { name: '情境定義', score: 3, comment: '時間範圍合理' },
          ],
          strengths: '問題範圍界定清楚',
          improvements: '可進一步說明業務影響鏈',
        },
      });
    });

    await test.step('trigger real restore via window._loadCirclesSessionItem', async () => {
      await triggerRealRestore(page, sessionId);
    });

    await test.step('verify circlesScoreResult populated by B3 fix (real restoreCirclesPhase1FromSession)', async () => {
      const scoreResult = await page.evaluate(() => window.AppState && window.AppState.circlesScoreResult);
      expect(scoreResult).not.toBeNull();
      expect(scoreResult.totalScore).toBe(78);
    });

    await test.step('navigate to Phase 3 → score UI visible (not spinner)', async () => {
      await navigateToPhase3(page);
      await expect(page.locator(SEL.scoreTotal)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(SEL.loadingWrap)).not.toBeVisible();
    });

    await test.step('cleanup session', async () => {
      await cleanupSession(page, sessionId, isAuth);
    });
  });

  // B3-R2: sad path — empty step_scores → circlesScoreResult=null → Phase 3 shows spinner
  test('B3-R2 sad: empty step_scores in DB → restore sets circlesScoreResult=null → Phase 3 shows spinner', async ({ page }, testInfo) => {
    await test.step('boot app + wait for auth', async () => {
      await bootApp(page);
      await waitForAuth(page);
    });

    let sessionId, isAuth;
    await test.step('seed real session with no step_scores (per-project unique question, slot 1, drill C1)', async () => {
      // Per-project unique question (slot 1) avoids dedup with B3-R1 test workers (slot 0).
      const result = await createRealSession(page, questionIdForSlot(testInfo, 1));
      sessionId = result.sessionId;
      isAuth = result.isAuth;
      await promoteLifecycle(page, sessionId, isAuth);
      // Explicitly seed empty step_scores (no evaluation done)
      await seedStepScores(page.request, sessionId, {});
    });

    await test.step('trigger real restore', async () => {
      await triggerRealRestore(page, sessionId);
    });

    await test.step('verify circlesScoreResult is null (empty step_scores → no score)', async () => {
      const scoreResult = await page.evaluate(() => window.AppState && window.AppState.circlesScoreResult);
      expect(scoreResult).toBeNull();
    });

    await test.step('navigate to Phase 3 → loading spinner visible (correct — no over-fix)', async () => {
      await navigateToPhase3(page);
      await expect(page.locator(SEL.loadingWrap)).toBeVisible({ timeout: 5_000 });
      await expect(page.locator(SEL.scoreTotal)).not.toBeVisible();
    });

    await test.step('cleanup session', async () => {
      await cleanupSession(page, sessionId, isAuth);
    });
  });

  // B3-R3: regression guard — "回評分" path NOT stuck on spinner (B3 original bug)
  test('B3-R3 regression guard: "回評分" path does NOT get stuck on spinner after restore with step_scores', async ({ page }, testInfo) => {
    // B3 bug (pre-fix): restoreCirclesPhase1FromSession did NOT set circlesScoreResult
    // from step_scores. So Phase 3 rendered spinner even when score existed in DB.
    // This test proves the regression cannot silently reappear.
    await test.step('boot app + wait for auth', async () => {
      await bootApp(page);
      await waitForAuth(page);
    });

    let sessionId, isAuth;
    await test.step('seed session with completed step_scores (per-project unique question, slot 2, simulates post-evaluation)', async () => {
      // Per-project unique question (slot 2) avoids dedup with R1 (slot 0) + R2 (slot 1) workers.
      const result = await createRealSession(page, questionIdForSlot(testInfo, 2));
      sessionId = result.sessionId;
      isAuth = result.isAuth;
      await promoteLifecycle(page, sessionId, isAuth);
      await seedStepScores(page.request, sessionId, {
        C1: {
          totalScore: 85,
          dimensions: [
            { name: '問題澄清', score: 5, comment: '邊界清晰、排除合理' },
            { name: '情境定義', score: 4, comment: '時間範圍有說明理由' },
          ],
          strengths: '框架完整，定義精準',
          improvements: '可補充更多假設驗證方式',
        },
      });
    });

    await test.step('trigger real restore (real GET + restoreCirclesPhase1FromSession)', async () => {
      await triggerRealRestore(page, sessionId);
    });

    await test.step('navigate to Phase 3 via 回評分 path (set circlesPhase=3 + render)', async () => {
      await navigateToPhase3(page);
    });

    await test.step('score UI visible immediately — spinner NOT stuck (B3 regression guard)', async () => {
      // B3 fix: circlesScoreResult derived from step_scores during restore,
      // so Phase 3 renders score UI without waiting for /evaluate-step.
      await expect(page.locator(SEL.scoreTotal)).toBeVisible({ timeout: 10_000 });
      // Critical: loading-wrap must NOT be visible (B3 bug was spinner stuck here)
      await expect(page.locator(SEL.loadingWrap)).not.toBeVisible();
    });

    await test.step('score total value matches seeded data (85)', async () => {
      await expect(page.locator(SEL.scoreTotal)).toContainText('85');
    });

    await test.step('cleanup session', async () => {
      await cleanupSession(page, sessionId, isAuth);
    });
  });

});
