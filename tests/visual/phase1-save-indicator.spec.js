// Plan B SB9a — Save indicator 4 狀態 visual cycle
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html Section F line 2109-2186
// Backend rule: 後端不動 — visual state cycle + localStorage 草稿(無 PATCH /progress)
const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://localhost:4000' });

function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function gotoSimC1(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
}

test('default state is idle (已暫存)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  const indicator = page.locator('.save-indicator').first();
  await expect(indicator).toBeVisible();
  await expect(indicator).toContainText('已暫存');
  await expect(indicator).toHaveClass(/save-indicator--idle/);
});

test('typing triggers saving → saved → idle cycle', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.locator('.rt-textarea').first().click();
  await page.keyboard.type('test');
  // saving appears within debounce window (800ms + buffer)
  await expect(page.locator('.save-indicator--saving').first()).toBeVisible({ timeout: 1500 });
  // saved appears after 200ms simulated write
  await expect(page.locator('.save-indicator--saved').first()).toBeVisible({ timeout: 2000 });
  // returns to idle after 2000ms fade
  await expect(page.locator('.save-indicator--idle').first()).toBeVisible({ timeout: 5000 });
});

test('saved state writes to localStorage', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.locator('.rt-textarea').first().click();
  await page.keyboard.type('hello-draft');
  await expect(page.locator('.save-indicator--saved').first()).toBeVisible({ timeout: 3000 });
  const draftKeys = await page.evaluate(() => {
    return Object.keys(localStorage).filter(k => k.startsWith('pmdrill:circles:draft:'));
  });
  expect(draftKeys.length).toBeGreaterThan(0);
});

test('error state on localStorage throw shows retry copy', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  await page.evaluate(() => {
    const proto = Storage.prototype;
    proto._origSetItem = proto.setItem;
    proto.setItem = function () { throw new Error('quota'); };
  });
  await page.locator('.rt-textarea').first().click();
  await page.keyboard.type('x');
  await expect(page.locator('.save-indicator--error').first()).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.save-indicator--error').first()).toContainText('離線中');
});

test('error state click retries cycle (saving appears again)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSimC1(page);
  // force first attempt to error
  await page.evaluate(() => {
    Storage.prototype._origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new Error('quota'); };
  });
  await page.locator('.rt-textarea').first().click();
  await page.keyboard.type('y');
  await expect(page.locator('.save-indicator--error').first()).toBeVisible({ timeout: 3000 });
  // restore localStorage so retry succeeds
  await page.evaluate(() => {
    Storage.prototype.setItem = Storage.prototype._origSetItem;
  });
  // click error indicator → retry → saving → saved
  await page.locator('.save-indicator--error').first().click();
  await expect(page.locator('.save-indicator--saving').first()).toBeVisible({ timeout: 1500 });
  await expect(page.locator('.save-indicator--saved').first()).toBeVisible({ timeout: 2000 });
});
