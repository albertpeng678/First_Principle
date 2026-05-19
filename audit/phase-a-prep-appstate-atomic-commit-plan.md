# Phase A Prep — AppState Atomic Commit Plan

> **Purpose**: Ship a single atomic commit that adds ALL new AppState keys required by Wave 2's 4 parallel commits (C-Drift-1/2/3/4) BEFORE Wave 2 dispatch.
> **Why**: Quiz reviewer caught GAP-3 — 4 Wave 2 commits all mutate `public/app.js` AppState block (line 74 / 120 / 141). Parallel patches on the same lines → guaranteed `git rebase` conflict.
> **Solution**: pre-declare all 4 new keys in main; Wave 2 implementers then touch only logic, never the AppState declaration.
>
> **Karpathy guardrails** (per `feedback_karpathy_guidelines_standard`):
> - §4.1 Think Before — prep keys are inert (declared but un-wired); zero behavioral delta.
> - §4.2 Simplicity First — NO helpers, NO logic, NO render path changes; only literal key additions to AppState object.
> - §4.3 Surgical Changes — exactly +N lines in AppState block, 0 lines elsewhere; jest smoke spec is pure key-presence assertion.
> - §4.4 Goal-Driven — single verifiable outcome: `AppState[k]` returns expected default for each k in {nsmGateInflight, nsmSessionLoading, nsmPhase2SaveState, nsmRecentSessions}.
>
> **Source plans**:
> - `audit/p2-c-drift-1-plan.md` — D-4 introduces `nsmGateInflight`
> - `audit/p2-c-drift-2-plan.md` — reads/writes existing keys only (no new keys)
> - `audit/p2-c-drift-3-plan.md` — D-8 introduces `nsmSessionLoading`; D-11 introduces `nsmPhase2SaveState`
> - `audit/p2-c-drift-4-plan.md` — D-12 introduces `nsmRecentSessions`

---

## §1 New AppState keys needed

| # | Key | Type | Default | Originating commit | Audit ref | Purpose (un-wired in prep; wired in originating commit) |
|---|---|---|---|---|---|---|
| 1 | `nsmGateInflight` | `boolean` | `false` | C-Drift-1 | D-4 (P1) | Step 2 submit mutex; mirrors `gateInflight` (line 141) for CIRCLES |
| 2 | `nsmSessionLoading` | `boolean` | `false` | C-Drift-3 | D-8 (P1) | Loading guard during offcanvas → NSM session restore fetch; mirrors `circlesSessionLoading` (line 120) |
| 3 | `nsmPhase2SaveState` | `string` (enum) | `'idle'` | C-Drift-3 | D-11 (P1) | NSM Step 2 save indicator state ('idle' / 'saving' / 'saved' / 'error'); mirrors `circlesPhase1SaveState` |
| 4 | `nsmRecentSessions` | `null \| Array` | `null` | C-Drift-4 | D-12 (P1 gap) | NSM home recent rail cache (null = not loaded; [] = empty; [...] = items); mirrors `circlesRecentSessions` (line 74) |

**Total**: 4 new keys.

**Invariants** for all 4:
- NOT in `PERSISTED_KEYS` (line 153-162) — all 4 are in-memory only, transient flags.
- NOT mutated outside their originating commit's wiring (prep just declares).
- NOT introduced in `restore()` defaults — `restore()` only repopulates from snapshot.

---

## §2 File diff plan

### File: `public/app.js` (single file edit)

Edits are clustered by mirror-counterpart locality (place each new NSM key directly adjacent to its CIRCLES mirror), keeping the block readable.

**Edit 1 — `nsmRecentSessions`** (mirror CIRCLES line 74)

Insertion point: **after line 74** (`circlesRecentSessions: null, ...`), inside the `// Plan B additions` block.

```js
    circlesRecentSessions: null,        // null = not loaded; [] = empty; [...] = items (SB2)
    nsmRecentSessions: null,            // null = not loaded; [] = empty; [...] = NSM-only items (C-Drift-4 / D-12)
```

Net diff: +1 / -0.

---

**Edit 2 — `nsmSessionLoading`** (mirror CIRCLES line 120)

Insertion point: **after line 120** (`circlesSessionLoading: false,`).

