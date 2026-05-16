# Findings Slice — CIRCLES Surfaces (Lane N — 2026-05-17)

## Methodology

Diff master plan §3A expected coverage vs Lane B inventory actual; cite all evidence.

Required reading confirmed before writing:

| Document | Key sections read |
|---|---|
| Master plan `2026-05-17-e2e-integration-coverage-master-plan.md` | §3A (lines 51-64), §4 edge cases, §5 cross-deps, §6 severity defs, §7 seeds |
| Lane B `lane-b-test-inventory-2026-05-17.md` | All sections; anti-pattern flags lines 285-303; coverage gap lines 276-281 |
| Lane C `lane-c-product-surface-map-2026-05-17.md` | FE surfaces lines 12-48, BE endpoints lines 54-114, AppState lines 148-241 |
| `test-architecture.md` | lines 60-77 (E2E vs API vs component decision) |
| `api-testing.md` | lines 1480-1497 (Decision Guide) |
| `crud-testing.md` | Recipe 1 (form CRUD, lines 1-75); CRUD-with-API-verification variation (lines 872-890) |
| `common-pitfalls.md` | Pitfall 11 (lines 597-661), Pitfall 14 (lines 802-858), Pitfall 18 (lines 1034-1097) |

Severity per master plan §6: P0 = integrity/security/data-loss; P1 = UX/hollow/coverage gap; P2 = nice-to-have.

---

## Findings

### F-N-001 — [P0] All CIRCLES Phases: No real browser E2E for complete Phase 1→2→3→4 critical path

- **Surface**: All CIRCLES phases (Home → Phase 4)
- **What's missing**: No single browser-level spec walks a real authenticated user through CIRCLES Home → Phase 1 form fill → gate → Phase 2 chat → evaluate all 7 steps → Phase 3 score → Phase 4 final report. `lifecycle-circles.spec.js` covers API layer only — no browser. The 95 browser E2E specs each cover isolated slices.
- **Evidence**: Lane B coverage gap line 277; Master plan §7 seed F-006 (P0); Master plan §5 cross-deps #1, #2, #3.
- **Severity**: P0
- **Reproduction**: (1) Search tests/ for a spec calling /gate then /message then /evaluate-step ×7 then /final-report in one browser session — none found. (2) Run lifecycle-circles.spec.js — passes API only. (3) No automated guard for phase chain.
- **Recommended fix tier**: Create `tests/e2e/circles-full-flow.spec.js` seeding auth via request.post() using test.step() for each phase boundary per master plan §7 F-006.
- **Cited skill pattern**: `test-architecture.md` 63-65 multi-page workflows; `common-pitfalls.md` Pitfall 19 test.step().

### F-N-002 — [P0] Phase 1.5 Gate: gateInflight concurrent-submit mutex unverified at any tier

- **Surface**: CIRCLES Phase 1.5 Gate (`renderCirclesGate` app.js:4875)
- **What's missing**: gateInflight AppState field (Lane C line 237 "B6 mutex for concurrent gate calls") exists but no test verifies the mutex blocks. circles-gate-contract.spec.js covers shape + auth but not concurrent calls.
- **Evidence**: Master plan §3A gap "Missing: concurrent gate test (gateInflight mutex)"; §4 edge case E-01.
- **Severity**: P0
- **Reproduction**: (1) Two Playwright contexts share same session at Phase 1.5. (2) Promise.all gate submit. (3) No test asserts behavior.
- **Recommended fix tier**: Add Promise.all concurrent-submit API test in tests/api/circles-gate-contract.spec.js.
- **Cited skill pattern**: `multi-user-and-collaboration.md` 306-343 Promise.all simultaneous submit.

### F-N-003 — [P0] Phase 4 Final Report: No real API test for /final-report 422 guard (incomplete step_scores)

- **Surface**: CIRCLES Phase 4 (`renderCirclesPhase4` app.js:645; routes/circles-sessions.js:372)
- **What's missing**: Master plan §5 cross-dep #3 expected test missing; phase4-final.spec.js SEMI-HOLLOW; adversarial tests content not guard.
- **Evidence**: Master plan §3A gap; Lane C endpoint line 70; Lane B line 112.
- **Severity**: P0 data-integrity
- **Reproduction**: (1) Create session, evaluate 3 of 7 steps. (2) Call POST /final-report. (3) Expect 422; regression undetected.
- **Recommended fix tier**: Add tests/api/circles-final-report-contract.spec.js with 422 + 200 shape cases.
- **Cited skill pattern**: `api-testing.md` 1484-1485; `crud-testing.md` Recipe 1 validation 42-61.

