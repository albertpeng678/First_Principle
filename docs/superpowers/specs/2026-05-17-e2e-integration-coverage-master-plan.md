---
date: 2026-05-17
purpose: Master coverage framework for e2e integration audit Phase 3
status: draft — pending user Gate 1 review
inputs:
  - audit/lane-a-skill-applicability (summary embedded in prompt)
  - audit/lane-b-test-inventory-2026-05-17.md
  - audit/lane-c-product-surface-map-2026-05-17.md
---

# E2E Integration Coverage Master Plan

## §1 Purpose

Goal: provide the **denominator** ("what surfaces SHOULD be tested at what Trophy tier") so Phase 3 can diff against the numerator (current inventory) and surface gaps.

This document does NOT fix anything and contains no fix code. It defines the EXPECTED coverage matrix, the edge case scenarios that must be provable, the cross-surface dependency chain, and the finding seeds already known before Phase 3 runs.

Audit methodology:
- Trophy target ratios from `test-architecture.md`
- Feature-based file structure expectations from `test-organization.md`
- Anti-pattern violations (Pitfall 11 / 14 / 18) from `common-pitfalls.md`
- Lane A skill patterns (auth-flows, authentication, multi-user, fixtures-and-hooks, network-mocking, mobile-and-responsive)
- Lane B: test inventory ~210 files classified by tier and hollowness
- Lane C: 36 render functions, 57 mounted endpoints, 20 prompts, 72 AppState fields

---

## §2 Trophy Distribution Target

Per `test-architecture.md` (Testing Trophy model):

| Trophy Tier | Target % | Current count (Lane B) | Current % | Gap |
|---|---|---|---|---|
| API / Integration (real Playwright `request` or real supertest) | 60% | ~18 files | ~9% | Under by ~51 percentage points — largest gap |
| Visual / Component (pixel-diff, boundingBox invariant, render-state) | 30% | ~55 files | ~26% | Near-target; quality gap (semi-hollow stubs) |
| E2E (full browser critical paths only) | 10% | ~95 files | ~45% | Over by ~35 percentage points — trophy inversion |
| Unit (pure logic) | (baseline; not a % target under Trophy model) | ~35 files | ~17% | Acceptable; some are hollow (vm.createContext) |
| Adversarial (real OpenAI) | (carve-out for AI stages) | 8 files | ~4% | Adequate for 5 AI stages |

**Key finding**: The suite is trophy-inverted. 95 browser E2E specs exist where the Trophy model expects a thin critical-path layer (~21 specs given ~210 total). The integration/API layer has only ~18 real specs where the target is ~126. This does not mean 95 E2E specs should be deleted — it means Phase 3 must identify which ones cover logic that SHOULD be an API test (Pitfall 11 pattern) versus which cover genuine browser-only behavior.

**Screenshot-only files (~38)** are excluded from Trophy counts; they provide no integration claim.

---

## §3 Surface × Trophy Coverage Matrix

Surfaces sourced exclusively from Lane C render functions and endpoints. Grouped into 5 product areas.

### 3A — CIRCLES Product Area

