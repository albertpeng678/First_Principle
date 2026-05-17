// tests/e2e/bug3-spinner-stuck-reproduce.spec.js
//
// Bug 3 reproduce harness — investigator-only, NO production fix here.
//
// User report (PNG-21, task #253):
//   「點擊回評分，就一直卡在轉圈圈」
//
// Hypothesis (after production code trace — see audit/bug3-reproduce-2026-05-17.md):
//   tryResumeLatestSession (app.js:7867-8003) rehydrates step_scores + derives
//   circlesLocked, but DOES NOT derive AppState.circlesScoreResult from
//   step_scores[currentStep]. restoreCirclesPhase1FromSession (app.js:8077-8114)
//   DOES set circlesScoreResult via Stage 1B B3 fix (line 8111).
//
//   Result: when a scored Phase-2 session is auto-resumed (post-login, page boot)
//   instead of being clicked open from offcanvas/history, the locked Phase-2
//   banner shows (because stepScores[stepKey].totalScore != null) and "回評分"
//   button is rendered. Clicking it sets circlesPhase = 3 and re-renders. The
//   Phase 3 renderer (app.js:6439-6476) sees circlesScoreResult == null and
//   enters the loading spinner branch → starts 5000 ms step interval + 60 000 ms
//   slow-warn timer + 300 000 ms (5 min) hard timeout that flips to EVAL_TIMEOUT
//   error. From user's POV: 「點擊回評分，就一直卡在轉圈圈」 forever.
//
// Pitfall 11: NEVER mock own API. All requests hit real Supabase via apiFetch.
//   Real session created via apiFetch; step_scores seeded via Supabase REST
//   service-role PATCH (mirrors circles-back-nav-lock.spec.js — legitimate
//   data seeding, not own-API mock).
//
// Skills cited (per STANDING feedback_playwright_skill_cited_application):
//   - playwright-skill/core/auth-flows.md:928-949 "Login via API for Speed"
//       → auth.setup.js storageState; no UI login.
//   - playwright-skill/core/common-pitfalls.md Pitfall 11
//       → ZERO route.fulfill on /api/circles-sessions/** during reproduce;
//         boot stub returns [] for empty list endpoints only and is unrouted.
//   - playwright-skill/core/common-pitfalls.md Pitfall 19 "test.step() for complex flows"
//       → each TC wraps phases in test.step() for trace structure.
//   - playwright-skill/core/api-testing.md:783-848 "API Data Seeding"
//       → Supabase REST PATCH to seed step_scores (legitimate data seeding).
//
// IL-3 framing (TDD): each test is RED if bug reproduces (spinner stays visible
// + circlesScoreResult is null after click). GREEN here would mean we could not
// reproduce — bug is already fixed or hypothesis is wrong.
//
// NO PRODUCTION FIX in this spec.

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test, expect } = require('@playwright/test');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// PNG output dir
const PNG_DIR = path.join(__dirname, '..', '..', 'audit', 'bug3-reproduce');

// Per-project question to avoid cross-project collision (e2e user is shared).
const QUESTION_BY_PROJECT = {
  'e2e-desktop':       'circles_021',
  'e2e-mobile-chrome': 'circles_022',
  'e2e-mobile-safari': 'circles_023',
};
function questionForTest(testInfo) {
  return QUESTION_BY_PROJECT[testInfo.project.name] || 'circles_021';
}

const SEL = {
  modeSelector: '[data-circles-mode="drill"]',
  phase1Root: '[data-view="circles"][data-circles-phase="1"]',
  phase2Root: '[data-view="circles"][data-phase="2"]',
  phase3Root: '[data-view="circles"][data-phase="3"]',
  goPhase3Btn: '[data-phase2="go-phase3"]',           // 回評分
  loadingSpinner: '.loading-wrap .loading-spinner',
  loadingTitle: '.loading-title',
  phase3ScoreNum: '.score-total__num',
  lockedBanner: '.locked-banner',
};

// ── bootApp — stub empty list endpoints on first load, then unroute ──────────
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
  await page.locator(SEL.modeSelector).waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

async function createDraftSession(page, opts) {
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  const sessionId = await page.evaluate(async ({ qid, step }) => {
    const A = window.AppState;
    const path = '/api/circles-sessions/draft';
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: qid, mode: 'drill', drill_step: step }),
    });
    if (!res.ok) throw new Error('createDraftSession: status ' + res.status);
    const session = await res.json();
    A.circlesSession = session;
    return session.id;
  }, { qid: opts.questionId, step: opts.drillStep });

  expect(sessionId).toBeTruthy();
  return sessionId;
}

