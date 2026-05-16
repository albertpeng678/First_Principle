---
date: 2026-05-17
lane: O — Phase 3 NSM Audit Slice (§3B)
status: FINAL — ready for director consolidation
inputs:
  - docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md §3B (lines 66-75)
  - audit/lane-b-test-inventory-2026-05-17.md (lines 112-145, 260-302)
  - audit/lane-c-product-surface-map-2026-05-17.md (lines 28-36, 91-113)
  - playwright-skill/core/test-architecture.md lines 42-77
  - playwright-skill/core/api-testing.md lines 1480-1497
  - playwright-skill/core/forms-and-validation.md lines 1-80
  - playwright-skill/core/common-pitfalls.md Pitfall 11, 14, 18, 19
  - nsm_plan/nsm_trainer_full_spec.md
---

# Findings Slice — NSM Surfaces (§3B)

## Scope

6 NSM surfaces:
1. NSM Step 1 (question picker — renderNSMStep1 app.js:5947)
2. NSM Step 2 (define NSM — renderNSMStep2 app.js:1290)
3. NSM Step 3 (breakdown — renderNSMStep3 app.js:1649)
4. NSM Step 3 Gate (renderNSMGate app.js:1399)
5. NSM Step 4 evaluator (renderNSMStep4 app.js:2409)
6. NSM Step 4 — 4 sub-tab renderers (app.js:2188/2259/2348/2377)

---

## Summary Table

| ID | Severity | Surface | One-line |
|---|---|---|---|
| N-01 | P0 | NSM Step 3 Gate | No real API contract test for /gate response shape; only adversarial + lifecycle state-assertion exist |
| N-02 | P0 | NSM All Steps | No browser E2E walks Step 1 pick through Step 4 report in one authenticated session |
| N-03 | P0 | NSM Step 2 | Bug A (PATCH /progress user_nsm object reject) covered only by hollow unit logic mirror; zero real-route integration |
| N-04 | P1 | NSM Step 4 (all tabs) | nsm-step-4.spec.js injects nsmEvalResult via AppState; never calls real /evaluate; schema drift undetected |
| N-05 | P1 | NSM Step 2 | PATCH /api/nsm-sessions/:id/progress has no real API response-shape or 401 test outside lifecycle state transitions |
| N-06 | P1 | NSM Step 1 | /api/nsm-sessions/:id/hints happy-path in nsm-hints-real.spec.js asserts status 200 only; response field schema not asserted |
| N-07 | P1 | NSM Step 4 tabs | Tab-switch test uses injected mock eval result; no test verifies real evaluate data renders per tab |
| N-08 | P1 | NSM Step 1 | No E2E test: pick question → POST /nsm-sessions created → advance to Step 2 (nsmStep=2 in DOM) |
| N-09 | P1 | NSM Step 3 | POST /evaluate response 4-dim structure (scores, coachTree, reach/depth/frequency/impact) not asserted at API tier |
| N-10 | P1 | NSM Step 3 Gate | Gate 5-dim rendering covered only by AppState injection; no thread: real /gate → app.js parses → UI renders |
| N-11 | P1 | NSM Step 2/3 iOS | hint-overlay scroll-lock + touch passthrough (style.css:1127) has no WebKit device-profile test for NSM surfaces |
| N-12 | P2 | NSM Step 2 | POST /api/nsm-sessions/:id/context (routes/nsm-sessions.js:157) has zero test coverage at any tier |
| N-13 | P2 | NSM Step 1 | nsm-home-stats.spec.js stubs own /api/nsm-stats via route.fulfill — Partial Pitfall 11; shape drift undetected |
| N-14 | P2 | NSM All Steps | tests/sp4-nsm-context-prefer-pregenerated.test.js permanently dead (vm.createContext + PENDING_PATH_2_REIMPL; all tests silently skip) |

**Counts: P0=3 / P1=8 / P2=3 — Total: 14 findings**

---

## Detailed Findings

---

### N-01 — P0 — NSM Step 3 Gate: No real API contract test for /gate response shape

**Surface**: NSM Step 3 Gate (renderNSMGate app.js:1399; POST /api/nsm-sessions/:id/gate routes/nsm-sessions.js:130)

**What's missing / wrong**: No file in `tests/api/` tests POST /api/nsm-sessions/:id/gate for contract shape. `tests/adversarial/nsm-gate.spec.js` tests adversarial inputs against real OpenAI but does NOT assert response field names (canProceed, overallStatus, 5-dim dimension keys). `lifecycle-nsm.spec.js` SLC-AC7 (line 180) calls /gate and asserts `canProceed: boolean` and `overallStatus in ['ok','warn','error']` — but this is embedded in a lifecycle test and lacks: (a) isolated 401-without-token test, (b) gate-fail 5-dim shape assertion, (c) concurrent gate mutex test (gateInflight AppState:237). The CIRCLES equivalent has `circles-gate-contract.spec.js` (153 LOC, REAL, Lane B line 16) — no NSM counterpart exists.

