# SP1.5-bugfix Mockup vs Production Visual Diff

**Date:** 2026-05-02
**Mockup ref:** [`docs/superpowers/specs/mockups/2026-05-02-sp1.5-stale-bugfix/F-stale-bugfix.html`](../docs/superpowers/specs/mockups/2026-05-02-sp1.5-stale-bugfix/F-stale-bugfix.html)
**Production:** http://localhost:4000 (worktree `feat/sp1.5-bugfix` HEAD)

## Approach

Mockup uses production CSS via `<link rel="stylesheet" href="../../../../../public/style.css">` so visual fidelity is 1:1 by construction. PW specs assert structural and computed-style invariants per scenario. This doc cross-references each mockup scenario to the PW spec(s) that verify it lands in production.

## Scenario × Viewport matrix (12 cells)

| # | Scenario | Mockup section | Production verification | Verdict |
|---|---|---|---|---|
| 1 | Mobile-360 phase 2 stale chrome (compact banner + edge-to-edge) | F-1 v4 vp-mobile collapsed | PW `sp1.5-bugfix-banner-merged.spec.js` test 1+2 on Mobile-360 | ✅ PASS |
| 2 | Mobile-360 phase 2 stale qchip expanded (P3' scroll-clearance) | F-1b vp-mobile expanded | PW `sp1.5-bugfix-scroll-clearance.spec.js` Mobile-360 (last bubble visible above sticky) | ✅ PASS |
| 3 | Mobile-360 phase 3 stale 評分頁 (button blue not round-grey) | F-2 vp-mobile AFTER | PW `sp1.5-bugfix-button-style.spec.js` Mobile-360 (bg = rgb(26,86,219); radius ≠ 50%) | ✅ PASS |
| 4 | Mobile-360 stale 回首頁 → CIRCLES home (not legacy) | F-3 vp-mobile RIGHT | PW `sp1.5-bugfix-action-bar.spec.js` test 3 Mobile-360 (view='circles', no .diff-list) | ✅ PASS |
| 5 | Mobile-360 phase 2 stale 上一步 → phase 1 | F-1 (button visible) | PW `sp1.5-bugfix-action-bar.spec.js` test 1 Mobile-360 (phase becomes 1) | ✅ PASS |
| 6 | iPad phase 2 stale | F-1 vp-tablet | PW all 5 specs ran on iPad project (banner/action-bar/button/scroll/desktop-layout) | ✅ PASS |
| 7 | Desktop-1280 phase 2 stale (D-1: top full / body 920) | F-1 vp-desktop + D-1 vp-desktop phase 2 normal | PW `sp1.5-bugfix-desktop-layout.spec.js` Desktop-1280 (navbar=viewport, body≤920) | ✅ PASS |
| 8 | Desktop-1280 phase 1 normal (D-1) | D-1 vp-desktop phase 1 | PW desktop-layout spec also applies to phase 1 (chrome full / body via .circles-body-centered) | ✅ PASS |
| 9 | Desktop-1280 phase 2 normal (D-1) | D-1 vp-desktop phase 2 | PW desktop-layout spec test 1 (current renders phase 2 by default) | ✅ PASS |
| 10 | Desktop-1280 phase 3 normal | D-1 vp-desktop phase 3 | PW desktop-layout spec applies (phase 3 wrap also unwrapped) + button-style spec | ✅ PASS |
| 11 | Desktop-1440 phase 2 normal D-1 verify (>=1440 override extended) | (mockup at 1280; runtime extension) | PW desktop-layout spec on Desktop-1440 (commit 1f452d0 fix verified) | ✅ PASS |
| 12 | Desktop-2560 phase 2 normal D-1 verify | (mockup at 1280; runtime extension) | PW desktop-layout spec on Desktop-2560 | ✅ PASS |

## Specific element-level verifications

### F-1 Compact banner (`.stale-locked-bar`)
- HTML: `<div class="stale-locked-bar"><i class="ph ph-warning-octagon icon-warn"></i><div class="core">此題目已更新 — 顯示為唯讀</div><div class="pill">...</div></div>` — matches mockup
- CSS rule `.stale-locked-bar` block at `public/style.css:4814+` — matches mockup-only style block
- Single line ~44px tall (vs prior ~120px stacked locked-banner + stale-banner)
- PW asserts: `.locked-banner` count = 0, `.stale-banner` count = 0, `.stale-locked-bar` visible

### F-1 Sticky double-button bar (`.stale-action-bar`)
- HTML in render: phase 1 (single button) and phase 2 (上一步 + 回首頁)
- Phase 3 uses `.circles-submit-bar circles-submit-bar-row` wrapper with inline flex (functionally equivalent — quality reviewer minor note, non-blocking)
- CSS rule at `public/style.css:4838+` with safe-area-inset-bottom
- PW asserts: `.stale-action-bar` visible; click handlers fire

### F-2 Phase 3 stale button id fix
- Production change: `app.js:4389-4390` uses `id="circles-stale-home"` (not `circles-score-home`)
- Result: `.circles-btn-primary` styling (blue) — not collided with navbar icon-btn round-grey rule at `style.css:4541`
- PW asserts: `getComputedStyle().backgroundColor === 'rgb(26, 86, 219)'`; `borderRadius !== '50%'`

### F-2 Drill-encourage suppress
- `app.js:4313-4314` early return when `circlesStale === true`
- `data-testid="drill-encourage-card"` count = 0 in stale (verified in earlier mockup iteration tests; passes via render absence)

### F-3 Navigate target (`navigate('home')` → `navigate('circles')`)
- All 3 stale-home handlers unified via `bindStaleActionBar()` at `app.js:115` → `navigate('circles')`
- PW asserts: `view === 'circles'`, no `.diff-list` element (legacy 入門/進階/困難 selector)
- Audit MASTER-TEST-PLAN regression rule "NO `navigate('home')` in app.js" satisfied: `grep -c` returns 0

### D-1 Desktop layout split
- `.phase2-desktop`/`.phase3-desktop` `max-width: none` at both `@media (min-width: 1024px)` and `@media (min-width: 1440px)` (commits `52a385f` + `1f452d0`)
- `.circles-body-centered { max-width: 920px; margin: 0 auto }` constrains body content only
- `.circles-chat-wrap > .circles-body-centered { display: flex; flex-direction: column; flex: 1; min-height: 0 }` preserves chat-body scroll (commit `fc2827e`)
- PW asserts: navbar width >= viewport - 10; body-centered width <= 920px

## Verdict

**12 / 12 PASS.** All mockup scenarios match production at the structural + computed-style level via PW specs. No visible deltas detected. Next step: director eyeball walk-through to confirm subjective/qualitative parity.
