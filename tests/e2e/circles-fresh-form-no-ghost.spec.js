// tests/e2e/circles-fresh-form-no-ghost.spec.js
// Phase 1 Lane L4 — Reproduce Bug 2: "進入 form 前就出現不知道哪來的已填寫內容"
// TDD-RED: these tests are written to FAIL when ghost content leaks into Phase 1 form.
//
// Skills applied (cited verbatim per STANDING feedback_playwright_skill_cited_application):
//   - playwright-skill/core/auth-flows.md:928-949  "API seed auth + storageState"
//       → test.use({ storageState }) handles browser session; AppState.accessToken
//         is populated by Supabase getSession on boot (no login steps inside tests).
//   - playwright-skill/core/test-data-management.md "Per-project unique data"
//       → QUESTION_BY_PROJECT maps one question_id per e2e project to avoid
//         cross-test collision in shared Supabase DB.
//   - playwright-skill/core/mobile-and-responsive.md:49-71 "Device Profiles"
//       → covers e2e-desktop (Desktop Chrome), e2e-mobile-chrome (Pixel 5),
//         e2e-mobile-safari (iPhone 14) via playwright.config.js project matrix.
//   - playwright-skill/core/locator-strategy.md "Priority order"
//       → role-based locators first; CSS/data-attr only for app-specific structure.
//   - playwright-skill/core/assertions-and-waiting.md "Web-first assertions"
//       → expect(...).toHaveValue('') and waitForFunction for AppState; no hard sleep.
//
// REAL-DATA DISCIPLINE (feedback_e2e_real_data_only):
//   - ZERO route.fulfill on /api/circles-sessions or /api/nsm-sessions except the
//     empty-stub GET on boot (identical pattern to circles-back-nav-lock.spec.js
//     bootApp — this is a Pitfall 11 carve-out: returning [] is NOT mocking behavior).
//   - ZERO page.waitForTimeout hard sleep.
//   - ZERO prod URL; server runs on localhost:3000.
//   - Test account: e2e@first-principle.test (test DB only, never prod).
//
// Bug vector (from lane-k audit):
//   Candidate 1: restore() writes circlesSelectedQuestion (PERSISTED_KEYS) synchronously
//     at DOMContentLoaded → renderCirclesPhase1() fires with empty circlesFrameworkDraft
//     before tryResumeLatestSession (async) completes.
//   Candidate 3: qcard-confirm reads pmdrill:circles:draft:<qid> from localStorage
//     when no live session matches → injects stale content into fresh session fields.
//
// Assertion strategy: after Phase 1 mounts, read each [data-phase1="textarea"]
//   innerHTML via page.evaluate — any non-empty value = ghost content = test FAILS.

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const path = require('path');
const { test, expect } = require('@playwright/test');

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

// One question_id per e2e project → no cross-project collision.
// circles_021/022/023 are reserved for this spec so they don't collide with
// circles_011/012/013 used by circles-back-nav-lock.spec.js.
const QUESTION_BY_PROJECT = {
  'e2e-desktop':       'circles_021',
  'e2e-mobile-chrome': 'circles_022',
  'e2e-mobile-safari': 'circles_023',
};
// Fallback for any unrecognised project name (e.g. direct npx invocation).
function questionForTest(testInfo) {
  return QUESTION_BY_PROJECT[testInfo.project.name] || 'circles_021';
}

// Alternate question_id for scenario C (cross-session carry test).
// Must differ from the primary qid to prove there's no carry from q_A to q_B.
const ALT_QUESTION_BY_PROJECT = {
  'e2e-desktop':       'circles_024',
  'e2e-mobile-chrome': 'circles_025',
  'e2e-mobile-safari': 'circles_026',
};
function altQuestionForTest(testInfo) {
  return ALT_QUESTION_BY_PROJECT[testInfo.project.name] || 'circles_024';
}