**Cited evidence**:
- Lane B §A (line 16): circles-gate-contract.spec.js EXISTS (REAL); no nsm-gate-contract.spec.js in tests/api/
- Lane B Coverage Gap (line 278): "NSM Step 3 gate has adversarial + inline visual spec but no real API contract test"
- Master Plan §3B (line 72): "Missing: real API contract test for /gate response shape (no chained API test exists per Lane B:278)"
- Master Plan §7 F-011 (line 240): "NSM gate AI response is verified only in adversarial suite; no chained API test verifies the gate endpoint contract shape"
- Lane C endpoint (line 96): POST /api/nsm-sessions/:id/gate routes/nsm-sessions.js:130

**Reproduction**:
1. Search tests/api/ — no nsm-gate-contract.spec.js found
2. Open lifecycle-nsm.spec.js line 180-224 — gate test asserts lifecycle state only, not 5-dim response shape
3. Open tests/adversarial/nsm-gate.spec.js — adversarial only; no shape assertion, no 401 test

**Recommended fix**: Create `tests/api/nsm-gate-contract.spec.js` mirroring circles-gate-contract.spec.js: 401-without-token, gate-ok shape (canProceed + overallStatus + per-dim keys), gate-fail shape, concurrent-gate mutex test via Promise.all.

**Skill citation**: test-architecture.md line 53 "API integration (contract): Validate response shapes, headers, auth independently"; api-testing.md line 1484 "Validate response status/body/headers → Use API Tests".

---

### N-02 — P0 — NSM All Steps: No browser E2E for complete Step 1 through Step 4 flow

**Surface**: NSM Steps 1–4 (renderNSMStep1 through renderNSMStep4)

**What's missing / wrong**: No single Playwright browser spec walks a real authenticated user through NSM Step 1 (question pick) → Step 2 (define, PATCH progress) → Step 3 (breakdown, PATCH progress) → Step 3 Gate (POST /gate) → Step 4 (POST /evaluate, view report). `lifecycle-nsm.spec.js` covers the API state machine (REAL, request tier) but never opens a browser. `tests/playwright/journeys/nsm.spec.js` covers Step 1 question selection only — stops at card click plus #btn-nsm-step1-next enabled (line 60). The 4-step wizard flow is the highest-value NSM user path; its absence mirrors the CIRCLES full-flow gap (Master Plan F-006 P0).

**Cited evidence**:
- Lane B §K (line 225): nsm.spec.js — "CIRCLES home → NSM → question list → select → step 2"; asserts Next button enabled only
- Master Plan §3B (line 74): "Missing: browser E2E walking all 4 NSM steps in sequence"
- Master Plan §5 cross-dep #4 (line 165-173): NSM Step 4 depends on gate pass + evaluate response; no E2E validates this chain
- Master Plan §4 E-05 (line 117): "Browser refresh mid-NSM Step 2 — E2E — POST /nsm-sessions, PATCH /progress, reload, assert draft"

**Reproduction**:
1. Search tests/ for any spec calling /gate then /evaluate then reading .nsm-step4 in one browser session — none found
2. Confirm nsm.spec.js journey ends at line 60 (Next button enabled); never clicks Next or asserts Step 2
3. Confirm lifecycle-nsm.spec.js is request-only (no page.goto, no browser DOM assertions)

**Recommended fix**: Create `tests/e2e/nsm-full-flow.spec.js` using test.step() for each phase (auth → Step 1 pick → Step 2 fill → Step 3 fill → Gate → Step 4 report); seed auth via request.post() per auth-flows.md:928-949.

**Skill citation**: test-architecture.md line 56 "Onboarding / wizard: Multi-step, state persists across pages → E2E + test.step()"; common-pitfalls.md Pitfall 19 (line 1106) — wrap logical phases in named steps.

---

### N-03 — P0 — NSM Step 2: Bug A PATCH /progress user_nsm object reject covered only by hollow unit

**Surface**: NSM Step 2 (renderNSMStep2 app.js:1290; PATCH /api/nsm-sessions/:id/progress routes/nsm-sessions.js:173)

**What's missing / wrong**: Bug A (triggerNsmSaveCycle sending `user_nsm: string` instead of full object → PATCH /progress data-loss / 400) is documented and "fixed" in `tests/bug6-nsm-persistence-fix.test.js` (line 25). However, this test uses pure local logic mirrors — `buildSavePayload()` is defined locally in the test file (line 29), not imported from app.js or the route handler. No test makes a real PATCH /api/nsm-sessions/:id/progress call with `{userNsm: {nsm, explanation, businessLink}}` and verifies the DB round-trip. `bug6b-persistence.test.js` (1498 LOC, Lane B line 54) covers PATCH /progress with jest.mock('../db/client') — Pitfall 11. If the route handler is refactored to break camelCase destructuring, all existing tests pass but Bug A returns in production.

