# Wave 1 補洞 + Phase 1 P1 並行 — Cheat-Sheet v4 (post quiz round 1 補洞)

> Director skill-integrated execution plan
> Date: 2026-05-18 PM
> Quiz round 1: v3 NOT READY (Q2 FAIL + 7 gap); 本 v4 補完
> Quiz round 2 pending

---

## §A 已 user 決定（v4 補 audit trail link）

- **A.1 D-11 baseline 副作用 = 路徑 B** (user 「b」 in chat 2026-05-18 message, prior to「a」for 8 補洞)：
  - production 已對齊 mockup（D-11 fix 對的）
  - 舊 test baseline self-referential = **architectural debt** (per systematic-debugging Phase 4 step 5)
  - **Tracker §6 O-13** 已 expanded 寫明 architectural debt + remediation spec + deadline (Phase 2 period)
  - **Known-fail registry** `audit/known-fail-registry.md` entry 已立：`circles-gate-warn-icon-color.spec.js` AC-3 deferred
  - **Commit message rule** (per Q2 fix): 本 Wave 任何 commit 含 D-11 change 必含 `known-skip: AC-3 (O-13 backlog)` 字串
- **A.2 8 Wave 1 補洞優先**（user message）
- **A.3 然後 Phase 1 並行**（P1-#257 F-007 + F-001 Trophy）
- **A.4 須先讀完 RITUAL + 15 skill** ✓ done
- **A.5 整合到實作計畫** ✓ §B/§C

---

## §B Skill 融入 map — Wave 1 補洞 8 項 (v4 補 Q3/Q4/Q5/Q8 gap)

| 補洞 # | Task | 用到的 skill | 怎麼用（Q3 verification gate 加） |
|---|---|---|---|
| W1-補.1 | #3 補 Playwright e2e (sub-agent 後台) | **TDD** RED→GREEN / **dispatching-parallel-agents** 1 focused / **verification-before-completion** 5-step | Sub-agent 後台跑中。Director 收回時必跑 5 step cross-check (per STANDING `feedback_subagent_self_report_unverifiable`)：(1) `find spec-path` (2) `grep Skills applied` (3) `git ls-files --error-unmatch` (4) `git diff --cached production-file` (5) 1x sanity run |
| W1-補.2 | #5 layer(b) full-flow real OpenAI | **systematic-debugging** Phase 1 evidence / **verification-before-completion** | Director 親跑 1x baseline，截 log，no self-confirm。Cross-Read terminal output: pass/total numbers + duration + any flake signal |
| W1-補.3 | D-11 (路徑 B 已選) | **systematic-debugging** 3-fix architecture question = O-13 architectural debt | Tracker §6 O-13 expanded ✓；known-fail registry 立 ✓；本 Wave skip + commit message known-skip 字串 |
| W1-補.4 | Cross-plan smoke 5x | **verification-before-completion** Iron Law + RITUAL §3.18 5x consecutive 0 flake | Director 親跑 critical specs × 5 run；逐 run terminal 報 pass/total + any flake signal；fresh verification 不重用前次 cache |
| W1-補.5 | iOS Safari 15-item | **systematic-debugging** evidence gathering | Director 對照 staged diff 走 15 item checklist (focus/sticky/modal/SSE/scroll/font-size/safe-area/tap-highlight 等)；每 item 標 ✓/❌/N/A + 證據 |
| **W1-補.6** | 5 task × 2-stage reviewer (Q4 clarified per task spec PASS 才 quality) | **requesting-code-review** + **receiving-code-review** + **subagent-driven-development** spec→quality 順序 per task | **跨 5 task 並行**派 5 個 spec-reviewer subagent (model=opus)；每 task 內**spec PASS 才再派 quality-reviewer** for that task (per subagent-driven-development SKILL.md line 249 — start code quality review **AFTER** spec compliance ✅)。Director 不可 performative agree。**Director 收 reviewer report 必 5 步 cross-check** (Q3 verification gate)：reviewer 引用 commit SHA 真存在 + Read 該 commit 5 個 file 對齊 reviewer claim + grep `--update-snapshots` 在 sub-agent commit + reviewer 4 staging hygiene checklist 跑過 + reviewer 7 anti-pattern checklist 跑過 |
| W1-補.7 | Wave 2 #4 F-CT1.4 NSM gate i18n | **TDD** RED→GREEN / **dispatching-parallel-agents** focused / **brainstorming** HARD-GATE 但 user pre-approved | 等 Wave 1 #2/#5 stage 完才動 (avoid app.js race)。新 1 sonnet dispatch with full prompt (含 7 ABSOLUTE PROHIBITIONS verbatim + 5-step cross-check)。**5x consecutive 0 flake** 才算 GREEN (Q8 gap fix per RITUAL §3.18)。Director 收回後跑 acceptance test + cold-Read green log (Q3 verification gate) |
| W1-補.8 | B13 finding log tracker | **find-first STANDING** + tracker §3 P1/P2 append | Director 寫 tracker entry。**Append 後 git diff 自驗格式對齊 §3 規約** (Q3 verification gate)：entry has severity / source / repro / suggested fix scope / cross-ref；不擅自改 prompt |

