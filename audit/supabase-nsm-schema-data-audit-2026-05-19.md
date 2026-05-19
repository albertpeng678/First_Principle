# Supabase NSM Schema + 資料總稽核 (2026-05-19)

> **目的**：D-2 localStorage restore 實作前先驗 DB 真實狀況，避免設計打到髒資料 / shape mismatch 暗礁。
> **方法**：service-role REST API，READ-ONLY。
> **腳本**：`scripts/audit-supabase-schema-data.js`（新建）+ `scripts/audit-nsm-conversion-funnel.js`（既有）。
> **快照時間**：2026-05-19T14:41:37Z（總共 6815 rows nsm_sessions / 取樣 50 + 整理 500）。

---

## §1 Schema — nsm_sessions vs circles_sessions

### nsm_sessions (16 columns)
| column | type | nullable | sample / note |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | YES | auth user；guest 為 null |
| `guest_id` | uuid | YES | guest path；user 為 null |
| `question_id` | text | NO | e.g. `q58` |
| `question_json` | jsonb | YES | 題目 snapshot：company / industry / scenario / criteria |
| `status` | text | YES | legacy: `active`/`completed`（被 lifecycle 取代中） |
| `user_nsm` | **jsonb** | YES | `{nsm, explanation, businessLink}`（migration 2026-05-15 從 TEXT 改 JSONB） |
| `user_breakdown` | jsonb | YES | `{reach, depth, frequency, impact?}`（注意 impact 偶爾出現） |
| `scores_json` | jsonb | YES | 評分 output：`{scores:{leading,alignment,...}, ...}` |
| `coach_tree_json` | jsonb | YES | AI 教練 best-practice tree |
| `progress_json` | jsonb | NO `DEFAULT '{}'` | 進度 keys: `currentStep / gateResult / reportTab / evaluating / evaluating_started_at / evaluation_error` |
| `user_explanation` | text | YES | legacy field — 已被 user_nsm.explanation 取代但欄位仍存在（全 null） |
| `user_business_link` | text | YES | legacy field — 同上（全 null） |
| `lifecycle` | text | NO `DEFAULT 'created'` | CHECK in (`created`, `editing`, `gated`, `completed`) |
| `created_at` | timestamptz | NO | |
| `updated_at` | timestamptz | NO | |

**Index**（per migration 2026-05-17）：`idx_nsm_sessions_lifecycle_user (user_id, lifecycle, updated_at DESC)`。**沒有 guest_id 索引**（migration 明寫 "no guest_id index"）。

### circles_sessions (19 columns)
| column | type | sample / note |
|---|---|---|
| `id` / `user_id` / `guest_id` / `question_id` / `question_json` / `status` / `created_at` / `updated_at` / `lifecycle` / `progress_json` | 同 nsm | 共用 10 columns |
| `mode` | text | `drill` / `simulation` |
| `drill_step` | text | C/I/R/C2/L/E/S |
| `current_phase` | int | 1/2/3 |
| `sim_step_index` | int | simulation step pointer |
| `framework_draft` | jsonb | `{方案一, solutionNames, ...}` |
| `gate_result` | jsonb | Phase 1.5 gate 三態 |
| `conversation` | jsonb (array) | Phase 2 messages |
| `step_scores` | jsonb | per-step 評分 |
| `step_drafts` | jsonb | `{C:{...}, I:{...}, R:{...}, ...}` |

### Cross-table column drift（§4b）
- **共享 10 columns**：`id, user_id, guest_id, question_id, question_json, status, created_at, updated_at, progress_json, lifecycle`
- **只在 nsm**：`user_nsm, user_breakdown, scores_json, coach_tree_json, user_explanation, user_business_link`
- **只在 circles**：`mode, drill_step, current_phase, sim_step_index, framework_draft, gate_result, conversation, step_scores, step_drafts`

