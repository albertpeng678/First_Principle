# Bug 6 — Gate Bypass Path Enumeration
**Date:** 2026-05-17
**Tracker:** P0-#255 — user reported 完整步驟 path may bypass gate
**Auditor:** Phase 1 Lane L3 code audit + TDD-red spec

---

## §1 Backend Path Inventory

| Method | Path | Handler line | Requires prior /gate pass? | Guard mechanism | Risk |
|---|---|---|---|---|---|
| POST | /api/circles-sessions/:id/gate | circles-sessions.js:177 | N/A (IS the gate) | Calls reviewFramework, sets lifecycle=gated on ok | None |
| POST | /api/circles-sessions/:id/message | circles-sessions.js:202 | **NO** | Only checks: session ownership + userMessage non-empty | **LEAK** — Phase 2 SSE accessible with lifecycle='editing' |
| POST | /api/circles-sessions/:id/evaluate-step | circles-sessions.js:253 | **NO** | Only checks: session ownership + step already scored (422) | **LEAK** — Phase 3 scoring accessible with lifecycle='editing' |
| PATCH | /api/circles-sessions/:id/progress | circles-sessions.js:304 | **NO** | lifecycle stripped; server only promotes monotone from content; currentPhase written freely | **LEAK** — currentPhase=2/3/4 can be written without gate |
| POST | /api/circles-sessions/:id/final-report | circles-sessions.js:382 | **NO** | Only checks: step_scores count >= 7 | **LEAK** — callable if step_scores seeded (gate never required) |
| POST | /api/circles-sessions/:id/conclusion-check | circles-sessions.js:285 | **NO** | Only checks: session ownership + conclusionText non-empty | Low risk (diagnostic only, no state mutation) |
| POST | /api/circles-sessions/:id/hint | circles-sessions.js:421 | **NO** | Ownership + step/field validation only | By design — hint is always available (STANDING RULE) |
| POST | /api/circles-sessions/:id/example | circles-sessions.js:440 | **NO** | Ownership + step/field validation only | By design — example is always available (STANDING RULE) |
| POST | /api/guest-circles-sessions/:id/gate | guest-circles-sessions.js:175 | N/A | Same as auth variant | None |
| POST | /api/guest-circles-sessions/:id/message | guest-circles-sessions.js:200 | **NO** | Ownership + userMessage only | **LEAK** — same as auth variant |
| POST | /api/guest-circles-sessions/:id/evaluate-step | guest-circles-sessions.js:245 | **NO** | Ownership + EvaluatorError catch only | **LEAK** — same as auth variant |
| PATCH | /api/guest-circles-sessions/:id/progress | guest-circles-sessions.js:284 | **NO** | Same pattern; lifecycle monotone only | **LEAK** — currentPhase=2 writable |
| POST | /api/guest-circles-sessions/:id/final-report | guest-circles-sessions.js:353 | **NO** | step_scores >= 7 only | **LEAK** — same as auth variant |

**Summary:** 4 distinct leak surfaces (message, evaluate-step, progress.currentPhase, final-report) × 2 auth variants (auth + guest) = 8 leaky handler instances.

---

## §2 Frontend Path Inventory

| FE Handler | Location (app.js line) | Makes BE call | Gate check before call? | Risk |
|---|---|---|---|---|
| Gate proceed button (`data-gate-action="proceed"`) | ~7542 | No — sets `AppState.circlesPhase = 2` + render() only | Checks `AppState.gateInflight` (race guard), NOT gateResult.canProceed | **FE BYPASS** — render-only guard; gateResult.canProceed not verified |
| Conclusion submit → evaluate-step chain | ~6982 | POST /evaluate-step | Checks conclusionText.length >= 30 + conclusion-check ok | No lifecycle/gate check |
| Phase 3 retry (retryEvaluateStep) | ~6641 | POST /evaluate-step | No check | No lifecycle/gate check |
| Phase 2 send (streamCirclesMessage) | ~1200 | POST /message via fetch | No lifecycle check | No gate check |
| Phase 4 auto-fire (bindCirclesPhase4) | ~662 | POST /final-report | Checks `_phase4FinalReportFired` (dedup only) | No lifecycle/gate check |
| drill-pill click | ~5710 | No BE call (only AppState) | N/A | No bypass possible |
| sim-back / sim-next (NSM) | ~2066 | PATCH /nsm-sessions/:id/progress | Not a CIRCLES gate concern | N/A |
| PATCH /progress (phase transition) | ~3862 | PATCH /circles-sessions/:id/progress | No lifecycle check | Sends currentPhase freely |

**Key FE finding:** `bindCirclesGate` at line ~7542 checks `AppState.gateInflight` (mutex for duplicate submits) but does NOT check `AppState.circlesGateResult.canProceed`. A user who receives a `canProceed=false` gate result and then directly clicks `data-gate-action="proceed"` — or directly calls the API — will not be blocked at the FE OR BE level.

---

## §3 Identified Leaks (paths without guard)

