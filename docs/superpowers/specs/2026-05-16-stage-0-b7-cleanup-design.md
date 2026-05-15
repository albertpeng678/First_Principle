# Stage 0 — B7 Data Pollution Cleanup + Prevention Infra

> **Status:** Design approved（§1-5 全 user 放行 2026-05-16）
> **Goal:** 清掉 user 真帳號 `albertpeng678@gmail.com` 上由我過去 UAT spec 寫入的測試污染資料；同時建立永久 prevention infra 阻止再次發生。
> **Date:** 2026-05-16

---

## 0. Context

過去 7 輪 UAT spec 用 production URL + user 真帳號跑，產生形如 `e2e-r2-B4-I-1778822383-f0` / `dual-uat-r2-nsm-...` 的 stub 字串寫進 prod DB。User 截圖 23.png 在 Phase 1 form 看到這些測試垃圾，B2「對話練習憑空有內容」很可能也是同源污染。

skill 已明確點名違規：
- `playwright-skill/core/test-data-management.md:1153` — 「Using production data in tests」（anti-pattern）
- `playwright-skill/SKILL.md` Golden Rule #10 — 「Mock external services only — never mock your own app」

Stage 0 走完，B7 永久解決 + B8 方法論基石就位 → Stage 1 才能在乾淨契約上修剩 7 bug。

---

## 1. Architecture

兩條 parallel lane 並行 + merge 後 destructive，design 原則：

```
┌────────────── PARALLEL LANES（commit batch 同一輪）──────────────┐
│                                                                  │
│  Lane A — Prevention Infra (sonnet, write-only, 0 destructive)  │
│  ┌─────────────────────────────────────────┐                    │
│  │ A1. .env.test + .env.local + .env.example                    │
│  │ A2. tests/helpers/env-guard.js          │                    │
│  │ A3. tests/fixtures/auto-cleanup.fixture │                    │
│  │ A4. .husky/pre-commit append            │                    │
│  │ A5. TDD specs (4 helpers, red-green)    │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  Lane B — Audit Report (opus, read-only, 0 destructive)         │
│  ┌─────────────────────────────────────────┐                    │
│  │ B1. scripts/register-test-account.js    │                    │
│  │ B2. scripts/scan-pollution.js           │                    │
│  │ B3. POLLUTION_PATTERNS regex            │                    │
│  │ B4. audit/data-pollution-report-...md   │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────┬──────────────────────────┬─────────────────┘
                      └──────── MERGE ───────────┘
                                  ↓
                  §3 user review 報告 → 標 confirm
                                  ↓
        §4 execute DELETE / CLEAR-FIELD（assertActingOnBehalfOf 保護）
                                  ↓
              security-review skill 驗 .env.* gitignored + 無 leak
                                  ↓
                          Stage 0 complete → Stage 1 開工
```

**為什麼 parallel：** Lane A 全 write-only（建檔案），Lane B 全 read-only（GET + 產 .md），互不依賴；destructive 只發生在 merge 後且受 Lane A 產出的 guard 保護。

---

## 2. Components

### 2.1 Lane A — Prevention Infrastructure

| # | 檔案 | 內容 / 介面 |
|---|---|---|
| A1 | `.env.test`（git-ignored）| `BASE_URL=https://first-principle.up.railway.app/`<br>`TEST_EMAIL=e2e@first-principle.test`<br>`TEST_PASSWORD=<random 16 char>`<br>`USER_REAL_EMAIL=albertpeng678@gmail.com`（cleanup-only guard 用） |
| A1b | `.env.local`（git-ignored）| `BASE_URL=http://localhost:3000`<br>同 email/password + USER_REAL_EMAIL |
| A1c | `.env.example`（commit）| 範本；值用 `<set in your local .env.test>` placeholder |
| A1d | `.gitignore` verify | 確認 `.env*` 在內（已存在；read-only verify） |
| A2 | `tests/helpers/env-guard.js` | export `assertNotProdWithRealAccount(email)` + `assertActingOnBehalfOfPollutionTarget(email)` |
| A3 | `tests/fixtures/auto-cleanup.fixture.js` | auto fixture：`cleanupTracker.track(kind, id)` + `afterEach` loop `request.delete` |
| A4 | `.husky/pre-commit`（append）| 擋 hardcoded `railway.app` URL + hardcoded `albertpeng678@gmail.com` 進 `tests/**/*.spec.js` |
| A5 | TDD specs | `tests/helpers/env-guard.test.js`（5 case）+ `tests/fixtures/auto-cleanup.test.js`（4 case）+ `scripts/test-pre-commit.sh`（3 case） |

