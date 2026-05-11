# NSM History 4-Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 NSM history bugs reported by user (entry-point, no-answers, back-to-selection, count-mismatch).

**Architecture:** Surgical edits — 2 backend SELECT additions, 2 new stats routes (mirroring CIRCLES pattern), 3 frontend behavior changes (smart-routing restore, Step 2 back→home, NSM home stats strip). No DB schema change, no prompts change, no jest baseline regression.

**Tech Stack:** Node/Express + Supabase + vanilla JS frontend (`public/app.js`) + Jest (backend tests) + Playwright (visual tests).

**Spec reference:** `docs/superpowers/specs/2026-05-11-nsm-history-4-bug-fix-design.md` (commit d7737a9).

**Karpathy 4 rules** — all implementer dispatch MUST prepend:
1. Think Before — confirm root cause matches plan before editing
2. Simplicity First — no refactor surrounding code
3. Surgical Changes — each task ≤ 30 lines diff
4. Goal-Driven — pass the bite-sized TDD test in the step

---

## File map

| File | Type | Touched by Task |
|---|---|---|
| `routes/nsm-sessions.js` | Modify line 30 | Task 1 |
| `routes/guest-nsm-sessions.js` | Modify line 30 | Task 1 |
| `routes/nsm-stats.js` | **Create** | Task 4 |
| `routes/guest-nsm-stats.js` | **Create** | Task 4 |
| `server.js` | Modify (mount 2 new routes) | Task 4 |
| `public/app.js:7539-7542` | Modify NSM restore step routing | Task 2 |
| `public/app.js:1810-1813` | Modify Step 2 back handler | Task 3 |
| `public/app.js` NSM home render | Add stats strip block | Task 5 |
| `public/app.js` NSM home post-render | Add stats fetch | Task 5 |
| `tests/routes/nsm-sessions.test.js` (or similar existing) | Add cases for new SELECT cols | Task 1 |
| `tests/routes/nsm-stats.test.js` | **Create** | Task 4 |
| `tests/visual/nsm-restore-routing.spec.js` | **Create** | Task 2 |
| `tests/visual/nsm-back-button.spec.js` | **Create** | Task 3 |
| `tests/visual/nsm-home-stats.spec.js` | **Create** | Task 5 |

---

## Task 1: Bug 2 — Backend list SELECT adds `user_nsm` + `user_breakdown`

**Files:**
- Modify: `routes/nsm-sessions.js:30`
- Modify: `routes/guest-nsm-sessions.js:30`
- Test: locate existing nsm-sessions backend test in `tests/` (likely `tests/routes/nsm-sessions.test.js` or `tests/api/`); if none exists, create `tests/routes/nsm-sessions-list.test.js`

- [ ] **Step 1.1: Locate or create backend list test**

Run: `find tests -name "nsm-sessions*" -o -name "nsm-list*" 2>/dev/null | head -5`

If file exists, modify it. If not, create `tests/routes/nsm-sessions-list.test.js`:

```javascript
const request = require('supertest');
const app = require('../../server');
const { resetDb, insertNsmSession, signJwt } = require('../helpers/db-helpers');

describe('GET /api/nsm-sessions (list)', () => {
  beforeEach(async () => { await resetDb(); });

  test('returns user_nsm and user_breakdown for restore', async () => {
    const userId = 'u-list-test-1';
    const token = signJwt({ id: userId });
    await insertNsmSession({
      user_id: userId,
      question_id: 'q1',
      question_json: { id: 'q1', company: 'Spotify' },
      user_nsm: { nsm: 'weekly listeners', explanation: 'core metric', businessLink: '收入' },
      user_breakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
      status: 'completed',
    });
    const res = await request(app).get('/api/nsm-sessions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      user_nsm: { nsm: 'weekly listeners', explanation: 'core metric', businessLink: '收入' },
      user_breakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
    });
  });
});
```

If `tests/helpers/db-helpers.js` does not exist, locate the existing test helper conventions: `find tests -name "*.test.js" | head -3 && cat tests/$(ls tests | head -1)/*.test.js 2>/dev/null | head -30`. Adapt the test to match the project's pattern. If the test infra requires substantial new scaffolding, defer to a single Playwright integration check via the spec in Task 2.

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx jest tests/routes/nsm-sessions-list.test.js -t "user_nsm" --no-coverage`
Expected: FAIL — assertion mismatch (`user_nsm` undefined / missing) because current SELECT omits the column.

If jest cannot run this without infra, skip to Step 1.3 and verify via Playwright integration in Task 2.

- [ ] **Step 1.3: Modify `routes/nsm-sessions.js:30`**

Apply this edit:

```javascript
// BEFORE (line 30):
    .select('id, question_id, question_json, status, scores_json, created_at')
