# CIRCLES Progress Save Design Spec

**Date:** 2026-04-28
**Scope:** 讓使用者在 CIRCLES drill / simulation phase 1 填寫過程中**自動儲存草稿**到後端，重整或下次回來能恢復進度，並透過 UI 提示已儲存狀態與未完成 session 的存在。

---

## 1. 背景與問題

目前 phase 1 的 textarea 內容只在「送出」時才會打包進 session 建立。Playwright 驗證確認：

```
BEFORE RELOAD: phase=1, sessionId=undefined, stepDrafts={}
OFFCANVAS AFTER RELOAD: 只有舊的兩筆，沒有新草稿
```

使用者打字 → 關 tab / 重整 → 全部丟失。`saveCirclesProgress(patch)` 雖然存在（`app.js` 第 401 行），但只在 session 已建立後才能 PATCH，且初始選題到送出之間沒有觸發點。

---

## 2. 目標

1. 使用者在 phase 1 任一 textarea 改動後，**自動儲存草稿到後端**（debounced）
2. session 不存在時：第一次改動 → **lazy-create session**（POST），後續用 PATCH
3. 儲存狀態給使用者**可見回饋**（`已儲存 · 剛剛` 樣式）
4. 使用者下次回來時，**兩處 UI 觸點**喚回未完成 session

非目標：
- 不做樂觀並發（同帳號多 tab 同時編輯不在 scope，最後寫贏）
- 不做 phase 2 / phase 3 的草稿儲存（只保 phase 1，因為 phase 2/3 已經會自動 save）
- 不做離線儲存（本地 storage cache）

---

## 3. 後端

### 3.1 Lazy-create endpoint
**新增** `POST /api/circles-sessions/draft`：
- body: `{ question_id, mode, drill_step?, sim_step_index? }`
- 行為：建立一筆 `circles_sessions`，`status='active'`、`current_phase=1`、`step_drafts={}`、`framework_draft={}`
- 回傳：`{ id, ...row }`

對應 guest route：`POST /api/guest-circles-sessions/draft`。

### 3.2 沿用 PATCH endpoint
`PATCH /api/circles-sessions/:id/progress`（已存在）— 接受 partial：
```json
{ "step_drafts": { "C1": { "問題範圍": "..." } }, "framework_draft": {...} }
```

merge 既有欄位（不要覆蓋未傳的欄位）。

### 3.3 List endpoint 加欄位
`GET /api/circles-sessions` 在 select 加上 `updated_at`（已有）+ 確保回傳 `step_drafts`（已有）— 用來在 offcanvas 顯示「最後編輯時間」。

---

## 4. 前端：自動儲存邏輯

### 4.1 觸發
**事件**：`circles-field-input` textarea 的 `input` 事件（已綁定）+ `solution-name-input` 的 `input` 事件。

**Debounce**：1500ms（避免每個字元打 API）。

### 4.2 第一次儲存（lazy-create）
條件：`AppState.circlesSession?.id` 為 falsy。

行為：
1. POST `/draft`，body 用當前選題與 mode
2. 收到 id 後：`AppState.circlesSession = { id, mode, drill_step }`
3. 立刻 PATCH 帶上當前所有 draft 欄位（合併寫入）

### 4.3 後續儲存
PATCH `/progress`，body：
```js
{ step_drafts: AppState.circlesStepDrafts, framework_draft: AppState.circlesFrameworkDraft }
```

### 4.4 並發保護
flag `AppState.circlesSaving` — 一次只允許一個請求 in flight。請求中又有新改動 → 結束後再 fire 一次。

### 4.5 失敗處理
- 失敗：stash 失敗時間戳，UI 切到「儲存失敗」狀態
- 重試：使用者可點 indicator 觸發手動重試

---

## 5. UI：儲存指示器（在 phase 1 表單右上）

### 5.1 位置
Phase 1 表單頂部的 progress label 那一行右側（同 row 的 right-aligned 元素）。

