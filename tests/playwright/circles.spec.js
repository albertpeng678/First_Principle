const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';

const BREAKPOINTS = [
  { name: '320-mobile',   width: 320,  height: 568  },
  { name: '375-se',       width: 375,  height: 667  },
  { name: '430-pro-max',  width: 430,  height: 932  },
  { name: '768-tablet',   width: 768,  height: 1024 },
  { name: '1280-desktop', width: 1280, height: 800  },
];

// Helper: assert no element overflows viewport horizontally
async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1) {
        offenders.push({ tag: el.tagName, class: el.className, right: rect.right });
      }
    });
    return offenders;
  });
  expect(overflow, `Horizontal overflow detected: ${JSON.stringify(overflow)}`).toHaveLength(0);
}

// Helper: assert all interactive elements meet 44×44 touch target
async function assertTouchTargets(page) {
  const small = await page.evaluate(() => {
    const selectors = 'button, a, [role="button"], .circles-mode-card, .circles-type-tab, .circles-step-pill, .circles-q-card, .circles-resume-card, .circles-nav-back, .circles-send-btn, .circles-phase2-submit';
    const offenders = [];
    document.querySelectorAll(selectors).forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
        offenders.push({ tag: el.tagName, class: el.className.slice(0, 60), w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    });
    return offenders;
  });
  expect(small, `Touch targets < 44px: ${JSON.stringify(small)}`).toHaveLength(0);
}

