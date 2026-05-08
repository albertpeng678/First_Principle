// tests/visual/draft-data-loss-fix.spec.js
// P0 user-reported regression: 已暫存內容點回去就清空。
// Three layered failure modes covered:
//   A. triggerSaveCycle race — first PATCH skipped because POST /draft slower than 600ms
//      → backend step_drafts/framework_draft remain empty
//   B. q-card-confirm path — clicking the same question on home wiped state without consulting
//      localStorage cache
//   C. restoreCirclesPhase1FromSession merge — local.ts <= serverTs skipped fallback, even
//      when backend was empty
const { test, expect } = require('@playwright/test');

function stubBaseStats(page, opts) {
  page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":1,"weeklyCompleted":0}' }));
  page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  if (opts && opts.list) {
    const body = JSON.stringify(opts.list);
    page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body }));
    page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body }));
  } else {
    page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  }
}

test.describe('P0 — draft data loss fix', () => {
  // ─────────────────────────────────────────────────────────────────
  // Cause A — saveCycle race: first PATCH must fire even when POST /draft
  // resolves slower than the 600ms display delay.
  // ─────────────────────────────────────────────────────────────────
  test('Cause A — slow POST /draft no longer drops PATCH (race fix)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page, { list: [] });

    let patchedBody = null;
    let patchHits = 0;
    let postDraftHits = 0;

    // Slow-roll session creation by 1500ms (well past the 600ms inner timer)
    await page.route('**/api/guest-circles-sessions/draft', async r => {
      postDraftHits += 1;
      await new Promise(res => setTimeout(res, 1500));
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'sess-race-1', question_id: 'q1', mode: 'drill', drill_step: 'C1',
        status: 'active', current_phase: 1, sim_step_index: 0,
        step_drafts: {}, framework_draft: {},
      }) });
    });
    await page.route('**/api/guest-circles-sessions/sess-race-1/progress', async r => {
      patchHits += 1;
      try { patchedBody = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.goto('/');
    await page.waitForSelector('.qcard');
    // Force into Phase 1 with a synthetic qid so save cycle has a known target.
    await page.evaluate(() => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 1,
        circlesMode: 'drill',
        circlesDrillStep: 'C1',
        circlesSimStep: 0,
        circlesSelectedQuestion: { id: 'q1', company: 'Spotify', product: 'Spotify Podcast', question_type: 'design' },
        circlesFrameworkDraft: {},
        circlesSession: null,
      });
      window.renderApp();
    });
    await page.waitForSelector('.rt-textarea');

    // Type into idx 0 — triggers saveCycle 800ms debounce, then 600ms inner timer.
    await page.locator('.rt-textarea').first().focus();
    await page.keyboard.type('race-fix-content');
    // Wait for full save cycle to complete: 800ms debounce + 1500ms POST + PATCH RTT.
    await page.waitForTimeout(3500);

    expect(postDraftHits).toBeGreaterThanOrEqual(1);
    // BUG (pre-fix): patchHits would be 0 because session.id was undefined when 600ms timer fired.
    expect(patchHits).toBeGreaterThanOrEqual(1);
    expect(patchedBody).toBeTruthy();
    expect(patchedBody.frameworkDraft).toBeTruthy();
    expect(JSON.stringify(patchedBody.frameworkDraft)).toContain('race-fix-content');
  });

  // ─────────────────────────────────────────────────────────────────
  // Cause B — q-card-confirm restores from localStorage when no session
  // is present in already-loaded recent rail / history list.
  // ─────────────────────────────────────────────────────────────────
  test('Cause B — q-card-confirm restores from localStorage cache', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    stubBaseStats(page, { list: [] });
    await page.route('**/api/guest-circles-sessions/draft', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 'sess-fresh', question_id: 'will-fill-later', mode: 'simulation', status: 'active', current_phase: 1, sim_step_index: 0, step_drafts: {}, framework_draft: {},
    }) }));

    await page.goto('/');
    await page.waitForSelector('.qcard');

    // Use the actually-rendered first qcard's qid so the click handler matches.
    const qid = await page.evaluate(() => {
      const card = document.querySelector('.qcard');
      return card && card.getAttribute('data-qid');
    });
    expect(qid).toBeTruthy();

    // Seed prior typed-but-not-synced draft in localStorage for that qid.
    await page.evaluate(({ qid }) => {
      localStorage.setItem('pmdrill:circles:draft:' + qid, JSON.stringify({
        framework: { C1: { '問題範圍': '從 localStorage 救回來' } },
        ts: Date.now() - 10000,
      }));
    }, { qid });

    // Click the qcard to expand, then 確認，開始練習
    await page.locator(`.qcard[data-qid="${qid}"]`).click();
    await page.locator(`.qcard[data-qid="${qid}"] [data-circles="qcard-confirm"]`).click();
    await page.waitForSelector('.rt-textarea');

    const idx0Text = (await page.locator('.rt-textarea').nth(0).textContent()).trim();
    expect(idx0Text).toBe('從 localStorage 救回來');
  });

  // ─────────────────────────────────────────────────────────────────
  // Cause C — when backend session is empty (PATCH was lost) but localStorage
  // has content, restoreCirclesPhase1FromSession must use localStorage even when
  // local.ts <= serverTs.
  // ─────────────────────────────────────────────────────────────────
  test('Cause C — backend empty, localStorage older still wins on restore', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const qid = 'q-bug-c';
    // serverTs (from updated_at) is NEWER than localTs — pre-fix would skip merge.
    const serverNow = Date.now();
    const session = {
      id: 'sess-bug-c', question_id: qid,
      question_json: { id: qid, company: 'Spotify', product: 'Spotify Podcast' },
      mode: 'drill', drill_step: 'C1', current_phase: 1, sim_step_index: 0, status: 'active',
      step_drafts: {},                  // empty — first PATCH was lost
      framework_draft: {},              // empty — same reason
      created_at: new Date(serverNow - 5000).toISOString(),
      updated_at: new Date(serverNow).toISOString(), // serverTs > localTs
    };
    stubBaseStats(page, { list: [session] });
    await page.route('**/api/guest-circles-sessions/' + session.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }));

    await page.goto('/');
    await page.waitForSelector('.qcard');

    // Seed localStorage BEFORE serverTs (older) — pre-fix would NOT merge.
    await page.evaluate(({ qid, ts }) => {
      localStorage.setItem('pmdrill:circles:draft:' + qid, JSON.stringify({
        framework: { C1: { '問題範圍': 'backend 空，但 local 有' } },
        ts,
      }));
    }, { qid, ts: serverNow - 10000 });

    // Open offcanvas and click the in-progress draft.
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.rt-textarea', { timeout: 5000 });

    const idx0Text = (await page.locator('.rt-textarea').nth(0).textContent()).trim();
    expect(idx0Text).toBe('backend 空，但 local 有');
  });
});