**Cited evidence**:
- tests/bug6-nsm-persistence-fix.test.js line 6-35: root cause documented + hollow fix contract via local buildSavePayload()
- Lane B §C (line 54): bug6b-persistence.test.js — "HOLLOW — jest.mock('../db/client') inline chain mock"
- Lane B anti-pattern flags (line 296): "Pitfall 11 — inline jest.mock('../db/client') chain mock (1498 LOC, very large)"
- Master Plan §3B (line 71): "Missing: real API test for PATCH /progress for NSM"
- Lane C endpoint (line 98): PATCH /api/nsm-sessions/:id/progress routes/nsm-sessions.js:173; mutates progress_json, current_phase

**Reproduction**:
1. Open bug6-nsm-persistence-fix.test.js line 29 — buildSavePayload() is a local function mirroring app.js behavior
2. Open bug6b-persistence.test.js line 19 — jest.mock('../db/client') present; no real Supabase
3. Search tests/api/ for PATCH /nsm-sessions/:id/progress with real request and response-body assertion — none found

**Recommended fix**: Add a real API test (in lifecycle-nsm.spec.js or new nsm-progress-contract.spec.js): POST /nsm-sessions, PATCH /progress with {userNsm: {nsm, explanation, businessLink}, userBreakdown: {reach,depth,frequency,impact}}, GET /nsm-sessions/:id, assert session.user_nsm is the full object — no jest.mock, real Supabase test DB.

**Skill citation**: common-pitfalls.md Pitfall 11 (line 597): "Only mock external third-party services. Test your own API for real."; api-testing.md line 1486 "Verify form submission creates correct data: API check confirms persistence".

---

### N-04 — P1 — NSM Step 4 tabs: eval result injected via AppState, never from real /evaluate

**Surface**: NSM Step 4 (renderNSMStep4 app.js:2409; 4 sub-tab renderers app.js:2188/2259/2348/2377)

**What's missing / wrong**: `tests/visual/nsm-step-4.spec.js` line 75 injects `MOCK_EVAL_RESULT` directly into `window.AppState.nsmEvalResult` via page.evaluate(). The mock object includes scores, coachTree, coachRationale, bestMove, mainTrap, summary — but never calls the real /evaluate endpoint. If the evaluator prompt changes the response schema (e.g., removes or renames a field), nsm-step-4.spec.js continues to pass while the live Step 4 rendering breaks. This is Pitfall 11 applied to AppState injection rather than route.fulfill. All 4 tab tests use the same injected constant (Lane B line 115: "nsm-step-4.spec.js — SEMI-HOLLOW").

**Cited evidence**:
- tests/visual/nsm-step-4.spec.js line 56-81: setupNSMStep4() uses page.evaluate() to set window.AppState.nsmEvalResult = MOCK_EVAL_RESULT
- Lane B §I (line 115): "nsm-step-4.spec.js — SEMI-HOLLOW"
- Master Plan §3B (line 75): "Missing: dedicated tab-switch + render assertion per tab"
- Master Plan §5 cross-dep #5 (line 170): "nsmBreakdown all 4 dims + nsmEvalResult — no assertion on 422 when dims missing [NEW]"
- common-pitfalls.md Pitfall 18 (line 1034): reserve page.evaluate() for things locators cannot do; injecting entire AppState bypasses all route and service logic

**Reproduction**:
1. Open nsm-step-4.spec.js line 56-81 — setupNSMStep4 does window.AppState.nsmEvalResult = evalResult where evalResult is a local constant
2. Confirm no request.post('/api/nsm-sessions/:id/evaluate') appears anywhere in the file
3. Remove coachTree.reach from MOCK_EVAL_RESULT — comparison tab test still passes; live app would break

**Recommended fix**: Add one tests/api/ test calling real POST /evaluate and asserting top-level schema keys ({scores.{alignment,leading,actionability,simplicity,sensitivity}, coachTree.{nsm,reach,depth,frequency,impact}, bestMove, mainTrap}). Visual tab tests may keep AppState injection for rendering speed once schema is verified at API tier.

**Skill citation**: test-architecture.md line 53 "API integration (contract): Validate response shapes"; api-testing.md line 1492 "Contract/schema regression testing → Use API Tests".

---

### N-05 — P1 — NSM Step 2: PATCH /progress has no real API response-shape or 401 test

**Surface**: NSM Step 2 (renderNSMStep2 app.js:1290; PATCH /api/nsm-sessions/:id/progress routes/nsm-sessions.js:173)