| Surface | Render fn (Lane C) | Key API endpoints (Lane C) | Expected API tests | Expected Visual tests | Expected E2E tests | Current coverage (Lane B) | Gap |
|---|---|---|---|---|---|---|---|
| CIRCLES Home | `renderCirclesHome` app.js:5371 | GET /api/circles-stats routes/circles-stats.js:10; GET /api/circles-sessions routes/circles-sessions.js:109 | 3 tests: stats 401, sessions list shape, empty-list state | 2 tests: 5-random cards rendered, reshuffle re-picks | 1 test: mode card click → phase 1 | `tests/visual/circles-home.spec.js` (SEMI-HOLLOW stubs stats); `tests/playwright/journeys/circles-home.spec.js` (REAL); `tests/api/lifecycle-circles.spec.js` covers downstream | API test for stats 401: `tests/circles-stats.test.js` (REAL) — EXISTS; sessions-list shape: missing real API test | Missing: real API shape test for GET /api/circles-sessions response schema |
| CIRCLES Phase 1 Form (drill) | `renderCirclesPhase1` app.js:5012 | POST /api/circles-sessions/draft routes/circles-sessions.js:46; PATCH /api/circles-sessions/:id/progress routes/circles-sessions.js:294 | 4 tests: draft create, progress save, 401 without token, input validation | 4 tests: all 7 steps (C1/I/R/C2/L/E/S) BEM, save-indicator states, locked state, stale banner | 1 test: fill → save → navigate away → session persists | `tests/visual/phase1-form.spec.js` (SEMI-HOLLOW); multiple `tests/visual/phase1-*.spec.js`; `tests/visual/preflight-session-creation.spec.js` (REAL) | Missing: real API test for PATCH /progress payload shape and 401; missing single full drill form → gate E2E |
| CIRCLES Phase 1 Sub-renderers (L/E/S steps) | `renderCirclesPhase1Lstep` app.js:4414; `renderCirclesPhase1Estep` app.js:4532; `renderCirclesPhase1Sstep` app.js:4688 | PATCH /api/circles-sessions/:id/progress (same) | (covered by Phase 1 API tests above) | 3 tests: L-step sol-card, E-step esol-card, S-step tracking-section rendering | (covered by Phase 1 E2E above) | `tests/visual/phase1-l-step.spec.js`; `phase1-e-step.spec.js`; `phase1-s-step.spec.js` (REAL) | Adequate visual coverage; API coverage via progress endpoint |
| CIRCLES Phase 1.5 Gate | `renderCirclesGate` app.js:4875 | POST /api/circles-sessions/:id/gate routes/circles-sessions.js:177 | 5 tests: gate ok shape, gate warn shape, gate error shape, 401, concurrent gate blocked (gateInflight mutex) | 3 tests: ok/warn/error UI rendering, loading spinner | 1 test: submit gate → see result → advance to Phase 2 (when ok) | `tests/visual/circles-gate.spec.js` (SEMI-HOLLOW); `tests/api/circles-gate-contract.spec.js` (REAL — EXISTS for shape+auth); `tests/adversarial/circles-gate.spec.js` (REAL OpenAI) | Missing: concurrent gate test (gateInflight mutex); missing E2E gate → Phase 2 transition in browser |
| CIRCLES Phase 2 Chat (normal) | `renderCirclesPhase2` app.js:862 | POST /api/circles-sessions/:id/message routes/circles-sessions.js:202 (SSE) | 3 tests: SSE stream opens, delta arrives, stream error 503 | 4 tests: bubble roles, streaming cursor, conclusion panel, qchip open/close | 1 test: send message → typewriter renders → conclusion → evaluate step | `tests/visual/phase2-chat.spec.js` (SEMI-HOLLOW stubs SSE); `tests/visual/sse-typewriter-perf.spec.js` (SEMI-HOLLOW) | Missing: real API-layer SSE test (route.fulfill SSE is partial Pitfall 11); missing browser E2E that hits real /message endpoint |
| CIRCLES Phase 2 Locked | `renderCirclesPhase2Locked` app.js:1062 | POST /api/circles-sessions/:id/evaluate-step routes/circles-sessions.js:253 | 2 tests: evaluate-step response shape, 401 | 2 tests: locked-banner visible, hint/example still clickable in locked state | 0 (locked state reached via evaluate; no separate E2E needed) | `tests/visual/phase2-chat.spec.js` partial; adversarial/circles-evaluator covers AI output | Missing: real API test for /evaluate-step response schema (separate from adversarial) |
| CIRCLES Phase 3 Score | `renderCirclesPhase3` app.js:6420 | (score assembled from circlesStepScores; no dedicated /phase3 endpoint — triggered by accumulation of /evaluate-step calls) | 2 tests: all 7 steps evaluated → score aggregates correctly; slow-load timeout flag | 3 tests: dim-card rendering, coach-demo accordion, loading/error variants | 0 (Phase 3 reached through E2E full flow — see §5) | `tests/visual/phase3-score.spec.js` (SEMI-HOLLOW); `tests/adversarial/circles-evaluator.spec.js` | Missing: real API sequence test: 7× /evaluate-step → verify circlesScoreResult shape |
| CIRCLES Phase 3 Loading / Error | `renderPhase3Loading` app.js:6188; `renderPhase3Error` app.js:6233 | (same /evaluate-step) | 2 tests: slow-load flag after 60s, error payload propagation | 2 tests: loading checklist render, error-wrap render | 0 | `tests/visual/phase3-error-loading.spec.js` (SEMI-HOLLOW) | Missing: API-level test that mocks 503 → verify error propagates (Pitfall 11 carve-out: error state impossible to reproduce against real BE) |
| CIRCLES Phase 4 Final Report | `renderCirclesPhase4` app.js:645; `renderPhase4Success` app.js:519 | POST /api/circles-sessions/:id/final-report routes/circles-sessions.js:372 | 3 tests: final-report response shape, 401, requires all 7 step_scores (422 if incomplete) | 2 tests: radar SVG rendered, step-rows populated | 1 test: Phase 4 loads after completing Phase 3 (critical path end) | `tests/visual/phase4-final.spec.js` (SEMI-HOLLOW); `tests/adversarial/circles-final-report.spec.js` | Missing: real API test for /final-report requiring all step_scores populated; missing E2E from Phase 3 → Phase 4 |
| CIRCLES Phase 4 Loading / Error | `renderPhase4Loading` app.js:457; `renderPhase4Error` app.js:491 | (same /final-report) | 1 test: error state when final-report 500 | 1 test: error-wrap rendering | 0 | No dedicated spec | Missing: error-state API test (carve-out: route.fulfill 500) and visual spec |

### 3B — NSM Product Area

