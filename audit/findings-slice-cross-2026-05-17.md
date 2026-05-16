---
date: 2026-05-17
lane: P — Auth + Onboarding + Cross-surface (§3C/3D/3E)
status: complete
surfaces: 13 (§3C Auth×4, §3D Onboarding×2, §3E Cross-surface×7)
findings: 17
---

# Lane P — Auth + Onboarding + Cross-surface Findings (2026-05-17)

> Read-only audit slice. No code changed. All claims cited to file:line.
> Methodology follows master plan §6 schema: F-NNN / Severity / Surface / What's wrong / Cited evidence / Reproduction / Recommended fix.

---

## §0 Required Reading Confirmed

All inputs read before writing findings:

1. `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` §3C/D/E (lines 77-103)
2. `audit/lane-b-test-inventory-2026-05-17.md` (lines 1-313)
3. `audit/lane-c-product-surface-map-2026-05-17.md` (lines 1-327)
4. `auth-flows.md` lines 928-949 (API login / storageState pattern)
5. `auth-flows.md` lines 709-733 (session expiry redirect pattern)
6. `authentication.md` lines 29-70 (storageState reuse), 238-267 (per-worker scoping)
7. `test-architecture.md` lines 42-58 (decision matrix: login/auth to E2E; CRUD to API; permissions/auth to API)
8. `common-pitfalls.md` Pitfall 11 (lines 597-661) and Pitfall 1 (lines 9-44)
9. `audit/lane-l-b7-data-loss-vectors-2026-05-17.md` (lines 1-101) — B7 vectors overlap mapped

---

## §1 Findings

### F-P01 — P0 — Auth Surface — No real API test for POST /api/auth/register (duplicate 409 missing)

**Surface**: Auth — `renderAuth` app.js:2571; POST /api/auth/register routes/auth.js:6

**What's wrong**: Zero real API-layer tests exist for `POST /api/auth/register`. Master plan §3C expects 3 tests: register success shape, register duplicate 409, and migrate-guest auth+guestId required. The only auth coverage is the `tests/setup/auth.setup.js` UI-login flow (which tests login, not register) and `tests/visual/auth-flow.spec.js` (DOM-only; stubs `/api/config` with empty Supabase credentials — line 21 injects `{ supabaseUrl: '', supabaseAnonKey: '' }`, so Supabase never actually initializes). No test covers the 409 duplicate-email path.

**Cited evidence**:
- Master plan §3C line 81: "Missing: real API test for POST /api/auth/register"
- Lane B inventory lines 103-104: `auth-flow.spec.js` classified "REAL (no own-API mocks)" — but `tests/visual/auth-flow.spec.js` line 21 injects empty Supabase credentials, meaning no Supabase call executes
- `tests/setup/auth.setup.js` line 21: covers login only, not register
- `test-architecture.md` line 58: "Permissions / authorization → API; Role-based access is backend logic; test without UI overhead"

**Reproduction**:
1. Search `tests/` for any spec calling `request.post('/api/auth/register')` — none found
2. Open `tests/visual/auth-flow.spec.js` line 21; observe Supabase initialized with empty strings — no real auth call executes
3. Submit register form in spec — Supabase SDK fires against empty URL, silently fails

**Recommended fix**: Create `tests/api/auth-register.spec.js` using `request.post('/api/auth/register', { data: { email, password } })` against localhost; assert 200 success shape and 409 duplicate conflict; use `auth-flows.md:928-949` pattern for token extraction.

---

### F-P02 — P0 — Auth Surface — `tests/playwright/journeys/auth.spec.js` is fully skipped (`test.describe.skip`)

**Surface**: Auth — login journey; `tests/playwright/journeys/auth.spec.js`

**What's wrong**: The entire auth journey spec is wrapped in `test.describe.skip('Auth Journey (pending Plan B implementation)')` (line 11). It references stale Plan A selectors (`#auth-form`, `window.navigate`) that no longer match Path 2's rendered output (`#auth-email`, `#auth-pw`, `data-nav="auth"`). This spec contributes zero coverage to any test run. Lane B counts it as one of the E2E "REAL" journey specs, but it executes no assertions. Auth — the most security-sensitive surface — has a permanently dead coverage spec.

**Cited evidence**:
- `tests/playwright/journeys/auth.spec.js` line 11: `test.describe.skip('Auth Journey (pending Plan B implementation)',...)`
- Lane B inventory line 223: `auth.spec.js` listed as E2E REAL — misclassified; zero tests execute due to skip
- Lane C line 37: `renderAuth` at app.js:2571 is a live surface with current selectors
- `auth-flows.md` lines 709-733: session expiry redirect pattern is never exercised

**Reproduction**:
1. Run `npx playwright test tests/playwright/journeys/auth.spec.js --reporter=list` — zero tests execute
2. Open file line 11: observe `test.describe.skip`
3. Compare selector `#auth-form` (Plan A, removed) vs live selector `#auth-email` from `tests/setup/auth.setup.js` line 55

**Recommended fix**: Rewrite `tests/playwright/journeys/auth.spec.js` targeting current Path 2 selectors (`data-nav="auth"`, `#auth-email`, `#auth-pw`, `#auth-submit`), remove the `.skip`, and add the mid-flow JWT expiry scenario (`auth-flows.md:709-733`).

