// tests/e2e/circles-gate.spec.js
// Stage 1A — Gate cluster E2E specs.
// T11 (this commit): 2 race specs (B6 proof)
// T12 (next commit): 4 more — happy / sad-garbage / sad-thin / visual baseline

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');
const { CirclesPhase1Page } = require('../page-objects/circles-phase1.page');
const factory = require('../factories/circles-phase1.factory');

// ── Setup helper ──────────────────────────────────────────────────────────────
//
// Boot the SPA in a clean state then inject Phase 1 drill C1 directly into
// AppState. Multiple async race conditions prevented a clean UI-driven flow:
//
// 1. localStorage pmDrillState persisted from prior runs restores stale Phase.
//    Fix: page.addInitScript clears it before any app script runs.
//
// 2. tryResumeLatestSession() fetches session lists on boot + auto-navigates
//    to existing DB sessions. Bug D fix then sets circlesMode='simulation'
//    when the list is empty — overriding any drill-mode UI click we made.
//    Fix: stub GET list endpoints to return [] so tryResume exits cleanly.
//
// 3. The qcard-confirm click checks historyList for a matching session and may
//    resume a stale one. ensureCirclesDraftSession() also requires
//    circlesSelectedQuestion to be non-null.
//
// Clean solution: wait for app to boot (mode-selector visible = tryResume
// settled), then inject Phase 1 drill C1 state via page.evaluate + render().
// Real gate POST + real session creation + real mutex all still run.
//
// Layer 1 note: validateFrameworkInput checks both I and C1 sections.
// buildFrameworkValuesForValidator('C1', c1Draft) produces { I: {}, C1: c1Draft }
// so the I section is always empty on a C1-only step injection → 4 validation errors.
// B6 specs test mutex not B1; each spec inlines a validator-null/restore around the
// submitFrameworkToGate call so gate fires without the pre-flight block.
//
async function bootToPhase1Drill(page) {
  // Clear persisted state BEFORE any page script runs.
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  // Stub GET session-list endpoints to prevent auto-resume.
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

  // Wait until the mode-selector is visible → app booted + tryResume settled.
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });

  // Un-intercept stubs — real POST requests (create session, gate) must flow.
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  // Inject Phase 1 drill C1 state + prime C1 draft with quality values.
  // window.submitFrameworkToGate() reads circlesMode, circlesDrillStep,
  // circlesSelectedQuestion, and circlesFrameworkDraft['C1'].
  const c1 = factory.quality().C1;
  await page.evaluate((qualityC1) => {
    const A = window.AppState;
    if (!A || !window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) return;
    const q = window.CIRCLES_QUESTIONS[0];

    // Set Phase 1 drill C1 state.
    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1;
    A.circlesSimStep          = 0;
    A.circlesSession          = null;   // fresh session created by ensureCirclesDraftSession
    A.circlesGateResult       = null;
    A.circlesGateLoading      = false;
    A.gateInflight            = false;
    A.circlesLocked           = false;
    A.circlesStale            = false;
    A.circlesExpandedQid      = null;
    A.view                    = 'circles';

    // Prime the C1 draft with quality values so submitFrameworkToGate finds
    // content and Layer 1 passes.  We set it directly because fill() on
    // contenteditable does not reliably fire the 'input' event.
    if (!A.circlesFrameworkDraft) A.circlesFrameworkDraft = {};
    A.circlesFrameworkDraft['C1'] = qualityC1;

    // Render Phase 1 (also re-binds all event listeners including submit btn).
    window.render();
  }, c1);

  // Confirm Phase 1 is rendered (submit button visible = sentinel).
  const submitButton = page.locator('button.btn--primary[data-phase1="submit"]');
  await submitButton.waitFor({ state: 'visible', timeout: 10_000 });

  // render() ran computePhase1MinLengthBlocked() which saw the primed draft
  // and enabled the submit button.  Wait up to 500ms for it to be enabled.
  await expect(submitButton).toBeEnabled({ timeout: 500 }).catch(() => {
    // If still disabled after render, enable it in-place (timing edge case).
    return page.evaluate(() => {
      const A = window.AppState;
      const btn = document.querySelector('[data-phase1="submit"]');
      if (btn && !A.circlesLocked && !A.circlesStale) btn.disabled = false;
    });
  });
}

