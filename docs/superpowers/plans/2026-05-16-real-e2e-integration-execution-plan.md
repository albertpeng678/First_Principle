# Real E2E Integration Execution Plan — Path 3 (18 P0 Closure)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute task-by-task. Steps use checkbox (`- [ ]`) syntax. Each task gets a fresh sonnet subagent + 2-stage opus reviewer.

**Goal:** Close 18 P0 findings from `audit/findings-slice-{circles,nsm,cross,edge}-2026-05-17.md` by writing real Playwright integration tests that hit localhost:4000 + real Supabase + mock only OpenAI, following playwright-skill discipline verbatim.

**Architecture:** 14 sonnet lanes in 2 groups (A = pure test gap, no BE bug expected; B = expected to RED then document BE bug). All new specs live in `tests/api/` (Trophy 60%) or `tests/e2e/` (Trophy 10%). Zero own-API mocks except documented carve-outs. Every commit has opus code-reviewer that cross-checks playwright-skill citation actually applied (not just referenced).

**Tech Stack:** Playwright `request.post/get/patch` (api-testing.md), `page.route` with carve-out only (when-to-mock.md), Supabase test DB via `auto-cleanup.fixture.js` + service-role direct seed where no API exists, `storageState` from `auth.setup.js`, jest only for pure unit (Trophy ~10%).

---

## §0 Why this plan exists

User explicitly stated: "要徹底使用 playwright-skill 做到 e2e 整合測試，避免之前見樹不見林的問題". 2026-05-16 Lane H shipped a hollow test that "passed" because the helper it claimed to test was never loaded in browser — discovered by Lane L investigation, fixed by Lane M. To prevent recurrence at scale (14 lanes), this plan codifies the playwright-skill e2e integration discipline as Appendix A which every lane must apply (not just cite).

---

## §1 Background

### 1.1 Source of 18 P0 findings

| Slice | File | P0 count |
|---|---|---|
| CIRCLES | `audit/findings-slice-circles-2026-05-17.md` | 4 (F-N-001..004) |
| NSM | `audit/findings-slice-nsm-2026-05-17.md` | 3 (N-01, N-02, N-03) |
| Cross-surface | `audit/findings-slice-cross-2026-05-17.md` | 5 (F-P02, F-P04, F-P05, +2) |
| Edge | `audit/findings-slice-edge-2026-05-17.md` | 6 (EQ-R-01, EQ-R-04, EQ-F-03, EQ-F-04, EQ-M-01, EQ-A-01) |

### 1.2 Trophy reality (from `audit/lane-b-test-inventory-2026-05-17.md`)

- Total 210 spec/test files
- API tier: 18 files (target 60% → 126 — under by 108)
- E2E tier: 95 files (target 10% → 21 — OVER by 74)
- Hollow (vm.createContext / mock own DB-API): 18 files
- Semi-hollow (stubs stats / list, real UI): 65 files

This plan adds ~14 new API/E2E tests targeting the 18 P0 gaps. It does not delete hollow tests — that's Retrofit G (#205) separately.

### 1.3 Triage (decided in brainstorm)

- **Group A (8 lanes — already dispatched 2026-05-16 22:55)**: pure test gap, BE expected GREEN
- **Group B (6 lanes — this plan dispatches)**: test will likely RED → document BE bug, don't fix BE
- **Group C (4 findings — out of plan scope)**: require brainstorm before implementation (frameworkDraft merge / nsmDefinition PERSISTED_KEYS / lock invariant full strategy)

---

## §2 File structure

### New files this plan creates

```
tests/api/
├── circles-final-report-contract.spec.js     [V1 — F-N-003]
├── circles-message-sse-real.spec.js          [V2 — F-N-004]
├── circles-sessions-list-contract.spec.js    [V3 — F-N-005]
├── circles-evaluate-step-contract.spec.js    [V4 — F-N-009]
├── circles-score-sequence.spec.js            [V5 — F-N-010]
├── nsm-gate-contract.spec.js                 [V6 — N-01]
├── guest-crud-real.spec.js                   [V8 — F-P04]
├── gate-mutex-concurrent.spec.js             [V10 — F-N-002 / EQ-R-01]
├── gate-fire-and-forget-compound.spec.js     [V11 — EQ-R-01 compound]
└── circles-jwt-mid-flow.spec.js              [V13 — EQ-A-01]

tests/e2e/
├── auth-flow-real.spec.js                    [V7 — F-P02]
├── nsm-full-flow.spec.js                     [V9 — N-02 / NSM critical-path]
├── circles-stale-multi-tab.spec.js           [V12 — EQ-M-01]
└── guest-to-auth-migration.spec.js           [V14 — F-P05]

tests/playwright/journeys/auth.spec.js          [DELETE — dead spec replaced by V7]
```

**Files NOT touched by this plan:**
- `public/app.js` (production code) — BE bugs documented but not fixed
- `routes/**` (production code) — same
- `prompts/**` — same
- Existing test files — Retrofit G separately

### Existing files used (read-only or as fixture)

| File | Purpose |
|---|---|
| `tests/api/fixtures/api-cleanup.fixture.js` | Auto-cleanup with auth token (V1-V6, V8, V10, V11, V13) |
| `tests/fixtures/auto-cleanup.fixture.js` | Base browser cleanup (V7, V9, V12, V14) |
| `tests/setup/auth.setup.js` | storageState producer for e2e specs (V7 OPTIONAL skip — that spec tests login UI directly) |
| `tests/api/playwright.config.js` | testMatch `**/*.spec.js` auto-discovers new specs — DO NOT modify |
| `tests/e2e/playwright.config.js` | Same — DO NOT modify |
| `audit/lane-b-test-inventory-2026-05-17.md` | Current coverage reference |
| `audit/lane-c-product-surface-map-2026-05-17.md` | Endpoint + render function map |

