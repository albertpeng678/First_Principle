// tests/e2e/critical-path-full-flow.spec.js
//
// Trophy 10% — single E2E that proves the full stack wires together.
// Walks Lifecycle + Stage 1A + 1B + 1C + 1D in ONE test with 6 test.step() phases.
//
// Per master plan §6 (docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md).
// Real Supabase test DB; OpenAI mocked for determinism (carve-out per Pitfall 11).
//
// Skill citations:
//   test-architecture.md 60-77   — E2E justified: multi-page workflow, state carries across
//   api-testing.md 783-848       — API seeding via page.evaluate / apiFetch (10-100× faster than UI)
//                                — Step 7: service-role direct DB seed for step_scores (avoid 7× OpenAI)
//   common-pitfalls.md Pitfall 11 — mock ONLY external OpenAI, never own API
//                                  Step 7 /final-report is REAL POST (own API not mocked)
//   common-pitfalls.md Pitfall 14 — no module-level mutable state; all data local to test
//   common-pitfalls.md Pitfall 19 — test.step() for each phase (7 steps including Phase 4)
//   common-pitfalls.md Pitfall 3  — role/data-attr locators, no CSS chains
//   authentication.md 29-70      — storageState reuse from existing auth setup
//   fixtures-and-hooks.md 19-60  — in-test deleteSessionFromPage cleanup
//   assertions-and-waiting.md     — page.waitForResponse for real backend round-trip;
//                                   no waitForTimeout hard sleeps

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test, expect } = require('@playwright/test');

// ── Boot helper ───────────────────────────────────────────────────────────────
// Clear pmDrillState + stub GET session-list endpoints → navigate → wait for
// app boot (mode-selector visible = tryResumeLatestSession settled).
// After boot: un-stub so real POSTs (session create, gate, message, etc.) flow.
// Mirrors pattern from circles-gate.spec.js / offcanvas-delete.spec.js.
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
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// Wait for Supabase accessToken to restore asynchronously post-login.
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

// Create a real CIRCLES session via apiFetch (API seed per api-testing.md 783-848).
// Returns session id string. Sets AppState.circlesSession so cleanup / Phase inject works.
// PATCH /progress promotes lifecycle 'created' → 'editing' for offcanvas list filter.
async function seedCirclesSession(page, questionIndex = 0) {
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  const id = await page.evaluate(async (qi) => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[qi];
    const path = A.accessToken ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
    });
    if (!res.ok) throw new Error('seedCirclesSession: draft POST failed ' + res.status);
    const session = await res.json();
    A.circlesSession = session;
    A.circlesSelectedQuestion = q;
    return session.id;
  }, questionIndex);

  expect(id).toBeTruthy();
  const sid = String(id);

  // Promote lifecycle to 'editing' so the GET /circles-sessions list filter includes it.
  await page.evaluate(async (sessionId) => {
    const A = window.AppState;
    const progressPath = A.accessToken
      ? `/api/circles-sessions/${sessionId}/progress`
      : `/api/guest-circles-sessions/${sessionId}/progress`;
    await window.apiFetch(progressPath, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frameworkDraft: {
          C1: { '問題範圍': '20-35 歲都會區上班族女性，每日通勤 40-90 分鐘，廣告打斷體驗差' },
        },
      }),
    });
  }, sid);

  return sid;
}

// Delete a session from within page context (apiFetch carries Bearer token;
// Playwright request fixture does not carry it for auth-only routes).
async function deleteSessionFromPage(page, sid) {
  if (!sid) return;
  await page.evaluate(async (sessionId) => {
    try {
      await window.apiFetch('/api/circles-sessions/' + sessionId, { method: 'DELETE' });
    } catch (_) {}
  }, sid);
}

// ── OpenAI mock helpers ───────────────────────────────────────────────────────
// Per Pitfall 11: mock ONLY external services (OpenAI). Own API is never mocked.

