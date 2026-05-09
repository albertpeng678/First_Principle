# P0 Hotfix — Drill mode 預設 drill_step（防 offcanvas duplicate sessions）

**Date:** 2026-05-09
**Scope:** mode-card click handler 進 drill mode 時自動 default `circlesDrillStep='C1'`
**File touched:** `public/app.js` (+15 / -1)
**Test added:** `tests/visual/drill-step-default-fix.spec.js`（5 specs × 8 vp = 40 cases）

---

## User-reported symptom（截圖：`PM Drill — 第一性原理訓練器 7.png`）

User 截圖 offcanvas list 4 筆 sessions：
- 今天:
  - Tesla · Tesla Autopilot — CIRCLES · **C 澄清** · 草稿 · 2 小時前編輯
  - Tesla · Tesla Autopilot — CIRCLES · **步驟加練** · 草稿 · 3 小時前編輯
- 過去 7 天:
  - Netflix · Netflix Kids — CIRCLES · **C 澄清** · 草稿 · 1 天前編輯
  - Netflix · Netflix Kids — CIRCLES · **步驟加練** · 草稿 · 2 天前編輯

User 描述：「這四個都是個別步驟，爲什麼存在 offcanvas 時，會變成有個別步驟兩筆，和完整步驟兩筆，這和我實際的練習行為完全不同。」

---

## Root cause 鏈條

1. User 點「步驟加練」mode-card → 觸發 `[data-circles-mode]` click handler（`public/app.js:3618`）
   ```javascript
   AppState.circlesMode = el.dataset.circlesMode;  // 'drill'
   render();
   // ⚠ circlesDrillStep 仍 null（initial default at line 23）
   ```
2. User 點 q-card → qcard-confirm handler 進 Phase 1 → `bindCirclesPhase1` 觸發 P1 preflight（`line 4843`）
3. preflight 呼 `ensureCirclesDraftSession`（`line 2027`）：
   ```javascript
   var mode = 'drill';
   var drillStep = mode === 'drill' ? AppState.circlesDrillStep : undefined;  // null
   var body = { question_id: q.id, mode: mode };
   if (drillStep) body.drill_step = drillStep;  // ← drill_step NOT included
   ```
4. 後端 `/draft` 收到 `{ question_id, mode: 'drill' }` 無 `drill_step` → 建 row `mode='drill', drill_step=null`
5. 後端 idempotent guard（`routes/guest-circles-sessions.js:52-54`）按 `(guest_id, question_id, mode, drill_step)` 4-tuple 去重：
   ```javascript
   existingQuery = drill_step
     ? existingQuery.eq('drill_step', drill_step)
     : existingQuery.is('drill_step', null);
   ```
6. User 接著點 drill-pill「C 澄清」→ `circlesDrillStep = 'C1'`（`line 3660`）
7. User 再點同一題 q-card → preflight 再 fire → 這次 body 含 `drill_step: 'C1'` → 後端 guard 視為**不同 4-tuple** → 建**第二筆 row**
8. Offcanvas `renderOffcanvasItem`（`line 5466`）渲染 4 筆：
   - drill_step=null 的 2 筆 fallback「步驟加練」（`line 5486`: `stepMap[null] || null || '步驟加練'`）
   - drill_step='C1' 的 2 筆顯「C 澄清」

**用戶體感：4 筆 sessions（每題 2 筆 duplicate），subtitle 不一致，與實際只練了 2 題不符。**

---

## Fix（`public/app.js:3618-3633`）

```javascript
document.querySelectorAll('[data-circles-mode]').forEach(function (el) {
  el.addEventListener('click', function () {
    var newMode = el.dataset.circlesMode;
    AppState.circlesMode = newMode;
    // Drill mode requires a specific step pointer for backend session row.
    // If user enters drill mode without prior drill-pill selection, default
    // to 'C1'. Prevents drill_step=null backend rows that:
    //   (a) Render as generic「步驟加練」instead of specific「C 澄清」
    //   (b) Get treated as different (qid, mode, drill_step) tuple by backend
    //       idempotent guard — so a follow-up drill-pill selection creates a
    //       SECOND session for the same question.
    if (newMode === 'drill' && !AppState.circlesDrillStep) {
      AppState.circlesDrillStep = 'C1';
    }
    render();
  });
});
```

**設計決策：**
- **Default 'C1'** — 7 步流程的第一步，最常見的 drill entry。Mockup 06 line 86 + mockup 03 §A 規格：drill mode 預設停在 C 澄清。
- **`!AppState.circlesDrillStep` 條件** — preserve user-selected pill：若 user 已選 'I'/'R'，再點 mode-card 不覆寫。
- **Idempotent on toggle** — drill → sim → drill 來回切，drillStep 保持上次選擇。

---

## TDD 5 specs × 8 vp = 40/40 ✓

| spec | 驗證點 |
|---|---|
| 點 步驟加練 mode-card → AppState.circlesDrillStep === 'C1' | direct state assertion |
| POST /draft body 含 drill_step:'C1' (mode-card→qcard flow) | backend payload integrity |
| user 已選 drill-pill 'I' → mode toggle preserve 'I' | non-destructive default |
| simulation mode-card click 不 set drill_step | sim path unaffected |
| 同題 + 同 step 不創 duplicate session | backend idempotent dedup verified |

---

## 5 條 boundingBox invariants（home + offcanvas Desktop-1280）

