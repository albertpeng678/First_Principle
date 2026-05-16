// tests/visual/playwright.config.js
// Path 2 — visual baseline + smoke spec config (per spec §0.5).
// Separate config so testDir points to tests/visual/ instead of journeys/.
const { defineConfig } = require('@playwright/test');

const DEVICES = [
  { name: 'Mobile-360',    viewport: { width: 360,  height: 780  }, isMobile: true  },
  { name: 'iPhone-SE',     viewport: { width: 375,  height: 667  }, isMobile: true  },
  { name: 'iPhone-14',     viewport: { width: 390,  height: 844  }, isMobile: true  },
  { name: 'iPhone-15-Pro', viewport: { width: 430,  height: 932  }, isMobile: true  },
  { name: 'iPad',          viewport: { width: 768,  height: 1024 }, isMobile: true  },
  { name: 'Desktop-1280',  viewport: { width: 1280, height: 800  }, isMobile: false },
  { name: 'Desktop-1440',  viewport: { width: 1440, height: 900  }, isMobile: false },
  { name: 'Desktop-2560',  viewport: { width: 2560, height: 1440 }, isMobile: false },
];

module.exports = defineConfig({
  testDir: '.',
  // Explicit testIgnore: quarantined legacy specs hardcode prod URL + real
  // account email → polluted user prod DB when full suite ran (B7-like incident
  // 2026-05-16). DO NOT remove this ignore without refactoring each spec to
  // use tests/helpers/env-guard.js + tests/fixtures/auto-cleanup.fixture.js
  // (Stage 0 ship) + e2e@first-principle.test account.
  testIgnore: ['**/_quarantine_prod_legacy/**'],
  timeout: 90000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PMDRILL_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:4000',
    headless: true,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: DEVICES.map(device => ({
    name: device.name,
    use: {
      viewport: device.viewport,
      isMobile: device.isMobile,
      hasTouch: device.isMobile,
    },
  })),
});
