// tests/visual/capture-prod-mockup-12-pngs.spec.js
// Capture production Phase 3 error+loading states (mockup 12 §A/B/C) at 8 viewports = 24 PNG.
// Companion to capture-prod-phase3-pngs.spec.js (which covers mockup 11 score states).
// Output: audit/png-prod-mockup-12/section-{A,B,C}-{vp}.png

const { test } = require('@playwright/test');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../../audit/png-prod-mockup-12');

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"thisWeek":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setupPhase3Loading(page, slow) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(({ slow }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 3,
      circlesMode: 'drill',
      circlesDrillStep: 'I',
      circlesSession: { id: 'sess-1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      circlesScoreResult: null,
      circlesPhase3Error: null,
      circlesPhase3LoadingStep: 2,
      circlesPhase3LoadingSlow: slow,
    });
    window.render();
  }, { slow });
  await page.waitForTimeout(200);
}

async function setupPhase3Error(page, code) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(({ code }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 3,
      circlesMode: 'drill',
      circlesDrillStep: 'I',
      circlesSession: { id: 'sess-1' },
      circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
      circlesScoreResult: null,
      circlesPhase3Error: { code, message: 'fixture' },
      circlesPhase3LoadingStep: 0,
    });
    window.render();
  }, { code });
  await page.waitForTimeout(200);
}

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 900  },
  { name: 'iPhone-SE',     width: 375,  height: 900  },
  { name: 'iPhone-14',     width: 390,  height: 900  },
  { name: 'iPhone-15-Pro', width: 430,  height: 900  },
  { name: 'iPad',          width: 768,  height: 1100 },
  { name: 'Desktop-1280',  width: 1280, height: 1100 },
  { name: 'Desktop-1440',  width: 1440, height: 1100 },
  { name: 'Desktop-2560',  width: 2560, height: 1100 },
];

test.describe.serial('Capture production mockup 12 PNGs (Phase 3 error + loading)', () => {
  for (const vp of VIEWPORTS) {
    test(`Section A — Loading 慢回應 — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPhase3Loading(page, true);
      await page.screenshot({ path: `${OUT_DIR}/section-A-${vp.name}.png`, fullPage: true });
    });

    test(`Section B — EVAL_API_ERROR — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPhase3Error(page, 'EVAL_API_ERROR');
      await page.screenshot({ path: `${OUT_DIR}/section-B-${vp.name}.png`, fullPage: true });
    });

    test(`Section C — EVAL_PARSE_ERROR — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPhase3Error(page, 'EVAL_PARSE_ERROR');
      await page.screenshot({ path: `${OUT_DIR}/section-C-${vp.name}.png`, fullPage: true });
    });
  }
});
