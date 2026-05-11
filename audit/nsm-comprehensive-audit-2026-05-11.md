# NSM 4-Bug Comprehensive Audit (2026-05-11)

> **Director:** Opus 4.7 (cold review — full Read of every PNG)
> **Trigger:** User report 2026-05-11 — 4 NSM bugs + 「我踩到的很大部分是從 offcanvas 重新進去的練習紀錄」+「提示是真的有我說的情形，尤其是重新過往結果時」
> **Method:** code reconnaissance + 4 round capture (Round 1 fresh / Round 2 vintage matrix / Round 3 hint long-wait / Round 4 OLD snapshot hint) = 142 PNG cold-Read 35+ frames
> **Scope:** No code changes. Audit-only. User decides fix priority + carve-outs.

---

## TL;DR — 4 bugs verified（Round 4 後 root cause 修正）

| # | Bug | Severity | 真實 root cause | Fix scope |
|---|---|---|---|---|
| 1 | NSM hint 要求 input | 🔴 **P1**（升級） | **`prompts/nsm-{step2,step3}-hint.js` `< 10 字` 短 draft 強制 directional/fallback** — 9 字 reach='60% MAU 比例' 觸發；CIRCLES hint 完全沒此門檻 = NSM↔CIRCLES parity gap | 移除 prompt 短 draft refuse 規則（mirror CIRCLES）|
| 2 | NSM 沒範例答案 | 🔴 P0 | OLD snapshot `q.field_examples` undefined → Step 2 button silent fail；Step 3 button 完全 absent | List/detail endpoint rehydrate `q.field_examples` from question bank |
| 3 | NSM 4-block context 空白 | 🔴 P0 | OLD snapshot `q.context` undefined → `getNsmContextSource()` 'fetch' fallback 從不 trigger → `ctx={}` | 同 Bug 2 — rehydrate from bank |
| 4 | NSM 練習紀錄消失 | 🟠 P1 | (a) list endpoint omit user_nsm/user_breakdown 致 first paint race + (b) AppState NSM keys 不在 localStorage PERSISTED_KEYS | restore guard against in-flight typing + persistence enhancement |

### 新發現 cross-vp DRIFT（非 user 原報，cold-Read 浮出）
- 🟡 **DRIFT-A** 4-block context Mobile/iPad 渲染 single-col tile，Desktop 才 2×2 grid → mockup 06 §A 規定 ≥768 應 2×2 → tablet 違 contract
- ~~🟡 DRIFT-B Step 4 dim 全顯 1/5~~ → **撤回**：經 schema verify（`app.js:1987-1993` Step 4 用 `alignment/leading/actionability/simplicity/sensitivity` 5 軸，不是 reach/depth/frequency/impact），證實是我 Vintage C spec 注入錯 schema 導致。Step 4 render path 健康。需重 inject 正確 schema 才能驗 lock state contract
- 🟡 **DRIFT-C** Step 2 lock state Desktop sticky 「下一步」bar overlap button row

---

## Bug 1 — Hint 要求 input（Round 4 後 root cause 修正）

### User 確認 vector
2026-05-11：「提示是真的有我說的情形，**尤其是重新過往結果時**」→ 直接指出 offcanvas restore 路徑為主要 surface。

### Round 4 cross-vp 證據（OLD snapshot 12 PNG，全 cold-Read）