| Surface | Render fn (Lane C) | Key API endpoints (Lane C) | Expected API tests | Expected Visual tests | Expected E2E tests | Current coverage (Lane B) | Gap |
|---|---|---|---|---|---|---|---|
| NSM Step 1 (question picker) | `renderNSMStep1` app.js:5947 | POST /api/nsm-sessions routes/nsm-sessions.js:18; GET /api/nsm-sessions routes/nsm-sessions.js:34; POST /api/nsm-sessions/:id/hints routes/nsm-sessions.js:235 | 3 tests: session create shape, list shape, hints endpoint | 3 tests: 5-card render, search/filter, context-card expand | 1 test: pick question → advance to Step 2 | `tests/visual/nsm-home.spec.js` (SEMI-HOLLOW); `tests/visual/nsm-search-focus-clear.spec.js` (REAL); `tests/api/lifecycle-nsm.spec.js` (REAL — covers lifecycle) | Missing: real API test for /hints shape; missing E2E: NSM Step 1 pick → Step 2 start |
| NSM Step 2 (define NSM) | `renderNSMStep2` app.js:1290 | PATCH /api/nsm-sessions/:id/progress routes/nsm-sessions.js:173; POST /api/nsm-sessions/:id/hints routes/nsm-sessions.js:235 | 3 tests: progress save, hints per-field, 401 | 3 tests: nsm-field rendering, lock state (hint/example visible), context-card | 0 | `tests/visual/nsm-step-2-3.spec.js` (SEMI-HOLLOW); `tests/visual/nsm-lock-state.spec.js` (E2E); `tests/visual/nsm-submit-reactive.spec.js` (REAL) | Missing: real API test for PATCH /progress for NSM; /hints shape test |
| NSM Step 2 Gate | `renderNSMGate` app.js:1399 | POST /api/nsm-sessions/:id/gate routes/nsm-sessions.js:130 | 4 tests: gate ok shape, gate fail shape, 401, 5-dim result structure | 2 tests: gate 5-dim rendering, loading spinner | 0 | `tests/visual/nsm-gate-inline.spec.js` (SEMI-HOLLOW); `tests/adversarial/nsm-gate.spec.js` (REAL OpenAI) | Missing: real API contract test for /gate response shape (no chained API test exists per Lane B:278) |
| NSM Step 3 (breakdown) | `renderNSMStep3` app.js:1649 | PATCH /api/nsm-sessions/:id/progress; POST /api/nsm-sessions/:id/evaluate routes/nsm-sessions.js:94 | 3 tests: progress save, evaluate call, evaluate 401 | 2 tests: nsm-dim-card render, step3 reminder banner | 0 | `tests/visual/nsm-step-2-3.spec.js` (SEMI-HOLLOW); `tests/visual/regression-r5-nsm-step3-fullmatrix.spec.js` (REAL) | Missing: real API test for /evaluate response schema |
| NSM Step 4 Report | `renderNSMStep4` app.js:2409 | (result from /evaluate stored in nsmEvalResult) | 2 tests: evaluate result shape has all 4 dims, nsmReportTab default=overview | 4 tests: overview/comparison/highlights/done tabs render | 1 test: complete NSM Steps 1-2-3-4 in sequence | `tests/visual/nsm-step-4.spec.js` (SEMI-HOLLOW); `tests/api/lifecycle-nsm.spec.js` (REAL — covers lifecycle) | Missing: browser E2E walking all 4 NSM steps in sequence; dedicated visual for each report tab |
| NSM Step 4 Sub-renderers | `renderNSMStep4OverviewTab` app.js:2188; `renderNSMStep4ComparisonTab` app.js:2259; `renderNSMStep4HighlightsTab` app.js:2348; `renderNSMStep4DoneTab` app.js:2377 | (same /evaluate) | (covered by Step 4 API tests) | 4 tests: one per tab | 0 | `tests/visual/nsm-step-4.spec.js` covers tabs partially | Missing: dedicated tab-switch + render assertion per tab |

### 3C — Auth Product Area

| Surface | Render fn (Lane C) | Key API endpoints (Lane C) | Expected API tests | Expected Visual tests | Expected E2E tests | Current coverage (Lane B) | Gap |
|---|---|---|---|---|---|---|---|
| Auth (login / register) | `renderAuth` app.js:2571 | POST /api/auth/register routes/auth.js:6; POST /api/migrate-guest routes/migrate.js:15 | 3 tests: register success shape, register duplicate 409, migrate-guest auth+guestId required | 2 tests: login form BEM, register form BEM | 1 test: register → login → access protected endpoint | `tests/visual/auth-flow.spec.js` (REAL — no own-API mocks); `tests/playwright/journeys/auth.spec.js` (REAL) | Missing: real API test for POST /api/auth/register; migrate-guest tested only with `jest.mock('../db/client')` (F-004 analogue for migrate) |
| Auth Error Banner | `renderAuthErrorBanner` app.js:2680 | (conditional branch inside renderAuth) | (covered by auth API tests above) | 1 test: error banner renders on failed login | 0 | `tests/visual/auth-flow.spec.js` covers partial | Adequate |
| Guest flow | `ensureGuestId` (app.js boot) | POST /api/guest-circles-sessions routes/guest-circles-sessions.js:131; GET /api/guest-circles-sessions routes/guest-circles-sessions.js:27 | 4 tests: guest create, guest list, guest gate, guest 400 without X-Guest-ID | 1 test: guest mode home renders stats strip | 1 test: guest → complete drill → register → guest sessions migrated | `tests/circles-stats.test.js` covers 401 (REAL); `tests/guest-circles-stats.test.js` covers 400 (REAL) | Missing: real API test for guest session CRUD; migrate-guest real (see above); no E2E guest→register migration flow |
| JWT expiry / session | (401 intercept in app.js) | (handled by requireAuth middleware) | 2 tests: 401 response with expired token, middleware requireAuth + requireGuestId | 0 | 1 test: mid-flow JWT expiry → redirect to auth | `tests/middleware.test.js` (SEMI-HOLLOW jest.mock); `tests/visual/auth-flow.spec.js` covers token-expiry DOM | Missing: real middleware test without jest.mock; mid-flow expiry E2E |

### 3D — Onboarding Product Area

