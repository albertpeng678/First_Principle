# Phase A Prep — GAP-1 / GAP-4 / GAP-5 / GAP-7 Mitigation Plan

> **Purpose**: Close the 4 remaining Critical gaps caught by Wave 2 quiz reviewer (GAP-2/3/6 already covered by parallel prep agents: mockup, AppState atomic commit, 4 user-visible-behavior alignment).
> **Scope**: RESEARCH ONLY — produce schedule + template skeletons. NO production code touched. NO git commits.
> **Cite**:
> - `docs/SESSION-START-RITUAL.md` §6 ship checklist, §7.3 並行上限 3, §7.4 2-stage review
> - memory `feedback_subagent_self_report_unverifiable.md` STANDING
> - memory `feedback_two_stage_review_caught_critical.md` STANDING
> - memory `feedback_live_demo_gate_protocol.md` STANDING
> - memory `feedback_find_first_fix_later_via_tracker.md` STANDING
>
> **Karpathy guardrails** (per `feedback_karpathy_guidelines_standard`):
> - §4.1 Think Before — schedule must explicitly enumerate which line ranges of `public/app.js` collide between C-1/C-2/C-3/C-4 BEFORE deciding parallel pairs.
> - §4.2 Simplicity First — recommend the LEAST coordination overhead schedule that still preserves RITUAL §7.3 cap of 3 parallel.
> - §4.3 Surgical Changes — templates are minimal scaffolds for implementer to fill; do NOT pre-fill speculative content.
> - §4.4 Goal-Driven — each gap has 1 testable closure criterion that Director re-verifies before re-quiz.

---

## §A GAP-1 Mitigation — Parallel cap (4 implementer → max 3 active)

### A.1 Quiz finding restated

Wave 2 dispatch plan proposed 4 implementers in parallel (C-1 / C-2 / C-3 / C-4), violating RITUAL §7.3 which caps concurrent sub-agents at 3. Reviewer recommended splitting into Wave 2a (C-1 + C-2) and Wave 2b (C-3 + C-4).

### A.2 Concurrency analysis — can C-1 + C-2 truly co-exist on `public/app.js`?

Both commits edit `public/app.js`. Line-range overlap audit (sourced from §1 of each plan):