⚠️ **架構不對稱**：CIRCLES 用 `step_drafts` 當「分散式 step 草稿 dict」，NSM 用 4 個 top-level columns (`user_nsm` / `user_breakdown` / `user_explanation` / `user_business_link`)。D-2 設計時不能直接 copy CIRCLES 的 restore pattern，因為形狀根本不同。

---

## §2 user_nsm / user_breakdown / progress_json shape distribution（50 rows，最新優先）

### user_nsm shapes
| shape | count |
|---|---|
| `emptyObj` `{}` | 42 (84%) |
| `emptyKeysOnly` (keys 存在但值都是空字串) | 8 (16%) |
| has content | **0** |

### user_breakdown shapes
| shape | count |
|---|---|
| `null` | 42 (84%) |
| `emptyKeysOnly` | 8 (16%) |
| has content | **0** |

### progress_json shapes
| shape | count |
|---|---|
| `emptyObj` `{}` | 47 (94%) |
| `obj keys=3 hasContent` | 3 (6%) |

### scores_json shapes
| shape | count |
|---|---|
| `null` | 50 (100%) |

⚠️ 50 row 取樣**沒有任何 row 有 user_nsm 內容**（與整體 99.7% drop 一致）。

### 從 conversion-funnel 全表取樣（21 個 step2 starters，最古老 vs 最新）
> 取自 `audit-nsm-conversion-funnel.js` 全表 step2 sample drop（5 rows，drop after step 2）：

- `84ec3f01` `lc=gated` `user_nsm: {"nsm":"每月協作頻次：每月至少有 3 次人員的協作互動","explanation":"<ul ...">"}` — **HTML in explanation**（從 AI hints inject）
- `85dd3083` `lc=created` `user_nsm: {"nsm":"e2e-a3-nsm-1778823784953","explanation":"e2e-a3-exp-..."}` — **e2e fixture leak**（含 timestamp suffix）
- `d96540ef` `lc=created` `user_nsm: {"nsm":"e2e-a3-nsm-1778824133050",...}` — 同上 e2e
- `526b10e4` `lc=created` `user_nsm: {"nsm":"e2e-r2-a3-nsm-1778825631222",...}` — 同上
- `2e032db9` `lc=created` `user_nsm: {"nsm":"e2e-a3-nsm-1778901358753",...}` — 同上

✅ **shape 一致**：所有 non-empty user_nsm 都是 `{nsm, explanation, businessLink}` object（migration 2026-05-15 已生效）。**沒看到 legacy string shape** 殘留。

但 FE restore 8307-8312 **仍保留 string-coerce 防禦**（`typeof rawNsm2 === 'string'` 分支）— 表示 prod code 預期 DB 可能還有 legacy text，要保留此 fallback。

---

## §3 Lifecycle integrity（500 rows，最新優先）

### Lifecycle counts
| lifecycle | count |
|---|---|
| created | 499 |
| gated | 1 |
| editing | 0 |
| completed | 0 |

### Step progression distribution（按資料推 step，非 progress_json.currentStep）
| step | count | note |
|---|---|---|
| step1Only (no user_nsm) | 499 | 99.8% |
| step2 (user_nsm only) | 1 | 0.2% |
| step3 (breakdown filled, no scores) | 0 | |
| step4Done (scores present) | 0 | |

### Bad-state counts（500 rows）
| state | count | severity |
|---|---|---|
| `gated_empty_user_nsm` | 0 | OK |
| `gated_empty_breakdown` | **1** | ⚠️ — gated 應該已填 breakdown |
| `gated_no_scores` | **1** | ⚠️ — gated 但無 scores |
| `completed_no_scores` | 0 | OK |
| `created_with_scores` | 0 | OK（L19 fix 後不該再發生） |
| `created_with_user_nsm` | 0 | OK |
| `created_with_progress_evaluating` | **5** | 🚨 **真 bug** — created 但 progress.evaluating=true 卡住 |
| `editing_no_user_nsm` | 0 | N/A (0 editing rows) |
| `editing_with_scores` | 0 | N/A |
| `same_ts_created_updated` | 469 | ⚠️ 94% session 從未被 PATCH（純 eager-INSERT 後立即流失） |
| `orphaned_evaluating_flag` | **5** | 🚨 = `created_with_progress_evaluating` 同集合 |