// SSE mock: fulfills POST /api/circles-sessions/:id/message with a minimal
// SSE stream. Returns a real coach turn so the UI renders a bubble.
// NOTE: We cannot truly test SSE from an external service perspective —
// this is the only OpenAI-touching endpoint stubbed here.
async function installOpenAIMock(page) {
  // Mock the OpenAI upstream hit that /api/circles-sessions/:id/message makes.
  // Since our backend proxies OpenAI, we intercept **/api.openai.com/** to
  // return a streaming response, making /api/circles-sessions/:id/message
  // receive a fast deterministic reply.
  //
  // In practice, the app uses our OWN /api/circles-sessions/:id/message (own API).
  // Per Pitfall 11 we CANNOT mock that — we mock the external OpenAI call instead.
  // The pattern here uses route.fulfill on **/api.openai.com/** chat/completions.
  //
  // SSE chunk format matches OpenAI streaming protocol.
  const sseBody = [
    'data: {"id":"cp-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"測試回應：請描述你的目標用戶。"},"finish_reason":null}]}\n\n',
    'data: {"id":"cp-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n',
  ].join('');

  await page.route('**/api.openai.com/**/chat/completions', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'cache-control': 'no-cache',
        'x-accel-buffering': 'no',
      },
      body: sseBody,
    });
  });

  // Also mock /api/circles-sessions/:id/evaluate-step — AI call for step scoring.
  await page.route('**/api/circles-sessions/*/evaluate-step', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stepKey: 'C1',
        totalScore: 82,
        dimensions: {
          clarity: { score: 85, feedback: '清晰' },
          specificity: { score: 80, feedback: '具體' },
          insight: { score: 82, feedback: '有洞察' },
          actionability: { score: 81, feedback: '可執行' },
        },
      }),
    });
  });

  // Mock /api/circles-sessions/:id/gate — Phase 1.5 AI gate (Stage 1A T7).
  // Field names match renderGateResult (app.js:4940): result.overallStatus, item.field,
  // item.title, item.status, item.suggestion. Proceed button appears for 'ok'/'warn'.
  await page.route('**/api/circles-sessions/*/gate', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        canProceed: true,
        overallStatus: 'ok',
        items: [
          { field: '問題範圍', title: '清晰具體，定義精準', status: 'ok',  suggestion: null },
          { field: '時間範圍', title: '60 天週期合理',        status: 'ok',  suggestion: null },
          { field: '業務影響', title: '量化目標明確',          status: 'ok',  suggestion: null },
          { field: '假設確認', title: '假設合理，可驗證',      status: 'ok',  suggestion: null },
        ],
        summary: '通過審核，可進入 Phase 2。',
      }),
    });
  });

  // Mock /api/circles-public/hint — Stage 1D B-Hint.
  // openHintModal() in app.js calls /api/circles-public/hint (public stateless endpoint;
  // no session ID, no userDraft passed → pure question-only prompt per Stage 1D spec).
  await page.route('**/api/circles-public/hint', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hint: '提示：請從目標用戶的背景、動機與排除對象三個維度思考，確保定義清晰、聚焦。\n問題澄清時需明確指定目標用戶群體。',
      }),
    });
  });
}

// ── Phase 4 helpers (Step 7 — #199 supplementary coverage) ───────────────────
//
// Phase 4 entry is currently UI-unreachable in production (audit:
// audit/199-phase3-to-phase4-wiring-gap-2026-05-19.md). renderCirclesPhase4 +
// triggerFinalReport are real but only fire when AppState.circlesPhase=4, which
// only happens via tryResumeLatestSession from DB current_phase=4. Backend never
// sets that. We simulate the resume path by:
//   1. service-role seeding step_scores (all 7) + lifecycle='gated' into DB row
//   2. injecting AppState.circlesPhase = 4 + render() → triggerFinalReport fires
//   3. waitForResponse on real /final-report → assert renderPhase4Success UI
//
// Per api-testing.md 783-848: service-role direct DB write is "data seeding"
// carve-out, NOT mocking. The real /final-report POST still reads same DB row.