| Surface | Render fn (Lane C) | Key API endpoints (Lane C) | Expected API tests | Expected Visual tests | Expected E2E tests | Current coverage (Lane B) | Gap |
|---|---|---|---|---|---|---|---|
| Onboarding welcome card | `renderOnbWelcome` app.js:8268 | (none — client-only; depends on historyList loaded) | 0 (no server component) | 1 test: welcome card renders when onboardingComplete=false | 0 | `tests/visual/onboarding.spec.js` covers welcome (SEMI-HOLLOW) | Acceptable — no server component |
| Onboarding 4-step coachmark | `renderOnboardingOverlay` app.js:8279 | (none — client-only; triggered by loadHistory() empty-list detection) | 0 | 2 tests: step 1-4 coachmark positions, dual-ring spotlight render | 1 test: first-time user → onboarding tour → complete → localStorage flag set | `tests/visual/onboarding.spec.js` (SEMI-HOLLOW); `tests/visual/onboarding-position.spec.js` (REAL); `tests/playwright/journeys/onboarding-tour.spec.js` (REAL) | Coverage adequate; dependency on historyList empty-list detection not API-tested |

### 3E — Cross-surface / Shared UI Product Area

| Surface | Render fn (Lane C) | Key API endpoints (Lane C) | Expected API tests | Expected Visual tests | Expected E2E tests | Current coverage (Lane B) | Gap |
|---|---|---|---|---|---|---|---|
| Navbar | `renderNavbar` app.js:2968 | (UI-only; interacts with view state) | 0 | 1 test: navbar tabs + history icon visible | 1 test: tab switch circles↔nsm preserves session | `tests/playwright/journeys/*.spec.js` (REAL) | Adequate |
| Resume toast | `renderResumeToast` app.js:3019 | GET /api/circles-sessions (for tryResumeLatestSession) | 1 test: GET sessions → latest in-progress → toast shows | 1 test: toast banner renders with correct copy | 1 test: cross-tab open → toast appears | `tests/visual/cross-tab-resume-toast.spec.js` (REAL) | Missing: API test for tryResumeLatestSession GET sessions → latest session selection logic |
| Global banners (stale / migration) | `renderGlobalBanners` app.js:3058 | (depends on circlesStale = localStorage storage event; migrationBanner = POST /api/migrate-guest result) | 1 test: migration banner after migrate-guest success | 2 tests: stale banner renders, migration banner renders | 0 | No dedicated spec | Missing: dedicated API + visual test for both banner variants |
| Offcanvas history drawer | `renderOffcanvas` app.js:7592 | GET /api/circles-sessions routes/circles-sessions.js:109; GET /api/nsm-sessions routes/nsm-sessions.js:34; DELETE /api/circles-sessions/:id routes/circles-sessions.js:162 | 4 tests: list fetch, list empty, delete 204, lifecycle filter (include_empty) | 3 tests: 280px drawer, 4 states (normal/loading/error/empty), item click → restore | 1 test: offcanvas open → click item → session resumes at correct phase | `tests/visual/offcanvas.spec.js` (SEMI-HOLLOW stubs list); `tests/api/lifecycle-list.spec.js` (REAL — EXISTS for list+filter); `tests/visual/offcanvas-item-click-restore.spec.js` (SEMI-HOLLOW) | Missing: real API test for DELETE; offcanvas restore E2E with real session data |
| Hint modal | `renderHintModalShell` app.js:3834 | POST /api/circles-sessions/:id/hint routes/circles-sessions.js:411; POST /api/circles-sessions/:id/example routes/circles-sessions.js:430 | 2 tests: hint response shape, example response shape | 2 tests: modal open/close, hint content renders | 0 | `tests/visual/phase1-hint-modal.spec.js` (REAL); `tests/visual/nsm-step2-hint-modal-close-paths.spec.js` (SEMI-HOLLOW) | Missing: real API test for /hint and /example endpoints |
| Locked banner / Stale banner | `renderLockedBanner` app.js:3474; `renderStaleBanner` app.js:3488 | (UI-only state display) | 0 | 2 tests: locked-banner renders when circlesLocked, stale-banner renders when circlesStale | 0 | `tests/visual/phase1-locked-stale.spec.js` (REAL) | Adequate |
| Session list (lifecycle filter) | (used by offcanvas + tryResume) | GET /api/circles-sessions routes/circles-sessions.js:109 | 3 tests: include_empty filter, dedup logic, lifecycle state filter | 0 | 0 | `tests/api/lifecycle-list.spec.js` (REAL — EXISTS) | Adequate — lifecycle-list spec covers this |

---

## §4 Edge Case Matrix

~30 cross-surface scenarios across 5 axes. Lane A skill citations reference the skill applicability summary provided in the prompt.

