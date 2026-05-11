const { test, expect } = require('@playwright/test');

async function mockApis(page, nsmStats) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nsmStats) }));
  await page.route('**/api/guest-nsm-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nsmStats) }));
}

test('NSM home renders stats strip with counts', async ({ page }) => {
  await mockApis(page, { completed: 2, active: 0, weeklyCompleted: 1 });
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 1;
    window.render();
  });
  await page.waitForTimeout(500); // async stats fetch + populate
  const strip = page.locator('[data-stats-strip="nsm"]');
  await expect(strip).toBeVisible();
  await expect(strip.locator('[data-stat="completed"]')).toHaveText('2');
  await expect(strip.locator('[data-stat="active"]')).toHaveText('0');
  await expect(strip.locator('[data-stat="weekly"]')).toHaveText('1');
});

test('NSM home strip with higher counts', async ({ page }) => {
  await mockApis(page, { completed: 5, active: 3, weeklyCompleted: 2 });
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 1;
    window.render();
  });
  await page.waitForTimeout(500);
  await expect(page.locator('[data-stats-strip="nsm"]')).toBeVisible();
  await expect(page.locator('[data-stats-strip="nsm"] [data-stat="completed"]')).toHaveText('5');
  await expect(page.locator('[data-stats-strip="nsm"] [data-stat="active"]')).toHaveText('3');
  await expect(page.locator('[data-stats-strip="nsm"] [data-stat="weekly"]')).toHaveText('2');
});
