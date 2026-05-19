# Diagnose — offcanvas-delete-invalidates-recent-sessions.spec.js Flake

> **Date**: 2026-05-18
> **Role**: Read-only finder (per find-first STANDING)
> **NO FIX in this doc** — Director + user decide fix scope after review.
> **Spec**: `tests/e2e/offcanvas-delete-invalidates-recent-sessions.spec.js`
> **Commits**: shipped `e811378`; flake caught by cross-plan smoke (per `feedback_cross_plan_smoke_after_each_ship` STANDING)

---

## 1. Spec Walkthrough

### AC 結構
- **B10-E1 (AC-1)**: offcanvas 刪除 → `AppState.circlesRecentSessions` 不再含已刪 id（cache invalidation proof）
- **B10-E2 (AC-2)**: offcanvas 刪除 → home recent-rail DOM 消失（DOM visible proof，desktop only）

### 執行流程（兩個 AC 共用）
1. `bootApp()` — 清 localStorage；stub 4 個 GET endpoint 傳空 `[]`；`goto('/')`；等 mode-selector visible；`unrouteAll`
2. `createRealSession()` — 等 `window.CIRCLES_QUESTIONS` 非空；真實 POST draft；真實 PATCH progress → lifecycle `created→editing`
3. `forceRecentRailLoad()` — evaluate：清 AppState session state，null `circlesRecentSessions`，`render()`；等 AppState cache 填入含目標 id 的陣列（desktop 看 DOM，mobile 看 waitForFunction）
4. inject historyList stub + open offcanvas → 點 delete → 等 offcanvas item 消失
5. Escape 關 offcanvas → poll loop（最多 12 次 × 1500ms = 18s）等 `circlesRecentSessions` 不含已刪 id

### Auto-cleanup fixture
- Spec 使用 `const { test } = require('../fixtures/auto-cleanup.fixture')` — 繼承 `cleanupTracker` fixture
- 但 spec **完全沒有呼叫** `cleanupTracker.track(kind, id)` 的地方（全文搜尋 `track(` 無結果）
- 因此 afterEach 的 Supabase DELETE 清理**不會發生** — 每次 run 留下真實 session 在 DB

---

## 2. 失敗 Run 分析

### Run 5 — AC-1 (B10-E1) e2e-mobile-chrome FAIL
**Error**: `TimeoutError: page.waitForFunction: Timeout 12000ms exceeded`
**位置**: `forceRecentRailLoad()` line 148 — mobile 分支等 `circlesRecentSessions !== null && sessions.some(s => s.id === sid)`
**Page snapshot at timeout**: 顯示 circles home 正常 render（5 個問題，44 個 in-progress），但 `circlesRecentSessions` 始終沒有填入含目標 id 的資料

**關鍵觀察**:
- snapshot 顯示 `44 進行中` — 代表有大量 `editing` lifecycle sessions 存在（包含其他 run 留下的殘留）
- `recent-rail` 最多顯示 5 筆（`merged.slice(0, 5)`），若殘留 sessions 新舊排列讓目標 id 排不進前 5，即永遠不在 cache

### Run 2 — AC-2 (B10-E2) e2e-desktop FAIL
**Error 推斷**: 同類型（Run 2 artifact 目錄只有一筆 mobile-chrome，Desktop Run 2 無 artifact 留存，但 CLAUDE.md 記載 AC-2 e2e-desktop FAIL）
**行為推斷**: `forceRecentRailLoad` 或 post-delete poll 超時 — desktop 路徑等 DOM visible `SEL.recentItem(id)` 12s 超時

---

## 3. Hypotheses（按可能性排序）

