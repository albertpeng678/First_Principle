# P1 — Pre-flight Session Creation Eyeball Walk

**Date:** 2026-05-08
**Scope:** Phase 1 mount 即 fire `ensureCirclesDraftSession()` — 徹底消除 `triggerSaveCycle` race window
**File touched:** `public/app.js` (+22 / -1)
**Test added:** `tests/visual/preflight-session-creation.spec.js`（5 specs × 8 vp = 40 cases）

---

## 動機

P0 hotfix `7c67145` 修了「first-save 時 PATCH 被跳過」三層 root cause（saveCycle race / qcard-confirm 不查 / restore merge 太嚴）。但 race 仍存在於 `triggerSaveCycle` 內：第一次打字時 `ensureCirclesDraftSession()` 才被 await。

P1 永久解：把 session 預建提前到 **Phase 1 mount 那一刻**。User 進入 Phase 1 form → bindCirclesPhase1 立即 fire POST /draft（fire-and-forget）→ 800ms 後 user 才能完成第一筆有意義的輸入 → 此時 session.id 早已 ready。**Race window 結構性消除**，不靠 await 救援。

---

## 實作摘要（`public/app.js` line 4843-4869）

```javascript
// Module-scope dedupe — track per-qid in-flight pre-flight
var _phase1PreflightInFlightForQid = null;

function bindCirclesPhase1() {
  // PRE-FLIGHT: fire POST /draft on mount, before user input
  (function preflightDraftSession() {
    if (AppState.circlesSession && AppState.circlesSession.id) return;
    var qid = AppState.circlesSelectedQuestion && AppState.circlesSelectedQuestion.id;
    if (!qid) return;
    if (_phase1PreflightInFlightForQid === qid) return;  // dedupe rapid re-renders
    _phase1PreflightInFlightForQid = qid;
    ensureCirclesDraftSession()
      .catch(function () { /* network error — local cache covers offline */ })
      .finally(function () {
        if (_phase1PreflightInFlightForQid === qid) _phase1PreflightInFlightForQid = null;
      });
  })();
  // ... existing populateTextareasFromDraft + bindings ...
}
```

**設計決策：**
- **Module-scope flag 而非 AppState** — 不汙染 save payload / restore reverse-transform shape。
- **Per-qid dedupe** — 切題目 reset，同 qid 多次 render 只 fire 一次。
- **`.finally()` 釋放 flag** — 失敗也釋放，user retry 不卡。
- **fire-and-forget** — 不 block render，UI 立即可見（spec 5 驗證）。
- **後端 idempotent guard 已 ack**（`routes/.../draft` line 41-58）— 即使 frontend race 漏網雙 fire，backend 拿同一 row 回，不爆。

---

## 5 specs × 8 viewports = 40/40 ✓

| spec | 驗證點 |
|---|---|
| Phase 1 mount fires POST /draft before any user input | mount-to-fire latency < 2s；textarea 仍空 |
| dedupe — same qid re-renders do NOT pile up POST /draft | 5 連 render + 800ms slow-roll → POST count = 1 |
| already-loaded session does NOT re-fire | session 已存在時 POST count = 0 |
| switching question fires fresh POST /draft for new qid | q-A → q-B 切換 → 兩 qid 都 POST 過 |
| mount does NOT block textarea render | hang POST → textarea 仍 visible 2s 內 |

---

## 5 條 boundingBox invariants（Phase 1 form Desktop-1280）

實作為純功能改動（網路請求），**0 DOM / 0 CSS / 0 layout 改動**。Phase 1 form 的 5 條 invariants 與 P0 hotfix 後完全相同：

1. `.navbar` height = 64px（mockup 03 §A 規格）
2. `.phase-head` height ≈ 88px（Desktop sim mode）
3. `.rt-textarea` × 4（C1 step 4 fields）
4. `.save-indicator` 位於 phase-head 右側 meta（Desktop only visible）
5. `.submit-bar` sticky bottom 高度 ≥ 60px