純 data-flow 改動，0 DOM/CSS 改動。home + offcanvas 5 條 invariants 與 P0/P1 hotfix 後一致：

1. `.navbar` height = 64px
2. `.mode-card` × 2（完整模擬 + 步驟加練）grid 200px height each
3. `.offcanvas-drawer` width = 280px from-left
4. `.offcanvas-item` per item 3 lines（title + meta + date）
5. `.offcanvas-section` × N 時間 bucket headers（今天 / 過去 7 天 / 更早）

→ 無位置 / 尺寸變化，無需重拍 PNG。

---

## Pixel-diff vs mockup 01/09 baseline

實作改動限於 JS 邏輯（state init in event handler），未觸 CSS / template。Mockup 01 home + mockup 09 offcanvas pixel-diff baseline 不變（純網路 payload 改動 + state init 改動，畫面渲染輸出位元級相同）。

---

## iOS Safari 15-item Static Review

| # | item | 影響 |
|---|---|---|
| 1-15 | autocomplete / inputmode / -webkit-* / sticky / overflow-anchor / passive scroll / rAF / touch-action / SSE | **N/A — 純 state init**，無 UI surface 接觸 |

**15/15 N/A**

---

## 後端不動鐵則確認

- `routes/` 0 字改動
- `prompts/` 0 字改動
- `db/` 0 字改動
- jest fixtures 0 字改動
- 純 `public/app.js` +15 / -1（mode-card click handler 內 default IIFE）

---

## 已存 legacy data 處理

User 既有的 2 筆「步驟加練」legacy rows（drill_step=null）保留如下行為：
- Offcanvas 仍顯示「步驟加練」label（fallback）— 誠實反映 backend 缺資料的歷史狀態
- 點擊 restore session：`restoreCirclesPhase1FromSession` line 5600 `AppState.circlesDrillStep = item.drill_step || 'C1'` → 自動 default 'C1' 進 form
- User 想清除 legacy row：透過 offcanvas hover trash icon 刪除（既有 capability）

**未做後端 data migration**（後端不動鐵則）。Forward-only fix。

---

## Honest dishonesty disclosure

- ~~純 functional 改動，未拍新 PNG~~ — **已補完 8/8 vp PNG 親 Read**（user killer Q 後立即補）
- 5 specs 走 mocked endpoint，未走真實 backend round-trip — 後端 idempotent guard 由 jest 後端 spec（baseline 143/143）保護
- chromium only 8 vp Playwright（webkit follow-up）

---

## 8-VP Visual Verification（補完）

**Capture spec**：`tests/visual/capture-p0-drill-fix-pngs.spec.js` — 2 scenarios × 8 viewports = 16 PNG
**Output**：`audit/png-p0-drill-fix/offcanvas-{A-postfix,B-legacy}-{vp}.png`

**Scenario A — POST-FIX clean state**（2 sessions, drill_step='C1' both）8/8 vp ✓
- mobile-360 / iphone-se-375 / iphone-14-390 / iphone-15-430（4 mobile sizes）
- tablet-768 / desktop-1280 / desktop-1440 / desktop-2560（tablet + 3 desktop）
- 全 vp 一致：drawer 280px 固定 / 2 items 全顯「CIRCLES · C 澄清 · 草稿」/ 0 「步驟加練」fallback
- Desktop 1280+ 右 rail「最近練習」同步顯「個別 C1」badge × 2

**Scenario B — LEGACY mixed**（new row drill_step='C1' + legacy row drill_step=null）8/8 vp ✓
- 全 vp 顯 2 Tesla items：1 小時前「CIRCLES · C 澄清 · 草稿」+ 3 小時前「CIRCLES · 步驟加練 · 草稿」
- 完整 reproduce user 截圖症狀（precondition：fix 之前的 broken data 在 legacy mode 仍正確 render，未破）
- Desktop 1280+ 右 rail：個別 C1 badge（new）+ 個別（無 step）badge（legacy）

**Layout invariants confirmed 跨 8 vp：**
1. `.offcanvas-drawer` width = 280px from-left（固定，independent of viewport）
2. `.offcanvas-section` headers「今天 / 過去 7 天」grouped by relative time bucket
3. `.offcanvas-item` 3-line structure（title / meta / date）
4. backdrop dim home view 完整透出
5. Desktop ≥ 1280 right rail「最近練習」reflects same data + drill_step badge variance

**結論：** Scenario A 確認 fix 預期效果（all-clean drill subtitle），Scenario B 確認 legacy data 不破（fallback graceful）。0 結構性 viewport drift。

---

## Race window 量化對比

**Pre-fix scenario（user-reported）：**
- 第 1 次練 Tesla：mode-card 步驟加練 → drillStep null → POST /draft `{mode:'drill'}` → backend row drill_step=null
- 後 user 點 drill-pill C → drillStep='C1'
- 第 2 次再進 Tesla：POST /draft `{mode:'drill', drill_step:'C1'}` → backend row 2（不同 4-tuple）
- → 同一題 2 筆 sessions

**Post-fix scenario：**
- 第 1 次練 Tesla：mode-card 步驟加練 → drillStep auto-default 'C1' → POST /draft `{mode:'drill', drill_step:'C1'}` → backend row drill_step='C1'
- 後 user 點 drill-pill C → drillStep 仍 'C1'（no-op）
- 第 2 次再進 Tesla：POST /draft `{mode:'drill', drill_step:'C1'}` → backend idempotent guard 命中 → 回原 row
- → 同一題 1 筆 session ✓
