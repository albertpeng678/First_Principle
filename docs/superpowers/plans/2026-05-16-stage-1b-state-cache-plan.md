# Stage 1B — State / Cache Cluster (B3 + B4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix B3 (Phase 3 spinner stuck after offcanvas history restore of a completed CIRCLES session) + B4 (offcanvas DELETE → quick re-open shows deleted item due to fire-and-forget race against 5 s server-side cache TTL), behind ~18 tests across 3 layers (jest unit / jest API / Playwright E2E) — single-file surgical patch (~18 LOC), no backend changes.

**Architecture:** B3 = single-line derivation inside `restoreCirclesPhase1FromSession()` that mirrors the existing `circlesScoreResult` assignment pattern at app.js:6556–6561 (no new state). B4 = swap fire-and-forget `apiFetch.catch()` for `await apiFetch + snapshot/rollback + reuse of existing `_resumeToast` helper` for the "刪除失敗，請再試一次" zh-TW error toast. Both fixes are disjoint from Stage 1A (gate cluster touches `7375–7443`) and from 1C / 1D — merge ordering safe.

**Tech Stack:** Vanilla JS (`public/app.js` only) + jest (unit + API contract via existing `tests/circles-sessions.test.js` mock-db pattern) + Playwright (E2E via existing `tests/e2e/playwright.config.js` + `auto-cleanup.fixture` + `circles-phase1.factory` + `assertions-and-waiting` web-first `not.toBeVisible()` retry pattern for deterministic rollback assertion).

**Branch:** `main` (per memory `feedback_push_directly_to_main`)

**Spec reference:** `docs/superpowers/specs/2026-05-16-stage-1b-state-cache-design.md` (commit `2c6fa51`)

**Spec readiness audit:** `audit/spec-readiness-1B-1C-1D-2026-05-16.md` — verdict READY_WITH_NOTES (2 minor live-questions: list-stub for B3-E1, toast helper for B4 — both pre-answered in this plan via §Pre-Flight below).

---

## Pre-Flight (resolves readiness-audit notes before Task 1)

1. **List-endpoint stub for B3 E2E** — reuse the existing `bootToPhase1Drill()` pattern in `tests/e2e/circles-gate.spec.js` (lines ~28–50) which already stubs `GET /api/circles-sessions` + `GET /api/guest-circles-sessions` + `GET /api/nsm-sessions` + `GET /api/guest/nsm-sessions` to `[]` so `tryResumeLatestSession()` exits cleanly. B3 specs reuse the same helper verbatim.
2. **Toast helper for B4** — reuse `AppState._resumeToastShow` + `AppState._resumeToastMsg` + `render()` + `setTimeout(..., 6000)` (see app.js:7842–7847 for the canonical setter + app.js:3008–3070 for `renderResumeToast()`). No new toast component. CSS class `.resume-toast` already exists. Message: `'刪除失敗，請再試一次'`.

---

## File Structure

### New files

- `tests/unit/circles-restore-phase3.test.js` — 5 jest unit specs (B3-U1..U5) covering `stepKey` derivation in `restoreCirclesPhase1FromSession`
- `tests/unit/circles-delete-rollback.test.js` — 4 jest unit specs (B4-U1..U4) covering snapshot + rollback logic in the offcanvas DELETE handler
- `tests/e2e/circles-phase3-restore.spec.js` — 3 Playwright E2E specs (B3-E1..E3)
- `tests/e2e/offcanvas-delete.spec.js` — 3 Playwright E2E specs (B4-E1..E3)

### Modified files

- `public/app.js` — B3 patch in `restoreCirclesPhase1FromSession()` after line 7944 (+6 LOC); B4 patch replacing lines 8127–8140 delete branch (+12 / −2 net)
- `tests/circles-sessions.test.js` — extend with 3 API contract specs B4-A1..A3 (cache-invalidation regression guard)
- `tests/e2e/playwright.config.js` — extend `testMatch` regex on the 3 E2E projects (lines 56 / 64 / 73) from `/circles-gate\.spec\.js$/` to `/(circles-gate|circles-phase3-restore|offcanvas-delete)\.spec\.js$/`
- `CLAUDE.md` — state board update at end (Last updated + Stage 1B ship line)

### Files NOT touched (carve-outs verified against spec §8)

- `lib/session-cache.js` — TTL stays 5 s; fix is sequencing not TTL
- `routes/circles-sessions.js` / `routes/guest-circles-sessions.js` / `routes/nsm-sessions.js` — server DELETE already invalidates correctly
- Any AI prompt file — no LLM-prompt change in 1B
- `tests/visual/` — pure behavioral fix, no pixel-diff surface

---

## Execution Order

```
Phase 1 (sequential): B3 unit tests + fix         (Tasks 1–2)
Phase 2 (sequential): B3 E2E specs                (Task 3)
Phase 3 (sequential): B4 unit tests + fix         (Tasks 4–5)
Phase 4 (sequential): B4 API contract specs       (Task 6)
Phase 5 (sequential): B4 E2E specs                (Task 7)
Phase 6 (sequential): Full bundle regression + ship (Task 8)
```

All tasks sequential — each TDD task is red-first per `feedback_three_iron_laws` IL-3 (write failing test → run → confirm RED → minimal impl → run → confirm GREEN → commit). B3 and B4 are independent fix groups; they could theoretically run in parallel, but sequencing avoids merge-conflict risk inside the same `app.js` file and keeps the bundle commit log linear.

---

## Task 1: B3 — failing unit tests for `restoreCirclesPhase1FromSession` score derivation

**Files:**
- Create: `tests/unit/circles-restore-phase3.test.js`
- Reference (do not modify yet): `public/app.js:7918–7975`

**Why:** Lock spec §6 B3-U1..U5 acceptance criteria into 5 jest specs BEFORE any production code change. The function under test is wrapped inside an IIFE in `app.js`; extract it via the same node-eval-window pattern used elsewhere in the suite (jsdom-style: stub `window`, eval the slice, call the exposed fn). If the existing suite uses a different approach (full-module require with `global.AppState` mock), mirror that.