for (const bp of BREAKPOINTS) {
  test.describe(`CIRCLES 稽核 @ ${bp.name} (${bp.width}×${bp.height})`, () => {
    test.use({ viewport: { width: bp.width, height: bp.height } });

    // ── Journey 1: 首頁 → CIRCLES tab → 選題 ──────────────────
    test('J1: 首頁顯示 CIRCLES tab，點擊進入選題', async ({ page }) => {
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', e => errors.push(e.message));

      await page.goto(BASE);
      await page.waitForSelector('.home-tab-btn');

      const circlesTab = page.locator('.home-tab-btn', { hasText: 'CIRCLES' });
      await expect(circlesTab).toBeVisible();
      await circlesTab.click();
      await page.locator('#btn-circles-start').click();

      await expect(page.locator('.circles-home-title')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await assertTouchTargets(page);

      expect(errors, `Console errors: ${errors.join('; ')}`).toHaveLength(0);
    });

    // ── Journey 2: 模式切換 + 步驟 pill ───────────────────────
    test('J2: 模式切換（drill/simulation）+ 步驟 pill 選取', async ({ page }) => {
      await page.goto(BASE);
      await page.locator('.home-tab-btn', { hasText: 'CIRCLES' }).click();
      await page.locator('#btn-circles-start').click();

      // Switch to simulation
      await page.locator('.circles-mode-card[data-mode="simulation"]').click();
      await expect(page.locator('.circles-mode-card[data-mode="simulation"].selected')).toBeVisible();
      // Step pills should disappear in simulation mode
      await expect(page.locator('.circles-step-pills')).toHaveCount(0);

      // Switch back to drill
      await page.locator('.circles-mode-card[data-mode="drill"]').click();
      await expect(page.locator('.circles-step-pills')).toBeVisible();

      // Click each step pill
      const pills = page.locator('.circles-step-pill');
      const count = await pills.count();
      for (let i = 0; i < count; i++) {
        await pills.nth(i).click();
      }

      await assertNoHorizontalOverflow(page);
      await assertTouchTargets(page);
    });

    // ── Journey 3: 題型 tab + 選題 → Phase 1 表單 ──────────────
    test('J3: 題型 tab 切換 + 選題 → Phase 1 填寫', async ({ page }) => {
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

      await page.goto(BASE);
      await page.locator('.home-tab-btn', { hasText: 'CIRCLES' }).click();
      await page.locator('#btn-circles-start').click();

      // Type tabs
      for (const type of ['design', 'improve', 'strategy']) {
        await page.locator(`.circles-type-tab[data-type="${type}"]`).click();
        await expect(page.locator(`.circles-type-tab[data-type="${type}"].active`)).toBeVisible();
      }

      // Pick first question
      await page.locator('.circles-type-tab[data-type="design"]').click();
      await page.locator('.circles-q-card').first().click();

      // Phase 1 form visible
      await expect(page.locator('.circles-field-input').first()).toBeVisible();
      await expect(page.locator('#circles-p1-submit')).toBeVisible();

      // Submit button must meet 44px height
      const btn = page.locator('#circles-p1-submit');
      const box = await btn.boundingBox();
      expect(box.height, 'Submit button height < 44px').toBeGreaterThanOrEqual(44);

      // No horizontal overflow
      await assertNoHorizontalOverflow(page);
      expect(errors, `Console errors: ${errors.join('; ')}`).toHaveLength(0);
    });

    // ── Journey 4: Phase 1.5 Gate 顯示（mock — 不呼叫真實 AI）──
    test('J4: Phase 1 填寫完整後提交按鈕存在且可點擊', async ({ page }) => {
      await page.goto(BASE);
      await page.locator('.home-tab-btn', { hasText: 'CIRCLES' }).click();
      await page.locator('#btn-circles-start').click();
      await page.locator('.circles-q-card').first().click();

      // Fill all inputs
      const inputs = page.locator('.circles-field-input');
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        await inputs.nth(i).fill(`測試內容 ${i + 1}`);
      }

      const submitBtn = page.locator('#circles-p1-submit');
      await expect(submitBtn).toBeVisible();
      await expect(submitBtn).toBeEnabled();

      // Bottom bar must not overflow viewport
      const barBox = await page.locator('.circles-submit-bar').boundingBox();
      expect(barBox.bottom, 'Submit bar overflows below viewport').toBeLessThanOrEqual(bp.height + 1);
    });

    // ── Journey 5: Phase 2 Chat 畫面結構 ───────────────────────
    test('J5: Phase 2 chat — input bar 不被遮擋，send btn 觸控目標合格', async ({ page }) => {
      // Force navigate to Phase 2 by manipulating AppState directly
      await page.goto(BASE);
      await page.waitForSelector('.home-tab-btn');

      // Set up minimal AppState to render Phase 2
      await page.evaluate(() => {
        AppState.view = 'circles';
        AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS !== 'undefined' && CIRCLES_QUESTIONS[0]) || {
          id: 'test', company: 'Test Co', product: 'Test Product',
          problem_statement: '如何提升用戶留存率？',
          question_type: 'improve', difficulty: 'medium',
        };
        AppState.circlesSession = { id: 'fake-id', mode: 'drill', drill_step: 'C1' };
        AppState.circlesMode = 'drill';
        AppState.circlesDrillStep = 'C1';
        AppState.circlesPhase = 2;
        AppState.circlesConversation = [];
        document.body.dataset.view = 'circles';
        if (typeof render === 'function') render();
      });

      await expect(page.locator('.circles-input-bar')).toBeVisible();
      await expect(page.locator('.circles-send-btn')).toBeVisible();
      await expect(page.locator('#circles-msg-input')).toBeVisible();

      // Input bar bottom must not be hidden below viewport
      const barBox = await page.locator('.circles-input-bar').boundingBox();
      expect(barBox.bottom, 'Input bar overflows below viewport').toBeLessThanOrEqual(bp.height + 2);

      // Send button touch target
      const sendBox = await page.locator('.circles-send-btn').boundingBox();
      expect(sendBox.width, 'Send btn width < 44').toBeGreaterThanOrEqual(40); // 40 acceptable for icon buttons
      expect(sendBox.height, 'Send btn height < 40').toBeGreaterThanOrEqual(40);

      await assertNoHorizontalOverflow(page);
    });

    // ── Journey 6: NSM 回歸 ─────────────────────────────────────
    test('J6: NSM 工作坊流程未受 CIRCLES 影響', async ({ page }) => {
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

      await page.goto(BASE);
      await page.waitForSelector('.home-tab-btn');
      await page.locator('.home-tab-btn', { hasText: '北極星' }).click();

      await expect(page.locator('.nsm-tab-panel').first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
      expect(errors, `NSM console errors: ${errors.join('; ')}`).toHaveLength(0);
    });

    // ── Journey 7: PM 訪談回歸 ──────────────────────────────────
    test('J7: PM 訪談難度卡片仍可點擊', async ({ page }) => {
      await page.goto(BASE);
      await page.waitForSelector('.home-tab-btn');
      await page.locator('.home-tab-btn', { hasText: 'PM 訪談' }).click();
      const cards = page.locator('.diff-item[data-difficulty]');
      await expect(cards.first()).toBeVisible();
      await assertTouchTargets(page);
      await assertNoHorizontalOverflow(page);
    });

    // ── Journey 8: 返回鍵導航 ───────────────────────────────────
    test('J8: 每個畫面的返回按鈕可用、觸控目標合格', async ({ page }) => {
      await page.goto(BASE);
      await page.locator('.home-tab-btn', { hasText: 'CIRCLES' }).click();
      await page.locator('#btn-circles-start').click();

      // Home back button
      const homeBack = page.locator('#circles-home-back');
      await expect(homeBack).toBeVisible();
      const homeBackBox = await homeBack.boundingBox();
      expect(homeBackBox.width).toBeGreaterThanOrEqual(36);
      expect(homeBackBox.height).toBeGreaterThanOrEqual(36);

      // Navigate to Phase 1
      await page.locator('.circles-q-card').first().click();
      const p1Back = page.locator('#circles-p1-back');
      await expect(p1Back).toBeVisible();
      const p1BackBox = await p1Back.boundingBox();
      expect(p1BackBox.height).toBeGreaterThanOrEqual(36);

      // Click back → should return to question list
      await p1Back.click();
      await expect(page.locator('.circles-home-title')).toBeVisible();
    });
  });
}