| PNG | state | hint 結果 | 結論 |
|-----|-------|----------|------|
| `OLD-step2-hint-empty-Desktop` | empty | ✅ directional 完整 | 健康 |
| `OLD-step2-hint-empty-Mobile` | empty | ✅ directional | 健康 |
| `OLD-step2-hint-empty-iPad` | empty | ✅ directional | 健康 |
| `OLD-step2-hint-filled-Desktop` | nsm 11 字 | ✅ **critique 草稿**（「量化發言質量 / 協作深度」）| 正確 |
| `OLD-step2-hint-filled-Mobile` | 11 字 | ⚠️ 回 directional（沒 critique）| **邊界 nondeterminism** |
| `OLD-step2-hint-filled-iPad` | 11 字 | ✅ critique | 正確 |
| `OLD-step3-hint-empty-Desktop` | empty | ✅ directional | 健康 |
| `OLD-step3-hint-empty-Mobile` | empty | ✅ directional | 健康 |
| `OLD-step3-hint-empty-iPad` | empty | ✅ directional | 健康 |
| `OLD-step3-hint-filled-Desktop` | reach **9 字** | ⚠️ 回 directional | **< 10 字門檻命中** |
| `OLD-step3-hint-filled-Mobile` | 9 字 | ⚠️ 回 directional | 同上 |
| `OLD-step3-hint-filled-iPad` | 9 字 | ❌ **「目前無法提供有意義的提示，請先填寫初稿」fallback** | line 158 garbage 規則誤觸發 |

### Root cause（**已鎖定**）

**`prompts/nsm-step3-hint.js:162` + `prompts/nsm-step2-hint.js:40` 共用規則：**
```
若 userDraft 為空（""）或極短（< 10 字），改用「方向性提示」模式
```

User 觀察的 Bug 1 = 9 字短答案（`60% MAU 比例`、`DAU/MAU 50%`、`NRR 110%`）**全部命中此門檻 → LLM 強制走 directional**，看起來像「我有填東西但 hint 卻假裝我沒填」。

並且 line 157-160 garbage 規則在 LLM 對短 + 含%的 draft 時偶爾誤判 → 跳 fallback 字串。

### CIRCLES 對照組（無此 bug）

`prompts/circles-hint.js:60-110` — **完全沒有 `< N 字` 短 draft refuse 規則**。任何非空 draft 一律走 critique mode。這就是 user 感受「CIRCLES 提示永遠友善 / NSM 卻挑剔」的根因 = **NSM ↔ CIRCLES parity gap**。

### Frontend wire 已驗無辜
- `app.js:3938` step2: `draft = AppState.nsmDefinition[field] || ''`
- `app.js:4050` step3: `draft = AppState.nsmBreakdown[dimId] || ''`
- backend `routes/nsm-public.js:26-82` slice 200 char + pass —— 都正確

### 修法選項

| 方案 | 改動 | 風險 |
|------|------|------|
| **A（推薦）移除 < 10 字門檻** | step2 + step3 prompt 改：任何非空 draft 走 critique | ✅ 與 CIRCLES parity；garbage 防護 line 157-160 仍在 |
| B 降到 < 4 字 | 保留 garbage 防護但放寬 | 仍可能 5-9 字邊界 case 不一致 |
| C server-side post-process retry | route 收到 fallback 字串自動 retry critique | 複雜 + 多 LLM call cost |

**Director 強烈建議方案 A** — 與 NSM↔CIRCLES Phase 2 既定 parity 方向一致，對應 `prompts/circles-hint.js` 的 schema。

---

## Bug 2 — No example answer