---

### F-P03 — P0 — Auth Surface — `tests/middleware.test.js` mocks `db.auth.getUser` — zero real middleware integration confidence

**Surface**: Auth middleware — `requireAuth` (middleware/auth.js); JWT expiry intercept app.js

**What's wrong**: `tests/middleware.test.js` mocks `../db/client` at line 4 (`jest.mock('../db/client')`), replacing Supabase's `auth.getUser` with a `jest.fn()`. The middleware is tested against a fake Supabase client — if the real Supabase SDK changes its response shape, `requireAuth` could silently fail in production while tests still pass. Master plan §3C expects 2 real tests: "401 response with expired token, middleware requireAuth + requireGuestId." The mid-flow JWT expiry E2E scenario (master plan line 84) has no coverage at all.

**Cited evidence**:
- `tests/middleware.test.js` line 4: `jest.mock('../db/client', () => ({ auth: { getUser: jest.fn() } }))`
- Master plan §3C line 84: "Missing: real middleware test without jest.mock; mid-flow expiry E2E"
- Lane B inventory line 49: classified SEMI-HOLLOW — `jest.mock('../db/client')` for auth.getUser
- `common-pitfalls.md` Pitfall 11 (line 597-603): "mocks become stale as the real API evolves"
- `auth-flows.md` lines 709-733: session expiry by clearing cookies pattern

**Reproduction**:
1. Open `tests/middleware.test.js` line 4 — `jest.mock('../db/client')`
2. Search all `tests/` for a spec that lets a real Supabase JWT expire and asserts a redirect to auth — none found
3. Search for `page.context().clearCookies()` or expiry simulation in auth test files — not present

**Recommended fix**: Create `tests/api/auth-middleware.spec.js` issuing real `request.get('/api/circles-sessions')` with an expired/malformed Bearer token against localhost; assert 401 and `{ error: 'Unauthorized' }` shape; no Supabase mock.

---

### F-P04 — P0 — Guest Flow — No real API tests for guest CRUD family; only `400-without-header` for stats covered

**Surface**: Guest flow — `ensureGuestId` (app.js boot); POST /api/guest-circles-sessions routes/guest-circles-sessions.js:131; GET /api/guest-circles-sessions routes/guest-circles-sessions.js:27

**What's wrong**: Master plan §3C expects 4 real tests for guest session CRUD (create, list, gate, 400 without X-Guest-ID). Only the `400-without-header` case for the stats endpoint exists in `tests/guest-circles-stats.test.js` (32 LOC). The guest session create, list, and gate endpoints have zero real API coverage. The guest DELETE (`routes/guest-circles-sessions.js:160`) also lacks any real API test. The full guest route family — 10 CIRCLES guest routes + 9 NSM guest routes per Lane C — is systematically undercovered.

**Cited evidence**:
- Lane B inventory line 47: `tests/guest-circles-stats.test.js` (32 LOC, REAL — only 400 without X-Guest-ID for stats)
- Master plan §3C line 83: "Missing: real API test for guest session CRUD; migrate-guest real"
- Master plan §5 cross-dep #12 (line 208): "one 400-without-header test per guest route family — partial; full family not systematically covered [NEW]"
- Lane C lines 73-85: 10 guest CIRCLES endpoints; lines 100-108: 9 guest NSM endpoints — none have dedicated API-layer specs

**Reproduction**:
1. Search `tests/api/` for any spec referencing `guest-circles-sessions` — none found
2. Search `tests/*.test.js` for guest session create/list/gate — only `guest-circles-stats.test.js` found (stats only)
3. Attempt `request.post('/api/guest-circles-sessions')` with X-Guest-ID header — no test exercises this path

**Recommended fix**: Create `tests/api/guest-sessions-contract.spec.js` covering POST /api/guest-circles-sessions (create), GET list, POST /gate (with OpenAI mocked via `route.fulfill`), DELETE with real 204; mirror the `lifecycle-circles.spec.js` pattern using X-Guest-ID header instead of Bearer token.

---

### F-P05 — P0 — Auth + Cross-surface — `tests/migrate-guest.unit.test.js` triple-mocks auth, guest middleware, and db — zero real migrate-guest confidence

**Surface**: Guest migration — POST /api/migrate-guest routes/migrate.js:15; `migrationBanner` AppState:236

**What's wrong**: `tests/migrate-guest.unit.test.js` mocks all three layers: auth middleware (line 4), guest middleware (line 7), AND the Supabase `db/client` (lines 11-23). The route wiring is tested but no real database operation executes. This is exactly the `F-009` seed finding from master plan §7. The migration banner E2E flow (guest creates session → register → login → migrate-guest → banner shows once) has no test at any level. Given Lane L's B7 finding that cross-device data transfer is the highest-risk data-loss path, migrate-guest being test-free at the integration level is a critical gap.

