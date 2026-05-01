# SP2 — CIRCLES Drill Mode 修正 + 搜尋

**Date:** 2026-05-02
**Mockup（必看，照做不偏離）：** `docs/superpowers/specs/mockups/2026-05-02-pm-drill-overhaul/sp2-drill-mode.html`

> **實作 AI 注意：** 所有視覺與互動決策都已在 mockup 中定案。實作前必看 mockup，desktop 3-col grid 與 mobile/tablet single-col 排版必須與 mockup 一致。任何偏離請先回頭確認。

## 鎖定決策

### 1. Desktop drill mode — 加 step pills 在左 rail

mockup `§ ① · DESKTOP · 1280px`：

- 在 `renderCirclesHomeDesktop` 的左 rail，於「練習模式」與「題型」之間插入 `練習步驟` section
- 只在 `mode === 'drill'` 時渲染
- 3 顆 pill 垂直堆疊（不是橫排）：`C 澄清情境` / `I 定義用戶` / `R 發掘需求`
- 下方 `lock-note`：「🔒 C2、L、E、S 需在完整模擬中練習」（icon 用 `ph-lock-simple`）

### 2. 題目過濾 — 依當前 drill step 顯示對應題目

- mockup `§ ① · 中 column`：標題改「練習 R 步驟 · 5 題」（依當前 step 動態）
- 題目 cards 加 step 標籤 pill：`<span class="pill step">R 練</span>`
- card border 加重：drill mode 下 border 改 `1.5px solid rgba(74,108,247,.3)`
- 過濾邏輯：當 mode === 'drill' 時，只顯示題庫中 `coach_circles[currentStep]` 有具體可練內容的題目（不是空字串、不是 placeholder）；如果該 step 全部題目都有，就不過濾

### 3. Desktop 搜尋功能 — 從零實作

mockup `§ ① · DESKTOP search bar`：

- `#search-input` 目前完全沒有 event listener（檢查 app.js 確認）
- 加 `input` 事件 → debounce 200ms → filter `AppState.circlesDisplayedQuestions`
- Filter 條件：substring match against `q.company || q.product || q.problem_statement`（case-insensitive）
- 結果為 0 時顯示「找不到符合的題目」placeholder
- 清空 input 恢復原本 5 題隨機池

### 4. 練習記錄 — 區分 drill vs simulation

mockup `§ ② history`：

- 每筆 history row 加 `mode-tag`：
  - `<span class="mode-tag">完整模擬</span>` 對應 sim
  - `<span class="mode-tag drill">加練 R</span>` 對應 drill（顯示具體 step）
- **Mobile / Tablet：** 改成 2 行 layout（第 1 行：badge + mode-tag + 日期；第 2 行：CIRCLES · 公司 · 產品）
- **Desktop：** 維持單行 inline，badge / tag / 公司 / 日期 一字排開

## 影響檔案

| 檔案 | 動作 |
|---|---|
| `public/app.js` | `renderCirclesHomeDesktop` 加 step pills section；題目過濾邏輯（filter by step）；`#search-input` 加 event listener；offcanvas history 渲染加 mode-tag |
| `public/style.css` | 加 `.step-pill`（垂直版）、`.lock-note`、`.pill.step`、`.qcard.drill-card`、`.mode-tag` 等 styles |

## 驗收

### Playwright 8 viewport
新增 `tests/playwright/journeys/sp2-drill-mode.spec.js`：
- desktop drill mode：選 `[data-mode="drill"]` → assert `.step-pill` 出現 3 顆且包含 C1/I/R 文字
- 點任一 step pill → assert 中 column title 含 `練習 X 步驟` + cards 都有 `.pill.step`
- search input 輸入「Spotify」→ assert 只剩含 Spotify 的卡片
- offcanvas 開啟 → assert 每筆 row 有 `.mode-tag`

### iOS Safari quirk check
- Step pill 觸控 ≥ 44×44px（mobile / tablet 要驗）
- search input font-size ≥ 16px（避免 iOS focus 時放大）

## 後續

下一步：writing-plans。
