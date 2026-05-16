---
date: 2026-05-17
lane: Q — Phase 3 Edge Case Matrix Audit
scope: §4 of master plan (30 edge case rows E-01 through E-30) + Lane L overlap
status: read-only findings; no code changes
---

# Lane Q — Edge Case Matrix Audit Findings

> Methodology: Read-only walk of master plan §4 (30 rows), Lane B test inventory, Lane L B7 data-loss vectors, and 6 skill files. Every claim is cited to file:line or skill section. No code was modified.

---

## Axis 1 — Race Conditions

### EQ-R-01 — E-01: Concurrent gate submit mutex untested at real API level

- **Edge row**: E-01 (master plan §4 line 113)
- **Severity**: P0
- **Covered by existing test?**: Partially — `tests/api/circles-gate-contract.spec.js` (Lane B table §A line 16) tests gate shape and 401, but NOT concurrent submission. `tests/visual/circles-gate.spec.js` (Lane B §I line 105) injects gate result via `route.fulfill` — hollow for this vector.
- **Hollowness flag**: `circles-gate.spec.js` line 3 partial Pitfall 11 (route.fulfill on own gate endpoint). The mutex (`gateInflight` AppState:237 per master plan §3A line 58) is never exercised by a real concurrent double-submit.
- **Gap**: No test uses `Promise.all` to fire two simultaneous POST /gate calls for the same session and assert the second is blocked or queued.
- **Lane L overlap**: V-002 (Lane L line 28-34) confirms gateResult PATCH is also fire-and-forget — a race condition that compounds this gap: even if mutex blocks the 2nd POST /gate, a concurrent PATCH /progress can overwrite gateResult.
- **Fix tier**: New API test — `tests/api/circles-gate-concurrent.spec.js` using `Promise.all` pattern per multi-user-and-collaboration.md:306-343.

---

### EQ-R-02 — E-02: Concurrent evaluate-step calls untested

- **Edge row**: E-02 (master plan §4 line 114)
- **Severity**: P1
- **Covered by existing test?**: No. `tests/adversarial/circles-evaluator.spec.js` (Lane B §E line 68) tests AI output quality but only for one call at a time. `tests/api/lifecycle-circles.spec.js` (Lane B §A line 13) calls /evaluate-step sequentially.
- **Gap**: `circlesStepScores` (AppState:170 per master plan §3A line 60) could accumulate corrupt data if two evaluate-step calls for the same step arrive concurrently — no test verifies idempotency or last-write-wins behavior.
- **Fix tier**: API test — POST /evaluate-step for same session + same step twice via `Promise.all`; assert `circlesStepScores` has exactly one entry for that step per multi-user-and-collaboration.md:306-343.

---

### EQ-R-03 — E-22: Parallel worker storageState isolation — gap in current auth setup

- **Edge row**: E-22 (master plan §4 line 134)
- **Severity**: P1
- **Covered by existing test?**: `tests/api/lifecycle-circles.spec.js` and `lifecycle-nsm.spec.js` (Lane B §A lines 13-14) use real Supabase test DB but have no explicit `{ scope: 'worker' }` storageState isolation visible in their setup. `tests/visual/auth-flow.spec.js` (Lane B §I line 103) uses no own-API mocks but does not address worker isolation.
- **Hollowness flag**: flaky-tests.md Isolation category (line 38): "Parallel tests colliding on unique constraints" is exactly this risk when Supabase sessions are shared across workers.
- **Gap**: If two workers create sessions for the same test user email, Supabase unique constraints trigger silent failures or data corruption.
- **Fix tier**: Auth fixture update — add `{ scope: 'worker' }` storageState per authentication.md:238-267 pattern; create unique test email per worker using `${Date.now()}-${Math.random()}` suffix per common-pitfalls.md Pitfall 5 (line 233).

---

### EQ-R-04 — (new): Multi-tab frameworkDraft full-overwrite race

- **Edge row**: Not in E-01 to E-30 explicitly; derived from Lane L race condition map (Lane L line 80-84)
- **Severity**: P0
- **Covered by existing test?**: No test exercises two-tab simultaneous PATCH /progress for the same session. `tests/visual/cross-tab-resume-toast.spec.js` (Lane B §I line 126) is REAL but only asserts toast appearance, not progress merge correctness.
- **Evidence**: Lane L line 80: "frameworkDraft is a full overwrite (line 304), not merged" — circles-sessions.js:304 overwrites the entire frameworkDraft key on each PATCH, so two tabs typing simultaneously lose one tab's content on server.
- **Gap**: Server-side shallow-merge logic only partially mitigates; `frameworkDraft` full-overwrite means any concurrent PATCH from tab B silently drops tab A's changes.
- **Fix tier**: API test — seed session, PATCH from two request contexts simultaneously for same frameworkDraft key, assert server returns the last-write-wins value and no data corruption; pattern per multi-user-and-collaboration.md:306-343.

---

