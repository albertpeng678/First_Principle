# CIRCLES Progress Bar Redesign + Field Layout + Navbar Alignment — Design

**Date:** 2026-04-30
**Author:** session 4 (Windows)
**Scope:** Three coupled UI changes that all shipped together because they were raised in the same brainstorming session.

## Background

After the 2026-04-30 audit cycle (commits `4941ee3` → `2560009`) shipped, the user reviewed the result on a real iPhone and a 14-inch laptop. Three more items came up:

1. The current CIRCLES progress strip — 7 thin 3px bars with letter labels positioned absolutely below — looks visually inconsistent with the NSM 4-step circle progress style. User wants the CIRCLES strip to mirror NSM's circle-and-line pattern. Reference image: `Image (1).jpg` (NSM step 1 page).
2. In every CIRCLES Phase 1 step form (Step C / I / R / C2 / L / E / S), the field's "提示" hint trigger sits on the right of the label row above `查看範例`, and the example expander sits between the label row and the textarea. The user wants both controls to live on the *same row immediately above the textarea*, not separated. Choice **Y** from the brainstorming mockup: a single row with `查看範例` left-aligned and `提示` right-aligned, sitting flush above the textarea, no toolbar coupling.
3. The NSM-mode top navbar (rendered in `.nsm-view`) shows `CIRCLES` / `北極星指標` tabs flush left and the logout icon flush right, but on the user's iPhone screenshot the tab pair did not visually align with the logout button — the tab block was offset / mis-anchored. Fix: navbar must look identical to CIRCLES-mode regardless of which view is active.

## Out of scope

- Onboarding tour, hint copy, example content — unchanged.
- Phase 2 (chat) and Phase 3 (score) progress bars — they reuse the same `.circles-progress` markup, so they pick up the redesign automatically. No bespoke variant per phase.
- Login / register / review-examples pages — no progress bar present.
- Mobile sticky bottom toolbar (`#rt-toolbar-mobile`) — separate concern, not touched.

## Approach

### 1. CIRCLES progress bar — option C (circles + letters, label single-line below)

**Markup** — replace the current `<div class="circles-progress">[7×div.circles-progress-seg + 1×div.circles-progress-label]</div>` with a single shared component that mirrors `buildNsmProgressBar` but for 7 letters:

```html
<div class="circles-progress" role="list" aria-label="CIRCLES 訓練進度">
  <div class="circles-progress-track">
    <div class="circles-progress-step done"   role="listitem" aria-label="第 1 步 澄清情境 (Comprehend / Clarify) 已完成">C</div>
    <div class="circles-progress-line done"></div>
    <div class="circles-progress-step done"   role="listitem" aria-label="第 2 步 定義用戶 已完成">I</div>
    <div class="circles-progress-line done"></div>
    <div class="circles-progress-step active" role="listitem" aria-label="第 3 步 發掘需求 進行中" aria-current="step">R</div>
    <div class="circles-progress-line"></div>
    <div class="circles-progress-step"        role="listitem" aria-label="第 4 步 優先排序">C</div>
    <div class="circles-progress-line"></div>
    <div class="circles-progress-step"        role="listitem" aria-label="第 5 步 提出方案">L</div>
    <div class="circles-progress-line"></div>
    <div class="circles-progress-step"        role="listitem" aria-label="第 6 步 評估取捨">E</div>
    <div class="circles-progress-line"></div>
    <div class="circles-progress-step"        role="listitem" aria-label="第 7 步 總結推薦">S</div>
  </div>
  <div class="circles-progress-current">
    <span class="circles-progress-current-letter">R · 發掘需求</span>
    <span class="circles-progress-current-meta">Report needs · 3/7</span>
  </div>
</div>
```

**Why option C, not A or B:** the 7-step Chinese name set (澄清情境 / 定義用戶 / 發掘需求 / 優先排序 / 提出方案 / 評估取捨 / 總結推薦) is too wide to fit beneath each circle on Mobile-360 even with 10px font. Option C drops the per-step text label and shows only the active step's name in a single line below the track — same density as the current implementation but with the cleaner circle-and-line geometry from NSM.