### H-1 ★★★★★【最高可能】: 跨 run session 殘留 → 目標 id 排不進前 5 筆
**Technical reasoning**:
- `loadHistoryForRail` 取 `GET /api/circles-sessions`（filtered by `editing` lifecycle）+ `GET /api/nsm-sessions`，merge sort，`slice(0, 5)`
- 每次 run 呼叫 `createRealSession()` 建立真實 Supabase row，但 `cleanupTracker.track()` **從未被呼叫**
- 每 run 累積 1-2 個殘留 sessions；多次 cross-plan smoke（3 vp × 2 AC = 6 runs/day）後 DB 累積大量殘留
- Page snapshot 的 `44 進行中` 直接證明有大量殘留 editing sessions
- 當 DB 有 44 個 editing sessions，`GET /api/circles-sessions` 回傳這 44 筆，sorted by `updated_at` desc，`slice(0, 5)` 只取最新 5 筆
- 本次 run 剛建立的 session 的 `updated_at` 有可能**不是最新 5 筆之一**（若舊 sessions 的 `updated_at` 比本次更新：例如其他 vp 在 parallel 同時建了新 session）
- 結果：`circlesRecentSessions` 填入了 5 筆但沒有目標 id → `waitForFunction` 永遠回 false → 12s timeout

**Evidence**:
- Page snapshot: `44 進行中` = 44 editing sessions in DB
- `auto-cleanup.fixture.js` 邏輯正確，但 spec 沒呼叫 `track()` → 實際清理從未執行
- `merged.slice(0, 5)` 是硬性限制，44 筆裡只有 5 筆進 cache

### H-2 ★★★★: parallel 3 vp 同時建 session → `updated_at` 互蓋，目標 id 被排擠出前 5
**Technical reasoning**:
- Playwright `fullyParallel: true`，3 vp 同時跑
- 3 個 browser 各自呼叫 `createRealSession()`，3 個真實 Supabase INSERT 幾乎同時發生
- 若 vp-A 的 session 建立後，vp-B、vp-C 緊接著建立（`updated_at` 更新），vp-A 的 session 在 sorted list 就被推後
- 加上 H-1 的殘留，前 5 名可能全被其他 vp 的 session 佔據
- 此 hypothesis 是 H-1 的**加乘因子**，不是獨立原因

**Evidence**: `fullyParallel: true` 在 playwright.config.js；3 vp 跑相同 spec 同時建立真實 session

### H-3 ★★★: Supabase replication lag → 剛建立的 session 不在 GET 結果中
**Technical reasoning**:
- POST draft 後，Supabase 寫入需要數 ms 至數 s 才能在 GET 回傳
- `forceRecentRailLoad` 在 `createRealSession` 完成後立即 null+render，馬上觸發 `loadHistoryForRail`
- 若 GET 在 replication lag 窗口內，新建 session 不在結果中 → `circlesRecentSessions` 填入了不含目標 id 的陣列 → waitForFunction false
- 但後續有 12s timeout 足以等 replication 通常 < 1s，此 hypothesis 單獨較難解釋 12s 全超時

**Evidence**: spec comment 本身已提及 `Supabase replication lag`（line 227）；`PATCH /progress` 後應該已 commit

### H-4 ★★: `loadHistoryForRail` 缺 inflight guard → 同一 page 多次 null+render 並發競爭，最後 `circlesRecentSessions` 被空 catch 覆蓋為 `[]`
**Technical reasoning**:
- `loadHistoryForRail` 沒有 `_railInFlight` 之類的 guard
- 若同一 page 內短時間觸發多次 null+render（例如 onboarding 或其他 render 觸發），多個 `loadHistoryForRail` 並發
- 其中一個因任何 API 錯誤進入 catch → `circlesRecentSessions = []` → 後續成功的 Promise 覆蓋 `[]` 為真實資料，但 race window 期間 waitForFunction 看到 `[]`（非 null → 退出 wait）再被正確資料覆蓋但 test 已超時
- 更嚴重：若兩個 loadHistoryForRail 幾乎同時 resolve，最後 resolve 的結果決定最終 state

**Evidence**: 無 `_railInFlight` guard（grep 確認）；`setTimeout(loadHistoryForRail, 0)` 在每次 `render()` 被呼叫且 `circlesRecentSessions===null` 時觸發

