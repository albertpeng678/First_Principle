const { test, expect } = require('@playwright/test');

const Q_TEST = { id: 'q-preflight-test', company: 'Spotify', industry: '音樂串流', scenario: '為 Spotify 定義北極星指標', product: 'Spotify Music' };

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-context**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ model: 'm', users: 'u', traps: 't', insight: 'i' })
  }));
}

async function navigateToNSMStep2(page) {
  await page.evaluate(({ q }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-step2';
    window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmSession = null;
    window.render();
  }, { q: Q_TEST });
  await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 3000 });
}

test.describe('NSM Step 2 mount fires preflight POST', () => {
  test('preflight POST fires within 1s of Step 2 mount, no typing required', async ({ page }) => {
    let preflightCount = 0;
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions', async (route, request) => {
      if (request.method() === 'POST') {
        preflightCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 's-pre-1', sessionId: 's-pre-1' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });
    await mockApis(page);

    await page.goto('/');
    await page.waitForSelector('.qcard');
    await navigateToNSMStep2(page);
    await page.waitForTimeout(800);

    expect(preflightCount).toBeGreaterThanOrEqual(1);
  });

  test('preflight is idempotent — same qid does not double-POST', async ({ page }) => {
    let preflightCount = 0;
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions', async (route, request) => {
      if (request.method() === 'POST') {
        preflightCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 's-pre-1', sessionId: 's-pre-1' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });
    await mockApis(page);

    await page.goto('/');
    await page.waitForSelector('.qcard');
    await navigateToNSMStep2(page);
    await page.waitForTimeout(800);
    // Re-render (simulates re-mount same qid)
    await page.evaluate(() => window.render && window.render());
    await page.waitForTimeout(500);

    expect(preflightCount).toBe(1);
  });
});
