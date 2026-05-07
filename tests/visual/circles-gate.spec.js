const { test, expect } = require('@playwright/test');

const SAMPLE_GATE_OK = {
  items: [
    { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: '聚焦免費版廣告' },
    { field: '時間範圍', status: 'ok', title: '週期合理', reason: '60 天對應月節奏' },
    { field: '業務影響', status: 'ok', title: '量化紅線', reason: '收入 3% 不能下降' },
    { field: '假設確認', status: 'ok', title: '可驗證', reason: '時段假設清晰' },
  ],
  canProceed: true,
  overallStatus: 'ok',
};
const SAMPLE_GATE_WARN = {
  items: [
    { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: 'OK' },
    { field: '時間範圍', status: 'warn', title: '可更具體', reason: '為何 60 天', suggestion: '解釋週期理由' },
    { field: '業務影響', status: 'ok', title: '量化紅線', reason: 'OK' },
    { field: '假設確認', status: 'warn', title: '需補假設', reason: '只有 1 條', suggestion: '補 2-3 條' },
  ],
  canProceed: true,
  overallStatus: 'warn',
};
const SAMPLE_GATE_ERROR = {
  items: [
    { field: '問題範圍', status: 'error', title: '邊界錯誤', reason: '範圍太廣', suggestion: '聚焦單一場景' },
    { field: '時間範圍', status: 'ok', title: 'OK', reason: 'OK' },
    { field: '業務影響', status: 'ok', title: 'OK', reason: 'OK' },
    { field: '假設確認', status: 'ok', title: 'OK', reason: 'OK' },
  ],
  canProceed: true, // sim mode allows but FE ignores
  overallStatus: 'error',
};

async function setupGateMode(page, mode, gateResult) {
  await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ mode, gateResult }) => {
    window.AppState.circlesMode = mode;
    window.AppState.circlesDrillStep = 'C1';
    window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'Spotify', product: 'Spotify Podcast' };
    window.AppState.circlesPhase = 1.5;
    window.AppState.circlesGateResult = gateResult;
    window.AppState.circlesGateLoading = false;
    window.AppState.circlesGateError = null;
    window.render();
  }, { mode, gateResult });
  await page.waitForSelector('.gate-content', { timeout: 3000 });
}

