# Home Card + Mobile Truncation + Phase 2 Conclusion Sticky — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement A1 + B1 + C1 from `docs/superpowers/specs/2026-04-30-home-card-and-conclusion-design.md` using strict red-green TDD, then verify across 8 viewport projects.

**Architecture:** Three independent UI changes touched in two files:
- `public/app.js` — rewrite `renderQCardHtml`; simplify `expandQCard`.
- `public/style.css` — add card-tag classes, line-clamp on the brief, sticky-bottom action row.
- Tests in `tests/playwright/journeys/audit/audit-master.spec.js` (4 new IDs) and `rwd-visual-gate.spec.js` (1 new route).

**Tech Stack:** Vanilla JS / CSS / Playwright Test (`@playwright/test`).

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `public/app.js` | rewrite `renderQCardHtml` + simplify `expandQCard` | modify |
| `public/style.css` | new tag/clamp/sticky CSS rules | modify |
| `tests/playwright/journeys/audit/audit-master.spec.js` | 4 new TDD tests (AUD-058 → AUD-061) | modify |
| `tests/playwright/journeys/audit/rwd-visual-gate.spec.js` | new `09-phase2-conclusion-expanded` route | modify |
| `audit/rwd-grid/**` | regenerated PNGs (auto by spec run) | regenerate |

Each test gates exactly one production change so red-green-commit cycles stay tight.

---

## Pre-flight (once, before Task 1)

- [ ] **Step 0.1: Confirm dev server on :4000**

Run:
```bash
curl -fsS http://localhost:4000/ -o /dev/null -w "HTTP %{http_code}\n"
```
Expected: `HTTP 200`. If not, `PORT=4000 npm run dev &` then re-curl.

- [ ] **Step 0.2: Confirm baseline green**

Run:
```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-015 |AUD-054|AUD-057" \
  --workers=4 --reporter=list 2>&1 | tail -3
```
Expected: all PASS, 0 failed. Baseline confirmed at commit `4c62c12` or later.

---

## Task 1: AUD-058 — Tag row (company / product / question_type / difficulty)

**Files:**
- Modify: `public/app.js` — `renderQCardHtml` near line 1583
- Modify: `public/style.css` — add tag CSS after the existing `.circles-q-card-company` rules
- Test: `tests/playwright/journeys/audit/audit-master.spec.js`

- [ ] **Step 1: Write the failing test**

