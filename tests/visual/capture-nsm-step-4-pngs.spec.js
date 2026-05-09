// Capture NSM Step 4 PNGs — uses playwright.config.js project viewport.
// 5 sections (A overview / B comparison / B' coach-expand / C highlights / D done) × 8 viewports = 40 PNGs
const { test } = require('@playwright/test');
const fs = require('fs');

const Q_ATTENTION = {
  id: 'q-spotify',
  company: 'Spotify',
  industry: '音樂串流',
  scenario: '為 Spotify Podcast 定義北極星指標，衡量用戶收聽行為與留存',
  product: 'Spotify Podcast'
};

const MOCK_EVAL_RESULT = {
  scores: {
    alignment: 4,
    leading: 4,
    actionability: 5,
    simplicity: 4,
    sensitivity: 3
  },
  totalScore: 80,
  coachComments: {
    alignment: '與商業價值連結清楚，能直接對應產品 PMF 階段。',
    leading: '是領先指標，但可進一步驗證與留存的因果關係。',
    actionability: '可被 PM/設計團隊每日直接優化，定義具體可量測。',
    simplicity: '指標名稱清楚，但定義公式可進一步簡化。',
    sensitivity: '對週期敏感度尚可，但缺乏 30/60/90 day milestone。'
  },
  coachTree: {
    nsm: '每月新增啟動並留存到第 30 天的 Premium 試用者數',
    reach: '所有曝過情境式提示的 Free 用戶（月活）',
    depth: '看到提示後進入 Premium 試用頁的轉化率',
    frequency: '試用期內每週啟動 Premium 功能的天數 ≥ 4 天',
    impact: '試用結束後 30 天內完成訂閱的轉換率'
  },
  coachRationale: {
    nsm: '教練版 NSM 聚焦於「啟動 → 留存到 30 天」，而非廣泛的月活躍，因為後者容易被短期廣告觸及拉高。',
    reach: '觸及廣度應量到真正接觸到核心功能（升級提示）的用戶，而非平台總曝光。',
    depth: '深度指標應衡量從看到提示到真正進入試用頁的轉化，反映真實意圖。',
    frequency: '習慣頻率以「試用期內每週 ≥ 4 天啟動 Premium 功能」，確保黏著行為形成。',
    impact: '業務影響以 30 天內付費轉換率，直接連結商業變現。'
  },
  bestMove: '把 NSM 拆成「啟用 → 留存」兩階段，準確反映漏斗本質，比單純看總人數更能驅動產品決策。',
  mainTrap: '指標可能被「短期廣告觸及」拉高，建議搭配真實互動數據（如試用期內每週啟動天數）佐證。',
  summary: '整體 NSM 設計扎實，能反映產品健康。下一步建議補上 milestone 與虛榮檢驗以強化指標可信度。'
};

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function goToNSMStep4(page, tab) {
  await setupRoutes(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('circles_onboarding_done', '1'); } catch (_) {}
  });
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ q, evalResult, tabName }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 4;
    window.AppState.nsmReportTab = tabName;
    window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmDefinition = {
      nsm: '每月活躍 Premium 試用者數',
      explanation: '定義說明字數需要夠長才能通過最低驗證要求',
      businessLink: '業務連結說明需要夠長才能通過最低驗證要求'
    };
    window.AppState.nsmBreakdown = {
      reach: '所有 Spotify 月活用戶',
      depth: '點擊試用按鈕進入試用頁的人數',
      frequency: '試用期間每週使用天數',
      impact: '試用後付費轉換率'
    };
    window.AppState.nsmEvalResult = evalResult;
    window.AppState.nsmActiveCompareNode = null;
    window.render();
  }, { q: Q_ATTENTION, evalResult: MOCK_EVAL_RESULT, tabName: tab });
  await page.waitForSelector('[data-nsm-step4]', { timeout: 5000 });
}

test.describe('Capture NSM Step 4 PNGs', () => {
  fs.mkdirSync('audit/png-mockup-14', { recursive: true });

  test('A-overview', async ({ page }, testInfo) => {
    await goToNSMStep4(page, 'overview');
    await page.waitForSelector('.nsm-overview', { timeout: 3000 });
    await page.screenshot({ path: `audit/png-mockup-14/A-overview-${testInfo.project.name}.png`, fullPage: true });
  });

  test('B-comparison', async ({ page }, testInfo) => {
    await goToNSMStep4(page, 'comparison');
    await page.waitForSelector('.nsm-compare', { timeout: 3000 });
    await page.screenshot({ path: `audit/png-mockup-14/B-comparison-${testInfo.project.name}.png`, fullPage: true });
  });

  test('B-prime-coach-expand', async ({ page }, testInfo) => {
    await goToNSMStep4(page, 'comparison');
    await page.waitForSelector('.nsm-compare', { timeout: 3000 });
    // Click the first coach card to expand thinking panel
    const coachCard = page.locator('.nsm-compare-card--coach').first();
    await coachCard.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `audit/png-mockup-14/B-prime-coach-${testInfo.project.name}.png`, fullPage: true });
  });

  test('C-highlights', async ({ page }, testInfo) => {
    await goToNSMStep4(page, 'highlights');
    await page.waitForSelector('.nsm-highlights', { timeout: 3000 });
    await page.screenshot({ path: `audit/png-mockup-14/C-highlights-${testInfo.project.name}.png`, fullPage: true });
  });

  test('D-done', async ({ page }, testInfo) => {
    await goToNSMStep4(page, 'done');
    await page.waitForSelector('.done-panel', { timeout: 3000 });
    await page.screenshot({ path: `audit/png-mockup-14/D-done-${testInfo.project.name}.png`, fullPage: true });
  });
});