**What's missing / wrong**: Master plan expects 3 real API tests for NSM Step 2 progress: progress-save shape, hints per-field, and 401 (Master Plan §3B line 71). lifecycle-nsm.spec.js SLC-AC5/SLC-AC6 (lines 159-177) verify lifecycle field transitions after PATCH but do NOT assert: response body shape of PATCH /progress, exact DB columns written (progress_json, current_phase), or a direct 401 response when no token is sent to the PATCH endpoint. The hollow bug6b-persistence.test.js (1498 LOC, Pitfall 11) provides no real confidence.

**Cited evidence**:
- Master Plan §3B (line 71): "Missing: real API test for PATCH /progress for NSM; /hints shape test"
- Lane B §C (line 54): bug6b-persistence.test.js — HOLLOW
- Lane C endpoint (line 98): PATCH /api/nsm-sessions/:id/progress routes/nsm-sessions.js:173; mutates progress_json, current_phase
- lifecycle-nsm.spec.js lines 159-177: asserts session.lifecycle after PATCH, not response body or 401

**Reproduction**:
1. Search tests/api/ for PATCH to /api/nsm-sessions/ with assertion on response body (not lifecycle transition) — none found
2. Open lifecycle-nsm.spec.js line 159-177 — only session.lifecycle is asserted, not PATCH response fields
3. Confirm no standalone 401 test for PATCH /api/nsm-sessions/:id/progress at API tier

**Recommended fix**: Extend lifecycle-nsm.spec.js or create nsm-progress-contract.spec.js with: (1) PATCH /progress 200 response body shape assertion, (2) GET /nsm-sessions/:id confirms progress_json round-trip, (3) PATCH without Authorization header → 401.

**Skill citation**: api-testing.md line 1484 "Validate response status/body/headers → Use API Tests, not E2E"; test-architecture.md decision matrix line 46 "CRUD operations: Data integrity → request.patch/get".

---

### N-06 — P1 — NSM Step 1: /hints response shape assertion minimal

**Surface**: NSM Step 1 (renderNSMStep1 app.js:5947; POST /api/nsm-sessions/:id/hints routes/nsm-sessions.js:235)

**What's missing / wrong**: `tests/api/nsm-hints-real.spec.js` lines 312-397 test POST /api/nsm-sessions/:id/hints with a real session and real OpenAI call. The shape assertions after res.json() check only that the response is truthy and status 200 — not that the returned hint structure matches the expected schema (the field names and array structure that prompts/nsm-hints.js is designed to produce). If the prompt is updated to return a different JSON shape, the tests continue to pass. Master Plan §3B (line 70) expects "hints endpoint" as a dedicated API test with shape assertion.

**Cited evidence**:
- tests/api/nsm-hints-real.spec.js lines 358-397: happy-path calls real OpenAI; assertion after res.json() does not validate field-level schema
- Master Plan §3B (line 70): "Missing: real API test for /hints shape"
- Lane C endpoint (line 99): POST /api/nsm-sessions/:id/hints routes/nsm-sessions.js:235; no mutation, returns hint content
- Lane C prompt (line 138): prompts/nsm-hints.js serves NSM Step 1 AI hints

**Reproduction**:
1. Open nsm-hints-real.spec.js lines 358-395 — find assertion block after res.json(); note it checks status 200 and truthy but not field names
2. Modify prompts/nsm-hints.js to return {result: "..."} instead of expected schema — test still passes
3. Compare to circles-gate-contract.spec.js which asserts specific field names (canProceed, overallStatus)

**Recommended fix**: Add explicit schema assertions in nsm-hints-real.spec.js specifying expected top-level keys of the hints response, derived from the structure prompts/nsm-hints.js is designed to produce.

**Skill citation**: api-testing.md decision matrix line 1492 "Contract/schema regression testing → Use API Tests, run in milliseconds".

---

### N-07 — P1 — NSM Step 4 tabs: tab-switch test uses injected mock; no real eval data per tab

**Surface**: NSM Step 4 tab renderers (renderNSMStep4OverviewTab app.js:2188, ComparisonTab 2259, HighlightsTab 2348, DoneTab 2377)

**What's missing / wrong**: The one tab-click test in nsm-step-4.spec.js (line 150: "clicking 對比 tab switches active tab") injects MOCK_EVAL_RESULT via AppState and tests only CSS class toggling. It does not verify that real evaluation result data populates each tab's content fields (e.g., coachTree.reach appears in comparison tab, mainTrap appears in highlights). No test verifies the Done tab's "完成" button triggers a session completion state change. Master Plan §3B (line 75) expects 4 dedicated tab visual tests.

