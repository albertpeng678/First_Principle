# Stats 0/0/0 + Phase 1 Restore Drift Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Director (opus) cold-reviews each task; sonnet implements; user approves between bundle stages.

**Goal:** Fix two production bugs reported by user — (A) home stats-strip showing 0/0/0 for guest users; (B) Phase 1 form field mapping drift on session restore via offcanvas history.

**Architecture:** Bug A — surgical backend add-on (`routes/guest-circles-stats.js` mirroring `guest-circles-sessions` pattern) + 1-line frontend path branch. Bug B — remove buggy positional `Object.values` fallback in `populateTextareasFromDraft`, retain English-key alias map for legacy session compatibility. L/E/S restore paths audited as structurally safe (push/pop dense arrays + key-map) — no code change, regression specs only.

**Tech Stack:** Node 18 / Express 4 / Supabase / Vanilla JS frontend / Jest 29 (supertest) / Playwright 1 (chromium + webkit, 8 viewport projects).

**Spec:** `docs/superpowers/specs/2026-05-07-stats-and-restore-fix-design.md`

**Mockup contracts:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/01-circles-home.html` §A stats-strip, `03-phase-1-form.html` §A/B/C/G restore behaviour.

**Branch:** main (solo workflow per standing rule).

---

## Task 1 — Backend: jest RED for guest stats route

**Files:**
- Create: `tests/guest-circles-stats.test.js`

- [ ] **Step 1: Write the failing test**

```js
// TDD RED — written before implementation per superpowers:test-driven-development
const request = require('supertest');
const app = require('../server');

