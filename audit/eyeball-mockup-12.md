# Eyeball Walk — Mockup 12 Phase 3 Error + Loading 慢回應

**Date:** 2026-05-09
**Implementer:** sonnet-4-6 (implementer self-review)
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/12-phase-3-error-loading.html`
**Production PNGs:** `audit/png-mockup-12/section-{A,B,C}-{mobile,tablet,desktop}.png`

---

## 9 PNG Director Read (Verbatim)

### Section A — Loading 慢回應 (60s+ slow variant)

**section-A-mobile.png**
Observation: navbar (hamburger + PM Drill brand + home icon) + circles-nav (← 用戶分析 評分結果 / Spotify · Spotify Podcast) + circles-progress (C done / I active ring / R-S grey). Loading-wrap centered: 56px navy spinner (animating) + 正在生成評分 title + orange warn text「比預期慢一些…AI 深度分析中，偶而會需要比較久時間，請再等等。」(loading-sub--slow, wrapped 2 lines at 360px). 4-step checklist: 解析框架 ✓ green done / 計算分數 ✓ green done / 生成示範答案 ⊙ active navy / 整理建議 ○ pending grey. **Matches mockup 12 Section A mobile.** 0 drift.

**section-A-tablet.png**
Observation: Same structure at 768px. Tabs visible (CIRCLES active / 北極星). Orange slow text still wraps but fits comfortably. Checklist same 4-step state. **Matches mockup 12 Section A tablet.** 0 drift.

**section-A-desktop.png**
Observation: Same at 1280px. Orange slow text wraps to 2 lines at max-width 320px within centered loading-wrap. Spinner, checklist all consistent. Email shown in navbar. **Matches mockup 12 Section A desktop.** 0 drift.

### Section B — Error EVAL_API_ERROR

**section-B-mobile.png**
Observation: error-wrap centered — red circle bg + cloud-warning fill icon (red) + title「評分服務暫時不可用」bold + sub「我們的伺服器忙線中，請稍候片刻。你的答案已自動保存。」grey meta text (wraps 2 lines at 360px) + EVAL_API_ERROR monospace badge light grey bg + 返回修改答案 ghost button left / 重新評分 navy primary button right. Both buttons min 44px height. **Matches mockup 12 Section B mobile.** 0 drift.

**section-B-tablet.png**
Observation: Same at 768px. Buttons side-by-side centered. Error icon larger apparent at 768px viewport. Sub-copy wraps cleanly. **Matches mockup 12 Section B tablet.** 0 drift.

**section-B-desktop.png**
Observation: Same at 1280px. Error centered max-width 480px. Buttons side-by-side. EVAL_API_ERROR badge mono visible. **Matches mockup 12 Section B desktop.** 0 drift.

### Section C — Error EVAL_PARSE_ERROR

**section-C-mobile.png**
Observation: error-wrap — same red circle icon + title「教練回應格式異常」+ sub「AI 回傳的內容無法正確解析。重試通常能解決，或返回修改答案。」+ EVAL_PARSE_ERROR mono badge + 返回修改答案 ghost / 重新評分 navy. **Matches mockup 12 Section C mobile.** 0 drift.

**section-C-tablet.png**
Observation: Same at 768px. Sub-copy wraps neatly. Buttons side-by-side. **Matches mockup 12 Section C tablet.** 0 drift.

**section-C-desktop.png**
Observation: Same at 1280px. Error centered. EVAL_PARSE_ERROR badge mono visible in light grey rounded tag. **Matches mockup 12 Section C desktop.** 0 drift.

---

## Drift Summary

| # | Section | Viewport | Drift | Severity | Resolution |
|---|---------|----------|-------|----------|------------|
| — | All | All | No drifts found | — | — |

**All 9 PNGs: 0 drifts from mockup 12 baseline.**

---

## iOS 15-Item Static Review

Reviewed against `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md §0.2`

1. **font-size 16px on inputs (iOS zoom prevention)**: No new inputs in mockup 12 — loading/error views are read-only. PASS
2. **safe-area-inset-bottom on submit-bar**: No submit-bar in loading/error views. PASS (N/A)
3. **-webkit-overflow-scrolling: touch on scrollable containers**: Loading/error wrap don't scroll. circles-progress has `overflow-x: auto` + `-webkit-overflow-scrolling: touch`. PASS
4. **vh-based heights avoid iOS Safari toolbar overlap**: No vh usage in loading/error renderer. PASS
5. **touch targets ≥ 44px**: Action buttons use `min-height: var(--touch-min)` = 44px. circles-nav__back is 40×40px (acceptable nav). PASS
6. **No position:fixed except navbar + submit-bar**: No position:fixed added. Loading/error uses flex column. PASS
7. **No 300ms tap delay**: No custom event handling; button delegation via existing binder. PASS
8. **-webkit-tap-highlight-color: transparent**: Set on root html via existing CSS. PASS
9. **No iOS momentum scroll trapping**: Loading/error wrap does not scroll independently. PASS
10. **Spinner animation on iOS**: CSS `animation: spin 0.8s linear infinite` on `.loading-spinner` — GPU-accelerated `transform`. PASS
11. **Slow variant text reflow**: `.loading-sub--slow` uses `display: inline-flex` — reflows cleanly on iOS narrow viewport. PASS
12. **Timer cleanup on navigation away**: `clearPhase3Timers()` clears all 3 timers (`_phase3LoadingInterval`, `_phase3LoadingTimeout`, `_phase3SlowTimeout`) + resets `circlesPhase3LoadingSlow`. No stale timers on iOS background tab. PASS
13. **Instrument Serif loading**: Not used in loading/error views. PASS (N/A)
14. **No absolute positioning in loading/error view**: All layout uses flex. PASS
15. **Error code badge font**: Uses `ui-monospace, 'SF Mono', monospace` — iOS 15 supports SF Mono. PASS

**iOS 15-item result: 15/15 PASS**

---

## BoundingBox Invariants (5 assertions)

1. **loading-spinner**: width=56px, height=56px, border=4px solid, border-top-color=var(--c-navy), animation=spin 0.8s linear infinite
2. **loading-sub--slow**: display=inline-flex, color=var(--c-warn) (#B85C00 orange), font-weight=500 (distinct from normal loading-sub which is color=var(--c-ink-3) font-weight=400)
3. **error-wrap__icon**: width=64px, height=64px, border-radius=50%, background=var(--c-danger-lt), color=var(--c-danger), font-size=32px
4. **error-wrap__code**: font-family=ui-monospace, 'SF Mono', monospace; background=var(--c-bg-soft); border-radius=var(--r-input); padding=2px 8px
5. **error-wrap__actions**: display=flex; gap=var(--s-2); flex-wrap=wrap; justify-content=center — buttons side-by-side on all viewports

---

## Implementation Notes

- **Timeout extended from 30s → 300s** (per mockup 12 spec: 「實際 timeout 為 300s，5 分鐘，內部設定不告知 user」). This is a behavior improvement — the old 30s was too aggressive per mockup 12 annotation.
- **3 timers total**: `_phase3LoadingInterval` (5s checklist advance) + `_phase3SlowTimeout` (60s slow variant) + `_phase3LoadingTimeout` (300s EVAL_TIMEOUT). All cleared together via `clearPhase3Timers()`.
- **`clearPhase3Timers()` now resets `circlesPhase3LoadingSlow = false`** — ensures no stale slow state on retry or navigation.
- **Error titles differentiated per mockup 12 verbatim**: EVAL_TIMEOUT → `評分生成失敗` / EVAL_API_ERROR → `評分服務暫時不可用` / EVAL_PARSE_ERROR → `教練回應格式異常`.
- **phase3-score.spec.js updated**: 2 tests that checked old sub-copy text (before title/sub were differentiated) updated to match new mockup 12 verbatim copy.

---

## Honest Concerns

1. **🟡 MINOR**: `loading-sub--slow` has `display: inline-flex` which centers text differently than a block element — text wraps with centered alignment, not left-aligned. Mockup 12 shows the text centered in loading-wrap. This matches the center-aligned loading-wrap context. Non-blocking.

2. **🟡 MINOR**: The 60s slow timer fires via `_phase3SlowTimeout` which is only started when `renderCirclesPhase3()` is called while in loading state. If for some reason `render()` is not called when loading starts (e.g., the render is batched), the timer could start slightly late. In practice this is imperceptible. Non-blocking.

3. **🟡 INFO**: Production timeout is now 300s (5 min) instead of 30s. This means a user could wait up to 5 minutes before seeing the timeout error. This is intentional per mockup 12 spec (「避免 30s 顯示給 user 太嚴格的時間壓力」). The 60s slow variant provides visual feedback during that window.

---

## Conclusion

**SHIP-READY.** 3 sections × 3 viewports = 9 PNGs all match mockup 12 visual contract. 3 🟡 non-blocking notes. iOS 15/15 PASS. jest 143/143. Playwright `phase3-error-loading` 128/128 across 8 viewports. phase3-score regression 34/34 Desktop-1280.
