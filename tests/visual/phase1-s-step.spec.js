// Plan B SB5 — S step 3 main + 4 tracking Playwright spec
// TDD: write spec first (red), then implement (green)
// Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/03-phase-1-form.html Section C (line 1469-1758)

const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://localhost:4000' });

function stub(page) {
  return Promise.all([
    page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' })),
    page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
    page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })),
  ]);
}

async function gotoSStep(page) {
  await page.goto('/');
  await page.waitForSelector('.qcard');
  // pick simulation mode (mode-card[0] = sim)
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
  // inject an attention-type question (Spotify — no saas/transaction/creator keywords)
  // and skip to S step (index 6)
  await page.evaluate(() => {
    var q = window.AppState.circlesSelectedQuestion;
    if (q) {
      // ensure question doesn't accidentally trigger non-attention type
      window.AppState.circlesSelectedQuestion = Object.assign({}, q, {
        company: 'Spotify',
        industry: '串流音樂 訂閱平台',
      });
    }
    window.AppState.circlesSimStep = 6;
    window.renderApp();
  });
  await page.waitForSelector('.tracking-section');
}

test('default tracking labels are attention type (觸及廣度/互動深度/習慣頻率/留存驅力)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoSStep(page);
  const heads = await page.locator('.tracking-card__head').allTextContents();
  expect(heads[0]).toContain('觸及廣度');
  expect(heads[1]).toContain('互動深度');
  expect(heads[2]).toContain('習慣頻率');
  expect(heads[3]).toContain('留存驅力');
});

test('phase-head__num is 07 and progress S is active', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoSStep(page);
  await expect(page.locator('.phase-head__num')).toHaveText('07');
  await expect(page.locator('.progress__step.is-active .step-letter')).toHaveText('S');
});

test('tracking-grid renders 4 .tracking-card with __num 01-04', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await gotoSStep(page);
  await expect(page.locator('.tracking-card')).toHaveCount(4);
  const nums = await page.locator('.tracking-card__num').allTextContents();
  expect(nums[0]).toBe('01');
  expect(nums[1]).toBe('02');
  expect(nums[2]).toBe('03');
  expect(nums[3]).toBe('04');
});

test('CTA button reads 「完成 Phase 1」', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSStep(page);
  const cta = await page.locator('[data-phase1="submit"]').textContent();
  expect(cta).toContain('完成 Phase 1');
});

test('desktop rail renders S 步重點', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSStep(page);
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('.rail__title').first()).toHaveText('S 步重點');
});

test('tracking-card head is dynamic — saas type shows 啟用廣度', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stub(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.mode-card').nth(0).click();
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head');
  // inject saas question (industry keyword triggers nsmGuessProductType → 'saas')
  await page.evaluate(() => {
    window.AppState.circlesSelectedQuestion = Object.assign(
      {},
      window.AppState.circlesSelectedQuestion,
      { company: 'Notion', industry: 'saas b2b 企業協作' }
    );
    window.AppState.circlesSimStep = 6;
    window.renderApp();
  });
  await page.waitForSelector('.tracking-section');
  const heads = await page.locator('.tracking-card__head').allTextContents();
  expect(heads[0]).toContain('啟用廣度');
  expect(heads[1]).toContain('席次深度');
  expect(heads[2]).toContain('黏著頻率');
  expect(heads[3]).toContain('擴張信號');
});

test('3 main rt-fields render (推薦方案 / 選擇理由 / 北極星指標)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await stub(page);
  await gotoSStep(page);
  const labels = await page.locator('.phase-body .field__label').allTextContents();
  expect(labels).toContain('推薦方案');
  expect(labels).toContain('選擇理由');
  expect(labels).toContain('北極星指標');
});

test('desktop phase-head title has 「含 NSM 與 4 追蹤維度」suffix', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await stub(page);
  await gotoSStep(page);
  const title = await page.locator('.phase-head__title').textContent();
  expect(title).toContain('含 NSM 與 4 追蹤維度');
});
