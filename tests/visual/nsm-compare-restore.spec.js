const { test, expect } = require('@playwright/test');

async function setupZoomScored(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 4,
      nsmReportTab: 'comparison',
      nsmSelectedQuestion: { id: 'q17', company: 'Zoom', product: '視訊會議 SaaS', question_type: 'saas' },
      nsmDefinition: '每週使用Zoom 完成一場「1 小時 3 人以上會議」的用戶數',
      nsmBreakdown: { reach: '- 每週使用Zoom 完成一場…', depth: '- 平均會議時長', frequency: '- 每週至少一次', impact: '- 升級付費用戶數' },
      nsmEvalResult: { totalScore: 80, coachTree: { nsm: 'coach NSM text', reach: 'r', depth: 'd', frequency: 'f', impact: 'i' }, coachRationale: {} },
      nsmSession: { id: 'sess-1' },
    });
    window.render();
  });
}

test('Bug X-Compare: 北極星指標 row 「你的」 cell shows user nsm definition (string-coerce)', async ({ page }) => {
  await setupZoomScored(page);
  await page.waitForTimeout(300);
  const yourCellText = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.nsm-compare-block, .nsm-compare-grid__row'));
    const nsmRow = rows.find(r => /北極星指標/.test(r.textContent));
    if (!nsmRow) return null;
    const yourCell = nsmRow.querySelector('.nsm-compare-card--yours .nsm-compare-card__text, .nsm-compare-grid__cell--yours');
    return yourCell ? yourCell.textContent.trim() : null;
  });
  expect(yourCellText).toContain('每週使用Zoom');
});