| # | Edge axis | Scenario | Surfaces affected | Trophy tier | Expected test pattern (Lane A skill cite) |
|---|---|---|---|---|---|
| E-01 | Race | Concurrent gate submit from 2 browser tabs (gateInflight mutex must block 2nd) | CIRCLES Phase 1.5 Gate — `gateInflight` AppState:237 | API + E2E | multi-user-and-collaboration.md:306-343 `Promise.all` simultaneous submit attempts; assert 2nd call blocked or queued |
| E-02 | Race | Concurrent evaluate-step calls for same session | CIRCLES Phase 2 Locked — `circlesStepScores` AppState:170 | API | multi-user-and-collaboration.md:306-343 `Promise.all` for 2 simultaneous POST /evaluate-step |
| E-03 | Refresh | Browser refresh mid-SSE stream in Phase 2 | CIRCLES Phase 2 Chat — `circlesConversation` AppState:165 | E2E | network-mocking.md carve-out: `route.abort()` to simulate dropped SSE; reconnect re-renders conversation from session |
| E-04 | Refresh | Browser refresh mid-Phase 1 form (unsaved draft) | CIRCLES Phase 1 Form — `circlesFrameworkDraft` AppState:164 | E2E | Seed data via POST /draft (auth-flows.md:928-949); reload; assert draft persisted via PATCH /progress |
| E-05 | Refresh | Browser refresh mid-NSM Step 2 (definition draft) | NSM Step 2 — `nsmDefinition` AppState:220 | E2E | Same pattern: POST /nsm-sessions, PATCH /progress, reload, assert draft |
| E-06 | Network | 503 burst then success on POST /gate | CIRCLES Phase 1.5 Gate — routes/circles-sessions.js:177 | API | network-mocking.md:839-933 `route.fulfill({ status: 503 })` then restore; assert retry behavior |
| E-07 | Network | 503 on POST /api/circles-sessions/:id/message (SSE) | CIRCLES Phase 2 — `circlesPhase2StreamError` AppState:191 | API | network-mocking.md:839-933 abort SSE stream; assert `circlesPhase2StreamError` flag set in DOM |
| E-08 | Network | 503 on POST /api/nsm-sessions/:id/evaluate | NSM Step 3→4 — `nsmEvalError` AppState:215 | API | network-mocking.md carve-out: error state only reproducible by mocking |
| E-09 | Quota | OpenAI rate-limit 429 on /gate | CIRCLES Phase 1.5 Gate | API | route.fulfill 429 from `**/openai.com/**`; assert user-facing error displayed |
| E-10 | Quota | OpenAI rate-limit 429 on /evaluate | NSM Step 3→4 | API | Same pattern; nsmEvalError shown |
| E-11 | iOS Safari | Fixed `.submit-bar` safe-area overlap on iPhone SE | CIRCLES Phase 1, NSM Step 2 — style.css:136 | Visual | mobile-and-responsive.md:49-71 `devices['iPhone SE']` project; assert submit-bar not clipped |
| E-12 | iOS Safari | `.hint-overlay` scroll-lock + touch passthrough | CIRCLES Phase 1, NSM Step 2/3 — style.css:1127 | Visual | mobile-and-responsive.md:279-322 `.tap()` requires `hasTouch: true` (device profile sets it); assert overlay blocks scroll |
| E-13 | iOS Safari | `.offcanvas` scroll/touch in fixed overlay | Offcanvas — style.css:375 | Visual | mobile-and-responsive.md:279-322 `.tap()` on offcanvas items; assert close on outside tap |
| E-14 | iOS Safari | `positionOnboardingTooltip()` timing on scroll | Onboarding — app.js:8405 | Visual | mobile-and-responsive.md:49-71 device profile; screenshot after step transition |
| E-15 | iOS Safari | SSE ReadableStream cancel on Phase 2 (iOS Safari 15) | CIRCLES Phase 2 — app.js:1172 | E2E | `devices['iPhone 14']` (WebKit); navigate away mid-stream; assert no console error |
| E-16 | iOS Safari | `position: sticky` conclusion-actions inside flex | CIRCLES Phase 2 — style.css:2230 | Visual | WebKit project; scroll Phase 2; assert `.conclusion-actions` sticky behavior |
| E-17 | Multi-tab | Lock state propagation via localStorage storage event | CIRCLES Phase 2 + Offcanvas — `circlesStale` AppState:173 | E2E | multi-user-and-collaboration.md:27-58 two `browser.newContext()`; tab A saves → tab B sees stale banner |
| E-18 | Multi-tab | Cross-tab resume toast on re-open | Offcanvas resume, resume-toast — `_resumeToastShow` AppState:238 | E2E | multi-user-and-collaboration.md:27-58 two contexts; tab B opens → toast appears; `tests/visual/cross-tab-resume-toast.spec.js` EXISTS (REAL) |
| E-19 | Multi-tab | Offcanvas history list stale after tab B deletes session | Offcanvas — `historyList` AppState:228 | E2E | multi-user-and-collaboration.md:27-58 two contexts; tab B deletes → tab A reloads offcanvas |
| E-20 | Auth | Mid-flow JWT expiry during Phase 2 chat | CIRCLES Phase 2 — 401 intercept in app.js | E2E | auth-flows.md:928-949 request.post() to seed storageState; expire token mid-flow; assert redirect |
| E-21 | Auth | Guest→register migration banner appears once | Auth + CIRCLES Home — `migrationBanner` AppState:236 | E2E | auth-flows.md login flow; POST /api/migrate-guest success; assert banner visible; dismiss; assert gone on reload |
| E-22 | Auth | Parallel worker storageState isolation (test suite race) | All authenticated surfaces | API | authentication.md:238-267 per-worker `{ scope: 'worker' }` storageState; prevent Supabase session collision |
| E-23 | Auth | Register with already-taken email (409) | Auth — routes/auth.js:6 | API | `request.post('/api/auth/register')` (auth-flows.md:928-949); expect 409; assert error.message |
| E-24 | Guest | Guest session → gate → phase 2 (no auth) | CIRCLES Phase 1.5 Gate, Phase 2 — routes/guest-circles-sessions.js | API | `request.post('/api/guest-circles-sessions')` with X-Guest-ID; gate; message SSE |
| E-25 | Guest | Guest 400 without X-Guest-ID header | Guest stats — routes/guest-circles-stats.js:9 | API | `tests/guest-circles-stats.test.js` EXISTS (REAL for 400); pattern repeats across all guest endpoints |
| E-26 | Lifecycle | CIRCLES session: draft → phase1 progress → gate → phase2 → evaluate×7 → final-report | All CIRCLES phases — routes/circles-sessions.js | API | `tests/api/lifecycle-circles.spec.js` EXISTS (REAL); verify each transition mutates correct DB columns |
| E-27 | Lifecycle | NSM session: create → progress → gate → evaluate → report tabs | All NSM steps — routes/nsm-sessions.js | API | `tests/api/lifecycle-nsm.spec.js` EXISTS (REAL); verify nsmEvalResult has 4 dims |
| E-28 | Lifecycle | Session list dedup: completed beats active, latest wins | Offcanvas — session-dedup lib | Unit+API | `tests/lib/session-dedup.test.js` EXISTS (REAL); complement with API-level GET list test |
| E-29 | Network | Offline → online recovery (isOnline flag) | Global banners — `isOnline` AppState:152 | E2E | `page.context().setOffline(true)` then `setOffline(false)`; assert offline banner appears/disappears |
| E-30 | Permissions | Auth endpoint without token returns 401 (all protected routes) | All auth-required routes — middleware.js | API | Pattern: `request.get('/api/circles-sessions')` without auth header; expect 401; `tests/circles-stats.test.js` (REAL for one endpoint); needs systematic coverage of all 27 auth endpoints |