---

## §C Skill 融入 map — Phase 1 P1 並行 (v4 補 Q6 brainstorming 9-step)

### P1.1 F-007 wave ~65 specs

**Skill 應用流程** (per brainstorming SKILL.md line 22-32 9-step checklist + writing-plans + subagent-driven-development + using-git-worktrees):

| Step | 動作 | 對齊 skill |
|---|---|---|
| 1 | Explore project context | brainstorming step 1 — Director read 65 specs file list, recent commits on these specs, related findings tracker |
| 2 | (Visual companion) — N/A (純 spec refactor 無視覺) | brainstorming step 2 skip |
| 3 | Ask clarifying questions (one at a time) | brainstorming step 3 — ask user: batch size? acceptance criteria per spec? known flaky? |
| 4 | Propose 2-3 approaches | brainstorming step 4 — Approach A: 5-7 batch × 3 lane (recommended) / Approach B: 1 mega batch (worst — review queue overflow) / Approach C: 1 spec at a time (slowest) |
| 5 | Present design | brainstorming step 5 — Director write design sections (architecture / batch boundaries / convergence criteria) — get user approval per section |
| 6 | Write design doc | brainstorming step 6 — `docs/superpowers/specs/2026-05-18-f007-wave-A-design.md` |
| 7 | Spec self-review | brainstorming step 7 — placeholder scan / consistency / scope / ambiguity |
| 8 | User reviews written spec | brainstorming step 8 — **HARD-GATE** — wait for user 「對」 before invoke writing-plans |
| 9 | Invoke writing-plans | brainstorming step 9 — write `docs/superpowers/plans/2026-05-18-f007-wave-A.md` per writing-plans SKILL (bite-sized 2-5 min steps, exact paths, complete code, frequent commits) |
| 10 | using-git-worktrees REQUIRED 隔離 | per subagent-driven-development SKILL.md line 268 — Set up isolated workspace BEFORE starting |
| 11 | subagent-driven 派每 spec 1 sonnet + 2-stage review per spec | per subagent-driven-development SKILL — fresh subagent per task + spec→quality review |
| 12 | finishing-a-development-branch | 4 options (merge/PR/keep/discard); solo workflow = merge 直推 main (per STANDING `feedback_push_directly_to_main` carve-out) |

### P1.2 F-001 Trophy +30 API specs

同 P1.1 9-step + 11-12 後續 — Director 先盤點 E2E specs 哪些可降為 API tier (~30-40 candidates per tracker §2)。

---

## §D 並行紀律 (v4 補 Q5 carve-out)

- W1-補 並行 (本 round)：
  - W1-補.1 sub-agent 後台 (1)
  - 同時 Director 跑：W1-補.2 + W1-補.4 + W1-補.5 (序列 by Director — Director 自己不算並行 quota)
  - W1-補.6 **跨 5 task 並行 spec-reviewer = 5 subagent** ← **在 user override 5 上限內，per `feedback_parallel_subagent_default` user 立 max=5；不需再升 quiz** (Q5 carve-out 明寫)
  - W1-補.7 Wave 2 等前面完
  - W1-補.8 Director 序列
- Phase 1 並行 P1.1 + P1.2 = 2 並行 brainstorm round（< 3 不需大 quiz）；但 P1.1 step 11 subagent-driven 派每 spec 可達 5-7 batch × 3 lane = **同時 >5 subagent**，**那批次必派 quiz reviewer per STANDING** `feedback_director_self_confirm_forbidden`

---

## §E File conflict map (v4 補 Q9 main vs worktree dual track)