### 🚨 Stale evaluating-flag examples (代表 D-2 必須處理)
```json
[
  {
    "id": "edd3d372",
    "lifecycle": "created",
    "progress_json": {
      "evaluating": true,
      "currentStep": 4,
      "evaluating_started_at": "2026-05-18T15:33:06.846Z"
    },
    "updated_at": "2026-05-18T15:33:06.846+00:00"
  },
  {
    "id": "08db5235",
    "progress_json": {"evaluating": true, "currentStep": 4, "evaluating_started_at": "2026-05-18T15:32:35.289Z"}
  },
  {
    "id": "ee03c632",
    "progress_json": {"evaluating": true, "currentStep": 4, "evaluating_started_at": "2026-05-18T15:32:16.402Z"}
  }
]
```

🚨 **3 個都是昨晚（2026-05-18 15:32-15:33 UTC）一分鐘內連發**：
- `lifecycle=created` 但 `evaluating=true` + `currentStep=4`
- `updated_at` 沒有後續更新 = process crash 在 evaluate 中段（pre-write checkpoint 寫了但 final UPDATE 沒到）
- 對應 routes/nsm-sessions.js:118-126 的 checkpoint pattern — FE 應該在 evaluating_started_at > 60s 時呈現「恢復」banner，但這 5 row 看起來 user 沒 retry（session 直接成孤兒）

---

## §4 CIRCLES drift — circles_sessions（50 rows）

### lifecycle counts (50 sample)
| lifecycle | count |
|---|---|
| created | 44 (88%) |
| editing | 6 (12%) |
| gated | 0 |
| completed | 0 |

### step_drafts shapes
| shape | count |
|---|---|
| `emptyObj` `{}` | 44 (88%) |
| `obj keys=6 hasContent` | 6 (12%) |

### progress_json shapes
| shape | count |
|---|---|
| `emptyObj` | 37 (74%) |
| `obj keys=1 hasContent` | 13 (26%) — 含 `phase2ConclusionDraft` |

### ⚠️ NSM vs CIRCLES drift findings
1. **CIRCLES 有 `editing` lifecycle 出現（6 rows）**，NSM 500 row 中 **0 個 editing**。Migration 同時加進兩邊，但 NSM 沒有任何 PATCH 把它推到 editing → 表示 **NSM `computeLifecycle()` 從未被觸發**，或者 PATCH /progress 從未被 user 觸發到。
2. **CIRCLES step_drafts 有 12% 有內容**，NSM user_nsm 0% 有內容 — 本機 50 row 取樣完全沒有 user 真的填字（對比 CIRCLES 用 sample 12% 填）。
3. **CIRCLES progress_json.phase2ConclusionDraft 有用**（26% 有內容），NSM progress_json 主要塞 `evaluating` flag（孤兒 5 個）+ `currentStep / gateResult / reportTab` 三 key。

---

## §5 localStorage ↔ backend shape mismatch?

### LS write site：app.js:2143-2148
```js
var payload = {
  userNsm: AppState.nsmDefinition || { nsm: '', explanation: '', businessLink: '' },
  userBreakdown: AppState.nsmBreakdown || {},
};
localStorage.setItem('pmdrill:nsm:draft:' + qid, JSON.stringify(Object.assign({}, payload, { ts: Date.now() })));
```

LS key shape：
```json
{
  "userNsm": { "nsm": "...", "explanation": "...", "businessLink": "..." },
  "userBreakdown": { "reach": "...", "depth": "...", "frequency": "..." },
  "ts": 1719...
}
```

### Backend PATCH /progress 接受 shape（routes/nsm-sessions.js:226-231）
```js
const { currentStep, userNsm, userBreakdown, gateResult, reportTab, progress, userExplanation, userBusinessLink } = req.body || {};
if (userNsm       !== undefined) patch.user_nsm       = userNsm;
if (userBreakdown !== undefined) patch.user_breakdown = userBreakdown;
```

