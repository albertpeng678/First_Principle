// tests/playwright/playwright.config.js
const { defineConfig } = require('@playwright/test');

const DEVICES = [
  { name: 'iPhone-SE',     viewport: { width: 375, height: 667 },  isMobile: true  },
  { name: 'iPhone-15-Pro', viewport: { width: 430, height: 932 },  isMobile: true  },
  { name: 'iPad',          viewport: { width: 768, height: 1024 }, isMobile: true  },
  { name: 'Desktop',       viewport: { width: 1280, height: 800 }, isMobile: false },
];

module.exports = defineConfig({
  testDir: './journeys',
  timeout: 30000,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: '../../test-results.json' }]],
  use: {
    baseURL: 'http://localhost:4000',
    headless: true,
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
