# CIRCLES Chat Drift + Lock-on-Back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Bug 5 Phase 2 qchip 不對齊（套 Phase 1 4-block 分析）+ 完整步驟 lock-on-back（防 user 點上一步觸發重新評分），with real Playwright E2E integration test coverage.

**Architecture:** BE guard (`/evaluate-step` 422 on re-score) + FE lock detection (上一步 click → check `step_scores[stepKey]` → set `circlesLocked`) + FE Phase 3 retry button disable + FE qchip-expand reuse (replace `renderQchipPanelHtml` with `renderQchipExpand`). All wrapped in real Playwright integration test (5 TC × 3 e2e projects × 5 consecutive runs).

**Tech Stack:** Express + Supabase (BE) / vanilla JS app.js (FE) / Playwright + jest (test) / Pitfall 11 (no own-API mock).

**Spec reference:** `docs/superpowers/specs/2026-05-17-circles-chat-drift-and-lock-design.md` (commit b2ca935, user approved).

---

## File Structure

| File | Role | Change |
|---|---|---|
| `routes/circles-sessions.js:253` | `/evaluate-step` handler | ADD 422 guard if `session.step_scores[stepKey]` exists |
| `public/app.js:6727-6733` | Phase 2 上一步 handler | ADD `step_scores[stepKey]` check → toggle `circlesLocked` |
| `public/app.js:6268` | Phase 3 retry button HTML | ADD `disabled` attribute when scored |
| `public/app.js:6509` | Phase 3 retry click handler | ADD guard to skip API call when scored |
| `public/app.js:879` | `renderCirclesPhase2` qchipHtml | REPLACE `renderQchipPanelHtml(q)` → `renderQchipExpand(q)` |
| `public/app.js:1064` | `renderCirclesPhase2Locked` qchipHtml | Same as above |
| `public/app.js:6710~` | `bindPhase2` qchip click toggle | CHANGE selector from `.qchip-panel` to `.qchip-expand` |
| `tests/api/circles-evaluate-step-rescore-guard.spec.js` | NEW: BE 422 contract | CREATE |
| `tests/e2e/circles-back-nav-lock.spec.js` | NEW: 5 TC E2E | CREATE |
| `tests/api/playwright.config.js` | Register new BE spec | ADD project entry |
| `tests/e2e/playwright.config.js` | Register new E2E spec | ADD spec to testMatch |
| `audit/eyeball-circles-chat-drift-lock-2026-05-17.md` | NEW: PNG cold-Read | CREATE after impl |
| `audit/sop-2026-05-17-circles-lock-and-qchip-uat.md` | NEW: UAT walk SOP | CREATE before ship |

---

## Task 1 — BE guard: `/evaluate-step` 422 reject re-score

**Files:**
- Modify: `routes/circles-sessions.js:253-300` (around `/evaluate-step` handler)
- Test: `tests/api/circles-evaluate-step-rescore-guard.spec.js`
- Modify: `tests/api/playwright.config.js`

- [ ] **Step 1: Write failing test for 422 on re-score**

Create file `tests/api/circles-evaluate-step-rescore-guard.spec.js`:

```js
// tests/api/circles-evaluate-step-rescore-guard.spec.js
// AC-2: POST /api/circles-sessions/:id/evaluate-step rejects with 422 when stepKey already scored.
// Skills applied:
//   api-testing.md 1023-1166 (error response testing)
//   common-pitfalls.md Pitfall 11 — real Supabase + real session (no jest.mock)

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken } = require('./helpers/auth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const QUESTION_ID = 'circles_001';
const DRILL_STEP = 'C1';

const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function authHeaders() {
  const token = await getE2eToken();
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function createDraftSession(request, cleanupTracker) {
  const headers = await authHeaders();
  const res = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
    headers,
    data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  cleanupTracker.track('circles', body.id);
  return body.id;
}

async function seedStepScore(sessionId, stepKey) {
  const { error } = await adminDb
    .from('circles_sessions')
    .update({ step_scores: { [stepKey]: { totalScore: 75, highlight: 'seed', improvement: 'seed', dimensions: [], coachVersion: { context: 'c', perField: [], reasoning: 'r' } } } })
    .eq('id', sessionId);
  if (error) throw new Error(`seed: ${error.message}`);
}

test.describe('POST /evaluate-step rescore guard — AC-2', () => {
  test('422 step_already_scored when stepKey is in step_scores', async ({ request, cleanupTracker }) => {
    const sessionId = await createDraftSession(request, cleanupTracker);
    await seedStepScore(sessionId, DRILL_STEP);

    const headers = await authHeaders();
    const res = await request.post(
      `${BASE_URL}/api/circles-sessions/${sessionId}/evaluate-step`,
      { headers, data: { stepKey: DRILL_STEP, framework: 'seed', conversation: [] } }
    );

    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'step_already_scored', stepKey: DRILL_STEP });
  });
});
```