// AFTER:
    .select('id, question_id, question_json, status, scores_json, user_nsm, user_breakdown, created_at')
```

- [ ] **Step 1.4: Modify `routes/guest-nsm-sessions.js:30` — same change**

```javascript
// BEFORE (line 30):
    .select('id, question_id, question_json, status, scores_json, created_at')
// AFTER:
    .select('id, question_id, question_json, status, scores_json, user_nsm, user_breakdown, created_at')
```

- [ ] **Step 1.5: Run jest baseline check**

Run: `npx jest --no-coverage 2>&1 | tail -10`
Expected: 197 passed / 17 skipped (no regression). New test (if added) PASS.

- [ ] **Step 1.6: Commit**

```bash
git add routes/nsm-sessions.js routes/guest-nsm-sessions.js tests/routes/nsm-sessions-list.test.js
git commit -m "$(cat <<'EOF'
fix(nsm): include user_nsm + user_breakdown in list SELECT (Bug 2)

Restored sessions showed empty form fields because list endpoint omitted
two columns the frontend reads directly (user_nsm, user_breakdown).
Detail fetch /:id was the workaround but is async-only; list seed renders first.

Both auth and guest variants patched in parallel.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Bug 1 — Frontend smart restore routing

**Files:**
- Modify: `public/app.js:7539-7542`
- Test: `tests/visual/nsm-restore-routing.spec.js` (Create)

- [ ] **Step 2.1: Write failing Playwright test**

Create `tests/visual/nsm-restore-routing.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setRestore(page, item) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate((it) => { window.AppState.accessToken = null; window._loadCirclesSessionItem(it); }, item);
  await page.waitForTimeout(100);
}

test('Bug 1 (a) scored session → lands at Step 4', async ({ page }) => {
  await setRestore(page, {
    id: 's1', question_id: 'q1', question_json: { id: 'q1', company: 'Z', product: 'X', question_type: 'design' },
    status: 'completed',
    user_nsm: { nsm: 'x', explanation: 'y', businessLink: 'z' },
    user_breakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
    scores_json: { overall: 80, dims: {} },
  });
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(4);
});

test('Bug 1 (b) breakdown-only session → lands at Step 3', async ({ page }) => {
  await setRestore(page, {
    id: 's2', question_id: 'q1', question_json: { id: 'q1', company: 'Z', product: 'X', question_type: 'design' },
    status: 'active',
    user_nsm: { nsm: 'x', explanation: 'y', businessLink: 'z' },
    user_breakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
    scores_json: null,
  });
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(3);
});

test('Bug 1 (c) nsm-only session → lands at Step 2', async ({ page }) => {
  await setRestore(page, {
    id: 's3', question_id: 'q1', question_json: { id: 'q1', company: 'Z', product: 'X', question_type: 'design' },
    status: 'active',
    user_nsm: { nsm: 'something', explanation: '', businessLink: '' },
    user_breakdown: { reach: '', depth: '', frequency: '', impact: '' },
    scores_json: null,
  });
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(2);
});

test('Bug 1 (d) empty session → lands at Step 1', async ({ page }) => {
  await setRestore(page, {
    id: 's4', question_id: 'q1', question_json: { id: 'q1', company: 'Z', product: 'X', question_type: 'design' },
    status: 'active',
    user_nsm: null, user_breakdown: null, scores_json: null,
  });
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(1);
});
```

**Note** about helper: the restore handler in `app.js:7530-7560` is currently inline inside a wider event handler. The spec must either invoke that handler via clicking the offcanvas card (preferred) OR temporarily expose `_loadCirclesSessionItem` on `window` via a one-line addition just before the fix step. Recommended: in Step 2.3 also add `window._loadCirclesSessionItem = loadCirclesSessionItem;` at end of the handler function declaration so future tests can call it directly.