- [ ] **Step 1: Inspect existing unit-test pattern in repo**

```bash
ls tests/unit/ 2>/dev/null || echo "no tests/unit yet — first file"
grep -rn "restoreCirclesPhase1FromSession\|circlesStepScores\|circlesScoreResult" tests/ 2>/dev/null | head -20
grep -nE "function.*AppState|window\.AppState" public/app.js | head -5
```

Expected: identify whether existing CIRCLES jest specs (e.g. `tests/issue2b-offcanvas-phase-restore.test.js`) instantiate `AppState` via require or via jsdom. Use whichever pattern is already present — do NOT invent a new harness.

- [ ] **Step 2: Write 5 failing jest specs**

Create `tests/unit/circles-restore-phase3.test.js`:

```js
// tests/unit/circles-restore-phase3.test.js
// Stage 1B B3 — restore-phase3 score derivation unit specs.
// Spec ref: docs/superpowers/specs/2026-05-16-stage-1b-state-cache-design.md §6 B3-U1..U5.
// Pattern: mirror tests/issue2b-offcanvas-phase-restore.test.js — load app.js into a jsdom
// window, grab the restore fn off the closure-exposed test hook, exercise with synthetic items.

const path = require('path');
const fs = require('fs');

// Reuse whichever harness pattern existing CIRCLES specs use. If issue2b uses
// `require('../public/app.js')` with a global AppState mock, follow that. If it
// uses jsdom + script-eval, follow that. The expectations below are harness-agnostic.

function makeItem(overrides) {
  return Object.assign({
    id: 'sess-test-1',
    mode: 'drill',
    drill_step: 'C1',
    sim_step_index: 0,
    step_scores: {},
    framework_draft: {},
    step_drafts: {},
    conversation: [],
    gate_result: null,
    progress_json: {},
    question_json: { id: 'q-test', body: 'Q' },
  }, overrides || {});
}

describe('Stage 1B B3 — restoreCirclesPhase1FromSession populates circlesScoreResult', () => {
  let restoreFn;
  let AppState;

  beforeEach(() => {
    // Boot fresh app context. Implementer: adapt to existing harness.
    ({ restoreFn, AppState } = loadAppForTest());
  });

  test('B3-U1: drill C1 with step_scores.C1.totalScore=72 → circlesScoreResult.totalScore===72', () => {
    const item = makeItem({ mode: 'drill', drill_step: 'C1', step_scores: { C1: { totalScore: 72, axisScores: {} } } });
    restoreFn(item);
    expect(AppState.circlesScoreResult).not.toBeNull();
    expect(AppState.circlesScoreResult.totalScore).toBe(72);
  });

  test('B3-U2: sim mode sim_step_index=3 → uses step_scores.C2', () => {
    const item = makeItem({ mode: 'simulation', drill_step: null, sim_step_index: 3, step_scores: { C2: { totalScore: 81 } } });
    restoreFn(item);
    expect(AppState.circlesScoreResult).not.toBeNull();
    expect(AppState.circlesScoreResult.totalScore).toBe(81);
  });

  test('B3-U3: empty step_scores → circlesScoreResult === null (spinner correct)', () => {
    const item = makeItem({ step_scores: {} });
    restoreFn(item);
    expect(AppState.circlesScoreResult).toBeNull();
  });

  test('B3-U4: step_scores.C1.totalScore === null → circlesScoreResult === null (partial eval)', () => {
    const item = makeItem({ mode: 'drill', drill_step: 'C1', step_scores: { C1: { totalScore: null } } });
    restoreFn(item);
    expect(AppState.circlesScoreResult).toBeNull();
  });

  test('B3-U5: sim_step_index 0..6 maps to C1/I/R/C2/L/E/S correctly', () => {
    const STEPS = ['C1', 'I', 'R', 'C2', 'L', 'E', 'S'];
    STEPS.forEach((stepKey, i) => {
      const fresh = loadAppForTest();
      const item = makeItem({
        mode: 'simulation',
        drill_step: null,
        sim_step_index: i,
        step_scores: { [stepKey]: { totalScore: 50 + i } },
      });
      fresh.restoreFn(item);
      expect(fresh.AppState.circlesScoreResult).not.toBeNull();
      expect(fresh.AppState.circlesScoreResult.totalScore).toBe(50 + i);
    });
  });
});

// loadAppForTest helper — implementer fills in with project-canonical harness
function loadAppForTest() {
  throw new Error('IMPLEMENTER: replace with existing harness pattern from tests/issue2b-offcanvas-phase-restore.test.js or similar');
}
```

- [ ] **Step 3: Run jest and confirm RED**

```bash
npx jest tests/unit/circles-restore-phase3.test.js 2>&1 | tail -40
```
Expected: 5 FAIL. Either harness error from placeholder `loadAppForTest` (which the implementer fixes by reading the existing harness pattern) OR — once harness wired — failures with `Received: null` on B3-U1, B3-U2, B3-U5 because the production code does not yet set `circlesScoreResult`. B3-U3 + B3-U4 may already pass on the null-default path; record which ones are red vs already-green.

- [ ] **Step 4: Commit (RED)**

```bash
git add tests/unit/circles-restore-phase3.test.js
git commit -m "test(stage-1b-b3): RED — 5 unit specs for restoreCirclesPhase1FromSession score derivation

Spec ref: 2026-05-16-stage-1b §6 B3-U1..U5. Production code does not yet copy
step_scores[stepKey] into circlesScoreResult; B3-U1/U2/U5 fail with null.
B3-U3/U4 guard the null-default path."
```

---

## Task 2: B3 — implement 6-LOC derivation patch in `restoreCirclesPhase1FromSession`

**Files:**
- Modify: `public/app.js:7944` (insert 6 lines AFTER existing `AppState.circlesStepScores = item.step_scores || {};`)