### 2.2 Lane B — Audit Report

| # | 檔案 | 內容 |
|---|---|---|
| B1 | `scripts/register-test-account.js` | 一次性：curl POST `/api/auth/register {email: "e2e@first-principle.test", password: <random>}` → 200 ok → 寫 `.env.test`（已存在則 skip）|
| B2 | `scripts/scan-pollution.js` | login real account → GET `/api/{nsm,circles}-sessions` → inspect 7 個 user-typed field：`framework_draft.*` / `phase2_chat_history` / `phase2_conclusion_draft` / `user_nsm` / `user_breakdown` / `user_explanation` / `user_business_link` |
| B3 | `POLLUTION_PATTERNS`（B2 內部） | `/^(e2e-r\d+-)/` + `/^(dual-(r-)?uat-)/` + `/^(test-stub-)/` + `/^(smoke-)/` + `/^[a-zA-Z0-9_-]+-178\d{6,}-f\d/` |
| B4 | `audit/data-pollution-report-2026-05-16.md` | 表格：sessionId / kind / created_at / polluted_fields / sample_content (60 char) / suggested_action (`DELETE row` 或 `clear field`) + DELETE / CLEAR 分兩 list + curl preview block |

### 2.3 Merge / Destructive

| # | 檔案 | 內容 |
|---|---|---|
| M1 | `scripts/execute-cleanup.js` | Read 報告 confirmed list → pre-flight `assertActingOnBehalfOfPollutionTarget(USER_REAL_EMAIL)` → `--dry-run` 模式可預覽 curl → stdin 等完整 confirm 字串 → loop DELETE / PATCH → 每筆寫 receipt |
| M2 | `audit/data-pollution-executed-2026-05-16.md` | receipt：每筆 sessionId + action + http status + timestamp |

### 2.4 Verify

| # | 動作 | 工具 |
|---|---|---|
| V1 | re-scan 確認 0 polluted | reuse `scan-pollution.js` |
| V2 | security-review on pending changes | invoke `security-review` skill |

---

## 3. Data Flow

### 3.1 Auth

**B1（一次性）：**
```
POST /api/auth/register
body: { email: "e2e@first-principle.test", password: "<random16>" }
expect: 200 { ok: true, userId }
side effect: write .env.test if not exists
```

**B2 / M1 / V1（每次跑）：**
```
POST /api/auth/login (Supabase SDK) → access_token
GET /api/nsm-sessions      header { Authorization: Bearer <token> }
GET /api/circles-sessions  header { Authorization: Bearer <token> }
```

### 3.2 Field inspect map

7 個 user-typed field（jsonb 內展開到 string-level 檢查）：

| Kind | 欄位 | 檢查方式 |
|---|---|---|
| circles | `framework_draft.{C1,I,R,C2,L,E,S}.*` | 每個 jsonb leaf string 套 regex |
| circles | `phase2_chat_history` | array of {role, text}；每個 text 套 regex |
| circles | `phase2_conclusion_draft` | 整 string 套 regex |
| nsm | `user_nsm` | string 或 jsonb；string 套 regex / jsonb 同 leaf 展開 |
| nsm | `user_breakdown` | `{reach, depth, frequency, impact}` 每 value 套 regex |
| nsm | `user_explanation` | 整 string 套 regex |
| nsm | `user_business_link` | 整 string 套 regex |

### 3.3 Audit report 結構

```markdown
# Data Pollution Report — 2026-05-16
Scanned: albertpeng678@gmail.com
Patterns: e2e-rN- / dual-uat- / *-178NNN-fN / test-stub- / smoke-
Result: X polluted sessions found (Y nsm + Z circles)

## Suggested DELETE list (whole row — created BY my UAT spec)
| sessionId | kind | created_at | match field | sample | confirm? |

## Suggested CLEAR-FIELD list (legitimate session, single polluted field)
| sessionId | kind | created_at | match field | sample | confirm? |

## Curl preview (post-confirmation execution)
[block of curl commands]
```

### 3.4 Execute flow

```
讀 audit/data-pollution-report → parse confirmed checkboxes
↓
assertActingOnBehalfOfPollutionTarget(USER_REAL_EMAIL)
↓
optional --dry-run print curl commands
↓
stdin 等 "yes I confirm <N> deletions"
↓
loop confirmed list：
  DELETE → DELETE /api/{kind}-sessions/<id>
  CLEAR  → PATCH /api/{kind}-sessions/<id>/progress { field: "" }
↓
寫 audit/data-pollution-executed-2026-05-16.md（receipt）
↓
re-scan → expect 0
```