Add inside `test.describe('CLUSTER-H — Progress bar labels & a11y', ...)` (or a new describe — placement doesn't matter for execution). Insert after the existing `AUD-057` test:

```javascript
  test('AUD-058 [P1] home question card shows company + product + question_type + difficulty tags', async ({ page }) => {
    await gotoHome(page);
    const data = await page.evaluate(() => {
      const card = document.querySelector('.circles-q-card');
      if (!card) return { exists: false };
      return {
        exists: true,
        company: !!card.querySelector('.circles-q-card-company'),
        product: !!card.querySelector('.circles-q-card-product'),
        tagCount: card.querySelectorAll('.circles-q-card-tag').length,
        tagsContainer: !!card.querySelector('.circles-q-card-tags'),
      };
    });
    expect(data.exists, 'first question card exists').toBe(true);
    expect(data.tagsContainer, 'tags container present').toBe(true);
    expect(data.company, 'company badge').toBe(true);
    expect(data.product, 'product badge (q.product is non-empty for all 100 rows in DB)').toBe(true);
    expect(data.tagCount, 'at least one of question_type or difficulty tag').toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-058" \
  --project=Desktop-1280 --reporter=list 2>&1 | tail -10
```
Expected: FAIL — selectors `.circles-q-card-product / -tag / -tags` do not exist yet.

- [ ] **Step 3: Implement renderQCardHtml rewrite (markup half — keep clamp/expand for next tasks)**

Open `public/app.js`, locate `renderQCardHtml` near line 1583. Replace the entire function body with:

```javascript
function renderQCardHtml(q) {
  // Spec 2026-04-30 home-card — A1 tags row + B1 line-clamp brief + A1 full block.
  var QTYPE_LABEL = { design: '產品設計', improve: '產品改進', strategy: '產品策略' };
  var DIFF_LABEL  = { easy: '簡單', medium: '中等難度', hard: '困難' };

  var qTypeTag = q.question_type && QTYPE_LABEL[q.question_type]
    ? '<span class="circles-q-card-tag">' + escHtml(QTYPE_LABEL[q.question_type]) + '</span>' : '';
  var qDiffTag = q.difficulty && DIFF_LABEL[q.difficulty]
    ? '<span class="circles-q-card-tag">' + escHtml(DIFF_LABEL[q.difficulty]) + '</span>' : '';
  var productTag = q.product
    ? '<span class="circles-q-card-product">' + escHtml(q.product) + '</span>' : '';

  var drillPracticeHtml = (AppState.circlesMode === 'drill')
    ? '<div style="font-size:11px;color:var(--c-primary);font-weight:600;margin-top:6px;font-family:DM Sans,sans-serif">練習步驟：' + (AppState.circlesDrillStep || 'C1') + '</div>'
    : '';

  return '<div class="circles-q-card" data-qid="' + q.id + '">' +
    '<div class="circles-q-card-tags">' +
      '<span class="circles-q-card-company">' + escHtml(q.company) + '</span>' +
      productTag +
      qTypeTag +
      qDiffTag +
    '</div>' +
    '<div class="circles-q-card-stmt">' + escHtml(q.problem_statement || '') + '</div>' +
    '<div class="circles-q-card-more-wrap">' +
      '<span class="circles-q-card-more">看完整題目 ▾</span>' +
    '</div>' +
    '<div class="circles-q-card-expand-area" style="display:none">' +
      '<div class="circles-q-card-full-block">' +
        '<div class="circles-q-card-full-label">完整題目</div>' +
        '<div class="circles-q-card-full-text">' + escHtml(q.problem_statement || '') + '</div>' +
      '</div>' +
      drillPracticeHtml +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:10px">' +
        '<button class="circles-q-confirm-btn">確認，開始練習</button>' +
        '<button class="circles-q-cancel-btn">取消</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}
```

- [ ] **Step 4: Add CSS for the tag row in `public/style.css`**

Find the existing `.circles-q-card-company` rule (search for `circles-q-card-company` within the file). Insert these rules immediately after it:

```css
[data-view="circles"] .circles-q-card-tags {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
  align-items: center;
}
[data-view="circles"] .circles-q-card-product {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 14px;
  background: #fff; border: 1px solid rgba(26,86,219,0.3);
  color: var(--c-primary); font-size: 11.5px;
  font-family: 'DM Sans', sans-serif;
}
[data-view="circles"] .circles-q-card-tag {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 4px;
  background: var(--c-bg-soft, #f7f5f0);
  color: var(--c-text-2); font-size: 11px;
  font-family: 'DM Sans', sans-serif;
}
[data-view="circles"] .circles-q-card-full-block {
  background: var(--c-bg-soft, #f7f5f0);
  border-radius: 8px;
  padding: 10px 12px; margin-top: 6px;
}
[data-view="circles"] .circles-q-card-full-label {
  font-size: 10.5px; color: var(--c-text-2); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;
  font-family: 'DM Sans', sans-serif;
}
[data-view="circles"] .circles-q-card-full-text {
  font-size: 13px; color: var(--c-text); line-height: 1.7;
  font-family: 'DM Sans', sans-serif;
}
```

- [ ] **Step 5: Run AUD-058 to verify it passes**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-058" \
  --project=Desktop-1280 --reporter=list 2>&1 | tail -5
```
Expected: PASS.

- [ ] **Step 6: Commit task 1**

```bash
git add public/app.js public/style.css tests/playwright/journeys/audit/audit-master.spec.js
git commit -m "feat(home/card): tag row (AUD-058)"
```

---

## Task 2: AUD-059 — CSS line-clamp 2 on brief (replace JS substring)

**Files:**
- Modify: `public/style.css` — add line-clamp rule on `.circles-q-card-stmt`
- Test: `tests/playwright/journeys/audit/audit-master.spec.js`

- [ ] **Step 1: Write the failing test**

Insert after AUD-058:

```javascript
  test('AUD-059 [P1] home question card brief uses CSS line-clamp 2 (no JS substring)', async ({ page }) => {
    await gotoHome(page);
    const data = await page.evaluate(() => {
      const stmt = document.querySelector('.circles-q-card .circles-q-card-stmt');
      if (!stmt) return { exists: false };
      const cs = getComputedStyle(stmt);
      return {
        exists: true,
        hasFullText: stmt.textContent.length > 0,
        hasLegacyDataset: !!stmt.dataset.full || !!stmt.dataset.short,
        webkitLineClamp: cs.webkitLineClamp || cs.lineClamp,
        boxOrient: cs.webkitBoxOrient,
        overflow: cs.overflow,
      };
    });
    expect(data.exists).toBe(true);
    expect(data.hasFullText, 'brief text rendered').toBe(true);
    expect(data.hasLegacyDataset, 'no legacy data-full / data-short attrs').toBe(false);
    expect(data.webkitLineClamp, '-webkit-line-clamp:2').toBe('2');
    expect(data.overflow, 'overflow:hidden').toBe('hidden');
  });
```

- [ ] **Step 2: Run AUD-059 to verify it fails**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-059" \
  --project=Desktop-1280 --reporter=list 2>&1 | tail -8
```
Expected: FAIL — webkitLineClamp not '2' (or the existing dataset.full/short still present).

- [ ] **Step 3: Add line-clamp CSS for `.circles-q-card-stmt`**

In `public/style.css`, find the existing `.circles-q-card-stmt` rule. Append these properties (or modify-in-place if the rule exists):

```css
[data-view="circles"] .circles-q-card-stmt {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px; line-height: 1.6; color: var(--c-text);
  font-family: 'DM Sans', sans-serif;
}
```

If `.circles-q-card-stmt` was already styled elsewhere with conflicting font-size or color, keep this rule and DELETE the older one to avoid duplicate-source-of-truth.

- [ ] **Step 4: Run AUD-059 to verify it passes**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-059" \
  --project=Desktop-1280 --reporter=list 2>&1 | tail -5
```
Expected: PASS.

- [ ] **Step 5: Commit task 2**

```bash
git add public/style.css tests/playwright/journeys/audit/audit-master.spec.js
git commit -m "feat(home/card): line-clamp 2 brief (AUD-059, B1)"
```

---

## Task 3: AUD-060 — Full block on expand + simplify expandQCard

**Files:**
- Modify: `public/app.js` — `expandQCard` near line 1607
- Test: `tests/playwright/journeys/audit/audit-master.spec.js`

- [ ] **Step 1: Write the failing test**

Insert after AUD-059:

```javascript
  test('AUD-060 [P1] expanded card shows full text in 完整題目 block, brief stays clamped above', async ({ page }) => {
    await gotoHome(page);
    await page.locator('.circles-q-card').first().click();
    await page.waitForTimeout(300);
    const data = await page.evaluate(() => {
      const card = document.querySelector('.circles-q-card');
      const stmt = card.querySelector('.circles-q-card-stmt');
      const block = card.querySelector('.circles-q-card-full-block');
      const label = card.querySelector('.circles-q-card-full-label');
      const fullText = card.querySelector('.circles-q-card-full-text');
      return {
        blockVisible: block && getComputedStyle(block).display !== 'none' && block.offsetHeight > 0,
        labelText: label ? (label.textContent || '').trim() : null,
        fullTextLen: fullText ? (fullText.textContent || '').trim().length : 0,
        briefStillClamped: stmt && getComputedStyle(stmt).webkitLineClamp === '2',
      };
    });
    expect(data.blockVisible, '完整題目 block visible after expand').toBe(true);
    expect(data.labelText, 'label is 完整題目').toBe('完整題目');
    expect(data.fullTextLen, 'full text non-empty').toBeGreaterThan(0);
    expect(data.briefStillClamped, 'brief retains line-clamp:2 after expand').toBe(true);
  });
```

- [ ] **Step 2: Run AUD-060 to verify it fails**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-060" \
  --project=Desktop-1280 --reporter=list 2>&1 | tail -8
```
Expected: FAIL — current `expandQCard` mutates `.circles-q-card-stmt.textContent = stmt.dataset.full` (legacy), and there's no `.circles-q-card-full-block` (the markup change in Task 1 added it but `expandQCard` still references dataset.full which Task 2 removed → may also throw). Either way the assertion order shows the failure.

- [ ] **Step 3: Simplify `expandQCard`**

In `public/app.js`, find `function expandQCard(card) {` near line 1607. Replace the entire function with:

```javascript
function expandQCard(card) {
  // Brief (.circles-q-card-stmt) keeps its CSS line-clamp:2 styling — never
  // mutated. Just unhide the expand area + emphasise the card border.
  var moreWrap = card.querySelector('.circles-q-card-more-wrap');
  if (moreWrap) moreWrap.style.display = 'none';
  var expandArea = card.querySelector('.circles-q-card-expand-area');
  if (expandArea) expandArea.style.display = 'block';
  card.style.borderColor = 'var(--c-primary)';
  // AUD-053 — emit a transient loading hint so users / a11y see the transition starting
  var hint = document.createElement('div');
  hint.className = 'circles-loading-hint loading';
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  hint.textContent = '展開中…';
  hint.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
  card.appendChild(hint);
  setTimeout(function() { try { hint.remove(); } catch (_) {} }, 600);
}
```

- [ ] **Step 4: Verify `collapseQCard` (or equivalent) doesn't reference legacy dataset**

Search the file for `dataset.full` and `dataset.short`. If any references remain (e.g., inside an existing collapse fn that flips the brief back to short), remove those lines — the brief is no longer mutated. Quick check:

```bash
grep -n "dataset\.full\|dataset\.short\|circles-q-card-stmt.textContent" public/app.js
```
Expected: 0 matches (apart from comments).

- [ ] **Step 5: Run AUD-060 to verify it passes**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-060" \
  --project=Desktop-1280 --reporter=list 2>&1 | tail -5
```
Expected: PASS.

- [ ] **Step 6: Commit task 3**

```bash
git add public/app.js tests/playwright/journeys/audit/audit-master.spec.js
git commit -m "feat(home/card): 完整題目 block on expand (AUD-060, A1 expand half)"
```

---

## Task 4: AUD-061 — Sticky-bottom action row in Phase 2 conclusion

**Files:**
- Modify: `public/style.css` — add sticky rule
- Test: `tests/playwright/journeys/audit/audit-master.spec.js`

- [ ] **Step 1: Write the failing test**

Insert after AUD-060:

```javascript
  test('AUD-061 [P1] Phase 2 conclusion-actions are sticky-bottom inside conclusion-box', async ({ page }, testInfo) => {
    only(testInfo, ['Desktop-1280', 'Desktop-1440']);
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      if (typeof AppState === 'undefined') return;
      AppState.view = 'circles';
      AppState.circlesPhase = 2;
      AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS[0] : null);
      AppState.circlesMode = 'drill';
      AppState.circlesDrillStep = 'C1';
      AppState.circlesSubmitState = 'expanded';
      if (typeof render === 'function') render();
    });
    await page.waitForTimeout(400);
    const data = await page.evaluate(() => {
      const box = document.querySelector('.circles-conclusion-box');
      const actions = document.querySelector('.circles-conclusion-box .conclusion-actions');
      if (!box || !actions) return null;
      const cs = getComputedStyle(actions);
      return {
        position: cs.position,
        bottom: cs.bottom,
        boxBottom: Math.round(box.getBoundingClientRect().bottom),
        actionsBottom: Math.round(actions.getBoundingClientRect().bottom),
      };
    });
    expect(data, 'conclusion box + actions both present in DOM').not.toBeNull();
    expect(data.position, 'actions row uses position:sticky').toBe('sticky');
    // Sticky bottom anchor: actions.bottom should sit within ±2px of box.bottom.
    expect(Math.abs(data.actionsBottom - data.boxBottom)).toBeLessThanOrEqual(2);
  });
