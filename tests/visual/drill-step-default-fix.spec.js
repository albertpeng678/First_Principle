// tests/visual/drill-step-default-fix.spec.js
// P0 user-reported: 4 個別步驟 sessions 同題 → offcanvas 變成 (C 澄清 × 2 + 步驟加練 × 2)。
// Root cause: 點「步驟加練」mode-card 後 circlesDrillStep 未 default → POST /draft body
// 缺 drill_step → 後端 row drill_step=null。後續 drill-pill 點選後再 POST /draft 因
// (qid, mode, drill_step) tuple 不同被視為新 session（backend idempotent guard 行為）。
//
// Fix: mode-card click handler 進 drill mode 時自動 default circlesDrillStep='C1'
// 若 user 尚未選 step。
//
// 驗證：
// 1. 點 步驟加練 mode-card 後立即 AppState.circlesDrillStep === 'C1'
// 2. 點 q-card 觸發 preflight → POST /draft body 含 drill_step: 'C1'
// 3. 重複進入同題目 → backend idempotent → 不會疊加新 session
// 4. user 已選 drill-pill (e.g. 'I') → 點 mode-card 不覆蓋 user 選擇
// 5. simulation mode 不受影響（drill_step 不送入 body）
const { test, expect } = require('@playwright/test');

function stubBaseStats(page) {
  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('P0 — drill mode default drill_step fix', () => {
  test('clicking 步驟加練 mode-card auto-defaults circlesDrillStep to C1', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');

    // Initial state: drillStep null
    const initialStep = await page.evaluate(() => window.AppState.circlesDrillStep);
    expect(initialStep).toBeNull();

    // Click 步驟加練 mode-card
    await page.locator('[data-circles-mode="drill"]').click();
    await page.waitForTimeout(100);

    // Verify drillStep was auto-defaulted
    const stepAfterClick = await page.evaluate(() => window.AppState.circlesDrillStep);
    expect(stepAfterClick).toBe('C1');

    // Mode also set
    const mode = await page.evaluate(() => window.AppState.circlesMode);
    expect(mode).toBe('drill');
  });

  test('POST /draft body carries drill_step="C1" when mode-card 步驟加練 → q-card flow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);

    let postBody = null;
    await page.route('**/api/guest-circles-sessions/draft', r => {
      try { postBody = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'sess-test', question_id: postBody && postBody.question_id, mode: 'drill', drill_step: 'C1',
        status: 'active', current_phase: 1, sim_step_index: 0, step_drafts: {}, framework_draft: {},
      }) });
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');

    // Click 步驟加練 mode-card
    await page.locator('[data-circles-mode="drill"]').click();
    await page.waitForTimeout(100);

    // Click first q-card → expand → confirm
    const firstCard = page.locator('.qcard').first();
    const qid = await firstCard.getAttribute('data-qid');
    await firstCard.click();
    await page.locator(`.qcard[data-qid="${qid}"] [data-circles="qcard-confirm"]`).click();
    await page.waitForSelector('.rt-textarea');

    // Wait for preflight to fire
    await page.waitForTimeout(800);

    expect(postBody).toBeTruthy();
    expect(postBody.mode).toBe('drill');
    expect(postBody.drill_step).toBe('C1'); // BUG (pre-fix): would be undefined → backend stores null
    expect(postBody.question_id).toBe(qid);
  });

  test('user-selected drill-pill is NOT overwritten by subsequent mode-card click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');

    // Simulate user explicitly clicking 步驟加練 first
    await page.locator('[data-circles-mode="drill"]').click();
    await page.waitForTimeout(100);

    // Then user clicks drill-pill 'I' (from drill-rail)
    await page.evaluate(() => {
      window.AppState.circlesDrillStep = 'I';
      window.renderApp();
    });
    await page.waitForTimeout(100);

    // User toggles to simulation then back to drill — drillStep should preserve 'I'
    await page.locator('[data-circles-mode="simulation"]').click();
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.AppState.circlesDrillStep)).toBe('I'); // preserved across mode toggle

    await page.locator('[data-circles-mode="drill"]').click();
    await page.waitForTimeout(100);
    // Returning to drill — should still be 'I' not reset to 'C1'
    expect(await page.evaluate(() => window.AppState.circlesDrillStep)).toBe('I');
  });

  test('simulation mode-card click does NOT set drill_step (sim path unaffected)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);

    let postBody = null;
    await page.route('**/api/guest-circles-sessions/draft', r => {
      try { postBody = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'sess-sim', question_id: 'q-sim', mode: 'simulation',
        status: 'active', current_phase: 1, sim_step_index: 0, step_drafts: {}, framework_draft: {},
      }) });
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');

    // Click 完整模擬 mode-card
    await page.locator('[data-circles-mode="simulation"]').click();
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.AppState.circlesMode)).toBe('simulation');

    // Click q-card flow
    const firstCard = page.locator('.qcard').first();
    const qid = await firstCard.getAttribute('data-qid');
    await firstCard.click();
    await page.locator(`.qcard[data-qid="${qid}"] [data-circles="qcard-confirm"]`).click();
    await page.waitForSelector('.rt-textarea');
    await page.waitForTimeout(800);

    expect(postBody).toBeTruthy();
    expect(postBody.mode).toBe('simulation');
    expect(postBody.drill_step).toBeUndefined(); // sim mode never sends drill_step
  });

  test('regression: same drill question + same step does NOT create duplicate session', async ({ page }) => {
    // Backend idempotent guard ensures (qid, mode, drill_step) tuple matches → returns existing.
    // With our fix, both rounds use drill_step='C1' so they hit the same row.
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);

    let postCalls = [];
    let returnedId = 'sess-dup-test';
    await page.route('**/api/guest-circles-sessions/draft', r => {
      let body;
      try { body = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
      postCalls.push(body);
      // Backend idempotent: same tuple returns same row
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: returnedId, question_id: body.question_id, mode: body.mode, drill_step: body.drill_step,
        status: 'active', current_phase: 1, sim_step_index: 0, step_drafts: {}, framework_draft: {},
      }) });
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');

    // Round 1: click drill mode-card + q-card
    await page.locator('[data-circles-mode="drill"]').click();
    await page.waitForTimeout(100);
    const firstCard = page.locator('.qcard').first();
    const qid = await firstCard.getAttribute('data-qid');
    await firstCard.click();
    await page.locator(`.qcard[data-qid="${qid}"] [data-circles="qcard-confirm"]`).click();
    await page.waitForSelector('.rt-textarea');
    await page.waitForTimeout(800);

    // Round 2: navigate home, click drill again, same q-card
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.circlesPhase = 1;
      window.AppState.circlesSelectedQuestion = null;
      window.AppState.circlesSession = null;
      window.renderApp();
    });
    await page.waitForSelector('.qcard');
    await page.locator('[data-circles-mode="drill"]').click();
    await page.waitForTimeout(100);
    await page.locator(`.qcard[data-qid="${qid}"]`).click();
    await page.locator(`.qcard[data-qid="${qid}"] [data-circles="qcard-confirm"]`).click();
    await page.waitForSelector('.rt-textarea');
    await page.waitForTimeout(800);

    // Both POST calls should have drill_step: 'C1' — same tuple → backend idempotent dedup
    expect(postCalls.length).toBeGreaterThanOrEqual(2);
    postCalls.forEach(call => {
      expect(call.mode).toBe('drill');
      expect(call.drill_step).toBe('C1');
    });
  });
});
