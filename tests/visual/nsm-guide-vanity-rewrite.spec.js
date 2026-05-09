const { test, expect } = require('@playwright/test');

test.describe('NSM guide step 3 vanity-check rewrite', () => {
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

  test('NSMGuide step 3 uses new vanity-check phrasing', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForSelector('.nsm-guide');

    const step3Text = await page.locator('.nsm-guide__step').nth(2).locator('p').textContent();
    expect(step3Text).toContain('如實反映');
    expect(step3Text).toContain('用戶體會到產品價值');
    expect(step3Text).not.toContain('如果這個數字翻倍');
    expect(step3Text).not.toContain('商業收益');
  });
});