## Axis 2 — Refresh / Reload Mid-Flow

### EQ-F-01 — E-03: Refresh mid-SSE stream — no real E2E test

- **Edge row**: E-03 (master plan §4 line 115)
- **Severity**: P1
- **Covered by existing test?**: `tests/visual/conversation-persistence-roundtrip.spec.js` (Lane B §I line 124) is SEMI-HOLLOW — stubs session list. `tests/visual/sse-typewriter-perf.spec.js` (Lane B §I line 166) uses `route.fulfill` SSE (Pitfall 11 borderline).
- **Hollowness flag**: `sse-typewriter-perf.spec.js` line 5 — route.fulfill SSE, not a real /message call. An SSE abort from page navigation is therefore untested against real backend.
- **Gap**: No test navigates away mid-SSE (using `route.abort()` pattern or real navigation) and asserts: (a) no console error, (b) conversation is loadable on return, (c) AbortController at app.js:1270-1273 (Lane L line 82) fires cleanly.
- **Lane L overlap**: Lane L line 82 confirms SSE abort path exists but is "turn lost and shows retry UI" — the retry UI behavior is not asserted anywhere.
- **Fix tier**: E2E test — start real SSE via POST /message; call `page.goto('/')` to navigate away; assert no console errors and on return the conversation partial turn is absent or shows retry UI per network-mocking.md:839-933 abort pattern.

---

### EQ-F-02 — E-04: Refresh mid-Phase 1 form — PATCH failure path untested

- **Edge row**: E-04 (master plan §4 line 116)
- **Severity**: P1
- **Covered by existing test?**: `tests/visual/draft-data-loss-fix.spec.js` (Lane B §I line 163) is REAL. However Lane L confirms (line 86-89) the localStorage vs server merge logic at app.js:8001-8021 is correct for Phase 1 fields but the `backendEmpty` flag path is never stress-tested.
- **Gap**: No test forces a PATCH /progress to fail (503) and then reloads to verify localStorage wins and content is restored from local. `draft-data-loss-fix.spec.js` tests the fix exists, not the failure path that necessitates it.
- **Lane L overlap**: V-001 (Lane L line 21-26) — PATCH fire-and-forget means the localStorage fallback is the only cross-device recovery; but the test at line 163 does not simulate PATCH failure.
- **Fix tier**: E2E test — fill Phase 1 fields, stub PATCH /progress to 503 via `route.fulfill({ status: 503 })` (acceptable carve-out: error states per common-pitfalls.md Pitfall 11 line 660), reload, assert fields restored from localStorage per network-mocking.md:839-933.

---

### EQ-F-03 — E-05: Refresh mid-NSM Step 2 — nsmDefinition not in PERSISTED_KEYS

- **Edge row**: E-05 (master plan §4 line 117)
- **Severity**: P0
- **Covered by existing test?**: `tests/visual/nsm-submit-reactive.spec.js` (Lane B §I line 170) is REAL and tests submit reactivity. `tests/visual/nsm-step-2-3.spec.js` (Lane B §I line 114) is SEMI-HOLLOW.
- **Evidence**: Lane L V-007 (line 68-74) confirms `nsmDefinition` and `nsmBreakdown` are NOT in `PERSISTED_KEYS` (app.js:153-164). The localStorage key `pmdrill:nsm:draft:*` is written but never read back on restore. No test verifies the restoration path.
- **Gap**: No test fills NSM Step 2, simulates PATCH failure, reloads, and asserts draft is restored. The restore path is broken by design (Lane L V-007).
- **Fix tier**: E2E test (after T2c fix) — fill NSM definition, stub PATCH to 503, reload, assert content restored; this test currently MUST fail (useful as regression gate) per network-mocking.md:839-933.

---

### EQ-F-04 — (new): Phase 2 conclusion localStorage orphan (Lane L V-006)

- **Edge row**: Extends E-05 scope; derived from Lane L V-006 (line 60-66)
- **Severity**: P0
- **Covered by existing test?**: No test file references `pmdrill:phase2:conclusion:*` localStorage key. `tests/visual/conversation-persistence-roundtrip.spec.js` (Lane B §I line 124) tests SSE conversation stored/reloaded but is SEMI-HOLLOW and does not test conclusion draft specifically.
- **Evidence**: Lane L V-006 confirms `pmdrill:phase2:conclusion:*` localStorage key is written at app.js:6793 but NEVER read in any restore function (app.js:7996 and 7851 both read server only). This is a confirmed orphan write with zero restore path.
- **Gap**: No test exists. The localStorage write is dead — conclusion draft is silently lost on reload if PATCH failed.
- **Fix tier**: After Lane L T2b fix: E2E test — type Phase 2 conclusion, stub PATCH to 503, reload, assert conclusion content restored from localStorage. Currently MUST fail (useful as regression gate) per network-mocking.md:839-933.

---

## Axis 3 — Network Failures (503 / abort / slow)

