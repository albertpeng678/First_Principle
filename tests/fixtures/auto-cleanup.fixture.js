const { test: base } = require('@playwright/test');

function validateTrackArgs(kind, id) {
  if (!['nsm', 'circles'].includes(kind)) {
    throw new Error(`auto-cleanup: invalid kind "${kind}" — must be 'nsm' or 'circles'`);
  }
  if (id == null || id === '') {
    throw new Error(`auto-cleanup: id is required (got ${JSON.stringify(id)})`);
  }
}

async function runAfterEachCleanup(tracked, request) {
  const failures = [];
  for (const { kind, id } of tracked) {
    const path = `/api/${kind}-sessions/${id}`;
    try {
      const res = await request.delete(path);
      if (res.status() === 404) {
        console.warn(`auto-cleanup: DELETE ${path} returned 404 (already gone)`);
      } else if (!res.ok()) {
        failures.push(`DELETE ${path} returned ${res.status()}`);
      }
    } catch (e) {
      failures.push(`DELETE ${path} threw: ${e.message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `auto-cleanup: ${failures.length} non-404 cleanup failure(s):\n  - ` +
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
      await runAfterEachCleanup(tracked, request);
    },
    { auto: true },
  ],
});

module.exports = { test, runAfterEachCleanup, validateTrackArgs };
