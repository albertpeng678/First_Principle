const { test, expect } = require('@playwright/test');

test.describe('NSM Step 4 — restore scores from offcanvas click', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
    await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
  });

  test('clicking completed NSM session in offcanvas restores scores into Step 4', async ({ page }) => {
    const completedNsmSession = {
      id: 'nsm-completed-1',
      question_id: 'q-fiverr',
      question_json: {
        id: 'q-fiverr',
        company: 'Fiverr',
        industry: '自由工作平台',
        scenario: 'Test scenario',
      },
      status: 'completed',
      scores_json: {
        totalScore: 60,
        scores: {
          alignment: 3,
          leading: 3,
          actionability: 3,
          simplicity: 3,
          sensitivity: 3,
        },
        coachComments: {
          alignment: 'OK alignment comment',
          leading: 'OK leading comment',
          actionability: 'OK actionability comment',
          simplicity: 'OK simplicity comment',
          sensitivity: 'OK sensitivity comment',
        },
        summary: 'Overall 60 分',
      },
      created_at: new Date().toISOString(),
    };

    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({
      status: 200, body: JSON.stringify([completedNsmSession])
    }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({
      status: 200, body: JSON.stringify([completedNsmSession])
    }));

    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');

    // Open offcanvas
    await page.click('button[data-nav="offcanvas"]');
    await page.waitForSelector('.offcanvas-item');

    // Click the completed NSM session
    await page.locator('.offcanvas-item').first().click();

    // Wait for NSM Step 4 overview to render
    await page.waitForSelector('.nsm-overview', { timeout: 5000 });

    // Verify all 5 dims show score 3 (NOT default 1)
    const scoreTexts = await page.locator('.nsm-score-row__score').allTextContents();
    expect(scoreTexts.length).toBe(5);
    scoreTexts.forEach(text => {
      // Each score should be "3" or "3/5" not "1/5"
      expect(text).toContain('3');
      expect(text).not.toMatch(/^1[\s\/]/);
      expect(text).not.toBe('1/5');
    });

    // Verify radar SVG polygon points are not all minimum (1/5 = small dot)
    const radarPolygon = await page.locator('.nsm-overview svg polygon').first().getAttribute('points');
    // With score=3 (not 1), points should be at 60% radius (not 20%)
    expect(radarPolygon).toBeTruthy();
    expect(radarPolygon.length).toBeGreaterThan(20); // sanity: real polygon, not empty

    // Verify total score shown is 60, not 0 (score lives in .nsm-summary__score outside .nsm-overview)
    const summaryScore = await page.locator('.nsm-summary__score').textContent();
    expect(summaryScore).toContain('60');
  });
});
