# 2026-05-01 — CIRCLES 首頁完成狀態 + 詳細題目分析 + 全階段持續題目 chip

## 背景與動機

CIRCLES 首頁與練習流程目前有兩個明顯問題：

1. **頂部黃 banner（`renderResumeBanner()` @ public/app.js:1773）與右側「繼續上次練習」資訊重複** — 同一筆 active draft 在兩處呈現，浪費版面，且未提供使用者整體進度感。
2. **「看完整題目」展開後只是把 `problem_statement` 重複一次** — 對使用者沒有任何分析價值，相比 NSM 卡片的破題導讀（商業模式 / 使用者 / 常見陷阱 / 破題切入）落差很大。

第三個衍生需求：
3. **使用者進入練習後，題目說明在多數階段消失或不顯眼** — Phase 1 有 `.problem-card`，但 Phase 1.5 / 2 / 3 / 最終總評頁沒有持續呈現題目脈絡，使用者中途容易忘記題目細節。

本 spec 解決上述三個問題，並建立一致的視覺語言（藍 + 紅雙色、Phosphor icon、system-ui 字型）。

## 範圍

包含：
- 首頁完成狀態指標（取代頂部黃 banner）
- 首頁詳細題目分析卡（取代「看完整題目」的單純重複）
- 全階段持續題目 chip（Phase 1 / 1.5 / 2 / 3 / 最終總評）
- 題目 JSON 新增 `analysis` 欄位 + 題庫腳本升級

不包含：
- NSM 端不動（NSM 已有 `/api/nsm-context` 自己的破題導讀）
- 練習歷史頁（完成狀態指標決議為「點擊純顯示、不導航」）
- 訪客 onboarding（訪客模式整條隱藏）

---

## ① 完成狀態指標（取代頂部黃 banner）

### 視覺
- 細條 strip：左圖示（`ph-chart-bar`）+ 3 個統計分隔顯示 + 右側無箭頭（不導航）
- 3 個統計：
  - **已完成 N**：藍色（`var(--c-primary)`）
  - **進行中 N**：紅色（`var(--c-danger)`）
  - **本週新增 +N**：藍色
- 字型 system-ui，不用襯線體
- max-width 520px（desktop），mobile 滿版
- 不可點擊跳頁，hover 僅微調 border 色

### 顯示條件
- **僅登入用戶**（`AppState.mode === 'auth'`）
- 訪客整條不渲染

### 資料來源
- 取代 `renderResumeBanner()` 的位置（mobile + desktop home renderer）
- 不取代右側「繼續上次練習」cards
- 後端：新增 `/api/circles-stats` 端點，回傳 `{ completed, active, weeklyCompleted }`
  - `completed`: `circles_sessions.status = 'completed'` count
  - `active`: `circles_sessions.status = 'active'` count
  - `weeklyCompleted`: 過去 7 天 status='completed' AND completed_at >= now() - interval '7 days'
- 前端 `AppState.circlesStats` 快取，home render 時若無資料則 fetch

### 「本週新增」定義
週統計使用「過去 7 天」（rolling 7-day window），不是 ISO 週起算。簡單可預測。

---

## ② 詳細題目分析卡

### 視覺
- 點「看完整題目」展開原本的 `.circles-q-card-expand-area`
- 取代原本只重複 `problem_statement` 的內容，改成 4 欄分析：
  - **商業背景**（`ph-buildings`，藍）
  - **用戶輪廓**（`ph-users`，藍）
  - **常見誤區**（`ph-warning`，紅）
  - **破題切入**（`ph-lightbulb`，藍）
- mobile：label 上 / value 下堆疊；tablet/desktop：92px label 欄 + 1fr value 欄
- 三裝置文案完全一致，不縮減
- 下方保留現有「確認，開始練習」「取消」按鈕

### 資料來源（決議：方案 C 純靜態）
- 題目 JSON 新增 `analysis` 欄位：
  ```json
  {
    "id": "circles_001",
    ...
    "analysis": {
      "business":  "Spotify 採訂閱+廣告雙模式...",
      "users":     "主要為通勤族（短時段重複收聽）...",
      "traps":     "只專注界面設計、忽略用戶內容偏好...",
      "insight":   "先界定「誰、在什麼情境用 Podcast」..."
    }
  }
  ```
- `traps` 由現有 `common_wrong_directions` 拼接生成（不耗額外 token）
- `business / users / insight` 由 OpenAI 一次性產出（題庫腳本內，非 runtime）

### 題庫腳本升級
- `scripts/generate-circles-questions.js` 增加：
  - 對每個題目呼叫 OpenAI 產出 `analysis.business / users / insight`
  - `analysis.traps` 由 `common_wrong_directions.join('、')` 直接組
  - 已存在的題目若已有 `analysis` 欄則 skip（idempotent，可重跑）
- 跑一次後 commit 更新後的 `public/circles-db.js`

### Runtime
- 零 API 呼叫、零延遲：直接從 `q.analysis.*` 取值
- 若舊題目沒 `analysis` 欄（防呆）：fallback 到只顯示 `common_wrong_directions`，並印 console warning

---

## ③ 全階段持續題目 chip（新需求）

### 適用範圍
從使用者「確認，開始練習」進入 Phase 1 那一刻起，以下所有畫面都必須持續顯示題目 chip：
- Phase 1（填欄位）
- Phase 1.5（gate 審視結果）
- Phase 2（對話訪談）
- Phase 3（步驟分數頁）
- 最終總評（simulation 模式跑完 7 步後的綜合報告）

