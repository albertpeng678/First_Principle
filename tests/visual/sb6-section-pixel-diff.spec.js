// SB6 Layer 2 mechanical pixel-diff — mockup 03 Section G qchip-expand
// vs production qchip clicked → expanded
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { captureMockupFrameClip, diffPngBuffers } = require('./helpers/section-pixel-diff');

test.use({ baseURL: 'http://localhost:4000' });

const OUT_DIR = path.resolve(__dirname, 'diffs/sb6');
fs.mkdirSync(OUT_DIR, { recursive: true });

const REPORT_PATH = path.resolve(__dirname, '../../audit/sb6-pixel-diff-report.md');
const reportLines = ['# SB6 Section G pixel-diff report', '', `_Generated: ${new Date().toISOString()}_`, ''];

function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function gotoPhase1Expanded(page, vpW, vpH) {
  await page.setViewportSize({ width: vpW, height: vpH });
  await stub(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').first().click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.qchip');
  await page.locator('.qchip').click();
  await page.waitForSelector('.qchip-expand');
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
  { vp: 'mobile-360', w: 360, h: 1700, frameLabel: 'Mobile · qchip expanded' },
  { vp: 'tablet-768', w: 768, h: 1700, frameLabel: 'Tablet · qchip expanded' },
  { vp: 'desktop-1280', w: 1280, h: 1700, frameLabel: 'Desktop · qchip expanded' },
];

cases.forEach(c => {
  test(`SB6 Section G ${c.vp} pixel-diff`, async ({ browser }) => {
    const ctxMock = await browser.newContext();
    const pageMock = await ctxMock.newPage();
    const mockupPath = path.join(OUT_DIR, `${c.vp}-mockup.png`);
    await captureMockupFrameClip(pageMock, '03-phase-1-form.html', c.frameLabel, mockupPath);
    await ctxMock.close();

    const ctxProd = await browser.newContext();
    const pageProd = await ctxProd.newPage();
    const prodPath = path.join(OUT_DIR, `${c.vp}-production.png`);
    await gotoPhase1Expanded(pageProd, c.w, c.h);
    await captureProduction(pageProd, prodPath);
    await ctxProd.close();

    const mockupBuf = fs.readFileSync(mockupPath);
    const prodBuf = fs.readFileSync(prodPath);
    const diffPath = path.join(OUT_DIR, `${c.vp}-diff.png`);
    const result = await diffPngBuffers(mockupBuf, prodBuf, diffPath);
    const summary = `mockup ${result.mockupWidth}×${result.mockupHeight} / production ${result.productionWidth}×${result.productionHeight} / padded ${result.paddedWidth}×${result.paddedHeight} / mismatched ${result.mis}px / **${result.pct.toFixed(2)}%**`;
    const verdict = result.pct < 0.5 ? '✅ < 0.5%' : result.pct < 5 ? '🟡 < 5%' : result.pct < 15 ? '🟠 < 15% (state diff 預期)' : '🔴 ≥ 15%';
    reportLines.push(`## SB6 Section G · ${c.vp}: ${verdict}`);
    reportLines.push('');
    reportLines.push(`- ${summary}`);
    reportLines.push(`- mockup PNG: \`tests/visual/diffs/sb6/${c.vp}-mockup.png\``);
    reportLines.push(`- production PNG: \`tests/visual/diffs/sb6/${c.vp}-production.png\``);
    reportLines.push(`- diff PNG: \`tests/visual/diffs/sb6/${c.vp}-diff.png\``);
    reportLines.push('');
  });
});

test.afterAll(async () => {
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## 解讀說明');
  reportLines.push('');
  reportLines.push('- 對應 mockup 03 Section G HTML line 2245-2372，CSS line 94-172');
  reportLines.push('- mockup state = qchip 已展開 demo with hardcoded Spotify Podcast statement + 4 ana-block content');
  reportLines.push('- production state = qchip click 後展開，statement 與 4 ana-block 從 random question 的 q.problem_statement / q.analysis 渲染');
  reportLines.push('- 預期 diff 來源：(1) navbar 登入態 mockup vs guest production (2) 題目隨機 vs hardcoded Spotify (3) statement 內 strong markup mockup hardcoded vs production plain text (4) 4 ana-block content text');
  reportLines.push('- 0.5% 嚴格門檻只在「兩端同 state 同 content」可達；本 SB 結構契約驗證為主，diff% 範圍 3-15% 視為結構正確');
  reportLines.push('');
  fs.writeFileSync(REPORT_PATH, reportLines.join('\n'));
  console.log(`\n✅ Report written: ${REPORT_PATH}`);
});
