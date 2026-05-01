# SP1 — Visual Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **MANDATORY READS BEFORE STARTING:**
> 1. Spec: `docs/superpowers/specs/2026-05-02-sp1-visual-baseline-design.md`
> 2. Mockup: `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp1-visual-baseline.html`
> 3. Verification standard: `docs/superpowers/specs/2026-05-02-verification-standard.md`
> 4. Test director rubric: `audit-cycle.md`
>
> Implement EXACTLY per mockup. No design liberties.

**Goal:** Sweep public/style.css + public/app.js to enforce edge-to-edge layout, unified radius/font tokens, and red-border-only error UI across all CIRCLES + NSM + login + review-examples routes.

**Architecture:** Pure CSS token sweep + small JS deletion. No new components, no new endpoints, no schema changes. All work in 2 files (`public/style.css`, `public/app.js`) plus 1 new Playwright spec.

**Tech Stack:** vanilla CSS variables / Phosphor icons / system-ui font / Playwright 8 projects.

**Branch & worktree (recommended):**
```bash
git worktree add .claude/worktrees/sp1-visual -b feat/sp1-visual main
cd .claude/worktrees/sp1-visual
cp ../../.env .env  # copy gitignored env
```

---

## File structure

| File | Action |
|---|---|
| `public/style.css` | Sweep — add CSS vars + replace serif font-family, remove page-wrapper horizontal padding, unify radius |
| `public/app.js` | Search-and-delete error message bar render code (gate result section) |
| `tests/playwright/journeys/sp1-edge-alignment.spec.js` | NEW — Playwright spec asserting padding/font/error/edge-alignment invariants |

---

## Task 1: Pre-flight checks

**Files:** none (read-only)

- [ ] **Step 1: Verify mockup + spec + standard exist**

```bash
ls -la docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp1-visual-baseline.html \
       docs/superpowers/specs/2026-05-02-sp1-visual-baseline-design.md \
       docs/superpowers/specs/2026-05-02-verification-standard.md
```

Expected: 3 files exist.

- [ ] **Step 2: Open mockup in default browser and read end-to-end**

```bash
open docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp1-visual-baseline.html
```

Visually confirm:
- Section ① shows Phase 1 form with edge-to-edge blocks at 360/768/1280
- Section ② shows score "65" in system-ui (NOT serif)
- Section ③ shows error red border on field inputs

- [ ] **Step 3: Baseline grep counts (will need to be 0 after sweep)**

```bash
grep -rE "font-family.*(Serif|serif|Georgia|Times)" public/ | wc -l
grep -rE "需要修正|gate-error-message|error-bar" public/ | wc -l
```

Record both counts as baseline. After sweep, both should be 0.

---

## Task 2: Add CSS tokens for padding + radius

**Files:** Modify `public/style.css`

- [ ] **Step 1: Find the `:root` block**

```bash
grep -n "^:root" public/style.css
```

Expected: one match near top of file.

- [ ] **Step 2: Add new tokens to `:root`**

In `:root { ... }`, append these lines (preserve existing tokens):

```css
  /* SP1 — block padding tokens */
  --pad-block: 14px;
  --pad-block-tablet: 18px;
  --pad-block-desktop: 22px;
  /* SP1 — radius tokens */
  --r-input: 8px;
  --r-pill: 999px;
```

- [ ] **Step 3: Verify CSS still parses**

```bash
node -e "const fs=require('fs'); const c=fs.readFileSync('public/style.css','utf8'); console.log('lines:', c.split('\n').length, 'pad-block uses:', (c.match(/--pad-block/g)||[]).length)"
```

Expected: `pad-block uses: 3` (just the new var definitions, before any consumers added).

- [ ] **Step 4: Commit**

```bash
git add public/style.css
git commit -m "style(sp1): add pad-block / r-input / r-pill tokens"
```

---

## Task 3: Strip Instrument Serif from style.css (5 known sites)

**Files:** Modify `public/style.css`

- [ ] **Step 1: List the 5 sites**

```bash
grep -nE "font-family.*'Instrument Serif'" public/style.css
```

Expected: 5 lines (welcome card title, line 2515, NSM total score, login card h2, grade letter).

