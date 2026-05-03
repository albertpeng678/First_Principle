// Path 2 — Layer 1.1 baseline 規範實作（per spec §0.5 / mockup 15 §A2）
// 截圖前注入 CSS 凍 animation / 等 fonts / 等 SVG paint
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-play-state: paused !important;
    animation-delay: -0.0001s !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

async function prepareForCapture(page) {
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function captureFrame(page, frameLocator, outPath) {
  await prepareForCapture(page);
  await frameLocator.screenshot({ path: outPath, animations: 'disabled' });
}

module.exports = { prepareForCapture, captureFrame };
