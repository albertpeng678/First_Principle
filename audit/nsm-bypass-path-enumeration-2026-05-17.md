# NSM Gate Bypass Path Enumeration
**Date:** 2026-05-17
**Tracker:** Lane L18 — preventive mirror of L3 for NSM side
**Auditor:** Phase 1 Lane L18 code audit + TDD-red spec
**Reference:** L3 CIRCLES audit `audit/bug6-bypass-path-enumeration-2026-05-17.md` + L5 fix commit `93b1b26`

---

## §1 Backend Path Inventory

| Method | Path | Handler line | Requires prior /gate pass? | Guard mechanism | Risk |
|---|---|---|---|---|---|
| POST | /api/nsm-sessions/:id/gate | nsm-sessions.js:160 | N/A (IS the gate) | Calls reviewNSMGate; sets lifecycle=gated on ok | None — gate itself |
| POST | /api/nsm-sessions/:id/evaluate | nsm-sessions.js:99 | **NO** | Only checks: session ownership (user_id match) | **LEAK** — evaluate can be called with lifecycle='editing' or 'created'; computeLifecycle('analysis_done') immediately returns 'completed' regardless of prior state |
| POST | /api/nsm-sessions/:id/context | nsm-sessions.js:187 | **NO** | Only checks: session ownership | Low risk — read-only AI call, no DB state mutation |
| PATCH | /api/nsm-sessions/:id/progress | nsm-sessions.js:203 | **NO** | lifecycle stripped server-side; computed monotone; currentStep written freely | Medium risk — currentStep can be advanced without gate (data integrity, not state bypass) |
| POST | /api/nsm-sessions/:id/hints | nsm-sessions.js:265 | **NO** | Only checks: session ownership | By design — hint is always available (STANDING RULE: Lock state hint/example always available) |
| POST | /api/guest/nsm-sessions/:id/gate | guest-nsm-sessions.js:123 | N/A (IS the gate) | Same as auth variant | None — gate itself |
| POST | /api/guest/nsm-sessions/:id/evaluate | guest-nsm-sessions.js:89 | **NO** | Only checks: guest_id match | **LEAK** — same as auth variant; computeLifecycle('analysis_done') promotes created/editing → completed |
| POST | /api/guest/nsm-sessions/:id/context | guest-nsm-sessions.js:150 | **NO** | Only checks: guest_id match | Low risk — read-only, no mutation |
| PATCH | /api/guest/nsm-sessions/:id/progress | guest-nsm-sessions.js:169 | **NO** | Same monotone pattern as auth | Medium risk — currentStep writable without gate |
| POST | /api/guest/nsm-sessions/:id/hints | guest-nsm-sessions.js:233 | **NO** | Only checks: guest_id match | By design — hint always available |

**Lifecycle promotion root cause:** `lib/session-lifecycle.js:98` — `if (route === 'analysis_done') return 'completed'` fires unconditionally, regardless of prior lifecycle. A session in `lifecycle='created'` or `lifecycle='editing'` that successfully calls `/evaluate` will be promoted directly to `'completed'`, bypassing the gate state machine entirely.

**Summary:** 1 distinct leak surface (evaluate) × 2 auth variants (auth + guest) = 2 leaky handler instances. CIRCLES had 4 leak surfaces (message, evaluate-step, progress.currentPhase, final-report). NSM has 1 primary leak (evaluate) because NSM has no multi-step eval chain, no currentPhase concept, and no final-report endpoint.

---

## §2 Frontend Handler Inventory

| FE Handler | app.js line | Makes BE call | Gate check before call? | Risk |
|---|---|---|---|---|
| NSM Step 2 submit (`data-nsm-submit`) — gate branch | ~1971 | POST /api/(guest/)nsm-sessions/:id/gate | FE calls gate first; only advances to Step 3 on gate ok (overallStatus=ok/warn) | No bypass — gate is the only path to nsmStep=3 |
| NSM Step 3 submit (`data-nsm-submit`) — evaluate branch | ~2020 | POST /api/(guest/)nsm-sessions/:id/evaluate | No lifecycle/gate check in FE handler | FE relies on gate-controlled navigation to step 3; no BE guard |
| NSM Step 4 retry evaluate (`data-nsm-action="retry-evaluate"`) | ~2521 | POST /api/(guest/)nsm-sessions/:id/evaluate | No lifecycle check | Same leak — re-fires evaluate directly |
| nsmPersistStep | ~2057 | PATCH /api/(guest/)nsm-sessions/:id/progress (currentStep only) | No gate check | No gate bypass; only persists step number |
| triggerNsmSaveCycle | ~2087 | PATCH /api/(guest/)nsm-sessions/:id/progress (userNsm, userBreakdown) | No gate check | Expected — saves draft; no lifecycle mutation |
| ensureNsmDraftSession / ensureNsmSession | ~1746, ~1936 | POST /api/(guest/)nsm-sessions | No gate check | Expected — session creation always available |
| NSM context fetch | ~6192 | GET /api/nsm-context | No gate check | Low risk — read-only |
| NSM step2-hint fetch | ~4135 | POST /api/nsm-public/step2-hint | No gate check | By design — hints always available |
| NSM step3-hint fetch | ~4247 | POST /api/nsm-public/step3-hint | No gate check | By design — hints always available |