### 視覺（低干擾）
- 收合預設：細條 + 1 行 ellipsis + 灰色文字
  - 左圖示（`ph-info`，藍 tint）
  - 「題目」tag（藍）
  - 1 行 ellipsis 題幹預覽
  - 右 `ph-caret-down` toggle
- 展開後：白底卡片 + 藍框
  - 頂部：tag + 公司/產品/題型/難度 meta + 「收合」按鈕（`ph-caret-up`）
  - 中間：完整 `problem_statement`
  - 下方：4 欄分析（同首頁分析卡）
- 字型 system-ui，全藍紅雙色
- 位置：phase navbar + progress bar 之下、phase 主體之上

### 取代 Phase 1 既有的 `.problem-card`
- Phase 1 目前有獨立的 `.problem-card` 大字框顯示題幹（mobile + desktop 都有）
- 統一改用 chip，避免雙重顯示
- 完整版（展開時）已包含 problem_statement，不會丟資訊

### 互動
- 點 chip 任意處（除收合按鈕）→ 切換展開/收合
- 預設收合，使用者切換後不記憶（每次進入新 phase 重置為收合）
- ARIA：`role="button"` `aria-expanded="false|true"` `aria-controls`

### 資料來源
- 直接讀 `AppState.circlesSelectedQuestion`，含 `problem_statement` + `analysis`
- 不需新 API，無 loading state

---

## 配色規則

全範圍只用 2 色：
- **藍** `var(--c-primary)` `#4a6cf7`：主要、資訊、正向、預設
- **紅** `var(--c-danger)` `#ef4444`：警示、進行中、誤區

不再使用：綠（`var(--c-success)`）、橙（`var(--c-warn)`）作為 status 色（既有功能保留現有色，本 spec 範圍內元件統一藍紅）。

---

## 圖示規則

全部使用 Phosphor (`ph-*`)，禁 emoji（per memory `feedback_no_emoji.md`）。

| 用途 | Icon |
|------|------|
| 完成狀態 strip 主圖 | `ph-chart-bar` |
| 商業背景 | `ph-buildings` |
| 用戶輪廓 | `ph-users` |
| 常見誤區 | `ph-warning` |
| 破題切入 | `ph-lightbulb` |
| 題目 chip 主圖 | `ph-info` |
| 展開/收合 | `ph-caret-down` / `ph-caret-up` |

---

## 字型規則

- 全文用 `var(--c-font-sans)` system-ui stack
- **不再**用 Instrument Serif 於標題（per memory `feedback_typography_system_ui.md`）
- Instrument Serif 例外：保留給未來 grade letter（A/B/C/D/F），本 spec 範圍內不出現

---

## RWD 驗收

per memory `feedback_mockup_3_viewports.md` + `feedback_test_all_devices_visual.md`：

- 8 個 Playwright project 全綠：
  - Mobile: 360, iPhone-SE, iPhone-14, iPhone-15-Pro
  - Tablet: iPad
  - Desktop: 1280, 1440, 2560
- 三裝置文案一致，不簡化
- mobile 用 column stack，tablet/desktop 用 row 分欄
- chip 收合在 mobile 一行 ellipsis 不破版

---

## 資料模型變更

### `public/circles-db.js`（題庫）
每筆題目新增 `analysis` 欄位（4 string）：
```javascript
{
  ...
  "analysis": {
    "business": "...",
    "users":    "...",
    "traps":    "...",
    "insight":  "..."
  }
}
```

### `circles_sessions` 表
不變動 schema。`status` / `completed_at` 欄已存在，可直接 query。

### 新增 API
`GET /api/circles-stats`（auth-required）
- Response: `{ completed: number, active: number, weeklyCompleted: number }`
- Backed by single SQL query against `circles_sessions`

---

## 元件邊界

- **`CirclesStatsStrip`**（新）— 接收 `{ completed, active, weeklyCompleted }`，渲染 strip。無內部狀態。
- **`QuestionAnalysisBlock`**（新）— 接收 `analysis: { business, users, traps, insight }`，渲染 4 欄。可重用於：首頁 q-card 展開、phase chip 展開。
- **`PersistentQuestionChip`**（新）— 接收 `question`，渲染 chip + panel。內部有 `expanded` state。Phase 1/1.5/2/3/Final 各 renderer 直接呼叫。
- **`fetchCirclesStats()`**（新）— 一次性 fetch，cache 到 `AppState.circlesStats`。home renderer 用。
- **題庫腳本** `generate-circles-questions.js` — 新增 analysis 生成函式 + idempotent skip。

---

## 已淘汰的設計

- 完成狀態 strip 點擊跳「練習歷史」清單 → 否決（多做一頁，當下不需要）
- 訪客顯示登入 CTA → 否決（直接隱藏更乾淨）
- 4 欄分析改 AI runtime endpoint → 否決（C 方案靜態，零延遲零成本）
- 3 欄精簡分析 → 否決（保留完整 4 欄）
- 綠/橙作為 status 色 → 否決（統一藍紅）

---

## 開放問題

無。所有設計決策已鎖定。

---

## 後續

下一步：用 superpowers writing-plans skill 寫 implementation plan，分解為可執行的 task list。
