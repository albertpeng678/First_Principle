// tests/playwright/journeys/rt-toolbar-ime.spec.js
// Spec 4 § 7.3: IME composition must suppress keyboard shortcuts (Ctrl+B, Tab, Enter handlers)

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

test.describe('rt-toolbar IME suppression', () => {
  test('Ctrl+B during compositionstart does not wrap text', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Keyboard shortcut is desktop only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.fill('abc');
    await ta.evaluate(el => { el.setSelectionRange(0, 3); el.dispatchEvent(new CompositionEvent('compositionstart')); });
    await page.keyboard.press('Control+b');
    // While composing, our handler should early-return — value remains 'abc'
    expect(await ta.inputValue()).toBe('abc');
    // End composition; now Ctrl+B should work
    await ta.evaluate(el => { el.dispatchEvent(new CompositionEvent('compositionend')); el.setSelectionRange(0, 3); });
    await page.keyboard.press('Control+b');
    expect(await ta.inputValue()).toBe('**abc**');
  });

  test('Enter on bullet line during composition does not auto-continue bullet', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop', 'Keyboard shortcut is desktop only');
    const ta = await gotoFirstPhase1Field(page);
    await ta.click();
    await ta.evaluate(el => {
      el.value = '- one';
      el.setSelectionRange(el.value.length, el.value.length);
      el.dispatchEvent(new CompositionEvent('compositionstart'));
    });
    // simulate Enter via keyboard event dispatch (key handler should bail)
    await ta.evaluate(el => {
      const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    });
    // Value should remain unchanged because composing flag was set
    expect(await ta.inputValue()).toBe('- one');
  });
});