### EQ-N-01 — E-06: 503 burst then success on POST /gate — no retry behavior test

- **Edge row**: E-06 (master plan §4 line 119)
- **Severity**: P1
- **Covered by existing test?**: `tests/api/circles-gate-contract.spec.js` (Lane B §A line 16) tests gate shape but not 503 handling. `tests/visual/circles-gate.spec.js` (Lane B §I line 105) injects gate results directly.
- **Gap**: No test fires a 503 on POST /gate and asserts the UI shows an error state (and not a crash). No retry behavior is tested because no retry exists in the current code — Lane L V-003 confirms `ensureCirclesDraftSession` returns null silently on 5xx (app.js:3745-3746).
- **Fix tier**: API test — `route.fulfill({ status: 503 })` on POST /gate (acceptable carve-out: error states per common-pitfalls.md Pitfall 11 line 660); assert error UI shown; verify no crash per network-mocking.md:906-932 intermittent pattern.

---

### EQ-N-02 — E-07: 503 on SSE POST /message — circlesPhase2StreamError flag untested

- **Edge row**: E-07 (master plan §4 line 119)
- **Severity**: P1
- **Covered by existing test?**: `tests/visual/phase2-chat.spec.js` (Lane B §I line 107) is SEMI-HOLLOW — stubs sessions/stats and uses `route.fulfill` SSE. The SSE error flag `circlesPhase2StreamError` (AppState:191 per master plan §3A line 59) is never set by a real SSE abort.
- **Hollowness flag**: `phase2-chat.spec.js` line 9 partial Pitfall 11 (Lane B anti-pattern line 302).
- **Gap**: No test aborts a real SSE stream mid-response and asserts `circlesPhase2StreamError` DOM state is rendered.
- **Fix tier**: E2E test — POST /message (real), intercept SSE via `route.abort()` mid-stream, assert error state rendered per network-mocking.md:839-933.

---

### EQ-N-03 — E-08: 503 on NSM /evaluate — nsmEvalError flag untested

- **Edge row**: E-08 (master plan §4 line 120)
- **Severity**: P1
- **Covered by existing test?**: `tests/adversarial/nsm-evaluator.spec.js` (Lane B §E line 72) tests AI output quality only. `tests/api/lifecycle-nsm.spec.js` (Lane B §A line 14) tests lifecycle but not 503 path.
- **Gap**: `nsmEvalError` AppState:215 (master plan §3B line 73) is never set by a test. No test verifies the error UI renders when /evaluate returns 503.
- **Fix tier**: API test — `route.fulfill({ status: 503 })` on POST /evaluate (carve-out acceptable); assert `nsmEvalError` DOM indicator shown per network-mocking.md:839-933.

---

### EQ-N-04 — E-29: Offline → online recovery — isOnline flag completely untested

- **Edge row**: E-29 (master plan §4 line 141)
- **Severity**: P1
- **Covered by existing test?**: No file in Lane B inventory tests `isOnline` (AppState:152 per master plan §3E line 99) or the global offline banner. Master plan §3E line 99 confirms `renderGlobalBanners` has no dedicated spec (F-013 seed).
- **Gap**: Zero tests exercise `page.context().setOffline(true)` then `setOffline(false)`. The offline banner appearance and disappearance are untested. This is the simplest network failure scenario and has no coverage.
- **Fix tier**: E2E test — `context.setOffline(true)`; assert offline banner visible; `context.setOffline(false)`; assert banner gone. Pure browser behavior, no own-API mock needed.

---

## Axis 4 — Quota / Rate Limits

### EQ-Q-01 — E-09: OpenAI 429 on /gate — user-facing error display untested

- **Edge row**: E-09 (master plan §4 line 121)
- **Severity**: P1
- **Covered by existing test?**: `tests/adversarial/circles-gate.spec.js` (Lane B §E line 70) tests adversarial inputs to real OpenAI but not 429 scenarios. No test simulates a 429 from OpenAI.
- **Gap**: No test stubs `**/openai.com/**` to return 429 on a gate request and asserts the user sees an error message (not a crash or infinite spinner).
- **Fix tier**: API test — `route.fulfill({ status: 429 })` on `**/openai.com/**` (this IS an external service, so mocking is correct per common-pitfalls.md Pitfall 11 line 621); assert user-facing error shown per network-mocking.md:839-933.

---

### EQ-Q-02 — E-10: OpenAI 429 on NSM /evaluate — nsmEvalError display untested

- **Edge row**: E-10 (master plan §4 line 122)
- **Severity**: P1
- **Covered by existing test?**: `tests/adversarial/nsm-evaluator.spec.js` (Lane B §E line 72) — real OpenAI, no 429 scenario.
- **Gap**: Same gap as EQ-Q-01 for NSM evaluate. `nsmEvalError` AppState:215 path is not exercised by any 429 scenario.
- **Fix tier**: API test — same `route.fulfill({ status: 429 })` on OpenAI endpoint during POST /evaluate; assert `nsmEvalError` UI shown per network-mocking.md:839-933.

