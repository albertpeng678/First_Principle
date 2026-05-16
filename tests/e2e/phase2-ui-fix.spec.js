// @ts-check
// tests/e2e/phase2-ui-fix.spec.js
// Stage 1C Task 2 — RED phase E2E spec.
// Covers B5-AC1..AC6: qchip expand, aria, caret direction, 上一步 inline,
// and 3-site regression (normal / locked / conclusion).
//
// All specs are intentionally RED until T4 (UI fix) lands:
//   - qchip-panel locator not found (panel HTML missing)
//   - .phase-back-row still present in DOM (上一步 not yet inline in input-bar__row)
//   - caret is ph-caret-right (B5-BUG-1 — should become ph-caret-down after T4)

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');
const { CirclesPhase2QchipComponent } = require('../page-objects/circles-phase2-qchip.component');
const factory = require('../factories/circles-phase1.factory');

// ── Navigation helpers ────────────────────────────────────────────────────────
//
// Boot pattern mirrors circles-gate.spec.js:
//   1. addInitScript clears localStorage (prevent stale resume)
//   2. stub GET session-list endpoints → prevent tryResume auto-navigate
//   3. goto('/') → wait for mode-selector
//   4. unrouteAll (real POSTs must flow)
//   5. page.evaluate → inject AppState + render()
//
// For Phase 2 we need circlesPhase=2 + circlesSession + circlesSelectedQuestion.
// We inject these directly, bypassing the full gate flow, because the gate
// calls real OpenAI (~10-25 s) and this spec targets UI layout, not gate logic.
//
// cleanupTracker.track('circles', id) is called whenever a real session is created.

async function bootBase(page) {
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

// Helper: inject Phase 2 normal state (no score yet, no conclusion mode).
// Uses a synthetic in-memory session object — no DB session created.
async function enterPhase2Normal(page, cleanupTracker) {
  await bootBase(page);

  // Create a real circles session so cleanup works and circlesSession.id exists.
  // Inject Phase 1 drill C1 state first to get a session created.
  const c1 = factory.quality().C1;
  const sid = await page.evaluate(async (qualityC1) => {
    const A = window.AppState;
    if (!A || !window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) return null;
    const q = window.CIRCLES_QUESTIONS[0];

    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1;
    A.circlesSimStep          = 0;
    A.circlesSession          = null;
    A.circlesGateResult       = null;
    A.circlesGateLoading      = false;
    A.gateInflight            = false;
    A.circlesLocked           = false;
    A.circlesStale            = false;
    A.view                    = 'circles';

    if (!A.circlesFrameworkDraft) A.circlesFrameworkDraft = {};
    A.circlesFrameworkDraft['C1'] = qualityC1;

    // Create a session via ensureCirclesDraftSession() (used by submitFrameworkToGate).
    // We call it directly to get a real session ID for cleanup.
    // If Supabase auth token has not yet restored async (CDN load timing), the API
    // call will use guest path and may fail — fall back to a synthetic session so
    // the Phase 2 render condition (circlesPhase===2 && circlesSession && selectedQ) is met.
    try {
      await window.ensureCirclesDraftSession();
    } catch (_) {}
    if (!A.circlesSession || !A.circlesSession.id) {
      A.circlesSession = { id: 'normal-test-session-synthetic' };
    }

    // Now transition AppState to Phase 2 (normal branch, no score).
    A.circlesPhase            = 2;
    A.circlesConversation     = [
      {
        role: 'coach',
        text: '請描述你的目標用戶群體。',
        hint: null,
        example: null,
      },
    ];
    A.circlesStepScores       = {};          // no score → normal branch
    A.circlesPhase2ConclusionMode = false;
    A.circlesPhase2Streaming  = false;
    A.circlesPhase2StreamError = false;

    window.render();

    return A.circlesSession && A.circlesSession.id;
  }, c1);

  // Only track real (non-synthetic) sessions for cleanup.
  if (sid && sid !== 'normal-test-session-synthetic' && cleanupTracker) {
    cleanupTracker.track('circles', sid);
  }

  // Wait for Phase 2 container to appear.
  await page.locator('[data-view="circles"][data-phase="2"]').waitFor({ state: 'visible', timeout: 10_000 });
}

// Helper: inject Phase 2 locked state (circlesStepScores[stepKey].totalScore set).
// No real session created — spec only needs UI structure.
async function enterPhase2Locked(page) {
  await bootBase(page);

  await page.evaluate(() => {
    const A = window.AppState;
    if (!A || !window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) return;
    const q = window.CIRCLES_QUESTIONS[0];

    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 2;
    A.circlesSimStep          = 0;
    A.circlesSession          = { id: 'locked-test-session' };
    A.circlesConversation     = [
      { role: 'coach', text: '請描述你的目標用戶群體。', hint: null, example: null },
      { role: 'user',  text: '20-35 歲上班族女性。' },
    ];
    // Set step score so renderCirclesPhase2 routes to renderCirclesPhase2Locked.
    A.circlesStepScores       = { C1: { totalScore: 72, dimensions: {} } };
    A.circlesScoreResult      = { totalScore: 72 };
    A.circlesPhase2ConclusionMode = false;
    A.circlesPhase2Streaming  = false;
    A.view                    = 'circles';

    window.render();
  });

  await page.locator('[data-view="circles"][data-phase="2"]').waitFor({ state: 'visible', timeout: 10_000 });
}

// Helper: inject Phase 2 conclusion mode.
async function enterPhase2Conclusion(page) {
  await bootBase(page);

  await page.evaluate(() => {
    const A = window.AppState;
    if (!A || !window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) return;
    const q = window.CIRCLES_QUESTIONS[0];

    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 2;
    A.circlesSimStep          = 0;
    A.circlesSession          = { id: 'conclusion-test-session' };
    A.circlesConversation     = [
      { role: 'coach', text: '請描述你的目標用戶群體。', hint: null, example: null },
      { role: 'user',  text: '20-35 歲上班族女性。' },
      { role: 'coach', text: '很好，再細化一下。', hint: null, example: null },
      { role: 'user',  text: '通勤族，廣告敏感度高。' },
      { role: 'coach', text: '不錯，準備整理結論。', hint: null, example: null },
    ];
    A.circlesStepScores       = {};          // no score — not locked
    A.circlesPhase2ConclusionMode = true;   // conclusion branch
    A.circlesPhase2ConclusionDraft = '';
    A.circlesPhase2ExampleOpen = false;
    A.circlesPhase2Streaming  = false;
    A.view                    = 'circles';

    window.render();
  });

  await page.locator('[data-view="circles"][data-phase="2"]').waitFor({ state: 'visible', timeout: 10_000 });
}

// ── Suite 1: qchip expand panel (B5-AC1..AC4) — normal Phase 2 ──────────────

test.describe('B5 — qchip expand panel (normal Phase 2)', () => {
  test('AC1: default closed — panel hidden, caret-down, aria-expanded=false', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: qchip-panel HTML not yet emitted → hidden assertion will fail if
    // panel element is absent; caret will be ph-caret-right (BUG-1).
    await expect(q.qchipPanel).toBeHidden();
    expect(await q.caretDirection()).toBe('down');
    expect(await q.ariaExpanded()).toBe('false');
  });

  test('AC2: click qchip → panel visible, .is-open on btn, aria=true', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: open() will throw because qchipPanel toBeVisible times out (panel absent).
    await q.open();
    expect(await q.ariaExpanded()).toBe('true');
    await expect(q.qchipBtn).toHaveClass(/is-open/);
    await expect(q.panelType).toBeVisible();
    await expect(q.panelBody).toBeVisible();
  });

  test('AC3: click close → panel hidden again, aria=false', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: will fail at open() step before close can run.
    await q.open();
    await q.close();
    expect(await q.ariaExpanded()).toBe('false');
  });

  test('AC4: toggle — second click collapses panel', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: toggleViaCaret() × 2 will not collapse a panel that never opened.
    await q.toggleViaCaret();   // open
    await q.toggleViaCaret();   // close
    await expect(q.qchipPanel).toBeHidden();
  });

  test('AC4b: render() after send resets panel to closed', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: open() fails because panel HTML is missing.
    await q.open();
    // Send a message → render() re-fires → panel should re-collapse.
    await q.inputBarTextarea.fill('測試訊息至少五字');
    await page.locator('[data-phase2="send"]').click();
    await expect(q.qchipPanel).toBeHidden({ timeout: 5_000 });
  });
});

