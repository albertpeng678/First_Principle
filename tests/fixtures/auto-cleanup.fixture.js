const { test: base } = require('@playwright/test');

async function runAfterEachCleanup(tracked, request) {
  for (const { kind, id } of tracked) {
    const path = `/api/${kind}-sessions/${id}`;
    try {
      const res = await request.delete(path);
      if (!res.ok() && res.status() !== 404) {
        console.warn(`auto-cleanup: DELETE ${path} returned ${res.status()}`);
      } else if (res.status() === 404) {
        console.warn(`auto-cleanup: DELETE ${path} returned 404 (already gone)`);
      }
    } catch (e) {
      console.warn(`auto-cleanup: DELETE ${path} threw: ${e.message}`);
    }
  }
}

const test = base.extend({
  cleanupTracker: [
    async ({ request }, use) => {
      const tracked = [];
      await use({
        track: (kind, id) => {
          if (!['nsm', 'circles'].includes(kind)) {
            throw new Error(`auto-cleanup: invalid kind "${kind}" — must be 'nsm' or 'circles'`);
          }
          tracked.push({ kind, id });
        },
      });
      await runAfterEachCleanup(tracked, request);
    },
    { auto: true },
  ],
});

module.exports = { test, runAfterEachCleanup };