### LEAK-1: POST /evaluate-step — no lifecycle/gate guard
- **Path:** POST /api/circles-sessions/:id/evaluate-step
- **Missing guard:** No check that `session.lifecycle === 'gated'` before triggering evaluator
- **Impact:** A session in `lifecycle='editing'` (gate not passed) can be scored immediately
- **Evidence surface:** route evaluates if session has no prior step_scores[stepKey]; no gate prerequisite
- **File:** routes/circles-sessions.js:253-282

### LEAK-2: POST /message — no lifecycle/gate guard
- **Path:** POST /api/circles-sessions/:id/message
- **Missing guard:** No check that `session.lifecycle === 'gated'` or `session.current_phase >= 2`
- **Impact:** Phase 2 SSE chat conversation can be initiated without gate pass
- **File:** routes/circles-sessions.js:202-250

### LEAK-3: PATCH /progress with currentPhase — no gate guard
- **Path:** PATCH /api/circles-sessions/:id/progress
- **Missing guard:** `currentPhase` is accepted and persisted without checking current lifecycle
- **Impact:** A session in `lifecycle='editing'` can be updated to `current_phase=2/3/4` via direct API call
- **Note:** This is a data integrity issue; the FE reads `current_phase` on reload and would show the wrong UI phase
- **File:** routes/circles-sessions.js:304-379 (line 312: `if (currentPhase !== undefined) patch.current_phase = currentPhase`)

### LEAK-4: POST /final-report — no lifecycle/gate guard
- **Path:** POST /api/circles-sessions/:id/final-report
- **Missing guard:** Only checks `step_scores.length >= 7`; no check that lifecycle='gated' or that gate was ever passed
- **Impact:** If step_scores are seeded (e.g., via service-role or LEAK-1 abuse), final-report generates without gate
- **Partially mitigated by:** Requires 7 complete step_scores — but LEAK-1 can supply those
- **File:** routes/circles-sessions.js:382-416

### LEAK-5 (FE): Gate proceed button ignores canProceed
- **FE path:** bindCirclesGate — `data-gate-action="proceed"` handler at app.js:~7542
- **Missing guard:** `AppState.circlesGateResult.canProceed` is NOT checked before setting `circlesPhase = 2`
- **Impact:** If the "proceed" button is somehow visible (e.g., HTML manipulation or state race), a failed gate result does not block FE phase advance
- **Note:** The proceed button is only rendered when `canProceed=true` in `renderCirclesGate` (renderLogic ~line 1469), so normal flow is protected; but the handler itself has no double-check — defense-in-depth is absent

---

## §4 Reproduction Spec Design

### Test plan for `tests/api/circles-no-bypass.spec.js`

Each test:
1. Creates a draft session via POST /draft (lifecycle='created')
2. Seeds `lifecycle='editing'` via service-role (simulate user who started typing but did NOT pass gate)
3. Attempts the bypass call directly
4. Asserts response >= 400 (expected); if 200 returned = bug confirmed

**Tests to cover:**
- T-BYPASS-1: POST /evaluate-step on lifecycle='editing' session → expect 400/403/422; actual = ?
- T-BYPASS-2: POST /message on lifecycle='editing' session → expect 400/403; actual = ?  
- T-BYPASS-3: PATCH /progress with currentPhase=2 on lifecycle='editing' → expect 400/403; actual = ?
- T-BYPASS-4: POST /final-report on lifecycle='editing' with seeded step_scores → expect 400/403; actual = ?

---

## §5 Actual Test Results (run 2026-05-17)

Spec run: `npx playwright test --config tests/api/playwright.config.js tests/api/circles-no-bypass.spec.js --reporter=list 2>&1 | tee /tmp/L3-run.log`
Result: **4 failed / 1 passed (24.2s)**

| Test | Expected | Actual HTTP | Status | Notes |
|---|---|---|---|---|
| T-BYPASS-1 evaluate-step no gate | >= 400 | **200** | **RED / BUG CONFIRMED** | Full evaluator ran, returned scored result with totalScore=16 |
| T-BYPASS-2 message no gate | >= 400 | **200** | **RED / BUG CONFIRMED** | SSE stream initiated, server returned 200 text/event-stream |
| T-BYPASS-3 progress currentPhase=2 | >= 400 | **200** | **RED / BUG CONFIRMED** | `current_phase=2` written to DB; GET confirmed the write |
| T-BYPASS-4 final-report seeded step_scores | >= 400 | **200** | **RED / BUG CONFIRMED** | Final report generated with lifecycle=editing; no gate required |
| T-BYPASS-5 (control) incomplete_steps guard | 400 | 400 | **GREEN** | Existing guard works correctly |

**All 4 leak paths confirmed. Guard direction: add `session.lifecycle !== 'gated'` check at the top of each leaky route handler before any business logic.**

### Recommended guard direction

Add a lifecycle prerequisite check at the start of `/message`, `/evaluate-step`, and `/final-report` handlers:
```js
if (!session.lifecycle || !['gated', 'completed'].includes(session.lifecycle)) {
  return res.status(403).json({ error: 'gate_required', message: 'Session must pass gate before proceeding.' });
}
```
For PATCH `/progress`, reject `currentPhase > 1` if `session.lifecycle` is not at least `'gated'`.
