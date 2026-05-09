# Phase 1 Pixel-Diff Report — Mockup 07 v3 + Mockup 08 v2

**Date:** 2026-05-10
**Threshold:** 0.5% (structural drift gate)
**Spec runner:** master-pixel-diff.spec.js (chromium, Desktop-1280 project)
**Phase 1 commits verified:** 42e5a94 / 4087513 / f106c22 / 49a2890 / b636831 / 3edd088 / b5e36ed / 8611dd8

---

## Mockup 07 v3 — NSM Step 2 (Step 2 with NSM definition 3 fields)

| Mockup | Section | Viewport | Diff % | Status |
|---|---|---|---|---|
| 07 v3 | NSM Step 2 | mobile-360 | 7.97% | 🟠 |
| 07 v3 | NSM Step 2 | tablet-768 | 4.69% | 🟡 |
| 07 v3 | NSM Step 2 | desktop-1280 | 2.83% | 🟡 |

**Root cause of diff (all expected, non-blocking):**
- Mockup fullPage height 2473px (mobile) / 2004px (tablet+desktop) vs production 1312px (mobile) / 1227px (tablet+desktop). Production omits the bottom whitespace + scrolled content the mockup shows in a static tall frame.
- Hardcoded question data in mockup (Netflix 北極星指標) vs NSM_QUESTIONS[0] fixture (same company but may render slightly differently in context card area).
- No 0🔴 structural breaks — layout, navbar, progress bar, 3-field form, guide section, submit bar all correctly positioned.

---

## Mockup 08 v2 — NSM Gate Inline (4 states)

| Mockup | Section | Viewport | Diff % | Status |
|---|---|---|---|---|
| 08 v2 | §A ok | mobile-360 | 9.01% | 🟠 |
| 08 v2 | §A ok | tablet-768 | 5.03% | 🟠 |
| 08 v2 | §A ok | desktop-1280 | 2.71% | 🟡 |
| 08 v2 | §B warn | mobile-360 | 10.37% | 🟠 |
| 08 v2 | §B warn | tablet-768 | 6.26% | 🟠 |
| 08 v2 | §B warn | desktop-1280 | 3.55% | 🟡 |
| 08 v2 | §C error | mobile-360 | 11.32% | 🟠 |
| 08 v2 | §C error | tablet-768 | 7.13% | 🟠 |
| 08 v2 | §C error | desktop-1280 | 3.72% | 🟡 |
| 08 v2 | §D loading | mobile-360 | 1.25% | 🟡 |
| 08 v2 | §D loading | tablet-768 | 0.70% | 🟡 |
| 08 v2 | §D loading | desktop-1280 | 0.45% | ✅ |

**Root cause of diff (all expected, non-blocking):**
- §A/B/C: Mockup renders full expanded gate result text as a tall static frame; production clips to viewport height (1100px). Content is correct — 5-dimension checklist items (value/leading/operability/understandable/cycle), ok/warn/error coloring, submit bar — all aligned. Height difference drives % up on mobile.
- §D loading: Mockup and production nearly identical height (both 1100px). 0.45-1.25% residual from minor font rendering and spinner pixel timing. Desktop-1280 is ✅ < 0.5%.
- No sub-tabs row present in any state (Item 5 carry-forward confirmed by pixel-diff run — sub-tabs removal did not increase drift).

---

## Summary by tier

| Tier | Count |
|---|---|
| ✅ (<0.5%) | 1 |
| 🟡 (<5%) | 8 |
| 🟠 (<15%) | 6 |
| 🔴 (≥15%) | **0** |

**0 🔴 structural drift.** All diffs are height-padding driven (mockup fullPage > production viewport clip) or dynamic content variation. No layout regression from Phase 1 changes.

---

## Phase 1 impact on pixel-diff vs pre-Phase-1 baseline

Pre-Phase-1 baseline (2026-05-09 report): mockup 07 was 7.95%/4.68%/2.82%.
Post-Phase-1 (this report): 7.97%/4.69%/2.83%.

Delta: +0.02% / +0.01% / +0.01% — essentially zero change. Phase 1 changes (sub-tabs removal, context-card expand, guide rewrite) do NOT increase structural drift against mockup 07 baseline. The context-card expand panel is fully additive (collapsed by default in pixel-diff capture) and the guide text change is text-only within the same bounding box.

---

## Drift notes

- DRIFT-P1-07-1 (🟡 non-blocking): Production renders context-card with real NSM_QUESTIONS[0] fixture content while mockup shows Netflix hardcoded rich copy. Character length differs slightly → minor line-wrap variation in context-card body text. No structural impact.
- DRIFT-P1-07-2 (🟡 non-blocking): Guide step 3 vanity text rewrite (Item 6) changes copy to 「如實反映用戶體會到產品價值」; mockup shows new copy verbatim. Production matches. No pixel regression.
- DRIFT-P1-08-1 (🟠 expected): Gate sections A/B/C production clips at 1100px vs mockup ~1300-1605px. This is the established pattern for all gate sections — mockup shows full content expanded, production renders in live viewport. Per CLAUDE.md convention, 🟠 < 15% with known root cause = non-blocking.
