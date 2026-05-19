# Wave 3 Readiness Cheat-Sheet v2 — 補 10 gaps (2026-05-19)

> Director rewrote per Wave 3 quiz reviewer BLOCKED verdict (v1 0 PASS / 3 NC / 4 FAIL)。
> User 2026-05-19 reaffirm「開發紀律必須從 day1 就訂」+ user 選 A 最 robust。

---

## §0 Honest current state（v1 self-fake correction）

**v1 寫「Stream D 已 staged 等 ship」是 self-fake** — `git diff --cached --name-only` 只 2 file：
- `prompts/circles-final-report.js`
- `tests/adversarial/circles-final-report-adversarial.test.js`
（= 只 B13 prompt fix staged）

**212 modified files 在 working tree** — Wave 1 work content 在，但 **staging lost**（pre-existing modifications，可能 mockup git restore + sub-agent edit 過程中 staging 沒 carry forward）。

→ **Wave 1 ship 多 30-60 min work** = re-hunk-split + re-stage per commit boundary。

---

## §1 Wave 3 Scope（Option B）

修 user-visible P0 痛點 + 結構對齊（NSM/CIRCLES schema column 對等 + lifecycle 修 + RLS）+ Wave 1/2 ship。**不 cover FE helpers 完全共用**（Option C 留長期）。3-4 週 timeline。

---

## §2 Per-commit line-range conflict map（gap #1）

### App.js 改動位置 per commit