test.describe('Phase 1.5 Gate (mockup 04)', () => {
  test('OK state — 繼續 button visible, 4 ok items', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_OK);
    await expect(page.locator('.gate-transition--ok')).toBeVisible();
    await expect(page.locator('[data-gate-action="proceed"]')).toBeVisible();
    expect(await page.locator('.gate-item--ok').count()).toBe(4);
  });

  test('WARN state — 繼續 button + warn suggestions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_WARN);
    await expect(page.locator('.gate-transition--warn')).toBeVisible();
    await expect(page.locator('[data-gate-action="proceed"]')).toBeVisible();
    expect(await page.locator('.gate-item__suggestion').count()).toBeGreaterThanOrEqual(2);
  });

  test('ERROR state drill — sticky 返回修改 only, no proceed', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_ERROR);
    await expect(page.locator('.gate-transition--error')).toBeVisible();
    expect(await page.locator('[data-gate-action="proceed"]').count()).toBe(0);
    await expect(page.locator('[data-gate-action="back"]')).toBeVisible();
    expect(await page.locator('.btn').filter({ hasText: '帶風險繼續' }).count()).toBe(0);
  });

  test('ERROR state simulation — same as drill (no override)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'simulation', SAMPLE_GATE_ERROR);
    expect(await page.locator('[data-gate-action="proceed"]').count()).toBe(0);
    await expect(page.locator('[data-gate-action="back"]')).toBeVisible();
    expect(await page.locator('.btn').filter({ hasText: '帶風險繼續' }).count()).toBe(0);
  });

  test('Loading state — spinner + 4-step checklist', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1.5;
      window.AppState.circlesGateLoading = true;
      window.render();
    });
    await expect(page.locator('.gate-loading__spinner')).toBeVisible();
    expect(await page.locator('.gate-loading__checklist li').count()).toBe(4);
  });

  test('OK 繼續 click → circlesPhase = 2', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_OK);
    await page.locator('[data-gate-action="proceed"]').click();
    const phase = await page.evaluate(() => window.AppState.circlesPhase);
    expect(phase).toBe(2);
  });

  test('ERROR 返回修改 click → circlesPhase = 1, draft preserved', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_ERROR);
    await page.evaluate(() => { window.AppState.circlesFrameworkDraft = { C1: { '問題範圍': 'preserved-content' } }; });
    await page.locator('[data-gate-action="back"]').click();
    const r = await page.evaluate(() => ({ phase: window.AppState.circlesPhase, draft: window.AppState.circlesFrameworkDraft }));
    expect(r.phase).toBe(1);
    expect(r.draft.C1['問題範圍']).toBe('preserved-content');
  });

  test('Server 500 → error-wrap with retry button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1.5;
      window.AppState.circlesGateError = 'Server returned 500';
      window.AppState.circlesGateLoading = false;
      window.render();
    });
    await expect(page.locator('.error-wrap')).toBeVisible();
    await expect(page.locator('[data-gate-action="retry"]')).toBeVisible();
  });

  test('Phase head shows correct step title for I step', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ ok }) => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'I';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1.5;
      window.AppState.circlesGateResult = ok;
      window.render();
    }, { ok: SAMPLE_GATE_OK });
    await expect(page.locator('.phase-head__title')).toContainText('I · 定義用戶');
    await expect(page.locator('.phase-head__num')).toHaveText('1.5');
  });

  test('Empty draft submit → toast, no API call', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let postCount = 0;
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/**/gate', r => { postCount++; r.fulfill({ status: 200, body: '{}' }); });
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1;
      window.AppState.circlesFrameworkDraft = {};
      window.render();
      window.submitFrameworkToGate && window.submitFrameworkToGate();
    });
    await page.waitForTimeout(300);
    expect(postCount).toBe(0);
  });

  test('Mobile-360 layout — phase-head + gate-list visible', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupGateMode(page, 'drill', SAMPLE_GATE_OK);
    await expect(page.locator('.phase-head')).toBeVisible();
    await expect(page.locator('.gate-list')).toBeVisible();
    expect(await page.locator('.gate-item').count()).toBe(4);
  });

  test('Submit fires POST gate with correct body', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    var capturedBody = null;
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions/draft', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'sess-test', question_id: 'q1', mode: 'drill', drill_step: 'C1', status: 'active' }) }));
    await page.route('**/api/guest-circles-sessions/sess-test/gate', async r => {
      try { capturedBody = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ overallStatus: 'ok', items: [], canProceed: true }) });
    });
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1;
      window.AppState.circlesFrameworkDraft = { C1: { '問題範圍': '聚焦免費版' } };
      window.submitFrameworkToGate();
    });
    await page.waitForFunction(() => window.AppState.circlesPhase === 1.5 && window.AppState.circlesGateLoading === false, { timeout: 5000 });
    expect(capturedBody).toBeTruthy();
    expect(capturedBody.step).toBe('C1');
    expect(capturedBody.frameworkDraft).toBeDefined();
    expect(capturedBody.frameworkDraft['問題範圍']).toBe('聚焦免費版');
  });

  test('401 from gate → does NOT show error-wrap (multi-tab+401 banner handles)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions/draft', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'sess-401', question_id: 'q1', mode: 'drill', drill_step: 'C1', status: 'active' }) }));
    await page.route('**/api/guest-circles-sessions/sess-401/gate', r => r.fulfill({ status: 401, body: '{"error":"unauthorized"}' }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1;
      window.AppState.circlesFrameworkDraft = { C1: { '問題範圍': '測試 401' } };
      window.submitFrameworkToGate();
    });
    await page.waitForTimeout(800);
    // gate error-wrap should NOT appear (multi-tab+401 banner is handled elsewhere; gate stays in loading or returns silently)
    expect(await page.locator('.gate-content .error-wrap').count()).toBe(0);
  });

  test('Empty draft submit → banner visible 「請至少填寫一個欄位再提交審核」', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'X', product: 'Y' };
      window.AppState.circlesPhase = 1;
      window.AppState.circlesFrameworkDraft = {};
      window.render();
      window.submitFrameworkToGate();
    });
    await page.waitForTimeout(200);
    await expect(page.locator('[data-banner="empty-hint"]')).toBeVisible();
  });
});