describe('GET /api/guest-circles-stats', () => {
  it('returns 400 without X-Guest-ID header', async () => {
    const res = await request(app).get('/api/guest-circles-stats');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/guest_id/i);
  });

  it('returns 400 with malformed (non-UUIDv4) X-Guest-ID', async () => {
    const res = await request(app)
      .get('/api/guest-circles-stats')
      .set('X-Guest-ID', 'not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('returns { completed, active, weeklyCompleted } shape with valid X-Guest-ID', async () => {
    const guestId = '00000000-0000-4000-8000-000000000999'; // synthetic UUID v4
    const res = await request(app)
      .get('/api/guest-circles-stats')
      .set('X-Guest-ID', guestId);
    expect(res.status).toBe(200);
    expect(typeof res.body.completed).toBe('number');
    expect(typeof res.body.active).toBe('number');
    expect(typeof res.body.weeklyCompleted).toBe('number');
    expect(res.body.completed).toBeGreaterThanOrEqual(0);
    expect(res.body.active).toBeGreaterThanOrEqual(0);
    expect(res.body.weeklyCompleted).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run to verify RED**

```bash
npm test -- tests/guest-circles-stats.test.js
```

Expected: 3 fail with "Cannot GET /api/guest-circles-stats" (404) or 400 with mismatched error shape.

- [ ] **Step 3: Commit RED**

```bash
git add tests/guest-circles-stats.test.js
git commit -m "test(stats): RED — guest-circles-stats route shape + auth"
```

---

## Task 2 — Backend: implement guest stats route + register in server.js

**Files:**
- Create: `routes/guest-circles-stats.js`
- Modify: `server.js:46` (add mount line after circles-stats line)

- [ ] **Step 1: Write the route**

```js
// routes/guest-circles-stats.js
const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { requireGuestId } = require('../middleware/guest');

// GET /api/guest-circles-stats — guest stats (mirrors circles-stats.js for X-Guest-ID).
router.get('/', requireGuestId, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [completedRes, activeRes, weeklyRes] = await Promise.all([
      db.from('circles_sessions').select('id', { count: 'exact', head: true })
        .eq('guest_id', req.guestId).eq('status', 'completed'),
      db.from('circles_sessions').select('id', { count: 'exact', head: true })
        .eq('guest_id', req.guestId).eq('status', 'active'),
      db.from('circles_sessions').select('id', { count: 'exact', head: true })
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

- [ ] **Step 2: Register in server.js**

Open `server.js`, find the line:

```js
app.use('/api/circles-stats', requireAuth, require('./routes/circles-stats'));
```

Insert a new line directly after it:

```js
app.use('/api/guest-circles-stats', require('./routes/guest-circles-stats'));
```

(No `requireAuth` — `requireGuestId` is applied inside the route.)

- [ ] **Step 3: Run jest to verify GREEN**

```bash
npm test -- tests/guest-circles-stats.test.js
```

Expected: 3 pass.

- [ ] **Step 4: Run full jest baseline (no regression)**

```bash
npm test
```

Expected: 161/161 pass (was 157, +3 = 160 from Task 1; final 161 will land in Task 8). If 160, OK to proceed.

- [ ] **Step 5: Commit GREEN**

```bash
git add routes/guest-circles-stats.js server.js
git commit -m "feat(stats): GREEN — /api/guest-circles-stats route mirrors auth pattern"
```

---

## Task 3 — Frontend: Playwright RED for guest stats display

**Files:**
- Create: `tests/visual/home-stats-guest.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/visual/home-stats-guest.spec.js
// RED — will fail because frontend still calls /api/circles-stats for guest (401 → silent return).
const { test, expect } = require('@playwright/test');

test.describe('Home stats-strip — guest user (Bug A)', () => {
  async function setupGuest(page, statsBody) {
    // Stub auth-required endpoint as 401 (matches real backend behaviour)
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 401, body: '{}' }));
    // Stub guest endpoint with seeded counts
    await page.route('**/api/guest-circles-stats**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(statsBody),
    }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
  }

  test('Mobile-360 — guest sees seeded stats (5 / 2 / 3)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupGuest(page, { completed: 5, active: 2, weeklyCompleted: 3 });
    // wait for fetch to settle
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-stat="completed"]');
      return el && el.textContent.trim() === '5';
    }, { timeout: 3000 });
    await expect(page.locator('[data-stat="completed"]').first()).toHaveText('5');
    await expect(page.locator('[data-stat="active"]').first()).toHaveText('2');
    await expect(page.locator('[data-stat="weekly"]').first()).toHaveText('3');
  });

  test('iPad — guest sees seeded stats (5 / 2 / 3)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupGuest(page, { completed: 5, active: 2, weeklyCompleted: 3 });
    await page.waitForFunction(() => document.querySelector('[data-stat="completed"]')?.textContent.trim() === '5', { timeout: 3000 });
    await expect(page.locator('[data-stat="completed"]').first()).toHaveText('5');
  });

  test('Desktop-1280 — guest sees seeded stats (5 / 2 / 3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGuest(page, { completed: 5, active: 2, weeklyCompleted: 3 });
    await page.waitForFunction(() => document.querySelector('[data-stat="completed"]')?.textContent.trim() === '5', { timeout: 3000 });
    await expect(page.locator('[data-stat="completed"]').first()).toHaveText('5');
  });

  test('frontend hits /api/guest-circles-stats not /api/circles-stats for guest', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const calledPaths = [];
    await page.route('**/api/circles-stats**', r => { calledPaths.push('auth'); r.fulfill({ status: 401, body: '{}' }); });
    await page.route('**/api/guest-circles-stats**', r => { calledPaths.push('guest'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ completed: 1, active: 1, weeklyCompleted: 0 }) }); });
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.waitForTimeout(500);
    expect(calledPaths).toContain('guest');
    expect(calledPaths).not.toContain('auth');
  });
});
```

- [ ] **Step 2: Run to verify RED**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/home-stats-guest.spec.js --reporter=line
```

Expected: 4 fail (frontend still calls auth path → guest path returns counts but frontend never reads it).

- [ ] **Step 3: Commit RED**

```bash
git add tests/visual/home-stats-guest.spec.js
git commit -m "test(stats): RED — guest home stats-strip Playwright × 3 viewport"
```

---

## Task 4 — Frontend: 1-line path branch in loadCirclesStats

**Files:**
- Modify: `public/app.js:2109`

- [ ] **Step 1: Edit the path resolution**

Open `public/app.js`. Find line 2109:

```js
      var path = '/api/circles-stats';
```

Replace with:

```js
      var path = AppState.accessToken ? '/api/circles-stats' : '/api/guest-circles-stats';
```

(No other changes; `headers` block at lines 2110-2113 already sets `Authorization` for auth or `X-Guest-ID` for guest.)

