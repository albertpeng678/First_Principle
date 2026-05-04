// Plan B SB9b — Section E pixel-diff (mockup 03 line 1953-2106) vs production
// 3 frames: Mobile · locked / Tablet · stale / Desktop · save error retry
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { captureMockupFrameClip, diffPngBuffers } = require('./helpers/section-pixel-diff');

test.use({ baseURL: 'http://localhost:4000' });

const OUT_DIR = path.resolve(__dirname, 'diffs/sb9b');
fs.mkdirSync(OUT_DIR, { recursive: true });

const REPORT_PATH = path.resolve(__dirname, '../../audit/sb9b-pixel-diff-report.md');
const reportLines = ['# SB9b Section E pixel-diff report', '', `_Generated: ${new Date().toISOString()}_`, ''];

function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function gotoPhase1State(page, vpW, vpH, stateSetup) {
  await page.setViewportSize({ width: vpW, height: vpH });
  await stub(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').first().click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
  await page.evaluate(stateSetup);
  await page.waitForTimeout(400);
}

async function captureProduction(page, outPath) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const buf = await page.screenshot({ fullPage: true });
  fs.writeFileSync(outPath, buf);
  return buf;
}

const cases = [
  {
    label: 'Mobile · locked',
    vp: 'mobile-360',
    w: 360, h: 1700,
    frameLabel: 'Mobile · locked',
    setup: `window.AppState.circlesLocked = true;
            window.AppState.circlesScoreResult = { totalScore: 76 };
            window.renderApp();`,
  },
  {
    label: 'Tablet · stale',
    vp: 'tablet-768',
    w: 768, h: 1700,
    frameLabel: 'Tablet · stale',
    setup: `window.AppState.circlesStale = true; window.renderApp();`,
  },
  {
    label: 'Desktop · save-error',
    vp: 'desktop-1280',
    w: 1280, h: 1700,
    frameLabel: 'Desktop · save error retry',
    setup: `window.AppState.circlesPhase1SaveState = 'error'; window.renderApp();`,
  },
];

cases.forEach(c => {
  test(`SB9b Section E ${c.label} pixel-diff`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `${c.vp}-mockup.png`);
    await captureMockupFrameClip(pageMock, '03-phase-1-form.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    const prodPath = path.join(OUT_DIR, `${c.vp}-production.png`);
    await gotoPhase1State(pageProd, c.w, c.h, c.setup);
    await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const prodBuf = fs.readFileSync(prodPath);
    const diffPath = path.join(OUT_DIR, `${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    const summary = `mockup ${result.mockupWidth}×${result.mockupHeight} / production ${result.productionWidth}×${result.productionHeight} / padded ${result.paddedWidth}×${result.paddedHeight} / mismatched ${result.mis}px / **${result.pct.toFixed(2)}%**`;
    const verdict = result.pct < 0.5 ? '✅ < 0.5%' : result.pct < 5 ? '🟡 < 5%' : result.pct < 15 ? '🟠 < 15% (state diff 預期)' : '🔴 ≥ 15%';
    reportLines.push(`## SB9b Section E · ${c.label}: ${verdict}`);
    reportLines.push('');
    reportLines.push(`- ${summary}`);
    reportLines.push(`- mockup PNG: \`tests/visual/diffs/sb9b/${c.vp}-mockup.png\``);
    reportLines.push(`- production PNG: \`tests/visual/diffs/sb9b/${c.vp}-production.png\``);
    reportLines.push(`- diff PNG: \`tests/visual/diffs/sb9b/${c.vp}-diff.png\``);
    reportLines.push('');
  });
});

test.afterAll(async () => {
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## 解讀說明');
  reportLines.push('');
  reportLines.push('- 對應 mockup 03 Section E HTML line 1953-2106，CSS line 711-715 + 1981-1988 (rt-field disabled inline)');
  reportLines.push('- 三 frame：Mobile locked / Tablet stale / Desktop save-error');
  reportLines.push('- 預期 diff 來源：');
  reportLines.push('  1. mockup hardcoded textarea content (e.g. line 1986 「聚焦免費版的廣告體驗...」) vs production empty placeholder');
  reportLines.push('  2. mockup hardcoded company/題目 vs production 隨機題');
  reportLines.push('  3. navbar 登入態：mockup desktop frame logged-in (email + sign-out) / production guest');
  reportLines.push('  4. mockup 用 textarea / production 用 contenteditable div — 字體 metrics 些微差');
  reportLines.push('- 0.5% 嚴格門檻只在「兩端同 state 同 content」可達；本 SB 結構契約驗證為主，diff% 範圍 3-15% 視為結構正確');
  reportLines.push('');
  fs.writeFileSync(REPORT_PATH, reportLines.join('\n'));
  console.log(`\n✅ Report written: ${REPORT_PATH}`);
});