// Supabase REST PATCH: write step_scores + current_phase=2 + a minimal
// conversation so locked Phase 2 banner renders on resume.
async function seedScoredPhase2Session(pageRequest, sessionId, stepKey, stepScore) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('seedScoredPhase2Session: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  }
  const url = `${SUPABASE_URL}/rest/v1/circles_sessions?id=eq.${sessionId}`;
  const res = await pageRequest.patch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    data: {
      step_scores: { [stepKey]: stepScore },
      current_phase: 2,
      // GET /circles-sessions filter excludes lifecycle='created' (routes/circles-sessions.js:136).
      // Set to 'gated' to mirror real-world state of a session that passed Phase 1.5 gate.
      lifecycle: 'gated',
      framework_draft: { [stepKey]: { '問題範圍': 'bug3 fixture seed' } },
      conversation: [
        { role: 'coach',       text: '你的目標用戶是誰？',  hint: null },
        { role: 'user',        text: '20-35 都會上班族女性',  hint: null },
        { role: 'interviewee', text: '我大多通勤聽 podcast', hint: null },
      ],
      // Bump updated_at into the future so tryResumeLatestSession picks OUR session
      // as "latest" even when parallel projects/workers create concurrent sessions
      // for the same shared e2e@first-principle.test user (cross-project pollution).
      // Sort: tryResume sorts by updated_at desc (app.js:7914).
      updated_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
  const status = res.status();
  if (status !== 204 && status !== 200) {
    const body = await res.text();
    throw new Error(`seedScoredPhase2Session: Supabase PATCH ${status}. Body: ${body}`);
  }
}

function fixtureStepScore() {
  return {
    totalScore: 78,
    dimensions: [
      { name: '問題澄清', score: 4, comment: 'bug3 fixture' },
      { name: '情境定義', score: 3, comment: 'bug3 fixture' },
    ],
    highlight: 'bug3 fixture highlight',
    improvement: 'bug3 fixture improvement',
    coachVersion: { context: 'bug3', perField: [], reasoning: 'bug3' },
  };
}

async function cleanupSession(page, sessionId) {
  try {
    await page.evaluate(async (sid) => {
      const A = window.AppState;
      if (!A || !A.accessToken) return;
      try { await window.apiFetch('/api/circles-sessions/' + sid, { method: 'DELETE' }); } catch (_) {}
    }, sessionId);
  } catch (_) { /* best-effort */ }
}

// ── Reproduce: auto-resume scored Phase-2 → click 回評分 → stuck spinner ─────
test.describe('Bug 3 — "點擊回評分，就一直卡在轉圈圈" reproduce', () => {

  test('R1 (PRIMARY): auto-resume (boot path) → locked Phase 2 → 回評分 → Phase 3 spinner stuck (circlesScoreResult null)', async ({ page }, testInfo) => {
    test.slow(); // gives 270 s; we only need ~30-60 s but auto-resume + reload + assertions add up.
    let sessionId;
    const qid = questionForTest(testInfo);
    const stepKey = 'C1';

    try {
      await test.step('seed: boot, drain pollution sessions for test user, create scored Phase-2 session', async () => {
        await bootApp(page);
        await waitForAuth(page);

        // Drain ALL existing circles sessions so tryResumeLatestSession picks
        // OUR session (the user has accumulated 20+ in-progress sessions from
        // prior runs that would otherwise be the "latest").
        await page.evaluate(async () => {
          const A = window.AppState;
          if (!A || !A.accessToken) return;
          const res = await window.apiFetch('/api/circles-sessions');
          if (!res.ok) return;
          const sessions = await res.json();
          for (const s of sessions) {
            try { await window.apiFetch('/api/circles-sessions/' + s.id, { method: 'DELETE' }); } catch (_) {}
          }
        });

        sessionId = await createDraftSession(page, { questionId: qid, drillStep: stepKey });

        // Trigger a real-API PATCH FIRST so the in-memory list cache for this
        // user is invalidated for the route. (Supabase REST in the next step
        // would bypass our cache invalidation.)
        await page.evaluate(async (sid) => {
          await window.apiFetch('/api/circles-sessions/' + sid + '/progress', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPhase: 2 }),
          });
        }, sessionId);

        // Now Supabase REST PATCH the step_scores + lifecycle + future updated_at.
        // This bypasses our Express cache — but the cache was just invalidated above,
        // and there has been no subsequent GET that would re-warm it before reload.
        await seedScoredPhase2Session(page.request, sessionId, stepKey, fixtureStepScore());
      });

      await test.step('trigger BOOT-PATH auto-resume (tryResumeLatestSession) — NOT offcanvas restore', async () => {
        // Clear AppState in-memory so tryResumeLatestSession's alreadyInSession
        // guard does not abort. The bug surfaces when the resume branch runs
        // (post-login, page boot) rather than when user clicks from offcanvas
        // (which uses restoreCirclesPhase1FromSession + correctly sets scoreResult).
        await page.evaluate(() => {
          const A = window.AppState;
          A.circlesPhase = 1;
          A.circlesSession = null;
          A.nsmSession = null;
          A.nsmStep = 1;
          A.circlesScoreResult = null;
          A.circlesStepScores = {};
          A.circlesLocked = false;
          A.circlesConversation = [];
          A.view = 'circles';
          // Reset the dedup guard so a fresh call goes through.
          // (_resumePromise is module-scoped; clearing localStorage + reload is the cleanest reset.)
        });

        // Reload so _resumePromise resets + tryResumeLatestSession runs on boot.
        await page.evaluate(() => {
          try { localStorage.removeItem('pmDrillState'); } catch (_) {}
        });
        await page.reload();

        // Wait for app boot + waitForAuth.
        await page.waitForFunction(
          () => window.AppState && !!window.AppState.accessToken,
          { timeout: 15_000 }
        );

        // Wait for the resume to settle into Phase 2 locked (current_phase=2 on the row).
        await page.waitForFunction(
          (sid) => {
            const A = window.AppState;
            return A && A.view === 'circles'
              && A.circlesPhase === 2
              && A.circlesSession && String(A.circlesSession.id) === String(sid);
          },
          sessionId,
          { timeout: 20_000 }
        );
      });

      await test.step('verify Phase 2 LOCKED variant rendered + circlesScoreResult is NULL (the bug condition)', async () => {
        await expect(page.locator(SEL.phase2Root)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator(SEL.lockedBanner)).toBeVisible();
        await expect(page.locator(SEL.goPhase3Btn)).toBeVisible(); // 回評分 button

        const state = await page.evaluate(() => ({
          phase: window.AppState.circlesPhase,
          scoreResult: window.AppState.circlesScoreResult,
          stepScoresKey: window.AppState.circlesStepScores
            && window.AppState.circlesStepScores.C1
            && window.AppState.circlesStepScores.C1.totalScore,
          locked: window.AppState.circlesLocked,
        }));
        expect(state.phase).toBe(2);
        expect(state.stepScoresKey).toBe(78);   // stepScores hydrated correctly
        expect(state.locked).toBe(true);        // lock state correct
        // ↓ THE BUG: scoreResult NOT derived from stepScores in auto-resume path
        expect(state.scoreResult).toBeNull();

        await page.screenshot({
          path: path.join(PNG_DIR, `R1-1-phase2-locked-before-click-${testInfo.project.name}.png`),
          fullPage: true,
        });
      });

      await test.step('click 回評分 → enters Phase 3 → loading spinner appears (THE STUCK STATE)', async () => {
        await page.locator(SEL.goPhase3Btn).click();
        await expect(page.locator(SEL.phase3Root)).toBeVisible({ timeout: 5_000 });
        await expect(page.locator(SEL.loadingSpinner)).toBeVisible({ timeout: 3_000 });
        await expect(page.locator(SEL.loadingTitle)).toHaveText(/正在生成評分/);

        // Score number should NOT appear (we expected the score to render immediately,
        // because step_scores[C1].totalScore is already 78 — but it does not).
        await expect(page.locator(SEL.phase3ScoreNum)).toHaveCount(0);

        await page.screenshot({
          path: path.join(PNG_DIR, `R1-2-phase3-spinner-stuck-${testInfo.project.name}.png`),
          fullPage: true,
        });
      });

      await test.step('wait 8 s — spinner is still visible (no API in flight, no resolution path)', async () => {
        // Watch for 8 seconds. The loading-step interval ticks every 5 s but the
        // spinner never resolves because no evaluate-step request was fired
        // (go-phase3 binding only does `circlesPhase = 3; render();`).
        await page.waitForTimeout(8_000);
        await expect(page.locator(SEL.loadingSpinner)).toBeVisible();
        await expect(page.locator(SEL.phase3ScoreNum)).toHaveCount(0);

        // Confirm: NO network request to /evaluate-step was made by the click handler.
        // (Phase 3 retry-button handler does fire it, but the "回評分" handler does not.)
        const stuckState = await page.evaluate(() => ({
          scoreResult: window.AppState.circlesScoreResult,
          loadingStep: window.AppState.circlesPhase3LoadingStep,
          phase3Error: window.AppState.circlesPhase3Error,
        }));
        expect(stuckState.scoreResult).toBeNull();   // still null → spinner stays
        expect(stuckState.phase3Error).toBeNull();   // no error path engaged either

        await page.screenshot({
          path: path.join(PNG_DIR, `R1-3-phase3-still-stuck-after-8s-${testInfo.project.name}.png`),
          fullPage: true,
        });
      });
    } finally {
      if (sessionId) await cleanupSession(page, sessionId);
    }
  });

  // ── Control: offcanvas-restore path should NOT stuck (restoreCirclesPhase1FromSession DOES set scoreResult) ──
  test('R2 (CONTROL): offcanvas-restore path → 回評分 → Phase 3 score renders (no spinner) — proves bug is auto-resume-only', async ({ page }, testInfo) => {
    test.slow();
    let sessionId;
    const qid = questionForTest(testInfo);
    const stepKey = 'C1';

    try {
      await test.step('seed scored Phase-2 session', async () => {
        await bootApp(page);
        await waitForAuth(page);
        sessionId = await createDraftSession(page, { questionId: qid, drillStep: stepKey });
        await seedScoredPhase2Session(page.request, sessionId, stepKey, fixtureStepScore());
      });

      await test.step('restore via window._loadCirclesSessionItem (offcanvas click path)', async () => {
        await page.waitForFunction(
          () => typeof window._loadCirclesSessionItem === 'function',
          { timeout: 10_000 }
        );
        await page.evaluate(() => {
          const A = window.AppState;
          A.circlesSession = null;
          A.circlesPhase = 0;
        });
        await page.evaluate(async ({ sid, step }) => {
          await window._loadCirclesSessionItem({ id: sid, mode: 'drill', drill_step: step });
        }, { sid: sessionId, step: stepKey });
        await page.waitForFunction(
          (sid) => {
            const A = window.AppState;
            return A && A.view === 'circles' && A.circlesPhase === 1
              && A.circlesSession && String(A.circlesSession.id) === String(sid);
          },
          sessionId,
          { timeout: 10_000 }
        );
      });

      await test.step('navigate to Phase 2 locked variant + verify circlesScoreResult IS set (offcanvas-restore branch ok)', async () => {
        await page.evaluate(() => {
          window.AppState.circlesPhase = 2;
          window.render && window.render();
        });
        await expect(page.locator(SEL.phase2Root)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator(SEL.lockedBanner)).toBeVisible();

        const state = await page.evaluate(() => ({
          scoreResult: window.AppState.circlesScoreResult,
          scoreResultTotal: window.AppState.circlesScoreResult && window.AppState.circlesScoreResult.totalScore,
        }));
        // CONTROL assertion: offcanvas-restore path correctly sets circlesScoreResult.
        expect(state.scoreResult).not.toBeNull();
        expect(state.scoreResultTotal).toBe(78);

        await page.screenshot({
          path: path.join(PNG_DIR, `R2-1-phase2-locked-offcanvas-${testInfo.project.name}.png`),
          fullPage: true,
        });
      });

      await test.step('click 回評分 → Phase 3 score renders WITHOUT spinner (control passes)', async () => {
        await page.locator(SEL.goPhase3Btn).click();
        await expect(page.locator(SEL.phase3Root)).toBeVisible({ timeout: 5_000 });

        // Score number should appear immediately (renderPhase3Score path).
        await expect(page.locator(SEL.phase3ScoreNum)).toBeVisible({ timeout: 5_000 });
        // Spinner should NOT appear in the score variant.
        await expect(page.locator(SEL.loadingSpinner)).toHaveCount(0);

        await page.screenshot({
          path: path.join(PNG_DIR, `R2-2-phase3-score-renders-ok-${testInfo.project.name}.png`),
          fullPage: true,
        });
      });
    } finally {
      if (sessionId) await cleanupSession(page, sessionId);
    }
  });
});
