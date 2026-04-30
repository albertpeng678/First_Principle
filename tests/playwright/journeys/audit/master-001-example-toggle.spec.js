// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('MASTER-001 查看範例 inline expansion', () => {
  test('CIRCLES step C1 — 查看範例 click 後 body 展開', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    // 進第一題第一步
    await page.locator('.circles-q-card').first().scrollIntoViewIfNeeded();
    await page.locator('.circles-q-card').first().click();
    await page.locator('.circles-q-confirm-btn').first().click();
    // 等 step C1 渲染
    await page.waitForSelector('.field-example-toggle', { timeout: 5000 });

    const toggle = page.locator('.field-example-toggle').first();
    const group = toggle.locator('xpath=ancestor::*[contains(@class,"circles-field-group")][1]');
    const body = group.locator('.field-example-body').first();

    await expect(body).not.toHaveClass(/open/);
    await toggle.click();
    await expect(body).toHaveClass(/open/, { timeout: 3000 });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
