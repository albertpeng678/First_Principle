const { test, expect } = require('@playwright/test');
test('css tokens resolve to expected values', async ({ page }) => {
  await page.goto('http://localhost:4000/');
  const cssVars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      primary: cs.getPropertyValue('--c-primary').trim(),
      bg: cs.getPropertyValue('--c-bg').trim(),
      text: cs.getPropertyValue('--c-text').trim(),
      success: cs.getPropertyValue('--c-success').trim(),
      nsm: cs.getPropertyValue('--c-nsm').trim(),
    };
  });
  expect(cssVars.primary).toBe('#1A56DB');
  expect(cssVars.bg).toBe('#F2F0EB');
  expect(cssVars.text).toBe('#1F1D1B');
  expect(cssVars.success).toBe('#10b981');
  expect(cssVars.nsm).toBe('#7C3AED');
});
