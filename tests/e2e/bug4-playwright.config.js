// tests/e2e/bug4-playwright.config.js
// Investigator-only standalone config for bug4-offcanvas-delete-cache-reproduce.spec.js.
// Does NOT modify the main e2e config (which has a fixed testMatch regex).
// Reuses the same setup (auth.setup.js) + storageState + Desktop Chrome project.

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

module.exports = defineConfig({
  testDir: '.',
  fullyParallel: false, // serial — each test creates/deletes real DB rows
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: {
    command: 'PORT=3000 node server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
    cwd: path.join(__dirname, '..', '..'),
  },

  projects: [
    {
      name: 'setup',
      testMatch: /tests\/setup\/auth\.setup\.js$/,
      testDir: path.join(__dirname, '..'),
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'bug4',
      testMatch: /bug4-offcanvas-delete-cache-reproduce\.spec\.js$/,
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
  ],
});