- [ ] **Step 2: Replace each with `var(--c-font-sans)`**

For each line found in step 1, change:
```css
font-family: 'Instrument Serif', serif;
```
to:
```css
font-family: var(--c-font-sans);
```

Use sed or manual edit. If using sed:
```bash
sed -i.bak "s/font-family: *'Instrument Serif', *serif/font-family: var(--c-font-sans)/g" public/style.css
rm public/style.css.bak
```

- [ ] **Step 3: Verify zero serif remains**

```bash
grep -rE "font-family.*(Serif|serif|Georgia|Times)" public/
```

Expected: empty output.

- [ ] **Step 4: Visually verify (server must be running)**

```bash
PORT=4000 node server.js >/tmp/sp1-server.log 2>&1 &
sleep 2
curl -sf http://localhost:4000/ -o /dev/null -w "HTTP %{http_code}\n"
```

Open `http://localhost:4000/` in browser, navigate to any phase 3 score page (or inject AppState), confirm "65" no longer renders as serif.

- [ ] **Step 5: Commit**

```bash
git add public/style.css
git commit -m "style(sp1): replace all Instrument Serif with system-ui (incl grade letter)"
```

---

## Task 4: Edge-to-edge — set page wrappers padding-left/right to 0

**Files:** Modify `public/style.css`

- [ ] **Step 1: Find page-wrapper class definitions with horizontal padding**

```bash
grep -nE "(circles-home-wrap|circles-phase1-wrap|nsm-view|circles-home-desktop|phase1-desktop).*padding" public/style.css
```

Record the line numbers — these are the wrappers we need to neutralize horizontally.

- [ ] **Step 2: For each wrapper, set horizontal padding to 0**

For each match, change rules like:
```css
.circles-home-wrap { padding: 16px 24px; }
```
to:
```css
.circles-home-wrap { padding: 16px 0; }
```

(Vertical padding preserved; only horizontal becomes 0.)

If a wrapper uses `padding-left: Xpx; padding-right: Xpx;`, change both to 0.

- [ ] **Step 3: Verify zero horizontal padding remains on wrappers**

```bash
grep -nE "(circles-home-wrap|circles-phase1-wrap|nsm-view|circles-home-desktop|phase1-desktop)" public/style.css | grep -E "padding-(left|right): [^0]"
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add public/style.css
git commit -m "style(sp1): page wrappers go edge-to-edge (horizontal padding 0)"
```

---

## Task 5: Apply block padding tokens to internal blocks

**Files:** Modify `public/style.css`

- [ ] **Step 1: Identify internal block selectors**

These get internal padding from the new tokens (apply via search-and-replace in style.css):

- `.circles-nav` / `.nsm-navbar`
- `.phase-head` / `.circles-step-header`
- `.problem-card` (until SP3 deletes it; for now retain padding)
- `.qcard`, `.circles-q-card`
- `.action-row`, `.circles-submit-bar`
- `.field-group`, `.circles-field-group`

For each, replace hard-coded `padding-left:` / `padding-right:` with `var(--pad-block)`. Add tablet/desktop overrides via `@media (min-width: 768px)` and `@media (min-width: 1280px)`.

Example pattern:

```css
.circles-nav {
  padding: 12px var(--pad-block);
}
@media (min-width: 768px) {
  .circles-nav { padding-left: var(--pad-block-tablet); padding-right: var(--pad-block-tablet); }
}
@media (min-width: 1280px) {
  .circles-nav { padding-left: var(--pad-block-desktop); padding-right: var(--pad-block-desktop); }
}
```

- [ ] **Step 2: Apply to ALL `.circles-*-wrap`'s direct children that are full-width strips**

Use mockup `sp1-visual-baseline.html § ①` as ground truth — every block visible in the mockup must use the token.

- [ ] **Step 3: Visual verify with curl + browser**

Refresh dev server in browser at 360 / 768 / 1280 widths. Compare side-by-side with mockup. No element should be "indented" relative to others.

- [ ] **Step 4: Commit**

```bash
git add public/style.css
git commit -m "style(sp1): unify block horizontal padding via --pad-block tokens"
```

---

## Task 6: Unify border-radius — input/btn → 8, pills → 999, outer blocks → 0

**Files:** Modify `public/style.css`

