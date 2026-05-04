// tests/visual/phase1-example-expand.spec.js — Plan B SB8 Task 2 TDD spec
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

async function gotoStep(page, simStepIdx) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
  await page.evaluate(idx => { window.AppState.circlesSimStep = idx; window.renderApp(); }, simStepIdx);
}

test('C1 範例答案 click → inline expand 顯示', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field-example-toggle').first().click();
  var firstExpand = page.locator('.example-expand').first();
  await expect(firstExpand).toBeVisible();
  // verify list is populated: none of the li items should still say "載入中"
  // use all() to check each li item
  const listItems = await firstExpand.locator('.example-list li').all();
  for (const li of listItems) {
    await expect(li).not.toContainText('載入中');
  }
  // also verify there's at least one item with real content
  expect(listItems.length).toBeGreaterThan(0);
});

test('範例答案 close button 收合', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field-example-toggle').first().click();
  await page.locator('.example-expand__close').first().click();
  await expect(page.locator('.example-expand').first()).not.toBeVisible();
});

// E step sol-card × 4 fields × 範例答案 click
test('E step sol-1 advantage 範例答案 expand 顯示', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stub(page);
  await gotoStep(page, 5);
  await page.evaluate(() => {
    window.AppState.circlesPhase1Solutions = [{name:'A',mechanism:''},{name:'B',mechanism:''}];
    window.renderApp();
  });
  await page.waitForSelector('.sol-card');
  await page.locator('.sol-card').first().locator('.field-example-toggle').first().click();
  var firstExpand = page.locator('.sol-card').first().locator('.example-expand').first();
  await expect(firstExpand).toBeVisible();
});

// 全 7 step × example smoke
['C1','I','R','C2','L','E','S'].forEach((step, idx) => {
  test(`${step} step 範例答案 click expand`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await stub(page);
    await gotoStep(page, idx);
    if (step === 'L' || step === 'E') {
      await page.evaluate(() => {
        window.AppState.circlesPhase1Solutions = [{name:'A',mechanism:''},{name:'B',mechanism:''}];
        window.renderApp();
      });
      await page.waitForSelector('.sol-card');
    }
    await page.locator('.field-example-toggle').first().click();
    await expect(page.locator('.example-expand').first()).toBeVisible();
  });
});
