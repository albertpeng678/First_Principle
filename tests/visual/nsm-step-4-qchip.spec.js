// TDD spec — B1: NSM Step 4 qchip wire
// RED: expects .qchip to render with correct company + scenario text.
// Mirrors capture-nsm-step-4-pngs.spec.js AppState injection pattern.
const { test, expect } = require('@playwright/test');

const Q_ATTENTION = {
  id: 'q-spotify',
  company: 'Spotify',
  industry: '音樂串流',
  scenario: '為 Spotify Podcast 業務定義北極星指標，目標是衡量新用戶能否養成日常收聽習慣。',
  product: 'Spotify Podcast'
};

const MOCK_EVAL_RESULT = {
  scores: { alignment: 4, leading: 4, actionability: 5, simplicity: 4, sensitivity: 3 },
  totalScore: 80,
  coachComments: {
    alignment: '與商業價值連結清楚。',
    leading: '是領先指標。',
    actionability: '可被直接優化。',
    simplicity: '指標名稱清楚。',
    sensitivity: '尚可，但缺乏 milestone。'
  },
  coachTree: {
    nsm: '每月新增啟動並留存到第 30 天的 Premium 試用者數',
    reach: '所有曝過情境式提示的 Free 用戶（月活）',
    depth: '看到提示後進入 Premium 試用頁的轉化率',
    frequency: '試用期內每週啟動 Premium 功能的天數 ≥ 4 天',
    impact: '試用結束後 30 天內完成訂閱的轉換率'
  },
  coachRationale: {
    nsm: '教練版聚焦啟動→留存。',
    reach: '觸及廣度量到核心功能。',
    depth: '深度衡量真實意圖。',
    frequency: '確保黏著行為形成。',
    impact: '直接連結商業變現。'
  },
  bestMove: '把 NSM 拆成兩階段。',
  mainTrap: '指標可能被廣告觸及拉高。',
  summary: '整體扎實，建議補 milestone。'
};

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function goToNSMStep4(page) {
  await setupRoutes(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('circles_onboarding_done', '1'); } catch (_) {}
  });
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ q, evalResult }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 4;
    window.AppState.nsmReportTab = 'overview';
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
  }, { q: Q_ATTENTION, evalResult: MOCK_EVAL_RESULT });
  await page.waitForSelector('[data-nsm-step4]', { timeout: 5000 });
}

test.describe('B1 — NSM Step 4 qchip wire', () => {
  test('qchip renders inside [data-nsm-step4]', async ({ page }) => {
    await goToNSMStep4(page);

    // Primary assertion: .qchip element exists in Step 4
    const qchip = page.locator('[data-nsm-step4] .qchip');
    await expect(qchip).toBeVisible({ timeout: 3000 });

    // Pill text must be "NSM"
    const pill = qchip.locator('.qchip__pill');
    await expect(pill).toHaveText('NSM');

    // Title must contain the scenario text from nsmSelectedQuestion
    const title = qchip.locator('.qchip__title');
    await expect(title).toContainText(Q_ATTENTION.scenario);
  });
});
