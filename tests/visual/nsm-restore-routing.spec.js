const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest/nsm-sessions/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

async function restoreItem(page, item) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate((it) => {
    window.AppState.accessToken = null;
    // Invoke the restore handler — implementer must expose it as window._loadCirclesSessionItem
    // (or equivalent) so the test can call it directly without UI fixture.
    if (typeof window._loadCirclesSessionItem === 'function') {
      window._loadCirclesSessionItem(it);
    } else {
      throw new Error('window._loadCirclesSessionItem not exposed by implementer');
    }
  }, item);
  await page.waitForTimeout(100);
}

test('Bug 1 (a) scored session → Step 4', async ({ page }) => {
  await restoreItem(page, {
    id: 's1', question_id: 'q1', question_json: { id: 'q1', company: 'Z', product: 'X', question_type: 'design' },
    status: 'completed',
    user_nsm: { nsm: 'x', explanation: 'y', businessLink: 'z' },
    user_breakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
    scores_json: { overall: 80, dims: {} },
  });
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(4);
});

test('Bug 1 (b) breakdown-only session → Step 3', async ({ page }) => {
  await restoreItem(page, {
    id: 's2', question_id: 'q1', question_json: { id: 'q1', company: 'Z', product: 'X', question_type: 'design' },
    status: 'active',
    user_nsm: { nsm: 'x', explanation: 'y', businessLink: 'z' },
    user_breakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
    scores_json: null,
  });
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(3);
});

test('Bug 1 (c) nsm-only session → Step 2', async ({ page }) => {
  await restoreItem(page, {
    id: 's3', question_id: 'q1', question_json: { id: 'q1', company: 'Z', product: 'X', question_type: 'design' },
    status: 'active',
    user_nsm: { nsm: 'something', explanation: '', businessLink: '' },
    user_breakdown: { reach: '', depth: '', frequency: '', impact: '' },
    scores_json: null,
  });
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(2);
});

test('Bug 1 (d) empty session → Step 1', async ({ page }) => {
  await restoreItem(page, {
    id: 's4', question_id: 'q1', question_json: { id: 'q1', company: 'Z', product: 'X', question_type: 'design' },
    status: 'active',
    user_nsm: null, user_breakdown: null, scores_json: null,
  });
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(1);
});
