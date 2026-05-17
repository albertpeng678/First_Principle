# L22 — Auth Setup Race Investigation
**Date:** 2026-05-17
**Lane:** L22 (independent of L24 regression cluster)
**Investigator:** Sonnet 4.6 subagent

---

## TL;DR

**Setup project never fails.** The symptom attributed to `ERR::CONNECTION_REFUSED` in P1-#264
is actually a **Supabase DB state collision** between concurrently executing Playwright CLI
processes. The server on :3000 remains healthy throughout all burst runs. The auth setup file
write (atomic rename `313b4fd`) is solid. The fix target is session isolation, not auth or
server keep-alive.

---

## Files Examined

- `tests/setup/auth.setup.js` — auth setup logic
- `tests/e2e/playwright.config.js` — workers / retries / webServer config
- `server.js` — express server, keep-alive posture
- `tests/e2e/circles-back-nav-lock.spec.js` — failing spec under investigation
- `/Users/albertpeng/.claude/skills/playwright-skill/core/auth-flows.md` — storageState patterns
- `/Users/albertpeng/.claude/skills/playwright-skill/core/flaky-tests.md` — flake taxonomy

---

## Reproduction

**Command run:**
```bash
for i in 1 2 3; do
  npx playwright test --config tests/e2e/playwright.config.js \
    tests/e2e/circles-back-nav-lock.spec.js --reporter=list 2>&1 | tail -5 &
done
wait
```

**Result:** Reproduction confirmed. 5–12 failures across 3 parallel runs (varies per run).

**Setup project status in all 3 runs:**
```
✓  [setup] › tests/setup/auth.setup.js:21:1 › authenticate as e2e@first-principle.test
```
Setup passed in all 3 parallel invocations — no CONNECTION_REFUSED ever observed.

---

## Failure Signature

Two distinct assertion failures appear:

### Failure Type A — TC2 returns 404 instead of 422
```
Expected: 422
Received: 404
> 366 |   expect(result.status).toBe(422);
```
Meaning: `/api/circles-sessions/:id/evaluate-step` returns 404 → session does not exist.

### Failure Type B — TC1 circlesLocked=false
```
Expected: true
Received: false
> 287 |   expect(state.locked).toBe(true);
```
Meaning: `AppState.circlesLocked` was not set → the session existed but had no step_scores
seeded, because a competing run's cleanup or draft-creation clobbered the DB row.

### Also observed
- TC3: retry button `enabled` instead of `disabled` (step_scores not present → lock not set)
- TC4: `.qchip-ana__block` not found (page in wrong state due to session collision)
- TC5: elements not found (cascading from session deletion mid-test)

---

## Root Cause Analysis

### Per-project isolation strategy (in spec)

```js
const QUESTION_BY_PROJECT = {
  'e2e-desktop':       'circles_011',
  'e2e-mobile-chrome': 'circles_012',
  'e2e-mobile-safari': 'circles_013',
};
```

This correctly isolates across the **3 projects within a single Playwright run**, because each
project maps to a different `question_id`, and the draft endpoint is idempotent on
`(user, question_id, mode, drill_step, status='active')`.

### What breaks under parallel CLI invocations

When 3 Playwright CLI processes run concurrently (as in the burst scenario):

```
CLI Run A (e2e-mobile-chrome / TC2):
  1. createDraftSession(circles_012, step=I)  → session_A created
  2. seedStepScores(session_A, {I: fixture})
  3. seedLifecycleGated(session_A)

CLI Run B (e2e-mobile-chrome / TC2, concurrent):
  1. createDraftSession(circles_012, step=I)  → returns session_A (idempotent!)
     OR Run A's cleanupSession(session_A) fires first → session_A deleted
     → createDraftSession returns a NEW session_B

  → If Run A already seeded session_A and Run B deleted it:
       Run A hits /evaluate-step on deleted session → 404

  → If Run B creates session_B and Run A seeded session_A (different IDs):
       Run B /evaluate-step on session_B has no step_scores → no 422 guard hits
```

The draft endpoint idempotency is the key: multiple runs creating a draft for the same
`(user, question_id, drill_step)` return the SAME session ID. Then when Run A's cleanup
calls `DELETE /api/circles-sessions/:id` while Run B is mid-test using that session,
Run B gets 404.

### Server keep-alive analysis

Node.js `http.Server` defaults:
- `keepAliveTimeout`: 5000 ms
- `headersTimeout`: 60000 ms

`server.js` uses `app.listen(PORT)` without capturing the server reference, so these
defaults are never customized. Under burst load (3 parallel Playwright CLI processes ×
5 workers each = up to 15 concurrent browser contexts), the server handles ~45 concurrent
connections. At default `keepAliveTimeout=5s`, idle connections are recycled well before
the 90s test timeout. **No evidence of connection drops attributable to keep-alive.**

`curl http://localhost:3000/health` confirmed healthy before, during, and after burst runs.

### Flake taxonomy classification (per playwright-skill/core/flaky-tests.md)

Category: **Test Isolation** (shared mutable state — DB rows shared across parallel CLI runs).

The flake taxonomy flowchart says:
> "Fails only when run with other tests? YES → ISOLATION issue: Parallel tests colliding
> on unique constraints"

This matches exactly. Single runs are 16/16 green; burst runs show 1–5 failures.

---

## Config Observations

