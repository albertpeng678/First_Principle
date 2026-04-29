// tests/playwright/journeys/rt-toolbar-mobile.spec.js
// Spec 4 § 10 scenarios: mobile sticky-bottom toolbar, focus/blur, visualViewport

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

test.describe('rt-toolbar mobile', () => {
  test('mobile toolbar is hidden by default and present in DOM', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Desktop', 'Mobile-only behavior');
    await gotoFirstPhase1Field(page);
    const mobileBar = page.locator('#rt-toolbar-mobile');
    await expect(mobileBar).toHaveCount(1);
    const display = await mobileBar.evaluate(el => el.style.display || getComputedStyle(el).display);
    expect(['none', '']).toContain(display);
  });

  test('focusing rt-textarea shows mobile toolbar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Desktop', 'Mobile-only behavior');
    const ta = await gotoFirstPhase1Field(page);
    await ta.focus();
    const mobileBar = page.locator('#rt-toolbar-mobile');
    await expect(mobileBar).toHaveCSS('display', 'flex', { timeout: 2000 });
  });

  test('blur hides mobile toolbar after delay', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Desktop', 'Mobile-only behavior');
    const ta = await gotoFirstPhase1Field(page);
    await ta.focus();
    const mobileBar = page.locator('#rt-toolbar-mobile');
    await expect(mobileBar).toHaveCSS('display', 'flex', { timeout: 2000 });
    await ta.evaluate(el => el.blur());
    // wait > 200ms delay
    await page.waitForTimeout(400);
    const display = await mobileBar.evaluate(el => el.style.display);
    expect(display).toBe('none');
  });

  test('window.visualViewport handler is registered', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Desktop', 'Mobile-only behavior');
    await gotoFirstPhase1Field(page);
    // Verify rt module exposes a marker that visualViewport binding is set up
    const bound = await page.evaluate(() => !!(window.__rtMobileBound));
    expect(bound).toBe(true);
  });
});
