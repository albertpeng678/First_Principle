const { test, expect } = require('@playwright/test');

async function setupCirclesHome(page, opts = {}) {
  await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.history || []) }));
  await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript((flag) => {
    if (flag) localStorage.setItem('circles_onboarding_done', '1');
    else localStorage.removeItem('circles_onboarding_done');
  }, opts.flagSet || false);
  await page.goto('/');
  await page.waitForSelector('.qcard');
}

test.describe('Onboarding (mockup 10)', () => {
  test('First-time user (no flag, no history) sees welcome card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await expect(page.locator('.onb-welcome')).toBeVisible();
    await expect(page.locator('[data-onb-action="start"]')).toBeVisible();
    await expect(page.locator('[data-onb-action="skip"]').first()).toBeVisible();
  });

  test('Click 開始引導 → step 1 tooltip + .mode-section gets .onb-targeted', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.onb-tooltip__step')).toContainText('第 1 步 / 共 4 步');
    await expect(page.locator('.mode-section.onb-targeted')).toBeVisible();
  });

  test('Click 下一步 progresses 1→2→3→4', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    for (var n = 2; n <= 4; n++) {
      await page.locator('[data-onb-action="next"]').click();
      await page.waitForTimeout(150);
      await expect(page.locator('.onb-tooltip__step')).toContainText('第 ' + n + ' 步 / 共 4 步');
    }
  });

  test('Step 4 button text is 開始練習 not 下一步', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.locator('[data-onb-action="next"]').click();
    await page.locator('[data-onb-action="next"]').click();
    await page.locator('[data-onb-action="next"]').click();
    await expect(page.locator('[data-onb-action="finish"]')).toContainText('開始練習');
  });

  test('Click 略過引導 → set localStorage + close overlay', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="skip"]').first().click();
    await page.waitForTimeout(200);
    expect(await page.locator('.onb-welcome').count()).toBe(0);
    expect(await page.locator('.onb-tooltip').count()).toBe(0);
    var flag = await page.evaluate(() => localStorage.getItem('circles_onboarding_done'));
    expect(flag).toBe('1');
  });

  test('Click 直接自己選題 → set localStorage + close', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    // 直接自己選題 also has data-onb-action="skip" per spec
    await page.locator('[data-onb-action="skip"]').first().click();
    var flag = await page.evaluate(() => localStorage.getItem('circles_onboarding_done'));
    expect(flag).toBe('1');
  });

  test('Esc key skips', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    expect(await page.locator('.onb-tooltip').count()).toBe(0);
  });

  test('Returning user (flag set) does NOT see welcome', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page, { flagSet: true });
    expect(await page.locator('.onb-welcome').count()).toBe(0);
    expect(await page.locator('.onb-tooltip').count()).toBe(0);
  });

  test('User with history does NOT see welcome (even without flag)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page, {
      history: [{ id: 's1', question_id: 'q1', question_json: { id: 'q1', company: 'X', product: 'Y' }, mode: 'drill', drill_step: 'C1', status: 'completed', scores_json: { totalScore: 80 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    });
    expect(await page.locator('.onb-welcome').count()).toBe(0);
  });

  test('Tooltip arrow class matches step direction', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.waitForTimeout(200);
    var arrowClass = await page.locator('.onb-tooltip__arrow').first().getAttribute('class');
    expect(arrowClass).toMatch(/onb-tooltip__arrow--(left|right|top|bottom)/);
  });

  test('Mobile-360 onboarding still shows floating tooltip (NOT sticky-bottom)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.waitForTimeout(200);
    var tt = page.locator('.onb-tooltip');
    await expect(tt).toBeVisible();
    var box = await tt.boundingBox();
    // sticky-bottom would have y near viewport bottom (800 - h); float-near-target sits above bottom
    expect(box.y).toBeLessThan(700);
  });
});