### H-5 ★: `createRealSession` PATCH lifecycle → 'editing' 失敗（fire-and-forget, no awaited error check）
**Technical reasoning**:
- `createRealSession` 的 PATCH `/progress` 用 `page.evaluate(async sid => { ... })` — evaluate resolve 後丟棄 response（沒有 `await` 返回值，也沒有檢查 `resp.ok`）
- 若 PATCH 失敗，session lifecycle 停在 `created`
- 某些 server 端 filter 可能排除 `lifecycle=created` 的 sessions（`GET /api/circles-sessions` server-side filter = editing/completed）
- 此 hypothesis 若成立，目標 id 永遠不在 GET 回傳 → `circlesRecentSessions` 無法含此 id

**Evidence**: `createRealSession` evaluate body 沒有 `if (!resp.ok) return null`；但 `createRealSession` 只 return session id（POST 成功），PATCH 是 best-effort

---

## 4. Single Hypothesis to Pursue

**H-1 (+ H-2 加乘): 跨 run session 殘留累積 → 目標 id 被 slice(0,5) 排擠出 cache**

**Root cause**: `cleanupTracker.track()` 從未被呼叫 → afterEach Supabase DELETE 不執行 → 每次 run 在 DB 留下 1-2 個真實 editing sessions。多次 cross-plan smoke 後累積到 44+ sessions。`loadHistoryForRail` 的 `slice(0,5)` 硬性限制導致目標 id 幾乎必然被排除在前 5 之外，尤其在 parallel 3 vp 同時建新 session 時（H-2 加乘：各 vp 的新 session 互相競爭前 5 名）。

**Why flake not always fail**: 若 DB 殘留很少（第一次 run，或殘留恰好被其他機制清除），新建 session 有機會排入前 5，test 通過。殘留累積後，失敗率升高。跨 vp parallel 讓同一批 run 裡 3 個新 session 競爭前 5，更容易發生其中 1-2 個排不進去。

**Technical path**: 
1. `createRealSession()` 建立 session（POST + PATCH editing）→ session 的 `updated_at` 最新
2. 但其他 editing sessions 在 DB 中也存在（舊 runs 殘留 + 同 batch 其他 vp 的 session）
3. `GET /api/circles-sessions` 回傳全部 editing，sorted newest first，`slice(0,5)` 只取最新 5
4. 若殘留 sessions 夠多（44 筆），或 parallel vp 剛好比目標 vp 晚幾 ms 建 session（updated_at 更新），目標 id 被推出前 5
5. `forceRecentRailLoad` 的 `waitForFunction` 永遠看不到目標 id → 12s timeout → FAIL

---

## 5. Fix Scope Suggestion（NOT implementing — user gate required）

> 以下是 diagnosis 的邏輯延伸，供 user 決策用，agent **不執行任何修改**。

1. **必修（root cause）**: 在 spec 的 `createRealSession` 回傳後，立即呼叫 `cleanupTracker.track('circles', sessionId)` — 讓 afterEach 自動 DELETE 清理
2. **可選（防守）**: `loadHistoryForRail` 加 `_railInFlight` guard 防止並發
3. **可選（防守）**: `forceRecentRailLoad` 的 `waitForFunction` 改為等 `circlesRecentSessions !== null`（而非等含目標 id），分開「cache 已填入」vs「含目標 id」兩個 check

---

## 6. Evidence Summary

| 項目 | 值 | 來源 |
|---|---|---|
| fail AC | AC-1 (e2e-mobile-chrome Run 5) + AC-2 (e2e-desktop Run 2) | CLAUDE.md 任務描述 |
| error type | TimeoutError 12000ms | `test-results/offcanvas-delete-invalidat-*/error-context.md` |
| fail point | `forceRecentRailLoad` line 148 waitForFunction | error-context.md source trace |
| DB editing count | 44 進行中 | error-context.md page snapshot `e19` → `44` |
| track() calls | 0 | spec 全文 grep `track(` 無結果 |
| slice limit | 5 | `app.js:5533` `merged.slice(0, 5)` |
| inflight guard | 無 | app.js grep `_railInFlight` 無結果 |
| fullyParallel | true | `tests/e2e/playwright.config.js:13` |

---

*Generated by diagnose finder (read-only). No production/spec code was modified.*