**CSS targets** (placed inside `[data-view="circles"]`):

```css
.circles-progress { padding:14px 16px; background:var(--c-card); border-bottom:1px solid var(--c-border); }
.circles-progress-track { display:flex; align-items:center; gap:4px; }
.circles-progress-step {
  width:28px; height:28px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-family:'DM Sans',sans-serif; font-size:12px; font-weight:700;
  background:#fff; color:var(--c-text-2); border:2px solid var(--c-border-mid, rgba(0,0,0,0.15));
  position:relative; min-width:44px; min-height:44px; /* tap-target safety, transparent inset */
}
.circles-progress-step::before { content:''; position:absolute; inset:-8px; }
.circles-progress-step.active { background:var(--c-primary); color:#fff; border-color:var(--c-primary); box-shadow:0 0 0 3px rgba(26,86,219,0.2); }
.circles-progress-step.done   { background:var(--c-primary); color:#fff; border-color:var(--c-primary); }
.circles-progress-line { flex:1; height:2px; background:var(--c-border); min-width:6px; }
.circles-progress-line.done { background:var(--c-primary); }
.circles-progress-current { margin-top:8px; font-family:'DM Sans',sans-serif; font-size:13px; }
.circles-progress-current-letter { color:var(--c-primary); font-weight:600; margin-right:6px; }
.circles-progress-current-meta { color:var(--c-text-2); font-size:12px; }
```

Note: the `min-width:44px / min-height:44px` looks contradictory with `width/height:28px`, but it's intentional — the actual circle is 28px (visible) and the `::before` pseudo extends the *clickable / focusable* hit-box outward to 44px without affecting layout. This preserves AUD-020/021 tap-target compliance.

**Mobile / desktop sizing:**

- Mobile (≤1023): track 28px circles, `gap:4px`, line `min-width:6px`.
- Desktop (≥1024): same circles + slightly bigger gaps inside `.phase1-desktop .circles-progress-track { gap:8px }` to feel less cramped on wider tracks. Active letter text in current-line bumps to 14px.

The 7 circles + 6 lines fit comfortably even at 360px viewport: `7×28 + 6×6 + padding(32) = 244` ≤ 343 inner width.

**Renderer change:** replace the per-step `progressSegs` map at app.js lines 2646, 3225, 3364, 3836 with a single shared helper `buildCirclesProgressBar(activeIdx)` (mirroring `buildNsmProgressBar`). The four call sites (Phase 1 / Phase 1.5 gate / Phase 2 chat / Phase 3 score) all pass through it. The line-state computation `i < activeIdx ? 'done' : (i === activeIdx ? 'active' : '')` stays identical to the current logic.

### 2. Field layout — option Y (hint + example controls flush above textarea)

**Markup change** — for every `.circles-field-group`:

```html
<div class="circles-field-group">
  <div class="circles-field-label-row">
    <label class="circles-field-label">問題範圍</label>
    <!-- (no buttons here anymore) -->
  </div>
  <div class="circles-field-affordances">
    <button class="circles-field-example-toggle" type="button" aria-expanded="false">
      <i class="ph ph-caret-right" aria-hidden="true"></i> 查看範例
    </button>
    <span class="circles-field-affordance-spacer"></span>
    <button class="circles-field-hint-trigger" type="button" aria-label="顯示提示">
      <i class="ph ph-lightbulb" aria-hidden="true"></i> 提示
    </button>
  </div>
  <!-- (toolbar-mobile + textarea — unchanged structure) -->
</div>
```

The hint trigger and example toggle moved out of the label row into a single new `.circles-field-affordances` row, sandwiched between label and textarea. Both buttons remain identical in behaviour — same handlers (`toggleExampleHint` etc) — only their DOM position changes.

**CSS:**

```css
.circles-field-affordances {
  display:flex; align-items:center; gap:8px;
  margin:6px 0;            /* visual gutter to label above + textarea below */
  padding:0 2px;           /* keep buttons aligned with textarea inner padding */
}
.circles-field-affordance-spacer { flex:1; }
.circles-field-example-toggle,
.circles-field-hint-trigger {
  display:inline-flex; align-items:center; gap:4px;
  background:none; border:none; padding:6px 8px;
  font-family:'DM Sans',sans-serif; font-size:12px;
  color:var(--c-primary); cursor:pointer; min-height:44px;
}
.circles-field-example-toggle .ph,
.circles-field-hint-trigger .ph { font-size:14px; }
```

