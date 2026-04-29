// tests/playwright/journeys/rt-toolbar-active-state.spec.js
// Spec 4 § 3.4: B button gets .active class when caret is inside **...**

const { test, expect } = require('@playwright/test');

async function gotoFirstPhase1Field(page) {
  await page.goto('/');
  await page.waitForSelector('.circles-q-card', { timeout: 10000 });
  await page.evaluate(() => {
    const list = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : []);
    const q = list[0];
    if (!q) throw new Error('CIRCLES_QUESTIONS empty');
    window.AppState.circlesSelectedQuestion = q;
    window.AppState.circlesSession = null;
    window.AppState.circlesPhase = 1;
    window.AppState.circlesFrameworkDraft = {};
    window.AppState.circlesGateResult = null;
    window.AppState.circlesConversation = [];
    window.AppState.circlesScoreResult = null;
    window.AppState.circlesSimStep = 0;
    window.AppState.circlesMode = 'simulation';
    window.render();
  });
  await page.waitForSelector('textarea.rt-textarea', { timeout: 10000 });
  return page.locator('textarea.rt-textarea').first();
}

test.describe('rt-toolbar active state (B button)', () => {
  test('B button is active when caret is inside **bold** region', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.fill('hi **bold** there');
    // Place caret inside the bold word (between b and o → index 6)
    await ta.evaluate(el => { el.setSelectionRange(6, 6); el.dispatchEvent(new Event('input', { bubbles:true })); });
    const boldBtn = page.locator('.rt-field').first().locator('.rt-tbtn[data-rt-action="bold"]');
    await expect(boldBtn).toHaveClass(/active/);
  });

  test('B button is not active when caret is outside bold region', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.fill('hi **bold** there');
    await ta.evaluate(el => { el.setSelectionRange(0, 0); el.dispatchEvent(new Event('input', { bubbles:true })); });
    const boldBtn = page.locator('.rt-field').first().locator('.rt-tbtn[data-rt-action="bold"]');
    const cls = await boldBtn.getAttribute('class');
    expect(cls || '').not.toMatch(/\bactive\b/);
  });
});