**Cited evidence**:
- nsm-step-4.spec.js line 149-151: tab-click test exists but uses injected AppState mock
- Master Plan §3B (line 75): "Missing: dedicated tab-switch + render assertion per tab"
- Lane C AppState (line 204): nsmReportTab defaults to 'overview'; mutation on tab click (bindNSMStep4)
- Lane C render (line 36): renderNSMStep4DoneTab app.js:2377 — depends on nsmEvalResult

**Reproduction**:
1. Search nsm-step-4.spec.js for request.post — none found; all tab tests use AppState injection
2. Check Done tab test — it renders static injected state; no button-click assertion for completion
3. Confirm no test verifies comparison tab shows real coachTree.reach from an actual /evaluate call

**Recommended fix**: After creating NSM full-flow E2E (N-02), add assertions per tab within that test verifying each tab renders real evaluation data — specifically coachTree fields in comparison tab and bestMove/mainTrap in highlights tab.

**Skill citation**: test-architecture.md line 56 "Multi-step, state persists across pages → E2E + test.step()".

---

### N-08 — P1 — NSM Step 1: No E2E for question pick → session created → nsmStep=2 in DOM

**Surface**: NSM Step 1 (renderNSMStep1 app.js:5947; POST /api/nsm-sessions routes/nsm-sessions.js:18)

**What's missing / wrong**: The journey spec `tests/playwright/journeys/nsm.spec.js` (REAL, Lane B line 225) selects a question card and asserts #btn-nsm-step1-next is enabled (line 60) — but never clicks Next, never asserts POST /api/nsm-sessions was made (nsmSession set), and never confirms .nsm-step2 visible in DOM. This means: (a) the session-creation side-effect of question selection is untested in browser context; (b) the Step 1 → Step 2 transition (most critical NSM navigation) has no E2E coverage. Master Plan §3B (line 70): "Missing: E2E: NSM Step 1 pick → Step 2 start".

**Cited evidence**:
- tests/playwright/journeys/nsm.spec.js line 56-60: asserts #btn-nsm-step1-next enabled but never clicks it or checks Step 2 renders
- Master Plan §3B (line 70): "Missing: E2E: NSM Step 1 pick → Step 2 start"
- Lane C AppState (line 205): nsmSession set on POST /nsm-sessions response; nsmStep advance from 1 to 2

**Reproduction**:
1. Open nsm.spec.js line 60 — test ends after asserting Next button enabled
2. Confirm nsm.spec.js does not navigate to .nsm-step2 or assert session was created via network interception
3. Verify nsm-preflight-session.spec.js — covers session creation in preflight context but not the user-facing Step 1→2 flow

**Recommended fix**: Extend tests/playwright/journeys/nsm.spec.js with a new test that clicks Next after card selection, waits for .nsm-step2 visible, and uses page.waitForResponse() to confirm POST /api/nsm-sessions returned 200.

**Skill citation**: test-architecture.md line 56 "Multi-page workflows where state carries across navigation → E2E".

---

### N-09 — P1 — NSM Step 3: /evaluate response 4-dim structure not asserted at API tier

**Surface**: NSM Step 3 / Step 4 (renderNSMStep3 app.js:1649; POST /api/nsm-sessions/:id/evaluate routes/nsm-sessions.js:94)

**What's missing / wrong**: lifecycle-nsm.spec.js SLC-AC8 (line 228) calls POST /evaluate and asserts only `status=200` and `session.lifecycle=completed` (lines 252-255). It does NOT assert: evalBody.scores.{alignment,leading,actionability,simplicity,sensitivity} are present, evalBody.coachTree.{nsm,reach,depth,frequency,impact} are present, or any of bestMove/mainTrap/summary fields. If the evaluator prompt drops a field, the API test passes while Step 4 rendering breaks. Additionally, no test asserts a validation error (422) when POST /evaluate is called without all 4 breakdown dims filled. Master Plan §3B (line 74) expects "evaluate result shape has all 4 dims" as a dedicated assertion.

**Cited evidence**:
- lifecycle-nsm.spec.js lines 248-255: evalRes status + session.lifecycle only after evaluate call
- Master Plan §3B (line 74): "Missing: browser E2E walking all 4 NSM steps in sequence; dedicated visual for each report tab"
- Master Plan §5 cross-dep #5 (line 170): "no assertion on 422 when dims missing [NEW]"
- nsm_trainer_full_spec.md §3.3: 4 dims listed as Reach/Depth/Frequency/Efficiency — note production uses "impact" not "efficiency"; naming divergence unverified in test suite
- Lane C endpoint (line 95): POST /api/nsm-sessions/:id/evaluate routes/nsm-sessions.js:94; stores in eval_result column

**Reproduction**:
1. Open lifecycle-nsm.spec.js line 252-255 — only status and lifecycle assertions after evaluate call
2. Delete coachTree.reach from evaluator prompt output schema — lifecycle-nsm test still passes
3. Note nsm-step-4.spec.js uses static MOCK_EVAL_RESULT with 5 radar scores; real evaluate prompt must match — unverified

