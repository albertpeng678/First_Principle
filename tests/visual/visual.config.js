// Playwright config for visual capture specs (tests/visual/*.spec.js)
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.PMDRILL_BASE_URL
  || process.env.PLAYWRIGHT_BASE_URL
  || process.env.BASE_URL
  || 'http://localhost:4000';

module.exports = defineConfig({
  testDir: '.',
  timeout: 60000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    headless: true,
    channel: 'chrome',
  },
  projects: [
    { name: 'Mobile-360',    use: { viewport: { width: 360,  height: 780  }, isMobile: true,  hasTouch: true } },
    { name: 'iPad',          use: { viewport: { width: 768,  height: 1024 }, isMobile: false } },
    { name: 'Desktop-1280',  use: { viewport: { width: 1280, height: 800  }, isMobile: false } },
  ],
});
