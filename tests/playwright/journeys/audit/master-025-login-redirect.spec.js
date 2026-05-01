// @ts-check
// MASTER-025 — 登入成功後若 view 還停在 'login'/'register'，
// onAuthStateChange 必須把 view 切回 'circles'，不要把使用者卡在
// 已 unmount 的 auth-form 上。
//
// 目前實作（public/app.js:802-814）只重新渲染 AppState.view，
// 因此 SIGNED_IN 後仍是 'login' 視圖；fix 後 SIGNED_IN 應自動換 view。
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('MASTER-025 登入成功跳首頁', () => {
  test('SIGNED_IN 在 login view 觸發時應切回 circles', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('networkidle');

    // 走到 login 畫面
    await page.evaluate(() => window.navigate && window.navigate('login'));
    await page.waitForSelector('#auth-form', { timeout: 5000 });

    // 模擬 supabase auth.onAuthStateChange('SIGNED_IN', session) 被觸發
    // 不依賴真實 supabase API；直接呼叫 callback。
    await page.evaluate(() => {
      // supabase 內部會把 listener 收進 GoTrueClient；
      // 為避免依賴內部結構，直接把 AppState.view 應做的轉換經由 onAuthStateChange 邏輯路徑驗證——
      // 我們複製產線的 listener 觸發語意：模擬 session 物件，再透過 supabase.auth 內部 dispatch。
      const sb = window.supabase || (window.AppState && window.AppState.supabase);
      // 沒有 sb 時用 fake session 直接驅動 listener subject
      // 大多數情況下 supabase.auth._notifyAllSubscribers 存在
      const fakeSession = { access_token: 'test-token', user: { id: 'test-uid' } };
      try {
        if (sb && sb.auth && typeof sb.auth._notifyAllSubscribers === 'function') {
          sb.auth._notifyAllSubscribers('SIGNED_IN', fakeSession);
        }
      } catch (_) { /* ignore */ }
    });

    // 給 render() 一點時間
    await page.waitForTimeout(800);

    // 預期：view 切到 'circles'，auth-form 不再可見
    const view = await page.evaluate(() => (window.AppState && window.AppState.view) || document.body.dataset.view);
    expect(view, 'AppState.view 應在 SIGNED_IN 後從 login 切回 circles').toBe('circles');
    await expect(page.locator('#auth-form')).toHaveCount(0);
  });

  test('SIGNED_IN 在 register view 觸發時應切回 circles', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => window.navigate && window.navigate('register'));
    await page.waitForSelector('#auth-form', { timeout: 5000 });

    await page.evaluate(() => {
      const sb = window.supabase || (window.AppState && window.AppState.supabase);
      const fakeSession = { access_token: 'test-token', user: { id: 'test-uid' } };
      try {
        if (sb && sb.auth && typeof sb.auth._notifyAllSubscribers === 'function') {
          sb.auth._notifyAllSubscribers('SIGNED_IN', fakeSession);
        }
      } catch (_) {}
    });

    await page.waitForTimeout(800);

    const view = await page.evaluate(() => (window.AppState && window.AppState.view) || document.body.dataset.view);
    expect(view, 'AppState.view 應在 SIGNED_IN 後從 register 切回 circles').toBe('circles');
    await expect(page.locator('#auth-form')).toHaveCount(0);
  });

  test('SIGNED_IN 在 circles view 觸發時不應改 view', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('networkidle');

    // 確認在 circles
    const initView = await page.evaluate(() => window.AppState && window.AppState.view);
    expect(initView).toBe('circles');

    await page.evaluate(() => {
      const sb = window.supabase || (window.AppState && window.AppState.supabase);
      const fakeSession = { access_token: 'test-token', user: { id: 'test-uid' } };
      try {
        if (sb && sb.auth && typeof sb.auth._notifyAllSubscribers === 'function') {
          sb.auth._notifyAllSubscribers('SIGNED_IN', fakeSession);
        }
      } catch (_) {}
    });

    await page.waitForTimeout(500);
    const view = await page.evaluate(() => window.AppState && window.AppState.view);
    expect(view).toBe('circles');
  });
});
