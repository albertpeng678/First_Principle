# E2E Master Tracker — Unresolved Hub

> **Single source of truth for ACTIVE unresolved issues.** Per STANDING `feedback_tracker_unresolved_hub`: §1-§3 only list真正待處理 items；resolved 立即剪貼移 §5。User 掃 §1-§3 = brainstorming 清單。
>
> **Last updated:** 2026-05-17 PM Taipei — Wave 1B-a (#1+#3) ship `1b75c0f` + Wave 1B-b (Bug A + Bug B + #2) ship (this commit); 4 reviewer-caught Critical 補修完成
> **Update protocol:** new finding → append §1-§3；fix shipped → cut & paste 整段 → §5 with commit + verify。**禁留 ~~strikethrough~~ 在 §1-§3**。
> **Read order**: §1 → §2 → §3 → §6 → §7。歷史 audit trail 看 §5 / §9。

---

## §1 Active P0 Bugs (user-visible / data integrity)

✅ **0 items** — F-1 / F-2 / FLOAT-2 / NEW-Bug-A 全 shipped (見 §5)。下個 P0 finding 出現 → append here。

---

---

## §2 Active P1 Bugs

### C-T2 finding: NSM 99.9% conversion 線上資料深挖 (2026-05-17 PM)
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

**Instrumentation spec**: `tests/e2e/audit-nsm-conversion-funnel-instrumentation.spec.js` (Pitfall 11 compliant, 3 vp, §3.8 API seed, §3.5 test.step per boundary, captures timing + lifecycle + console errors)

---

### P1-#257 Bug 8 / Master plan F-007 — ~65 hollow API specs refactor
- **Status**: partial done (retrofit C/D/E/F + Group A V1-V8 shipped)
- **Open**: ~65 specs partial-mock `/api/circles-sessions` list endpoint still hollow
- **Why P1 not P0**: production code OK，但 hollow specs 不抓真 regression（P0-NEW-6 cascade 證明）
- **Impact long-term**: 防止未來 ship 再撞同類 lifecycle-guard cascade
- **Effort**: 8-15h wall-clock parallel (Phase B 計畫 5-7 batch × 3 lane)
- **Cross-ref**: master plan `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` §7 F-007；多階段 ship plan `docs/superpowers/plans/2026-05-17-pm-multi-phase-ship-plan.md` §B

### P1 Master plan F-001 — Testing Trophy inversion
- **Status**: Group A V1-V8 added 8 real API specs，ratio 改善但未到 60% API target
- **Current state**: 95 E2E vs ~18 API (post Group A)
- **Open**: identify ~30-40 more E2E candidates to convert to API tier per surface
- **Effort**: medium-large；可隨 F-007 wave 一起做
- **Cross-ref**: `audit/testing-trophy-audit-2026-05-16.md`

---

## §3 Active P2 / Needs Decision

### #207 B5 decision — Stage 1C revert vs keep
- **Needs**: user 親自決定
- **Context**: Stage 1C qchip-panel ship (commits `f6b18fe` `a0e5531`) SUPERSEDED by chat-drift wave 1-4
- **Recommendation**: close as superseded (chat-drift `49d00ba` 已 swap Phase 2 + L23 已 delete orphan `renderQchipPanelHtml`)
- **Owner**: user

### #199 Trophy Step 4 — critical-path E2E
- **Status**: master plan F-006 partly satisfied by `9446ad2` critical-path-full-flow spec
- **Open**: spec partial coverage Phase 1→4 (gap on Phase 3→4 transition?)
- **Recommendation**: may overlap with task #212 critical-path E2E (completed)；可 close as duplicate
- **Owner**: needs Director cross-verify with #212 scope

### #205 Retrofit G — delete hollow tests + test-supabase mock library
- **Status**: backlog (low priority cleanup)
- **Trigger**: best done after F-007 wave (#257) — many hollow tests will become deletable once real api/ tier covers same surface
- **Effort**: medium

### B6 / #21 — mockup 04 Phase 1.5 Gate pixel-diff audit (2026-05-17 PM)
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

### COMMON design issue (Both NEW-Bug-A and NEW-Bug-B)
**共同根因**: NSM 跟 CIRCLES 沒共用 component → NSM-only template drift
- Bug A: 沒抽 `resetNsmDraftState()` helper，CIRCLES 的 reset block 沒 mirror 到 NSM
- Bug B: NSM `renderNSMDim` 自訂 wrapper 不用 CIRCLES `renderField` 共用 label-row template
**STANDING 進化建議（user 評估後再做）**: 加一條「NSM 的 draft reset / hint+example row 必須 reuse 與 CIRCLES 同一 helper function」防未來 drift；不在當前 fix scope 內（YAGNI）

---

### C-T1 finding: AI 4-surface error handling audit (2026-05-17 PM)
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

2. **[F-CT1.2] [Sev P1] [CIRCLES evaluator Phase 2 path]** — Phase 2 結論送出的 evaluate-step 失敗靜默吞掉：`app.js:7157-7161` `evalRes.ok === false` 只做 `conclusionSubmitBtn.disabled = false`，不設 `circlesPhase3Error`，用戶不知道評分失敗，也看不到重試按鈕（只有 button 重新 enable）。同路徑使用 raw `fetch` 而非 `window.apiFetch`，跳過 401 token refresh 機制（app.js:7136）。
   **Why matters**: 用戶填完答案點送出，進入 loading，AI 失敗 → 靜默回到 Phase 2 submit 狀態，無任何錯誤提示，100% 的錯誤對用戶不可見，且 token 過期後會出現 401 靜默失敗。
   **Suggested fix scope**: 補 `AppState.circlesPhase3Error = { code: errCode, ... }` + `render()`；raw fetch 改 `window.apiFetch`（app.js:7136 + 7157-7161）

3. **[F-CT1.3] [Sev P2] [CIRCLES gate]** — prompt retry 無 backoff 延遲：`circles-gate.js:104-121` 第 2、3 次 attempt 之間無 `setTimeout` 延遲，遇到 429 rate-limit 時連續打三次 OpenAI，只要第一次 429 大概率三次都 429，等效於無 retry 保護（相比 nsm-gate.js 有 800ms/1600ms 漸進等待）。
   **Why matters**: 流量尖峰時 CIRCLES gate 審核失敗率顯著高於 NSM gate；若 CIRCLES 是 conversion funnel 的前置關卡，此 gap 直接影響用戶能否完成審核並繼續。
   **Suggested fix scope**: `circles-gate.js:119` 前加 `await new Promise(r => setTimeout(r, 800 * (attempt + 1)));`（1 行，mirror nsm-gate.js 模式）

4. **[F-CT1.4] [Sev P2] [NSM gate]** — 錯誤訊息洩漏 + 分類缺失：`routes/nsm-sessions.js:189` catch 直接回傳 `e.message`（OpenAI SDK 拋出的英文錯誤訊息，可能含敏感 API 錯誤細節）；FE 只顯示 `err.error || 'gate_error'` 字串而非中文說明；沒有區分 429（rate limit）/ 500（server error）/ timeout（網路）給用戶不同的 UX 提示。（NSM evaluator 同樣問題 routes/nsm-sessions.js:152-161）
   **Why matters**: 用戶看到英文錯誤或 undefined 時完全不知道該等多久還是重試，導致放棄率高。
   **Suggested fix scope**: route catch 統一回 `{ error: 'ai_service_error', code: 'GATE_TIMEOUT/GATE_API_ERROR' }`；FE 對應中文訊息（mirror CIRCLES evaluator 模式）

5. **[F-CT1.5] [Sev P3] [NSM gate — lifecycle root cause]** — 最核心發現：NSM lifecycle='created' 堆積的主因**不是 AI 錯誤**，而是**設計本身**：`GET /api/nsm-sessions` 預設過濾掉 lifecycle='created' 的 row（routes/nsm-sessions.js:59）；每次 NSM session 建立後就是 'created'，只有通過 gate 才升 'gated'。所以 6500 rows 中 99.9% lifecycle='created' = 6499 個用戶建立 session 但還沒按「送出 NSM 定義」。AI 錯誤頂多造成已按送出但 gate 失敗者無法繼續（佔比估計 < 1%）。F-2 修 sticky bar 蓋輸入框才是最直接的 conversion 提升點。
   **Why matters**: 重新定位 C-T1 調查範圍——AI error handling 的 gap 是真實的，但主要影響 already-past-gate 的用戶體驗，不是造成 99.9% drop 的根因。建議 C-T2 深挖 UX 流程斷點（用戶是否有機會填寫 + 按送出）。

**Cross-refs**:
- `feedback_find_first_fix_later_via_tracker.md`：以上全是 find-only，不動 production
- C-T2 task（線上深挖 99.9% conversion 斷點）— 本 finding #5 指向 F-2 UX 修正後追蹤 conversion 變化才能驗證
- `routes/nsm-sessions.js:59`（lifecycle filter），`app.js:2039-2043`（spinner bug），`app.js:7136,7157-7161`（CIRCLES Phase 2 silent fail），`prompts/circles-gate.js:104-121`（no backoff）

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
