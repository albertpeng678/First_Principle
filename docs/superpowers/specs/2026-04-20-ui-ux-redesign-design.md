# PM Drill UI/UX 全面重設計 — 設計文件

**日期：** 2026-04-20
**版本：** v1.0
**基礎規格：** docs/specs/2026-04-20-pm-drill-design.md

---

## 背景與目標

針對現有 PM Drill 產品的 11 項 UX 問題進行全面重設計，目標是改善練習體驗的資訊架構、RWD 適應性與視覺一致性。

**原始問題清單：**
1. 沒有舊對話列表，無法回到未完成的 session
2. 教練缺乏提示機制，使用者不知道如何推進
3. 發送訊息後問題本質 textarea 被清空，造成線索遺失
4. 問題本質輸入區在最下面且不固定，容易忽略
5. 問題本質缺乏引導說明
6. 抱怨內容沒有置頂，使用者需要滑回去看
7. 評分頁資訊全部線性堆疊，缺乏導覽
8. 評分頁沒有回首頁的入口
9. 所有 emoji 視覺不統一
10. 預設深色主題，應改為亮色
11. 沒有 RWD 設計

---

## 決策摘要

| 設計決策 | 選擇 |
|----------|------|
| Practice View 佈局 | 方案 B：折疊 Issue Banner + 工具列底欄 |
| Icon 系統 | Phosphor Icons（font CDN） |
| Report View 架構 | 方案 A：Tab 分頁 |

---

## 技術選型補充

| 新增項目 | 方式 |
|----------|------|
| Icon | Phosphor Icons v2.1.1 via CDN font |
| Offcanvas | 純 CSS + JS，無外部依賴 |
| 提示機制 | coach API 回傳新增 `hint` 欄位 |

Phosphor Icons CDN：
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css">
```

---

## 全域變更

### Icon 替換對照表

| 原 emoji | Phosphor class | 使用位置 |
|----------|---------------|----------|
| ☀️ / 🌙 | `ph-sun` / `ph-moon` | Navbar 主題切換 |
| 🌱 | `ph-leaf` | 入門難度 |
| 🔥 | `ph-flame` | 進階難度 |
| ⚡ | `ph-lightning` | 困難難度 |
| 💡 | `ph-lightbulb` | 提示按鈕 |
| 📝 | `ph-note-pencil` | 更新定義按鈕 |
| 📄 | `ph-file-pdf` | 匯出 PDF |
| 🖼️ | `ph-image` | 匯出 PNG |
| ✅ | `ph-check-circle` | 評分卡 did |
| ❌ | `ph-x-circle` | 評分卡 missed |
| 🏆 | `ph-trophy` | 最佳亮點 |
| ⚠️ | `ph-warning` | 主要陷阱 |
| ☰ | `ph-list` | Hamburger |
| ← | `ph-arrow-left` | 返回按鈕 |
| 🏠 | `ph-house` | 回首頁 |

### 預設主題

```javascript
// public/app.js - AppState 初始化
theme: localStorage.getItem('theme') || 'light',  // 原為 'dark'
```

### RWD 基礎規則（style.css）

```css
/* 主容器 */
main {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 16px;
}

/* 難度卡片 grid */
.difficulty-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

