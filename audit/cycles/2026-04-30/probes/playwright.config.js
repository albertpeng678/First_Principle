// Aesthetics probe config — same projects as the master config, but testDir
// pointed at this folder so the probe spec is picked up.
const path = require('path');
const base = require(path.resolve(__dirname, '../../../../tests/playwright/playwright.config.js'));
module.exports = {
  ...base,
  testDir: __dirname,
  reporter: [['line']],
};
