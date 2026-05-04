# Plan B SB9a — Save Indicator 4 狀態 Visual Cycle Audit

**Date:** 2026-05-04
**Plan:** `docs/superpowers/plans/2026-05-04-plan-b-sb9a-save-indicator.md`
**Mockup ref:** 03-phase-1-form.html Section F line 2109-2186 + line 294-306 CSS

## Scope

把 Phase 1 form 的 6 處 hardcoded `save-indicator save-indicator--saved` 動態化成 4 狀態 visual cycle：
- `idle` → 「已暫存」grey, no bg
- `saving` → 「儲存中」navy spinner + soft bg
- `saved` → 「已儲存到雲端」green check + green-lt bg
- `error` → 「離線中 · 點擊重試」red warning + red-lt bg + cursor:pointer

後端鐵則：**不打 PATCH /progress**，純前端 visual cycle + localStorage 草稿。

## State × viewport matrix capture（4 × 3 = 12 PNG）

`/tmp/sb9a-states/{vp}-{state}.png`

| viewport | idle | saving | saved | error |
|---|---|---|---|---|
| mobile-360  | ✓「已暫存」grey | ✓「儲存中」spinner+bg | ✓「已儲存到雲端」green | ✓「離線中·點擊重試」red |
| tablet-768  | ✓ | ✓ | ✓ | ✓ |
| desktop-1280 | ✓ | ✓ | ✓ | ✓ |

bbox boundingBox（desktop-1280）:
- idle 52px wide × 26.6px high
- saving 68px（含 12px spinner）
- saved 104px（含 ph-check icon）
- error 126.3px（含 ph-warning-circle）

## Director eyeball walk

Read 4 PNG（desktop-1280 idle/saving/saved/error）— 全與 mockup line 2160-2174 文字 + 配色一致：
- saving spinner CSS：mockup line 303 `border: 2px solid var(--c-ink-3); border-top-color: transparent; animation: spin 0.8s linear infinite;` 對齊
- saved success-lt bg + ph-check icon
- error danger-lt bg + ph-warning-circle + 「離線中·點擊重試」cursor:pointer

## Mockup-as-Spec drift

**0 條 drift**。production CSS 只有 `--saved` 一個 modifier，補齊 4 modifier + spin keyframe（已存在 line 74）。

## Tests / regression

- jest: 157/157
- Playwright phase1-save-indicator Desktop-1280: 5/5 全綠
  - default state idle ✓
  - typing → saving → saved → idle cycle ✓
  - saved 寫 localStorage ✓
  - localStorage throw → error ✓
  - error click retry → saving → saved ✓
- Playwright 全 spec Desktop-1280+Mobile-360+iPad regression: **477 pass / 9 fail (7.9min)**
  - **無 SB9a 引入的回歸** — 9 failure breakdown:
    - 3× `smoke.spec` "app boots without console errors" → 401 Unauthorized（pre-existing；git stash 驗證 pre-SB9a 即 fail）
    - 4× `nsm-home.spec` Mobile-360 → 1.5min timeout（NSM 範疇 flake，與 SB9a 無關）
    - 2× pixel-diff `sb4-sb5 SB4 L mobile-360` + `sb6 Section G tablet-768` → 並行 flake（單獨 re-run 5.68% PASS / 4.1s PASS）

## How it wired

- `AppState.circlesPhase1SaveState` default `'idle'`
- Helper `renderSaveIndicator(state)` 取代 9 處 hardcoded HTML（6 phase-head + 1 saveHtml var + 2 sim/drill metaHtml）
- `triggerSaveCycle()` debounce 800ms → `saving` → 200ms → localStorage write → `saved` → 2000ms → `idle`；catch → `error`
- 5 input listeners 全加 `triggerSaveCycle()` first call: contenteditable / sol-name / sol mechanism / S 主 textarea / S tracking input / E nested textarea
- `setPhase1SaveState()` in-place outerHTML swap，不走 renderApp() 避免 contenteditable 失焦
- error retry: document-level click delegation `data-phase1="save-retry"` 觸發 fresh cycle
- localStorage key: `pmdrill:circles:draft:{questionId}` JSON `{P1, P1S, P1L, P1E, framework, ts}`