**Recommended fix**: Extend SLC-AC8 to call evalRes.json() and assert top-level schema keys; add a negative test: POST /evaluate on session without prior PATCH /progress with all 4 dims → expect 422 or structured error.

**Skill citation**: api-testing.md decision matrix line 1492 "Contract/schema regression testing → Use API Tests".

---

### N-10 — P1 — NSM Step 3 Gate: Gate 5-dim rendering covered only by AppState injection

**Surface**: NSM Step 3 Gate (renderNSMGate app.js:1399)

**What's missing / wrong**: `tests/visual/nsm-gate-inline.spec.js` (SEMI-HOLLOW, Lane B line 117) sets nsmGateResult via window.AppState.nsmGateResult = MOCK_GATE_RESULT injection through page.evaluate() and asserts 5-dim gate rendering. This tests rendering logic for an injected shape, not that the real /gate endpoint response is correctly parsed by app.js and displayed. No single test thread exists: real POST /gate → response parsed by app.js → gate UI renders → assert .nsm-gate-item count = 5. If app.js mis-parses a key from the real gate response (e.g., a field rename), nsm-gate-inline.spec.js passes while the live gate page renders incorrectly.

**Cited evidence**:
- tests/visual/nsm-gate-inline.spec.js lines 42-78: mockApis() + AppState injection pattern; line 45: stubs /api/nsm-sessions via route.fulfill
- Lane B §I (line 117): "nsm-gate-inline.spec.js — SEMI-HOLLOW"
- Master Plan §3B (line 72): "Missing: real API contract test for /gate response shape"
- common-pitfalls.md Pitfall 11 line 660: "when mocking your own API is acceptable: Testing specific error states — gate success state IS reproducible with a real call"

**Reproduction**:
1. Open nsm-gate-inline.spec.js line 52-75 — setupNSMGate injects nsmGateResult directly into AppState
2. Rename a key in MOCK_GATE_RESULT — visual spec still passes; live app would render incorrectly
3. Confirm no .nsm-gate-item assertion exists from a real /gate response in any test

**Recommended fix**: The N-01 fix (nsm-gate-contract.spec.js) addresses the API layer; also add one E2E assertion in the NSM full-flow (N-02) that reaches gate result via real /gate call and asserts 5 .nsm-gate-item elements visible.

**Skill citation**: common-pitfalls.md Pitfall 11 line 660 — gate success state is reproducible; mocking not justified here.

---

### N-11 — P1 — NSM Step 2/3 iOS: hint-overlay scroll-lock has no WebKit device-profile test

**Surface**: NSM Step 2 hint overlay (.hint-overlay style.css:1127; NSM Step 2/3 hint toggle)

**What's missing / wrong**: Lane C iOS Safari table (line 311) lists .hint-overlay (style.css:1127) as a scroll-lock + touch passthrough risk. `tests/visual/nsm-step2-hint-modal-close-paths.spec.js` (SEMI-HOLLOW, Lane B line 141) tests NSM Step 2 hint modal close paths (X / backdrop / Esc) but without an iOS Safari device profile (hasTouch: true). No WebKit project runs this test. The .hint-overlay is the same CSS class for CIRCLES and NSM; no test uses .tap() with hasTouch: true to verify overlay blocks scroll on mobile. Master Plan E-12 (line 124) expects mobile-and-responsive.md:279-322 .tap() pattern with hasTouch.

**Cited evidence**:
- Lane C iOS Safari table (line 311): ".hint-overlay (fixed inset 0) — Scroll lock + touch passthrough when open — style.css:1127"
- tests/visual/nsm-step2-hint-modal-close-paths.spec.js — SEMI-HOLLOW; no test.use({ ...devices['iPhone SE'] }) or hasTouch: true
- Master Plan §4 E-12 (line 124): ".hint-overlay scroll-lock + touch passthrough — NSM Step 2/3 — style.css:1127 — Visual — mobile-and-responsive.md:279-322 .tap() requires hasTouch: true"

**Reproduction**:
1. Open nsm-step2-hint-modal-close-paths.spec.js — confirm no devices['iPhone SE'] or hasTouch configuration
2. Check Playwright config for NSM visual tests — no dedicated WebKit iPhone project for hint modal
3. Note phase1-hint-modal.spec.js (REAL, Lane B line 155) also lacks this; NSM adds no additional coverage

**Recommended fix**: Add a test.describe block in nsm-step2-hint-modal-close-paths.spec.js with test.use({ ...devices['iPhone SE'] }) that asserts: (1) hint overlay opens via .tap(), (2) scroll behind overlay is blocked (page scroll position unchanged), (3) overlay closes on backdrop tap.

