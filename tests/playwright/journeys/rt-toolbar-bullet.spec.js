// tests/playwright/journeys/rt-toolbar-bullet.spec.js
// Spec 4 § 10 scenarios: bullet toggle, Tab indent, Enter continuation, empty exit

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

test.describe('rt-toolbar bullet', () => {
  test('列點 button toggles "- " on current line', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.fill('first item');
    await ta.evaluate(el => { el.setSelectionRange(el.value.length, el.value.length); });
    const bulletBtn = page.locator('.rt-field').first().locator('.rt-tbtn[data-rt-action="bullet"]');
    await bulletBtn.click();
    expect(await ta.inputValue()).toBe('- first item');
    // Toggle off
    await bulletBtn.click();
    expect(await ta.inputValue()).toBe('first item');
  });

  test('Tab indents bullet line by 2 spaces; Shift+Tab outdents', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.evaluate(el => { el.value = '- item'; el.setSelectionRange(el.value.length, el.value.length); });
    await page.keyboard.press('Tab');
    expect(await ta.inputValue()).toBe('  - item');
    await page.keyboard.press('Shift+Tab');
    expect(await ta.inputValue()).toBe('- item');
  });

  test('Enter on bullet line continues with new "- "', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.evaluate(el => { el.value = '- one'; el.setSelectionRange(el.value.length, el.value.length); });
    await page.keyboard.press('Enter');
    const value = await ta.inputValue();
    expect(value).toBe('- one\n- ');
  });

  test('Enter on empty bullet line exits bullet mode', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.evaluate(el => { el.value = '- one\n- '; el.setSelectionRange(el.value.length, el.value.length); });
    await page.keyboard.press('Enter');
    const value = await ta.inputValue();
    expect(value).toBe('- one\n');
  });
});