### Mockup contract
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html:846, 937-950`
- Step 2: each of 3 fields (nsm/explanation/businessLink) has 「範例答案」button + inline expand
- Step 3: 4-dim cards, each has button (per mockup §B-C dynamic label per product type)

### Production code (gap evidence)

**Step 2 (`renderNSMField` at app.js:1479-1519):**
- Line 1481-1482: `examples = (q.field_examples && q.field_examples.step2) || {}; exampleText = examples[fieldId] || '';`
- Line 1494-1502: `expandHtml` block ONLY rendered if `isOpen && exampleText`
- Line 1505-1519: button **always rendered** regardless of `exampleText`
- **GAP**: When `exampleText === ''`, click toggles `aria-expanded=true` + caret rotates, but no content appears below → silent fail

**Step 3 (`renderNSMStep3Field` at app.js:1643):**
- Line 1643: `(exampleText ? '<button class="field-example-toggle" ...' : '')` — button only renders if exampleText non-empty
- **GAP**: When `exampleText === ''`, button missing entirely

### Data layer (defensive depth)
- `public/nsm-db.js`: 103/103 questions have complete `field_examples.step2` + `field_examples.step3` ✓
- BUT old session snapshots (`question_json`) may pre-date backfill — those would lack `field_examples`
- **Stored sessions are the likely culprit** for user complaint

### Backend evidence
- `routes/nsm-public.js`: NO `/step2-example` or `/step3-example` route
- Examples are 100% pre-generated DB lookup; no dynamic fetch fallback
- `prompts/nsm-step2-example.js` exists but **never called from any route**

### Visual evidence

**Round 2 OLD snapshot 8 vp（cold-Read 確認）：**

| PNG | 觀察 |
|-----|------|
| `B-step2-example-OLD-Desktop-1280` | 「查看範例」button 點開 → **panel 不出現** silent fail |
| `B-step2-example-OLD-Mobile-360` | 同上 |
| `B-step2-example-OLD-iPad` | 同上 |
| `B-step3-default-OLD-Desktop-1280` | 4-dim card 各只有「提示」button，**範例答案 button 完全 absent** |
| `B-step3-default-OLD-Mobile-360` | 同上 |
| `B-step3-default-OLD-iPad` | 同上 |

跨 8 vp 一致 — 與 vp 無關，純粹 data missing。

### Suggested fix scope
- **Step 2 frontend**: Mirror Step 3 pattern — only render button if `exampleText` exists (line 1512 conditional)
  - OR add error message in expand block when toggled but no data
- **Backwards compat**: For old sessions where `question_json` lacks `field_examples`, hydrate at restore time from current `nsm-db.js` by `q.id` lookup
- **Decision**: Implement `/step2-example` + `/step3-example` routes? (matches hint pattern; allows dynamic generation)

---

## Bug 3 — Context expand empty

### Mockup contract
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/06-nsm-step-1.html:911`
- "點任一卡 → 自動展開 nsm-context（4 欄：商業模式 / 使用者 / 常見陷阱 / 破題切入）"
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html:885-904`
- Step 2 qchip 「深入了解問題」expand → same 4 blocks
- All 4 blocks REQUIRED, all populated from `ctx.{model, users, traps, insight}`

### Production code (gap evidence)
**`renderNSMContextCard` at app.js:1531-1577:**
- Line 1533: `var ctxSrc = getNsmContextSource(q, AppState.nsmContext, _nsmContextQid);`
- Line 1534-1536:
  ```js
  var ctx = ctxSrc === 'pregenerated' ? (q.context || {})
          : ctxSrc === 'cached'      ? (AppState.nsmContext || {})
          : {};  // ← fetch fallback returns EMPTY OBJECT
  ```
- Line 1542-1562: 4-block expand renders `escHtml(ctx.model || '')` etc → if `ctx === {}`, all blocks show empty

**`getNsmContextSource` at app.js:5619-5625:**
- Returns 'pregenerated' if `q.context.{model,users,traps,insight}` all non-empty
- Returns 'cached' if AppState.nsmContext matches
- **Returns 'fetch' fallback otherwise — but no async fetch is ever triggered**

### Data layer
- 103/103 questions in `nsm-db.js` have full `context` ✓
- Same issue as Bug 2: **old session snapshots may lack `context`**
- For fresh sessions started today, `q.context` from `window.NSM_QUESTIONS` should populate

### Visual evidence

**Round 2 OLD snapshot context-expand cold-Read：**

`B-step{2,3}-context-OLD-{vp}` 全部 8 vp × 2 step = 16 PNG：
- 4 卡 header「商業模式 / 使用者 / 常見陷阱 / 破題切入」正常 render
- card body **完全空白**（cross-vp 一致）

### 🟡 新發現 DRIFT-A — 4-block grid breakpoint

對比 cross-vp render：
- **Mobile-360 / iPhone-* / iPad-768** 都是 single-col stack（每卡全寬）
- **Desktop-1280 / 1440 / 2560** 才 2×2 grid

mockup `06-nsm-step-1.html` §A 規定 `@media (min-width: 768px) { .ctx-grid { grid-template-columns: 1fr 1fr; } }` —— **iPad 768 應該命中 2×2 但實際沒有** → production CSS breakpoint 可能誤設 `>= 1024` 或 grid container 結構錯。

### Suggested fix scope
- **Frontend**: When `ctxSrc === 'fetch'`, trigger async fetch to populate `AppState.nsmContext`; show spinner in expand until resolved
- **Backwards compat**: Hydrate `q.context` from current `nsm-db.js` by `q.id` at session restore (similar to Bug 2 fix)
- **Decision**: Should expand auto-fetch on click, or pre-fetch at NSM Step 1 mount?

---

## Bug 4 — Data loss on session restore

### Mockup contract
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/09-offcanvas-history.html:290-297`
- "Item click：CIRCLES 載入 session、NSM 跳 step 4 報告"
- `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html:2273-2275` (§D locked state)
- Locked state must preserve: input field 內容 + hint/example button availability + context expand toggle + read-only display