```js
    // R3: loading state for session detail fetch (Option B)
    circlesSessionLoading: false,
    nsmSessionLoading: false,            // loading state for NSM session detail fetch (C-Drift-3 / D-8)
```

Net diff: +1 / -0.

---

**Edit 3 — `nsmGateInflight`** (mirror CIRCLES line 141)

Insertion point: **after line 141** (`gateInflight: false,`), inside the `// B6 mutex` block.

```js
    // B6 mutex — in-memory only, never persisted
    gateInflight: false,
    nsmGateInflight: false,              // NSM Step 2 /gate submit mutex (C-Drift-1 / D-4); in-memory only, never persisted
```

Net diff: +1 / -0.

---

**Edit 4 — `nsmPhase2SaveState`** (mirror CIRCLES `circlesPhase1SaveState`)

Mirror counterpart for `circlesPhase1SaveState` is **NOT** at line 74 / 120 / 141. Need to grep its declaration first. Likely in the `// Plan B SB5 additions` block (lines 61-67) or near. Implementer MUST confirm exact line in pre-edit grep:

```
grep -n "circlesPhase1SaveState" public/app.js | head -5
```

Insertion point: **directly after `circlesPhase1SaveState: ...`** declaration line (TBD by grep — expected ~line 56-67 range).

```js
    circlesPhase1SaveState: 'idle',
    nsmPhase2SaveState: 'idle',          // 'idle' | 'saving' | 'saved' | 'error' (C-Drift-3 / D-11)
```

Net diff: +1 / -0.

---

**Net total**: **+4 / -0 lines** in `public/app.js` AppState block. Zero changes anywhere else in production code.

