const { test, expect } = require('@playwright/test');

// Shared mock data
const Q = { id: 'q-sp', company: 'Spotify', industry: '音樂串流', scenario: '為 Spotify 定義北極星指標', product: 'Spotify Music' };

const GATE_OK_RESULT = {
  overall_status: 'ok',
  overallStatus: 'ok',
  canProceed: true,
  items: [
    { criterion: 'NSM定義清晰度', status: 'ok', feedback: '清晰定義用戶行為與量化門檻', suggestion: null },
    { criterion: '與業務目標的連結', status: 'ok', feedback: '直接對應訂閱續費率', suggestion: null },
    { criterion: '可測量性', status: 'ok', feedback: '可用 Amplitude 直接追蹤', suggestion: null },
    { criterion: '非虛榮指標', status: 'ok', feedback: '捕捉 AHA 時刻行為', suggestion: null },
  ],
};

const GATE_WARN_RESULT = {
  overall_status: 'warn',
  overallStatus: 'warn',
  canProceed: true,
  items: [
    { criterion: 'NSM定義清晰度', status: 'ok', feedback: '清晰定義用戶行為', suggestion: null },
    { criterion: '與業務目標的連結', status: 'warn', feedback: '邏輯有跳躍需補充', suggestion: '說明 NSM 如何直接驅動訂閱收入' },
    { criterion: '可測量性', status: 'ok', feedback: '可用埋點追蹤', suggestion: null },
    { criterion: '非虛榮指標', status: 'ok', feedback: '行為深度指標', suggestion: null },
  ],
};

const GATE_ERROR_RESULT = {
  overall_status: 'error',
  overallStatus: 'error',
  canProceed: false,
  items: [
    { criterion: 'NSM定義清晰度', status: 'error', feedback: '這是虛榮指標', suggestion: '改成行為深度型指標' },
    { criterion: '與業務目標的連結', status: 'error', feedback: '無法預測營收走向', suggestion: '先找 AHA 時刻動作' },
    { criterion: '可測量性', status: 'warn', feedback: '過度仰賴行銷推廣', suggestion: null },
    { criterion: '非虛榮指標', status: 'ok', feedback: '直觀易懂', suggestion: null },
  ],
};

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"s1","sessionId":"s1"}' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"s1","sessionId":"s1"}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setupNSMGateState(page, gateResult) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ q, gr }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-gate';
    window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmGateResult = gr;
    window.AppState.nsmGateLoading = false;
    window.AppState.nsmGateError = null;
    window.AppState.nsmSession = { id: 's1' };
    window.AppState.nsmDefinition = {
      nsm: '每月完成至少一首完整曲目播放的活躍月用戶數',
      explanation: '定義說明',
      businessLink: '業務連結說明'
    };
    window.render();
  }, { q: Q, gr: gateResult });
  await page.waitForSelector('.gate-wrap', { timeout: 3000 });
}

async function setupNSMLoadingState(page) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ q }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-gate';
    window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmGateResult = null;
    window.AppState.nsmGateLoading = true;
    window.AppState.nsmGateLoadingStep = 0;
    window.AppState.nsmGateError = null;
    window.AppState.nsmSession = { id: 's1' };
    window.render();
  }, { q: Q });
  await page.waitForSelector('.gate-loading-wrap', { timeout: 3000 });
}

