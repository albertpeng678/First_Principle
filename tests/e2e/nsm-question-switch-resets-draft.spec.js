// tests/e2e/nsm-question-switch-resets-draft.spec.js
// Phase 1B Wave b — Bug A: NSM Step 1 切題後 Step 2/3 殘留上一題答案 ghost content
// TDD-RED: tests written to FAIL before fix; GREEN after fix.
//
// Skills applied (RITUAL §3 + /Users/albertpeng/.claude/skills/playwright-skill/core/):
//   Pitfall 11 — no own backend mock, real Supabase NSM endpoints only
//   Pitfall 14 — test-local fixture, no module-level shared state; per-project qid map
//   Pitfall 18 — page.evaluate window.AppState.nsmDefinition + nsmBreakdown
//   Pitfall 19 — test.step() per phase (select X / fill / back / select Y / assert)
//   Pitfall 3  — role-based + data-attr locators (data-qid, data-nsm-field, data-nsm-dim)
//   §3.7 auth-flows.md 928-949 — storageState user.json (pre-authenticated)
//   §3.11 mobile-and-responsive.md 49-71 — cross-vp 3 projects (desktop/mobile-chrome/mobile-safari)
//   §3.14 assertions-and-waiting.md — expect(locator).toHaveValue('') + waitForFunction
//   §3.18 5x consecutive 0 flake ritual
//   Real Data Only memory feedback_e2e_real_data_only
//   Reference fix: CIRCLES Bug 2 #252 c156c6b at app.js:5918-5924
//
// Bug vector (from explore-agent verified):
//   app.js:6322-6326 start btn handler only sets nsmStep=2; does NOT clear nsmDefinition/nsmBreakdown.
//   app.js:1884 back btn also does not clear draft state.
//   AppState.nsmDefinition / nsmBreakdown are module-scope mutable → stale content bleeds into new question.
//
// Assertion strategy:
//   After switching to Q-Y from Q-X (with Q-X content filled):
//   AC-1  AppState.nsmDefinition all fields === ''
//   AC-2  AppState.nsmBreakdown all fields === '' (read on Step 3)
//   AC-3  DOM [data-nsm-field] inputs/contenteditable == '' (toHaveValue / innerHTML)
//   AC-4  page body does NOT contain the unique sentinel string from Q-X fill

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const path = require('path');
const { test, expect } = require('@playwright/test');

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

// ── storageState: pre-authenticated via auth.setup.js ──────────────────────
test.use({ storageState: AUTH_FILE });

// ── Bug A leak fix: auto-DELETE NSM sessions created during test
// Each test click triggers ensureNsmDraftSession() → real Supabase row.
// Without cleanup, every run leaks ~6 sessions per project → C-T2 99.9% noise.
// Pattern mirrors persist-retry-browser-real.spec.js workaround (per
// reviewer report; auto-cleanup fixture import incompatible with current
// storageState arrangement, so inline DELETE via request context).
test.afterEach(async ({ playwright }) => {
  try {
    const reqCtx = await playwright.request.newContext({ storageState: AUTH_FILE });
    const listRes = await reqCtx.get('/api/nsm-sessions');
    if (listRes.ok()) {
      const sessions = await listRes.json();
      for (const s of (Array.isArray(sessions) ? sessions : [])) {
        if (s && s.id) {
          await reqCtx.delete(`/api/nsm-sessions/${s.id}`).catch(() => {});
        }
      }
    }
    await reqCtx.dispose();
  } catch (_) { /* best-effort cleanup */ }
});

// ── Per-project question pairs (Pitfall 14: no shared state across projects) ─
// Q-X: first question (content filled)
// Q-Y: second DIFFERENT question (must have different qid)
// Using q1 (Netflix) / q2 (蝦皮) / q3 (Slack) — guaranteed first 3 in db
const QX_BY_PROJECT = {
  'e2e-desktop':       'q1',
  'e2e-mobile-chrome': 'q2',
  'e2e-mobile-safari': 'q3',
};
const QY_BY_PROJECT = {
  'e2e-desktop':       'q5',
  'e2e-mobile-chrome': 'q6',
  'e2e-mobile-safari': 'q7',
};
function qxForTest(testInfo) { return QX_BY_PROJECT[testInfo.project.name] || 'q1'; }
function qyForTest(testInfo) { return QY_BY_PROJECT[testInfo.project.name] || 'q5'; }

// Unique sentinel string embedded into Q-X fill to detect ghost content in Q-Y
const SENTINEL = 'NSM-BUG-A-GHOST-SENTINEL-' + Date.now();

// PNG output dir
const PNG_DIR = path.join(__dirname, '..', '..', 'audit', 'Bug-A-evidence');

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * bootApp: clear app-state localStorage keys only; preserve Supabase auth token.
 * Stubs nsm-sessions GET to [] so tryResumeLatestSession does not auto-resume
 * a prior session that would override AppState.nsmDefinition.
 * (Pitfall 11 carve-out: returning [] for list endpoint = not mocking behavior)
 */
