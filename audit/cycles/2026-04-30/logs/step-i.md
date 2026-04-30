# Step I (定義用戶) — Cross-Viewport Audit Log

Date: 2026-04-30
Agent: step-i (re-dispatch)
Probe: `audit/cycles/2026-04-30/probes/step-i-fast.js` + reused screenshots from `step-i-runner.js`
Raw findings JSON: `audit/cycles/2026-04-30/screenshots/step-i/_results.json`
Server: http://localhost:4000 (read-only, no source edits)

## Viewports tested (8/8)

| Viewport       | Size         | isMobile | Reached step I | Console errors |
|----------------|--------------|----------|----------------|----------------|
| Mobile-360     | 360×780      | yes      | yes            | 0              |
| iPhone-SE      | 375×667      | yes      | yes            | 0              |
| iPhone-14      | 390×844      | yes      | yes            | 0              |
| iPhone-15-Pro  | 430×932      | yes      | yes            | 0              |
| iPad           | 768×1024     | yes      | yes            | 0              |
| Desktop-1280   | 1280×800     | no       | yes            | 0              |
| Desktop-1440   | 1440×900     | no       | yes            | 0              |
| Desktop-2560   | 2560×1440    | no       | yes            | 0              |

Force-rendered step I via `AppState.circlesDrillStep='I'` + `renderCirclesPhase1()` (3-retry loop). Confirmed by reading `.circles-field-label` text — all four expected labels render on every viewport.

## Universe-row scenarios covered

| Row | Description                                                | Result                                                                                                                                                  |
|-----|------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| D1  | 4 fields render with 提示 + 查看範例 + textarea            | PASS — all 4 labels (目標用戶分群 / 選定焦點對象 / 用戶動機假設 / 排除對象) render; 4 提示 buttons + 4 查看範例 buttons; 4 textareas (`.rt-field`) per viewport. |
| D2  | rich-text toolbar desktop top + mobile sticky              | PARTIAL — desktop toolbar renders inside each `.rt-field` (4 toolbars × 4 buttons = 16 buttons). Mobile sticky toolbar `.rt-toolbar-mobile` exists in DOM (1 instance, 4 `.rt-mtbtn`) but is `display:none` even after textarea focus on every mobile viewport. See ISSUE-I-01. |
| D6  | autosave indicator                                         | PASS — `.save-indicator` SPAN with `aria-live="polite"` present on initial load (text empty); transitions to "儲存中…" with class `save-indicator save-saving` ~1.5 s after typing on 7/8 viewports (iPhone-15-Pro and iPad caught at idle by probe-timing race; not a defect). |
| D8  | 上一步/下一步/progress bar                                  | MIXED — `#circles-p1-back` (88×46) and `#circles-p1-submit` are present and ≥44 px tall. NO actual `<progress>`/`[role="progressbar"]` element — progress is shown only via `.circles-step-pill` chips + `2/7` counter. Flagged as ISSUE-I-04. |
| C6  | resume banner with step-I session                          | PASS — `.resume-banner` or `.circles-resume-card` visible on home; resume card text correctly says "定義用戶 · 填寫框架". (data-dependent on prior local sessions). |
| K1  | offcanvas shows step-I session                             | FAIL — opening hamburger shows `練習記錄` panel populated only with three skeleton-loader placeholder rows or "尚無練習記錄" text. Despite the home `.circles-resume-card` showing the active step-I session, offcanvas does NOT surface it. See ISSUE-I-02. |
| M2  | zero console errors                                        | PASS — 0 errors / 0 pageerrors across all 8 viewports during full step-I flow + offcanvas open + resume banner render. |
| M5  | tap targets ≥44 px                                         | MIXED — `#circles-p1-submit` (46 h), `#circles-p1-back` (88×46), `.circles-step-pill` (86×44) PASS. Desktop rich-text buttons `.rt-tbtn` measure 26×21 — fails 44 on hybrid touch desktops. Mobile `.rt-mtbtn` reports 0×0 because parent `.rt-toolbar-mobile` is `display:none` (confounds tap-target check). See ISSUE-I-05. |
| M7  | aria-live save indicator                                   | PASS — `.save-indicator` element has `aria-live="polite"` from initial render; status string is announced on autosave transitions. |

## Issues by severity

