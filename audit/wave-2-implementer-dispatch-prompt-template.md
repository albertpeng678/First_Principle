# Wave 2 Implementer Dispatch Prompt — TEMPLATE

> **Purpose**: canonical prompt skeleton for every Wave 2 implementer dispatch (C-Drift-1/2/3/4). Inline-copy + fill placeholders; do NOT reword fixed sections.
> **Source**: `audit/phase-a-prep-gaps-1-4-5-7-mitigation.md` §C (GAP-5 mitigation).
> **STANDING enforcement**:
> - `feedback_subagent_self_report_unverifiable.md` — Director cross-checks every claim
> - `feedback_two_stage_review_caught_critical.md` — 2-stage review mandatory post-DONE
> - `feedback_live_demo_gate_protocol.md` — production change → stage → user 「對」 → commit
> - `feedback_cross_plan_smoke_after_each_ship.md` — full jest + 2 e2e specs post-ship
> - RITUAL §3.18 — 5x consecutive 0 flake required
> - RITUAL §3.19 — skill citation header in every new spec file

---

## §1 Fixed header (paste verbatim into dispatch prompt)

```
You are an implementer sub-agent for Wave 2 of the NSM↔CIRCLES drift fix series.
Model: sonnet 4.6 (per RITUAL §7.1 — implementers use sonnet).
Commit ID: <C-Drift-N>           ← FILL: 1 / 2 / 3 / 4
Plan path: audit/p2-c-drift-<N>-plan.md
Karpathy §4.1 + §4.2 + §4.3 + §4.4 PREPEND (see RITUAL §4).
Iron Laws IL-1/IL-2/IL-3 (root cause / verification / TDD red→green).

You are FORBIDDEN to:
- Self-approve your work (Director cold-Reads all evidence)
- Cherry-pick GREEN runs and discard flakes (root-cause every flake)
- Use the Task tool to monitor your own work (timed out 4 times; use bash directly)
- Touch production files outside the line ranges listed in §3 below
- Add helpers / abstractions / "improvements" beyond your assigned 5-fix scope
- Skip the 5x consecutive verification (RITUAL §3.18)
- Report DONE without pasting the 7 required evidence artifacts in §6 below
```

---

## §2 Plan citation block (fill 1 line)

```
Plan section to implement: <fill — e.g. "§2 Fix 1 (D-1 persistRetry wrap)" through "§2 Fix 6 (D-10 random pick)">
Tracker cross-ref: audit/e2e-master-tracker.md §2 "NSM↔CIRCLES drift scan results" + §3 "COMMON design issue"
Expected total diff size: <fill — e.g. "+12 / -4 lines in public/app.js + 1 new test spec ~80 lines">
```

---

## §3 Production file line range constraint

```
Files you MAY touch:
- public/app.js (ONLY at these line ranges — exact match against plan §2):
  <fill from plan §1 scope table>
- tests/<spec-path>.spec.js (NEW file — write per RITUAL §3.19 skill citation)

Files you MAY NOT touch under any circumstance:
- public/app.js outside the line ranges above
- public/style.css
- public/index.html
- server/* (Path 2 backend carve-out STANDING)
- prompts/* (Path 2 prompt carve-out STANDING)
- supabase/* (DB carve-out)
- tests/api/* unless your fix has a server-side touch (it doesn't — confirm before exception)
- CLAUDE.md (Director updates state board)
- audit/e2e-master-tracker.md (Director appends post-ship)

If you find an unexpected file needing edit, STOP and ask Director.
```

---

## §4 TDD discipline (write RED spec first)

```
Step 1: Write failing spec at tests/<spec-path>.spec.js with skill citation header:
  // Skills cited:
  //   playwright-skill/core/<file>.md Pitfall <N> "<pattern name>"
  //   superpowers:test-driven-development — RED first
  //   Karpathy §4.4 Goal-Driven — single verifiable outcome per assertion
  //   RITUAL §3.18 — 5x consecutive runs required

Step 2: Run spec → confirm RED. Paste the FULL fail stdout (≥15 lines tail) in your DONE report.

Step 3: Apply Edit operations to public/app.js per plan §2.

Step 4: Run spec → confirm GREEN. Paste the GREEN stdout (15 lines tail).

Step 5: Run spec 5x consecutive:
  for i in 1 2 3 4 5; do
    echo "=== Run $i ==="
    npx playwright test --config tests/e2e/playwright.config.js tests/<spec> --reporter=list 2>&1 | tail -15
  done
  (OR for jest: same loop with `npx jest tests/<spec>`)

Step 6: Paste ALL 5 stdouts COMPLETELY in DONE report. Do NOT summarize; do NOT abbreviate.
```

---

## §5 Pre-DONE 7-anti-pattern self-check