### F-N-004 — [P0] Phase 2 Chat: route.fulfill SSE is Pitfall 11; real /message endpoint never hit

- **Surface**: CIRCLES Phase 2 Chat (`renderCirclesPhase2` app.js:862; routes/circles-sessions.js:202)
- **What's missing**: phase2-chat.spec.js + sse-typewriter-perf.spec.js both mock SSE stream. Real /message endpoint never hit by browser. Adversarial only tests content.
- **Evidence**: Master plan §3A gap; Lane B anti-pattern flag line 302; common-pitfalls.md Pitfall 11.
- **Severity**: P0
- **Reproduction**: (1) Run phase2-chat.spec.js — all pass. (2) Remove Content-Type: text/event-stream header. (3) Tests still pass because route.fulfill intercepts.
- **Recommended fix tier**: Add real API-layer SSE test in tests/api/ calling POST /message via request context.
- **Cited skill pattern**: `api-testing.md` 1495-1496; `common-pitfalls.md` Pitfall 11 line 660 carve-out.

### F-N-005 — [P1] CIRCLES Home: Missing real API shape test for GET /api/circles-sessions response schema

- **Surface**: CIRCLES Home (`renderCirclesHome` app.js:5371; routes/circles-sessions.js:109)
- **What's missing**: Master plan §3A expected 3 tests; circles-home.spec.js SEMI-HOLLOW route.fulfill on sessions list.
- **Severity**: P1
- **Recommended fix tier**: Add real API test in tests/api/ calling GET /api/circles-sessions with real auth, asserting required fields.
- **Cited skill pattern**: `api-testing.md` 1484, 1492.

### F-N-006 — [P1] Phase 1 Form (drill): Missing real API test for PATCH /progress payload shape and 401

- **Surface**: CIRCLES Phase 1 Form drill (`renderCirclesPhase1` app.js:5012; routes/circles-sessions.js:294)
- **What's missing**: phase1-form.spec.js SEMI-HOLLOW; lifecycle covers as chain not isolated for shape/401.
- **Severity**: P1
- **Recommended fix tier**: Add tests/api/circles-progress-contract.spec.js with 401, 200, payload shape assertions.
- **Cited skill pattern**: `api-testing.md` 1490; `crud-testing.md` CRUD-with-API-verification 872-890.

### F-N-007 — [P1] Phase 1 Form (sim): Simulation mode API payload not separately tested

- **Surface**: CIRCLES Phase 1 Form simulation
- **What's missing**: Master plan §3A lists sim as distinct surface; circles-simulation.spec.js E2E only, sim-specific PATCH /progress payload (circlesSimStep) not API-tested.
- **Severity**: P1
- **Recommended fix tier**: Extend circles-progress-contract.spec.js with sim-mode payload cases.
- **Cited skill pattern**: `api-testing.md` 1486.

### F-N-008 — [P1] Phase 1.5 Gate: Missing browser E2E for gate OK → Phase 2 transition in DOM

- **Surface**: CIRCLES Phase 1.5 Gate → Phase 2 transition
- **What's missing**: circles-gate.spec.js SEMI-HOLLOW injects gate result via route.fulfill; AppState phase transition (1.5 → 2) not verified.
- **Severity**: P1
- **Recommended fix tier**: Add real browser E2E seeding Phase-1-complete session, submitting gate, asserting .chat-wrap visible.
- **Cited skill pattern**: `test-architecture.md` 63-65 multi-page workflows.

### F-N-009 — [P1] Phase 2 Locked: No real API test for /evaluate-step response schema

- **Surface**: CIRCLES Phase 2 Locked (`renderCirclesPhase2Locked` app.js:1062; routes/circles-sessions.js:253)
- **What's missing**: circles-evaluator.test.js HOLLOW jest.mock('openai') entire SDK; never hits real route.
- **Severity**: P1
- **Recommended fix tier**: Add integration test (OPENAI_API_KEY gated) calling real /evaluate-step asserting response schema.
- **Cited skill pattern**: `api-testing.md` 1492.

### F-N-010 — [P1] Phase 3 Score: No real API sequence test for 7× evaluate-step → score aggregate shape

