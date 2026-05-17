// tests/e2e/playwright.config.js
// Stage 1A Task 4 — E2E gate config: setup + api-contract + 3 e2e projects.
// Does NOT replace tests/visual/playwright.config.js or tests/playwright/playwright.config.js.
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

module.exports = defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['blob']] : [['list'], ['html', { open: 'never' }]],

  // T12: gate specs call real OpenAI (~5-25 s) + boot overhead (~5 s) → 90 s.
  timeout: 90_000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'PORT=3000 node server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    cwd: path.join(__dirname, '..', '..'),
  },

  projects: [
    // 1. Setup project — UI-login once, save storageState
    {
      name: 'setup',
      testMatch: /tests\/setup\/auth\.setup\.js$/,
      testDir: path.join(__dirname, '..'),
      use: { ...devices['Desktop Chrome'] },
    },

    // 2. API contract project — no browser, fastest layer
    {
      name: 'api-contract',
      testMatch: /(circles|nsm)-gate-contract\.spec\.js$/,
      testDir: path.join(__dirname, '..'),
      // No storageState — API specs build their own auth via shell-passed REAL_ACCESS_TOKEN
    },

    // 3. E2E project — desktop chrome
    {
      name: 'e2e-desktop',
      testMatch: /(circles-gate|circles-gate-await-patch-real|circles-draft-retry-real|circles-phase3-restore|circles-phase3-restore-real|offcanvas-delete|phase2-ui-fix|circles-phase2-qchip-sse-rerender|capture-t4-qchip-sse|circles-delete-rollback-real|persist-retry-browser-real|critical-path-full-flow|auth-flow-real|nsm-full-flow|nsm-evaluate-checkpoint-real|circles-back-nav-lock|bug3-spinner-stuck-reproduce|bug3-spinner-deep-investigation|circles-fresh-form-no-ghost|circles-fe-gate-stale-state|nsm-hint-ui-flow|nsm-gate-result-ui-display|nsm-impact-removal-fresh-session|nsm-impact-backward-compat|nsm-freq-label-by-type|audit-nsm-director-walk-2026-05-17|apiFetch-401-refresh-retry)\.spec\.js$/,
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },

    // 4. E2E project — mobile chrome (for race + reflow on small viewport)
    {
      name: 'e2e-mobile-chrome',
      testMatch: /(circles-gate|circles-gate-await-patch-real|circles-draft-retry-real|circles-phase3-restore|circles-phase3-restore-real|offcanvas-delete|phase2-ui-fix|circles-phase2-qchip-sse-rerender|capture-t4-qchip-sse|circles-delete-rollback-real|persist-retry-browser-real|critical-path-full-flow|auth-flow-real|nsm-full-flow|nsm-evaluate-checkpoint-real|circles-back-nav-lock|bug3-spinner-stuck-reproduce|bug3-spinner-deep-investigation|circles-fresh-form-no-ghost|circles-fe-gate-stale-state|nsm-hint-ui-flow|nsm-gate-result-ui-display|nsm-impact-removal-fresh-session|nsm-impact-backward-compat|nsm-freq-label-by-type|audit-nsm-director-walk-2026-05-17|apiFetch-401-refresh-retry)\.spec\.js$/,
      use: { ...devices['Pixel 5'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },

    // 5. E2E project — mobile WebKit (per memory feedback_ios_review_before_ship)
    {
      name: 'e2e-mobile-safari',
      testMatch: /(circles-gate|circles-gate-await-patch-real|circles-draft-retry-real|circles-phase3-restore|circles-phase3-restore-real|offcanvas-delete|phase2-ui-fix|circles-phase2-qchip-sse-rerender|capture-t4-qchip-sse|circles-delete-rollback-real|persist-retry-browser-real|critical-path-full-flow|auth-flow-real|nsm-full-flow|nsm-evaluate-checkpoint-real|circles-back-nav-lock|bug3-spinner-stuck-reproduce|bug3-spinner-deep-investigation|circles-fresh-form-no-ghost|circles-fe-gate-stale-state|nsm-hint-ui-flow|nsm-gate-result-ui-display|nsm-impact-removal-fresh-session|nsm-impact-backward-compat|nsm-freq-label-by-type|audit-nsm-director-walk-2026-05-17|apiFetch-401-refresh-retry)\.spec\.js$/,
      use: { ...devices['iPhone 14'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
  ],
});