test.describe('NSM Gate Inline (mockup 08)', () => {
  // ── Loading state ────────────────────────────────────────────────────────
  test('Loading: gate-loading-wrap visible with spinner + 4-step checklist', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMLoadingState(page);
    await expect(page.locator('.gate-loading-wrap')).toBeVisible();
    await expect(page.locator('.gate-spinner')).toBeVisible();
    await expect(page.locator('.gate-loading-title')).toContainText('AI 正在審核');
    expect(await page.locator('.gate-loading-step').count()).toBe(4);
  });

  test('Loading: first step active, rest pending', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMLoadingState(page);
    const steps = page.locator('.gate-loading-step');
    await expect(steps.nth(0)).toHaveClass(/is-active/);
    await expect(steps.nth(1)).toHaveClass(/is-pending/);
    await expect(steps.nth(2)).toHaveClass(/is-pending/);
    await expect(steps.nth(3)).toHaveClass(/is-pending/);
  });

  test('Loading: no submit-bar visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMLoadingState(page);
    await expect(page.locator('.submit-bar')).not.toBeVisible();
  });

  // ── Gate OK ──────────────────────────────────────────────────────────────
  test('Gate ok: gate-transition--ok visible + title 通過審核', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_OK_RESULT);
    await expect(page.locator('.gate-transition--ok')).toBeVisible();
    await expect(page.locator('.gate-transition__title')).toContainText('通過審核');
    await expect(page.locator('.gate-transition__sub')).toContainText('4 / 4');
  });

  test('Gate ok: 4 gate-items all ok class', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_OK_RESULT);
    const items = page.locator('.gate-item');
    expect(await items.count()).toBe(4);
    for (let i = 0; i < 4; i++) {
      await expect(items.nth(i)).toHaveClass(/gate-item--ok/);
    }
  });

  test('Gate ok: submit-bar has 繼續到 步驟 3 primary button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_OK_RESULT);
    await expect(page.locator('.submit-bar')).toBeVisible();
    const primaryBtn = page.locator('.submit-bar .btn--primary');
    await expect(primaryBtn).toContainText('繼續到 步驟 3');
  });

  // ── Gate WARN ────────────────────────────────────────────────────────────
  test('Gate warn: gate-transition--warn + 1 warn item + suggestion visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_WARN_RESULT);
    await expect(page.locator('.gate-transition--warn')).toBeVisible();
    await expect(page.locator('.gate-transition__title')).toContainText('通過');
    expect(await page.locator('.gate-item--warn').count()).toBe(1);
    await expect(page.locator('.gate-item--warn .gate-item__suggestion')).toBeVisible();
  });

  test('Gate warn: submit-bar has 繼續到 步驟 3 (warn does not block)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_WARN_RESULT);
    const primaryBtn = page.locator('.submit-bar .btn--primary');
    await expect(primaryBtn).toContainText('繼續到 步驟 3');
  });

  // ── Gate ERROR ───────────────────────────────────────────────────────────
  test('Gate error: gate-transition--error + 2 error items visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_ERROR_RESULT);
    await expect(page.locator('.gate-transition--error')).toBeVisible();
    await expect(page.locator('.gate-transition__title')).toContainText('需要修正');
    expect(await page.locator('.gate-item--error').count()).toBe(2);
  });

  test('Gate error: submit-bar has only 上一步修改 — no proceed button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_ERROR_RESULT);
    await expect(page.locator('.submit-bar')).toBeVisible();
    const allBtns = page.locator('.submit-bar .btn');
    expect(await allBtns.count()).toBe(1);
    await expect(allBtns.first()).toContainText('上一步修改');
    // Must NOT have any 繼續 / 帶風險繼續 button
    await expect(page.locator('.submit-bar .btn').filter({ hasText: '繼續' })).toHaveCount(0);
  });

  test('Gate error → click 上一步修改 → clears gate result, returns to step 2 form', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_ERROR_RESULT);
    // Click 上一步修改
    await page.locator('.submit-bar .btn').filter({ hasText: '上一步修改' }).click();
    // Should return to step 2 form (nsm-body visible, nsm-field visible)
    await expect(page.locator('.nsm-body')).toBeVisible();
    await expect(page.locator('.nsm-field').first()).toBeVisible();
    // Gate result cleared
    const gateResult = await page.evaluate(() => window.AppState.nsmGateResult);
    expect(gateResult).toBeNull();
    // SubTab should be nsm-step2
    const subTab = await page.evaluate(() => window.AppState.nsmSubTab);
    expect(subTab).toBe('nsm-step2');
  });

  // ── Gate API Error (network/500) ─────────────────────────────────────────
  test('Gate API error: error-wrap / error message visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-gate';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmGateResult = null;
      window.AppState.nsmGateLoading = false;
      window.AppState.nsmGateError = 'gate_error';
      window.AppState.nsmSession = { id: 's1' };
      window.render();
    }, { q: Q });
    // Should show error UI (banner--save-error or error block)
    await expect(page.locator('.nsm-gate-error-wrap')).toBeVisible();
  });

  // ── gate-summary shows company + NSM ────────────────────────────────────
  test('Gate result: gate-summary shows company + NSM text', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMGateState(page, GATE_OK_RESULT);
    await expect(page.locator('.gate-summary')).toBeVisible();
    await expect(page.locator('.gate-summary')).toContainText('Spotify');
    await expect(page.locator('.gate-summary')).toContainText('每月完成至少一首完整曲目播放的活躍月用戶數');
  });

  // ── phase-head eyebrow changes to 2.5 + NSM 品質審核 ─────────────────────
  test('Gate loading: phase-head shows 2.5 + NSM 品質審核', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMLoadingState(page);
    await expect(page.locator('.phase-head__num')).toContainText('2.5');
    await expect(page.locator('.phase-head__title')).toContainText('NSM 品質審核');
  });

});
