# Wave 3 Readiness Cheat-Sheet — 大規模重構 sprint (2026-05-19)

> Director 寫 per `feedback_director_self_confirm_forbidden` STANDING：大 Wave dispatch 前 quiz reviewer 全 PASS 才放。
> User 2026-05-19 立：「開發紀律必須從 day1 就訂」+ Schema unification commitment + reaffirm quiz STANDING

---

## §A Wave 3 範圍（Option B 中期 robustness 3-4 週）

修 user-visible P0 痛點 + 結構對齊（NSM/CIRCLES schema column 對等 + lifecycle 修 + RLS）+ Wave 1/2 ship。不 cover FE helpers 完全共用（Option C 留長期）。

---

## §B 6 Streams 並行架構

### Stream A — DB migration (BE-only)
- A1 NSM UNIQUE partial index migration (mirror `2026-04-29-circles-active-uniqueness.sql`)
- A2 NSM `guest_id` index (93.6% NSM traffic 是 guest，無 index 全表 scan)
- A3 P0-SCHEMA-1 `/evaluate` string overwrite fix（FE + BE coordinated；FE 改送 full object，BE 加防禦）
- A4 lifecycle state machine 修（NSM 500/500 rows 0 editing — `computeLifecycle()` audit + fix）
- A5 RLS policy codification（per opus audit P0）

**RITUAL §**: §3.8 service-role seed / §3.9 error response testing / §6 ship checklist
**Skill**: `api-testing.md:783-848` / migration files reference
**e2e 鏈**: 跑 jest unit 驗 migration SQL + e2e seed → query → assert dedup
**Baseline source**: existing migration files in `migrations/`（已 user 放行格式）
**Conflict**: 不動 app.js / spec；獨立 BE 變動
**Risk**: migration 順序（A1 必先於 A2 if both 動 `idx_nsm_*` namespace）
**Mitigation**: 各自 atomic migration file + dry-run on test DB before commit

### Stream B — FE NSM/CIRCLES drift fix (drift scan 15)
- B1 C-Drift-1 (XS 6 items: D-1/3/4/5/9/10)
- B2 C-Drift-2 (P0 D-2 localStorage restore — Q1-Q5 brainstorm 結論：方案 B/B/C/A/B + NEW-D-14 history routing fix 併入)
- B3 C-Drift-3 (state refactor: D-7/8/11)
- B4 C-Drift-4 (D-12 NSM recent rail + STANDING memory + hint modal unify)

**RITUAL §**: §3.2 Pitfall 11 / §3.4 Pitfall 18 / §3.7 auth-flows.md:928-949 / §3.8 service-role seed / §3.18 5x consecutive
**Skill**: `common-pitfalls.md` Pitfall 11/14/18/19/3 / `fixtures-and-hooks.md` auto-cleanup
**e2e 鏈**: user action (PATCH /progress) → DB persist → reload → assert restore 真實顯示
**Baseline**: mockup 06 (`.nsm-recent`) + mockup 03 (`.save-indicator`) 既有 design — 不動 mockup
**Conflict**: B1-B4 全動 app.js（NSM-only sections）→ 必序列化 within Stream B
**Risk**: localStorage 跨 c-drift user lane contamination；shared user nsm_001 dedup 衝突
**Mitigation**: 每 commit 用獨立 c-drift user lane（e2e+c-drift-1/2/3/4@first-principle.test）

### Stream C — P0 user-visible FE fixes
- C1 NEW-D-14 history routing fix (`app.js:8582` + `app.js:8320` — `hasQuestion → step 2` 邏輯修)
- C2 P0-SCHEMA-1 FE 側（送 full object 給 /evaluate）— 與 A3 BE coordinated

**RITUAL §**: §3.2 Pitfall 11 / §3.18 5x consecutive
**Skill**: `auth-flows.md:928-949`
**e2e 鏈**: seed session with question_json + empty user_nsm → click history → assert nsmStep === 2
**Conflict**: C1 改 app.js 跟 Stream B 同 file → 必序列化 with B
**Risk**: 改 8582/8320 同時 D-2 改 6107 等 → 多處 app.js diff 衝突
**Mitigation**: C 在 B 之後 ship；或 C 改的 line 範圍跟 B 不重疊（行號 audit）

### Stream D — Wave 1 ship (已 staged，等 ship)
- D1 C1 F-CT2.1
- D2 C2 B6 mockup 04 11 drift
- D3 C3 F-CT1.3 backoff
- D4 C4 B13 prompt fix (atomic with adversarial spec)
- D5 C5 W1-補.7 NSM i18n + offcanvas + NEW-Test-Debt
- D6 C6 Phase A infra (4 c-drift users + auth.setup)

**RITUAL §**: §6 ship checklist 10 件套
**Skill**: 各 commit 已含 skill citation header
**e2e 鏈**: 每 commit 已有 5x consecutive verify（W1-補.7 4/5 + offcanvas 5/5 + B13 17/17×5）
**Conflict**: 不衝突 — 已 staged 不再動
**Risk**: HITL gate cadence — 6 commit × user 1 min decision = 6 min user time
**Mitigation**: Director 寫每 commit 簡報，user 1 分鐘決定「對/退」