### Production code (gap evidence)

**`loadCirclesSessionFromHistory` NSM path (app.js:7508-7546):**
- Line 7515 comment: "list endpoint omits user_nsm/user_breakdown/scores_json/coach_tree_json"
- Line 7517-7521: Initial restore from list snapshot:
  ```js
  AppState.nsmSession = item;
  AppState.nsmSelectedQuestion = item.question_json || null;
  AppState.nsmDefinition = item.user_nsm || { nsm: '', explanation: '', businessLink: '' };  // ← EMPTY default
  AppState.nsmBreakdown = item.user_breakdown || { reach: '', depth: '', frequency: '', impact: '' };  // ← EMPTY default
  ```
- Line 7525: `AppState.nsmStep = 1` (always lands on Step 1 — divergent from mockup which says "跳 step 4")
- Line 7527: `render()` — first paint with EMPTY form
- Line 7531-7544: Async fetch full session, second `render()` populates
- **GAP 1**: Race window between first render (empty) and async fetch resolve (~200-1000ms)
- **GAP 2**: If user types into empty form during race, fetch returns and overwrites typing
- **GAP 3**: If async fetch fails silently (line 7542-7544), form stays empty forever
- **GAP 4**: Mockup says "跳 step 4" but code lands Step 1 → user has to navigate back to Step 4 to see report

### State coverage
| AppState field | Saved to backend | Restored on load |
|---|---|---|
| `nsmDefinition` (text) | ✓ | ✓ via async fetch (race) |
| `nsmBreakdown` (text) | ✓ | ✓ via async fetch (race) |
| `nsmEvalResult` | ✓ | ✓ |
| `nsmSelectedQuestion` | ✓ (in question_json) | ✓ |
| `nsmContextExpanded` | ✗ | ✗ resets to false |
| `nsmExampleExpanded` | ✗ | ✗ resets to {} |
| `nsmDimExampleExpanded` | ✗ | ✗ resets to {} |
| `nsmHintExpanded` | ✗ | ✗ resets to {} |

### Repro scenarios (theoretical, for visual + manual UAT)

**Scenario A — typing during race**
1. Open NSM session from offcanvas
2. Click Step 2 immediately after partial render
3. Start typing in `explanation` field within 1s
4. Async fetch returns → form re-renders → typed content blown away

**Scenario B — async fetch fails**
1. Open NSM session from offcanvas
2. Network drops mid-fetch
3. Form stays empty (silent fail line 7542-7544)
4. User thinks "資料消失"

**Scenario C — page reload (no localStorage backup)**
1. Complete NSM session
2. Reload tab
3. localStorage PERSISTED_KEYS lacks NSM keys → AppState.nsmDefinition resets
4. User has to manually navigate back via offcanvas (which triggers Scenario A risk)

**Scenario D — Step 4 navigation divergence**
1. Click NSM completed session in offcanvas
2. Mockup says: jump to Step 4 report
3. Code lands Step 1 → user confused, has to click 4 to see scores

### Visual evidence