| Stream | Commit | app.js line range | AppState keys 觸及 | Other files |
|---|---|---|---|---|
| **D D1 C1** F-CT2.1 | 6394 hunk only | `nsmDraftSession` write | tests/e2e/nsm-step1-card-click-no-session.spec.js + 30 PNG |
| **D D2 C2** B6 mockup 04 drift | 5136-5240 renderCirclesGate | `circlesGate*` (read only) | style.css + 44 visual baseline PNG |
| **D D3 C3** F-CT1.3 backoff | 0 lines (prompt only) | none | prompts/circles-gate.js:119 + jest unit |
| **D D4 C4** B13 prompt | 0 (prompt only) | none | prompts/circles-final-report.js + adversarial spec (**已 staged**) |
| **D D5 C5** W1-補.7 + offcanvas + NEW-Test-Debt | 2027 (dead conditional fix) | `nsmGateError` (existing) | routes/nsm-sessions.js + 3 spec files |
| **D D6 C6** Phase A infra | 4 lines AppState additions | `nsmGateInflight / nsmSessionLoading / nsmPhase2SaveState / nsmRecentSessions` (4 new) | scripts/register-c-drift-test-accounts.js + tests/setup/auth.setup.js |
| **B B1** C-Drift-1 6 XS | 2148 (NSM persistRetry) / 3146 (resumeToast) / 1973-2110 (gateInflight) / 4220 (hint abort) / 1978-1992 (delete dup) / 6206 (excludeCurrent) | `nsmGateInflight` (use D6's key) / others use existing | none |
| **B B2** C-Drift-2 D-2 + D-6 | 8547 + 6396 + 6457-6464 (restore paths) | `nsmDefinition / nsmBreakdown` (existing) | + tests/e2e/nsm-localStorage-restore.spec.js |
| **B B3** C-Drift-3 state refactor | 3212 (resetNsmToHome new helper) + 347 (sessionLoading branch) + 3767 (save indicator mirror) | `nsmSessionLoading / nsmPhase2SaveState` (use D6 keys) | + 4 reset sites refactor |
| **B B4** C-Drift-4 D-12 recent rail | 5824 (renderRecentRail extract helper) + 6297 (renderNSMRecentRail wire) + 8697 (cache invalidate) | `nsmRecentSessions` (use D6 key) | + memory STANDING file + hint modal unify (line 3959/4124/4231/4373) |
| **C C1** NEW-D-14 routing | 8582 + 8320 (NSM step resolve 2 sites) | none new | none |
| **C C2** P0-SCHEMA-1 FE | 2080-2087 (evaluate body) | `nsmDefinition` (read) | routes/nsm-sessions.js BE 139-141 同 commit (A3 atomic) |

### Conflict 解析

- **D6 必先 ship**（all of B1-B4 + C1 + C2 都 read D6 的 4 個 AppState key）
- **B1-B4 序列化**（同 file 不同 line，git apply 順序很重要）
- **C1 + C2 在 B 之後**（C1 8582/8320 vs B 各 line 不重疊但跨 NSM-only file），可序列化於 B 完
- **A4 lifecycle fix → B2 D-2 dependency**（A4 修 NSM editing → B2 才能 assert lifecycle）

### 序列化 timeline

`D6 (AppState prep) → D1..D5 (Wave 1 ship) → A1 + A4 → B1 → B2 → B3 → B4 → C1 → A3 + C2 atomic → A2 + A5`

---

## §3 A1 dedupe-first SQL（gap #2 — 358 dup rows）

Mirror `migrations/2026-04-29-circles-active-uniqueness.sql` step ordering：

```sql
-- A1.1: 找 keep-id per (owner, question_id, lifecycle='created')
--       策略：keep latest non-empty per group；若全部 empty 保 oldest
WITH ranked AS (
  SELECT id, user_id, guest_id, question_id, lifecycle, created_at,
         (user_nsm IS NOT NULL AND user_nsm != '{}'::jsonb) AS has_content,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(user_id, guest_id), question_id, lifecycle
           ORDER BY (user_nsm IS NOT NULL AND user_nsm != '{}'::jsonb) DESC,
                    updated_at DESC
         ) AS rn
  FROM nsm_sessions
  WHERE lifecycle = 'created'
)
DELETE FROM nsm_sessions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
-- 預期 delete: 358 rows (per opus audit §10b)
-- 預期 keep: 1 per (owner, question_id, lifecycle) group

-- A1.2: CREATE UNIQUE INDEX (partial, lifecycle='created' only)
CREATE UNIQUE INDEX CONCURRENTLY idx_nsm_sessions_active_uniqueness
ON nsm_sessions (COALESCE(user_id::text, guest_id::text), question_id)
WHERE lifecycle = 'created';

-- A1.3 rollback path
-- DROP INDEX CONCURRENTLY IF EXISTS idx_nsm_sessions_active_uniqueness;
```

**Pre-flight verify steps**:
1. test DB dry-run（先在 test 環境跑 A1.1，count delete = 358 預期值）
2. backup table snapshot before A1.1（per CIRCLES migration precedent）
3. `CONCURRENTLY` 避鎖 prod table（per Postgres best practice）

---

## §4 Lane assignment table（gap #3 — 4 lanes × 8+ commits）

### 4 c-drift user lanes（per Phase A GAP-2 provisioned）

```
e2e+c-drift-1@first-principle.test
e2e+c-drift-2@first-principle.test
e2e+c-drift-3@first-principle.test
e2e+c-drift-4@first-principle.test
```

### Assignment

| Commit / Spec | Lane | 為什麼 |
|---|---|---|
| Stream D (Wave 1) 6 commits | c-drift-1 (rotate) | Wave 1 已驗證的 spec，序列化跑 OK |
| **B1 C-Drift-1 spec** | c-drift-1 | XS 6 items 小範圍 |
| **B2 C-Drift-2 spec** | c-drift-2 | D-2 localStorage restore 需獨立 user 避污染 |
| **B3 C-Drift-3 spec** | c-drift-3 | state refactor 跨 NSM keys |
| **B4 C-Drift-4 spec** | c-drift-4 | recent rail + STANDING |
| C1 NEW-D-14 routing spec (E1) | c-drift-2 (rotate after B2) | 同 user journey |
| A3+C2 evaluate roundtrip spec (E3) | c-drift-3 (rotate after B3) | evaluate 觸 NSM |
| A1 dedup constraint spec (E4) | c-drift-4 (rotate after B4) | UNIQUE index 直接 query nsm_sessions |
| E2 nsm-localStorage-restore.spec.js | c-drift-1 (after Wave 1) | 跨 lane (D-2 implementation in B2 uses c-drift-2)，會跟 B2 spec 衝突 → **使用 c-drift-1 隔離** |

**Rule**: 同一時間 1 lane 只跑 1 spec process。`drainSessions` 在 spec 內 boot 階段 drain 該 lane 全 NSM session（per offcanvas E pattern），避免 prev run 殘留。

---

## §5 Schedule with dependencies（gap #4 — A4→B2）

| Week | Day | Active streams | Sequential constraint |
|---|---|---|---|
| 0 | 0 | **A5 dashboard verify (user action)** | A5 migration blocker |
| 1 | 1 | **D6 AppState prep** (already done; just ship) + A1 migration + A4 lifecycle + E2/E4 RED specs + F1/F2/F3 docs | D6 ship 後其他都 unblock |
| 1 | 2-3 | D1-D5 Wave 1 ship (sequential per HITL gate) | each commit Director simrep + user gate |
| 2 | 1 | A2 guest_id index + A3 evaluate fix + B1 C-Drift-1 + E1 RED spec | B1 wait for D6 ship |
| 2 | 2-3 | **A4 ship → B2 unblock** + C1 NEW-D-14 routing | **B2 等 A4 完**（lifecycle assumption） |
| 2 | 4-5 | B2 D-2 localStorage restore + E2 GREEN | use c-drift-2 lane |
| 3 | 1 | B3 C-Drift-3 state refactor | B2 ship 後 |
| 3 | 2 | B4 C-Drift-4 recent rail + STANDING | B3 ship 後 |
| 3 | 3 | **A3 + C2 atomic** evaluate object roundtrip (BE+FE) + E3 GREEN | A4 ship 完才 unblock |
| 3 | 4 | A5 RLS migration | dashboard verify done |
| 4 | 1-2 | Regression: cross-plan smoke 5x / jest 5x serial / Playwright cross-vp | all upstream done |
| 4 | 3 | Push origin/main | full integration GREEN |

---

## §6 A5 RLS dashboard pre-flight（gap #5）

**Action needed before A5 dispatch**:
1. User 開 Supabase dashboard
2. Navigate Authentication → Policies → 看 `nsm_sessions` / `circles_sessions` / `auth.users` / 其他 tables
3. 截 screenshot 給 Director
4. 回報目前 RLS state（enabled / policies / role mapping）
5. Director 才能寫 A5 migration（codify existing or fix gap）

**Without dashboard verify**：A5 可能 ship 破壞 prod 現有 policy。

---

## §7 HITL aggregate budget（gap #6）

| Stream | Commit count | Per-commit user time | Total |
|---|---|---|---|
| A migrations | 5 | 30s (text review) | 2.5 min |
| B drift | 4 | 1 min (review PNG + simrep) | 4 min |
| C P0 fixes | 2 | 1 min | 2 min |
| D Wave 1 | 6 | 1 min (already-tested commits) | 6 min |
| E e2e specs | 4 | 30s (no UI) | 2 min |
| F docs | 3 | 30s (consolidate to 1 batch gate) | 0.5 min |
| **Total per cycle** | **24** | | **~17 min** |

**Mitigation**:
- F 3 docs 1 batch gate（不分 3 次 user time）
- E 4 specs no UI → 純看 5x consecutive 數字
- 同期 review fix loop 預估 2 cycles = ~34 min user time over 3-4 weeks

可接受（用戶分散時間，不是一次性 34 min）。

---

## §8 Anti-fake dispatch template body（gap #7）

每 Wave 3 sub-agent dispatch prompt **必含以下 section**（不只 cite STANDING）：

### Section: Anti-fake controls（must verbatim 嵌入 dispatch prompt）

```markdown
## ⚠️ Sub-agent fake history (本 session 6+ 次命中)

- D 自報 50/50 → reviewer 真 26/50
- a77f08b8 自報 50/50 → reviewer 真 49/50
- B6 monitor timeout 沒驗
- 第一輪 F1 fix 範圍判斷錯
- a47293df AppState prep 自報 5/5 GREEN 但 full jest run Run 1 fail
- Director self-fake「6 commit 已 staged」(quiz catch)

## 你必走 4 件事（缺一退件）

1. **完整 stdout × 5 paste**（不允許「Run X: PASS」摘要）
```
=== Run 1 ===
[tail 15 line]
=== Run 2 ===
[tail 15 line]
=== Run 3 ===
[tail 15 line]
=== Run 4 ===
[tail 15 line]
=== Run 5 ===
[tail 15 line]
```

2. **git diff --cached paste**（cross-check 真實 staged file）
```
$ git diff --cached --stat
[paste output]
```

3. **git ls-files --error-unmatch verify**（cross-check spec 真追蹤）
```
$ git ls-files --error-unmatch tests/path/spec.js
[paste output or error]
```

4. **禁用 monitor task tool**（過去 5+ 次 timeout）— bash 直跑 only

任 1 step fake / 缺漏 → Director 退件 + 重做。
```

### 2-stage review chain per commit（per `feedback_two_stage_review_mandatory`）

- **Spec-compliance reviewer (opus)**: 對照 spec / tracker / mockup 確認 code 100% match
- **Code-quality reviewer (opus)**: Karpathy 4 + 7-anti-pattern + STANDING memory cross-ref

兩 reviewer APPROVED + Director simrep + user gate → commit。

---

## §9 PNG capture plan per stream（gap #8）

| Stream | Commit | PNG capture? | Path | Threshold |
|---|---|---|---|---|
| A1 dedup migration | ❌ no UI | — | — | — |
| A2 guest_id index | ❌ no UI | — | — | — |
| A3 evaluate fix (BE side) | ❌ no UI | — | — | — |
| A4 lifecycle fix | ❌ no UI（state machine internal）| — | — | — |
| A5 RLS migration | ❌ no UI | — | — | — |
| **B1 C-Drift-1** | ⚠️ partial（D-3 evalToast + D-4 gate mutex 有 UI feedback）| `audit/Wave3-b1-evidence/{vp}.png × 3 vp` | mockup-source baseline diff < 0.5% |
| **B2 C-Drift-2 D-2 + D-6** | ✅ yes（restore form state visible）| `audit/Wave3-b2-evidence/{vp}-restore-{scenario}.png × 3 vp × 3 scenarios` | mockup-source |
| **B3 C-Drift-3 D-11 save indicator** | ✅ yes（save indicator 4 state）| `audit/Wave3-b3-evidence/{vp}-save-{state}.png × 3 vp × 4 state` | mockup 03 LOCKED reuse — pixel-diff 既有 mockup |
| **B4 C-Drift-4 D-12 recent rail** | ✅ yes（NSM recent rail desktop only）| `audit/Wave3-b4-evidence/desktop-recent-rail.png` | mockup 06 既有 .nsm-recent baseline |
| **C1 NEW-D-14 routing** | ✅ yes（before/after history click → step 2 not step 1）| `audit/Wave3-c1-evidence/{vp}-before.png / {vp}-after.png` | DOM verify primary, PNG secondary |
| **C2 P0-SCHEMA-1 FE** | ✅ yes（restore form shows explanation + biz_link）| `audit/Wave3-c2-evidence/{vp}-restored.png` | DOM verify primary |
| **E specs** | ❌ no UI | — | — | — |
| **F docs** | ❌ no UI | — | — | — |

### Director cold-Read mandate per PNG-touching commit

per `feedback_uiux_visual_only`：Director 親 Read 每張 PNG ≥ 1 句評論，sub-agent self-Read 不算數。Wave 3 預估 ~24 PNG × 3 vp = 72 PNG cold-Read。

---

## §10 Cost forecast（gap #9）

### Real OpenAI 觸發 commit / spec

| Commit / Spec | OpenAI calls per CI run | × 3 vp | × 5x consec | $/cycle (@$0.03/call) |
|---|---|---|---|---|
| B13 adversarial spec (already shipped C4) | 17 variants | 17 | 85 | $2.55 |
| B2 D-2 spec - real PATCH/restore walk | ~2 calls/run (gate/evaluate optional) | 6 | 30 | $0.90 |
| C2 evaluate roundtrip (E3) | ~2 calls/run (evaluate + reload) | 6 | 30 | $0.90 |
| Critical-path-full-flow (existing) | ~2 calls/run | 6 | 30 | $0.90 |
| Adversarial sweep monthly run | 50 variants | n/a | n/a | $1.50 |
| **Wave 3 ship-gate one-time** | | | | **~$6.75** |
| **Monthly CI ongoing** (post-ship) | | | | **~$15-30/month** |

### Cost mitigation

- E2/E4 spec 用 service-role seed bypass OpenAI（per RITUAL §3.8 carve-out）— $0
- E3 evaluate roundtrip 必真 OpenAI（測試 evaluate behavior）— $0.90/cycle
- adversarial 5x consec 已 ship 在 C4，不重複

---

## §10b Stream D real staged status（gap #10）

### Current honest state

`git diff --cached --name-only` 顯示 only 2 files:
- `prompts/circles-final-report.js`
- `tests/adversarial/circles-final-report-adversarial.test.js`

= **只有 B13 prompt fix staged**（slot ab8bfc8d 工作）。

### Wave 1 work content state

`git status --short | wc -l` = 212 modified files **但全 unstaged**。
- public/app.js: modified（含 W1-補.7 / Bug A / Bug B / F-CT1.1 / F-CT1.2 / B6 etc.）
- routes/nsm-sessions.js: modified
- 60+ visual baseline PNG: modified
- 多個 spec files modified

Wave 1 「ship-ready」是 **false claim** — 工作內容在 working tree，**staging lost**。

### Stream D revised plan

**D0 (NEW): Re-hunk Wave 1 work into 6 commit boundaries**
- Read each commit's expected scope per `audit/wave-1-c1-c5-commit-messages-draft.md`
- `git add -p` 互動式 stage 對應 hunks
- 每 commit 預 stage 完後 `git diff --cached` cross-check
- 工時：~30-60 min Director hand work（不可 dispatch sonnet，原因：互動式 staging 需 Director judgment）

**D1-D6**: After D0，正常 simrep + user gate per commit。

---

## §11 Director 自確（不算數，必過 quiz）

- e2e mandate ✓
- IL-1/2/3 ✓
- Pitfall 11/14/18/19/3 ✓
- Karpathy 4 ✓
- 並行紀律 ✓
- master tracker ✓
- 殺手鐧 5 ✓

**但必過 quiz reviewer 才算 Wave 3 ready**。