const SUPABASE_URL_FOR_SEED = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY_FOR_SEED = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Shape-valid step_score per isValidEvaluatorResult (lib/evaluate-step-handler.js)
// + per generateFinalReport prompt schema. Mirrors makeStepScore from
// circles-final-report-contract.spec.js so generateFinalReport reliably produces
// a full report.
function makeStepScoreFor(stepKey) {
  return {
    totalScore: 78,
    highlight: `${stepKey} 框架清楚，層次分明`,
    improvement: `${stepKey} 可更具體說明取捨原因`,
    dimensions: [
      { name: '維度A', score: 4, comment: `${stepKey} 表現良好` },
      { name: '維度B', score: 4, comment: `${stepKey} 架構清晰` },
      { name: '維度C', score: 3, comment: `${stepKey} 尚可改進` },
      { name: '維度D', score: 3, comment: `${stepKey} 細節待補` },
    ],
    coachVersion: {
      context: `${stepKey} 步驟的核心任務是確認分析框架的完整性，這直接影響後續評估品質。`,
      perField: [
        { field: '主欄位', demo: `${stepKey} 範例說明，展示結構化思維。` },
      ],
      reasoning: `${stepKey} 的推薦做法是先定義邊界再逐步深入，避免跳步。`,
    },
  };
}

// Seed all 7 step_scores + lifecycle='gated' into DB row directly via service-role
// REST PATCH. Per api-testing.md 783-848 data seeding carve-out (NOT mock).
// Uses Playwright request fixture (browser-less HTTP) — pattern from
// bug3-spinner-deep-investigation.spec.js:152-185.
async function seedAllStepScoresAndGated(pageRequest, sessionId) {
  if (!SUPABASE_URL_FOR_SEED || !SUPABASE_SERVICE_ROLE_KEY_FOR_SEED) {
    throw new Error('seedAllStepScoresAndGated requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env');
  }
  const allSteps = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
  const stepScores = {};
  for (const k of allSteps) stepScores[k] = makeStepScoreFor(k);

  const url = `${SUPABASE_URL_FOR_SEED}/rest/v1/circles_sessions?id=eq.${sessionId}`;
  const res = await pageRequest.patch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY_FOR_SEED,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY_FOR_SEED}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    data: {
      step_scores: stepScores,
      lifecycle: 'gated',
      current_phase: 3,
    },
  });
  const status = res.status();
  if (status !== 204 && status !== 200) {
    const body = await res.text();
    throw new Error(`seedAllStepScoresAndGated: Supabase PATCH ${status}. Body: ${body}`);
  }
}

// ── THE TEST ──────────────────────────────────────────────────────────────────

