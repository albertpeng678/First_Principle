'use strict';
const { test, expect } = require('@playwright/test');
const ENV_BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('SP1.5-bugfix scroll-clearance', () => {
  test('phase 2 stale: last bubble visible above sticky action-bar', async ({ page }) => {
    await page.goto(ENV_BASE);
    await page.evaluate(() => {
      window.AppState = window.AppState || {};
      window.AppState.circlesStale = true;
      window.AppState.circlesSelectedQuestion = { id: 'q', company: 'X', product: 'Y', problem_statement: 'Z', analysis: {} };
      window.AppState.circlesSession = { id: 'mock', mode: 'drill', drill_step: 'C1' };
      window.AppState.circlesPhase = 2;
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesStepScores = { C1: { totalScore: 65 } };
      window.AppState.circlesConversation = Array.from({ length: 6 }, (_, i) => ({
        userMessage: 'Q' + (i + 1) + ': 用戶問題重複內容', interviewee: '回答內容'.repeat(20), coaching: '點評內容'.repeat(15), hint: ''
      }));
      if (typeof navigate === 'function') navigate('circles');
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const body = document.querySelector('.circles-chat-body');
      if (body) body.scrollTop = body.scrollHeight;
    });
    await page.waitForTimeout(200);

    const lastBubble = page.locator('.circles-bubble-ai').last();
    await expect(lastBubble).toBeInViewport();
    await expect(page.locator('.stale-action-bar')).toBeInViewport();

    // last bubble bottom must be at or above the sticky bar top
    const bubbleBottom = await lastBubble.evaluate(el => el.getBoundingClientRect().bottom);
    const barTop = await page.locator('.stale-action-bar').evaluate(el => el.getBoundingClientRect().top);
    expect(bubbleBottom).toBeLessThanOrEqual(barTop);
  });
});