**Cited evidence**:
- `tests/migrate-guest.unit.test.js` lines 4-23: triple `jest.mock` — auth middleware, guest middleware, db/client
- Master plan §7 F-009 (line 238): "Create real API-layer spec: guest creates session → auth user logs in → POST /migrate-guest with real Supabase test DB"
- Master plan §3C line 83: "migrate-guest tested only with `jest.mock('../db/client')` (F-004 analogue for migrate)"
- `common-pitfalls.md` Pitfall 11 (line 597): mocking own infra removes real integration confidence
- Lane L lines 86-89: localStorage vs server divergence — migrate-guest is the only mechanism for guest-to-auth data transfer; if it silently fails, guest sessions are permanently lost

**Reproduction**:
1. Open `tests/migrate-guest.unit.test.js` lines 4-23: observe all three jest.mock layers
2. Grep all tests for `request.post('/api/migrate-guest')` with real auth token — none found
3. Grep tests for `migrationBanner` assertion in any E2E context — none found

**Recommended fix**: Create `tests/api/migrate-guest-real.spec.js`: seed a guest session via `request.post('/api/guest-circles-sessions')`, register a new user, login to get real token, call `POST /api/migrate-guest` with real Supabase — assert session rows transferred, 200 response shape, conflict handling (23505 → conflicts++).

---

### F-P06 — P1 — Auth Surface — `tests/visual/auth-flow.spec.js` injects empty Supabase credentials — Supabase SDK never initializes; Lane B classification overstated

**Surface**: Auth — `renderAuth` app.js:2571; Supabase client init (app.js boot)

**What's wrong**: `auth-flow.spec.js` stubs `/api/config` with `{ supabaseUrl: '', supabaseAnonKey: '' }` (line 21). The Supabase JS client initializes with empty strings and silently fails all auth calls. All DOM assertions (login form BEM, register form BEM, error banner) are valid visual tests, but the spec's classification as "REAL (no own-API mocks)" in Lane B line 103 overstates its confidence. Supabase is effectively mocked by nullifying its configuration. The token expiry section cannot exercise the real 401 intercept path since no valid session ever existed.

**Cited evidence**:
- `tests/visual/auth-flow.spec.js` lines 21-26: `supabaseUrl: ''`, `supabaseAnonKey: ''` injected via `route.fulfill` on `/api/config`
- Lane B inventory line 103: "REAL (no own-API mocks)" — partially misleading; Supabase credentials are nullified
- Master plan §3C line 82: "Adequate" for auth error banner — needs qualification given empty Supabase credentials
- `authentication.md` lines 29-70: `storageState` pattern for real Supabase auth sessions

**Reproduction**:
1. Open `auth-flow.spec.js` line 21; observe `supabaseUrl: ''`
2. In browser console after page load, run `window.supabase.auth.getSession()` — returns URL parse error
3. Submit login form — Supabase SDK throws, caught silently; DOM renders error state not from real Supabase 401

**Recommended fix**: Reclassify `auth-flow.spec.js` as SEMI-HOLLOW in Lane B; complement with `tests/api/auth-register.spec.js` (F-P01) for real Supabase calls; for visual assertions only, document that the spec validates DOM structure under simulated auth state, not real auth behavior.

---

### F-P07 — P1 — Auth Surface — Shared single `AUTH_FILE` across all parallel E2E workers; no per-worker storageState isolation

**Surface**: Auth — all authenticated E2E surfaces; `playwright/.auth/user.json`

**What's wrong**: `tests/e2e/playwright.config.js` (lines 57, 64, 72) configures all three E2E projects (`e2e-desktop`, `e2e-mobile-chrome`, `e2e-mobile-safari`) to share the same `AUTH_FILE`. With `fullyParallel: true` (line 14), all worker processes load the same token. If Supabase invalidates a session during parallel runs (e.g., token rotation), all workers fail simultaneously. `authentication.md` lines 238-267 specifies the per-worker `{ scope: 'worker' }` fixture pattern to prevent Supabase session collision — this is not implemented. Master plan §4 E-22 (line 134) identifies this as a gap.

**Cited evidence**:
- `tests/e2e/playwright.config.js` lines 14, 57, 64, 72: `fullyParallel: true` + single shared `storageState: AUTH_FILE`
- `authentication.md` lines 238-267: per-worker fixture with `{ scope: 'worker' }` — required "when tests modify user state"
- Master plan §4 E-22 (line 134): "Parallel worker storageState isolation (test suite race) — all authenticated surfaces"
- `tests/api/playwright.config.js` line 26: `fullyParallel: false, workers: 1` — API layer correctly serializes; E2E layer does not

**Reproduction**:
1. Open `tests/e2e/playwright.config.js` line 14: `fullyParallel: true`
2. Lines 57, 64, 72: all three projects use identical `storageState: AUTH_FILE`
3. Run E2E config with `workers: 4` — if Supabase session is invalidated mid-run, all workers fail with opaque 401s

**Recommended fix**: Follow `authentication.md:238-267` per-worker fixture pattern; each worker authenticates once with `{ scope: 'worker' }` using `e2e@first-principle.test` credentials; retain `AUTH_FILE` as a pre-warm fallback for serial runs.

---

### F-P08 — P1 — Onboarding — `tests/visual/onboarding.spec.js` uses `waitForTimeout` (200ms, 150ms) — Pitfall 1 violation

**Surface**: Onboarding — `renderOnboardingOverlay` app.js:8279; `positionOnboardingTooltip()` app.js:8405