| File | Wave 1 補洞 影響 | Phase 1 影響 |
|---|---|---|
| `public/app.js` | 已 staged on **main** (per STANDING `feedback_push_directly_to_main` solo workflow carve-out) | P1.1 不動 production；**worktree 隔離** per subagent-driven-development SKILL.md line 240 |
| `prompts/circles-gate.js` | 已 staged on **main** (#3) | P1.1 不動 |
| `tests/adversarial/` | W1-補.1 sub-agent on **main** | 不動 |
| `tests/e2e/` | W1-補.1 sub-agent + W1-補.7 新 spec on **main** | P1.1 改 ~65 既有 spec — **worktree 隔離 REQUIRED** |
| `tests/api/` | 無 | P1.1 新 real API spec — worktree |
| `tests/visual/` | W1-補.6 reviewer 不動 | 不動 |
| `audit/` | W1-補.8 + Wave 1 findings consolidation — main | P1.1 batch findings — main (兩 track 同 audit dir 不衝突) |
| `tracker.md` | Director consolidate post-Wave 1 on **main** | P1.1 batch ship → tracker §5 移 on **main** |

**Carve-out 規則**:
- **Wave 1 main 直推** carve-out per STANDING `feedback_push_directly_to_main` (user solo workflow，hook 擋 push 也手動繼續)
- **Phase 1 worktree 隔離** per subagent-driven-development SKILL — 大量並行 subagent + 跨 spec 改動，main 直推會 conflict
- **規則不矛盾**：Wave 1 = 小 staged batch 集中 ship；Phase 1 = 大量 spec refactor 用 worktree

---

## §F Iron Laws 自確 (per RITUAL §2 + verification-before-completion)

- **IL-1 root cause**：D-11 走路徑 B = 認 architecture debt (per systematic-debugging 3-fix rule + tracker §6 O-13 + known-fail registry)；不 hide symptom ✓
- **IL-2 verification**：每 task 完成 Director 必跑 fresh verification + cold-Read 證據；sub-agent 自報不算數 (Q3 補：W1-補.6/7/8 都加 5 step gate)
- **IL-3 TDD**：每 fix（W1-補.7 / Phase 1 spec）必先寫 RED → log fail → 寫 code → log green；W1-補.7 **5x consecutive 0 flake** (Q8 補)

---

## §G Live demo gate per commit

per `feedback_live_demo_gate_protocol`:
- Wave 1 補洞完 → 整批 stage + Director cold-Read + sound ping → user「對」→ commit + push
- Commit message 含 `known-skip: circles-gate-warn-icon-color AC-3 (O-13 backlog)` (Q2 fix)
- Phase 1 每 batch ship → 同流程

---

## §H Known anti-pattern from this session (本 v4 已防範)

- ❌ Sub-agent `--update-snapshots` from production → STANDING enforced + permission 擋 (Bug B / D-11 案例) → **本 v4 W1-補.3 走 path B + O-13 tracker + known-fail registry**
- ❌ Director self-confirm「✓ all」→ STANDING `feedback_director_self_confirm_forbidden` → **本 v4 必派 quiz reviewer round 2 過關才動**
- ❌ Sub-agent self-report DONE 不 cross-check → STANDING → **本 v4 W1-補.1/6/7 都加 5 step gate**
- ❌ 2-stage review 跳過 → STANDING → **本 v4 W1-補.6 跨 5 task 並行 spec-reviewer + 每 task spec PASS 才 quality**
- ❌ TDD baseline self-referential → **本 v4 D-11 案例認 architectural debt + 路徑 B + O-13 spec 寫明 mockup-source rebuild deadline**

---

## §I 對 quiz round 1 feedback 處置 (per receiving-code-review — 不 performative agree)

| Quiz Q | Verdict | 處置 |
|---|---|---|
| Q1 D-11 architectural decision link | PASS reservation | **FIXED** §A.1 補 audit trail link (user 「b」 + cheat-sheet v3 line 11 + tracker §6 O-13 expanded + known-fail registry entry) |
| Q2 TDD baseline drift | **FAIL** | **FIXED** §A.1 + §G commit-message rule + tracker §6 O-13 + known-fail registry (3 件全補) |
| Q3 verification 5-step gap | PASS gaps | **FIXED** §B W1-補.6/7/8 都加 verification step |
| Q4 spec→quality ambiguity | PASS ambiguous | **FIXED** §B W1-補.6 明寫「跨 5 task 並行 spec；每 task spec PASS 才派 quality」 |
| Q5 5 reviewer carve-out | PASS | **FIXED** §D 明寫「user override 5 上限內」 |
| Q6 brainstorming 9-step | PASS micro-gap | **FIXED** §C 列全 12 step (9 brainstorming + 3 後續 worktree/subagent-driven/finishing) |
| Q7 receiving-code-review | NOT TESTABLE | **DEMONSTRATED** 本 §I 即 technical response（no "Thanks!" / no "Right!"），逐 Q 處置標 FIXED/DEFERRED/PUSHED-BACK |
| Q8 5x consecutive | PARTIAL | **FIXED** §B W1-補.7 補「5x consecutive 0 flake」 |
| Q9 main vs worktree | PASS | **FIXED** §E carve-out rules 寫明 |

---

## §J Director 自確 7 條 (per RITUAL §13) — 等 quiz round 2 verify (禁自確 ✓)

- 首要綱領 e2e integration test mandate ✓ (per §F IL-3)
- IL-1/2/3 ✓ (per §F)
- Pitfall 11/14/18/19/3 ✓ (per §B 各 task 引用)
- Karpathy 4 條 ✓ (per §C/§B implicit, dispatch prompt 必 prepend)
- 並行 5 上限 + opus/sonnet 分工 ✓ (per §D)
- Master tracker §1-§5 conventions ✓ (per §E + W1-補.8)
- User 殺手鐧 5 問 ✓ (per §B Q3 verification gate 涵蓋 Q3 mockup pixel-diff + Q4 skill cite + Q5 action→DB→reload→visible)