```js
// playwright.config.js
workers: process.env.CI ? 2 : undefined,  // local: auto = ceil(CPUs / 2) = 5
retries: process.env.CI ? 2 : 0,          // local: 0 retries
```

With `workers: undefined` (auto) on a 10-CPU Mac, Playwright uses 5 workers locally.
3 parallel CLI invocations = 15 concurrent workers hitting shared Supabase rows.

CI has `workers: 2` and `retries: 2` — the lower concurrency + retries partially mask
this, which is why it was not caught in single-run CI.

---

## Fix Options — Ranked

### Option B (RECOMMENDED): retry helper in auth.setup.js + session-ID namespacing in spec

This is a **two-part fix**:

**Part 1 — auth.setup.js: add `waitForServer` preflight (addresses original ERR symptom)**

Add a `waitForServer` loop before `page.goto('/')` that polls `http://localhost:3000/health`
with exponential backoff (3 attempts, 1s/2s/3s). If the server is not up in 6s, throw a
descriptive error. This makes the setup robust to the rare case where the webServer starts
slowly under burst load.

```js
// Proposed addition in auth.setup.js (setup step before page.goto):
async function waitForServer(maxMs = 6000) {
  const start = Date.now();
  for (let delay of [500, 1000, 2000, 2500]) {
    try {
      const r = await fetch(process.env.BASE_URL + '/health');
      if (r.ok) return;
    } catch (_) {}
    if (Date.now() - start + delay > maxMs) break;
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error('auth.setup: server did not become ready within ' + maxMs + 'ms');
}
```

**Part 2 — circles-back-nav-lock.spec.js: per-run session namespacing**

Replace the per-project `QUESTION_BY_PROJECT` constant with a per-run unique suffix
derived from `process.pid` or `Date.now()`:

```js
// Current (collides across CLI runs):
const QUESTION_BY_PROJECT = {
  'e2e-desktop':       'circles_011',
  'e2e-mobile-chrome': 'circles_012',
  'e2e-mobile-safari': 'circles_013',
};

// Proposed: use per-TC random suffix so parallel CLI runs can never share a session
// NOTE: question_id must exist in circles_plan/circles_database.json.
// Alternative: keep fixed question_id but add a per-run `test_run_id` tag to
// session metadata so DELETE only removes the current run's sessions.
```

The cleanest approach is a **global beforeAll fixture** that generates a `RUN_ID = Date.now()`
and uses it as a session metadata tag, then cleanup only targets sessions with that tag.

### Option A: lower workers in playwright.config.js

```js
workers: process.env.CI ? 2 : 2,  // cap at 2 locally
```

Reduces collision probability but does not eliminate it. Two sequential runs can still
collide if the second starts before the first's cleanup completes. **Not recommended alone.**

### Option C: keep-alive in server.js

```js
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.keepAliveTimeout = 65_000;  // above load-balancer idle timeout
server.headersTimeout = 70_000;
```

Addresses a different (unconfirmed) failure mode. **Not the root cause here.** Worth doing
as hardening regardless, but does not fix the DB collision failures observed.

### Option D: spec-level retry()

```js
// playwright.config.js
retries: process.env.CI ? 2 : 1,  // add 1 local retry
```

Masks flakiness but does not fix it. The retry will also hit the same deleted session since
`sessionId` is captured in `let sessionId` before the try/finally — the retry re-runs the
entire test, creating a NEW session, so it would actually pass. **Acceptable as mitigation
but obscures the real bug.**

---

## Recommended Fix

**Option B (auth.setup.js server preflight) + session isolation fix in the spec.**

The `waitForServer` preflight in auth.setup.js addresses the original ERR::CONNECTION_REFUSED
symptom for any future true server startup race. The session namespacing (per-run unique
question_id or metadata tag) eliminates the DB collision across parallel CLI runs.

Implementation note: the spec's `QUESTION_BY_PROJECT` uses hardcoded question IDs
`circles_011/012/013` because `circles_sessions.question_id` must reference a valid entry
in `circles_plan/circles_database.json`. The safest per-run isolation is to:
1. Keep the same question IDs (they exist in DB)
2. Add cleanup targeting sessions by `created_at > test_start_timestamp AND user_id = e2e_user`
   instead of by explicit `sessionId` captured at draft time

This ensures cleanup cannot accidentally hit a parallel run's session.

---

## Evidence Summary

| Observation | Conclusion |
|---|---|
| `[setup] ✓` in all 3 burst runs | auth.setup.js atomic rename fix is solid; no CONNECTION_REFUSED |
| TC2: 404 instead of 422 | Session deleted by competing run's cleanupSession before /evaluate-step |
| TC1: circlesLocked=false | Session seeding race: step_scores not present when test asserts |
| Server health stable throughout | keep-alive not the issue; server never dropped |
| Single run: 16/16 green | Pure isolation failure; no timing/async/environment cause |
| Flake taxonomy: ISOLATION | Parallel tests colliding on same Supabase rows |

---

## Burst Run Results

| Run | Passes | Failures | Setup failed? |
|---|---|---|---|
| Burst 1 (first attempt) | 13 | 3 | No |
| Burst 2 (first attempt) | 16 | 0 | No |
| Burst 3 (first attempt) | 14 | 2 | No |
| Burst 4 (second attempt) | 12 | 4 | No |
| Burst 5 (second attempt) | 11 | 5 | No |
| Burst 6 (second attempt) | 13 | 3 | No |

Failure rate under burst: ~25% of individual tests across 3 parallel CLI invocations.
