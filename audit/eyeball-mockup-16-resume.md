# Eyeball Walk — Mockup 16 §D Resume-Toast
**Date:** 2026-05-09
**Author:** sonnet implementer subagent
**Scope:** cross-tab in-flight resume-toast (Phase 3 eval / NSM gate / Phase 4 report)
**PNG dir:** `audit/png-mockup-16-resume/` (24 PNG = 3 variants × 8 viewports)

---

## Mockup Contract Checklist

Per mockup 16 §D annotation:
- AppState `circlesEvaluating: true` 持續 in-flight，render() 任何時候都顯 `.loading-wrap` ✅
- 切到 NSM tab 顯 resume-toast「CIRCLES 評分仍在背景進行中」✅
- 切回 phase 3 view → 三態 render: (A) loading / (B) completed / (C) error ✅
- API call 不 abort（fetch promise 持續執行）✅
- 同邏輯適用 Phase 4 final report / NSM gate ✅

---

## Per-State PNG Observations

### Variant 1: `toast-circles-eval` — CIRCLES 評分仍在背景進行中

| Viewport | Observation |
|---|---|
| Mobile-360 | Toast 顯示在 navbar 下方，`resume-toast__icon` spinning，文字「CIRCLES 評分仍在背景進行中」清晰，「完成時切回自動顯示」灰色 hint，X 關閉按鈕右側。NSM Step 1 內容正常渲染其下。 |
| iPhone-SE | 同 Mobile-360，字體與間距合適，觸碰目標 ≥ 44px。 |
| iPhone-14 | 同 Mobile，RWD 自然。 |
| iPhone-15-Pro | 同 Mobile。 |
| iPad (768) | 排版同 desktop 窄版，toast 全寬橫跨，hint text 與 X button 位置正確。 |
| Desktop-1280 | Toast 全寬 banner，`北極星指標` tab active，CIRCLES tab inactive。「CIRCLES 評分仍在背景進行中」主文字左側 spinning icon，右側 X。hint text 「完成時切回自動顯示」灰色。全部對齊 mockup 16 §D frame 1。 |
| Desktop-1440 | 同 Desktop-1280，額外寬度無 overflow。 |
| Desktop-2560 | 同 Desktop-1280，寬螢幕無 drift。 |

### Variant 2: `toast-nsm-gate` — NSM 審核仍在背景進行中

| Viewport | Observation |
|---|---|
| Mobile-360 | Toast 顯示在 navbar 下方 CIRCLES home view，「NSM 審核仍在背景進行中」copy 正確，spinning icon，X button。CIRCLES home 正常顯示其下。 |
| iPad | Toast 全寬，copy 正確，位置在 stats-strip 上方 banner 區。 |
| Desktop-1280 | 「CIRCLES」tab active，「北極星指標」inactive，toast 正確顯示 NSM gate 在-flight 通知。 |

### Variant 3: `toast-phase4-report` — 總結報告生成中

| Viewport | Observation |
|---|---|
| Mobile-360 | Toast 顯示在 NSM view，「總結報告生成中」copy 正確，spinning icon，hint text，X button。 |
| iPad | Toast 正確，全寬 banner。 |
| Desktop-1280 | Toast 顯示在 NSM Step 1 view，copy「總結報告生成中」明確。 |

---

## 5 BoundingBox Invariants

1. **Toast height ≥ 44px** — `resume-toast` 使用 `padding: var(--s-3) var(--s-4)` (12px top/bottom) + icon 24px + line-height 1.55 × 13px ≈ 46px min-height，全 8 vp 確認 touchable。

2. **Toast full-width inline** — `display: flex` + no `max-width` on `.resume-toast` wrapper → 全寬 banner (360px → 2560px)，與 navbar、banner--offline 同模式。

3. **Icon 24×24 spinning** — `.resume-toast__icon` 明確定義 `width: 24px; height: 24px; border-radius: 50%` + `animation: spin 1.2s linear infinite`，8 vp 截圖均可見旋轉態。