**What's wrong**: `onboarding.spec.js` line 32 calls `await page.waitForTimeout(200)` and line 43 calls `await page.waitForTimeout(150)` between coachmark step assertions. These arbitrary waits are a direct Pitfall 1 violation (`common-pitfalls.md` lines 9-44): slow on fast machines, flaky on slow CI runners. The correct pattern is a web-first assertion (`await expect(locator).toContainText(...)`) that auto-retries. The `positionOnboardingTooltip()` function (app.js:8405) runs after render — timing varies across host speeds.

**Cited evidence**:
- `tests/visual/onboarding.spec.js` line 32: `await page.waitForTimeout(200)`
- `tests/visual/onboarding.spec.js` line 43: `await page.waitForTimeout(150)`
- `common-pitfalls.md` lines 9-44: Pitfall 1 "Using waitForTimeout instead of Assertions — tests are slow and flaky; Fix: replace every waitForTimeout with a web-first assertion"
- Master plan §4 E-14 (line 126): `positionOnboardingTooltip()` timing risk on iOS scroll — already noted as iOS sensitive area (Lane C line 312)

**Reproduction**:
1. Open `tests/visual/onboarding.spec.js` lines 32 and 43 — both `waitForTimeout` calls between coachmark step clicks
2. Run spec on a slow CI runner with 2× test timeout — 200ms may fire before CSS transition completes
3. Grep file for condition-based waits after `[data-onb-action="next"]` click — none; only raw timeout

**Recommended fix**: Replace both `waitForTimeout` calls with `await expect(page.locator('.onb-tooltip__step')).toContainText('第 N 步 / 共 4 步')` web-first assertions; Playwright auto-retries until the condition is met, eliminating timing fragility.

---

### F-P09 — P1 — Onboarding — `historyList` empty-detection trigger for onboarding is not API-tested; real GET /api/circles-sessions response schema change would break onboarding silently

**Surface**: Onboarding — `onboardingActive` AppState:156; `loadHistory()` → `maybeStartOnboarding`; historyList AppState:228

**What's wrong**: Onboarding trigger depends on `loadHistory()` returning `[]` (Lane C cross-dep #5, line 254). `onboarding.spec.js` mocks `GET /api/circles-sessions` with `opts.history || []` (line 6) — it never exercises the real API boundary. If the route response schema changes (e.g., wrapping array in `{ sessions: [] }`), the onboarding trigger breaks in production while all tests still pass. Master plan §3D line 91: "dependency on historyList empty-list detection not API-tested."

**Cited evidence**:
- `tests/visual/onboarding.spec.js` line 6: `route.fulfill({ body: JSON.stringify(opts.history || []) })` — stubs own API
- Lane C cross-dep #5 (line 254): "`onboardingActive` only becomes `true` when `loadHistory()` returns empty list"
- Master plan §3D line 91: "dependency on historyList empty-list detection not API-tested"
- `common-pitfalls.md` Pitfall 11 (line 597-603): mocking own API removes confidence

**Reproduction**:
1. Open `onboarding.spec.js` lines 6-8 — three `route.fulfill` stubs for session list endpoints
2. Modify real routes to wrap response `{ sessions: [] }` — onboarding breaks in production; tests still pass
3. Search for any spec booting the app as a truly new user (no session list mock) and observing onboarding trigger — not found

**Recommended fix**: Add one integration E2E: boot app with `tests/setup/auth.setup.js` storageState as a fresh user with zero sessions; do NOT mock the sessions list; assert `.onb-welcome` appears naturally through `tryResumeLatestSession` and `loadHistory` hitting real GET endpoint.

---

### F-P10 — P1 — Cross-surface — `cross-tab-resume-toast.spec.js` bypasses `tryResumeLatestSession`; all 6 specs inject AppState directly, never exercising the real toast trigger

**Surface**: Resume toast — `renderResumeToast` app.js:3019; `tryResumeLatestSession()` (app.js); `_resumeToastShow` AppState:239

**What's wrong**: All 6 specs in `cross-tab-resume-toast.spec.js` inject AppState directly via `window.AppState.circlesEvaluating = true; window.render()` (lines 27-34). No spec exercises the actual `tryResumeLatestSession()` code path that sets `_resumeToastShow = true` from a real `GET /api/circles-sessions` response. Master plan §3E line 98: "Missing: API test for tryResumeLatestSession GET sessions → latest session selection logic." Lane C cross-dep #7 (line 258) confirms `tryResumeLatestSession()` calls real GET sessions.

**Cited evidence**:
- `tests/visual/cross-tab-resume-toast.spec.js` lines 27-34: `window.AppState.circlesEvaluating = true` direct injection
- Lane B inventory line 126: `cross-tab-resume-toast.spec.js` classified REAL — all specs bypass `tryResumeLatestSession` entirely
- Master plan §3E line 98: "Missing: API test for tryResumeLatestSession GET sessions → latest session selection logic"
- Lane C AppState line 239: `_resumeToastShow` mutated by `tryResumeLatestSession()` only
- Master plan §5 cross-dep #7 (line 183): "no dedicated test [NEW]"

