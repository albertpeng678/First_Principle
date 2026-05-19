# Wave 1 補洞 + Phase 1 P1 並行 — Cheat-Sheet v3

> Director skill-integrated execution plan
> Date: 2026-05-18 PM
> Quiz pending: 等 reviewer 出題評

---

## §A 已 user 決定

- **D-11 baseline 副作用 = 路徑 B**：production 已對齊 mockup（D-11 fix 對的），舊 test baseline self-referential = O-13 backlog；本 Wave 不擋 ship；circles-gate-warn-icon-color AC-3 暫時 skip 或 known-fail
- **8 Wave 1 補洞優先做完**
- **然後 Phase 1 並行**（P1-#257 F-007 + F-001 Trophy）
- 須先讀完 RITUAL + 15 skill 後整合（已讀 ✓ 待 quiz verify）

---

## §B Skill 融入 map — Wave 1 補洞 8 項

| 補洞 # | Task | 用到的 skill | 怎麼用 |
|---|---|---|---|
| W1-補.1 | #3 補 Playwright e2e | **TDD** RED→GREEN / **dispatching-parallel-agents** 1 focused subagent / **verification-before-completion** | Sub-agent 後台跑中 — Director 收回時必 5 步 cross-check（per `feedback_subagent_self_report_unverifiable`）|
| W1-補.2 | #5 layer(b) full-flow real OpenAI | **systematic-debugging** Phase 1 evidence / **verification-before-completion** | Director 親跑 1x baseline，截 log，no self-confirm |
| W1-補.3 | D-11 (路徑 B 已選) | **systematic-debugging** 3-fix architecture question → 認 debt 不修 | Tracker §6 O-13 已 log；本 Wave skip |
| W1-補.4 | Cross-plan smoke 5x | **verification-before-completion** Iron Law + RITUAL §3.18 | Director 親跑：critical specs × 5；逐 run 報 pass/total 數字 |
| W1-補.5 | iOS Safari 15-item | **systematic-debugging** evidence gathering | Director 對照 diff 走 15 條（focus/sticky/modal/SSE/scroll/font-size 等）|
| W1-補.6 | 5 task × 2-stage reviewer | **requesting-code-review** + **receiving-code-review** + **subagent-driven-development** spec→quality 順序 | 並行 dispatch 5 個 reviewer subagent；每 reviewer 必含 4 staging hygiene + 7 anti-pattern checklist（per `feedback_two_stage_review_caught_critical`）；Director 不可 performative agree |
| W1-補.7 | Wave 2 #4 F-CT1.4 NSM gate i18n | **TDD** RED→GREEN / **dispatching-parallel-agents** focused / **brainstorming** HARD-GATE — 但已 user 預先放行 Phase 1B-w table | 等 Wave 1 #2/#5 stage 完才動（避 app.js race）；新 1 sonnet dispatch |
| W1-補.8 | B13 finding log tracker | **find-first STANDING** + tracker §3 P1/P2 append | Director 寫 tracker entry，不擅自改 prompt |

---

## §C Skill 融入 map — Phase 1 P1 並行

| Task | 用到的 skill | 怎麼用 |
|---|---|---|
| **P1.1 F-007 wave ~65 specs** | **brainstorming** scope check（65 specs 需 decompose） / **writing-plans** bite-sized task / **subagent-driven-development** 2-stage review per spec / **using-git-worktrees** REQUIRED 隔離 / **TDD** every spec RED→GREEN | 1. Director 先 brainstorm decompose into batches（5-7 batch × 3 lane）2. 寫 plan to `docs/superpowers/plans/2026-05-18-f007-wave-A.md` 3. user 放行 plan 4. worktree 隔離 5. subagent-driven 派每 spec 1 sonnet + 2-stage review |
| **P1.2 F-001 Trophy +30 API specs** | **brainstorming** identify candidates / **writing-plans** / **TDD** / **subagent-driven-development** / **systematic-debugging** for any spec fail | 1. Director 盤點 E2E specs 哪些可降為 API tier 2. 寫 plan 3. user 放行 4. 並行轉換 5. 完 → tracker §5 sweep |

---

## §D 並行紀律（per dispatching-parallel-agents + RITUAL §7.3 + user override 5）

- W1-補 順序：
  - 同時並行：W1-補.4 cross-plan + W1-補.5 iOS 15-item + W1-補.6 5 reviewer（3 並行 OK 不需 quiz 升級）
  - W1-補.1 sub-agent 後台繼續跑
  - W1-補.2 Director 親跑
  - W1-補.7 Wave 2 等前面完
- Phase 1 並行 P1.1 + P1.2：2 並行（< 3 不需大 quiz），但每 task 內部會再 dispatch 5-7 subagent — 那批次需 quiz reviewer per STANDING

---

## §E File conflict map

| File | Wave 1 補洞 影響 | Phase 1 影響 |
|---|---|---|
| `public/app.js` | 已 staged（#2/#5），不再動 | P1.1 spec refactor 不動 production |
| `prompts/circles-gate.js` | 已 staged（#3） | P1.1 不動 |
| `tests/adversarial/` | W1-補.1 sub-agent | P1.1 不動 |
| `tests/e2e/` | W1-補.1 sub-agent 新 spec + W1-補.7 新 spec | P1.1 改 ~65 既有 spec — 預期大量 file conflict per batch；用 worktree 隔離 |
| `tests/api/` | 無 | P1.1 新增 real API spec |
| `tests/visual/` | W1-補.6 reviewer 不動 | P1.1 不動 |
| `audit/` | W1-補.8 + Wave 1 findings consolidation | P1.1 每 batch findings file |
| `tracker.md` | Director consolidate post-Wave 1 | P1.1 batch ship → tracker §5 移 |

---

## §F Iron Laws 自確（per RITUAL §2 + verification-before-completion）

- **IL-1 root cause**：D-11 走路徑 B = 認 architecture debt 不 hide symptom ✓
- **IL-2 verification**：每 task 完成 Director 必跑 fresh verification + cold-Read 證據；sub-agent 自報不算數
- **IL-3 TDD**：每 fix（W1-補.7 / Phase 1 spec）必先寫 RED → log fail → 寫 code → log green

---

## §G Live demo gate per commit

per `feedback_live_demo_gate_protocol`:
- Wave 1 補洞完 → 整批 stage + Director cold-Read + sound ping → user「對」→ commit + push
- Phase 1 每 batch ship → 同流程

---

## §H Known anti-pattern from this session

- ❌ Sub-agent `--update-snapshots` from production（Bug B / D-11 案例）→ STANDING `feedback_visual_baseline_from_mockup_not_production` 已立，本 Wave 不再犯
- ❌ Director self-confirm「✓ all」→ STANDING `feedback_director_self_confirm_forbidden` 已立，本 Wave 派 quiz reviewer
- ❌ Sub-agent self-report DONE 不 cross-check → STANDING `feedback_subagent_self_report_unverifiable` 已立，5 步 cross-check
- ❌ 2-stage review 跳過 → STANDING `feedback_two_stage_review_caught_critical` 已立，本 Wave W1-補.6 必走

---

## §I 等 quiz reviewer 評
