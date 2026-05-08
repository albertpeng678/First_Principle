// Capture mockup 05 (Phase 2 Chat) frame-by-frame across 6 sections × 3 viewports.
// Output: audit/png-mockup-05/{section}-{viewport}.png — 18 PNGs total.
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const MOCKUP_PATH = path.resolve(
  __dirname,
  '../../docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html'
);
const OUT_DIR = path.resolve(__dirname, '../../audit/png-mockup-05');

const SECTIONS = [
  { id: 'A', label: '對話開頭' },
  { id: 'B', label: '中段對話' },
  { id: 'C', label: 'Streaming AI' },
  { id: 'D', label: '對話足夠' },
  { id: 'E', label: '結論展開填寫' },
  { id: 'F', label: '已評分唯讀' },
];
const VIEWPORTS = ['mobile', 'tablet', 'desktop'];

test.describe.configure({ mode: 'parallel' });

test('capture mockup 05 — 6 sections × 3 viewports = 18 PNGs', async ({ page }) => {
  test.setTimeout(120000);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Wide viewport so all 3-column vp-grid is fully painted before element screenshots.
  await page.setViewportSize({ width: 4400, height: 4000 });
  await page.goto('file://' + MOCKUP_PATH, { waitUntil: 'networkidle' });
  // Wait for fonts (Phosphor / Instrument Serif)
  await page.waitForTimeout(1500);

  // Iterate vp-grids (one per section) and capture each .vp-frame inside.
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