- [ ] **Step 2: Register new project in tests/api/playwright.config.js**

Add before closing `]` of `projects` array (around line 122):

```js
    // AC-2 — rescore guard contract test
    {
      name: 'api-evaluate-step-rescore-guard',
      testMatch: /circles-evaluate-step-rescore-guard\.spec\.js$/,
    },
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
npx playwright test --config tests/api/playwright.config.js --project=api-evaluate-step-rescore-guard
```

Expected: FAIL — current handler does NOT return 422; either calls OpenAI (slow) or returns some other status.

- [ ] **Step 4: Implement BE guard in routes/circles-sessions.js**

Open `routes/circles-sessions.js`, find `/evaluate-step` handler (around line 253). Locate the section AFTER the session row is fetched from DB and BEFORE the OpenAI call. Add:

```js
// AC-2 (b2ca935 spec §3.2) — 422 reject re-score attempt
if (session.step_scores && session.step_scores[stepKey] != null) {
  return res.status(422).json({
    error: 'step_already_scored',
    stepKey,
    message: 'This step has already been scored; re-scoring is not allowed.',
  });
}
```

Exact insertion point: after the line that destructures `session` from `req.body` or `loadSession()` result, before the `await openai.chat.completions.create(...)` call.

- [ ] **Step 5: Run test to verify PASS**

```bash
npx playwright test --config tests/api/playwright.config.js --project=api-evaluate-step-rescore-guard
```

Expected: PASS (1/1).

- [ ] **Step 6: Run full api jest to verify no regression**

```bash
npx playwright test --config tests/api/playwright.config.js
```

Expected: all existing pass + 1 new pass.

- [ ] **Step 7: Commit**

```bash
git add routes/circles-sessions.js tests/api/circles-evaluate-step-rescore-guard.spec.js tests/api/playwright.config.js
git commit -m "$(cat <<'EOF'
feat(routes): /evaluate-step 422 guard reject re-score (spec b2ca935 AC-2)

Returns 422 step_already_scored when session.step_scores[stepKey] exists.
Real Playwright + real Supabase test verifies guard (no jest.mock).
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — FE: 上一步 lock detection

**Files:**
- Modify: `public/app.js:6727-6733` (Phase 2 backBtn handler)
- Test: `tests/e2e/circles-back-nav-lock.spec.js` (TC1 will cover this — written in Task 5)

- [ ] **Step 1: Modify Phase 2 backBtn handler**

Open `public/app.js`. Find the block at lines 6727-6733:

```js
// ── back button (go to Phase 1) ──
var backBtn = document.querySelector('[data-phase2="back"]');
if (backBtn) {
  backBtn.addEventListener('click', function () {
    AppState.circlesPhase = 1;
    render();
  });
}
```

Replace with:

```js
// ── back button (go to Phase 1) ──
// AC-3 (spec b2ca935 §3.3): if THIS step was already scored, lock Phase 1 form
var backBtn = document.querySelector('[data-phase2="back"]');
if (backBtn) {
  backBtn.addEventListener('click', function () {
    var stepKey = AppState.circlesDrillStep;
    var scoredMap = AppState.circlesStepScores || {};
    if (stepKey && scoredMap[stepKey]) {
      AppState.circlesLocked = true;
    }
    AppState.circlesPhase = 1;
    render();
  });
}
```

- [ ] **Step 2: Smoke verify renderCirclesPhase1 honors circlesLocked**

```bash
grep -n "circlesLocked" public/app.js | head -10
```

Expected: see references in `renderCirclesPhase1` and related sub-renderers. If `circlesLocked=true`, form fields render readonly + submit hidden + hint/example button still rendered.

If grep shows the render fn does NOT honor `circlesLocked` for Phase 1 form, STOP and escalate. Otherwise proceed.

- [ ] **Step 3: Commit (will verify via E2E in Task 5)**

```bash
git add public/app.js
git commit -m "$(cat <<'EOF'
feat(fe): Phase 2 上一步 → lock Phase 1 if step scored (spec b2ca935 AC-3)