→ DB column `user_nsm` 直接吃整個 object。

✅ **PATCH /progress 對齊 LS shape**：FE 寫 `{userNsm: {nsm, explanation, businessLink}, userBreakdown: {reach, depth, frequency}}` ↔ backend 直接 spread 進 column。

### 🚨 但是 POST /evaluate shape mismatch！

**app.js:2080-2087**（evaluate 提交時）：
```js
body: JSON.stringify({
  userNsm: (AppState.nsmDefinition || {}).nsm || '',  // ⚠️ STRING (only .nsm)
  userBreakdown: AppState.nsmBreakdown || {},
}),
```

**routes/nsm-sessions.js:139-141**：
```js
.update({
  user_nsm: userNsm,         // ⚠️ 把 string 寫回 JSONB column
  user_breakdown: userBreakdown,
  ...
})
```

→ **`/evaluate` 把 user_nsm 從 object 覆寫成 string**。完成 evaluate 後 user_nsm 變成 `"events_created_count"` 之類的 raw string，**explanation / businessLink 就被丟掉了**。

FE restore (app.js:8306-8312) 已有 typeof string fallback 防禦，但這代表 user 完成 evaluate 後，原本填的 explanation + businessLink 永遠抓不回來 — **D-2 必須處理「evaluate 後 user_nsm 變 string，restore 時 explanation/businessLink 被吞」這個 bug**。

### Phase 2 conclusion LS（CIRCLES，對比參考）
`pmdrill:phase2:conclusion:{sessionId}:{stepKey}` — 純 string per step。對應 backend `circles-sessions PATCH /progress` 的 `phase2ConclusionDraft` → 寫進 `progress_json.phase2ConclusionDraft`。NSM 沒有對應 mechanism。

---

## §6 Findings for D-2 design impact

| # | Finding | Severity | D-2 影響 |
|---|---|---|---|
| F1 | **94% sessions never PATCH** (same_ts_created_updated=469/500) | 🚨 highest impact | LS restore 是核心 — 大量 user 在 eager-INSERT 後立即流失，server 端沒有任何 user 輸入；LS 是唯一能撿回他們進度的途徑 |
| F2 | **5 個 orphaned `evaluating=true` checkpoint**（lifecycle=created 但 progress.evaluating=true，updated_at 卡在 2026-05-18 15:32-15:33） | 🚨 | D-2 restore 邏輯必須處理「LS 有資料 + DB session 有 evaluating=true stale flag」case — 否則 user 看到「恢復」banner 但實際應該 reset 或讓 user 重新 evaluate |
| F3 | **`/evaluate` 把 user_nsm 從 object overwrite 成 string**（app.js:2085 + routes/nsm-sessions.js:140） | 🚨 | restore from DB 後 explanation + businessLink 被吞掉；D-2 必須優先用 LS（含完整 object）overlay DB（被退化成 string）；或修 evaluate handler 寫回完整 object |
| F4 | **NSM 0 個 editing lifecycle**（migration 加了但 prod 從未到達 editing 狀態） | ⚠️ | computeLifecycle 對 NSM 可能 broken / 從未被 user 觸發 PATCH /progress；D-2 LS restore 不能依賴 lifecycle=editing 判斷「有進行中」 |
| F5 | **1 個 gated 但 empty breakdown + no scores**（500 row 中） | ⚠️ low volume but real | gated 不一定代表 step3+4 都做完；D-2 restore 邏輯不能假設 lifecycle=gated → user_breakdown 必有內容 |
| F6 | **LS write site 沒有 `pmdrill:nsm:draft:*` restore code**（grep 全 app.js 只有 1 write at line 2148，無對應 read） | 🚨 = D-2 task definition | 這就是 D-2 要實作的 — restore from `pmdrill:nsm:draft:{qid}` |
| F7 | **CIRCLES vs NSM column 不對稱**：CIRCLES 用 `step_drafts` JSONB blob，NSM 用 4 個 top-level columns | ⚠️ design | D-2 不能 copy CIRCLES 6055-6072 restore pattern，要 per-column merge |
| F8 | **legacy `user_explanation` + `user_business_link` columns 全 null**（migration 後 deprecated） | low | D-2 不要寫這 2 個 column，只用 user_nsm.explanation / user_nsm.businessLink |
| F9 | **LS shape 對齊 PATCH /progress（safe）但對齊 POST /evaluate 是退化 shape**（string-only nsm） | ⚠️ | D-2 restore source-of-truth 排序：LS object > DB user_nsm object > DB user_nsm string |
| F10 | **同 progress_json.evaluating bug 是 1 分鐘 5 row burst（2026-05-18 15:32-15:33）**，疑似一次 prod incident（OpenAI 超時 / process restart） | info | D-2 不直接修但要意識到此類 burst 會生 stale checkpoint，restore 必須 staleness-aware（`evaluating_started_at` > 60s = stale，per 既有 FE 期待） |

