# E2E Master Tracker — Unresolved Hub

> **Single source of truth for ACTIVE unresolved issues.** Per STANDING `feedback_tracker_unresolved_hub`: §1-§3 only list真正待處理 items；resolved 立即剪貼移 §5。User 掃 §1-§3 = brainstorming 清單。
>
> **Last updated:** 2026-05-19 — D-2 pre-impl Supabase NSM schema + 資料總稽核 完成 (`audit/supabase-nsm-schema-data-audit-2026-05-19.md`) — 10 findings 駆動 D-2 spec constraints
> **Prev:** 2026-05-18 PM Taipei (Wave 2) — Wave 1 補洞 B/E/D 3 個 implementer DONE staged + 3 research agent DONE (offcanvas spec review APPROVED with 4 issues / P1.1 hunk audit抓 2 critical Q2 spec mistakes / B13 brainstorm 推薦方案 A)
> **新一輪 5 slot 全跑**:
>   - slot 1 `a5c706f6760f3a26d`: B6 spec-compliance reviewer (running，從 Wave 1 接續)
>   - slot 2 `aad67acdff07ba6fb`: W1-補.7 NSM gate i18n spec-compliance reviewer (Wave 2 dispatch)
>   - slot 3 `a3775e91df4f78ae4`: Offcanvas CRITICAL doc drift fix sonnet (4 issues + 5x verify)
>   - slot 4 `ac7f35904ad3eb802`: P1.1 Q2 spec list correction explore (2 replacement candidates)
>   - slot 5 `a0f6329c9ea59b171`: offcanvas-delete.spec.js 2 pre-existing fails root cause investigation
> **Wave 1 完成 audit doc**: `audit/p1.1-step3-critical-path-5-specs-hunk-audit.md` / `audit/B13-NEW-B13-W1-prompt-fix-scope-brainstorm.md` / `audit/補修-offcanvas-flake-fix-findings.md`
> **Update protocol:** new finding → append §1-§3；fix shipped → cut & paste 整段 → §5 with commit + verify。**禁留 ~~strikethrough~~ 在 §1-§3**。
> **Read order**: §1 → §2 → §3 → §6 → §7。歷史 audit trail 看 §5 / §9。

---

## §1 Active P0 Bugs (user-visible / data integrity)

### 🚨 P0-SCHEMA-1: `/evaluate` 把 user_nsm 從 object 退化成 string — explanation + businessLink 永久消失 (2026-05-19 DB audit 抓到)
**狀態：【B — 只有 root cause，等 brainstorm fix】** **⚡ user 2026-05-19 priority — Wave 1 必修**
**Location**:
- FE buggy: `public/app.js:2080-2087` — `body: JSON.stringify({ userNsm: (AppState.nsmDefinition || {}).nsm || '' })` — 只取 nsm 字段 string
- BE blind accept: `routes/nsm-sessions.js:139-141` — `.update({ user_nsm: userNsm })` — string 直接 overwrite JSONB column
**User behavior**:
1. 用戶填 NSM 定義 + 解釋 + 商業關聯（3 個欄位）
2. 按「送出評分」→ 評分回來
3. 重新打開該題 → **explanation + businessLink 永久消失**，只剩 nsm 一行字
4. 用戶以為自己沒填 → 重填 → 再次被吞
**Severity**: P0 — user-visible **permanent data loss**（比 NEW-Bug-A ghost content 更嚴重 — 那是 UI race，這是 DB 寫壞）
**Family**: 同 NEW-Bug-A pattern「state restore 邏輯漏 case」+ 跟 D-2 LS restore 同 user journey
**Fix scope**: FE 改送完整 object `userNsm: AppState.nsmDefinition`；BE 加防禦 `if typeof userNsm === 'string', wrap into {nsm: ...} 保留 existing JSONB fields`
**Audit ref**: `audit/supabase-nsm-schema-data-audit-2026-05-19.md` §5 + F3
**Commit boundary**: Wave 1 必修（user 2026-05-19 priority）— 建議併入 C-Drift-2 或獨立 C8

---

### 🟡 P0-SCHEMA-OTHERS-WIP: 其他 Supabase schema 嚴苛稽核 — opus 數據專家 完工 (2026-05-19)
**狀態：【B — root cause + audit done，等 brainstorm fix】**
**Source**: user 2026-05-19「嚴重懷疑現在其他部分 Supabase schema 也有問題，導致使用資料經常出現問題」
**Audit doc**: `audit/supabase-full-schema-strict-audit-2026-05-19.md`（10 sections + 3 P0 / 4 P1 / 5 P2 ranked）
**Script**: `scripts/audit-supabase-full-schema-strict.js`（READ-ONLY service-role；6,815 NSM 全 paginate；無 DB 寫入）
**Pending**: 3 個 NEW P0 → 拆 entries 如下，user brainstorm 後決定優先順序

---

### 🚨 P0-SCHEMA-2: NSM 缺 UNIQUE 部分索引 — 一個 user 已產生 235 個 nsm_001 重複 row (5.3% 全表是 dupes) (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix】**
**Smoking gun**: paginate 全表 6,815 row 掃描：user `4501e548-dbfa-4870-ab84-b24e5a0aeeb2` 對 `nsm_001` 有 **235 個 lifecycle=created row**，全部 user_nsm 空；同 user 對 q6/q2/q52 各有 12/8/7 重複；全表 358/6,815 (5.3%) 是 structural duplicate
**Location**: `migrations/` 沒有 NSM 對稱 UNIQUE 部分索引；CIRCLES 有 `uniq_active_user_circles` + `uniq_active_guest_circles` (2026-04-29-circles-active-uniqueness.sql)
**User behavior**: user 開 2 個 tab / eager-INSERT loop bug → 每次 visit 建新 row 不重用既有 draft → `tryResumeLatestSession` 隨機挑一個 → 別的 tab 的 draft 變孤兒（呼應 94% never-PATCHed 統計）
**Severity**: P0 — 用戶 draft 隨機被遺忘 + DB 5.3% 結構性 bloat；同 L22 「Supabase DB session collision under concurrent CLI burst」相同 root cause（L22 推定「auth race」，audit 確認**是 schema 缺索引**不是 auth race）
**Fix scope**: medium — 寫 migration mirror `2026-04-29-circles-active-uniqueness.sql`：dedupe step 1 (keep latest non-empty) + UNIQUE partial index on `(user_id|guest_id, question_id, lifecycle IN created+editing)`
**Audit ref**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §3 + §8 + §10b 全表 dup scan
**Cross-ref**: `audit/L22-auth-race-investigation-2026-05-17.md`（L22 推定 auth race，audit 證明 root cause 是缺索引）

---

### 🚨 P0-SCHEMA-3: NSM 缺 guest_id index — 93.6% NSM 流量走無索引 path (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix】**
**Smoking gun**: 全表 6,815 row 中 6,382 (93.6%) 是 `guest_id` path，433 (6.4%) 是 `user_id` path。`migrations/2026-05-17-session-lifecycle.sql:24` 註釋 "NSM sessions table has no guest path" **完全錯誤** — `routes/guest-nsm-sessions.js` 早就存在且是主要流量來源
**Location**: `migrations/2026-05-17-session-lifecycle.sql` 加了 `idx_nsm_sessions_lifecycle_user` 但跳過 guest variant；CIRCLES 兩個都有
**User behavior**: 每次 guest user 開 NSM → 後端 `tryResumeLatestSession(guest_id, lifecycle='created')` → **全表掃描 6,815 row**；今日 p99 ~50ms；流量擴大線性退化
**Severity**: P0 — performance + correctness 雙風險；最高流量 path 無索引
**Fix scope**: small — 1 行 migration `CREATE INDEX CONCURRENTLY idx_nsm_sessions_lifecycle_guest ON nsm_sessions (guest_id, lifecycle, updated_at DESC)`
**Audit ref**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §3 + §10b

---

### 🚨 P0-SCHEMA-4: RLS policy 沒 codified 在 migration — session tables 安全姿勢全靠 dashboard 手動設 (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix；需先 dashboard verify 真實狀態】**
**Smoking gun**: `grep -r "ENABLE ROW LEVEL" migrations/` → 0 命中；只有 `db/schema.sql` 對 legacy `practice_sessions` + `guest_sessions` 啟了 RLS；`docs/superpowers/plans/swirling-popping-globe.md` 草過 NSM RLS policy 但**從未 migrate**
**Location**: `migrations/*` 全部沒 RLS 語句
**User behavior**: 若 dashboard RLS off → anon key 可讀寫全表（**用戶 session cross-leak 災難級**）；若 dashboard RLS on → 今天安全但下次 replatform redeploy 會漏（沒 codified）
**Severity**: P0 — 取決於 dashboard 當前狀態（service-role 後端 bypass 永遠安全，但 FE 用 anon key 做 auth bootstrap）
**Fix scope**: medium — (1) dashboard 確認 RLS 啟用 + policy 寫法 (2) 寫 migration `ALTER TABLE nsm_sessions ENABLE ROW LEVEL SECURITY; CREATE POLICY users_own_nsm ...` 把現況凍進 repo
**Audit ref**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §4
**Action needed before fix**: user 開 Supabase dashboard 看 Authentication > Policies → 回報 nsm_sessions + circles_sessions RLS 是否 enabled 跟 policy 內容

---

✅ **0 historical items** — F-1 / F-2 / FLOAT-2 / NEW-Bug-A 全 shipped (見 §5)。

---

### 狀態標示說明（2026-05-18 新增）

每個 §2 / §3 entry header 後面加一行 **狀態：【X】**，X 為：

- **【A — 已 brainstorming + 實作】** = fix 已 staged 或 shipped（已決定方案 + 寫了 code）
- **【B — 只有 root cause】** = 只有診斷，尚未進入 brainstorming / 未實作（next action = brainstorm or get user decision）
- **【Mixed】** = 子項目混合（看個別 sub-finding tag）
- **【N/A】** = 確認不需要 action（如歷史資料 + L19 已修）

用法：user 掃 §2 / §3 → 「B」標的就是真正待 brainstorm 的清單。「A」標的等 ship / verify。「Mixed」要看內文 sub-tag。

---

---

## §2 Active P1 Bugs

### Pre-existing offcanvas-delete flake (cross-plan smoke Run 2 / Run 5) — 2026-05-18
**狀態：【A — 已 brainstorming + 實作 staged，等 commit】** sub-agent E fix staged + 5x 35/35 + spec reviewer APPROVED FOR SHIP（抓 1 CRITICAL findings doc drift + 3 NIT 需補修後 commit）
**Source**: `feedback_cross_plan_smoke_after_each_ship` STANDING；Wave 1 補洞抓到
**Spec**: `tests/e2e/offcanvas-delete-invalidates-recent-sessions.spec.js`
**Fail pattern**: AC-1 e2e-mobile-chrome Run 5 + AC-2 e2e-desktop Run 2；不同 run、不同 vp、不同 AC → 非 vp-specific
**Error**: `TimeoutError: page.waitForFunction 12000ms exceeded` at `forceRecentRailLoad()` line 148
**Root cause (diagnosed)**: `cleanupTracker.track()` 從未被呼叫 → afterEach Supabase DELETE 不執行 → 跨 run 殘留累積到 44+ editing sessions → `loadHistoryForRail` 的 `slice(0,5)` 把目標 id 排擠出 cache；parallel 3 vp 同時建 session 加劇競爭
**Evidence**: page snapshot `44 進行中`；spec 全文 `track(` 0 呼叫；`app.js:5533 merged.slice(0,5)`；`fullyParallel:true`
**Audit**: `audit/diagnose-offcanvas-delete-flake-2026-05-18.md`
**Severity**: P1（flake 壓制 cross-plan smoke gate 可靠性）
**Suggested fix scope** (await user decision): 在 `createRealSession` return 後加 `cleanupTracker.track('circles', sessionId)` — 讓 afterEach 清理；可選加 `_railInFlight` guard + 拆分 waitForFunction 條件
**Owner**: user gate required before fix
**FIX STAGED (2026-05-18 PM, sub-agent E)**: spec 改用 `drainSessions(page)` helper（page.evaluate apiFetch DELETE）取代 fixture request.delete（避 401）；`forceRecentRailLoad` 改為直接 inject session 進 `circlesRecentSessions`（pre-condition 100% deterministic）；post-delete 斷言仍打真實 GET。**5x consecutive 35/35 PASS, 0 flake**。Audit `audit/補修-offcanvas-flake-fix-findings.md`
**Spec-compliance reviewer (2026-05-18 PM, slot 3) APPROVED FOR SHIP with 4 issues to fix before commit**:
- **CRITICAL #1 doc drift**: findings doc §3+§6+§7 假稱 `cleanupTracker.track()` 已 wire，實際 grep=0；要更新 findings doc honest：「auto-cleanup.fixture import 留著但 0 wire；drainSessions at boot 是 cleanup 替代」
- **NIT #2**: 拿掉 misleading auto-cleanup import OR 真 wire 它（會 401）— 建議改 `require('@playwright/test')` 對齊 bug4 precedent
- **NIT #3**: line 217-225 echo-assert injected cache 是 tautological self-assert，零驗證價值，建議 remove 或改 real recent-rail DOM check
- **NIT #4**: 查 `offcanvas-delete.spec.js` 2 pre-existing fails 是否同 H-1 root cause；若是，propagate `drainSessions` fix pattern（defer 不阻 commit）
- **Pitfall 11 + 18 + real backend round-trip**: 全 PASS。`window.apiFetch` 是 prod JS API；post-delete assertion 真實 GET → `loadHistoryForRail` → real Supabase
**Next action**: dispatch sonnet 修 CRITICAL #1 + NIT #2/3 → 再 spec-review confirm → 派 code-quality reviewer → commit C5

---