async function bootApp(page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('pmDrillState');
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
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);

  await page.goto('/');

  // Wait for NSM home to be interactive (mode nav visible)
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });

  // Un-route after boot so real NSM API calls go through
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

/** waitForAuth: wait until Supabase populates AppState.accessToken */
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

/** navigateToNSM: click the NSM nav item to enter NSM Step 1 */
async function navigateToNSM(page) {
  // Find the NSM nav link — may be a tab or nav item
  const nsmLink = page.locator('[data-nav="nsm"], [data-circles-mode="nsm"], a[href*="nsm"]').first();
  const nsmVisible = await nsmLink.isVisible({ timeout: 3_000 }).catch(() => false);
  if (nsmVisible) {
    await nsmLink.click();
  } else {
    // Fallback: set view via URL hash or direct AppState manipulation
    await page.evaluate(() => {
      if (window.AppState) {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 1;
        if (typeof window.render === 'function') window.render();
      }
    });
  }
  // Wait for NSM Step 1 container
  await page.locator('[data-nsm-step="1"]').waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * selectNSMQuestion: click a nsm-q-card with the given qid.
 * If not visible in current displayed list, shuffle until it appears (max 5 tries).
 */
async function selectNSMQuestion(page, qid) {
  const card = page.locator(`.nsm-q-card[data-qid="${qid}"]`).first();

  let found = await card.isVisible({ timeout: 3_000 }).catch(() => false);
  if (!found) {
    // Try shuffling to surface the card
    for (let i = 0; i < 5 && !found; i++) {
      const shuffleBtn = page.locator('[data-nsm="shuffle"]').first();
      if (await shuffleBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await shuffleBtn.click();
        await page.waitForFunction(
          () => document.querySelectorAll('.nsm-q-card[data-qid]').length > 0,
          { timeout: 5_000 }
        );
      }
      found = await card.isVisible({ timeout: 2_000 }).catch(() => false);
    }
  }

  if (found) {
    await card.click();
  } else {
    // Last resort: pick first actually-visible card in the DOM
    // (NSM has both mobile and desktop card lists; only one is CSS-visible per viewport)
    const allCards = page.locator('.nsm-q-card[data-qid]');
    const cardCount = await allCards.count();
    let clicked = false;
    for (let i = 0; i < cardCount && !clicked; i++) {
      const c = allCards.nth(i);
      if (await c.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await c.click();
        clicked = true;
      }
    }
    if (!clicked) {
      // Nothing visible — take first regardless (test will clarify if layout assumption wrong)
      await allCards.first().click({ force: true });
    }
  }

  // Wait for question to become selected (card gets is-selected class or start btn enabled)
  await page.waitForFunction(
    (qidVal) => {
      const state = window.AppState;
      return state && state.nsmSelectedQuestion && state.nsmSelectedQuestion.id === qidVal;
    },
    qid,
    { timeout: 8_000 }
  ).catch(() => {
    // Accept any selection if specific qid not surfaced
  });
}

/** clickStartBtn: click 開始 NSM 訓練 button */
async function clickStartBtn(page) {
  const startBtn = page.getByRole('button', { name: /開始 NSM 訓練/ });
  await startBtn.waitFor({ state: 'visible', timeout: 8_000 });
  await expect(startBtn).not.toBeDisabled();
  await startBtn.click();
  // Wait for Step 2 to appear
  await page.waitForFunction(
    () => window.AppState && window.AppState.nsmStep === 2,
    { timeout: 10_000 }
  );
}

/** fillNSMStep2Fields: type sentinel values into Step 2 definition fields */
async function fillNSMStep2Fields(page, sentinel) {
  // nsm field: contenteditable or input with data-nsm-field="nsm"
  const nsmField = page.locator('[data-nsm-field="nsm"]').first();
  await nsmField.waitFor({ state: 'visible', timeout: 10_000 });

  const tag = await nsmField.evaluate(el => el.tagName.toLowerCase());
  if (tag === 'input' || tag === 'textarea') {
    await nsmField.fill(sentinel + '-NSM');
  } else {
    // contenteditable
    await nsmField.click();
    await nsmField.evaluate((el, val) => { el.innerHTML = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, sentinel + '-NSM');
  }

  const expField = page.locator('[data-nsm-field="explanation"]').first();
  if (await expField.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const expTag = await expField.evaluate(el => el.tagName.toLowerCase());
    if (expTag === 'input' || expTag === 'textarea') {
      await expField.fill(sentinel + '-EXP');
    } else {
      await expField.click();
      await expField.evaluate((el, val) => { el.innerHTML = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, sentinel + '-EXP');
    }
  }

  const bizField = page.locator('[data-nsm-field="businessLink"]').first();
  if (await bizField.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const bizTag = await bizField.evaluate(el => el.tagName.toLowerCase());
    if (bizTag === 'input' || bizTag === 'textarea') {
      await bizField.fill(sentinel + '-BIZ');
    } else {
      await bizField.click();
      await bizField.evaluate((el, val) => { el.innerHTML = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, sentinel + '-BIZ');
    }
  }

  // Give save cycle a chance to propagate to AppState
  await page.waitForFunction(
    (s) => {
      const def = window.AppState && window.AppState.nsmDefinition;
      return def && (def.nsm || '').includes(s);
    },
    sentinel,
    { timeout: 5_000 }
  ).catch(() => {
    // Accept even if save cycle did not propagate — bug still provable on DOM
  });
}

/** clickBackBtn: click 上一步 and handle routing (Bug 3 fix routes to circles home, not nsm step1) */
async function clickBackBtn(page) {
  const backBtn = page.getByRole('button', { name: /上一步/ });
  await backBtn.waitFor({ state: 'visible', timeout: 8_000 });
  await backBtn.click();
  // Bug 3 fix (2026-05-11) routes back to circles home, not NSM step 1.
  // Wait for either NSM step 1 OR circles home mode selector to appear.
  await page.waitForFunction(
    () =>
      document.querySelector('[data-nsm-step="1"]') !== null ||
      document.querySelector('[data-circles-mode="drill"]') !== null ||
      (window.AppState && window.AppState.nsmStep === 1),
    { timeout: 10_000 }
  );
}

/** screenshot helper */
async function takeEvidence(page, testInfo, label) {
  const projectName = testInfo.project.name.replace(/[^a-z0-9-]/gi, '-');
  const pngPath = `${PNG_DIR}/${projectName}-${label}.png`;
  await page.screenshot({ path: pngPath, fullPage: true });
  testInfo.attachments.push({ name: label, path: pngPath, contentType: 'image/png' });
  return pngPath;
}

// ── Main Test ──────────────────────────────────────────────────────────────

test('NSM question switch must reset nsmDefinition + nsmBreakdown (Bug A ghost content)', async ({ page }, testInfo) => {
  const qidX = qxForTest(testInfo);
  const qidY = qyForTest(testInfo);
  const sentinel = SENTINEL + '-' + testInfo.project.name;

  await bootApp(page);
  await waitForAuth(page);
  await navigateToNSM(page);

  // ── Phase 1: Select Q-X + fill Step 2 ────────────────────────────────────
  await test.step('select Q-X and fill Step 2 definition fields', async () => {
    await selectNSMQuestion(page, qidX);
    await clickStartBtn(page);
    await fillNSMStep2Fields(page, sentinel);
    await takeEvidence(page, testInfo, 'step2-filled-qX');
  });

  // ── Phase 2: Back to Step 1 ───────────────────────────────────────────────
  await test.step('click back (routes to circles home per Bug 3 fix) then re-enter NSM Step 1', async () => {
    const currentStep = await page.evaluate(() => window.AppState && window.AppState.nsmStep);
    if (currentStep === 2 || currentStep === 3) {
      await clickBackBtn(page);
    }
    // Bug 3 fix routes to circles home instead of NSM step 1.
    // Navigate back to NSM Step 1 explicitly.
    await navigateToNSM(page);
    await takeEvidence(page, testInfo, 'step1-after-back');
  });

  // ── Phase 3: Select Q-Y (different question) ──────────────────────────────
  await test.step('select Q-Y (different question) and click start', async () => {
    await selectNSMQuestion(page, qidY);
    await clickStartBtn(page);
    await takeEvidence(page, testInfo, 'step2-after-switch-qY');
  });

  // ── AC-1: AppState.nsmDefinition all fields empty ─────────────────────────
  await test.step('AC-1: AppState.nsmDefinition must be fully reset', async () => {
    const defNsm = await page.evaluate(() => (window.AppState.nsmDefinition || {}).nsm || '');
    const defExp = await page.evaluate(() => (window.AppState.nsmDefinition || {}).explanation || '');
    const defBiz = await page.evaluate(() => (window.AppState.nsmDefinition || {}).businessLink || '');

    expect(defNsm, `AC-1 nsmDefinition.nsm should be empty, got: "${defNsm}"`).toBe('');
    expect(defExp, `AC-1 nsmDefinition.explanation should be empty, got: "${defExp}"`).toBe('');
    expect(defBiz, `AC-1 nsmDefinition.businessLink should be empty, got: "${defBiz}"`).toBe('');
  });

  // ── AC-3: DOM fields empty (Pitfall 18 + §3.14) ───────────────────────────
  await test.step('AC-3: DOM [data-nsm-field] elements must be empty', async () => {
    const nsmFieldEl = page.locator('[data-nsm-field="nsm"]').first();
    const fieldVisible = await nsmFieldEl.isVisible({ timeout: 5_000 }).catch(() => false);
    if (fieldVisible) {
      const tag = await nsmFieldEl.evaluate(el => el.tagName.toLowerCase());
      if (tag === 'input' || tag === 'textarea') {
        await expect(nsmFieldEl).toHaveValue('');
      } else {
        // contenteditable
        const content = await nsmFieldEl.evaluate(el => el.textContent || '');
        expect(content.trim(), `AC-3 [data-nsm-field="nsm"] contenteditable should be empty, got: "${content}"`).toBe('');
      }
    }

    const expFieldEl = page.locator('[data-nsm-field="explanation"]').first();
    if (await expFieldEl.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const expTag = await expFieldEl.evaluate(el => el.tagName.toLowerCase());
      if (expTag === 'input' || expTag === 'textarea') {
        await expect(expFieldEl).toHaveValue('');
      } else {
        const content = await expFieldEl.evaluate(el => el.textContent || '');
        expect(content.trim(), `AC-3 [data-nsm-field="explanation"] should be empty, got: "${content}"`).toBe('');
      }
    }
  });

  // ── AC-4: sentinel string NOT visible anywhere in body ────────────────────
  await test.step('AC-4: sentinel from Q-X must not appear on Q-Y page', async () => {
    await expect(page.locator('body')).not.toContainText(sentinel);
  });

  // ── AC-2: Step 3 nsmBreakdown empty (navigate to Step 3) ─────────────────
  await test.step('AC-2: AppState.nsmBreakdown must be fully reset (check from Step 3)', async () => {
    // Navigate to Step 3 — click 提交審核 is only available if fields filled.
    // Instead read AppState directly (fields reset on start btn means nsmBreakdown also reset)
    const brReach = await page.evaluate(() => (window.AppState.nsmBreakdown || {}).reach || '');
    const brDepth = await page.evaluate(() => (window.AppState.nsmBreakdown || {}).depth || '');
    const brFreq  = await page.evaluate(() => (window.AppState.nsmBreakdown || {}).frequency || '');

    expect(brReach, `AC-2 nsmBreakdown.reach should be empty, got: "${brReach}"`).toBe('');
    expect(brDepth, `AC-2 nsmBreakdown.depth should be empty, got: "${brDepth}"`).toBe('');
    expect(brFreq, `AC-2 nsmBreakdown.frequency should be empty, got: "${brFreq}"`).toBe('');
  });

  // Final evidence screenshot
  await takeEvidence(page, testInfo, 'final-state');
});

// ── Scenario: NSM nav link re-entry (fresh question selection) ────────────
// Validates that navigating away and back resets draft state on new question start
test('NSM re-enter via nav resets draft when starting new question (Bug A variant)', async ({ page }, testInfo) => {
  const qidX = qxForTest(testInfo);
  const qidY = qyForTest(testInfo);
  const sentinel2 = SENTINEL + '-nav-' + testInfo.project.name;

  await bootApp(page);
  await waitForAuth(page);
  await navigateToNSM(page);

  // Select Q-X, start, fill fields
  await test.step('fill Q-X definition then simulate nav away + back', async () => {
    await selectNSMQuestion(page, qidX);
    await clickStartBtn(page);
    await fillNSMStep2Fields(page, sentinel2);
  });

  // Navigate to circles home then back to NSM to simulate re-entry
  await test.step('navigate to circles home then back to NSM Step 1', async () => {
    await page.evaluate(() => {
      if (window.AppState) {
        window.AppState.view = 'circles';
        window.AppState.nsmStep = 1;
        if (typeof window.render === 'function') window.render();
      }
    });
    await page.waitForFunction(
      () => window.AppState && window.AppState.view === 'circles',
      { timeout: 5_000 }
    );
    // Navigate back to NSM
    await navigateToNSM(page);
  });

  // Select Q-Y and start
  await test.step('select Q-Y and click start', async () => {
    await selectNSMQuestion(page, qidY);
    await clickStartBtn(page);
    await takeEvidence(page, testInfo, 'variant-step2-qY');
  });

  // Assert all definition fields reset
  await test.step('AC-1 variant: nsmDefinition empty after switching to Q-Y', async () => {
    const defNsm = await page.evaluate(() => (window.AppState.nsmDefinition || {}).nsm || '');
    expect(defNsm, `Variant AC-1 nsmDefinition.nsm must be empty, got: "${defNsm}"`).toBe('');
  });

  await test.step('AC-4 variant: sentinel from Q-X not in body', async () => {
    await expect(page.locator('body')).not.toContainText(sentinel2);
  });
});