**Why:** Spec §2: derive `stepKey` per existing app.js:6556–6561 rule then assign `circlesScoreResult = step_scores[stepKey] || null` with `totalScore != null` guard. Pure read of already-restored memory — no API call, no new AppState key, no auto phase-jump (line 7932 safe-landing policy preserved per spec §8).

- [ ] **Step 1: Insert the 6-line patch**

After `AppState.circlesStepScores = item.step_scores || {};` (current line 7944), insert:

```js
    // Stage 1B B3 fix: derive circlesScoreResult from restored step_scores so
    // a later click of "回評分" renders Phase 3 score UI instead of spinning.
    // Mirrors the normal eval-completion path at app.js:6556–6561.
    var __stepKey = AppState.circlesMode === 'drill'
      ? (AppState.circlesDrillStep || 'C1')
      : (['C1','I','R','C2','L','E','S'][AppState.circlesSimStep || 0] || 'C1');
    var __scoreRow = (AppState.circlesStepScores && AppState.circlesStepScores[__stepKey]) || null;
    AppState.circlesScoreResult = (__scoreRow && __scoreRow.totalScore != null) ? __scoreRow : null;
```

Important: `AppState.circlesMode` was set 4 lines earlier (line 7924) to `'drill'` or `'sim'`. The string equality check above uses `=== 'drill'`. Verify by reading lines 7923–7925 — if existing code uses `'simulation'` not `'sim'` as the contrast value, the ternary is still correct because the only path that derives via drill_step is the explicit `'drill'` match.

- [ ] **Step 2: Run jest and confirm GREEN**

```bash
npx jest tests/unit/circles-restore-phase3.test.js 2>&1 | tail -20
```
Expected: 5 PASS, 0 FAIL.

- [ ] **Step 3: Run baseline jest to confirm no regression**

```bash
npx jest 2>&1 | tail -10
```
Expected: baseline counts hold (170/187 floor per CLAUDE.md — adjust if Stage 1A added new green specs). Zero new failures from B3 patch.

- [ ] **Step 4: Commit (GREEN)**

```bash
git add public/app.js tests/unit/circles-restore-phase3.test.js
git commit -m "fix(stage-1b-b3): derive circlesScoreResult from restored step_scores

6-LOC patch in restoreCirclesPhase1FromSession after circlesStepScores assignment.
Mirrors normal eval path at app.js:6556–6561. Spinner-forever bug on offcanvas
restore of completed CIRCLES sessions resolved. Preserves Phase=1 safe-landing
(line 7932). 5/5 B3-U specs green; baseline jest unchanged."
```

---

## Task 3: B3 — Playwright E2E specs (3 cases, `assertions-and-waiting` skill applied)

**Files:**
- Create: `tests/e2e/circles-phase3-restore.spec.js`
- Modify: `tests/e2e/playwright.config.js` (extend testMatch regex on the 3 E2E project blocks)

**Why:** Spec §6 B3-E1..E3 + §7 B3-AC5 require Mobile-360 + Desktop-1280 (and per memory `feedback_ios_review_before_ship` Mobile Safari) coverage. Use `page.evaluate()` AppState injection per spec §6 line 221, mirroring `tests/e2e/circles-gate.spec.js` boot pattern. Apply `playwright-skill/core/assertions-and-waiting.md` web-first `expect(locator).toBeVisible()` / `not.toBeVisible()` auto-retry to assert spinner is GONE and score UI is PRESENT deterministically — no fixed `waitForTimeout`.

- [ ] **Step 1: Inspect spinner + score-UI DOM markers in renderCirclesPhase3**

```bash
grep -nE "phase3.*loading|phase-3-loading|circlesScoreResult|score-card|score__|data-phase3" public/app.js | head -30
```
Use the discovered selectors in Step 2. Most likely: `.score-card`, `[data-circles="phase3"]`, `.loading-overlay`, or `<i class="ph ph-circle-notch">` for the spinner. Verify in DOM via `npx playwright codegen http://localhost:3000` if grep is ambiguous.

- [ ] **Step 2: Create `tests/e2e/circles-phase3-restore.spec.js`**

