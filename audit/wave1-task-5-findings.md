# Wave 1 Task #5 — B6 Mockup 04 Drift Fix — Findings

**Status:** `DONE_PENDING_BASELINE_REGEN`
**Date:** 2026-05-17 PM
**Layer (a) DOM tests:** 75/75 PASS × 3 viewports (Desktop-1280 / iPad / Mobile-360)
**Layer (b) full-flow:** Written; awaiting Director run (real OpenAI budget, real dev server)

---

## Per-Drift Status

| Drift | Title | DOM Layer | Visual Baseline |
|---|---|---|---|
| D-1 | Gate ok sub-copy | GREEN — text exact match | PENDING Director regen |
| D-2 | Gate warn title + sub-copy | GREEN — text exact match | PENDING Director regen |
| D-3 | Gate error title + sub-copy | GREEN — text exact match | PENDING Director regen |
| D-4 | No-regression AC-1/AC-2 | GREEN — DOM + color pass | AC-3 visual stale (see note) |
| D-5 | Section count label per-state | GREEN — ok/warn/error variants | PENDING Director regen |
| D-6 | Gate item suggestion badge | GREEN — `建議` vs `修正` + CSS 3-measure | PENDING Director regen |
| D-7 | Loading title + sub-copy | GREEN — text exact match | PENDING Director regen |
| D-8 | Loading checklist 5 steps | GREEN — all 5 items present | PENDING Director regen |
| D-9 | Phase-head meta loading state | GREEN — tablet/desktop visible; mobile hidden by CSS (DOM count verified) | PENDING Director regen |
| D-10 | Phase-head meta result state | GREEN — tablet/desktop visible; mobile hidden by CSS (DOM count verified) | PENDING Director regen |
| D-11 | qchip icon + responsive company | GREEN — `ph-bookmark-simple` + short/long span CSS toggle | PENDING Director regen |

---

## Layer (a) DOM/Measurement Test Details

**File:** `tests/visual/wave1-b6-mockup04-drift-fix.spec.js`

**Viewports run:** Desktop-1280, iPad (768), Mobile-360

**Test run output:** 75 passed, 0 failed, 0 skipped

### Key assertion patterns used (per playwright-skill Critical #4/#5):
- Text exact match: `expect(el).toHaveText('...')`
- getComputedStyle 3-measure: `backgroundColor`, `border`, `color` for D-6 suggestion badge
- getComputedStyle display: `display` for D-9/D-10 tablet/desktop meta visibility
- DOM count guard for mobile hidden elements: `count() > 0` instead of `toBeVisible()`
- AppState injection: `circlesGateResult`, `circlesGateLoading`, then `window.render()`

### AppState injection pattern (no real AI):
```js
await page.evaluate(() => {
  window.AppState.circlesGateResult = { ... };
  window.render();
});
```

---

## Layer (b) Full-Flow Test Details

**File:** `tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js`

**Status:** Written. NOT yet run. Requires:
- Real dev server at `http://localhost:3000`
- Auth (`playwright/.auth/user.json` from setup project)
- Real OpenAI API key (circles-gate evaluator)

**Tests defined:**
1. Loading state shows D-7 title + D-8 checklist during AI evaluation
2. Excellent C1 input → gate passes (ok or warn state)
3. Poor/vague input → gate blocks (error state, at least 1 error item)

**Cleanup:** `afterEach` deletes `circles_sessions` rows created during test via service-role key

---

## Production Diff Scope (Critical #4 mitigation #1)

Confirmed via `git diff public/app.js | grep '^@@'`:

All hunks in `app.js` are in the **5136–5240 region only**:
- `renderCirclesGate()` — D-9, D-10, D-11 qchip + phase-head meta
- `renderGateResult()` — D-1, D-2, D-3, D-5 copy + section count
- `renderGateItem()` — D-6 suggestion badge label + structure
- `renderGateLoading()` — D-7, D-8 loading copy + checklist

No changes outside this region. Backend / API / prompts / DB untouched.

---

## D-4 Visual Baseline Side-Effect (Known)

D-11 changed the qchip icon from `ph-info` to `ph-bookmark-simple`.

The existing spec `tests/visual/circles-gate-warn-icon-color.spec.js` has:
- **AC-1 DOM**: `ph-bookmark-simple` icon class present → **PASS** (after D-11 fix)
- **AC-2 color**: warning amber color → **PASS**
- **AC-3 visual**: `toHaveScreenshot()` baseline → **STALE** (was captured with old `ph-info` icon)

**Director action required:** Regenerate AC-3 baseline after visually confirming D-11 icon is correct.

---

## Director Actions Required

### Action 1 — Generate mockup-sourced baselines (ABSOLUTE per Critical #4)
```bash
node scripts/capture-mockup-04-baselines.js
# Verify output PNGs against mockup 04 §A/§B/§C/§D visually (Read each PNG)
# Then stage the snapshot directory
git add tests/visual/wave1-b6-mockup04-drift-fix.spec.js-snapshots/
```

### Action 2 — Regenerate D-4 AC-3 visual baseline
After verifying D-11 qchip icon is correct in production:
```bash
npx playwright test --config=tests/visual/playwright.config.js \
  circles-gate-warn-icon-color.spec.js --update-snapshots
```

### Action 3 — Run full-flow Layer (b) spec (optional, per OpenAI budget)
```bash
npx playwright test --config=tests/e2e/playwright.config.js \
  wave1-b6-circles-phase1-to-gate-real-flow.spec.js --project=e2e-desktop
```

### Action 4 — Run 5× consecutive DOM layer for GREEN gate
```bash
for i in 1 2 3 4 5; do
  npx playwright test --config=tests/visual/playwright.config.js \
    wave1-b6-mockup04-drift-fix.spec.js 2>&1 | tail -3
done
```

---

## Files Created / Modified

| File | Action | Notes |
|---|---|---|
| `public/app.js` | Modified | Lines 5136–5240: D-1/2/3/5/6/7/8/9/10/11 |
| `public/style.css` | Modified | D-11: `.qchip__company-short/long` responsive |
| `tests/visual/wave1-b6-mockup04-drift-fix.spec.js` | Created | Layer (a) DOM + getComputedStyle, 75 tests |
| `tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js` | Created | Layer (b) full-flow, 3 tests |
| `tests/e2e/playwright.config.js` | Modified | Added wave1-b6 to e2e-desktop/mobile-chrome/mobile-safari |
| `scripts/capture-mockup-04-baselines.js` | Created | Director-only baseline capture script |
