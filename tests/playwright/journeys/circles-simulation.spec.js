// tests/playwright/journeys/circles-simulation.spec.js
// Journey: Simulation mode — verify score page nav arrows + final report button
// (full 7-step simulation not run in tests; we inject state to test phase 3 + phase 4 UI)

const { test, expect } = require('@playwright/test');
const { checkPageHealth, collectConsoleErrors } = require('../helpers/metrics');
const { formatIssues, createIssue } = require('../helpers/issue-reporter');

test.describe('CIRCLES Simulation Mode', () => {
  test('simulation mode card is selectable and persists', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    const simCard = page.locator('.circles-mode-card[data-mode="simulation"]');
    await simCard.click();
    await expect(simCard).toHaveClass(/selected/);

    // Reload — localStorage should persist mode
    await page.reload();
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });
    const simCardAfterReload = page.locator('.circles-mode-card[data-mode="simulation"]');
    await expect(simCardAfterReload).toHaveClass(/selected/);
  });

  test('simulation phase 3 score page renders with nav arrows when not first step', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    // Inject AppState to simulate: simulation mode, phase 3, step index 2 (not first/last)
    await page.evaluate(() => {
      const mockScoreData = {
        totalScore: 72,
        highlight: '分析框架清楚',
        improvement: '需加強具體數據支撐',
        coachVersion: '整體方向正確，下一步可以更精準定義用戶痛點。',
        dimensions: [
          { name: '廣度', score: 75, comment: '覆蓋了主要面向' },
          { name: '深度', score: 70, comment: '可以更深入' },
          { name: '邏輯', score: 71, comment: '邏輯連貫' },
        ]
      };
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'simulation';
      window.AppState.circlesPhase = 3;
      window.AppState.circlesSimStep = 2;
      window.AppState.circlesScoreResult = mockScoreData;
      window.AppState.circlesStepScores = { 'C1': mockScoreData, 'I': mockScoreData };
      window.AppState.circlesSelectedQuestion = {
        id: 'q1', company: 'Spotify', product: '播放清單推薦',
        problem_statement: '測試題目', type: 'design'
      };
      window.AppState.circlesSession = { id: 'test-session-id', mode: 'simulation', drill_step: null };
      window.AppState.circlesDrillStep = 'I'; // step index 1
      window.render();
    });

    // Score page should show
    await page.waitForSelector('.circles-score-wrap', { timeout: 5000 });

    // Nav arrows should be visible in simulation mode
    const prevBtn = page.locator('#circles-score-prev');
    const nextBtn = page.locator('#circles-score-nav-next');
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Score number shown
    const scoreNum = page.locator('.circles-score-number');
    await expect(scoreNum).toBeVisible();
    const scoreText = await scoreNum.textContent();
    expect(parseInt(scoreText)).toBe(72);

    // 回首頁 button visible
    const homeBtn = page.locator('#circles-score-home');
    await expect(homeBtn).toBeVisible();
  });

  test('simulation last step (S) shows 查看總結報告 button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    await page.evaluate(() => {
      const mockScoreData = {
        totalScore: 80,
        highlight: '總結清晰有力',
        improvement: '建議加強數據量化',
        coachVersion: '整體表現優秀，完成全部 7 個步驟。',
        dimensions: []
      };
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'simulation';
      window.AppState.circlesPhase = 3;
      window.AppState.circlesSimStep = 6; // last step index
      window.AppState.circlesScoreResult = mockScoreData;
      window.AppState.circlesStepScores = {
        'C1': mockScoreData, 'I': mockScoreData, 'R': mockScoreData,
        'C2': mockScoreData, 'L': mockScoreData, 'E': mockScoreData, 'S': mockScoreData
      };
      window.AppState.circlesSelectedQuestion = {
        id: 'q1', company: 'Spotify', product: '播放清單推薦',
        problem_statement: '測試題目', type: 'design'
      };
      window.AppState.circlesSession = { id: 'test-session-id', mode: 'simulation', drill_step: null };
      window.AppState.circlesDrillStep = 'S'; // last step key
      window.render();
    });

    await page.waitForSelector('.circles-score-wrap', { timeout: 5000 });

    // Should show 查看總結報告 button (not 繼續下一步)
    const finalBtn = page.locator('#circles-score-final');
    await expect(finalBtn).toBeVisible();
    const finalBtnText = await finalBtn.textContent();
    expect(finalBtnText).toContain('總結報告');

    // Should NOT show 繼續下一步
    const nextBtn = page.locator('#circles-score-next');
    expect(await nextBtn.count()).toBe(0);
  });

  test('phase 4 loading state renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    // Set phase 4 with no report yet (will trigger fetch, show loading)
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'simulation';
      window.AppState.circlesPhase = 4;
      window.AppState.circlesFinalReport = null;
      window.AppState.circlesStepScores = {
        'C1': { totalScore: 78 }, 'I': { totalScore: 82 }, 'R': { totalScore: 75 },
        'C2': { totalScore: 70 }, 'L': { totalScore: 85 }, 'E': { totalScore: 68 }, 'S': { totalScore: 80 }
      };
      window.AppState.circlesSelectedQuestion = {
        id: 'q1', company: 'Spotify', product: '播放清單推薦',
        problem_statement: '測試題目', type: 'design'
      };
      window.AppState.circlesSession = { id: 'test-session-id', mode: 'simulation', drill_step: null };
      window.render();
    });

    // Final report page should show (loading or content)
    // Navigation bar title should say 完整模擬 or 總結報告
    await page.waitForSelector('.circles-nav', { timeout: 5000 });
    const navTitle = page.locator('.circles-nav-title');
    await expect(navTitle).toBeVisible();
    const titleText = await navTitle.textContent();
    expect(titleText).toContain('報告');

    // 回首頁 button should be visible
    const homeBtn = page.locator('#circles-final-home');
    // It appears once content loads or in error state
    // Just confirm no overflow while loading
    const healthIssues = await checkPageHealth(page);
    const overflowIssues = healthIssues.filter(h => h.type === 'overflow');
    expect(overflowIssues).toHaveLength(0);
  });

  test('phase 4 error state shows retry button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circles-mode-card', { timeout: 10000 });

    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'simulation';
      window.AppState.circlesPhase = 4;
      window.AppState.circlesFinalReport = { _error: true };
      window.AppState.circlesSelectedQuestion = {
        id: 'q1', company: 'Spotify', product: '播放清單推薦',
        problem_statement: '測試題目', type: 'design'
      };
      window.AppState.circlesSession = { id: 'test-session-id', mode: 'simulation', drill_step: null };
      window.render();
    });

    // Error state should show retry button
    await page.waitForSelector('#circles-final-retry', { timeout: 5000 });
    const retryBtn = page.locator('#circles-final-retry');
    await expect(retryBtn).toBeVisible();

    // Error text
    const errorText = page.locator('[style*="color:#D92020"], [style*="color: #D92020"]').or(
      page.locator('[style*="danger"]')
    );
    // Just confirm retry btn is there as the key UX element
    await expect(retryBtn).toBeEnabled();
  });
});