```js
// tests/e2e/circles-phase3-restore.spec.js
// Stage 1B B3 — Phase 3 restore E2E specs.
// Spec ref: 2026-05-16-stage-1b §6 B3-E1..E3 + §7 B3-AC5.
// Pattern: reuse bootToPhase1Drill from circles-gate.spec.js (stubs GET list endpoints,
// clears localStorage), then page.evaluate to inject AppState with completed step_scores,
// then click "回評分" and assert score UI visible / spinner gone via web-first retry.
// Skill ref: playwright-skill/core/assertions-and-waiting.md (not.toBeVisible auto-retry).

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');

// SELECTORS — verify against actual DOM in Step 1 grep + codegen
const SELECTORS = {
  scoreUI: '[data-circles="phase3-score"], .score-card, .phase-3-score',
  spinner: '.phase-3-loading, [data-phase3="loading"], .loading-overlay',
  backToScoreBtn: 'button:has-text("回評分"), [data-action="back-to-score"]',
};

async function bootCirclesEmpty(page) {
  // Identical setup to circles-gate.spec.js bootToPhase1Drill: clear LS, stub GET lists.
  await page.addInitScript(() => { try { localStorage.removeItem('pmDrillState'); } catch (_) {} });
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson })
    : route.continue();
  await page.route('**/api/circles-sessions*', stubGet);
  await page.route('**/api/guest-circles-sessions*', stubGet);
  await page.route('**/api/nsm-sessions*', stubGet);
  await page.route('**/api/guest/nsm-sessions*', stubGet);
  await page.goto('/');
  // Wait for app boot — mode-selector or equivalent landing element
  await page.waitForFunction(() => window.AppState && window.render);
}

async function injectCompletedSession(page, opts) {
  await page.evaluate((o) => {
    const fakeItem = {
      id: 'e2e-b3-' + Date.now(),
      mode: o.mode,
      drill_step: o.drill_step,
      sim_step_index: o.sim_step_index || 0,
      step_scores: o.step_scores,
      framework_draft: {},
      step_drafts: {},
      conversation: [],
      question_json: { id: 'q-e2e', body: 'E2E 題目' },
    };
    // restoreCirclesPhase1FromSession is internal to the IIFE; trigger via the
    // public history-click path which is the actual user flow.
    window.AppState.historyList = [fakeItem];
    window.loadCirclesSessionFromHistory ? window.loadCirclesSessionFromHistory(fakeItem)
      : window.AppState._restoreShim && window.AppState._restoreShim(fakeItem);
    window.render && window.render();
  }, opts);
}

test.describe('Stage 1B B3 — Phase 3 restore renders score UI', () => {
  test('B3-E1: drill C1 with step_scores.C1.totalScore present → click 回評分 → score UI visible', async ({ page }) => {
    await bootCirclesEmpty(page);
    await injectCompletedSession(page, {
      mode: 'drill', drill_step: 'C1',
      step_scores: { C1: { totalScore: 78, axisScores: { S: 80, A: 75, M: 76, R: 78, T: 80 } } },
    });
    // Click "回評分" (button appears on Phase 1 for completed sessions)
    await page.locator(SELECTORS.backToScoreBtn).first().click();
    // Web-first auto-retry: score UI visible, spinner NOT visible
    await expect(page.locator(SELECTORS.scoreUI).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(SELECTORS.spinner).first()).not.toBeVisible();
  });

  test('B3-E2: empty step_scores → click 回評分 → spinner visible (regression guard)', async ({ page }) => {
    await bootCirclesEmpty(page);
    await injectCompletedSession(page, {
      mode: 'drill', drill_step: 'C1', step_scores: {},
    });
    await page.locator(SELECTORS.backToScoreBtn).first().click();
    // For partial sessions, spinner is the CORRECT behavior — guard against B3 over-fix
    await expect(page.locator(SELECTORS.spinner).first()).toBeVisible({ timeout: 5_000 });
  });

  test('B3-E3: sim session, sim_step_index=6 (S slot), step_scores.S present → score UI visible', async ({ page }) => {
    await bootCirclesEmpty(page);
    await injectCompletedSession(page, {
      mode: 'simulation', drill_step: null, sim_step_index: 6,
      step_scores: { S: { totalScore: 85, axisScores: {} } },
    });
    await page.locator(SELECTORS.backToScoreBtn).first().click();
    await expect(page.locator(SELECTORS.scoreUI).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(SELECTORS.spinner).first()).not.toBeVisible();
  });
});
```

- [ ] **Step 3: Extend `tests/e2e/playwright.config.js` testMatch**

Edit lines 56, 64, 73 — change:
```js
testMatch: /circles-gate\.spec\.js$/,
```
to (all three project blocks):
```js
testMatch: /(circles-gate|circles-phase3-restore|offcanvas-delete)\.spec\.js$/,
```

- [ ] **Step 4: Run E2E and confirm 3 specs × 3 projects = 9 cases pass**

```bash
npx playwright test --config tests/e2e/playwright.config.js circles-phase3-restore 2>&1 | tail -30
```
Expected: 9 passed (3 specs × Desktop Chrome + Mobile Chrome + Mobile Safari). If selectors mismatch, fix the `SELECTORS` const in Step 2 by inspecting the failing screenshot under `playwright-report/`.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/circles-phase3-restore.spec.js tests/e2e/playwright.config.js
git commit -m "test(stage-1b-b3): 3 E2E specs for Phase 3 restore + spinner-gone regression guard

Spec ref: 2026-05-16-stage-1b §6 B3-E1..E3 + §7 B3-AC5. Reuses circles-gate
bootToPhase1Drill stub pattern + page.evaluate AppState injection. Web-first
expect(...).not.toBeVisible() retry per playwright-skill assertions-and-waiting.
9/9 cases green across desktop/mobile-chrome/mobile-safari projects."
```

---

## Task 4: B4 — failing unit tests for offcanvas DELETE snapshot + rollback

**Files:**
- Create: `tests/unit/circles-delete-rollback.test.js`
- Reference (do not modify yet): `public/app.js:8127–8140`

**Why:** Spec §6 B4-U1..U4 lock the 4 rollback scenarios (200 / 500 / network-reject / 404-as-success) into jest BEFORE the await refactor. The DELETE handler is bound inside the offcanvas binder closure; tests must extract via the same harness used for B3 unit tests.

- [ ] **Step 1: Write 4 failing jest specs**

Create `tests/unit/circles-delete-rollback.test.js`:

```js
// tests/unit/circles-delete-rollback.test.js
// Stage 1B B4 — offcanvas DELETE snapshot + rollback unit specs.
// Spec ref: 2026-05-16-stage-1b §6 B4-U1..U4.

