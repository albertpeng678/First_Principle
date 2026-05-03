const fs = require('fs');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const THRESHOLD = 0.5; // % per spec §0.5 Layer 2

function diffPng(baselinePath, actualPath, diffPath) {
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const actual   = PNG.sync.read(fs.readFileSync(actualPath));
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return { passed: false, reason: `size mismatch ${baseline.width}x${baseline.height} vs ${actual.width}x${actual.height}` };
  }
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const mismatchedPixels = pixelmatch(baseline.data, actual.data, diff.data, baseline.width, baseline.height, { threshold: 0.1 });
  const totalPixels = baseline.width * baseline.height;
  const pct = (mismatchedPixels / totalPixels) * 100;
  if (pct > THRESHOLD && diffPath) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }
  return { passed: pct <= THRESHOLD, pct, mismatchedPixels, totalPixels };
}

module.exports = { diffPng, THRESHOLD };