- [ ] **Step 2: Run guest spec to verify GREEN**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 --project=Mobile-360 --project=iPad tests/visual/home-stats-guest.spec.js --reporter=line
```

Expected: 12 pass (4 specs × 3 viewport).

- [ ] **Step 3: Commit GREEN**

```bash
git add public/app.js
git commit -m "fix(stats): GREEN — guest path branch in loadCirclesStats"
```

---

## Task 5 — Bug B: Playwright RED for C1 partial-fill no-drift

**Files:**
- Create: `tests/visual/restore-no-drift.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/visual/restore-no-drift.spec.js
// RED — Bug B repro: partial-fill draftForStep → positional fallback drifts to wrong textarea.
// All assertions use Chinese keys (cfg.fields[i].key canonical form).
const { test, expect } = require('@playwright/test');

const ROUTES = {
  stats: '**/api/(guest-)?circles-stats**',
  list: '**/api/(guest-)?circles-sessions',
  nsm: '**/api/(guest-)?(nsm|nsm-sessions)**',
};

function stubAll(page, listSession, detailSession) {
  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":1,"weeklyCompleted":0}' }));
  page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([listSession]) }));
  page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([listSession]) }));
  page.route('**/api/guest-circles-sessions/' + listSession.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailSession) }));
  page.route('**/api/circles-sessions/' + listSession.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailSession) }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function openSessionViaOffcanvas(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('button[data-nav="offcanvas"]').first().click();
  await page.waitForSelector('.offcanvas-item');
  await page.locator('.offcanvas-item').first().click();
  await page.waitForSelector('.rt-textarea', { timeout: 5000 });
}

