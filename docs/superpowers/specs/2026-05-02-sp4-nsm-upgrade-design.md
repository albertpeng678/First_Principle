# SP4 — NSM 升級（pre-gen + UI parity + Step 4 全 4 tab 重設計）

**Date:** 2026-05-02
**Mockup（必看，照做不偏離）：** `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp4-nsm-upgrade.html`

> **實作 AI 注意：** Step 4 的 4 個 tab（總覽 / 對比 / 亮點 / 完成）每一個都有 mobile / tablet / desktop 設計，共 12 個 mockup 區塊。實作時逐一比對，不可偷懶用「同一份 mobile UI 套到 desktop」。

## 鎖定決策

### A. NSM 題庫 context 預生成（同 CIRCLES analysis 模式）

- 為每題 `NSM_QUESTIONS` 加 `context` 欄位：`{ model, users, traps, insight }`
- 寫一支 `scripts/backfill-nsm-context.js`：
  - 載入 `NSM_QUESTIONS`（從 `public/app.js` 抽出 array，或抽到單獨 `public/nsm-db.js`）
  - 對每題呼叫既有 `prompts/nsm-context.js` 的 `generateNSMContext`
  - 寫回 `public/app.js`（或 `public/nsm-db.js`）
  - Idempotent：已有 `context` 完整的題目跳過 OpenAI call
- `routes/nsm-context.js` 保留作為 fallback（未來新題 lazy 補）
- 前端：`AppState.nsmContext` 邏輯改為「優先讀 q.context，沒有才 fetch」

### B. Step 1 卡片 UI 對齊 CIRCLES

mockup `§ A+B`：

- 卡片改 layout 為 `公司 + industry + type pill + scenario`
- 卡片 selected 時自動展開「預生成的 4 欄分析」（`q.context` 有值就直接 render，無 loading state）
- 4 欄：商業模式（`ph-buildings`）/ 使用者（`ph-users`）/ 常見陷阱（`ph-warning`，紅）/ 破題切入（`ph-lightbulb`）
- **Mobile：** 上下堆疊（label 在上、值在下）
- **Tablet：** 卡片 2 欄並排
- **Desktop：** 3-col grid（左 200px 產業 filter rail / 中 cards / 右 220px 近期練習 rail）
- 產業 filter：`全部 ×100 / 注意力型 ×24 / 交易量型 ×28 / 創造力型 ×18 / SaaS 型 ×30`
- desktop 加 search input（同 CIRCLES home）

### C. Step 4 全 4 tab 重設計

mockup `§ C` 4 個 tabs × 3 viewports = 12 個 mockup blocks，**全部都要實作**。

#### Tab 1 · 總覽
- **Mobile：** radar 上 / dim-bars 下（單欄）
- **Tablet：** 同 mobile 單欄但寬一點
- **Desktop：** 2-col grid（左 380px radar / 右 1fr dim-bars 卡片）

#### Tab 2 · 對比
- **Mobile：** 你的 / 教練版上下堆疊（垂直），每維度自成一塊
- **Tablet / Desktop：** 2-col side-by-side（左欄你的 / 右欄教練版），加 header row「你的拆解」「教練版本（點擊看思路）」
- Desktop 卡片寬度填滿，不再卡在 600px 中央窄欄

#### Tab 3 · 亮點
- **Mobile：** 3 cards 單欄（最大亮點 / 主要陷阱 / 總評）
- **Tablet：** 2-col（亮點+陷阱並排），總評跨 2 欄
- **Desktop：** 3-col 並排：最大亮點 / 主要陷阱 / **下一步建議**（新增第 3 卡），總評跨 3 欄
- 「下一步建議」卡 border-left 用 `var(--c-success)` 區分

#### Tab 4 · 完成
- 取代現有「只有再練一次按鈕 + 房子」的空白頁
- 改為 `done-panel`：
  - icon `ph-check-circle` 64×64 圓形 background
  - 標題「完成這次 NSM 訓練」
  - 內文：用分數帶出鼓勵（如「本次得分 80 分，距離滿分還差 20 分」）
  - 主按鈕：`再練一題`（icon `ph-shuffle`）
  - **Desktop** 增加 ghost 副按鈕：`回首頁`
- 下方 `done-secondary` info card：「NSM 練習小技巧」

### D. 統一 padding 與「再練一題」行為

- Step 1-4 所有區塊統一 padding：mobile 16 / tablet 22 / desktop 32
- 4 個 tab content 都用 `.step4-body` 容器 → 切換 tab 時容器寬度一致，內容不會忽大忽小
- 「再練一題」navigate 回 NSM home，從 `NSM_QUESTIONS` 隨機抽 1 題 + 自動 selected

## 影響檔案

| 檔案 | 動作 |
|---|---|
| `scripts/backfill-nsm-context.js` | **新檔** — 用 OpenAI 對每題產生 context |
| `public/app.js`（或抽出 `public/nsm-db.js`） | NSM_QUESTIONS 每題加 `context` 欄位 |
| `public/app.js` | NSM Step 1 renderer（mobile + tablet + desktop 3 個分支）；Step 4 renderer 重寫 4 個 tab content；context 直接從 q 讀；search wire-up |
| `public/style.css` | 加 NSM-specific styles（含 padding 統一、4 tab layouts） |

## 驗收

### Jest
- `scripts/backfill-nsm-context.js` 執行後 grep 確認每題都有 `context.model / users / traps / insight` 4 欄
- idempotent：第二次跑 OpenAI call 數 = 0

### Playwright 8 viewport
新增 `tests/playwright/journeys/sp4-nsm-step4-tabs.spec.js`：
- 注入 mock Step 4 state
- 4 個 tab 各跑：assert 該 tab 有對應元件（radar / cmp-card / hl-card / done-panel）
- desktop 各 tab 驗 layout 寬度填滿（不再卡 600px）
- mobile 點擊 chip / 折疊 expand 切換正常

新增 `tests/playwright/journeys/sp4-nsm-step1.spec.js`：
- 進 NSM Step 1 → 點任一卡 → assert `q.context` 即時 render（**0 個 fetch 請求**），無 loading state
- desktop 驗 3-col grid 存在

## 後續

下一步：writing-plans。