**Skill citation**: test-architecture.md line 52 "Responsive layout — Viewport-specific rendering"; Master Plan E-12 cites mobile-and-responsive.md:279-322.

---

### N-12 — P2 — NSM Step 2: /context endpoint has zero test coverage at any tier

**Surface**: NSM Step 2 (POST /api/nsm-sessions/:id/context routes/nsm-sessions.js:157)

**What's missing / wrong**: The /context endpoint generates AI-based NSM question context and stores it in context_json. It is mounted and active (Lane C line 97). No test at any tier calls this endpoint. The context-card display in Step 2 is visually covered by bounding-box-phase1-invariants.spec.js (line 25) and nsm-context-expand.spec.js, but both inject context via route.fulfill('**/api/nsm-context**') — which stubs the stateless public /api/nsm-context route, NOT the session-bound /api/nsm-sessions/:id/context route. The session-bound context endpoint's 401 guard, response shape, and idempotency are completely untested.

**Cited evidence**:
- Lane C endpoint (line 97): POST /api/nsm-sessions/:id/context routes/nsm-sessions.js:157; auth required; mutates context_json
- tests/visual/bounding-box-phase1-invariants.spec.js line 25: route.fulfill('**/api/nsm-context**') stubs stateless public route, not session-bound route
- tests/visual/nsm-context-expand.spec.js — SEMI-HOLLOW; stubs same stateless public route
- Zero results for /api/nsm-sessions.*context in tests/api/ directory

**Reproduction**:
1. Search tests/api/ for nsm-sessions.*context — no results
2. Search all tests/ for POST to /api/nsm-sessions/:id/context — no results (only /api/nsm-context public stub found)
3. Confirm the session-bound route is distinct from the stateless public /api/nsm-context route (Lane C lines 97 vs 111)

**Recommended fix**: Add 3 tests in lifecycle-nsm.spec.js or nsm-progress-contract.spec.js: (1) POST /context returns 200 with context_json fields, (2) POST /context without auth returns 401, (3) GET /nsm-sessions/:id after /context shows context_json populated.

**Skill citation**: api-testing.md decision matrix line 1484 "Validate response status/body/headers → Use API Tests".

---

### N-13 — P2 — NSM Home stats: /api/nsm-stats stubs own endpoint (Partial Pitfall 11)

**Surface**: NSM Step 1 home (renderNSMStep1 app.js:5947; GET /api/nsm-stats routes/nsm-stats.js:11)

**What's missing / wrong**: `tests/visual/nsm-home-stats.spec.js` line 10 stubs both /api/nsm-stats and /api/guest-nsm-stats via route.fulfill with a hardcoded stats object. This is a partial Pitfall 11 violation — the response shape in the mock may drift from the real API. No real API test for GET /api/nsm-stats exists (the CIRCLES equivalent tests/circles-stats.test.js covers 401 only). If the field names in routes/nsm-stats.js change, the visual test passes while the live stats strip renders incorrectly.

**Cited evidence**:
- tests/visual/nsm-home-stats.spec.js lines 10-11: route.fulfill on own /api/nsm-stats and /api/guest-nsm-stats
- Lane C endpoint (line 112): GET /api/nsm-stats routes/nsm-stats.js:11; auth required
- tests/circles-stats.test.js line 5 (REAL, Lane B line 46): covers 401 for CIRCLES only; no NSM stats equivalent
- Lane B anti-pattern flags (line 301-302): Partial Pitfall 11 pattern for route.fulfill on own stats endpoint
- Master Plan §7 F-007 (line 236): same anti-pattern noted for CIRCLES stats — NSM has identical problem

**Reproduction**:
1. Open nsm-home-stats.spec.js line 10 — route.fulfill on /api/nsm-stats
2. Change the real /api/nsm-stats response shape — visual spec still passes
3. Search tests/api/ for GET /api/nsm-stats — no results

**Recommended fix**: Add a real 401 test for GET /api/nsm-stats (mirroring circles-stats.test.js); update nsm-home-stats.spec.js to verify against the real route response shape or confirm the stub matches the live route.

**Skill citation**: common-pitfalls.md Pitfall 11 line 660 — "200 happy-path for stats IS reproducible; stub not justified".

---

### N-14 — P2 — NSM context source test permanently dead

**Surface**: NSM Step 1 (context source selection logic removed in Path 2)

**What's missing / wrong**: `tests/sp4-nsm-context-prefer-pregenerated.test.js` (62 LOC) uses vm.createContext to extract getNsmContextSource from app.js (Pitfall 11 violation, line 8). The function no longer exists — `PENDING_PATH_2_REIMPL` marker present in app.js. The test silently skips all specs (function not found → it.skip fallback). This file: (a) contributes 62 LOC of dead test code to the suite, (b) appears in NSM coverage tallies when it provides zero coverage, (c) is a Pitfall 11 violation that can never be fixed because the tested function was removed.

