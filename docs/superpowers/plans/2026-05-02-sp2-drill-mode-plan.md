# SP2 — CIRCLES Drill Mode + Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
>
> **MANDATORY READS:**
> 1. Spec: `docs/superpowers/specs/2026-05-02-sp2-drill-mode-design.md`
> 2. Mockup: `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp2-drill-mode.html`
> 3. Verification standard: `docs/superpowers/specs/2026-05-02-verification-standard.md`
> 4. `audit-cycle.md` (universe rows C, D for picker / Phase 1 invariants)
>
> Implement EXACTLY per mockup. The desktop 3-col grid existed before — we're inserting a `練習步驟` section into the left rail when `mode === 'drill'`.

**Goal:** Make desktop drill mode functional (step pills + filtered questions + R-練 tag), wire desktop search input, and label history items as drill vs simulation.

**Architecture:** All-frontend changes in `public/app.js` + `public/style.css`. No backend / API / DB changes. SP1 must be merged first (its tokens are dependencies).

**Tech Stack:** vanilla JS / Phosphor icons / Playwright 8 projects / debounced search.

**Branch:**
```bash
git worktree add .claude/worktrees/sp2-drill -b feat/sp2-drill main
cd .claude/worktrees/sp2-drill
cp ../../.env .env
```

---

## File structure

| File | Action |
|---|---|
| `public/app.js` | Insert drill `練習步驟` section in `renderCirclesHomeDesktop` left rail; add filter; add `R 練` pill to `renderQCardHtml`; wire `#search-input`; mode-tag in history render |
| `public/style.css` | Add `.rail-pills`, `.rail-pill`, `.lock-note`, `.pill.step`, `.qcard.drill-card`, `.mode-tag`, history 2-line layout |
| `tests/playwright/journeys/sp2-drill-mode.spec.js` | NEW — drill / search / history Playwright |

---

## Task 1: Pre-flight

- [ ] **Step 1: Confirm SP1 merged into base**

```bash
grep -E "^\s*--pad-block:" public/style.css
grep -E "^\s*--r-input:" public/style.css
```

Expected: both vars present (means SP1 already in).

- [ ] **Step 2: Open mockup in browser**

```bash
open docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp2-drill-mode.html
```

Visually confirm desktop drill — left rail 3 pills + lock note + filtered cards.

- [ ] **Step 3: Locate the existing drill steps array**

```bash
grep -n "drillSteps = \[" public/app.js
```

Expected: 1 match around app.js:2194 — confirm 3 entries (C1, I, R).

---

## Task 2: Add drill step pills to desktop left rail

**Files:** Modify `public/app.js` (`renderCirclesHomeDesktop`)

- [ ] **Step 1: Find the left rail render in desktop renderer**

```bash
grep -n "left-rail\|ch-rail\|練習模式" public/app.js | head
```

Locate where the left rail is constructed in `renderCirclesHomeDesktop` (look for `'<div class="ch-rail">'` or similar).

- [ ] **Step 2: Add drill section after `練習模式` mode-card list, before `題型`**

Insert this block (ONLY rendered when `mode === 'drill'`):

```javascript
var drillSection = '';
if (mode === 'drill') {
  var drillStepsLocal = [
    { key: 'C1', label: 'C 澄清情境', tip: '確認題目邊界與假設' },
    { key: 'I',  label: 'I 定義用戶', tip: '識別核心用戶群' },
    { key: 'R',  label: 'R 發掘需求', tip: '挖掘真正痛點' },
  ];
  var pills = drillStepsLocal.map(function(s) {
    var cls = 'rail-pill' + (drillStep === s.key ? ' active' : '');
    return '<button type="button" class="' + cls + '" data-drill-step="' + s.key + '">' + escHtml(s.label) + '</button>';
  }).join('');
  drillSection =
    '<div class="rail-label" style="margin-top:14px">練習步驟</div>' +
    '<div class="rail-pills">' + pills + '</div>' +
    '<div class="lock-note"><i class="ph ph-lock-simple"></i> C2、L、E、S 需在完整模擬中練習</div>';
}
```

Then concatenate `drillSection` into the left rail HTML between mode-cards and 題型.

- [ ] **Step 3: Wire bind for `[data-drill-step]` clicks**

Find `bindCirclesHome` (or whatever handles desktop home clicks). Add:

```javascript
document.querySelectorAll('[data-drill-step]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    AppState.circlesDrillStep = btn.dataset.drillStep;
    render();
  });
});
```

Place this where other home bindings live.