// ── Suite 2: 上一步 button inline in input-bar__row (B5-AC1 / layout fix) ───

test.describe('B5 — 上一步 button inline in input-bar__row', () => {
  test('上一步 is inside .input-bar__row (no .phase-back-row wrapper)', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: .phase-back-row still exists in DOM before T4 fix.
    expect(await q.isPhaseBackRowAbsent()).toBe(true);
    // RED: first child of input-bar__row will be textarea, not the back button.
    const firstChild = q.inputBarRow.locator('> *').first();
    await expect(firstChild).toHaveAttribute('data-phase2', 'back');
  });

  test('上一步 Y aligns with textarea (delta ≤ 4px — same row)', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: back button lives in phase-back-row above input-bar, Y delta will be >> 4.
    const delta = await q.backButtonYDelta();
    expect(delta).not.toBeNull();
    expect(delta).toBeLessThanOrEqual(4);
  });

  test('click 上一步 → navigates back to Phase 1', async ({ page, cleanupTracker }) => {
    await enterPhase2Normal(page, cleanupTracker);
    const q = new CirclesPhase2QchipComponent(page);
    await q.inputBarBackBtn.click();
    // Phase 1 uses data-circles-phase="1" (not data-phase="1") per app.js render.
    await expect(page.locator('[data-view="circles"][data-circles-phase="1"]')).toBeVisible({ timeout: 5_000 });
  });
});

// ── Suite 3: B5-AC6 — 3-site regression guard ────────────────────────────────

test.describe('B5-AC6 — qchip + panel wired in ALL 3 render paths', () => {
  test('locked branch: caret is caret-down (NOT caret-right regression) + panel toggles', async ({ page }) => {
    await enterPhase2Locked(page);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: caret will be ph-caret-right (BUG-1 present in locked branch too).
    expect(await q.caretDirection()).toBe('down');
    // RED: qchipPanel absent → open() times out.
    await q.open();
    await expect(q.qchipPanel).toBeVisible();
  });

  test('conclusion branch: qchip renders + caret-down + panel toggles', async ({ page }) => {
    await enterPhase2Conclusion(page);
    const q = new CirclesPhase2QchipComponent(page);
    // RED: caret will be ph-caret-right + panel absent in conclusion branch.
    expect(await q.caretDirection()).toBe('down');
    await q.open();
    await expect(q.qchipPanel).toBeVisible();
  });
});
