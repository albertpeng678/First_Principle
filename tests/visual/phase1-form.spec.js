// Path 2 · Plan B · Sub-bundle 3 — Phase 1 Form（mockup 03 Section A）
// 13 viewport-conditional contract + BEM structure tests.
// Source of truth: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html Section A line 794-1216
const { test, expect } = require('@playwright/test');

test.describe('B SB3 Phase 1 Form — mockup 03 Section A', () => {

  async function gotoSimC1(page) {
    // Stub stats so home doesn't error
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    // Click first qcard → expand → primary 確認 → enter Phase 1
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
  }

  async function gotoDrillC1(page) {
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.mode-card');
    await page.locator('.mode-card').nth(1).click(); // drill mode
    await page.locator('.drill-pill:visible').first().click(); // C1 drill-pill (must be visible)
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
  }

  test('simulation phase-head: eyebrow「Phase 1 · 寫框架」+ title「C · 澄清情境」', async ({ page }) => {
    await gotoSimC1(page);
    await expect(page.locator('.phase-head__eyebrow')).toHaveText('Phase 1 · 寫框架');
    await expect(page.locator('.phase-head__title')).toHaveText('C · 澄清情境');
  });

  test('simulation shows progress bar with 7 step pills (C/I/R/C/L/E/S)', async ({ page }) => {
    await gotoSimC1(page);
    await expect(page.locator('.progress')).toBeVisible();
    const pills = page.locator('.progress__step');
    await expect(pills).toHaveCount(7);
    await expect(pills.nth(0)).toHaveClass(/is-active/);
    const letters = await page.locator('.progress__step .step-letter').allTextContents();
    expect(letters).toEqual(['C', 'I', 'R', 'C', 'L', 'E', 'S']);
  });

  test('drill phase-head: eyebrow「Phase 1 · 個別步驟練習」+ title 含 fields summary', async ({ page }) => {
    await gotoDrillC1(page);
    await expect(page.locator('.phase-head__eyebrow')).toHaveText('Phase 1 · 個別步驟練習');
    await expect(page.locator('.phase-head__title')).toContainText('C · 澄清情境');
    await expect(page.locator('.phase-head__title')).toContainText('題目邊界');
    await expect(page.locator('.phase-head')).toHaveClass(/phase-head--drill/);
  });

  test('drill mode hides progress bar', async ({ page }) => {
    await gotoDrillC1(page);
    await expect(page.locator('.progress')).toHaveCount(0);
  });

  test('renders 4 fields with 問題範圍 / 時間範圍 / 業務影響 / 假設確認 labels (C1)', async ({ page }) => {
    await gotoSimC1(page);
    const labels = await page.locator('.field__label').allTextContents();
    expect(labels).toEqual(['問題範圍', '時間範圍', '業務影響', '假設確認']);
  });

  test('each field has rt-field with toolbar + textarea + meta', async ({ page }) => {
    await gotoSimC1(page);
    const fields = page.locator('.field');
    expect(await fields.count()).toBe(4);
    for (let i = 0; i < 4; i++) {
      await expect(fields.nth(i).locator('.rt-field__toolbar')).toBeVisible();
      await expect(fields.nth(i).locator('.rt-textarea')).toBeVisible();
    }
    // field 1 has char-counter
    await expect(fields.nth(0).locator('.char-counter')).toBeVisible();
  });

  test('submit-bar sim mobile: 下一步 only (ghost hidden); sim tablet: ghost 上一步 visible', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoSimC1(page);
    await expect(page.locator('.submit-bar__right .btn--primary')).toContainText('下一步');
    // mobile sim: ghost btn exists but hidden via CSS (.submit-bar__back hidden on mobile)
    await expect(page.locator('.submit-bar__left .btn--ghost')).not.toBeVisible();
    // tablet sim: resize → ghost becomes visible
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(200);
    await expect(page.locator('.submit-bar__left .btn--ghost')).toBeVisible();
    await expect(page.locator('.submit-bar__left .btn--ghost')).toContainText('上一步');
  });

  test('submit-bar drill mode: only 下一步, no 上一步 ghost', async ({ page }) => {
    await gotoDrillC1(page);
    expect(await page.locator('.submit-bar__left .btn--ghost').count()).toBe(0);
    await expect(page.locator('.submit-bar__right .btn--primary')).toContainText('下一步');
  });

  test('desktop drill phase-body has --with-rail + rail aside「本步重點」', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoDrillC1(page);
    await expect(page.locator('.phase-body--with-rail')).toBeVisible();
    await expect(page.locator('.rail')).toBeVisible();
    await expect(page.locator('.rail__title').first()).toHaveText('本步重點');
  });

  // SB6 cold-review fix — DRIFT 2: mockup 03 Section G desktop line 2342 + Section B/C
  // desktop sim base C step shows qchip__company suffix「· 設計題 · 難度 中」.
  // Mirror existing renderCirclesPhase1Lstep desktop behavior (phase1-l-step.spec.js line 80).
  test('desktop sim base C step qchip__company shows 設計題 · 難度 suffix', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await gotoSimC1(page);
    const company = await page.locator('.qchip__company').textContent();
    expect(company).toContain('設計題');
    expect(company).toContain('難度');
  });

  // user 2026-05-04 bug 1: 「在 CIRCLES 測試頁時，點擊回首頁、icon 都無法回首頁」
  // home / brand / CIRCLES tab 必須 reset Phase 1 sub-state，回到 mockup 01 home。
  test('navbar home icon from Phase 1 form resets to mockup 01 home', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await gotoSimC1(page);
    await expect(page.locator('.qchip')).toBeVisible();
    await page.locator('[data-nav="home"].navbar__icon-btn').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.mode-card')).toHaveCount(2);
    await expect(page.locator('.qcard')).toHaveCount(5);
    await expect(page.locator('.phase-head')).toHaveCount(0);
  });

  test('navbar brand from Phase 1 form resets to mockup 01 home', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoSimC1(page);
    await expect(page.locator('.qchip')).toBeVisible();
    await page.locator('.navbar__brand[data-nav="home"]').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.mode-card')).toHaveCount(2);
    await expect(page.locator('.phase-head')).toHaveCount(0);
  });
});
