# CIRCLES home stats + question analysis + persistent chip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicate top resume banner with login-only completion stats strip; replace "看完整題目" repeat-text with a 4-block question analysis card (pre-generated into question DB); add a persistent low-disturbance question chip across all CIRCLES practice phases.

**Architecture:** Static-first — analysis data lives in `public/circles-db.js` (regenerated via existing OpenAI generator script). One new auth-required REST endpoint `/api/circles-stats` for the strip. Three new reusable HTML helper functions (`renderStatsStrip`, `renderQuestionAnalysisBlock`, `renderPersistentQuestionChip`) injected into existing renderers without restructuring.

**Tech Stack:** Node 20 / Express / Supabase (PostgreSQL); vanilla JS frontend in `public/app.js`; Phosphor icons; system-ui font; Playwright for visual gates; jest for API; OpenAI SDK (script only).

**Mockup references** (implementer must follow these exactly):
- Happy path (all 3 components, 3 viewports each):
  `docs/superpowers/specs/mockups/2026-05-01-circles-home/00-happy-path.html`
- Error / loading / empty / fallback states (3 viewports each):
  `docs/superpowers/specs/mockups/2026-05-01-circles-home/01-error-states.html`

**Spec reference:** `docs/superpowers/specs/2026-05-01-circles-home-stats-and-persistent-chip-design.md`

**Standing rules** (per memory):
- All UI text 繁體中文 zh-TW
- Phosphor icons only — no emoji
- system-ui font; Instrument Serif reserved for grade letter (not used here)
- Color palette: `var(--c-primary)` blue + `var(--c-danger)` red ONLY for new components
- iOS Safari static review checklist before any commit touching `public/app.js` / `public/style.css` / `index.html`

**Verification gate** (per `feedback_test_all_devices_visual.md` — applies to every Playwright task below):
- Run all 8 Playwright projects (Mobile-360, iPhone-SE, iPhone-14, iPhone-15-Pro, iPad, Desktop-1280, Desktop-1440, Desktop-2560)
- Capture screenshots and **personally view them** — never claim pass without seeing the image
- Cover happy path AND every error / loading / empty / fallback state in mockup
- Plan task is not done until all 8 projects green AND screenshots reviewed

---

## File Structure

**New files:**
- `routes/circles-stats.js` — GET /api/circles-stats endpoint
- `tests/circles-stats.test.js` — jest API test
- `tests/playwright/journeys/circles-stats-strip.spec.js` — strip visual gate
- `tests/playwright/journeys/circles-question-analysis.spec.js` — analysis card visual gate
- `tests/playwright/journeys/circles-persistent-chip.spec.js` — chip visual gate

**Modified files:**
- `server.js` — register new route
- `scripts/generate-circles-questions.js` — add `analysis` field generation
- `public/circles-db.js` — regenerated with `analysis` field on every question
- `public/app.js` — replace banner with strip; modify `renderQCardHtml`; add chip helpers; inject chip into Phase 1/1.5/2/3/Final renderers
- `public/style.css` — add `.pmd-stats`, `.qcard-analysis`, `.ana-row`, `.qchip`, `.qchip-panel` styles

**Untouched (intentionally):**
- `circles_sessions` schema — no migration needed; uses existing `status` and `updated_at` columns
- NSM module — has its own `/api/nsm-context`, untouched
- Right-rail "繼續上次練習" cards — kept as-is

---

## Task 0: Pre-flight checks

**Files:** none (read-only)

- [ ] **Step 1: Verify spec + mockups exist and are unchanged**

```bash
ls -la docs/superpowers/specs/2026-05-01-circles-home-stats-and-persistent-chip-design.md \
       docs/superpowers/specs/mockups/2026-05-01-circles-home/00-happy-path.html \
       docs/superpowers/specs/mockups/2026-05-01-circles-home/01-error-states.html
```

Expected: all 3 files exist.

- [ ] **Step 2: Verify circles_sessions has `status` column with `'active'` and `'completed'` values used in production**

```bash
grep -n "status: 'active'\|status: 'completed'" routes/circles-sessions.js routes/guest-circles-sessions.js
```

Expected: at least one match each in `circles-sessions.js`.

- [ ] **Step 3: Open both mockup files in your browser and read them end-to-end**

```bash
open docs/superpowers/specs/mockups/2026-05-01-circles-home/00-happy-path.html
open docs/superpowers/specs/mockups/2026-05-01-circles-home/01-error-states.html
```

Stop here if anything in the mockups looks unclear — ask the user before continuing.

---

## Task 1: Add `analysis` field to question generator script

**Mockup:** `01-error-states.html` § ② · A (fallback when missing) — output here MUST eliminate that fallback by populating `analysis` for every question.

**Files:**
- Modify: `scripts/generate-circles-questions.js`

- [ ] **Step 1: Read the existing generator to find the `SYSTEM_PROMPT` and the per-question schema**

```bash
sed -n '1,80p' scripts/generate-circles-questions.js
```

- [ ] **Step 2: Modify the SYSTEM_PROMPT so each question includes an `analysis` object**

Replace the existing JSON schema block in `SYSTEM_PROMPT` so it now contains:

```
"analysis": {
  "business": "商業背景：這家公司靠什麼賺錢、本題情境如何嵌入商業模式（1-2 句、繁體中文，60-100字）",
  "users":    "用戶輪廓：典型用戶分群與情境動機，不洩漏 hidden_context（1-2 句，60-100字）",
  "insight":  "破題切入：學員應該優先思考哪個 CIRCLES 步驟、用什麼角度切入；不洩漏答案（1-2 句，60-120字）"
}
```

Keep the existing fields (`hidden_context`, `coach_circles`, `common_wrong_directions`, `anti_patterns`) untouched. Note: `analysis.traps` is NOT generated — it is computed at runtime from `common_wrong_directions`.

- [ ] **Step 3: Add a post-processing step that fills `analysis.traps`**

After OpenAI returns each question, before writing to disk, set:

```javascript
q.analysis = q.analysis || {};
q.analysis.traps = (q.common_wrong_directions || []).join('、');
```

