// Capture mockup 07 PNGs — uses playwright.config.js project viewport.
// 4 state × 8 viewport = 32 PNGs total.
const { test } = require('@playwright/test');
const fs = require('fs');

const Q_ATTENTION = { id: 'q-att', company: 'Spotify', industry: '音樂串流', scenario: '為 Spotify 定義北極星指標，衡量用戶日常收聽行為', product: 'Spotify Music' };
const Q_SAAS      = { id: 'q-saas', company: 'Slack',   industry: 'B2B SaaS',  scenario: 'Workspace activation NSM 練習', product: 'Slack' };

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('Capture mockup 07 PNGs', () => {
  fs.mkdirSync('audit/png-mockup-07', { recursive: true });

  test('step2-empty', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmSelectedQuestion = q;
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-07/step2-empty-${testInfo.project.name}.png`, fullPage: true });
  });

  test('step2-filled', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = {
        nsm: '每月完成至少一首完整曲目播放的活躍月用戶數',
        explanation: '聚焦真實聆聽行為，剔除背景播放',
        businessLink: 'NSM 上升直接對應廣告營收與留存率提升',
      };
      window.AppState.nsmExampleExpanded = { nsm: true };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-07/step2-filled-${testInfo.project.name}.png`, fullPage: true });
  });

  test('step3-attention', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: '每月活躍聆聽用戶數', explanation: 'X', businessLink: 'Y' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.AppState.nsmBreakdown = { reach: '', depth: '', frequency: '', retention: '' };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('.nsm-dim', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-07/step3-attention-${testInfo.project.name}.png`, fullPage: true });
  });

  test('step3-saas', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: 'Weekly Active Workspaces', explanation: 'X', businessLink: 'Y' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.AppState.nsmBreakdown = { reach: '', depth: '', frequency: '', retention: '' };
      window.render();
    }, { q: Q_SAAS });
    await page.waitForSelector('.nsm-dim', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-07/step3-saas-${testInfo.project.name}.png`, fullPage: true });
  });
});