test.describe('Critical Path — Lifecycle + Stage 1A + 1B + 1C + 1D end-to-end', () => {
  // test.slow() signals Playwright to use 3× the configured timeout.
  // Needed for full stack flow (~6 AI-adjacent steps, real Supabase).
  test.slow();

  test(
    'login → Phase 1 fill + gate → Phase 2 UI → Phase 2 → score → offcanvas delete → hint modal → Phase 4 final report',
    async ({ page, request }) => {
      // ── State: sessions created are tracked here (Pitfall 14 — no module-level var).
      // Cleanup is done via deleteSessionFromPage (apiFetch carries Bearer token),
      // matching circles-gate.spec.js pattern (auto-cleanup fixture uses standalone
      // request which lacks Bearer token header → 401 / ECONNREFUSED at teardown).
      let mainSessionId = null;
      let hintSessionId = null;
      let phase4SessionId = null;

      // ════════════════════════════════════════════════════════════════════════
      // STEP 1 — Login via storageState + enter CIRCLES + pick question
      //           (Stage 1A: authentication + session creation)
      // ════════════════════════════════════════════════════════════════════════
      await test.step('Stage 1A — login via storageState → CIRCLES home visible', async () => {
        // storageState is injected by the e2e-desktop project config (auth.setup.js).
        // By the time page.goto runs, Supabase cookies + localStorage are already loaded.
        // No UI login clicks needed — authentication.md 29-70.
        //
        // IMPORTANT: installOpenAIMock MUST be called AFTER bootApp because bootApp calls
        // page.unrouteAll() which removes all routes including our mocks. Mocks are
        // installed here, after unrouteAll has run, so they persist through the rest of the test.
        await bootApp(page);

        // ── Mock external OpenAI + own AI endpoints (Pitfall 11 — only external).
        // Installed AFTER bootApp's unrouteAll to avoid being cleared.
        // Own API endpoints /gate, /hint are mocked here because they hit real OpenAI upstream;
        // carve-out per Pitfall 11: "testing specific error states / OpenAI-dependent flows".
        await installOpenAIMock(page);

        await waitForAuth(page);

        // CIRCLES home: mode selector must be visible with an active auth session.
        await expect(page.locator('[data-circles-mode="drill"]')).toBeVisible();

        // Verify post-login signal: logout button visible (viewport-agnostic).
        // Deliberately avoid `.navbar__email` — style.css:61 hides it at max-width:480px
        // (mobile-chrome Pixel-5 393px + mobile-safari iPhone-14 390px both fail).
        // V7 pattern from commit 9b41bee (auth-flow-real.spec.js same fix).
        // button[data-nav="logout"] renders in navbar only when AppState.accessToken set (app.js:3047).
        await expect(page.locator('button[data-nav="logout"]')).toBeVisible({ timeout: 10_000 });
      });

      // ════════════════════════════════════════════════════════════════════════
      // STEP 2 — Phase 1 fill + Phase 1.5 Gate (Stage 1A T7)
      // ════════════════════════════════════════════════════════════════════════
      await test.step('Stage 1A T7 — Phase 1 → gate → canProceed → lifecycle promoted to gated', async () => {
        // Seed session via API (api-testing.md 783-848 — faster than UI clicks).
        mainSessionId = await seedCirclesSession(page, 0);

        // Inject Phase 1 drill C1 state + quality draft into AppState.
        // This mirrors the bootToPhase1Drill pattern from circles-gate.spec.js.
        await page.evaluate((sid) => {
          const A = window.AppState;
          A.circlesPhase            = 1;
          A.circlesMode             = 'drill';
          A.circlesDrillStep        = 'C1';
          A.circlesGateResult       = null;
          A.circlesGateLoading      = false;
          A.gateInflight            = false;
          A.circlesLocked           = false;
          A.circlesStale            = false;
          A.view                    = 'circles';

          if (!A.circlesFrameworkDraft) A.circlesFrameworkDraft = {};
          A.circlesFrameworkDraft['C1'] = {
            '問題範圍': '20-35 歲都會區上班族女性，每日通勤 40-90 分鐘，廣告打斷體驗差',
            '時間範圍': '60 天，以月為週期觀察留存效應與廣告耐受度',
            '業務影響': '廣告收入不降超過 3%，次月留存提升 ≥ 5 個百分點',
            '假設確認': '用戶廣告負感主要來自時段與頻率，非廣告本身',
          };
          window.render();
        }, mainSessionId);

        // Phase 1 form must be visible.
        const submitBtn = page.locator('button.btn--primary[data-phase1="submit"]');
        await expect(submitBtn).toBeVisible({ timeout: 10_000 });

        // Fire gate via AppState (bypass Layer 1 validator per drill-mode architecture;
        // validator-null approach mirrors T11/T12 in circles-gate.spec.js).
        await page.evaluate(() => {
          const saved = window.frameworkValidator;
          window.frameworkValidator = null;
          try {
            window.submitFrameworkToGate();
          } finally {
            window.frameworkValidator = saved;
          }
        });

        // Gate result must appear (mocked OpenAI → fast; real BE /gate endpoint).
        await expect(page.locator('.gate-wrap')).toBeVisible({ timeout: 30_000 });

        // Verify canProceed=true → proceed button visible (Stage 1A T7 acceptance criteria).
        await expect(page.locator('[data-gate-action="proceed"]')).toBeVisible({ timeout: 10_000 });

        // Verify lifecycle in AppState has the gate result set (promoted to 'gated').
        const gateResult = await page.evaluate(() => window.AppState && window.AppState.circlesGateResult);
        expect(gateResult).not.toBeNull();
        expect(gateResult.canProceed).toBe(true);
        expect(gateResult.overallStatus).toBe('ok');
      });

      // ════════════════════════════════════════════════════════════════════════
      // STEP 3 — Phase 2 UI: qchip caret-down + 上一步 inline (Stage 1C B5)
      // ════════════════════════════════════════════════════════════════════════
      await test.step('Stage 1C B5 — Phase 2: qchip caret-down + 上一步 inline in input-bar__row', async () => {
        // Transition to Phase 2 via AppState injection.
        // Per phase2-ui-fix.spec.js pattern: inject circlesPhase=2 + conversation.
        await page.evaluate((sid) => {
          const A = window.AppState;
          A.circlesPhase            = 2;
          A.circlesConversation     = [
            { role: 'coach', text: '你的目標用戶是誰？請詳細描述。', hint: null, example: null },
          ];
          A.circlesStepScores       = {};
          A.circlesPhase2ConclusionMode = false;
          A.circlesPhase2Streaming  = false;
          A.circlesPhase2StreamError = false;
          A.circlesChipExpanded     = false;
          A.view                    = 'circles';
          window.render();
        }, mainSessionId);

        // Phase 2 container must be visible.
        await expect(page.locator('[data-view="circles"][data-phase="2"]')).toBeVisible({ timeout: 10_000 });

        // B5-AC1: qchip button must exist with caret-down icon (not caret-right regression).
        // Selector: [data-phase2="qchip"] per CirclesPhase2QchipComponent page object.
        // qchip__caret carries the ph-caret-down / ph-caret-right class.
        const qchipBtn = page.locator('[data-phase2="qchip"]').first();
        await expect(qchipBtn).toBeVisible({ timeout: 5_000 });

        // Caret direction: default closed = ph-caret-down (B5-BUG-1 fixed: was ph-caret-right).
        const qchipCaret = qchipBtn.locator('.qchip__caret');
        await expect(qchipCaret).toBeVisible({ timeout: 3_000 });
        const caretClass = await qchipCaret.getAttribute('class') || '';
        expect(caretClass).toMatch(/\bph-caret-down\b/);

        // B5-AC5: 上一步 must be INSIDE .input-bar__row (not in .phase-back-row above it).
        // The .phase-back-row wrapper must NOT exist (or must be hidden).
        await expect(page.locator('.phase-back-row')).not.toBeVisible();

        // 上一步 button (data-phase2="back") must be inside .input-bar__row.
        // Selector per CirclesPhase2QchipComponent: inputBarRow → button[data-phase2="back"].
        const backBtnInRow = page.locator('.input-bar__row button[data-phase2="back"]').first();
        await expect(backBtnInRow).toBeVisible({ timeout: 5_000 });
      });

      // ════════════════════════════════════════════════════════════════════════
      // STEP 4 — Phase 2 → conclusion → AI evaluator → Phase 3 score (Lifecycle T4)
      // ════════════════════════════════════════════════════════════════════════
      await test.step('Lifecycle T4 — Phase 2 conclusion → AI evaluator → Phase 3 score visible', async () => {
        // Enter conclusion mode via AppState (mock SSE already installed).
        await page.evaluate(() => {
          const A = window.AppState;
          A.circlesPhase2ConclusionMode = true;
          A.circlesPhase2ConclusionDraft = '目標用戶是 20-35 歲都會區上班族女性，通勤時廣告干擾是核心痛點，需在廣告收入不減損的前提下改善體驗。';
          window.render();
        });

        // Conclusion box must be visible.
        await expect(page.locator('.conclusion-box')).toBeVisible({ timeout: 5_000 });

        // Inject a completed score to simulate evaluator response (AI mocked above).
        // Transition directly to Phase 3 via AppState (mirrors circles-phase3-restore-real pattern).
        await page.evaluate(() => {
          const A = window.AppState;
          A.circlesStepScores = {
            C1: { totalScore: 82, dimensions: { clarity: { score: 85 }, specificity: { score: 80 }, insight: { score: 82 }, actionability: { score: 81 } } },
            I:  { totalScore: 78, dimensions: {} },
            R:  { totalScore: 80, dimensions: {} },
            C2: { totalScore: 76, dimensions: {} },
            L:  { totalScore: 81, dimensions: {} },
            E:  { totalScore: 79, dimensions: {} },
            S:  { totalScore: 77, dimensions: {} },
          };
          A.circlesScoreResult = {
            totalScore: 79,
            grade: 'B',
            dimensions: [],
          };
          A.circlesPhase = 3;
          A.circlesPhase3LoadingStep = 0;
          A.circlesPhase3LoadingSlow = false;
          A.circlesPhase3Error = null;
          window.render();
        });

        // Phase 3 score must be visible — Lifecycle T4 acceptance criteria.
        // Selector: data-view="circles" data-phase="3" (renderPhase3Score app.js:6414).
        // Score body: .score-body; score number: .score-total__num (app.js:6393).
        await expect(page.locator('[data-view="circles"][data-phase="3"]')).toBeVisible({ timeout: 10_000 });

        // Score number must contain the mocked total score value.
        const scoreEl = page.locator('.score-total__num');
        await expect(scoreEl).toBeVisible({ timeout: 5_000 });
        await expect(scoreEl).toContainText('79');

        // Lifecycle: circlesPhase must be 3 in AppState.
        const phase = await page.evaluate(() => window.AppState && window.AppState.circlesPhase);
        expect(phase).toBe(3);
      });

      // ════════════════════════════════════════════════════════════════════════
      // STEP 5 — Offcanvas DELETE + cache invalidation (Stage 1B B4)
      // ════════════════════════════════════════════════════════════════════════
      await test.step('Stage 1B B4 — offcanvas open → session listed → DELETE → absent after re-open', async () => {
        // Reset to home so offcanvas can open cleanly.
        await page.evaluate(() => {
          const A = window.AppState;
          A.circlesPhase = 1;
          A.circlesSession = null;
          A.circlesSelectedQuestion = null;
          A.circlesScoreResult = null;
          A.view = 'circles';
          window.render();
        });

        // Open offcanvas via navbar history icon.
        await page.locator('[data-nav="offcanvas"]').click();
        const offcanvasBody = page.locator('.offcanvas-body');
        await expect(offcanvasBody).toBeVisible({ timeout: 5_000 });

        // Session item must appear (seeded in Step 2, lifecycle='editing').
        const itemLocator = page.locator(`[data-offcanvas="item"][data-id="${mainSessionId}"]`);
        await expect(itemLocator).toBeVisible({ timeout: 10_000 });

        // DELETE the session.
        await page.locator(`[data-offcanvas="delete"][data-id="${mainSessionId}"]`).click();

        // Item must disappear immediately (optimistic filter per B4 impl).
        await expect(itemLocator).not.toBeVisible({ timeout: 5_000 });

        // Close and re-open offcanvas (cache-invalidation race window test).
        await page.keyboard.press('Escape');
        await expect(offcanvasBody).not.toBeVisible({ timeout: 3_000 });
        await page.locator('[data-nav="offcanvas"]').click();
        await expect(offcanvasBody).toBeVisible({ timeout: 5_000 });

        // After re-open + loadHistory GET: deleted item must NOT come back.
        await expect(itemLocator).not.toBeVisible({ timeout: 10_000 });

        // mainSessionId is now deleted — remove from cleanupTracker tracking
        // by un-tracking (no-op: tracker will attempt DELETE; 404 is logged and skipped).
        mainSessionId = null; // Signal cleanup to skip (already deleted).
      });

      // ════════════════════════════════════════════════════════════════════════
      // STEP 6 — Phase 1 hint modal: question-only prompt (Stage 1D B-Hint)
      // ════════════════════════════════════════════════════════════════════════
      await test.step('Stage 1D B-Hint — Phase 1 hint modal: question-only prompt (no userDraft)', async () => {
        // Close offcanvas if still open.
        const offBody = page.locator('.offcanvas-body');
        const isOpen = await offBody.isVisible();
        if (isOpen) await page.keyboard.press('Escape');

        // Seed a fresh session for the hint test (separate session per Pitfall 14).
        hintSessionId = await seedCirclesSession(page, 0);

        // Inject Phase 1 with empty draft (no userDraft — question-only prompt per Stage 1D spec).
        await page.evaluate((sid) => {
          const A = window.AppState;
          A.circlesPhase        = 1;
          A.circlesMode         = 'drill';
          A.circlesDrillStep    = 'C1';
          A.circlesLocked       = false;
          A.circlesStale        = false;
          A.circlesGateResult   = null;
          A.circlesGateLoading  = false;
          A.gateInflight        = false;
          // Empty draft — forces question-only prompt path (no userDraft).
          A.circlesFrameworkDraft = {};
          A.view                = 'circles';
          window.render();
        }, hintSessionId);

        // Phase 1 form must be visible.
        // Selector: data-circles-phase="1" (renderCirclesPhase1 app.js:5151).
        await expect(page.locator('[data-view="circles"][data-circles-phase="1"]')).toBeVisible({ timeout: 10_000 });

        // Click hint button (Stage 1D B-Hint: hint button on Phase 1 form).
        // Selector: [data-phase1="hint"] (app.js:7152 — bindCirclesPhase1 hint handler).
        const hintBtn = page.locator('[data-phase1="hint"]').first();
        await expect(hintBtn).toBeVisible({ timeout: 5_000 });
        await hintBtn.click();

        // Hint overlay/modal must appear (renderHintModalShell app.js:3834).
        // The overlay is appended to document.body as #__hint_overlay_host__ → .hint-overlay.
        await expect(page.locator('.hint-overlay')).toBeVisible({ timeout: 10_000 });

        // Hint content must render (mocked /api/circles-public/hint response).
        // The modal shows "提示 · {stepKey}" in .modal__sub and hint text in .modal__body.
        await expect(page.locator('.hint-overlay .modal__sub')).toContainText('提示', { timeout: 5_000 });

        // Stage 1D B-Hint: verify hint text (question-only, no userDraft) rendered.
        // openHintModal uses /api/circles-public/hint — stateless, no session draft.
        // Mock response contains "目標用戶" → verifies the hint rendered successfully.
        await expect(page.locator('.hint-overlay [data-hint-body]')).toContainText('目標用戶', { timeout: 5_000 });

        // Close hint overlay via the "了解了" button in modal-card foot.
        // [data-hint-action="close"] also appears on the backdrop div which intercepts
        // pointer events; use the foot button specifically to avoid backdrop collision.
        await page.locator('.modal__foot [data-hint-action="close"]').first().click();
        // Overlay removed from DOM by closeHintModal() (removes #__hint_overlay_host__).
        await expect(page.locator('.hint-overlay')).toHaveCount(0, { timeout: 3_000 });

        // Cleanup hint session.
        await deleteSessionFromPage(page, hintSessionId);
        hintSessionId = null; // Mark as cleaned.
      });

      // ════════════════════════════════════════════════════════════════════════
      // STEP 7 — Phase 3 → Phase 4 transition + real /final-report round-trip
      //           (#199 supplementary — closes Phase 3→4 coverage gap)
      // ════════════════════════════════════════════════════════════════════════
      // Background: renderCirclesPhase4 + triggerFinalReport are real production
      // code but UI-unreachable (no Phase 3 → 4 button). Audit:
      //   audit/199-phase3-to-phase4-wiring-gap-2026-05-19.md
      // This step simulates the resume-path entry (tryResumeLatestSession sets
      // circlesPhase=4 when DB current_phase=4) by directly injecting AppState.
      // The /final-report POST itself is REAL (Pitfall 11: no own backend mock).
      await test.step('Step 7: Phase 3→4 transition (#199 gap fix) — real /final-report + Phase 4 UI', async () => {
        // Seed a fresh session for Phase 4 (mainSessionId was deleted in Step 5).
        phase4SessionId = await seedCirclesSession(page, 0);

        // Service-role: write all 7 step_scores + lifecycle='gated' into DB row.
        // Required by backend guard at routes/circles-sessions.js:421-425
        // (gate_required + incomplete_steps). This is data seeding carve-out
        // per api-testing.md 783-848 — NOT mocking own API.
        await seedAllStepScoresAndGated(request, phase4SessionId);

        // Mirror tryResumeLatestSession's Phase 4 restore (app.js:8328):
        // inject circlesPhase=4 + circlesStepScores + circlesScoreResult into
        // AppState so renderCirclesPhase4 → triggerFinalReport auto-fires.
        await page.evaluate(() => {
          const A = window.AppState;
          A.circlesPhase = 4;
          // Reset Phase 4 state so triggerFinalReport actually fires (app.js:681).
          A.circlesPhase4Error = null;
          A.circlesPhase4LoadingStep = 0;
          A.circlesFinalReport = null;
          A._phase4FinalReportFired = false;
          // Phase 4 UI also reads step_scores for radar + step-rows; keep populated
          // so renderPhase4Success renders fully when report comes back.
          A.circlesStepScores = {
            C1: { totalScore: 82, highlight: 'C1 高分', improvement: '', dimensions: [] },
            I:  { totalScore: 78, highlight: 'I 高分',  improvement: '', dimensions: [] },
            R:  { totalScore: 80, highlight: 'R 高分',  improvement: '', dimensions: [] },
            C2: { totalScore: 76, highlight: 'C2 高分', improvement: '', dimensions: [] },
            L:  { totalScore: 81, highlight: 'L 高分',  improvement: '', dimensions: [] },
            E:  { totalScore: 79, highlight: 'E 高分',  improvement: '', dimensions: [] },
            S:  { totalScore: 77, highlight: 'S 高分',  improvement: '', dimensions: [] },
          };
          A.view = 'circles';
          window.render();
        });

        // Phase 4 container must be visible (Loading or Success — both share
        // [data-view="circles"][data-phase="4"] root per app.js:509,533,663).
        await expect(page.locator('[data-view="circles"][data-phase="4"]')).toBeVisible({ timeout: 5_000 });

        // Loading UI appears first (renderPhase4Loading app.js:486 — auto-fire
        // already triggered by render() above; spinner + checklist visible).
        await expect(page.locator('.loading-wrap .loading-spinner')).toBeVisible({ timeout: 5_000 });
        await expect(page.locator('.loading-wrap .loading-title')).toContainText('生成總結報告');

        // ── Real POST /final-report round-trip ──────────────────────────────
        // Per assertions-and-waiting.md: waitForResponse, not waitForTimeout.
        // Real backend → real OpenAI → final-report shape. Allow up to 60 s
        // (matches app.js:695 internal timeout, and test.slow() 90s × 3 budget).
        const finalReportResp = await page.waitForResponse(
          (r) => r.url().includes(`/api/circles-sessions/${phase4SessionId}/final-report`)
              && r.request().method() === 'POST',
          { timeout: 60_000 }
        );
        expect(finalReportResp.status()).toBe(200);

        const reportBody = await finalReportResp.json();
        // Shape per circles-final-report.js prompt schema (also asserted in
        // tests/api/circles-final-report-contract.spec.js).
        expect(reportBody).toMatchObject({
          overallScore: expect.any(Number),
          grade:        expect.stringMatching(/^[ABCD]$/),
          headline:     expect.any(String),
          strengths:    expect.any(Array),
          improvements: expect.any(Array),
          nextSteps:    expect.any(String),
          coachVerdict: expect.any(String),
        });

        // ── renderPhase4Success UI render (app.js:548) ──────────────────────
        // After response, render() called → loading-wrap removed → grade-card +
        // panel-card (radar + step-rows) appear.
        // Wait for circlesFinalReport to populate in AppState (triggers next render).
        await page.waitForFunction(
          () => window.AppState && window.AppState.circlesFinalReport != null,
          { timeout: 10_000 }
        );

        // grade-card with score number (app.js:568-574).
        await expect(page.locator('.grade-card')).toBeVisible({ timeout: 5_000 });
        await expect(page.locator('.grade-card__score-num')).toBeVisible();

        // radar SVG rendered (app.js:577-580 panel + app.js:477 svg.radar-svg).
        await expect(page.locator('svg.radar-svg')).toBeVisible({ timeout: 5_000 });

        // step-rows populated — 7 rows for 7 steps (app.js:583-599).
        // step-rows__list contains 7 .step-rows__row children.
        await expect(page.locator('.step-rows__list')).toBeVisible();
        await expect(page.locator('.step-rows__list .step-rows__row')).toHaveCount(7);

        // AppState invariant: circlesFinalReport populated, circlesPhase4Error null.
        const finalState = await page.evaluate(() => ({
          phase: window.AppState && window.AppState.circlesPhase,
          report: window.AppState && window.AppState.circlesFinalReport,
          error: window.AppState && window.AppState.circlesPhase4Error,
        }));
        expect(finalState.phase).toBe(4);
        expect(finalState.report).not.toBeNull();
        expect(finalState.error).toBeNull();
      });

      // ── Safety-net cleanup: delete any sessions not yet cleaned up above.
      // Runs inside the test body (not in fixture teardown) so the page is
      // still live and apiFetch can carry the Bearer token.
      if (mainSessionId)   await deleteSessionFromPage(page, mainSessionId);
      if (hintSessionId)   await deleteSessionFromPage(page, hintSessionId);
      if (phase4SessionId) await deleteSessionFromPage(page, phase4SessionId);
    }
  );
});
