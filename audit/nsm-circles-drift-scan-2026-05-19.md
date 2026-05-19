# NSM ↔ CIRCLES Component Drift Scan (2026-05-19)

> Full inventory of paired / behavior-equivalent functions across CIRCLES (Plan B) and NSM (Plan C) front-end. Find-only per `feedback_find_first_fix_later_via_tracker` STANDING; no production / spec / git changes.
>
> **Trigger**: Bug A NSM 切題 ghost content (`b126937`) + Bug B NSM hint+example row position (`b126937`) both had the same shape — CIRCLES had a helper / pattern, NSM had a divergent copy that broke. User asked: 「還有多少這類 drift 藏在 code 裡？」
>
> **Method**: grep all `*Circles*` / `*Nsm*` / `*NSM*` declarations in `public/app.js` (9011 lines, 90 paired functions), pair-diff behavior, mark drift severity by predicted user-visible bug.
>
> **Skills cited**:
> - Karpathy §4.1 Think Before — assumption: drift exists where features share UX intent but evolved separately. Predicted areas before searching: cache invalidate, error retry, spinner clear, locked render gate, persist retry, draft localStorage.
> - Karpathy §4.4 Goal-Driven — each "drift (未撞)" row must predict a concrete user-visible bug. Rows without predictable bugs marked P2 or OK.
> - `feedback_three_iron_laws` IL-1 — root cause = paired helper drift, not the individual symptom.
> - RITUAL §3.19 spec citation — every row cites `app.js:NNNN` line numbers.

---

## §1 Summary

| Metric | Count |
|---|---|
| Components / helpers scanned | 32 |
| 一致（同 helper / behavior-identical） | 4 |
| 分開寫但一致（duplicated but behavior currently aligned） | 6 |
| drift（已修） | 3 |
| **drift（未撞）** ⚠️ | **15** |
| OK / not applicable | 4 |

### Top 5 user-visible risk drift（未撞）— priority抽 helper 順序

