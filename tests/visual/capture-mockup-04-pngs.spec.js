// Temporary capture spec — produces 32 PNGs for opus director Read (4 states × 8 viewport).
// Run from this worktree only. Deleted after Read.
const { test } = require('@playwright/test');
const fs = require('fs');

const VPS = [
  { name: 'Mobile-360',    w: 360,  h: 780  },
  { name: 'iPhone-SE',     w: 375,  h: 667  },
  { name: 'iPhone-14',     w: 390,  h: 844  },
  { name: 'iPhone-15-Pro', w: 430,  h: 932  },
  { name: 'iPad',          w: 768,  h: 1024 },
  { name: 'Desktop-1280',  w: 1280, h: 800  },
  { name: 'Desktop-1440',  w: 1440, h: 900  },
  { name: 'Desktop-2560',  w: 2560, h: 1440 },
];

const SAMPLE_OK = {
  items: [
    { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: '聚焦免費版廣告體驗，不含付費' },
    { field: '時間範圍', status: 'ok', title: '週期合理', reason: '60 天對應月活動節奏' },
    { field: '業務影響', status: 'ok', title: '量化紅線', reason: '收入 3% 不能下降' },
    { field: '假設確認', status: 'ok', title: '可驗證', reason: '時段假設清晰' },
  ],
  canProceed: true,
  overallStatus: 'ok',
};
const SAMPLE_WARN = {
  items: [
    { field: '問題範圍', status: 'ok',   title: '邊界清晰', reason: 'OK' },
    { field: '時間範圍', status: 'warn', title: '可更具體', reason: '為何 60 天', suggestion: '解釋業務週期理由' },
    { field: '業務影響', status: 'ok',   title: '量化紅線', reason: 'OK' },
    { field: '假設確認', status: 'warn', title: '需補假設', reason: '只有 1 條',     suggestion: '補 2-3 條依賴假設' },
  ],
  canProceed: true,
  overallStatus: 'warn',
};
const SAMPLE_ERROR = {
  items: [
    { field: '問題範圍', status: 'error', title: '邊界錯誤', reason: '範圍過廣含付費端', suggestion: '聚焦免費版單一場景' },
    { field: '時間範圍', status: 'ok',    title: '週期合理', reason: 'OK' },
    { field: '業務影響', status: 'ok',    title: '量化紅線', reason: 'OK' },
    { field: '假設確認', status: 'ok',    title: '可驗證', reason: 'OK' },
  ],
  canProceed: true,
  overallStatus: 'error',
};

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setStateAndRender(page, gateState) {
  await page.evaluate(({ gateState }) => {
    window.AppState.circlesMode = 'drill';
    window.AppState.circlesDrillStep = 'C1';
    window.AppState.circlesSelectedQuestion = { id: 'q1', company: 'Spotify', product: 'Spotify Podcast' };
    window.AppState.circlesPhase = 1.5;
    window.AppState.circlesGateResult = gateState.result;
    window.AppState.circlesGateLoading = !!gateState.loading;
    window.AppState.circlesGateError = gateState.error || null;
    window.render();
  }, { gateState });
}

test.describe('Capture mockup 04 PNGs (4 states × 8 viewport = 32)', () => {
  fs.mkdirSync('audit/png-mockup-04', { recursive: true });

  for (const vp of VPS) {
    test(`gate-ok ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await setupRoutes(page);
      await page.goto('/');
      await page.waitForSelector('.qcard');
      await setStateAndRender(page, { result: SAMPLE_OK });
      await page.waitForSelector('.gate-content', { timeout: 5000 });
      await page.screenshot({ path: `audit/png-mockup-04/gate-ok-${vp.name}.png`, fullPage: true });
    });

    test(`gate-warn ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await setupRoutes(page);
      await page.goto('/');
      await page.waitForSelector('.qcard');
      await setStateAndRender(page, { result: SAMPLE_WARN });
      await page.waitForSelector('.gate-content', { timeout: 5000 });
      await page.screenshot({ path: `audit/png-mockup-04/gate-warn-${vp.name}.png`, fullPage: true });
    });

    test(`gate-error ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await setupRoutes(page);
      await page.goto('/');
      await page.waitForSelector('.qcard');
      await setStateAndRender(page, { result: SAMPLE_ERROR });
      await page.waitForSelector('.gate-content', { timeout: 5000 });
      await page.screenshot({ path: `audit/png-mockup-04/gate-error-${vp.name}.png`, fullPage: true });
    });

    test(`gate-loading ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await setupRoutes(page);
      await page.goto('/');
      await page.waitForSelector('.qcard');
      await setStateAndRender(page, { loading: true, result: null });
      await page.waitForSelector('.gate-spinner', { timeout: 5000 });
      await page.screenshot({ path: `audit/png-mockup-04/gate-loading-${vp.name}.png`, fullPage: true });
    });
  }
});