### 3.5 Guard 雙模式

| Mode | Helper | 用途 |
|---|---|---|
| Normal | `assertNotProdWithRealAccount(email)` | 所有 spec / Lane A test 用；prod URL + 真帳號 → throw |
| Cleanup-only | `assertActingOnBehalfOfPollutionTarget(email)` | M1 cleanup 專用；明示 opt-in，必須匹配 USER_REAL_EMAIL env，其他 throw |

---

## 4. Error Handling

### 4.1 Register（B1）

| 情境 | 處理 |
|---|---|
| `email_already_exists` | 不視為錯；接續 login 驗 password；錯則提示 user 在 Supabase admin reset |
| `password_too_weak` | regenerate + retry |
| network / 5xx | exit 1，報告 user，不重試 |
| 200 ok | write `.env.test`（已存在 → log + skip） |

### 4.2 Login

| 情境 | 處理 |
|---|---|
| 401 invalid_credentials | exit 1，提示 reset 或重 register |
| Token expired | retry 1 次；二次失敗 exit 1 |
| 5xx | retry 3 次 backoff (1/2/4s)；仍失敗 exit 1 |

### 4.3 Pollution scan

| 情境 | 處理 |
|---|---|
| 0 polluted | 空報告 + 結語「無污染」+ Stage 0 §3-5 跳過 |
| GET 500 某 sessionId | log + continue 其他；報告底部列「scan-failed」 |
| jsonb parse error | log + suggest manual review；不歸 polluted |
| 報告寫入失敗 | exit 1，不留 partial |

### 4.4 Execute cleanup（M1）— 最高風險

| 情境 | 處理 |
|---|---|
| `assertActingOnBehalfOf` throw | exit 1 立刻；0 destructive ops |
| sessionId 404 | log skip，receipt 標 `already_gone`，不算 error |
| DELETE 500 | retry 1 次；仍失敗 → log `failed` 並繼續其他 row（不 abort 整批） |
| PATCH 500 | 同上 |
| Script crash 中途 | resume 模式：re-run 讀 receipt 跳過已 `200_ok`，只重跑未處理 / failed |
| 全 DELETE 完 re-scan 仍有 | log dedup cache 可能延遲；等 30s 再 re-scan；仍有 → 報告 new failure |

### 4.5 Prevention infra（Lane A）

| 情境 | 處理 |
|---|---|
| TDD red phase test 沒紅 | 修 spec 或實作直到正確紅 |
| Pre-commit hook false positive | hook 用 `git diff --cached` 精確找 spec literal；非 spec 檔不掃 |
| `.env.test` 已存在但缺欄位 | log warn 提示補齊；不覆寫 |
| `.gitignore` 已含但格式不同 | append 標準格式 + commit |

### 4.6 Verify

| 情境 | 處理 |
|---|---|
| V1 re-scan 仍有污染 | exit 1，報告 sessionId，Stage 0 不算 done |
| V2 發現 leak | 立刻 fix + 重跑 |
| `.env.test` 被誤 commit | `git rm --cached` + commit + rotate password + 重 register |

### 4.7 IL-1 整合

任何 error path 上「retry 仍失敗」：
1. 寫 evidence log（layer / status / payload）
2. Phase 1 root cause 分析，不確定根因不准動
3. 3+ fix 仍未過 → 停下找 user discuss architecture

---

## 5. Testing Strategy

### 5.1 Lane A — Prevention infra TDD

| Helper | 紅燈 spec | 綠燈 impl |
|---|---|---|
| `env-guard.js` `assertNotProdWithRealAccount` | 5 case：prod+real throw / prod+test pass / local+real pass / local+test pass / missing email throw | export simple if-throw |
| `assertActingOnBehalfOfPollutionTarget` | 3 case：USER_REAL pass / test email throw（明示「只能對你的真帳號」）/ 第三人 throw | if-throw 匹配 USER_REAL_EMAIL env |
| `auto-cleanup.fixture.js` | 4 case：track 0 / 1 / 3 / 404 swallow | `test.extend` auto fixture collect + afterEach loop |
| `.husky/pre-commit` hook | 3 case：spec contains `railway.app` exit 1 / spec contains real email exit 1 / non-spec file no exit | grep + 條件 |

**紅綠循環必走（IL-3）**：
```
1. 寫 spec → 跑 → 紅
2. 寫 impl → 跑 → 綠
3. revert impl → 跑 → 必再紅（驗 spec 真測東西）
4. restore → 跑 → 再綠
5. 記錄 4 output 進 commit message
```