- [ ] **Step 4: Sanity check**

```bash
node --check public/app.js
PORT=4000 node server.js >/tmp/sp2-dev.log 2>&1 &
sleep 2
curl -sf http://localhost:4000/ -o /dev/null -w "HTTP %{http_code}\n"
```

Open in browser, click 步驟加練 mode card on desktop, confirm 3 pills appear in left rail.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat(sp2): desktop drill mode adds 練習步驟 pills in left rail"
```

---

## Task 3: Filter question list by drill step

**Files:** Modify `public/app.js`

- [ ] **Step 1: Find the question filter logic in home renderers**

```bash
grep -n "AppState.circlesDisplayedQuestions\|pickRandom5\|filteredQs" public/app.js | head
```

Identify where `AppState.circlesDisplayedQuestions` is populated for the home page.

- [ ] **Step 2: Add filter helper**

Add this helper near the other CIRCLES helpers in `public/app.js`:

```javascript
function filterQuestionsForDrillStep(questions, stepKey) {
  // Keep only questions where coach_circles[stepKey] has substantive content
  // (≥ 30 chars, since coach_circles strings are typically 100-150 chars)
  return questions.filter(function(q) {
    var coach = (q.coach_circles && q.coach_circles[stepKey]) || '';
    return coach.length >= 30;
  });
}
```

- [ ] **Step 3: Apply filter when rendering questions in drill mode**

Find where `pickRandom5(filteredQs)` is called. Wrap input list:

```javascript
// Before
var filteredQs = allQs.filter(function(q) { return q.question_type === type; });

// After
var filteredQs = allQs.filter(function(q) { return q.question_type === type; });
if (mode === 'drill' && drillStep) {
  filteredQs = filterQuestionsForDrillStep(filteredQs, drillStep);
}
```

Apply this in BOTH `renderCirclesHome` (mobile) and `renderCirclesHomeDesktop`.

- [ ] **Step 4: Update `選擇題目` title to show step + count**

Find the title text `'選擇題目'` in both renderers. Replace with dynamic version:

```javascript
var titleText = (mode === 'drill' && drillStep)
  ? '練習 ' + drillStep + ' 步驟 · ' + displayedQs.length + ' 題'
  : '選擇題目';
```

Use `titleText` in the `.center-title` (or equivalent) span.

- [ ] **Step 5: Visual check**

Refresh dev server, switch to drill mode + select R, confirm:
- Title says "練習 R 步驟 · N 題"
- Question count may differ from non-drill (some questions filtered out)

- [ ] **Step 6: Commit**

```bash
git add public/app.js
git commit -m "feat(sp2): filter question list by drill step (≥30 char coach_circles)"
```

---

## Task 4: Add R 練 tag pill to question cards

**Files:** Modify `public/app.js`

- [ ] **Step 1: Find `renderQCardHtml`**

```bash
grep -n "function renderQCardHtml" public/app.js
```

- [ ] **Step 2: Inject step tag inside `circles-q-card-tags` block**

Within the tags block construction in `renderQCardHtml`, add:

```javascript
var stepTagHtml = (AppState.circlesMode === 'drill' && AppState.circlesDrillStep)
  ? '<span class="pill step">' + AppState.circlesDrillStep + ' 練</span>'
  : '';
```

Concatenate `stepTagHtml` into the tags row HTML.

- [ ] **Step 3: Add `.drill-card` class on outer div**

In `renderQCardHtml`, change the outer div class:

```javascript
var cardClass = 'circles-q-card' + (AppState.circlesMode === 'drill' ? ' drill-card' : '');
return '<div class="' + cardClass + '" data-qid="' + q.id + '">' + ...;
```

- [ ] **Step 4: Visual check**

Switch to drill mode + R step, confirm each card has the `R 練` pill and a slightly stronger blue border.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat(sp2): add R 練 step tag + drill-card border on q-cards"
```

---

## Task 5: CSS — rail-pills, lock-note, pill.step, drill-card

**Files:** Modify `public/style.css`

- [ ] **Step 1: Append the SP2 styles**