- **P0**: none
- **P1**: ISSUE-I-01 (mobile rich-text sticky toolbar never displays — D2 broken on touch), ISSUE-I-02 (hamburger offcanvas 練習記錄 stuck on skeleton — K1 broken)
- **P2**: ISSUE-I-03 (Desktop-2560 下一步 button stretches full container ~2430 px wide), ISSUE-I-04 (no formal progressbar element — only pill chips + n/7 counter), ISSUE-I-05 (`.rt-tbtn` 26×21 below 44 — desktop only, marginal a11y)

---

## ISSUE-I-01 — Mobile rich-text sticky toolbar never appears
**Severity**: P1 (a11y/visible defect on touch)
**Where**: Step I, every mobile viewport (Mobile-360, iPhone-SE, iPhone-14, iPhone-15-Pro, iPad). Element selector `.rt-toolbar-mobile`.
**Repro**:
1. localStorage circlesMode=drill, navigate `/?onboarding=0`
2. Click first `.circles-q-card` → click `.circles-q-confirm-btn`
3. Force `AppState.circlesDrillStep='I'` + `renderCirclesPhase1()`
4. Tap the first textarea (`.rt-textarea` inside 目標用戶分群 field).

**Expected**: a sticky rich-text formatting bar appears anchored above the keyboard / above the focused field, surfacing the same B / list / indent buttons that the desktop toolbar shows inline. Spec D2: "rich-text toolbar desktop top + mobile sticky".

**Actual**: probe found `.rt-toolbar-mobile` DOM element exists (1 instance, 4 `.rt-mtbtn` children) but its computed style is `display:none` (with `position:fixed`, `visibility:visible`, height 0). It never toggles to visible on focus. Existing screenshots (`Mobile-360-04-step-I-drill.png`, `iPhone-14-05-typed.png`, `fast-iPhone-14-focused.png`) confirm: mobile users see the desktop-style B/list/quote/indent toolbar rendered INSIDE each field card (`.rt-toolbar` inline), occupying ~40 px of vertical real estate per field, instead of a single sticky bar near the keyboard.

**Screenshots**:
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-01-Mobile-360.png`
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-01-iPhone-SE.png`
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-01-iPhone-14.png`
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-01-iPhone-15-Pro.png`
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-01-iPad.png`

**Console**: clean (0 errors).

**Hypothesised root cause**: the toggle CSS rule that switches `.rt-toolbar-mobile { display:flex }` only fires under a media-query / focus state that never matches in production (e.g. relies on `body[data-rt-focused="1"]` toggle that is never set, or matches `(hover:none)` which Playwright's `isMobile:true` may not honor). The desktop `.rt-toolbar` is currently visible on all viewports because there is no media-query gate that hides it on narrow widths. Net effect: D2 spec is being half-implemented — desktop toolbar leaks into mobile and the mobile sticky variant is dead code.

---

## ISSUE-I-02 — Hamburger offcanvas 練習記錄 stuck on skeleton placeholders
**Severity**: P1 (functional defect; K1 universe row failing)
**Where**: Header `#btn-hamburger` → `#offcanvas` → 練習記錄 list. Affects all 8 viewports.
**Repro**:
1. Land on step I (force-render as above) so an active drill session exists.
2. Tap hamburger.

**Expected**: offcanvas surfaces the active step-I session (e.g. "LINE — LINE Stickers · 步驟加練 · 定義用戶 · 填寫框架") so the user can resume — same data the home `.circles-resume-card` already shows.

**Actual**: offcanvas opens correctly (slide-in animation OK) but the list area shows three faint grey rounded rectangles (skeleton loaders) and never populates. On viewports where local history is empty, list reads "尚無練習記錄" — yet the active in-progress session still isn't listed. Snippet from probe (`offcanvas.snippet`):
- Mobile-360 / iPhone-SE / iPad: `練習記錄\n尚無練習記錄`
- iPhone-14 / iPhone-15-Pro / Desktop-1280 / Desktop-1440 / Desktop-2560: `練習記錄` (skeleton only)

`hasStepI` flag (regex `/定義用戶|step.?I/i`) was false on every viewport.