---

### EQ-Q-03 — E-30: 401 on all protected routes — systematic gap

- **Edge row**: E-30 (master plan §4 line 142)
- **Severity**: P1
- **Covered by existing test?**: `tests/circles-stats.test.js` (Lane B §C line 46) covers 401 for ONE endpoint. `tests/api/circles-gate-contract.spec.js` (Lane B §A line 16) covers 401 for gate. Master plan §3C line 84 notes `middleware.test.js` is SEMI-HOLLOW (jest.mock for auth.getUser).
- **Hollowness flag**: `tests/middleware.test.js` line 12 — `jest.mock('../db/client')` (Lane B §C line 49), partial Pitfall 11.
- **Gap**: Master plan §4 row E-30 cites 27 auth endpoints needing systematic 401 coverage. Only 2 endpoints have real 401 tests. The remaining ~25 are untested for auth enforcement.
- **Fix tier**: API test family — one parameterized `test.each` loop over all 27 auth-required routes; `request.get(route)` without auth header; expect 401 per auth-flows.md:709-733 pattern.

---

## Axis 5 — iOS Safari Quirks

### EQ-I-01 — E-11: Fixed submit-bar safe-area overlap — visual automation partial

- **Edge row**: E-11 (master plan §4 line 123)
- **Severity**: P2
- **Covered by existing test?**: `tests/visual/master-pixel-diff.spec.js` (Lane B §I line 120) runs 16 mockups × 3 viewport pixel-diff. `tests/visual/rwd-visual-gate.spec.js` (Lane B §K line 233) covers RWD × 8 vp. However, per master plan §8 line 251, iOS deep automated test stays manual (15-item checklist).
- **Gap**: No test using `devices['iPhone SE']` specifically asserts that `.submit-bar` at style.css:136 is not clipped by safe-area-inset-bottom. The device profile tests exist but safe-area clip is not asserted.
- **Note**: Per master plan §8 (out of scope), this is explicitly a manual checklist item. Automated coverage is limited to viewport + device profile screenshots.
- **Fix tier**: Visual test (P2) — add `devices['iPhone SE']` screenshot assertion specifically for `.submit-bar` bottom edge, not clipped per mobile-and-responsive.md:49-71; flag as P2 (manual checklist covers this gap formally).

---

### EQ-I-02 — E-12: Hint overlay scroll-lock + touch passthrough — not automated with WebKit

- **Edge row**: E-12 (master plan §4 line 124)
- **Severity**: P2
- **Covered by existing test?**: `tests/visual/phase1-hint-modal.spec.js` (Lane B §I line 155) is REAL — tests hint modal open/close. `tests/visual/nsm-step2-hint-modal-close-paths.spec.js` (Lane B §I line 141) is SEMI-HOLLOW.
- **Gap**: Neither test uses `devices['iPhone 14']` with `hasTouch: true` and asserts that `.hint-overlay` at style.css:1127 blocks scroll underneath. Touch passthrough is a WebKit-specific quirk not tested in Chromium.
- **Note**: Per master plan §8 (out of scope), deep iOS automation is excluded. But `.tap()` interaction can be added.
- **Fix tier**: Visual test (P2) — add WebKit project test using `.tap()` on hint overlay; assert body scroll is locked; assert backdrop tap closes per mobile-and-responsive.md:279-322.

---

### EQ-I-03 — E-13: Offcanvas scroll/touch in fixed overlay — not automated with touch

- **Edge row**: E-13 (master plan §4 line 125)
- **Severity**: P2
- **Covered by existing test?**: `tests/visual/offcanvas.spec.js` (Lane B §I line 118) is SEMI-HOLLOW (stubs session list). Tests exist for offcanvas rendering but no touch/tap interaction with hasTouch device profile.
- **Gap**: Offcanvas `.tap()` on outside area (to close) and item `.tap()` are not tested with WebKit + `hasTouch: true`. The iOS-specific scroll containment inside `position: fixed` overlay is not asserted.
- **Fix tier**: Visual test (P2) — WebKit device profile; `.tap()` on offcanvas item; assert item click restores session; `.tap()` outside offcanvas; assert close per mobile-and-responsive.md:279-322.

---

### EQ-I-04 — E-14: Onboarding tooltip position timing on scroll — Chromium only

- **Edge row**: E-14 (master plan §4 line 126)
- **Severity**: P2
- **Covered by existing test?**: `tests/visual/onboarding-position.spec.js` (Lane B §I line 167) is REAL. `tests/playwright/journeys/onboarding-tour.spec.js` (Lane B §K line 230) is REAL.
- **Gap**: These tests run in Chromium. `positionOnboardingTooltip()` at app.js:8405 timing on WebKit scroll is not specifically asserted. No `devices['iPhone 14']` project run for onboarding-position.spec.js.
- **Fix tier**: Add WebKit project to `onboarding-position.spec.js` config per mobile-and-responsive.md:49-71. P2 — existing coverage adequate for Chromium; WebKit is incremental.

