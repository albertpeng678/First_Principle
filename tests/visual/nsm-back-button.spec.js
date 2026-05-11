const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setupNsmStep2(page) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 2,
      nsmSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      nsmDefinition: { nsm: '', explanation: '', businessLink: '' },
      nsmBreakdown: { reach: '', depth: '', frequency: '', impact: '' },
      nsmSession: { id: 's-mock' },
    });
    window.render();
  });
}

test('Step 2 back → goes home (view=circles), NOT to NSM Step 1', async ({ page }) => {
  await setupNsmStep2(page);
  await page.locator('[data-nsm-action="back"]').click();
  await page.waitForTimeout(100);
  const state = await page.evaluate(() => ({ view: window.AppState.view, nsmStep: window.AppState.nsmStep }));
  expect(state.view).toBe('circles');
});

test('Step 2 back → nsmSelectedQuestion preserved (not cleared)', async ({ page }) => {
  await setupNsmStep2(page);
  await page.locator('[data-nsm-action="back"]').click();
  await page.waitForTimeout(100);
  const q = await page.evaluate(() => window.AppState.nsmSelectedQuestion);
  expect(q).toEqual(expect.objectContaining({ id: 'q1', company: 'Spotify' }));
});

test('Step 3 back-to-step2 → Step 2 (regression guard — unchanged behavior)', async ({ page }) => {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 3,
      nsmSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      nsmDefinition: { nsm: 'x', explanation: 'y', businessLink: 'z' },
      nsmBreakdown: { reach: '', depth: '', frequency: '', impact: '' },
      nsmSession: { id: 's-mock' },
    });
    window.render();
  });
  await page.locator('[data-nsm-action="back-to-step2"]').click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.AppState.nsmStep)).toBe(2);
});