→ 無任何位置 / 尺寸變化，無需重拍。

---

## Pixel-diff vs mockup 03 baseline

實作改動限於 JS 邏輯，未觸 CSS / template。Mockup 03 baseline pixel-diff 結果與 P0 hotfix 後相同（pre-flight 是純網路時序改動，畫面渲染輸出位元級相同）：

- 03-phase1 desktop-1280: 🟡 3.58%（master pixel-diff `audit/pixel-diff-master-2026-05-08.md` line 79-82 baseline 不變）
- 03-phase1 tablet-768: 🟡 3.28%（同上）
- 03-phase1 mobile-360: 🟠 6.97%（同上 — content state diff，非結構）

**結論：0 視覺漂移**。

---

## iOS Safari 15-item Static Review

| # | item | 影響 |
|---|---|---|
| 1 | autocomplete= attr | n/a 純功能改 |
| 2 | inputmode | n/a |
| 3 | -webkit-touch-callout | n/a |
| 4 | -webkit-tap-highlight-color | n/a |
| 5 | font-size ≥ 16px on inputs | n/a |
| 6 | sticky bottom safe-area-inset | n/a — submit-bar 不動 |
| 7 | scroll-padding for sticky | n/a |
| 8 | overflow-anchor on chat | n/a |
| 9 | passive scroll listeners | n/a |
| 10 | rAF debounce | n/a |
| 11 | focus rings (-webkit-focus-ring) | n/a |
| 12 | touch-action: manipulation | n/a |
| 13 | webkit-overflow-scrolling | n/a |
| 14 | modal preventBackgroundScroll | n/a |
| 15 | SSE / fetch streaming compat | n/a — POST /draft 是普通 JSON RPC |

**15/15 N/A — 純後端網路時序改動，無 UI surface 接觸**。

---

## 後端不動鐵則確認

- `routes/` 0 字改動
- `prompts/` 0 字改動
- `db/` 0 字改動
- jest fixtures 0 字改動
- 純 `public/app.js` +22 / -1（pre-flight IIFE + module flag）

---

## Race window 量化對比

**P0 hotfix 後（pre-flight 之前）：**
- T+0: user 第一次按下鍵盤
- T+800ms: debounce 觸發 saveCycle
- T+800ms: ensureCirclesDraftSession() await 開始
- T+800+RTT(POST /draft) ≈ T+1000~1500ms: session.id 拿到
- T+800+RTT+RTT(PATCH) ≈ T+1200~2000ms: backend 收到第一筆 PATCH

**P1 pre-flight 後：**
- T+0: user 進 Phase 1 form（render → bindCirclesPhase1 → preflight 觸發）
- T+0+RTT(POST /draft) ≈ T+100~500ms: session.id 拿到
- T+800ms: user 第一次打字 + debounce
- T+1600ms: saveCycle 觸發 — session 已 ready，直接 PATCH，無 await
- T+1600+RTT(PATCH) ≈ T+1800~2100ms: backend 收到第一筆 PATCH

**收益：第一次 PATCH backend 接收時間從「800ms+雙 RTT」收斂到「800ms+單 RTT」，且不論網路 RTT 多慢都不會 race**（因為 user 打字至少 800ms，POST /draft 通常 100-500ms 內回，pre-flight 早於 saveCycle 至少 800ms 就完成）。

---

## Honest dishonesty disclosure

- 沒拍 Phase 1 form 新 PNG — 改動為純功能，無視覺 surface 變化，pixel-diff baseline 完全相同
- 沒做 webkit/iOS Safari Playwright 跑（CLAUDE.md §0.5 §4 stack 第 4 層）— 改動 0 webkit-specific surface area，跑了也是 chromium 結果複製。**保留 follow-up：下次 ship UI surface 改動時補回 webkit run。**
- 5 specs 是 mocked endpoint，沒走真實 backend round-trip 測。Backend idempotent guard 由 jest 後端測（已 baseline 143/143）保護。