### Stream E — E2E coverage (補測試)
- E1 `tests/e2e/nsm-history-resume-routing.spec.js` (RED test for NEW-D-14 + Stream C green)
- E2 `tests/e2e/nsm-localStorage-restore.spec.js` (RED for D-2 → green by B2)
- E3 `tests/api/nsm-evaluate-object-roundtrip.spec.js` (RED for P0-SCHEMA-1 → green by A3+C2)
- E4 `tests/api/nsm-dedup-unique-index.spec.js` (RED for missing UNIQUE → green by A1)

**RITUAL §**: §1 e2e mandate / §3.18 5x consecutive / §3.19 skill citation
**Skill**: 各 spec 用 c-drift user lanes (per Phase A GAP-2 provisioned)
**e2e 鏈**: 每 spec 都覆蓋「user action → DB persist → reload → visible」
**Conflict**: 0 — 純新增 spec file，不動 production
**Risk**: e2e parallel contamination → 用 c-drift-1/2/3/4 lanes 隔離
**Mitigation**: c-drift lane 已 provisioned (slot a47293df DONE)

### Stream F — Docs + STANDING
- F1 `audit/wave-3-migration-plan.md` (schema migration sequence + rollback)
- F2 `feedback_nsm_circles_shared_helper_mandate.md` (drift scan §5 草稿 ship 進 memory)
- F3 `audit/rls-policy-codification.md` (per A5)

**RITUAL §**: §6 master tracker append
**Skill**: writing-plans.md
**Conflict**: 0 — 純 audit doc
**Risk**: 低
**Mitigation**: 各 doc 獨立 + tracker append 走 §5 closure pattern

---

## §C 並行 Schedule（4 週）

| Week | Active streams | Sequential constraint |
|---|---|---|
| 1 | A (1-2) + D (ship 全 6 commit) + E (RED tests) + F (docs) | B/C 等 D ship 完才動 |
| 2 | A (3-5) + B1 + E (green tests) | B/C 序列化 within app.js |
| 3 | B2-B4 + C1-C2 | C2 等 A3 BE ready |
| 4 | regression + cross-plan smoke + ship-gate | full integration verify |

**Daily check**: jest baseline / playwright cross-vp / cross-plan smoke

---

## §D Sub-agent 並行紀律

- 上限 **5 並行**（per RITUAL §7.3 + user override 5）
- **每 stream 內 sequential**（避 conflict）；**跨 stream parallel**（A + D + E + F 同時動）
- 任 1 sub-agent return → 立刻補下一個（per `feedback_parallel_subagent_default`）
- **每 commit 必走 HITL gate**（per `feedback_live_demo_gate_protocol`）：截 PNG → user 1 分鐘「對」
- **每 sub-agent dispatch 必含 fake prevention prompt 範本**（per `feedback_subagent_self_report_unverifiable`）：完整 stdout × 5 / Director cross-check / 禁 monitor task tool

---

## §E 風險 + Mitigation 矩陣

| 風險 | Mitigation |
|---|---|
| app.js B + C 衝突 | Stream B 序列化 + Stream C 改的 line 跟 B 不重疊 audit |
| DB migration ordering | A1 必先於 A2；test DB dry-run before commit |
| e2e parallel contamination | c-drift-{1,2,3,4} user lanes 已 provisioned |
| Sub-agent fake history（6 次）| Hard report format + Director cold-Read 親跑 cross-check |
| HITL gate 卡 user | Director 寫簡報 < 30 行；user 1 分鐘決定 |
| 中斷 prod feature 開發 | B option 範圍限制 — 不 ship FE helper unification，留 Option C 長期 |
| Schema migration 風險 | down-path 必寫；no destructive without backup |

---

## §F Quiz Reviewer 預期問題（你會被考）

per `feedback_director_self_confirm_forbidden` quiz 5-7 題 expected：

1. 殺手鐧 5 問每題 Wave 3 具體答案
2. Stream A/B/C 怎麼避 app.js 衝突？
3. e2e parallel contamination 怎麼防？（drainSessions / c-drift user / kill switch）
4. P0-SCHEMA-1 fix BE + FE coordination 怎麼做？(同 commit / 分 commit?)
5. NEW-D-14 fix line 8582 + 8320 + AppState.nsmStep init 三處改是 atomic 嗎？
6. Wave 3 與 Wave 1 / Wave 2 commit boundary 怎麼劃？
7. STANDING memory `feedback_nsm_circles_shared_helper_mandate` 立的時機是 B4 ship 時還是 Wave 3 開始？

---

## §G Director 自確 (per §13 — 等 quiz 過才算數)

- e2e mandate 知道嗎？ ✓
- IL-1/2/3 知道嗎？ ✓
- Pitfall 11/14/18/19/3 知道嗎？ ✓
- Karpathy 4 知道嗎？ ✓
- 並行上限 + opus/sonnet 分工 ✓
- master tracker 怎麼用 ✓
- User 殺手鐧 5 問 ✓

**但 Director 自確不算數 — 必過 quiz reviewer 才算**。
