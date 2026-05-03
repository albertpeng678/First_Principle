const path = require('path');
const fs = require('fs');
const { test } = require('@playwright/test');
const { MOCKUPS, VIEWPORTS, MOCKUP_DIR, BASELINE_DIR } = require('./helpers/baseline-capture');
const { prepareForCapture } = require('./helpers/screenshot');

test.describe('Mockup baselines (Layer 1)', () => {
  for (const mockup of MOCKUPS) {
    for (const vp of VIEWPORTS) {
      test(`${mockup} @ ${vp.name}`, async ({ page }) => {
        const fileUrl = 'file://' + path.join(MOCKUP_DIR, `${mockup}.html`);
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await page.goto(fileUrl);
        await page.waitForLoadState('networkidle');
        await prepareForCapture(page);
        const outDir = path.join(BASELINE_DIR, vp.name);
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `${mockup}.png`);
        const frameSelector = `.vp-frame:has(.vp-frame__inner[style*="width:${vp.w}px"])`;
        const frame = page.locator(frameSelector).first();
        if (await frame.count() === 0) {
          await page.screenshot({ path: outPath, fullPage: true });
        } else {
          await frame.screenshot({ path: outPath });
        }
      });
    }
  }
});