### 5.2 Lane B — Audit report unit test

| Component | 驗證 |
|---|---|
| regex 邏輯 | 5 polluted + 5 legitimate string → 5 hit + 5 miss |
| Field extraction（jsonb path）| mock 4 schema → 抓出正確 string array |
| Markdown 格式 | snapshot test：固定 input 比對 expected .md |

### 5.3 Execute — IL-2 gates（非 TDD）

| Gate | 證據 |
|---|---|
| G1 Pre-flight | script 開頭 call assertActingOnBehalfOf → throw 即 exit 0 destructive |
| G2 Dry-run | `--dry-run` 印 curl 不執行；user 親看 |
| G3 Confirmation | stdin 等 `yes I confirm <N> deletions` 完整字串 |
| G4 Per-row receipt | 每 DELETE 完寫一行；crash 保留 partial → resume |
| G5 Post-execution re-scan | 跑完 scan-pollution.js → expect 0 polluted **on confirmed list that returned `200_ok`**；`failed` rows 不算 G5 通過 → 報告 + fix root cause（IL-1）後重跑 |

### 5.4 IL-2 Verification Evidence checklist（Stage 0 完工貼齊）

- [ ] `npm test tests/helpers/env-guard.test.js` → 5/5 pass + 紅綠 revert log
- [ ] `npm test tests/fixtures/auto-cleanup.test.js` → 4/4 pass + 紅綠 revert log
- [ ] `bash scripts/test-pre-commit.sh` → 3/3 case 通過
- [ ] `node scripts/scan-pollution.js`（pre-cleanup）→ report 路徑 + count
- [ ] user check 報告 → 回「確認 N 筆」
- [ ] `node scripts/execute-cleanup.js --dry-run` → user 親看 curl preview
- [ ] `node scripts/execute-cleanup.js` → receipt 路徑 + status
- [ ] `node scripts/scan-pollution.js`（post-cleanup）→ 0 polluted
- [ ] invoke `security-review` skill → 無 leak / .env.* 全 gitignored
- [ ] `git diff` review → 確認沒誤 commit `.env.test`

### 5.5 IL-1 evidence requirement

任何 step 失敗：先寫 root cause analysis，不准盲 retry。

---

## 6. Acceptance Criteria（Stage 0 完成定義）

- [ ] `audit/data-pollution-report-2026-05-16.md` 存在，user 標完 confirm
- [ ] `audit/data-pollution-executed-2026-05-16.md` 存在，所有 confirmed row 都有 `200_ok` 或 `already_gone` status
- [ ] Re-scan 0 polluted（V1 PASS）
- [ ] `security-review` 無 leak（V2 PASS）
- [ ] Lane A 5 helper / fixture / hook 全部 TDD 紅綠 revert 循環完成
- [ ] `.env.test` 已存在於 local，未 commit；`.env.example` 已 commit 含 placeholder
- [ ] Pre-commit hook 已 active，跑 `git commit` 對含 hardcoded prod URL spec 確認被擋
- [ ] CLAUDE.md state board 更新「Stage 0 done, Stage 1 ready」
- [ ] 兩條 standing memory 建立：`feedback_three_iron_laws.md` + `feedback_e2e_real_data_only.md`

---

## 7. Out of Scope（Stage 1 處理）

- B1 / B2 / B3 / B4 / B5 / B6 修補（Stage 1 走完整 brainstorm → plan → impl）
- 既有 production spec 漸進改寫到 10 Golden Rules（P3 階段）
- audit-cycle 11-agent flow（Stage 1 大 ship 前跑）
- railway-deploy-prep（Stage 1 ship 前跑）
- GitHub Actions CI workflow（P5 階段）

---

## 8. References

- 整合 plan：`audit/skill-integration-plan-2026-05-16.md`
- Standing rule（**Stage 0 完工最後一步建立**）：`feedback_three_iron_laws.md` — IL-1/2/3 升 STANDING；implementer / reviewer dispatch 必 prepend
- Standing rule（**Stage 0 完工最後一步建立**）：`feedback_e2e_real_data_only.md` — 禁 stub timestamp / 禁 mock 自家 API / 禁 prod URL + 真帳號
- Playwright skill：`/Users/albertpeng/.claude/skills/playwright-skill/core/test-data-management.md`
- Iron Laws：`superpowers:systematic-debugging` + `superpowers:verification-before-completion` + `superpowers:test-driven-development`