---

### EQ-I-05 — E-15: SSE ReadableStream cancel on iOS Safari 15 — zero automation

- **Edge row**: E-15 (master plan §4 line 127)
- **Severity**: P1 (regression risk — iOS Safari 15 specific behavior that can break SSE silently)
- **Covered by existing test?**: No WebKit browser test exercises Phase 2 SSE with a real backend. `sse-typewriter-perf.spec.js` (Lane B §I line 166) is SEMI-HOLLOW (route.fulfill SSE, not real). Per master plan §8, iOS automation is limited — but this is a functional breakage, not a pixel check.
- **Gap**: No test uses `devices['iPhone 14']` (WebKit) + navigates away during real SSE stream to assert no console error from ReadableStream.cancel(). This is a confirmed iOS Safari 15 regression vector.
- **Fix tier**: E2E test — `devices['iPhone 14']` project; start real SSE; `page.goto('/')` mid-stream; assert `page.on('console', ...)` has no error mentioning ReadableStream. Note: requires real SSE endpoint, not route.fulfill.

---

### EQ-I-06 — E-16: position:sticky conclusion-actions in flex — no WebKit assertion

- **Edge row**: E-16 (master plan §4 line 128)
- **Severity**: P2
- **Covered by existing test?**: `tests/visual/phase2-chat.spec.js` (Lane B §I line 107) is SEMI-HOLLOW. No WebKit project scroll assertion for `.conclusion-actions` at style.css:2230.
- **Gap**: Safari has known sticky-in-flex bugs. No test scrolls Phase 2 in WebKit and asserts `.conclusion-actions` stays visible.
- **Fix tier**: Visual test (P2) — WebKit project; scroll Phase 2 chat to bottom; assert `.conclusion-actions` visible via `toBeInViewport()` per mobile-and-responsive.md:49-71.

---

## Axis 6 — Multi-Tab / Cross-Context

### EQ-M-01 — E-17: Lock state propagation via localStorage storage event — no cross-context test

- **Edge row**: E-17 (master plan §4 line 129)
- **Severity**: P0
- **Covered by existing test?**: `tests/visual/cross-tab-resume-toast.spec.js` (Lane B §I line 126) is REAL and covers the resume toast scenario (E-18). But E-17 (lock state stale banner) is NOT covered. `cross-tab-resume-toast.spec.js` uses two contexts but only for toast — not for `circlesStale` (AppState:173 per master plan §3E line 98).
- **Evidence**: Master plan §5 cross-dep #9 (line 193) explicitly marks this as [NEW] — "no dedicated test." The storage event trigger path from tab B save → tab A stale banner is unverified.
- **Gap**: No test creates two `browser.newContext()` instances, has context A in Phase 1, triggers a save from context B, and asserts context A's stale banner appears.
- **Fix tier**: E2E test — two contexts per multi-user-and-collaboration.md:27-58; ctx A loads Phase 1; ctx B triggers PATCH /progress; assert ctx A page shows stale banner via localStorage storage event.

---

### EQ-M-02 — E-18: Cross-tab resume toast — COVERED (REAL)

- **Edge row**: E-18 (master plan §4 line 130)
- **Severity**: COVERED
- **Covered by existing test?**: YES — `tests/visual/cross-tab-resume-toast.spec.js` (Lane B §I line 126) is classified REAL. Uses two Playwright contexts. No Pitfall flag.
- **Finding**: This edge case is the only multi-tab scenario with real coverage. No action needed.

---

### EQ-M-03 — E-19: Offcanvas history list stale after tab B deletes session — no test

- **Edge row**: E-19 (master plan §4 line 131)
- **Severity**: P1
- **Covered by existing test?**: `tests/visual/offcanvas-delete-routing.spec.js` (Lane B §I line 150) is SEMI-HOLLOW (stubs list). No two-context test for delete propagation.
- **Gap**: No test has context A with offcanvas open, context B deletes a session via DELETE /api/circles-sessions/:id, and asserts context A's list is stale (showing deleted item) or has a refresh indicator.
- **Fix tier**: E2E test — two contexts per multi-user-and-collaboration.md:27-58; ctx B deletes session; ctx A reloads offcanvas; assert deleted session absent.

---

## Axis 7 — Auth Expiry Mid-Flow

### EQ-A-01 — E-20: Mid-flow JWT expiry during Phase 2 — no real E2E test