| Rank | Drift | Predicted user-visible bug | Severity |
|---|---|---|---|
| 1 | NSM PATCH `/progress` 無 `persistRetry` wrapper | 5xx transient → NSM 草稿 silent loss (same shape as P0-#266 CIRCLES fix) | **P0** |
| 2 | NSM 寫 `pmdrill:nsm:draft:` localStorage 但**從不讀取** | 後端 PATCH race / fail → CIRCLES 用 local recover、NSM silent 全失 | **P0** |
| 3 | `nsmEvalLoading` (Step 3 evaluate) **未納入** `renderResumeToast` | 用戶離開頁面後不見 toast → 以為評分失敗 / 重複按送出 | **P1** |
| 4 | NSM gate submit 無 `gateInflight` mutex | 用戶 double-click → 2 個 POST 同跑，race on result | **P1** |
| 5 | NSM Step 3 hint modal close 不 abort `_nsmStep3HintAbortController` | 快速關 + 重開 → 舊 dim 的 hint 灌入新 dim modal | **P1** |

---

## §2 Component Drift Matrix

### Form / Input layer

| # | Component / Function | CIRCLES 位置 | NSM 位置 | Drift 狀態 | 對應 user-visible 行為 | 嚴重度 |
|---|---|---|---|---|---|---|
| 1 | renderField (label + hint + example + input) | `app.js:4532` renderPhase1Field | `app.js:1552` renderNSMField / `app.js:1723` renderNSMDim | drift (Bug B 已修 NSM Step 3 align mockup 07 canonical) | dim/field 卡片排版 hint+example row | **P2 已修** |
| 2 | 切題時 reset draft state | `app.js:6049-6055` qcard click 內 inline reset + restore localStorage | `app.js:6457-6464` `data-nsm="start"` 內 inline reset (Bug A 已修)，**不 restore localStorage** | drift (Bug A partial 已修，**localStorage restore 仍 drift 未撞**) | 切題 ghost content (CIRCLES 已修，NSM Bug A partial 已修但未 restore local cache) | **P0 partial** |
| 3 | localStorage draft cache read | `app.js:6057 / 8356 / 8510` 三處讀 `pmdrill:circles:draft:` 並 merge 進 AppState | **0 處讀** `pmdrill:nsm:draft:`（line 2144 寫但無讀） | drift（未撞） | 後端 PATCH fail / race / 首次 PATCH 競賽 → NSM 草稿不可恢復 | **P0** |
| 4 | data-max char limit on textarea | `app.js:4564, 4932` `data-max` 屬性 | **無** `data-max` on nsm-rt-textarea | drift（未撞） | 輸入超長字 UI 不警示（雖然後端會擋） | P2 |
| 5 | fieldNonEmpty validator | `app.js:8960` `fieldNonEmpty()` 共用 | 同 8960 共用 | **一致** | submit disable 判斷 | OK |
| 6 | fieldMinLengthOk / parseFloor | `app.js:8968 / 8978` 定義但 **0 caller** | 同 0 caller | dead code — drift artifact | 無 user-visible 行為 | P2 |
| 7 | example expand 4 states (open/close/empty/loaded) | `app.js:4566` renderExampleExpand (CIRCLES side) | `app.js:1574-1591`/`1732-1749` inline 2 份 NSM 各自版本 | 分開寫但一致 (markup 一致 class 命名一致) | 範例 toggle 行為 | P2 |
| 8 | markdownBulletsToHtml | `app.js:3933` 共用 | 同 line 共用 (4042/4074/4172/4203 etc.) | **一致** | hint / example bullet render | OK |
| 9 | save indicator UI (4-state idle/saving/saved/error) | `app.js:3767` renderSaveIndicator + `3784` setPhase1SaveState | **無 NSM 等價** (triggerNsmSaveCycle line 2131 只 setTimeout 不 UI feedback) | drift（未撞） | NSM 用戶不知道是否儲存中 / 失敗；CIRCLES 有 4-state 視覺 | P1 |
| 10 | submit-block tip on disabled button click | `app.js:3805-3823` minLengthTipBound + showSubmitBlockTip | **無 NSM 等價** | drift（未撞） | NSM 點 disabled submit → 無回饋；用戶以為按鈕壞 | P1 |

### State / Lifecycle

| # | Component / Function | CIRCLES 位置 | NSM 位置 | Drift 狀態 | 對應 user-visible 行為 | 嚴重度 |
|---|---|---|---|---|---|---|
| 11 | ensureDraftSession | `app.js:3847` `ensureCirclesDraftSession` | `app.js:1777` `ensureNsmDraftSession` **+** `app.js:1978` inline `ensureNsmSession` (重複 helper！) | drift（未撞）— 2 份 NSM 副本 | inline 版**無 `_nsmPreflightInFlightForQid` guard** → 同時 click hint + submit 可能跑 2 個 POST，server-side dedupe 才避免；P0-NEW-6 跨 plan smoke 也命中 | **P1** |
| 12 | resetToHome | `app.js:3212` resetCirclesToHome (完整 32 lines reset) | **無 resetNsmToHome**；reset 散在 4 處 inline：`2659 / 2676 / 6110 / 6457-6464` | drift（未撞） | 各處 reset 欄位不一致；新增 AppState key 易漏 reset → ghost state；Bug-A fix 就是補 6457-6464 一處遺漏 | **P1** |
| 13 | persistRetry wrapper on PATCH | `app.js:3910 / 7218 / 7928 / 7980` 全部 PATCH 經 `window.persistRetry` | `app.js:2148` PATCH **直接 apiFetch 無 retry** | drift（未撞） | NSM PATCH 5xx → 草稿 silent loss；同 P0-#266 CIRCLES fix shape | **P0** |
| 14 | gateInflight mutex (double-click guard) | `app.js:141` AppState + `7843 / 7874 / 8240 / 8540` 4 處 guard | **無 nsmGateInflight** | drift（未撞） | 雙擊 NSM 送出 → 2 POST race | **P1** |
| 15 | recentSessions cache state | `app.js:74` circlesRecentSessions + `8697` invalidate after delete (B10/O-6) | **無 nsmRecentSessions** (renderNSMRecentRail line 6297 是空 stub) | drift（未撞） + 功能完全 missing | NSM home 沒有 recent rail；NSM session 刪除無 cache invalidate（因無 cache）→ 但 user 看不到 NSM recent 整個功能 | P1 (gap) |
| 16 | stale state | `app.js:36` circlesStale + applyPhase1StateOverlay 處理 | **無 nsmStale** | drift（未撞） | NSM 評分後修改 → 無 stale 警示；CIRCLES 有 | P2 |
| 17 | session loading state (during history detail fetch) | `app.js:120` circlesSessionLoading + `347-352` renderView loading spinner | **無 nsmSessionLoading**；line 8587 async fetch 無 UI feedback | drift（未撞） | offcanvas → NSM session 點開瞬間：CIRCLES 顯示 spinner，NSM 直接顯示 stale partial 後 flicker → 新 data | P1 |
| 18 | offcanvas delete + cache invalidate | `app.js:8672` _doOffcanvasDelete 共用 (B10/O-6 已修 CIRCLES side) | 同 line 共用，**但 line 8697 只 invalidate `circlesRecentSessions`** | drift（未撞） | 因 NSM 無 recentSessions cache 概念，刪 NSM 無 cache 需 invalidate；但若未來補 NSM recent rail 會立刻撞 bug | P2 (latent) |

### AI Surface

| # | Component / Function | CIRCLES 位置 | NSM 位置 | Drift 狀態 | 對應 user-visible 行為 | 嚴重度 |
|---|---|---|---|---|---|---|
| 19 | gate render | `app.js:5136` renderCirclesGate | `app.js:1414` renderNSMGate | 分開寫但一致 (用相同 CSS class `.gate-content`/`.gate-wrap`/`.gate-transition`/`.gate-item`) | gate 三態 UI | OK (mockup-as-spec 對齊) |
| 20 | gate item suggestion label | `app.js:5298` `'修正' / '建議'` (無 colon) + `<div class="gate-item__suggestion-body">` | `app.js:1383` `'修正方向：' / '建議：'` (有 colon) + `<span class="gate-item__suggestion-body">` | drift（未撞） | 兩個 gate 的 suggestion 區塊 label 文案+structure 不同；mockup 04 vs mockup 08 不同來源 | P2 |
| 21 | evaluator (Phase 3 / Step 4 generate) | `app.js:6801` renderCirclesPhase3 | `app.js:1670` renderNSMStep3 (含 submit logic inline at `2068-2108`) | 分開寫但一致 (error UI 共用 `.error-wrap` class) | 評分流程 | OK |
| 22 | spinner clear on eval error | `app.js:7298` F-CT1.2 fix (set phase3Error → render → button re-enable) | `app.js:2089` F-CT1.1 fix (set nsmEvalLoading=false BEFORE render) | drift（已修 — 兩邊都修） | 評分 fail 後 spinner 卡死 | **P0 已修** |
| 23 | gate error retry button | `app.js:5341` `data-gate-action="retry"` (2 actions: retry / back) | `app.js:1474-1475` `data-nsm-gate-action="retry"` + `back-to-step2` | 分開寫但一致 | gate fail 後 retry | OK |
| 24 | resume toast in-flight detect | `app.js:3143` circlesEvaluating + `3146` nsmGateLoading | 同 line — **但無 nsmEvalLoading**（Step 3 evaluate） | drift（未撞） | 用戶送出 NSM Step 3 評分後切到 CIRCLES tab → **不出 toast**；以為評分沒在跑 | **P1** |
| 25 | already-scored retry guard | `app.js:6642 / 6892` AC-4 explicit guard (button disabled + click no-op) | **無**；靠 `applyNSMStateOverlay` (line 3719-3763) 把 submit 換成「查看評分結果」按鈕 | drift（未撞） | NSM 防止 re-evaluate 靠 UI overlay；若 overlay regex 失敗（如 button HTML 改），re-evaluate 就會發生 | P2 |

### Hint Modal

| # | Component / Function | CIRCLES 位置 | NSM 位置 | Drift 狀態 | 對應 user-visible 行為 | 嚴重度 |
|---|---|---|---|---|---|---|
| 26 | hint modal shell | `app.js:3959` renderHintModalShell | `app.js:4124` _renderNSMHintModalShell (Step 2) + `app.js:4231` _renderNSMStep3HintModalShell (Step 3) + `app.js:4373` _renderNSMStep1HintModalShell (Step 1) — 4 份 shell | drift（未撞） — code duplication | shell HTML 4 份維護；單一 mockup 變動 4 處改 | P2 |
| 27 | hint cache | `app.js:4020` `_hintCache` | `app.js:4121` `_nsmHintCache` + `4228` `_nsmStep3HintCache` + `4370` `_nsmStep1HintCache` — 3 份 cache | drift（未撞） | 4 個獨立 cache；無統一 invalidate；切題後舊 hint 仍 cached | P2 |
| 28 | hint API auth pattern | `app.js:4061` 用 `fetch`（無 apiFetch / 無 401 refresh） — public endpoint `/api/circles-public/hint` | Step 2/3: `4190 / 4301` 用 `fetch` public; Step 1: `4476` 用 `window.apiFetch` (auth required `/api/nsm-sessions/.../hints`) | drift（未撞） | Step 1 hint 401 race 會 fail；CIRCLES + NSM Step 2/3 public 不受影響 | P2 |
| 29 | hint modal close abort controller | `app.js:4106-4114` closeHintModal aborts `_hintAbortController` | `app.js:4220-4224` closeNSMStep2HintModal **only aborts `_nsmHintAbortController`** — `_nsmStep3HintAbortController` 與 `_nsmStep1HintAbortController` 永不被關閉時 abort | drift（未撞） | Step 3/Step 1 hint modal 關閉後 in-flight fetch 繼續；快速關 + 開不同 dim → 舊 response 灌新 modal | **P1** |
| 30 | retry button on hint error | `app.js:4101` `data-hint-action="retry"` + _bindHintHostEvents | `app.js:4339-4358` data-nsm-modal-retry + data-nsm-step3-modal-retry + data-nsm-step1-hint-retry — 3 個 selector | drift（未撞） | retry 邏輯各自實作；維護成本高 | P2 |

### Navigation / Progress

| # | Component / Function | CIRCLES 位置 | NSM 位置 | Drift 狀態 | 對應 user-visible 行為 | 嚴重度 |
|---|---|---|---|---|---|---|
| 31 | progress bar | `app.js:4511` renderProgressBar (.progress class — Phase 1) **+** `app.js:6515` renderCirclesProgressBar (.circles-progress class — Phase 3) — CIRCLES 內 2 份 | `app.js:6226` renderNSMProgress (.nsm-progress class) | drift（未撞）— CIRCLES 內部 2 份 + 不通用於 NSM | progress bar 各自實作 7-step CIRCLES vs 4-step NSM；CIRCLES Phase 1 vs Phase 3 用不同 class 命名 inconsistent | P2 |
| 32 | navbar tabs | `app.js:3098-3099` `data-nav="circles" / "nsm"` 同 navbar | 共用 navbar | **一致** | tab 切換 | OK |
| 33 | loadStats | `app.js:5871` loadCirclesStats 含 hint-short / hint-long (含 streak weeks) | `app.js:5900` loadNsmStats **無 hint-short / hint-long** (line 5915-5917 只 set completed/active/weekly) | drift（未撞） | NSM home stats strip 沒「已完成 N / 100 題」hint；CIRCLES 有 | P2 |
| 34 | pickDisplayed (random 5 with reshuffle exclude) | `app.js:5525` circlesPickDisplayed 支援 `excludeCurrent` | `app.js:6206` nsmPickDisplayed **無 excludeCurrent** | drift（未撞） | NSM 重新抽 5 題常常還是同 5 題（窄 filter 時更糟）；違反 `feedback_5_random_questions` memory | **P1** |
| 35 | search field coverage | `app.js:5517-5519` 搜尋 `company / product / problem_statement` | `app.js:6214-6215` 搜尋 `company / industry` **無 scenario** | drift（未撞） | NSM 搜尋情境關鍵字（如「外賣」）無結果 | P2 |

---

## §3 Detailed drift（未撞）descriptions

> 以下對 §2 標為「drift（未撞）」且嚴重度 P0/P1 的 row 詳述 predicted bug。

### D-1 (P0) — NSM PATCH 無 persistRetry wrapper [row 13]

**Location**: `app.js:2148` (`triggerNsmSaveCycle`)
**CIRCLES counterpart**: `app.js:3910` 全部 PATCH 經 `window.persistRetry.persistRetry(fn)` 包裝（最多 3 次 retry on 5xx / network error）。
**NSM 現況**:
```js
window.apiFetch(path, { method: 'PATCH', ... })
  .catch(function (err) { console.error('[nsm-save] PATCH failed:', err); });
```
單次 attempt，失敗只 console log。
**Predicted bug**: 用戶輸入時 backend 504 / 502 / connection reset → CIRCLES retry 3 次後通常成功 / NSM 直接放棄。下次 PATCH 觸發前用戶 reload → 草稿丟失。**與 P0-#266 CIRCLES persistRetry session-object 修同 shape**。
**Reproduction**:
1. user 編 NSM Step 2 草稿
2. mock backend 連續回 503 三次
3. 等 2 秒 (debounce) → 觀察 console: `[nsm-save] PATCH failed: ...`
4. user reload → 草稿空（localStorage 雖有但無 restore 路徑，見 D-2）
**Suggested fix scope**: NSM PATCH 加 `window.persistRetry.persistRetry(fn)` 包裝；驗證 `nsm_sessions` 後端 5xx → 草稿不丟。

### D-2 (P0) — NSM localStorage write-only, never read [row 3]

**Location write**: `app.js:2144` (`triggerNsmSaveCycle`)
**Location read**: **0 處**
**CIRCLES counterpart**: 寫 `app.js:3892`；讀 3 處 `app.js:6057 (qcard click) / 8356 (boot resume) / 8510 (restoreCirclesPhase1FromSession)`，每處都 merge local fresher / backend empty fallback。
**Predicted bug**: 後端首次 PATCH 因為 race（card click → submit before debounce fires）→ NSM session row 仍是空 stub；用戶 reload → CIRCLES 用 local 恢復、**NSM 顯示空表單**。Live Supabase 觀察「`nsm_sessions` lifecycle 'created':999 vs 'gated':1 = 99.9%」可能部分被此 drift 放大。
**Reproduction**:
1. user 開 NSM Step 2，輸 100 字 → debounce 800ms
2. 在 800ms 內 close tab (或 fire offline event 模擬網路斷)
3. localStorage 有；後端空
4. reload → AppState 從 backend 讀取 empty → user 看到空表單
**Suggested fix scope**: 在 `app.js:8547` NSM history restore branch 加上等同 `restoreCirclesPhase1FromSession` line 8503-8527 的 localStorage merge 邏輯；qcard 點擊（line 6396）後也加 cache restore。

### D-3 (P1) — nsmEvalLoading 不出 resume toast [row 24]

**Location**: `app.js:3143-3165` (`renderResumeToast`)
**現況**: 偵測 `circlesEvaluating` / `nsmGateLoading` / `_phase4FinalReportFired`，**未偵測 `nsmEvalLoading`**（Step 3 evaluate）。
**Predicted bug**: 用戶在 NSM Step 3 按「送出，取得 AI 評分」 → API 跑 30 秒 → 用戶切到 CIRCLES tab → **無 toast**。用戶等不到回應，以為失敗，可能重新 submit (但 button 已 reset 在 `2106` finally block 跑時)，或回去看時 evaluation 已完成但用戶錯過 Step 4 自動跳轉。
**Reproduction**:
1. NSM Step 3 填完按送出
2. 立刻點 navbar CIRCLES tab
3. 觀察上方無 toast (CIRCLES 評分時有)
**Suggested fix scope**: line 3146 後加 `var nsmEvalAway = AppState.nsmEvalLoading && !(AppState.view === 'nsm' && AppState.nsmStep === 3);` + toast copy「NSM 評分仍在背景進行中」。

### D-4 (P1) — NSM 無 gateInflight mutex [row 14]

**Location**: `app.js:141` AppState.gateInflight 是 CIRCLES-only；NSM submit handler `app.js:1973-2110` 無同等 guard。
**Predicted bug**: 用戶在 NSM Step 2 雙擊「提交審核」(slow phones) → 2 個 POST 同時跑 → 後端可能建 2 個 gate row / OpenAI 帳單翻倍 / UI race 用較晚回應覆蓋較早。
**Reproduction**:
1. NSM Step 2 fill in
2. throttle network to 3G
3. 連續快速 click 「提交審核」 3 次
4. Network tab → 3 個 /gate POST in-flight
**Suggested fix scope**: 加 `AppState.nsmGateInflight` mutex；submit handler 入口 check + finally set false（mirror `app.js:7910 / 8013`）。

### D-5 (P1) — NSM Step 3 hint modal close 不 abort [row 29]

**Location**: `app.js:4220` (`closeNSMStep2HintModal`) 只 abort `_nsmHintAbortController`。`_nsmStep3HintAbortController` (line 4229) 與 `_nsmStep1HintAbortController` (line 4371) 只在 **下次 open** 時被 abort（line 4298 + 4470）；ESC / X / backdrop / 「了解了」 close 全不 abort。
**Predicted bug**: 用戶在 NSM Step 3 reach dim 開 hint → loading → ESC 關 → 立刻開 depth dim hint → reach 的舊 response 比 depth 早回 → 灌入 depth modal (因 line 4311 `current` 仍 truthy)。
**Reproduction**:
1. NSM Step 3 開 reach hint，slow network
2. ESC 關
3. 立刻開 depth hint
4. reach response 回來，因為 abort 沒跑 → 寫進 depth modal
**Suggested fix scope**: closeNSMStep2HintModal 同時 abort 三個 controller。

### D-6 (P1, partial 已修) — NSM 切題不 restore localStorage [row 2]

**Location**: `app.js:6457-6464` Bug-A fix 只 reset draft，未從 localStorage 恢復。
**CIRCLES counterpart**: `app.js:6057-6068` reset 後立刻嘗試 restore `pmdrill:circles:draft:` 進 AppState — 用戶若上次同題草稿仍在 local，自動帶回。
**Predicted bug**: NSM 用戶切題 → 切回原題 → 草稿空（即使 local 有）。CIRCLES 行為相反（local 有就帶回）。
**Reproduction**:
1. NSM 選 A 公司題 → Step 2 填 NSM 「DAU」
2. 不送出，回 Step 1 (back button)
3. 改選 B 公司題 → Step 2 看到空表（OK）
4. 再回 Step 1 → 選 A → Step 2 → **空表**（CIRCLES 同情境會帶回 DAU）
**Suggested fix scope**: line 6457-6464 後加 localStorage merge mirror `app.js:6057-6068` pattern (with `pmdrill:nsm:draft:` key + nsmDefinition/nsmBreakdown shapes)。**注意：依賴 D-2 先有 read 路徑**。

### D-7 (P1) — resetCirclesToHome 無 NSM 等價 [row 12]

**Location**: `app.js:3212-3255` resetCirclesToHome 集中重設 30+ field；NSM reset 散在 4 處 inline (2659, 2676, 6110, 6457-6464)，欄位選擇各異。
**Predicted bug**: 新增 AppState NSM key（如未來加 `nsmStep3ConclusionDraft`）易漏 reset → 跨 session 殘留。Bug-A fix 本身就是補 6457-6464 一處之前漏掉的 reset，**證明此模式高風險**。
**Reproduction (歷史 Bug-A repro)**:
1. 跑 NSM A → 評分完成 → 回首頁
2. 選 NSM B → 看到 A 的 NSM definition 殘留（Bug-A 已修此處）
3. 但其他 reset 點仍可能漏 — 例如 nsmDimExampleExpanded 散在多處不一定 reset
**Suggested fix scope**: 抽 `resetNsmToHome()` helper；4 處 inline reset 統一呼叫；加 jest test enumerate AppState NSM keys vs reset coverage。

### D-8 (P1) — NSM 無 sessionLoading state [row 17]

**Location**: `app.js:347-352` renderView 有 `circlesSessionLoading` 顯示 spinner；`app.js:8587` NSM async fetch 無 UI feedback。
**Predicted bug**: offcanvas 點 NSM session → 瞬間 stale partial data render → 1-2 秒後 full data flicker → 用戶看到「閃爍」效果不專業。
**Reproduction**:
1. throttle 3G
2. offcanvas → 點 NSM session
3. 看到 stale partial → flicker → full data
**Suggested fix scope**: 加 `nsmSessionLoading` AppState + renderView NSM branch loading guard mirror CIRCLES。

### D-9 (P1) — ensureNsmDraftSession 2 份 [row 11]

**Location**: `app.js:1777` 有 `_nsmPreflightInFlightForQid` guard 防止同 qid 並發；`app.js:1978` 是 submit handler inline 另一份 `ensureNsmSession`（**無 guard**）。兩者都 POST `/api/nsm-sessions`。
**Predicted bug**: 用戶 click hint button (line 4458) 同時 submit (line 1973) → hint path 經 1777 (有 guard)，submit 經 1978 (無 guard) → 兩個 POST 同時跑 → backend 可能建 2 個 session row（看後端 dedupe 邏輯）。
**Reproduction**:
1. NSM Step 2 填完 + 點「提示」打開 hint modal 同一瞬間（slow phone）
2. Network tab → 觀察 2 個 POST /api/nsm-sessions
**Suggested fix scope**: 刪 inline `ensureNsmSession`（line 1978-1992），統一呼叫 line 1777 helper。

### D-10 (P1) — pickDisplayed reshuffle 無 excludeCurrent [row 34]

**Location**: `app.js:5525` circlesPickDisplayed 支援 excludeCurrent；`app.js:6206` nsmPickDisplayed 無。
**Predicted bug**: NSM 用戶按「隨機選題」按鈕 → 因為無 exclude → 可能還是同 5 題（尤其有 filter 時 pool 小）。違反 `feedback_5_random_questions` STANDING memory「reshuffle re-picks 5」期望含 fresh subset。
**Reproduction**:
1. NSM Step 1 篩 SaaS（pool 縮小）
2. 按隨機選題 5 次
3. 觀察前 3 題重複出現比例
**Suggested fix scope**: nsmPickDisplayed 加 `clearSelection` 之外的 `excludeCurrent` arg；shuffle 前 filter 出非當前 5 題的 pool（若剩 >= 5）。

### D-11 (P1) — NSM 無 save indicator UI [row 9]

**Location**: `app.js:3767` renderSaveIndicator CIRCLES 4-state；NSM 完全無。
**Predicted bug**: NSM 用戶輸入後不知是否儲存中 / 已儲存 / 失敗離線；CIRCLES 用戶有清楚 visual。
**Reproduction**: NSM Step 2 輸入；觀察周圍無任何 saving indicator。
**Suggested fix scope**: 抽共用 `renderSaveIndicator(state)` + nsmPhase2SaveState（mirror circlesPhase1SaveState）。

### D-12 (P1, gap) — renderNSMRecentRail 是空 stub [row 15]

**Location**: `app.js:6297-6299`：
```js
function renderNSMRecentRail() {
  return '<aside class="nsm-recent"><div class="nsm-recent__label">近期練習</div></aside>';
}
```
**CIRCLES counterpart**: `app.js:5824` 完整 recent rail with sessions list, click → resume.
**Predicted bug**: NSM 用戶在 home 看不到近期練習，只能走 offcanvas（多 1 click）。功能完全 missing。
**Reproduction**: 開 NSM home，看右側 desktop rail → 只有 label，無 sessions。
**Suggested fix scope**: 抽共用 `renderRecentRail(kind)` helper；NSM 也要 `nsmRecentSessions` AppState + loadHistoryForRail 對應 NSM 分支；offcanvas delete 也要 invalidate（見 D-13 latent）。

### D-13 (P2, latent) — offcanvas delete cache invalidate NSM gap [row 18]

**Location**: `app.js:8697` `AppState.circlesRecentSessions = null;` — 刪 NSM session 也走此分支但因 NSM 無 recent cache 無 effect。
**Predicted bug**: 未來補 D-12 加 nsmRecentSessions cache 後，line 8697 不加 NSM cache invalidate → NSM 刪後 home 仍顯示。**latent — 跟 D-12 修一起補**。
**Suggested fix scope**: 8697 同時 set `AppState.nsmRecentSessions = null;`（after D-12 lands）。

---

## §4 Recommended 抽 helper sequence

> 依 user-visible 嚴重度 + 修改範圍排優先順序。所有抽 helper 必走 brainstorm + writing-plan + mockup-as-spec 流程；本 audit 只 find，不 propose 實作。

| Order | Item | Why first | Effort |
|---|---|---|---|
| 1 | D-1 NSM persistRetry wrap | P0 data loss；改 1 行包 retry helper | XS |
| 2 | D-2 NSM localStorage restore (含 D-6 切題 restore) | P0 data loss；mirror CIRCLES line 8503-8527 pattern | S |
| 3 | D-3 nsmEvalLoading 進 resumeToast | P1；+1 條件 1 處 copy；極小 risk | XS |
| 4 | D-4 nsmGateInflight mutex | P1；2-3 處 set/check | XS |
| 5 | D-5 NSM hint modal close 全 abort | P1；補 2 行 abort | XS |
| 6 | D-7 resetNsmToHome helper | P1；refactor 4 處 inline → 1 helper；jest enumeration test | M |
| 7 | D-9 刪 inline ensureNsmSession 重複 | P1；refactor 15 行 → 統一 helper | S |
| 8 | D-8 nsmSessionLoading state | P1；mirror circlesSessionLoading | S |
| 9 | D-10 NSM excludeCurrent reshuffle | P1；mirror line 5527-5531 邏輯 | XS |
| 10 | D-11 NSM save indicator UI | P1；抽 renderSaveIndicator(state, kind) 通用；NSM 需 nsmPhase2SaveState | M |
| 11 | D-12 NSM recent rail (功能補) | P1 gap；需新功能 design + mockup-as-spec | L |
| 12 | D-13 latent — 與 D-12 同 ship | — | XS (依附) |
| 13 | Row 26-30 hint modal unify (4 shell → 1) | P2 maint debt | L |
| 14 | Row 31 progress bar class unify | P2 maint debt | S |

---

## §5 STANDING memory 建議內容

> User 可複製貼到 `~/.claude/projects/-Users-albertpeng-Desktop-claude-project-First-Principle/memory/` 新檔（建議檔名 `feedback_nsm_circles_shared_helper_mandate.md`），並加入 MEMORY.md index。

```markdown
# NSM ↔ CIRCLES 共用 helper 強制 STANDING

**Trigger**: 2026-05-19 drift scan 發現 15 個 drift（未撞）、3 個已撞修（Bug A / Bug B / F-CT1.1）— 證明「分開寫但意圖共用」模式高風險。

**規則**:
1. 任何新增 / 修改 CIRCLES helper 必同步 check NSM 是否該也有；無則記入 `audit/e2e-master-tracker.md` §3 等 user 決定是否抽。
2. 抽 helper 順序看 `audit/nsm-circles-drift-scan-2026-05-19.md` §4 priority list。
3. 新增 AppState key 若兩邊都有概念（如 *Loading / *Error / *Stale / *Draft）必同時加；reset 必過 `resetXxxToHome` helper 不 inline。
4. PATCH 進度必經 `window.persistRetry`；不可直接 `apiFetch().catch(log)`。
5. localStorage 草稿 write 必對應 read 路徑（restore on history + qcard click）；只 write 無 read 視為 dead code。
6. 任何 in-flight async (gate / evaluate / hint) 必納入 `renderResumeToast` detect；切 view 必有 toast。
7. 任何 modal close path 必 abort 所有 in-flight controllers；不可只 abort 部分。
8. 任何 submit handler 必有 inflight mutex；雙擊防 race。

**例外**: NSM 是 4-step、CIRCLES 是 7-step；steps 數量本身不抽 — progress bar render fn 可保留各自 markup，但 component class 命名要對齊（`.xxx-progress__step` pattern）。

**Audit baseline**: 2026-05-19 — 32 components scanned，15 drift（未撞）；下次 audit 預期 N 下降。
```

---

## §6 Verification

**Production code diff**: **ZERO** — audit-only, no production changes（per `feedback_find_first_fix_later_via_tracker` STANDING）。
**Files read**: `public/app.js` (9011 lines), `audit/e2e-master-tracker.md`.
**Files written**: this audit doc + 1 tracker append。
**Git stage / commit**: **none**.
