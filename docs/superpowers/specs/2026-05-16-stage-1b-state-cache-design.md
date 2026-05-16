# Stage 1B Design Spec — State / Cache Cluster (B3 + B4)

**Date:** 2026-05-16
**Status:** DRAFT — awaiting implementer
**Cluster:** B3 (Phase 3 spinner stuck on history restore) + B4 (offcanvas DELETE cache race)
**Estimated LOC delta:** B3 ~6 LOC, B4 ~12 LOC — both FE-only except one server-side cache path note

---

## §1 Context

### B3 — Phase 3 spinner stuck after history restore

**Symptom.** User opens the offcanvas history drawer, clicks a completed CIRCLES session (one that has `step_scores` data in the DB row), lands on Phase 1 as expected, then clicks the "回評分" button. The app sets `circlesPhase = 3` and re-renders. `renderCirclesPhase3()` immediately enters its loading branch, starts `_phase3LoadingInterval` + `_phase3SlowTimeout` + `_phase3LoadingTimeout`, and the spinner never resolves. The user is permanently stuck.

**Root cause (one-liner).** `restoreCirclesPhase1FromSession()` (app.js line 7918–7975) rehydrates `circlesStepScores` from `item.step_scores` (line 7944) but never populates `circlesScoreResult`. `renderCirclesPhase3()` (line 6415) guards on `!AppState.circlesScoreResult` — true forever — so it renders the loading state indefinitely even when the score data is already available locally.

**Relevant code locations.**

| Symbol | File | Line |
|---|---|---|
| `restoreCirclesPhase1FromSession()` | `public/app.js` | 7918–7975 |
| `AppState.circlesStepScores = item.step_scores` | `public/app.js` | 7944 |
| `AppState.circlesScoreResult` (reset on home) | `public/app.js` | 3090 |
| `renderCirclesPhase3()` loading guard | `public/app.js` | 6415 |
| "回評分" click handler sets `circlesPhase = 3` | `public/app.js` | 6703 |
| `AppState.circlesScoreResult = data` (normal eval path) | `public/app.js` | 6561 |

---

### B4 — Offcanvas shows deleted item after quick re-open

**Symptom.** User opens offcanvas, deletes a session (trash icon), closes the offcanvas, and re-opens it within roughly 0–200 ms (e.g., tap-close → immediate tap-open). The deleted session reappears in the list. On second open (after ~5 s or network round-trip completes) the item is gone correctly.

**Root cause (one-liner).** The FE DELETE handler (app.js line 8140) fires the DELETE request fire-and-forget (`window.apiFetch(...).catch(function(){})`); if the user calls `loadHistory()` before the DELETE response arrives, the GET request hits the server while its in-process cache entry (5 s TTL, `lib/session-cache.js`) has not yet been invalidated, returning the stale pre-delete list.

**Relevant code locations.**

| Symbol | File | Line |
|---|---|---|
| FE DELETE handler (fire-and-forget) | `public/app.js` | 8127–8140 |
| Server-side cache invalidation on DELETE | `routes/circles-sessions.js` | 161 |
| Server-side cache invalidation on DELETE (guest) | `routes/guest-circles-sessions.js` | 160 |
| Server-side cache invalidation on DELETE (NSM) | `routes/nsm-sessions.js` | 75 |
| `loadHistory()` GET path | `public/app.js` | 7859–7913 |
| `session-cache.js` TTL constant (5 s) | `lib/session-cache.js` | 3 |
| `cache.invalidate()` implementation | `lib/session-cache.js` | 35–37 |

---

## §2 Architecture

### B3 Fix — Derive `circlesScoreResult` from `circlesStepScores` during restore

After `restoreCirclesPhase1FromSession()` assigns `circlesStepScores`, append a single derivation block: compute `stepKey` from the restored `mode` and `drill_step`, then if `circlesStepScores[stepKey]` exists and has `totalScore != null`, copy it to `circlesScoreResult`.

This mirrors exactly what the normal eval completion path does (lines 6556–6561):

```
stepKey = mode==='drill' ? drillStep : STEPS[simStepIndex]
circlesScoreResult = circlesStepScores[stepKey] || null
```