```

- [ ] **Step 2: Run AUD-061 to verify it fails**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-061" \
  --project=Desktop-1280 --reporter=list 2>&1 | tail -8
```
Expected: FAIL — `position` of `.conclusion-actions` is `static`, not `sticky`.

- [ ] **Step 3: Add sticky-bottom CSS rule for `.conclusion-actions`**

In `public/style.css`, find the existing `.circles-conclusion-box` rule (search for `circles-conclusion-box`). Append after it:

```css
[data-view="circles"] .circles-conclusion-box .conclusion-actions {
  position: sticky;
  bottom: 0;
  margin: 8px -14px -14px;          /* extend over the box's 14px padding */
  padding: 10px 14px;
  background: #fff;
  border-top: 1px solid var(--c-border);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
```

- [ ] **Step 4: Run AUD-061 to verify it passes**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/audit-master.spec.js -g "AUD-061" \
  --project=Desktop-1280 --reporter=list 2>&1 | tail -5
```
Expected: PASS.

- [ ] **Step 5: Commit task 4**

```bash
git add public/style.css tests/playwright/journeys/audit/audit-master.spec.js
git commit -m "feat(phase2): sticky-bottom 確認提交 row in conclusion-box (AUD-061, C1)"
```

---

## Task 5: rwd-visual-gate — `09-phase2-conclusion-expanded` route

**Files:**
- Modify: `tests/playwright/journeys/audit/rwd-visual-gate.spec.js`

- [ ] **Step 1: Add the new route**

Open `tests/playwright/journeys/audit/rwd-visual-gate.spec.js`. In the `ROUTES` array, append:

```javascript
  {
    name: '09-phase2-conclusion-expanded',
    desc: 'Phase 2 conclusion box expanded — sticky bottom action row',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        if (typeof AppState === 'undefined') return;
        AppState.view = 'circles';
        AppState.circlesPhase = 2;
        AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS[0] : null);
        AppState.circlesMode = 'drill';
        AppState.circlesDrillStep = 'C1';
        AppState.circlesSubmitState = 'expanded';
        if (typeof render === 'function') render();
      });
      await page.waitForTimeout(700);
    },
    contentSel: ['.circles-conclusion-box', '.phase2-desktop', 'main'],
    skipRatio: true, // box is fixed-bottom by design; ratio not meaningful
  },
