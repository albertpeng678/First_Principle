// Capture mockup 04 HTML screenshots for B6 audit — find-only, no production changes.
// Captures Section A (ok), B (warn), C (error), D (loading) from the mockup HTML file.
// 3 vp × 4 sections = 12 PNGs, saved to audit/B6-mockup04-audit/

const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const MOCKUP_FILE = path.resolve(__dirname, '../../docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/04-phase-1-5-gate.html');

// Section anchor IDs / frame identifiers in the mockup HTML.
// Mockup is a "vp-grid" showing 3 frames side-by-side.
// We clip to specific .vp-frame elements per section.
// Viewport names: Mobile-360 → frame[0], iPad → frame[1], Desktop-1280 → frame[2]

const VP_FRAME_INDICES = {
  'Mobile-360': 0,
  'iPad': 1,
  'Desktop-1280': 2,
};

const SECTIONS = [
  { name: 'ok',      sectionIndex: 0 },
  { name: 'warn',    sectionIndex: 1 },
  { name: 'error',   sectionIndex: 2 },
  { name: 'loading', sectionIndex: 3 },
];

test.describe('Capture mockup 04 HTML for B6 audit', () => {
  fs.mkdirSync('audit/B6-mockup04-audit', { recursive: true });

  for (const section of SECTIONS) {
    test(`mockup-${section.name}`, async ({ page }, testInfo) => {
      const vpIdx = VP_FRAME_INDICES[testInfo.project.name] ?? 0;

      // Open mockup HTML via file:// URL
      await page.goto('file://' + MOCKUP_FILE);

      // Each section has its own vp-grid with 3 vp-frames.
      // The vp-grid elements are grouped into sections in the HTML.
      // Select all .vp-grid elements; each section maps to one.
      const allGrids = await page.locator('.vp-grid').all();
      const grid = allGrids[section.sectionIndex];

      if (!grid) {
        throw new Error(`vp-grid index ${section.sectionIndex} not found for section ${section.name}`);
      }

      // Within the grid, pick the frame matching the viewport
      const frames = await grid.locator('.vp-frame').all();
      const frame = frames[vpIdx];

      if (!frame) {
        throw new Error(`vp-frame index ${vpIdx} not found in section ${section.name}`);
      }

      const outPath = `audit/B6-mockup04-audit/mockup-${section.name}-${testInfo.project.name}.png`;
      await frame.screenshot({ path: outPath });
    });
  }
});