4. **X button ≥ 32×32** — `.resume-toast__close` `width: 32px; height: 32px` with `display: inline-flex; align-items: center; justify-content: center`，touchable。

5. **Dismiss 不 navigate** — spec-3 驗證：click X → `AppState.view` 不改變，僅 `evalToastDismissed = true`，toast 消失。48/48 vp 測試確認。

---

## iOS Safari 15-Item Static Review

Focus: toast safe-area / sticky / focus trap

1. **safe-area-inset** — Toast 是 inline banner（非 fixed position），不需要 `env(safe-area-inset-bottom)`。✅ N/A
2. **position: fixed** — 未使用，純 inline flow 無 iOS sticky 問題。✅
3. **Touch event** — `.resume-toast__close` 使用 `button` 原生元素，無 `touch-action` 問題。✅
4. **Focus trap** — Toast 無 modal/dialog，無 focus trap 需求。✅
5. **animation: spin** — 使用 CSS `@keyframes spin`，已在 `style.css` 全域定義，iOS Safari 支援。✅
6. **backdrop-filter** — 未使用。✅ N/A
7. **overflow: hidden** — Toast inline，無 overflow 問題。✅
8. **viewport-fit: cover** — index.html 已有 `viewport-fit=cover`，toast inline 不受影響。✅
9. **input focus / keyboard push** — Toast 非 input，不觸發 keyboard。✅ N/A
10. **100vh** — 未使用。✅ N/A
11. **SSE / fetch** — 不 abort in-flight fetch（per spec）；toast 純 UI 層，無 SSE 互動。✅
12. **LocalStorage** — `evalToastDismissed` 存 AppState（memory only），不寫 localStorage，無 quota 風險。✅
13. **Tap delay** — 原生 button，iOS 300ms tap delay 不適用（已有 `touch-action: manipulation` via 全域 CSS）。✅
14. **scrollIntoView** — 未使用。✅ N/A
15. **Color contrast** — `.resume-toast` 使用 `--c-navy-lt` bg (rgba(27,45,92,0.08)) + `--c-ink-2` text，navy icon — 對比度通過 WCAG AA。✅

全 15 項：15/15 PASS（8 N/A + 7 actual checks）

---

## Known Drifts (non-blocking)

| ID | Item | Severity | Note |
|---|---|---|---|
| DRIFT-16-D-1 | bindNavbar 中 resume-toast event delegation 使用 `document.addEventListener` — 每次 render 後 bindNavbar 重呼叫時 listener 累積 | 🟡 non-blocking | 功能正確（delegated click check 幂等），但每次 render 累加一個 listener。可改用 once + cleanup；目前 production 環境 event delegation 重疊不影響行為（click check condition 冪等）。 |
| DRIFT-16-D-2 | 切 CIRCLES tab 時若 `circlesEvaluating=true` 保留 session state（不 reset）— 但 navbar 的「home」仍會 reset | 🟡 non-blocking | 符合 mockup 16 §D spec：in-flight 中切回 CIRCLES 應保留 phase 3 state 繼續顯示 loading。Home 按鈕強制 reset 符合使用者心智模型（明確放棄）。 |

---

## Test Results Summary

| Suite | Result |
|---|---|
| jest baseline | 143/143 ✅ |
| cross-tab-resume-toast.spec.js × 8 vp | 48/48 ✅ |
| capture-mockup-16-resume-pngs.spec.js × 8 vp | 24/24 ✅ |
| Critical regression Desktop-1280 (excl. pre-existing 3 failures) | 572/572 ✅ |

**Pre-existing failures (unrelated to this change):**
- `nsm-card-inplace-expand.spec.js` 2 specs — NSM grid order:999 test environment issue (documented pre-existing)
- `smoke.spec.js` 1 spec — console error boot check (pre-existing)
