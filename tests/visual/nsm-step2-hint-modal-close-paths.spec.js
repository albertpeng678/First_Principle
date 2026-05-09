const { test, expect } = require('@playwright/test');

test.describe('NSM Step 2 hint modal — 4 close paths', () => {
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
    await page.route('**/api/nsm-public/step2-hint**', r => r.fulfill({
      status: 200, body: JSON.stringify({ hint: '- **重點**：提示內容測試' })
    }));
  });

  async function openHintModal(page) {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForSelector('.field__hint-link');
    await page.locator('.field__hint-link').first().click();
    await page.waitForSelector('.modal-card');
    await page.waitForTimeout(300); // wait for content state
  }

  test('ESC key closes modal', async ({ page }) => {
    await openHintModal(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(await page.locator('.modal-card').count()).toBe(0);
  });

  test('backdrop click closes modal', async ({ page }) => {
    await openHintModal(page);
    const backdrop = page.locator('.overlay-frame__backdrop, [data-nsm-modal-close="backdrop"]').first();
    await backdrop.click({ position: { x: 5, y: 5 }, force: true });
    await page.waitForTimeout(200);
    expect(await page.locator('.modal-card').count()).toBe(0);
  });

  test('X button closes modal', async ({ page }) => {
    await openHintModal(page);
    await page.locator('.modal__close, [data-nsm-modal-close="x"]').first().click();
    await page.waitForTimeout(200);
    expect(await page.locator('.modal-card').count()).toBe(0);
  });

  test('「了解了」 button closes modal', async ({ page }) => {
    await openHintModal(page);
    await page.locator('.modal__foot button:has-text("了解了"), [data-nsm-modal-close="ok"]').first().click();
    await page.waitForTimeout(200);
    expect(await page.locator('.modal-card').count()).toBe(0);
  });
});
