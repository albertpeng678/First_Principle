// Capture mockup 05 amend — §A §B §C per-frame (3 sections × 3 viewports = 9 PNGs)
// Director cold-review target: qchip company fix + 上一步 inline placement
// Output: audit/png-mockup-05-amend-AF/{section}-{viewport}.png
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const MOCKUP_PATH = path.resolve(
  __dirname,
  '../../docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/05-phase-2-chat.html'
);
const OUT_DIR = path.resolve(__dirname, '../../audit/png-mockup-05-amend-AF');

// §A §B §C are grid indices 0, 1, 2 (A=對話開頭, B=中段對話, C=Streaming AI)
const SECTIONS = [
  { id: 'A', label: '對話開頭' },
  { id: 'B', label: '中段對話' },
  { id: 'C', label: 'StreamingAI' },
];
const VIEWPORTS = ['mobile', 'tablet', 'desktop'];

test.describe.configure({ mode: 'serial' });

test('capture mockup-05-amend-AF — 3 sections × 3 viewports = 9 PNGs', async ({ page }) => {
  test.setTimeout(120000);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  await page.setViewportSize({ width: 4400, height: 4000 });
  await page.goto('file://' + MOCKUP_PATH, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const grids = page.locator('.vp-grid');
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
