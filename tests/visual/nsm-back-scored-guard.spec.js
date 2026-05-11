const { test, expect } = require('@playwright/test');

async function setupScoredSession(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  // Set up a scored session at Step 4
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 4,
      nsmSelectedQuestion: { id: 'q17', company: 'Zoom', product: '視訊會議 SaaS', question_type: 'saas' },
      nsmDefinition: '每週使用Zoom 完成一場會議的用戶數',
      nsmBreakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
      nsmEvalResult: { totalScore: 80, coachTree: { nsm: 'coach', reach: 'r', depth: 'd', frequency: 'f', impact: 'i' }, coachRationale: {} },
      nsmSession: { id: 'sess-scored-1' },
    });
    window.render();
  });
  await page.waitForTimeout(200);
}

test('Bug X-Back T1: scored session + navbar NSM tab → nsmStep must NOT reset to 1', async ({ page }) => {
  await setupScoredSession(page);

  // Verify we start at Step 4 (scored state)
  const stepBefore = await page.evaluate(() => window.AppState.nsmStep);
  expect(stepBefore).toBe(4);

  // Click navbar NSM tab (simulates user clicking the NSM tab while already on scored Step 4)
  // Navigate away first so the tab click is meaningful
  await page.evaluate(() => {
    window.AppState.view = 'circles';
    window.render();
  });
  await page.waitForTimeout(100);

  // Now click the NSM navbar tab (use evaluate click to bypass mobile scrollability check)
  await page.locator('[data-nav="nsm"]').first().evaluate(el => el.click());
  await page.waitForTimeout(200);

  const stepAfter = await page.evaluate(() => window.AppState.nsmStep);
  // With scored session: nsmStep must NOT be 1 — should be 4 (redirected to report)
  expect(stepAfter).not.toBe(1);
  expect(stepAfter).toBe(4);
});

test('Bug X-Back T2: CIRCLES→NSM CTA clears scored state for fresh entry', async ({ page }) => {
  await setupScoredSession(page);

  // Start from CIRCLES home view
  await page.evaluate(() => {
    window.AppState.view = 'circles';
    window.render();
  });
  await page.waitForTimeout(200);

  // Click the NSM promo CTA on CIRCLES home
  await page.evaluate(() => {
    var cta = document.querySelector('[data-circles="nsm-promo"]');
    if (cta) cta.click();
  });
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => ({
    nsmStep: window.AppState.nsmStep,
    nsmEvalResult: window.AppState.nsmEvalResult,
    nsmSelectedQuestion: window.AppState.nsmSelectedQuestion,
  }));

  // CTA must produce a CLEAN fresh entry:
  // - nsmStep = 1 (Step 1 question picker)
  // - nsmEvalResult cleared (no prior scored data leaking in)
  // - nsmSelectedQuestion cleared
  expect(state.nsmStep).toBe(1);
  expect(state.nsmEvalResult).toBeNull();
  expect(state.nsmSelectedQuestion).toBeNull();
});

test('Bug X-Back T3: CTA from CIRCLES home clears ALL NSM state (no stale leak)', async ({ page }) => {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  // Seed a "dirty" state across all NSM keys (matching canonical 回首頁 handler key set)
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'circles',
      nsmSelectedQuestion: { id: 'q-old', company: 'StaleCo' },
      nsmDefinition: { nsm: 'old', explanation: 'old', businessLink: 'old' },
      nsmBreakdown: { reach: 'old', depth: 'old', frequency: 'old', impact: 'old' },
      nsmEvalResult: { totalScore: 80, coachTree: {} },
      nsmGateResult: { items: [{ status: 'error' }] },
      nsmActiveCompareNode: 'nsm',
      nsmSession: { id: 'old-session' },
      nsmStep: 4,
      nsmSubTab: 'nsm-step3',
      nsmReportTab: 'comparison',
    });
    window.render();
  });
  await page.waitForTimeout(200);
  // Click the NSM promo CTA
  await page.evaluate(() => {
    var cta = document.querySelector('[data-circles="nsm-promo"]');
    if (cta) cta.click();
  });
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    nsmSelectedQuestion: window.AppState.nsmSelectedQuestion,
    nsmEvalResult: window.AppState.nsmEvalResult,
    nsmGateResult: window.AppState.nsmGateResult,
    nsmActiveCompareNode: window.AppState.nsmActiveCompareNode,
    nsmSession: window.AppState.nsmSession,
    nsmSubTab: window.AppState.nsmSubTab,
    nsmReportTab: window.AppState.nsmReportTab,
    nsmStep: window.AppState.nsmStep,
  }));
  expect(state.nsmSelectedQuestion).toBeNull();
  expect(state.nsmEvalResult).toBeNull();
  expect(state.nsmGateResult).toBeNull();
  expect(state.nsmActiveCompareNode).toBeNull();
  expect(state.nsmSession).toBeNull();
  expect(state.nsmSubTab).toBeNull();
  expect(state.nsmReportTab).toBe('overview');
  expect(state.nsmStep).toBe(1);
});