No API call, no extra state, no new AppState keys. The fix is a pure read of already-restored memory.

**Deliberate constraint.** `circlesPhase` is intentionally left at 1 (not 3) on restore per the existing comment at line 7932 ("always land on Phase 1 — safe landing"). The fix does NOT auto-jump to Phase 3; it only ensures that if the user manually clicks "回評分", Phase 3 renders correctly rather than spinning.

### B4 Fix — Await DELETE before optimistic list update drives re-open

Replace the fire-and-forget pattern with an async sequence:

1. Remove the item from `AppState.historyList` and `render()` immediately (optimistic — UX unchanged).
2. Await the DELETE response.
3. On success (HTTP 200): no further action needed (server cache already invalidated by the route handler).
4. On failure (non-200 / network error): restore the deleted item back to `historyList` at its original position, call `render()` to show the item again, and display a brief error toast.

This eliminates the race: `loadHistory()` can only fire after the DELETE round-trip completes, so the server cache is always invalidated before the next GET.

**Why not client-side cache bust instead?** The FE has no direct mechanism to force the server-side `session-cache.js` to invalidate from the client side. The proper fix is sequencing, not adding another cache layer.

---

## §3 Components

### B3

| File | Change | Est. LOC delta |
|---|---|---|
| `public/app.js` — inside `restoreCirclesPhase1FromSession()` after line 7944 | Add ~6 lines: compute `stepKey`, assign `circlesScoreResult` | +6 |

No backend changes. No new files.

### B4

| File | Change | Est. LOC delta |
|---|---|---|
| `public/app.js` — replace lines 8127–8140 (delete branch) | Convert to async IIFE; await apiFetch; rollback on failure | +12 / -2 net |

No backend changes (server-side routes already invalidate correctly on DELETE 200). No new files.

---

## §4 Data Flow

### B3 — Restore → Phase 3

```
offcanvas item click
  └─ loadCirclesSessionFromHistory(item)
       └─ restoreCirclesPhase1FromSession(item)
            ├─ AppState.circlesStepScores = item.step_scores   [existing, line 7944]
            ├─ [NEW] stepKey = drill ? drillStep : STEPS[simStepIndex]
            └─ [NEW] AppState.circlesScoreResult = circlesStepScores[stepKey] || null

user clicks "回評分"
  └─ AppState.circlesPhase = 3 → render()
       └─ renderCirclesPhase3()
            ├─ [BEFORE FIX] !circlesScoreResult → true → spinner forever
            └─ [AFTER FIX]  !circlesScoreResult → false → render score UI
```

`stepKey` derivation rule (mirrors lines 6556–6558):

- `mode === 'drill'` → `item.drill_step || 'C1'`
- `mode !== 'drill'` (sim) → `['C1','I','R','C2','L','E','S'][item.sim_step_index || 0] || 'C1'`

Edge case: if `item.step_scores[stepKey]` is absent or `totalScore == null`, `circlesScoreResult` stays `null` (partial session — spinner is correct behavior, user must re-evaluate).

### B4 — Delete → Cache Invalidation

```
[CURRENT — BROKEN]
delete click
  ├─ optimistic filter + render()
  └─ apiFetch DELETE (fire-and-forget, no await)

quick re-open (< ~150 ms later)
  └─ loadHistory() GET
       └─ server cache still warm → returns stale list with deleted item

[FIXED]
delete click
  ├─ snapshot originalList
  ├─ optimistic filter + render()   ← UX latency unchanged
  └─ await apiFetch DELETE
       ├─ 200 OK → server cache invalidated by route handler → done
       └─ non-200 / network error
            ├─ AppState.historyList = originalList  ← rollback
            ├─ render()
            └─ show error toast ("刪除失敗，請再試一次")

any subsequent re-open of offcanvas
  └─ loadHistory() GET → server cache already invalidated → fresh list
```

---

## §5 Error Handling

### B3

No new error paths introduced. The fix is a pure value assignment. The only edge case is an absent or incomplete `step_scores[stepKey]` — handled by the `|| null` fallback, which preserves the existing spinner behavior (correct for sessions where evaluation never ran).

### B4

