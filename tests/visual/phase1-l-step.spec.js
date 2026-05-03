// Plan B SB4 — L step solution-multi Playwright spec
// TDD: write spec first (red), then implement (green)
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html Section B (line 1230-1467)

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

async function gotoLStep(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  // pick simulation mode (mode-card[0] = sim)
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
  // skip C1/I/R/C2 to reach L (set state directly via injection)
  await page.evaluate(() => { window.AppState.circlesSimStep = 4; window.renderApp(); });
  await page.waitForSelector('.sol-card');
}

test('L step renders 2 sol-cards by default', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoLStep(page);
  await expect(page.locator('.sol-card')).toHaveCount(2);
  await expect(page.locator('.sol-card__num').nth(0)).toHaveText('方案一');
  await expect(page.locator('.sol-card__num').nth(1)).toHaveText('方案二');
  await expect(page.locator('.sol-add')).toBeVisible();
});

test('L step phase-head__num is 05 and progress L is active', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoLStep(page);
  await expect(page.locator('.phase-head__num')).toHaveText('05');
  await expect(page.locator('.progress__step.is-active .step-letter')).toHaveText('L');
});

test('sol-add adds 3rd card with optional + remove btn', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoLStep(page);
  await page.locator('.sol-add').click();
  await expect(page.locator('.sol-card')).toHaveCount(3);
  await expect(page.locator('.sol-card__num').nth(2)).toContainText('方案三');
  await expect(page.locator('.sol-card__optional')).toBeVisible();
  await expect(page.locator('.sol-card__remove')).toBeVisible();
  // sol-add hidden after 3rd added
  await expect(page.locator('.sol-add')).toBeHidden();
});

test('sol-card__remove removes 3rd card', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoLStep(page);
  await page.locator('.sol-add').click();
  await page.locator('.sol-card__remove').click();
  await expect(page.locator('.sol-card')).toHaveCount(2);
  await expect(page.locator('.sol-add')).toBeVisible();
});

test('desktop renders rail with L 步重點', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoLStep(page);
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('.rail__title').first()).toHaveText('L 步重點');
});

test('desktop qchip__company shows 設計題 · 難度 中 suffix', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoLStep(page);
  // suffix appears on desktop sim mode for L step (matches mockup line 1388)
  const company = await page.locator('.qchip__company').textContent();
  expect(company).toContain('設計題');
});