- [ ] **Step 1: Audit current radius values**

```bash
grep -nE "border-radius:" public/style.css | sort -u | head -30
```

Identify any hard-coded radius != 8 / 999 / 0. Common offenders: 4, 6, 10, 12 (for cards which we now want 0 since edge-to-edge).

- [ ] **Step 2: Map values to tokens or 0**

Find/replace:
- `border-radius: 4px;` → drop or use `var(--r-input)` if it's a small element
- `border-radius: 6px;` → `var(--r-input)`
- `border-radius: 8px;` → `var(--r-input)` (already 8, just tokenize)
- `border-radius: 999px;` → `var(--r-pill)` (already 999)
- `border-radius: 12px;` on full-width blocks → `0` (since edge-to-edge)
- `border-radius: 12px;` on EXCEPTIONS (`.modal`, `.offcanvas`, `.login-card`, `.welcome-card`, `.qchip-panel`, `.dialog`) → keep as 12px

- [ ] **Step 3: Add `--r-card: 12px` token for the exceptions**

In `:root`, add:
```css
  --r-card: 12px;  /* exceptions — modal/offcanvas/login-card/welcome-card etc */
```

Apply `var(--r-card)` to the 5 exception classes.

- [ ] **Step 4: Verify counts**

```bash
grep -cE "border-radius: var\(--r-input\)" public/style.css
grep -cE "border-radius: var\(--r-pill\)" public/style.css
grep -cE "border-radius: var\(--r-card\)" public/style.css
```

Expected: r-input ≥10, r-pill ≥5, r-card ≥5.

- [ ] **Step 5: Commit**

```bash
git add public/style.css
git commit -m "style(sp1): unify border-radius via --r-input / --r-pill / --r-card tokens"
```

---

## Task 7: Error UI — replace bar with red border

**Files:** Modify `public/style.css`, `public/app.js`

- [ ] **Step 1: Find error message bar render code in app.js**

```bash
grep -nE "需要修正|gate-error-message|error-bar" public/app.js
```

Record line numbers.

- [ ] **Step 2: Delete those render blocks**

For each match, delete the surrounding `if/else` branch or HTML string concatenation that emits the bar. Keep variable assignments / state intact — only delete the visual rendering.

If a block looks like:
```javascript
if (gateResult.error) {
  bottomBar = '<div class="error-bar">需要修正以下問題...';
}
```
Change to:
```javascript
// Error visualisation handled via field-level red border (SP1)
```

- [ ] **Step 3: Add `.has-error` style to inputs**

In `public/style.css`, add:

```css
/* SP1 — field-level error visualisation */
.field-input.has-error,
.rt-textarea.has-error,
input.has-error,
textarea.has-error {
  border: 1.5px solid var(--c-danger, #ef4444) !important;
  background: rgba(239, 68, 68, 0.03);
}
```

- [ ] **Step 4: Find where gate result attaches error class to fields**

```bash
grep -nE "gate-result|.has-error" public/app.js
```

Verify there's existing logic to add `.has-error` to per-field elements based on gate response. If not, add a small loop in the gate handler:

```javascript
// In gate-result render path
(gateResult.fieldErrors || []).forEach(function(field) {
  var input = document.querySelector('[data-field="' + field + '"] textarea, [data-field="' + field + '"] input');
  if (input) input.classList.add('has-error');
});
```

- [ ] **Step 5: Verify zero references to old error bar**