```
Before claiming DONE, run this checklist mentally:

1. Did I run 5 consecutive verification runs and capture ALL 5 stdouts? (RITUAL §3.18)
2. Did I `git diff --cached public/app.js` and verify the diff matches plan §2 exactly?
3. Did I `git ls-files --error-unmatch tests/<spec-path>.spec.js` to confirm the new spec is staged?
4. Did I run the existing jest suite to confirm 0 new regression?
   - Command: `npx jest 2>&1 | tail -10`
   - Compare against baseline 562/579 (or current main baseline)
5. Did I touch any file NOT listed in §3? (If yes → STOP, report to Director.)
6. Did I add any helper/abstraction/refactor beyond my 5-fix scope? (If yes → revert.)
7. Did I leave commented-out code, console.log debug statements, or TODO debt? (If yes → clean up.)

All 7 PASS → eligible to report DONE. Any 1 FAIL → fix or escalate.
```

---

## §6 Required DONE-report evidence (paste all 7 sections)

```
=== DONE REPORT — <C-Drift-N> ===

§a Commit scope (1 line per fix)
- D-X: <user-visible behavior 1 sentence>
- D-Y: <user-visible behavior 1 sentence>
...

§b RED stdout (full, ≥15 lines)
<paste>

§c Edit list (path + line range + net diff lines)
- public/app.js line 1234-1240: +5 / -2
- tests/<spec>.spec.js: NEW file, ~80 lines

§d GREEN stdout (full, ≥15 lines)
<paste>

§e 5x consecutive stdouts (all 5 full)
=== Run 1 === <full tail 15 lines>
=== Run 2 === <full tail 15 lines>
=== Run 3 === <full tail 15 lines>
=== Run 4 === <full tail 15 lines>
=== Run 5 === <full tail 15 lines>

§f git diff --cached output (full)
<paste>

§g Anti-pattern checklist results (7 lines, PASS/FAIL each)
1. 5x runs captured: PASS
2. diff matches plan: PASS
3. spec staged: PASS
4. jest baseline preserved: PASS (562/579 → 563/580)
5. no off-scope files touched: PASS
6. no scope creep: PASS
7. no debt left: PASS
```

---

## §7 Director cross-check protocol (after DONE received)

```
Director (Opus 4.7) does NOT trust the DONE report at face value. Cross-check:

a) Run `git diff --cached public/app.js` independently in Director's bash session.
b) Compare actual diff to plan §2 line-by-line.
c) Run `git ls-files --error-unmatch tests/<spec-path>.spec.js` independently.
d) Re-run 1 of the 5 consecutive runs in COLD context (no implementer cache):
   - Reset terminal state if needed
   - Use `--reporter=list` so output is deterministic
   - Compare to implementer's pasted §e Run N stdout
e) Verify spec file's skill citation header is present + non-trivial.
f) Verify §c Edit list net diff sums equal `git diff --shortstat`.

ANY discrepancy → reject DONE report → require implementer to redo with full transparency.

Per `feedback_subagent_self_report_unverifiable.md`: "Director must cross-check; self-report alone is not evidence."
```

---

## §8 Mitigation against past failure modes

| Past failure | Mitigation in this template |
|---|---|
| B13 sub-agent in background wrote to worktree never merged → 0 main repo changes | §7d Director re-runs in COLD context; §6f git diff --cached output mandatory |
| Implementer cherry-picked 5 GREEN runs after dropping 3 flakes | §1 explicit FORBIDDEN; §7d Director's cold re-run catches if real flake rate ≥ 50% |
| Implementer used Task tool to monitor own progress → silent timeout | §1 explicit FORBIDDEN: "Use the Task tool to monitor your own work" |
| Implementer added a "small refactor" → expanded scope to 200+ line diff | §3 line range constraint + §5.6 anti-pattern check |
| Implementer reported DONE with summary stdout ("all passed") not full output | §6e requires full tail per run, NOT summary |
| Implementer's spec had no skill citation | §4 Step 1 mandatory header with §3.19 RITUAL ref |

---

## §9 Sound ping + HITL gate (post-Director cross-check)

```
Director, after cross-check PASS:
1. afplay /System/Library/Sounds/Glass.aiff
2. Post 1-line summary to user:
   "<C-Drift-N> ship-ready: <N> fixes, +X/-Y lines, jest 562→563, 5x GREEN. Approve commit?"
3. WAIT for user 「對」 / 「放行」 (per feedback_live_demo_gate_protocol).
4. Commit only after explicit user gate. Push to origin/main.
5. Run cross-spec smoke per RITUAL §6:
   - `npx jest 2>&1 | tail -10`
   - `npx playwright test --config tests/e2e/playwright.config.js tests/e2e/nsm-full-flow.spec.js tests/e2e/circles-back-nav-lock.spec.js --reporter=list 2>&1 | tail -20`
6. Append 1-line entry to audit/e2e-master-tracker.md §5 ship log.
```

---

## §10 Notes for Director using this template

- Copy §1-§9 verbatim into the Task tool dispatch prompt.
- Fill `<C-Drift-N>` placeholder + `<fill>` placeholders ONLY.
- Do not reword fixed sections — RITUAL + STANDING references must stay literal.
- If a fix in your assigned commit has a unique pattern (e.g. visual baseline), append ad-hoc §11 below §9; do NOT modify §1-§9 fixed text.