### 5.2 狀態
| 狀態 | 顯示 | 顏色 |
|---|---|---|
| `idle`（從未存過） | 無顯示 | — |
| `saving` | 「儲存中…」 | #f59e0b（橘）|
| `saved`（剛存完） | 「已儲存」 | #10b981（綠）|
| `saved-stale`（>5s 前存過） | 「已儲存 · {N} 秒前」/「已儲存 · 剛剛」 | #5a5a5a（灰）|
| `error` | 「儲存失敗，重試」 | #ef4444（紅，可點）|

點點：6px 圓點 + 11px 字。

### 5.3 動畫
從 saving → saved 加入一個 200ms fade-in，避免閃爍。

---

## 6. UI：喚回未完成 Session

### 6.1 Offcanvas badge（A）
在「練習記錄」列表，未完成 session 顯示：
- badge：黃底「進行中」（`background: #FEF3C7; color: #92400E`）
- 副標題：原有「日期」改為「{N} 分鐘前編輯」（如 `<5min` 顯示「剛剛」、`<60min` 顯示「N 分鐘前」、`>60min` 顯示日期）

判定條件：
- 已完成（`status='completed'`） → 顯示「完成」
- 未完成（`status='active'`） → 顯示「進行中」

### 6.2 CIRCLES 首頁 banner（B）
進入 CIRCLES 首頁時，若使用者最近有 1 筆 active 的 session：

頂部顯示一張 card：
```
┌──────────────────────────────────────────────┐
│ 你有未完成的練習                              │
│ Tesla · Tesla Autopilot · 5 分鐘前編輯  →繼續 │
└──────────────────────────────────────────────┘
```

樣式：白底、border 1px、`border-radius: 12px`、padding 16px、放在常駐說明卡片**上方**。

點「繼續」 → `loadCirclesSession(id)` + `navigate('circles')`（保持在 phase 1）。

「→繼續」按鈕右側加一個小 X 關掉 banner（`localStorage` 記住「dismiss for this session id」），避免使用者看到很煩。

判定條件：
- 取「最近 updated 的 active circles session」
- 條件：`status === 'active'` AND 有任何 `step_drafts` 內容（避免顯示完全空白的）
- 如果使用者是訪客（guest），banner 也顯示（用 `X-Guest-ID` header）

---

## 7. AppState 新增

```js
circlesSaveStatus: 'idle' | 'saving' | 'saved' | 'error',
circlesLastSavedAt: number | null,    // ms timestamp
circlesSavingDebounce: number | null, // setTimeout handle
circlesSavingInFlight: boolean,
circlesSavingPending: boolean,        // 有改動但 inflight, 結束後要再 fire
circlesActiveDraft: { id, question_id, company, product, updated_at } | null,
                                       // for homepage banner
```

---

## 8. Implementation order

1. 後端：加 `POST /draft` route（auth + guest 兩個版本）
2. 前端：寫 `triggerCirclesAutoSave()` 函式（debounce + lazy-create + PATCH）
3. 前端：把 `triggerCirclesAutoSave` 接到 phase 1 textarea + sol-name input 的 `input` listener
4. 前端：寫 saving indicator（component + 4 states）
5. 前端：offcanvas badge 改造（含相對時間）
6. 前端：CIRCLES 首頁 banner（fetch active draft + render + dismiss）
7. Playwright 驗證：填字 → reload → 兩處 UI 都看到 session、點開 phase 1 內容還在

---

## 9. 風險與緩解

- **Risk:** 第一次打字就觸發 POST `/draft`，使用者只是想瀏覽某題就退出 → 留下空 session
  - **Mitigation:** 後端清理 cron（每天）：刪除 `created_at < 24h ago AND status='active' AND step_drafts={}` 的孤兒 session
- **Risk:** Banner 太吵，使用者每次都看到
  - **Mitigation:** 提供 dismiss 按鈕 + `localStorage` 記憶；只有最近 7 天內的 active draft 才顯示
- **Risk:** PATCH 失敗時資料丟失
  - **Mitigation:** UI 紅色 indicator + 點一下重試；同時 console.warn 留 debug 痕跡
- **Risk:** 多 tab 同帳號編輯，最後寫贏覆蓋
  - **Mitigation:** 不在 scope，但 PATCH 是 merge 不是 overwrite，部分欄位不會丟