**Key FE finding:** The FE enforces gate flow via navigation state (`nsmStep`/`nsmSubTab`). Step 3 evaluate is only reachable in normal flow after a gate ok result. However, the BE has no corresponding guard, so an API caller that bypasses the FE entirely can reach `/evaluate` with any lifecycle value.

---

## §3 Identified Leaks (paths without guard)

### LEAK-NSM-1: POST /evaluate — no lifecycle/gate guard (auth)
- **Path:** POST /api/nsm-sessions/:id/evaluate
- **Missing guard:** No check that `session.lifecycle === 'gated'` (or `'completed'`) before triggering evaluateNSM
- **Impact:** A session in `lifecycle='editing'` (gate not passed) or even `lifecycle='created'` can be evaluated; computeLifecycle with 'analysis_done' returns 'completed' from any prior state
- **Root cause:** `lib/session-lifecycle.js:98` — `if (route === 'analysis_done') return 'completed'` is unconditional
- **File:** routes/nsm-sessions.js:99-156 (no lifecycle guard between lines 99-107)
- **Parallel:** CIRCLES LEAK-1 (evaluate-step) — same pattern, same missing guard

### LEAK-NSM-2: POST /evaluate — no lifecycle/gate guard (guest)
- **Path:** POST /api/guest/nsm-sessions/:id/evaluate
- **Missing guard:** Same as LEAK-NSM-1
- **Impact:** Guest session can be evaluated without gate pass; lifecycle promoted to completed
- **File:** routes/guest-nsm-sessions.js:89-119
- **Parallel:** CIRCLES LEAK-1 guest variant

### Not leaks (by design or low risk):
- **context** (auth + guest): Read-only AI call, no DB state mutation → low risk, acceptable without guard
- **hints** (auth + guest): STANDING RULE — hint/example always available in all lifecycle states
- **progress PATCH** (auth + guest): No lifecycle-gating bypass; currentStep spoofing is a cosmetic data issue (FE reads step, not lifecycle, for navigation); lifecycle remains monotone
- **gate** (auth + guest): IS the gate — no prior gate required

---

## §4 Reproduction Spec Design

**Method:** Service-role seed to set lifecycle='editing' without calling /gate → attempt /evaluate directly → assert >= 400.

**Precondition:** NSM session with lifecycle='editing' (seeded via adminDb.from('nsm_sessions').update({lifecycle:'editing'})).

**Expected behavior (after fix):** 403 with `{ error: 'gate_required' }` analogous to CIRCLES L5 guard pattern:
```js
if (!['gated', 'completed'].includes(session.lifecycle)) {
  return res.status(403).json({ error: 'gate_required', message: '...' });
}
```

**Control test:** Session with lifecycle='gated' (seeded directly) calling /evaluate → should return 200 (or 500 if OpenAI fails, but not 403).

**Tests:**
1. T-NSM-BYPASS-1: POST /evaluate with lifecycle='editing' → expect 403 (auth)
2. T-NSM-BYPASS-2: POST /evaluate with lifecycle='created' → expect 403 (auth)
3. T-NSM-BYPASS-3: POST /evaluate with lifecycle='editing' → expect 403 (guest)
4. T-NSM-CONTROL-1: POST /evaluate with lifecycle='gated' → expect NOT 403 (auth, happy path)

---

## §5 Actual Test Results

Run: `npx playwright test --config tests/api/playwright.config.js tests/api/nsm-no-bypass.spec.js --reporter=list`
Log: `/tmp/L18-run.log`
Result: **3 failed (leaks confirmed), 1 passed (control green)** — 44.3s total

| Test | Path | Lifecycle seeded | Status received | Verdict |
|---|---|---|---|---|
| T-NSM-BYPASS-1 | POST /api/nsm-sessions/:id/evaluate | editing | **200** (BUG) | LEAK CONFIRMED |
| T-NSM-BYPASS-2 | POST /api/nsm-sessions/:id/evaluate | created | **200** (BUG) | LEAK CONFIRMED |
| T-NSM-BYPASS-3 | POST /api/guest/nsm-sessions/:id/evaluate | editing | **200** (BUG) | LEAK CONFIRMED |
| T-NSM-CONTROL-1 | POST /api/nsm-sessions/:id/evaluate | gated | 200 (expected) | GREEN — control passes |

### Evidence detail
- T-NSM-BYPASS-1: `/evaluate` with lifecycle=editing returned 200 + full AI evaluation result (totalScore=84). Lifecycle was promoted to `completed` without gate pass.
- T-NSM-BYPASS-2: `/evaluate` with lifecycle=created returned 200 + full AI evaluation result (totalScore=84). Most egregious bypass — never even started editing.
- T-NSM-BYPASS-3: guest `/evaluate` with lifecycle=editing returned 200 + full AI evaluation result (totalScore=80). Guest variant has identical leak.
- T-NSM-CONTROL-1: `/evaluate` with lifecycle=gated returned 200 + full AI result (totalScore reported). Lifecycle correctly advanced to `completed`. Control is green.

### Fix direction
Add lifecycle guard at the top of both `/evaluate` handlers (auth + guest), mirroring the L5 CIRCLES pattern:
```js
// In nsm-sessions.js POST /:id/evaluate (line 107, after session fetch):
if (!['gated', 'completed'].includes(session.lifecycle)) {
  return res.status(403).json({ error: 'gate_required', message: 'NSM gate must be passed before evaluation.' });
}

// Same guard in guest-nsm-sessions.js POST /:id/evaluate (line 97, after session fetch).
```