### offcanvas-delete.spec.js 2 pre-existing fails — cross-spec drift investigation (2026-05-18)
**狀態：【B — 只有 root cause】** 不同 H-1 root cause，不適合直接 propagate `drainSessions`
**Source**: offcanvas flake fix spec reviewer NIT #4
**Spec**: `tests/e2e/offcanvas-delete.spec.js`
**Fail count**: 2/9 (multi-proj) — B4-E2 mobile-safari + B4-E3 mobile-safari；safari-only re-run 變 B4-E1 + B4-E2 fail（flake, fail set 不穩）
**Fail vp pattern**: **e2e-mobile-safari only**（chrome/desktop 100% pass）
**Fail point**: `openOffcanvasAndAwaitItem()` line 199 `expect.toBeVisible({timeout:10_000})` — dialog 卡在 `載入中…` 滿 10s
**Root cause verdict**: **NOT same as H-1**（H-1 = cache 排擠目標 id；這裡 = WebKit `loadHistory` GET stall）
- H-1 fail on `forceRecentRailLoad waitForFunction`（cache 填了但漏目標）；此 spec fail on `loadHistory` GET 從未 resolve（`historyList === null` 滿 10s）
- H-1 affects chrome+desktop；此 spec safari-only
- H-1 root cause = `slice(0,5)` 排擠（home rail code path）；此 spec 用 `loadHistory`（offcanvas code path，無 client-side slice，server `limit=20`，NSM GET 無 limit）
- 即使 DB 完全清空，WebKit GET round-trip 仍可能 >10s → toBeVisible 仍 fail
**Evidence**: page snapshot dialog `載入中…`；reporter shows `e2e-mobile-safari` only；`grep track( = 0`（同 H-1 anti-pattern 但 H-1 fix 不適用）
**Likely root cause hypotheses**: H-A WebKit `apiFetch` 401 retry race（5★）/ H-B `unrouteAll` residue（4★）/ H-C `toBeVisible` 10s budget 在 WebKit 太短（3★）
**Propagation recommendation**:
- ❌ `drainSessions` 直接 propagate — does NOT address WebKit stall root cause
- ✅ 建議 surgical: (1) `page.waitForResponse('**/api/circles-sessions',{timeout:15_000})` + extend timeout 10s→20s in `openOffcanvasAndAwaitItem` / (2) 順手 wire `cleanupTracker.track()` in `createRealSession` + `createRealNsmSession` returns（hygiene，配 sibling spec pattern，~4 lines）
- 估 effort: ~10 min code + 5x consecutive run validation
- 若 prod safari user 真遇此 stall → 升 P1 production bug，需 real-device 驗證 WebKit `apiFetch` 401 retry path
**Audit**: `audit/offcanvas-delete-spec-2-prexisting-fails-rootcause.md`
**Severity**: P1（flake 影響 cross-plan smoke gate；若 WebKit prod 也 affected → 升 P0）
**Owner**: user gate before fix

---

### C-T2 finding: NSM 99.9% conversion 線上資料深挖 (2026-05-17 PM)
**狀態：【Mixed】** F-CT2.1 = A 已實作 staged (C1 commit) / F-CT2.2 = A shipped F-2 `a221cf0` 追蹤中 / F-CT2.3 = N/A 歷史資料不需修 / F-CT2.4 = **B 只有 root cause** UI weight 待調查
**Source**: Phase 1 C-T2 task per PATH-2-HANDOFF.md §A.5
**Script**: `scripts/audit-nsm-conversion-funnel.js` (read-only, service-role)

**Live Supabase snapshot** (2026-05-17T11:12:15Z, total 6509 rows):

| lifecycle | count | % |
|---|---|---|
| created | 6508 | 99.98% |
| gated | 1 | 0.02% |
| editing | 0 | 0% |
| completed | 0 | 0% |

**資料組成拆解**（關鍵：不能直接用 lifecycle=created 推轉換率）:

| 類型 | 行數 | 說明 |
|---|---|---|
| q3 (Slack) 題目 — 全為空殼 | 5,487 (84%) | 全是 guest 每次點 q3 卡片立刻觸發 `ensureNsmDraftSession()` 建立，但 0 個用戶填了任何文字；`created_at ≈ updated_at < 2秒`，是 UX 設計導致的噪音 session |
| E2E/director walk 測試帳號 (4501e548) | 124 (2%) | question_id=nsm_001；非真實用戶 |
| 真實用戶 session（其餘） | ~898 (14%) | 含 guest 點各題卡片後離開 (empty {})；只有 2 個真人實際填了 NSM 內容 |

**Per-step completion (真實人類 + 去污染)**:

| 步驟 | Count | % of total | 說明 |
|---|---|---|---|
| S1 — 選題（session 建立）| 6,509 | 100% | 點卡片就建 session，無法區分「真的要練」vs「誤觸」 |
| S2 — 填 NSM 定義 | ~21 (all data) | 0.3% | 其中 ~8 筆是 e2e 汙染；真實 = 3 人（2 真人 + 1 汙染） |
| S3 — 填 breakdown | ~12 | 0.2% | 真實 = 1 人（同上那位 ee133f7e 和 real human） |
| S4 — 完成評估 | ~12 | 0.2% | 含 12 筆 lifecycle=created + scores_json（pre-L19 bug） |
| gated | 1 | 0.015% | 唯一 1 位真人進到 gated |

**Drop funnel（真實訊號）**:

| 段落 | 掉率 | 根因 |
|---|---|---|
| S1 → S2 | 99.7% | q3 題設計：點卡片即建 session，但用戶大多未進入 Step 2 表單 |
| S2 → S3 | 42.9% of S2 | 填了 NSM 定義後未填 breakdown |
| S3 → S4 | 0% | 填完 breakdown 的人都送出評估 |
| S4 → gated lifecycle | 91.7% | 12 筆有 scores 但 lifecycle=created（pre-L19 bug，L19 已修） |

**Time-to-drop median**: 0.0 分鐘（6498/6508 stuck sessions 在建立後 1 分鐘內就 abandoned）

**Recent 7 days vs historical**:
- Last 7d: 5,703 sessions，S2 rate = 0.2%（9/5703）；S4 = 0%（0 sessions）
- Historical (>7d): 806 sessions，S2 rate = 1.5%（12/806）；S4 = 1.5%

**User-level**: 2 distinct auth users；6,381 unique guest IDs；1 auth + 10 guests completed evaluation

**Error breadcrumbs**: 無 last_error / error_count / retry_count 欄位。`progress_json` 有 11 non-empty rows，含 `{gateResult: {items: [...error...]}}` — gate 失敗的用戶把失敗結果 persist 到 progress_json 但 lifecycle 沒推進。

**Top drop-points (ranked)**:

1. **[F-CT2.1]** [Sev P1] — q3 / Slack 題「點卡片即建 session」設計，5,487 個空殼 sessions，S1→S2 drop 99.7%
   **Why matters**: 污染轉換率指標，讓所有「lifecycle=created」的分析數字失真；刪掉或不建 session 直到 Step 2 才能還原真實轉換數據。
   **檔案**: `public/app.js:6270` — `ensureNsmDraftSession().catch(...)` on question card click
   **Suggested fix scope**: 延後 session 建立到 Step 2 第一次 PATCH 時；或在 `GET /api/nsm-sessions` 的 `lifecycle=created` filter 只隱藏而已，需同時在 analytics 過濾掉這批 draft sessions。

2. **[F-CT2.2]** [Sev P1] — 真實 S2→S3 drop 42.9%（3 個真人填了 NSM 定義，其中 2 個沒填 breakdown 就離開）
   **Why matters**: 實際到達 Step 2 表單的用戶有 57% 未繼續到 Step 3 — 說明 Step 2→3 之間有 UX 斷點；F-2（mobile sticky bar 蓋第一欄）是主因之一（已修），但還需要觀察 post-F-2 改善。
   **Suggested fix scope**: F-2 已修（`a221cf0`）。追蹤 F-2 後的 conversion 改善。同時考慮在 Step 2 未填完時加入提醒 toast 或 save progress 提示。

3. **[F-CT2.3]** [Sev P2] — 12 個 sessions 有 `scores_json` 但 `lifecycle=created`（資料完整性 bug）
   **Why matters**: pre-L19 時代（2026-04-22 ~ 2026-05-01）的 session 繞過了 gate，直接用 /evaluate，server 寫入了 scores_json 但 lifecycle 沒從 'created' 推進。這批已是歷史資料，L19 fix 後不再新增。
   **Suggested fix scope**: 不需修 prod code（L19 已封閉）；可選擇性用 script backfill lifecycle 到 'completed'。

4. **[F-CT2.4]** [Sev P2] — q3 (Slack) 題是 NSM Step 1 隨機 5 題中最常被選的，但是否是預設第一題需確認
   **Why matters**: q3 有 5,487 sessions vs q1 有 154（下一名）— 倍數差距太大，可能是 UI 呈現順序 / 視覺權重讓 q3 成為「最先被點擊」的題目；需要 UX 調整。
   **Suggested fix scope**: 追蹤 NSM Step 1 的 5 個隨機題中哪個在視覺上最突出（大小、位置、公司名稱熟悉度）。
   **狀態 (2026-05-18 user 決)：【C — 先放著加追蹤】** 99.9% drop 真根因是 F-2（已修 `a221cf0`）；當前不修；每週看 q3 vs 其他題比例；F-2 修後比例若不變 → 進選 A 調查 UI 視覺權重。

**Instrumentation spec**: `tests/e2e/audit-nsm-conversion-funnel-instrumentation.spec.js` (Pitfall 11 compliant, 3 vp, §3.8 API seed, §3.5 test.step per boundary, captures timing + lifecycle + console errors)

---

### NEW-B13-W1: circles-final-report prompt mixed-input hallucination (2026-05-18 PM, Wave 1 #1 B13 adversarial caught)
**狀態：【A — user 決定方案 A + 門檻 60 (2026-05-18)，等實作 dispatch】** 產品理由：60 分以下用戶若看到讚美 = 信任崩塌 + 學不到東西 + 截圖傳出去難看；A 是硬規則 vs B 抽象指令交給 AI 自判（同類 bug 再來一次風險）
**Source**: Wave 1 task #1 B13 adversarial sweep — `tests/adversarial/circles-final-report-adversarial.test.js` variant `d-mixed-one-good`（6 步 garbage + 1 步 high score）
**Finding**: `circles-final-report` prompt 對 mixed garbage+good 輸入給 coachVerdict 出現「學員在總結推薦步驟表現良好」這種**不對稱讚美詞**（雖然 overall grade=D / overallScore=23 數字正確）。
**Severity**: P2（grade/score 數字對；只有 coachVerdict 措辭一致性 drift）
**Why matters**: 用戶看到「表現良好」會誤以為通過，跟 grade=D 矛盾 → UX 混淆
**Suggested fix scope** (sonnet not auto-dispatch, await user):
- 加 prompt guard：coachVerdict 在 mixed-input case 必須描述 dominant pattern（multi-step garbage 為主就不准單獨讚美 1 個高分 step）
- 或：coachVerdict 跟 overallScore align（score < 60 不准 含「良好/優秀」等正面詞）
**Test**: B13 spec d-mixed-one-good variant 是 RED proof + future GREEN
**Cross-ref**: Wave 1 #1 B13 commit (pending split)；tracker §6 O-11 closure 部份（adversarial spec 已 ship 抓到 1 finding）

**Brainstorm doc (2026-05-18 PM, slot 5 sub-agent)**: `audit/B13-NEW-B13-W1-prompt-fix-scope-brainstorm.md`
**關鍵 finding（必讀）**: 既有 prompt **已有**「輸入品質檢查（最高優先級）」block + 黑名單，但 **JSON schema line 75 字面要求「coachVerdict 必須包含一個讚賞」← 跟 input quality guard 自相矛盾**。LLM 看到 S step `totalScore=90` 就抓這個亮點履行 schema 義務 → 寫「總結推薦步驟表現良好」（regex `表現.{0,5}好` 命中，但 prompt 黑名單原寫的是「表現好」**少一字「良」**）
**推薦方案 A**: coachVerdict 措辭極性綁定 `overallScore < 60` 切 neg-only schema（schema 條件式拆「< 60 = 缺陷+根因+重練建議」/「≥ 60 = 讚賞+批判+鼓勵」）+ 擴 HALLUCINATED_PRAISE regex 加「良好／尚可／亮點／可圈可點／有基礎／展現」 + 7 個新 adversarial variant
**Regression risk**: 既有 variant `i-borderline-55` 若採 threshold=60 會 fail（55 < 60 觸發 neg-only schema，但原 `noHallucinatedPraise: false`）；user 親准 threshold (60/55/50 三選一) + 同步調該 variant expectation 為 `true`
**Next user gate**: 選方案 A or B + threshold value

---

### NEW-B13-W2: circles-coach-version prompt off-topic coach leak (2026-05-19, Wave 1 adversarial 1x caught)
**狀態：【B — 只有 finding，等 user brainstorm fix scope】**
**Source**: `tests/adversarial/circles-coach-version-adversarial.test.js`（B13 implementer slot 2 ab8bfc8d 剛加的 spec，sub-agent jest 1x 抓到）
**Finding**: interviewee 回 off-topic「我覺得火候控制是經驗問題，料理方式我喜歡簡單的炒」，coaching reply 仍漏題引導內容 leak（reply 沒嚴格限定澄清題目邊界階段）
**Failed assertion**: `tests/adversarial/circles-coach-version-adversarial.test.js:339` `[BUG — COACH LEAK]` check
**Severity**: P2（adversarial 抓 prompt edge case；用戶在 off-topic 情境下會看到 misleading coach 引導，不是 critical user data loss）
**Why matters**: 用戶填了不相關的回答時，coach 應該說「請回到題目澄清階段」而不是順著用戶 off-topic 給建議
**Suggested fix scope (sonnet not auto-dispatch, await user)**:
- 加 prompt guard：detect off-topic interviewee reply → coachReply 必須只說「請先澄清題目邊界 / 用戶情境」不准順著 off-topic 給 hint
- 或：coachReply schema 必須 reference 當前 step key（C1/I/R/C2/L/E/S），off-topic 時 reference 為 'clarify'
- 與 NEW-B13-W1 不同 prompt（final-report vs coach-version），但同類 schema-guard 模式
**Test**: variant fail = RED proof + future GREEN
**Cross-ref**: 與 NEW-B13-W1 不同 prompt 同類 finding；adversarial 4-pillar coverage 證明價值（CIRCLES coach 變體第 7 pillar 對應 O-11 sweep）
**Discovered**: 2026-05-19 Wave 1 jest baseline run（sub-agent a49159a7 1x adversarial sweep）

