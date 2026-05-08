// Capture Phase 1 form for visual regression check after P1 pre-flight change.
// Output: audit/png-p1-preflight/phase1-{mobile-360,tablet-768,desktop-1280}.png
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../audit/png-p1-preflight');

const VIEWPORTS = [
  { name: 'mobile-360',   width: 360,  height: 1100 },
  { name: 'tablet-768',   width: 768,  height: 1100 },
  { name: 'desktop-1280', width: 1280, height: 1100 },
];

test('capture Phase 1 form post pre-flight — 3 vp', async ({ page }) => {
  test.setTimeout(60000);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/guest-circles-sessions/draft', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    id: 'sess-p1-png', question_id: 'q1', mode: 'drill', drill_step: 'C1', status: 'active',
    current_phase: 1, sim_step_index: 0, step_drafts: {}, framework_draft: {},
  }) }));

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 1,
        circlesMode: 'drill',
        circlesDrillStep: 'C1',
        circlesSimStep: 0,
        circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
        circlesFrameworkDraft: {},
        circlesSession: null,
      });
      window.renderApp();
    });
    await page.waitForSelector('.rt-textarea');
    await page.waitForTimeout(500); // pre-flight POST resolves; verify no UI flicker
    await page.screenshot({ path: path.join(OUT_DIR, `phase1-${vp.name}.png`), fullPage: false });
  }
});
