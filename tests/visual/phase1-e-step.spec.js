// Plan B SB7 — E step (per-solution × 4-field nested) Playwright spec
// TDD: write spec first (red), then implement (green)
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html
// Section B (line 1230-1467) — E step 沿用 L 結構規則 (mockup 03 line 1466)

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

async function gotoEStep(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  // 選 simulation mode (mode-card[0] = sim)
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
  // 直接跳 E step (simStep=5)
  await page.evaluate(() => {
    window.AppState.circlesSimStep = 5;  // E step idx = 5
    window.renderApp();
  });
  // 等 E step 渲染（data-circles-e-step="true" 已存在於 placeholder）
  await page.waitForSelector('[data-circles-e-step="true"]');
}

// 規則：E 沿用 L 結構 (per mockup 03 line 1466)
// spec 1: E 步渲染 2 個 sol-card（對齊 AppState.circlesPhase1Solutions 預設長度）
test('E step renders 2 sol-cards by default (matches L step solutions count)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await stub(page);
  await gotoEStep(page);
  await expect(page.locator('.sol-card')).toHaveCount(2);
  await expect(page.locator('.sol-card__num').nth(0)).toContainText('方案一');
  await expect(page.locator('.sol-card__num').nth(1)).toContainText('方案二');
});

// spec 2: phase-head__num = 06 / progress E is-active
test('E step phase-head__num is 06 and progress E is active', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await stub(page);
  await gotoEStep(page);
  await expect(page.locator('.phase-head__num')).toHaveText('06');
  await expect(page.locator('.progress__step.is-active .step-letter')).toHaveText('E');
});

// spec 3: 每張 sol-card 含 4 個 rt-field + 正確 label 順序（mockup 03 line 1258-1273）
test('Each sol-card contains exactly 4 rt-fields (優點/缺點/風險與依賴/成功指標)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoEStep(page);
  const firstCard = page.locator('.sol-card').nth(0);
  await expect(firstCard.locator('.rt-field')).toHaveCount(4);
  await expect(firstCard.locator('.field__label').nth(0)).toHaveText('優點');
  await expect(firstCard.locator('.field__label').nth(1)).toHaveText('缺點');
  await expect(firstCard.locator('.field__label').nth(2)).toHaveText('風險與依賴');
  await expect(firstCard.locator('.field__label').nth(3)).toHaveText('成功指標');
});

// spec 4: 無 sol-add / 無 sol-card__remove（E 步不可改方案數）
test('E step does not render sol-add or sol-card__remove (cannot edit solution count)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoEStep(page);
  await expect(page.locator('.sol-add')).toHaveCount(0);
  await expect(page.locator('.sol-card__remove')).toHaveCount(0);
});

// spec 5: sol name 唯讀（無 input element — 對照 L 步 .sol-card__name-input 改為顯示）
test('E step sol-card name is read-only (no input element for name)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await stub(page);
  await gotoEStep(page);
  // E step 不渲染 .sol-card__name-input（唯讀展示 name）
  await expect(page.locator('.sol-card__name-input')).toHaveCount(0);
});

// spec 6: desktop 顯 rail + rail__title = 'E 步重點'（mockup 03 line 1445-1452）
test('desktop renders rail with E 步重點', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stub(page);
  await gotoEStep(page);
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('.rail__title').first()).toHaveText('E 步重點');
});

// spec 7: desktop sim qchip__company 含「設計題」suffix（對齊 SB6 cold-review fix）
test('desktop sim base E step qchip__company shows 設計題 suffix', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stub(page);
  await gotoEStep(page);
  const company = await page.locator('.qchip__company').textContent();
  expect(company).toContain('設計題');
});

// spec 8: textarea input → AppState.circlesPhase1Evaluate 持久化
test('typing in E step textarea persists to AppState.circlesPhase1Evaluate', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoEStep(page);
  // sol 0 / field 0 = advantages
  await page.locator('[data-circles-e-sol-idx="0"][data-circles-e-field-key="advantages"]').fill('提升用戶留存');
  await page.waitForTimeout(200);
  const state = await page.evaluate(() => window.AppState.circlesPhase1Evaluate[0].advantages);
  expect(state).toBe('提升用戶留存');
});
