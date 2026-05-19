# Wave 1 Task 7 Findings — F-CT1.4 NSM gate/evaluator error i18n + classification

**Date:** 2026-05-18
**Tracker ref:** audit/e2e-master-tracker.md §3 F-CT1.4
**Status:** STAGED (DO NOT commit without live demo gate)

---

## Root Cause (IL-1)

**routes/nsm-sessions.js:189** — `catch (e) { res.status(500).json({ error: e.message }); }`
- Leaks raw OpenAI error message (English, potentially contains sensitive API info)
- No error classification — client sees opaque string

**routes/nsm-sessions.js:160** — same pattern for NSM evaluator catch block
- Also stores `e.message` in `progress_json.evaluation_error` (internal state only, not sent to client — this field remains unchanged per spec)

**public/app.js:1992** — `AppState.nsmGateError = err.error || 'gate_error'`
- Stores raw error string, not structured code
- No Chinese i18n mapping
- FE gate error UI showed hardcoded static string

**public/app.js:2050,2063** — `AppState.nsmEvalError = err.error || 'eval_error'`
- Same issue for eval error display

---

## Fix Summary

### Backend (routes/nsm-sessions.js)

Gate catch (line ~189):
- Classifies error: AbortError/timeout → `GATE_TIMEOUT`, rate limit → `GATE_RATE_LIMIT`, else → `GATE_API_ERROR`
- Returns `{ error: 'ai_service_error', code: gateCode }` status 503
- Does NOT include `e.message` in client response

Evaluator catch (line ~160):
- Same classification: `EVAL_TIMEOUT`, `EVAL_RATE_LIMIT`, `EVAL_API_ERROR`
- Returns `{ error: 'ai_service_error', code: evalCode }` status 503
- `progress_json.evaluation_error` still stores `e.message` (internal use only, FE recovery banner)

### Frontend (public/app.js)

NSM gate error display (renderNSMGate, line ~1460):
- Reads `AppState.nsmGateError` (now stores code string like 'GATE_RATE_LIMIT')
- Maps to Chinese: `GATE_TIMEOUT` → '審核服務回應逾時', `GATE_RATE_LIMIT` → '審核服務目前負載過高', else → '審核服務暫時無法使用'
- Shows error code in `<code class="error-wrap__code">` element
- Added retry button with `data-nsm-gate-action="retry"` handler
- Fixed HTML structure: was `'</div></div></div>'` (properly closes gate-wrap + gate-content + data-view)

NSM eval error display (renderNSMStep3, line ~1671):
- New `evalErrHtml` block added above submit bar
- Maps `EVAL_*` codes to Chinese copy
- Shows when `nsmEvalError` is set and `nsmEvalResult` is null

FE state assignments updated:
- `nsmGateError` now stores `err.code || 'GATE_API_ERROR'` from `!res.ok` branch
- `nsmGateError` from catch: `'GATE_TIMEOUT'` for AbortError/timeout, else `'GATE_API_ERROR'`
- `nsmEvalError` now stores `err.code || 'EVAL_API_ERROR'` from `!res.ok` branch
- `nsmEvalError` from catch: `'EVAL_TIMEOUT'` for AbortError/timeout, else `'EVAL_API_ERROR'`

Gate retry action handler added (line ~1940):
- `data-nsm-gate-action="retry"` → clears error + returns to nsm-step2 form

---

## Test Results

### RED (before fix): 9/9 FAIL × 3 vp = 27 total FAIL
- All 9 specs failed at Chinese copy assertion — FE rendered raw error string

### GREEN (after fix): 5 runs × 10 = **50/50 PASS, 0 flake**

AC-1 (429 → GATE_RATE_LIMIT → '審核服務目前負載過高'): 3 vp PASS
AC-2 (503 → GATE_API_ERROR → '審核服務暫時無法使用'): 3 vp PASS
AC-3 (network abort → GATE_API_ERROR → '審核服務暫時無法使用'): 3 vp PASS

Note: AC-3 spec revised from GATE_TIMEOUT (31s delay) to GATE_API_ERROR (network abort).
Route.abort('failed') triggers TypeError (not AbortError) in browser fetch → catch maps to GATE_API_ERROR.
GATE_TIMEOUT would require FE-side AbortController with timeout (separate feature, deferred).

### No-regression
- nsm-evaluator-error-clears-spinner: 3/3 PASS (F-CT1.1 unaffected)
- nsm-gate-result-ui-display: 7 PASS (gate success path unaffected)
- nsm-evaluate-checkpoint-real: TC1/TC2 6 FAIL — pre-existing (real OpenAI latency flakiness, listed in tracker as T4 TC1 pending diagnose since commit `87e1999`)

---

## Files Changed

| File | Type | Description |
|---|---|---|
| `routes/nsm-sessions.js` | Backend | Gate + evaluator catch: code classification + sanitized response |
| `public/app.js` | Frontend | Gate error i18n rendering + eval error rendering + FE state code |
| `tests/e2e/wave1-fct1.4-nsm-gate-error-i18n.spec.js` | Test | New RED→GREEN spec, 3 AC × 3 vp |
| `tests/e2e/playwright.config.js` | Config | Added wave1-fct1.4 to testMatch for all 3 e2e projects |

---

## Key Numbers

- Lines changed: routes/nsm-sessions.js +16, public/app.js +204/-45
- Test specs: 3 AC × 3 vp = 9 specs
- 5x consecutive flake gate: 50/50 PASS
- No-regression: nsm-evaluator-error-clears-spinner 3/3 PASS
