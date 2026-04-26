// tests/playwright/journeys/circles-phase1.spec.js
// Journey: Select question → Phase 1 (framework fill) → submit → Phase 1.5 gate

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('CIRCLES Phase 1 Journey', () => {
  test('select question, fill framework, submit to gate', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    const issues = [];
    const consoleErrors = collectConsoleErrors(page);

    await page.goto('/');
    await page.waitForSelector('.circles-q-card', { timeout: 10000 });

    // Click first question card
    await page.locator('.circles-q-card').first().click();

    // Phase 1: framework fields must appear
    await page.waitForSelector('.circles-field-input', { timeout: 10000 });

    const fields = page.locator('.circles-field-input');
    const fieldCount = await fields.count();
    expect(fieldCount).toBeGreaterThan(0);

    // Fill all fields
    for (let i = 0; i < fieldCount; i++) {
      await fields.nth(i).fill('測試回答，填入足夠的內容以通過基本長度要求。');
    }

    // 💡 hint buttons may exist if hint feature is enabled (optional)
    // Not asserting count — feature presence varies by branch

    // Submit bar has submit button
    const submitBtn = page.locator('#circles-p1-submit');
    await expect(submitBtn).toBeVisible();

    // 回首頁 button in nav bar
    const homeBtn = page.locator('#circles-p1-home');
    await expect(homeBtn).toBeVisible();

    // Submit → Phase 1.5 gate (AI call — allow up to 30s)
    await submitBtn.click();
    await page.waitForSelector('.circles-gate-wrap', { timeout: 30000 });

    // Gate result renders (pass or error cards)
    const gateWrap = page.locator('.circles-gate-wrap');
    await expect(gateWrap).toBeVisible();

    // Proceed button (圓形 gate returns pass or error, but always has a proceed option)
    const proceedBtn = page.locator('#circles-gate-proceed, #circles-gate-fix');
    await expect(proceedBtn.first()).toBeVisible();

    // Page health
    const healthIssues = await checkPageHealth(page);
    for (const hi of healthIssues) {
      issues.push(createIssue('circles-phase1', device, 'phase1', hi.type, hi.detail));
    }
    const critical = consoleErrors.filter(e => !e.includes('supabase') && !e.includes('net::ERR'));
    if (critical.length > 0) {
      issues.push(createIssue('circles-phase1', device, 'console', 'js-error', critical.join(' | ')));
    }
    if (issues.length > 0) console.warn('\n' + formatIssues(issues));
    expect(issues.filter(i => i.type === 'overflow')).toHaveLength(0);
  });

  test('回首頁 from phase 1 returns to CIRCLES home', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-q-card', { timeout: 10000 });
    await page.locator('.circles-q-card').first().click();
    await page.waitForSelector('.circles-field-input', { timeout: 10000 });

    // Click 回首頁
    await page.click('#circles-p1-home');

    // Back at CIRCLES home
    await page.waitForSelector('.circles-mode-card', { timeout: 5000 });
    const modeCards = page.locator('.circles-mode-card');
    expect(await modeCards.count()).toBe(2);
  });

  test('💡 hint overlay opens and closes (if feature present)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-q-card', { timeout: 10000 });
    await page.locator('.circles-q-card').first().click();
    await page.waitForSelector('.circles-field-input', { timeout: 10000 });

    // Feature may not be present in all branches
    const hintBtns = page.locator('.circles-hint-trigger');
    if (await hintBtns.count() === 0) {
      console.log('[SKIP] circles-hint-trigger not found — hint feature not in this branch');
      return;
    }

    await hintBtns.first().click();
    await page.waitForSelector('.circles-hint-overlay', { timeout: 5000 });
    await expect(page.locator('.circles-hint-overlay')).toBeVisible();

    await page.click('.circles-hint-close');
    await page.waitForSelector('.circles-hint-overlay', { state: 'detached', timeout: 3000 });
  });

  test('back button from phase 1 returns to CIRCLES home', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-q-card', { timeout: 10000 });
    await page.locator('.circles-q-card').first().click();
    await page.waitForSelector('#circles-p1-back', { timeout: 10000 });

    await page.click('#circles-p1-back');
    await page.waitForSelector('.circles-mode-card', { timeout: 5000 });
  });
});
