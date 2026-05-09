const { test, expect } = require('@playwright/test');

test.describe('NSM sub-tabs DOM-removed', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
    await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/nsm-sessions**', async (route, request) => {
      if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
      return route.fulfill({ status: 200, body: '[]' });
    });
    await page.route('**/api/guest/nsm-sessions**', async (route, request) => {
      if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
      return route.fulfill({ status: 200, body: '[]' });
    });
    await page.route('**/api/nsm-context**', r => r.fulfill({
      status: 200, body: JSON.stringify({ model: 'm', users: 'u', traps: 't', insight: 'i' })
    }));
  });

  test('NSM Step 2 has no .nsm-sub-tabs element', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForSelector('[data-nsm-field="nsm"]');
    expect(await page.locator('.nsm-sub-tabs').count()).toBe(0);
    expect(await page.locator('.nsm-sub-tab').count()).toBe(0);
  });

  test('NSM Step 3 has no .nsm-sub-tabs element', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForSelector('.nsm-step3-banner');
    expect(await page.locator('.nsm-sub-tabs').count()).toBe(0);
  });

  test('NSM Gate inline (nsmSubTab=nsm-gate) has no .nsm-sub-tabs', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-gate';
      window.AppState.nsmGateLoading = true;
      window.AppState.nsmGateLoadingStep = 0;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForTimeout(300);
    expect(await page.locator('.nsm-sub-tabs').count()).toBe(0);
  });
});