If `loadCirclesSessionItem` is not a named function but inline, refactor it into a named function as part of Step 2.3 (still surgical — extract function, ~15 lines).

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-restore-routing.spec.js --project=Mobile-360 2>&1 | tail -15`
Expected: 4/4 FAIL (all expect `nsmStep` 4/3/2/1 but receive 1 because current code hardcodes Step 1).

- [ ] **Step 2.3: Apply fix — replace `AppState.nsmStep = 1` at `public/app.js:7539`**

```javascript
// BEFORE (lines 7539-7542):
      // Always land on Step 1 (mirror Issue 2b CIRCLES fix) — avoid auto-landing on eval
      // result page which causes 卡死 if session data is incomplete.
      // User navigates forward via tab nav after reviewing context.
      AppState.nsmStep = 1;

// AFTER:
      // Bug 1 fix (2026-05-11): smart routing per spec design — restore lands at
      // the saved checkpoint inferred from session data presence.
      var _scored = item.scores_json && typeof item.scores_json === 'object'
        && Object.keys(item.scores_json).length > 0;
      var _hasBreakdown = item.user_breakdown
        && Object.values(item.user_breakdown).some(function (v) { return v && String(v).trim(); });
      var _hasNsm = item.user_nsm && item.user_nsm.nsm && String(item.user_nsm.nsm).trim();
      AppState.nsmStep = _scored ? 4 : (_hasBreakdown ? 3 : (_hasNsm ? 2 : 1));
```

If the surrounding handler is inline (not a named function), extract it into a named `function loadCirclesSessionItem(item) {…}` block defined within the same scope, then expose via `window._loadCirclesSessionItem = loadCirclesSessionItem;` immediately after declaration. This enables the test in Step 2.1 to invoke the handler directly.

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-restore-routing.spec.js --project=Mobile-360`
Expected: 4/4 PASS.

- [ ] **Step 2.5: Cross-vp regression check**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-restore-routing.spec.js --project=iPad --project=Desktop-1280`
Expected: 8/8 PASS (4 tests × 2 additional vp).

- [ ] **Step 2.6: Commit**

```bash
git add public/app.js tests/visual/nsm-restore-routing.spec.js
git commit -m "$(cat <<'EOF'
fix(nsm): smart restore routing — land at saved checkpoint (Bug 1)

Replaces hardcoded AppState.nsmStep=1 with state-aware routing:
- scored (scores_json non-empty)  → Step 4 report
- has breakdown (user_breakdown filled) → Step 3 拆解
- has nsm (user_nsm.nsm filled)        → Step 2 定義
- else                                  → Step 1 選題

Aligns with mockup 09 §I-296 contract ("NSM item click → 跳 step 4 報告")
and user expectation that clicking a session card resumes where left off.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Bug 3 — Step 2 back goes home, not Step 1 selection

**Files:**
- Modify: `public/app.js:1808-1814` (Step 2/3 back handler block)
- Test: `tests/visual/nsm-back-button.spec.js` (Create)

**Context confirmed by grep:**
- Step 2 uses `data-nsm-action="back"` (line 1288)
- Step 3 uses `data-nsm-action="back-to-step2"` (line 1617) → handler at 1815 already sets nsmStep=2 ✓ no change needed
- Only Step 2's `back` handler at 1808-1814 needs fixing

- [ ] **Step 3.1: Write failing test**

Create `tests/visual/nsm-back-button.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setupNsmStep2(page) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 2,
      nsmSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      nsmDefinition: { nsm: '', explanation: '', businessLink: '' },
      nsmBreakdown: { reach: '', depth: '', frequency: '', impact: '' },
      nsmSession: { id: 's-mock' },
    });
    window.render();
  });
}

test('Step 2 back → goes home (view=circles), NOT to NSM Step 1 selection', async ({ page }) => {
  await setupNsmStep2(page);
  await page.locator('[data-nsm-action="back"]').click();
  await page.waitForTimeout(100);
  const state = await page.evaluate(() => ({ view: window.AppState.view, nsmStep: window.AppState.nsmStep }));
  expect(state.view).toBe('circles');
});

test('Step 2 back → nsmSelectedQuestion is preserved (not cleared)', async ({ page }) => {
  await setupNsmStep2(page);
  await page.locator('[data-nsm-action="back"]').click();
  await page.waitForTimeout(100);
  const q = await page.evaluate(() => window.AppState.nsmSelectedQuestion);
  expect(q).toEqual(expect.objectContaining({ id: 'q1', company: 'Spotify' }));
});

test('Step 3 back-to-step2 → goes Step 2 (regression guard, no change expected)', async ({ page }) => {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 3,
      nsmSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      nsmDefinition: { nsm: 'x', explanation: 'y', businessLink: 'z' },
      nsmBreakdown: { reach: '', depth: '', frequency: '', impact: '' },
      nsmSession: { id: 's-mock' },
    });
    window.render();
  });
  await page.locator('[data-nsm-action="back-to-step2"]').click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(2);
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-back-button.spec.js --project=Mobile-360`
Expected: Test 1 + Test 2 FAIL (current handler sets nsmStep=1, view stays 'nsm'). Test 3 PASS (regression guard for existing correct behavior).

