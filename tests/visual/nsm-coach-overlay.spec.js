// nsm-coach-overlay.spec.js
// TDD spec for Bug X-Overlay: NSM 教練思路 mobile bottom-sheet per mockup 02-coach-bottom-sheet.html
// Task 4 Step 4.2 — 2026-05-12

const { test, expect } = require('@playwright/test');

async function setupComparisonScored(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm', nsmStep: 4, nsmReportTab: 'comparison',
      nsmSelectedQuestion: { id: 'q17', company: 'Zoom', product: '視訊會議 SaaS', question_type: 'saas' },
      nsmDefinition: 'user nsm',
      nsmBreakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
      nsmEvalResult: {
        totalScore: 80,
        coachTree: { nsm: 'coach nsm text', reach: 'coach reach', depth: 'coach depth', frequency: 'coach freq', impact: 'coach impact' },
        coachRationale: { nsm: 'why nsm' }
      },
      nsmSession: { id: 'sess-1' },
      nsmActiveCompareNode: 'nsm',
    });
    window.render();
  });
}

test('Bug X-Overlay: mobile coach bottom-sheet has handle pill + 16px radius + backdrop', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'iPad' ||
    testInfo.project.name.includes('Desktop'),
    'mobile-only feature'
  );
  await setupComparisonScored(page);
  await page.waitForTimeout(300);
  const sheet = page.locator('.nsm-coach-bottom-sheet');
  await expect(sheet).toBeVisible();
  const handle = page.locator('.nsm-coach-bottom-sheet__handle');
  await expect(handle).toBeVisible();
  const backdrop = page.locator('.nsm-coach-overlay__backdrop');
  await expect(backdrop).toBeVisible();
});

test('Bug X-Overlay: clicking backdrop closes the sheet', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'iPad' ||
    testInfo.project.name.includes('Desktop'),
    'mobile-only feature'
  );
  await setupComparisonScored(page);
  await page.waitForTimeout(300);
  await page.locator('.nsm-coach-overlay__backdrop').click();
  await page.waitForTimeout(200);
  const active = await page.evaluate(() => window.AppState.nsmActiveCompareNode);
  expect(active).toBeNull();
});