- **Surface**: CIRCLES Phase 3 Score (`renderCirclesPhase3` app.js:6420)
- **What's missing**: Master plan §5 cross-dep #2 expected test missing; phase3-score.spec.js SEMI-HOLLOW.
- **Severity**: P1
- **Recommended fix tier**: Add tests/api/circles-score-sequence.spec.js evaluating all 7 steps with mocked OpenAI via route.fulfill('**/openai.com/**').
- **Cited skill pattern**: `api-testing.md` 1484; master plan §4 E-09.

### F-N-011 — [P1] Phase 3 Loading/Error: 503 → DOM error propagation not tested at any tier

- **Surface**: Phase 3 Error (`renderPhase3Error` app.js:6233); Phase 3 Loading (`renderPhase3Loading` app.js:6188)
- **What's missing**: phase3-error-loading.spec.js SEMI-HOLLOW; no test triggers real 503 from /evaluate-step + asserts .error-wrap renders.
- **Severity**: P1
- **Recommended fix tier**: Add browser visual spec using route.fulfill({status:503}) on /evaluate-step asserting .error-wrap (Pitfall 11 carve-out).
- **Cited skill pattern**: `common-pitfalls.md` Pitfall 11 line 660 carve-out.

### F-N-012 — [P1] Phase 4 Error/Loading: renderPhase4Error and renderPhase4Loading have no spec at any tier

- **Surface**: Phase 4 Error (`renderPhase4Error` app.js:491); Phase 4 Loading (`renderPhase4Loading` app.js:457)
- **What's missing**: No dedicated spec; phase4-final.spec.js covers success only.
- **Severity**: P1
- **Recommended fix tier**: Add visual spec for error/loading using route.fulfill({status:500}) on /final-report.
- **Cited skill pattern**: `common-pitfalls.md` Pitfall 11 line 660; `test-architecture.md` 76.

### F-N-013 — [P1] Phase 2 Chat (normal): No browser E2E with real /message endpoint

- **Surface**: Phase 2 Chat browser layer
- **What's missing**: Browser-level SSE rendering (ReadableStream, chunk parsing, DOM bubble) distinct from API layer; iOS Safari ReadableStream teardown unverified.
- **Severity**: P1
- **Recommended fix tier**: Create browser E2E (WebKit project) seeding session via API, submitting real message, waiting for .bubble[data-role="assistant"].
- **Cited skill pattern**: `test-architecture.md` 70; master plan §4 E-15.

### F-N-014 — [P1] Phase 2 Conclusion mode: Conclusion panel + sticky bar not tested (especially WebKit)

- **Surface**: Phase 2 conclusion (`circlesPhase2ConclusionMode`; .conclusion-box; .conclusion-actions sticky)
- **What's missing**: No dedicated spec asserts .conclusion-box visible when conclusionMode=true; sticky .conclusion-actions not tested on iPhone SE.
- **Severity**: P1
- **Recommended fix tier**: Dedicated visual spec for Phase 2 conclusion covering Chromium + WebKit (iPhone 14).
- **Cited skill pattern**: `test-architecture.md` 73; master plan §4 E-16 mobile-and-responsive.md 279-322.

### F-N-015 — [P1] Phase 3 → Phase 4: Browser transition not tested at any tier

- **Surface**: Phase 3 Score → Phase 4 Final Report transition
- **What's missing**: phase4-final.spec.js stubs gate/session and jumps to Phase 4 directly; no real Phase 3 → Phase 4 transition test.
- **Severity**: P1
- **Recommended fix tier**: Extend circles-full-flow.spec.js (F-N-001) with test.step() for Phase 3 → Phase 4 transition asserting .radar-svg.
- **Cited skill pattern**: `crud-testing.md` Tip 3 lines 929-931.

### F-N-016 — [P1] CIRCLES Home: NSM cross-promo card + reshuffle behavior not real-browser tested

- **Surface**: CIRCLES Home reshuffle + NSM cross-promo card
- **What's missing**: circles-home.spec.js SEMI-HOLLOW stubs sessions; reshuffle behavior (re-picks 5, not navigates) not asserted vs real bank.
- **Severity**: P1
- **Recommended fix tier**: Replace session-list stub with real seeded data; assert reshuffle re-picks via DOM diff.
- **Cited skill pattern**: `common-pitfalls.md` Pitfall 11 621-637.

### F-N-017 — [P2] Mode Select: Drill→sim mode switch state isolation not tested

- **Surface**: Mode select (circlesMode; .mode-card)
- **What's missing**: Switching modes; circlesDrillStep vs circlesSimStep isolation not asserted.
- **Severity**: P2
- **Recommended fix tier**: Extend circles-simulation.spec.js with afterEach cleanup + fresh mode selection assertion.
- **Cited skill pattern**: `crud-testing.md` Tip 4 lines 932-933.

