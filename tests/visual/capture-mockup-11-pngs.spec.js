// Capture mockup 11 (Phase 3 Score) frame-by-frame across 4 sections × 3 viewports.
// Output: audit/png-mockup-11/section-{A,B,C,D}-{mobile,tablet,desktop}.png — 12 PNGs total.
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const MOCKUP_PATH = path.resolve(
  __dirname,
  '../../docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/11-phase-3-score.html'
);
const OUT_DIR = path.resolve(__dirname, '../../audit/png-mockup-11');

const SECTIONS = [
  { id: 'A', label: '預設狀態' },
  { id: 'B', label: '低分自動展開' },
  { id: 'C', label: 'Loading' },
  { id: 'D', label: 'Error' },
];
const VIEWPORTS = ['mobile', 'tablet', 'desktop'];

test.describe.configure({ mode: 'parallel' });

test('capture mockup 11 — 4 sections × 3 viewports = 12 PNGs', async ({ page }) => {
  test.setTimeout(120000);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  await page.setViewportSize({ width: 4400, height: 4000 });
  await page.goto('file://' + MOCKUP_PATH, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const grids = page.locator('.vp-grid');
  const gridCount = await grids.count();
  if (gridCount < SECTIONS.length) {
    throw new Error('Expected ' + SECTIONS.length + ' vp-grid sections, got ' + gridCount);
  }

  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];
    const grid = grids.nth(i);
    const frames = grid.locator('.vp-frame');
    const frameCount = await frames.count();
    if (frameCount !== 3) {
      throw new Error('Section ' + section.id + ' has ' + frameCount + ' frames, expected 3');
    }
    for (let v = 0; v < 3; v++) {
      const frame = frames.nth(v);
      await frame.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const out = path.join(OUT_DIR, 'section-' + section.id + '-' + VIEWPORTS[v] + '.png');
      await frame.screenshot({ path: out });
    }
  }
});