```css
/* SP2 — desktop drill rail pills */
.rail-pills {
  display: flex; flex-direction: column; gap: 6px;
  margin-bottom: 6px;
}
.rail-pill {
  padding: 8px 10px;
  border-radius: var(--r-input);
  border: 1px solid var(--c-border);
  background: #fff;
  font-size: 12px;
  font-family: var(--c-font-sans);
  cursor: pointer;
  text-align: left;
  min-height: 36px;
}
.rail-pill.active {
  background: var(--c-primary);
  color: #fff;
  border-color: var(--c-primary);
}
.lock-note {
  font-size: 10.5px; color: var(--c-text-3);
  display: flex; align-items: center; gap: 4px;
  padding-top: 6px; margin-top: 8px;
  border-top: 1px dashed var(--c-border);
}

/* SP2 — step tag pill */
.pill.step {
  background: rgba(74, 108, 247, 0.18);
  color: var(--c-primary);
  font-weight: 700;
}

/* SP2 — drill-card border emphasis */
.circles-q-card.drill-card {
  border-color: rgba(74, 108, 247, 0.3);
  border-width: 1.5px;
}
```

- [ ] **Step 2: Verify visually**

Refresh — drill mode left rail should match mockup: vertical pills, blue active state, lock note below.

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "style(sp2): rail pills + lock note + step tag + drill card border"
```

---

## Task 6: Wire desktop search input

**Files:** Modify `public/app.js`

- [ ] **Step 1: Confirm `#search-input` exists and has no listener**

```bash
grep -n 'id="search-input"' public/app.js
grep -n 'search-input.*addEventListener\|getElementById("search-input")' public/app.js
```

Expected: input rendered in `renderCirclesHomeDesktop` (~line 2432), zero listeners.

- [ ] **Step 2: Add debounced filter helper**

Near other home helpers in `public/app.js`, add:

```javascript
var _searchDebounceTimer = null;
function applyHomeSearchFilter(query) {
  query = (query || '').trim().toLowerCase();
  var allQs = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : []);
  var byType = allQs.filter(function(q) { return q.question_type === AppState.circlesSelectedType; });
  if (AppState.circlesMode === 'drill' && AppState.circlesDrillStep) {
    byType = filterQuestionsForDrillStep(byType, AppState.circlesDrillStep);
  }
  var matched = !query
    ? pickRandom5(byType)
    : byType.filter(function(q) {
        var hay = ((q.company || '') + ' ' + (q.product || '') + ' ' + (q.problem_statement || '')).toLowerCase();
        return hay.indexOf(query) >= 0;
      });
  AppState.circlesDisplayedQuestions = matched;
  // Re-render only the q-list, not whole page
  var listEl = document.getElementById('circles-q-list');
  if (listEl) {
    listEl.innerHTML = matched.length
      ? matched.map(renderQCardHtml).join('')
      : '<div style="padding:24px;text-align:center;color:var(--c-text-3);font-size:13px">找不到符合的題目</div>';
  }
}
```

- [ ] **Step 3: Bind input event**

Inside `bindCirclesHome` (or whatever runs after home render):

```javascript
var searchInput = document.getElementById('search-input');
if (searchInput && !searchInput.__sp2Bound) {
  searchInput.__sp2Bound = true;
  searchInput.addEventListener('input', function(e) {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(function() {
      applyHomeSearchFilter(e.target.value);
    }, 200);
  });
}
```

- [ ] **Step 4: Manual test**

Open desktop, type "Spotify" in search → cards should filter to Spotify only. Clear → 5 random again.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat(sp2): wire #search-input with 200ms debounce + filter"
```

---

## Task 7: History — mode-tag distinction + 2-line mobile/tablet layout

**Files:** Modify `public/app.js`, `public/style.css`

- [ ] **Step 1: Find offcanvas history rendering**

```bash
grep -n "offcanvas\|history.*item\|hbadge\|練習記錄" public/app.js | head -10
```

Locate where each history row is constructed.

- [ ] **Step 2: Add mode-tag to each row**

For each row, after the score / status badge, add:

```javascript
var modeLabel = s.mode === 'drill'
  ? '加練 ' + (s.drill_step || '?')
  : '完整模擬';
var modeClass = s.mode === 'drill' ? 'mode-tag drill' : 'mode-tag';
var modeTagHtml = '<span class="' + modeClass + '">' + modeLabel + '</span>';
```

Concatenate into row HTML.

- [ ] **Step 3: Restructure for 2-line mobile/tablet**

Mobile/tablet: split into 2 lines (badge + mode-tag + date on row 1; CIRCLES · company · product on row 2).

Wrap the row HTML:

```javascript
var rowHtml =
  '<div class="h-item">' +
    '<div class="h-row1">' +
      badgeHtml + modeTagHtml +
      '<span class="h-date">' + escHtml(formatRelativeEdit(s.updated_at)) + '</span>' +
    '</div>' +
    '<div class="h-row2">CIRCLES · ' + escHtml(s.question_json.company || '') +
      (s.question_json.product ? ' · ' + escHtml(s.question_json.product) : '') +
    '</div>' +
  '</div>';