/* 手機安全區 */
.chat-bottom-bar {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

/* Report Tab label 縮短 */
@media (max-width: 480px) {
  .tab-label-full { display: none; }
  .tab-label-short { display: inline; }
}
```

---

## Navbar（全頁共用）

**結構：**
```
[ph-list] [標題/Logo]                    [ph-sun] [ph-user-circle / 登出]
```

Hamburger (`ph-list`) 點擊 → 開啟 Offcanvas 側邊抽屜。

### Offcanvas 側邊抽屜（#1）

- 從左側滑出，背景半透明遮罩（`rgba(0,0,0,0.4)`）
- 點遮罩或 `ph-x` 關閉
- 內容：最近 session 列表
  - 資料來源：`GET /api/(guest-)sessions`（已有端點，無需新增）
  - 每列顯示：難度 badge + 日期（`created_at` 格式化）+ 狀態
    - in_progress：「進行中」（藍色 badge）
    - completed：總分數字（如「74分」，綠色）
  - 點擊 in_progress → `AppState.currentSession = session; navigate('practice')`
  - 點擊 completed → `AppState.currentSession = session; navigate('report')`
- CSS：`transform: translateX(-100%)` → `translateX(0)`，`transition: 0.25s ease`
- 登入用戶顯示全部歷史；訪客只顯示當前 guestId 的 session

---

## Practice View 重構

### 整體佈局（上→下，全高 `100dvh`）

```
┌─────────────────────────────────────┐  ← Navbar（固定）
├─────────────────────────────────────┤  ← 進度條（固定）
├─────────────────────────────────────┤  ← Issue Banner（固定，可折疊）
│                                     │
│         聊天區（可滾動）             │  ← flex-1, overflow-y: auto
│                                     │
├─────────────────────────────────────┤  ← 固定底欄 sticky bottom
│  [ph-lightbulb 本輪提示]  [ph-note-pencil 更新定義] │
│  ┌─ 問題本質定義 textarea ─────────┐ │
│  │ placeholder + 範例              │ │
│  └─────────────────────────────────┘ │
│  ┌─ 聊天輸入 textarea ──┐ [送出]    │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Issue Banner（#6）

- 預設展開，顯示完整抱怨內容
- 右側 `ph-caret-up` 點擊收合 → 只顯示一行摘要 + `ph-caret-down`
- 背景色：`--bg-surface` + 左側 2px accent 色邊框
- 顯示：來源 badge（如「客服主管 · 進階」）+ 抱怨全文

### 提示機制（#2）

- 底欄工具列左側：`[ph-lightbulb 本輪提示]` 按鈕（預設 disabled 外觀，可點擊）
- 點擊後：在聊天區底部插入一張提示卡片（inline，非 modal）
  - 樣式：淡黃背景，左側橘色邊框
  - 內容：coach API 回應新增 `hint` 欄位（一句引導方向，不劇透）
  - 每輪對話後 hint 更新（從最新一筆 coachReply 取）
- 後端：`prompts/coach.js` buildSystemPrompt 補充指示，要求在 `【教練提示】` section 輸出一句引導，前端 parseCoachReply 新增解析此 section

### 問題本質（#3 #4 #5）

- 底欄固定，與聊天輸入分離
- `sendChat()` 只清空 `#chat-input`，不動 `#final-def`
- placeholder 改為：
  ```
  用中性問句描述問題本質…
  例：如何讓 [角色] 在 [情境] 下更有效率達成 [目標]？
  ```
- 標籤：「問題本質定義（提交前可隨時更新）」

---

## Report View 重構

### 整體佈局

```
┌─────────────────────────────────────┐  ← Navbar（固定）
│  [ph-list]  練習報告   [ph-house]   │
├─────────────────────────────────────┤  ← 總分摘要列（固定）
│  74分  ████████████░░░  進階 · 7輪  │
├──────┬──────┬──────┬────────────────┤  ← Tab Bar（固定）
│評分總覽│練習回顧│亮點摘要│   匯出   │
├─────────────────────────────────────┤
│                                     │
│         Tab 內容（可滾動）           │
│                                     │
└─────────────────────────────────────┘
```

### Tab 1：評分總覽

- 雷達圖（現有 SVG，保留）
- 五維度 bar chart（橫向進度條形式，比 card grid 更緊湊）
- 各維度展開卡片：did (`ph-check-circle`) / missed (`ph-x-circle`) / tip (`ph-lightbulb`)

### Tab 2：練習回顧

- 現有回顧表格，columns：輪次 / 學員提問 / 本輪預期重點 / 被訪談者回答 / 教練點評
- 手機：卡片形式（每輪一張卡），避免橫向 scroll

### Tab 3：亮點摘要

- bestMove (`ph-trophy`) / mainTrap (`ph-warning`) / summary（斜體引言樣式）

### Tab 4：匯出

- `[ph-file-pdf 匯出 PDF]` 按鈕
- `[ph-image 匯出 PNG]` 按鈕
- 說明文字：「PDF 使用瀏覽器列印；PNG 截取報告畫面」
- 「再練一次」按鈕（→ navigate('home')）

### 回首頁（#8）

Navbar 右側 `ph-house` → `navigate('home')`

---

## 後端變更

### coach.js — 新增 hint 欄位

在 system prompt 新增指示：
```
每次回覆結尾加上：
【教練提示】
（一句話，引導學員下一輪可以從哪個方向繼續探索，不直接給答案）
```

`parseCoachReply()` 前端新增解析 `【教練提示】` section，存入 coachReply.hint。

---

## 驗收標準

| 項目 | 驗收方式 |
|------|---------|
| Offcanvas | 點 hamburger 滑出，列表正確，點 session 正確跳轉 |
| 提示機制 | 預設不顯示，點按鈕後顯示提示卡，內容來自 coach hint |
| 問題本質不清空 | 送出後定義 textarea 內容保留 |
| 固定底欄 | 手機瀏覽器捲動時底欄始終可見 |
| Issue 置頂 | 可展開/收合，手機下不破版 |
| Report Tab | 4 Tab 正確切換，手機 label 縮短不破版 |
| 回首頁 | Report Navbar `ph-house` 正確跳回 Home |
| Phosphor Icons | 所有 emoji 替換，無殘留 |
| 亮色預設 | 首次訪問顯示亮色主題 |
| RWD | iPhone SE（375px）完整跑完練習流程不破版 |
| Offcanvas 訪客 | 訪客模式顯示 guestId 對應的 session 列表 |
