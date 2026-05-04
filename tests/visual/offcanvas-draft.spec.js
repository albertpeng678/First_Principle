// Path 2 — Offcanvas drafts (active sessions visible) TDD spec
// Task D: 紅燈 spec 先寫，實作後全綠。
// Run: npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 offcanvas-draft.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Offcanvas drafts (active sessions visible)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":1,"weeklyCompleted":0}' }));
  });

  test('Phase 1 first input → POST /draft fires lazy-create and AppState.circlesSession set', async ({ page }) => {
    let draftPosted = false;
    await page.route('**/api/guest-circles-sessions/draft', r => {
      draftPosted = true;
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'sess-test-1', status: 'active', mode: 'simulation',
        question_id: 'q-test', question_json: { company: 'TestCo', product: 'TestProd' },
        step_drafts: {}, framework_draft: {}, created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }) });
    });
    await page.route('**/api/guest-circles-sessions/sess-test-1/progress', r => r.fulfill({ status: 200, body: '{"ok":true}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    await page.waitForSelector('.phase-head');
    await page.locator('.rt-textarea').first().fill('test draft input');
    // Wait for debounce + saving phase
    await page.waitForTimeout(1800);
    expect(draftPosted).toBe(true);
  });

  test('offcanvas shows active session as "草稿" with relative time, no score', async ({ page }) => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'a1', status: 'active', mode: 'drill', drill_step: 'C1',
        question_id: 'q1', question_json: { company: 'Discord', product: 'Voice' },
        step_drafts: { P1: { boundaryScope: 'foo' } }, updated_at: tenMinAgo, created_at: tenMinAgo }
    ]) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('.navbar__icon-btn[data-offcanvas="open"], button[data-nav="offcanvas"], button[data-offcanvas="open"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    const meta = await page.locator('.offcanvas-item__meta').first().textContent();
    expect(meta).toContain('草稿');
    expect(meta).toContain('CIRCLES');
    expect(meta).toContain('C 澄清');
    const date = await page.locator('.offcanvas-item__date').first().textContent();
    expect(date).toContain('分鐘前編輯');
    const scoreCount = await page.locator('.offcanvas-item__score').count();
    expect(scoreCount).toBe(0);
  });

  test('offcanvas shows simulation active as "進行中" with relative time', async ({ page }) => {
    const fiveHrAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'a2', status: 'active', mode: 'simulation',
        question_id: 'q2', question_json: { company: 'Spotify', product: 'Wrapped' },
        step_drafts: {}, updated_at: fiveHrAgo, created_at: fiveHrAgo }
    ]) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    const meta = await page.locator('.offcanvas-item__meta').first().textContent();
    expect(meta).toContain('進行中');
    expect(meta).toContain('完整 7 步');
    const date = await page.locator('.offcanvas-item__date').first().textContent();
    expect(date).toContain('小時前編輯');
  });

  test('completed session still shows score (no regression)', async ({ page }) => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'c1', status: 'scored', mode: 'simulation',
        question_id: 'q3', question_json: { company: 'Meta', product: 'Marketplace' },
        step_scores: { S: { totalScore: 78 } }, updated_at: yesterday, created_at: yesterday }
    ]) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    const score = await page.locator('.offcanvas-item__score').first().textContent();
    expect(score).toContain('78');
    expect(score).toContain('分'); // mockup 09 line 367「78 分」
    const meta = await page.locator('.offcanvas-item__meta').first().textContent();
    expect(meta).not.toContain('進行中');
    expect(meta).not.toContain('草稿');
  });

  test('empty copy aligned to mockup (進行中與已完成 cue)', async ({ page }) => {
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-empty__sub');
    const sub = await page.locator('.offcanvas-empty__sub').textContent();
    expect(sub).toContain('進行中');
    expect(sub).toContain('已完成');
  });
});