describe('Stage 1B B4 — offcanvas delete handler rollback semantics', () => {
  let handler;        // function (id) => Promise — exposed test hook
  let AppState;
  let mockApiFetch;

  beforeEach(() => {
    // Implementer harness: load app.js IIFE, expose deleteOffcanvasItem(id) on
    // window for test (production behavior unchanged — hook is debug-only).
    ({ handler, AppState } = loadDeleteHandlerForTest());
    mockApiFetch = jest.fn();
    window.apiFetch = mockApiFetch;
    AppState.historyList = [
      { id: 'a', mode: 'drill', drill_step: 'C1' },
      { id: 'b', mode: 'drill', drill_step: 'C1' },
      { id: 'c', mode: 'drill', drill_step: 'C1' },
    ];
    AppState.accessToken = 'tok';
  });

  test('B4-U1: apiFetch resolves 200 → list stays filtered, no rollback', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await handler('b');
    expect(AppState.historyList.map(i => i.id)).toEqual(['a', 'c']);
    expect(AppState._resumeToastShow).not.toBe(true);
  });

  test('B4-U2: apiFetch resolves 500 → list rolled back to original', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await handler('b');
    expect(AppState.historyList.map(i => i.id)).toEqual(['a', 'b', 'c']);
    expect(AppState._resumeToastMsg).toBe('刪除失敗，請再試一次');
    expect(AppState._resumeToastShow).toBe(true);
  });

  test('B4-U3: apiFetch rejects (network) → list rolled back + toast', async () => {
    mockApiFetch.mockRejectedValue(new Error('network'));
    await handler('b');
    expect(AppState.historyList.map(i => i.id)).toEqual(['a', 'b', 'c']);
    expect(AppState._resumeToastMsg).toBe('刪除失敗，請再試一次');
    expect(AppState._resumeToastShow).toBe(true);
  });

  test('B4-U4: apiFetch resolves 404 → treated as success, no rollback, no toast', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await handler('b');
    expect(AppState.historyList.map(i => i.id)).toEqual(['a', 'c']);
    expect(AppState._resumeToastShow).not.toBe(true);
  });
});

function loadDeleteHandlerForTest() {
  throw new Error('IMPLEMENTER: expose deleteOffcanvasItem on window via test-only hook, or use the same harness pattern as B3 unit specs');
}
```

- [ ] **Step 2: Run jest and confirm RED**

```bash
npx jest tests/unit/circles-delete-rollback.test.js 2>&1 | tail -30
```
Expected: 4 FAIL. Current production code fires-and-forgets; even when wrapped in an async test the `.catch(function(){})` swallows everything, so rollback assertions never fire.

- [ ] **Step 3: Commit (RED)**

```bash
git add tests/unit/circles-delete-rollback.test.js
git commit -m "test(stage-1b-b4): RED — 4 unit specs for offcanvas delete snapshot/rollback