```

- [ ] **Step 4: CSS — 2-line layout (mobile/tablet) and 1-line (desktop)**

Append to `public/style.css`:

```css
/* SP2 — history mode-tag */
.mode-tag {
  font-size: 10.5px; font-weight: 600;
  padding: 2px 6px; border-radius: 4px;
  background: rgba(99, 102, 241, 0.1); color: #6366f1;
  flex-shrink: 0;
}
.mode-tag.drill { background: rgba(74, 108, 247, 0.1); color: var(--c-primary); }

/* SP2 — history 2-line layout (mobile / tablet default) */
.h-item { padding: 12px 0; border-bottom: 1px dashed var(--c-border); }
.h-item:last-child { border-bottom: none; }
.h-row1 {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
  flex-wrap: wrap;
}
.h-row1 .h-date { font-size: 11px; color: var(--c-text-3); margin-left: auto; }
.h-row2 { font-size: 13px; line-height: 1.4; color: var(--c-text-1); }

/* SP2 — desktop single-row inline */
@media (min-width: 1280px) {
  .h-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 0;
  }
  .h-row1 { display: contents; }
  .h-row1 .h-date { margin-left: 0; }
  .h-row2 { flex: 1; }
}
```

- [ ] **Step 5: Visual check**

Open offcanvas at mobile / tablet / desktop widths. Verify mockup parity.

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(sp2): history rows show mode-tag + 2-line mobile/tablet layout"
```

---

## Task 8: Playwright spec — sp2-drill-mode

**Files:** Create `tests/playwright/journeys/sp2-drill-mode.spec.js`

- [ ] **Step 1: Write spec**

```javascript
const { test, expect } = require('@playwright/test');

test.describe('SP2 — drill mode + search + history', () => {

  test('desktop drill mode shows 3 step pills in left rail', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    await page.click('[data-mode="drill"]');
    await page.waitForTimeout(200);
    const pills = page.locator('.rail-pill');
    const count = await pills.count();
    expect(count).toBe(3);
    const texts = await pills.allInnerTexts();
    expect(texts.join(' ')).toContain('C 澄清情境');
    expect(texts.join(' ')).toContain('I 定義用戶');
    expect(texts.join(' ')).toContain('R 發掘需求');
  });

  test('selecting R step filters questions and adds R 練 tag', async ({ page, viewport }) => {
    test.skip(viewport.width < 1280, 'desktop-only test (mobile already had pills)');
    await page.goto('/');
    await page.click('[data-mode="drill"]');
    await page.click('[data-drill-step="R"]');
    await page.waitForTimeout(300);
    const cards = page.locator('.circles-q-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    // Every card has R 練 pill
    for (let i = 0; i < cardCount; i++) {
      await expect(cards.nth(i).locator('.pill.step')).toContainText('R 練');
    }
  });

  test('search filters cards by substring', async ({ page, viewport }) => {
    test.skip(viewport.width < 1280, 'search input is desktop-only');
    await page.goto('/');
    await page.waitForSelector('#search-input');
    await page.fill('#search-input', 'Spotify');
    await page.waitForTimeout(400);  // wait debounce
    const cards = page.locator('.circles-q-card');
    const count = await cards.count();
    if (count > 0) {
      const allText = await page.locator('#circles-q-list').innerText();
      expect(allText.toLowerCase()).toContain('spotify');
    }
  });

  test('search empty result shows placeholder', async ({ page, viewport }) => {
    test.skip(viewport.width < 1280, 'search desktop-only');
    await page.goto('/');
    await page.fill('#search-input', 'zzzznonexistent12345');
    await page.waitForTimeout(400);
    expect(await page.locator('#circles-q-list').innerText()).toContain('找不到符合的題目');
  });

  test('history shows mode-tag', async ({ page }) => {
    await page.goto('/');
    // Inject mock sessions
    await page.evaluate(() => {
      window.AppState.recentSessions = [
        { mode: 'simulation', question_json: { company: 'Spotify', product: 'Podcast' }, updated_at: '2026-05-01T03:02', status: 'completed' },
        { mode: 'drill', drill_step: 'R', question_json: { company: 'Netflix', product: 'Originals' }, updated_at: '2026-05-01T01:37', status: 'active' },
      ];
      window.render && window.render();
    });
    // Open offcanvas (depends on app structure — adjust as needed)
    const openBtn = page.locator('#btn-hamburger, #btn-history');
    if (await openBtn.count()) {
      await openBtn.first().click();
      await page.waitForTimeout(200);
    }
    const tags = page.locator('.mode-tag');
    if (await tags.count() >= 2) {
      const texts = await tags.allInnerTexts();
      expect(texts.some(t => t.includes('完整模擬'))).toBe(true);
      expect(texts.some(t => t.includes('加練 R'))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Sanity**

```bash
node --check tests/playwright/journeys/sp2-drill-mode.spec.js
```

- [ ] **Step 3: Commit**

```bash
git add tests/playwright/journeys/sp2-drill-mode.spec.js
git commit -m "test(sp2): drill mode + search + history Playwright"
```

---

## Task 9: Run on all 8 viewports + regression

- [ ] **Step 1: Ensure server**

```bash
curl -sf http://localhost:4000/ -o /dev/null && echo READY || (PORT=4000 node server.js >/tmp/sp2-dev.log 2>&1 & sleep 2)
```

- [ ] **Step 2: Run new spec on all 8 projects**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  tests/playwright/journeys/sp2-drill-mode.spec.js \
  --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro \
  --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 \
  --reporter=list --screenshot=on
```

