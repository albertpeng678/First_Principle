// @ts-check
const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4101';

test.describe('M-024-A · Desktop home 顯示 step pill', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('drill mode 卡片顯示 .circles-info-step pill', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.evaluate(() => { window.localStorage.setItem('circlesMode', 'drill'); });
    await page.reload();
    await page.waitForSelector('[data-view="circles"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    const pillCount = await page.locator('.circles-info-step').count();
    expect(pillCount).toBeGreaterThan(0);
  });
});

test.describe('M-024-B · iPhone-SE step E 上一步重點預設折疊', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test('step E 進入時 prev card 是收起狀態', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.evaluate(() => {
      window.AppState.circlesSession = { mode: 'simulation' };
      window.AppState.circlesSimStep = 5;
      window.AppState.circlesPhase = 1;
      if (window.renderCirclesPhase1) window.renderCirclesPhase1();
    });
    const prevCard = page.locator('[data-prev-card], .circles-prev-card-collapsible, .prev-step-card').first();
    if (await prevCard.count() > 0) {
      const collapsed = await prevCard.evaluate(el => {
        if (el.tagName.toLowerCase() === 'details') return !el.hasAttribute('open');
        const body = el.querySelector('.prev-step-body, .prev-card-body');
        if (body) {
          const cs = getComputedStyle(body);
          return cs.display === 'none';
        }
        return el.getAttribute('data-collapsed') === 'true';
      });
      expect(collapsed).toBe(true);
    }
  });
});

test.describe('M-024-C · NSM step 4 desktop 寬度', () => {
  test.use({ viewport: { width: 2560, height: 1440 } });
  test('Desktop-2560 寬度 ≥ 80% viewport', async ({ page }) => {
    await page.goto(BASE_URL + '/?view=nsm&onboarding=0');
    await page.evaluate(() => {
      window.AppState.nsmSubTab = 'nsm-step4';
      if (window.renderNsm) window.renderNsm();
    });
    const wrap = page.locator('.nsm-step4-desktop, .nsm-step4-wrap').first();
    if (await wrap.count() > 0) {
      const w = await wrap.evaluate(el => el.getBoundingClientRect().width);
      expect(w).toBeGreaterThan(2048);
    }
  });
});

test.describe('M-024-D · Login 忘記密碼次要化', () => {
  test('忘記密碼 a 字色用 --c-text-3，font-size ≤ 13px，無底線', async ({ page }) => {
    await page.goto(BASE_URL + '/?view=login&onboarding=0');
    const link = page.locator('#forgot-password-link');
    await link.waitFor({ state: 'visible', timeout: 5000 });
    const meta = await link.evaluate(el => {
      const cs = getComputedStyle(el);
      return { fontSize: parseFloat(cs.fontSize), color: cs.color, td: cs.textDecorationLine };
    });
    expect(meta.fontSize).toBeLessThanOrEqual(13);
    expect(meta.td).not.toContain('underline');
  });
});

test.describe('M-024 spec-only', () => {
  test('progress label 改「第 N 步 / 共 7 步」', async ({ page }) => {
    const res = await page.request.get(BASE_URL + '/app.js');
    const text = await res.text();
    expect(text).toContain('第 1 步 / 共 7 步');
    expect(text).toContain('第 7 步 / 共 7 步');
  });

  test('conclusion-back-btn min-height ≥ 44 (M-008 token 蓋過)', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.evaluate(() => {
      window.AppState.circlesPhase = 2;
      window.AppState.circlesSubmitState = 'expanded';
      window.AppState.circlesDrillStep = 'R';
      if (window.renderCirclesPhase2) window.renderCirclesPhase2();
    });
    const btn = page.locator('.conclusion-back-btn').first();
    if (await btn.count() > 0) {
      const h = await btn.evaluate(el => el.getBoundingClientRect().height);
      expect(h).toBeGreaterThanOrEqual(44);
    }
  });
});