| Commit | `public/app.js` line ranges touched |
|---|---|
| **C-1** | **141** (AppState — covered by Phase A prep) · **1973-2110** (submit handler) · **1977-1992** (inline `ensureNsmSession` delete) · **2148** (`triggerNsmSaveCycle` PATCH) · **3137-3147** (`renderResumeToast`) · **4220-4224** (`closeNSMStep2HintModal`) · **6206-6224** (`nsmPickDisplayed` random select) |
| **C-2** | **6457-6464** (qcard click after Bug-A reset) · **8547-8620** (NSM history restore branch) |
| **C-3** | **343-352** (renderView NSM branch) · **~3256** (new helper insertion AFTER `resetCirclesToHome`) · **2651-2663 + 2666-2684** (retry/giveup reset sites) · **3767-3805** (`renderSaveIndicator`) · **6110-6113** (3rd reset site) · **6457-6464** (4th reset site — **COLLIDES with C-2**) · **8587** (history fetch path — **OVERLAPS C-2's 8547-8620 region**) |
| **C-4** | **74** (AppState — covered by Phase A prep) · **~5550** (`loadHistoryForRail` neighbor insert) · **6297-6299** (`renderNSMRecentRail` stub replacement) · **8697** (`_doOffcanvasDelete`) |

**Conflict matrix**:

| Pair | Same line ranges? | Collision type | Verdict |
|---|---|---|---|
| C-1 ↔ C-2 | None | — | **SAFE to run parallel** |
| C-1 ↔ C-3 | None directly (C-1 line 1977-1992 deletes `ensureNsmSession` inline; C-3 does helper extraction elsewhere ~3256) | none | SAFE in isolation but C-3's helper enumerates new keys from C-1 (`nsmGateInflight`) — **semantic dep** |
| C-1 ↔ C-4 | None | — | SAFE |
| C-2 ↔ C-3 | **YES — 6457-6464 (qcard reset) AND ~8547-8620 history restore branch** | **HARD — same lines edited** | **MUST serialize** |
| C-2 ↔ C-4 | None | — | SAFE |
| C-3 ↔ C-4 | None | — | SAFE |

**Conclusion**: only C-2 ↔ C-3 has a true line-range collision. All other pairs are concurrency-safe (modulo semantic dependencies on Phase A prep keys).

### A.3 Recommended sequence (3-slot cap honored)

**Phase A (already planned)** — Atomic prep commit ships 4 new AppState keys + mockup updates + 4 user-flow alignment (handled by 3 separate parallel agents in current session prep).

**Wave 2a — C-1 + C-2 parallel (~30 min implementer time)**
- Slot 1: C-1 implementer (sonnet 4.6) — 6 surgical fixes spread across 7 line regions
- Slot 2: C-2 implementer (sonnet 4.6) — P0 localStorage data-loss fix in 2 regions
- Slot 3: **Director reserve** — used by spec-compliance reviewer at end of 2a, NOT a 3rd implementer (RITUAL §7.3 cap)

**Wave 2a gate** — both commits land + 2-stage review × 2 commits + HITL gate (~user 2 min) + cross-spec smoke. THEN unlock Wave 2b.

**Wave 2b — C-3 + C-4 parallel (~30 min implementer time)**
- Slot 1: C-3 implementer (sonnet 4.6) — refactor commit; safe because C-2's edits to line 6457-6464 and 8547-8620 already landed; C-3 rebases and absorbs.
- Slot 2: C-4 implementer (sonnet 4.6) — functional gap commit
- Slot 3: **Director reserve** — same as Wave 2a

**Wave 2b gate** — same as Wave 2a.

### A.4 Why C-3 / C-4 must follow Wave 2a (not just C-3)

- **C-3 ↔ C-2 conflict** is the binding constraint. C-3 reads C-2's already-applied diff at line 6457-6464 (qcard click block) and 8547-8620 (history restore) to safely apply its 4-site reset refactor + D-8 spinner branch. If C-2 had not yet landed, C-3 would either (a) duplicate the localStorage merge logic accidentally OR (b) overwrite C-2's pending merge block.
- **C-4 has no direct conflict** with C-3 but bundling it with Wave 2b serializes naturally: C-4 depends on `nsmRecentSessions` key from Phase A prep (already landed) and `_doOffcanvasDelete` invalidation (line 8697 — far from anything C-3 touches). Wave 2b grouping = pure scheduling convenience to keep slot 3 free for review.
- **Wave 2b implementers MUST rebase on main after Wave 2a ships** (not on Wave 2a's pre-merge branch). Mandatory in dispatch prompt template §C.

### A.5 RITUAL §7.3 compliance verdict

| Metric | Original plan | Mitigated plan |
|---|---|---|
| Peak parallel implementer slots | 4 | 2 |
| Peak parallel reviewer slots | 4 (post-implementer) | 2 (post-implementer) |
| Total slot peak | 8 | 3 (2 impl + 1 reserve) |
| RITUAL §7.3 cap (3) | **VIOLATED** | **HONORED** |

---

## §B GAP-4 Mitigation — HITL cadence (4 × 4 stage cognitive load)

### B.1 Quiz finding restated

Original Wave 2 plan: 4 commits × 4 review stages each (spec compliance + code quality + HITL + cross-spec smoke) = 16 review interactions. Reviewer flagged this exceeds reasonable user cognitive load per session.

### B.2 Decomposed cost analysis

Per `feedback_two_stage_review_caught_critical` STANDING, each commit requires:
- Stage 1: spec-compliance reviewer (~5 min sonnet auto + 0 min user)
- Stage 2: code-quality reviewer (~5 min sonnet auto + 0 min user)
- Stage 3: HITL (Director cold-Read PNG + user 「對」 — ~1 min user attention per commit)
- Stage 4: cross-spec smoke (~3 min auto + 0 min user)

**User-attention total**: 4 commits × 1 min HITL = **4 min total over Wave 2**.

This is acceptable in absolute terms BUT only if not bursty. Reviewer's concern: 4 simultaneous HITL pings risks user context-switch overload.

### B.3 Cadence solution — serialize HITL, parallelize compute

**Time-lapse schedule** (~90 min total Wave 2 wall clock):

```
T+0     Director dispatches Wave 2a (C-1 impl + C-2 impl in parallel)
T+30    Both implementers report DONE (5x consecutive GREEN claims)
T+30    Director cross-check (git ls-files + diff cached + reverify run) — ~5 min
T+35    Stage 1 + Stage 2 reviewers dispatched in parallel for both commits (4 reviewers in 2 commit batches)
         — Slot allocation: 2 reviewers × 2 commits = 4 reviewer slots peak, EXCEEDS RITUAL §7.3 cap of 3
         — MITIGATION: dispatch reviewers serially per commit (C-1 reviewers first 10 min, then C-2 reviewers 10 min) → peak 2 slots
T+55    Both commits reviewed (all 4 reviewers PASS) — Director synthesizes findings
T+57    HITL ping 1 of 2: user shown C-1 diff summary + jest GREEN + (optional PNG) → user 「對」 → commit C-1
T+58    HITL ping 2 of 2: user shown C-2 diff summary + jest GREEN + (optional PNG) → user 「對」 → commit C-2
T+60    Cross-spec smoke (jest full + 2 e2e specs) — Wave 2a CLOSED
T+62    Director dispatches Wave 2b (C-3 impl + C-4 impl in parallel)
T+90    Symmetric to Wave 2a — 2 HITL pings at T+88/T+89, commits land, smoke, CLOSE
```

**User-attention bursts**:
- T+57 + T+58: 2 HITL pings ~1 min apart (acceptable — same context, same Director, same session)
- T+88 + T+89: same pattern for Wave 2b
- Total: 4 HITL events spread across ~90 min, 2 events × 2 clusters, each cluster ~2 min.

### B.4 Slot-cap reconciliation (reviewer phase)

RITUAL §7.3 cap of 3 means 4 parallel reviewers (2 per commit × 2 commits) is over-quota. Two mitigations:

1. **Serial reviewer dispatch per commit** (recommended): C-1's 2 reviewers run first (10 min), C-2's 2 reviewers run second (10 min). Peak = 2 slots. Total = 20 min. (Used in B.3 schedule.)
2. **Alternative — parallel within a single commit, serial across commits**: dispatch C-1 spec + C-1 quality in parallel (2 slots, 5 min), then C-2 spec + C-2 quality (2 slots, 5 min). Peak = 2 slots, total = 10 min. ALSO compliant but tighter scheduling.

Both compliant. Plan adopts option 2 (faster wall-clock).

### B.5 Final cadence checklist (per Wave)

- [ ] **Implementer dispatch (T+0)**: 2 parallel slots, Director monitors
- [ ] **Implementer DONE claims (T+~30)**: Director runs cross-check (per `feedback_subagent_self_report_unverifiable`)
- [ ] **Stage 1+2 reviewers commit N=1 (T+~35)**: 2 parallel reviewers, ~5 min
- [ ] **Stage 1+2 reviewers commit N=2 (T+~40)**: 2 parallel reviewers, ~5 min
- [ ] **HITL gate clusters (T+~50)**: afplay ping + 2 sequential user 「對」 confirmations, ~2 min user attention
- [ ] **Commits land** (T+~52): use Phase A prep atomic commit pattern (no force-push, no rebase --interactive)
- [ ] **Cross-spec smoke (T+~55)**: jest full + 2 e2e specs, log to tracker §5
- [ ] **Wave gate close (T+~60)**: re-quiz reviewer confirms Wave gate criteria met before next Wave dispatched

---

## §C GAP-5 Mitigation — Dispatch prompt template (anti-fake)

### C.1 Quiz finding restated

`feedback_subagent_self_report_unverifiable.md` STANDING was not yet codified into a reusable dispatch prompt template. Implementers in past sessions reported DONE without Director-verifiable evidence (1 case: B13 sub-agent claimed DONE in background while writing to a worktree never merged → main repo had 0 production changes; case logged in `feedback_subagent_self_report_unverifiable`).

### C.2 Solution

Produce **one canonical template** under `audit/wave-2-implementer-dispatch-prompt-template.md` that every Wave 2 implementer dispatch MUST inline-copy and fill. Template enforces:

1. **Read-only header section** — fixed text quoting STANDING memories + Karpathy §4.1-§4.4 + IL-1/2/3 + RITUAL §3.18.
2. **Required-evidence block** — implementer must paste 5x consecutive jest/playwright stdout (full tail 15 lines per run, NOT truncated/summarized).
3. **Director cross-check warning** — explicit text: "self-report DONE without these artifacts = auto-退件; Director will re-run all 5x in cold context."
4. **Cherry-pick prohibition** — explicit text: "do NOT discard a flaky run and try again until 5 pass; root-cause flakes per `playwright-skill/core/flaky-tests.md`."
5. **Stage verification** — implementer must `git diff --cached` paste + `git ls-files --error-unmatch <path>` for every NEW spec file.
6. **Forbid `Task` tool monitoring** — use bash directly (per 4 sessions where `Task` tool timed out silently).
7. **7 anti-pattern self-check** — exhaustive list to grep against before claiming DONE.

Template draft → `audit/wave-2-implementer-dispatch-prompt-template.md` (see separate file).

---

## §D GAP-7 Mitigation — Eyeball walk doc per commit

### D.1 Quiz finding restated

RITUAL §6 ship checklist requires `audit/eyeball-{name}.md` per commit. The 4 c-drift plans cite this requirement but **do NOT pre-provision the actual file paths**. Implementers would have to invent file names ad hoc, risking inconsistency + scope drift.

### D.2 Solution

Produce **4 template files** matching the per-commit pattern used in past Waves (`audit/eyeball-bundle-N.md`):

- `audit/eyeball-c-drift-1-template.md`
- `audit/eyeball-c-drift-2-template.md`
- `audit/eyeball-c-drift-3-template.md`
- `audit/eyeball-c-drift-4-template.md`

Each template enforces RITUAL §6:
- 3 viewport × N state PNG path (one row per behavior in commit scope)
- Director cold-Read 每張 ≥ 1 句評論 (placeholder line per row)
- User UAT SOP step-by-step (numbered list, copy-paste-ready URL + actions)
- Mockup ↔ production pixel-diff path (relative path to `tests/visual/diffs/` artifact)
- User 親 walk verification 結果 (signoff line: 「user 「對」 @ <timestamp>」 or 「待 user」)

Template draft → see 4 separate files.

### D.3 Why not 1 unified template

Each c-drift commit has different surface area:
- C-1: 6 fixes across 4 distinct user-visible behaviors (resume toast, mutex double-click, hint abort, random pick) — needs 4 behavior rows
- C-2: 1 P0 behavior (localStorage data persistence) — needs 1 behavior row but heavy invariant section
- C-3: 3 fixes (helper refactor invisible, spinner gate, save indicator) — needs 2 behavior rows + 1 "no regression" row
- C-4: 1 visible behavior (NSM recent rail) + 1 invisible (cache invalidation) — needs 1 behavior row + 1 invariant row

Per-commit template lets implementer pre-think coverage; unified template would either over-prescribe or under-prescribe.

---

## §E Closure criteria — Director re-verifies before re-quiz

Each GAP gets 1 testable closure question. Director asks themselves before requesting re-quiz:

| GAP | Closure question | Pass evidence |
|---|---|---|
| GAP-1 | Did Wave 2a + Wave 2b schedule honor RITUAL §7.3 (≤3 parallel slots)? | §A.5 table: peak = 3 |
| GAP-4 | Did HITL cadence schedule keep user-attention bursts ≤ 2 min? | §B.3 schedule + §B.5 checklist |
| GAP-5 | Does `audit/wave-2-implementer-dispatch-prompt-template.md` exist with 7 required sections? | `ls -la` shows file; spot-check 7 sections present |
| GAP-7 | Do all 4 `audit/eyeball-c-drift-{1,2,3,4}-template.md` exist with 5 sections each? | `ls -la` shows 4 files; spot-check 5 sections each |

All 4 PASS → submit to re-quiz reviewer (separate Opus 4.7 sub-agent) for Wave 2 dispatch readiness PASS/FAIL verdict.

---

## §F Summary of produced artifacts

1. `audit/phase-a-prep-gaps-1-4-5-7-mitigation.md` (this doc) — 1 plan
2. `audit/wave-2-implementer-dispatch-prompt-template.md` — 1 template for GAP-5
3. `audit/eyeball-c-drift-1-template.md` — 1 template for GAP-7 (C-1)
4. `audit/eyeball-c-drift-2-template.md` — 1 template for GAP-7 (C-2)
5. `audit/eyeball-c-drift-3-template.md` — 1 template for GAP-7 (C-3)
6. `audit/eyeball-c-drift-4-template.md` — 1 template for GAP-7 (C-4)

**Total**: 1 plan doc + 5 template docs = 6 artifacts.

**Pre-re-quiz verdict**: with these 6 artifacts in place, GAP-1/4/5/7 mitigations are **plan-actionable** (templates ready for Wave 2 implementers to fill; schedule respects RITUAL §7.3; HITL cadence avoids cognitive overload). Re-quiz reviewer should validate the §A schedule explicitly + spot-check 5 templates exist + confirm closure criteria §E table.
