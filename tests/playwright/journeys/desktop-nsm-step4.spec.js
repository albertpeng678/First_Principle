// tests/playwright/journeys/desktop-nsm-step4.spec.js
// Phase 4.6: NSM Step 4 desktop layout
const { test, expect } = require('@playwright/test');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 667 };
const BASE_URL = process.env.PMD_BASE_URL || 'http://localhost:4000';

async function gotoNSMStep4(page) {
  await page.goto(BASE_URL + '/?guest=1');
  await page.waitForSelector('#app', { state: 'attached' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    AppState.view = 'nsm';
    AppState.nsmStep = 4;
    var nsmQs = (typeof NSM_QUESTIONS !== 'undefined' ? NSM_QUESTIONS : []);
    AppState.nsmSelectedQuestion = nsmQs[0] || { id: 'q1', company: 'Netflix', industry: '內容訂閱制', scenario: '測試情境', coach_nsm: '測試NSM', anti_patterns: [] };
    AppState.nsmSession = AppState.nsmSession || {};
    AppState.nsmSession.scores_json = {
      totalScore: 70,
      scores: { alignment: 4, leading: 3, actionability: 4, simplicity: 4, sensitivity: 3 },
      coachComments: { alignment: 'good', leading: 'ok', actionability: 'good', simplicity: 'good', sensitivity: 'ok' },
      bestMove: '示例最佳動作',
      mainTrap: '示例陷阱',
      summary: '示例總評',
      coachTree: { nsm: '示例NSM', activation: '激活', engagement: '互動', retention: '留存', monetization: '變現' },
    };
    AppState.nsmReportTab = 'overview';
    document.body.dataset.view = 'nsm';
    render();
  });
  await page.waitForTimeout(400);
}

test.describe('Phase 4.6 desktop NSM Step 4', () => {
  test('NSM Step 4 has nsm-step4-desktop class on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoNSMStep4(page);
    await expect(page.locator('.nsm-step4-desktop')).toHaveCount(1);
  });

  test('NSM Step 4 mobile does NOT have desktop class', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await gotoNSMStep4(page);
    await expect(page.locator('.nsm-step4-desktop')).toHaveCount(0);
  });

  test('no JS console errors on desktop NSM step 4', async ({ page }) => {
    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error' && !/Failed to load resource|404/.test(m.text())) errors.push(m.text());
    });
    await page.setViewportSize(DESKTOP);
    await gotoNSMStep4(page);
    expect(errors).toEqual([]);
  });
});
