// Path 2 · Plan D · Sub-bundle 1 — Offcanvas History drawer (mockup 09)
// Asserts BEM classes + 4 states (list/empty/loading/error) + open/close behaviour.
const { test, expect } = require('@playwright/test');

test.describe('D1 Offcanvas History drawer', () => {

  test('hamburger click opens drawer with backdrop', async ({ page }) => {
    // Stub /api endpoints so loadHistory returns deterministic empty state
    await page.route('**/api/circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.navbar');
    // closed by default
    await expect(page.locator('.offcanvas-drawer')).toHaveCount(0);
    await expect(page.locator('.offcanvas-backdrop')).toHaveCount(0);
    // open via hamburger button (data-nav="offcanvas")
    await page.locator('.navbar [data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-drawer')).toBeVisible();
    await expect(page.locator('.offcanvas-backdrop')).toBeVisible();
    await expect(page.locator('.offcanvas-head__title')).toHaveText('練習記錄');
  });

  test('close button + backdrop click + esc all close drawer', async ({ page }) => {
    await page.route('**/api/circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.navbar');

    // close via X button
    await page.locator('[data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-drawer')).toBeVisible();
    await page.locator('.offcanvas-head__close').click();
    await expect(page.locator('.offcanvas-drawer')).toHaveCount(0);

    // close via backdrop click
    await page.locator('[data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-drawer')).toBeVisible();
    await page.locator('.offcanvas-backdrop').click();
    await expect(page.locator('.offcanvas-drawer')).toHaveCount(0);

    // close via esc
    await page.locator('[data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.offcanvas-drawer')).toHaveCount(0);
  });

  test('empty state matches mockup 09 contract (icon / sub copy / ghost CTA)', async ({ page }) => {
    await page.route('**/api/circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.locator('[data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-empty')).toBeVisible();
    await expect(page.locator('.offcanvas-empty__title')).toHaveText('尚無練習記錄');
    // mockup 09 line 560: ph-folder-open
    await expect(page.locator('.offcanvas-empty__icon i')).toHaveClass(/ph-folder-open/);
    // mockup 09 line 562: exact sub copy
    await expect(page.locator('.offcanvas-empty__sub')).toHaveText('練習完成的 CIRCLES 題目與 NSM 訓練會出現在這裡。');
    // mockup 09 line 563: btn--ghost + ph-arrow-right + "開始第一題"
    const cta = page.locator('.offcanvas-empty__cta');
    await expect(cta).toHaveClass(/btn--ghost/);
    await expect(cta).not.toHaveClass(/btn--primary/);
    await expect(cta.locator('i')).toHaveClass(/ph-arrow-right/);
    await expect(cta).toContainText('開始第一題');
  });

  test('error state matches mockup 09 contract (icon / sub / retry button)', async ({ page }) => {
    await page.route('**/api/circles-sessions**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.route('**/api/nsm-sessions**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.route('**/api/guest/nsm-sessions**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.locator('[data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-error')).toBeVisible();
    await expect(page.locator('.offcanvas-error__title')).toHaveText('載入失敗');
    // mockup 09 line 782: ph-warning-circle
    await expect(page.locator('.offcanvas-error__icon i')).toHaveClass(/ph-warning-circle/);
    // mockup 09 line 784: exact sub copy
    await expect(page.locator('.offcanvas-error__sub')).toHaveText('請檢查網路連線後再試。');
    // mockup 09 line 785: btn--ghost + ph-arrow-clockwise + "重試"
    const retry = page.locator('.offcanvas-error button[data-offcanvas="retry"]');
    await expect(retry).toBeVisible();
    await expect(retry).toHaveClass(/btn--ghost/);
    await expect(retry.locator('i')).toHaveClass(/ph-arrow-clockwise/);
    await expect(retry).toContainText('重試');
  });

  test('list renders production-shape items with score badges showing numeric values', async ({ page }) => {
    // Real production schema: step_scores values are EvaluatorResponse objects (per spec §1.4),
    // not bare numbers; NSM scores_json uses key "totalScore" (per prompts/nsm-evaluator.js:48).
    const evalResp86 = { totalScore: 86, dimensions: [], highlight: 'a', improvement: 'b', coachVersion: { context: '', perField: [], reasoning: '' } };
    const fakeCircles = [
      { id: 'c-1', question_id: 'q1', mode: 'simulation', drill_step: null,
        question_json: { id: 'q1', company: 'Spotify', product: 'Wrapped' },
        currentQuestion: { id: 'q1', company: 'Spotify', product: 'Wrapped' },
        status: 'completed', step_scores: { S: evalResp86 }, framework_draft: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'c-2', question_id: 'q2', mode: 'drill', drill_step: 'C1',
        question_json: { id: 'q2', company: 'Discord', product: 'Voice' },
        currentQuestion: { id: 'q2', company: 'Discord', product: 'Voice' },
        status: 'active', step_scores: {}, framework_draft: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    const fakeNsm = [
      { id: 'n-1', question_id: 'nq1',
        question_json: { id: 'nq1', company: 'Asana', product: '工作協作' },
        currentQuestion: { id: 'nq1', company: 'Asana', product: '工作協作' },
        status: 'completed', scores_json: { totalScore: 92, scores: { alignment: 4, leading: 4, actionability: 5, simplicity: 4, sensitivity: 3 } },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    await page.route('**/api/circles-sessions**',       (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeCircles) }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeCircles) }));
    await page.route('**/api/nsm-sessions**',           (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeNsm) }));
    await page.route('**/api/guest/nsm-sessions**',     (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeNsm) }));

    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.locator('[data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-item').first()).toBeVisible();
    const items = page.locator('.offcanvas-item');
    expect(await items.count()).toBe(3);
    // Score badges only for completed entries (2 of 3)
    expect(await page.locator('.offcanvas-item__score').count()).toBe(2);
    // Score values must be numeric, not "[object Object]"
    const scoreTexts = await page.locator('.offcanvas-item__score').allTextContents();
    expect(scoreTexts.sort()).toEqual(['86', '92']);
    // Title must not contain "[object Object]" — production currentQuestion is an object
    const titles = await page.locator('.offcanvas-item__title').allTextContents();
    for (const t of titles) {
      expect(t).not.toContain('[object Object]');
    }
    // NSM title should show company · product (Asana · 工作協作), not trailing "·  " from undefined industry
    const joinedTitles = titles.join(' | ');
    expect(joinedTitles).toContain('Asana · 工作協作');
    expect(joinedTitles).toContain('Spotify · Wrapped');
    // meta strings include drill / sim / nsm tags
    const metas = await page.locator('.offcanvas-item__meta').allTextContents();
    const joined = metas.join(' | ');
    expect(joined).toMatch(/CIRCLES · 完整 7 步/);
    expect(joined).toMatch(/CIRCLES · C 澄清/);
    expect(joined).toMatch(/NSM · 4 步/);
    // section divider rendered
    await expect(page.locator('.offcanvas-section').first()).toBeVisible();
  });
});