**Cited evidence**:
- Lane B §B (line 28): "sp4-nsm-context-prefer-pregenerated.test.js — HOLLOW — vm.createContext; function no longer exists (PENDING_PATH_2_REIMPL marker present)"
- Lane B anti-pattern flags (line 293): "Pitfall 11 — vm.createContext; function no longer exists — test is permanently dead"
- Lane B Caveats (line 311): "test silently skips (function not found → it.skip fallback)"
- Master Plan §7 F-005 (line 234): "Delete test or rewrite against current Path 2 implementation of NSM context selection"

**Reproduction**:
1. Run `npx jest tests/sp4-nsm-context-prefer-pregenerated.test.js --verbose` — all tests show as skipped
2. Open file line 8 — vm.createContext targeting getNsmContextSource
3. Search app.js for getNsmContextSource — absent; PENDING_PATH_2_REIMPL present

**Recommended fix**: Delete tests/sp4-nsm-context-prefer-pregenerated.test.js; if NSM context source selection exists in Path 2 as a different mechanism, write a new test against the current implementation using real imports.

**Skill citation**: common-pitfalls.md Pitfall 11 line 597 "mocked responses drift from the real API"; Pitfall 18 — vm.createContext is the server-side equivalent of page.evaluate() overuse.

---

## Cross-reference: Known Bugs vs Test Coverage

| Bug | Description | Current coverage | Gap |
|---|---|---|---|
| Bug 1 (hint long-wait) | NSM hint resolution blocked by long-running server call | audit-nsm-bug1-hint-longwait.spec.js (SCREENSHOT-ONLY); audit-nsm-bug1-vintageB-hint.spec.js (SCREENSHOT-ONLY) | No regression test prevents re-introduction; screenshot-only captures cannot catch recurrence |
| Bug A (NSM PATCH 400) | triggerNsmSaveCycle sent user_nsm string instead of object; PATCH /progress 400 | tests/bug6-nsm-persistence-fix.test.js (hollow unit logic mirror); bug6b-persistence.test.js (Pitfall 11) | No real API integration test — covered by N-03 |
| Bugs B-G chain | NSM UAT 2026-05-11 batch bugs (accordion content, rationale, etc.) | capture-uat-bug-A-D.spec.js (SCREENSHOT-ONLY) | Screenshot-only; no regression assertions; Bugs B-G not individually regression-guarded |

---

## Skill Citations Summary

| Skill | Line(s) | Applied to |
|---|---|---|
| test-architecture.md decision matrix | 42-58 | N-01, N-02, N-05, N-09: which Trophy tier applies |
| test-architecture.md wizard/multi-step | 56 | N-02, N-07, N-08: NSM steps need E2E with test.step() |
| api-testing.md decision matrix | 1480-1497 | N-01, N-04, N-09, N-12: API contract tests for schema |
| common-pitfalls.md Pitfall 11 | 597-660 | N-03, N-04, N-10, N-13: over-mocking own API or AppState |
| common-pitfalls.md Pitfall 14 | 800-858 | N-03: module-level logic mirrors used as regression tests |
| common-pitfalls.md Pitfall 18 | 1034-1098 | N-04, N-07: AppState injection via page.evaluate() |
| common-pitfalls.md Pitfall 19 | 1106-1186 | N-02: use test.step() for multi-step NSM wizard |
| forms-and-validation.md patterns | 1-80 | N-02, N-08: NSM Step 2/3 form fill via getByLabel |

---

## Escalation Items

1. **N-01 + N-10 block F-011 (Master Plan §7)**: NSM gate contract test was already seeded as F-011. N-01 confirms it remains missing. Create `tests/api/nsm-gate-contract.spec.js` first — it unblocks N-10 by providing a verified real response shape for the visual test to reference.

2. **N-02 blocks N-07 + N-09**: The NSM full-flow E2E (N-02) is the correct vehicle for verifying tab rendering (N-07) and evaluate response integration (N-09). Creating N-02 first resolves three findings.

3. **Bug 1 hint long-wait (screenshot-only, no regression guard)**: Two audit specs exist but provide zero regression protection. If Bug 1 is considered fixed, a regression unit or API test for the hint timeout path should be added. No product surface spec exists for this; escalate to director for explicit regression test mandate.

4. **4-dim field name divergence**: nsm_trainer_full_spec.md §3.3 lists 4th dimension as "Efficiency"; production code uses "Impact" (nsmBreakdown.impact, SUBSTANTIVE_BREAKDOWN.impact in lifecycle-nsm.spec.js line 39). This divergence is undocumented in the test suite. Escalate for spec document correction or confirmation that "Impact" is the canonical term.
