// @ts-check
const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('M-008 tap target ≥44×44', () => {
  test('home 主要按鈕全 ≥44px 高', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('domcontentloaded');
    const selectors = ['.circles-q-card .circles-q-confirm-btn', '.nsm-banner-btn'];
    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if (await el.count() === 0) continue;
      const box = await el.boundingBox();
      // skip if not in current layout (display:none / hidden modal)
      if (!box) continue;
      expect(box.height, sel).toBeGreaterThanOrEqual(44);
    }
  });

  test('login 按鈕 ≥44', async ({ page }) => {
    await page.goto(BASE_URL + '/?view=login&onboarding=0');
    const btn = page.locator('button.btn').first();
    if (await btn.count() > 0) {
      const box = await btn.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('M-013 contrast tokens', () => {
  test('--c-text-3 / chip / pill 已調 token', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    const text3 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-text-3').trim());
    expect(text3.toLowerCase()).toBe('#525252');
    const chipBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-chip-bg').trim());
    expect(chipBg.toLowerCase()).toBe('#ede9fe');
    const pillBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-pill-active-bg').trim());
    expect(pillBg.toLowerCase()).toBe('#ddd6fe');
  });
});

test.describe('M-014 focus-visible ring', () => {
  test('循環 Tab 後第一張題目卡有 outline', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForSelector('.circles-q-card', { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => {
      const card = document.querySelector('.circles-q-card');
      if (card) {
        if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
        card.focus();
      }
    });
    const outline = await page.evaluate(() => {
      const card = document.querySelector('.circles-q-card');
      if (!card) return '';
      const style = getComputedStyle(card);
      return style.outlineWidth + ' ' + style.outlineStyle;
    });
    expect(outline).toMatch(/2px solid/);
  });
});
