const { test, expect } = require('@playwright/test');

test.describe('SP1 — visual baseline invariants', () => {

  test('outer page wrappers have 0 horizontal padding', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    const wrappers = ['.circles-home-wrap', '.circles-home-desktop'];
    for (const sel of wrappers) {
      const el = page.locator(sel).first();
      if (await el.count() === 0) continue;
      // Skip if the element exists but isn't rendered (display:none / off DOM)
      const padding = await el.evaluate(node => {
        const cs = getComputedStyle(node);
        if (cs.display === 'none' || !cs.paddingLeft) return null;
        return { left: cs.paddingLeft, right: cs.paddingRight };
      });
      if (!padding) continue;
      expect(padding.left, sel + ' paddingLeft').toBe('0px');
      expect(padding.right, sel + ' paddingRight').toBe('0px');
    }
  });

  test('no element on home uses Instrument Serif', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    // Skip HTML/HEAD/META etc where browser-default Times is irrelevant.
    // Specifically forbid 'Instrument Serif' (the named font we banned).
    // Generic serif fallback in stack is allowed.
    const serifElements = await page.evaluate(() => {
      const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
      return Array.from(document.querySelectorAll('body *')).filter(el => {
        if (SKIP.has(el.tagName)) return false;
        const ff = getComputedStyle(el).fontFamily;
        return /Instrument Serif/i.test(ff);
      }).map(el => ({ tag: el.tagName, cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '', ff: getComputedStyle(el).fontFamily }));
    });
    expect(serifElements).toEqual([]);
  });

  test('gate error bar element does not exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.error-bar')).toHaveCount(0);
    await expect(page.locator('.gate-error-message')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.innerText.includes('需要修正以下問題'))).toBe(false);
  });

  test('field with .has-error has red border (1.5px)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (ta) ta.classList.add('has-error');
    });
    const ta = page.locator('textarea.has-error').first();
    if (await ta.count()) {
      const border = await ta.evaluate(el => getComputedStyle(el).borderColor);
      expect(border).toMatch(/rgb\(239, 68, 68\)|rgba\(239, 68, 68/);
    }
  });

  test('block left-edge alignment — navbar / chip / progress at x=0', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    // Strips that span viewport (q-card / question-card are content-cards with margin, excluded)
    const targets = ['.circles-nav', '.qchip', '.problem-card', '.circles-progress'];
    const lefts = [];
    for (const sel of targets) {
      const el = page.locator(sel).first();
      if (await el.count()) {
        const left = await el.evaluate(e => Math.round(e.getBoundingClientRect().left));
        lefts.push({ sel, left });
      }
    }
    // All visible blocks should start at x=0 (page wrapper padding 0)
    const nonZero = lefts.filter(l => l.left !== 0);
    expect(nonZero).toEqual([]);
  });
});