```

- [ ] **Step 2: Run rwd-visual-gate to verify route renders & no horizontal scroll across all 8 viewports**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/rwd-visual-gate.spec.js -g "09-phase2-conclusion-expanded" \
  --workers=4 --reporter=list 2>&1 | tail -10
```
Expected: 8 PASS / 0 FAIL (or 7 PASS + 1 skipped Desktop alias).

- [ ] **Step 3: Commit task 5**

```bash
git add tests/playwright/journeys/audit/rwd-visual-gate.spec.js
git commit -m "test(rwd-visual-gate): add 09-phase2-conclusion-expanded route"
```

---

## Task 6: Full audit regression + screenshot regen + commit + push

- [ ] **Step 1: Run the full audit dir**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/ --workers=4 --reporter=line 2>&1 | tail -5
```
Expected: 0 failures. Pass count ≥ 401 + 4 new tests × N projects.

- [ ] **Step 2: Run Jest unit suite**

```bash
npx jest 2>&1 | tail -5
```
Expected: 5 suites passed, 104 tests passed (no regressions).

- [ ] **Step 3: Stage regenerated screenshots and commit**

The `rwd-visual-gate` run at Step 1 regenerated `audit/rwd-grid/<project>/{01-home-guest,07-q-card-expanded,09-phase2-conclusion-expanded}.png`. Stage everything:

```bash
git add audit/rwd-grid
git status --short | head -20
git commit -m "audit(rwd-grid): regenerate PNGs reflecting card chrome + sticky submit"
```
Expected: a single commit with the 8-9 modified PNGs and (possibly) the new 09-route PNGs.

- [ ] **Step 4: Push to origin/main**

Per memory `pushing-to-main`, push directly to `main`:

```bash
git push origin main
git log --oneline origin/main~6..origin/main
```
Expected: 4-5 fresh commits land on `origin/main` (one per task + the screenshot regen).

- [ ] **Step 5: Update ROLLOUT-STATE.md (optional, but good hygiene)**

Append to `docs/superpowers/test-agents/ROLLOUT-STATE.md` under the Session 4 area:

```markdown
### Session 5 follow-up (2026-04-30)
- Home card brief vs full (A1) + line-clamp (B1) + sticky submit (C1) shipped per spec
  `docs/superpowers/specs/2026-04-30-home-card-and-conclusion-design.md`.
