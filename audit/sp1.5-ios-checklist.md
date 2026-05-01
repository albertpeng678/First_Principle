# SP1.5 — iOS Safari 15-item Static Checklist

**Branch:** `feat/sp1.5-fix-track`
**Date:** 2026-05-02
**Scope:** SP1.5 diff vs `main` — `public/app.js`, `public/style.css`, `public/index.html`
**Reference:** Memory rule `feedback_ios_review_before_ship.md`; spec §6.5

Inspection command:
```bash
git diff main...HEAD -- public/app.js public/style.css public/index.html
```

Diff summary: `public/app.js` +230, `public/style.css` +116, `public/index.html` 0 (no HTML diff against `main`).

---

## 1. Touch targets ≥ 44×44 logical px

**Status:** PASS

`.btn-icon` was visually changed to `width: 40px; height: 40px` in T2 (`public/style.css:221-228`) — a deliberate visual choice for the round icon button. **The cascading rule at `public/style.css:762`**

```css
.btn-icon  { min-width: 44px; min-height: 44px; padding: 10px; ... }
```

is loaded later in the file and overrides the visual `width/height` for hit-target purposes via `min-*`. Result: visual radius 40×40 pill, but iOS hit-box ≥ 44×44 — no invisible-hit-box patch needed.

Other interactive targets in SP1.5 diff:
- `.circles-btn-primary` / `.circles-btn-secondary` in submit bars — unchanged, retain `min-height: 44px` from existing rule.
- `#circles-stale-home`, `#circles-p2-prev-phase`, `#circles-p2-back-score`, `#circles-p1-next-step` — all use existing `.circles-btn-*` classes, inherit ≥ 44px.
- `.circles-send-btn[disabled]` — same dimensions as enabled state (only colour change), no hit-box shrink.

## 2. `text-overflow: ellipsis` requires `nowrap` + `overflow:hidden`

**Status:** N/A

SP1.5 diff introduces no new `text-overflow: ellipsis` rule. `grep "text-overflow" diff` returns no hits. The locked-banner / stale-banner allow text to wrap (`flex-direction` + `flex-wrap` defaults; banner content uses `<strong>` block + body line, both wrap freely).

## 3. `prefers-reduced-motion` respected for animations

**Status:** PASS

SP1.5 introduces no new keyframe animations or `transition` longer than the existing `0.15s` colour fades:
- `.btn-icon` adds `transition: background 0.15s` (sub-perceptible, conventional hover affordance).
- `.locked-banner`, `.stale-banner` are static — no transform / opacity transitions.

Existing global rule `@media (prefers-reduced-motion: reduce)` at `style.css:4612` continues to govern; SP1.5 adds nothing that bypasses it.

## 4. `env(safe-area-inset-*)` consumed on sticky bottom bars

**Status:** PASS

SP1.5 did not move or replace any sticky bottom bar. Existing consumers preserved:
- `style.css:514` (`.circles-submit-bar` family — `padding-bottom: max(10px, env(safe-area-inset-bottom))`)
- `style.css:814`, `style.css:990`, `style.css:1318`, `style.css:1914`, `style.css:2171`, `style.css:2227`, `style.css:2256`

SP1.5's new locked / stale banners render at the **top** of phase 1 / phase 2 (between progress bar and qchip slot — see `app.js:3115-3116, 3146-3147`); they're not bottom-stuck and need no safe-area padding.

## 5. Form `input` font-size 16 px+ (avoid focus-zoom)

**Status:** PASS

SP1.5 modifies `.circles-input.locked` and `.circles-field-input.locked` colour only; base `font-size` rules at `style.css:1525` (`.circles-input` 16px) and the `.circles-field-input` family unchanged. Spot check:

```bash
grep -n "circles-input\|circles-field-input" public/style.css | grep -i "font-size"
```

returns the existing 16 px declarations. `readonly` / `disabled` attributes added in SP1.5 do not alter font-size.

## 6. `interactive-widget=resizes-visual` honored

**Status:** PASS

