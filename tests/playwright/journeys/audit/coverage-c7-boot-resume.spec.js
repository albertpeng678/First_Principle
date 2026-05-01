// @ts-check
// Coverage C7 — Boot-time auto-resume：lastSessionId 在 localStorage 時，
// CIRCLES draft 應走 resume banner（live path），不能讓使用者掉進 legacy
// practice view。
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('Coverage C7 — Boot resume CIRCLES does not regress to legacy practice', () => {
  test('lastSessionId set + active CIRCLES draft → resume banner (live path)；view 應為 circles', async ({ page }) => {
    // 預先在 origin 上 seed localStorage：先用首頁 navigate 一次再 set
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.evaluate(() => {
      localStorage.setItem('lastSessionId', '00000000-0000-0000-0000-000000000abc');
    });
    // 重整：boot 路徑會走 init() — 對 guest 模式 lastId 分支由於
    // `AppState.mode === 'auth'` guard 而不會打 fetch（防止 legacy practice），
    // 因此使用者應該看到 CIRCLES 首頁，而不是 practice view。
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);

    const view = await page.evaluate(() => window.AppState && window.AppState.view);
    expect(view, 'CIRCLES boot 不可掉進 legacy practice').not.toBe('practice');
    expect(view).toBe('circles');
  });

  test('沒有 lastSessionId 時 boot 直接停在 CIRCLES 首頁', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.evaluate(() => {
      localStorage.removeItem('lastSessionId');
    });
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('networkidle');
    const view = await page.evaluate(() => window.AppState && window.AppState.view);
    expect(view).toBe('circles');
  });

  test('boot 時 confirm 對話框不應跳出（CIRCLES 路徑無 legacy prompt）', async ({ page }) => {
    let confirmFired = false;
    page.on('dialog', async (d) => {
      if (d.type() === 'confirm' && /繼續上次的練習/.test(d.message())) {
        confirmFired = true;
      }
      await d.dismiss().catch(() => {});
    });

    await page.goto(BASE_URL + '/?onboarding=0');
    await page.evaluate(() => {
      localStorage.setItem('lastSessionId', '00000000-0000-0000-0000-000000000abc');
    });
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    expect(confirmFired, 'CIRCLES boot 不應觸發 legacy practice confirm prompt').toBe(false);
  });
});