// Screenshot output dir (per task spec).
const PNG_DIR = path.join(__dirname, '..', '..', 'audit', 'repro-bug2-ghost-content');

// ── storageState: pre-authenticated via auth.setup.js ───────────────────────
test.use({ storageState: AUTH_FILE });

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * bootApp: clear only app-state localStorage keys (pmDrillState, pmdrill:* drafts)
 * while PRESERVING the Supabase auth token (sb-*-auth-token) and guestId.
 * Clearing ALL localStorage would wipe the auth token set by storageState, causing
 * waitForAuth to time out — the Supabase SDK reads the token from localStorage on boot.
 *
 * The empty-stub IS the Pitfall 11 carve-out: returning [] for list endpoints is
 * identical to the pattern in circles-back-nav-lock.spec.js#bootApp.
 * Un-routing immediately after page load means subsequent CRUD calls go through.
 */
async function bootApp(page) {
  // Selectively clear app-state keys; preserve Supabase auth token + guestId.
  await page.addInitScript(() => {
    try {
      // Remove pmDrillState (restore() state: circlesSelectedQuestion, circlesPhase, etc.)
      localStorage.removeItem('pmDrillState');
      // Remove any pmdrill:circles:draft:<qid> and pmdrill:nsm:draft:<qid> cache entries.
      const draftKeys = Object.keys(localStorage).filter(k => k.startsWith('pmdrill:'));
      draftKeys.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (_) {}
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

  // Wait for home view to be interactive (mode selector visible = boot complete).
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });

  // Un-route so Phase 1 CRUD calls (POST /draft, PATCH, GET detail) are real.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

/**
 * waitForAuth: wait until Supabase has populated AppState.accessToken.
 * storageState restores the cookie/token, but the async Supabase getSession
 * call may not have resolved yet when the test starts.
 */
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

/**
 * clickQuestionAndConfirm: find a rendered qcard matching qid and click through
 * to Phase 1. Returns after Phase 1 root is visible.
 */
async function clickQuestionAndConfirm(page, qid) {
  // qcard expand: click the card to expand the confirm overlay.
  const qcard = page.locator(`[data-circles="qcard"][data-qid="${qid}"]`).first();

  // If the question is not currently displayed (e.g. shuffled away), trigger a
  // reshuffle until it appears — or use the search bar to surface it.
  // Simpler: pick the first visible qcard if qid is not found — this exercises
  // the "any new question" path which is sufficient for scenarios A & B.
  const qcardExists = await qcard.count();
  let usedQcard;
  if (qcardExists > 0) {
    usedQcard = qcard;
  } else {
    // Fall back to first rendered qcard (any question) — still proves ghost content
    // behaviour is question-agnostic.
    usedQcard = page.locator('[data-circles="qcard"]').first();
  }
  await usedQcard.click();

  // Wait for confirm button to be visible, then click it.
  const confirmBtn = page.locator('[data-circles="qcard-confirm"]').first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 8_000 });
  await confirmBtn.click();

  // Phase 1 root appears after render().
  await page.locator('[data-view="circles"][data-circles-phase="1"]').waitFor({
    state: 'visible',
    timeout: 15_000,
  });
}

/**
 * readPhase1TextareaContents: return array of { fieldIdx, innerHTML } for all
 * [data-phase1="textarea"] elements. Ghost content = any non-empty innerHTML.
 */
async function readPhase1TextareaContents(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-phase1="textarea"]')).map((el, i) => ({
      fieldIdx: el.dataset.fieldIdx || String(i),
      innerHTML: el.innerHTML || '',
    }));
  });
}

/**
 * readAppStateDraft: snapshot AppState.circlesFrameworkDraft from the page.
 */
async function readAppStateDraft(page) {
  return page.evaluate(() => {
    return (window.AppState && window.AppState.circlesFrameworkDraft) || {};
  });
}

/**
 * takeEvidenceScreenshot: capture a PNG to audit/repro-bug2-ghost-content/.
 * File name: <scenario>-<projectName>.png
 */
