// @ts-check
// Coverage A3 — Login form 使用 supabase client SDK，驗證 happy / wrong-password /
// unknown-email 三條路徑。我們不打真實 Supabase API（避免 flake），而是 stub
// supabase.auth.signInWithPassword 並驗證 UI 行為。
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

async function gotoLogin(page) {
  await page.goto(BASE_URL + '/?onboarding=0');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.navigate && window.navigate('login'));
  await page.waitForSelector('#auth-form', { timeout: 5000 });
}

test.describe('Coverage A3 — Login via Supabase client SDK', () => {
  test('happy path: signInWithPassword 成功時不顯示錯誤', async ({ page }) => {
    await gotoLogin(page);
    await page.evaluate(() => {
      window.supabase.auth.signInWithPassword = async () => ({ data: { user: { id: 'u1' } }, error: null });
    });
    await page.fill('#email', 'good@example.com');
    await page.fill('#password', 'correctpassword');
    await page.click('#auth-form button[type="submit"]');
    await page.waitForTimeout(600);
    // 沒有錯誤顯示
    const errVisible = await page.locator('#auth-error').isVisible().catch(() => false);
    expect(errVisible).toBe(false);
  });

  test('wrong password: signInWithPassword 回 error 時 UI 顯示錯誤', async ({ page }) => {
    await gotoLogin(page);
    await page.evaluate(() => {
      window.supabase.auth.signInWithPassword = async () => ({ data: null, error: { message: 'Invalid login credentials' } });
    });
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('#auth-form button[type="submit"]');
    await page.waitForTimeout(600);
    // 錯誤訊息出現（auth-error 或 alert/吐司）
    await expect(page.locator('#auth-error')).toBeVisible();
    await expect(page.locator('#auth-error')).toContainText(/Invalid/i);
  });

  test('unknown email: error 訊息出現', async ({ page }) => {
    await gotoLogin(page);
    await page.evaluate(() => {
      window.supabase.auth.signInWithPassword = async () => ({ data: null, error: { message: 'User not found' } });
    });
    await page.fill('#email', 'nobody@example.com');
    await page.fill('#password', 'whatever');
    await page.click('#auth-form button[type="submit"]');
    await page.waitForTimeout(600);
    await expect(page.locator('#auth-error')).toBeVisible();
    await expect(page.locator('#auth-error')).toContainText(/User not found/i);
  });
});
