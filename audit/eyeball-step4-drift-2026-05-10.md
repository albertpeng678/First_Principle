# NSM Step 4 Drift Audit — 2026-05-10

**Director:** Sonnet 4.6 (Phase A audit + Phase B fixes)
**Spec:** mockup 14 `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/14-nsm-step-4.html`
**Scope:** `renderNSMStep4` + restore path in `loadCirclesSessionFromHistory`
**PNG audit:** `audit/png-step4-drift-audit/` — 12 PNGs (4 tabs × 3 viewports)

---

## Phase A: Drift Summary

### DRIFT-S4-1 — 🔴 BLOCKING: renderNSMProgress(4) on Step 4 report

**Location:** `public/app.js` line 2244 (pre-fix)
**Mockup contract:** Mockup 14 line 597+. Step 4 chrome = navbar + `nsm-nav` + `nsm-summary` + `tab-bar`. No `nsm-progress` 4-dot workshop stepper. `nsm-progress` belongs to Step 1/2/3 forms only.
**Production behavior:** `renderNSMStep4()` prepended `renderNSMProgress(4)` as first child of `[data-nsm-step4]`, adding a 4-dot workshop stepper (情境定義/指標設定/4維拆解/評分報告) at top of every Step 4 view.
**Fix:** Removed `+ renderNSMProgress(4)` line. `nsm-nav` is now the direct first child.
**Status:** FIXED

---

### DRIFT-S4-2 — ✅ ALREADY FIXED (pre-existing): nsmEvalResult restore

**Location:** `public/app.js` line 7277
**Original report:** `loadCirclesSessionFromHistory` NSM path did not restore `AppState.nsmEvalResult = item.scores_json`, causing all 5 dim scores to fall back to 1/5.
**Current state:** Line 7277 already contains `AppState.nsmEvalResult = item.scores_json || null`. Fix was applied in a prior session. Covered by `tests/visual/nsm-step4-restore-scores.spec.js` (pass).
**Status:** ALREADY FIXED — no action needed in this bundle.

---

### DRIFT-S4-3 — 🟡 COSMETIC/LAYOUT: nsm-body clamped to 720px at tablet

**Location:** `public/style.css` line 226 (pre-fix)
**Mockup contract:** Mockup 14 `.nsm-body` CSS (line 157-158): base `max-width: 920px`, no 720px cap at tablet, `max-width: 1180px` at ≥1024px. Also: `flex: 1; display: flex; flex-direction: column; gap: var(--s-4)`.
**Production behavior:** Shared `.nsm-body` rule (Step 1/2/3) sets `max-width: 720px` at ≥768px, overriding Step 4. This squeezes the 3-col comparison grid and 2-col overview layout at tablet, making cards narrow and text overflow.
**Fix:** Added scoped override `[data-nsm-step4] .nsm-body` in `public/style.css` after the Step 4 section: `max-width: 920px` (base + tablet), `max-width: 1180px` (≥1024px), `display: flex; flex-direction: column; flex: 1; gap: var(--s-4)`.
**Scope safety:** Override is scoped to `[data-nsm-step4]` only — Step 1/2/3 `.nsm-body` unaffected.
**Status:** FIXED

---

## Phase B: Fixes Applied

| Drift | File | Change |
|---|---|---|
| DRIFT-S4-1 | `public/app.js` line 2244 | Remove `+ renderNSMProgress(4)` from renderNSMStep4 |
| DRIFT-S4-3 | `public/style.css` after line 3138 | Add `[data-nsm-step4] .nsm-body` scoped override |

---

## TDD Results

**RED → GREEN spec:** `tests/visual/nsm-step4-drift-fix.spec.js`
- DRIFT-S4-1 group: 4 tests (0 → 4 pass)
- DRIFT-S4-3 group: 2 tests (0 → 2 pass)
- Regression group: 5 tests (5 pass pre-fix, 5 pass post-fix)
- **Total: 11/11 GREEN** (Desktop-1280)

**Existing spec regression:**
- `tests/visual/nsm-step-4.spec.js`: 29/29 pass (Desktop-1280)
- `tests/visual/nsm-step4-restore-scores.spec.js`: 1/1 pass (Desktop-1280)
- `jest`: 162/162 pass

---

## Director PNG Read — 4 tabs × 3 viewports

**A 總覽 · desktop-1280:**
- navbar (PM Drill logo + CIRCLES/北極星指標 tabs + home icon) ✅
- nsm-nav: arrow-left + NSM 報告 + Spotify · Spotify Podcast ✅ (NO nsm-progress above — DRIFT-S4-1 confirmed fixed)
- nsm-summary: Italic 80 navy / 100 + Spotify · Spotify Podcast / 創造力型 · 模擬完成 (right-aligned) ✅
- tab-bar 4 tabs: 總覽 active (navy underline) ✅
- 2-col layout: left 380px radar panel + right 1fr score-rows panel ✅
- 5-axis pentagon navy polygon + 5 labels ✅
- 5 score rows with grade-based color (4/5 high success / 5/5 high success / 3/5 mid navy) ✅
- Each row has comment text ✅

**A 總覽 · mobile-360:**
- NO nsm-progress stepper ✅
- nsm-nav visible, nsm-summary 80/100 ✅
- 1-col stack: radar then score rows ✅

**B 對比 · tablet-768:**
- nsm-compare--grid 3-col (label / 你的拆解 / 教練版本 點擊看思路) ✅
- Width is correct — NOT squeezed to 720px (DRIFT-S4-3 confirmed fixed) ✅
- 5 rows: NSM 北極星指標 / 創造廣度 / 成果品質 / 採用廣度 / 商業轉化 ✅
- 你的 cards (user text) and 教練版 cards (coach text) side by side ✅

**D 完成 · desktop-1280:**
- nsm-nav: NSM 報告 + Spotify · Spotify Podcast ✅
- nsm-summary 80/100 ✅
- tab-bar 完成 active ✅
- done-panel: success-lt circle + ph-check-circle icon + 完成這次 NSM 訓練 ✅
- Body: 本次得分 80 分，距離滿分還差 20 分；5/5 個維度達標 ✅
- Buttons: 回首頁 (ghost) + 再練一題 (navy primary) ✅
- done-secondary tip card: NSM 練習小技巧 + 3 bullets ✅

---

## Non-blocking observations

1. **Product type shows 創造力型 instead of 注意力型** — DRIFT-14-1 carried forward (pre-existing). fixture q-spotify maps to creator type in production, mockup shows attention type. Production is correct for actual data, fixture-only issue.
2. **nsm-nav__sub on mobile shows company only (Spotify)**, tablet+ shows company · product — matches production responsive logic correctly per mockup 14 lines 601/711/801.
3. **Tablet comparison tab**: 4 dim labels use product-type-specific names (creator: 創造廣度/成果品質/採用廣度/商業轉化) vs mockup attention type (觸及廣度/互動深度/習慣頻率/留存驅力) — expected per dynamic `getNsmDimConfig(ptype)` logic. Non-blocking fixture/type mismatch.

---

## Karpathy Self-Audit

- §1 Think Before: surfaced all drifts before fixing — found DRIFT-S4-2 already fixed (honest)
- §2 Simplicity: DRIFT-S4-1 = 1 line deletion; DRIFT-S4-3 = scoped CSS block (no global change)
- §3 Surgical: only `renderNSMStep4` + `[data-nsm-step4] .nsm-body` CSS touched — Steps 1/2/3 unaffected
- §4 Goal-Driven: RED tests per drift, GREEN per drift, all 4 tabs verified in regression group
