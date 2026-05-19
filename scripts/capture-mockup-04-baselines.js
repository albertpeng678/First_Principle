// scripts/capture-mockup-04-baselines.js
//
// Director-only script: render mockup 04 HTML at 3 viewports → save PNG baselines
// for wave1-b6-mockup04-drift-fix.spec.js toHaveScreenshot assertions.
//
// Per STANDING feedback_visual_baseline_from_mockup_not_production:
//   Baselines MUST come from mockup HTML render, NOT from production app.
//   Sub-agent does NOT run this script. Director runs after verifying script correctness.
//
// 🚫 ABSOLUTE PROHIBITIONS:
//   - DO NOT run with --update-snapshots from production
//   - DO NOT modify production app before running this capture
//   - Director verifies the output PNGs match mockup 04 §A/§B/§C/§D visually before committing
//
// Usage:
//   node scripts/capture-mockup-04-baselines.js
//
// Output:
//   tests/visual/wave1-b6-mockup04-drift-fix.spec.js-snapshots/
//     gate-ok-transition-Desktop-1280.png
//     gate-ok-transition-iPad.png
//     gate-ok-transition-Mobile-360.png
//     gate-warn-transition-Desktop-1280.png
//     gate-warn-transition-iPad.png
//     gate-warn-transition-Mobile-360.png
//     gate-error-transition-Desktop-1280.png
//     gate-error-transition-iPad.png
//     gate-error-transition-Mobile-360.png
//     gate-loading-wrap-Desktop-1280.png
//     gate-loading-wrap-iPad.png
//     gate-loading-wrap-Mobile-360.png

'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const MOCKUP_PATH = path.resolve(
  __dirname, '..', 'docs', 'superpowers', 'specs', 'mockups',
  '2026-05-02-frontend-rewrite', '04-phase-1-5-gate.html'
);
const SNAPSHOT_DIR = path.resolve(
  __dirname, '..', 'tests', 'visual',
  'wave1-b6-mockup04-drift-fix.spec.js-snapshots'
);

fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

// Mockup 04 has sections A (ok), B (warn), C (error), D (loading).
// Each section has 3 viewport frames. We capture the gate-transition / gate-loading-wrap
// element from the FIRST frame of each section (Mobile 360) and also iPad / Desktop.
//
// Since the mockup renders all 3 viewports in one HTML page,
// we screenshot the element inside the vp-frame for the correct width.

const VIEWPORTS = [
  { name: 'Mobile-360', width: 360,  height: 780  },
  { name: 'iPad',       width: 768,  height: 1024 },
  { name: 'Desktop-1280', width: 1280, height: 800 },
];

// Section selectors in mockup 04 — each section has exactly 3 .vp-frame items.
// Section A = ok (index 0-2), Section B = warn (3-5), Section C = error (6-8), Section D = loading (9-11)
const SECTION_MAP = {
  ok: { sectionIndex: 0, elementClass: '.gate-transition--ok' },
  warn: { sectionIndex: 1, elementClass: '.gate-transition--warn' },
  error: { sectionIndex: 2, elementClass: '.gate-transition--error' },
  loading: { sectionIndex: 3, elementClass: '.gate-loading-wrap' },
};

async function captureBaselines() {
  console.log('[capture-mockup-04-baselines] Starting...');
  console.log('Mockup path:', MOCKUP_PATH);
  console.log('Output dir: ', SNAPSHOT_DIR);

  if (!fs.existsSync(MOCKUP_PATH)) {
    console.error('ERROR: Mockup file not found:', MOCKUP_PATH);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`\nViewport: ${vp.name} (${vp.width}x${vp.height})`);

    // Each viewport rendered in the mockup HTML uses a .vp-frame__inner with explicit width.
    // We open the mockup at a large viewport and target the specific frame by width.
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 }, // wide enough to show all 3 columns
    });
    const page = await context.newPage();

    await page.goto('file://' + MOCKUP_PATH);
    await page.waitForLoadState('networkidle');

    // For each state (ok / warn / error / loading), find the vp-frame with the right width
    // and capture the target element within it.
    for (const [stateName, { elementClass }] of Object.entries(SECTION_MAP)) {
      // Find vp-frame__inner with matching width style
      const frameSelector = `.vp-frame__inner[style*="width:${vp.width}px"], .vp-frame__inner[style*="width: ${vp.width}px"]`;
      const frames = await page.locator(frameSelector).all();

      // Find the frame that contains this state's section element
      let targetEl = null;
      for (const frame of frames) {
        const el = frame.locator(elementClass);
        if (await el.count() > 0) {
          targetEl = el.first();
          break;
        }
      }

      if (!targetEl) {
        console.warn(`  [SKIP] ${stateName} ${elementClass} not found in ${vp.name} frame`);
        continue;
      }

      const filename = `gate-${stateName}-transition-${vp.name}.png`.replace(
        'loading-transition', 'loading-wrap'
      );
      const outputPath = path.join(SNAPSHOT_DIR, filename);

      await targetEl.screenshot({
        path: outputPath,
        animations: 'disabled',
      });

      console.log(`  [OK] ${stateName} → ${filename}`);
    }

    await context.close();
  }

  await browser.close();

  console.log('\n[capture-mockup-04-baselines] Done. Director: please Read each PNG and verify');
  console.log('  against mockup 04 §A/§B/§C/§D before staging baselines.');
  console.log('\nFiles in', SNAPSHOT_DIR, ':');
  const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.startsWith('gate-'));
  files.forEach(f => console.log('  ', f));
}

captureBaselines().catch((err) => {
  console.error('[capture-mockup-04-baselines] FATAL:', err);
  process.exit(1);
});
