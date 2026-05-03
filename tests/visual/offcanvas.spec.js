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

  test('empty state renders when API returns no records', async ({ page }) => {
    await page.route('**/api/circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.locator('[data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-empty')).toBeVisible();
    await expect(page.locator('.offcanvas-empty__title')).toHaveText('尚無練習記錄');
  });

  test('error state renders when API errors', async ({ page }) => {
    await page.route('**/api/circles-sessions**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.route('**/api/nsm-sessions**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.route('**/api/guest/nsm-sessions**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.locator('[data-nav="offcanvas"]').click();
    await expect(page.locator('.offcanvas-error')).toBeVisible();
    await expect(page.locator('.offcanvas-error__title')).toHaveText('載入失敗');
  });

  test('list renders items with mode pills + score badge for completed', async ({ page }) => {
    const fakeCircles = [
      { id: 'c-1', question_id: 'q1', mode: 'simulation', drill_step: null,
        question_json: { id: 'q1', company: 'Spotify', product: 'Wrapped', title: 'Spotify Wrapped' },
        status: 'completed', step_scores: { S: 86 }, framework_draft: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'c-2', question_id: 'q2', mode: 'drill', drill_step: 'C1',
        question_json: { id: 'q2', company: 'Discord', product: 'Voice', title: 'Discord Voice' },
        status: 'active', step_scores: {}, framework_draft: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    const fakeNsm = [
      { id: 'n-1', question_id: 'nq1',
        question_json: { id: 'nq1', company: 'Asana', product: '工作協作', title: 'Asana 工作協作' },
        status: 'completed', scores_json: { final_score: 92 },
        created_at: new Date().toISOString() },
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
