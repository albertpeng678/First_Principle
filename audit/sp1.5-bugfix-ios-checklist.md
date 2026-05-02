# SP1.5-bugfix iOS Safari Static Review — 15-item Checklist

**Date:** 2026-05-02
**Reviewer:** Claude (subagent-driven static review)
**Scope:** All `public/style.css` + `public/app.js` changes between commits `d338ccb..fc2827e` (12 commits, including bundle 1-3 + flex-chain follow-up)

Walked the 15-item iOS quirk checklist (per CLAUDE.md memory `feedback_ios_review_before_ship.md`) against every change.

| # | Item | Status | Evidence / Notes |
|---|------|--------|------------------|
| 1 | Focus / blur tab order | PASS | `.stale-action-bar` buttons (`#circles-stale-prev`, `#circles-stale-home`) appear in document order; default tab order works. No `tabindex` overrides added. |
| 2 | Touch tap-target ≥ 44 | PASS | `.circles-btn-primary`/`-secondary` already inherit `min-height: 44px` from existing rules (`public/style.css:2754`). `.stale-action-bar` does not override. |
| 3 | `-webkit-tap-highlight-color` | PASS | `.circles-btn-primary` already has `-webkit-tap-highlight-color: transparent` (existing rule). New `.stale-action-bar` doesn't override. |
| 4 | `position: fixed` bottom | PASS | `.stale-action-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; }` — same pattern as existing `.circles-submit-bar` (which has been verified on iOS). |
| 5 | `env(safe-area-inset-bottom)` | PASS | `.stale-action-bar { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }` — matches existing `.circles-submit-bar` pattern. |
| 6 | Modal | N/A | No modal added. |
| 7 | SSE / streaming | N/A | No streaming changes. Stale mode actually disables chat input. |
| 8 | `visualViewport` keyboard avoidance | N/A | Stale mode is read-only — no input field, no virtual keyboard interaction. The existing `_adjustCirclesKbFn` handler binds in non-stale `bindCirclesPhase2` and is not affected by stale-branch render. |
| 9 | Input `font-size: 16px` (prevent zoom) | N/A | No new input. Existing `.circles-input` and `.circles-field-input` are unchanged. |
| 10 | Autoplay video | N/A | None. |
| 11 | `backdrop-filter` | N/A | None added; existing navbar `backdrop-filter: blur(12px)` not modified. |
| 12 | CSS containment | N/A | No `contain` property added. |
| 13 | `-webkit-backdrop-filter` | N/A | Existing rules unchanged. |
| 14 | iOS Safari toolbar overlap | PASS | `.stale-action-bar { z-index: 20 }` matches existing `.circles-submit-bar` z-index (also 20) — proven not to conflict with iOS Safari toolbar. The `padding-bottom: calc(12px + env(safe-area-inset-bottom))` clears the home indicator. |
| 15 | `-webkit-overflow-scrolling` | PASS | `.circles-chat-body` already has `-webkit-overflow-scrolling: touch` (`public/style.css:2132`). Bundle 3 adds `padding-bottom: 88px` via `.stale-mode .circles-chat-body` — only affects the visible padding, not scroll behavior. The flex-chain follow-up commit (`fc2827e`) preserves `flex: 1; min-height: 0` on `.circles-body-centered > .circles-chat-body` chain so momentum scroll continues to work. |

## Additional iOS-specific verifications

### iOS Safari "100vh bug" (viewport height)
- `.stale-action-bar` uses `bottom: 0` not `top: calc(100vh - X)` — immune.
- `.circles-chat-wrap` uses `position: fixed; inset: 0` (existing) — immune.

### iOS Safari notch / dynamic island
- `.stale-locked-bar` does not occupy the top of the viewport (it sits below `.navbar` and `.circles-progress`). No notch concerns.

### Tap delay (300ms)
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` already in `index.html` — eliminates 300ms tap delay.

### Scroll snapping / momentum
- Stale mode `.circles-chat-body` retains existing `-webkit-overflow-scrolling: touch; overscroll-behavior: contain` — momentum scroll preserved.

### `:hover` states on touch devices
- `.stale-locked-bar`, `.stale-action-bar`, `.stale-mode` selectors don't define `:hover` rules. Existing button `:hover` rules are guarded by `@media (hover: hover) and (pointer: fine)` (verified at `public/style.css:265`).

## Verdict

**All 15 checklist items: PASS or N/A.**
**No iOS-specific regressions identified.**

iOS Safari will render the SP1.5-bugfix changes correctly:
- Compact merged banner displays as flex row
- Sticky double-button bar respects safe-area-inset-bottom
- Edge-to-edge stripes (border-radius: 0) match existing flush patterns from SP1.5
- Body-centered wrapper preserves chat-body flex chain (verified by fc2827e follow-up)
- Desktop layout split is desktop-only (`@media (min-width: 1024px)`) — no iOS impact