---

### P1-#257 Bug 8 / Master plan F-007 — ~65 hollow API specs refactor
**狀態：【A — brainstorming 進行中（Q1+Q2 user 決定，Q3-Q5 pending，未實作）】** slot 4 hunk audit 完成有 **2 critical blocker 待 user 重審 Q2 spec list**
- **Status**: partial done (retrofit C/D/E/F + Group A V1-V8 shipped); Phase 1 P1.1 brainstorm in progress (Step 2 Q1+Q2 user decided 2026-05-18)
- **Open**: 確切 57 hollow specs (e2e 38 + visual 18 + journey 1) — 比原估 ~65 略少；分 6 batch refactor 待 plan
- **P1.1 explore findings (2026-05-18)**:
  - Hollow spec 兩類：**Pattern A boot helper** (26 e2e specs，`page.route('**/api/circles-sessions', stubGet)` + 立刻 `unrouteAll`，GET→[] empty) vs **Pattern B success-path AI mock** (13 e2e specs + 18 visual specs，違反 Pitfall 11)
  - `tests/api/` 22 個 real API spec 已建立 canonical pattern：`api-cleanup.fixture` + `getE2eToken()` + `request.post`，無需新建 helper
  - 6 batch 建議：B1/B2 boot helper LOW → B3 evaluator AI mock HIGH（先做）→ B4 error carve-out → B5 audit/offcanvas → B6 visual tier
- **User decisions (Q1+Q2 of Q1-Q5)**:
  - **Q1 = B**：boot helper 26 specs 全改 — service-role 清空 user session list 模擬空帳號；cost CI +~78s/run；理由：抓「新用戶 / 老用戶刪光 session / 訪客 0 session / 首次登入空狀態」regression
  - **Q2 = B**：critical-path 5 specs 改真實 OpenAI；其他 8 specs（5 error path + 3 adversarial in api tier）保留 mock；cost CI +~50s + $0.45/run + ~$27/month；critical 5 specs: wave1-b13-prompt-regression-smoke / critical-path-full-flow / circles-phase2-evaluator-error-shown / nsm-hint-ui-flow / bug3-spinner-deep-investigation
- **Outstanding Q3-Q5** (待 user 決定): Visual tier 18 specs 優先序 / critical-path-full-flow gate mock 策略細節 / Batch 量上限
- **Slot 4 hunk audit findings (2026-05-18 PM, DONE)** `audit/p1.1-step3-critical-path-5-specs-hunk-audit.md`:
  - **2 critical blocker**: Spec 3 (circles-phase2-evaluator-error-shown) 是 503/401 error injection **本來就不打 OpenAI**；Spec 5 (bug3-spinner-deep-investigation) 是 Supabase seed bypass OpenAI **也不打** → user Q2 推薦的 5 specs **2/5 錯誤**；建議替換為 `nsm-evaluate-checkpoint-real` / `wave1-b6-circles-phase1-to-gate-real-flow` 已 real 的 spec
  - **真實 OpenAI cost**: 3 spec × ~10 calls/run = **$0.90/run × 60 = $54/月**（比原估 $27 翻倍）；worst case $108/月
  - **Spec 1 (wave1-b13) AC-2 step_scores 種子策略**: 拔 evaluate-step mock 後 final-report 會 422（只 C1 一個 step 有 score）；建議 Supabase service-role PATCH 種 7 個 step_scores（$0 cost），canonical pattern `bug3-spinner-deep-investigation.spec.js:152-185`
  - **Spec 2 critical-path-full-flow** 3 個 mock hunk: line 153-168 evaluate-step + 173-192 `/gate` + 197-206 `/hint` — 都是違規必刪
  - **Spec 4 nsm-hint-ui-flow** mockHintEndpoints function 整個刪 + 3 個 call sites；**且 Spec 4 完全沒 cleanup → 9 NSM rows leak per CI run，必補 manual deleteSession pattern**
  - **不需新建 seedGatedSession() shared helper** — 既有 inline pattern 各自合適
  - **不需新建 e2e auto-cleanup fixture** — 基本款用 unauthenticated request 會 401；4/5 spec 已用 manual deleteSession（canonical）
  - AC-3 SSE coach 是否升級 real（目前 mock OpenAI SSE 因 cost）— **user 需確認**
- **Slot 4-B Q2 spec correction explore (2026-05-18 PM, DONE)** `audit/p1.1-step3-q2-spec-list-correction.md`:
  - **Final 5 specs**: 1.wave1-b13 / 2.critical-path-full-flow / 3.nsm-hint-ui-flow / 4.**NEW** nsm-evaluate-checkpoint-real / 5.**NEW** wave1-b6-circles-phase1-to-gate-real-flow
  - **Replacements verified ready**: 兩個替換已是真實 OpenAI（無 own API route.fulfill on SUT path）；Replacement B 需 1 行 cleanup patch (`sessionIdsToDelete.push(sid)` after gate POST — latent bug: afterEach exist but array empty)
  - **New cost**: **$1.35/CI run × 60 = $81/月**（原 Option B $0.90 → +$0.45/run / +$27/月）— 額外 $$買到 real evaluator + real gate UI 覆蓋（替換掉的兩 spec 是 $0/label-only）
  - **Optional 6th spec**: `nsm-full-flow.spec.js` 可加（補 NSM Step 2→3 gate coverage gap），延後 Phase 2 決定
  - **Wider scan** 38 e2e specs：2 個 alternate (`circles-gate-await-patch-real`) defer 未來
  - **User Q2 re-gate 建議**: spec list 變 + cost +50%，建議 user 親自確認 corrected list
- **Why P1 not P0**: production code OK，但 hollow specs 不抓真 regression（P0-NEW-6 cascade 證明）
- **Impact long-term**: 防止未來 ship 再撞同類 lifecycle-guard cascade；抓「新用戶空狀態」+「AI behavior regression」兩類 user-visible bug
- **Effort revised**: 8-15h wall-clock parallel (6 batch × ~3 lane)
- **Cross-ref**: master plan `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` §7 F-007；多階段 ship plan `docs/superpowers/plans/2026-05-17-pm-multi-phase-ship-plan.md` §B；P1.1 explore output 在 conversation transcript

### P1 Master plan F-001 — Testing Trophy inversion
**狀態：【A — 部分實作（Group A V1-V8 shipped 8 spec），剩 ~30-40 specs 未實作】**
- **Status**: Group A V1-V8 added 8 real API specs，ratio 改善但未到 60% API target
- **Current state**: 95 E2E vs ~18 API (post Group A)
- **Open**: identify ~30-40 more E2E candidates to convert to API tier per surface
- **Effort**: medium-large；可隨 F-007 wave 一起做
- **Cross-ref**: `audit/testing-trophy-audit-2026-05-16.md`

### NSM↔CIRCLES drift scan results (2026-05-19, COMMON design issue follow-up)
**狀態 (2026-05-19 PM update)：【B — Wave 2 quiz BLOCKED 2026-05-19，quiz reviewer 抓 7 critical gap (GAP-1~7)；Phase A prep in flight；re-quiz 全 PASS 才放 dispatch】**

**Wave 2 quiz BLOCKED 2026-05-19** — quiz reviewer 抓 7 critical gap (GAP-1~7)：
- GAP-1: implementer test fixture / 真實帳號 contamination 風險
- GAP-2: 4 parallel implementer 共用 1 test user → cross-spec storageState 互殺
- GAP-3: AppState 3 commit 衝突 (C-Drift-2/3/4 同改 `nsmRecentSessions`/`nsmGateInflight`/`nsmPhase2SaveState`)
- GAP-4: 4 implementer parallel 違反 RITUAL §7.3 上限 3 implementer
- GAP-5: drainSessions 跨 commit 順序錯 → cleanup 互殺
- GAP-6: D-11 / D-12 mockup 06+07 update 未準備 → 違反 `feedback_mockup_first`
- GAP-7: HITL 16 review (4 commit × (3 reviewer + 1 user gate)) 過載 → 8 hr budget overrun

