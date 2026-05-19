// tests/api/playwright.config.js
// Playwright config for real API layer tests (tests/api/).
// Hits localhost:4000 real Express + real Supabase test DB.
//
// Per api-testing.md §API Test Structure: dedicated testDir, no browser for pure API tests.
// Per when-to-mock.md decision matrix: NEVER mock own API/DB.
//   Only mock api.openai.com (third-party, paid-per-call) via page.route().
//
// Gate/evaluate tests need page.route() to mock OpenAI → uses Chromium.
// Pure CRUD lifecycle tests use the request fixture directly (no browser needed).
// One project runs all: request fixture works regardless of browser being present.
//
// Usage:
//   npx playwright test --config tests/api/playwright.config.js
//   npx playwright test --config tests/api/playwright.config.js tests/api/lifecycle-list.spec.js

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

module.exports = defineConfig({
  testDir: '.',
  fullyParallel: false, // serial: avoid parallel Supabase row collisions between lifecycle tests
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    // Per api-testing.md Troubleshooting §"401 Unauthorized": request fixture starts clean.
    // Auth token is injected per-test via beforeAll signIn helper.
  },

  // Per api-testing.md Troubleshooting §"connect ECONNREFUSED": webServer auto-starts server.
  // reuseExistingServer=true: dev workflow reuses already-running localhost:4000.
  // OPERATOR_EMAIL set so lifecycle-list operator tests pass (gate is email-match).
  webServer: {
    command: `OPERATOR_EMAIL=e2e@first-principle.test PORT=4000 node server.js`,
    url: `${BASE_URL}/health`,
    reuseExistingServer: true,
    timeout: 30_000,
    cwd: path.join(__dirname, '..', '..'),
  },

  projects: [
    // Pure API project — no browser launched.
    // All lifecycle tests use request fixture (request.post/get/patch) directly.
    // Gate/evaluate/final-report tests make real OpenAI calls (server-to-server;
    // page.route() cannot intercept server-side calls from Node.js Express).
    // Per when-to-mock.md: we accept real OpenAI calls here as the boundary mock
    // mechanism (page.route) doesn't apply to server-side HTTP.
    {
      name: 'api-lifecycle',
      testMatch: /lifecycle-(circles|nsm|list)\.spec\.js$/,
      // No browser — request fixture is browser-less per api-testing.md §APIRequestContext Basics
    },
    // F-N-004 remediation — real SSE /message endpoint tests.
    // 3 tests: first SSE chunk read + Content-Type header guard + 401 permission guard.
    // Tests 1 + 2 call real OpenAI (server-to-server; page.route cannot intercept).
    // Test 3 (401) is instant — no OpenAI call, no session creation.
    // Per when-to-mock.md decision matrix: OpenAI is third-party paid-per-call;
    // cannot be mocked via page.route at server-side boundary. test.slow() applied.
    {
      name: 'api-circles-message-sse',
      testMatch: /circles-message-sse-real\.spec\.js$/,
      // No browser — SSE read via Node native http in test.step
    },
    // CIRCLES draft + progress route smoke — real POST /draft + PATCH /progress + GET round-trip.
    // Renamed from persist-retry-integration-real.spec.js per Review-3 audit.
    // No browser needed (pure request fixture). No OpenAI calls (no test.slow needed).
    // Per testing-trophy-audit-2026-05-16.md Trophy Reset Roadmap §Step 3.
    {
      name: 'api-persist-retry',
      testMatch: /circles-draft-progress-route-real\.spec\.js$/,
      // No browser — pure API calls via request fixture
    },
    // NSM hint endpoints — real API layer tests (Trophy 60% tier).
    // Covers /api/nsm-public/step2-hint, step3-hint, /api/nsm-sessions/:id/hints.
    // Validation + permission tests are instant (never reach OpenAI).
    // Happy-path tests call real OpenAI (server-to-server; page.route cannot intercept).
    // Per when-to-mock.md §Real Service Strategies: accept real OpenAI for server-side calls.
    {
      name: 'api-nsm-hints',
      testMatch: /nsm-hints-real\.spec\.js$/,
      // No browser — pure API calls via request fixture
    },
    // F-N-003 remediation — Phase 4 final-report 422 guard contract test (Group A V1).
    {
      name: 'api-final-report',
      testMatch: /circles-final-report-contract\.spec\.js$/,
    },
    // F-N-005 remediation — sessions list GET response schema contract (Group A V3).
    {
      name: 'api-sessions-list',
      testMatch: /circles-sessions-list-contract\.spec\.js$/,
    },
    // F-N-009 remediation — evaluate-step contract (Group A V4, commit 206b6ed).
    {
      name: 'api-evaluate-step',
      testMatch: /circles-evaluate-step-contract\.spec\.js$/,
    },
    // F-N-010 remediation — 7× evaluate-step sequence → score aggregate (Group A V5).
    {
      name: 'api-score-sequence',
      testMatch: /circles-score-sequence\.spec\.js$/,
    },
    // N-01 remediation — NSM /gate contract (Group A V6, mirror CIRCLES).
    {
      name: 'api-nsm-gate',
      testMatch: /nsm-gate-contract\.spec\.js$/,
    },
    // F-P04 remediation — guest CRUD 19 routes real API tests (Group A V8).
    {
      name: 'api-guest-crud',
      testMatch: /guest-crud-real\.spec\.js$/,
    },
    // AC-2 (spec b2ca935) — /evaluate-step 422 rescore guard contract test.
    {
      name: 'api-evaluate-step-rescore-guard',
      testMatch: /circles-evaluate-step-rescore-guard\.spec\.js$/,
    },
    // P0-#251 Bug 1 — gate 全打 Y 過審 adversarial reproduction (TDD-red, Phase 1 Lane L2).
    // 10 variants × real OpenAI (server-to-server; page.route cannot intercept).
    // Each variant asserts canProceed=false; FAIL = bug confirmed for that variant.
    {
      name: 'api-gate-adversarial',
      testMatch: /circles-gate-all-Y-adversarial\.spec\.js$/,
    },
    // Lane L9 — NSM gate adversarial sweep (preventive, mirror L2 for NSM side).
    // 10 variants × real OpenAI (server-to-server; page.route cannot intercept).
    // Each variant asserts canProceed=false; FAIL = bug confirmed for that variant.
    {
      name: 'api-nsm-gate-adversarial',
      testMatch: /nsm-gate-all-Y-adversarial\.spec\.js$/,
    },
    // Lane L12 — CIRCLES evaluator adversarial sweep (preventive, mirror L2/L9).
    // 7 variants × real OpenAI: gate-passable but low-quality inputs → assert totalScore < 60.
    // FAIL = evaluator awarded ≥ 60 total for low-quality content (evaluator leak confirmed).
    {
      name: 'api-evaluator-adversarial',
      testMatch: /circles-evaluator-adversarial\.spec\.js$/,
    },
    // Lane L15 — NSM evaluator adversarial sweep (preventive, completes 4-pillar sweep).
    // 7 variants × real OpenAI: gate-passable but low-quality NSM inputs → assert totalScore < 60.
    // FAIL = NSM evaluator awarded ≥ 60 total for low-quality content (evaluator leak confirmed).
    // 4-pillar sweep: L2(CIRCLES gate) + L9(NSM gate) + L12(CIRCLES eval) + L15(NSM eval).
    {
      name: 'api-nsm-evaluator-adversarial',
      testMatch: /nsm-evaluator-adversarial\.spec\.js$/,
    },
    // P0-#255 Bug 6 — gate bypass path enumeration (TDD-red, Phase 1 Lane L3).
    // 5 tests × 4 leaky paths + 1 control. No OpenAI calls (service-role seeding).
    // Tests assert >= 400; 2xx returned = leak confirmed. All expected to be RED
    // until BE lifecycle guards are added.
    {
      name: 'api-no-bypass',
      testMatch: /circles-no-bypass\.spec\.js$/,
    },
    // Lane L18 — NSM gate bypass path enumeration (preventive, mirror L3 for NSM side).
    // 4 tests: 3 bypass attempts (auth editing, auth created, guest editing) + 1 control.
    // Tests assert >= 400; 2xx = leak confirmed (evaluate accepted without gate pass).
    // T-NSM-BYPASS-1/2/3 expected RED until BE lifecycle guard added to /evaluate.
    // T-NSM-CONTROL-1 calls real OpenAI (test.slow) — must remain GREEN after guard added.
    {
      name: 'api-nsm-no-bypass',
      testMatch: /nsm-no-bypass\.spec\.js$/,
    },
    // Lane L26 — NSM /context + /hints + PATCH /progress comprehensive bypass audit.
    // Extends L18 coverage: confirms /context + /hints are by-design open (no mutation),
    // and PATCH /progress cannot advance lifecycle to 'gated' (closing L18 medium-risk vector).
    // 18 tests across §A (/context), §B (/hints), §C (PATCH /progress).
    // Most OpenAI-calling tests use test.slow(); PATCH /progress tests are instant.
    {
      name: 'api-nsm-context-hints-progress',
      testMatch: /nsm-context-hints-progress-coverage\.spec\.js$/,
    },
    // Lane L15b — NSM evaluator adversarial sweep: 3-dim schema (post impact-removal).
    // Verifies evaluator still rejects low-quality input after dropping impact dim.
    // 4 variants × real OpenAI (server-to-server; page.route cannot intercept).
    {
      name: 'api-nsm-evaluator-3dim-adversarial',
      testMatch: /nsm-evaluator-3dim-adversarial\.spec\.js$/,
    },
    // #199 supplementary — CIRCLES Phase 2→3 real 7× evaluate-step chain on
    // one session + final-report aggregate. Heavy (~$0.24/run, ~70-160 s wall).
    // Replaces synthetic-only circles-score-sequence (which mocks /evaluate-step
    // via page.route, never hitting real evaluator). This spec exercises the
    // real evaluator chain + real /final-report aggregate.
    {
      name: 'api-phase2-evaluate-sequence',
      testMatch: /circles-phase2-evaluate-sequence\.spec\.js$/,
    },
  ],
});
