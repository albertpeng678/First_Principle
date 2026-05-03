// Path 2 · Plan B · Sub-bundle 1 — CIRCLES Home（mockup 01）
// BEM contract + 5-random + reshuffle + mode toggle + type tab.
// Source of truth: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/01-circles-home.html
const { test, expect } = require('@playwright/test');

test.describe('B1 CIRCLES Home', () => {

  test.beforeEach(async ({ page }) => {
    // Stub stats endpoint so renderStats has deterministic counts
    await page.route('**/api/circles-stats**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ completed: 12, active: 3, weeklyCompleted: 5 })
    }));
    // Stub history empty so offcanvas / recent-rail won't fetch real data
    await page.route('**/api/circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  });

  test('renders core sections: stats-strip / qa-row / mode-selector / search / type-tabs / q-list / reshuffle / nsm-promo', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.navbar');
    // home view by default (AppState.view === 'circles')
    await expect(page.locator('.stats-strip')).toBeVisible();
    await expect(page.locator('.qa-row')).toBeVisible();
    await expect(page.locator('.qa-row__title')).toHaveText('什麼是 CIRCLES 實戰訓練？');
    await expect(page.locator('.mode-selector')).toBeVisible();
    await expect(page.locator('.mode-card')).toHaveCount(2);
    await expect(page.locator('.search-wrap input[type="search"]')).toBeVisible();
    await expect(page.locator('.type-tabs')).toBeVisible();
    await expect(page.locator('.type-tab')).toHaveCount(3);
    await expect(page.locator('.q-list')).toBeVisible();
    await expect(page.locator('.reshuffle')).toBeVisible();
    await expect(page.locator('.nsm-promo')).toBeVisible();
  });

  test('q-list renders exactly 5 random qcards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qcard');
    const cards = page.locator('.qcard');
    expect(await cards.count()).toBe(5);
    // Each qcard has head with __num and __title, meta with mode-tag, and body
    for (let i = 0; i < 5; i++) {
      await expect(cards.nth(i).locator('.qcard__num')).toBeVisible();
      await expect(cards.nth(i).locator('.qcard__title')).toBeVisible();
      await expect(cards.nth(i).locator('.qcard__meta .mode-tag')).toBeVisible();
      await expect(cards.nth(i).locator('.qcard__body')).toBeVisible();
    }
  });

  test('default mode is simulation (mode-card[0] is-active, mode-tag--sim on cards)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-selector');
    await expect(page.locator('.mode-card').nth(0)).toHaveClass(/is-active/);
    await expect(page.locator('.mode-card').nth(1)).not.toHaveClass(/is-active/);
    // qcard meta should carry mode-tag--sim in default sim mode
    const tags = await page.locator('.qcard .mode-tag').first().getAttribute('class');
    expect(tags).toMatch(/mode-tag--sim/);
  });

  test('clicking mode-card[1] switches to drill mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-selector');
    await page.locator('.mode-card').nth(1).click();
    await expect(page.locator('.mode-card').nth(1)).toHaveClass(/is-active/);
    await expect(page.locator('.mode-card').nth(0)).not.toHaveClass(/is-active/);
    // qcard mode-tag should switch to drill variant
    const tags = await page.locator('.qcard .mode-tag').first().getAttribute('class');
    expect(tags).toMatch(/mode-tag--drill/);
  });

  test('default type tab is design ×40 active; type counts ×40 / ×35 / ×25 from CIRCLES_QUESTIONS', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.type-tabs');
    const tabs = page.locator('.type-tab');
    await expect(tabs.nth(0)).toHaveClass(/is-active/);
    await expect(tabs.nth(0)).toContainText('產品設計');
    await expect(tabs.nth(0)).toContainText('40');
    await expect(tabs.nth(1)).toContainText('產品改進');
    await expect(tabs.nth(1)).toContainText('35');
    await expect(tabs.nth(2)).toContainText('產品策略');
    await expect(tabs.nth(2)).toContainText('25');
  });

  test('clicking type-tab switches active and re-picks 5 cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.q-list');
    const before = await page.locator('.qcard__title').allTextContents();
    await page.locator('.type-tab').nth(1).click();
    await expect(page.locator('.type-tab').nth(1)).toHaveClass(/is-active/);
    await expect(page.locator('.type-tab').nth(0)).not.toHaveClass(/is-active/);
    const after = await page.locator('.qcard__title').allTextContents();
    expect(after.length).toBe(5);
    // Different titles likely (improve type subset). Don't assert disjoint (small chance of overlap),
    // just assert that the list re-rendered (count stable).
    expect(before).not.toEqual(after);
  });

  test('reshuffle button re-picks 5 cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.q-list');
    const before = await page.locator('.qcard__title').allTextContents();
    await page.locator('.reshuffle').click();
    await page.waitForTimeout(200);
    const after = await page.locator('.qcard__title').allTextContents();
    expect(after.length).toBe(5);
    expect(after).not.toEqual(before);
  });

  test('stats-strip shows numbers from API (12 / 3 / 5)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.stats-strip');
    await page.waitForFunction(() => {
      const nums = Array.from(document.querySelectorAll('.stats-strip__num')).map(n => n.textContent);
      return nums.includes('12') && nums.includes('3') && nums.includes('5');
    }, null, { timeout: 5000 });
    const nums = await page.locator('.stats-strip__num').allTextContents();
    expect(nums).toContain('12');
    expect(nums).toContain('3');
    expect(nums).toContain('5');
  });

  test('qa-row toggle opens/closes accordion body', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qa-row');
    // Default state per mockup: is-open
    await expect(page.locator('.qa-row')).toHaveClass(/is-open/);
    await page.locator('.qa-row__head').click();
    await expect(page.locator('.qa-row')).not.toHaveClass(/is-open/);
    await page.locator('.qa-row__head').click();
    await expect(page.locator('.qa-row')).toHaveClass(/is-open/);
  });

  test('nsm-promo CTA links / triggers nav to NSM', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.nsm-promo');
    await expect(page.locator('.nsm-promo__title')).toContainText('北極星');
    await page.locator('.nsm-promo__cta').click();
    // navigation should land on NSM view
    await expect(page.locator('[data-view="nsm"], .nsm-view, .nsm-step1')).toBeVisible();
  });
});
