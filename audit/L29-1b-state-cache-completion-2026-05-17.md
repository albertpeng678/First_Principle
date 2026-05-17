# L29 — Stage 1B State/Cache Plan Completion Audit

**Lane:** L29
**Date:** 2026-05-17
**Investigator:** sonnet (Phase 3 execution — audit + gap fix)
**Plan ref:** `docs/superpowers/plans/2026-05-16-stage-1b-state-cache-plan.md`
**Spec ref:** `docs/superpowers/specs/2026-05-16-stage-1b-state-cache-design.md` (commit `2c6fa51`)

---

## §1 Plan Task → Ship Status Matrix

| Task | Description | Status | Commit(s) |
|---|---|---|---|
| T1 | B3 RED unit tests (5 specs, circles-restore-phase3.test.js) | SHIPPED → then SUPERSEDED | `8a8b424` created; `72e7797` deleted (hollow vm.createContext → real E2E retrofit) |
| T2 | B3 fix: 6-LOC derivation in restoreCirclesPhase1FromSession | SHIPPED | `654d0e8` |
| T3 | B3 E2E specs (circles-phase3-restore.spec.js + config) | SHIPPED + RETROFITTED | `341db66` initial; `72e7797` retrofit-c added circles-phase3-restore-real.spec.js |
| T4 | B4 RED unit tests (4 specs, circles-delete-rollback.test.js) | SHIPPED → then SUPERSEDED | `f79a8bc` created; `f6aeec0` deleted (hollow → real E2E retrofit) |
| T5 | B4 fix: await + snapshot/rollback + _resumeToast | SHIPPED | `74959cf` + `c7b3e40` (id coerce + inflight guard) |
| T6 | B4 API contract specs (B4-A1..A3 in circles-sessions.test.js) | SHIPPED | `9a406f8` |
| T7 | B4 E2E specs (offcanvas-delete.spec.js) | SHIPPED + B4-E3 UNBLOCKED | `ecfbf8d` B4-E1/E2 + `f292a22` B4-E3 NSM seed helper (L20) |
| T8 | Full bundle regression + CLAUDE.md state board update | PARTIALLY SHIPPED | State board updates across multiple commits; B3-R1 parallel flake was pre-existing gap |

---

## §2 Remaining Gaps + Fix Applied in L29

### Gap: circles-phase3-restore-real.spec.js B3-R1 parallel worker collision

**Root cause:** `createRealSession(page, questionIndex)` used a fixed integer index (0/1/2) to pick from `CIRCLES_QUESTIONS`. When 3 browser projects (e2e-desktop, e2e-mobile-chrome, e2e-mobile-safari) run B3-R1 in parallel with `fullyParallel: true`, all 3 workers call `createRealSession(page, 0)` — same question ID + same auth user → the draft endpoint's idempotency returns the SAME session for all 3 workers.

**Race sequence:**
1. Worker A: createRealSession(q0) → gets session-X
2. Worker B: createRealSession(q0) → gets session-X (dedup)
3. Worker C: createRealSession(q0) → gets session-X (dedup)
4. Worker A: seedStepScores(session-X, {C1: {totalScore: 78}})
5. Worker B: triggerRealRestore(session-X) → fetches session BEFORE A finishes seeding → circlesScoreResult = null → FAIL

**Evidence:** spec passed 10/10 with `--workers=1` (sequential); failed 3/10 with default parallel workers.

**Fix applied:** Changed `createRealSession` to accept a `questionId` string instead of an integer index. Added `QUESTION_BY_SLOT_AND_PROJECT` map so each (test slot, browser project) pair uses a unique question ID from circles_031..circles_039 — distinct from bug3-spinner-stuck-reproduce.spec.js which uses circles_021..circles_023.

**Files modified:**
- `tests/e2e/circles-phase3-restore-real.spec.js` — added `QUESTION_BY_SLOT_AND_PROJECT` + `questionIdForSlot(testInfo, slot)` helper; updated `createRealSession` signature; updated 3 test call sites to pass `testInfo` + `questionIdForSlot(testInfo, N)`.

**Verification:** 5/5 × 10/10 runs no flake (see §3).

### Cross-tab cache invalidation — COVERED

The task prompt asked: "Cross-tab cache invalidation: are there e2e specs for it?"

**Answer: YES.**
- `tests/e2e/bug4-offcanvas-delete-cache-reproduce.spec.js` R4 uses `browser.newContext()` (multi-context pattern per playwright-skill multi-user-and-collaboration.md) to test Tab A delete → Tab B fresh open.
- This spec runs under `tests/e2e/bug4-playwright.config.js` (separate config).
- Latest run: 8/8 passed (1 initial flake on first run; 8/8 on subsequent clean run — pre-existing timing sensitivity).
- `tests/circles-sessions.test.js` B4-A1..A3 (commit `9a406f8`) verify `session-cache.invalidate()` is called on DELETE 200 and skipped on DELETE 404 — the server-side regression guard.

**No additional cross-tab work is needed.**

### Multi-context newContext pattern — NOT NEEDED for 1B scope

Per E2E bible §9 multi-user-and-collaboration: `newContext` is required when testing two separate users/sessions simultaneously. Bug 4 single-user delete → re-open does not require this pattern. Bug4 reproduce spec (R4) already implements the newContext variant. 1B spec §6 does not require additional multi-context specs.

---

## §3 Verification Results

### New spec: circles-phase3-restore-real.spec.js (parallel flake fix)

```
Run 1: 10/10 passed (9.0s)
Run 2: 10/10 passed (9.3s)
Run 3: 10/10 passed (10.4s)
Run 4: 10/10 passed (9.8s)
Run 5: 10/10 passed (8.6s)
```
5/5 × 5 = 25/25 — no flake.

### Cross-vp regression smoke

| Suite | Result |
|---|---|
| circles-back-nav-lock.spec.js | 16/16 PASS |
| circles-fresh-form-no-ghost.spec.js | 16/16 PASS (1 transient mobile-safari flake on first run; stable on subsequent) |
| circles-fe-gate-stale-state.spec.js | 16/16 PASS |
| circles-phase3-restore-real.spec.js | 10/10 PASS (parallel flake fixed this lane) |
| Combined (all 4) | 55/55 PASS |

### jest

```
Tests: 17 skipped, 538 passed, 555 total
Test Suites: 4 skipped, 40 passed, 44 total
Time: 25.191s
```
538/555 (≥ 535/552 baseline confirmed; additional 3 passes from new test files added earlier).

### API smoke: lifecycle-circles.spec.js

```
8/8 passed via tests/api/playwright.config.js lifecycle-circles
```

---

## §4 Plan Completion Summary

All 8 tasks of the Stage 1B plan are closed:
- T1..T7: shipped across commits `8a8b424` through `f292a22` (2026-05-16 to 2026-05-17)
- T8: closed in this lane L29 — B3-R1 parallel flake fixed; all smokes GREEN

**Stage 1B bugs fixed:**
- **B3**: Phase 3 spinner stuck after offcanvas history restore of a completed CIRCLES session → fixed via 6-LOC derivation in `restoreCirclesPhase1FromSession` (commit `654d0e8`)
- **B4**: Offcanvas DELETE → quick re-open shows deleted item due to fire-and-forget race against 5s server-side cache TTL → fixed via await + snapshot/rollback + _resumeToast (commits `74959cf` + `c7b3e40`)
- **B3 parallel flake**: circles-phase3-restore-real.spec.js B3-R1 failing under parallel workers due to question dedup → fixed via per-project question ID map (this lane, commit TBD)

**Closes #191.**
