const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testMatch: '**/circles.spec.js',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    channel: 'chrome',
    headless: true,
  },
});