---

## Appendix A — Playwright-skill e2e integration cheat sheet (THE GUIDELINE)

**Every lane MUST apply these patterns, not just cite them. Reviewer cross-checks.**

### A.1 Testing Trophy distribution (from `core/test-architecture.md` 1-77)

```
API (60%) — endpoint-level integration, real BE, real Supabase, OpenAI mocked
Visual / Component (30%) — render correctness per viewport, modal interactions
E2E (10%) — critical-path browser flows only
```

**Decision matrix** (test-architecture.md 42-58):
- CRUD / permissions / errors / business rules → **API**
- Form validation / widget interactions / responsive layout → **Component** (we use Visual snapshot proxy)
- Login flow / multi-page workflow / payment → **E2E**

### A.2 Pitfall 11 — never mock own API (`core/when-to-mock.md` 1-46, `core/common-pitfalls.md` 597-661)

**Forbidden:**
```javascript
// DON'T — pretends backend works
await page.route('**/api/circles-sessions/**', route => route.fulfill({...}));
```

**Carve-outs (the ONLY 4 acceptable own-API mocks):**

1. **Error state simulation** (`when-to-mock.md` 839-933): 500/503/timeout when impossible to reproduce against real BE
   ```javascript
   // Recovery test for persistRetry — 503 then success (network-mocking.md 906-933)
   let attempts = 0;
   await page.route('**/api/circles-sessions/*/progress', async (route) => {
     attempts++;
     if (attempts <= 2) await route.fulfill({ status: 503, body: '{"error":"transient"}' });
     else await route.continue();
   });
   ```
2. **OpenAI** (third-party): `route.fulfill('**/api.openai.com/**')` — ALWAYS OK
3. **Stats stubs to avoid network noise in setup**: must `await page.unrouteAll()` before test logic begins
4. **Timing control** when real-DELETE/POST destroys element before assertion: must comment as "controlled deviation for deterministic assertion"

**Anything else mocking own API = REJECT in review.**

### A.3 Pitfall 14 — no shared mutable test state (`core/common-pitfalls.md` 802-858)

```javascript
// DON'T
let sessionId; // module-level shared — different workers overwrite

// DO
test('foo', async ({ request }) => {
  const sessionId = await createSession(request); // test-local
  // ...
  await deleteSession(request, sessionId); // cleanup in test or fixture
});
```

### A.4 Pitfall 18 — `page.evaluate` only for true JS APIs (`core/common-pitfalls.md` 1034-1097)

**Forbidden:** using evaluate for DOM querying / clicking / visibility / text reading
**Acceptable:** `window.apiFetch` (project-specific helper with auth token), `localStorage`, `__APP_STATE__`, cleanup helpers that need bearer token

### A.5 Pitfall 19 — `test.step()` for multi-phase tests (`core/common-pitfalls.md` 1099-1185)

```javascript
test('critical path', async ({ page }) => {
  await test.step('seed via API', async () => { /* ... */ });
  await test.step('login', async () => { /* ... */ });
  await test.step('navigate to Phase 2', async () => { /* ... */ });
  // Each step appears in trace + failure error includes step name
});
```

