// phase-b-helpers.js — thin re-export of shared pixel-diff utilities for phase-b spec
// Re-uses tryCaptureMockupFrameNth logic from master-pixel-diff.spec.js (copy-free approach
// via shared pngjs + pixelmatch deps) plus the existing diffPngBuffers from section-pixel-diff.js

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { diffPngBuffers } = require('./section-pixel-diff');

// tryCaptureMockupFrameNth — picks the nth occurrence of frameLabel in a mockup HTML file
// Mirrors the implementation in master-pixel-diff.spec.js verbatim (no new logic)
async function tryCaptureMockupFrameNth(page, mockupDir, mockupFile, frameLabel, labelIndex, outPath) {
  await page.setViewportSize({ width: 3000, height: 1080 });
  const url = 'file://' + path.join(mockupDir, mockupFile);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  const escaped = frameLabel.replace(/"/g, '\\"');
  for (const bodyClass of ['.vp-frame__body', '.vp-frame__inner']) {
    const allFrames = page.locator(`.vp-frame:has(.vp-frame__label span:text-is("${escaped}"))`);
    const count = await allFrames.count();
    if (count > labelIndex) {
      const frame = allFrames.nth(labelIndex);
      const body = frame.locator(bodyClass).first();
      const bodyCount = await body.count();
      if (bodyCount > 0) {
        try {
          const rect = await body.evaluate(el => {
            const r = el.getBoundingClientRect();
            return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
          });
          const docX = Math.round(rect.x);
          const docY = Math.round(rect.y);
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          const fullBuf = await page.screenshot({ fullPage: true, animations: 'disabled' });
          const fullPng = PNG.sync.read(fullBuf);
          const cropX = Math.max(0, Math.min(docX, fullPng.width - 1));
          const cropY = Math.max(0, Math.min(docY, fullPng.height - 1));
          const cropW = Math.min(w, fullPng.width - cropX);
          const cropH = Math.min(h, fullPng.height - cropY);
          const cropped = new PNG({ width: cropW, height: cropH });
          PNG.bitblt(fullPng, cropped, cropX, cropY, cropW, cropH, 0, 0);
          fs.writeFileSync(outPath, PNG.sync.write(cropped));
          return true;
        } catch (e) {
          return false;
        }
      }
    }
  }
  return false;
}

module.exports = { tryCaptureMockupFrameNth, diffPngBuffers };
