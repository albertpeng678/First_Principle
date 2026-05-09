// Capture offcanvas list rendering for P0 drill_step fix verification.
// Two scenarios per viewport:
//   A. POST-FIX clean: 2 drill sessions both with drill_step='C1' → both show「C 澄清」
//   B. LEGACY mixed: drill_step=null + drill_step='C1' (legacy + new) → 「步驟加練」+「C 澄清」mix
//      (documents the legacy-data fallback behavior preserved by fix)
// Output: audit/png-p0-drill-fix/offcanvas-{scenario}-{vp}.png
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../audit/png-p0-drill-fix');

const VIEWPORTS = [
  { name: 'mobile-360',     width: 360,  height: 1100 },
  { name: 'iphone-se-375',  width: 375,  height: 1100 },
  { name: 'iphone-14-390',  width: 390,  height: 1100 },
  { name: 'iphone-15-430',  width: 430,  height: 1100 },
  { name: 'tablet-768',     width: 768,  height: 1100 },
  { name: 'desktop-1280',   width: 1280, height: 1100 },
  { name: 'desktop-1440',   width: 1440, height: 1100 },
  { name: 'desktop-2560',   width: 2560, height: 1100 },
];

function makeSession(opts) {
  return {
    id: opts.id,
    question_id: opts.qid,
    question_json: { id: opts.qid, company: opts.company, product: opts.product, question_type: 'design' },
    mode: 'drill',
    drill_step: opts.drill_step,                 // ← key field under test
    current_phase: 1,
    sim_step_index: 0,
    status: 'active',
    step_drafts: { ts: opts.ts || Date.now() },
    framework_draft: { C1: { '問題範圍': opts.draft || 'sample' } },
    created_at: new Date(opts.ts || Date.now()).toISOString(),
    updated_at: new Date(opts.ts || Date.now()).toISOString(),
  };
}

const NOW = Date.now();

// Scenario A — POST-FIX: 2 drill sessions both with drill_step='C1'
// Expected: both show「CIRCLES · C 澄清 · 草稿」no inconsistency
const SCENARIO_A_LIST = [
  makeSession({ id: 's-a1', qid: 'q-tesla', company: 'Tesla', product: 'Tesla Autopilot', drill_step: 'C1', ts: NOW - 2 * 3600000 }),
  makeSession({ id: 's-a2', qid: 'q-netflix', company: 'Netflix', product: 'Netflix Kids', drill_step: 'C1', ts: NOW - 24 * 3600000 }),
];

// Scenario B — LEGACY mixed: 1 drill_step=null (legacy) + 1 drill_step='C1' (new)
// Expected: legacy shows「步驟加練」fallback, new shows「C 澄清」— honest historical state
const SCENARIO_B_LIST = [
  makeSession({ id: 's-b1', qid: 'q-tesla', company: 'Tesla', product: 'Tesla Autopilot', drill_step: 'C1', ts: NOW - 1 * 3600000 }),
  makeSession({ id: 's-b2', qid: 'q-tesla', company: 'Tesla', product: 'Tesla Autopilot', drill_step: null, ts: NOW - 3 * 3600000 }),
];

test('capture P0 drill fix offcanvas — scenario A post-fix clean × 8 vp', async ({ page }) => {
  test.setTimeout(120000);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const listJson = JSON.stringify(SCENARIO_A_LIST);
  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: listJson }));
  page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: listJson }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await page.waitForSelector('.navbar');
    // Open offcanvas
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, `offcanvas-A-postfix-${vp.name}.png`), fullPage: false });
  }
});

test('capture P0 drill fix offcanvas — scenario B legacy mixed × 8 vp', async ({ page }) => {
  test.setTimeout(120000);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const listJson = JSON.stringify(SCENARIO_B_LIST);
  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: listJson }));
  page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: listJson }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, `offcanvas-B-legacy-${vp.name}.png`), fullPage: false });
  }
});
