// tests/visual/phase3-error-loading.spec.js
// Mockup 12 — Phase 3 Loading slow variant + EVAL_API_ERROR / EVAL_PARSE_ERROR detailed UIs
// TDD: covers the 3 sections of mockup 12

const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

// Shared setup — Phase 3 in loading state (no score, no error)
async function setupPhase3Loading(page, { slowVariant = false } = {}) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(({ slowVariant }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 3,
      circlesMode: 'drill',
      circlesDrillStep: 'I',
      circlesSession: { id: 'sess-1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      circlesScoreResult: null,
      circlesPhase3Error: null,
      circlesPhase3LoadingStep: 2,   // step 3 active (0-indexed): 解析框架 done, 計算分數 done, 生成示範答案 active
      circlesPhase3LoadingSlow: slowVariant,
    });
    window.render();
  }, { slowVariant });
}

// Shared setup — Phase 3 in error state
async function setupPhase3Error(page, errorCode) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate((errorCode) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 3,
      circlesMode: 'drill',
      circlesDrillStep: 'I',
      circlesSession: { id: 'sess-1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      circlesScoreResult: null,
      circlesPhase3Error: { code: errorCode, message: 'test error' },
      circlesPhase3LoadingStep: 1,
      circlesPhase3LoadingSlow: false,
    });
    window.render();
  }, errorCode);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section A — Loading 慢回應 (mockup 12 §A)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Phase 3 Loading — Section A: slow variant', () => {
  test('Normal loading: shows loading-sub (not slow)', async ({ page }) => {
    await setupPhase3Loading(page, { slowVariant: false });
    // Normal loading-sub should be present (no slow variant)
    await expect(page.locator('.loading-sub')).toBeVisible();
    // Should NOT have loading-sub--slow class
    const slowEl = page.locator('.loading-sub--slow');
    await expect(slowEl).toHaveCount(0);
  });

  test('Slow variant (60s elapsed): loading-sub--slow visible with warn copy', async ({ page }) => {
    await setupPhase3Loading(page, { slowVariant: true });
    // loading-sub--slow should be visible
    const slowEl = page.locator('.loading-sub--slow');
    await expect(slowEl).toBeVisible();
    // Should contain the correct slow copy
    await expect(slowEl).toContainText('比預期慢一些');
    await expect(slowEl).toContainText('AI 深度分析中');
    await expect(slowEl).toContainText('請再等等');
    // Spinner still visible
    await expect(page.locator('.loading-spinner')).toBeVisible();
    // Checklist still visible
    await expect(page.locator('.loading-checklist')).toBeVisible();
  });

  test('Checklist at step 2: 解析框架 done, 計算分數 done, 生成示範答案 active, 整理建議 pending', async ({ page }) => {
    await setupPhase3Loading(page, { slowVariant: true });
    const steps = page.locator('.loading-step');
    await expect(steps).toHaveCount(4);
    // Step 0 (解析框架) — done
    await expect(steps.nth(0)).toHaveClass(/is-done/);
    await expect(steps.nth(0)).toContainText('解析框架');
    // Step 1 (計算分數) — done
    await expect(steps.nth(1)).toHaveClass(/is-done/);
    // Step 2 (生成示範答案) — active
    await expect(steps.nth(2)).toHaveClass(/is-active/);
    await expect(steps.nth(2)).toContainText('生成示範答案');
    // Step 3 (整理建議) — pending
    await expect(steps.nth(3)).toHaveClass(/is-pending/);
    await expect(steps.nth(3)).toContainText('整理建議');
  });

  test('AppState.circlesPhase3LoadingSlow=true via JS evaluate triggers slow variant', async ({ page }) => {
    await setupPhase3Loading(page, { slowVariant: false });
    // Normal state first
    await expect(page.locator('.loading-sub--slow')).toHaveCount(0);
    // Simulate 60s elapsed by setting flag and re-render
    await page.evaluate(() => {
      window.AppState.circlesPhase3LoadingSlow = true;
      window.render();
    });
    await expect(page.locator('.loading-sub--slow')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section B — Error EVAL_API_ERROR (mockup 12 §B)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Phase 3 Error — EVAL_API_ERROR (Section B)', () => {
  test('Shows error-wrap with correct title', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_API_ERROR');
    await expect(page.locator('.error-wrap')).toBeVisible();
    await expect(page.locator('.error-wrap__title')).toContainText('評分服務暫時不可用');
  });

  test('Shows correct sub-copy mentioning 伺服器忙線', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_API_ERROR');
    await expect(page.locator('.error-wrap__sub')).toContainText('伺服器忙線中');
    await expect(page.locator('.error-wrap__sub')).toContainText('你的答案已自動保存');
  });

  test('Shows EVAL_API_ERROR code badge', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_API_ERROR');
    await expect(page.locator('.error-wrap__code')).toContainText('EVAL_API_ERROR');
  });

  test('Shows both action buttons', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_API_ERROR');
    await expect(page.locator('[data-phase3="back-to-phase1"]')).toBeVisible();
    await expect(page.locator('[data-phase3="retry"]')).toBeVisible();
    await expect(page.locator('[data-phase3="back-to-phase1"]')).toContainText('返回修改答案');
    await expect(page.locator('[data-phase3="retry"]')).toContainText('重新評分');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section C — Error EVAL_PARSE_ERROR (mockup 12 §C)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Phase 3 Error — EVAL_PARSE_ERROR (Section C)', () => {
  test('Shows error-wrap with correct title', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_PARSE_ERROR');
    await expect(page.locator('.error-wrap')).toBeVisible();
    await expect(page.locator('.error-wrap__title')).toContainText('教練回應格式異常');
  });

  test('Shows correct sub-copy mentioning 無法正確解析', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_PARSE_ERROR');
    await expect(page.locator('.error-wrap__sub')).toContainText('無法正確解析');
    await expect(page.locator('.error-wrap__sub')).toContainText('重試通常能解決');
  });

  test('Shows EVAL_PARSE_ERROR code badge', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_PARSE_ERROR');
    await expect(page.locator('.error-wrap__code')).toContainText('EVAL_PARSE_ERROR');
  });

  test('Both action buttons present', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_PARSE_ERROR');
    await expect(page.locator('[data-phase3="back-to-phase1"]')).toBeVisible();
    await expect(page.locator('[data-phase3="retry"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Existing: EVAL_TIMEOUT (mockup 11 §D) — regression guard
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Phase 3 Error — EVAL_TIMEOUT (Section D, mockup 11 regression)', () => {
  test('EVAL_TIMEOUT shows title 評分生成失敗', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_TIMEOUT');
    await expect(page.locator('.error-wrap__title')).toContainText('評分生成失敗');
    await expect(page.locator('.error-wrap__code')).toContainText('EVAL_TIMEOUT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Interactions — retry + back-to-phase1
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Phase 3 error interactions', () => {
  test('Retry click clears error and resets to loading state', async ({ page }) => {
    // Mock evaluate endpoint with a slow response so loading state is visible
    await page.route('**/api/guest-circles-sessions/**/evaluate-step', r =>
      new Promise(resolve => setTimeout(() => resolve(r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })), 500))
    );
    await page.route('**/api/circles-sessions/**/evaluate-step', r =>
      new Promise(resolve => setTimeout(() => resolve(r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })), 500)))
    ;
    await setupPhase3Error(page, 'EVAL_API_ERROR');
    await page.locator('[data-phase3="retry"]').click();
    // Immediately after click: error should be cleared
    // Loading wrap should be visible (render was called synchronously before API fires)
    await expect(page.locator('.loading-wrap')).toBeVisible();
    // Error wrap should be gone
    await expect(page.locator('.error-wrap')).toHaveCount(0);
  });

  test('Back-to-phase1 click navigates away from phase 3', async ({ page }) => {
    await setupPhase3Error(page, 'EVAL_PARSE_ERROR');
    await page.locator('[data-phase3="back-to-phase1"]').click();
    // Phase 3 view should be gone
    await expect(page.locator('[data-view="circles"][data-phase="3"]')).toHaveCount(0);
  });

  test('clearPhase3Timers resets circlesPhase3LoadingSlow', async ({ page }) => {
    await setupPhase3Loading(page, { slowVariant: true });
    await expect(page.locator('.loading-sub--slow')).toBeVisible();
    // Navigate to an error state (triggers clearPhase3Timers)
    await page.evaluate(() => {
      window.AppState.circlesPhase3Error = { code: 'EVAL_API_ERROR', message: 'test' };
      window.render();
    });
    // Error state shown — slow variant should be gone
    await expect(page.locator('.error-wrap')).toBeVisible();
    await expect(page.locator('.loading-sub--slow')).toHaveCount(0);
    // Now clear error — slow flag should remain false
    await page.evaluate(() => {
      window.AppState.circlesPhase3Error = null;
      // Note: clearPhase3Timers was called when error was set, resetting LoadingSlow
      window.render();
    });
    // Normal loading-sub (not slow)
    await expect(page.locator('.loading-sub--slow')).toHaveCount(0);
  });
});
