// @ts-check
const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test('M-022 — 全站使用 --c-font-sans token (Wave D D-5: system-ui chain)', async ({ page }) => {
  await page.goto(BASE_URL + '/?onboarding=0');
  const fontToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--c-font-sans').trim());
  // Wave D D-5: token 改為 system-ui 起頭、CJK fallback chain
  expect(fontToken.toLowerCase()).toContain('system-ui');
  expect(fontToken.toLowerCase()).toContain('pingfang');
});

test('M-022 — body font-family 用 token，system-ui 為先', async ({ page }) => {
  await page.goto(BASE_URL + '/?onboarding=0');
  const samples = ['body', '.circles-q-card', 'button.btn'];
  for (const sel of samples) {
    const ff = await page.evaluate((s) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el).fontFamily : null;
    }, sel);
    if (ff !== null) {
      const lower = ff.toLowerCase();
      // computed font-family 應包含 system-ui 或 OS-resolved 的等價物
      // (system-ui 在 Chrome/Safari 會 resolve，但 token 字面值仍可見)
      expect(lower.includes('system-ui') || lower.includes('-apple-system') || lower.includes('pingfang')).toBe(true);
      // 不應 'DM Sans' 為先
      expect(lower.startsWith('"dm sans"')).toBe(false);
    }
  }
});

test('M-023 — inline hex 殘留量 < 5 (容許 instrument-serif/grade 等保留)', async ({ page, request }) => {
  const html = await (await request.get(BASE_URL + '/app.js')).text();
  const matches = html.match(/style="[^"]*#[0-9a-fA-F]{3,6}/g) || [];
  expect(matches.length).toBeLessThan(5);
});