```bash
grep -rnE "需要修正|gate-error-message|class=\"error-bar\"" public/
```

Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add public/style.css public/app.js
git commit -m "feat(sp1): replace error bar with field-level red border"
```

---

## Task 8: Write Playwright spec — sp1-edge-alignment

**Files:** Create `tests/playwright/journeys/sp1-edge-alignment.spec.js`

- [ ] **Step 1: Look at existing Playwright pattern**

```bash
sed -n '1,30p' tests/playwright/journeys/circles-home.spec.js
```

Note imports + test.describe pattern.

- [ ] **Step 2: Write the spec**

Create `tests/playwright/journeys/sp1-edge-alignment.spec.js` with:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('SP1 — visual baseline invariants', () => {

  test('outer page wrappers have 0 horizontal padding', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    const wrappers = ['.circles-home-wrap', '.circles-home-desktop'].filter(async sel => await page.locator(sel).count() > 0);
    for (const sel of wrappers) {
      if (await page.locator(sel).count() === 0) continue;
      const padding = await page.locator(sel).first().evaluate(el => {
        const cs = getComputedStyle(el);
        return { left: cs.paddingLeft, right: cs.paddingRight };
      });
      expect(padding.left).toBe('0px');
      expect(padding.right).toBe('0px');
    }
  });

  test('no element on home uses Instrument Serif', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    const serifElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => {
        const ff = getComputedStyle(el).fontFamily;
        return /Serif|Georgia|Times/i.test(ff) && !/system-ui/i.test(ff.split(',')[0]);
      }).map(el => ({ tag: el.tagName, cls: el.className, ff: getComputedStyle(el).fontFamily }));
    });
    expect(serifElements).toEqual([]);
  });

  test('gate error bar element does not exist anywhere', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.error-bar')).toHaveCount(0);
    await expect(page.locator('.gate-error-message')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.innerText.includes('需要修正以下問題'))).toBe(false);
  });

  test('field with .has-error has red border (1.5px)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (ta) ta.classList.add('has-error');
    });
    const ta = page.locator('textarea.has-error').first();
    if (await ta.count()) {
      const border = await ta.evaluate(el => getComputedStyle(el).borderColor);
      // Either rgb or rgba with red dominant
      expect(border).toMatch(/rgb\(239, 68, 68\)|rgba\(239, 68, 68/);
    }
  });

  test('block left-edge alignment — navbar / header / progress / chip share x=0', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    const targets = ['.circles-nav', '.circles-home-wrap > h1', '.qchip', '.problem-card'];
    const lefts = [];
    for (const sel of targets) {
      const el = page.locator(sel).first();
      if (await el.count()) {
        const left = await el.evaluate(e => Math.round(e.getBoundingClientRect().left));
        lefts.push({ sel, left });
      }
    }
    // All visible blocks should start at x=0 (page wrapper has padding 0)
    const nonZero = lefts.filter(l => l.left !== 0);
    expect(nonZero).toEqual([]);
  });
});
```

- [ ] **Step 3: Sanity check syntax**

```bash
node --check tests/playwright/journeys/sp1-edge-alignment.spec.js
```

Expected: silent (no syntax error).

- [ ] **Step 4: Commit (test only — implementation is already in)**

```bash
git add tests/playwright/journeys/sp1-edge-alignment.spec.js
git commit -m "test(sp1): edge-alignment / serif-free / no-error-bar invariants"
```

---

## Task 9: Run Playwright on all 8 viewports

**Files:** none (test execution)

- [ ] **Step 1: Ensure dev server up on :4000**

```bash
curl -sf http://localhost:4000/ -o /dev/null && echo READY || (PORT=4000 node server.js >/tmp/sp1-dev.log 2>&1 & sleep 2)
```

- [ ] **Step 2: Run new spec on all 8 projects**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  tests/playwright/journeys/sp1-edge-alignment.spec.js \
  --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro \
  --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 \
  --reporter=list --screenshot=on
```

Expected: 5 tests × 8 projects = 40 passed.

- [ ] **Step 3: View screenshots — at least 1 per viewport**

```bash
ls test-results/ | head
open test-results/sp1-edge-alignment-*Mobile-360*/test-finished-*.png
```

(Or use Read tool with the screenshot path.)

Verify visually that the rendered home page on each viewport has consistent edge alignment.

- [ ] **Step 4: Run regression — full existing Playwright + jest suites**

```bash
npx jest --no-coverage 2>&1 | tail -3
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test --config=tests/playwright/playwright.config.js --reporter=line 2>&1 | tail -3
```

Expected: jest all green; existing playwright suite all green (no regression).

If there's regression: investigate the failing test, determine if it's an SP1 side-effect or pre-existing flake. Pre-existing flake → document and proceed. SP1 regression → fix before continuing.

---

## Task 10: iOS Safari static review

**Files:** none (review-only, may produce small fixes)

- [ ] **Step 1: Walk the 15-item iOS quirk checklist** from `docs/superpowers/specs/2026-05-02-verification-standard.md` § 7

For each touched file (`public/style.css`, `public/app.js`):
- Touch targets ≥ 44×44 px (verify any new error-input clickable areas)
- `text-overflow: ellipsis` paired with `nowrap` + `overflow:hidden`
- `prefers-reduced-motion` not introduced
- `env(safe-area-inset-*)` preserved on sticky bars
- `font-size: 16px+` on inputs
- IME composition unaffected (we didn't touch composition listeners)

- [ ] **Step 2: Spot-check on iPhone-15-Pro Playwright project**

```bash
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  --project=iPhone-15-Pro \
  tests/playwright/journeys/sp1-edge-alignment.spec.js \
  --reporter=list --screenshot=on