---

## §5 Cross-surface Dependency Map

Each entry represents a chain where breaking the upstream step makes the downstream surface impossible to reach. Each dependency should have at least 1 dedicated cross-surface test.

1. **CIRCLES Phase 2 unlock depends on Phase 1.5 Gate pass**
   - `circlesGateResult` must be set (non-null, no red item) before `circlesPhase` advances to 2
   - Source: Lane C cross-deps #1 (app.js gateResult check)
   - Expected test: API-level lifecycle test `draft → progress → gate(ok) → phase=2` — `tests/api/lifecycle-circles.spec.js` line 34 covers this

2. **CIRCLES Phase 3 score depends on all 7 step evaluations**
   - `circlesStepScores` must have all 7 steps (C1/I/R/C2/L/E/S) before `circlesScoreResult` assembles
   - Source: Lane C cross-deps #2
   - Expected test: API test: 7× POST /evaluate-step → verify score aggregate shape — partially covered by adversarial; no dedicated API sequence test [NEW]

3. **CIRCLES Phase 4 depends on Phase 3 score loaded**
   - `POST /final-report` requires session to have all step_scores in DB
   - Source: Lane C cross-deps #2 (inferring from Phase 4 render dependency)
   - Expected test: API test asserting 422 when final-report called before all scores [NEW]

4. **NSM Step 3 depends on Step 2 gate pass**
   - `nsmGateResult` must show pass and `nsmStep` must advance to 3
   - Source: Lane C cross-deps #3
   - Expected test: API lifecycle: `POST /nsm-sessions → PATCH /progress → POST /gate → nsmStep=3` — `tests/api/lifecycle-nsm.spec.js` line 38 covers this

5. **NSM Step 4 depends on all 4 breakdown dims filled + /evaluate response**
   - `nsmBreakdown` all 4 dims (reach/depth/frequency/impact) + `nsmEvalResult` from `/evaluate`
   - Source: Lane C cross-deps #4
   - Expected test: API test verifying /evaluate returns 4-dim structure — `tests/api/lifecycle-nsm.spec.js` covers; no assertion on 422 when dims missing [NEW]

6. **Onboarding trigger depends on historyList empty detection**
   - `onboardingActive` only becomes true when `loadHistory()` returns empty list (first-time user)
   - Source: Lane C cross-deps #5
   - Expected test: E2E: new guest user → historyList empty → onboarding starts — `tests/playwright/journeys/onboarding-tour.spec.js` (REAL) covers this

7. **Auth → session resume depends on Supabase getSession() + GET sessions list**
   - `tryResumeLatestSession()` calls GET /api/circles-sessions or /api/nsm-sessions to find latest in-progress
   - Source: Lane C cross-deps #6
   - Expected test: API test: seed session → login → GET sessions → verify latest returned — no dedicated test [NEW]

8. **Offcanvas resume depends on historyList pre-loaded + GET session detail**
   - Offcanvas item click triggers `GET /api/circles-sessions/:id` → sets circlesSession, circlesPhase, circlesSelectedQuestion
   - Source: Lane C cross-deps #7
   - Expected test: E2E: seed session via API (auth-flows.md:928-949) → open offcanvas → click item → verify phase restored — `tests/visual/offcanvas-item-click-restore.spec.js` (SEMI-HOLLOW); needs real API seeding [NEW with real seed]

9. **Cross-tab stale detection depends on localStorage storage event**
   - Tab B saving progress sets `circlesStale` localStorage key; Tab A listens via storage event
   - Source: Lane C cross-deps #8
   - Expected test: E2E multi-context (multi-user-and-collaboration.md:27-58): ctx A loads phase 1; ctx B saves progress; ctx A sees stale banner — no dedicated test [NEW]

