// UAT Fix — NSM Step 1 search: Bug 1 (focus/caret loss) + Bug 2 (clear-search no-op)
// Search input is only rendered in nsm-desktop-shell (Desktop-1280+).
// Tests run against Desktop-1280 only; other viewports skipped.
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const DESKTOP_ONLY = ['Desktop-1280', 'Desktop-1440', 'Desktop-2560'];

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function goToNSMStep1(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('circles_onboarding_done', '1'); } catch (_) {}
  });
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.locator('[data-nav="nsm"]').first().click();
  await page.waitForSelector('[data-nsm-step="1"]', { timeout: 5000 });
  await page.waitForTimeout(200);
}

test.describe('NSM Step 1 Search — Bug 1 focus/caret + Bug 2 clear-search', () => {
  fs.mkdirSync('audit/png-uat-fix', { recursive: true });

  test('Bug 1: typing 3 chars keeps focus + caret at position 3', async ({ page }, testInfo) => {
    if (!DESKTOP_ONLY.includes(testInfo.project.name)) return;
    await setupRoutes(page);
    await goToNSMStep1(page);

    const searchInput = page.locator('[data-nsm="search"]').first();
    await searchInput.click();

    // Type 3 characters one by one (triggers render() each time)
    await searchInput.pressSequentially('abc', { delay: 50 });

    // Focus must still be on the search input after 3 renders
    const isFocused = await page.evaluate(() => {
      const el = document.querySelector('[data-nsm="search"]');
      return document.activeElement === el;
    });
    expect(isFocused).toBe(true);

    // Caret must be at position 3 (end of "abc")
    const caretPos = await page.evaluate(() => {
      const el = document.querySelector('[data-nsm="search"]');
      return el ? el.selectionStart : -1;
    });
    expect(caretPos).toBe(3);

    // Input value must be "abc"
    await expect(searchInput).toHaveValue('abc');

    await page.screenshot({
      path: `audit/png-uat-fix/issue-AB-search-bugs-${testInfo.project.name}-focused.png`,
      fullPage: true,
    });
  });

  test('Bug 2: type no-match query then clear-search restores card list', async ({ page }, testInfo) => {
    if (!DESKTOP_ONLY.includes(testInfo.project.name)) return;
    await setupRoutes(page);
    await goToNSMStep1(page);

    const searchInput = page.locator('[data-nsm="search"]').first();

    // Type a query that matches nothing
    await searchInput.fill('ngg_no_match_xyz');
    await searchInput.dispatchEvent('input');
    await page.waitForTimeout(200);

    // Verify empty-state appeared in desktop shell
    const desktopEmptyState = page.locator('.nsm-desktop-shell .nsm-empty-search');
    await expect(desktopEmptyState).toBeVisible();

    await page.screenshot({
      path: `audit/png-uat-fix/issue-AB-search-bugs-${testInfo.project.name}-empty-state.png`,
      fullPage: true,
    });

    // Click 清除搜尋 inside desktop shell
    const clearBtn = page.locator('.nsm-desktop-shell [data-action="clear-search"]').first();
    await clearBtn.click();
    await page.waitForTimeout(200);

    // AppState.nsmSearchText must be cleared
    const searchText = await page.evaluate(() => window.AppState ? window.AppState.nsmSearchText : '__undefined__');
    expect(searchText).toBe('');

    // Empty-state must be gone from desktop shell
    await expect(desktopEmptyState).not.toBeVisible();

    // Card list must have 5 visible cards again
    const visibleCards = page.locator('.nsm-desktop-shell .nsm-q-card').filter({ visible: true });
    await expect(visibleCards).toHaveCount(5);

    // Search input must be cleared
    await expect(searchInput).toHaveValue('');

    await page.screenshot({
      path: `audit/png-uat-fix/issue-AB-search-bugs-${testInfo.project.name}-cleared.png`,
      fullPage: true,
    });
  });
});
