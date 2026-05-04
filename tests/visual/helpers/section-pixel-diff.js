// section-pixel-diff helper — Layer 2 補洞 (SB4/SB5)
// 截 mockup vp-frame__body element + production matching state，pad 較小者，pixelmatch 報 diff%
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
// pixelmatch 7.x is ESM-only — use dynamic import
let _pixelmatch = null;
async function getPixelmatch() {
  if (_pixelmatch) return _pixelmatch;
  const mod = await import('pixelmatch');
  _pixelmatch = mod.default;
  return _pixelmatch;
}

const MOCKUP_DIR = path.resolve(__dirname, '../../../docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite');

async function captureMockupFrameClip(page, mockupFile, frameLabelText, outPath) {
  // Load mockup at viewport WIDER than the entire vp-grid (3 frames + gaps = up to ~2500px)
  // so vp-grid never horizontally overflows + all frames are positioned at predictable x.
  await page.setViewportSize({ width: 3000, height: 1080 });
  const url = 'file://' + path.join(MOCKUP_DIR, mockupFile);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  // Exact text match: avoid substring collision (e.g., "Mobile · S" matching "Mobile · simulation")
  // Use Playwright :text-is pseudo for exact span text match, then traverse to vp-frame ancestor
  const escaped = frameLabelText.replace(/"/g, '\\"');
  const frame = page.locator(`.vp-frame:has(.vp-frame__label span:text-is("${escaped}"))`).first();
  const body = frame.locator('.vp-frame__body').first();
  // Get document-absolute coords directly via getBoundingClientRect + scroll
  const rect = await body.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
  });
  const docX = Math.round(rect.x);
  const docY = Math.round(rect.y);
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  // Take fullPage screenshot then crop in pngjs
  const fullBuf = await page.screenshot({ fullPage: true, animations: 'disabled' });
  const fullPng = PNG.sync.read(fullBuf);
  // Defensive: clip crop rect to fullPng bounds
  const cropX = Math.max(0, Math.min(docX, fullPng.width - 1));
  const cropY = Math.max(0, Math.min(docY, fullPng.height - 1));
  const cropW = Math.min(w, fullPng.width - cropX);
  const cropH = Math.min(h, fullPng.height - cropY);
  const cropped = new PNG({ width: cropW, height: cropH });
  PNG.bitblt(fullPng, cropped, cropX, cropY, cropW, cropH, 0, 0);
  fs.writeFileSync(outPath, PNG.sync.write(cropped));
  return { rect, docX, docY, w, h, fullW: fullPng.width, fullH: fullPng.height };
}

function padPngToSize(pngBuffer, targetW, targetH) {
  const png = PNG.sync.read(pngBuffer);
  if (png.width === targetW && png.height === targetH) return pngBuffer;
  // crop if larger; pad with white otherwise
  const out = new PNG({ width: targetW, height: targetH });
  // fill white
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255; out.data[i+1] = 255; out.data[i+2] = 255; out.data[i+3] = 255;
  }
  const copyW = Math.min(png.width, targetW);
  const copyH = Math.min(png.height, targetH);
  PNG.bitblt(png, out, 0, 0, copyW, copyH, 0, 0);
  return PNG.sync.write(out);
}

async function diffPngBuffers(bufA, bufB, diffPath) {
  const pixelmatch = await getPixelmatch();
  const a = PNG.sync.read(bufA);
  const b = PNG.sync.read(bufB);
  const targetW = Math.max(a.width, b.width);
  const targetH = Math.max(a.height, b.height);
  const aBuf = padPngToSize(bufA, targetW, targetH);
  const bBuf = padPngToSize(bufB, targetW, targetH);
  const aPng = PNG.sync.read(aBuf);
  const bPng = PNG.sync.read(bBuf);
  const diff = new PNG({ width: targetW, height: targetH });
  const mis = pixelmatch(aPng.data, bPng.data, diff.data, targetW, targetH, { threshold: 0.1 });
  const total = targetW * targetH;
  const pct = (mis / total) * 100;
  if (diffPath) {
    fs.mkdirSync(path.dirname(diffPath), { recursive: true });
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }
  return {
    mis, total, pct,
    mockupWidth: a.width, mockupHeight: a.height,
    productionWidth: b.width, productionHeight: b.height,
    paddedWidth: targetW, paddedHeight: targetH,
  };
}

module.exports = { captureMockupFrameClip, diffPngBuffers, padPngToSize, MOCKUP_DIR };