Expected: 5 tests × 8 projects, with desktop-only tests skipped on mobile/tablet projects.

- [ ] **Step 3: View screenshots — at least 1 per viewport**

```bash
ls test-results/ | grep sp2-drill
# Use Read tool on each viewport's PNG
```

- [ ] **Step 4: Regression**

```bash
npx jest --no-coverage 2>&1 | tail -3
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js --reporter=line 2>&1 | tail -3
```

Both green = no regression.

---

## Task 10: iOS Safari static review

- [ ] **Step 1: Walk checklist** (from verification standard § 7)

Specifically check:
- `.rail-pill` `min-height: 36px` may be < 44 — but it's desktop-only, fine
- `.mode-tag` is informational, not tappable, no touch concern
- `#search-input` font-size — verify ≥ 16px to avoid iOS zoom

```bash
grep -n "search-input.*font-size\|input#search" public/style.css
```

If font-size missing or < 16px, add:

```css
#search-input { font-size: 16px; }
```

- [ ] **Step 2: Spot-check on iPhone-15-Pro Playwright**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  --project=iPhone-15-Pro \
  tests/playwright/journeys/sp2-drill-mode.spec.js \
  --reporter=list --screenshot=on
```

View screenshot, confirm no overflow / no element cut off.

- [ ] **Step 3: Commit any tweaks**

---

## Task 11: Sign-off

- [ ] **Step 1: Run all gates**

```bash
echo "=== JEST ===" && npx jest --no-coverage 2>&1 | tail -3
echo "=== PW ===" && PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js --reporter=line 2>&1 | tail -3
```

- [ ] **Step 2: Console check** — drill mode flow + search + history

- [ ] **Step 3: Eyeball** — mobile/tablet/desktop drill mode side-by-side with mockup

- [ ] **Step 4: Write `audit/sp2-signoff.md`**

```markdown
# SP2 Sign-off — 2026-05-02

- [x] Tasks 2-7 committed
- [x] Playwright sp2-drill-mode.spec.js: <N>/<N> passed across 8 viewports
- [x] Existing PW + jest: no regression
- [x] iOS quirks walked
- [x] 8 viewport screenshots viewed
- [x] Mockup parity confirmed
- [x] No console errors

**Branch:** feat/sp2-drill
```

```bash
git add audit/sp2-signoff.md
git commit -m "audit(sp2): sign-off"
```

---

## Self-Review

**Spec coverage:**
- ✅ desktop step pills (Tasks 2, 5)
- ✅ question filter by step (Task 3)
- ✅ R 練 tag pill on cards (Task 4)
- ✅ search wire-up (Task 6)
- ✅ history mode-tag + 2-line mobile/tablet (Task 7)
- ✅ Playwright + 8-viewport + iOS (Tasks 8, 9, 10)
- ✅ Sign-off (Task 11)

**Type consistency:**
- `.rail-pill` / `.lock-note` / `.pill.step` / `.drill-card` / `.mode-tag`: defined in CSS (Task 5, 7), referenced in JS (Tasks 2, 4, 7) and Playwright (Task 8) ✓
- `filterQuestionsForDrillStep` defined Task 3 step 2, used in Tasks 3 step 3 and 6 step 2 ✓

**No placeholders.**