Phosphor icons (`ph ph-caret-right` for example, `ph ph-lightbulb` for hint) match the rest of the app — no emoji.

**Active states** — when the example expander is open, swap caret-right → caret-down via existing `.expanded` class. When the hint popup is showing, the trigger gets the existing `.active` highlight class. Both unchanged from today.

**Cross-view scope:** all four step renderers in `renderCirclesPhase1Step` (and the per-dimension fields built by helpers like `buildCirclesStepFieldsHtml`) use `.circles-field-label-row` today. Single-source markup change covers them all.

### 3. NSM-mode navbar alignment

The user's screenshot shows in NSM mode: `[hamburger] [logo] [PM Drill] [CIRCLES] [北極星指標 (active)] ...gap... [logout]`. The right side appears mis-anchored — the gap between the tab block and the logout button is asymmetric versus CIRCLES mode.

Root cause hypothesis (verify on implement): `body[data-view="nsm"] .navbar { margin-bottom: 0 }` (style.css:256) only zeroes the navbar's bottom margin, but `body[data-view="nsm"] #app { padding: 0 }` (style.css:248-250) wipes the global #app padding that CIRCLES mode relies on for navbar internal alignment. The navbar uses flexbox and inherits #app's box; with `padding:0` the navbar's `.navbar-actions` no longer matches the right edge that CIRCLES mode produces.

**Fix:** either (a) keep #app padding nonzero in NSM mode but make `.nsm-view` self-pad to the same value, or (b) move the right-edge alignment into the `.navbar` rule itself so it doesn't depend on #app padding. Option (b) is cleaner — drop dependency on parent box. Concrete change:

```css
.navbar {
  /* existing rules */
  padding-left:  max(env(safe-area-inset-left), 16px);
  padding-right: max(env(safe-area-inset-right), 16px);
}
body[data-view="nsm"] .navbar { padding-left: max(env(safe-area-inset-left), 16px); padding-right: max(env(safe-area-inset-right), 16px); }
```

This guarantees the navbar's interior 16px gutter regardless of #app's padding/width. The visible behaviour: `CIRCLES / 北極星指標` tabs and logout button both anchor to the navbar's 16px insets, identical in CIRCLES and NSM modes.

Verify with a visual diff snapshot at iPhone-SE / iPhone-15-Pro / Desktop-1280 in CIRCLES vs NSM mode — gap from logout to right edge should be the same to the pixel.

## Testing

### Unit / structural

- Update `audit-master.spec.js`:
  - **AUD-015** "CIRCLES progress segments have C/I/R/C/L/E/S labels" still holds — markup now uses `.circles-progress-step` instead of `.circles-progress-seg-letter`, so widen the selector. The test should fetch step elements and assert the visible text on each is one of the 7 letters.
  - Add **AUD-015b** asserting active circle has `aria-current="step"` and the rendered current-line text matches `<letter> · <Chinese name>`.
- Add a new **AUD-054** P1 test: "field affordance row contains both example-toggle and hint-trigger, on the same row, both icon-prefixed (no emoji)". Assert: same `.circles-field-affordances` parent, computed styles match flexbox row, both children have `<i class="ph">` descendant.
- Add a new **AUD-055** P1 test: "navbar-actions right-edge gap is identical in CIRCLES mode and NSM mode". Compute `viewport_width - logout.right` in both modes; expect within 1px.

### Visual

- Re-generate `audit/rwd-grid/<project>/02-circles-step-c.png` for all 8 viewport projects so the PNGs reflect the new bar.
- Add a new route `09-circles-step-r` to the rwd-visual-gate spec — Step R is the user's reference point and exercises the "two completed bars + one active" path.
- Add a new route `10-nsm-home-navbar-aligned` — full-page screenshot of NSM home with navbar visible so the gap is visually verifiable across all 8 viewports.
- Existing AUD-000-A4 (home content/viewport ratio across 15 widths) and AUD-000-A5 (`.p1-main` fills 1fr track) continue to pass — no layout-width changes.