**Reproduction**:
1. Open `cross-tab-resume-toast.spec.js` — every spec uses `window.AppState.*= ...` injection
2. Search tests for `tryResumeLatestSession` being invoked or tested — none found
3. Observe: `_resumeToastShow` is only set by `tryResumeLatestSession()` in real code; spec bypasses this entry point

**Recommended fix**: Add one real API test: seed an in-progress circles session via `request.post('/api/circles-sessions/draft')`, navigate to app WITHOUT mocking GET sessions, assert `.resume-toast` appears via natural `tryResumeLatestSession` flow; follow `auth-flows.md:928-949` seeding pattern.

---

### F-P11 — P1 — Cross-surface — Offcanvas restore spec stubs own `GET /:id`; real session restore with real DB data untested

**Surface**: Offcanvas history — `renderOffcanvas` app.js:7592; GET /api/circles-sessions/:id routes/circles-sessions.js:149; `restoreCirclesPhase1FromSession` (app.js:8001)

**What's wrong**: `offcanvas-item-click-restore.spec.js` stubs all four session endpoints including `GET /api/circles-sessions/${session.id}` (lines 35-36) with hardcoded `sampleActiveSession()` JSON. The real restore path — including the `restoreCirclesPhase1FromSession` merge logic (app.js:8001-8021) that merges localStorage with server `step_drafts` — is never exercised with real database rows. Master plan §5 cross-dep #8 (line 188): "needs real API seeding [NEW with real seed]." Lane L V-001 also flags that `step_drafts` merge logic is a data-loss risk.

**Cited evidence**:
- `tests/visual/offcanvas-item-click-restore.spec.js` lines 35-36: `route.fulfill` stubs own `GET /:id` endpoint
- Lane B inventory line 151: SEMI-HOLLOW
- Master plan §5 cross-dep #8 (line 188): "SEMI-HOLLOW; needs real API seeding [NEW with real seed]"
- Lane L B7 vectors line 89: `restoreCirclesPhase1FromSession` merge logic — real DB vs localStorage winner selection not tested with real data
- `auth-flows.md` lines 928-949: API-seeded session pattern for real data testing

**Reproduction**:
1. Open `offcanvas-item-click-restore.spec.js` lines 30-42: all `route.fulfill` stubs including `GET /:id`
2. Change real `step_drafts` schema shape on server — all offcanvas restore specs still pass
3. Open a real session via offcanvas with real `step_drafts` — restore may silently fail

**Recommended fix**: Create `tests/e2e/offcanvas-restore-real.spec.js`: seed a real session via `request.post('/api/circles-sessions/draft')` + `request.patch('.../progress', { data: { step_drafts: {...} } })`; open offcanvas and click the item; assert real phase and draft content restored; no GET /:id stub.

---

### F-P12 — P1 — Cross-surface — No API-tier test for `DELETE /api/circles-sessions/:id` 204 response + post-delete list absence

**Surface**: Offcanvas DELETE — `DELETE /api/circles-sessions/:id` routes/circles-sessions.js:162; `historyList` AppState:228

**What's wrong**: `tests/e2e/offcanvas-delete.spec.js` covers the CIRCLES success delete path in the browser, but `tests/api/` has no dedicated DELETE API contract test asserting the 204 response shape and that the session row is absent from GET list after delete. `test-architecture.md` line 46: "CRUD operations → API: Data integrity matters more than UI." The DELETE is only tested through the E2E browser layer — a Trophy inversion for a pure backend operation. Master plan §3E line 100: "Missing: real API test for DELETE."

**Cited evidence**:
- Master plan §3E line 100: "Missing: real API test for DELETE; offcanvas restore E2E with real session data"
- Lane C line 64: `DELETE /api/circles-sessions/:id` routes/circles-sessions.js:162 — no dedicated `tests/api/` spec
- `test-architecture.md` line 46: "CRUD operations → API: Data integrity matters more than UI for create/update/delete"
- `tests/api/lifecycle-list.spec.js` line 15: covers list filter but not delete
- `tests/api/lifecycle-circles.spec.js` line 13: covers `draft → progress → gate → final-report` but not DELETE

**Reproduction**:
1. Search `tests/api/` for any spec calling `request.delete('/api/circles-sessions')` — none found
2. After a real DELETE, GET list should not return the row — this assertion does not exist at API tier
3. `circles-delete-rollback-real.spec.js` tests the rollback/failure path (mocks 500) but not the 204 success path at API tier

**Recommended fix**: Add a DELETE test case to `tests/api/lifecycle-list.spec.js` or new `tests/api/circles-delete-contract.spec.js`: seed session, `request.delete('/api/circles-sessions/:id')`, assert 204, follow with GET list, assert session absent from response.

---

### F-P13 — P1 — Cross-surface — No browser E2E test for full Phase 1→2→3→4 lifecycle in a single spec with a real authenticated user

**Surface**: Lifecycle state machine — CIRCLES phase transitions in browser; `circlesPhase` AppState:158; all phase surfaces

**What's wrong**: `tests/api/lifecycle-circles.spec.js` tests the API state machine (POST /draft → PATCH /progress → POST /gate → ... → POST /final-report). However, no browser E2E test walks this full cycle. `test-architecture.md` line 56 classifies wizard/onboarding as E2E — the CIRCLES drill lifecycle is the same multi-step wizard pattern. Master plan §7 F-006 (line 235): "No real E2E browser spec walks CIRCLES Phase 1 → 2 → 3 → 4 in a single test." Lane B coverage gaps line 277 confirms this.