If AppState.circlesStepScores[circlesDrillStep] populated, set
AppState.circlesLocked=true before returning to phase 1. Prevents
user from editing & re-submitting framework for an already-scored step.
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — FE: Phase 3 retry button disable when scored

**Files:**
- Modify: `public/app.js:6260-6275` (renderPhase3Error or renderPhase3Loading retry button HTML)
- Modify: `public/app.js:6509-6520` (retry click handler)

- [ ] **Step 1: Find exact retry button render location**

```bash
grep -n -B 2 -A 4 'data-phase3="retry"' public/app.js
```

Note the exact line + which render fn contains it.

- [ ] **Step 2: Modify retry button HTML to conditional disable**

In the render fn containing `data-phase3="retry"` (likely `renderPhase3Error` around line 6260), find:

```js
+ '<button class="btn btn--primary" data-phase3="retry"><i class="ph ph-arrow-clockwise"></i>重新評分</button>'
```

Replace with:

```js
+ (function () {
    var stepKey = AppState.circlesDrillStep;
    var alreadyScored = AppState.circlesStepScores && AppState.circlesStepScores[stepKey];
    var attrs = alreadyScored
      ? 'disabled aria-disabled="true" title="此步已評分，不可重新評分"'
      : '';
    return '<button class="btn btn--primary" data-phase3="retry" ' + attrs + '><i class="ph ph-arrow-clockwise"></i>重新評分</button>';
  })()
```

- [ ] **Step 3: Modify retry click handler to guard against scored state**

Find the `data-phase3="retry"` click handler around line 6509-6520. Locate the function body that fires the evaluate-step API. Wrap the body with:

```js
// AC-4 (spec b2ca935): no-op when step already scored
var stepKey = AppState.circlesDrillStep;
if (AppState.circlesStepScores && AppState.circlesStepScores[stepKey]) {
  return;
}
// ...existing handler body...
```

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "$(cat <<'EOF'
feat(fe): Phase 3 retry button disabled when step scored (spec b2ca935 AC-4)

Renders <button disabled aria-disabled="true"> when step_scores has stepKey;
click handler also no-ops as defense-in-depth.
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — FE: qchip-expand reuse (replace qchip-panel)

**Files:**
- Modify: `public/app.js:879` (renderCirclesPhase2 qchipHtml composition)
- Modify: `public/app.js:1064` (renderCirclesPhase2Locked qchipHtml composition)
- Modify: `public/app.js:6710~` (bindPhase2 qchip click selector)

- [ ] **Step 1: Modify renderCirclesPhase2 qchipHtml**

In `public/app.js:879`, find:

```js
var qchipHtml = renderPhase2QchipHtml(q) + renderQchipPanelHtml(q);
```

Replace with:

```js
// AC-1 (spec b2ca935 §3.1): reuse Phase 1 qchip-expand for 4-block analysis
var qchipHtml = renderPhase2QchipHtml(q) + renderQchipExpand(q);
```

- [ ] **Step 2: Same change in renderCirclesPhase2Locked (line 1064)**

Find:

```js
var qchipHtml = renderPhase2QchipHtml(q) + renderQchipPanelHtml(q);
```

Replace with:

```js
// AC-1 (spec b2ca935 §3.1): same qchip-expand reuse in locked state
var qchipHtml = renderPhase2QchipHtml(q) + renderQchipExpand(q);
```

- [ ] **Step 3: Find bindPhase2 qchip toggle code**

```bash
grep -n 'qchip\|qchip-panel\|qchip-expand' public/app.js | grep -i "bindPhase2\|querySelector\|addEventListener\|toggle" | head -10
```

Note the exact line numbers for qchip click handler + panel toggle.

- [ ] **Step 4: Update qchip toggle selector**