async function takeEvidenceScreenshot(page, testInfo, scenario) {
  const projectName = testInfo.project.name.replace(/[^a-z0-9-]/gi, '-');
  const pngPath = path.join(PNG_DIR, `${scenario}-${projectName}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });
  return pngPath;
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

/**
 * Scenario A: Fresh login (clean storage) → home → click brand-new question
 * → Phase 1 mount → assert all C1 textareas are empty.
 *
 * This is the cleanest repro path for Candidate 1 (restore() persists
 * circlesSelectedQuestion across page load). With storage cleared, restore()
 * should find nothing → form should be blank on first use.
 */
test('Scenario A — fresh login, new question, Phase 1 must be empty', async ({ page }, testInfo) => {
  await bootApp(page);
  await waitForAuth(page);

  const qid = questionForTest(testInfo);

  await test.step('click question and confirm → Phase 1 mount', async () => {
    await clickQuestionAndConfirm(page, qid);
  });

  // Allow one render cycle after bindCirclesPhase1 + populateTextareasFromDraft run.
  await page.waitForFunction(
    () => document.querySelectorAll('[data-phase1="textarea"]').length > 0,
    { timeout: 10_000 }
  );

  const contents = await readPhase1TextareaContents(page);
  const draft = await readAppStateDraft(page);

  const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-A');
  testInfo.attachments.push({ name: 'phase1-screenshot', path: pngPath, contentType: 'image/png' });

  // Ghost content check: every textarea must be empty.
  const nonEmpty = contents.filter(c => c.innerHTML.trim() !== '');
  if (nonEmpty.length > 0) {
    console.error('[BUG CONFIRMED] Scenario A ghost content:', JSON.stringify(nonEmpty));
    console.error('[BUG CONFIRMED] AppState.circlesFrameworkDraft:', JSON.stringify(draft));
  }
  expect(nonEmpty, `Scenario A: ${nonEmpty.length} textarea(s) contain ghost content: ${JSON.stringify(nonEmpty)}`).toHaveLength(0);
});

/**
 * Scenario B: Fresh login → home → reshuffle → pick question → Phase 1
 * → assert all textareas empty.
 *
 * Exercises the reshuffle path (bindHomeListeners reshuffle button re-shuffles
 * displayed questions) to confirm the question pool change doesn't carry draft.
 */
test('Scenario B — reshuffle then pick question, Phase 1 must be empty', async ({ page }, testInfo) => {
  await bootApp(page);
  await waitForAuth(page);

  await test.step('trigger reshuffle', async () => {
    const reshuffleBtn = page.locator('[data-circles="reshuffle"]');
    // Reshuffle button may not be visible on all viewports; proceed if absent.
    const reshuffleVisible = await reshuffleBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (reshuffleVisible) {
      await reshuffleBtn.click();
      // Wait one render cycle for new question set.
      await page.waitForFunction(
        () => document.querySelectorAll('[data-circles="qcard"]').length > 0,
        { timeout: 5_000 }
      );
    }
  });

  await test.step('click first visible qcard → Phase 1 mount', async () => {
    const firstCard = page.locator('[data-circles="qcard"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 8_000 });
    await firstCard.click();

    const confirmBtn = page.locator('[data-circles="qcard-confirm"]').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await confirmBtn.click();

    await page.locator('[data-view="circles"][data-circles-phase="1"]').waitFor({
      state: 'visible',
      timeout: 15_000,
    });
  });

  await page.waitForFunction(
    () => document.querySelectorAll('[data-phase1="textarea"]').length > 0,
    { timeout: 10_000 }
  );

  const contents = await readPhase1TextareaContents(page);
  const draft = await readAppStateDraft(page);

  const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-B');
  testInfo.attachments.push({ name: 'phase1-screenshot', path: pngPath, contentType: 'image/png' });

  const nonEmpty = contents.filter(c => c.innerHTML.trim() !== '');
  if (nonEmpty.length > 0) {
    console.error('[BUG CONFIRMED] Scenario B ghost content:', JSON.stringify(nonEmpty));
    console.error('[BUG CONFIRMED] AppState.circlesFrameworkDraft:', JSON.stringify(draft));
  }
  expect(nonEmpty, `Scenario B: ${nonEmpty.length} textarea(s) contain ghost content: ${JSON.stringify(nonEmpty)}`).toHaveLength(0);
});

/**
 * Scenario C: Simulate having visited a prior session (type text in Phase 1),
 * go back to home, then click a DIFFERENT question → Phase 1 → assert no
 * carry-over from the first session.
 *
 * This exercises Candidate 3: qcard-confirm reads pmdrill:circles:draft:<qid>
 * from localStorage, which may have been written by the prior session's
 * triggerSaveCycle. The DIFFERENT question must have a different qid so the
 * draft key (<qid_A> vs <qid_B>) prevents accidental carry — but if the app
 * reads the wrong key, ghost content appears.
 *
 * Note: this test also catches Candidate 1 via the second Phase 1 entry.
 */
test('Scenario C — prior session then different question, Phase 1 must be empty', async ({ page }, testInfo) => {
  await bootApp(page);
  await waitForAuth(page);

  const qidA = questionForTest(testInfo);
  const qidB = altQuestionForTest(testInfo);

  await test.step('open question A and type something in Phase 1', async () => {
    await clickQuestionAndConfirm(page, qidA);

    await page.waitForFunction(
      () => document.querySelectorAll('[data-phase1="textarea"]').length > 0,
      { timeout: 10_000 }
    );

    // Type some content in the first textarea to seed localStorage draft.
    const firstTextarea = page.locator('[data-phase1="textarea"]').first();
    await firstTextarea.focus();
    await firstTextarea.pressSequentially('ghost content from session A', { delay: 20 });

    // Wait briefly so triggerSaveCycle has a chance to write to localStorage.
    await page.waitForFunction(
      () => {
        const key = Object.keys(localStorage).find(k => k.startsWith('pmdrill:circles:draft:'));
        if (!key) return false;
        try { const v = JSON.parse(localStorage.getItem(key)); return !!v; } catch (_) { return false; }
      },
      { timeout: 8_000 }
    ).catch(() => {
      // If localStorage draft not written (e.g. save cycle has min-char threshold),
      // that's acceptable — the test still validates the cross-question path.
    });
  });

  await test.step('navigate back to home via page.goto', async () => {
    // Use page.goto('/') rather than clicking back-button — the Phase 1 back button
    // may navigate to gate (Phase 1.5) not directly to home, causing the home
    // mode-selector wait to time out. page.goto is more reliable for cross-session
    // navigation and is equivalent to the user manually typing the URL.
    // bootApp's empty-list stubs are no longer active at this point (un-routed);
    // tryResumeLatestSession will fire and may auto-resume the qidA session.
    // That's fine — we only care that when user picks qidB explicitly, its form is clean.
    await page.goto('/');
    // Home must render (mode selector = home view).
    await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 20_000 });
  });

  await test.step('click DIFFERENT question B → Phase 1 mount', async () => {
    await clickQuestionAndConfirm(page, qidB);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-phase1="textarea"]').length > 0,
      { timeout: 10_000 }
    );
  });

  const contents = await readPhase1TextareaContents(page);
  const draft = await readAppStateDraft(page);

  const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-C');
  testInfo.attachments.push({ name: 'phase1-screenshot', path: pngPath, contentType: 'image/png' });

  const nonEmpty = contents.filter(c => c.innerHTML.trim() !== '');
  if (nonEmpty.length > 0) {
    console.error('[BUG CONFIRMED] Scenario C ghost content from prior session:', JSON.stringify(nonEmpty));
    console.error('[BUG CONFIRMED] AppState.circlesFrameworkDraft:', JSON.stringify(draft));
  }
  expect(nonEmpty, `Scenario C: ${nonEmpty.length} textarea(s) contain ghost content from prior session: ${JSON.stringify(nonEmpty)}`).toHaveLength(0);
});

/**
 * Scenario D: Hard-reload while Phase 1 is active (page reload with
 * pmDrillState still containing circlesSelectedQuestion + circlesPhase=1).
 *
 * This is the PRIMARY repro for Candidate 1: restore() at DOMContentLoaded
 * reads pmDrillState, sets circlesSelectedQuestion and circlesPhase=1 →
 * renderView() immediately routes to renderCirclesPhase1() with empty
 * circlesFrameworkDraft (not in PERSISTED_KEYS) before tryResumeLatestSession
 * (async) can populate it. The form appears with a valid question chip but
 * all textareas blank — the "ghost" form shown before user input.
 *
 * Note: after reload, tryResumeLatestSession (async) WILL eventually populate
 * circlesFrameworkDraft and re-render with real content. The bug is the INITIAL
 * blank Phase 1 form appearing before that async completes — which is detectable
 * by reading textareas immediately after Phase 1 root appears, before async loads.
 *
 * With stub returning [] for list endpoints, tryResumeLatestSession finds no active
 * session and falls through — leaving circlesFrameworkDraft={} — which means the
 * Phase 1 form rendered by restore() will stay empty for the test duration. This
 * scenario proves a DIFFERENT ghost: the form appears without user choosing it.
 */
test('Scenario D — reload with pmDrillState set, Phase 1 should not appear pre-auth', async ({ page }, testInfo) => {
  await bootApp(page);
  await waitForAuth(page);

  const qid = questionForTest(testInfo);

  await test.step('navigate to Phase 1 for question qid', async () => {
    await clickQuestionAndConfirm(page, qid);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-phase1="textarea"]').length > 0,
      { timeout: 10_000 }
    );
  });

  // Snapshot the pmDrillState that will persist on reload.
  const pmDrillState = await page.evaluate(() => localStorage.getItem('pmDrillState'));

  await test.step('reload page — pmDrillState persists (simulates Candidate 1)', async () => {
    // Re-stub list endpoints to [] so tryResumeLatestSession returns no active sessions.
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

    await page.reload();

    // After reload, restore() runs synchronously with old pmDrillState.
    // If circlesPhase=1 and circlesSelectedQuestion are persisted,
    // renderView() should route to renderCirclesPhase1() immediately.
    // We wait for EITHER Phase 1 form OR home view — not just Phase 1.
    await page.waitForFunction(
      () =>
        document.querySelector('[data-view="circles"][data-circles-phase="1"]') !== null ||
        document.querySelector('[data-circles-mode="drill"]') !== null,
      { timeout: 15_000 }
    );

    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  const phase1Appeared = await page.evaluate(
    () => document.querySelector('[data-view="circles"][data-circles-phase="1"]') !== null
  );

  const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-D');
  testInfo.attachments.push({ name: 'after-reload-screenshot', path: pngPath, contentType: 'image/png' });

  if (phase1Appeared) {
    // Phase 1 appeared due to pmDrillState restore — read textarea contents.
    const contents = await readPhase1TextareaContents(page);
    const draft = await readAppStateDraft(page);

    console.error('[BUG CANDIDATE-1 CONFIRMED] Scenario D: Phase 1 appeared on reload via pmDrillState restore');
    console.error('pmDrillState was:', pmDrillState);
    console.error('Textarea contents after reload:', JSON.stringify(contents));
    console.error('circlesFrameworkDraft after reload:', JSON.stringify(draft));

    // The ghost form itself is the bug: Phase 1 appeared before user chose a question
    // in this session. Per spec: the form must NOT appear on reload without user action.
    // Fail here to signal Candidate 1 is confirmed.
    expect(phase1Appeared, 'Scenario D: Phase 1 form appeared on reload via pmDrillState without user action — Candidate 1 ghost confirmed').toBe(false);
  } else {
    // Home appeared — either pmDrillState was cleared or restore() handled it correctly.
    // This is the expected (non-buggy) behaviour.
    await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 10_000 });
  }
});

/**
 * Scenario E: Storage pollution test — pre-populate localStorage with a stale
 * draft for the target question qid, then load a fresh Phase 1 for that same qid.
 *
 * This directly exercises Candidate 3: qcard-confirm reads
 * pmdrill:circles:draft:<qid> from localStorage when no live session is found.
 * If the app correctly ignores stale local cache for a fresh session, textareas
 * remain empty. If it injects old draft content, textareas contain ghost data.
 */
test('Scenario E — pre-polluted localStorage draft, Phase 1 must be empty on fresh start', async ({ page }, testInfo) => {
  const qid = questionForTest(testInfo);

  // Inject stale draft into localStorage BEFORE navigation.
  // IMPORTANT: only clear app-state keys; preserve sb-*-auth-token + guestId.
  await page.addInitScript((qidVal) => {
    try {
      localStorage.removeItem('pmDrillState');
      const draftKeys = Object.keys(localStorage).filter(k => k.startsWith('pmdrill:'));
      draftKeys.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (_) {}
    // Simulate a stale draft that a prior session would have written.
    // Uses the same shape as triggerSaveCycle (app.js:3842-3847).
    const stalePayload = {
      qid: qidVal,
      savedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      framework: {
        C1: {
          '問題範圍': 'STALE GHOST CONTENT — should not appear',
          '時間範圍': 'STALE GHOST Q=C1 timeWindow',
          '業務影響': 'STALE GHOST Q=C1 businessImpact',
          '假設確認': 'STALE GHOST Q=C1 assumption',
        },
      },
    };
    try {
      localStorage.setItem('pmdrill:circles:draft:' + qidVal, JSON.stringify(stalePayload));
    } catch (_) {}
  }, qid);

  // Boot with empty list stubs so tryResumeLatestSession finds nothing.
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
  await waitForAuth(page);

  await test.step('click question matching polluted qid → Phase 1 mount', async () => {
    await clickQuestionAndConfirm(page, qid);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-phase1="textarea"]').length > 0,
      { timeout: 10_000 }
    );
  });

  const contents = await readPhase1TextareaContents(page);
  const draft = await readAppStateDraft(page);

  // Check if ghost content from stale draft leaked into textareas.
  const ghostFields = contents.filter(c => c.innerHTML.includes('STALE GHOST'));
  const anyNonEmpty = contents.filter(c => c.innerHTML.trim() !== '');

  const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-E');
  testInfo.attachments.push({ name: 'phase1-screenshot', path: pngPath, contentType: 'image/png' });

  if (ghostFields.length > 0) {
    console.error('[BUG CONFIRMED] Scenario E: stale localStorage draft injected into fresh Phase 1 textareas!');
    console.error('Ghost fields:', JSON.stringify(ghostFields));
    console.error('AppState.circlesFrameworkDraft:', JSON.stringify(draft));
  } else if (anyNonEmpty.length > 0) {
    console.error('[BUG - DIFFERENT CONTENT] Scenario E: non-empty textareas (not stale-ghost marker):', JSON.stringify(anyNonEmpty));
    console.error('AppState.circlesFrameworkDraft:', JSON.stringify(draft));
  }

  expect(
    ghostFields,
    `Scenario E: stale localStorage draft leaked into ${ghostFields.length} textarea(s): ${JSON.stringify(ghostFields)}`
  ).toHaveLength(0);

  expect(
    anyNonEmpty,
    `Scenario E: ${anyNonEmpty.length} textarea(s) have non-empty content on fresh Phase 1 start: ${JSON.stringify(anyNonEmpty)}`
  ).toHaveLength(0);
});