**Cited evidence**:
- Master plan §7 F-006 (line 235): "No real E2E browser spec walks CIRCLES Phase 1 → 2 → 3 → 4 in a single test with a real authenticated user against localhost"
- Lane B coverage gaps line 277: "No real E2E test for complete CIRCLES Phase 1→2→3→4 happy path in a single spec"
- `test-architecture.md` line 56: "Onboarding / wizard → E2E: Multi-step, state persists across pages"
- Lane C cross-deps #1-#2 (lines 246-249): Phase 2 unlock depends on gate pass; Phase 3 depends on all 7 evaluations — neither is browser-tested end-to-end

**Reproduction**:
1. Search `tests/e2e/` and `tests/playwright/journeys/` for a spec calling `/gate`, then `/message`, then `/evaluate-step`×7, then `/final-report` in one browser session — none found
2. `tests/e2e/circles-gate.spec.js` covers gate → phase 2 transition but stops there; no continuation to Phase 3/4
3. Lifecycle-circles.spec.js covers API calls but not browser-level phase transitions

**Recommended fix**: Create `tests/e2e/circles-full-flow.spec.js` using `test.step()` for each phase; seed auth via `auth-flows.md:928-949`; use real API calls through gate+message+evaluate×7+final-report; assert `circlesPhase` DOM attribute transitions at each step.

---

### F-P14 — P1 — Cross-surface — `circlesStale` storage event cross-tab detection untested; only AppState injection used in banner spec

**Surface**: Cross-tab stale detection — `circlesStale` AppState:174; `renderStaleBanner` app.js:3488; `localStorage` storage event handler

**What's wrong**: No spec exercises the cross-tab stale detection path. The mechanism depends on one browser tab writing to localStorage, and another tab's `storage` event listener updating `AppState.circlesStale`. Master plan §4 E-17 (line 129): "E2E multi-context: ctx A loads phase 1; ctx B saves progress; ctx A sees stale banner — no dedicated test." `tests/visual/phase1-locked-stale.spec.js` tests banner rendering but injects `circlesStale` directly without exercising the storage event path. A key rename in app.js would go undetected.

**Cited evidence**:
- Master plan §4 E-17 (line 129): cross-tab stale detection — no dedicated test
- Master plan §5 cross-dep #9 (line 193): "no dedicated test [NEW]"
- Lane C AppState line 174: `circlesStale` — mutated by "multi-tab storage event"
- `tests/visual/phase1-locked-stale.spec.js` (Lane B line 154: REAL) — tests banner render only; injects AppState directly
- `authentication.md` line 238: multi-context per-worker pattern for cross-tab isolation

**Reproduction**:
1. Search all tests for `setItem.*circlesStale\|storage.*event` — none found in browser E2E context
2. Open `phase1-locked-stale.spec.js` — sets `circlesStale` via `window.AppState` injection, not real storage event
3. Rename the localStorage key used for stale detection in app.js — no test detects the regression

**Recommended fix**: Add `tests/e2e/cross-tab-stale.spec.js`: open ctx A to Phase 1 (with real authenticated session); open ctx B via `browser.newContext()`; ctx B triggers a PATCH /progress; assert ctx A receives `storage` event and shows `.banner--warn`; pattern per `authentication.md:238-267`.

---

### F-P15 — P1 — Cross-surface — CIRCLES → NSM cross-promo navigation and Phase 3 → Phase 1 back-drill nav have no dedicated E2E tests

**Surface**: CIRCLES → NSM cross-promo card (`renderCirclesHome` app.js:5371); Phase 3 → Phase 1 back-drill nav (`circlesPhase` reset); view tab switch circles↔nsm

**What's wrong**: No test verifies:
(a) The NSM cross-promo card in CIRCLES Home navigates to NSM Step 1 while preserving the circles session state.
(b) Clicking back from Phase 3 resets `circlesPhase` to 1 without losing `circlesDrillStep` or `circlesSelectedQuestion`.
Master plan §3E surface 11 (CIRCLES → NSM cross-promo) and surface 12 (Phase 3 → Phase 1 back drill nav) list these as expected E2E coverage. Lane B journey specs (`circles.spec.js`, `nsm.spec.js`) cover basic navigation but not these cross-surface transitions.

**Cited evidence**:
- Master plan §3E line 97: navbar tab switch "Adequate" — but cross-promo card click not verified
- Lane C line 13: `renderCirclesHome` includes NSM cross-promo card per mockup 01 §D
- Master plan §3E surface 11 (line 93): "CIRCLES → NSM cross-promo navigation" — no coverage in Lane B gap map
- Master plan §3E surface 12 (line 93): "Phase 3 → Phase 1 back drill nav" — no dedicated E2E found
- Lane B line 223: `circles.spec.js` (REAL) covers home → phase 1 but not cross-promo or back-drill

**Reproduction**:
1. Search `tests/` for a spec that clicks the NSM cross-promo card from CIRCLES home — none found
2. Search for a spec asserting `circlesPhase === 1` after a back action from Phase 3 — none found
3. Grep for `data-nav="nsm"\|cross-promo` as a tested interaction in test files — not found