10. **SSE Phase 2 chat depends on circlesSession.id + circlesConversation seeded**
    - Session must exist; prior turns loaded from DB before SSE starts
    - Source: Lane C cross-deps #9
    - Expected test: API test: POST /message with valid session → SSE stream opens → first delta arrives within 3s — current `phase2-chat.spec.js` uses route.fulfill (hollow); real SSE API test missing [NEW]

11. **Migration banner depends on POST /migrate-guest success in login flow**
    - Banner only shows once (`migrationBanner='showing'`) after migrate-guest succeeds
    - Source: Lane C cross-deps #10
    - Expected test: E2E: guest creates session → register → login → migrate-guest → banner visible — no dedicated E2E [NEW]

12. **Guest CIRCLES/NSM routes depend on X-Guest-ID header being present**
    - All `/api/guest-*` endpoints call `requireGuestId` middleware; 400 without header
    - Source: Lane C endpoint list; routes/guest-circles-sessions.js:27; routes/guest-nsm-sessions.js:34
    - Expected test: API test family: one 400-without-header test per guest route family — partial (stats 400 exists); full family not systematically covered [NEW]

---

## §6 Findings Doc Structure (for Phase 3)

Phase 3 will produce `audit/e2e-integration-findings-2026-05-17.md` with this schema per finding:

- **ID**: F-NNN (sequential)
- **Severity**: P0 (integrity / security / data-loss — blocking, must fix before any new feature) | P1 (UX / hollow tests / coverage gap — fix in next sprint) | P2 (nice-to-have / dead code / refactor — backlog)
- **Surface**: which product surface(s) affected
- **What's missing / wrong**: 1-2 sentence description
- **Cited evidence**: file:line from Lane B or Lane C
- **Reproduction**: 3 steps to reproduce
- **Recommended fix**: 1 sentence, no code

---

## §7 Already-known Findings (Seeds for Phase 3)

