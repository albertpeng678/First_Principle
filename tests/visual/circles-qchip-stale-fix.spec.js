const { test, expect } = require('@playwright/test');

test.describe('CIRCLES qchip-expand stale snapshot fallback', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  });

  test('renderQchipExpand falls back to fresh DB lookup when session.question_json lacks analysis', async ({ page }) => {
    const staleSession = {
      id: 's-stale-1',
      question_id: 'circles_001',
      question_json: {
        id: 'circles_001',
        company: 'Spotify',
        product: 'Spotify Podcast',
        problem_statement: '設計一個新功能，提升用戶在 Spotify 上的 Podcast 體驗',
        // NOTE: no .analysis field
      },
      mode: 'drill',
      drill_step: 'C1',
      current_phase: 1,
      step_drafts: {},
      framework_draft: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, body: JSON.stringify([staleSession]) }));
    await page.route('**/api/(guest-)?circles-sessions/s-stale-1', r => r.fulfill({ status: 200, body: JSON.stringify(staleSession) }));
    await page.route('**/api/(guest-)?circles-sessions/s-stale-1/**', r => r.fulfill({ status: 200, body: JSON.stringify(staleSession) }));
    await page.route('**/api/(guest-)?nsm-sessions**', r => r.fulfill({ status: 200, body: '[]' }));

    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');

    // Use page.evaluate to restore stale session directly (matches existing test conventions)
    await page.evaluate((session) => {
      window.AppState.view = 'circles';
      window.AppState.circlesPhase = 1;
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = session.question_json;
      window.AppState.circlesSession = session;
      window.AppState.circlesChipExpanded = true;
      window.render();
    }, staleSession);

    await page.waitForSelector('.qchip-expand', { timeout: 5000 });

    // Verify all 4 ana bodies have content (not empty strings)
    const bodies = await page.locator('.qchip-ana__body').allTextContents();
    expect(bodies.length).toBe(4);
    bodies.forEach((text, idx) => {
      expect(text.trim().length).toBeGreaterThan(0);
    });
  });

  test('renderQchipExpand uses session analysis when present (no fallback needed)', async ({ page }) => {
    const freshSession = {
      id: 's-fresh-1',
      question_id: 'circles_001',
      question_json: {
        id: 'circles_001',
        company: 'Spotify',
        product: 'Spotify Podcast',
        problem_statement: '設計一個新功能',
        analysis: {
          business: 'CUSTOM-business-from-session',
          users: 'CUSTOM-users-from-session',
          traps: 'CUSTOM-traps-from-session',
          insight: 'CUSTOM-insight-from-session',
        },
      },
      mode: 'drill',
      drill_step: 'C1',
      current_phase: 1,
      step_drafts: {},
      framework_draft: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, body: JSON.stringify([freshSession]) }));
    await page.route('**/api/(guest-)?nsm-sessions**', r => r.fulfill({ status: 200, body: '[]' }));

    await page.goto('/?circles_onboarding_done=1');
    await page.waitForSelector('.navbar');
    await page.evaluate((session) => {
      window.AppState.view = 'circles';
      window.AppState.circlesPhase = 1;
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = session.question_json;
      window.AppState.circlesSession = session;
      window.AppState.circlesChipExpanded = true;
      window.render();
    }, freshSession);

    await page.waitForSelector('.qchip-expand');

    // Verify session's CUSTOM analysis is preferred over fresh DB
    const bodies = await page.locator('.qchip-ana__body').allTextContents();
    expect(bodies.some(t => t.includes('CUSTOM-business-from-session'))).toBe(true);
  });
});