**Recommended fix**: Add `tests/e2e/cross-surface-nav.spec.js` with two `test.step()` chains: (1) CIRCLES home → click NSM cross-promo → assert `view=nsm` + `nsmStep=1`; (2) CIRCLES Phase 3 → back button → assert `circlesPhase=1`, `circlesSelectedQuestion` preserved.

---

### F-P16 — P1 — Cross-surface — NSM session delete in offcanvas is explicitly skipped; `DELETE /api/nsm-sessions/:id` has no E2E or API test

**Surface**: Offcanvas DELETE → NSM — `DELETE /api/nsm-sessions/:id` routes/nsm-sessions.js:79; `historyList` cache invalidation after NSM delete

**What's wrong**: `tests/e2e/offcanvas-delete.spec.js` has a comment at line 6: "B4-E3 NSM skipped pending seed helper." The NSM session delete path is explicitly not covered. `DELETE /api/nsm-sessions/:id` (Lane C line 94) has zero real E2E or API test coverage. After a NSM delete, `loadHistory()` should refresh and remove the item — this cache invalidation is unverified for the NSM path.

**Cited evidence**:
- `tests/e2e/offcanvas-delete.spec.js` line 6: "B4-E3 NSM skipped pending seed helper"
- Lane C line 94: `DELETE /api/nsm-sessions/:id` routes/nsm-sessions.js:79 — no dedicated test found in `tests/api/` or `tests/e2e/`
- Master plan §3E line 100: "delete 204" expected test — CIRCLES partially covered, NSM missing
- Lane B inventory lines 149-150: `offcanvas-delete-routing.spec.js` (SEMI-HOLLOW) — covers CIRCLES only

**Reproduction**:
1. Open `tests/e2e/offcanvas-delete.spec.js` line 6: "B4-E3 NSM skipped"
2. Search tests for `request.delete('/api/nsm-sessions')` — none found
3. Delete a NSM session from offcanvas manually — no test verifies `historyList` updates correctly or that 204 is returned

**Recommended fix**: Implement the skipped B4-E3 NSM delete test in `offcanvas-delete.spec.js` using the NSM session factory (or `request.post('/api/nsm-sessions')` seed); assert DELETE 204 + `historyList` item absent; follow existing CIRCLES delete pattern in the same file.

---

### F-P17 — P2 — Cross-surface — Visual playwright config has no storageState; authenticated-user visual surfaces cannot be verified across 8 viewports

**Surface**: All authenticated visual surfaces; `tests/visual/playwright.config.js`

**What's wrong**: `tests/visual/playwright.config.js` (lines 1-42) has no `setup` project, no `storageState`, and no `dependencies` array. All visual specs run in an unauthenticated state (guest mode). Authenticated-user behaviors (personalized history in offcanvas, migrate-guest banner, session-count stats strip) cannot be tested by the 8-viewport visual suite. This is acceptable for mockup compliance testing, but means the full 8-viewport coverage claimed in CLAUDE.md is guest-only for §3C/3D/3E authenticated surfaces.

**Cited evidence**:
- `tests/visual/playwright.config.js` lines 1-42: no setup project, no storageState, no dependencies
- `authentication.md` lines 29-70: `storageState` pattern — load saved state to start authenticated
- Lane B line 103: `auth-flow.spec.js` classified REAL but injects empty Supabase credentials (see F-P06)
- Master plan §3C table line 82: "2 tests: login form BEM, register form BEM" — these cover guest-mode DOM only; authenticated-only UI paths are not in the 8-viewport visual suite

**Reproduction**:
1. Open `tests/visual/playwright.config.js` — no setup project, no storageState reference
2. Run any visual spec — `window.AppState.userEmail === null`, `window.AppState.accessToken === null` in all 8 viewports
3. `migrationBanner` rendering (`renderGlobalBanners` app.js:3058) cannot appear without authenticated flow

**Recommended fix**: Acceptable as-is for mockup compliance; explicitly document in Lane B that visual specs cover guest-mode rendering only; authenticated-user visual coverage should be routed to `tests/e2e/` with storageState; add a note to `tests/visual/playwright.config.js` to prevent future confusion.

---

## §2 Lane L (B7) Cross-surface Overlap Map

| Lane L Vector | Cross-surface gap overlap | Lane P finding |
|---|---|---|
| V-001 triggerSaveCycle fire-and-forget (app.js:3796) | Cross-device: offcanvas history shows stale `step_drafts`; resume reads stale server state | F-P11 (offcanvas restore not exercised with real DB) |
| V-002 gateResult PATCH fire-and-forget (app.js:7512) | Cross-device: gate result not persisted → Phase 1.5 gate-pending re-shown on second device | F-P12 (no DELETE API test is orthogonal; gate persist gap feeds into offcanvas restore gap) |
| V-003 ensureCirclesDraftSession silent null (app.js:3745) | Draft session creation failure → `historyList` stays empty → onboarding triggers on every reload | F-P09 (onboarding trigger depends on historyList API; untested integration boundary) |
| V-004 NSM gateResult not persisted (nsm-sessions.js:150) | NSM offcanvas shows as "gated" when it should show "passed" | F-P11 + F-P16 (NSM offcanvas restore and NSM delete both gap; F-P04 guest gate gap) |
| V-005 NSM evaluate no pre-write checkpoint (nsm-sessions.js:94) | AI evaluation result lost on crash; no test verifies idempotency of /evaluate | F-P04 guest flow gap (guest NSM evaluate also has no API test) |
| V-006 Phase 2 conclusion localStorage orphan (app.js:6793, 7996) | Resume reads server-only; localStorage write is orphaned — not in §3C/D/E scope | Forward-reference to Phase 2 slice findings |

