// Jest config — restrict scanning to real unit tests under tests/
// (excludes Playwright specs, worktree copies, and temp browser-profile dirs).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.worktrees/',
    '/.tmp-chrome-profile/',
    '/tests/playwright/',
    '/tests/audit/',
    '/tests/mobile-audit/',
  ],
  setupFiles: ['<rootDir>/tests/setup-env.js'],
};
