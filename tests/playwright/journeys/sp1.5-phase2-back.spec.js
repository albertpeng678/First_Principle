'use strict';

const { test, expect } = require('@playwright/test');

const ENV_BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('SP1.5 phase2 back button (B2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENV_BASE);
    await page.evaluate(() => {
      window.AppState = window.AppState || {};
      window.AppState.circlesSelectedQuestion = {
        id: 'circles_001', company: 'Spotify', product: 'Spotify Podcast',
        problem_statement: 'Phase 2 back test',
        analysis: { business: 'a', users: 'b', insight: 'c' }
      };
      window.AppState.circlesFrameworkDraft = {
        '問題範圍': 'preserved-scope',
        '業務影響': 'preserved-impact',
        '時間範圍': 'preserved-window',
        '假設確認': 'preserved-hypothesis'
      };
      window.AppState.circlesConversation = [
        { userMessage: 'preserved-message-1', interviewee: 'preserved-reply-1', coaching: 'c1', hint: 'h1' }
      ];
      window.AppState.circlesStepScores = {};  // unlocked
      window.AppState.circlesSession = { id: 'mock-test-session-id', mode: 'drill', drill_step: 'C1' };
      window.AppState.circlesPhase = 2;
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesMode = 'drill';
      if (typeof navigate === 'function') navigate('circles');
    });
    await page.waitForTimeout(200);
  });

  test('上一步 button visible in phase 2 ungraded', async ({ page }) => {
    await expect(page.locator('#circles-p2-prev-phase')).toBeVisible();
    await expect(page.locator('#circles-p2-prev-phase')).toContainText('上一步');
  });

  test('clicking 上一步 navigates to phase 1 with framework prefilled', async ({ page }) => {
    await page.click('#circles-p2-prev-phase');
    await page.waitForTimeout(200);
    const phase = await page.evaluate(() => window.AppState.circlesPhase);
    expect(phase).toBe(1);
    // Framework draft preserved
    const draft = await page.evaluate(() => window.AppState.circlesFrameworkDraft);
    expect(draft['問題範圍']).toBe('preserved-scope');
  });

  test('conversation preserved after returning to phase 2', async ({ page }) => {
    await page.click('#circles-p2-prev-phase');
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.AppState.circlesPhase = 2; navigate('circles'); });
    await page.waitForTimeout(200);
    const conv = await page.evaluate(() => window.AppState.circlesConversation);
    expect(conv).toHaveLength(1);
    expect(conv[0].userMessage).toBe('preserved-message-1');
  });
});
