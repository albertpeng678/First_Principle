# Eyeball Walk — Mockup 08 NSM Gate Inline

**Date:** 2026-05-09
**Branch:** `main`
**Commit:** (pending — this document written pre-commit)
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/08-nsm-step-3-gate.html`
**PNGs:** `audit/png-mockup-08/` — 32 PNGs (4 states × 8 viewports)

---

## Test gates

- jest: **143 passed / 17 skipped / 0 fail** (baseline unchanged)
- Playwright `nsm-gate-inline.spec.js`: **144/144** (18 specs × 8 viewports)
- Playwright `nsm-step-2-3.spec.js` + `nsm-home.spec.js`: **18/18** Desktop-1280 (NSM regression)
- Race regression: **13/13** Desktop-1280
- PNG capture: **32/32** (4 sections × 8 viewports)

---

## PNGs Read by implementer (cross-viewport)

| State | Viewport | Verdict |
|---|---|---|
| gate-ok | Desktop-1280 | ✓ green check-circle banner「NSM 定義通過審核」4/4 條件達標 · gate-summary 公司 + NSM · 4 ok items (全綠勾) · 繼續到 步驟 3 primary + 上一步 ghost |
| gate-error | Desktop-1280 | ✓ red x-circle banner「需要修正方向」2 項根本性問題 · gate-summary · 4 items (2 red + 1 warn + 1 ok) · 只有「上一步修改」一顆 primary 無任何繼續按鈕 |
| gate-loading | Desktop-1280 | ✓ navy spinner centered + 「AI 正在審核你的 NSM 定義」+ 4-step checklist (step1 done ✓ navy / step2 active 旋轉 circle-notch / step3+4 pending circle) · 無 submit-bar |
| gate-warn | Mobile-360 | ✓ warn check-circle banner「通過審核（附提醒）」3/4 達標 1 項可優化 · 1 warn item 黃框 + 建議框可見 · 「繼續到 步驟 3」primary + 上一步 ghost |
| gate-error | Mobile-360 | ✓ 「需要修正方向」· 2 error red + 修正方向 red box · 只有「上一步修改」primary 浮在底部 · 步驟 3 sub-tab greyed-out |
| gate-ok | Mobile-360 | ✓ 全 4 綠勾 items · 「繼續到 步驟 3」primary visible at bottom |
| gate-loading | Mobile-360 | ✓ centered spinner + checklist 4-step 正確階段狀態 |
| gate-error | iPad (768) | ✓ 2 error red cards + 修正方向 red suggestion box 寬版顯示完整 · 只有「上一步修改」primary |

---

## Critical rule verified — Red = 必擋

**Mockup contract (mockup 08 §C annotation):** 任一紅 item = 「返回修改」**唯一動作**，無「帶風險繼續」，無 simulation override，drill 與 simulation 行為一致（Master Spec § 2.4）。

**Production verification (gate-error-Mobile-360 + gate-error-Desktop-1280 + gate-error-iPad):**
- Submit-bar 含唯一「上一步修改」primary button (left-arrow icon)
- 步驟 3 sub-tab `disabled` greyed-out 全3 viewport
- 無任何「繼續」/ 「帶風險繼續」/ ghost 第二按鈕
- 紅色 gate-transition--error banner 清楚標示「需要修正方向」
- 確認符合 Phase 1.5 Gate 同等規格 ✓

---

## 5 boundingBox invariants

1. `.phase-head__num` contains `2.5` (not `2`) in all gate states — confirmed gate phase number correct
2. `.nsm-sub-tab.is-active` contains `NSM 審核` — confirmed active tab correct in gate state
3. `.gate-transition` exists exactly once per gate result state — no duplicate banners
4. Error state: `.submit-bar .btn` count = 1 — confirmed single-button rule
5. Loading state: `.submit-bar` not visible — confirmed no navigation during load

---

## mockup ↔ production alignment

| Section | mockup contract | production | verdict |
|---|---|---|---|
| A ok banner | `gate-transition--ok` 綠勾 + 「NSM 定義通過審核」+ sub 4/4 條件達標 | ✓ exact match | PASS |
| A ok items | 4 items all gate-item--ok green check-circle | ✓ exact match | PASS |
| A ok CTA | 上一步 ghost + 繼續到 步驟 3 primary | ✓ exact match | PASS |
| B warn banner | `gate-transition--warn` 綠勾 + 「通過審核（附提醒）」| ✓ exact match | PASS |
| B warn item | 1 gate-item--warn yellow + suggestion box visible | ✓ exact match | PASS |
| B warn CTA | 繼續到 步驟 3 primary | ✓ exact match | PASS |
| C error banner | `gate-transition--error` 紅 X + 「需要修正方向」 | ✓ exact match | PASS |
| C error items | 2 gate-item--error red + 修正方向 box | ✓ exact match | PASS |
| C error CTA | 唯一「上一步修改」primary 無 ghost 無繼續 | ✓ exact match | PASS |
| C error step3 | 步驟 3 sub-tab disabled | ✓ exact match | PASS |
| D loading | spinner + 「AI 正在審核你的 NSM 定義」+ 4-step checklist | ✓ exact match | PASS |
| D loading CTA | 無 submit-bar | ✓ exact match | PASS |
| gate-summary | 公司 + 你的 NSM 兩行 navy 標籤 + 內容 | ✓ exact match | PASS |

---

## Drifts vs mockup

### Non-blocking drifts (🟡)

- **DRIFT-08-1:** gate-item 無 `gate-item__title` field — 目前使用 `feedback` 直接作 reason 顯示（mockup 有 `gate-item__title` + `gate-item__reason` 兩層），但因 backend 實際 schema (`items[].feedback`, `items[].suggestion`) 無單獨 `title` 欄位，render 時 title 留空、feedback 顯示於 reason。外觀等同 mockup 兩行合一（criterion field + feedback）。**不影響功能，用戶信息完整。**
- **DRIFT-08-2:** Loading checklist 文案微差 — 實作文案「解析 NSM 語意 / 對齊產品價值 / 檢查領先性 / 評估操作性」對齊 mockup §D verbatim（mockup 用「解析 NSM 語意 / 對齊產品價值 / 檢查領先性 / 評估操作性」）— **實際對齊，非 drift。**
- **DRIFT-08-3:** Phase-head 在 gate loading/result 顯示 `2.5`（非 `2`）。Phase-head title 改為「NSM 品質審核」對齊 mockup §A-D — ✓ CORRECT。
- **DRIFT-08-4:** 後端 prompt 返回 4 items（`prompts/nsm-gate.js` 有 4 criteria），mockup 顯示 5 維度（包含「週期敏感」在頁面 HTML）。實際 backend 只有 4 criteria — frontend render 正確對齊 backend 實際返回，mockup HTML 範例多 1 項為展示用。**不 blocking — 已如實對齊後端資料。**

### Honest dishonesty disclosure

- `gate-item__title` 未在 backend response 中，目前顯示留空 + feedback 於 reason 欄位。視覺上等同 mockup 效果，但非完全 mockup-verbatim。若後端未來加 `title` 欄位可 trivially 補。
- `ph-spin` class (circle-notch spin) 在 Phosphor web icon 中可能不是 built-in spin animation，依賴 global CSS `@keyframes spin`，需確認 Phosphor CDN 版本。截圖中靜態 frame 無法驗證旋轉，但 `ph-spin` class 在之前的 mockups 04/07/11 均已驗證可用。

---

## iOS Safari 15-item static review (relevant only)

- [x] Touch targets ≥ 44px — `submit-bar .btn` min-height 44px, `gate-item` padding 16px × 20px (寬 ok)
- [x] No `position: sticky` regression — submit-bar 已有 sticky bottom + safe-area env()
- [x] No double-tap zoom on CTA buttons — font-size 14px button text, no 300ms delay issue
- [x] Loading: no focus jump — gate-loading-wrap 無 input/textarea，無 focus trap 風險
- [x] submit-bar backdrop-filter on iOS — `rgba + saturate(140%) blur(10px)` 已在 Phase 1 + Gate 04 驗證
- [x] Step3 sub-tab disabled styling — `cursor: not-allowed` + `opacity: 0.6` matches existing nsm-sub-tab[disabled] rule
- [n/a] SSE / streaming — 本 feature 無 SSE
- [n/a] Keyboard / focus / textarea — 本 gate view 無 input fields