| Scenario | Handling |
|---|---|
| DELETE returns 500 | Await resolves with non-ok response → rollback `historyList` to snapshot → render → toast "刪除失敗，請再試一次" |
| DELETE network error (offline / timeout) | `.catch()` block → same rollback + toast |
| DELETE returns 404 (already deleted elsewhere) | Treat as success (item was already gone server-side) → no rollback, no toast |
| User closes offcanvas before DELETE resolves | DELETE still awaited in background IIFE; optimistic filter already applied; no visible change when it resolves |
| Server cache `invalidate()` throws | Not possible — `lib/session-cache.js:35–37` is synchronous `Map.delete`, no I/O |

---

## §6 Testing Strategy

### Unit tests (Jest — `tests/` root)

**B3 — new file: `tests/circles-restore-phase3.test.js`**

| Test ID | Description |
|---|---|
| B3-U1 | `restoreCirclesPhase1FromSession` with `step_scores: { C1: { totalScore: 72 } }`, `mode: 'drill'`, `drill_step: 'C1'` → `circlesScoreResult.totalScore === 72` |
| B3-U2 | Same but `mode: 'simulation'`, `sim_step_index: 3` (C2 slot) → `circlesScoreResult` taken from `step_scores.C2` |
| B3-U3 | `step_scores: {}` (no completed step) → `circlesScoreResult === null` (spinner still correct) |
| B3-U4 | `step_scores: { C1: { totalScore: null } }` (partial eval) → `circlesScoreResult === null` |
| B3-U5 | All 7 sim steps (C1/I/R/C2/L/E/S) → stepKey derivation correct for each `sim_step_index` 0–6 |

**B4 — extend `tests/issue-bug1-nsm-session-restore.test.js` or new `tests/circles-delete-rollback.test.js`**

| Test ID | Description |
|---|---|
| B4-U1 | Mock `apiFetch` to resolve 200 → `historyList` stays filtered, no rollback |
| B4-U2 | Mock `apiFetch` to resolve 500 → `historyList` rolled back to originalList |
| B4-U3 | Mock `apiFetch` to reject (network) → `historyList` rolled back to originalList |
| B4-U4 | Mock `apiFetch` to resolve 404 → treated as success, no rollback |

### API contract tests (Jest — `tests/api/`)

**B4 — extend `tests/circles-sessions.test.js`**

| Test ID | Description |
|---|---|
| B4-A1 | `DELETE /api/circles-sessions/:id` returns 200 `{ ok: true }` and subsequent `GET /api/circles-sessions` does not include the deleted id (verifies server cache invalidation) |
| B4-A2 | Same for `DELETE /api/guest-circles-sessions/:id` guest path |
| B4-A3 | `DELETE` with unknown id returns 404; cache unaffected |

### E2E tests (Playwright — `tests/e2e/`)

All E2E specs go in `tests/e2e/`, NOT in `tests/visual/`. Use the `auto-cleanup.fixture` + `circles-phase1.factory` pattern established in `tests/e2e/circles-gate.spec.js`. Use real DB sessions (no stubs for session data per memory `feedback_e2e_real_data_only`); stub only the list endpoints where needed to prevent tryResume auto-navigation.

**B3 — new test group in `tests/e2e/circles-phase3-restore.spec.js`**

| Test ID | Description |
|---|---|
| B3-E1 | Boot app, inject AppState with completed drill C1 (step_scores.C1 present), click history item → Phase 1, click "回評分" → Phase 3 score UI visible (not spinner) |
| B3-E2 | Same but step_scores empty → click "回評分" → spinner visible (regression guard) |
| B3-E3 | Completed sim session with S slot → Phase 3 renders score correctly |

State injection approach: use `page.evaluate()` to set `window.AppState` + `window.render()` after app boot, mirroring the circles-gate.spec.js pattern (lines 28–30 of that file). Avoids relying on the offcanvas UI flow for test setup speed and determinism.

**B4 — new test group in `tests/e2e/offcanvas-delete.spec.js`**

| Test ID | Description |
|---|---|
| B4-E1 | Real DELETE + real loadHistory: delete a session, immediately call loadHistory → deleted item absent (core regression) |
| B4-E2 | Simulate 500: intercept DELETE route → returns 500 → item reappears in list + error toast visible |
| B4-E3 | NSM session delete: same happy-path check via `/api/nsm-sessions/:id` |