---

## §7 Suggested D-2 implementation constraints

基於 audit 結果，D-2 spec 必須處理：

1. **【LS-only 優先 path】** Server session 不存在（94% case）→ 直接用 LS restore；不依賴 DB
2. **【LS + DB merge path】** 兩邊都有 → 按 `ts` 比較（LS payload.ts vs DB.updated_at）；LS 較新 / 兩邊 timestamp 接近時優先 LS（含完整 object shape）
3. **【DB string user_nsm 防禦】** DB.user_nsm 可能是 string（legacy）或 object（post 2026-05-15）；FE 已有 typeof check at 8307-8312，D-2 必須複用同 pattern
4. **【evaluate-overwrites-object 防禦】** 若 DB.user_nsm 是 string + LS 有完整 object → LS overlay DB（撿回 explanation/businessLink），不能用 DB 覆蓋 LS
5. **【stale evaluating checkpoint】** DB.progress_json.evaluating=true + `evaluating_started_at` > 60s ago → 視為 stale，顯示「恢復 / 重試」banner（已是現有設計，D-2 須對齊不能 race）
6. **【no editing lifecycle 假設】** 不可假設 lifecycle=editing 代表有 draft；500/500 NSM rows 0 個 editing
7. **【LS-only fallback when DB 404】** Eager-INSERT 失敗或 session 被 prune → 仍能從 LS 重建（4-field state：nsmDefinition + nsmBreakdown）
8. **【cross-question protection】** LS key 是 `pmdrill:nsm:draft:{qid}` per question；切題後要清舊 qid 的 LS（不然會把 q58 的 draft 載到 q72）
9. **【clear LS on completed】** scores_json 有內容 / lifecycle=completed → 清掉 LS（避免 user 重做時舊資料污染）
10. **【e2e fixture noise】** prod 已有 5 row `e2e-a3-nsm-` timestamp pattern leak — D-2 restore 邏輯本身不需排除，但跑 e2e 測試前 `scripts/scan-pollution.js` 應抓到（既有 patch `e34d825` 已涵蓋此 pattern）

---

## §8 一句話 Verdict

**DB 髒一點點 + 設計大坑兩個**：
- 髒：5 個 orphan `evaluating=true` + 1 個 gated 缺資料 + 5 個 e2e fixture 殘留（總 < 0.2%）
- 真坑：`/evaluate` 把 user_nsm 從 object 退化成 string（F3）+ 94% session 從未 PATCH server（F1）— D-2 必須以 LS 為主 source，DB 為次

---

## §9 附錄：執行 evidence

- 新建腳本：`scripts/audit-supabase-schema-data.js`（READ-ONLY service-role；commit 前可保留 or 刪）
- raw log：`/tmp/audit-supabase-output.log`（本機 ephemeral，不入版控）
- conversion funnel 對照：`scripts/audit-nsm-conversion-funnel.js` 同時間 run，總 6815 rows 一致
