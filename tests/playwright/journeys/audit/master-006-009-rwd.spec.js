// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

async function gotoStepI(page) {
  await page.goto(BASE_URL + '/?onboarding=0');
  await page.locator('.circles-q-card').first().click();
  await page.locator('.circles-q-confirm-btn').first().click();
  await page.waitForSelector('#circles-p1-submit');
  await page.click('#circles-p1-submit'); // C1 → I
  await page.waitForSelector('[data-step="I"]', { timeout: 5000 }).catch(() => {});
}

test.describe('MASTER-006 Mobile-360 horizontal overflow', () => {
  test.use({ viewport: { width: 360, height: 720 } });

  test('step I 沒有水平捲軸', async ({ page }) => {
    await gotoStepI(page);
    const overflow = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    expect(overflow.sw).toBeLessThanOrEqual(overflow.cw);
  });
});

test.describe('MASTER-009 sticky bar 不蓋 form', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('iPhone-SE step I 捲到底時 sticky bar 不重疊最後 textarea', async ({ page }) => {
    await gotoStepI(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const overlap = await page.evaluate(() => {
      const bar = document.querySelector('.circles-submit-bar');
      const tas = Array.from(document.querySelectorAll('textarea'));
      if (!bar || tas.length === 0) return null;
      const barTop = bar.getBoundingClientRect().top;
      const lastBottom = tas[tas.length - 1].getBoundingClientRect().bottom;
      return lastBottom - barTop; // <=0 means no overlap
    });
    expect(overlap).not.toBeNull();
    expect(overlap).toBeLessThanOrEqual(0);
  });
});