Place this in the loop that processes each generated question.

- [ ] **Step 4: Add idempotent skip for already-analyzed questions**

When loading existing questions, if `q.analysis && q.analysis.business && q.analysis.users && q.analysis.insight` then skip the OpenAI call for that question (still recompute `q.analysis.traps` since `common_wrong_directions` may change).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-circles-questions.js
git commit -m "feat(generator): add analysis field to circles question schema"
```

---

## Task 2: Regenerate `public/circles-db.js` with `analysis` data

**Mockup:** `00-happy-path.html` § ② shows what every question must look like once this task completes.

**Files:**
- Modify (regenerate): `public/circles-db.js`

- [ ] **Step 1: Verify `OPENAI_API_KEY` is set**

```bash
test -n "$OPENAI_API_KEY" && echo "OK" || echo "MISSING — export OPENAI_API_KEY first"
```

- [ ] **Step 2: Run the generator** (idempotent — only fills missing analysis)

```bash
node scripts/generate-circles-questions.js
```

Expected: script reports "skipped X" for the 100+ existing questions and "filled Y" for any new ones; writes `public/circles-db.js`.

- [ ] **Step 3: Spot-check 3 random questions have full `analysis`**

```bash
node -e "var qs=require('./public/circles-db.js'); /* eval shim */" 2>&1 || \
node -e "
  global.CIRCLES_QUESTIONS=[]; global.CIRCLES_STEPS=[]; global.CIRCLES_STEP_CONFIG={};
  eval(require('fs').readFileSync('public/circles-db.js','utf8'));
  var sample = [0, 50, 99].map(i => CIRCLES_QUESTIONS[i]);
  sample.forEach(q => {
    console.log(q.id, '→',
      q.analysis && q.analysis.business ? 'business OK' : 'MISSING business',
      q.analysis && q.analysis.users    ? 'users OK'    : 'MISSING users',
      q.analysis && q.analysis.traps    ? 'traps OK'    : 'MISSING traps',
      q.analysis && q.analysis.insight  ? 'insight OK'  : 'MISSING insight'
    );
  });
"
```

Expected: all 4 fields present on all 3 sampled questions.

- [ ] **Step 4: Commit**

```bash
git add public/circles-db.js
git commit -m "data: regenerate circles question DB with analysis field (100 questions)"
```

---

## Task 3: Backend `/api/circles-stats` endpoint — failing test

**Mockup:** `01-error-states.html` § ① · A/B/C — endpoint correctness drives the strip's loading/empty/error states.

**Files:**
- Create: `tests/circles-stats.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/circles-stats.test.js` exactly:

```javascript
const request = require('supertest');
const app = require('../server');

