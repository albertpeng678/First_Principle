// tests/visual/capture-t4-qchip-sse.spec.js
// One-off screenshot capture for T4 SSE fix audit folder.
// Real Supabase + real BE; same flow as e2e spec but saves PNGs.

'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '..', '..', 'audit', 'task4-sse-fix');

async function bootApp(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });
  const stub = (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    : route.continue();
  await page.route('**/api/circles-sessions', stub);
  await page.route('**/api/nsm-sessions', stub);
  await page.route('**/api/guest-circles-sessions', stub);
  await page.route('**/api/guest/nsm-sessions', stub);
  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

test('capture qchip open before + after SSE-like re-render', async ({ page }) => {
  await bootApp(page);
  await page.waitForFunction(() => window.AppState && !!window.AppState.accessToken, { timeout: 15_000 });

  // seed real session
  await page.waitForFunction(() => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0);
  const sid = await page.evaluate(async () => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[0];
    const res = await window.apiFetch('/api/circles-sessions/draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
    });
    const s = await res.json();
    A.circlesSession = s;
    A.circlesSelectedQuestion = q;
    return s.id;
  });

  try {
    await page.evaluate(() => {
      const A = window.AppState;
      A.circlesPhase = 2;
      A.circlesMode = 'drill';
      A.circlesDrillStep = 'C1';
      A.circlesConversation = [{ role: 'coach', text: '你的目標用戶是誰？', hint: null, example: null }];
      A.circlesStepScores = {};
      A.circlesPhase2ConclusionMode = false;
      A.circlesPhase2Streaming = false;
      A.circlesChipExpanded = false;
      A.circlesPhase2QchipOpen = false;
      A.view = 'circles';
      window.render();
    });

    await expect(page.locator('[data-view="circles"][data-phase="2"]')).toBeVisible();

    // open qchip
    await page.locator('[data-phase2="qchip"]').first().click();
    await expect(page.locator('.qchip-expand').first()).toBeVisible();
    await page.screenshot({ path: path.join(AUDIT_DIR, '01-qchip-opened.png'), fullPage: true });

    // simulate SSE chunks
    for (let i = 0; i < 5; i++) {
      await page.evaluate((chunk) => {
        const A = window.AppState;
        const last = A.circlesConversation[A.circlesConversation.length - 1];
        last.text = (last.text || '') + chunk;
        A.circlesPhase2Streaming = true;
        window.render();
      }, ' chunk-' + i);
    }

    // verify still visible after re-renders
    await expect(page.locator('.qchip-expand').first()).toBeVisible();
    await page.screenshot({ path: path.join(AUDIT_DIR, '02-qchip-still-open-after-5-sse-chunks.png'), fullPage: true });

    // close → screenshot
    await page.locator('[data-phase2="qchip"]').first().click();
    await expect(page.locator('.qchip-expand').first()).toBeHidden();
    await page.screenshot({ path: path.join(AUDIT_DIR, '03-qchip-closed.png'), fullPage: true });

    // re-render after close — should stay closed
    await page.evaluate(() => window.render());
    await expect(page.locator('.qchip-expand').first()).toBeHidden();
    await page.screenshot({ path: path.join(AUDIT_DIR, '04-qchip-closed-after-rerender.png'), fullPage: true });
  } finally {
    await page.evaluate(async (s) => {
      try { await window.apiFetch('/api/circles-sessions/' + s, { method: 'DELETE' }); } catch (_) {}
    }, sid);
  }
});
