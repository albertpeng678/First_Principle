# Testing Trophy Audit — 2026-05-16

**Methodology**: Each test file touched today reviewed against playwright-skill `core/test-architecture.md` Testing Trophy + `core/when-to-mock.md` Pitfall 11 (over-mocking own API).

**Trophy ideal**: API 60% + Component 30% + E2E 10%
**Today's reality**: ~60% over-mocked unit/contract pretending to be integration, ~30% real E2E, ~10% real pure unit. Inverted.

---

## Tier 1 — KEEP (pure logic, no integration claim)

These test pure functions. Mocks are minimal or none. Valid jest unit tests.

| File | What it tests | Verdict |
|---|---|---|
| `tests/unit/framework-validator.test.js` | `minLength` / `notAllSameChar` / `notTrivialAsciiToken` / `validateFrameworkInput` (Stage 1A T5) | ✅ KEEP — pure function |
| `tests/lib/persist-retry.test.js` | `retryWithBackoff` / `defaultBackoff` (5 P0 T1) | ✅ KEEP — pure function |
| `tests/lib/session-lifecycle.test.js` | `computeLifecycle` / `hasSubstantiveContent` (Lifecycle T2) | ✅ KEEP — pure function |
| `tests/scripts/backfill-lifecycle.test.js` | `classify()` (Lifecycle T2) | ✅ KEEP — pure function |
| `tests/migrations/2026-05-17-session-lifecycle.test.js` | SQL regex shape (Lifecycle T1) | ✅ KEEP — text assertion |
| `tests/unit/prompts-question-only.test.js` | Prompt strings don't interpolate user input (1D T1+T2) | ✅ KEEP — text assertion |
| `tests/helpers/env-guard.test.js` | env-guard validation (Stage 0) | ✅ KEEP — pure function |
| `tests/fixtures/auto-cleanup.test.js` | Auto-cleanup fixture logic (Stage 0) | ✅ KEEP — pure function |

**Count: 8 files** — these are the only legitimate "test green = something real" tests today.

---

## Tier 2 — REWRITE (vm.createContext "fake component" tests)

These extract a JS function from `public/app.js` source text, run it in `vm.createContext` with stubbed `AppState` and `apiFetch`. **Anti-pattern per Pitfall 11** — mocks all dependencies including own HTTP client. Tests pass but production integration unverified.

| File | Problem | Action |
|---|---|---|
| `tests/unit/circles-restore-phase3.test.js` | Stubbed `AppState`, function-as-string extraction | REWRITE as real E2E that loads `/circles` page, injects session via real backend, verifies score UI renders |
| `tests/unit/circles-delete-rollback.test.js` | Same pattern + stubbed `apiFetch` | REWRITE as real E2E hitting real DELETE endpoint + `route.fulfill 500` only for the failure case |

**Count: 2 files** — replace with real E2E.

---

## Tier 3 — REPLACE (in-memory mock pretending to be API contract)

These use `tests/helpers/test-supabase.js` which is a hand-rolled in-memory mock of Supabase. **Pure Pitfall 11 violation** — mocks own database/API surface. Tests pass even when migration not run / column missing / etc.

| File | Problem | Action |
|---|---|---|
| `tests/contracts/lifecycle-circles-route.test.js` | `createMockDb()` + supertest against in-memory mock | REWRITE as `tests/api/lifecycle-circles.spec.js` using Playwright `request.post/get/patch` hitting real `localhost:4000` BE |
| `tests/contracts/lifecycle-nsm-route.test.js` | Same | REWRITE as `tests/api/lifecycle-nsm.spec.js` real API |
| `tests/contracts/lifecycle-list-filter.test.js` | Same | REWRITE as `tests/api/lifecycle-list.spec.js` real API |
| `tests/integration/hint-routes.test.js` | Mock OpenAI but supertest against real express app — borderline | KEEP shape, verify uses real express (not mock express) |
| `tests/circles-sessions.test.js` | Pre-existing baseline with extended B4 cache specs — uses real express + spy on cache module | KEEP — uses real route handler + spy pattern is acceptable |

**Count: 3 hard rewrites + 2 borderline acceptable.**

---

## Tier 4 — FIX (real E2E but with anti-patterns)

These actually hit real Playwright + browser, but contain Pitfall 11 / 14 / 18 violations.

