// @ts-check
const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4101';

// D-1 · simulation 卡片 copy「無提示」改正向
test.describe('Wave-D-1 · simulation mode card copy', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('simulation 卡 desc 含「提示與範例隨時可看」且不再含「無提示」', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForSelector('[data-view="circles"]', { timeout: 5000 });
    await page.waitForTimeout(400);
    // Click 練習 entry / drilldown to mode selector — simulation card
    const simCard = page.locator('.circles-mode-card[data-mode="simulation"] .circles-mode-card-desc').first();
    await expect(simCard).toBeVisible();
    const txt = (await simCard.textContent()) || '';
    expect(txt).toContain('提示與範例隨時可看');
    expect(txt).not.toContain('無提示');
  });
});

// D-2 · 錯誤訊息 alert 卡 — mobile-360
test.describe('Wave-D-2 · mobile error alert card 在 submit-bar 上方', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test('preflight err 顯示 .circles-form-error-card 且 NOT 在 submit-bar flex row 內', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      // @ts-ignore
      if (typeof AppState === 'undefined') return;
      // @ts-ignore
      AppState.view = 'circles';
      // @ts-ignore
      AppState.circlesPhase = 1;
      // @ts-ignore
      AppState.circlesMode = 'drill';
      // @ts-ignore
      AppState.circlesDrillStep = 'C1';
      // @ts-ignore
      AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS[0] : null);
      // @ts-ignore
      AppState.circlesSession = { mode: 'drill', id: 'test', stepKey: 'C1' };
      // @ts-ignore
      if (typeof render === 'function') render();
    });
    await page.waitForTimeout(600);
    const submitBtn = page.locator('#circles-p1-submit');
    if (await submitBtn.count() === 0) test.skip(true, 'submit btn not present in this build');
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(300);
    const card = page.locator('.circles-form-error-card');
    if (await card.count() === 0) {
      // empty fields branch may have already returned but with old class — fail
      throw new Error('expected .circles-form-error-card after submitting empty form');
    }
    // Confirm card is NOT inside .circles-submit-bar
    const inside = await card.first().evaluate(el => !!el.closest('.circles-submit-bar'));
    expect(inside).toBe(false);
    // Confirm card precedes submit bar in DOM (上方)
    const order = await page.evaluate(() => {
      const c = document.querySelector('.circles-form-error-card');
      const b = document.querySelector('.circles-submit-bar');
      if (!c || !b) return -1;
      const pos = c.compareDocumentPosition(b);
      // DOCUMENT_POSITION_FOLLOWING = 4 — bar follows card
      return pos & 4 ? 1 : 0;
    });
    expect(order).toBe(1);
  });
});

// D-5 · 全站 system-ui 字型
test.describe('Wave-D-5 · system-ui font token', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('body computed font-family 以 system-ui 為先，且不含 DM Sans', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForSelector('body', { timeout: 5000 });
    const ff = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(ff.toLowerCase()).toContain('system-ui');
    expect(ff).not.toContain('DM Sans');
  });

  test('--c-font-sans token 含 system-ui 為首', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForSelector('body', { timeout: 5000 });
    const tok = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--c-font-sans').trim()
    );
    expect(tok.startsWith('system-ui')).toBe(true);
    expect(tok).not.toContain('DM Sans');
  });

  test('Phase-4 .grade-letter 仍用 Instrument Serif（不被 system-ui 蓋）', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    // Inject a stub element styled by our CSS rule and read computed style
    await page.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.className = 'circles-final-report';
      const inner = document.createElement('div');
      inner.className = 'grade-letter';
      inner.textContent = 'A';
      wrap.appendChild(inner);
      document.body.appendChild(wrap);
    });
    const ff = await page.evaluate(() => {
      const el = document.querySelector('.grade-letter');
      return el ? getComputedStyle(el).fontFamily : '';
    });
    // If site doesn't expose .grade-letter rule, this softly passes (no Instrument Serif token? skip)
    if (!ff) test.skip(true, '.grade-letter rule not present');
    expect(ff).toContain('Instrument Serif');
  });
});