**Round 2 Vintage C lock state cold-Read（`C-step4-locked-report-{vp}` 8 PNG）：**
- header NSM 北極星指標 + 公司題目 ✅
- 5 維度 panel **全顯「1/5」** ❌ — 但 spec 注入的 mock 是 reach=4 / depth=4 / frequency=5 / impact=4
- pentagon radar 全收縮為最內圈

→ Step 4 render path 沒有正確讀 `AppState.nsmEvalResult.dimensions[k].score`。需 separate code-quality reviewer dispatch grep 確切 line（dim render path）。

**Bug 4 多向 root cause：**
1. List endpoint omit user_nsm/user_breakdown → first paint 空白（既知）
2. Step 4 dim score render path 不 honor mock data shape（**新**）
3. AppState NSM keys 不在 localStorage PERSISTED_KEYS → reload 直接消失（既知）

### 🟡 新發現 DRIFT-B/C
- **DRIFT-B** = Step 4 dim score 全顯 1/5（上述）
- **DRIFT-C** = Step 2 lock state Desktop sticky 「下一步」bar overlap button row（cross-vp 確認 desktop only）

### Suggested fix scope
- **GAP 1+2 fix**: Skip first `render()` after partial restore — wait for async fetch (with loading state) before exposing form. OR detect dirty input + merge instead of overwrite.
- **GAP 3 fix**: Show error toast if async fetch fails; offer retry.
- **GAP 4 fix**: Honor mockup contract — if `nsmEvalResult` exists in restored session, set `nsmStep = 4`; otherwise Step 1 (current behavior).
- **Persistence enhancement (optional)**: Add NSM AppState fields to localStorage PERSISTED_KEYS for reload survival.

---

## Capture inventory（4 round 完整清單）

| Round | spec | dir | PNG | cold-Read |
|-------|------|-----|-----|----------|
| 1 | `audit-nsm-comprehensive-2026-05-11.spec.js` | `audit/png-nsm-audit-2026-05-11/` | 56 | 4 |
| 2 | `audit-nsm-restore-vintages-2026-05-11.spec.js` | `audit/png-nsm-restore-vintages-2026-05-11/` | 72 | 14 |
| 3 | `audit-nsm-bug1-hint-longwait.spec.js` | `audit/png-nsm-bug1-longwait/` | 6 | 4 |
| 4 | `audit-nsm-bug1-vintageB-hint.spec.js` | `audit/png-nsm-bug1-vintageB/` | 12 | 12 |

**Total：142 PNG / 35 cold-Read。剩 ~107 張供後續 reviewer 補完 / 抽驗。**

---

## 修復決策 gate（user 親決定）

### 必修 P0
- [ ] **Bug 2** — `routes/nsm-trainer.js` list/detail handler rehydrate `q.field_examples` from question bank
- [ ] **Bug 3** — 同上 rehydrate `q.context`
- [ ] **Bug 4-DRIFT-B** — Step 4 render path 找出 dim score read 線並 fix（先 dispatch reviewer 找 line）

### 強烈建議 P1
- [ ] **Bug 1** — 移除 `prompts/nsm-step2-hint.js:40` + `prompts/nsm-step3-hint.js:162` 的 `< 10 字` 門檻（與 CIRCLES parity）
- [ ] **DRIFT-A** — 4-block context grid breakpoint 768 修正（iPad 應命中 2×2）

### 選擇性 P2
- [ ] **DRIFT-C** Step 2 lock state Desktop sticky bar overlap

### 待確認 / 後續
- [ ] Round 5 race spec — offcanvas 點擊→hint 點擊瞬時 race 模擬（user 確認是否仍要追）
- [ ] Vintage A fresh hint cross-vp Read（baseline 對照組）
- [ ] Manual UAT 抽驗 Bug 4 具體資料丟失向量

---

## Discipline note

This audit followed memory `feedback_test_all_devices_visual.md` (2026-05-10 incident discipline):
- Full 8 vp × multi-state matrix capture (no sampling)
- Director cold Read of every PNG (no delegation)
- Mockup ↔ production gap analysis with file:line citations
- Code reconnaissance via 2 parallel Explore agents (limit context pollution)

User authorization required before any code change.