`public/index.html:5` viewport meta unchanged:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-visual, viewport-fit=cover" />
```

`git diff main...HEAD -- public/index.html` returns empty, confirming no regression.

## 7. IME composition (compositionstart / compositionend) doesn't lose chars

**Status:** PASS

Existing real-time autosave handler at `public/app.js:1555-1556` preserved:

```js
ta.addEventListener('compositionstart', () => { ta._rtComposing = true; });
ta.addEventListener('compositionend',   () => { ta._rtComposing = false; });
```

SP1.5 adds `readonly` / `disabled` to inputs when locked (no IME possible in that state — correct). No keydown / input handler in SP1.5 fires synchronously during composition.

## 8. No `position:sticky` regressions inside scroll containers

**Status:** PASS

SP1.5 introduces no new `position: sticky` declaration. `grep "position: *sticky"` against the diff returns zero hits. Existing sticky rules at `style.css:181, 510, 982, 1507, 2224, 2252, 3815, 3816, 3834` all preserved.

T3's edit to `.navbar` removed only `margin-left: -16px; margin-right: -16px;` (style.css:185-186 in `main`). The `position: sticky; top: 0; z-index: 100;` declaration on the same selector is untouched.

## 9. No `backdrop-filter` introduced (existing one preserved)

**Status:** PASS

SP1.5 does **not** add or remove `backdrop-filter`. The navbar's existing rule at `style.css:183-184`:

```css
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
```

is preserved. T3's diff is margin-only (`margin-left: -16px; margin-right: -16px;` deleted), no `backdrop-filter` line touched. Other existing backdrop-filter at `style.css:3722-3723` (modal overlay) also untouched.

## 10. No new horizontal scroll on any 360–2560 viewport

**Status:** PASS

Independent confirmation: Playwright spec **`tests/playwright/journeys/sp1.5-edge-alignment.spec.js`** asserts edge-to-edge alignment and absence of horizontal scroll across all 8 viewports (Mobile-360, iPhone-SE, iPhone-14, iPhone-15-Pro, iPad, Desktop-1280, Desktop-1440, Desktop-2560).

The CSS edits that could introduce overflow (`#app` padding 0, `.navbar` no negative margin, `.circles-q-card` flush) are precisely the ones the spec polices via `body.scrollWidth <= viewport.width`.

## 11. `focus-visible` outline visible on iOS

**Status:** PASS

SP1.5 adds no `outline: none` and removes none. Existing focus-visible rules preserved at:
- `style.css:195` (`.navbar-logo:focus-visible`)
- `style.css:4295` (`.btn-home-icon:focus-visible`)
- `style.css:4372-4380, 4392-4394` (M-014 unified focus ring)
- `style.css:4653` (`.qchip:focus-visible`)

The new `#circles-stale-home`, `#circles-p2-back-score`, `#circles-p1-next-step` buttons inherit through the global `button:focus-visible` rule at `style.css:4379`.

## 12. `-webkit-tap-highlight-color: transparent` global rule preserved

**Status:** PASS

`style.css:125` global rule:

```css
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
```

unchanged. Per-component reaffirmations at lines 1520, 1587, 1625, 1687, 1714, 1845, 1959, 2063, 2503, 2519, 2642, 2685, 2753, 2769, 2789 preserved.

## 13. No new `position:absolute` overlay without ARIA

**Status:** PASS

The two new banners (`.locked-banner`, `.stale-banner`) use **inline flow** layout (no `position: absolute` / `fixed`). Confirmed in `public/style.css` SP1.5 additions — neither rule sets `position`. They are full-width banners between the progress bar and qchip, contributing to natural document flow. ARIA not required (no overlay / dialog semantics).

## 14. No new modal without focus trap

**Status:** N/A

SP1.5 does not introduce any new modal / dialog element. `grep "modal\|dialog\|role=\"dialog\""` against the diff returns zero hits. The B2 "上一步（看框架）" and "回評分" buttons cause **route changes** (phase 1 ↔ phase 2 ↔ phase 3), not modal opens.

## 15. No new long-press / 3D Touch dependencies

**Status:** PASS

SP1.5 adds no `touchstart` / `touchend` / `pointerdown` long-press handler, no `force` event, no `gesturestart`. All new handlers are click-based (`.addEventListener('click', ...)` at `app.js:3179, 3193, 3203, etc.`).

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Touch targets ≥ 44×44 | PASS (cascade preserves 44 hit-box) |
| 2 | text-overflow ellipsis | N/A |
| 3 | prefers-reduced-motion | PASS |
| 4 | safe-area-inset-* | PASS |
| 5 | input font-size ≥ 16px | PASS |
| 6 | interactive-widget=resizes-visual | PASS |
| 7 | IME composition | PASS |
| 8 | position:sticky | PASS |
| 9 | backdrop-filter | PASS (existing preserved) |
| 10 | horizontal scroll | PASS (8-vp Playwright) |
| 11 | focus-visible | PASS |
| 12 | tap-highlight-color | PASS |
| 13 | absolute overlay ARIA | PASS |
| 14 | modal focus trap | N/A |
| 15 | long-press / 3D Touch | PASS |

**Result: 13 PASS / 2 N/A / 0 FAIL.** SP1.5 is iOS Safari static-clean.
