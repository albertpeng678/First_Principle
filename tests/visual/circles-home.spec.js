// Path 2 · Plan B · Sub-bundle 1 — CIRCLES Home（mockup 01）
// BEM contract + 5-random + reshuffle + mode toggle + type tab.
// Source of truth: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/01-circles-home.html
const { test, expect } = require('@playwright/test');

test.describe('B1 CIRCLES Home', () => {

  test.beforeEach(async ({ page }) => {
    // Stub stats endpoint so renderStats has deterministic counts
    await page.route('**/api/circles-stats**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ completed: 12, active: 3, weeklyCompleted: 5 })
    }));
    // Stub history empty so offcanvas / recent-rail won't fetch real data
    await page.route('**/api/circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest-circles-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  });

  test('renders core sections: stats-strip / qa-row / mode-selector / search / type-tabs / q-list / reshuffle / nsm-promo', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.navbar');
    // home view by default (AppState.view === 'circles')
    await expect(page.locator('.stats-strip')).toBeVisible();
    await expect(page.locator('.qa-row')).toBeVisible();
    await expect(page.locator('.qa-row__title')).toHaveText('什麼是 CIRCLES 實戰訓練？');
    await expect(page.locator('.mode-selector')).toBeVisible();
    await expect(page.locator('.mode-card')).toHaveCount(2);
    await expect(page.locator('.search-wrap input[type="search"]')).toBeVisible();
    await expect(page.locator('.type-tabs')).toBeVisible();
    await expect(page.locator('.type-tab')).toHaveCount(3);
    await expect(page.locator('.q-list')).toBeVisible();
    await expect(page.locator('.reshuffle')).toBeVisible();
    await expect(page.locator('.nsm-promo')).toBeVisible();
  });

  test('q-list renders exactly 5 random qcards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qcard');
    const cards = page.locator('.qcard');
    expect(await cards.count()).toBe(5);
    // Each qcard has head with __num and __title, meta with mode-tag, and body
    for (let i = 0; i < 5; i++) {
      await expect(cards.nth(i).locator('.qcard__num')).toBeVisible();
      await expect(cards.nth(i).locator('.qcard__title')).toBeVisible();
      await expect(cards.nth(i).locator('.qcard__meta .mode-tag')).toBeVisible();
      await expect(cards.nth(i).locator('.qcard__body')).toBeVisible();
    }
  });

  test('default mode is simulation (mode-card[0] is-active, mode-tag--sim on cards)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-selector');
    await expect(page.locator('.mode-card').nth(0)).toHaveClass(/is-active/);
    await expect(page.locator('.mode-card').nth(1)).not.toHaveClass(/is-active/);
    // qcard meta should carry mode-tag--sim in default sim mode
    const tags = await page.locator('.qcard .mode-tag').first().getAttribute('class');
    expect(tags).toMatch(/mode-tag--sim/);
  });

  test('clicking mode-card[1] switches to drill mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-selector');
    await page.locator('.mode-card').nth(1).click();
    await expect(page.locator('.mode-card').nth(1)).toHaveClass(/is-active/);
    await expect(page.locator('.mode-card').nth(0)).not.toHaveClass(/is-active/);
    // qcard mode-tag should switch to drill variant
    const tags = await page.locator('.qcard .mode-tag').first().getAttribute('class');
    expect(tags).toMatch(/mode-tag--drill/);
  });

  test('default type tab is design ×40 active; type counts ×40 / ×35 / ×25 from CIRCLES_QUESTIONS', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.type-tabs');
    const tabs = page.locator('.type-tab');
    await expect(tabs.nth(0)).toHaveClass(/is-active/);
    await expect(tabs.nth(0)).toContainText('產品設計');
    await expect(tabs.nth(0)).toContainText('40');
    await expect(tabs.nth(1)).toContainText('產品改進');
    await expect(tabs.nth(1)).toContainText('35');
    await expect(tabs.nth(2)).toContainText('產品策略');
    await expect(tabs.nth(2)).toContainText('25');
  });

  test('clicking type-tab switches active and re-picks 5 cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.q-list');
    const before = await page.locator('.qcard__title').allTextContents();
    await page.locator('.type-tab').nth(1).click();
    await expect(page.locator('.type-tab').nth(1)).toHaveClass(/is-active/);
    await expect(page.locator('.type-tab').nth(0)).not.toHaveClass(/is-active/);
    const after = await page.locator('.qcard__title').allTextContents();
    expect(after.length).toBe(5);
    // Different titles likely (improve type subset). Don't assert disjoint (small chance of overlap),
    // just assert that the list re-rendered (count stable).
    expect(before).not.toEqual(after);
  });

  test('reshuffle button re-picks 5 cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.q-list');
    const before = await page.locator('.qcard__title').allTextContents();
    await page.locator('.reshuffle').click();
    await page.waitForTimeout(200);
    const after = await page.locator('.qcard__title').allTextContents();
    expect(after.length).toBe(5);
    expect(after).not.toEqual(before);
  });

  test('stats-strip shows numbers from API (12 / 3 / 5)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.stats-strip');
    await page.waitForFunction(() => {
      const nums = Array.from(document.querySelectorAll('.stats-strip__num')).map(n => n.textContent);
      return nums.includes('12') && nums.includes('3') && nums.includes('5');
    }, null, { timeout: 5000 });
    const nums = await page.locator('.stats-strip__num').allTextContents();
    expect(nums).toContain('12');
    expect(nums).toContain('3');
    expect(nums).toContain('5');
  });

  test('qa-row toggle opens/closes accordion body', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qa-row');
    // Default state per mockup: is-open
    await expect(page.locator('.qa-row')).toHaveClass(/is-open/);
    await page.locator('.qa-row__head').click();
    await expect(page.locator('.qa-row')).not.toHaveClass(/is-open/);
    await page.locator('.qa-row__head').click();
    await expect(page.locator('.qa-row')).toHaveClass(/is-open/);
  });

  test('nsm-promo CTA links / triggers nav to NSM', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.nsm-promo');
    await expect(page.locator('.nsm-promo__title')).toContainText('北極星');
    await page.locator('.nsm-promo__cta').click();
    // navigation should land on NSM view
    await expect(page.locator('[data-view="nsm"], .nsm-view, .nsm-step1')).toBeVisible();
  });

  // ── SB2 carry-forward tests ──────────────────────────────────

  test('drill mode renders .drill-rail with title 練習步驟 + 3 drill-pill C/I/R', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mode-card').nth(1).click(); // switch to drill
    await page.waitForSelector('.drill-rail');
    await expect(page.locator('.drill-rail__title')).toHaveText('練習步驟');
    const pills = page.locator('.drill-pill');
    expect(await pills.count()).toBe(3);
    await expect(pills.nth(0).locator('.step-letter')).toHaveText('C');
    await expect(pills.nth(1).locator('.step-letter')).toHaveText('I');
    await expect(pills.nth(2).locator('.step-letter')).toHaveText('R');
    await expect(page.locator('.drill-rail__lock')).toBeVisible();
  });

  test('drill-pill click sets active and AppState.circlesDrillStep', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mode-card').nth(1).click();
    await page.waitForSelector('.drill-pill');
    await page.locator('.drill-pill').nth(1).click(); // I
    await expect(page.locator('.drill-pill').nth(1)).toHaveClass(/is-active/);
    const state = await page.evaluate(() => window.AppState.circlesDrillStep);
    expect(state).toBe('I');
  });

  test('qcard click toggles is-expanded', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qcard');
    const first = page.locator('.qcard').first();
    await expect(first).not.toHaveClass(/is-expanded/);
    await first.click();
    await expect(first).toHaveClass(/is-expanded/);
    await first.click();
    await expect(first).not.toHaveClass(/is-expanded/);
  });

  test('expanded qcard renders __full-statement + 4 ana-block (1 trap) + action-row', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('.qcard').first().click();
    await expect(page.locator('.qcard.is-expanded .qcard__full-statement')).toBeVisible();
    const blocks = page.locator('.qcard.is-expanded .ana-block');
    expect(await blocks.count()).toBe(4);
    expect(await page.locator('.qcard.is-expanded .ana-block--trap').count()).toBe(1);
    await expect(page.locator('.qcard.is-expanded .qcard__action-row')).toBeVisible();
    await expect(page.locator('.qcard.is-expanded .qcard__btn--ghost')).toContainText('取消');
    await expect(page.locator('.qcard.is-expanded .qcard__btn--primary')).toContainText('確認，開始練習');
  });

  test('expanded qcard primary btn → enters Phase 1 form (sets circlesSelectedQuestion + phase=1)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('.qcard').first().click();
    await page.locator('.qcard__btn--primary').click();
    const state = await page.evaluate(() => ({
      view: window.AppState.view,
      phase: window.AppState.circlesPhase,
      hasQuestion: !!window.AppState.circlesSelectedQuestion,
    }));
    expect(state.view).toBe('circles');
    expect(state.phase).toBe(1);
    expect(state.hasQuestion).toBe(true);
  });

  test('recent-rail loads from history API and renders 5 .recent-item', async ({ page }) => {
    const fakeC = Array.from({ length: 4 }, (_, i) => ({
      id: 'c' + i, mode: i % 2 === 0 ? 'simulation' : 'drill', drill_step: i % 2 === 0 ? null : 'C1',
      question_json: { id: 'q'+i, company: 'Co'+i, product: 'P'+i },
      currentQuestion: { id: 'q'+i, company: 'Co'+i, product: 'P'+i },
      status: i === 0 ? 'completed' : 'active',
      step_scores: i === 0 ? { S: { totalScore: 78 } } : {},
      current_phase: 2 + (i % 3),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
    }));
    const fakeN = [{
      id: 'n0', question_json: { id: 'nq0', company: 'Asana', product: '工作協作' },
      currentQuestion: { id: 'nq0', company: 'Asana', product: '工作協作' },
      status: 'completed', scores_json: { totalScore: 92 },
      updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
      created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    }];
    await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeC) }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeC) }));
    await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeN) }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeN) }));
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForSelector('.recent-rail');
    await page.waitForFunction(() => document.querySelectorAll('.recent-item').length === 5, null, { timeout: 5000 });
    const items = page.locator('.recent-item');
    expect(await items.count()).toBe(5);
    // each item must contain mode-tag + __title + __phase
    await expect(items.first().locator('.mode-tag')).toBeVisible();
    await expect(items.first().locator('.recent-item__title')).toBeVisible();
    await expect(items.first().locator('.recent-item__phase')).toBeVisible();
  });

  test('mode-card body desktop shows long-form text (≥30 chars)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForSelector('.mode-card');
    const visibleBody = await page.locator('.mode-card').nth(0).locator('.mode-card__body:not([hidden]):not([style*="display: none"])').textContent();
    // long form per mockup line 1020 contains "C → I → R → C → L → E → S"
    expect(visibleBody).toMatch(/C\s*[→]\s*I\s*[→]\s*R/);
  });

  test('mode-card body mobile shows short-form text', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    await page.waitForSelector('.mode-card');
    const visibleBody = await page.locator('.mode-card').nth(0).locator('.mode-card__body').first().textContent();
    expect(visibleBody.trim()).toBe('7 步循序練習');
  });
});