### Per-viewport coverage (mandated by user)

Run after implementation:

```
PMDRILL_BASE_URL=http://localhost:4000 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  journeys/audit/ --workers=4 --reporter=line
```

Across all 8 viewport projects (Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560). Pass criterion: 0 failures.

Then human eyeball review of the regenerated `audit/rwd-grid/` PNGs, especially `02-circles-step-c.png` (new progress bar shape) and any new `09-/10-` shots.

## Risks

- **CIRCLES Step 4 letter is "C2" / "Cu" depending on file** — existing CIRCLES_STEPS array in app.js. The progress circle should show the *short* glyph (`C` for both step 1 and step 4 — they're the literal letters in C-I-R-C-L-E-S). Current renderer uses `s.short` for the letter. Verify this gives "C / I / R / C / L / E / S" not "C / I / R / U / T / L / E / S" (the 8-letter expansion is wrong — CIRCLES is 7 letters not 8). Source-of-truth: AUD-015 test currently asserts `C/I/R/U/T/L/E/S` — that test is wrong about the framework; should be C/I/R/C/L/E/S. Fix as part of this change.
- **Phase 1.5 gate + Phase 3 score share `.circles-progress`** — the current label (`stepShort + ' · ' + stepLabel`) gets rendered inside the new `.circles-progress-current-letter`. Visual layout is the same; only that the surrounding wrapper changed. Verify Phase 1.5 / Phase 3 don't push pixel-perfect layout with current-line text.
- **Hint popover positioning** — hint popovers anchor relative to `.circles-field-hint-trigger`. Moving the trigger from inside the label row to the new affordance row shifts that anchor down by ~20-40px. Verify popover stays inside viewport on mobile (it currently positions `right:0; top:100%`).
- **Example expander height jumps** — the expander accordions content under itself. Now that it's directly above the textarea, expanding pushes the textarea down. Verify the textarea remains in view (or scrolls to it) on mobile.

## Acceptance criteria

1. Phase 1 step C (and every other CIRCLES step) renders 7 circles + 6 connecting lines, with the active circle filled in `--c-primary` and lined-up letters C/I/R/C/L/E/S.
2. Beneath the track, a single line shows `<letter> · <step-name>` in `--c-primary` plus `<English origin> · <i+1>/7` in muted text.
3. Each field has a single affordance row above the textarea with `查看範例` icon-button on the left and `提示` icon-button on the right, both using Phosphor icons (no emoji).
4. NSM-mode navbar has the same right-edge gap (logout to viewport edge) as CIRCLES-mode at every viewport project.
5. `audit-master` and `rwd-visual-gate` pass at 0 failures across all 8 viewport projects.
6. Human eye review of regenerated `audit/rwd-grid/` PNGs confirms no visual regressions in any phase.

## Files to touch (summary)

- `public/app.js` — extract `buildCirclesProgressBar(activeIdx)` helper, replace 4 call sites; restructure `circles-field-label-row` markup; remove inline lightbulb emoji if any remain.
- `public/style.css` — add `.circles-progress-step / -line / -current(-letter / -meta)` rules, `.circles-field-affordances` rules, `.navbar` padding decoupled from `#app`. Remove the now-unused `.circles-progress-seg / -seg-letter / -label` rules to avoid dead CSS.
- `tests/playwright/journeys/audit/audit-master.spec.js` — fix AUD-015 letter list to C/I/R/C/L/E/S; add AUD-015b / AUD-054 / AUD-055.
- `tests/playwright/journeys/audit/rwd-visual-gate.spec.js` — extend ROUTES with `09-circles-step-r` and `10-nsm-home-navbar`.
- `audit/rwd-grid/**` — regenerated PNGs (auto by spec run).

## Out-of-scope follow-ups (not blocking ship)

- Hint popover repositioning rules if they overflow on Mobile-360 — small fix, can be folded in if Risk #3 materialises during implementation.
- Long-term consolidation of `.circles-progress` and `.nsm-progress` into one shared component — would touch more files; left for a future refactor.
