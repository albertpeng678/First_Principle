// tests/playwright/journeys/rt-toolbar-bold.spec.js
// Spec 4 § 10 scenario: Bold action via click, Ctrl+B, and select-then-bold

const { test, expect } = require('@playwright/test');

async function gotoFirstPhase1Field(page) {
  await page.goto('/');
  await page.waitForSelector('.circles-q-card', { timeout: 10000 });
  await page.locator('.circles-q-card').first().click();
  await page.waitForSelector('textarea.rt-textarea', { timeout: 10000 });
  return page.locator('textarea.rt-textarea').first();
}

test.describe('rt-toolbar bold', () => {
  test('clicking B with no selection inserts **|** with caret in middle', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.fill('');
    // Find toolbar within same .rt-field
    const boldBtn = page.locator('.rt-field').first().locator('.rt-tbtn[data-rt-action="bold"]');
    await boldBtn.click();
    const value = await ta.inputValue();
    expect(value).toBe('****');
    const caret = await ta.evaluate(el => el.selectionStart);
    expect(caret).toBe(2);
  });

  test('selecting text then clicking B wraps with **', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.fill('hello world');
    await ta.evaluate(el => { el.setSelectionRange(0, 5); });
    const boldBtn = page.locator('.rt-field').first().locator('.rt-tbtn[data-rt-action="bold"]');
    await boldBtn.click();
    const value = await ta.inputValue();
    expect(value).toBe('**hello** world');
  });

  test('Ctrl+B wraps selection', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Desktop inline toolbar only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.fill('foo bar');
    await ta.evaluate(el => { el.setSelectionRange(4, 7); });
    await page.keyboard.press('Control+b');
    const value = await ta.inputValue();
    expect(value).toBe('foo **bar**');
  });
});
