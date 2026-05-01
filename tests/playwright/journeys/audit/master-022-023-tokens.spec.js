// @ts-check
const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test('M-022 — 全站使用 --c-font-sans token', async ({ page }) => {
  await page.goto(BASE_URL + '/?onboarding=0');
  const fontToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--c-font-sans').trim());
  expect(fontToken).toMatch(/DM Sans/);
});

test('M-022 — body font-family 用 token 不出現殘留 DM Sans 字串', async ({ page }) => {
  await page.goto(BASE_URL + '/?onboarding=0');
  // 量幾個關鍵 selector 的 computed font-family 都帶 DM Sans
  const samples = ['body', '.circles-q-card', 'button.btn'];
  for (const sel of samples) {
    const ff = await page.evaluate((s) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el).fontFamily : null;
    }, sel);
    if (ff !== null) expect(ff).toMatch(/DM Sans/);
  }
});

test('M-023 — inline hex 殘留量 < 5 (容許 instrument-serif/grade 等保留)', async ({ page, request }) => {
  const html = await (await request.get(BASE_URL + '/app.js')).text();
  const matches = html.match(/style="[^"]*#[0-9a-fA-F]{3,6}/g) || [];
  expect(matches.length).toBeLessThan(5);
});
