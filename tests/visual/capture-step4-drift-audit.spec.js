// capture-step4-drift-audit.spec.js — Phase A PNG capture for audit docs
// Captures 4 tabs × 3 viewports = 12 PNGs to audit/png-step4-drift-audit/
const { test } = require('@playwright/test');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '../../audit/png-step4-drift-audit');

const MOCK_EVAL = {
  scores: { alignment: 4, leading: 4, actionability: 5, simplicity: 4, sensitivity: 3 },
  totalScore: 80,
  coachComments: {
    alignment: '與商業價值連結清楚，能直接對應產品 PMF 階段。',
    leading: '是領先指標，但可進一步驗證與留存的因果關係。',
    actionability: '可被 PM/設計團隊每日直接優化，定義具體可量測。',
    simplicity: '指標名稱清楚，但定義公式可進一步簡化。',
    sensitivity: '對週期敏感度尚可，但缺乏 30/60/90 day milestone。',
  },
  coachTree: {
    nsm: '每月新增啟動並留存到第 30 天的 Premium 試用者數',
    reach: '所有曝過情境式提示的 Free 用戶（月活）',
    depth: '看到提示後進入 Premium 試用頁的轉化率',
    frequency: '試用期內每週啟動 Premium 功能的天數 ≥ 4 天',
    impact: '試用結束後 30 天內完成訂閱的轉換率',
  },
  coachRationale: {
    nsm: '教練版 NSM 聚焦於啟動留存。', reach: '觸及廣度量真正接觸核心功能用戶。',
    depth: '深度衡量從看到提示到進入試用頁轉化。', frequency: '習慣頻率每週 ≥ 4 天。',
    impact: '業務影響 30 天內付費轉換率。',
  },
  bestMove: '把 NSM 拆成「啟用 → 留存」兩階段，準確反映漏斗本質。',
  mainTrap: '指標可能被「短期廣告觸及」拉高，需真實互動數據佐證。',
  summary: '整體 NSM 設計扎實，下一步建議補上 milestone 與虛榮檢驗。',
};
const Q = { id: 'q-spotify', company: 'Spotify', industry: '音樂串流', scenario: 'Spotify Podcast NSM 訓練', product: 'Spotify Podcast' };

async function mockApis(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
}

async function setup(page, tab) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ q, evalResult, activeTab }) => {
    window.AppState.view = 'nsm'; window.AppState.nsmStep = 4;
    window.AppState.nsmReportTab = activeTab; window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmEvalResult = evalResult; window.AppState.nsmActiveCompareNode = null;
    window.AppState.nsmDefinition = { nsm: '每月活躍 Premium 試用者數', explanation: '定義說明字數需要夠長才能通過最低驗證', businessLink: '業務連結說明需要夠長才能通過最低驗證' };
    window.AppState.nsmBreakdown = { reach: '所有 Spotify 月活用戶', depth: '點擊試用按鈕進入試用頁的人數', frequency: '試用期間每週使用天數', impact: '試用後付費轉換率' };
    window.render();
  }, { q: Q, evalResult: MOCK_EVAL, activeTab: tab });
  await page.waitForSelector('[data-nsm-step4]');
}

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];
const TABS = ['overview', 'comparison', 'highlights', 'done'];

for (const vp of VIEWPORTS) {
  for (const tab of TABS) {
    test(`capture step4 ${tab} ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setup(page, tab);
      const fname = path.join(AUDIT_DIR, `step4-${tab}-${vp.name}.png`);
      await page.screenshot({ path: fname, fullPage: true });
    });
  }
}
