// Path 2 — Offcanvas item click → load session + restore drafts (mockup 09 line 296)
// Task A: TDD 紅燈 spec — 先寫，實作後全綠。
// Run: npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 --project=Mobile-360 tests/visual/offcanvas-item-click-restore.spec.js --reporter=line

const { test, expect } = require('@playwright/test');

test.describe('Offcanvas item click — load session + restore drafts (mockup 09 line 296)', () => {
  // sample stub data — circles session with step_drafts + framework_draft
  function sampleActiveSession() {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    return {
      id: 'sess-restore-1',
      question_id: 'q-restore-1',
      question_json: { id: 'q-restore-1', company: 'Spotify', product: 'Spotify Podcast', industry: '音樂串流', type: 'design' },
      mode: 'drill',
      drill_step: 'C1',
      current_phase: 1,
      sim_step_index: 0,
      status: 'active',
      step_drafts: {
        P1: { boundaryScope: '針對 Spotify Podcast', timeWindow: '6 個月', businessImpact: 'NSM 收聽時長', assumption: '通勤族日常' },
        P1S: null, P1L: null, P1E: null,
        framework: null, ts: Date.now()
      },
      framework_draft: { C1: { boundaryScope: '針對 Spotify Podcast', timeWindow: '6 個月', businessImpact: 'NSM 收聽時長', assumption: '通勤族日常' } },
      created_at: tenMinAgo, updated_at: tenMinAgo
    };
  }

  async function gotoOffcanvasWithItem(page, session) {
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":1,"weeklyCompleted":0}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([session]) }));
    await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([session]) }));
    // GET /:id endpoint returns full session
    await page.route(`**/api/guest-circles-sessions/${session.id}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }));
    await page.route(`**/api/circles-sessions/${session.id}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
  }

  test('Desktop-1280 點 item → 進 Phase 1 form (.phase-head visible)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoOffcanvasWithItem(page, sampleActiveSession());
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
    // offcanvas should close
    expect(await page.locator('.offcanvas-drawer').count()).toBe(0);
    // phase-head shown
    await expect(page.locator('.phase-head__title')).toContainText('C · 澄清情境');
  });

  test('Mobile-360 點 item → 進 Phase 1 form', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoOffcanvasWithItem(page, sampleActiveSession());
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
    await expect(page.locator('.phase-head__eyebrow')).toContainText('Phase 1');
  });

  test('進 form 後 4 個 textarea 有 restore 內容（從 framework_draft.C1 讀回）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoOffcanvasWithItem(page, sampleActiveSession());
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.rt-textarea', { timeout: 5000 });
    const textareas = page.locator('.rt-textarea');
    const count = await textareas.count();
    expect(count).toBe(4);
    // each textarea content matches framework_draft.C1
    expect(await textareas.nth(0).textContent()).toContain('針對 Spotify Podcast');
    expect(await textareas.nth(1).textContent()).toContain('6 個月');
    expect(await textareas.nth(2).textContent()).toContain('NSM 收聽時長');
    expect(await textareas.nth(3).textContent()).toContain('通勤族日常');
  });

  test('AppState.circlesSession.id correctly set after item click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoOffcanvasWithItem(page, sampleActiveSession());
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
    const sessionId = await page.evaluate(() => window.AppState && window.AppState.circlesSession && window.AppState.circlesSession.id);
    expect(sessionId).toBe('sess-restore-1');
  });

  test('AppState.circlesFrameworkDraft restored from session.framework_draft', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoOffcanvasWithItem(page, sampleActiveSession());
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
    const fw = await page.evaluate(() => window.AppState && window.AppState.circlesFrameworkDraft);
    expect(fw).toBeTruthy();
    expect(fw.C1).toBeTruthy();
    expect(fw.C1.boundaryScope).toContain('Spotify Podcast');
  });

  test('drill mode + drill_step C1 restored', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoOffcanvasWithItem(page, sampleActiveSession());
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
    const drillStep = await page.evaluate(() => window.AppState && window.AppState.circlesDrillStep);
    const mode = await page.evaluate(() => window.AppState && window.AppState.circlesMode);
    expect(drillStep).toBe('C1');
    expect(mode).toBe('drill');
  });

  // ── B3 Round-2 additional specs ───────────────────────────────────────────

  test('char-counter shows actual length not 0 after textarea restore', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoOffcanvasWithItem(page, sampleActiveSession());
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.rt-textarea', { timeout: 5000 });
    // char-counter only on field idx=0; content is '針對 Spotify Podcast' (14 chars)
    const counter = page.locator('.char-counter').first();
    await expect(counter).toBeVisible();
    const text = await counter.textContent();
    // must NOT be '0 / 120' — should reflect actual content length
    expect(text).not.toMatch(/^0\s*\/\s*\d+/);
    // should be non-zero
    const match = text.match(/^(\d+)\s*\//);
    expect(match).toBeTruthy();
    expect(parseInt(match[1], 10)).toBeGreaterThan(0);
  });

  test('NSM session click → nsmStep=4 + view=nsm', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const nsmSession = {
      id: 'nsm-test-1', question_id: 'nq1',
      question_json: { id: 'nq1', company: 'Asana', product: '工作協作' },
      status: 'completed', scores_json: { totalScore: 92, scores: {} },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([nsmSession]) }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([nsmSession]) }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    await page.waitForTimeout(300);
    const view = await page.evaluate(() => window.AppState && window.AppState.view);
    const nsmStep = await page.evaluate(() => window.AppState && window.AppState.nsmStep);
    expect(view).toBe('nsm');
    expect(nsmStep).toBe(4);
  });

  test('step_drafts null/{} 不 throw', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const emptyDraftSession = {
      id: 'sess-empty', question_id: 'q-empty',
      question_json: { id: 'q-empty', company: 'EmptyCo', product: 'EmptyProd' },
      mode: 'drill', drill_step: 'C1', status: 'active',
      step_drafts: null, framework_draft: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([emptyDraftSession]) }));
    await page.route('**/api/guest-circles-sessions/' + emptyDraftSession.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyDraftSession) }));
    await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([emptyDraftSession]) }));
    await page.route('**/api/circles-sessions/' + emptyDraftSession.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyDraftSession) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.phase-head', { timeout: 5000 });
    // no JS error, form rendered with empty textareas
    expect(errors).toEqual([]);
  });

  test('L step P1L solutions restore (mechanism + name)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const lStepSession = {
      id: 'sess-l-1', question_id: 'q-l-1',
      question_json: { id: 'q-l-1', company: 'LCo', product: 'LProd' },
      mode: 'drill', drill_step: 'L', status: 'active', current_phase: 1, sim_step_index: 4,
      step_drafts: {
        P1: null, P1S: null, P1E: null,
        P1L: [
          { name: 'SolutionA-name', mechanism: 'SolutionA-mechanism' },
          { name: 'SolutionB-name', mechanism: 'SolutionB-mechanism' }
        ],
        ts: Date.now()
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([lStepSession]) }));
    await page.route('**/api/guest-circles-sessions/' + lStepSession.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lStepSession) }));
    await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([lStepSession]) }));
    await page.route('**/api/circles-sessions/' + lStepSession.id, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lStepSession) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.sol-card', { timeout: 5000 });
    // verify L sol-card mechanism + name
    const mechanism0 = await page.locator('.rt-textarea[data-sol-idx="0"]').textContent();
    expect(mechanism0).toContain('SolutionA-mechanism');
    const name0 = await page.locator('input.sol-card__name-input[data-sol-idx="0"]').inputValue();
    expect(name0).toBe('SolutionA-name');
  });

  // ── R3 Round-3 specs (Option B async fetch + loading state + S tracking) ──

  test('Phase 2 session click → GET /:id fetch full conversation, restore to phase 2', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // List partial (no conversation field)
    const listPartial = {
      id: 'sess-p2-1', question_id: 'q-p2',
      question_json: { id: 'q-p2', company: 'TestCo', product: 'TestProd' },
      mode: 'simulation', current_phase: 2, sim_step_index: 0, status: 'active',
      step_drafts: { framework: null, ts: Date.now() },
      framework_draft: { C1: { boundaryScope: 'foo' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      // NO conversation — simulating list endpoint
    };
    // Detail (full payload — Option B)
    const detailFull = Object.assign({}, listPartial, {
      conversation: [
        { role: 'user', content: 'turn 1 user' },
        { role: 'coach', content: 'turn 1 coach reply' }
      ]
    });

    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([listPartial]) }));
    await page.route('**/api/guest-circles-sessions/sess-p2-1', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailFull) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    // Wait for fetch + render
    await page.waitForTimeout(800);
    const phase = await page.evaluate(() => window.AppState && window.AppState.circlesPhase);
    const convLen = await page.evaluate(() => window.AppState && window.AppState.circlesConversation && window.AppState.circlesConversation.length);
    expect(phase).toBe(2); // 不該被 fallback 退回 1
    expect(convLen).toBe(2);
  });

  test('item click → loading-wrap visible briefly during fetch', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = {
      id: 'sess-load-1', question_id: 'q-l1',
      question_json: { id: 'q-l1', company: 'L', product: 'P' },
      mode: 'drill', drill_step: 'C1', status: 'active', current_phase: 1,
      step_drafts: { ts: Date.now() }, framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([session]) }));
    // Delay detail response 500ms
    await page.route('**/api/guest-circles-sessions/sess-load-1', async r => {
      await new Promise(s => setTimeout(s, 500));
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    });
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    // Loading state should appear within 200ms
    await expect(page.locator('.loading-wrap')).toBeVisible({ timeout: 300 });
    // Eventually phase-head shows up
    await page.waitForSelector('.phase-head', { timeout: 2000 });
  });

  test('GET /:id 500 → fallback to list partial item', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const listPartial = {
      id: 'sess-fail-1', question_id: 'q-f1',
      question_json: { id: 'q-f1', company: 'FailCo', product: 'FailProd' },
      mode: 'drill', drill_step: 'C1', status: 'active', current_phase: 1,
      step_drafts: { framework: null, ts: Date.now() },
      framework_draft: { C1: { boundaryScope: '部分資料-list-partial' } },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([listPartial]) }));
    await page.route('**/api/guest-circles-sessions/sess-fail-1', r => r.fulfill({ status: 500, body: 'server error' }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.phase-head', { timeout: 3000 });
    const ta0 = await page.locator('.rt-textarea').first().textContent();
    expect(ta0).toContain('部分資料-list-partial'); // restore from list partial fallback
  });

  test('S step tracking inputs restore from circlesPhase1S.tracking', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const sStepSession = {
      id: 'sess-s-1', question_id: 'q-s-1',
      question_json: { id: 'q-s-1', company: 'SCo', product: 'SProd' },
      mode: 'drill', drill_step: 'S', current_phase: 1, sim_step_index: 6, status: 'active',
      step_drafts: {
        P1S: { recommendation: 'Sol-A', reasoning: '理由', nsm: 'NSM', tracking: { reach: 'reach-val', depth: 'depth-val', frequency: 'freq-val', impact: 'impact-val' } },
        ts: Date.now()
      },
      framework_draft: {},
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    // detail same as list — full payload from list (this stub simulates Option B GET /:id)
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([sStepSession]) }));
    await page.route('**/api/guest-circles-sessions/sess-s-1', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sStepSession) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('input[data-s-tracking]', { timeout: 3000 });
    // 4 tracking inputs each restored (keys: reach/depth/frequency/impact — matches AppState.circlesPhase1S.tracking)
    const trackingDims = ['reach', 'depth', 'frequency', 'impact'];
    for (const dim of trackingDims) {
      const v = await page.locator(`input[data-s-tracking="${dim}"]`).inputValue();
      expect(v).toContain(dim === 'reach' ? 'reach-val' : dim === 'depth' ? 'depth-val' : dim === 'frequency' ? 'freq-val' : 'impact-val');
    }
  });

  test('localStorage newer than detail GET /:id → local override', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const oldServer = {
      id: 'sess-local-2', question_id: 'q-local-2',
      question_json: { id: 'q-local-2', company: 'TestCo', product: 'TestProd' },
      mode: 'drill', drill_step: 'C1', status: 'active', current_phase: 1, sim_step_index: 0,
      step_drafts: { P1: { boundaryScope: 'OLD-server' }, ts: Date.now() - 3600 * 1000 },
      framework_draft: { C1: { boundaryScope: 'OLD-server' } },
      created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 3600 * 1000).toISOString()
    };
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([oldServer]) }));
    await page.route('**/api/guest-circles-sessions/sess-local-2', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(oldServer) }));
    await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      localStorage.setItem('pmdrill:circles:draft:q-local-2', JSON.stringify({
        P1: { boundaryScope: 'NEW-localStorage' },
        framework: { C1: { boundaryScope: 'NEW-localStorage' } },
        ts: Date.now()
      }));
    });
    await page.locator('button[data-nav="offcanvas"]').first().click();
    await page.waitForSelector('.offcanvas-item');
    await page.locator('.offcanvas-item').first().click();
    await page.waitForSelector('.rt-textarea', { timeout: 3000 });
    const firstContent = await page.locator('.rt-textarea').first().textContent();
    expect(firstContent).toContain('NEW-localStorage');
  });
});
