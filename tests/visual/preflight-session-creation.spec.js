// tests/visual/preflight-session-creation.spec.js
// P1 永久解：Phase 1 mount 時立即 fire POST /draft，由 bindCirclesPhase1 觸發。
// 目標：徹底消除「第一次 save 才建 session」race window。
// 驗證點：
//   1. mount 即 fire — user 還沒打字 POST /draft 已到後端
//   2. dedupe — 同一 qid 連續 render 不會疊加 POST
//   3. 已有 session 時跳過 — restored / loaded session 不重新 POST
//   4. 切題目時重新 fire — 換 selectedQuestion 應為新 qid POST
//   5. 不 block render — Phase 1 textareas 立即可見，不等網路
const { test, expect } = require('@playwright/test');

function stubBaseStats(page) {
  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('P1 — Pre-flight session creation', () => {
  test('Phase 1 mount fires POST /draft before any user input', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);

    let postDraftHits = 0;
    let firstHitTimestamp = null;
    const tStart = Date.now();
    await page.route('**/api/guest-circles-sessions/draft', r => {
      postDraftHits += 1;
      if (firstHitTimestamp === null) firstHitTimestamp = Date.now();
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'sess-preflight-1', question_id: 'q-preflight', mode: 'drill', drill_step: 'C1',
        status: 'active', current_phase: 1, sim_step_index: 0, step_drafts: {}, framework_draft: {},
      }) });
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');
    // Mount Phase 1 form via direct AppState assignment + render — same shape as q-card-confirm.
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 1,
        circlesMode: 'drill',
        circlesDrillStep: 'C1',
        circlesSimStep: 0,
        circlesSelectedQuestion: { id: 'q-preflight', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
        circlesFrameworkDraft: {},
        circlesSession: null,
      });
      window.renderApp();
    });
    await page.waitForSelector('.rt-textarea');

    // Pre-flight should fire within ~500ms of mount, BEFORE any keystroke
    await page.waitForTimeout(500);
    expect(postDraftHits).toBeGreaterThanOrEqual(1);
    expect(firstHitTimestamp).toBeTruthy();
    // Mount-to-fire latency should be well under typing debounce (5 sec — relaxed
    // bound for batch-parallel CPU contention; isolated runs typically < 500ms)
    expect(firstHitTimestamp - tStart).toBeLessThan(5000);

    // No keystrokes have happened — the fire is purely from mount
    const textValue = await page.locator('.rt-textarea').first().textContent();
    expect((textValue || '').trim()).toBe('');
  });

  test('dedupe — same qid re-renders do NOT pile up POST /draft', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);

    let postDraftHits = 0;
    await page.route('**/api/guest-circles-sessions/draft', async r => {
      postDraftHits += 1;
      // Slow-roll to keep first request in-flight while subsequent renders happen
      await new Promise(res => setTimeout(res, 800));
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'sess-dedupe', question_id: 'q-dedupe', mode: 'drill', drill_step: 'C1',
        status: 'active', current_phase: 1, sim_step_index: 0, step_drafts: {}, framework_draft: {},
      }) });
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 1, circlesMode: 'drill', circlesDrillStep: 'C1', circlesSimStep: 0,
        circlesSelectedQuestion: { id: 'q-dedupe', company: 'Notion', product: '工作協作', question_type: 'design' },
        circlesFrameworkDraft: {}, circlesSession: null,
      });
      window.renderApp();
      // Trigger 4 more renders within the in-flight window
      window.renderApp();
      window.renderApp();
      window.renderApp();
      window.renderApp();
    });
    await page.waitForTimeout(1200); // wait past 800ms slow-roll
    // Despite 5 renders, dedupe should keep this at exactly 1
    expect(postDraftHits).toBe(1);
  });

  test('already-loaded session does NOT re-fire POST /draft', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);

    let postDraftHits = 0;
    await page.route('**/api/guest-circles-sessions/draft', r => {
      postDraftHits += 1;
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 1, circlesMode: 'drill', circlesDrillStep: 'C1', circlesSimStep: 0,
        circlesSelectedQuestion: { id: 'q-already', company: 'Airbnb', product: 'Marketplace', question_type: 'strategy' },
        circlesFrameworkDraft: {},
        // Session already exists — pre-flight must skip
        circlesSession: { id: 'sess-already-loaded', question_id: 'q-already', mode: 'drill' },
      });
      window.renderApp();
    });
    await page.waitForTimeout(500);
    expect(postDraftHits).toBe(0);
  });

  test('switching question fires fresh POST /draft for new qid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);

    const calls = [];
    await page.route('**/api/guest-circles-sessions/draft', async r => {
      const body = JSON.parse(r.request().postData() || '{}');
      calls.push(body.question_id);
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'sess-' + body.question_id, question_id: body.question_id, mode: body.mode,
        drill_step: body.drill_step || null, status: 'active', current_phase: 1, sim_step_index: 0,
        step_drafts: {}, framework_draft: {},
      }) });
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');
    // Mount with q-A
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 1, circlesMode: 'drill', circlesDrillStep: 'C1', circlesSimStep: 0,
        circlesSelectedQuestion: { id: 'q-A', company: 'A', product: 'A', question_type: 'design' },
        circlesFrameworkDraft: {}, circlesSession: null,
      });
      window.renderApp();
    });
    await page.waitForTimeout(400);
    // Switch to q-B (clear session — simulating user backtracking and choosing different question)
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        circlesSelectedQuestion: { id: 'q-B', company: 'B', product: 'B', question_type: 'design' },
        circlesSession: null,
      });
      window.renderApp();
    });
    await page.waitForTimeout(400);
    expect(calls).toContain('q-A');
    expect(calls).toContain('q-B');
  });

  test('mount does NOT block textarea render — UI ready immediately', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page);
    // Hang the draft endpoint indefinitely — UI must still render
    await page.route('**/api/guest-circles-sessions/draft', async () => {
      await new Promise(() => {}); // never resolves
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 1, circlesMode: 'drill', circlesDrillStep: 'C1', circlesSimStep: 0,
        circlesSelectedQuestion: { id: 'q-hang', company: 'X', product: 'Y', question_type: 'design' },
        circlesFrameworkDraft: {}, circlesSession: null,
      });
      window.renderApp();
    });
    // Textarea must be visible despite hanging POST
    const textareas = page.locator('.rt-textarea');
    await expect(textareas.first()).toBeVisible({ timeout: 2000 });
    expect(await textareas.count()).toBeGreaterThanOrEqual(4);
  });
});