```

View the screenshot, confirm:
- No horizontal scrollbar
- No element clipped at notch / safe area
- Font renders crisp without serif fallback

- [ ] **Step 3: Commit any fixes (or note "no iOS issues found")**

If fixes needed:
```bash
git add public/style.css public/app.js
git commit -m "fix(sp1): iOS Safari static review tweaks"
```

---

## Task 11: Final sign-off gate (per verification standard § 9)

**Files:** Create `audit/sp1-signoff.md`

- [ ] **Step 1: Run all gates**

```bash
echo "=== JEST ===" && npx jest --no-coverage 2>&1 | tail -5
echo "=== PLAYWRIGHT (all 8 projects, all specs) ===" && \
  PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js --reporter=line 2>&1 | tail -5
echo "=== GREP serif ===" && grep -rcE "font-family.*(Serif|serif|Georgia|Times)" public/ | grep -v ":0$"
echo "=== GREP error-bar ===" && grep -rnE "需要修正|gate-error-message|error-bar" public/
echo "=== CONSOLE — manual ===" 
```

Expected:
- jest: all green
- playwright: all green
- grep serif: empty (no files with serif uses)
- grep error-bar: empty

- [ ] **Step 2: Console check**

Open `http://localhost:4000/` in Chrome devtools. Navigate through home → Phase 1 → Phase 1.5 (gate, force error) → Phase 2 → Phase 3 (mock) → NSM → review-examples. Confirm no red errors / no unhandled rejections.

- [ ] **Step 3: Eyeball verification**

View at least 8 screenshots (1 per viewport project) from `test-results/`. Confirm visual matches mockup `sp1-visual-baseline.html § ①` happy path.

- [ ] **Step 4: Write sign-off**

Create `audit/sp1-signoff.md`:

```markdown
# SP1 Sign-off — 2026-05-02

- [x] All TDD tasks committed (T2-T7)
- [x] Playwright sp1-edge-alignment.spec.js: 40/40 passed across 8 viewports
- [x] Existing Playwright + jest: no regression
- [x] iOS quirks walked
- [x] 8 viewport screenshots viewed
- [x] Mockup parity confirmed visually
- [x] No console errors on home / phase1 / phase1.5 / phase2 / phase3 / nsm / review-examples

**Director:** [agent name]
**Branch:** feat/sp1-visual
**Commits:** <SHA list>
```

- [ ] **Step 5: Final commit + push**

```bash
git add audit/sp1-signoff.md
git commit -m "audit(sp1): sign-off"
```

If on worktree branch, prepare for merge to main:
```bash
git log --oneline main..HEAD
```

---

## Self-Review

**Spec coverage check:**
- ✅ Edge-to-edge wrappers (Task 4)
- ✅ Padding tokens (Tasks 2, 5)
- ✅ Radius tokens (Tasks 2, 6)
- ✅ Serif removal (Task 3)
- ✅ Error UI red border (Task 7)
- ✅ Exceptions (modal/offcanvas/login retain radius — Task 6 step 2)
- ✅ 8-viewport Playwright (Tasks 8, 9)
- ✅ iOS check (Task 10)
- ✅ Sign-off gate (Task 11)

**Type consistency:**
- `--pad-block` / `--pad-block-tablet` / `--pad-block-desktop`: consistent across Tasks 2 & 5
- `--r-input` / `--r-pill` / `--r-card`: consistent across Tasks 2 & 6
- `.has-error` class: consistent across Task 7

**Placeholder scan:** none.