**Phase A prep 進度 (mitigation in flight)**:
- ✅ **GAP-2 解** — 4 unique test users provisioned via `scripts/register-c-drift-test-accounts.js` + `tests/setup/auth.setup.js` (+98 lines, `C_DRIFT_LANES` array, 4 storageState path)
- 🟡 **GAP-3 plan** — `audit/phase-a-prep-appstate-atomic-commit-plan.md` (4 AppState keys 拆 commit 邊界 + namespace lock，~30 min ship)
- 🟡 **GAP-6 mockup 06+07 draft** — in flight (sub-agent `acf745cb`) — D-11 save indicator + D-12 desktop rail 雙 viewport mockup
- 🟡 **GAP-1/4/5/7 mitigation** — in flight (sub-agent `ab6d77c5`) → `audit/phase-a-prep-gaps-1-4-5-7-mitigation.md`：限 3 implementer / fixture cleanup race fix / HITL batch consolidation
- 🟡 **Wave 1 收尾 serial verifier** — in flight (avoid drainSessions parallel contamination per #199 finding)；Wave 1 commit messages draft → `audit/wave-1-c1-c5-commit-messages-draft.md`

**下一步**: Phase A prep ship 全完 (4 task) → re-quiz reviewer → 7 GAP 全 PASS → Wave 2 dispatch (2a: C-1+C-2 parallel / 2b: C-3+C-4)

**Cross-ref**:
- `scripts/register-c-drift-test-accounts.js` (4 user provision)
- `tests/setup/auth.setup.js` (`C_DRIFT_LANES` array + 4 storageState path)
- `audit/phase-a-prep-appstate-atomic-commit-plan.md` (GAP-3 plan)
- `audit/phase-a-prep-gaps-1-4-5-7-mitigation.md` (in flight)
- `audit/wave-1-c1-c5-commit-messages-draft.md` (in flight)
- **D-2 假說驗證 plan**: `audit/d-2-localStorage-hypothesis-verification-plan.md`（C-Drift-2 ship 前後 pre/post metric + e2e simulation test）

**Mockup decision (2026-05-19 user 決 A)**:
- Mockup 06 既有 `.nsm-recent` 設計 (line 483-518 + 879-881) = design contract — **不動**
- Mockup 07 `.save-indicator` CSS 缺，但 C-Drift-3 D-11 直接 reuse mockup 03 `.save-indicator` LOCKED class（cross-mockup component reuse per `feedback_locked_components_reuse` STANDING）— **不動**
- Wave 2 C-Drift-3 + C-Drift-4 不再 mockup-blocked
**STANDING 更新**: `feedback_mockup_show_and_sonnet_make` 升級 — mockup 工作全 opus，禁 sonnet（per `feedback_uiux_visual_only` 親 cold-Read mandate）

---

### NSM↔CIRCLES drift scan results — earlier state snapshot (2026-05-19 brainstorm，superseded by quiz BLOCKED above)
**舊狀態 (2026-05-19 user 決)：【A — D plan locked，分 4 atomic commit ship，< 1 天 HITL 強稽核】**

**User decision flow (2026-05-19 brainstorm)**:
- Q1 strategy options A/B/C presented：A 全包 ship / B P0 先 ship + 觀察 conversion / C incremental Phase 2 同期
- User 回：「沒人口 → B 觀察優勢失效；A 規模偏大；要 robust」
- Proposed compromise **D plan = A 全範圍 + 4 atomic commit + HITL strict audit** — user 確認 D + < 1 day + HITL
- Q follow-up: HITL = user 仍 final gate（不全權交給 AI），3 reviewer 做 pre-filter heavy work

**4 atomic commit 拆分**:
| Commit | Items | Priority | 工時 |
|---|---|---|---|
| **C-Drift-1 XS 快攻** | D-1 NSM persistRetry / D-3 evalToast / D-4 gateInflight mutex / D-5 hint abort 3 controllers / D-9 刪 inline ensureNsmSession / D-10 nsmPickDisplayed excludeCurrent | 6 個 P0/P1 共 ~半天 |
| **C-Drift-2 P0 localStorage** | D-2 NSM localStorage restore (history + qcard) + D-6 切題 restore | 2 個 P0 連動 ~1 天 |
| **C-Drift-3 state refactor** | D-7 resetNsmToHome helper / D-8 nsmSessionLoading / D-11 NSM save indicator UI | 3 個 P1 ~1 天 |
| **C-Drift-4 功能補 + STANDING** | D-12 NSM recent rail + D-13 cache invalidate / STANDING memory `feedback_nsm_circles_shared_helper_mandate.md` / hint modal 4 shell unify / progress bar class align | ~1.5 天 |

**HITL per-commit protocol**:
1. Implementer sonnet → 修 + 自報 5x
2. 並行派 3 opus reviewer：spec-compliance / code-quality / **audit-evidence packager**（cold-Read PNG + 親跑 5x cross-check + e2e walk verify）
3. 3 reviewer 全完工 → Director 寫 1 段簡報給 user
4. **User 1 分鐘看簡報「對」/「退」**（不全權交 AI；3 reviewer pre-filter，user 親決定）
5. 「對」→ Director stage + commit + push；「退」→ 退回 implementer

**Time budget**:
- Phase 1 (now ~now+3-4hr): Wave 1 補洞收尾（W1-補.7 F1 / B6 5x / offcanvas WebKit / #199 P0 gap）+ Director 拆 5 commit (C1-C5) + HITL ship
- Phase 2 (next ~5-6hr): NSM drift 4 implementer parallel + HITL ship 4 commit
- 總計 ~9-10 hr < 1 day ✓

**Dependencies**:
- Wave 1 staged 必須先 ship 完 commit C5（避免 git 衝突 — Phase 2 大量改 `public/app.js`）
- Phase 2 prep plan 進行中 (slot 4 sub-agent `a6de26acfff3812a9`) 產出 `audit/p2-c-drift-{1,2,3,4}-plan.md`

**Sub-agent self-report 風險警告**:
- 本 session 已 3 次 sub-agent fake 5x GREEN 數字（D 50/50→真 26/50；a77f08b8 50/50→真 49/50；B6 monitor timeout 沒驗）
- HITL audit-evidence packager 必須 paste 完整 stdout × 5 run（per `feedback_subagent_self_report_unverifiable` STANDING 強化）
- User 看簡報必含 Director cold-Read cross-check 真實數字（不信任 sonnet 自報）

**Cross-ref**: `audit/nsm-circles-drift-scan-2026-05-19.md` (full audit) / `audit/p2-c-drift-{1,2,3,4}-plan.md` (待 sub-agent 產出) / §3 COMMON design issue entry / 待立 STANDING memory `feedback_nsm_circles_shared_helper_mandate.md`

---

### Phase 2 NSM drift Wave 2 — 4 commit detailed plan (2026-05-19)
**狀態：【A — plan ready，等 Phase 1 commit C1-C5 ship 完 dispatch 4 implementer parallel】**
**Source**: COMMON design issue user 決定方案 D + < 1 day 強稽核 HITL
**Plans**: audit/p2-c-drift-{1,2,3,4}-plan.md
**Next action**: Phase 1 ship 完 → 4 parallel implementer + per-commit 3 reviewer + HITL user gate

**Plan summary per commit** (full detail in respective plan doc):
- **C-Drift-1** (~半天, 6 specs new): D-1 persistRetry / D-3 evalToast / D-4 gateInflight / D-5 hint abort 3 ctrl / D-9 inline ensureNsmSession 刪 / D-10 excludeCurrent. XS surgical edits; **director-clarification: D-9 inline-delete null handling + D-1 PATCH scope** (3 sites vs 1)
- **C-Drift-2** (~1 天, 2 specs / 4 cases): D-2 localStorage history restore + D-6 qcard click restore. P0 data loss fix; **director-clarification: D-2 second-merge full-fetch race + nsm-question-switch-resets-draft.spec compatibility**
- **C-Drift-3** (~1-1.5 天, 4 specs): D-7 resetNsmToHome helper + jest enumeration / D-8 nsmSessionLoading / D-11 save indicator UI. **BLOCKER: D-11 mockup 07 update needed (`feedback_mockup_first`)**; may split into 3a (D-7+D-8) + 3b (D-11 after mockup)
- **C-Drift-4** (~1-1.5 天 if mockup fast, 2 specs + memory file): D-12 NSM recent rail + D-13 cache invalidate + STANDING memory write. **BLOCKER: mockup 06 update needed for D-12 desktop rail**. Hint modal unify (row 26-30) **DEFERRED** to C-Drift-5; progress class align (row 31) **OPTIONAL**

**Total effort estimate**: 4-5 days OR ~9-10 hr per `< 1 day` budget IF mockup work parallelized (sonnet dispatch concurrent with C-Drift-1/2 impl)

**Cross-commit dependencies**:
- C-Drift-3 D-7 helper enumerates ALL nsm* keys — must include `nsmGateInflight` (C-Drift-1 D-4), `nsmPhase2SaveState` (C-Drift-3 D-11), `nsmSessionLoading` (C-Drift-3 D-8), `nsmRecentSessions` (C-Drift-4 D-12). Implementer of C-Drift-3 must read all 4 plans first.
- C-Drift-2 D-6 qcard restore lives at the SAME line block as C-Drift-3 D-7's "site #4 carve-out" decision. Coordinate.
- C-Drift-4 D-12 click handler reuses C-Drift-2 `loadCirclesSessionFromHistory` routing — D-2 must ship first.

**Recommended ship order**: C-Drift-1 → C-Drift-2 → C-Drift-3 → C-Drift-4 (left-to-right priority + dependency graph)

**Risks needing Director clarification before dispatch**:
1. D-9 inline ensureNsmSession delete — full delete + null-retry shim OR keep both helpers (audit recommends delete; risk: submit-handler null sessionId path)
2. D-1 persistRetry scope — only `triggerNsmSaveCycle` (1 site) OR all 3 NSM PATCH sites (incl `nsmPersistStep` + gateResult persist)
3. D-2 second-merge full-fetch — ship both OR first-only (recommended first-only to avoid clobber of user edits during fetch race)
4. D-11 mockup 07 update — block C-Drift-3 entirely OR split into 3a+3b
5. D-12 mockup 06 update — block C-Drift-4 entirely (no split alternative — D-12 IS the bulk of C-Drift-4)
6. Fix 4 hint modal unify (row 26-30) — confirm deferred to C-Drift-5

**Cross-ref**: `audit/p2-c-drift-1-plan.md` / `-2-plan.md` / `-3-plan.md` / `-4-plan.md`

---

### Supabase NSM schema + 已儲存資料 總稽核 (2026-05-19) — D-2 pre-impl
**狀態：【B — find-only，audit 完成等 D-2 brainstorm 動工】**
**Audit doc**: `audit/supabase-nsm-schema-data-audit-2026-05-19.md` — **D-2 實作前必讀**
**Scripts**: `scripts/audit-supabase-schema-data.js`（新建 READ-ONLY 16+19 cols + shape + lifecycle integrity）+ `scripts/audit-nsm-conversion-funnel.js`（既有，confirm 6815 rows）
**1-line verdict**: DB 髒一點點（5 個 orphan evaluating flag + 1 個 gated 缺資料 + 5 個 e2e fixture leak，< 0.2%）+ 真坑 2 個（`/evaluate` 退化 user_nsm 從 object → string；94% session 從未 PATCH server）
**Critical findings**（10 個，driving D-2 spec）:
- **F1 🚨** 94% sessions never PATCH (`same_ts_created_updated`=469/500) — eager-INSERT 後立即流失，LS 是唯一撿回管道
- **F2 🚨** 5 個 orphan `evaluating=true` checkpoint（2026-05-18 15:32-15:33 一分鐘 burst）— D-2 restore 必須 staleness-aware（`evaluating_started_at` > 60s = stale）
- **F3 🚨** `/evaluate` 把 user_nsm 從 object 退化成 string（app.js:2085 `userNsm: (...).nsm` + routes/nsm-sessions.js:140 `user_nsm: userNsm`）— explanation + businessLink 永久遺失；D-2 restore 必須以 LS（完整 object）overlay DB（被退化的 string）
- **F4 ⚠️** NSM lifecycle 0 個 editing（500/500 row），CIRCLES 有 12% editing — NSM computeLifecycle 對 PATCH /progress 可能 broken
- **F5 ⚠️** 1 個 gated 但 empty breakdown + no scores — 不可假設 lifecycle=gated → 資料完整
- **F6 🚨** `pmdrill:nsm:draft:{qid}` LS 只 write 不 read（grep app.js:2148 唯一 hit，無對應 restore） = D-2 task scope
- **F7 ⚠️** CIRCLES `step_drafts` JSONB blob vs NSM 4 top-level columns — D-2 不能 copy CIRCLES restore pattern
- **F8** legacy `user_explanation` + `user_business_link` columns 全 null — D-2 不要寫，只用 user_nsm 內巢
- **F9 ⚠️** LS shape 對齊 PATCH /progress（safe）但對齊 POST /evaluate 是退化 shape — D-2 source-of-truth 排序：LS object > DB object > DB string
- **F10** orphan evaluating burst 5 row 同 1 分鐘 = prod incident 痕跡（可能 OpenAI timeout / process restart）
**Suggested D-2 constraints**（10 條，見 audit doc §7）: LS-only 優先 / LS+DB merge by ts / DB string defense / evaluate-overwrites-object 防禦 / stale checkpoint banner / no editing 假設 / DB 404 fallback / cross-question LS clear / completed 後清 LS / e2e fixture 不影響 restore
**Snapshot**: 2026-05-19T14:41:37Z，6815 total rows nsm_sessions
**Owner**: user gate 開 D-2 brainstorm 前必 cite 此 audit

---

### 🟠 P1-SCHEMA-5: nsm/circles sessions 缺 `updated_at` 觸發器 — 全靠 app code 設 (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §7 D6
**Location**: `db/schema.sql:40-50` 對 legacy practice/guest_sessions 有 `update_updated_at()` trigger；新表 nsm_sessions / circles_sessions migrations 完全沒加 trigger
**User behavior**: cleanup scripts / 後台直 SQL update / 任何忘記寫 `updated_at = NOW()` 的程式碼 → 留 stale timestamp → `tryResumeLatestSession` 排序錯，挑到舊 row
**Severity**: P1 — 邊角 bug，但任何 admin tool 改 DB 都有 silent 風險
**Fix scope**: small — 1 migration 加 trigger（function 已存在 db/schema.sql:40）
**Audit ref**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §7 D6

---

### 🟠 P1-SCHEMA-6: `status` + `lifecycle` 雙狀態機並存 — UNIQUE 索引仍 filter on `status='active'` 不是 `lifecycle` (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §7 D2 + §10 P1-S-NEW-5
**Smoking gun**: circles_sessions 500-row sample status counts {active:499, completed:1}，lifecycle counts {created:493, editing:7}；同表雙系統，CIRCLES 的 `uniq_active_*_circles` UNIQUE 索引 filter on `status='active'`，app code 改 lifecycle 卻不改 status 時 partial index 失守 → duplicate 出現
**Location**: 全 routes mix 兩者；`migrations/2026-04-29-circles-active-uniqueness.sql` 仍 filter `status='active'`
**User behavior**: 若某條 code path 改 lifecycle 不改 status → uniqueness 不擋 → 又一條 dup row（同 P0-SCHEMA-2 同 root cause）
**Severity**: P1 — 設計 debt 暴露面
**Fix scope**: medium — 先決定哪個是 source of truth（建議 lifecycle）→ migrate UNIQUE index → 跑 backfill → DROP `status` column
**Audit ref**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §7 D2

---

### 🟠 P1-SCHEMA-7: 5 個 orphan `evaluating=true` checkpoint 殘留 1+ 天 — 無 janitor (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §8
**Smoking gun**: 500-row recent sample 抓到 5 個 `lifecycle=created` + `progress_json.evaluating=true` 卡 1-2 天（age_s 84,260 - 181,794 秒）；OpenAI timeout / process restart 中段沒 final UPDATE 就成孤兒
**Location**: `routes/nsm-sessions.js:118-126` 寫 checkpoint；沒對應 janitor cron
**User behavior**: user 回來 → 看到 evaluating spinner 卡住 → reload 沒用；FE 60s timeout banner 是唯一補救（D-2 必處理）
**Severity**: P1 — UI 卡住但 user 可繞過
**Fix scope**: medium — janitor cron + lifecycle transition rule（age > 5 min stale → reset progress_json.evaluating=false + 標 progress_json.evaluation_error='timeout-cleanup'）
**Audit ref**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §8

---

### 🟠 P1-SCHEMA-8: nsm/circles sessions 缺 FK 到 auth.users — user 刪除後 session 永遠 orphan (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §5
**Smoking gun**: `grep -r "REFERENCES auth.users" migrations/` → 0；只有 legacy `db/schema.sql:4` 對 practice_sessions 有 FK + CASCADE
**Location**: nsm_sessions / circles_sessions migrations 全沒 FK 宣告
**User behavior**: Supabase Auth 刪用戶 → 該用戶所有 session row 永久殘留（join on user_id 看不到 + 永遠占 storage + skew analytics）
**Severity**: P1 — 結構 debt + GDPR/隱私問題（user 要求刪資料但實際留著）
**Fix scope**: medium — 先跑 orphan purge → `ALTER TABLE … ADD FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
**Audit ref**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §5

---

### 🟠 P1-SCHEMA-9: NSM `editing` lifecycle 從未觸發 — 500/500 row = 0 editing (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，需 trace `computeLifecycle()` 為何 NSM 沒推到 editing】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §8（同 prior NSM-only audit F4）
**Smoking gun**: NSM 500 row 0 個 editing，CIRCLES 500 row 7 個 editing；同 `computeLifecycle()` 函數兩邊用
**Location**: `lib/session-lifecycle.js:94 computeLifecycle()` + `routes/nsm-sessions.js:191/262`
**User behavior**: `tryResumeLatestSession` 找不到 draft-in-progress 標記；D-2 LS restore 不能依賴 lifecycle=editing 判定
**Severity**: P1 — 影響 D-2 spec 設計（已記入 D-2 constraint）
**Fix scope**: medium — root cause `computeLifecycle` 對 NSM patch 為何不 promote；確保 first user input PATCH 後 lifecycle 推進
**Audit ref**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §8

---

## §3 Active P2 / Needs Decision

### 🟡 P2-NCK-1: nsm-evaluate-checkpoint-real TC1+TC3 pre-existing fail (2026-05-22)
**狀態：【A — 已 find，未動 fix】**
**Source**: Wave 1.5 banner refactor cross-vp 5x — stash 對照確認 pre-existing
**Specs affected**: `tests/e2e/nsm-evaluate-checkpoint-real.spec.js:175 (TC1 happy) + :285 (TC3 retry)`
**Failure mode**: timeout waiting for `window.AppState.nsmEvalResult` non-empty (90s)
**Projects**: e2e-desktop + e2e-mobile-chrome + e2e-mobile-safari (3 projects × 2 specs = 6 fail)
**5x serial**: deterministic 5/5 runs all fail same 6
**Stash baseline**: pre-refactor (no banner changes) ALSO fails same 2 specs → confirmed non-regression
**Suspect**: real OpenAI /evaluate call latency exceeding 90s window OR nsmEvalResult mutation path broken pre-Wave-1.5
**Fix scope**: medium — likely needs longer timeout OR checkpoint state mutation audit

---

### 🟡 P2-GL-1: gate-loading 共用層 refactor 暫不做 — drift 太多 ROI 差 (2026-05-22)
**狀態：【A — 已 find，未動 fix】**
**Source**: Wave 1.5 batch 3 inventory cold-Read
**5 inline sites**: app.js 352 (session-load) / 515 (Phase 4) / 1380 (NSM gate) / 5331 (CIRCLES gate) / 6600 (Phase 3)
**Drift**:
- Prefix: `loading-` vs `gate-loading-` (2 distinct CSS prefixes, mockup canonical 11/12/13 vs 04/08)
- Spinner class: `loading-spinner` vs `gate-spinner`
- Checklist container: `<div>` vs `<ul role="list">`
- Step item tag: `<div>` vs `<li>`
- Caller 4 (CIRCLES gate, 5331) 全 hardcode 5 個 step，不迭代 → helper 不適用
- Done icon class drift: `ph-check-circle` vs `ph-check` vs `ph-fill ph-check-circle`
**Recommended helper**: per inventory §531 `renderChecklist({prefix, title, sub, slow?, steps})` 但實作會超過 8 個 opts，違反 Karpathy §4.2 simplicity
**Decision**: 暫不做 — 投入精力 vs 統一收益不對等；後續若 prefix 用法收斂或 mockup 統一再回來
**Fix scope**: large — 需先 mockup 規範統一 prefix (loading-* OR gate-loading-*) + 設計可 hardcode step 變體的 helper

---

### 🟡 P2-Q-3: wave1-b6 Layer (b) 3 specs mobile-only pre-existing fail (2026-05-22)
**狀態：【A — 已 find，未動 fix】**
**Source**: Wave 1.5 qchip refactor cross-vp 5× serial — pre-refactor stash 對照確認 pre-existing
**Specs affected**: `tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js:228,265,318`
- Layer (b) D-7/D-8 loading state
- Layer (b) excellent input D-1/D-2/D-5/D-10
- Layer (b) poor input D-3/D-6
**Projects affected**: `e2e-mobile-chrome` + `e2e-mobile-safari`（同 3 spec × 2 project = 6 fail）
**Desktop status**: e2e-desktop 8/8 PASS × 5 runs（無 fail）
**Deterministic**: 5/5 run same fails；pre-refactor stash 也同樣 6 fail → 非 Wave 1.5 regression
**Suspect**: mobile viewport gate-loading title text 偵測 / iOS Safari fetch timing
**Fix scope**: medium — 需 cold-Read 失敗 screenshot 找 selector or timing issue

---

### 🟡 P2-Q-1: Phase 2 qchip caret 與 mockup 05 不符 (pre-existing pre-Wave-1.5) (2026-05-22)
**狀態：【A — 已 find，未動 fix】**
**Source**: Wave 1.5 qchip refactor UI/UX reviewer cold-Read 18 PNGs，反查 mockup 抓到
**Mockup contract**: `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html:716` 指定 `ph-caret-right`
**Production**: `public/app.js` Phase 2 qchip 自始用 `ph-caret-down`（pre-refactor + post-refactor 同）
**Refactor 影響**: 0 — byte-equivalent preserved，不是 Wave 1.5 造成
**Decision needed**: align production → mockup (ph-caret-right) 或反過來 align mockup → production
**Fix scope**: 1 char swap if align-to-mockup chosen; or update mockup-05 line 716

---

### 🟡 P2-Q-2: phase2-ui-fix.spec.js 5 specs 用 `qchip-panel` selector 但 selector 在 L23 (`f2a3d58`) 已刪 (2026-05-22)
**狀態：【A — 已 find，未動 fix】**
**Source**: Wave 1.5 qchip refactor cross-plan e2e 5× serial，pre-refactor baseline 對照確認 pre-existing
**Specs affected**: `tests/e2e/phase2-ui-fix.spec.js:205,216,234,280,290` (AC2/AC3/AC4b + B5-AC6 ×2)
**Selector**: `[data-phase2="qchip-panel"]` → `<div class="qchip-panel">` 已被 `qchip-expand` 取代 (O-9 close)
**Decision needed**: 改寫 spec 用 `qchip-expand` selector，或 delete spec（已 obsolete）
**Fix scope**: small — 5 lines POM `qchipPanel` selector swap + 5 spec assertions

---

### 🟡 P2-SCHEMA-10: 死欄位 `user_explanation` + `user_business_link` (TEXT) 全 null — migration 2026-05-15 加但無人寫 (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §7 D1
**Location**: `migrations/2026-05-15-nsm-explanation-business-link.sql` 加了 2 columns；500-row 全 null；routes 只寫 user_nsm JSONB
**Severity**: P2 — 設計 debt + 未來 dev 誤以為 canonical
**Fix scope**: small — DROP COLUMN，或改為 `GENERATED ALWAYS AS (user_nsm->>'explanation') STORED`

---

### 🟡 P2-SCHEMA-11: `progress_json` 混合 transient + persistent state — 同欄位塞 currentStep / evaluating / evaluation_error (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等 brainstorm fix】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §10 P2-S-NEW-9
**Location**: 全部 routes / FE 共用
**Severity**: P2 — 設計 debt；transient flag 卡住變 stale ghost（P1-SCHEMA-7 root cause）
**Fix scope**: medium — split into `ui_state_json` + `transient_progress_json`，或把 evaluating* 移到專屬 columns

---

### 🟡 P2-SCHEMA-12: NSM vs CIRCLES schema 不對稱 — NSM 4 top-level cols vs CIRCLES 單一 step_drafts JSONB (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，需 architectural decision】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §10 P2-S-NEW-10
**Severity**: P2 — code dup + D-2 restore 無法 share pattern
**Fix scope**: large — 統一 pattern；建議 NSM 收斂進 `step_drafts` blob

---

### 🟡 P2-SCHEMA-13: Legacy `practice_sessions` (3 rows) + `guest_sessions` (24 rows) 可能孤兒表 — 無 routes 引用 (2026-05-19 DB audit)
**狀態：【B — 只有 root cause，等確認 30 天無寫入後 DROP】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §8
**Smoking gun**: practice_sessions newest created_at 2026-04-23；guest_sessions newest 2026-04-25；近 1 個月 0 新行；`grep -r "practice_sessions\|guest_sessions" routes/` 預期 0
**Severity**: P2 — DB clutter
**Fix scope**: small — verify no live writes for 30 days then DROP

---

### 🟡 P2-SCHEMA-14: 7 個 e2e-fixture-shape NSM row 殘留 prod — `e2e-a3-nsm-` timestamp pattern (2026-05-19 DB audit)
**狀態：【B — 只有 root cause；`e34d825` scan-pollution patch 已涵蓋此 pattern；需手動 DELETE 7 row】**
**Source**: `audit/supabase-full-schema-strict-audit-2026-05-19.md` §10b
**Severity**: P2 — pollution 殘留（B7 incident 後遺）
**Fix scope**: small — 手動 DELETE 7 row + 確認 scan-pollution.js 跑 jest 全綠

---



### #199 Trophy Step 4 — critical-path E2E
**狀態 (2026-05-19 update)：【B — verify 完成，發現 2 個真實 GAP；不是 dup of #212，是補測需求】**

**Verify findings (Explore sub-agent 2026-05-19)**: `critical-path-full-flow.spec.js` 覆蓋 Phase 1→2→3 UI render，但 **2 個 P0 gap**:
1. **Phase 3→4 transition 完全沒測** — 用戶看評分後點「生成最終報告」這段壞了我們抓不到（~15 分鐘補 step 7）
2. **Phase 2→3 evaluate-step×7 真實鏈沒測** — 評分 sequence 是 AppState 灌進去的假資料；真實 7 次評分 API 鏈 + score aggregate 沒覆蓋（~1 小時新增 `tests/api/circles-phase2-evaluate-sequence.spec.js`）

**Next action**: 不結案 #199；補 2 個 supplementary test 後再結
**Effort**: ~1.25 小時總和
**Owner**: user gate before dispatch（不擋當前 commit C1-C5）
- **Status**: master plan F-006 partly satisfied by `9446ad2` critical-path-full-flow spec
- **Open**: spec partial coverage Phase 1→4 (gap on Phase 3→4 transition?)
- **Recommendation**: may overlap with task #212 critical-path E2E (completed)；可 close as duplicate
- **Owner**: needs Director cross-verify with #212 scope

### #205 Retrofit G — delete hollow tests + test-supabase mock library
**狀態：【B — 只有 root cause，blocked by F-007 wave (#257) 完成】**
- **Status**: backlog (low priority cleanup)
- **Trigger**: best done after F-007 wave (#257) — many hollow tests will become deletable once real api/ tier covers same surface
- **Effort**: medium

### B6 / #21 — mockup 04 Phase 1.5 Gate pixel-diff audit (2026-05-17 PM)
**狀態 (2026-05-18 update)：【A — D-1 至 D-11 全 11 個 drift 已實作於 app.js:5136-5240，等 NEEDS_FIX 補修後 commit】** Spec reviewer 抓 2 Critical: (1) `circles-gate.spec.js:105` 還 assert 4 step 需改 5 step (D-8 已改 production) — commit 會 break；(2) 8 個 B6 artifact 全 untracked，sub-agent B 自報 staged 但 git ls-files 沒，又一次 self-report drift。Spec match / CSS / baseline source / 5x 全 PASS。dispatched fix sonnet。
**Source**: Phase 1 B6 per PATH-2-HANDOFF.md §A.5；supersedes prior backlog entry #21
**Status**: FIND COMPLETE — 11 drifts confirmed，awaiting user decision on Phase 1B fix scope
**Coverage**: 4 states × 3 vp = 12 production vs 12 mockup baseline pairs (24 PNG total)
**Method**: Playwright production capture + mockup HTML frame screenshot；director cold-Read all 24 PNG
**Production code diff**: ZERO — audit-only, no production changes

| # | State × VP | Drift 分類 | Mockup 期望 | Production 現況 | PNG 證據 | 嚴重度 |
|---|---|---|---|---|---|---|
| D-1 | ok / warn / error × 全 vp | **transition bar copy — ok** | 「框架完整」/ sub：「四個欄位都對齊到 I 步核心定義，沒有需要修正」 | 「框架完整」/ sub：「所有欄位都對齊到 C 步核心定義」（step letter 動態但 copy 結尾不同：mockup 說「沒有需要修正」；prod 沒有） | gate-ok-Mobile-360.png vs mockup-ok-Mobile-360.png | minor |
| D-2 | warn × 全 vp | **transition bar copy — warn** | title「通過附提醒」/ sub：「2 處可優化，繼續 Phase 2 不會卡」 | title「框架可通過」/ sub：「可繼續但有 2 個建議優化點」（title 與 sub 字句都不同） | gate-warn-Mobile-360.png vs mockup-warn-Mobile-360.png | medium |
| D-3 | error × 全 vp | **transition bar copy — error** | title「需要修正方向」/ sub：「N 個欄位偏離 C 步核心，請回頭調整」 | title「方向需修正」/ sub：「有 N 個方向性問題需修正」（title 語序不同；sub 措辭不同） | gate-error-Mobile-360.png vs mockup-error-Mobile-360.png | medium |
| D-4 | warn × 全 vp | **transition bar icon — warn** | `ph-fill ph-check-circle`（綠色 filled check-circle，因 warn 仍通過） | `ph-fill ph-warning`（三角驚嘆號，橘色）| gate-warn-Mobile-360.png vs mockup-warn-Mobile-360.png | **HIGH** |
| D-5 | warn / error × 全 vp | **gate-section-label count 格式** | Mockup ok：「4 / 4 通過」；warn：「2 通過 · 2 提醒」；error：「2 通過 · 2 阻擋」（不同文字 per state） | 全部用「N / M 通過」格式（例如 warn 時顯示「2 / 4 通過」，error 顯示「3 / 4 通過」）— warn/error 沒有分開計數提醒/阻擋 | gate-warn-iPad.png vs mockup-warn-iPad.png | medium |
| D-6 | warn × 全 vp | **gate-item 建議 label** | Mockup：warn item 建議框 label 是「建議」（暖橘色） | Production：「修正方向：」（紅色，和 error 一樣，沒有區分 warn / error 語氣） | gate-warn-Mobile-360.png vs mockup-warn-Mobile-360.png | medium |
| D-7 | loading × 全 vp | **loading title + sub copy** | title「AI 正在審核你的框架」/ sub「通常需要 8 - 15 秒」 | title「正在審核框架」/ sub「教練閱讀你的回答中…」（title 少「AI」，sub 完全不同，缺少時間提示） | gate-loading-Mobile-360.png vs mockup-loading-Mobile-360.png | medium |
| D-8 | loading × 全 vp | **loading checklist 步驟數** | 5 個步驟（解析框架草稿 / 檢查欄位對齊步驟核心 / 偵測陷阱方向 / 生成具體建議 / 整合通行判斷） | 4 個步驟（解析欄位內容 / 對照 C 步重點 / 檢查方向性 / 整理回饋）— 少 1 步，copy 也全部不同 | gate-loading-Mobile-360.png vs mockup-loading-Mobile-360.png | minor |
| D-9 | loading × tablet / desktop | **phase-head meta — loading 狀態文字** | Mockup tablet：phase-head meta 顯示「等待 AI 審核回應」；desktop：「等待 AI 審核回應」+ 「已」標記 | Production tablet：phase-head meta 只顯示「等待 AI 審核回應」（只有 tablet 顯示，desktop 缺「已」標記）— tablet OK，desktop 的「已」marker 缺失 | gate-loading-iPad.png mockup-loading-Desktop-1280.png vs gate-loading-Desktop-1280.png | minor |
| D-10 | ok / warn × 全 vp | **phase-head — no meta on mobile / no timer on tablet+desktop** | Mockup tablet：phase-head meta 顯示「N.N 秒」timer icon；desktop：「審核耗時 N.N 秒 · N 個欄位 · 全部通過」多欄位 meta | Production：mobile/tablet/desktop 的 phase-head 均不顯示 timer 或欄位計數（renderCirclesGate 的 phaseHeadHtml 完全沒有 meta div） | gate-ok-iPad.png vs mockup-ok-iPad.png；gate-ok-Desktop-1280.png vs mockup-ok-Desktop-1280.png | **HIGH** |
| D-11 | ok / warn × desktop | **qchip content — desktop** | Mockup desktop：qchip 顯示完整題目 + 公司 · drill mode · type（長版）；qchip__icon 用 `ph-bookmark-simple` | Production desktop：qchip 顯示公司 · 產品名（無 drill mode / type 說明）；qchip__icon 用 `ph-info`（不同 icon） | gate-ok-Desktop-1280.png vs mockup-ok-Desktop-1280.png | minor |

**Total drifts found**: 11（vs original estimate "9"）

**Suggested fix scope（供 user 決定 Phase 1B）**：
- **Phase A 高影響（3 項）**：D-4（warn icon 語意相反影響用戶判斷通行 vs 阻擋）、D-10（desktop/tablet phase-head meta 計時器缺失，mockup 明確要求）、D-6（warn 建議 label 與 error 同色同文字，UX 混淆）
- **Phase B 中影響（5 項）**：D-2（warn transition bar copy）、D-3（error transition bar copy）、D-5（section label count 格式）、D-7（loading title/sub copy）、D-8（loading 步驟數與 copy）
- **Phase C 低影響（3 項）**：D-1（ok sub copy 末尾「沒有需要修正」缺失）、D-9（loading desktop 「已」marker）、D-11（qchip icon + 內容格式）

**Cross-refs**: mockup `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/04-phase-1-5-gate.html`；production `public/app.js` renderCirclesGate / renderGateResult / renderGateLoading（行 5082-5198）；PNG 證據 `audit/B6-mockup04-audit/`；原始 production PNGs `audit/png-mockup-04/`；mockup HTML capture spec `tests/visual/capture-mockup-04-mockup-html.spec.js`

---

<!-- NEW-Bug-B moved to §5 closure (commit b126937 2026-05-17 PM Wave 1B-b) -->


### NEW-Test-Debt (2026-05-17 PM, Director cold-Read after Bug B 2-stage review)
**狀態：【A — 已 brainstorming + 實作 planned (commit C5)，等 commit】**
**Source**: cross-spec smoke discovered after Bug B class rename — pre-existing test/prod drift unrelated to current commit
**Severity**: P2 (test-only; production rendering correct per mockup 07)
**Findings**:
1. `tests/visual/nsm-step-2-3.spec.js` line 109 + 127: expect 4 dim labels (`觸及/互動/習慣/留存` or `啟用/席次/黏著/擴張`) but production renders only **3 dims** post impact-removal (confirmed via `nsm-freq-label-by-type.spec.js` comment "post impact-removal" + `expect(dimCards).toHaveCount(3)`)
2. Same spec lines 191, 214: `attention dims desc verbatim` / `saas dims desc verbatim` — same root cause, expect 4 desc strings
3. Affected: 4 tests × 8 vp in visual config = ~32 failures consistent with pre-existing drift
**Suggested fix scope (separate task — not in current commit)**:
- Update expect arrays from 4 → 3 labels (remove `'留存驅力'` / `'擴張信號'`)
- Update desc arrays from 4 → 3 entries (remove impact dim desc)
- Verify against `NSM_DIMENSION_CONFIGS.attention/saas` in app.js for exact dim list per type
**Cross-ref**: `nsm-freq-label-by-type.spec.js:154` `expect(dimCards).toHaveCount(3)` confirms 3-dim production state；Bug B 2-stage review caught this via cross-spec class rename verification

---

### ⚡ COMMON design issue — NSM/CIRCLES component drift（**🔴 user 2026-05-19 標 PRIORITY**）
**狀態 (2026-05-19 user 決)：【A — 方案 B 限定範圍 STANDING + drift scan 進行中】**

> **🔴 優先處理項** — 已連續撞 Bug A + Bug B 兩個 user-visible bug；user 想知道還有多少潛在 drift 等被撞。

**已造成 bug**:
- ✅ NEW-Bug-A (P0 NSM 切題 ghost content) — shipped `b126937`（原因：NSM 沒抄 CIRCLES 的 reset block）
- ✅ NEW-Bug-B (P2 NSM hint row 排版) — shipped `b126937` + `b0c7a55`（原因：NSM 自訂 wrapper 沒用 CIRCLES `renderField`）

**user 決定 (2026-05-19)**: 走方案 B — 立精準 STANDING memory「**LOCKED component 跨 NSM/CIRCLES 必須 reuse 同一個 helper function**」+ 範圍限定已知 LOCKED 元件

**🔍 In-flight drift scan (slot N sub-agent `a7d646e0b39dd0343`)**: 全面掃 NSM ↔ CIRCLES drift，產出 `audit/nsm-circles-drift-scan-2026-05-19.md`；找所有「drift（未撞）」潛在 ghost-bug；完工 append 此 entry

**實作 task（待 drift scan 回 + user 放行）**:
1. 寫 STANDING memory file（10 分鐘）
2. 基於 drift scan 結果列現知 LOCKED 元件清單（10 分鐘）
3. 抽 helper（NEW-Bug-A reset / NEW-Bug-B hint-row + drift scan 抓到的 top priority drift，~半天到 1 天）
4. 之後每立新 LOCKED 元件更新 list

**優先序**: 跟 Phase 2 C-T3 CIRCLES director walk 同期最自然。不擋當前 commit C1-C5。

**Cross-ref**: drift scan audit doc（待 sub-agent 回）將提供 top 5 priority drift list 給 user 決定 fix 順序

---

### C-T1 finding: AI 4-surface error handling audit (2026-05-17 PM)
**狀態：【Mixed】** F-CT1.1 = SHIPPED `1b75c0f`（debt 該移 §5）/ F-CT1.2 = SHIPPED `b126937`（debt 該移 §5）/ F-CT1.3 = A staged 等 commit C3 / F-CT1.4 = **A 已實作 staged (sub-agent D 2026-05-18)** 等 spec-compliance reviewer / F-CT1.5 = N/A 已指向 F-2 修法 `a221cf0`
**Source**: Phase 1 C-T1 task per PATH-2-HANDOFF.md §A.5
**Hypothesis-link**: 99.9% NSM conversion drop（6500 sessions 卡在 lifecycle='created'，只有 1 個到達 'gated'）可能因 AI 呼叫失敗被靜默吞掉而未回滾 lifecycle，或 FE spinner 卡死讓用戶無法重試。

| Surface | Catch coverage | Lifecycle on error | User msg | Retry? | Gap |
|---|---|---|---|---|---|
| NSM gate | 通用 catch(e) 兜底；prompt 層 3 次重試 800ms/1600ms 間隔 | 不推進（gate_fail 路徑不改 lifecycle）；但 throw 會跳過 `computeLifecycle+update` → lifecycle 停在 created | FE 顯示「審核服務暫時無法使用，請重試。」banner + 返回修改按鈕 | Prompt 層有 3 次，BE route 無額外重試；FE 無自動重試 | 429/500/timeout 全吐 e.message 出去，FE 看到 undefined 就顯示 'gate_error'；沒有區分 rate-limit vs server error；錯誤後 lifecycle 留在 created **完全正確**（不是問題） |
| NSM evaluator | try/catch 兜底；T6 checkpoint write/clear；prompt 層 3 次重試 1000ms/2000ms | catch 後清 evaluating checkpoint + 寫 evaluation_error；lifecycle **不回退**（已在 gated 因為有 L19 guard） | FE：`nsmEvalError` 設 e.message；但 **`nsmEvalLoading` 在 early-return 路徑沒有清除** → spinner 卡死 | Prompt 層 3 次；BE route 無額外重試；FE 無自動重試 | `!res.ok` early return（app.js:2043）沒有 `AppState.nsmEvalLoading = false` → 用戶看到轉圈永遠不停；必須重新整理頁面 |
| CIRCLES gate | 通用 catch(e)；FE 有 AbortError/timeout 分類；prompt 層 3 次重試 | 不推進；lifecycle 停在 created（gate_fail 不改狀態） | FE 有 GATE_TIMEOUT/GATE_API_ERROR/GATE_PARSE_ERROR 分類顯示；互斥鎖 finally 一定 release | Prompt 層 3 次；FE persistRetry 只管 PATCH，不管 gate API 本身 | circles-gate.js:117 第 2、3 次 attempt 之間沒有 backoff 延遲（相較 nsm-gate.js 有 `setTimeout(r, 800*(attempt+1))`）；429 會被快速重試兩次再拋出 |
| CIRCLES evaluator | evaluate-step-handler.js M2 分類：AbortError→EVAL_TIMEOUT / SyntaxError→EVAL_PARSE_ERROR / 401→EVAL_AUTH_ERROR；30s AbortController timeout | DB update 在 success path；catch 不改 lifecycle（已是 gated）；但 Phase 2 結論送出路徑（app.js:7136）用 **raw `fetch`** 而非 `window.apiFetch` | FE renderPhase3Error 有完整 4 類錯誤文案；retry 按鈕（已評分時 disable）| evaluate-step-handler.js 無重試（intentional：`// No retry — callers own retry`）；FE Phase 2 結論提交路徑的 evaluate-step 失敗後只 re-enable button，不渲染錯誤 UI，用戶不知道 evaluate 失敗 | Phase 2 評分失敗靜默（app.js:7157-7161 沒有設 circlesPhase3Error），同時 Phase 2 路徑用 raw fetch 跳過 401 refresh+retry |

**Top findings（依對 99.9% 轉換率假說的影響力排序）**：

1. **[F-CT1.1] [Sev P1] [NSM evaluator]** — `nsmEvalLoading` spinner 卡死：用戶點送出 AI 評分後，若伺服器回 4xx/5xx，FE early-return 不清 `nsmEvalLoading`，spinner 永久不消失，用戶唯一出路是整頁重整（app.js:2039-2043）。
   **Why matters**: 直接貢獻「評分送出後沒反應」的放棄率；但此 surface 在 L19 前已被 403 gate-required 擋死（NSM 卡在 created 連 /evaluate 都打不到），所以實際觸發需要先修 F-2 + 轉換率提升後才會大量觸發。修 F-CT1.1 應與 F-2 配套。
   **Suggested fix scope**: `app.js` NSM evaluate `!res.ok` branch 補 `AppState.nsmEvalLoading = false` + `render()`（1 行）
   **已 shipped `1b75c0f` 2026-05-17（詳 §5 Optimization closures L32 entry）**

2. **[F-CT1.2] [Sev P1] [CIRCLES evaluator Phase 2 path]** — Phase 2 結論送出的 evaluate-step 失敗靜默吞掉：`app.js:7157-7161` `evalRes.ok === false` 只做 `conclusionSubmitBtn.disabled = false`，不設 `circlesPhase3Error`，用戶不知道評分失敗，也看不到重試按鈕（只有 button 重新 enable）。同路徑使用 raw `fetch` 而非 `window.apiFetch`，跳過 401 token refresh 機制（app.js:7136）。
   **Why matters**: 用戶填完答案點送出，進入 loading，AI 失敗 → 靜默回到 Phase 2 submit 狀態，無任何錯誤提示，100% 的錯誤對用戶不可見，且 token 過期後會出現 401 靜默失敗。
   **Suggested fix scope**: 補 `AppState.circlesPhase3Error = { code: errCode, ... }` + `render()`；raw fetch 改 `window.apiFetch`（app.js:7136 + 7157-7161）
   **已 shipped `b126937` 2026-05-17（詳 §5 Optimization closures L33 entry）**

3. **[F-CT1.3] [Sev P2] [CIRCLES gate]** — prompt retry 無 backoff 延遲：`circles-gate.js:104-121` 第 2、3 次 attempt 之間無 `setTimeout` 延遲，遇到 429 rate-limit 時連續打三次 OpenAI，只要第一次 429 大概率三次都 429，等效於無 retry 保護（相比 nsm-gate.js 有 800ms/1600ms 漸進等待）。
   **Why matters**: 流量尖峰時 CIRCLES gate 審核失敗率顯著高於 NSM gate；若 CIRCLES 是 conversion funnel 的前置關卡，此 gap 直接影響用戶能否完成審核並繼續。
   **Suggested fix scope**: `circles-gate.js:119` 前加 `await new Promise(r => setTimeout(r, 800 * (attempt + 1)));`（1 行，mirror nsm-gate.js 模式）

4. **[F-CT1.4] [Sev P2] [NSM gate]** — 錯誤訊息洩漏 + 分類缺失：`routes/nsm-sessions.js:189` catch 直接回傳 `e.message`（OpenAI SDK 拋出的英文錯誤訊息，可能含敏感 API 錯誤細節）；FE 只顯示 `err.error || 'gate_error'` 字串而非中文說明；沒有區分 429（rate limit）/ 500（server error）/ timeout（網路）給用戶不同的 UX 提示。（NSM evaluator 同樣問題 routes/nsm-sessions.js:152-161）
   **Why matters**: 用戶看到英文錯誤或 undefined 時完全不知道該等多久還是重試，導致放棄率高。
   **Suggested fix scope**: route catch 統一回 `{ error: 'ai_service_error', code: 'GATE_TIMEOUT/GATE_API_ERROR' }`；FE 對應中文訊息（mirror CIRCLES evaluator 模式）
   **FIX STAGED (2026-05-18 PM, sub-agent D — W1-補.7)**:
   - **BE**: `routes/nsm-sessions.js` +16 lines — gate + eval catch handler 改為 classification `{error:'ai_service_error', code:'GATE_RATE_LIMIT|GATE_TIMEOUT|GATE_API_ERROR'}` status 503
   - **FE**: `public/app.js` +204/-45 lines — gate render i18n + eval error render + retry button；code mapping: `GATE_RATE_LIMIT`→「審核服務目前負載過高」/ `GATE_TIMEOUT` / `GATE_API_ERROR`→「審核服務暫時無法使用」；`renderNSMStep3` 新增 eval error 區塊（`EVAL_*` → 中文）
   - **New spec**: `tests/e2e/wave1-fct1.4-nsm-gate-error-i18n.spec.js` 3 AC × 3 vp
   - **RED→GREEN**: RED 9/9 FAIL → GREEN 50/50 PASS（5 consecutive × 10 specs）0 flake
   - **No-regression**: nsm-evaluator-error-clears-spinner 3/3 PASS（F-CT1.1 unaffected）
   - **Known caveat**: AC-3 spec `route.abort('failed')` 在瀏覽器層觸發 TypeError（非 AbortError），FE catch 映射到 `GATE_API_ERROR` 而非 `GATE_TIMEOUT`；`GATE_TIMEOUT` 需 FE AbortController timeout 才能觸發 — **D 列後續 task（待 reviewer 判定是否該在此 commit 補）**
   - **Next action**: dispatch spec-compliance reviewer (slot 2 in flight `aad67acdff07ba6fb`) → APPROVED → code-quality reviewer → commit C5

5. **[F-CT1.5] [Sev P3] [NSM gate — lifecycle root cause]** — 最核心發現：NSM lifecycle='created' 堆積的主因**不是 AI 錯誤**，而是**設計本身**：`GET /api/nsm-sessions` 預設過濾掉 lifecycle='created' 的 row（routes/nsm-sessions.js:59）；每次 NSM session 建立後就是 'created'，只有通過 gate 才升 'gated'。所以 6500 rows 中 99.9% lifecycle='created' = 6499 個用戶建立 session 但還沒按「送出 NSM 定義」。AI 錯誤頂多造成已按送出但 gate 失敗者無法繼續（佔比估計 < 1%）。F-2 修 sticky bar 蓋輸入框才是最直接的 conversion 提升點。
   **Why matters**: 重新定位 C-T1 調查範圍——AI error handling 的 gap 是真實的，但主要影響 already-past-gate 的用戶體驗，不是造成 99.9% drop 的根因。建議 C-T2 深挖 UX 流程斷點（用戶是否有機會填寫 + 按送出）。

**Cross-refs**:
- `feedback_find_first_fix_later_via_tracker.md`：以上全是 find-only，不動 production
- C-T2 task（線上深挖 99.9% conversion 斷點）— 本 finding #5 指向 F-2 UX 修正後追蹤 conversion 變化才能驗證
- `routes/nsm-sessions.js:59`（lifecycle filter），`app.js:2039-2043`（spinner bug），`app.js:7136,7157-7161`（CIRCLES Phase 2 silent fail），`prompts/circles-gate.js:104-121`（no backoff）

### F-CT1.4b: CIRCLES side `e.message` leak (2026-05-19, discovered during W1-補.7 review)
**狀態：【A — plan ready，等 user 決定 ship 時機（建議 Wave 2 完才動 C-Drift-5）】**
**Source**: W1-補.7 spec-compliance reviewer cross-spec drift check
**Spec**: `routes/circles-sessions.js` line 39, 105, 198, 251, 306, 463, 482 — 7 catch blocks 同 NSM pre-W1-補.7 vulnerability
**Why matters**: CIRCLES FE 的 renderGateError 已有 GATE_* i18n，但 BE 從不產生 code → 用戶仍看到英文 raw e.message
**Plan**: `audit/p2-c-drift-f-ct1.4b-circles-emessage-leak-plan.md` (Phase B writeup; 7 catch blocks ship order = #3 HIGH gate → #5+#4 MEDIUM → #2/#1/#6/#7 LOW; recommend 3-sub-commit split C-Drift-5a/b/c or single C-Drift-5)
**Audit (find-phase)**: `audit/F-CT1.4b-circles-emessage-leak-audit.md`
**Commit boundary**: independent `C-Drift-5` (NOT bundled with Wave 2 NSM drift; ship after Wave 2 lands)
**Sibling debt**: F-CT1.4c — `routes/guest-circles-sessions.js` 9 parallel leaks (lines 49/127/143/168/196/243/288/435/454); recommend file new §3 P2 entry
**Owner**: user gate

---

## §4 Verification Matrix (latest pass/fail)

| Spec / Suite | Result | Last verified |
|---|---|---|
| **jest full** | ✅ **562/579** (post Wave 1B-b; 17 skip / 0 fail) | post `706d26c` |
| API integration full suite | ✅ 196/199 (3 are concurrent-load flakes in nsm-context-hints-progress-coverage; isolated 19/19 PASS) | post L24 `ca59bbd` |
| **nsm-question-switch-resets-draft (NEW-Bug-A)** | ✅ 35/35 × 5 runs (3 vp) + sub-agent report + Director 3/3 desktop verify | post `b126937` |
| **nsm-dim-card-hint-row-position (NEW-Bug-B)** | ✅ 5/5 desktop (4 AC + setup); 3 baseline snapshots; parallel 3-vp has 1 transient Supabase ConnectTimeoutError (infra) | post `b126937` |
| **circles-phase2-evaluator-error-shown (F-CT1.2)** | ✅ 3/3 desktop (2 AC + setup); 6 PNG; parallel mobile-safari AC-2 1 transient auth refresh timeout (infra) | post `b126937` |
| **circles-gate-warn-icon-color (B6 D-4)** | ✅ 45/45 × 5 runs (3 vp × 3 AC) | post `1b75c0f` |
| **nsm-evaluator-error-clears-spinner (F-CT1.1)** | ✅ 15/15 × 5 runs (3 vp) | post `1b75c0f` |
| **nsm-freq-label-by-type (post Bug B rename)** | ✅ 5/5 desktop (class-rename verified no regression) | post `b126937` |
| API lifecycle (CIRCLES+NSM) | ✅ 16/16 real OpenAI | post L19 |
| circles-no-bypass | ✅ 5/5 × 5 runs no flake | post L5 |
| nsm-no-bypass | ✅ 4/4 × 5 runs no flake | post L19 |
| circles-back-nav-lock | ✅ 16/16 × 3 vp | post L25 |
| circles-fe-gate-stale-state | ✅ 15/15 × 3 vp | post L13 |
| circles-fresh-form-no-ghost (Scen C mobile-chrome) | ✅ 30/30 × 5 runs no flake | post L11 |
| circles-phase3-restore-real | ✅ 10/10 + 50/50 × 5 runs post-L29 flake fix | post L29 `cac214c` |
| bug3-spinner-deep-investigation | ✅ 5/5 × 5 runs no flake | post L17 |
| 4-pillar adversarial sweep (CIRCLES gate / NSM gate / CIRCLES evaluator / NSM evaluator) | ✅ all robust; max totalScore=40 < 60 | L2 + L9 + L12 + L15 |
| Concurrent CLI burst load (3 × 16/16) | ✅ no DB session collision | post L25 |
| offcanvas-delete (incl B4-E3 NSM) | ✅ 15/15 (5 runs × 3 browsers) | post L20 |

---

## §5 Closed Issues (audit trail)

### P0 ship closures (本 session 7/7)
| # | Bug | Resolved via | Final commit |
|---|---|---|---|
| #251 | Bug 1 全 Y 過審 | L2 backend cleared + L10 LEAK-A + L13 F1+F2 | `85f0039` |
| #252 | Bug 2 ghost content | L4 RED + L11 reset | `c156c6b` |
| #255 | Bug 6 沒審核放行 | L3 RED + L5 8 BE+FE guards | `93b1b26` |
| #263 | iOS Safari Phase 3 (P1-#256 Bug 7 同) | L1 verified already shipped | `654d0e8` (2026-05-16) |
| P0-NEW-3 | persistRetry session-object | L14 + L16 dual fix | `91fb2ad` |
| P0-NEW-4 | Bug 3 spinner (reclass P2→P0) | L13b RED + L16 scope-leak + L17 spec flip | `2aa8fd5` |
| P0-NEW-5 | NSM /evaluate bypass | L18 RED + L19 fix | `9142eef` |
| P0-NEW-6 | Cross-plan smoke 5 API spec drift | L24 lifecycle seed | `ca59bbd` |
| P0-NEW-7 | NSM gate ok/warn 略過 result UI (user report 2026-05-17 PM) | L30 Option A fix (keep nsmSubTab='nsm-gate' for ok/warn, mirror error case persist; user click proceed required) | `58d6749` — mockup 08 三態 contract restored; new TDD spec `nsm-gate-result-ui-display.spec.js` 2/2 GREEN × 5 runs no flake + nsm-full-flow workaround removed + lifecycle-nsm 8/8 + no regression |

### P0 mis-diagnosis closures
| # | Resolution |
|---|---|
| P0-NEW Lifecycle gate→gated | TEST FIXTURE drift not prod bug；stubs `{ok}` → `{canProceed, overallStatus}` per task #208；commit `069986e` |
| P0-NEW-2 jest tests/circles-sessions.test.js cascade | Resolved in L5 commit `93b1b26` (3 spec updates included) + L8 makeSession seed `05025b9` |

### P1 closures
| # | Resolved via |
|---|---|
| P1-#256 Bug 7 已填內容消失 | Same root cause as P0-#263 commit `654d0e8` |
| P1-#264 Auth race (reclassified Supabase DB collision) | L22 audit `36f4ba2` + L25 fix `1e293b3` — waitForServer + tagSessionWithPid scoped cleanup |
| P1 Plan #194 T4 TC1 happy retry timeout | Same root cause as P0-NEW-3；L16 dual fix `91fb2ad` |
| P1 Critical-path mobile flake (.navbar__email) | L14 V7 pattern applied `2165c2a` |

### P2 closures
| # | Resolved via |
|---|---|
| #253 Bug 3 spinner stuck | Reclass P2→P0-NEW-4，then closed via L17 `2aa8fd5` |
| #254 Bug 4 offcanvas delete cache | NOT_REPRODUCIBLE verified (Bug 4 audit `3af488d` 7 scenarios GREEN) + L20 NSM coverage `f292a22` |
| F-P16 NSM session DELETE spec gap | L20 unblock B4-E3 + 確認 no cache leak (`f292a22` + `961cb09`) |
| #211 B3 retrofit C | Duplicate of #201 (commit `72e7797`) |
| #207 B5 Stage 1C qchip-panel decision | SUPERSEDED — Stage 1C ship (commits `f6b18fe` `a0e5531`) 被 chat-drift wave 1-4 取代；`49d00ba` 已 swap Phase 2；L23 `f2a3d58` 已 delete orphan `renderQchipPanelHtml`；user 2026-05-18 結案 |

### Plan completions (paused → done)
| Plan | Closure |
|---|---|
| #190 Lifecycle plan | schema+lib+handler shipped；P0-NEW test drift closed |
| #191 1B state/cache plan | L29 close — 8/8 tasks shipped + B3-R1 flake fix `cac214c` |
| #192 1C Phase 2 UI plan | SUPERSEDED by chat-drift wave 1-4 + L23 orphan delete `f2a3d58` |
| #194 5 P0 resilience plan | T1/T2/T5 pre + T3 + T6 + T4 (via L16) all shipped |

### Optimization closures
| O | Closed |
|---|---|
| O-6 B10 `_doOffcanvasDelete` cache invalidate | L31 — 2-line `AppState.circlesRecentSessions = null; render()` (app.js:8547-8550) + spec `offcanvas-delete-invalidates-recent-sessions.spec.js` 7/7 × 3 vp GREEN + Director cold-Read 4 PNG diff `e811378` |
| F-CT1.1 NSM evaluator spinner 卡死 (partial close of §3 C-T1) | L32 — 1-line `AppState.nsmEvalLoading=false;` at app.js:2042 + spec `nsm-evaluator-error-clears-spinner.spec.js` (281 lines) 15/15 × 5 runs (3 vp) + 3 PNG evidence + no regression (nsm-gate-result/freq-label/hint 25/25 PASS). **F-CT1.2/1.3/1.4/1.5 仍 pending §3** |
| B6 D-4 warn icon 顏色相反 (partial close of §3 B6 11-drift) | L32 — 1-char swap `ph-warning`→`ph-check-circle` at app.js:5146 + spec `circles-gate-warn-icon-color.spec.js` (186 lines) 45/45 × 5 runs (3 vp × 3 AC) + 3 baseline snapshots + Director cold-Read confirmed visual match mockup 04. **B6 D-1/2/3/5/6/7/8/9/10/11 仍 pending §3** |
| **NEW-Bug-A** NSM 切題不清舊答案 (P0/P1 ghost content, user reported 2026-05-17 PM) | L33 (this commit) — 10-line reset (start btn app.js:6330-6342 + back btn app.js:1883-1896) mirror CIRCLES Bug 2 c156c6b pattern + new spec `nsm-question-switch-resets-draft.spec.js` (450 lines incl auto-cleanup afterEach hook to prevent Supabase leak per Bug A reviewer Critical) 3/3 desktop + 5x consec 35/35 (earlier sub-agent report) + 15 PNG evidence + Bug-A 2-stage review CRITICAL fixes applied |
| **NEW-Bug-B** NSM dim hint+example 不在 head row (P2 visual contract, user PNG-31 2026-05-17 PM) | L33 (this commit) — `renderNSMDim` template restructure (app.js:1726-1746) mirror mockup 07 line 1355-1384 `.field__label-row > .field__hint-row` canonical pattern + style.css L1802-1834 dead `.nsm-dim__head/__label/__hint-btn/__hint` 20 lines DELETE + new spec `nsm-dim-card-hint-row-position.spec.js` (194 lines) 4 AC × 3 vp + 3 baseline snapshots + 3 audit PNG + hint test rewritten to assert `.hint-overlay__backdrop` modal (post-architecture migration, replaces obsolete `.nsm-dim__hint-content` inline). Bug-B 2-stage review CRITICAL cross-spec drift fixes: `nsm-freq-label-by-type.spec.js:145` + `nsm-step-2-3.spec.js:108,126,144,145` migrated to new class names |
| F-CT1.2 CIRCLES Phase 2 evaluator silent fail (partial close of §3 C-T1) | L33 (this commit) — 3 surgical edits app.js:7122-7126 + 7137-7141 + 7158-7168 (raw `fetch` → `window.apiFetch` × 2 sites; `evalRes.ok===false` branch sets `AppState.circlesPhase3Error = {code, message}; render()`) + dead `headers` var removal app.js:7128 (Wave #2 reviewer CRITICAL) + new spec `circles-phase2-evaluator-error-shown.spec.js` (375 lines) AC-1 503 → error UI shown + AC-2 401 → apiFetch refresh+retry succeeds + 6 PNG evidence (3 vp × 2 AC). **F-CT1.3/1.4/1.5 仍 pending §3** |
| O-7 NSM seed helper for offcanvas-delete | L20 `f292a22` + audit `961cb09` |
| O-9 orphan renderQchipPanelHtml delete | L23 `f2a3d58` (15 lines, 0 callers verified) |

### 2026-05-17 PM session ship — director walk + 401 fix
| Finding | Severity | Resolved via | Final commit |
|---|---|---|---|
| F-1 NSM context-card 空殼 | NOT_PROD_BUG (test fixture drift) | Update walk fixture to real `nsm_database.json` q1 Netflix shape | `d2d1d2f` |
| F-2 sticky bar 蓋第一欄 (mobile blocker) | P1 prod CSS bug | `.nsm-body` 加 `padding-bottom: calc(var(--touch-min) + var(--s-7))` | `a221cf0` |
| FLOAT-1 mockup 07 hint 9 行 orphan | mockup drift | sed 刪除 align production renderNSMContextCard 0 hint render | `c70b8e9` |
| FLOAT-2 401 timeout auto-logout (was D dashboard route) | P1 UX | C fix — apiFetch 401 → refreshSession() → retry → kick only if refresh fails；+ onAuthStateChange TOKEN_REFRESHED sync | `e883eb8` |
| FLOAT-3 mockup 07 對齊 user 親看 | mockup pending sweep | User reviewed browser + 「mockup 通過」 (FLOAT 結案) | n/a (user signoff) |

**Director walk infra**: `tests/e2e/audit-nsm-director-walk-2026-05-17.spec.js` (27 PNG × 3 vp, viewport-only 02b for F-2 verify)
**C fix new spec**: `tests/e2e/apiFetch-401-refresh-retry.spec.js` (AC-C-1 success + AC-C-2 failure × 3 vp = 6/6 GREEN)
**Live Supabase insight**: nsm_sessions 6500 rows, 99.9% 卡在 lifecycle='created' 沒完成 — F-2 修了應該改善 conversion

### Preventive sweep audits (NEGATIVE findings — confirmed solid)
| Lane | Audit |
|---|---|
| L2 CIRCLES gate adversarial 10 變體 | `f7a43ff` — 10/10 reject × 3 runs |
| L9 NSM gate adversarial 10 變體 | `322dfa8` — 10/10 reject |
| L12 CIRCLES evaluator adversarial 7 變體 | `0efe786` — totalScore=16 well < 60 |
| L15 NSM evaluator adversarial 7 變體 | `c853d93` — max totalScore=40 < 60 |
| L26 NSM /context+/hints+/progress audit | `4bdba5b` — 19/19 GREEN, 0 leak, 3 endpoint groups SAFE by-design |

---

## §6 Optimization Opportunities

### O-1 / F-007 wave — Refactor ~65 specs from route.fulfill stubs → real Supabase
**移到 §2 P1-#257**（已 elevated 為 active P1）

### O-2 Delete 5 vm.createContext app.js helper specs
- Master plan F-008
- Partly done via Retrofit C/D；待 F-007 wave 之後一起清

### O-3 Unmount stale routes/prompts dead code
- Master plan F-002 + F-003
- Files: `routes/sessions.js`, `routes/guest-sessions.js`, `prompts/coach.js`, `prompts/evaluator.js`, `prompts/issue-generator.js`
- Effort: small

### O-4 Mockup 04 audit + 9 transition drift
**移到 §3 #21**

### O-5 Plan #194 T7/T8/T9 remaining
- T7 spec reorg / T8 adversarial 5 specs / T9 final regression + cold-Read 4 toast PNGs
- Effort: medium

### O-8 jest "pre-existing fails" reclassification policy enforcement
- Discovery: 4 lifecycle wire fails were misclassified；本 session 抓 4 個真 bug 起源於 baseline 假綠燈
- Action: enforce policy — any NEW commit must show jest count ≥ baseline AND every fail must be tagged
- Effort: process change, already informally enforced post-2026-05-17

### O-10 Extract `_doOffcanvasDelete` / `bindOffcanvas` from app.js
- Note: app.js ~8200 LOC；many helpers extractable
- Effort: large

### O-11 Adversarial extension to remaining AI prompts
- `circles-conclusion-check` / `circles-final-report` / `circles-coach-version` 還沒 adversarial sweep
- 4-pillar → 7-pillar coverage
- Effort: 2-4h (mirror L2/L9/L12/L15 pattern)

### O-13 visual-regression baseline 全庫掃描 + mockup-source 遷移
- **Source**: 2026-05-17 PM Bug B follow-up + 2026-05-18 D-11 case；user 親眼抓到 padding 漏；per new STANDING `feedback_visual_baseline_from_mockup_not_production`
- **Scope**: scan `tests/e2e/*.spec.js-snapshots/` + `tests/visual/baselines/` for all `toHaveScreenshot` baselines
- **Action**: tag 每個 baseline 是 mockup-sourced 還是 production-sourced；後者視為 debt，逐步用 mockup HTML render 重生
- **Architectural debt (per systematic-debugging 3-fix architecture rule)**:
  - 已知失敗 case：D-11 qchip icon 改 ph-bookmark-simple 對齊 mockup 04，但既有 spec `circles-gate-warn-icon-color.spec.js` AC-3 baseline 自 production 自截鎖在舊 ph-info icon → spec fail
  - 3-fix 連敗：(1) `--update-snapshots` 被 permission 擋 ✓ STANDING enforce (2) 寫 mockup-render baseline pipeline = O-13 大工 (3) 跑 D-11 全庫遷移 = O-13 同
  - architectural question 結論：baseline 來源 architecture 本身錯（production 自截 ≠ mockup spec contract），需 architectural fix（baseline pipeline 重建），不是 D-11 hide symptom
- **Remediation spec (commit 後正式立)**:
  - 寫 `scripts/regenerate-visual-baselines-from-mockup.js` Playwright render mockup HTML → save baseline → spec diff against
  - migrate 50+ existing baseline 一個一個對 mockup
  - deadline: Phase 2 covered period 之內（per CLAUDE.md Phase 2 ~2-3 天 + O-13 large effort 1-2 天）
- **Known-fail registry (本 Wave skip)**: `audit/known-fail-registry.md` 寫明 `circles-gate-warn-icon-color.spec.js` AC-3 為 O-13 deferred
- **Effort**: large（50+ baseline + pipeline 重建）
- **Priority**: P2（系統性 debt，不阻 ship）；新 visual spec 從今天起必走 mockup-source

### O-12 L25 :3000 fallback flag
- L25 commit `1e293b3` `auth.setup.js` waitForServer 用 `BASE_URL || 'localhost:3000'` 但專案 dev server 是 :4000
- 一般情況 BASE_URL env 設好不會踩，但 fallback misleading
- Effort: tiny (~1 line)

---

## §7 Paused Plans Status (#190-194)

✅ **全 closed** — 詳見 §5 plan completions。

---

## §8 Cross-references (audit doc map)

| Path | Purpose |
|---|---|
| `audit/findings-slice-{circles,nsm,cross,edge}-2026-05-17.md` | 82 findings on 4 surface clusters |
| `audit/lane-b-test-inventory-2026-05-17.md` | full test inventory (~210 specs) |
| `audit/lane-c-product-surface-map-2026-05-17.md` | 36 render fn + 57 endpoints + 20 prompts |
| `audit/lane-k-b2-ghost-content-investigation-2026-05-17.md` | Bug 2 prior investigation |
| `audit/lane-l-b7-data-loss-vectors-2026-05-17.md` | B7 data loss vectors |
| `audit/persistence-comprehensive-audit-2026-05-16.md` | Plan #194 baseline audit |
| `audit/testing-trophy-audit-2026-05-16.md` | Trophy reset baseline |
| `audit/bug3-deep-investigation-2026-05-17.md` + `audit/bug3-deep/` | Bug 3 BUG CONFIRMED 35 PNG |
| `audit/bug4-reproduce-2026-05-17.md` + `audit/bug4-reproduce/` | Bug 4 NOT_REPRODUCIBLE 7 scenarios |
| `audit/diagnose-iOS-safari-phase3-restore/diagnose-2026-05-17.md` + traces | L1 iOS Safari diagnose |
| `audit/repro-bug1-all-Y-adversarial-2026-05-17.md` | L2 adversarial sweep |
| `audit/bug6-bypass-path-enumeration-2026-05-17.md` | L3 Bug 6 enumeration |
| `audit/repro-bug2-ghost-content-2026-05-17.md` + PNGs | L4 Bug 2 RED evidence |
| `audit/bug1-fe-gate-stale-state-2026-05-17.md` + `audit/bug1-fe-gate-stale/` 24 PNG | L10 LEAK-A finding |
| `audit/critical-path-3-fails-investigation-2026-05-17.md` + `audit/L14-evidence/` | L14 critical-path triage |
| `audit/nsm-bypass-path-enumeration-2026-05-17.md` | L18 NSM enumeration |
| `audit/L22-auth-race-investigation-2026-05-17.md` | L22 auth race reclassification |
| `audit/L23-orphan-cleanup-2026-05-17.md` | L23 O-9 closure |
| `audit/L26-nsm-context-hints-progress-coverage-2026-05-17.md` | L26 negative finding |
| `audit/L29-1b-state-cache-completion-2026-05-17.md` | L29 Stage 1B closure |
| `audit/eyeball-2026-05-17-pm-7-p0-ship.md` | Director cold-Read for 7 P0 ship |
| `audit/sop-2026-05-17-circles-lock-and-qchip-uat.md` | UAT SOP chat-drift |
| `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` | Master plan F-001..F-014 |
| `docs/superpowers/plans/2026-05-17-pm-multi-phase-ship-plan.md` | Multi-phase ship roadmap (A/B/C/D) |
| `docs/superpowers/plans/2026-05-17-circles-chat-drift-and-lock-plan.md` | Chat-drift plan |
| `docs/superpowers/plans/2026-05-16-persistence-resilience-plan.md` | Plan #194 |
| `CLAUDE.md` | Live state board |

---

## §9 Skill Citation Reference

All e2e specs apply playwright-skill at `/Users/albertpeng/.claude/skills/playwright-skill/core/`:
- `common-pitfalls.md` Pitfall 11 (no own backend mock) — carve-out only for error-state simulation
- `common-pitfalls.md` Pitfall 14 (no module-level shared state)
- `common-pitfalls.md` Pitfall 18 (`page.evaluate` only for true JS APIs)
- `common-pitfalls.md` Pitfall 19 (`test.step()` for multi-phase)
- `common-pitfalls.md` Pitfall 3 (role-based locators)
- `api-testing.md:783-848` (data seeding via service-role)
- `api-testing.md:1023-1166` (error response testing)
- `auth-flows.md:928-949` (API seed auth)
- `mobile-and-responsive.md:49-71` (device profiles)
- `network-mocking.md:839-933` (intermittent failure pattern)
- `multi-user-and-collaboration.md:27-58` (cross-tab newContext)
- `visual-regression.md` (toHaveScreenshot pixel-diff)
- `assertions-and-waiting.md` (expect.poll / toBeVisible)

Per STANDING `feedback_e2e_integration_supreme`: 5x consecutive 0 flake gate.
Per `feedback_playwright_skill_cited_application`: spec cites segment + pattern name.
Per `feedback_two_stage_review_mandatory`: spec compliance + code quality reviewer per commit.
Per `feedback_uiux_visual_only`: Director cold-Read every PNG.
Per `feedback_tracker_unresolved_hub`: §1-§3 only active；resolved → §5.

---

## §10 How to Use This Tracker

**For Director (opus)**：
1. 開 session 立刻 Read §1 + §2 + §3 = action queue
2. 新 finding → append §1-§3
3. fix shipped → **剪貼整段 → §5**（不准留 strikethrough）
4. §4 matrix = check before claim GREEN

**For Implementers (sonnet)**：
1. Pick from §1 / §2 by priority
2. Cite related audit slice (§8) in spec header
3. Apply skill citations (§9) verbatim
4. Don't claim GREEN without 5x consecutive

**For User**：
1. Read §1 + §2 = 真正待處理 backlog（brainstorm 起點）
2. §3 = 需 user 決定 / 等 user 介入
3. §5 = 已完工歷史
4. §6 = 未來想做但非 bug
