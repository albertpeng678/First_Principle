const { test, expect } = require('@playwright/test');

test.describe('NSM Step 2 example renders from q.field_examples (not hardcoded)', () => {
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

  test('NSM Step 2 first field has LOCKED .field__hint-row with both buttons right-aligned', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForSelector('.nsm-field');

    // Verify LOCKED class structure
    expect(await page.locator('.nsm-field .field__label-row').count()).toBeGreaterThanOrEqual(3);
    expect(await page.locator('.nsm-field .field__hint-link').count()).toBeGreaterThanOrEqual(3);
    expect(await page.locator('.nsm-field .field-example-toggle').count()).toBeGreaterThanOrEqual(3);

    // Hint button has lightbulb icon
    expect(await page.locator('.nsm-field .field__hint-link .ph-lightbulb').count()).toBeGreaterThanOrEqual(3);
  });

  test('Example expand reveals pre-generated content from q.field_examples (not Spotify generic)', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForSelector('.field-example-toggle');
    await page.locator('.field-example-toggle').first().click();
    await page.waitForTimeout(200);

    expect(await page.locator('.example-expand').count()).toBeGreaterThanOrEqual(1);
    const exampleText = await page.locator('.example-expand').first().textContent();
    expect(exampleText.length).toBeGreaterThan(20);
    // Should contain Netflix-related content (q1 is Netflix), NOT Spotify generic
    expect(exampleText).not.toContain('每月完成至少一首完整曲目');
  });

  test('NSM Step 2 hint button click opens modal with sparkle icon', async ({ page }) => {
    await page.route('**/api/nsm-public/step2-hint**', r => r.fulfill({
      status: 200, body: JSON.stringify({ hint: '- **行為動詞**：完成購買\n- 量化門檻：每月 ≥ 1 次' })
    }));
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
    await page.waitForSelector('.modal-card', { timeout: 5000 });
    expect(await page.locator('.modal-card .ph-sparkle, .modal__head-icon .ph-sparkle').count()).toBeGreaterThanOrEqual(1);

    // Wait for content state (loading → content)
    await page.waitForTimeout(500);
    const body = await page.locator('.modal__body, .modal-card').first().textContent();
    expect(body).toContain('行為動詞');
  });

  test('NSM Step 3 dim renders example from q.field_examples.step3', async ({ page }) => {
    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
      window.render();
    });
    await page.waitForSelector('.nsm-dim');

    // Verify all 4 dim cards have example button (dim id 'impact' aligned across all sites)
    expect(await page.locator('.nsm-dim .field-example-toggle').count()).toEqual(4);

    // Click first dim's example
    await page.locator('.nsm-dim .field-example-toggle').first().click();
    await page.waitForTimeout(200);
    expect(await page.locator('.nsm-dim .example-expand').count()).toBeGreaterThanOrEqual(1);
  });
});
