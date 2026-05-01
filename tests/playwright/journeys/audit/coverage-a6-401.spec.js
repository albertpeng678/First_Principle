// @ts-check
// Coverage A6 — Mid-call 401: app.js 目前沒有全域 401 interceptor。
// 本 spec 透過 page.route 把 PATCH /progress 強制改為 401，輸入文字觸發 autosave，
// 確認本機草稿仍被 saveCirclesDraftToLocal 寫入 localStorage 而沒有靜默掉。
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

async function gotoStepC(page) {
  await page.goto(BASE_URL + '/?onboarding=0');
  await page.waitForLoadState('networkidle');
  await page.locator('.circles-q-card').first().click();
  await page.locator('.circles-q-confirm-btn').first().click();
  await page.waitForSelector('#circles-p1-submit', { timeout: 10000 });
}

test.describe('Coverage A6 — Mid-call 401 not silently lost', () => {
  test('progress PATCH 被 401 時 .save-indicator 顯示異常 + 草稿落本機', async ({ page }) => {
    const block401 = (r) =>
      r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) });
    await page.route('**/api/guest-circles-sessions/**/progress', block401);
    await page.route('**/api/circles-sessions/**/progress', block401);

    await gotoStepC(page);

    const ta = page.locator('textarea').first();
    await ta.fill('A6 coverage — 401 fallback ' + Date.now());
    // 等 autosave debounce + flush
    await page.waitForTimeout(2500);

    // 預期：save-indicator 不該停在「儲存中」永久轉圈，而是 error / offline 文案
    const saveText = await page.locator('.save-indicator').first().innerText().catch(() => '');
    expect(saveText, 'save-indicator 應顯示錯誤 / 離線提示，不能假裝成功').toMatch(/未連線|本機|錯誤|失敗|offline|error|重試/i);

    // 同時：本機 draft 已落 localStorage，使用者輸入沒有靜默丟失
    const lsKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('circles_local_draft_'))
    );
    expect(lsKeys.length, '本機 draft key 應存在，使用者文字未消失').toBeGreaterThan(0);
  });
});