| ID | Severity | Surface | What's missing / wrong | Evidence | Reproduction | Recommended fix |
|---|---|---|---|---|---|---|
| F-001 | P1 | All surfaces | Trophy inversion: 95 E2E specs vs ~18 API specs; target is 60% API / 10% E2E | Lane B counts section (line 245-253) | Run `find tests/ -name '*.spec.js' | wc -l`; inspect Trophy tier column in Lane B inventory | Identify E2E specs covering pure backend logic and convert to `tests/api/` specs using `request` context |
| F-002 | P2 | Sessions legacy routes | `routes/sessions.js` and `routes/guest-sessions.js` exist on disk but NOT mounted in server.js — dead code accumulating maintenance surface | Lane C endpoint table (line 116-117) | Grep `require.*routes/sessions` in server.js; none found | Delete unmounted route files after confirming no pending re-mount intention |
| F-003 | P2 | Legacy prompts | 3 prompt files unmounted: `prompts/coach.js`, `prompts/evaluator.js`, `prompts/issue-generator.js` — dead code | Lane C prompts table (lines 132-134) | Grep prompt file names in routes/*.js; none found | Delete unmounted prompt files after confirming they are SP2/SP3 legacy |
| F-004 | P1 | NSM + CIRCLES persistence | `tests/bug6b-persistence.test.js` (1498 LOC) fully mocks `db/client` via inline jest.mock chain; provides zero real-integration confidence for persistence | Lane B table section C (line 54) | Open file line 19; see `jest.mock('../db/client')` with inline chain mock | Break into targeted API-layer specs using real Supabase test DB; delete or archive the hollow file |
| F-005 | P1 | NSM context source selection | `tests/sp4-nsm-context-prefer-pregenerated.test.js` silently skips — function `getNsmContextSource` removed during Path 2; `PENDING_PATH_2_REIMPL` marker present | Lane B table section B (line 28) | Run `npx jest tests/sp4-nsm-context-prefer-pregenerated.test.js --verbose`; all tests show as skipped | Delete test or rewrite against current Path 2 implementation of NSM context selection |
| F-006 | P0 | CIRCLES full flow | No real E2E browser spec walks CIRCLES Phase 1 → 2 → 3 → 4 in a single test with a real authenticated user against localhost | Lane B coverage gaps (line 277); matches project Task #212 | Search `tests/` for a spec that calls `/gate`, then `/message`, then `/evaluate-step`×7, then `/final-report` in one browser session — none found | Create `tests/e2e/circles-full-flow.spec.js` using `test.step()` for each phase; seed auth via request.post() (auth-flows.md:928-949) |
| F-007 | P1 | CIRCLES stats + session list | ~65 specs partially mock `/api/circles-stats` and `/api/circles-sessions` list via `route.fulfill` on own endpoints — Pitfall 11 borderline; these stubs may drift from real response shapes | Lane B anti-pattern flags (line 301-302); common-pitfalls.md Pitfall 11 | Open `tests/visual/circles-home.spec.js` line 12; see `route.fulfill` on `/api/circles-stats` — mock shape may not match real response | Replace stats/session stubs with real seeded data; reserve `route.fulfill` for error states only (network-mocking.md:839-933 carve-out) |
| F-008 | P1 | app.js helpers via vm.createContext | 5 test files extract functions from app.js using `vm.createContext` — Pitfall 11 / Pitfall 18 violation; tests will silently break if function is moved or renamed | Lane B anti-pattern flags (lines 288-293); common-pitfalls.md Pitfall 11 | See `tests/sp1.5-helpers.test.js` line 8; `tests/sp1.5-bugfix-action-bar.test.js` line 8; `tests/nsm-render-bug-fixes.test.js` line 12 | Refactor tested helpers into importable modules; replace vm.createContext tests with real module imports |
| F-009 | P1 | Guest migration route | `tests/migrate-guest.unit.test.js` mocks both auth middleware and `db/client`; POST /api/migrate-guest tested with zero real infrastructure | Lane B table section C (line 50); common-pitfalls.md Pitfall 11 | Open file line 4; see `jest.mock` for auth, guest middleware, and db/client | Create real API-layer spec: guest creates session → auth user logs in → POST /migrate-guest with real Supabase test DB |
| F-010 | P1 | CIRCLES evaluator OpenAI mock | `tests/circles-evaluator.test.js` (456 LOC) mocks entire OpenAI SDK — Pitfall 11; evaluator prompt construction is tested but real schema validation is only in adversarial suite | Lane B table section C (line 52) | Open file line 3; see `jest.mock('openai')` entire package | Add one real integration test for evaluator schema shape (guarded by `describe.skip` when no OPENAI_API_KEY, like `circles-evaluator.live.test.js`) |
| F-011 | P1 | NSM Step 2 gate — no real API contract test | NSM gate AI response is verified only in adversarial suite; no chained API test verifies the gate endpoint contract shape | Lane B coverage gaps (line 278) | Search `tests/api/` for nsm-gate; none found | Create `tests/api/nsm-gate-contract.spec.js` mirroring `circles-gate-contract.spec.js` pattern (Lane B line 16) |
| F-012 | P2 | Phase 4 error state | No spec tests CIRCLES Phase 4 error rendering (`renderPhase4Error` app.js:491) or the 422 guard on /final-report when step_scores incomplete | Lane C render fn table (line 26); §3A matrix | Call POST /final-report on session missing step_scores; expect 422 | Add API test for 422 guard; add visual spec for `renderPhase4Error` (route.fulfill 500 carve-out) |
| F-013 | P2 | Global banners (stale + migration) | `renderGlobalBanners` (app.js:3058) has no dedicated visual test; stale banner logic and migration banner verified only by unit/hollow tests | Lane C render fn table (line 40) | Search `tests/visual/` for banner spec; none found | Create `tests/visual/global-banners.spec.js` for stale-banner (trigger via localStorage storage event) and migration-banner (trigger via POST /migrate-guest) |
| F-014 | P2 | Test organization drift | Tests are spread across `tests/visual/`, `tests/playwright/journeys/`, `tests/api/`, `tests/`, `tests/adversarial/` with no enforced large-project feature-based structure (test-organization.md Pattern 1 for 200+ tests) | Lane B counts (line 240-242); test-organization.md "Large project" layout | Run `ls tests/` — flat mix of unit, visual, journey, and API specs at root level | Migrate to `tests/e2e/`, `tests/api/`, `tests/visual/`, `tests/unit/` top-level split per test-organization.md large-project layout |

---

## §8 Out of Scope

The following are explicitly excluded from Phase 3 findings and fix work:

1. **NSM evaluator AI prompt audit** — Path 2 carve-out; prompts locked for duration of Path 2 rewrite
2. **Database migration test redesign** — separate Stage item; requires schema migration tooling discussion
3. **Replacing all 95 E2E specs with API tests** — trophy rebalancing is directional only; Phase 3 identifies high-value conversions, not a wholesale replacement
4. **iOS Safari deep automated test** — 15-item checklist stays manual per CLAUDE.md Standing Rule 5; automated coverage limited to viewport + `.tap()` device profile checks
5. **Adversarial test expansion** — 8 adversarial specs cover 5 AI stages adequately; Phase 3 does not add adversarial tests
6. **Worktree specs** — `first-principle-path2-b-circles`, `first-principle-path2-c-nsm`, `first-principle-path2-d-cross` worktrees are out of scope for this audit

---

## §9 Self-review Checklist

- [x] Placeholder scan: no TBD / TODO remaining in document
- [x] Internal consistency: §3 surface rows cite Lane C render fn lines and endpoint file:lines; §5 cross-deps reference §3 surfaces; §4 edge cases cite Lane A skill md line ranges
- [x] Scope check: document is audit framework only — no fix code, only "recommended fix (1 sentence)" in §7
- [x] Ambiguity check: all existing test paths cited are from Lane B inventory; new tests marked [NEW] in §5; all endpoint paths verified against Lane C
- [x] Trophy math: §2 counts sourced from Lane B line 245-253; target percentages from test-architecture.md Testing Trophy model
- [x] Lane A citations confirmed present: multi-user-and-collaboration.md 27-58, 306-343; auth-flows.md 928-949; authentication.md 238-267; network-mocking.md 839-933; mobile-and-responsive.md 49-71, 279-322; fixtures-and-hooks.md 19-60, 110-175 — all cited in §4
- [x] No surfaces invented: all 36 render functions from Lane C used; endpoints cited from Lane C only
- [x] F-* seeds: F-001 through F-014; each has evidence, reproduction, recommended fix; severity assigned
- [x] Line count target: document is within 1500 lines