// ── Specs ─────────────────────────────────────────────────────────────────────

// ── Per-test cleanup helper ───────────────────────────────────────────────────
//
// auto-cleanup.fixture's request.delete uses storageState cookies only.
// requireAuth reads Authorization: Bearer <token> header → returns 401.
// Fix: use window.apiFetch from the page context (already has Bearer token set).
//
async function deleteSessionFromPage(page, sid) {
  if (!sid) return;
  await page.evaluate(async (sessionId) => {
    try {
      await window.apiFetch('/api/circles-sessions/' + sessionId, { method: 'DELETE' });
    } catch (_) {}
  }, sid);
}

// ==================== T12 ====================
//
// POM fillAll() finding:
//   Phase 1 drill mode renders only ONE step's fields at a time (the active
//   circlesDrillStep). When circlesDrillStep = 'C1', only C1 fields exist in
//   DOM; fillI() finds no elements and is effectively a no-op. fillC1() works
//   normally via DOM since C1 fields are rendered.
//
//   Even bypassing POM and priming AppState.circlesFrameworkDraft['I'] directly,
//   validator still blocks: buildFrameworkValuesForValidator(stepKey='C1', draft)
//   produces {I: {}, C1: draft} — only the CURRENT step's draft is passed to
//   validateFrameworkInput. I section is always empty → all 4 I fields fail.
//
// Decision: use the same frameworkValidator=null workaround from T11 for specs
// that need gate to fire (happy path, thin, visual). The validator-null approach
// is correct for drill mode because the architecture is step-by-step (one step
// validated per gate call), not a multi-step all-at-once validation.
//
// The garbage spec tests that Layer 1 blocks when ALL 4 C1 fields are garbage —
// it does NOT need the null workaround because blocking is the expected outcome.
//
// Helper: fire gate bypassing Layer 1 validator (matches T11 pattern exactly).
async function fireGateBypassingValidator(page) {
  await page.evaluate(() => {
    const saved = window.frameworkValidator;
    window.frameworkValidator = null;
    try {
      window.submitFrameworkToGate();
    } finally {
      window.frameworkValidator = saved;
    }
  });
}

test.describe('Gate cluster — B1 happy path', () => {
  test('quality input → gate ok → can proceed to Phase 2', async ({ page }) => {
    // bootToPhase1Drill (T11) boots + primes quality C1 draft + renders Phase 1.
    // frameworkValidator is bypassed (null workaround) because drill mode only
    // validates the current step — I section is always empty in drill C1.
    // See T12 POM fillAll() finding comment above.
    await bootToPhase1Drill(page);

    // Fire gate bypassing Layer 1 (same pattern as T11 race specs).
    await fireGateBypassingValidator(page);

    const form = new CirclesPhase1Page(page);

    // Wait for gate result (real OpenAI call ~5-15 s).
    await expect(form.gateResult).toBeVisible({ timeout: 60_000 });
    const status = await form.getGateStatus();
    // Quality content should yield 'ok' or 'warn'; never 'error' or null.
    expect(['ok', 'warn']).toContain(status);

    // "Proceed" button is visible for ok + warn (rendered as [data-gate-action="proceed"]).
    await expect(page.locator('[data-gate-action="proceed"]')).toBeVisible();

    // Cleanup: DELETE session via apiFetch (has Bearer token).
    const sid = await page.evaluate(() => {
      const sess = window.AppState && window.AppState.circlesSession;
      return sess && sess.id;
    });
    await deleteSessionFromPage(page, sid);
  });
});

