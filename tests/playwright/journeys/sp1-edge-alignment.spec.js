const { test, expect } = require('@playwright/test');

test.describe('SP1 — visual baseline invariants', () => {

  test('outer page wrappers have 0 horizontal padding', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    const wrappers = ['.circles-home-wrap', '.circles-home-desktop'];
    for (const sel of wrappers) {
      if (await page.locator(sel).count() === 0) continue;
      const padding = await page.locator(sel).first().evaluate(el => {
        const cs = getComputedStyle(el);
        return { left: cs.paddingLeft, right: cs.paddingRight };
      });
      expect(padding.left).toBe('0px');
      expect(padding.right).toBe('0px');
    }
  });

  test('no element on home uses Instrument Serif', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    const serifElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => {
        const ff = getComputedStyle(el).fontFamily;
        // Allow generic 'serif' as final fallback in stack
        return /Instrument Serif|Georgia|Times/i.test(ff);
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
    const targets = ['.circles-nav', '.qchip', '.problem-card', '.circles-q-card'];
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
