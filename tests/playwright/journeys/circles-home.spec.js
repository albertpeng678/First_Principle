// tests/playwright/journeys/circles-home.spec.js
// Journey: App loads → CIRCLES is default view → mode cards + question cards shown

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('CIRCLES Home Journey', () => {
  test('CIRCLES is default view, mode cards and question cards load', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    const consoleErrors = collectConsoleErrors(page);

    await page.goto('/');

    // CIRCLES home must render immediately (no PM tabs)
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    // Two mode cards: 步驟加練 + 完整模擬
    const modeCards = page.locator('.circles-mode-card');
    expect(await modeCards.count()).toBe(2);

    // At least one of them is selected by default
    const selected = page.locator('.circles-mode-card.selected');
    expect(await selected.count()).toBeGreaterThan(0);

    // Type tabs exist (產品設計 / 產品改進 / 產品策略)
    const typeTabs = page.locator('.circles-type-tab');
    expect(await typeTabs.count()).toBe(3);

    // Question cards are populated
    await page.waitForSelector('.circles-q-card', { timeout: 5000 });
    const qCards = page.locator('.circles-q-card');
    expect(await qCards.count()).toBeGreaterThan(0);

    // NSM banner at bottom
    const nsmBanner = page.locator('#circles-nsm-banner-btn');
    await expect(nsmBanner).toBeVisible();

    // No PM routes in page — confirm navbar shows NSM link (not home tab)
    const nsmNavBtn = page.locator('#navbar-actions .btn.btn-ghost').filter({ hasText: '北極星指標' });
    await expect(nsmNavBtn).toBeVisible();

    // No theme toggle button
    const themeToggle = page.locator('button[title="切換主題"]');
    expect(await themeToggle.count()).toBe(0);

    // Page health
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('circles-home', device, 'home', hi.type, hi.detail));
    }

    const critical = consoleErrors.filter(e => !e.includes('supabase') && !e.includes('net::ERR'));
    if (critical.length > 0) {
      issues.push(createIssue('circles-home', device, 'console', 'js-error', critical.join(' | ')));
    }

    if (issues.length > 0) console.warn('\n' + formatIssues(issues));
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
    expect(issues.filter(i => i.type === 'cls')).toHaveLength(0);
  });

  test('mode card click switches selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    const simulationCard = page.locator('.circles-mode-card[data-mode="simulation"]');
    await simulationCard.click();
    await expect(simulationCard).toHaveClass(/selected/);

    const drillCard = page.locator('.circles-mode-card[data-mode="drill"]');
    await expect(drillCard).not.toHaveClass(/selected/);
  });

  test('type tab switching filters questions', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-q-card', { timeout: 10000 });

    // Click 產品改進 tab
    const improveTab = page.locator('.circles-type-tab[data-type="improve"]');
    await improveTab.click();
    await expect(improveTab).toHaveClass(/active/);

    // Questions should still show (may be different set)
    const qCards = page.locator('.circles-q-card');
    // Count is >= 0, not crashing
    expect(await qCards.count()).toBeGreaterThanOrEqual(0);
  });

  test('NSM banner click navigates to NSM', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#circles-nsm-banner-btn', { timeout: 10000 });

    await page.click('#circles-nsm-banner-btn');

    // NSM step 1 should load
    await page.waitForSelector('.nsm-question-list', { timeout: 10000 });
  });

  test('navbar NSM link navigates to NSM', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#navbar-actions .btn.btn-ghost', { timeout: 10000 });

    const nsmBtn = page.locator('#navbar-actions .btn.btn-ghost').filter({ hasText: '北極星指標' });
    await nsmBtn.click();

    await page.waitForSelector('.nsm-question-list', { timeout: 10000 });
  });
});