- **Edge row**: E-20 (master plan §4 line 132)
- **Severity**: P0
- **Covered by existing test?**: `tests/visual/auth-flow.spec.js` (Lane B §I line 103) is REAL and covers "token-expiry DOM structure." But it tests the DOM structure of the expiry screen, NOT the mid-flow behavior during active Phase 2 chat.
- **Evidence**: Master plan §3C line 84 notes "missing: real middleware test without jest.mock; mid-flow expiry E2E." `middleware.test.js` (Lane B §C line 49) is SEMI-HOLLOW (jest.mock('../db/client')).
- **Gap**: No test: (1) logs in, (2) reaches Phase 2 with real session, (3) invalidates JWT mid-flow (via `context.clearCookies()` or token expiry stub), (4) sends a chat message, (5) asserts redirect to auth page without data loss.
- **Fix tier**: E2E test — authenticate via `request.post('/api/auth/register')` (auth-flows.md:928-949); reach Phase 2; call `context.clearCookies({ name: 'session' })`; trigger POST /message; assert redirect to login per auth-flows.md:709-733.

---

### EQ-A-02 — E-21: Guest → register migration banner — no E2E test

- **Edge row**: E-21 (master plan §4 line 133)
- **Severity**: P1
- **Covered by existing test?**: `tests/migrate-guest.unit.test.js` (Lane B §C line 50) is HOLLOW (jest.mock auth + guest middleware + db/client, per Lane B anti-pattern line 297). Master plan §5 cross-dep #11 (line 200) marks this [NEW]. Master plan seed F-009 (line 238) confirms no real infrastructure test.
- **Gap**: No test walks the guest→register flow end-to-end: guest creates session → navigates to register → POST /api/migrate-guest with real Supabase → migration banner `migrationBanner='showing'` appears → dismissed → absent on reload.
- **Fix tier**: E2E test — create guest session; register new user; assert migration banner visible; click dismiss; reload; assert banner absent per auth-flows.md:709-733 + multi-user-and-collaboration.md:27-58.

---

### EQ-A-03 — E-23: Register with taken email (409) — untested at API level

- **Edge row**: E-23 (master plan §4 line 135)
- **Severity**: P1
- **Covered by existing test?**: `tests/visual/auth-flow.spec.js` (Lane B §I line 103) covers "register form BEM" but not 409 response handling. Master plan §3C line 81 flags "missing: real API test for POST /api/auth/register."
- **Gap**: No test calls `request.post('/api/auth/register')` with a pre-existing email and asserts 409 + error.message propagation.
- **Fix tier**: API test — `request.post('/api/auth/register', { data: { email: existingEmail }})` ; `expect(res.status()).toBe(409)` per auth-flows.md:928-949 pattern.

---

## Axis 8 — Guest → Auth Conversion

### EQ-G-01 — E-24: Guest session → gate → phase 2 (no auth) — partial coverage only

- **Edge row**: E-24 (master plan §4 line 136)
- **Severity**: P1
- **Covered by existing test?**: `tests/guest-circles-stats.test.js` (Lane B §C line 47) is REAL for 400 without X-Guest-ID. `tests/circles-stats.test.js` (Lane B §C line 46) covers 401 for one endpoint. But the guest CIRCLES gate + message SSE flow is not tested end-to-end.
- **Evidence**: Master plan §3C line 83 confirms "missing: real API test for guest session CRUD; no E2E guest→register migration flow."
- **Gap**: No test posts to `/api/guest-circles-sessions` with X-Guest-ID header, advances to gate, then to Phase 2 SSE — verifying guest sessions can complete full CIRCLES flow without auth.
- **Fix tier**: API test — `request.post('/api/guest-circles-sessions', { headers: { 'X-Guest-ID': guestId }})` through lifecycle; assert gate and SSE endpoints accept guest header per auth-flows.md:928-949.

---

### EQ-G-02 — E-25: Guest 400 without X-Guest-ID — COVERED for stats only; gap on other guest routes

- **Edge row**: E-25 (master plan §4 line 137)
- **Severity**: P1
- **Covered by existing test?**: `tests/guest-circles-stats.test.js` (Lane B §C line 47) covers 400 for `/api/guest-circles-stats` only. Master plan §5 cross-dep #12 (line 204) confirms "full family not systematically covered."
- **Gap**: 400-without-header test exists for stats but NOT for guest sessions CRUD (POST/GET /api/guest-circles-sessions), guest NSM sessions, or guest gate endpoint. Each guest route family has `requireGuestId` middleware — only one is tested.
- **Fix tier**: API test family — `test.each` over all guest route endpoints; call without X-Guest-ID header; expect 400 each time per auth-flows.md:928-949.

---

### EQ-G-03 — E-26 + E-27: Lifecycle API sequences — COVERED but with 422-guard gaps

- **Edge row**: E-26 / E-27 (master plan §4 lines 138-139)
- **Severity**: PARTIALLY COVERED (P1 for gaps)
- **Covered by existing test?**: `tests/api/lifecycle-circles.spec.js` (Lane B §A line 13) is REAL — covers draft→phase1→gate→phase2→evaluate×7→final-report. `tests/api/lifecycle-nsm.spec.js` (Lane B §A line 14) is REAL — covers NSM lifecycle.
- **Remaining gap**: Master plan §5 cross-dep #3 (line 163) — no assertion on 422 when /final-report called before all step_scores populated. Master plan §5 cross-dep #5 (line 173) — no assertion on 422 when NSM /evaluate called before all 4 dims filled.
- **Fix tier**: API test additions to existing lifecycle specs — add `test('422 when final-report called incomplete')` and `test('422 when NSM evaluate called without all dims')`.