test.describe('Phase 1 restore — partial-fill no-drift (Bug B)', () => {
  test('C1: only idx 1 (時間範圍) filled with 「測試」 → idx 1 shows it, idx 0/2/3 empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-c1-partial-1', question_id: 'q-c1-1',
      question_json: { id: 'q-c1-1', company: 'Spotify', product: 'Spotify Podcast' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { C1: { '時間範圍': '測試' } }, // ONLY idx 1 — drift bait
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const textareas = page.locator('.rt-textarea');
    expect(await textareas.count()).toBe(4);
    expect((await textareas.nth(0).textContent()).trim()).toBe('');
    expect((await textareas.nth(1).textContent()).trim()).toBe('測試');
    expect((await textareas.nth(2).textContent()).trim()).toBe('');
    expect((await textareas.nth(3).textContent()).trim()).toBe('');
  });

  test('C1: idx 0 + idx 2 filled (skip idx 1, idx 3) → idx 1 stays empty (positional fallback bait)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-c1-partial-2', question_id: 'q-c1-2',
      question_json: { id: 'q-c1-2', company: 'Notion', product: '工作協作' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { C1: { '問題範圍': 'A', '業務影響': 'C' } }, // idx 0 + 2; positional fallback would put 'C' in idx 1
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const textareas = page.locator('.rt-textarea');
    expect((await textareas.nth(0).textContent()).trim()).toBe('A');
    expect((await textareas.nth(1).textContent()).trim()).toBe(''); // BUG would show 'C'
    expect((await textareas.nth(2).textContent()).trim()).toBe('C');
    expect((await textareas.nth(3).textContent()).trim()).toBe('');
  });

  test('C1: insertion-order != field-order (timeWindow inserted first) → fields land in correct slots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Object.values would return ['T', 'B'] if insertion order is [時間範圍, 問題範圍].
    // Without canonical key lookup, idx 0 would get 'T' (wrong).
    const draftOutOfOrder = {};
    draftOutOfOrder['時間範圍'] = 'T';
    draftOutOfOrder['問題範圍'] = 'B';
    const session = {
      id: 'sess-c1-order', question_id: 'q-c1-3',
      question_json: { id: 'q-c1-3', company: 'Airbnb', product: 'Marketplace' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { C1: draftOutOfOrder },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const textareas = page.locator('.rt-textarea');
    expect((await textareas.nth(0).textContent()).trim()).toBe('B'); // 問題範圍
    expect((await textareas.nth(1).textContent()).trim()).toBe('T'); // 時間範圍
  });
});
```

- [ ] **Step 2: Run to verify RED**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/restore-no-drift.spec.js -g "C1" --reporter=line
```

Expected: 3 fail. The drift specs prove the positional fallback bug.

- [ ] **Step 3: Commit RED**

```bash
git add tests/visual/restore-no-drift.spec.js
git commit -m "test(restore): RED — C1 partial-fill no-drift × 3 (Bug B repro)"
```

---

## Task 6 — Bug B: remove fallback + add ENGLISH_ALIAS

**Files:**
- Modify: `public/app.js:2552-2573` (replace the C/I/R/C2 textarea restore block)

- [ ] **Step 1: Replace the restore block**

Open `public/app.js`. Find the block starting at line 2551 (`// ── C/I/R/C2 step ──`) and ending at the closing `}` before the L step block (line 2573 — the one immediately before `// ── R1: L step ──`).

Replace the entire block with:

```js
      // ── C/I/R/C2 step: [data-phase1="textarea"] from circlesFrameworkDraft ──
      // Canonical lookup uses Chinese keys from CIRCLES_STEP_CONFIG.fields[i].key.
      // ENGLISH_ALIAS provides read-only compatibility for sessions saved before
      // the Chinese-key migration (legacy data + older test fixtures).
      // No positional Object.values() fallback — that caused Bug B mapping drift.
      var ENGLISH_ALIAS = {
        '問題範圍': 'boundaryScope', '時間範圍': 'timeWindow',
        '業務影響': 'businessImpact', '假設確認': 'assumption',
        '目標用戶分群': 'targetSegment', '選定焦點對象': 'focusGroup',
        '用戶動機假設(JTBD)': 'jtbd', '排除對象': 'excluded',
        '功能性': 'functional', '情感性': 'emotional', '社交性': 'social', '核心痛點': 'corePain',
        '取捨標準': 'criteria', '最優先': 'priority', '暫緩': 'defer', '排序理由': 'rationale',
      };
      var stepKey = AppState.circlesMode === 'drill'
        ? (AppState.circlesDrillStep || 'C1')
        : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][AppState.circlesSimStep || 0] || 'C1');
      var draftForStep = AppState.circlesFrameworkDraft && AppState.circlesFrameworkDraft[stepKey];
      if (draftForStep) {
        var cfg = CIRCLES_STEP_CONFIG[stepKey];
        if (cfg && cfg.fields) {
          var textareas = document.querySelectorAll('[data-phase1="textarea"]');
          textareas.forEach(function (ta, idx) {
            if (ta.innerHTML && ta.innerHTML.trim()) return;
            var fieldIdx = parseInt(ta.dataset.fieldIdx, 10);
            if (isNaN(fieldIdx)) fieldIdx = idx;
            var fieldKey = cfg.fields[fieldIdx] && cfg.fields[fieldIdx].key;
            if (!fieldKey) return;
            // canonical Chinese-key lookup
            var value = draftForStep[fieldKey];
            // legacy English-alias fallback (read-only; does not affect saves)
            if (value == null || value === '') {
              var alias = ENGLISH_ALIAS[fieldKey];
              if (alias) value = draftForStep[alias];
            }
            if (value) {
              ta.innerHTML = value;
              syncCharCounter(ta);
            }
          });
        }
      }
```

(Note: this block goes inside the existing `(function populateTextareasFromDraft() { ... })()` IIFE — `syncCharCounter` is defined locally above; do not redefine.)

- [ ] **Step 2: Run partial-fill specs to verify GREEN**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/restore-no-drift.spec.js -g "C1" --reporter=line
```

Expected: 3 pass.

- [ ] **Step 3: Run existing offcanvas restore specs (no regression)**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/offcanvas-item-click-restore.spec.js --reporter=line
```

Expected: 12/12 pass (these test fixtures use English keys → ENGLISH_ALIAS path keeps them green). If any fail, audit fixture vs ENGLISH_ALIAS map (must cover every key the fixture uses).

- [ ] **Step 4: Commit GREEN**

```bash
git add public/app.js
git commit -m "fix(restore): GREEN — C/I/R/C2 key-only lookup + English alias (Bug B)"
```

---

## Task 7 — Bug B: I / R / C2 partial-fill regression specs

**Files:**
- Modify: `tests/visual/restore-no-drift.spec.js` (append to existing describe block)

- [ ] **Step 1: Append three more specs**

Append to the same `test.describe(...)` block before the closing `});`:

```js
  test('I step: partial-fill (idx 0 + idx 3 only) → idx 1 idx 2 stay empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-i-partial', question_id: 'q-i',
      question_json: { id: 'q-i', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'I', current_phase: 1, sim_step_index: 1, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { I: { '目標用戶分群': 'GroupA', '排除對象': 'ExcludeZ' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const ta = page.locator('.rt-textarea');
    expect((await ta.nth(0).textContent()).trim()).toBe('GroupA');
    expect((await ta.nth(1).textContent()).trim()).toBe('');
    expect((await ta.nth(2).textContent()).trim()).toBe('');
    expect((await ta.nth(3).textContent()).trim()).toBe('ExcludeZ');
  });

  test('R step: partial-fill (only 核心痛點 idx 3) → idx 3 only', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-r-partial', question_id: 'q-r',
      question_json: { id: 'q-r', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'R', current_phase: 1, sim_step_index: 2, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { R: { '核心痛點': 'CorePain99' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const ta = page.locator('.rt-textarea');
    expect((await ta.nth(0).textContent()).trim()).toBe('');
    expect((await ta.nth(1).textContent()).trim()).toBe('');
    expect((await ta.nth(2).textContent()).trim()).toBe('');
    expect((await ta.nth(3).textContent()).trim()).toBe('CorePain99');
  });

  test('C2 step: partial-fill (idx 1 + idx 2) → idx 0 idx 3 empty, no drift', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-c2-partial', question_id: 'q-c2',
      question_json: { id: 'q-c2', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'C2', current_phase: 1, sim_step_index: 3, status: 'active',
      step_drafts: { ts: Date.now() },
      framework_draft: { C2: { '最優先': 'P1', '暫緩': 'P2' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    const ta = page.locator('.rt-textarea');
    expect((await ta.nth(0).textContent()).trim()).toBe('');
    expect((await ta.nth(1).textContent()).trim()).toBe('P1');
    expect((await ta.nth(2).textContent()).trim()).toBe('P2');
    expect((await ta.nth(3).textContent()).trim()).toBe('');
  });

  test('Legacy English-key alias: framework_draft uses {boundaryScope, timeWindow} → restored to Chinese-keyed slots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-legacy', question_id: 'q-legacy',
      question_json: { id: 'q-legacy', company: 'Old', product: 'Schema' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: { ts: Date.now() - 7 * 24 * 60 * 60 * 1000 }, // pre-migration timestamp
      framework_draft: { C1: { boundaryScope: 'Legacy-bound', timeWindow: 'Legacy-time' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    // Pre-clear localStorage to avoid override from prior tests
    await page.addInitScript(() => { try { localStorage.clear(); } catch (_) {} });
    await openSessionViaOffcanvas(page);
    const ta = page.locator('.rt-textarea');
    expect((await ta.nth(0).textContent()).trim()).toBe('Legacy-bound');
    expect((await ta.nth(1).textContent()).trim()).toBe('Legacy-time');
    expect((await ta.nth(2).textContent()).trim()).toBe('');
    expect((await ta.nth(3).textContent()).trim()).toBe('');
  });
```

- [ ] **Step 2: Run to verify GREEN**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/restore-no-drift.spec.js --reporter=line
```

Expected: 7 pass total (3 from Task 5 + 4 from Task 7).

- [ ] **Step 3: Commit GREEN**

```bash
git add tests/visual/restore-no-drift.spec.js
git commit -m "test(restore): I/R/C2 partial-fill + legacy English-alias regression"
```

---

## Task 8 — L / E / S no-drift regression specs (no fix expected)

**Files:**
- Modify: `tests/visual/restore-no-drift.spec.js` (append L/E/S specs)

These steps' restore paths were audited as structurally safe (push/pop dense arrays + key-map). These specs prove that and prevent future regression.

- [ ] **Step 1: Append L/E/S specs**

```js
  test('L step: only solutions[1] filled → sol-card 0 empty, sol-card 1 shows it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-l-partial', question_id: 'q-l',
      question_json: { id: 'q-l', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'L', current_phase: 1, sim_step_index: 4, status: 'active',
      step_drafts: {
        P1L: [
          { name: '', mechanism: '' },
          { name: 'SolB-name', mechanism: 'SolB-mechanism' },
        ],
        ts: Date.now(),
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    await page.waitForSelector('.sol-card', { timeout: 5000 });
    const m0 = await page.locator('.rt-textarea[data-sol-idx="0"]').textContent();
    const m1 = await page.locator('.rt-textarea[data-sol-idx="1"]').textContent();
    const n0 = await page.locator('input.sol-card__name-input[data-sol-idx="0"]').inputValue();
    const n1 = await page.locator('input.sol-card__name-input[data-sol-idx="1"]').inputValue();
    expect(m0.trim()).toBe('');
    expect(m1.trim()).toBe('SolB-mechanism');
    expect(n0).toBe('');
    expect(n1).toBe('SolB-name');
  });

  test('E step: only sol[1].metrics filled → other 7 nested fields empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-e-partial', question_id: 'q-e',
      question_json: { id: 'q-e', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'E', current_phase: 1, sim_step_index: 5, status: 'active',
      step_drafts: {
        P1L: [
          { name: 'SolA', mechanism: 'A-mech' },
          { name: 'SolB', mechanism: 'B-mech' },
        ],
        P1E: [
          { advantages: '', disadvantages: '', risks: '', metrics: '' },
          { advantages: '', disadvantages: '', risks: '', metrics: 'Metric-99' },
        ],
        ts: Date.now(),
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    await page.waitForSelector('.rt-textarea[data-circles-e-sol-idx]', { timeout: 5000 });
    const sol0Adv = await page.locator('.rt-textarea[data-circles-e-sol-idx="0"][data-circles-e-field-key="advantages"]').textContent();
    const sol1Metrics = await page.locator('.rt-textarea[data-circles-e-sol-idx="1"][data-circles-e-field-key="metrics"]').textContent();
    expect(sol0Adv.trim()).toBe('');
    expect(sol1Metrics.trim()).toBe('Metric-99');
  });

  test('S main: only reasoning filled → recommendation + nsm empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-s-main', question_id: 'q-s',
      question_json: { id: 'q-s', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'S', current_phase: 1, sim_step_index: 6, status: 'active',
      step_drafts: {
        P1S: { recommendation: '', reasoning: 'Reason-OK', nsm: '', tracking: { reach: '', depth: '', frequency: '', impact: '' } },
        ts: Date.now(),
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    await page.waitForSelector('.rt-textarea[data-s-textarea]', { timeout: 5000 });
    const rec = await page.locator('.rt-textarea[data-s-textarea="推薦方案"]').textContent();
    const reason = await page.locator('.rt-textarea[data-s-textarea="選擇理由"]').textContent();
    const nsm = await page.locator('.rt-textarea[data-s-textarea="北極星指標"]').textContent();
    expect(rec.trim()).toBe('');
    expect(reason.trim()).toBe('Reason-OK');
    expect(nsm.trim()).toBe('');
  });

  test('S tracking: only frequency filled → other 3 dims empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-s-track', question_id: 'q-st',
      question_json: { id: 'q-st', company: 'X', product: 'Y' },
      mode: 'drill', drill_step: 'S', current_phase: 1, sim_step_index: 6, status: 'active',
      step_drafts: {
        P1S: { recommendation: 'R', reasoning: 'Why', nsm: 'NSM', tracking: { reach: '', depth: '', frequency: 'freq-99', impact: '' } },
        ts: Date.now(),
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    stubAll(page, session, session);
    await openSessionViaOffcanvas(page);
    await page.waitForSelector('input[data-s-tracking]', { timeout: 5000 });
    expect(await page.locator('input[data-s-tracking="reach"]').inputValue()).toBe('');
    expect(await page.locator('input[data-s-tracking="depth"]').inputValue()).toBe('');
    expect(await page.locator('input[data-s-tracking="frequency"]').inputValue()).toBe('freq-99');
    expect(await page.locator('input[data-s-tracking="impact"]').inputValue()).toBe('');
  });
```

- [ ] **Step 2: Run all restore-no-drift specs**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/restore-no-drift.spec.js --reporter=line
```

Expected: 11 pass (3 + 4 + 4).

- [ ] **Step 3: Commit GREEN**

```bash
git add tests/visual/restore-no-drift.spec.js
git commit -m "test(restore): L/E/S partial-fill regression × 4 (audit confirms safe)"
```

---

## Task 9 — Full 8-viewport regression sweep + visual director review

**Files:**
- Create: `audit/eyeball-stats-and-restore-fix.md`

- [ ] **Step 1: Run full Playwright on critical specs × 8 viewport (chromium)**

```bash
npx playwright test --config=tests/visual/playwright.config.js \
  --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro \
  --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 \
  tests/visual/home-stats-guest.spec.js tests/visual/restore-no-drift.spec.js tests/visual/offcanvas-item-click-restore.spec.js \
  --reporter=line
```

Expected: 100% pass (~32 + 88 + 96 = ~216 specs).

- [ ] **Step 2: Run jest baseline**

```bash
npm test
```

Expected: 161/161 pass (157 baseline + 3 from Task 1 + 1 incidental jest from existing test running with new route registered ≈ 160-161).

- [ ] **Step 3: Capture PNGs at 3 viewports × 2 bugs (sonnet runs Playwright with screenshot helper)**

Create `tests/visual/capture-hotfix-pngs.spec.js` (temporary scratch spec) capturing 6 PNGs:

```js
const { test } = require('@playwright/test');
const fs = require('fs');

test.describe('Capture PNG for opus director Read', () => {
  ['Mobile-360', 'iPad', 'Desktop-1280'].forEach((label, i) => {
    const w = [360, 768, 1280][i], h = [800, 1024, 900][i];
    test(`stats-strip guest ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.route('**/api/circles-stats**', r => r.fulfill({ status: 401, body: '{}' }));
      await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":5,"active":2,"weeklyCompleted":3}' }));
      await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto('/');
      await page.waitForSelector('.qcard');
      await page.waitForFunction(() => document.querySelector('[data-stat="completed"]')?.textContent.trim() === '5');
      fs.mkdirSync('audit/png-hotfix', { recursive: true });
      await page.screenshot({ path: `audit/png-hotfix/stats-${label}.png`, fullPage: false });
    });

    test(`restore C1 partial ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const session = {
        id: 'cap-c1', question_id: 'cap-q',
        question_json: { id: 'cap-q', company: 'Spotify', product: 'Spotify Podcast' },
        mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
        step_drafts: { ts: Date.now() },
        framework_draft: { C1: { '問題範圍': '聚焦免費版的廣告體驗，排除付費方案', '時間範圍': '測試' } },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([session]) }));
      await page.route('**/api/guest-circles-sessions/cap-c1', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }));
      await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto('/');
      await page.waitForSelector('.qcard');
      await page.locator('button[data-nav="offcanvas"]').first().click();
      await page.waitForSelector('.offcanvas-item');
      await page.locator('.offcanvas-item').first().click();
      await page.waitForSelector('.rt-textarea');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `audit/png-hotfix/restore-c1-${label}.png`, fullPage: true });
    });
  });
});
```

Run:

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/capture-hotfix-pngs.spec.js --reporter=line
```

(The capture spec sets viewport explicitly per test, so 1 project run produces all 6 PNGs.)

- [ ] **Step 4: Director (opus, in cold review pass) Read each PNG and write eyeball walk doc**

Director reads:
- `audit/png-hotfix/stats-Mobile-360.png` — assert visible 「5 已完成 · 2 進行中 · 3 本週」 alignment with mockup 01 line 856-872
- `audit/png-hotfix/stats-iPad.png` — assert tablet variant short hint shown
- `audit/png-hotfix/stats-Desktop-1280.png` — assert desktop long hint with 持續 N 週連續練習
- `audit/png-hotfix/restore-c1-Mobile-360.png` — assert idx 0 = 聚焦..., idx 1 = 測試, idx 2/3 empty (placeholder visible)
- `audit/png-hotfix/restore-c1-iPad.png` — same content, tablet layout
- `audit/png-hotfix/restore-c1-Desktop-1280.png` — same content, desktop with rail

Write `audit/eyeball-stats-and-restore-fix.md` with one sentence per PNG covering: viewport / what's visible / mockup line ref / pass/fail.

- [ ] **Step 5: iOS Safari 15-item static review walkthrough**

Walk Master Spec §0.2 15 items against the diff. Items most relevant: focus order on stats-strip (touch target ≥ 44px), input restore on contenteditable (innerHTML write does not break iOS content editing), and SSE/streaming N/A here. Document each in eyeball walk doc.

- [ ] **Step 6: Delete temporary capture spec, commit audit**

```bash
rm tests/visual/capture-hotfix-pngs.spec.js
git add audit/eyeball-stats-and-restore-fix.md audit/png-hotfix/
git commit -m "docs(audit): hotfix eyeball walk × 6 PNG + iOS 15-item static review"
```

---

## Task 10 — Live port + user SOP + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (add hotfix entry to 進度狀態 table)

- [ ] **Step 1: Start dev server (background)**

```bash
npm run dev > /tmp/dev-server.log 2>&1 &
```

(Or whichever start script the repo uses — check `package.json` scripts.) Wait until `Server running on port 3000` appears.

- [ ] **Step 2: Compose user SOP**

Print to user (no file write — message body only):

```
Live port: http://localhost:3000

SOP for Bug A — Stats:
  1. Open http://localhost:3000 in incognito (guest mode)
  2. Confirm stats-strip shows current saved counts (was 0/0/0). If you have a draft → expect 進行中 ≥ 1.
  3. (Optional) Login → confirm stats still load via /api/circles-stats path.

SOP for Bug B — Restore drift:
  1. Open Phase 1 form on any question (drill C 步)
  2. Type 「測試」 ONLY in 時間範圍 (idx 1), leave others empty
  3. Wait ~1.5s for save (saved indicator appears)
  4. Open offcanvas drawer → confirm session appears
  5. Close form (back to home)
  6. Re-open via offcanvas item click
  7. Verify: 時間範圍 shows 「測試」, 業務影響 stays empty (placeholder visible)
  8. Repeat with mixed partial fills across I / R / C2 / L / E / S 步

If anything looks wrong: flag it. Otherwise reply 'OK' to proceed to commit + ship.
```

- [ ] **Step 3: Update CLAUDE.md**

Open `CLAUDE.md`. Add a new row to the 進度狀態 table after the latest hotfix row (offcanvas drafts visibility):

```md
| Post-ship hotfix（user 親要求 — Stats 0/0/0 + restore mapping drift）| ✅ DONE — (1) `/api/guest-circles-stats` 加 guest 分支 mirroring auth route + frontend path branch (`AppState.accessToken ? auth : guest`)；(2) `populateTextareasFromDraft` 移除 `Object.values(...)[fieldIdx]` positional fallback（曾因 partial-fill draftForStep + 鍵插入順序非欄位順序產生 drift），改純 Chinese-key 查找 + ENGLISH_ALIAS 16-key map 兼容舊資料；(3) L/E/S restore audit 確認 push/pop dense + key-map 結構安全，無 code 改動只加 regression spec；(4) jest 161/161；(5) Playwright × 8 viewport 含 stats × 3 + restore-no-drift × 11；(6) opus director Read 6 PNG（stats × 3 vp + restore C1 × 3 vp）+ iOS 15-item 靜檢；spec `2026-05-07-stats-and-restore-fix-design.md` |
```

Update the `Last updated` line at top to reflect this hotfix.

- [ ] **Step 4: After user 'OK' — final commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): mark hotfix DONE — stats + restore drift"
```

- [ ] **Step 5: Stop dev server**

```bash
pkill -f 'node.*server.js' || true
```

(Or kill the background PID from Step 1.)

---

## Self-review (writing-plans skill checklist)

**1. Spec coverage:**
- §1.2 Bug A backend — Tasks 1+2 ✓
- §1.2 Bug A frontend — Tasks 3+4 ✓
- §1.3 Bug A tests — Tasks 1 (jest) + 3 (Playwright) ✓
- §2.3 Bug B fix — Task 6 ✓
- §2.5 Bug B 11 specs — Tasks 5+7+8 (3+4+4 = 11) ✓
- §3 visual verification (8 viewport, Read PNG, pixel-diff stand-in via mockup line ref, eyeball walk, iOS 15-item, live port) — Tasks 9+10 ✓
- §6 success criteria — covered across 9+10 ✓

**2. Placeholder scan:** No "TBD"/"TODO"/"similar to". Each step has explicit code or commands. ✓

**3. Type consistency:**
- `ENGLISH_ALIAS` map keys match `CIRCLES_STEP_CONFIG.fields[i].key` (verified earlier against `public/app.js:346-407`) ✓
- Test fixture `framework_draft.C1` always uses Chinese keys for new specs; legacy spec uses English keys (alias path) ✓
- `data-sol-idx` / `data-circles-e-sol-idx` / `data-s-textarea` / `data-s-tracking` selector attributes match production (verified `public/app.js:2575-2630`) ✓
- `requireGuestId` middleware import path `../middleware/guest` matches `routes/guest-circles-sessions.js` ✓

**4. Pixel-diff note:** No mockup-as-PNG baseline file exists for this hotfix specifically — mockup files are HTML, not PNG. Visual verification proxy is line-by-line mockup HTML reference + director eyeball walk on 6 PNGs. This is consistent with prior hotfix audits (e.g. NSM in-place expand) — mockup HTML reference + eyeball, no automated pixel-diff CI for hotfixes.

---

## Execution

**Subagent-Driven (recommended).** Director (opus) dispatches sonnet implementer per task; cold-reviews each commit; runs full verification (Task 9) himself before user sign-off (Task 10). Per user explicit instruction: opus = director/auditor, sonnet = implementer.