- [ ] **Step 3.3: Apply fix to `public/app.js:1808-1814`**

```javascript
// BEFORE (lines 1808-1814):
    var backBtn = document.querySelector('[data-nsm-action="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        AppState.nsmStep = 1;
        render();
      });
    }

// AFTER:
    var backBtn = document.querySelector('[data-nsm-action="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        // Bug 3 fix (2026-05-11): Step 2 back must NOT route to Step 1 question
        // selection — that visually orphans the user's already-selected question.
        // Route to home (CIRCLES default landing) instead. nsmSelectedQuestion is
        // preserved so user can resume via offcanvas restore (Task 2 smart-routing
        // will land them back at Step 2).
        AppState.view = 'circles';
        AppState.nsmStep = 1; // reset for next NSM session entry
        render();
      });
    }
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-back-button.spec.js --project=Mobile-360`
Expected: 3/3 PASS.

- [ ] **Step 3.5: Cross-vp**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-back-button.spec.js --project=iPad --project=Desktop-1280`
Expected: 6/6 PASS.

- [ ] **Step 3.6: Commit**

```bash
git add public/app.js tests/visual/nsm-back-button.spec.js
git commit -m "$(cat <<'EOF'
fix(nsm): Step 2 back routes home, not to selection page (Bug 3)

Previously [data-nsm-action="back"] at Step 2 set nsmStep=1, which renders
the question-selection page — visually orphaning the user's selected question
and inviting them to re-pick. Now routes to CIRCLES home (default landing).
nsmSelectedQuestion is preserved; user can resume via offcanvas restore (which
after Bug 1 smart-routing will land them back at Step 2).

Step 3 back-to-step2 handler unchanged (already correctly sets nsmStep=2).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Bug 4 backend — new `/api/nsm-stats` + `/api/guest-nsm-stats`

**Files:**
- Create: `routes/nsm-stats.js`
- Create: `routes/guest-nsm-stats.js`
- Modify: `server.js` (mount new routes)
- Test: `tests/routes/nsm-stats.test.js` (Create — only if jest infra supports; otherwise rely on integration via Task 5 spec)

- [ ] **Step 4.1: Write failing test**

Create `tests/routes/nsm-stats.test.js` (skip if jest infra lacks test helpers — see Task 1 Step 1.1 fallback note):

```javascript
const request = require('supertest');
const app = require('../../server');
const { resetDb, insertNsmSession, signJwt } = require('../helpers/db-helpers');

describe('GET /api/nsm-stats', () => {
  beforeEach(async () => { await resetDb(); });

  test('returns counts grouped by status', async () => {
    const userId = 'u-stats-1';
    const token = signJwt({ id: userId });
    await insertNsmSession({ user_id: userId, question_id: 'q1', question_json: {}, status: 'completed', updated_at: new Date().toISOString() });
    await insertNsmSession({ user_id: userId, question_id: 'q2', question_json: {}, status: 'active' });
    const res = await request(app).get('/api/nsm-stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ completed: 1, active: 1, weeklyCompleted: 1 });
  });

  test('401 without auth', async () => {
    const res = await request(app).get('/api/nsm-stats');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `npx jest tests/routes/nsm-stats.test.js --no-coverage`
Expected: 404 errors (route doesn't exist yet).

- [ ] **Step 4.3: Create `routes/nsm-stats.js`** (mirror `routes/circles-stats.js`)

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db/client');

// GET /api/nsm-stats — auth-required
// Returns { completed, active, weeklyCompleted } for the authenticated user.
// Mirrors routes/circles-stats.js — NSM-side equivalent for homepage stats strip.
router.get('/', async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const userId = req.user.id;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [completedRes, activeRes, weeklyRes] = await Promise.all([
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'completed'),
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'active'),
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'completed').gte('updated_at', sevenDaysAgo),
    ]);

    if (completedRes.error || activeRes.error || weeklyRes.error) {
      return res.status(500).json({ error: 'db_error' });
    }

    res.json({
      completed: completedRes.count || 0,
      active: activeRes.count || 0,
      weeklyCompleted: weeklyRes.count || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
```

