// tests/playwright/journeys/nsm-step4-mobile-compare.spec.js
// Phase 6: NSM Step 4 對比 tab — mobile vertical stack + bottom sheet
const { test, expect } = require('@playwright/test');

// iPhone 15 Pro per spec request
const MOBILE = { width: 393, height: 852 };
const DESKTOP = { width: 1440, height: 900 };
const BASE_URL = process.env.PMD_BASE_URL || 'http://localhost:4000';

async function gotoNSMStep4Compare(page) {
  await page.goto(BASE_URL + '/?guest=1');
  await page.waitForSelector('#app', { state: 'attached' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    AppState.view = 'nsm';
    AppState.nsmStep = 4;
    var nsmQs = (typeof NSM_QUESTIONS !== 'undefined' ? NSM_QUESTIONS : []);
    AppState.nsmSelectedQuestion = nsmQs[0] || { id: 'q1', company: 'Netflix', industry: '內容訂閱制', scenario: '測試情境', coach_nsm: '測試NSM', anti_patterns: [] };
    AppState.nsmNsmDraft = '使用者每週觀看時長';
    AppState.nsmBreakdownDraft = { activation: 'A', engagement: 'E', retention: 'R', monetization: 'M' };
    AppState.nsmSession = AppState.nsmSession || {};
    AppState.nsmSession.scores_json = {
      totalScore: 70,
      scores: { alignment: 4, leading: 3, actionability: 4, simplicity: 4, sensitivity: 3 },
      coachComments: { alignment: 'good', leading: 'ok', actionability: 'good', simplicity: 'good', sensitivity: 'ok' },
      bestMove: '示例最佳動作',
      mainTrap: '示例陷阱',
      summary: '示例總評',
      coachTree: { nsm: '示例NSM', activation: '激活', engagement: '互動', retention: '留存', monetization: '變現' },
      coachRationale: { nsm: '此 NSM 反映核心價值', activation: '促使新用戶回訪', engagement: '深度參與', retention: '長期留存', monetization: '變現轉化' },
    };
    AppState.nsmSession.user_nsm = AppState.nsmNsmDraft;
    AppState.nsmSession.user_breakdown = AppState.nsmBreakdownDraft;
    AppState.nsmReportTab = 'comparison';
    document.body.dataset.view = 'nsm';
    render();
  });
  await page.waitForTimeout(400);
}

test.describe('Phase 6 — NSM Step 4 對比 tab mobile bottom-sheet', () => {
  test('mobile renders vertical stack (.nsm-compare-mobile-stack) and a sheet shell', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await gotoNSMStep4Compare(page);
    await expect(page.locator('.nsm-compare-mobile-stack')).toHaveCount(1);
    await expect(page.locator('.nsm-detail-sheet')).toHaveCount(1);
  });

  test('clicking a compare card opens the bottom sheet', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await gotoNSMStep4Compare(page);
    const sheet = page.locator('.nsm-detail-sheet');
    await expect(sheet).not.toHaveClass(/(^|\s)open(\s|$)/);
    // Click first card in the mobile stack
    const firstCard = page.locator('.nsm-compare-mobile-stack .nsm-tree-node').first();
    await firstCard.click();
    await expect(sheet).toHaveClass(/(^|\s)open(\s|$)/);
    // Sheet should contain detail content
    await expect(sheet.locator('.nsm-detail-metric')).toBeVisible();
  });

  test('clicking backdrop closes the sheet', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await gotoNSMStep4Compare(page);
    const sheet = page.locator('.nsm-detail-sheet');
    const firstCard = page.locator('.nsm-compare-mobile-stack .nsm-tree-node').first();
    await firstCard.click();
    await expect(sheet).toHaveClass(/(^|\s)open(\s|$)/);
    // Click backdrop
    await page.locator('.nsm-detail-sheet-backdrop').click();
    await expect(sheet).not.toHaveClass(/(^|\s)open(\s|$)/);
  });

  test('desktop does NOT render mobile stack (regression)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoNSMStep4Compare(page);
    await expect(page.locator('.nsm-compare-mobile-stack')).toHaveCount(0);
    // Desktop layout still present
    await expect(page.locator('.nsm-step4-desktop')).toHaveCount(1);
  });
});