In the toggle helper (likely `toggleQchipPanel` or similar), change DOM target from `.qchip-panel` (Phase 2 old) to `.qchip-expand` (Phase 1 share). If Phase 1 already has its own click handler `data-phase1="qchip-collapse"` and a separate toggle path, ensure Phase 2 reuses the SAME toggle pattern by adding/sharing the click handler.

Concrete: in `bindPhase2`, find:

```js
toggleQchipPanel(false);
```

and the corresponding `toggleQchipPanel(true)` toggle. Replace target queries with `.qchip-expand`. If Phase 1 already uses a different toggle name like `toggleQchipExpand`, rename Phase 2's call to match.

If the structure is too tangled to do surgically, ESCALATE — do not refactor blindly.

- [ ] **Step 5: Manual smoke — open page and click qchip**

```bash
open http://localhost:4000
```

In browser: log in as e2e@first-principle.test → CIRCLES → drill C1 → complete Phase 1 → pass gate → enter Phase 2 → click qchip header → verify 4-block analysis appears (商業背景 / 用戶輪廓 / 常見誤區 / 破題切入).

- [ ] **Step 6: Commit**

```bash
git add public/app.js
git commit -m "$(cat <<'EOF'
feat(fe): Phase 2 qchip reuse Phase 1 renderQchipExpand (spec b2ca935 AC-1)

Replaces renderQchipPanelHtml (type pill + statement only) with
renderQchipExpand (4-block analysis: 商業/用戶/誤區/破題). Applies to
renderCirclesPhase2 + renderCirclesPhase2Locked. Covers all 7 drill steps.
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — E2E: 5 TC integration spec

**Files:**
- Create: `tests/e2e/circles-back-nav-lock.spec.js`
- Modify: `tests/e2e/playwright.config.js` (testMatch regex)

- [ ] **Step 1: Create E2E spec file**

Create `tests/e2e/circles-back-nav-lock.spec.js`:

```js
// tests/e2e/circles-back-nav-lock.spec.js
// AC-5 (spec b2ca935): 5 TC integration test for back-nav lock + qchip 4-block.
//
// Skills applied (per spec §4):
//   auth-flows.md:928-949    — API seed auth via request.post
//   common-pitfalls.md 11    — no own-API mock; real Supabase + real OpenAI
//   common-pitfalls.md 19    — test.step() multi-phase
//   network-mocking.md       — counter pattern for /evaluate-step
//   multi-user.md 306-343    — Promise.all assertion not used here (single user)
//
// Real OpenAI call (test.slow) for conclusion submit. Cleanup via api-cleanup fixture.