Use `page.route()` for B4-E2 to intercept the DELETE endpoint and return a mocked 500 without touching the real server. Do not mock B4-E1 (real data per memory rule).

---

## §7 Acceptance Criteria

### B3

| ID | Criterion |
|---|---|
| B3-AC1 | After restoring a completed drill session from offcanvas history, clicking "回評分" renders the Phase 3 score UI (grade letter, axis breakdown) — spinner does NOT appear |
| B3-AC2 | After restoring a completed sim session from offcanvas history, clicking "回評分" renders the Phase 3 score UI correctly for the sim's terminal step |
| B3-AC3 | After restoring an in-progress session (no step_scores), clicking "回評分" still shows the spinner (regression guard — existing correct behavior must be preserved) |
| B3-AC4 | `circlesScoreResult` is never set to a value with `totalScore == null` by the restore path |
| B3-AC5 | All 5 B3 unit tests pass; B3-E1/E2/E3 Playwright specs pass on Mobile-360 + Desktop-1280 |

### B4

| ID | Criterion |
|---|---|
| B4-AC1 | Deleting a session then immediately (< 50 ms) re-opening offcanvas does NOT show the deleted item |
| B4-AC2 | On DELETE 500, the deleted item reappears in the list and a "刪除失敗，請再試一次" toast is shown |
| B4-AC3 | On network error, same rollback + toast behavior as B4-AC2 |
| B4-AC4 | On DELETE 404, no rollback, no toast — item stays filtered (already gone server-side) |
| B4-AC5 | Optimistic UI (item disappears immediately on click) is preserved — no visible latency increase for the success path |
| B4-AC6 | All 4 B4 unit tests pass; B4-A1/A2/A3 API contract tests pass; B4-E1/E2/E3 Playwright specs pass |

---

## §8 Out of Scope

- No backend AI prompts touched (CIRCLES gate, evaluator, final-report, NSM gate, NSM evaluator).
- `lib/session-cache.js` TTL constant is not changed. The 5 s TTL is not the root cause of B4; the fix is sequencing, not TTL reduction.
- No new AppState keys added for either fix.
- `circlesPhase` is NOT auto-set to 3 on restore — the safe-landing-at-Phase-1 policy (app.js line 7932) is preserved.
- No changes to `routes/circles-sessions.js`, `routes/guest-circles-sessions.js`, or `routes/nsm-sessions.js` — their DELETE handlers already invalidate the cache correctly.
- No visual / CSS changes. No mockup updates required.
- Stage 1A gate cluster (B1/B2/B5/B6/B7) fixes are not in scope for this spec.
- No Playwright visual (pixel-diff) specs needed — these are behavioral bugs with no visual regression surface.

---

## §9 References

| Reference | Path / Location |
|---|---|
| `restoreCirclesPhase1FromSession()` | `public/app.js` lines 7918–7975 |
| `renderCirclesPhase3()` | `public/app.js` lines 6409–6614 |
| Offcanvas DELETE handler | `public/app.js` lines 8127–8140 |
| `loadHistory()` | `public/app.js` lines 7859–7913 |
| `session-cache.js` | `lib/session-cache.js` (full file, 58 lines) |
| Circles sessions route (auth) | `routes/circles-sessions.js` lines 150–163 |
| Circles sessions route (guest) | `routes/guest-circles-sessions.js` lines 149–162 |
| NSM sessions route (auth) | `routes/nsm-sessions.js` lines 64–76 |
| Stage 1A E2E fixture pattern | `tests/e2e/circles-gate.spec.js` + `tests/fixtures/auto-cleanup.fixture.js` |
| Phase 1 factory (real zh-TW data) | `tests/factories/circles-phase1.factory.js` |
| memory: two-stage review mandatory | `feedback_two_stage_review_mandatory.md` — implementer dispatches spec compliance reviewer before any merge |
| memory: e2e real data only | `feedback_e2e_real_data_only` — no `e2e-r${N}-${Date.now()}` stub values in factory pools |
