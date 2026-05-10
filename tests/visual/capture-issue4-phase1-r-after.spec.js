// capture-issue4-phase1-r-after.spec.js
// Issue 4 — inline coaching text removal (Path A, 2026-05-10)
// Captures Phase 1 R step at 3 viewports to verify no inline hint text remains.
// Output: audit/png-issue-4-after-{viewport}.png

const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../../audit');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile-360',  width: 360,  height: 780 },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

test('capture Phase 1 R step — no inline hint text (issue 4)', async ({ page }) => {
  test.setTimeout(60000);

  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/guest-circles-sessions/draft', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'sess-issue4', question_id: 'q1', mode: 'drill', drill_step: 'R', status: 'active',
      current_phase: 1, sim_step_index: 2, step_drafts: {}, framework_draft: {},
    })
  }));

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 1,
        circlesMode: 'drill',
        circlesDrillStep: 'R',
        circlesSimStep: 2,
        circlesSelectedQuestion: {
          id: 'q1',
          company: 'Spotify',
          product: 'Spotify Podcast',
          question_type: 'design',
          title: '如何提升 Spotify Podcast 的用戶留存率？',
          industry: '訂閱平台',
          type: 'attention',
        },
        circlesFrameworkDraft: {},
        circlesSession: null,
      });
      window.renderApp();
    });
    await page.waitForSelector('.rt-textarea', { timeout: 8000 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, `png-issue-4-after-${vp.name}.png`),
      fullPage: true
    });
  }
});