---

### EQ-G-04 — E-28: Session dedup — COVERED

- **Edge row**: E-28 (master plan §4 line 140)
- **Severity**: COVERED
- **Covered by existing test?**: `tests/lib/session-dedup.test.js` (Lane B §B line 24) is REAL — pure function, covers "completed beats active, latest wins."
- **Finding**: This edge case has adequate unit coverage. No action needed.

---

## Summary Table

| Finding ID | Edge Row | Axis | Severity | Test exists? | Pitfall Flag |
|---|---|---|---|---|---|
| EQ-R-01 | E-01 | Race | P0 | Partial (hollow for mutex) | Pitfall 11 (route.fulfill gate) |
| EQ-R-02 | E-02 | Race | P1 | No | — |
| EQ-R-03 | E-22 | Race | P1 | Partial (no worker isolation) | Pitfall 5 (worker state leak) |
| EQ-R-04 | (new) | Race | P0 | No | — |
| EQ-F-01 | E-03 | Refresh | P1 | Partial (SEMI-HOLLOW SSE) | Pitfall 11 (route.fulfill SSE) |
| EQ-F-02 | E-04 | Refresh | P1 | Partial (fix tested, not failure) | — |
| EQ-F-03 | E-05 | Refresh | P0 | No (restore path broken) | — |
| EQ-F-04 | (new) | Refresh | P0 | No (orphan localStorage) | — |
| EQ-N-01 | E-06 | Network | P1 | No | — |
| EQ-N-02 | E-07 | Network | P1 | Partial (SEMI-HOLLOW) | Pitfall 11 (route.fulfill SSE) |
| EQ-N-03 | E-08 | Network | P1 | No | — |
| EQ-N-04 | E-29 | Network | P1 | No | — |
| EQ-Q-01 | E-09 | Quota | P1 | No | — |
| EQ-Q-02 | E-10 | Quota | P1 | No | — |
| EQ-Q-03 | E-30 | Quota | P1 | Partial (2/27 endpoints) | Pitfall 11 (jest.mock middleware) |
| EQ-I-01 | E-11 | iOS | P2 | Partial (no safe-area assert) | — |
| EQ-I-02 | E-12 | iOS | P2 | Partial (no WebKit touch) | — |
| EQ-I-03 | E-13 | iOS | P2 | Partial (no touch) | — |
| EQ-I-04 | E-14 | iOS | P2 | Partial (Chromium only) | — |
| EQ-I-05 | E-15 | iOS | P1 | No (WebKit SSE untested) | — |
| EQ-I-06 | E-16 | iOS | P2 | No (WebKit sticky) | — |
| EQ-M-01 | E-17 | Multi-tab | P0 | No | — |
| EQ-M-02 | E-18 | Multi-tab | COVERED | YES (REAL) | — |
| EQ-M-03 | E-19 | Multi-tab | P1 | No (cross-tab delete) | — |
| EQ-A-01 | E-20 | Auth | P0 | Partial (DOM only, not mid-flow) | Pitfall 11 (jest.mock middleware) |
| EQ-A-02 | E-21 | Auth | P1 | No (HOLLOW migrate-guest) | Pitfall 11 (jest.mock full) |
| EQ-A-03 | E-23 | Auth | P1 | No | — |
| EQ-G-01 | E-24 | Guest | P1 | Partial (stats only) | — |
| EQ-G-02 | E-25 | Guest | P1 | Partial (1/N endpoints) | — |
| EQ-G-03 | E-26/27 | Lifecycle | P1 (gaps) | Mostly covered | — |
| EQ-G-04 | E-28 | Lifecycle | COVERED | YES (REAL) | — |

**Counts: P0: 6 | P1: 17 | P2: 6 | Covered: 2 | Total findings: 31**

---

## Top 6 P0 Findings (Escalation Required)

### P0-1 — EQ-R-01: Concurrent gate submit mutex has no real test

The `gateInflight` mutex (AppState:237) is tested only by SEMI-HOLLOW visual spec and a shape-only API contract test. Two simultaneous POST /gate calls for the same session are never exercised. Lane L V-002 adds a compounding risk: the gateResult PATCH is fire-and-forget. Pattern: `Promise.all` two gate submits per multi-user-and-collaboration.md:306-343.

### P0-2 — EQ-R-04: frameworkDraft full-overwrite race in multi-tab scenario

Lane L race condition map (line 80-84) confirms `frameworkDraft` at circles-sessions.js:304 is a full overwrite, not a shallow merge. Two browser tabs simultaneously PATCHing /progress for the same session will silently drop one tab's content. No test covers this. Pattern: two `request` contexts, `Promise.all` PATCH, assert server value correct per multi-user-and-collaboration.md:306-343.