- [ ] **Step 4.4: Create `routes/guest-nsm-stats.js`** (mirror `routes/guest-circles-stats.js`)

```javascript
// routes/guest-nsm-stats.js
const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');

// GET /api/guest-nsm-stats — guest stats (mirrors nsm-stats.js for X-Guest-ID).
router.get('/', requireGuestId, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [completedRes, activeRes, weeklyRes] = await Promise.all([
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('guest_id', req.guestId).eq('status', 'completed'),
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('guest_id', req.guestId).eq('status', 'active'),
      db.from('nsm_sessions').select('id', { count: 'exact', head: true })
        .eq('guest_id', req.guestId).eq('status', 'completed').gte('updated_at', sevenDaysAgo),
    ]);

    if (completedRes.error || activeRes.error || weeklyRes.error) {
      return res.status(500).json({ error: 'db_error' });
    }

    res.json({
      completed: completedRes.count || 0,
      active: activeRes.count || 0,
      weeklyCompleted: weeklyRes.count || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
```

- [ ] **Step 4.5: Mount new routes in `server.js`** — add 2 lines AFTER line 44 (after guest-circles-stats):

```javascript
// BEFORE (line 43-44):
app.use('/api/circles-stats', requireAuth, require('./routes/circles-stats'));
app.use('/api/guest-circles-stats', require('./routes/guest-circles-stats'));

// AFTER (add lines):
app.use('/api/circles-stats', requireAuth, require('./routes/circles-stats'));
app.use('/api/guest-circles-stats', require('./routes/guest-circles-stats'));
app.use('/api/nsm-stats', requireAuth, require('./routes/nsm-stats'));
app.use('/api/guest-nsm-stats', require('./routes/guest-nsm-stats'));
```

- [ ] **Step 4.6: Run jest baseline + new test**

Run: `npx jest --no-coverage 2>&1 | tail -10`
Expected: 197 passed (no regression) + new nsm-stats tests PASS (or skipped if helpers absent).

Manual curl smoke test:
Run: `curl -s http://localhost:4000/api/guest-nsm-stats -H "X-Guest-ID: smoke-test" | python3 -m json.tool`
Expected: `{"completed": 0, "active": 0, "weeklyCompleted": 0}` (or actual counts).

- [ ] **Step 4.7: Commit**

```bash
git add routes/nsm-stats.js routes/guest-nsm-stats.js server.js tests/routes/nsm-stats.test.js
git commit -m "$(cat <<'EOF'
feat(nsm): add /api/nsm-stats endpoint (Bug 4 backend)

New NSM-side stats endpoint mirroring routes/circles-stats.js pattern.
Returns { completed, active, weeklyCompleted } for homepage strip on NSM tab.

Both auth (requireAuth at mount) and guest (X-Guest-ID via requireGuestId)
variants. Mounted at server.js after circles-stats lines for code locality.

DB query: count nsm_sessions grouped by status, weekly filter on
updated_at >= now() - 7 days. No schema change.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Bug 4 frontend — NSM home stats strip

**Files:**
- Modify: `public/app.js` — NSM Step 1 render (add stats strip HTML block at top)
- Modify: `public/app.js` — NSM home post-render (add stats fetch invocation)
- Test: `tests/visual/nsm-home-stats.spec.js` (Create)

**Context confirmed by grep:**
- CIRCLES stats strip HTML at `public/app.js:5264-5277` — reuse this exact pattern
- CIRCLES stats fetch at `public/app.js:5405-5411` — reuse this exact pattern (extract into helper if not already shared)

- [ ] **Step 5.1: Write failing test**

Create `tests/visual/nsm-home-stats.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

async function mockApis(page, nsmStats) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nsmStats) }));
  await page.route('**/api/guest-nsm-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nsmStats) }));
}