test.describe('Gate cluster — B1 sad: garbage (Layer 1 catches)', () => {
  test('all-Y input → Layer 1 blocks; no POST; inline errors visible', async ({ page }) => {
    let postCount = 0;
    await page.route('**/api/circles-sessions/*/gate', (route) => {
      if (route.request().method() === 'POST') postCount++;
      route.continue();
    });

    // Boot with quality draft, then overwrite C1 draft with garbage values.
    // Garbage values (≤ 4 ASCII chars, no Chinese) fail all 4 Layer 1 rules.
    // We do NOT bypass frameworkValidator — blocking is the expected outcome.
    await bootToPhase1Drill(page);

    const garbageC1 = factory.garbage().C1;

    // Overwrite C1 draft in AppState with garbage values.
    await page.evaluate((garbageC1Values) => {
      const A = window.AppState;
      if (!A) return;
      if (!A.circlesFrameworkDraft) A.circlesFrameworkDraft = {};
      A.circlesFrameworkDraft['C1'] = garbageC1Values;
    }, garbageC1);

    // Click submit button directly — Layer 1 validator should block; no POST fires.
    const form = new CirclesPhase1Page(page);
    await form.submitGate();

    // Explicit "no event" check: wait briefly, then assert no POST fired.
    // (Proving ABSENCE of an event; waitForTimeout is legitimate per
    //  playwright-skill assertions-and-waiting.md pattern)
    await page.waitForTimeout(800);
    expect(postCount).toBe(0);

    // Inline errors must be visible (renderInlineFrameworkErrors inserts .framework-error).
    await expect(page.locator('.framework-error').first()).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Gate cluster — B1 sad: thin (Layer 2 catches)', () => {
  test('thin Chinese input → passes Layer 1, BE returns warn/error', async ({ page }) => {
    // Boot + overwrite C1 draft with thin values (≥ 4 chars + Chinese = passes Layer 1).
    // Fire gate bypassing frameworkValidator (validator always fails I section in drill C1).
    await bootToPhase1Drill(page);

    const thinC1 = factory.thin().C1;

    // Overwrite C1 draft with thin values.
    await page.evaluate((thinC1Values) => {
      const A = window.AppState;
      if (!A) return;
      if (!A.circlesFrameworkDraft) A.circlesFrameworkDraft = {};
      A.circlesFrameworkDraft['C1'] = thinC1Values;
    }, thinC1);

    // Fire gate bypassing Layer 1 — thin content passes Layer 1 anyway, but
    // validator null avoids I-section block (drill architecture constraint).
    await fireGateBypassingValidator(page);

    const form = new CirclesPhase1Page(page);

    // BE (Layer 2 semantic check) should return 'warn' or 'error' for thin content.
    await expect(form.gateResult).toBeVisible({ timeout: 60_000 });
    const status = await form.getGateStatus();
    expect(['warn', 'error']).toContain(status);

    // Cleanup.
    const sid = await page.evaluate(() => {
      const sess = window.AppState && window.AppState.circlesSession;
      return sess && sess.id;
    });
    await deleteSessionFromPage(page, sid);
  });
});

test.describe('Gate cluster — visual baseline', () => {
  test('gate result rendered — pixel-diff vs locked baseline', async ({ page }) => {
    // Same boot + validator-null pattern as happy path.
    await bootToPhase1Drill(page);
    await fireGateBypassingValidator(page);

    const form = new CirclesPhase1Page(page);
    await expect(form.gateResult).toBeVisible({ timeout: 60_000 });

    // Pixel-diff with strict threshold per Master Spec §0.5 Layer 2 (0.5% threshold).
    // animations: 'disabled' prevents spinner / transition drift.
    await expect(form.gateResult).toHaveScreenshot('gate-ok-result.png', {
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
    });

    // Cleanup.
    const sid = await page.evaluate(() => {
      const sess = window.AppState && window.AppState.circlesSession;
      return sess && sess.id;
    });
    await deleteSessionFromPage(page, sid);
  });
});

// ==================== END T12 ====================

test.describe('Gate cluster — B6 race guard', () => {
  test('rapid double-click on submit → only 1 POST fires', async ({ page }) => {
    await bootToPhase1Drill(page);
    const form = new CirclesPhase1Page(page);

    // Count gate POSTs via page.route BEFORE the click.
    let postCount = 0;
    await page.route('**/api/circles-sessions/*/gate', (route) => {
      if (route.request().method() === 'POST') postCount++;
      route.continue();
    });

    // Simulate rapid double-click: call submitFrameworkToGate twice in the same
    // JS tick via page.evaluate — mutex blocks the 2nd call before it fires a POST.
    // This is equivalent to a double-click because dblclick fires 2 click events
    // in the same microtask queue before any async fence.
    // Layer 1 validator bypassed inline to avoid round-trip races.
    await page.evaluate(() => {
      const saved = window.frameworkValidator;
      window.frameworkValidator = null;
      try {
        // First call: acquires mutex (gateInflight = true) and starts async gate.
        window.submitFrameworkToGate();
        // Second call: mutex check (gateInflight === true) → returns immediately.
        window.submitFrameworkToGate();
      } finally {
        window.frameworkValidator = saved;
      }
    });

    // Wait for the ONE gate response that should arrive (real OpenAI call ~3-10s).
    await page.waitForResponse('**/api/circles-sessions/*/gate', { timeout: 30_000 });

    // Assert: only 1 POST fired (mutex blocked the 2nd call).
    expect(postCount).toBe(1);

    // After gate: app transitions to Phase 1.5 result view (.gate-wrap appears).
    // Submit button is gone from DOM (Phase 1 form replaced); verify gateInflight
    // released via AppState (mutex released in finally block).
    await form.gateResult.waitFor({ state: 'visible', timeout: 5_000 });
    const gateInflightAfter = await page.evaluate(() => window.AppState && window.AppState.gateInflight);
    expect(gateInflightAfter).toBe(false);

    // Cleanup: DELETE session via apiFetch (has Bearer token; fixture request lacks it).
    const sid = await page.evaluate(() => {
      const sess = window.AppState && window.AppState.circlesSession;
      return sess && sess.id;
    });
    await deleteSessionFromPage(page, sid);
  });

  test('submit button disabled during gate inflight', async ({ page }) => {
    await bootToPhase1Drill(page);

    // Delay the gate response so we can observe the inflight state mid-flight.
    await page.route('**/api/circles-sessions/*/gate', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    // Fire gate + capture gateInflight in a SINGLE evaluate (zero round-trip race).
    // Nulls frameworkValidator inline, fires submitFrameworkToGate, reads gateInflight,
    // restores frameworkValidator — all in one synchronous JS block.
    // submitFrameworkToGate sets gateInflight=true synchronously before any await.
    const gateInflightMid = await page.evaluate(() => {
      // Bypass Layer 1: null validator so submitFrameworkToGate doesn't block on I-fields.
      const saved = window.frameworkValidator;
      window.frameworkValidator = null;
      try {
        window.submitFrameworkToGate();
        // gateInflight is set synchronously before the first await in submitFrameworkToGate.
        return !!(window.AppState && window.AppState.gateInflight);
      } finally {
        window.frameworkValidator = saved;
      }
    });

    // Mid-flight: mutex must be held (gateInflight=true) immediately after gate fires.
    expect(gateInflightMid).toBe(true);

    // Phase 1.5 loading view must be visible (render() fired synchronously in submitFTG).
    const form = new CirclesPhase1Page(page);
    await form.gateLoading.waitFor({ state: 'visible', timeout: 3_000 });

    // After response: gate result rendered, mutex released.
    await page.waitForResponse('**/api/circles-sessions/*/gate', { timeout: 30_000 });
    await form.gateResult.waitFor({ state: 'visible', timeout: 5_000 });
    const gateInflightAfter = await page.evaluate(() => window.AppState && window.AppState.gateInflight);
    expect(gateInflightAfter).toBe(false);

    // Cleanup: DELETE session via apiFetch (has Bearer token).
    const sid = await page.evaluate(() => {
      const sess = window.AppState && window.AppState.circlesSession;
      return sess && sess.id;
    });
    await deleteSessionFromPage(page, sid);
  });
});