**Anti-scope creep guardrails**:
- DO NOT touch `PERSISTED_KEYS` array.
- DO NOT touch `persist()` / `restore()`.
- DO NOT add helpers (e.g. no `resetNsmToHome` — that's C-Drift-3 work).
- DO NOT add render-path branches consuming these keys (those wire in their originating commits).
- DO NOT delete or rename existing keys.

**Karpathy §4.3 Surgical Changes audit**: 4 literal-line additions in 1 file, each adjacent to its CIRCLES mirror — meets surgical bar.

---

## §3 TDD spec

### Spec — `tests/appstate-phase-a-prep.test.js` (jest unit, new file)

**Skill citation header** (per RITUAL §3.19):

```js
// Skills cited:
//   superpowers:test-driven-development — RED first (declare expectation before AppState patch lands)
//   playwright-skill/core/common-pitfalls.md Pitfall 18 — N/A (no DOM); pure JS state assertion
//   Karpathy §4.4 Goal-Driven — single verifiable outcome per key
//   RITUAL §3.18 — 5x consecutive runs required pre-commit
//   RITUAL §3.19 — skill citation header (this block)
```

**Loading pattern**: mirror existing `tests/api/*.spec.js` jest files that load `public/app.js` via `vm.createContext` (per C-Drift-3 spec 1 pattern). Implementer must check whether project already has a helper for app.js script loading; reuse if present.

**Test shape** (4 cases, 1 per new key):

```js
describe('Phase A prep — new AppState keys declared inert', () => {
  let AppState;

  beforeAll(() => {
    // load app.js into vm context; capture window.AppState
    AppState = loadAppStateFromScript();  // helper TBD by implementer
  });

  it('declares nsmGateInflight with default false', () => {
    expect(AppState).toHaveProperty('nsmGateInflight');
    expect(AppState.nsmGateInflight).toBe(false);
  });

  it('declares nsmSessionLoading with default false', () => {
    expect(AppState).toHaveProperty('nsmSessionLoading');
    expect(AppState.nsmSessionLoading).toBe(false);
  });

  it('declares nsmPhase2SaveState with default "idle"', () => {
    expect(AppState).toHaveProperty('nsmPhase2SaveState');
    expect(AppState.nsmPhase2SaveState).toBe('idle');
  });

  it('declares nsmRecentSessions with default null', () => {
    expect(AppState).toHaveProperty('nsmRecentSessions');
    expect(AppState.nsmRecentSessions).toBeNull();
  });

  it('does NOT add any of the 4 new keys to PERSISTED_KEYS', () => {
    // Per spec — all 4 are in-memory only.
    const PERSISTED_KEYS = loadPersistedKeysFromScript();
    expect(PERSISTED_KEYS).not.toContain('nsmGateInflight');
    expect(PERSISTED_KEYS).not.toContain('nsmSessionLoading');
    expect(PERSISTED_KEYS).not.toContain('nsmPhase2SaveState');
    expect(PERSISTED_KEYS).not.toContain('nsmRecentSessions');
  });
});
```

**TDD discipline** (per `superpowers:test-driven-development`):
1. Write spec file FIRST → 5 assertions RED (keys undefined).
2. Apply 4 Edit operations to `app.js` per §2.
3. Re-run jest → 5 assertions GREEN.
4. Run 5x consecutive: `for i in 1 2 3 4 5; do npx jest tests/appstate-phase-a-prep.test.js; done` — all 5 GREEN, 0 flake.

**Why jest, not playwright**: pure state assertion; no DOM, no network. Faster + deterministic.

**Existing-test sanity** (cross-spec drift gate per `feedback_cross_plan_smoke_after_each_ship`):
- Run full jest suite: expect 562/579 baseline preserved → 563/580 (+1 new spec, no regression).
- Run `tests/e2e/nsm-full-flow.spec.js` smoke (no behavior delta expected; AppState gets 4 inert keys).

---

## §4 Ship gate

> Per `feedback_two_stage_review_caught_critical` STANDING: every commit gets 2 reviewers.

### Stage 1 — Spec compliance reviewer (sonnet 4.6)

**Prompt skeleton**:
- Read `audit/phase-a-prep-appstate-atomic-commit-plan.md` §1 + §2.
- Read `git diff --cached public/app.js` (or unstaged if not yet staged).
- Verify each of the 4 keys:
  - Name matches §1 column exactly (no typos: `nsmGateInflight` not `nsmGateInFlight`).
  - Default value matches §1 column exactly.
  - Insertion location matches §2 anchor line.
  - Comment text includes commit ref (e.g. `C-Drift-1 / D-4`).
- Verify `PERSISTED_KEYS` unchanged.
- Verify NO logic added beyond the 4 declarations.

**Pass criteria**: 4 keys correct + 0 spec drift.
**Fail action**: list deltas; main agent fixes via Edit, re-runs reviewer.

### Stage 2 — Code quality reviewer (sonnet 4.6)

**Prompt skeleton**:
- Read `git diff --cached public/app.js`.
- Apply Karpathy 4 guardrails:
  - §4.1 Think Before — confirm keys are inert (no consumer code added; grep `public/app.js` for new key names → only declaration matches).
  - §4.2 Simplicity First — no helpers, no abstractions added.
  - §4.3 Surgical Changes — diff is exactly +4 / -0 in `public/app.js`; no formatting drift, no neighboring-line churn.
  - §4.4 Goal-Driven — each key has a clear future-wired purpose documented in comment.
- Check naming consistency (camelCase mirror of CIRCLES counterpart).
- Check no commented-out code, no TODO debt left.

**Pass criteria**: all 4 Karpathy checks PASS.
**Fail action**: list violations; main agent fixes via Edit, re-runs reviewer.

### Stage 3 — HITL (Human-In-The-Loop, Director cold-Read)

> Per `feedback_live_demo_gate_protocol` STANDING: production change → stage → user 親眼對 → commit.

**Director protocol**:
1. Director (Opus 4.7) cold-Reads `git diff --cached public/app.js` (no context from agent reports).
2. Verifies independently: 4 key names + 4 defaults + 4 insertion sites match plan §2.
3. Pings user with `afplay /System/Library/Sounds/Glass.aiff` (per `feedback_sound_ping_on_confirmation`) + 1-line summary:
   > 「Phase A prep: 4 inert AppState key declarations (+4/-0 lines)；jest 5/5 GREEN × 5 consecutive. Approve commit?」
4. Wait for user 「對」/「放行」 (per `feedback_live_demo_gate_protocol`).

**Commit only after user 放行.**

**Live-demo check**: since these keys are inert, NO visible behavior delta. Director skips PNG capture (no UI change). Spec output (jest GREEN log) substitutes for PNG.

### Stage 4 — Cross-plan smoke (post-commit)

Per `feedback_cross_plan_smoke_after_each_ship`:
- `npx jest` full suite → expect 563/580 GREEN.
- `npm run test:e2e -- nsm-full-flow.spec.js circles-back-nav-lock.spec.js` → smoke unchanged.
- Tracker `audit/e2e-master-tracker.md` §5 — append 1-line entry: `Phase A prep ship: 4 AppState keys declared; unblocks Wave 2 4 parallel commits.`

---

## §5 Why atomic separate commit (rationale)

### The conflict scenario without prep commit

If Wave 2 dispatches 4 parallel implementers (C-Drift-1/2/3/4) directly:

- **C-Drift-1 implementer** edits line 141 → adds `nsmGateInflight: false,` after `gateInflight: false,`.
- **C-Drift-3 implementer** edits line 120 → adds `nsmSessionLoading: false,` after `circlesSessionLoading: false,`. ALSO touches the `circlesPhase1SaveState` line to add `nsmPhase2SaveState: 'idle',`.
- **C-Drift-4 implementer** edits line 74 → adds `nsmRecentSessions: null,` after `circlesRecentSessions: null,`.

Each implementer commits on a separate branch (or rebases on stale main). When the second branch merges to main:

1. **Git diff conflict on AppState block** — even though edits are on different lines, git rebase frequently flags adjacent-line conflicts in dense object-literal blocks, especially if any implementer accidentally re-formats whitespace or comment placement.
2. **Semantic conflict** — even if git auto-merges syntactically, the second implementer may have read a stale snapshot (without commit 1's key) → their TDD spec assumes only their key exists → flake when commit 1 lands.
3. **Implementer noise** — implementers writing code-quality-checked spec compliance reports referencing line numbers (e.g. "AppState declaration at line 141") will be off-by-N as each adjacent commit shifts subsequent lines. 4 implementers × ~3 line-number references each = 12 stale references to fix in PR description.
4. **Review confusion** — reviewers comparing each commit's `git diff` will see partially-overlapping AppState block changes, making it hard to verify each commit independently.

### The atomic prep commit solution

After Phase A prep ships to main:

- All 4 new AppState keys exist on main with default values, unwired.
- Wave 2 implementers each rebase on the latest main → AppState block is shared, settled.
- Each implementer touches ONLY logic (their `setNsmGateInflight = true` mutex line, their `setNsmSessionLoading(true)` render guard, etc.) — NEVER the declaration block.
- 4 parallel commits' `git diff` are now **disjoint** (each touches different functions / handlers in app.js, plus their own test specs).
- Merge conflicts collapse to zero (modulo the rare case of two implementers touching the same handler function — escalate to user if found).

### Git operational comparison

| Scenario | AppState block edits | Rebase conflict prob. | Reviewer cost |
|---|---|---|---|
| No prep (4 parallel touch AppState) | 4 implementers each insert 1 key | HIGH (adjacent-line + semantic) | high (cross-commit line-num drift) |
| Prep ships first, 4 parallel logic-only | 1 prep commit inserts all 4; 4 implementers insert 0 | LOW (disjoint handler edits) | low (each commit reviewable in isolation) |

### Cost of the prep commit

- ~30 minutes director time IF HITL goes smooth (spec write 5 min + 4 Edits 5 min + jest write 5 min + 5x flakeproof 5 min + 2 reviewer dispatches 5 min + HITL 1 min + commit 1 min + smoke 3 min).
- Zero risk: keys are inert; rollback = revert single commit; no downstream wiring depends on them yet.

### Why this is NOT premature optimization (Karpathy §4.2 sanity check)

Karpathy §4.2 (Simplicity First) might suggest "just let the 4 commits land, resolve conflicts as they appear." Counter:
- 4 implementers running in parallel CANNOT communicate; they will each declare their key on the assumption that no other commit landed first.
- Conflict resolution post-hoc requires re-running tests on each rebased branch — multiplies wall-clock time and reviewer load.
- The prep commit is a **pre-emptive coordination point** that costs ~30 min and saves ~2-4 hr of conflict-resolution overhead in Wave 2.

Verdict: prep commit is the simpler total-system outcome, even though it adds 1 ceremony commit. Approved.

---

## §6 Implementation sequencing

> Per RITUAL §3.18 + `superpowers:test-driven-development`:

1. **Write TDD spec first** (`tests/appstate-phase-a-prep.test.js`) → RED (5 assertions fail because keys don't exist yet).
2. **Run jest** → confirm 5 RED.
3. **Apply Edit #4 in §2** (need to grep `circlesPhase1SaveState` line first to find insertion point for `nsmPhase2SaveState`).
4. **Apply Edit #1 + #2 + #3** in `public/app.js`.
5. **Run jest** → confirm 5 GREEN.
6. **Run 5x consecutive jest** → all 5 GREEN, 0 flake.
7. **Stage**: `git add public/app.js tests/appstate-phase-a-prep.test.js`.
8. **Stage 1 reviewer** (spec compliance) — pass.
9. **Stage 2 reviewer** (code quality) — pass.
10. **Stage 3 HITL** — `afplay` + 1-line summary → wait for 「對」.
11. **Commit** with message:

```
chore(appstate): Phase A prep — declare 4 AppState keys unblocking Wave 2

Inert pre-declaration of 4 new AppState keys consumed by Wave 2 commits.
All keys default to mirror-CIRCLES safe state; no consumer wiring yet.

- nsmGateInflight: false (C-Drift-1 / D-4 — Step 2 submit mutex)
- nsmSessionLoading: false (C-Drift-3 / D-8 — session restore loading guard)
- nsmPhase2SaveState: 'idle' (C-Drift-3 / D-11 — save indicator state)
- nsmRecentSessions: null (C-Drift-4 / D-12 — NSM home recent rail cache)

Why atomic separate commit: Wave 2's 4 parallel commits would otherwise
each touch the AppState declaration block (lines 74 / 120 / 141 / ~63),
causing adjacent-line rebase conflicts. Prep commit declares all keys
in one shot so Wave 2 implementers only touch handler / render logic.

Tests: tests/appstate-phase-a-prep.test.js (5 assertions × 5 consecutive runs GREEN)

Refs:
- audit/phase-a-prep-appstate-atomic-commit-plan.md (this plan)
- audit/p2-c-drift-1-plan.md §2 Fix 3 (nsmGateInflight)
- audit/p2-c-drift-3-plan.md §2 Fix 2 + Fix 3 (nsmSessionLoading + nsmPhase2SaveState)
- audit/p2-c-drift-4-plan.md §2 Fix 1 (nsmRecentSessions)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

12. **Push** to origin/main (per `feedback_push_directly_to_main`).
13. **Cross-plan smoke** per §4 Stage 4 — append tracker entry.
14. **Notify user** ready to dispatch Wave 2 (4 parallel implementers).

**Expected wall-clock total**: ~30 minutes if HITL approves on first review pass.

---

## §7 Open clarifications for Director (none expected — plan should be ship-ready)

- **None blocking**. Plan is RESEARCH-ONLY per task spec.
- **Grep dependency**: implementer must locate `circlesPhase1SaveState` line for Edit #4 insertion before editing. This is the only line not nailed down to an exact line number in §2.
- **Spec loader helper**: implementer should reuse existing app.js-loading test harness pattern; if none exists, write a minimal `vm.createContext`-based loader inline in the spec file (NOT in a shared helper — Karpathy §4.2 Simplicity First).

---

## §8 Summary

- **New AppState keys**: 4 (`nsmGateInflight`, `nsmSessionLoading`, `nsmPhase2SaveState`, `nsmRecentSessions`)
- **Production diff**: +4 / -0 lines in `public/app.js` (AppState declaration block only)
- **Test diff**: +1 new jest file (~40 lines) with 5 assertions
- **Behavior delta**: ZERO (keys are declared but unwired)
- **Estimated ship time**: ~30 min if HITL approves smoothly
- **Unblocks**: Wave 2's 4 parallel commits (C-Drift-1/2/3/4) with disjoint logic-only edits
- **Karpathy compliance**: §4.1 + §4.2 + §4.3 + §4.4 all PASS
- **2-stage review**: spec-compliance reviewer + code-quality reviewer mandatory
- **HITL**: Director cold-Read git diff + user 「對」 before commit
- **Cross-spec smoke**: jest full + nsm-full-flow + circles-back-nav-lock post-commit
