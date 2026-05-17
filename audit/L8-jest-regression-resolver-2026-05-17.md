# L8 — Jest Regression Resolver 2026-05-17

**Lane:** L8 — Resolve 21 jest regressions in tests/circles-sessions.test.js (P0-NEW-2)
**Root cause:** L5 added L5 lifecycle guards to `routes/circles-sessions.js` (P0-#255).
Guards return 403 unless `session.lifecycle ∈ {'gated','completed'}`. Old unit tests seeded
sessions via `makeSession()` which had no `lifecycle` field → `undefined` → guards fired → 403.

**E2E Bible citations:**
- `/Users/albertpeng/.claude/skills/playwright-skill/core/test-architecture.md` §Testing Trophy — hollow unit tests vs real API/integration
- `/Users/albertpeng/.claude/skills/playwright-skill/core/common-pitfalls.md` Pitfall 14 — shared state in test runners
- `/Users/albertpeng/.claude/skills/playwright-skill/core/api-testing.md` §APIRequestContext Basics — proper real-API coverage pattern

---

## §1 — 21 Failing Tests Classification Table

| # | Test name | Endpoint | Action | Reason |
|---|---|---|---|---|
| 1 | sets SSE headers: Content-Type text/event-stream | POST /:id/message | UPDATE | Tests real SSE header behavior (post-gate); seed lifecycle='gated' in makeSession() |
| 2 | streams delta chunks as SSE events | POST /:id/message | UPDATE | Tests SSE delta event format (post-gate behavior); seed lifecycle='gated' |
| 3 | sends done event with parsed 3-role turn | POST /:id/message | UPDATE | Tests 3-role reply parsing; not covered by api/ tier without real OpenAI; seed lifecycle='gated' |
| 4 | saves parsed turn to DB conversation | POST /:id/message | UPDATE | Tests DB write of conversation turn; seed lifecycle='gated' |
| 5 | calls evaluateCirclesStep with correct params | POST /:id/evaluate-step | UPDATE | Tests evaluator call shape + AbortSignal; seed lifecycle='gated' |
| 6 | returns evaluateCirclesStep result | POST /:id/evaluate-step | UPDATE | Tests route response passthrough; seed lifecycle='gated' |
| 7 | sets status to completed for drill mode | POST /:id/evaluate-step | UPDATE | Tests completion logic for drill mode; seed lifecycle='gated' |
| 8 | sets status to completed for simulation at last step | POST /:id/evaluate-step | UPDATE | Tests 7-step completion detection; seed lifecycle='gated' |
| 9 | sets status to active for simulation at non-last step | POST /:id/evaluate-step | UPDATE | Tests partial-step active status; seed lifecycle='gated' |
| 10 | saves step score under drill_step key | POST /:id/evaluate-step | UPDATE | Tests step_scores keying; seed lifecycle='gated' |
| 11 | returns 500 when evaluateCirclesStep throws | POST /:id/evaluate-step | UPDATE | Tests generic error path; seed lifecycle='gated' |
| 12 | legacy coachVersion (string) → 500 EVAL_PARSE_ERROR | POST /:id/evaluate-step | UPDATE | Tests M3 shape guard before DB write; seed lifecycle='gated' |
| 13 | coachVersion missing perField array → 500 EVAL_PARSE_ERROR | POST /:id/evaluate-step | UPDATE | Tests M3 perField guard; seed lifecycle='gated' |
| 14 | AbortError → 500 EVAL_TIMEOUT | error code mapping | UPDATE | Tests error classifier; beforeEach seeds makeSession() w/o lifecycle; fix via makeSession() |
| 15 | SyntaxError → 500 EVAL_PARSE_ERROR | error code mapping | UPDATE | Tests error classifier; same beforeEach fix |
| 16 | e.status === 401 → 500 EVAL_AUTH_ERROR | error code mapping | UPDATE | Tests error classifier; same beforeEach fix |
| 17 | generic Error → 500 EVAL_API_ERROR | error code mapping | UPDATE | Tests error classifier; same beforeEach fix |
| 18 | plain Error with no status → 500 EVAL_API_ERROR | error code mapping | UPDATE | Regression guard for false-positive; same beforeEach fix |
| 19 | updates currentPhase when provided | PATCH /:id/progress | UPDATE | currentPhase=2 triggers lifecycle guard; mock lifecycle read via maybeSingle default |
| 20 | can update multiple fields at once | PATCH /:id/progress | UPDATE | includes currentPhase=2; same maybeSingle fix |
| 21 | returns 500 when DB update fails | PATCH /:id/progress | UPDATE | Two maybeSingle() calls now: lifecycle read + final update; sequence with mockResolvedValueOnce |

**Summary: DELETE=0, UPDATE=21, ASSERTION-CHANGE=0, SKIP=0 (total=21)**

---

## §2 — Equivalent api/ Tier Coverage Map

Tests 1-18 are **UPDATE** not DELETE because the api/ tier does not fully duplicate them:

| Tests | Why UPDATE not DELETE | api/ tier equivalent | Gap |
|---|---|---|---|
| 1-4 (POST /message) | `circles-message-sse-real.spec.js` covers SSE format + Content-Type header with real OpenAI. But unit tests 3-4 validate turn parsing logic with mock streaming — deterministic assertions not possible with real OpenAI variance. | `circles-message-sse-real.spec.js` Tests 1-2 | Turn parse internals + DB write shape only verifiable via mock |
| 5-13 (POST /evaluate-step) | `circles-evaluate-step-contract.spec.js` covers 200 shape + 401 + 404 with real OpenAI. But error code mapping (EVAL_TIMEOUT/EVAL_PARSE_ERROR/EVAL_AUTH_ERROR), coachVersion shape guard, and per-mode status logic require deterministic mock injection of specific errors — impossible with real 3rd-party API. | `circles-evaluate-step-contract.spec.js` Tests 1-3 | Error code mapping, coachVersion guard, completion logic |
| 14-18 (error code mapping) | Same as above — error code mapping tests require injecting AbortError, SyntaxError, status=401 etc. deterministically. No real API test covers this. | None | Unique coverage retained |
| 19-21 (PATCH /progress) | `lifecycle-circles.spec.js` covers lifecycle promotion (frameworkDraft → editing), monotone guard, FE-lifecycle strip. `circles-draft-progress-route-real.spec.js` covers happy-path PATCH round-trip. But unit test 21 (DB error on final update) requires mock injection. | `lifecycle-circles.spec.js` + `circles-draft-progress-route-real.spec.js` | DB error path unique |

No tests were deleted. All 21 regressions resolved by updating mock seed state.

---

## §3 — Verify Results

| Metric | Before fix | After fix |
|---|---|---|
| `tests/circles-sessions.test.js` | 41/62 PASS (21 failures) | 62/62 PASS |
| Full jest suite | 514/552 (est.) → problem statement said 514 | 535/552 |
| Baseline | 535/552 (pre-L5) | 535/552 RESTORED |

---

## §4 — Rationale for Each Retrofit G Decision (UPDATE reasoning)

**Why UPDATE instead of DELETE for all 21:**

1. **Error code mapping (tests 14-18):** `classifyEvaluatorError()` in `lib/evaluate-step-handler.js` maps specific exception types → error codes (EVAL_TIMEOUT, EVAL_PARSE_ERROR, EVAL_AUTH_ERROR, EVAL_API_ERROR). This logic is not testable at the real api/ tier because you cannot force the real OpenAI SDK to throw an AbortError or SyntaxError deterministically. These tests are the *only* coverage for the error classifier — deleting them would leave the mapping completely untested (Retrofit G criterion: "covers real behavior not in api/ tier").

2. **coachVersion shape guard (tests 12-13):** The M3 guard in `isValidEvaluatorResult()` (`lib/evaluate-step-handler.js` lines 46-54) validates the LLM output shape before DB write. Real OpenAI reliably returns the correct shape, so real api/ tests will never exercise the rejection path. These unit tests provide the only guard against LLM drift.

3. **SSE parsing + DB write (tests 1-4):** The 3-role reply parser (regex extraction of 【被訪談者】/【教練點評】/【教練提示】 blocks) and the resulting DB conversation update are deterministic logic that cannot be deterministically validated with real OpenAI streaming. The api/ tier (`circles-message-sse-real.spec.js`) only verifies the SSE wire format and Content-Type header, not the parsed turn internals.

4. **per-mode status logic (tests 7-9):** Completion detection for drill vs simulation modes, and the 7-step isLastStep check (B4-1), require controlled session fixtures. Real api/ tests use real sessions with real OpenAI scores — the path where sim_step_index=3 (non-last) returns 'active' vs sim_step_index=6 (last) returns 'completed' is not exercised in `circles-evaluate-step-contract.spec.js`.

5. **PATCH /progress DB error (test 21):** The 500 path requires forcing a DB error on the final UPDATE. No real api/ test injects DB errors — this is unit-test-only coverage.

**Fix approach used:**

- `makeSession()` helper: added `lifecycle: 'gated'` to default session shape (with explanatory comment citing L5 guard). Spread semantics allow per-test override (e.g. a future test wanting `lifecycle: 'created'` passes `makeSession({ lifecycle: 'created' })`).
- `maybeSingle` mock default: changed from `{ id: 'mock-id' }` to `{ id: 'mock-id', lifecycle: 'gated' }` in both `mockFns` factory AND `resetDbChain()` so the PATCH /progress lifecycle guard read receives a valid lifecycle value.
- Test 21 (`returns 500 when DB update fails`): PATCH /progress now performs TWO `maybeSingle()` calls when `currentPhase > 1` (lifecycle guard read + final UPDATE). Changed to `mockResolvedValueOnce` sequence: first call returns gated session (passes guard), second call returns the DB error (triggers 500).

**Karpathy alignment:**
- Think Before: classification table written and verified before any edits.
- Simplicity First: 3 targeted edits to `tests/circles-sessions.test.js` only — no new files, no route changes.
- Surgical Changes: only `tests/circles-sessions.test.js` + this audit doc touched.
- Goal-Driven: full jest 535/552 restored, all 21 regressions resolved, 0 tests deleted.
