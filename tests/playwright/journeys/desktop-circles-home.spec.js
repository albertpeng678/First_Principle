// tests/playwright/journeys/desktop-circles-home.spec.js
// Phase 4.1: CIRCLES home desktop layout
const { test, expect } = require('@playwright/test');

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 667 };
const BASE_URL = process.env.PMD_BASE_URL || 'http://localhost:4000';

async function gotoCirclesHome(page) {
  await page.goto(BASE_URL + '/?guest=1');
  await page.waitForSelector('#app', { state: 'attached' });
  // Wait for circles render
  await page.waitForFunction(() => {
    return document.querySelector('.circles-home-desktop, .circles-home-wrap');
  }, { timeout: 5000 });
}

test.describe('Phase 4.1 desktop CIRCLES home', () => {
  test('desktop renders .circles-home-desktop container at 1280', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoCirclesHome(page);
    const container = page.locator('.circles-home-desktop');
    await expect(container).toHaveCount(1);
    const maxW = await container.evaluate(el => getComputedStyle(el).maxWidth);
    expect(maxW).toMatch(/1180px/);
  });

  test('desktop has 3-column grid: left rail / center / right rail', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoCirclesHome(page);
    const grid = page.locator('.circles-home-desktop .ch-grid');
    await expect(grid).toHaveCount(1);
    const cols = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    // 3 columns
    expect(cols.split(' ').length).toBeGreaterThanOrEqual(3);
  });

  test('desktop left rail has mode-section and type-section', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoCirclesHome(page);
    await expect(page.locator('.circles-home-desktop .mode-section')).toHaveCount(1);
    await expect(page.locator('.circles-home-desktop .type-section')).toHaveCount(1);
  });

  test('desktop right rail has recent area and NSM banner', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoCirclesHome(page);
    await expect(page.locator('.circles-home-desktop .right-rail')).toHaveCount(1);
    await expect(page.locator('.circles-home-desktop .nsm-banner')).toHaveCount(1);
  });

  test('desktop center has q-list', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoCirclesHome(page);
    await expect(page.locator('.circles-home-desktop .circles-q-list, .circles-home-desktop .q-list')).not.toHaveCount(0);
  });

  test('mobile (375) does NOT use desktop container — regression', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await gotoCirclesHome(page);
    await expect(page.locator('.circles-home-desktop')).toHaveCount(0);
    await expect(page.locator('.circles-home-wrap')).toHaveCount(1);
  });

  test('no JS console errors on desktop circles home', async ({ page }) => {
    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error' && !/Failed to load resource|404/.test(m.text())) errors.push(m.text());
    });
    await page.setViewportSize(DESKTOP);
    await gotoCirclesHome(page);
    expect(errors).toEqual([]);
  });
});