| File | Issue | Action |
|---|---|---|
| `tests/e2e/circles-gate.spec.js` | Mostly real BE; visual baseline pixel-diff is inherently flaky against live LLM output (flagged earlier) | FIX visual specs: use `mask:` for LLM-generated text rows OR drop pixel-diff in favor of structural assertions |
| `tests/e2e/circles-phase3-restore.spec.js` | Uses `page.evaluate` to inject AppState directly — Pitfall 18 (evaluate overuse) | OK for now (skill §1097 allows for app-specific JS APIs); add `test.step()` per Pitfall 19 |
| `tests/e2e/offcanvas-delete.spec.js` | Real BE + `route.fulfill 500` for failure case — appropriate per when-to-mock §660 (carve-out for error states) | KEEP as-is, exemplar |
| `tests/e2e/phase2-ui-fix.spec.js` | `'normal-test-session-synthetic'` sentinel — Pitfall 14 (module-level shared assumption) | FIX: use real `ensureCirclesDraftSession` path via API seed; remove sentinel |
| `tests/visual/phase2-qchip.spec.js` | Visual snapshot, no integration claim | KEEP |

**Count: 5 files — 2 fixes + 3 keeps.**

---

## Tier 5 — Infrastructure (mixed signals)

| File | Verdict |
|---|---|
| `tests/factories/circles-phase1.factory.js` | KEEP — test data factory |
| `tests/page-objects/circles-phase1.page.js` | KEEP — POM |
| `tests/page-objects/circles-phase2-qchip.component.js` | KEEP — POM |
| `tests/setup/auth.setup.js` | KEEP — Playwright auth setup |
| `tests/fixtures/auto-cleanup.fixture.js` | KEEP — runtime cleanup |
| `tests/helpers/env-guard.js` | KEEP — safety check |
| **`tests/helpers/test-supabase.js`** | **DELETE after Tier 3 rewrites land** — this is the mock-Supabase that powers all the hollow-green contract tests |

---

## Tier 6 — Adversarial (real OpenAI, OK)

| File | Verdict |
|---|---|
| `tests/adversarial/nsm-step2-hint.test.js` | KEEP — calls real OpenAI to verify prompt behavior |

---

## Tier 7 — Already quarantined (16 files)

`tests/visual/_quarantine_prod_legacy/*` — already isolated by Stage 0 B7 ship. No action.

---

## Tier 8 — Already deleted today (5 capture specs)

Per commit `0faceca`. Already gone.

---

## Summary Counts

| Tier | Count | Action |
|---|---|---|
| 1 KEEP pure unit | 8 | None |
| 2 REWRITE vm.createContext fakes | 2 | Replace with real E2E |
| 3 REPLACE mock-DB "contracts" | 3 + 2 borderline | Build `tests/api/` real Playwright `request` tests |
| 4 FIX E2E anti-patterns | 2 fixes + 3 keeps | Surgical edits |
| 5 Infrastructure | 6 keep + 1 DELETE (`test-supabase.js`) | Delete mock library after Tier 3 done |
| 6 Adversarial | 1 | None |
| 7 Quarantine | 16 | None |
| 8 Already deleted | 5 | None |

**Hollow-green count: 5 files (Tier 2 ×2 + Tier 3 hard ×3)** — these are the tests that lied about integration coverage. Plus `test-supabase.js` (the mock library underpinning them).

**Real integration coverage today: only 5 E2E specs + 8 pure units (~ 13 real tests).**

---

## Trophy Reset Roadmap

### Step 3 (next): Build `tests/api/` real API tests

Replace 3 hollow contract tests with real Playwright `request.post/get/patch` against `localhost:4000`:
- `tests/api/lifecycle-circles.spec.js` — POST /draft, PATCH /:id/progress, POST /:id/gate, POST /:id/final-report all hit real BE
- `tests/api/lifecycle-nsm.spec.js` — POST /:id/gate, POST /:id/evaluate real
- `tests/api/lifecycle-list.spec.js` — GET /:id and list with ?include_empty operator gate

Use real Supabase test DB (auto-cleanup fixture per Stage 0). No mock-DB.

### Step 4: Single critical-path E2E

ONE spec: login → 寫 framework → submit gate → 看結果 → 看 lifecycle 升級。Real BE, real Supabase test account, no mocks. Mock only OpenAI gate response with `route.fulfill` for determinism (acceptable per when-to-mock §660 — testing the integration flow, not the AI).

### Step 5: Delete hollow tests

After Step 3 + 4 ship, delete:
- `tests/unit/circles-restore-phase3.test.js`
- `tests/unit/circles-delete-rollback.test.js`
- `tests/contracts/lifecycle-circles-route.test.js`
- `tests/contracts/lifecycle-nsm-route.test.js`
- `tests/contracts/lifecycle-list-filter.test.js`
- `tests/helpers/test-supabase.js`

Net: -6 files of hollow tests, +4 files of real integration coverage.