test('NSM home renders stats strip with counts', async ({ page }) => {
  await mockApis(page, { completed: 2, active: 0, weeklyCompleted: 1 });
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => { window.AppState.view = 'nsm'; window.AppState.nsmStep = 1; window.render(); });
  await page.waitForTimeout(300); // wait for async stats fetch + re-render
  const strip = page.locator('[data-stats-strip="nsm"]');
  await expect(strip).toBeVisible();
  await expect(strip.locator('[data-stat="completed"]')).toHaveText('2');
  await expect(strip.locator('[data-stat="active"]')).toHaveText('0');
  await expect(strip.locator('[data-stat="weekly"]')).toHaveText('1');
});

test('NSM home strip cross-vp renders', async ({ page }) => {
  await mockApis(page, { completed: 5, active: 3, weeklyCompleted: 2 });
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => { window.AppState.view = 'nsm'; window.AppState.nsmStep = 1; window.render(); });
  await page.waitForTimeout(300);
  await expect(page.locator('[data-stats-strip="nsm"]')).toBeVisible();
  await expect(page.locator('[data-stats-strip="nsm"] [data-stat="completed"]')).toHaveText('5');
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-home-stats.spec.js --project=Mobile-360`
Expected: FAIL — `[data-stats-strip="nsm"]` selector not found.

- [ ] **Step 5.3: Read NSM Step 1 render block** to find injection point

Run: `grep -n "renderNSMStep1\|nsm-step-1\|選擇企業情境\|step1.*context\|nsmStep === 1" public/app.js | head -10`

Identify the function that emits the "選擇企業情境" page. Likely a function with HTML string accumulator. The stats strip must inject as a sibling block ABOVE the question-picker but inside the NSM Step 1 wrapper, BELOW the progress-rail.

- [ ] **Step 5.4: Apply HTML injection** — add stats strip block at top of NSM Step 1 render

In the NSM Step 1 render function (identified in Step 5.3), insert this block immediately after the breadcrumb / progress rail and before the filter+question grid. The exact location depends on the current render structure; use the same indentation and string-concat style as the surrounding code:

```javascript
// NSM home stats strip (Bug 4 fix 2026-05-11) — mirror CIRCLES stats strip at line 5269.
// Numbers populated by async fetchNsmStats() after render.
var nsmStatsHtml = '<div class="stats-strip" data-stats-strip="nsm">'
  + '<i class="ph ph-chart-bar stats-strip__icon"></i>'
  + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="completed">0</span>已完成</span>'
  + '<span class="stats-strip__sep">·</span>'
  + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="active">0</span>進行中</span>'
  + '<span class="stats-strip__sep">·</span>'
  + '<span class="stats-strip__item"><span class="stats-strip__num" data-stat="weekly">0</span>本週</span>'
  + '<span class="stats-strip__hint stats-strip__hint--tablet" data-stat="hint-short"></span>'
  + '<span class="stats-strip__hint stats-strip__hint--desktop" data-stat="hint-long"></span>'
  + '</div>';
// Inject nsmStatsHtml into the Step 1 render output between breadcrumb and the picker body.
```

The implementer must locate the exact line where the breadcrumb HTML or progress rail HTML ends and prepend `nsmStatsHtml` to the next block. If the render uses template literals or React-like syntax, adapt accordingly while keeping the `data-stats-strip="nsm"` and `data-stat` attribute names identical.

- [ ] **Step 5.5: Add fetch + populate logic** — mirror CIRCLES pattern at line 5405-5411

Find the existing CIRCLES stats fetch block at app.js line 5405-5411. Either:
- (a) Generalize the function to accept `view` parameter ('circles' | 'nsm') and call from both paths
- (b) Add a parallel `fetchNsmStats()` function next to the CIRCLES one

Recommended **(a)** for DRY. Example refactor (pseudo-diff, adapt to actual code):

```javascript
// BEFORE — pseudo-shape near line 5405:
function fetchCirclesStats() {
  var path = AppState.accessToken ? '/api/circles-stats' : '/api/guest-circles-stats';
  window.apiFetch(path).then(...).then(function (data) {
    populateStatsStrip(document.querySelector('[data-stats-strip="circles"]'), data);
  });
}

// AFTER — parameterized:
function fetchStatsStrip(kind) {
  var basePath = AppState.accessToken ? '/api/' + kind + '-stats' : '/api/guest-' + kind + '-stats';
  window.apiFetch(basePath).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data) return;
    var strip = document.querySelector('[data-stats-strip="' + kind + '"]');
    if (!strip) return;
    var c = strip.querySelector('[data-stat="completed"]'); if (c) c.textContent = data.completed || 0;
    var a = strip.querySelector('[data-stat="active"]');    if (a) a.textContent = data.active || 0;
    var w = strip.querySelector('[data-stat="weekly"]');    if (w) w.textContent = data.weeklyCompleted || 0;
  });
}
```

Then ensure the existing CIRCLES home rendering also adds `data-stats-strip="circles"` to its strip element (if it doesn't already — verify via grep `[data-stats-strip` at Step 5.3), and call `fetchStatsStrip('circles')` after CIRCLES render, `fetchStatsStrip('nsm')` after NSM render.

**Surgical alternative if refactor risk is too high:** Keep CIRCLES path untouched. Add a separate `fetchNsmStats()` function next to it, called from NSM Step 1 post-render.

- [ ] **Step 5.6: Run test to verify it passes**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-home-stats.spec.js --project=Mobile-360`
Expected: 2/2 PASS.

- [ ] **Step 5.7: Cross-vp + regression**

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/nsm-home-stats.spec.js --project=iPad --project=Desktop-1280`
Expected: 4/4 PASS (2 tests × 2 vp).

Run baseline regression:
`npx playwright test --config=tests/visual/playwright.config.js --project=Mobile-360 2>&1 | tail -5`
Expected: no regression vs baseline.

- [ ] **Step 5.8: Commit**

```bash
git add public/app.js tests/visual/nsm-home-stats.spec.js
git commit -m "$(cat <<'EOF'
feat(nsm): NSM home stats strip — completed/active/weekly counts (Bug 4 FE)

Adds same stats-strip pattern as CIRCLES home to NSM Step 1 (question
selection) page. Fetches /api/nsm-stats (auth) or /api/guest-nsm-stats
(guest) and populates numbers post-render.

CIRCLES and NSM each show their own counts — not combined — per user
preference. Strip selector data-stats-strip="nsm" added; CIRCLES strip
gets matching data-stats-strip="circles" if it doesn't already have it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Integration check + cold-Read 完工驗證

**Files:**
- New audit doc: `audit/eyeball-nsm-4-bug-fix-2026-05-11.md`

- [ ] **Step 6.1: User-account integration test** — repeat the original user-reported scenarios via the existing spec from this session

Run: `npx playwright test --config=tests/visual/playwright.config.js tests/visual/capture-user-nsm-bugs.spec.js --project=Mobile-360 --project=iPad --project=Desktop-1280`

This re-runs the captures that originally documented the 4 bugs (`audit/png-user-nsm-bugs/`). Compare new PNGs to existing baseline:

- `homepage-stats-nsm-{vp}.png` — now should show stats strip (Bug 4 fixed)
- `nsm-restore-after-click-{vp}.png` — clicking Zoom (80分) record should land at Step 4 report, NOT Step 1 (Bug 1 fixed)
- After restore: form fields populated with user's saved nsm + breakdown (Bug 2 fixed)
- After landing in Step 2, click back → returns to CIRCLES home (Bug 3 fixed)

- [ ] **Step 6.2: Director cold-Read PNGs**

Read each captured PNG via the Read tool. Write a one-sentence verdict per PNG into `audit/eyeball-nsm-4-bug-fix-2026-05-11.md` per the `feedback_test_all_devices_visual.md` discipline.

Required structure:

```markdown
# NSM 4-Bug Fix Eyeball Walk — 2026-05-11

## Methodology
[Cold-Read X PNGs across Y viewports, no sampling]

## Bug 1 (Restore routing) — POST-FIX verdict
| VP | PNG | Verdict |
|---|---|---|
| Mobile-360 | ... | ... |

## Bug 2 (Empty fields) — POST-FIX verdict
[...]

## Bug 3 (Step 2 back) — POST-FIX verdict
[...]

## Bug 4 (Stats strip) — POST-FIX verdict
[...]

## Cross-vp consistency
[...]

## Standing rule compliance
- [x] Director cold-Read all PNGs (no sampling)
- [x] 3 vp tested
- [x] No DB schema change
- [x] No jest regression (X/Y vs X/Y baseline)
- [x] iOS Safari 15-item static review walked
```

- [ ] **Step 6.3: iOS Safari 15-item static review** (standing rule #5)

Walk the iOS Safari 15-item checklist (`docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md` §0.2) for the touched UI surfaces:
- Step 2 back button click behavior
- NSM home stats strip render on iOS Mobile vp
- Restore handler navigation transitions

Document walk-through in the eyeball doc Step 6.2.

- [ ] **Step 6.4: Full Playwright × 8 vp regression** (per CLAUDE.md baseline)

Run: `npx playwright test --config=tests/visual/playwright.config.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 2>&1 | tail -10`

Expected: Pass rate matches baseline (704/704 focused or current baseline). Report any regression in eyeball doc.

- [ ] **Step 6.5: Open dev port + write UAT SOP for user**

Confirm port 4000 is still up:
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/`
Expected: 200.

Write `audit/uat-sop-nsm-4-bug-fix-2026-05-11.md` with step-by-step verification instructions for the user. Include:
- Login URL + credentials
- Steps to verify each of 4 bugs (click sequence + expected result)
- Where to look for the new stats strip
- How to test the Step 2 back button

- [ ] **Step 6.6: Update CLAUDE.md state board**

Edit `CLAUDE.md` "Last updated" line and "最近 ship" section to record this fix:

```markdown
> **Last updated:** 2026-05-11 (NSM 4-bug fix shipped: Bug 1 smart restore routing + Bug 2 list SELECT add 2 cols + Bug 3 Step 2 back→home + Bug 4 NSM stats strip)

- **最近 ship**（2026-05-11）：NSM history 4-bug fix (Bug 1-4 全修)，user UAT pending. spec `d7737a9` / plan `<this commit SHA>` ...
```

- [ ] **Step 6.7: Final commit (audit doc + CLAUDE.md)**

```bash
git add audit/eyeball-nsm-4-bug-fix-2026-05-11.md audit/uat-sop-nsm-4-bug-fix-2026-05-11.md CLAUDE.md
git commit -m "$(cat <<'EOF'
audit(nsm): 4-bug fix eyeball walk + UAT SOP + state board update

Director cold-Read all post-fix PNGs across 3 vp. No regression vs baseline.
iOS Safari 15-item static review walked. User UAT SOP ready at audit/.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review

**1. Spec coverage:**
- Bug 1 (smart routing) → Task 2 ✓
- Bug 2 (list SELECT user_nsm + user_breakdown) → Task 1 ✓
- Bug 3 (Step 2 back home) → Task 3 ✓
- Bug 4 backend (/api/nsm-stats + /api/guest-nsm-stats) → Task 4 ✓
- Bug 4 frontend (NSM home stats strip) → Task 5 ✓
- Director cold-Read + iOS review + Playwright × 8 vp → Task 6 ✓
- UAT SOP + CLAUDE.md update → Task 6 ✓

No spec gaps detected.

**2. Placeholder scan:** No TBD / TODO / "add error handling" / "fill in". Each step has concrete code or exact command.

**3. Type consistency:**
- `nsmStep` numeric (1-4) used consistently
- `user_nsm` shape `{nsm, explanation, businessLink}` consistent across tasks
- `user_breakdown` shape `{reach, depth, frequency, impact}` consistent
- Stats response shape `{completed, active, weeklyCompleted}` consistent backend + frontend
- `data-stats-strip="nsm"` selector consistent between Task 5.4 (HTML) + Task 5.1 (test) + Task 5.5 (fetch)

**Note:** Task 5.5 mentions adding `data-stats-strip="circles"` to existing CIRCLES strip "if it doesn't already have it". Implementer must verify via grep before adding. If CIRCLES strip already has it, no change needed — only NSM strip is new.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-nsm-history-4-bug-fix-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch fresh implementer subagent per task, two-stage review per task (spec compliance + code quality), fast iteration. Each task ≤ 30 min wall-clock.

**2. Inline Execution** — Batch execute all 6 tasks in this session with checkpoints after each.

Recommend **Subagent-Driven** per memory `feedback_parallel_subagent_default.md` (implementer = sonnet 4.6, main + review = opus 4.7).