### P0-3 — EQ-F-03: nsmDefinition not in PERSISTED_KEYS — restore path is broken by design

Lane L V-007 (line 68-74) proves `nsmDefinition` and `nsmBreakdown` are missing from `PERSISTED_KEYS` (app.js:153-164). The localStorage write (`pmdrill:nsm:draft:*`) is never read back on session restore. A test simulating PATCH failure then reload MUST fail. This is a data-loss vector awaiting T2c implementation — a test should be written NOW as a regression gate.

### P0-4 — EQ-F-04: Phase 2 conclusion localStorage orphan (V-006)

Lane L V-006 (line 60-66) confirms `pmdrill:phase2:conclusion:*` localStorage key is written at app.js:6793 but NEVER read in restore functions app.js:7996 or 7851. The conclusion draft is silently lost on reload after any PATCH failure. Zero test coverage. Test must fail until T2b is implemented — write it now as a regression gate.

### P0-5 — EQ-M-01: Cross-tab stale banner (circlesStale) — no cross-context test

The storage event path from tab B save → tab A stale banner (`circlesStale` AppState:173) is completely unverified by any test. Master plan §5 cross-dep #9 (line 193) marks this [NEW]. Only the resume toast (E-18) has cross-context coverage; the stale banner does not. Pattern: two `browser.newContext()` per multi-user-and-collaboration.md:27-58.

### P0-6 — EQ-A-01: Mid-flow JWT expiry during Phase 2 — no real E2E test

`auth-flow.spec.js` tests the DOM structure of the expiry screen but not mid-Phase 2 expiry behavior. `middleware.test.js` is SEMI-HOLLOW (jest.mock('../db/client') line 12). No test clears JWT mid-Phase 2 and asserts redirect without data loss. Pattern: `context.clearCookies()` per auth-flows.md:709-733.

---

## Skill Citation Map

| Pattern needed | Skill file | Lines |
|---|---|---|
| Concurrent submit race | multi-user-and-collaboration.md | 306-343 |
| Two isolated browser contexts | multi-user-and-collaboration.md | 27-58 |
| Session expiry mid-flow | auth-flows.md | 709-733 |
| Auth seeding via request.post | auth-flows.md | 928-949 (referenced in master plan §4) |
| 503/abort/network error state | network-mocking.md | 839-933 |
| waitForRequest payload verify | network-mocking.md | 1012-1027 |
| iOS device profile matrix | mobile-and-responsive.md | 49-71 |
| tap() with hasTouch | mobile-and-responsive.md | 279-322 |
| Worker isolation / unique data | common-pitfalls.md | Pitfall 5 (line 233) |
| Over-mocking own API | common-pitfalls.md | Pitfall 11 (line 597) |
| Sentinel string anti-pattern | common-pitfalls.md | Pitfall 14 (line 802) |
| Timing flakiness diagnosis | flaky-tests.md | Taxonomy table (line 37) |

---

## Lane L Overlap Summary

Lane L identified 7 data-loss vectors (V-001 through V-007). Their mapping to edge case findings:

| Lane L Vector | Lane Q Finding | Axis | Severity |
|---|---|---|---|
| V-001 (triggerSaveCycle fire-and-forget) | EQ-F-02 | Refresh | P1 |
| V-002 (gateResult PATCH fire-and-forget) | EQ-R-01 | Race | P0 |
| V-003 (ensureCirclesDraftSession silent null) | EQ-N-01 | Network | P1 |
| V-004 (NSM gate result not persisted) | EQ-G-01 (extension) | Guest | P1 |
| V-005 (NSM evaluate no pre-write checkpoint) | EQ-N-03 | Network | P1 |
| V-006 (Phase 2 conclusion localStorage orphan) | EQ-F-04 | Refresh | P0 |
| V-007 (NSM definition not in PERSISTED_KEYS) | EQ-F-03 | Refresh | P0 |

All 7 Lane L vectors have corresponding test gaps identified here. V-006 and V-007 are the most critical — both are NOT in the current 5 P0 fix plan (T2-T6) and need tests written NOW as regression gates before T2b/T2c are implemented.

---

## Caveats

- E-11 through E-16 (iOS Safari axis) are explicitly out of scope for deep automation per master plan §8 line 251. P2 ratings reflect this constraint.
- E-18 (cross-tab resume toast) and E-28 (session dedup) have real coverage and are marked COVERED — no action needed.
- E-26/E-27 (lifecycle API sequences) have real backbone coverage but two 422-guard assertions are missing; these are P1 additions to existing specs, not new files.
- persistRetry (T1) is shipped but not wired into app.js per Lane L line 8-9; any new tests for V-001/V-002/V-003 paths will fail until T2-T4 are implemented — write tests as regression gates first.
