// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('MASTER-015 全站「回首頁」icon 化', () => {
  test('CIRCLES Phase 1 nav 用 icon 不用文字', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.locator('.circles-q-card').first().click();
    await page.locator('.circles-q-confirm-btn').first().click();
    await page.waitForSelector('#circles-p1-home');
    const homeBtn = page.locator('#circles-p1-home');
    await expect(homeBtn.locator('i.ph.ph-house')).toHaveCount(1);
    await expect(homeBtn).toHaveAttribute('aria-label', '回首頁');
    await expect(homeBtn).toHaveText(/^\s*$/);
  });

  test('NSM step 4 同時有 back + home icon', async ({ page }) => {
    await page.goto(BASE_URL + '/?view=nsm&onboarding=0');
    await page.evaluate(() => {
      window.AppState.nsmStep = 4;
      window.AppState.nsmSession = window.AppState.nsmSession || {};
      if (typeof window.render === 'function') window.render();
    });
    await page.waitForSelector('#btn-nsm-home-nav', { timeout: 5000 });
    await expect(page.locator('#btn-nsm-back')).toHaveCount(1);
    await expect(page.locator('#btn-nsm-home-nav')).toHaveCount(1);
  });

  test('NSM gate sub-tab 回首頁是純 icon', async ({ page }) => {
    await page.goto(BASE_URL + '/?view=nsm&onboarding=0');
    await page.evaluate(() => {
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-gate';
      if (typeof window.render === 'function') window.render();
    });
    const gateHome = page.locator('#btn-nsm-home-nav').first();
    if (await gateHome.count() > 0) {
      await expect(gateHome).toHaveText(/^\s*$/);
      await expect(gateHome.locator('i.ph.ph-house')).toHaveCount(1);
    }
  });
});

test.describe('MASTER-021 offcanvas loading', () => {
  test('open 後等 fetch 期間顯示 spinner', async ({ page }) => {
    await page.route(/sessions/, async (r) => {
      await new Promise((res) => setTimeout(res, 800));
      r.continue();
    });
    await page.goto(BASE_URL + '/?onboarding=0');
    // Wait for navbar render so hamburger.onclick is bound.
    await page.waitForFunction(() => {
      const h = document.getElementById('btn-hamburger');
      return h && typeof h.onclick === 'function';
    }, { timeout: 5000 });
    await page.click('#btn-hamburger');
    await expect(page.locator('.offcanvas-loading')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.offcanvas-loading .spinner')).toBeVisible();
    await expect(page.locator('.offcanvas-loading')).toBeHidden({ timeout: 5000 });
  });
});
