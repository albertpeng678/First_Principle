# SP3 — 評分深化 + 教練示範答案加深 + 結尾頁簡化

**Date:** 2026-05-02
**Mockups（必看，照做不偏離）：**
- Happy: `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp3-score-coach-end.html`
- Loading / Error: `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp3-loading-error-states.html`

> **實作 AI 注意：** 所有 layout / 折疊規則 / loading / error 行為都在 mockup 中定案。逐項照做。schema 改動會影響 OpenAI prompt 與前端 render，必須一致更新。

## 鎖定決策

### A. 評分頁 — 維度 collapsible（省空間）

mockup `sp3-score-coach-end.html § A`：

- **Mobile / Tablet：** 維度預設折疊（只看 `名稱 + 分數 + 進度條`），點擊展開
- **自動展開：** 分數 ≤ 2 的維度第一眼就看到問題，自動展開
- **Desktop：** 預設全展開（2-col 寬足）；左欄 score + highlights / 右欄 dimensions
- 每維度展開內容：
  - `comment`：30-50 字「你的版本」說明
  - `coachVersion`：教練版本 quote-style block
  - `tip`：1-line 改進提醒（icon `ph-lightbulb`）
- 互動：點擊維度標題切換展開/折疊；箭頭 `ph-caret-right` 旋轉 90deg

### B. 教練示範答案加深

mockup `sp3-score-coach-end.html § B`：

- 取代現有 1 行 `coachVersion`（如「探索用戶行為，確定具體困惑點」），擴展成多段結構：
  - **情境前置**：1 段（為什麼這個步驟重要）
  - **逐欄位示範**：bullet list（針對該步驟的 4 個 framework 欄位各給示範答案）
  - **為什麼這樣答**：quote-style reasoning（1-2 句）
- 預設折疊；點擊 `教練示範答案` header 展開
- 內容由 evaluator API 在評分同一次 call 中產出（**不是另一個 API**）
- 確認過 prompts/circles-evaluator.js — 同一個 evaluate-step API 已包含 coachVersion 字串

### C. 結尾頁簡化

mockup `sp3-score-coach-end.html § C`：

- **移除** 黃色 `恭喜完成這個步驟！` card（含 `回首頁` + `再練一次` 雙按鈕）
- **移除** 底部 sticky `再練一次` 按鈕 + 房子 icon
- **新增** 底部單顆 `再練一題` 主按鈕：
  - icon: `ph-shuffle`
  - 行為：navigate 回 CIRCLES home → 從**同 mode**（drill / simulation）+ **同 type**（design / improve / strategy）的題庫池子隨機抽 1 題 → 自動展開該題卡

### Loading / Error states

mockup `sp3-loading-error-states.html § ① ②`：

**Loading（POST evaluate-step in flight）：**
- 整頁取代成 spinner + checklist：
  - `loadingSpinner` 56×56 動畫
  - 4 項視覺進度（純前端）：解析框架 → 計算分數 → 生成示範答案 → 整理建議
  - 0s/500ms/1000ms/1500ms/3000ms 自動切換 check 狀態
  - 15 秒顯示 toast「比預期慢一些…」；30 秒進 error
- 套用 phase-head + qchip 維持 context

**Error：**
- 整頁顯示：`ph-cloud-warning` icon + 標題「評分生成失敗」+ 說明 + 2 顆按鈕：
  - **重新評分**（primary）— 重打 evaluate API 帶同一份 framework_draft
  - **返回修改答案**（ghost）— navigate 回 Phase 1，保留 framework_draft（已 auto-save）
- 顯示 error code（dev-only 或 console）：`EVAL_TIMEOUT` / `EVAL_API_ERROR` / `EVAL_PARSE_ERROR`
- `EVAL_AUTH_ERROR`（401）特殊處理：跳登入頁，不顯示錯誤頁

### 與既有流程相容性

- 既有 Phase 3 進入點：`AppState.circlesPhase === 3 && !circlesScoreResult` → 觸發 fetch
- 新增 AppState slots：
  ```javascript
  circlesScoreLoading: false,        // fetch 中
  circlesScoreError: null,           // { code, message } | null
  ```
- Phase 3 renderer 三分支：
  ```javascript
  if (AppState.circlesScoreLoading) return renderScoreLoading();
  if (AppState.circlesScoreError)  return renderScoreError();
  if (AppState.circlesScoreResult) return renderScoreContent();
  ```
- fetch 用 `AbortController` 30s timeout
- `bindCirclesPhase3` 加 loading/error state 的 bind（重試按鈕 + 返回修改）

## 影響檔案

| 檔案 | 動作 |
|---|---|
| `prompts/circles-evaluator.js` | schema 擴展 `coachVersion` 從 string 改 object：`{ context, perField: [...], reasoning }`；prompt 改寫產出多段內容 |
| `routes/circles-sessions.js` + `routes/guest-circles-sessions.js` | evaluate-step route 增加 timeout + error code mapping |
| `public/app.js` | 新增 AppState slots / Phase 3 三分支 renderer / collapse interactions / 結尾按鈕行為 / loading checklist 動畫 |
| `public/style.css` | 加 `.dim-summary[data-open]` collapse styles / `.coach-demo` styles / `.loading-wrap` / `.error-wrap` 等 |
| `tests/circles-evaluator.test.js` | 更新 schema 預期 |

## 驗收

### Jest
- `tests/circles-evaluator.test.js` — coachVersion 為 object 且 3 個 sub-field 皆 string non-empty
- 新增：模擬 API timeout / 5xx / parse fail，驗 error code 正確

### Playwright 8 viewport
新增 `tests/playwright/journeys/sp3-phase3.spec.js`：
- 注入 mock score → 驗預設折疊 / 點擊展開 / 分數 ≤2 自動展開
- 驗 `coach-demo` collapsible 三段內容皆 render
- 驗黃卡 + 雙按鈕**不存在**
- 驗底部單顆 `再練一題` 按鈕，點擊後 navigate 回 home 且新題目展開
- mock fetch fail → 驗 error UI 顯示 + 重試按鈕重打 API
- mock fetch hang → 驗 loading checklist 隨時間切換

## 後續

下一步：writing-plans。
