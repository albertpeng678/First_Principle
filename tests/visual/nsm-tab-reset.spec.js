const { test, expect } = require('@playwright/test');

test.describe('NSM tab click resets to Step 1', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/(guest-)?nsm-sessions**', async (route, request) => {
      if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
      return route.fulfill({ status: 200, body: '[]' });
    });
    await page.route('**/api/nsm-context**', r => r.fulfill({
      status: 200, body: JSON.stringify({ model: 'm', users: 'u', traps: 't', insight: 'i' })
    }));
  });

  test('NSM tab click from Step 2 returns to Step 1 question selector', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    // Use page.evaluate pattern (matches existing nsm-step-2-3.spec.js convention)
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 5000 });

    // Click NSM navbar tab — should reset to Step 1
    await page.click('button[data-nav="nsm"]');
    await page.waitForTimeout(300);

    const state = await page.evaluate(() => ({
      nsmStep: window.AppState.nsmStep,
      nsmSubTab: window.AppState.nsmSubTab,
      view: window.AppState.view,
    }));
    expect(state.nsmStep).toBe(1);
    expect(state.nsmSubTab).toBe(null);
    expect(state.view).toBe('nsm');
  });

  test('NSM tab does NOT reset during nsmGateLoading (mid-eval)', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmGateLoading = true;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForTimeout(200);

    await page.click('button[data-nav="nsm"]');
    await page.waitForTimeout(300);

    const state = await page.evaluate(() => ({
      nsmStep: window.AppState.nsmStep,
      nsmGateLoading: window.AppState.nsmGateLoading,
    }));
    expect(state.nsmStep).toBe(2); // preserved during loading
    expect(state.nsmGateLoading).toBe(true);
  });

  test('NSM tab does NOT reset during nsmEvalLoading (mid-eval)', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmEvalLoading = true;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForTimeout(200);

    await page.click('button[data-nav="nsm"]');
    await page.waitForTimeout(300);

    const state = await page.evaluate(() => ({
      nsmStep: window.AppState.nsmStep,
      nsmEvalLoading: window.AppState.nsmEvalLoading,
    }));
    expect(state.nsmStep).toBe(3); // preserved during loading
    expect(state.nsmEvalLoading).toBe(true);
  });
});