### F-N-018 — [P2] Phase 3 Score: coach-demo accordion + dim-card expand states not tested

- **Surface**: Phase 3 Score interactive states (circlesPhase3DimExpanded, circlesPhase3CoachDemoOpen)
- **What's missing**: Accordion open/close interaction not tested.
- **Severity**: P2
- **Recommended fix tier**: Visual spec interaction test for Phase 3 accordion states with real session data.
- **Cited skill pattern**: `test-architecture.md` 73; `crud-testing.md` Recipe 1 14-40.

### F-N-019 — [P2] Phase 4 Final: Radar SVG structural assertion missing (only SEMI-HOLLOW stub)

- **Surface**: Phase 4 radar SVG (.radar-svg)
- **What's missing**: phase4-final.spec.js stubs gate/session; no test asserts <path>/<polygon> SVG present.
- **Severity**: P2
- **Recommended fix tier**: Replace stub with real /final-report call (seeded session with 7 steps scored); assert .radar-svg contains expected SVG elements.
- **Cited skill pattern**: `crud-testing.md` CRUD-with-API-verification 872-890.

### F-N-020 — [P2] Phase 1 Hint/Example: /hint and /example endpoints have no real API contract test

- **Surface**: Phase 1 hint modal (routes/circles-sessions.js:411, 430)
- **What's missing**: phase1-hint-modal.spec.js tests UI open/close; hint-routes.test.js SEMI-HOLLOW mocks OpenAI prompt modules; real route not contract-tested.
- **Severity**: P2
- **Recommended fix tier**: Add tests/api/circles-hint-example-contract.spec.js with route.fulfill on **/openai.com/** (acceptable external mock) and real own-route calls.
- **Cited skill pattern**: `api-testing.md` 1492; `common-pitfalls.md` Pitfall 11 660 carve-out.

---

## Summary Table

| ID | Severity | Surface | Key gap |
|---|---|---|---|
| F-N-001 | P0 | All CIRCLES phases | No browser E2E for complete Phase 1→2→3→4 critical path |
| F-N-002 | P0 | Phase 1.5 Gate | gateInflight concurrent-submit mutex unverified |
| F-N-003 | P0 | Phase 4 Final Report | No real API 422 guard test for /final-report + incomplete step_scores |
| F-N-004 | P0 | Phase 2 Chat | route.fulfill SSE = Pitfall 11; real /message endpoint never hit |
| F-N-005 | P1 | CIRCLES Home | GET /api/circles-sessions response schema not API-tested |
| F-N-006 | P1 | Phase 1 Form (drill) | PATCH /progress payload shape + 401 not API-tested |
| F-N-007 | P1 | Phase 1 Form (sim) | Simulation mode API payload not tested separately |
| F-N-008 | P1 | Phase 1.5 Gate | Browser E2E for gate OK → Phase 2 transition missing |
| F-N-009 | P1 | Phase 2 Locked | /evaluate-step response schema not real-API tested |
| F-N-010 | P1 | Phase 3 Score | 7× evaluate-step sequence → score aggregate shape not tested |
| F-N-011 | P1 | Phase 3 Loading/Error | 503 → DOM error propagation not tested at any tier |
| F-N-012 | P1 | Phase 4 Error/Loading | renderPhase4Error and renderPhase4Loading have no spec |
| F-N-013 | P1 | Phase 2 Chat (normal) | No browser E2E with real /message endpoint (WebKit SSE path) |
| F-N-014 | P1 | Phase 2 Conclusion mode | Conclusion panel + sticky bar not tested (especially WebKit) |
| F-N-015 | P1 | Phase 3 → Phase 4 | Phase 3 → Phase 4 browser transition not tested |
| F-N-016 | P1 | CIRCLES Home | NSM cross-promo card + reshuffle behavior not real-browser tested |
| F-N-017 | P2 | Mode Select | Drill→sim mode switch state isolation not tested |
| F-N-018 | P2 | Phase 3 Score | coach-demo accordion + dim-card expand states not tested |
| F-N-019 | P2 | Phase 4 Final | Radar SVG structural assertion missing (only stub) |
| F-N-020 | P2 | Phase 1 Hint/Example | /hint and /example endpoints no real API contract test |

**P0: 4 | P1: 12 | P2: 4 | Total: 20**
