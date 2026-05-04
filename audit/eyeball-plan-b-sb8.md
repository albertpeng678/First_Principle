# Eyeball Walk — Plan B SB8 hint modal + example expand

**Date:** 2026-05-04
**Implementer:** sonnet4.6
**Scope:** 全 7 步（C1/I/R/C2/L/E/S）hint modal（Tier-1 hardcoded）+ example expand（inline lazy populate）

---

## PNG Director Read 清單（6 張）

### 1. Mobile 360 — C1 hint modal（bottom sheet）
**文件路徑：** `/tmp/sb8-hint-modal-mobile-360.png`
- modal-card 底部 bottom sheet 上滑，無 border-bottom-radius
- 標題列：lightbulb icon + `提示 · C1` + `問題範圍` + X 關閉
- body：2 段落，文字對齊 HINT_OVERLAY_TEXT.C1['問題範圍']
- footer：`了解了` navy 按鈕
- form 在後方可見（opacity dim）
- **結論：PASS**

### 2. Tablet 768 — C1 hint modal（centered fade-in）
**文件路徑：** `/tmp/sb8-hint-modal-tablet-768.png`
- modal-card 居中，backdrop dim 45%
- 標題：`提示 · C1` + `問題範圍`
- body：2 段落正確
- footer：`了解了` 右對齊
- form fields（問題範圍/時間範圍/業務影響/假設確認）全在後方
- **結論：PASS**

### 3. Desktop 1280 — C1 example expand（inline）
**文件路徑：** `/tmp/sb8-example-expand-desktop-1280.png`
- inline panel 展開在 rt-field 下方，soft bg surface
- 標題：quotes icon + `範例答案 — 此題預先生成，不打 LLM（< 50ms）`+ X 收合
- bullet list 正確渲染：頂層 `<li>` + 縮排子項 `<ul class="example-list">` → rendered
- **bold** 文字正確渲染（Netflix Streaming bold）
- 題目是 Netflix，field_examples.C1['問題範圍'] 正確載入
- **結論：PASS**

### 4. Desktop 1280 — E step hint modal（sol-card 方案一優點）
**文件路徑：** `/tmp/sb8-hint-modal-e-step-desktop.png`
- 從 sol-card 第一個 field（優點）點提示
- `提示 · E` + `優點`
- body 2 段：「誠實寫每個方案最強的 1-2 個優勢。」+ 後半段
- desktop rail 仍顯示 `E 步重點` / `為何要評估每個方案`（backdrop 不遮 rail）
- **結論：PASS**

### 5. Desktop 1280 — S step hint modal（推薦方案）
**文件路徑：** `/tmp/sb8-hint-modal-s-step-desktop.png`
- S 步 step 7，標題「S · 總結推薦（含 NSM 與 4 追蹤維度）」
- 點 `推薦方案` hint
- `提示 · S` + `推薦方案`
- body 2 段：「一句話總判斷。」+ 「推薦哪個方案、為什麼...」
- submit-bar CTA 顯示「完成 Phase 1」（正確）
- **結論：PASS**

### 6. Mobile 360 — C1 example expand（inline mobile）
**文件路徑：** `/tmp/sb8-example-expand-mobile-360.png`
- inline expand 在 `問題範圍` rt-field 下方展開
- body 字體正確 small，bullet 清楚
- `99 範例答案 ↓` button 已轉為 active（caret 上旋轉）
- **結論：PASS**

---

## 互動點覆蓋（42 total = 7 step × 2 button type × 3 viewport，代表覆蓋）

| Step | Hint button | Example toggle | Viewport tested |
|------|-------------|---------------|-----------------|
| C1 | ✅ Mobile 360 + Tablet 768 | ✅ Desktop 1280 + Mobile 360 | 360 / 768 / 1280 |
| I | ✅ spec 全 pass | ✅ spec 全 pass | 1280 (spec) |
| R | ✅ spec 全 pass | ✅ spec 全 pass | 1280 (spec) |
| C2 | ✅ spec 全 pass | ✅ spec 全 pass | 1280 (spec) |
| L | ✅ spec 全 pass | ✅ spec 全 pass | 1280 (spec) |
| E | ✅ Desktop 1280 PNG | ✅ spec 全 pass | 1280 |
| S | ✅ Desktop 1280 PNG | ✅ spec 全 pass | 1280 |

---

## boundingBox Invariants（5 條）

1. `.modal-card` mobile：bottom = viewport height（bottom sheet 貼底）
2. `.modal-card` tablet/desktop：vertically centered（top ≈ 50% - height/2）
3. `.hint-overlay__backdrop` 覆蓋 inset:0（全視窗 overlay）
4. `.example-expand` 展開後 `aria-hidden="false"`，`display` 不為 none
5. `.example-list li` count ≥ 1（lazy populate 成功，無空清單）

---

## Drift vs Mockup（mockup 03 Section D line 1760-1949）

**符合：**
- modal-card HTML 結構：verbatim copy mockup line 1795-1812
- bottom sheet mobile CSS：`@media (max-width: 767px)` `bottom: 0; border-bottom-radius: 0`
- centered tablet/desktop CSS：`@media (min-width: 768px)` `top: 50%; transform: translate(-50%, -50%)`
- `了解了` + X + backdrop 4 種關閉路徑全實作
- example-expand 結構：verbatim copy mockup line 1905-1920
- `data-example-key` based lookup（不 rely on idx）
- Lazy populate：第一次展開才查 DB，之後 cache `data-populated="1"`

**誠實 drift 清單：**
- `renderExampleExpand` 第一個 arg（stepKey）傳空字串（在 renderPhase1Field call）— 因為 stepKey 在 binder 階段才知道，不影響功能，但 HTML 沒記錄 stepKey
- S step tracking-card 的 hint 使用 `dimZh`（如「觸及廣度」）作為 fieldKey，查 HINT_OVERLAY_TEXT.S['觸及廣度'] — 但 dimZh 隨 productType 動態切換，attention 以外的 type 查不到，會 fallback 到「提示內容稍後提供。」— 此為 SB8 已知限制，SB9 可補全

---

## 測試結果摘要

| Test | Result |
|------|--------|
| jest 157/157 | ✅ PASS |
| phase1-hint-modal.spec.js 11/11 | ✅ PASS |
| phase1-example-expand.spec.js 10/10 | ✅ PASS |
| Phase 1 full regression 496/496 × 8 viewport | ✅ PASS |
