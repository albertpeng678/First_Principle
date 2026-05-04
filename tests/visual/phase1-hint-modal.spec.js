// tests/visual/phase1-hint-modal.spec.js — Plan B SB8 Task 1 TDD spec
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

test('C1 提示 click 開 modal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field__hint-link').first().click();
  await expect(page.locator('.modal-card')).toBeVisible();
  await expect(page.locator('.modal__title')).toHaveText('問題範圍');
  await expect(page.locator('.modal__body p').first()).toContainText('問題本身定義清楚');
});

test('hint modal close button 收合', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field__hint-link').first().click();
  await page.locator('.modal__close').click();
  await expect(page.locator('.modal-card')).not.toBeVisible();
});

test('hint modal 「了解了」CTA 收合', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field__hint-link').first().click();
  await page.locator('.modal__foot .btn--primary').click();
  await expect(page.locator('.modal-card')).not.toBeVisible();
});

test('hint modal backdrop click 收合', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoStep(page, 0);
  await page.locator('.field__hint-link').first().click();
  await page.locator('.hint-overlay__backdrop').click();
  await expect(page.locator('.modal-card')).not.toBeVisible();
});

// 7 step × 至少 1 hint 開 modal smoke
['C1','I','R','C2','L','E','S'].forEach((step, idx) => {
  test(`${step} step 提示 click 開 modal`, async ({ page }) => {
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
    await page.locator('.field__hint-link').first().click();
    await expect(page.locator('.modal-card')).toBeVisible();
    await expect(page.locator('.modal__sub')).toContainText('提示');
  });
});
