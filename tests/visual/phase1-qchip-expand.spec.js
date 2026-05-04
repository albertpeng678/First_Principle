const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://localhost:4000' });

function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function gotoPhase1(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').first().click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.qchip');
}

test('qchip default has caret-down + no qchip-expand', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await expect(page.locator('.qchip__caret.ph-caret-down')).toBeVisible();
  await expect(page.locator('.qchip-expand')).toHaveCount(0);
  await expect(page.locator('.qchip.is-expanded')).toHaveCount(0);
});

test('qchip click → expand panel + caret-up', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.locator('.qchip').click();
  await expect(page.locator('.qchip.is-expanded')).toBeVisible();
  await expect(page.locator('.qchip__caret.ph-caret-up')).toBeVisible();
  await expect(page.locator('.qchip-expand')).toBeVisible();
  await expect(page.locator('.qchip-expand__section-label')).toHaveText('深入分析');
  await expect(page.locator('.qchip-ana__block')).toHaveCount(4);
  await expect(page.locator('.qchip-ana__block--trap')).toHaveCount(1);
});

test('4 ana-block heads correct text + icons', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.locator('.qchip').click();
  const heads = page.locator('.qchip-ana__head');
  await expect(heads.nth(0)).toContainText('商業背景');
  await expect(heads.nth(0).locator('i.ph-buildings')).toBeVisible();
  await expect(heads.nth(1)).toContainText('用戶輪廓');
  await expect(heads.nth(1).locator('i.ph-users')).toBeVisible();
  await expect(heads.nth(2)).toContainText('常見誤區');
  await expect(heads.nth(2).locator('i.ph-warning')).toBeVisible();
  await expect(heads.nth(3)).toContainText('破題切入');
  await expect(heads.nth(3).locator('i.ph-lightbulb')).toBeVisible();
});

test('collapse btn → panel disappears + caret-down', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.locator('.qchip').click();
  await page.locator('.qchip-collapse-btn').click();
  await expect(page.locator('.qchip-expand')).toHaveCount(0);
  await expect(page.locator('.qchip__caret.ph-caret-down')).toBeVisible();
});

test('collapse btn click does not bubble to qchip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.locator('.qchip').click();
  await page.locator('.qchip-collapse-btn').click();
  // Should be collapsed (single click cycle, not double via bubble)
  await expect(page.locator('.qchip-expand')).toHaveCount(0);
});

test('qchip-expand applies to L step', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.evaluate(() => { window.AppState.circlesSimStep = 4; window.renderApp(); });
  await page.waitForSelector('.sol-card');
  await page.locator('.qchip').click();
  await expect(page.locator('.qchip-expand')).toBeVisible();
  await expect(page.locator('.qchip-ana__block')).toHaveCount(4);
});

test('qchip-expand applies to S step', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoPhase1(page);
  await page.evaluate(() => { window.AppState.circlesSimStep = 6; window.renderApp(); });
  await page.waitForSelector('.tracking-section');
  await page.locator('.qchip').click();
  await expect(page.locator('.qchip-expand')).toBeVisible();
  await expect(page.locator('.qchip-ana__block')).toHaveCount(4);
});
