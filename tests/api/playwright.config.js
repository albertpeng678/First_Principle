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
  ],
});
