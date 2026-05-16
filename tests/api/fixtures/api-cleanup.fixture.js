// tests/api/fixtures/api-cleanup.fixture.js
// Extends auto-cleanup.fixture with auth headers for real API tests.
// The base auto-cleanup uses the plain request fixture (no auth).
// This fixture adds the e2e token to DELETE cleanup calls.
//
// Per api-testing.md §Anti-Patterns: "Forget cleanup after creating resources:
// test pollution: subsequent tests may see stale data".
// Per api-testing.md §API Data Seeding: "Cleanup after test — always delete what you created".

const { test: base } = require('@playwright/test');
const { validateTrackArgs } = require('../../fixtures/auto-cleanup.fixture');
const { getE2eToken } = require('../helpers/auth');

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

async function runAuthCleanup(tracked, request) {
  const token = await getE2eToken();
  const failures = [];
  for (const { kind, id } of tracked) {
    const path = `${BASE_URL}/api/${kind}-sessions/${id}`;
    try {
      const res = await request.delete(path, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.status() === 404) {
        console.warn(`api-cleanup: DELETE ${path} returned 404 (already gone)`);
      } else if (!res.ok()) {
        failures.push(`DELETE ${path} returned ${res.status()}`);
      }
    } catch (e) {
      failures.push(`DELETE ${path} threw: ${e.message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `api-cleanup: ${failures.length} non-404 cleanup failure(s):\n  - ` +
      failures.join('\n  - ')
    );
  }
}

const test = base.extend({
  cleanupTracker: [
    async ({ request }, use) => {
      const tracked = [];
      await use({
        track: (kind, id) => {
          validateTrackArgs(kind, id);
          tracked.push({ kind, id });
        },
      });
      await runAuthCleanup(tracked, request);
    },
    { auto: true },
  ],
});

module.exports = { test };