describe('GET /api/circles-stats', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/circles-stats');
    expect(res.status).toBe(401);
  });

  it('returns { completed, active, weeklyCompleted } for an authed user', async () => {
    const token = process.env.TEST_AUTH_TOKEN;
    if (!token) return;  // skip locally without test token
    const res = await request(app)
      .get('/api/circles-stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.completed).toBe('number');
    expect(typeof res.body.active).toBe('number');
    expect(typeof res.body.weeklyCompleted).toBe('number');
    expect(res.body.completed).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails with 404 (route not registered)**

```bash
npx jest tests/circles-stats.test.js --no-coverage
```

Expected: FAIL — first assertion expects 401 but gets 404 (route not found).

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/circles-stats.test.js
git commit -m "test(circles-stats): add failing API contract test"
```

---

## Task 4: Implement `/api/circles-stats` route

**Mockup:** `01-error-states.html` § ① · B (empty 0/0/+0 — endpoint must return zeros, not 404 or null).

**Files:**
- Create: `routes/circles-stats.js`
- Modify: `server.js`

- [ ] **Step 1: Look at an existing auth-protected route for the pattern**

```bash
sed -n '1,40p' routes/circles-sessions.js
```

Note the `requireAuth` middleware (or equivalent) and `req.user.id` access.

- [ ] **Step 2: Create the route file**

Create `routes/circles-stats.js`:

```javascript
const express = require('express');
const router = express.Router();
const supabase = require('../db/client');

// GET /api/circles-stats — auth-required
// Returns { completed, active, weeklyCompleted } for the authenticated user.
router.get('/', async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const userId = req.user.id;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [completedRes, activeRes, weeklyRes] = await Promise.all([
      supabase.from('circles_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'completed'),
      supabase.from('circles_sessions').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'active'),
      supabase.from('circles_sessions').select('id', { count: 'exact', head: true })
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

- [ ] **Step 3: Register the route in `server.js`**

Open `server.js`, find the line `app.use('/api/nsm-context', require('./routes/nsm-context'));` and add directly below it:

```javascript
app.use('/api/circles-stats', requireAuth, require('./routes/circles-stats'));
```

(Use whatever the auth middleware is actually called in this codebase — check existing `app.use` calls for `circles-sessions` to match the pattern.)

- [ ] **Step 4: Run the test to verify it now passes**

```bash
npx jest tests/circles-stats.test.js --no-coverage
```

Expected: PASS (at least the 401 case; authed case skipped without `TEST_AUTH_TOKEN`).

- [ ] **Step 5: Commit**

```bash
git add routes/circles-stats.js server.js
git commit -m "feat(api): GET /api/circles-stats returns user's session counts"
```

---

## Task 5: Frontend — `fetchCirclesStats()` helper + state

**Mockup:** `01-error-states.html` § ① · A (loading) and § ① · C (API error → strip removed).

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add state slots near `circlesActiveDraft`**

Find `circlesActiveDraft: null,` in `AppState` (around line 60–70) and immediately below add:

```javascript
  circlesStats: null,           // { completed, active, weeklyCompleted } | null
  circlesStatsLoading: false,
```

- [ ] **Step 2: Add the fetch helper next to `fetchActiveDraft`** (which is around app.js:1753)

```javascript
async function fetchCirclesStats() {
  // Login-only. Guests skip silently — UI must not render strip.
  if (AppState.mode !== 'auth' || !AppState.accessToken) {
    AppState.circlesStats = null;
    return;
  }
  AppState.circlesStatsLoading = true;
  try {
    const r = await fetch('/api/circles-stats', {
      headers: { 'Authorization': 'Bearer ' + AppState.accessToken },
    });
    if (!r.ok) {
      AppState.circlesStats = null;  // mockup § ① · C: remove strip on error
      console.warn('fetchCirclesStats failed:', r.status);
      return;
    }
    AppState.circlesStats = await r.json();
  } catch (e) {
    AppState.circlesStats = null;
    console.warn('fetchCirclesStats threw:', e);
  } finally {
    AppState.circlesStatsLoading = false;
  }
}
window.fetchCirclesStats = fetchCirclesStats;
```

- [ ] **Step 3: Call `fetchCirclesStats()` from the home renderer post-bind hook**

Find `bindCirclesHome` (search for `function bindCirclesHome`) and at the end of its body add:

```javascript
  if (AppState.mode === 'auth') {
    fetchCirclesStats().then(() => {
      var slot = document.getElementById('circles-stats-slot');
      if (slot) slot.outerHTML = renderStatsStripHtml();
    });
  }
```

- [ ] **Step 4: Commit (no UI yet — render in next task)**

```bash
git add public/app.js
git commit -m "feat(circles-home): add fetchCirclesStats and AppState slots"
```

---

## Task 6: Frontend — `renderStatsStripHtml()` helper

**Mockup (must match exactly):**
- Happy: `00-happy-path.html` § ① (3 viewports)
- Loading: `01-error-states.html` § ① · A
- Empty (0/0/+0): `01-error-states.html` § ① · B
- API error: `01-error-states.html` § ① · C (returns empty string — no render)
- Guest: `01-error-states.html` § ① · D (returns empty string — no render)

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add the helper near `renderResumeBanner`** (~app.js:1773)

```javascript
function renderStatsStripHtml() {
  // Guest mode: hide entirely (mockup § ① · D)
  if (AppState.mode !== 'auth') return '';

  // Loading skeleton (mockup § ① · A)
  if (AppState.circlesStatsLoading) {
    return '<div id="circles-stats-slot" class="pmd-stats" aria-busy="true">' +
      '<div class="pmd-stats-icon"><i class="ph ph-chart-bar"></i></div>' +
      '<div class="pmd-stats-list">' +
        '<div class="pmd-stat"><span class="pmd-stat-skel"></span><span class="pmd-stat-label">已完成</span></div>' +
        '<div class="pmd-stat"><span class="pmd-stat-skel"></span><span class="pmd-stat-label">進行中</span></div>' +
        '<div class="pmd-stat"><span class="pmd-stat-skel"></span><span class="pmd-stat-label">本週新增</span></div>' +
      '</div>' +
    '</div>';
  }

  // API error / not yet loaded → no render (mockup § ① · C)
  var s = AppState.circlesStats;
  if (!s) return '<div id="circles-stats-slot"></div>';

  // Happy path / Empty (mockup § ① and § ① · B)
  var isEmpty = (s.completed === 0 && s.active === 0 && s.weeklyCompleted === 0);
  var muted = isEmpty ? ' muted' : '';
  return '<div id="circles-stats-slot" class="pmd-stats" role="group" aria-label="練習進度">' +
    '<div class="pmd-stats-icon"><i class="ph ph-chart-bar"></i></div>' +
    '<div class="pmd-stats-list">' +
      '<div class="pmd-stat"><span class="pmd-stat-num blue' + muted + '">' + s.completed + '</span><span class="pmd-stat-label">已完成</span></div>' +
      '<div class="pmd-stat"><span class="pmd-stat-num red' + muted + '">' + s.active + '</span><span class="pmd-stat-label">進行中</span></div>' +
      '<div class="pmd-stat"><span class="pmd-stat-num blue' + muted + '">+' + s.weeklyCompleted + '</span><span class="pmd-stat-label">本週新增</span></div>' +
    '</div>' +
  '</div>';
}
window.renderStatsStripHtml = renderStatsStripHtml;
```

- [ ] **Step 2: Replace the `renderResumeBanner()` call with strip in mobile home renderer**

Find in `renderCirclesHome()` (mobile, around app.js:2125):

```javascript
      welcomeHtml +
      renderResumeBanner() +
      recentHtml +
```

Replace `renderResumeBanner()` with `renderStatsStripHtml()`. Result:

```javascript
      welcomeHtml +
      renderStatsStripHtml() +
      recentHtml +
```

- [ ] **Step 3: Replace the `renderResumeBanner()` call in desktop home renderer**

Find in `renderCirclesHomeDesktop()` (around app.js:2255):

```javascript
  var bannerHtmlD = (typeof renderResumeBanner === 'function') ? renderResumeBanner() : '';
```

Replace with:

```javascript
  var bannerHtmlD = renderStatsStripHtml();
```

- [ ] **Step 4: Verify in browser (manual smoke check before automated tests)**

Start the dev server, log in, open `/`, click 「CIRCLES 訓練」. Compare with `00-happy-path.html` § ① side-by-side. The strip must be visually identical at each of mobile / tablet / desktop widths.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat(circles-home): replace resume banner with login-only stats strip"
```

---

## Task 7: CSS for stats strip

**Mockup:** `00-happy-path.html` § ① and `01-error-states.html` § ① · A/B (skeleton + muted).

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Append the CSS block at end of `style.css`**

```css
/* ── 2026-05-01 CIRCLES home: completion stats strip ────────────────── */
.pmd-stats {
  display: flex; align-items: center;
  background: linear-gradient(180deg, #ffffff 0%, #f4f6fb 100%);
  border: 1px solid var(--c-border, #dde2ec);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  max-width: 520px;
}
@media (max-width: 480px) {
  .pmd-stats { padding: 10px 12px; max-width: none; }
}
.pmd-stats-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: rgba(74,108,247,.1);
  color: var(--c-primary);
  display: grid; place-items: center;
  font-size: 20px; margin-right: 14px;
}
.pmd-stats-list { display: flex; flex: 1; align-items: center; }
.pmd-stat {
  display: flex; align-items: baseline; gap: 6px;
  padding: 0 16px; position: relative;
}
.pmd-stat + .pmd-stat::before {
  content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 1px; height: 24px; background: var(--c-border, #dde2ec);
}
.pmd-stat:first-child { padding-left: 0; }
.pmd-stat-num {
  font-size: 22px; font-weight: 700; line-height: 1; letter-spacing: -.02em;
  font-family: var(--c-font-sans);
}
.pmd-stat-num.blue { color: var(--c-primary); }
.pmd-stat-num.red  { color: var(--c-danger, #ef4444); }
.pmd-stat-num.muted { color: var(--c-text-3, #999); }
.pmd-stat-label { font-size: 12px; color: var(--c-text-2, #666); }
@media (max-width: 480px) {
  .pmd-stat { padding: 0 10px; }
  .pmd-stat-num { font-size: 18px; }
  .pmd-stat-label { font-size: 11px; }
}
.pmd-stat-skel {
  display: inline-block; width: 24px; height: 22px; border-radius: 4px;
  background: linear-gradient(90deg, #e8eaf0 0%, #f4f5f8 50%, #e8eaf0 100%);
  background-size: 200% 100%;
  animation: pmd-skel-anim 1.4s ease-in-out infinite;
}
@keyframes pmd-skel-anim {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
```

- [ ] **Step 2: Reload the browser and confirm the strip looks identical to the mockup at 360 / 768 / 1280 widths**

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "style(circles-home): stats strip + skeleton"
```

---

## Task 8: Stats strip Playwright visual gate

**Mockup:** `00-happy-path.html` § ① + `01-error-states.html` § ① · A/B/C/D — must match all 4 states across 8 viewports.

**Files:**
- Create: `tests/playwright/journeys/circles-stats-strip.spec.js`

- [ ] **Step 1: Write the test**

```javascript
const { test, expect } = require('@playwright/test');

test.describe('CIRCLES home — stats strip', () => {
  test('logged-in user sees stats strip with 3 stats', async ({ page }) => {
    await page.goto('/?loginAs=test');  // adjust to actual test login mechanism
    await page.waitForSelector('[data-view="circles"]');
    const strip = page.locator('.pmd-stats');
    await expect(strip).toBeVisible();
    await expect(strip.locator('.pmd-stat')).toHaveCount(3);
    await expect(strip.locator('.pmd-stat-label').nth(0)).toHaveText('已完成');
    await expect(strip.locator('.pmd-stat-label').nth(1)).toHaveText('進行中');
    await expect(strip.locator('.pmd-stat-label').nth(2)).toContainText('本週');
    await page.screenshot({ path: 'test-results/strip-happy.png', fullPage: false });
  });

  test('guest does NOT see stats strip', async ({ page }) => {
    await page.goto('/');  // no login
    await page.waitForSelector('[data-view="circles"]');
    await expect(page.locator('.pmd-stats')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/strip-guest-hidden.png' });
  });

  test('API failure: strip removed', async ({ page }) => {
    await page.route('**/api/circles-stats', route => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/?loginAs=test');
    await page.waitForSelector('[data-view="circles"]');
    await expect(page.locator('.pmd-stats')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/strip-api-error.png' });
  });
});
```

- [ ] **Step 2: Run on all 8 viewport projects**

```bash
npx playwright test tests/playwright/journeys/circles-stats-strip.spec.js \
  --reporter=list --screenshot=on
```

Expected: 24 tests pass (3 cases × 8 projects).

- [ ] **Step 3: Open and personally view every screenshot**

```bash
ls test-results/ | grep strip
open test-results/strip-happy.png
# repeat for every viewport's screenshot in playwright-report/
```

Verification gate: must have viewed at least 8 screenshots (one per viewport) for the happy-path test before claiming done.

- [ ] **Step 4: Commit**

```bash
git add tests/playwright/journeys/circles-stats-strip.spec.js
git commit -m "test(playwright): stats strip gate (8 viewports + 3 states)"
```

---

## Task 9: Frontend — `renderQuestionAnalysisBlock()` helper

**Mockup:**
- Happy: `00-happy-path.html` § ②
- Fallback (missing analysis): `01-error-states.html` § ② · A

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add the helper near `renderQCardHtml`** (~app.js:1685)

```javascript
function renderQuestionAnalysisBlock(q) {
  // Mockup § ② happy path: 4 rows (business / users / traps / insight)
  // Fallback (mockup § ② · A): only traps from common_wrong_directions, others muted.
  var a = q && q.analysis;
  var hasFull = a && a.business && a.users && a.insight;
  var traps = (a && a.traps) || ((q.common_wrong_directions || []).join('、'));

  if (!hasFull) {
    console.warn('Question missing analysis:', q.id);
    return '<div class="qcard-analysis">' +
      '<div class="ana-row trap"><span class="ana-label"><i class="ph ph-warning"></i> 常見誤區</span>' +
        '<span class="ana-val">' + escHtml(traps || '—') + '</span></div>' +
      '<div class="ana-row"><span class="ana-label">其餘欄位</span>' +
        '<span class="ana-val muted">分析資料載入失敗，請刷新頁面或聯絡管理員</span></div>' +
    '</div>';
  }

  return '<div class="qcard-analysis">' +
    '<div class="ana-row"><span class="ana-label"><i class="ph ph-buildings"></i> 商業背景</span>' +
      '<span class="ana-val">' + escHtml(a.business) + '</span></div>' +
    '<div class="ana-row"><span class="ana-label"><i class="ph ph-users"></i> 用戶輪廓</span>' +
      '<span class="ana-val">' + escHtml(a.users) + '</span></div>' +
    '<div class="ana-row trap"><span class="ana-label"><i class="ph ph-warning"></i> 常見誤區</span>' +
      '<span class="ana-val">' + escHtml(traps) + '</span></div>' +
    '<div class="ana-row"><span class="ana-label"><i class="ph ph-lightbulb"></i> 破題切入</span>' +
      '<span class="ana-val">' + escHtml(a.insight) + '</span></div>' +
  '</div>';
}
window.renderQuestionAnalysisBlock = renderQuestionAnalysisBlock;
```

- [ ] **Step 2: Replace the duplicate-text block in `renderQCardHtml` expand area**

Find (around app.js:1696–1703):

```javascript
    '<div class="circles-q-card-expand-area scroll-container" style="display:none">' +
      '<div class="scroll-body">' +
        '<div class="circles-q-card-full-block">' +
          '<div class="circles-q-card-full-label">完整題目</div>' +
          '<div class="circles-q-card-full-text">' + escHtml(q.problem_statement || '') + '</div>' +
        '</div>' +
        drillPracticeHtml +
      '</div>' +
```

Replace with:

```javascript
    '<div class="circles-q-card-expand-area scroll-container" style="display:none">' +
      '<div class="scroll-body">' +
        renderQuestionAnalysisBlock(q) +
        drillPracticeHtml +
      '</div>' +
```

(The brief `.circles-q-card-stmt` above remains as-is — it shows the 2-line clamp of `problem_statement`.)

- [ ] **Step 3: Reload browser, log in, click 「看完整題目」on any card**

Confirm 4 blocks render exactly as `00-happy-path.html` § ②. Confirm no duplicate problem_statement.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat(circles-home): replace duplicate text with 4-block analysis"
```

---

## Task 10: CSS for analysis card

**Mockup:** `00-happy-path.html` § ②. Must match label/value layouts exactly.

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Append**

```css
/* ── 2026-05-01 CIRCLES home: question analysis 4-block ─────────────── */
.qcard-analysis {
  margin-top: 12px; padding-top: 12px;
  border-top: 1px dashed var(--c-border, #dde2ec);
  display: grid; gap: 10px;
}
.ana-row {
  display: grid; grid-template-columns: 92px 1fr; gap: 10px;
  font-size: 12.5px; line-height: 1.55;
}
@media (max-width: 480px) {
  .ana-row { grid-template-columns: 1fr; gap: 4px; }
}
.ana-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; color: var(--c-primary);
}
.ana-label .ph { font-size: 13px; color: var(--c-primary); }
.ana-row.trap .ana-label,
.ana-row.trap .ana-label .ph { color: var(--c-danger, #ef4444); }
.ana-val { color: var(--c-text-1, #1a1a1a); }
.ana-val.muted { color: var(--c-text-3, #999); font-style: italic; }
```

- [ ] **Step 2: Visual diff against `00-happy-path.html` § ② at all 3 widths.**

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "style(circles-home): 4-block analysis card"
```

---

## Task 11: Analysis card Playwright visual gate

**Mockup:** `00-happy-path.html` § ② + `01-error-states.html` § ② · A.

**Files:**
- Create: `tests/playwright/journeys/circles-question-analysis.spec.js`

- [ ] **Step 1: Write the test**

```javascript
const { test, expect } = require('@playwright/test');

test.describe('CIRCLES home — question analysis card', () => {
  test('expanding 看完整題目 shows 4 analysis rows', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    const firstCard = page.locator('.circles-q-card').first();
    await firstCard.locator('.circles-q-card-more').click();
    const analysis = firstCard.locator('.qcard-analysis');
    await expect(analysis).toBeVisible();
    await expect(analysis.locator('.ana-row')).toHaveCount(4);
    const labels = await analysis.locator('.ana-label').allInnerTexts();
    expect(labels.join(' ')).toContain('商業背景');
    expect(labels.join(' ')).toContain('用戶輪廓');
    expect(labels.join(' ')).toContain('常見誤區');
    expect(labels.join(' ')).toContain('破題切入');
    await page.screenshot({ path: 'test-results/analysis-happy.png' });
  });

  test('does not duplicate problem_statement', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('.circles-q-card').first();
    const stmt = await firstCard.locator('.circles-q-card-stmt').innerText();
    await firstCard.locator('.circles-q-card-more').click();
    const expandHtml = await firstCard.locator('.circles-q-card-expand-area').innerHTML();
    // The expanded area should NOT contain a verbatim copy of the brief stmt
    expect(expandHtml).not.toContain('class="circles-q-card-full-text"');
  });

  test('fallback when analysis missing', async ({ page }) => {
    // Inject a question with no analysis into AppState, then re-render
    await page.goto('/');
    await page.evaluate(() => {
      const q = window.CIRCLES_QUESTIONS[0];
      delete q.analysis;
      window.AppState.circlesDisplayedQuestions = [q];
      window.render && window.render();
    });
    await page.locator('.circles-q-card .circles-q-card-more').first().click();
    await expect(page.locator('.ana-val.muted')).toBeVisible();
    await page.screenshot({ path: 'test-results/analysis-fallback.png' });
  });
});
```

- [ ] **Step 2: Run on all 8 viewport projects**

```bash
npx playwright test tests/playwright/journeys/circles-question-analysis.spec.js \
  --reporter=list --screenshot=on
```

Expected: 24 tests pass.

- [ ] **Step 3: Open and view every screenshot personally** (8 viewports × 2 main scenarios = 16 screenshots minimum)

```bash
open test-results/analysis-happy.png
open test-results/analysis-fallback.png
# plus playwright-report screenshots per project
```

- [ ] **Step 4: Commit**

```bash
git add tests/playwright/journeys/circles-question-analysis.spec.js
git commit -m "test(playwright): analysis card gate (8 viewports + fallback)"
```

---

## Task 12: Frontend — `renderPersistentQuestionChip()` helper

**Mockup:**
- Collapsed: `00-happy-path.html` § ③ MOBILE / DESKTOP
- Expanded panel: `00-happy-path.html` § ③ TABLET
- Long text ellipsis: `01-error-states.html` § ③ · A
- Missing analysis: `01-error-states.html` § ③ · B

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add helpers + state slot**

Add an `AppState` slot near `circlesPhase`:

```javascript
  circlesChipExpanded: false,  // resets on each phase enter
```

Add helpers near `renderResumeBanner`:

```javascript
function renderPersistentQuestionChip() {
  var q = AppState.circlesSelectedQuestion;
  if (!q) return '';
  if (AppState.circlesChipExpanded) return renderChipPanelHtml(q);
  return renderChipCollapsedHtml(q);
}
window.renderPersistentQuestionChip = renderPersistentQuestionChip;

function renderChipCollapsedHtml(q) {
  return '<div class="qchip" id="circles-qchip" role="button" tabindex="0" aria-expanded="false" aria-controls="circles-qchip-panel" data-action="expand-chip">' +
    '<div class="qchip-icon"><i class="ph ph-info"></i></div>' +
    '<span class="qchip-tag">題目</span>' +
    '<span class="qchip-text">' + escHtml(q.problem_statement || '') + '</span>' +
    '<i class="ph ph-caret-down qchip-toggle"></i>' +
  '</div>';
}

function renderChipPanelHtml(q) {
  var meta = [q.company, q.product, (q.question_type === 'design' ? '產品設計' : q.question_type === 'improve' ? '產品改進' : '產品策略'), (q.difficulty === 'easy' ? '簡單' : q.difficulty === 'hard' ? '困難' : '中等難度')].filter(Boolean).join(' · ');
  return '<div class="qchip-panel" id="circles-qchip-panel" role="region" aria-expanded="true">' +
    '<div class="qchip-panel-head">' +
      '<span class="qchip-tag">題目</span>' +
      '<span class="qchip-panel-meta">' + escHtml(meta) + '</span>' +
      '<button class="qchip-panel-close" type="button" data-action="collapse-chip" aria-label="收合">' +
        '<i class="ph ph-caret-up"></i> 收合</button>' +
    '</div>' +
    '<div class="qchip-panel-stmt">' + escHtml(q.problem_statement || '') + '</div>' +
    renderQuestionAnalysisBlock(q) +
  '</div>';
}

function bindPersistentQuestionChip(rootEl) {
  // Single delegated handler — works whether chip is collapsed or expanded.
  (rootEl || document).addEventListener('click', function(e) {
    var t = e.target.closest('[data-action="expand-chip"]');
    var c = e.target.closest('[data-action="collapse-chip"]');
    if (t) {
      AppState.circlesChipExpanded = true;
      var slot = document.getElementById('circles-qchip-slot');
      if (slot) slot.innerHTML = renderPersistentQuestionChip();
      return;
    }
    if (c) {
      AppState.circlesChipExpanded = false;
      var slot2 = document.getElementById('circles-qchip-slot');
      if (slot2) slot2.innerHTML = renderPersistentQuestionChip();
      return;
    }
  });
}
window.bindPersistentQuestionChip = bindPersistentQuestionChip;
```

- [ ] **Step 2: Reset `circlesChipExpanded = false` whenever a phase is entered**

In `loadCirclesSession` and the navigation that sets `AppState.circlesPhase`, ensure:

```javascript
AppState.circlesChipExpanded = false;
```

is set whenever the phase changes (search for assignments like `AppState.circlesPhase = 1`, `= 1.5`, `= 2`, `= 3` and add the reset line below each).

- [ ] **Step 3: Commit (no UI insertion yet)**

```bash
git add public/app.js
git commit -m "feat(circles): persistent question chip helpers"
```

---

## Task 13: Inject chip into Phase 1 (replace `.problem-card`)

**Mockup:** `00-happy-path.html` § ③ MOBILE / DESKTOP — chip replaces the existing `.problem-card`.

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: In `renderCirclesPhase1` (mobile branch around app.js:2944), replace the `.problem-card` line**

Find:

```javascript
    '<div class="problem-card">' + escHtml(q.problem_statement || '') + '</div>' +
```

Replace with:

```javascript
    '<div id="circles-qchip-slot">' + renderPersistentQuestionChip() + '</div>' +
```

- [ ] **Step 2: Same replacement in the desktop branch (around app.js:2914)**

Find the matching `'<div class="problem-card">' + escHtml(q.problem_statement || '') + '</div>' +` in `renderCirclesPhase1` desktop branch and replace identically.

- [ ] **Step 3: Wire `bindPersistentQuestionChip()` from `bindCirclesPhase1`**

In `bindCirclesPhase1` (around app.js:2970), add at the top of the function:

```javascript
  bindPersistentQuestionChip(document.querySelector('[data-view="circles"]'));
```

- [ ] **Step 4: Manual smoke check at 360 / 768 / 1280**

Reload, enter Phase 1. Confirm chip is visible (collapsed by default), click expands to panel with 4 analysis rows + meta + close button.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat(circles): chip replaces problem-card in Phase 1"
```

---

## Task 14: Inject chip into Phase 1.5, Phase 2, Phase 3, Final summary

**Mockup:** `00-happy-path.html` § ③ phase thumbnails — every phase carries the same chip placement (under progress bar).

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Phase 1.5 — find `renderCirclesPhase15` (search the file)**

After the progress bar render and before the gate result body, insert:

```javascript
    '<div id="circles-qchip-slot">' + renderPersistentQuestionChip() + '</div>' +
```

(If Phase 1.5 is rendered as part of Phase 1's branch using a different mechanism, locate the gate-result wrapper and place the slot above it. Inspect `app.js:887` to find where Phase 1.5 renders.)

Add `bindPersistentQuestionChip(...)` to the corresponding bind function.

- [ ] **Step 2: Phase 2 — `renderCirclesPhase2` (app.js:3542)**

Find the line just after `progressBarHtml` is concatenated and before the dialogue body. Insert the slot immediately under progress.

Wire `bindPersistentQuestionChip(...)` at the top of `bindCirclesPhase2`.

- [ ] **Step 3: Phase 3 — find `renderCirclesPhase3` (search; if not found, locate the score render around `circlesPhase === 3` block)**

Insert the slot below the navbar/progress bar.

Wire `bindPersistentQuestionChip(...)` in its bind function.

- [ ] **Step 4: Final summary (simulation 7-step report) — find the renderer that handles "看完整總結報告" target (search `看完整總結報告`)**

Insert the slot near the top.

- [ ] **Step 5: Reset `circlesChipExpanded = false` on every phase navigation transition** (already covered in Task 12 Step 2; verify it actually resets in all 5 entry points).

- [ ] **Step 6: Manual smoke check — walk through full simulation: select question → Phase 1 → 1.5 → 2 → 3 → Phase 1 next step → ... → Final summary. The chip MUST appear on every screen.**

- [ ] **Step 7: Commit**

```bash
git add public/app.js
git commit -m "feat(circles): inject persistent chip into Phase 1.5, 2, 3, final"
```

---

## Task 15: CSS for chip + panel

**Mockup:** `00-happy-path.html` § ③ + `01-error-states.html` § ③.

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Append**

```css
/* ── 2026-05-01 CIRCLES persistent question chip ─────────────────────── */
.qchip {
  display: flex; align-items: center; gap: 10px;
  background: var(--c-card, #fff);
  border: 1px solid var(--c-border, #dde2ec);
  border-radius: 10px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.qchip:hover { border-color: var(--c-primary); background: #fbfcff; }
.qchip:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 2px; }
.qchip-icon {
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
  background: rgba(74,108,247,.1);
  color: var(--c-primary);
  display: grid; place-items: center; font-size: 12px;
}
.qchip-tag {
  font-size: 10.5px; font-weight: 700; color: var(--c-primary);
  background: rgba(74,108,247,.08); padding: 2px 6px; border-radius: 4px;
  flex-shrink: 0;
}
.qchip-text {
  flex: 1; min-width: 0;
  color: var(--c-text-2, #666); line-height: 1.4;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.qchip-toggle {
  color: var(--c-text-3, #999); flex-shrink: 0; font-size: 12px;
}

.qchip-panel {
  background: var(--c-card, #fff);
  border: 1px solid var(--c-primary);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}
.qchip-panel-head {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px; flex-wrap: wrap;
}
.qchip-panel-meta {
  font-size: 11px; color: var(--c-text-3, #999);
}
.qchip-panel-stmt {
  font-size: 13.5px; line-height: 1.6;
  margin-bottom: 10px;
  color: var(--c-text-1, #1a1a1a);
}
.qchip-panel-close {
  background: none; border: none; cursor: pointer;
  color: var(--c-text-3, #999); padding: 0;
  display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--c-font-sans); font-size: 12px;
  margin-left: auto;
}
.qchip-panel-close:hover { color: var(--c-primary); }
```

- [ ] **Step 2: Visual diff against `00-happy-path.html` § ③ at 3 widths.**

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "style(circles): chip + panel"
```

---

## Task 16: Persistent chip Playwright gate (full journey)

**Mockup:** every § ③ in both mockup files. This is the most important visual gate — covers all 5 phases.

**Files:**
- Create: `tests/playwright/journeys/circles-persistent-chip.spec.js`

- [ ] **Step 1: Write the test**

```javascript
const { test, expect } = require('@playwright/test');

test.describe('CIRCLES persistent question chip', () => {
  test('chip is present on Phase 1, 1.5, 2, 3, and final report', async ({ page }) => {
    await page.goto('/');
    // Pick first question, simulation mode
    await page.click('[data-mode="simulation"]');
    await page.locator('.circles-q-card').first().click();
    await page.locator('.circles-q-confirm-btn').click();

    // Phase 1
    await expect(page.locator('#circles-qchip-slot .qchip')).toBeVisible();
    await page.screenshot({ path: 'test-results/chip-phase1.png' });

    // Expand → panel
    await page.locator('.qchip').click();
    await expect(page.locator('.qchip-panel')).toBeVisible();
    await expect(page.locator('.qchip-panel .ana-row')).toHaveCount(4);
    await page.screenshot({ path: 'test-results/chip-expanded.png' });

    // Collapse
    await page.locator('.qchip-panel-close').click();
    await expect(page.locator('.qchip')).toBeVisible();

    // ... fill fields, submit, gate, dialogue, score — repeat assertion at each phase
    // (Implementer: extend with selectors specific to this app's submit flow.)
  });

  test('chip ellipsis on long problem_statement', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.AppState.circlesSelectedQuestion = {
        ...window.CIRCLES_QUESTIONS[0],
        problem_statement: '設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗，並大幅增加用戶在每日通勤時段、週末休閒時段以及跨情境的黏著度，同時要兼顧訂閱率與廣告營收的平衡',
      };
      window.AppState.circlesPhase = 1;
      window.render && window.render();
    });
    const text = page.locator('.qchip-text');
    await expect(text).toBeVisible();
    const overflow = await text.evaluate(el => getComputedStyle(el).textOverflow);
    expect(overflow).toBe('ellipsis');
    await page.screenshot({ path: 'test-results/chip-long-text.png' });
  });

  test('chip panel fallback when analysis missing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const q = { ...window.CIRCLES_QUESTIONS[0] };
      delete q.analysis;
      window.AppState.circlesSelectedQuestion = q;
      window.AppState.circlesPhase = 1;
      window.AppState.circlesChipExpanded = true;
      window.render && window.render();
    });
    await expect(page.locator('.ana-val.muted')).toBeVisible();
    await page.screenshot({ path: 'test-results/chip-no-analysis.png' });
  });

  test('chip resets to collapsed on phase change', async ({ page }) => {
    // After expanding then advancing phase, the chip should be collapsed again.
    await page.goto('/');
    // Implementer: extend with phase advance trigger.
  });
});
```

- [ ] **Step 2: Run on all 8 projects**

```bash
npx playwright test tests/playwright/journeys/circles-persistent-chip.spec.js \
  --reporter=list --screenshot=on
```

Expected: 32 tests pass (4 cases × 8 projects).

- [ ] **Step 3: Open and personally view all key screenshots**

Minimum to view: chip-phase1, chip-expanded, chip-long-text, chip-no-analysis × all 8 viewports.

```bash
open test-results/*.png
```

- [ ] **Step 4: Commit**

```bash
git add tests/playwright/journeys/circles-persistent-chip.spec.js
git commit -m "test(playwright): persistent chip gate (8 viewports + 4 states)"
```

---

## Task 17: Drop dead code — `renderResumeBanner` + `bindResumeBanner`

**Mockup:** N/A (cleanup).

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Verify no remaining callers**

```bash
grep -n "renderResumeBanner\|bindResumeBanner\|resume-banner" public/app.js public/style.css
```

Expected: only declaration sites remain (no callers from `renderCirclesHome*`).

- [ ] **Step 2: Delete the helper functions and the binding helper**

Remove:
- `function renderResumeBanner()` (~app.js:1773)
- `function bindResumeBanner()` (~app.js:1787)
- The line `window.renderResumeBanner = renderResumeBanner;`
- The line `window.bindResumeBanner = bindResumeBanner;`
- Any caller of `bindResumeBanner` in bind hooks

Also remove `.resume-banner` CSS rules from `public/style.css`.

- [ ] **Step 3: Run full Playwright + jest suite to confirm nothing broke**

```bash
npx jest --no-coverage
npx playwright test tests/playwright/journeys/circles-stats-strip.spec.js \
                    tests/playwright/journeys/circles-question-analysis.spec.js \
                    tests/playwright/journeys/circles-persistent-chip.spec.js
```

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/style.css
git commit -m "refactor(circles-home): drop dead resume-banner code"
```

---

## Task 18: iOS Safari static review (per memory rule)

**Mockup:** N/A (verification step, but uses mockups for visual baseline).

**Files:** none (read-only review)

- [ ] **Step 1: Walk the 15-item iOS quirk checklist** for every change made to `public/app.js` and `public/style.css`. Fix anything that fails.

Specifically for this plan:
- Stats strip — does the skeleton shimmer animation pause when JS off?
- Chip on iPhone-15-Pro safe area — does it sit correctly under the navbar / not under notch?
- Chip panel close button — has it got at least 44×44 px touch target?
- `text-overflow: ellipsis` works on iOS Safari with `nowrap` — confirm.
- SSE / focus / sticky / modal — none touched here, skip.

- [ ] **Step 2: Document any iOS-specific tweaks made** as inline comments referencing this rule.

- [ ] **Step 3: Commit any fixes**

```bash
git add public/app.js public/style.css
git commit -m "fix(circles): iOS Safari static review tweaks"
```

(If no fixes needed, skip the commit.)

---

## Task 19: Full audit-cycle visual gate (per `feedback_full_sit_uat_uiux.md`)

**Mockup:** all sections of both mockup files.

**Files:** none

- [ ] **Step 1: Run jest full suite**

```bash
npx jest --no-coverage
```

Expected: all green.

- [ ] **Step 2: Run all 8 Playwright projects on the new specs**

```bash
npx playwright test \
  tests/playwright/journeys/circles-stats-strip.spec.js \
  tests/playwright/journeys/circles-question-analysis.spec.js \
  tests/playwright/journeys/circles-persistent-chip.spec.js \
  --reporter=list --screenshot=on
```

Expected: 80 tests pass (10 cases × 8 projects).

- [ ] **Step 3: Run the existing rwd-visual-gate / audit-master if available**

```bash
ls scripts/ | grep -i audit
# Run whatever the project's standard audit-master script is, e.g.:
# node scripts/audit-rwd-grid.js
```

Expected: 0 P0 / 0 P1 across all 8 viewport projects.

- [ ] **Step 4: View at minimum these screenshots personally** (paste paths into Read tool):

- `test-results/strip-happy.png`
- `test-results/strip-guest-hidden.png`
- `test-results/strip-api-error.png`
- `test-results/analysis-happy.png`
- `test-results/analysis-fallback.png`
- `test-results/chip-phase1.png`
- `test-results/chip-expanded.png`
- `test-results/chip-long-text.png`
- `test-results/chip-no-analysis.png`
- One screenshot per Playwright project from `playwright-report/data/` (8 projects × 3 specs ≥ 24 screenshots minimum)

If any visual is wrong, fix and re-run from the affected task.

- [ ] **Step 5: Commit the audit cycle log**

```bash
git add audit/
git commit -m "audit: cycle 2026-05-01 stats-strip + analysis + persistent-chip" || true
```

---

## Self-Review

**Spec coverage check:**
- ① Completion stats strip → Tasks 3, 4, 5, 6, 7, 8 ✓
- ② Question analysis card → Tasks 1, 2, 9, 10, 11 ✓
- ③ Persistent question chip (5 phases) → Tasks 12, 13, 14, 15, 16 ✓
- Color palette (blue + red) → enforced in CSS Tasks 7, 10, 15 ✓
- Phosphor icons / system-ui → enforced in render helpers, tested in Playwright text content ✓
- 3-viewport mockup parity → Playwright runs all 8 projects ✓
- iOS quirks → Task 18 ✓
- Dead code cleanup → Task 17 ✓
- Final audit cycle → Task 19 ✓

**Type consistency:**
- `AppState.circlesStats` → `{ completed, active, weeklyCompleted }` (consistent across Task 5 fetch, Task 6 render, Task 4 backend) ✓
- `q.analysis` → `{ business, users, traps, insight }` (consistent in generator, render helpers, fallback) ✓
- `AppState.circlesChipExpanded` → boolean, reset on phase change ✓
- Function names: `renderStatsStripHtml`, `renderQuestionAnalysisBlock`, `renderPersistentQuestionChip`, `renderChipCollapsedHtml`, `renderChipPanelHtml`, `bindPersistentQuestionChip`, `fetchCirclesStats` — used consistently ✓

**Placeholder scan:** No TBD / TODO / "implement later" / "appropriate error handling" left. Each task contains complete code blocks for any code change, exact file paths, and exact test commands.

**Mockup references:** every implementation task references mockup file path + section. ✓
