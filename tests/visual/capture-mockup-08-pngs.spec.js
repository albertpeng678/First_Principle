// Capture mockup 08 PNGs — 4 sections × 8 viewports = 32 PNGs
// Sections: A-ok, B-warn, C-error, D-loading
const { test } = require('@playwright/test');
const fs = require('fs');

const Q = { id: 'q-sp', company: 'Spotify', industry: '音樂串流', scenario: '為 Spotify 定義北極星指標，衡量用戶日常收聽行為', product: 'Spotify Music' };
const DEF = { nsm: '每月完成至少一首完整曲目播放的活躍月用戶數', explanation: '聚焦真實聆聽行為，剔除背景播放', businessLink: 'NSM 上升直接對應廣告營收與留存率提升' };

const GATE_OK = {
  overall_status: 'ok', overallStatus: 'ok', canProceed: true,
  items: [
    { criterion: 'NSM定義清晰度',   status: 'ok',   feedback: '清晰定義具體用戶行為與量化門檻', suggestion: null },
    { criterion: '與業務目標的連結', status: 'ok',   feedback: '直接對應訂閱續費率提升', suggestion: null },
    { criterion: '可測量性',        status: 'ok',   feedback: '可用 Amplitude 埋點直接追蹤', suggestion: null },
    { criterion: '非虛榮指標',      status: 'ok',   feedback: '捕捉用戶 AHA 時刻的真實行為', suggestion: null },
  ],
};

const GATE_WARN = {
  overall_status: 'warn', overallStatus: 'warn', canProceed: true,
  items: [
    { criterion: 'NSM定義清晰度',   status: 'ok',   feedback: '清晰定義用戶行為', suggestion: null },
    { criterion: '與業務目標的連結', status: 'warn', feedback: '邏輯有跳躍需補充', suggestion: '說明 NSM 如何直接驅動訂閱收入，補充因果機制' },
    { criterion: '可測量性',        status: 'ok',   feedback: '可用埋點追蹤', suggestion: null },
    { criterion: '非虛榮指標',      status: 'ok',   feedback: '行為深度指標', suggestion: null },
  ],
};

const GATE_ERROR = {
  overall_status: 'error', overallStatus: 'error', canProceed: false,
  items: [
    { criterion: 'NSM定義清晰度',   status: 'error', feedback: '這是經典虛榮指標，DAU 不代表深度價值', suggestion: '改成行為深度型指標，例如「完整播放用戶數」' },
    { criterion: '與業務目標的連結', status: 'error', feedback: 'DAU 與訂閱續費相關性低', suggestion: '先找 Spotify 的 AHA 時刻動作再衍生指標' },
    { criterion: '可測量性',        status: 'warn',  feedback: '過度仰賴行銷推廣', suggestion: null },
    { criterion: '非虛榮指標',      status: 'ok',    feedback: 'DAU 直觀易懂，是唯一優點', suggestion: null },
  ],
};

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"s1","sessionId":"s1"}' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"s1","sessionId":"s1"}' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('Capture mockup 08 PNGs', () => {
  fs.mkdirSync('audit/png-mockup-08', { recursive: true });

  // Section A — Gate OK
  test('gate-ok', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q, def, gr }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-gate';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = def;
      window.AppState.nsmGateResult = gr;
      window.AppState.nsmGateLoading = false;
      window.AppState.nsmGateError = null;
      window.AppState.nsmSession = { id: 's1' };
      window.render();
    }, { q: Q, def: DEF, gr: GATE_OK });
    await page.waitForSelector('.gate-transition--ok', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-08/gate-ok-${testInfo.project.name}.png`, fullPage: true });
  });

  // Section B — Gate WARN
  test('gate-warn', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q, def, gr }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-gate';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = def;
      window.AppState.nsmGateResult = gr;
      window.AppState.nsmGateLoading = false;
      window.AppState.nsmGateError = null;
      window.AppState.nsmSession = { id: 's1' };
      window.render();
    }, { q: Q, def: DEF, gr: GATE_WARN });
    await page.waitForSelector('.gate-transition--warn', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-08/gate-warn-${testInfo.project.name}.png`, fullPage: true });
  });

  // Section C — Gate ERROR
  test('gate-error', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q, def, gr }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-gate';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = def;
      window.AppState.nsmGateResult = gr;
      window.AppState.nsmGateLoading = false;
      window.AppState.nsmGateError = null;
      window.AppState.nsmSession = { id: 's1' };
      window.render();
    }, { q: Q, def: DEF, gr: GATE_ERROR });
    await page.waitForSelector('.gate-transition--error', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-08/gate-error-${testInfo.project.name}.png`, fullPage: true });
  });

  // Section D — Gate Loading
  test('gate-loading', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q, def }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-gate';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = def;
      window.AppState.nsmGateResult = null;
      window.AppState.nsmGateLoading = true;
      window.AppState.nsmGateLoadingStep = 1;  // second step active (like mockup §D)
      window.AppState.nsmGateError = null;
      window.AppState.nsmSession = { id: 's1' };
      window.render();
    }, { q: Q, def: DEF });
    await page.waitForSelector('.gate-loading-wrap', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-08/gate-loading-${testInfo.project.name}.png`, fullPage: true });
  });
});