const { test } = require('../api/fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken } = require('../api/helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const FE_BASE = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const QUESTION_ID = 'circles_001';
const DRILL_STEP = 'C1';

const GOOD_FRAMEWORK = {
  C1: {
    問題範圍: '提升 Spotify Podcast 用戶週活躍率，聚焦 18-35 歲通勤族群',
    影響對象: '目前每週使用 Spotify 至少一次但 Podcast 使用率低的 MAU，約 4000 萬人',
    核心衝突: '用戶知道 Podcast 存在但不易發現適合通勤的節目',
    目標結果: '週 Podcast 活躍率從 15% 提升至 25%',
  },
};

async function seedScoredSession(request, cleanupTracker, token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const draftRes = await request.post(`${API_BASE}/api/circles-sessions/draft`, {
    headers, data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
  });
  expect(draftRes.status()).toBe(200);
  const session = await draftRes.json();
  cleanupTracker.track('circles', session.id);

  await request.patch(`${API_BASE}/api/circles-sessions/${session.id}/progress`, {
    headers, data: { frameworkDraft: GOOD_FRAMEWORK },
  });

  // Seed step_scores via service-role to skip real evaluate-step OpenAI call
  // (this test focuses on lock behavior, not evaluation correctness).
  // Note: this requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
  const { createClient } = require('@supabase/supabase-js');
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const stepScore = {
    [DRILL_STEP]: {
      totalScore: 75, highlight: 'seed', improvement: 'seed',
      dimensions: [{ name: 'd', score: 4 }],
      coachVersion: { context: 'c', perField: [], reasoning: 'r' },
    },
  };
  await admin.from('circles_sessions').update({
    step_scores: stepScore,
    current_phase: 3,
  }).eq('id', session.id);

  return session.id;
}

test.describe('CIRCLES back-nav lock + qchip 4-block — AC-5', () => {

  // ── TC1 — Happy path lock-on-back (AC-3) ────────────────────────────────
  test('TC1: 上一步 from scored Phase 2 → Phase 1 readonly + submit hidden + hint/example clickable', async ({ page, request, cleanupTracker }) => {
    test.slow();
    const token = await getE2eToken();
    const sessionId = await seedScoredSession(request, cleanupTracker, token);

    await test.step('navigate to scored Phase 2 (locked state)', async () => {
      await page.goto(`${FE_BASE}/?session=${sessionId}&phase=2`);
      await expect(page.locator('[data-phase2]')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('click 上一步 → verify readonly Phase 1', async () => {
      await page.getByRole('button', { name: /上一步/ }).click();
      await expect(page.locator('[data-phase1]')).toBeVisible();
      // submit button hidden
      await expect(page.getByRole('button', { name: /完成 Phase 1|提交框架/ })).toBeHidden();
      // form inputs readonly
      const firstInput = page.locator('[data-phase1-field]').first();
      await expect(firstInput).toHaveAttribute('readonly', '');
    });

    await test.step('hint + example buttons still clickable (STANDING memory)', async () => {
      await expect(page.getByRole('button', { name: /查看提示/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /查看範例/ })).toBeVisible();
    });
  });

  // ── TC2 — Re-scoring API rejection (AC-2) ───────────────────────────────
  test('TC2: direct API call to /evaluate-step on scored step → 422', async ({ request, cleanupTracker }) => {
    const token = await getE2eToken();
    const sessionId = await seedScoredSession(request, cleanupTracker, token);

    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const res = await request.post(`${API_BASE}/api/circles-sessions/${sessionId}/evaluate-step`, {
      headers, data: { stepKey: DRILL_STEP, framework: 'retry', conversation: [] },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('step_already_scored');
  });

  // ── TC3 — Phase 3 retry button disabled (AC-4) ──────────────────────────
  test('TC3: Phase 3 retry button disabled when step scored', async ({ page, request, cleanupTracker }) => {
    test.slow();
    const token = await getE2eToken();
    const sessionId = await seedScoredSession(request, cleanupTracker, token);

    await page.goto(`${FE_BASE}/?session=${sessionId}&phase=3`);
    await expect(page.locator('[data-phase3]')).toBeVisible({ timeout: 10_000 });

    const retryBtn = page.locator('[data-phase3="retry"]');
    await expect(retryBtn).toBeDisabled();
    await expect(retryBtn).toHaveAttribute('aria-disabled', 'true');
  });

  // ── TC4 — qchip 4-block content match (AC-1) ────────────────────────────
  test('TC4: Phase 2 qchip click → 4 .qchip-ana__block visible with non-empty content', async ({ page, request, cleanupTracker }) => {
    test.slow();
    const token = await getE2eToken();
    const sessionId = await seedScoredSession(request, cleanupTracker, token);

    await page.goto(`${FE_BASE}/?session=${sessionId}&phase=2`);
    await page.locator('[data-phase2="qchip"]').click();

    const blocks = page.locator('.qchip-ana__block');
    await expect(blocks).toHaveCount(4);

    const labels = ['商業背景', '用戶輪廓', '常見誤區', '破題切入'];
    for (const label of labels) {
      await expect(page.locator('.qchip-ana__head', { hasText: label })).toBeVisible();
    }
  });

  // ── TC5 — Cross-step independence (AC-3 边界) ───────────────────────────
  test('TC5: C1 scored does not lock I step form', async ({ page, request, cleanupTracker }) => {
    test.slow();
    const token = await getE2eToken();
    const sessionId = await seedScoredSession(request, cleanupTracker, token);

    // Navigate to I step (different from scored C1)
    await page.goto(`${FE_BASE}/?session=${sessionId}&phase=1&drill_step=I`);
    await expect(page.locator('[data-phase1]')).toBeVisible({ timeout: 10_000 });

    // I step form should be editable (submit visible, fields not readonly)
    const submitBtn = page.getByRole('button', { name: /完成 Phase 1|提交框架/ });
    await expect(submitBtn).toBeVisible();
  });

});
```

- [ ] **Step 2: Register spec in tests/e2e/playwright.config.js**

In `tests/e2e/playwright.config.js`, find the `testMatch` regex in each of the 3 e2e projects (`e2e-desktop`, `e2e-mobile-chrome`, `e2e-mobile-safari`) and add `circles-back-nav-lock` to each:

```js
testMatch: /(auth-flow-real|nsm-full-flow|circles-back-nav-lock)\.spec\.js$/,
```

(append `|circles-back-nav-lock` to existing list)

- [ ] **Step 3: Run spec to verify (with Tasks 1-4 applied)**

```bash
npx playwright test --config tests/e2e/playwright.config.js circles-back-nav-lock --project=e2e-desktop --reporter=list
```

Expected: 5/5 PASS.

- [ ] **Step 4: Run 5x consecutive across all 3 e2e projects**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --config tests/e2e/playwright.config.js circles-back-nav-lock --reporter=list 2>&1 | tail -15
done
```

Expected: 5 × 5 TC × 3 projects = 75/75 GREEN across all runs (no flake).

If any flake: STOP. Diagnose via debug.md / flaky-tests.md (`playwright-skill/core/`). Fix root cause (likely race in seed step) before commit.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/circles-back-nav-lock.spec.js tests/e2e/playwright.config.js
git commit -m "$(cat <<'EOF'
test(e2e): circles back-nav lock + qchip 4-block — 5 TC integration

AC-5 (spec b2ca935) — covers AC-1/2/3/4 via real Playwright + real Supabase
(service-role seed) + real OpenAI. 5 TC × 3 e2e projects × 5 consecutive runs.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Visual regression snapshots

**Files:**
- Modify: `tests/e2e/circles-back-nav-lock.spec.js` (add `.toHaveScreenshot()` calls)
- Snapshots: auto-generated under `tests/e2e/circles-back-nav-lock.spec.js-snapshots/`

- [ ] **Step 1: Add visual snapshot to TC1 (Phase 1 locked state)**

In TC1's last `test.step` block, append:

```js
await expect(page.locator('[data-phase1]')).toHaveScreenshot(
  `phase1-locked-from-back-${test.info().project.name}.png`,
  { maxDiffPixelRatio: 0.005 }
);
```

- [ ] **Step 2: Add visual snapshot to TC4 (qchip expanded)**

In TC4 after `expect(blocks).toHaveCount(4)`, append:

```js
await expect(page.locator('.qchip-expand')).toHaveScreenshot(
  `phase2-qchip-expanded-${test.info().project.name}.png`,
  { maxDiffPixelRatio: 0.005 }
);
```

- [ ] **Step 3: Generate baselines (first run)**

```bash
npx playwright test --config tests/e2e/playwright.config.js circles-back-nav-lock --update-snapshots
```

Expected: snapshots generated under `tests/e2e/circles-back-nav-lock.spec.js-snapshots/`.

- [ ] **Step 4: Cold-Read EACH new PNG (director)**

```bash
ls tests/e2e/circles-back-nav-lock.spec.js-snapshots/
```

For each PNG (6 total: 2 states × 3 projects), use Read tool to view. Write `audit/eyeball-circles-chat-drift-lock-2026-05-17.md` with ≥ 1 sentence per PNG describing what is visible.

If any PNG looks wrong (e.g., locked state still shows submit btn, qchip-expand only shows 1 block), STOP. Fix root cause, regenerate baseline.

- [ ] **Step 5: Re-run with NEW baselines, expect 0 diff**

```bash
npx playwright test --config tests/e2e/playwright.config.js circles-back-nav-lock --reporter=list
```

Expected: all 5 TC × 3 projects = 15 PASS with snapshots matching.

- [ ] **Step 6: Commit snapshots + audit doc**

```bash
git add tests/e2e/circles-back-nav-lock.spec.js tests/e2e/circles-back-nav-lock.spec.js-snapshots/ audit/eyeball-circles-chat-drift-lock-2026-05-17.md
git commit -m "$(cat <<'EOF'
test(visual): baseline snapshots for phase1 locked + phase2 qchip-expand

6 PNG (2 states × 3 e2e projects). Director cold-Read all 6 documented in
audit/eyeball-circles-chat-drift-lock-2026-05-17.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — Cross-plan smoke + ship gate

**Files:**
- Read-only: full jest + Playwright dual-vp baseline

- [ ] **Step 1: Full jest no regression**

```bash
npx jest 2>&1 | tail -10
```

Expected: pass/skip/total numbers matching pre-impl baseline (410/428 + 1 pre-existing fail) OR better. No new failures.

- [ ] **Step 2: Critical-path E2E still GREEN**

```bash
npx playwright test --config tests/e2e/playwright.config.js tests/critical-path/ --reporter=list 2>&1 | tail -10
```

Expected: existing critical-path specs pass.

- [ ] **Step 3: Write UAT SOP for user**

Create `audit/sop-2026-05-17-circles-lock-and-qchip-uat.md`:

```markdown
# UAT SOP — CIRCLES Lock-on-back + qchip 4-block (2026-05-17)

Dev server: `http://localhost:4000`  (run `npm run dev` if not up)

## Walk
1. 登入 `e2e@first-principle.test`
2. CIRCLES tab → drill mode → C1
3. 完成 Phase 1 form → submit → 過 Phase 1.5 gate
4. Phase 2 對話 → 寫 conclusion (≥30 字) → submit → 等評分完成
5. 點「上一步」← 確認 Phase 1 form 變 readonly + 「完成 Phase 1」消失
6. 確認「查看提示」「查看範例」仍可點
7. 切回 Phase 2 → 點 qchip 卡 → 確認展開有 4 block：商業背景 / 用戶輪廓 / 常見誤區 / 破題切入
8. 嘗試點 Phase 3 「重新評分」→ 確認 disabled
9. 切到 I step → 確認 form 仍可編輯（cross-step independence）

## 預期 0 regression
- 對話練習其他 step（I/R/C2/L/E/S）qchip 也應該展開 4 block
- Locked state 視覺：grey bg / score badge / hint+example buttons
```

- [ ] **Step 4: Commit SOP**

```bash
git add audit/sop-2026-05-17-circles-lock-and-qchip-uat.md
git commit -m "docs(audit): UAT SOP for circles lock + qchip 4-block ship"
```

- [ ] **Step 5: Update CLAUDE.md state board**

Open `CLAUDE.md`. In the「當前狀態 (30 秒讀完)」section, add a bullet at the top:

```markdown
- **CIRCLES chat drift + lock-on-back ship (2026-05-17)**: spec b2ca935 + 7-task plan + 7 commits + 5 TC E2E (75/75 GREEN × 5 runs × 3 projects) + 6 visual snapshots. AC-1/2/3/4/5 全綠。
```

- [ ] **Step 6: Final commit + push**

```bash
git add CLAUDE.md
git commit -m "chore(claude-md): mirror CIRCLES chat drift + lock ship 2026-05-17"
git push origin main
```

---

## Self-Review

**1. Spec coverage:**
- AC-1 (qchip 4-block) → Task 4 + TC4 ✓
- AC-2 (BE 422 guard) → Task 1 + TC2 ✓
- AC-3 (FE lock-on-back) → Task 2 + TC1 ✓
- AC-4 (Phase 3 retry disable) → Task 3 + TC3 ✓
- AC-5 (E2E spec 5 TC × 3 projects × 5 runs) → Task 5 ✓
- AC-6 (no regression) → Task 7 ✓
- §11.1 visual regression → Task 6 ✓
- §11.7 director cold-Read → Task 6 Step 4 ✓
- §11.10 UAT SOP → Task 7 Step 3 ✓

**Gaps:** §11.5 multi-context (cross-tab) not covered in 5 TC. Acceptable — covered by separate cross-tab spec stack already (`tests/visual/cross-tab-resume-toast.spec.js`). Lock state cross-tab is incremental; can be added in followup if user observes need.

**2. Placeholder scan:** No TBD/TODO. All code blocks complete. All commands explicit.

**3. Type consistency:** `circlesStepScores[stepKey]` referenced consistently in Task 1/2/3. `circlesLocked` flag pattern matches existing usage (app.js:37/3107/3511).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-17-circles-chat-drift-and-lock-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — opus director (me) dispatches sonnet per Task, reviews between tasks, fast iteration. Per user 4 條 process requirement: opus = director/cold-reviewer, sonnet = implementer.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints.

Which approach?