- AUD-058..061 added; full audit dir green across 8 viewport projects.
```

```bash
git add docs/superpowers/test-agents/ROLLOUT-STATE.md
git commit -m "docs(rollout-state): session 5 home card + sticky submit"
git push origin main
```

---

## Self-Review

Spec coverage check:
- A1 home card chrome → Tasks 1 + 3.
- B1 CSS line-clamp → Task 2.
- C1 sticky-bottom action row → Task 4.
- Visual route for the new state → Task 5.
- Cross-device verification → Task 6.

Placeholder scan: no TBD/TODO/"add validation" — every step has runnable commands and complete code.

Type / selector consistency:
- `.circles-q-card-tags` introduced Task 1 → asserted Task 1 (AUD-058) + reused Task 3.
- `.circles-q-card-product / -tag` consistent across Task 1 markup + Task 1 CSS + AUD-058 selectors.
- `.circles-q-card-full-block / -full-label / -full-text` introduced Task 1 markup + Task 1 CSS + AUD-060 selectors.
- `.circles-q-card-stmt` line-clamp:2 introduced Task 2 CSS + asserted Task 2 (AUD-059) + Task 3 (AUD-060 brief-stays-clamped).
- `.circles-conclusion-box .conclusion-actions` sticky introduced Task 4 CSS + asserted Task 4 (AUD-061).

Spec test ID parity:
- AUD-058 → Task 1 ✓
- AUD-059 → Task 2 ✓
- AUD-060 → Task 3 ✓
- AUD-061 → Task 4 ✓
- 09-phase2-conclusion-expanded route → Task 5 ✓

No gaps.