---

## §3 Skill Citations Applied

| Skill | Section | Applied to |
|---|---|---|
| `auth-flows.md` | lines 928-949 (API login for seeding) | F-P01, F-P04, F-P05, F-P10, F-P11: recommended fix patterns |
| `auth-flows.md` | lines 709-733 (session expiry pattern) | F-P02, F-P03: mid-flow JWT expiry gap |
| `authentication.md` | lines 29-70 (storageState reuse) | F-P07, F-P17: shared AUTH_FILE risk |
| `authentication.md` | lines 238-267 (per-worker scoping) | F-P07: parallel worker collision; F-P14: multi-context for cross-tab |
| `test-architecture.md` | lines 42-58 (decision matrix) | F-P01 (register → API tier); F-P12 (CRUD → API); F-P13 (wizard → E2E) |
| `common-pitfalls.md` | Pitfall 11 (lines 597-661) | F-P03, F-P05, F-P06, F-P09, F-P10: over-mocking own API |
| `common-pitfalls.md` | Pitfall 1 (lines 9-44) | F-P08: waitForTimeout in onboarding spec |

---

## §4 Summary Table

| ID | Severity | Surface | One-line summary |
|---|---|---|---|
| F-P01 | P0 | Auth (Register) | No real API test for POST /api/auth/register; 409 duplicate path uncovered |
| F-P02 | P0 | Auth (Login journey) | `auth.spec.js` 100% skipped — dead spec, zero coverage in any test run |
| F-P03 | P0 | Auth (Middleware / JWT) | `middleware.test.js` mocks Supabase; no real mid-flow expiry test |
| F-P04 | P0 | Guest Flow | Guest session CRUD (create/list/gate/DELETE) has zero real API tests |
| F-P05 | P0 | Auth + Cross (migrate-guest) | Triple-mock in migrate-guest.unit.test.js; migration banner E2E missing |
| F-P06 | P1 | Auth (visual spec) | `auth-flow.spec.js` injects empty Supabase credentials; Lane B classification overstated |
| F-P07 | P1 | Auth (parallelism) | Single shared `AUTH_FILE` across all parallel workers — Supabase session collision risk |
| F-P08 | P1 | Onboarding | `waitForTimeout` (200ms, 150ms) in onboarding spec — Pitfall 1 violation |
| F-P09 | P1 | Onboarding | `historyList` empty-detection for onboarding trigger not API-tested |
| F-P10 | P1 | Resume toast | `cross-tab-resume-toast.spec.js` bypasses `tryResumeLatestSession`; AppState-injected only |
| F-P11 | P1 | Offcanvas restore | `offcanvas-item-click-restore.spec.js` stubs own GET /:id; real DB restore untested |
| F-P12 | P1 | Offcanvas DELETE | No API-tier test for `DELETE /api/circles-sessions/:id` 204 + post-delete list absence |
| F-P13 | P1 | Lifecycle state machine | No browser E2E for full Phase 1→2→3→4 lifecycle in single spec |
| F-P14 | P1 | Cross-tab stale | `circlesStale` storage event path untested; only AppState injection in banner spec |
| F-P15 | P1 | Cross-surface nav | CIRCLES → NSM cross-promo and Phase 3 → Phase 1 back-drill have no E2E coverage |
| F-P16 | P1 | Offcanvas DELETE (NSM) | NSM delete E2E explicitly skipped in `offcanvas-delete.spec.js`; no API test either |
| F-P17 | P2 | Visual config (auth) | Visual config has no storageState; authenticated visual surfaces unverifiable at 8 vp |

**Total findings: 17 (5 P0, 11 P1, 1 P2)**

---

## §5 Top 3 P0 Escalations

**F-P02** — `tests/playwright/journeys/auth.spec.js` is permanently dead (`test.describe.skip`). The most security-critical surface (login journey) contributes zero E2E coverage. Auth regressions in the Path 2 UI (selector changes, form binding failures) go completely undetected across all 8 viewports.

**F-P04** — Guest session CRUD family (10 auth-variant guest CIRCLES routes + 9 guest NSM routes per Lane C lines 73-108) has zero real API tests. Only one 400-without-header stats test exists. Guest users are the primary onboarding path; a breaking change to any guest route is undetectable by the test suite.

**F-P05** — `migrate-guest.unit.test.js` triple-mocks auth, guest middleware, and Supabase db/client. The migration path (guest data to auth user on register) is the B7-analogous cross-device data transfer. If the route breaks silently due to a real DB schema change, guest users who register lose all their drill history with no test detecting the regression.

---

*Lane P audit complete. File: `audit/findings-slice-cross-2026-05-17.md`. No code changes made.*