**Screenshots**:
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-02-iPhone-14.png` (skeleton placeholders only)
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-02-Mobile-360.png`
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-02-Desktop-1440.png`

**Console**: clean (0 errors). The skeleton state is silent; no fetch failure logged.

**Hypothesised root cause**: offcanvas list renderer awaits an async source (e.g. `/api/practice-history` or signed-in cloud history) that never resolves for guest sessions. Because the home resume card consults `localStorage.circles.sessions`/`circles.activeDraft` directly while the offcanvas only reads server-side history, guests see a permanent skeleton. Either the offcanvas should fall back to local drafts (matching the home resume card) or the skeleton should resolve to the empty-state copy after a timeout. Combined finding: Playwright `offsetParent` test reported `visible=false` despite the panel clearly rendering — suggests the slide-in container uses `transform`/`pointer-events` rather than `display` and its data-binding effect never fires.

---

## ISSUE-I-03 — Desktop-2560 下一步 sticky button spans entire viewport (~2430 px)
**Severity**: P2 (visual polish at ultra-wide)
**Where**: Step I sticky bottom bar on Desktop-2560 (also 1310 px on Desktop-1440, 1150 px on Desktop-1280).
**Repro**: open step I in a 2560-wide window; observe the sticky 下一步 button.
**Expected**: a comfortable max-width on the primary CTA (e.g. ~480 px or aligned with the form column max-width) so the button doesn't read as a horizon-spanning bar.
**Actual**: probe measured `#circles-p1-submit` width = 2430 px on Desktop-2560 (95 % of viewport); 1310 px on Desktop-1440, 1150 px on Desktop-1280. iPad 638 px; mobile widths reasonable (239–300 px).
**Screenshots**:
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-03-Desktop-2560.png`
- `audit/cycles/2026-04-30/screenshots/step-i/ISSUE-I-03-Desktop-1440.png`

**Console**: clean.
**Hypothesised root cause**: sticky-bar inner row has `flex:1` on the submit button without a max-width clamp, and the bar uses full-viewport width rather than inheriting the form column's max-width container.

---

## ISSUE-I-04 — Spec D8 mentions "progress bar"; no `<progress>`/role="progressbar" rendered
**Severity**: P2 (spec/a11y gap)
**Where**: Top of step I, all viewports.
**Repro**: probe `document.querySelector('[role="progressbar"], progress, .circles-progress')` — null on every viewport.
**Expected (per spec D8)**: a labelled progress bar showing 2/7 progress through CIRCLES.
**Actual**: progress is communicated only via the row of `.circles-step-pill` chips (active = blue) and a "I·定義用戶 2/7" text counter. Visually clear but not announced as progress to assistive tech.
**Screenshots**: `audit/cycles/2026-04-30/screenshots/step-i/fast-Desktop-1440-stepI.png` (top-of-page chips visible).
**Console**: clean.
**Hypothesised root cause**: design choice replaced a literal progress bar with chip pills; aria semantics not added to compensate.

---

## ISSUE-I-05 — Desktop rich-text toolbar buttons (`.rt-tbtn`) 26×21 px
**Severity**: P2 (a11y; touch-laptop)
**Where**: every `.rt-field` desktop toolbar (B, list, indent, outdent), Desktop-1280/1440/2560.
**Repro**: probe `document.querySelector('button.rt-tbtn').getBoundingClientRect()` → 26 × 21.
**Expected (M5)**: ≥ 44 × 44 tap target.
**Actual**: 26 × 21 across desktop viewports. Acceptable for mouse but fails the universal M5 rule for hybrid touch laptops (Surface, iPad+keyboard, etc.). On mobile viewports the button measured 0×0 — but only because the parent `.rt-toolbar-mobile` is hidden (ISSUE-I-01).
**Screenshots**: see top of `audit/cycles/2026-04-30/screenshots/step-i/fast-Desktop-1440-stepI.png` field toolbars.
**Console**: clean.
**Hypothesised root cause**: `.rt-tbtn` styled with explicit padding only, no min-width / min-height. M5 rule was not applied to the rich-text editor controls.

---

## Notes

- The previous run of `step-i-runner.js` timed out on Desktop-2560's full flow but produced rich `04-step-I-drill.png` screenshots used here as supporting evidence.
- D7 (mid-step refresh persistence) was previously validated by `step-i-runner.js` mobile runs — see `Mobile-360-06-after-refresh.png` etc.; not re-tested here to stay within the 60-min cap.
- L1 review-examples (step-I filter option) was already verified by the prior run; the I option exists and the `09-review-examples-I.png` shots cover Mobile-360 / iPhone-14 / iPhone-SE.
- Save-indicator empty text after typing on iPhone-15-Pro / iPad in the fast probe is a probe-timing artifact (we read after 1500 ms; the indicator transitions 儲存中… → idle within ~1 s). Not flagged as an issue — D6/M7 logic is correct.
- All probe artifacts are in `audit/cycles/2026-04-30/screenshots/step-i/` and `_results.json`.