Spec ref: 2026-05-16-stage-1b §6 B4-U1..U4. Current fire-and-forget handler
fails rollback semantics — no snapshot, no await, no toast."
```

---

## Task 5: B4 — implement await + snapshot + rollback + toast patch

**Files:**
- Modify: `public/app.js:8127–8140` (replace fire-and-forget delete branch)

**Why:** Spec §2 + §4 — convert `apiFetch(...).catch(function(){})` to an async IIFE with snapshot before optimistic filter, await response, rollback on non-2xx (except 404) or network error, reuse `_resumeToast` helper for "刪除失敗，請再試一次". Eliminates the cache race; UX latency unchanged for the happy path because the optimistic filter still runs before await.

- [ ] **Step 1: Replace lines 8127–8140**

Current:
```js
        } else if (action === 'delete') {
          const id = el.dataset.id;
          // route to correct endpoint based on session kind (mirror loadCirclesSessionFromHistory heuristic)
          const item = (AppState.historyList || []).find(function (i) { return String(i.id) === String(id); });
          const isNsm = item && !item.mode && !item.drill_step;
          AppState.historyList = AppState.historyList.filter(function (i) { return i.id !== id; });
          render();
          var path;
          if (isNsm) {
            path = AppState.accessToken ? '/api/nsm-sessions/' + id : '/api/guest/nsm-sessions/' + id;
          } else {
            path = AppState.accessToken ? '/api/circles-sessions/' + id : '/api/guest-circles-sessions/' + id;
          }
          window.apiFetch(path, { method: 'DELETE' }).catch(function () {});
        } else if (action === 'item') {
```

Replace with:
```js
        } else if (action === 'delete') {
          const id = el.dataset.id;
          // route to correct endpoint based on session kind (mirror loadCirclesSessionFromHistory heuristic)
          const item = (AppState.historyList || []).find(function (i) { return String(i.id) === String(id); });
          const isNsm = item && !item.mode && !item.drill_step;
          // Stage 1B B4: snapshot BEFORE optimistic filter so we can rollback.
          const __originalList = (AppState.historyList || []).slice();
          AppState.historyList = AppState.historyList.filter(function (i) { return i.id !== id; });
          render();
          var path;
          if (isNsm) {
            path = AppState.accessToken ? '/api/nsm-sessions/' + id : '/api/guest/nsm-sessions/' + id;
          } else {
            path = AppState.accessToken ? '/api/circles-sessions/' + id : '/api/guest-circles-sessions/' + id;
          }
          // Stage 1B B4: await + rollback. 404 = already gone server-side = treat as success.
          (async function () {
            try {
              const resp = await window.apiFetch(path, { method: 'DELETE' });
              if (!resp || (!resp.ok && resp.status !== 404)) throw new Error('delete-failed-' + (resp && resp.status));
            } catch (_err) {
              AppState.historyList = __originalList;
              AppState._resumeToastMsg = '刪除失敗，請再試一次';
              AppState._resumeToastShow = true;
              render();
              setTimeout(function () { AppState._resumeToastShow = false; render(); }, 6000);
            }
          })();
        } else if (action === 'item') {
```

- [ ] **Step 2: Expose test hook (debug-only, no production side-effects)**

If the B4 unit specs in Task 4 require a hook, add ONE line in the same offcanvas binder scope (near the top of the binder fn, BEFORE the click handler) — gated to test:

```js
        // Test-only hook: expose delete-by-id handler for unit specs. No effect in prod.
        if (typeof window !== 'undefined' && window.__test_exposeDeleteHandler) {
          window.__test_deleteOffcanvasItem = function (id) {
            const el = document.createElement('div');
            el.dataset.id = id;
            // Synthesize a click event that the existing delegated handler accepts.
            // … implementer adapts to whichever delegation pattern the binder uses.
          };
        }
```

If wiring a synthetic-click hook is cleaner than refactoring to a named exportable fn, prefer that. Goal: jest can call the same code path the click handler runs. If the existing harness in `tests/issue2b-offcanvas-phase-restore.test.js` already has a click-simulator helper, reuse it and skip this hook.

- [ ] **Step 3: Run jest and confirm GREEN**

```bash
npx jest tests/unit/circles-delete-rollback.test.js 2>&1 | tail -15
```
Expected: 4 PASS.

```bash
npx jest 2>&1 | tail -10
```
Expected: baseline holds, zero new failures.

- [ ] **Step 4: Commit (GREEN)**

```bash
git add public/app.js tests/unit/circles-delete-rollback.test.js
git commit -m "fix(stage-1b-b4): await DELETE + snapshot/rollback + reuse _resumeToast for error

Replaces fire-and-forget apiFetch().catch with async IIFE. Snapshot original
historyList BEFORE optimistic filter; await response; rollback on non-2xx
(except 404 = already gone server-side); reuse existing _resumeToast helper
(app.js:3008–3070 + 7842–7847 pattern) with zh-TW '刪除失敗，請再試一次'.
4/4 B4-U specs green; baseline jest unchanged."
```

---

## Task 6: B4 — API contract specs (3 cases, cache-invalidation regression guard)

**Files:**
- Modify: `tests/circles-sessions.test.js` (extend with 3 new specs)

**Why:** Spec §6 B4-A1..A3 require server-side regression guards proving DELETE 200 + immediate GET returns fresh list (`session-cache.invalidate()` actually called on the route). Existing `tests/circles-sessions.test.js` already uses a mocked-db chainable harness; extend it without adding a new test file.

- [ ] **Step 1: Inspect existing test file structure**

```bash
grep -nE "describe|test\(|beforeEach|DELETE|invalidate|cache" tests/circles-sessions.test.js | head -30
```
Identify the existing DELETE-route block (if any) and the cache mock pattern.

- [ ] **Step 2: Add 3 new specs at the end of the describe block**

Append (adapt to existing file's describe nesting):

```js
  describe('Stage 1B B4 — DELETE cache invalidation (regression guard)', () => {
    test('B4-A1: auth DELETE /api/circles-sessions/:id → 200 + subsequent GET excludes id', async () => {
      // Arrange: seed mock DB with 2 sessions, mock cache.invalidate as a spy.
      const cacheModule = require('../lib/session-cache');
      const invalidateSpy = jest.spyOn(cacheModule, 'invalidate');
      // … invoke route handler for DELETE /api/circles-sessions/:id with id='b'
      // … expect 200, expect invalidateSpy called with the auth-list cache key
      // … invoke GET /api/circles-sessions
      // … expect response body excludes id='b'
      expect(invalidateSpy).toHaveBeenCalled();
    });

    test('B4-A2: guest DELETE /api/guest-circles-sessions/:id → 200 + cache invalidated', async () => {
      // Same pattern for routes/guest-circles-sessions.js
    });

    test('B4-A3: DELETE with unknown id → 404, cache untouched', async () => {
      const cacheModule = require('../lib/session-cache');
      const invalidateSpy = jest.spyOn(cacheModule, 'invalidate');
      // … invoke DELETE with id='nonexistent'
      // … expect 404 response
      // … expect invalidateSpy NOT called (or called 0 times for this id)
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
```

Implementer: fill in the route invocation matching the harness pattern already in the file (likely `require('../routes/circles-sessions')` + supertest or direct handler call with mocked `req`/`res`).

- [ ] **Step 3: Run jest and confirm 3 GREEN**

```bash
npx jest tests/circles-sessions.test.js 2>&1 | tail -20
```
Expected: prior specs hold + 3 new specs pass.

- [ ] **Step 4: Commit**

```bash
git add tests/circles-sessions.test.js
git commit -m "test(stage-1b-b4): API contract regression guards for DELETE cache invalidation

Spec ref: 2026-05-16-stage-1b §6 B4-A1..A3. Spies on lib/session-cache.invalidate
to prove route handlers call it on DELETE 200 + skip it on DELETE 404. Closes the
gap where a future regression could re-introduce the FE/cache race even after
the FE await fix."
```

---

## Task 7: B4 — Playwright E2E specs (3 cases, real DELETE + 500 intercept + NSM)

**Files:**
- Create: `tests/e2e/offcanvas-delete.spec.js`

**Why:** Spec §6 B4-E1..E3 + §7 B4-AC1..AC6. Combine `playwright-skill/core/assertions-and-waiting.md` web-first retries (deterministic "item gone" / "item reappears") with `playwright-skill/playwright-cli/request-mocking.md` `page.route()` intercept for the 500 case. B4-E1 (real DELETE) is the CORE regression guard — no mocking, real DB session, per memory `feedback_e2e_real_data_only`.

- [ ] **Step 1: Create `tests/e2e/offcanvas-delete.spec.js`**

```js
// tests/e2e/offcanvas-delete.spec.js
// Stage 1B B4 — offcanvas delete + cache race E2E specs.
// Spec ref: 2026-05-16-stage-1b §6 B4-E1..E3 + §7 B4-AC1..AC6.
// Pattern: B4-E1 real DELETE + real loadHistory (no mock — per memory
// feedback_e2e_real_data_only); B4-E2 page.route intercept returns 500 to
// drive rollback + toast; B4-E3 same as B4-E1 but for NSM endpoint.
// Skill refs:
//   - playwright-skill/core/assertions-and-waiting.md (web-first retry on .not.toBeVisible)
//   - playwright-skill/playwright-cli/request-mocking.md (page.route 500 stub)

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');
const factory = require('../factories/circles-phase1.factory');

const SELECTORS = {
  offcanvasOpen: '[data-action="offcanvas-toggle"], button:has-text("歷史紀錄")',
  offcanvasItem: (id) => `[data-offcanvas="item"][data-id="${id}"]`,
  deleteBtn: (id) => `[data-offcanvas="delete"][data-id="${id}"]`,
  toast: '.resume-toast',
  toastBody: '.resume-toast__body',
};

async function createRealCirclesSessionThenOpenOffcanvas(page) {
  // Implementer: use the existing storageState auth + minimal Phase 1 submit
  // path to land a real DB row. Helper can be shared with circles-gate.spec.js
  // if the implementer extracts it. For now, inline the steps that already
  // work in circles-gate's "happy" spec.
  await page.goto('/');
  await page.waitForFunction(() => window.AppState && window.render);
  // … minimal flow: select drill C1, fill quality factory, submit, land Phase 2.
  // Return the created session id from window.AppState.circlesSession.id.
  const id = await page.evaluate(() => window.AppState.circlesSession && window.AppState.circlesSession.id);
  expect(id).toBeTruthy();
  // Open offcanvas
  await page.locator(SELECTORS.offcanvasOpen).first().click();
  await expect(page.locator(SELECTORS.offcanvasItem(id))).toBeVisible();
  return id;
}

test.describe('Stage 1B B4 — offcanvas delete + cache race', () => {
  test('B4-E1: real DELETE → immediate re-open → deleted item absent (core regression)', async ({ page }) => {
    const id = await createRealCirclesSessionThenOpenOffcanvas(page);
    // Delete
    await page.locator(SELECTORS.deleteBtn(id)).click();
    // Web-first retry: item gone immediately (optimistic filter)
    await expect(page.locator(SELECTORS.offcanvasItem(id))).not.toBeVisible();
    // Close + re-open offcanvas immediately (the race window)
    await page.keyboard.press('Escape');
    await page.locator(SELECTORS.offcanvasOpen).first().click();
    // Auto-retry until loadHistory GET settles — deleted item must NOT come back
    await expect(page.locator(SELECTORS.offcanvasItem(id))).not.toBeVisible({ timeout: 10_000 });
  });

  test('B4-E2: intercept DELETE → 500 → item reappears + toast visible', async ({ page }) => {
    const id = await createRealCirclesSessionThenOpenOffcanvas(page);
    // Intercept JUST this DELETE — return 500
    await page.route('**/api/circles-sessions/' + id, (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });
    await page.route('**/api/guest-circles-sessions/' + id, (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });
    await page.locator(SELECTORS.deleteBtn(id)).click();
    // Web-first retry: item reappears after rollback fires
    await expect(page.locator(SELECTORS.offcanvasItem(id))).toBeVisible({ timeout: 5_000 });
    // Toast visible with zh-TW copy
    await expect(page.locator(SELECTORS.toast)).toBeVisible();
    await expect(page.locator(SELECTORS.toastBody)).toContainText('刪除失敗，請再試一次');
  });

  test('B4-E3: NSM session DELETE → immediate re-open → deleted item absent', async ({ page }) => {
    // Implementer: create a real NSM session (mirror pattern in any existing
    // NSM E2E or via API seed). Then identical flow to B4-E1 against
    // /api/nsm-sessions/:id. Skip if no NSM E2E helper exists yet — leave a
    // TODO comment referencing this plan so it lands in a follow-up.
    test.skip(true, 'NSM seed helper TBD — track in P3 follow-ups');
  });
});
```

- [ ] **Step 2: Run E2E (3 specs × 3 projects)**

```bash
npx playwright test --config tests/e2e/playwright.config.js offcanvas-delete 2>&1 | tail -30
```
Expected: B4-E1 + B4-E2 green × 3 projects = 6 green + B4-E3 skipped × 3 = 3 skipped. If B4-E3 helper lands during implementation, drop the `test.skip` and confirm 9/9.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/offcanvas-delete.spec.js
git commit -m "test(stage-1b-b4): 3 E2E specs for offcanvas delete cache race + 500 rollback

Spec ref: 2026-05-16-stage-1b §6 B4-E1..E3 + §7 B4-AC1..AC6. B4-E1 real
DELETE + immediate re-open (per memory feedback_e2e_real_data_only — no
mocks for session data); B4-E2 page.route 500 intercept drives rollback +
toast assertion; B4-E3 NSM skipped pending seed helper. Skill refs:
playwright-skill/core/assertions-and-waiting.md +
playwright-skill/playwright-cli/request-mocking.md."
```

---

## Task 8: Full bundle regression + state-board update + ship

**Files:**
- Modify: `CLAUDE.md` (Last updated + Stage 1B ship line at top)

**Why:** Per `feedback_full_sit_uat_uiux` + `feedback_verification_before_completion` (IL-2): zero ship without full jest + full E2E green + visible state-board update.

- [ ] **Step 1: Full jest run**

```bash
npx jest 2>&1 | tail -15
```
Expected: baseline + 9 new (5 B3-U + 4 B4-U) + 3 new B4-A = baseline + 12 passing. Zero new failures. Record exact counts.

- [ ] **Step 2: Full E2E run on the gate config**

```bash
npx playwright test --config tests/e2e/playwright.config.js 2>&1 | tail -20
```
Expected: Stage 1A gate specs hold + 6 new B3-E specs green (3 specs × 3 projects, treating B3-E2 as a regression-guard not over-fix) + 6 new B4-E green (B4-E1 + B4-E2 × 3 projects; B4-E3 skipped × 3). Total: prior + 12 new green + 3 skipped.

- [ ] **Step 3: iOS Safari static review (per `feedback_ios_review_before_ship`)**

Walk the 15-item iOS quirk checklist in Master Spec §0.2 against the B4 patch only (B3 is pure data — no UI quirks). Specific items to verify:
- (a) `setTimeout` for toast dismissal on iOS — already in use elsewhere in this file (line 7847), no new pattern.
- (b) `async` IIFE inside delegated click handler — confirm Safari 15+ supports (it does; no transpile needed).
- (c) Tap-close → immediate tap-open offcanvas (the bug repro) — verify no double-tap delay regression on iPhone-SE viewport.

Record findings in the Step 4 commit message.

- [ ] **Step 4: Update CLAUDE.md state board**

Update lines 5–8 (status block) — replace "Stage 0 ship (2026-05-16)" lead with a one-line Stage 1B ship and bump `Last updated`:

```markdown
> **Last updated:** 2026-05-16（Stage 1B ship — B3 score-derive + B4 await/rollback；單檔 +18 LOC；12 new green specs；baseline 不破）
```

Add one line under the bullet list:

```markdown
- **Stage 1B ship (2026-05-16)**：B3 (Phase 3 spinner stuck on restore) + B4 (offcanvas delete cache race) — `public/app.js` 單檔 +18 LOC；新 5 jest unit (B3-U) + 4 jest unit (B4-U) + 3 jest API contract (B4-A) + 6 Playwright E2E (B3-E + B4-E × 3 projects) 全綠；baseline jest + Stage 1A gate specs 不破；iOS Safari 15-item checklist PASS（toast setTimeout + async IIFE 已有先例）。
```

- [ ] **Step 5: Commit + push**

```bash
git add CLAUDE.md
git commit -m "ship(stage-1b): state/cache cluster B3 + B4

B3: derive circlesScoreResult from restored step_scores in
restoreCirclesPhase1FromSession (6 LOC after app.js:7944) — clicking '回評分'
on a restored completed CIRCLES session now renders the Phase 3 score UI
instead of spinning forever.

B4: replace fire-and-forget delete branch (app.js:8127–8140) with await +
snapshot/rollback + reuse of existing _resumeToast helper (zh-TW
'刪除失敗，請再試一次') — eliminates the 5 s server-cache race where
delete-then-quick-reopen showed the deleted item again.

Tests: 5 B3-U + 4 B4-U + 3 B4-A jest + 6 B3-E + 6 B4-E Playwright (3 specs
each × 3 e2e projects; B4-E3 NSM seed helper deferred to P3 follow-up).
Baseline jest holds; Stage 1A gate specs hold. iOS Safari 15-item checklist
PASS (toast setTimeout + async IIFE already in use elsewhere in app.js).

Spec ref: docs/superpowers/specs/2026-05-16-stage-1b-state-cache-design.md (2c6fa51)
Plan ref: docs/superpowers/plans/2026-05-16-stage-1b-state-cache-plan.md"

git push origin main
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| §2 B3 derivation block | Task 2 |
| §2 B4 await + rollback | Task 5 |
| §3 B3 component (+6 LOC at line 7944) | Task 2 |
| §3 B4 component (+12 / -2 at lines 8127–8140) | Task 5 |
| §4 B3 data flow + stepKey rule | Tasks 1 (locked in test) + 2 |
| §4 B4 data flow + snapshot/rollback path | Tasks 4 (test) + 5 (impl) |
| §5 B3 error handling (null guard) | Task 1 B3-U3 + U4 + Task 2 ternary |
| §5 B4 error handling (500 / network / 404 / close-before-resolve / sync invalidate) | Task 4 B4-U2/U3/U4 + Task 5 try/catch + Task 7 B4-E2 |
| §6 B3-U1..U5 jest unit | Task 1 |
| §6 B4-U1..U4 jest unit | Task 4 |
| §6 B4-A1..A3 API contract | Task 6 |
| §6 B3-E1..E3 Playwright | Task 3 |
| §6 B4-E1..E3 Playwright | Task 7 (B4-E3 skipped with explicit follow-up note) |
| §7 B3-AC1..AC5 | Tasks 1 + 3 |
| §7 B4-AC1..AC6 | Tasks 4 + 5 + 6 + 7 |
| §8 carve-outs (no backend / no TTL / no AppState key / Phase=1 preserved / no visual) | Honored across all tasks — `File Structure` "Files NOT touched" enumerates each carve-out |

All sections accounted for. One scope-shrink: B4-E3 (NSM happy-path E2E) is skipped with explicit `test.skip` + follow-up note because no NSM session-seed helper exists yet — flagged in plan, not silent.

**2. Placeholder scan:** Two intentional `IMPLEMENTER:` markers in Task 1 + Task 4 — both are explicit hand-offs to the existing harness pattern in `tests/issue2b-offcanvas-phase-restore.test.js`. These are NOT "TBD" or "implement later" — they tell the implementer exactly where to read for the harness. Task 7 B4-E3 has a `test.skip` with an explicit follow-up reason; not a TODO-without-owner. No other placeholders found.

**3. Type consistency:**
- `circlesScoreResult` consistent: Task 1 (assert), Task 2 (assign), Task 3 (E2E uses score-UI DOM selector — derived from the state). OK.
- `historyList` snapshot variable named `__originalList` in Task 5 — same name as `originalList` referenced in spec §4. Underscore prefix matches local-temp convention used elsewhere in app.js (e.g. `__stepKey` in Task 2). OK.
- `_resumeToastShow` + `_resumeToastMsg` consistent across Tasks 4 / 5 / 7. OK.
- `stepKey` derivation logic consistent across Task 1 B3-U5 (STEPS array) + Task 2 patch (same STEPS array inlined) + spec §4. OK.

No fixes needed. Plan ready for handoff.

---

## Playwright skill picked

**Primary:** `playwright-skill/core/assertions-and-waiting.md`

**Why:** The 1B fixes are pure behavioral / state-deterministic — both B3 ("spinner gone / score UI present after click") and B4 ("item gone after delete / reappears after 500 rollback") need DOM-state assertions that survive timing variability. The web-first `expect(locator).toBeVisible()` + `expect(locator).not.toBeVisible()` auto-retry pattern is the canonical primitive: it polls until the condition is met or the timeout fires, eliminating flaky `waitForTimeout(...)` sprinkles. This is the single most-important skill for "deterministic UI state assertion + rollback verification" — exactly the task framing.

**Secondary (used in Task 7 B4-E2 only):** `playwright-skill/playwright-cli/request-mocking.md` for the `page.route(..., r => r.fulfill({ status: 500 }))` intercept that drives the rollback assertion. Cited inline at the test file header.

Both skills referenced in commit messages per `feedback_two_stage_review_mandatory` audit-trail discipline.