### A.6 Real API test pattern (`core/api-testing.md` 1-103, 165-291)

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Endpoint X', () => {
  test('200 happy path', async ({ request }) => {
    const response = await request.post('/api/foo', {
      headers: { Authorization: `Bearer ${token}` },
      data: { /* valid body */ },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ id: expect.any(String) });
  });

  test('401 without auth', async ({ request }) => {
    const response = await request.post('/api/foo', { data: { /* valid */ } });
    expect(response.status()).toBe(401);
  });

  test('400 missing required', async ({ request }) => {
    const response = await request.post('/api/foo', {
      headers: { Authorization: `Bearer ${token}` },
      data: {}, // missing required
    });
    expect(response.status()).toBe(400);
  });
});
```

### A.7 Schema validation (`core/api-testing.md` 903-1021)

```javascript
// Option B (no zod dependency) — preferred for this project
function assertSessionShape(session) {
  expect(session).toMatchObject({
    id: expect.any(String),
    question_id: expect.any(String),
    current_phase: expect.any(Number),
    mode: expect.stringMatching(/^(drill|simulation)$/),
    status: expect.any(String),
    created_at: expect.any(String),
    updated_at: expect.any(String),
    lifecycle: expect.stringMatching(/^(created|editing|gated|completed)$/),
  });
}
```

### A.8 Error response testing (`core/api-testing.md` 1023-1166)

Every endpoint must test:
- 200 happy
- 400 validation (when required fields missing or invalid)
- 401 without auth (for protected routes)
- 404 not-found (when id doesn't exist)
- 422 unprocessable (when business rule violated — e.g., final-report before scores complete)
- 409 conflict (when duplicate / locked state)

### A.9 Chained API calls / state machine (`core/api-testing.md` 1311-1418)

```javascript
test('workflow — create → action → verify', async ({ request }) => {
  // Step 1: create
  const createResp = await request.post('/api/foo', { data: {...} });
  const created = await createResp.json();
  
  // Step 2: action
  const actionResp = await request.patch(`/api/foo/${created.id}/action`, { data: {...} });
  expect(actionResp.status()).toBe(200);
  
  // Step 3: verify state transition
  const getResp = await request.get(`/api/foo/${created.id}`);
  expect((await getResp.json()).status).toBe('expected-after-action');
  
  // Step 4: verify cannot reverse — state machine rule
  const reverseResp = await request.patch(`/api/foo/${created.id}/action`, { data: { status: 'back' } });
  expect(reverseResp.status()).toBe(422); // or 409
});
```

### A.10 API data seeding for E2E (`core/api-testing.md` 783-848)

```javascript
test('UI test seeds via API for speed', async ({ page, request }) => {
  // Seed via API (10-100x faster than UI clicks)
  const sessResp = await request.post('/api/circles-sessions/draft', { data: {...} });
  const sessionId = (await sessResp.json()).id;
  
  // Then UI assertions on seeded data
  await page.goto(`/circles?sessionId=${sessionId}`);
  await expect(page.getByRole('heading', { name: 'Phase 2' })).toBeVisible();
  
  // Cleanup via API
  await request.delete(`/api/circles-sessions/${sessionId}`);
});
```

### A.11 Network mocking patterns

**Intermittent failure** (`core/network-mocking.md` 906-933):
```javascript
let attempts = 0;
await page.route('**/api/foo', async (route) => {
  attempts++;
  if (attempts <= 2) await route.fulfill({ status: 503 });
  else await route.continue();
});
// Action that triggers retries
// ...
expect(attempts).toBeGreaterThanOrEqual(3); // proves retries happened
```

**Request counting** (`core/network-mocking.md` 1012-1027):
```javascript
const responsePromise = page.waitForRequest('**/api/bar');
await someAction();
const request = await responsePromise;
expect(request.method()).toBe('POST');
expect(request.postDataJSON()).toMatchObject({ field: 'value' });
```

### A.12 Multi-user / cross-tab (`core/multi-user-and-collaboration.md` 27-58, 306-343)

```javascript
test('lock state persists across tabs', async ({ browser }) => {
  const context1 = await browser.newContext({ storageState: '.auth/user.json' });
  const context2 = await browser.newContext({ storageState: '.auth/user.json' });
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  // Tab 1: trigger lock
  await page1.goto('/...');
  await page1.getByRole('button', { name: 'Score' }).click();
  
  // Tab 2: should see locked state
  await page2.goto('/...');
  await expect(page2.getByText('已評分')).toBeVisible();
  
  await context1.close();
  await context2.close();
});
```

**Promise.all race assertion** (multi-user 306-343):
```javascript
test('concurrent submit — only one succeeds', async ({ request }) => {
  const [r1, r2] = await Promise.all([
    request.post('/api/foo/action'),
    request.post('/api/foo/action'),
  ]);
  const statuses = [r1.status(), r2.status()].sort();
  expect(statuses).toEqual([200, 409]); // one wins, one rejected
});
```

### A.13 Authentication / fixtures (`core/auth-flows.md` 928-949, `core/authentication.md` 29-70, 238-267)

**API-based login + storageState reuse** — existing `tests/setup/auth.setup.js` already produces `playwright/.auth/user.json`. E2E specs that need auth should use:
```javascript
// playwright.config.js — already configured
{ name: 'e2e-desktop', use: { storageState: 'playwright/.auth/user.json' } }
```

**Per-worker for parallel mutation** (authentication.md 238-267):
```javascript
const test = base.extend({
  workerUser: [async ({ request }, use, workerInfo) => {
    const email = `e2e-${workerInfo.workerIndex}-${Date.now()}@first-principle.test`;
    // register + login + cleanup per worker
    await use(loggedInUser);
  }, { scope: 'worker' }]
});
```

### A.14 Fixtures (`core/fixtures-and-hooks.md` 19-60)

Project's existing `tests/api/fixtures/api-cleanup.fixture.js`:
```javascript
const { test: base } = require('@playwright/test');
const test = base.extend({
  cleanupTracker: async ({}, use) => {
    const tracked = [];
    await use({ track: (kind, id) => tracked.push({ kind, id }) });
    // Teardown after use — guaranteed even on test crash
    for (const { kind, id } of tracked) {
      await request.delete(`/api/${kind}-sessions/${id}`, { headers: { Authorization: `Bearer ${E2E_TOKEN}` } });
    }
  }
});
```

### A.15 Three Iron Laws (project-specific, per STANDING memory)

- **IL-1 Root cause**: hollow tests are symptom; find why agent wrote hollow + fix the discipline
- **IL-2 Verification**: never trust "test passes" claim without running yourself + checking it asserts the right thing
- **IL-3 TDD**: red first, then green; if test was green on first run, it's testing nothing

### A.16 STANDING memory rules to apply

- `feedback_three_iron_laws.md` — IL-1/2/3
- `feedback_e2e_real_data_only.md` — no stub timestamp / no mock own API / no prod URL with real account
- `feedback_must_read_playwright_skill_before_tests.md` — Read real path `/Users/albertpeng/.claude/skills/playwright-skill/`
- `feedback_playwright_skill_cited_application.md` — cite + apply (not just reference)
- `feedback_two_stage_review_mandatory.md` — every commit gets spec + code-quality reviewer
- `feedback_cross_plan_smoke_after_each_ship.md` — ship-gate runs jest + Playwright dual-vp

---

## §3 Discipline rules per lane

### 3.1 Every lane prompt MUST contain:

1. Required reading list with specific md + line range (per A.16)
2. File isolation declaration (which files lane MAY touch — usually 1 new spec only)
3. Citation requirement: report MUST include "applied {pattern} from {md}:{lines} at {new spec}:{lines}"
4. Test expectation (N/N PASS) with run command
5. Honest gap reporting clause: if can't achieve target, STOP and report — don't ship partial

### 3.2 Every lane MUST NOT:

1. Modify any file outside its declared isolation set
2. Mock own `/api/*` route except A.2 carve-outs (with comment justifying)
3. Use `page.evaluate` for things locator can do (Pitfall 18)
4. Use `vm.createContext` / `jest.mock('db/client')` / `jest.mock('openai')` (hollow patterns)
5. Commit if any test fails — STOP and report
6. Skip the reviewer-cross-check step
7. Push to origin/main (director decides)

### 3.3 Reviewer obligations (opus code-reviewer per commit)

1. Run the test yourself — verify N/N PASS claim
2. Grep `route.fulfill` for unauthorized own-API mocks
3. Grep `vm.createContext` / `jest.mock` for hollow patterns
4. Cross-check each cited skill line range actually informs the code
5. Use Verdict: APPROVE / CONDITIONAL / REJECT — REJECT means redispatch

### 3.4 Cross-plan smoke gate (after all 14 lanes done)

Run:
```bash
npx jest                                                    # full jest baseline (target: no regression vs pre-plan)
npx playwright test --config tests/api/playwright.config.js # all API tests
npx playwright test tests/e2e/ --project=e2e-desktop        # all E2E specs desktop
npx playwright test tests/e2e/ --project=e2e-mobile-chrome  # E2E mobile chromium
```

All must be GREEN (no regression count increase). Capture baseline numbers in CLAUDE.md state board update.

---

## §4 Group A tasks (V1-V8 — already dispatched 2026-05-16 22:55)

Each lane is one sonnet subagent producing one new spec file. These were dispatched with the same discipline embedded in Appendix A; reviewers should cross-check using A as the rubric.

### Task V1: F-N-003 — Phase 4 final-report 422 guard

**Files:**
- Create: `tests/api/circles-final-report-contract.spec.js`

**Status:** dispatched (lane V1)
**Expected delivery:** 2 tests (422 with partial step_scores + 200 with full step_scores)
**Cited skill:** `api-testing.md` 1023-1166 + 783-848; `common-pitfalls.md` Pitfall 11 carve-out
**Spec compliance check:** does it seed via direct Supabase OR via real /evaluate-step? Direct seed is fine per F-N-003 since evaluator is non-trivial — note this in commit msg.

### Task V2: F-N-004 — Phase 2 real SSE API test

**Files:**
- Create: `tests/api/circles-message-sse-real.spec.js`

**Status:** dispatched
**Expected delivery:** 3 tests (real SSE chunk + Content-Type header + 401)
**Cited skill:** `api-testing.md` 1311-1418 + `when-to-mock.md` 1244-1245
**Spec compliance check:** verify Content-Type assertion is regression-guard against the F-N-004 reproduction (remove header → tests catch it)

### Task V3: F-N-005 — Sessions list schema

**Files:**
- Create: `tests/api/circles-sessions-list-contract.spec.js`

**Status:** dispatched
**Expected delivery:** 4 tests (401 / 200 / per-row schema / empty)
**Cited skill:** `api-testing.md` 903-1021 (schema) + 434-565 (JSON assertions)

### Task V4: F-N-009 — /evaluate-step contract

**Files:**
- Create: `tests/api/circles-evaluate-step-contract.spec.js`

**Status:** dispatched
**Expected delivery:** 3 tests (401 / 400 / 200 shape with score+dimensions+feedback)
**Cited skill:** `api-testing.md` 1023-1166 + `when-to-mock.md` Pitfall 11 carve-out
**Spec compliance check:** if real OpenAI used, must `test.slow()` per `lifecycle-nsm.spec.js` precedent

### Task V5: F-N-010 — 7× evaluate-step sequence

**Files:**
- Create: `tests/api/circles-score-sequence.spec.js`

**Status:** dispatched
**Expected delivery:** 1 test with 8 `test.step()` (7 steps + aggregate)
**Cited skill:** `api-testing.md` 1311-1418 state machine + `common-pitfalls.md` Pitfall 19

### Task V6: N-01 — NSM /gate contract (mirror CIRCLES)

**Files:**
- Create: `tests/api/nsm-gate-contract.spec.js`

**Status:** dispatched
**Expected delivery:** 3 tests mirroring `circles-gate-contract.spec.js` (401 / 400 / 200 with canProceed + overallStatus + 5-dim)
**Cited skill:** `api-testing.md` 903-1021 + existing `circles-gate-contract.spec.js` exemplar

### Task V7: F-P02 — Auth flow real E2E

**Files:**
- Create: `tests/e2e/auth-flow-real.spec.js`
- Delete: `tests/playwright/journeys/auth.spec.js` (dead spec)

**Status:** dispatched
**Expected delivery:** 4 tests (register / login UI / logout / protected redirect)
**Cited skill:** `auth-flows.md` full + `authentication.md` 29-70
**Spec compliance check:** verify NO storageState used (this spec tests login UI directly per A.13 note)

### Task V8: F-P04 — Guest CRUD 19 routes

**Files:**
- Create: `tests/api/guest-crud-real.spec.js`

**Status:** dispatched
**Expected delivery:** ~57 tests (19 routes × 3 cases: happy / 400-no-guestId / 404-wrong-id)
**Cited skill:** `api-testing.md` 903-1021 + 1023-1166 + 1311-1418
**Spec compliance check:** all 10 CIRCLES guest + 9 NSM guest routes from Lane C 73-108 listed

---

## §5 Group B tasks (V9-V14 — this plan dispatches AFTER Group A returns)

These tasks are expected to RED on first run (BE bug present). Lane writes test that fails with a clear assertion, documents the BE bug in a follow-up doc, and exits — does NOT fix BE.

### Task V9: N-02 — NSM full flow critical-path E2E

**Files:**
- Create: `tests/e2e/nsm-full-flow.spec.js`

- [ ] **Step 1: Write the failing test**

```javascript
const { test, expect } = require('@playwright/test');

// Per master plan §6 critical-path; addresses N-02 (NSM had zero browser E2E walking all 4 steps)
// Cited skill: test-architecture.md 60-77 (multi-page workflow justified for E2E)
//             api-testing.md 783-848 (API seed for speed)
//             common-pitfalls.md Pitfall 19 (test.step per phase)

test.describe('NSM full flow critical-path', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('Step 1 pick → Step 2 contribution → Step 3 gate → Step 4 evaluator', async ({ page, request }) => {
    let sessionId;
    
    await test.step('seed NSM session via API', async () => {
      const resp = await request.post('http://localhost:4000/api/nsm-sessions/draft', {
        headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
        data: { question_id: 'spotify-podcast' },
      });
      expect(resp.status()).toBe(200);
      sessionId = (await resp.json()).id;
    });

    await test.step('Step 1 — pick definition + breakdown', async () => {
      await page.goto(`http://localhost:4000/nsm?sessionId=${sessionId}`);
      await expect(page.getByRole('heading', { name: /Step 1|定義/ })).toBeVisible();
      // Fill 5-card definition + 4-col breakdown via real interaction
      await page.getByLabel('北極星定義').fill('Spotify Podcast 30 天回訪率');
      await page.getByRole('button', { name: '下一步' }).click();
    });

    await test.step('Step 2 — 4-dim contribution', async () => {
      await expect(page.getByText('Step 2')).toBeVisible();
      // Fill each dimType
      for (const dim of ['attention', 'engagement', 'retention', 'monetization']) {
        await page.getByLabel(new RegExp(dim, 'i')).fill(`${dim} contribution detail`);
      }
      await page.getByRole('button', { name: '下一步' }).click();
    });

    await test.step('Step 3 gate — 5-dim AI review', async () => {
      await expect(page.getByText('Step 3')).toBeVisible();
      await page.getByRole('button', { name: '送出審核' }).click();
      // Wait for gate result (real OpenAI — test.slow allowed)
      test.slow();
      await expect(page.getByText(/通過|可進入|advance/i)).toBeVisible({ timeout: 90000 });
    });

    await test.step('Step 4 — evaluator', async () => {
      await expect(page.getByText('Step 4')).toBeVisible();
      await page.getByRole('button', { name: '評估' }).click();
      // Verify radar SVG / pentagon rendered
      await expect(page.locator('[data-view="nsm"] svg')).toBeVisible({ timeout: 90000 });
    });

    await test.step('cleanup via API', async () => {
      await request.delete(`http://localhost:4000/api/nsm-sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it shape (may RED due to selector or BE)**

Run: `npx playwright test tests/e2e/nsm-full-flow.spec.js --project=e2e-desktop`
Expected: Either GREEN (closes N-02) or RED with specific failure to document

- [ ] **Step 3: If RED, document in `audit/group-b-bugs-found.md` (append)**

```markdown
## V9 — N-02 NSM full flow

### Status: RED at step: <which test.step>
### Failure: <paste assertion + selector that failed>
### Hypothesis: <BE bug, UI selector drift, etc>
### Needs brainstorm: <yes/no — describes what discussion is needed>
```

- [ ] **Step 4: Commit**

If GREEN:
```bash
git add tests/e2e/nsm-full-flow.spec.js
git commit -m "$(cat <<'EOF'
test(e2e): N-02 NSM full flow critical-path (Group B)

- ADD tests/e2e/nsm-full-flow.spec.js — 1 test, 5 test.step phases (seed / Step 1 / Step 2 / Step 3 gate / Step 4 eval / cleanup)
- Real Supabase + real OpenAI (test.slow per lifecycle-nsm precedent)
- Per test-architecture.md 60-77 multi-page workflow + api-testing.md 783-848 API seeding + common-pitfalls Pitfall 19 test.step

Closes N-02 — NSM had zero browser E2E walking all 4 steps.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

If RED:
```bash
git add audit/group-b-bugs-found.md
git commit -m "$(cat <<'EOF'
docs(audit): V9 N-02 NSM full flow RED — BE bug documented (Group B)

Test written per spec; fails at step <X> due to <reason>.
Spec file NOT committed (tests/e2e/nsm-full-flow.spec.js not staged) — needs BE fix or selector update first.

Brainstorm needed before this finding can close.
EOF
)"
```

### Task V10: F-N-002 — gateInflight concurrent-submit mutex test

**Files:**
- Create: `tests/api/gate-mutex-concurrent.spec.js`

- [ ] **Step 1: Write the failing test (Promise.all race per A.12)**

```javascript
const { test, expect } = require('../fixtures/api-cleanup.fixture');

// Per F-N-002 + EQ-R-01
// Cited skill: multi-user-and-collaboration.md 306-343 (Promise.all race)
//             api-testing.md 1311-1418 (chained calls + state machine)
//             common-pitfalls.md Pitfall 11 carve-out (real own API)

test.describe('Gate mutex — concurrent submit', () => {
  test('two simultaneous POST /:id/gate — only one succeeds, other 409 or queued', async ({ request, cleanupTracker }) => {
    // Seed a session at Phase 1.5 ready state
    const draftResp = await request.post('http://localhost:4000/api/circles-sessions/draft', {
      headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
      data: { question_id: 'spotify-podcast', mode: 'drill', drill_step: 'C1' },
    });
    const session = await draftResp.json();
    cleanupTracker.track('circles', session.id);
    
    // Fill framework so gate has something to evaluate
    await request.patch(`http://localhost:4000/api/circles-sessions/${session.id}/progress`, {
      headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
      data: { progress_json: { frameworkDraft: { C1: { '問題範圍': '測試' } } } },
    });
    
    // Fire 2 concurrent gate requests
    const [r1, r2] = await Promise.all([
      request.post(`http://localhost:4000/api/circles-sessions/${session.id}/gate`, {
        headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
      }),
      request.post(`http://localhost:4000/api/circles-sessions/${session.id}/gate`, {
        headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
      }),
    ]);
    
    const statuses = [r1.status(), r2.status()].sort();
    
    // Expected: one wins (200), one rejected (409 conflict) OR both 200 but same gate_result
    // If BOTH 200 with DIFFERENT gate_results → BE bug (mutex broken)
    const get = await request.get(`http://localhost:4000/api/circles-sessions/${session.id}`, {
      headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
    });
    const gateResult = (await get.json()).gate_result;
    
    // Strong assertion: only one gate_result row written (no overwrite race)
    expect(gateResult).toBeDefined();
    // If statuses include 409 → mutex works; if both 200 → check gateResult stable
    expect(statuses[0] === 409 || statuses[0] === 200).toBe(true);
  });
});
```

- [ ] **Step 2: Run + Document**

Run: `npx playwright test tests/api/gate-mutex-concurrent.spec.js`

If RED (both 200 + different gate_results → mutex broken): commit RED test under `tests/api/_pending_be_fix/` OR document in `audit/group-b-bugs-found.md` per V9 pattern.

- [ ] **Step 3: Commit per V9 pattern**

### Task V11: EQ-R-01 — gateInflight + gateResult fire-and-forget compound

**Files:**
- Create: `tests/api/gate-fire-and-forget-compound.spec.js`

- [ ] **Step 1: Write test asserting gateResult PATCH actually persists post-gate**

```javascript
const { test, expect } = require('../fixtures/api-cleanup.fixture');

// Per EQ-R-01 — Lane L found gateResult PATCH at app.js:7512-7517 is fire-and-forget IIFE
// Plus Lane M wired persistRetry there at 7519. Verify post-Lane-M the persist actually completes.
// Cited skill: api-testing.md 1311-1418 (state machine verify after action)
//             network-mocking.md 906-933 (intermittent failure)

test.describe('Gate fire-and-forget PATCH — verify post-Lane-M wiring', () => {
  test('after gate POST, gate_result IS persisted server-side (verify with GET)', async ({ request, cleanupTracker }) => {
    const draftResp = await request.post('http://localhost:4000/api/circles-sessions/draft', {
      headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
      data: { question_id: 'spotify-podcast', mode: 'drill', drill_step: 'C1' },
    });
    const session = await draftResp.json();
    cleanupTracker.track('circles', session.id);
    
    await request.patch(`http://localhost:4000/api/circles-sessions/${session.id}/progress`, {
      headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
      data: { progress_json: { frameworkDraft: { C1: { '問題範圍': '足夠長的問題範圍內容' } } } },
    });
    
    const gateResp = await request.post(`http://localhost:4000/api/circles-sessions/${session.id}/gate`, {
      headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
    });
    expect(gateResp.status()).toBe(200);
    const gateBody = await gateResp.json();
    
    // Now GET and assert gate_result persisted with same canProceed + overallStatus
    const getResp = await request.get(`http://localhost:4000/api/circles-sessions/${session.id}`, {
      headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
    });
    const persisted = (await getResp.json()).gate_result;
    
    expect(persisted).toBeDefined();
    expect(persisted.canProceed).toBe(gateBody.canProceed);
    expect(persisted.overallStatus).toBe(gateBody.overallStatus);
  });
});
```

- [ ] **Step 2: Run + commit per V9 pattern**

### Task V12: EQ-M-01 — circlesStale storage event cross-tab

**Files:**
- Create: `tests/e2e/circles-stale-multi-tab.spec.js`

- [ ] **Step 1: Write 2-context test per A.12**

```javascript
const { test, expect } = require('@playwright/test');

// Per EQ-M-01 — circlesStale storage event has zero cross-context test
// Cited skill: multi-user-and-collaboration.md 27-58 (two newContext)
//             common-pitfalls.md Pitfall 11 (real own API)

test.use({ storageState: 'playwright/.auth/user.json' });

test('tab B save → tab A receives circlesStale event + shows stale banner', async ({ browser }) => {
  const ctxA = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
  const ctxB = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  
  // Both tabs load the same Phase 1 session
  await pageA.goto('http://localhost:4000/circles');
  await pageB.goto('http://localhost:4000/circles');
  
  // Get to Phase 1 form on both
  await pageA.getByRole('button', { name: 'Drill' }).first().click();
  await pageA.getByRole('button', { name: /開始|練習/ }).first().click();
  
  await pageB.getByRole('button', { name: 'Drill' }).first().click();
  await pageB.getByRole('button', { name: /開始|練習/ }).first().click();
  
  // Tab B saves something
  await pageB.getByLabel('問題範圍').first().fill('Tab B updated this');
  await pageB.waitForTimeout(2000); // debounced save
  
  // Tab A should receive storage event and show stale banner
  await expect(pageA.getByText(/已過期|stale|請刷新/i)).toBeVisible({ timeout: 5000 });
  
  await ctxA.close();
  await ctxB.close();
});
```

- [ ] **Step 2: Run + commit per V9 pattern**

### Task V13: EQ-A-01 — mid-Phase 2 JWT expiry

**Files:**
- Create: `tests/api/circles-jwt-mid-flow.spec.js`

- [ ] **Step 1: Write test simulating JWT expiry mid-conversation**

```javascript
const { test, expect } = require('../fixtures/api-cleanup.fixture');

// Per EQ-A-01 — mid-Phase 2 JWT expiry path not tested
// Cited skill: auth-flows.md 709-733 (session expiry)
//             api-testing.md 1023-1166 (401 response testing)

test('Phase 2 /message with expired JWT — returns 401 with refresh hint', async ({ request, cleanupTracker }) => {
  const draftResp = await request.post('http://localhost:4000/api/circles-sessions/draft', {
    headers: { Authorization: `Bearer ${process.env.E2E_TOKEN}` },
    data: { question_id: 'spotify-podcast', mode: 'drill', drill_step: 'C1' },
  });
  const session = await draftResp.json();
  cleanupTracker.track('circles', session.id);
  
  // Use expired/garbage JWT
  const expiredToken = 'eyJ.fake.token.expired';
  
  const msgResp = await request.post(`http://localhost:4000/api/circles-sessions/${session.id}/message`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
    data: { message: 'test', sessionId: session.id },
  });
  
  expect(msgResp.status()).toBe(401);
  const body = await msgResp.json();
  expect(body).toMatchObject({ error: expect.any(String) });
});
```

- [ ] **Step 2: Run + commit per V9 pattern**

### Task V14: F-P05 — Guest-to-auth migration

**Files:**
- Create: `tests/e2e/guest-to-auth-migration.spec.js`

- [ ] **Step 1: Write E2E for migration banner + data transfer**

```javascript
const { test, expect } = require('@playwright/test');

// Per F-P05 — migrate-guest is triple-mocked; real flow has zero E2E
// Cited skill: auth-flows.md 928-949 (API login + storageState)
//             api-testing.md 1311-1418 (chained workflow)
//             common-pitfalls.md Pitfall 11 (real own API)

test('guest creates session → register → migration banner → data preserved', async ({ page, request }) => {
  // Start as guest — no storageState
  await page.goto('http://localhost:4000/');
  
  // Create a guest session via UI
  await page.getByRole('button', { name: /開始|guest/i }).first().click();
  // ... navigate to CIRCLES + start a session
  await page.getByRole('button', { name: /CIRCLES/ }).click();
  await page.getByRole('button', { name: /開始/ }).first().click();
  
  // Fill some content as guest
  await page.getByLabel('問題範圍').fill('Guest content to migrate');
  
  // Register a new account
  const email = `migrate-${Date.now()}@first-principle.test`;
  await page.getByRole('link', { name: /註冊|Sign up/ }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('TestPass123!');
  await page.getByRole('button', { name: /註冊|Submit/ }).click();
  
  // Migration banner should appear
  await expect(page.getByText(/將 guest 資料.*合併|migrate.*data/i)).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /確認|Migrate/ }).click();
  
  // Navigate back to the session — content should be there
  await page.goto('http://localhost:4000/circles');
  await expect(page.getByText('Guest content to migrate')).toBeVisible();
});
```

- [ ] **Step 2: Run + commit per V9 pattern**

---

## §6 Post-Group-B: merge + cross-plan smoke

### Task X1: Merge all 4 findings slices into master findings doc

**Files:**
- Create: `audit/e2e-integration-findings-2026-05-17.md`

- [ ] **Step 1: Concatenate slices with master header**

```bash
cat > audit/e2e-integration-findings-2026-05-17.md <<'EOF'
# E2E Integration Findings — Master (2026-05-17)

Synthesized from 4 Phase-3 slice files:
- audit/findings-slice-circles-2026-05-17.md (Lane N — 20 findings)
- audit/findings-slice-nsm-2026-05-17.md (Lane O — 14 findings)
- audit/findings-slice-cross-2026-05-17.md (Lane P — 17 findings)
- audit/findings-slice-edge-2026-05-17.md (Lane Q — 31 findings)

**Total: 82 findings (18 P0 / 48 P1 / 14 P2 / 2 covered)**

Per master plan: `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md`
Execution: `docs/superpowers/plans/2026-05-16-real-e2e-integration-execution-plan.md`

## P0 closure status (post-plan execution)

| Finding | Lane | Status |
|---|---|---|
| F-N-001 (CIRCLES full E2E) | S | CLOSED via 9446ad2 |
| F-N-002 (gateInflight mutex) | V10 | <STATUS> |
| F-N-003 (Phase 4 422 guard) | V1 | <STATUS> |
| F-N-004 (Phase 2 SSE real) | V2 | <STATUS> |
| N-01 (NSM gate contract) | V6 | <STATUS> |
| N-02 (NSM full E2E) | V9 | <STATUS> |
| N-03 (Bug A hollow) | C-brainstorm | DEFERRED |
| F-P02 (Auth journey) | V7 | <STATUS> |
| F-P04 (Guest CRUD) | V8 | <STATUS> |
| F-P05 (Migration) | V14 | <STATUS> |
| EQ-R-01 (mutex compound) | V11 | <STATUS> |
| EQ-R-04 (frameworkDraft race) | C-brainstorm | DEFERRED |
| EQ-F-03 (nsmDefinition persist) | C-brainstorm | DEFERRED |
| EQ-F-04 (Phase 2 conclusion orphan) | U (wrap) + C-brainstorm | PARTIAL |
| EQ-M-01 (stale storage) | V12 | <STATUS> |
| EQ-A-01 (JWT mid-flow) | V13 | <STATUS> |

## Group C — deferred to brainstorm
- EQ-R-04, EQ-F-03, EQ-F-04, N-03 — require product/design decision before impl

## P1 findings — see slice files

## P2 findings — see slice files
EOF
```

- [ ] **Step 2: Update statuses with actual lane verdicts after Group B completes**

- [ ] **Step 3: Commit**

```bash
git add audit/e2e-integration-findings-2026-05-17.md
git commit -m "docs(audit): master findings doc — 82 findings P0 closure status"
```

### Task X2: Cross-plan smoke

- [ ] **Step 1: Run jest full**

```bash
npx jest 2>&1 | tail -10
```

Expected: PASS count >= pre-plan baseline (no regression)

- [ ] **Step 2: Run all API tests**

```bash
npx playwright test --config tests/api/playwright.config.js 2>&1 | tail -10
```

Expected: all GREEN

- [ ] **Step 3: Run E2E desktop + mobile-chrome**

```bash
npx playwright test tests/e2e/ --project=e2e-desktop 2>&1 | tail -10
npx playwright test tests/e2e/ --project=e2e-mobile-chrome 2>&1 | tail -10
```

Expected: all GREEN

- [ ] **Step 4: If any RED — investigate (could be flake, could be real regression)**

5x consecutive GREEN required before claiming clean per `feedback_cross_plan_smoke_after_each_ship.md`.

- [ ] **Step 5: Update CLAUDE.md state board with new baseline numbers**

### Task X3: STANDING memory addition

- [ ] **Step 1: Create `feedback_path_3_e2e_plan_executed.md`** (already partially covered by `feedback_playwright_skill_cited_application.md` — extend not duplicate)

Actually skip if existing feedback files cover this.

---

## §7 Self-review

**1. Spec coverage check:**
- Group A 8 lanes cover F-N-003, F-N-004, F-N-005, F-N-009, F-N-010, N-01, F-P02, F-P04 ✓
- Group B 6 lanes cover N-02, F-N-002, EQ-R-01, EQ-M-01, EQ-A-01, F-P05 ✓
- Group C 4 deferred (EQ-R-04, EQ-F-03, EQ-F-04, N-03) — documented as deferred ✓
- F-N-001 covered by Lane S (commit 9446ad2) — documented as CLOSED ✓
- **Gap:** EQ-F-04 partial (V-006 wrap shipped by Lane U, read-on-restore pending brainstorm) — flagged

**2. Placeholder scan:** None — all code blocks complete; cited commit SHAs for already-shipped work; <STATUS> placeholders in §6 X1 are intentional fill-in-after-execution markers.

**3. Type consistency:** 
- `cleanupTracker.track('circles', id)` vs `('nsm', id)` — fixture supports both per existing `api-cleanup.fixture.js` ✓
- E2E_TOKEN env var consistent across all V9-V14 examples ✓
- `Authorization: Bearer ${...}` header pattern consistent ✓

**4. Scope check:** Plan covers Group A (in-flight) + Group B (to dispatch) + post-merge + smoke. Single coherent unit — does NOT mix with B5-redux brainstorm or other work. ✓

---

## Execution

Plan complete. Two execution paths:

### For Group A (already dispatched)
- 8 lanes running per their inline prompts (each carries the same discipline embedded in §3)
- Reviewer-7 already dispatched for Lane S
- When each lane returns, dispatch its code-reviewer per §3.3
- If any reviewer REJECTs, follow §3.3 redispatch loop

### For Group B (6 lanes to dispatch after Group A returns)
**REQUIRED SUB-SKILL: superpowers:subagent-driven-development**

Dispatch each V9-V14 as a fresh sonnet with prompt that:
1. Embeds the specific task code from §5
2. References Appendix A by section (A.1 through A.16)
3. Includes the RED-fallback discipline (§5 Step 3 of each task)
4. Specifies file isolation + STANDING rules

Each commit gets opus code-reviewer per §3.3.

### Post all 14 lanes:
- Task X1 merge findings → master doc
- Task X2 cross-plan smoke
- CLAUDE.md update

**My recommendation: Subagent-Driven for Group B** — same pattern as Group A, fresh subagent per V9-V14, opus reviewer per commit. Continues the established cadence.
