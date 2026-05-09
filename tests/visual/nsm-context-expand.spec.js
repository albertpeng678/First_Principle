const { test, expect } = require('@playwright/test');

test.describe('NSM Step 2 context-card 4-block expand', () => {
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
      status: 200, body: JSON.stringify({
        model: 'M-business-model', users: 'M-users-profile',
        traps: 'M-vanity-traps', insight: 'M-key-insight'
      })
    }));
  });

  test('clicking expand toggle reveals 4 ana blocks', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = false;
      window.render();
    });
    await page.waitForSelector('.nsm-context-card', { timeout: 5000 });

    expect(await page.locator('.nsm-context-card__ana-block').count()).toBe(0);
    await page.click('[data-nsm="context-toggle"]');
    await page.waitForTimeout(150);
    expect(await page.locator('.nsm-context-card__ana-block').count()).toBe(4);

    const trapClassMatch = await page.locator('.nsm-context-card__ana-block--trap').count();
    expect(trapClassMatch).toBe(1);
  });

  test('expand state persists when navigating Step 2 to Step 3', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = false;
      window.render();
    });
    await page.waitForSelector('.nsm-context-card');
    await page.click('[data-nsm="context-toggle"]');
    expect(await page.locator('.nsm-context-card__ana-block').count()).toBe(4);

    await page.evaluate(() => { window.AppState.nsmStep = 3; window.render(); });
    await page.waitForSelector('.nsm-context-card');
    expect(await page.locator('.nsm-context-card__ana-block').count()).toBe(4);
  });

  test('4 ana blocks have correct icons + content from q.context', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.AppState.nsmContextExpanded = true;
      window.render();
    });
    await page.waitForSelector('.nsm-context-card__ana-block');

    const heads = await page.locator('.nsm-context-card__ana-head').allTextContents();
    expect(heads).toEqual(expect.arrayContaining([
      expect.stringContaining('商業模式'),
      expect.stringContaining('使用者'),
      expect.stringContaining('常見陷阱'),
      expect.stringContaining('破題切入'),
    ]));

    // Verify Phosphor icons (NOT emoji)
    expect(await page.locator('.nsm-context-card__ana-head .ph-buildings').count()).toBe(1);
    expect(await page.locator('.nsm-context-card__ana-head .ph-users').count()).toBe(1);
    expect(await page.locator('.nsm-context-card__ana-head .ph-warning').count()).toBe(1);
    expect(await page.locator('.nsm-context-card__ana-head .ph-lightbulb').count()).toBe(1);
  });
});
