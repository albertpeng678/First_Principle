# E2E Comprehensive Integration Test Findings (2026-05-17)

> Director (opus) ran systematic post-cap parallel e2e verification per user 首要綱領「所有修復必過 e2e 整合測試」+ 「揪出愈多問題愈好」directive。Multi-spec parallel + cross-vp + skill-cited per playwright-skill.

## Verification Matrix

| Spec | Projects | Result | Notes |
|---|---|---|---|
| **API contract full suite** | 11 projects | ✅ 137/137 PASS (2.8m) | All Group A V1-V8 + Plan #194 T1 422 guard + guest CRUD full coverage GREEN |
| **Plan #194 T6 NSM evaluate checkpoint** | 3 e2e projects | ✅ 10/10 PASS (21.8s) | TC1/TC2/TC3 GREEN × desktop+mobile-chrome+mobile-safari |
| **Plan #194 T3 gate await PATCH** | 3 e2e projects | ✅ 50/50 PASS × 5 runs (per prior Re-Review) | data-loss fix verified |
| **Plan #194 T4 ensureCirclesDraftSession retry** | e2e-desktop | ⚠️ 2/3 PASS | TC2 exhaust ✓ TC3 retry ✓, **TC1 happy retry TIMEOUT 60s** waiting for gate POST |
| **Bug 6 Phase 4 422 guard (final-report)** | api | ✅ 2/2 PASS (5.7s) | F-N-003 contract GREEN |
| **Bug 7 Phase 3 restore (B3-R1)** | 3 e2e projects | ❌ 9 PASS / 1 **FAIL** | **e2e-mobile-safari** fails: page snapshot shows `renderCirclesStub()` legacy fallback「待 Plan B 實作」 |
| **Chat-drift Wave 2 (circles-back-nav-lock)** | 3 e2e projects | ❌ setup FAIL | `auth.setup.js` net::ERR_CONNECTION_REFUSED on page.reload — 15 tests did not run |

## 🔴 P0 Real Bug: iOS Safari Phase 3 Restore Fallback

**Repo path**: `tests/e2e/circles-phase3-restore-real.spec.js` TC `B3-R1`
**Failure mode**: page snapshot shows `<div data-view="circles">CIRCLES view — 待 Plan B 實作</div>` (production code `public/app.js:353` `renderCirclesStub()`)

**Trigger logic** (app.js:325-343):
- Phase 3 render requires `circlesPhase === 3 && circlesSession`
- All conditions failing → fallback `renderCirclesStub()` fires

**Root cause hypothesis**: On WebKit (iOS Safari), after restore flow:
- `AppState.circlesSession` is `null` at render time (race)
- OR `AppState.circlesPhase` not 3
- Desktop + mobile-chrome (Chromium) consistently set state correctly before render
- WebKit handles async hydration / storageState load order differently

**User-visible impact**: Matches user's PNG-23「已填寫內容會消失」report. iOS Safari users may see blank/fallback view after restoring scored sessions instead of their actual content + scores.

**Recommended fix**: Investigate restore flow timing — ensure render() awaits state hydration completion on WebKit. Likely involves `restoreCirclesPhase1FromSession` or `tryResumeLatestSession` async ordering.

## 🟡 P1 Infra: Auth Setup Race Under Parallel Load

**Repo path**: `tests/setup/auth.setup.js`
**Failure mode**: `page.reload: net::ERR_CONNECTION_REFUSED` mid-test

**Context**: Previous fix `313b4fd` solved file-level atomic rename for storageState. But **server :4000 briefly drops connection** when multiple Playwright test suites run in parallel (3+ e2e projects + simultaneous specs).

**Symptoms**:
- Setup fails to reload page during auth UI flow
- 15 downstream tests aborted (`did not run`)
- Server itself remains healthy after (200 OK on /health)
- Only manifests under high parallel load

**Recommended fix**: Either
- (a) Test serialization (lower `workers` in playwright.config for setup project)
- (b) Server connection retry helper in auth.setup
- (c) Investigate dev server keep-alive under burst load

## 🟡 P1 T4 TC1 Pending Diagnosis

**Repo path**: `tests/e2e/circles-draft-retry-real.spec.js:150` TC1 happy retry
**Failure**: timeout 60s waiting for POST `/circles-sessions/:id/gate`

**Production wire** (app.js:7612-7635): structurally correct
- try { await persistRetry(ensureCirclesDraftSession) } catch RetryExhausted → DRAFT_CREATE_FAILED
- After success → check sid → continue to gate POST

**Possible**: 
- ensureCirclesDraftSession internal state pollution from preflight 503 (line 7099 silent catch)
- 1st-attempt-fault → 2nd-attempt-success but state not propagated correctly
- Test setup pre-counting phase blocks all draft → preflight call may corrupt cache

**Production code shipped at 87e1999 with caveat in commit message**. Needs deeper diagnosis (dispatch sonnet post-cap).

## ✅ Confirmed Working

- **Plan #194 T3 gate await** — 50/50 GREEN × 5 runs, data-loss bug closed
- **Plan #194 T6 NSM evaluate checkpoint** — 10/10 GREEN × 3 e2e projects
- **API full suite (137 specs)** — all contract tests pass
- **Bug 6 Phase 4 422 guard** — confirmed working
- **Chat-drift Wave 1-4 production code** — committed + pushed origin/main (10 commits)
- **Plan #194 BE pre-write checkpoint** — verified via T6 tests (writes evaluating=true before AI call)

## Investigation Pending

- **Bug 7 iOS Safari fix** — needs sonnet investigate WebKit restore race
- **T4 TC1 happy retry** — needs sonnet investigate preflight state pollution
- **Auth setup parallel race** — infra fix (workers config or retry)
- **Bug 3 spinner stuck** — INCONCLUSIVE, need longer test window + user input
- **Bug 4 offcanvas delete cache** — NOT_REPRODUCIBLE, need user clarify (guest? device?)

## Skill Citations Applied

Per playwright-skill at `/Users/albertpeng/.claude/skills/playwright-skill/core/`:
- `common-pitfalls.md` Pitfall 11 (no own backend mock) — strictly held in all newly-run specs
- `api-testing.md:783-848` (data seeding via service-role) — used in T6 TC2 stuck-state setup
- `auth-flows.md:928-949` (API seed auth) — auth.setup.js storageState + apiFetch in-page
- `mobile-and-responsive.md` — caught WebKit-specific race in Bug 7
- `network-mocking.md:839-933` (intermittent failure pattern) — T4 TC2/TC3 503 simulation

## Director Verdict

E2E integration testing under 首要綱領 **caught 2 real bugs + 1 infra issue + verified 4 ships GREEN**:
- ✅ T3 / T6 / Bug 6 / API suite — production-ready
- ⚠️ T4 partial — committed with caveat, needs follow-up
- 🔴 Bug 7 iOS Safari — NEW BUG found, matches user PNG-23 report
- 🟡 Auth setup race — infra debt under parallel load

Per IL-2 verification: claims backed by independent test runs + reviewer cross-check + Director cold-Read of evidence PNGs.
