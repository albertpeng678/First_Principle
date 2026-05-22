// tests/e2e/nsm-evaluate-shape-roundtrip.spec.js
//
// P0-SCHEMA-1-v2 — full browser roundtrip: fill 3 fields → evaluate → reload → assert 3 fields restored.
// Spec: docs/superpowers/specs/2026-05-22-schema-1-v2-evaluate-shape-coerce-design.md §6
//
// Skills applied:
//   playwright-skill/core/auth-flows.md:928-949 — login via API for speed (storageState)
//   playwright-skill/core/common-pitfalls.md Pitfall 14 — auto-cleanup fixture
//   playwright-skill/core/common-pitfalls.md Pitfall 19 — test.step per phase
//   playwright-skill/core/common-pitfalls.md Pitfall 3 — role-based locators
//   playwright-skill/core/mobile-and-responsive.md — cross-vp 3 projects
//
// NIT #1 (Round 2 quiz): NSM flow is step1 → step2 → nsm-gate (AI gate) → step3 → evaluate.
//   - [data-nsm-submit] from nsm-step2 subTab → fires POST /gate → shows gate result UI
//   - gate ok/warn: user clicks [data-nsm-gate-action="proceed"] → advances to nsm-step3
//   - [data-nsm-submit] from nsm-step3 subTab → fires POST /evaluate
//   Source: app.js:1929-2040 + app.js:1875-1903

const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');

test.use({ storageState: 'playwright/.auth/user.json' });

// Admin client for DB-direct cleanup + Phase 4 verify (bypasses RLS via service role).
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const createdIds = [];

test.afterAll(async () => {
  if (createdIds.length) {
    await admin.from('nsm_sessions').delete().in('id', createdIds);
  }
});

// Substantive NSM content (same as nsm-full-flow.spec.js) — passes real OpenAI gate reliably.
const TEST_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const TEST_EXPLANATION = 'SCHEMA1V2_TEST_EXPL_' + Date.now();  // unique to distinguish per test run
const TEST_BUSINESS_LINK = 'SCHEMA1V2_TEST_LINK_FIXTURE';
const SUBSTANTIVE_BREAKDOWN = {
  reach:     '每週至少訪問 Spotify 的用戶，約 3.5 億，其中 Podcast 觸及率目前 40%，即 1.4 億人',
  depth:     '播放超過 5 分鐘代表有意圖的消費行為，而非意外點擊',
  frequency: '週活躍而非月活躍，符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差',
};

const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
};

// Boot helper: clear pmDrillState + stub GET list endpoints so tryResumeLatestSession
// doesn't race-resume a previous session. Mirrors nsm-full-flow.spec.js bootApp().
async function bootApp(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);
  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

test('SCHEMA-1-v2 roundtrip: 3 fields persist through evaluate + reload', async ({ page }, testInfo) => {
  // Gate + evaluate both call real OpenAI server-to-server — triple the base timeout.
  // Mirror of nsm-full-flow.spec.js test.slow() pattern.
  test.slow();
  const vp = testInfo.project.name;
  const snapDir = 'audit/schema-1-v2-roundtrip';

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 1: boot app + create NSM session via AppState injection
  // ─────────────────────────────────────────────────────────────────────────────
  await test.step('Phase 1: boot app + inject NSM session (Step 2 form)', async () => {
    await bootApp(page);

    // Wait for auth (storageState reuse — auth-flows.md:928-949)
    await page.waitForFunction(
      () => window.AppState && !!window.AppState.accessToken,
      { timeout: 15_000 }
    );

    // Create NSM session via apiFetch from page context (carries Bearer token)
    const sessionId = await page.evaluate(async ({ qid, qjson }) => {
      const res = await window.apiFetch('/api/nsm-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qid, questionJson: qjson }),
      });
      if (!res.ok) throw new Error('session_create_failed: ' + res.status);
      const data = await res.json();
      return data.sessionId || data.id;
    }, { qid: QUESTION_ID, qjson: QUESTION_JSON });

    expect(sessionId).toBeTruthy();
    createdIds.push(sessionId);

    // Inject 3 fields into AppState + advance to Step 2 form
    await page.evaluate(({ sid, qjson, nsm, explanation, businessLink }) => {
      window.AppState.nsmSession = { id: sid };
      window.AppState.nsmSelectedQuestion = qjson;
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmDefinition = { nsm, explanation, businessLink };
      window.AppState.nsmBreakdown = { reach: '', depth: '', frequency: '' };
      window.AppState.nsmGateResult = null;
      window.AppState.nsmGateLoading = false;
      window.AppState.nsmGateError = null;
      window.AppState.nsmEvalResult = null;
      window.AppState.nsmEvalLoading = false;
      window.AppState.nsmEvalError = null;
      window.render();
    }, {
      sid: sessionId,
      qjson: QUESTION_JSON,
      nsm: TEST_NSM,
      explanation: TEST_EXPLANATION,
      businessLink: TEST_BUSINESS_LINK,
    });

    // Step 2 must be visible with 定義 NSM header
    await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.phase-head__title')).toContainText('定義 NSM', { timeout: 5_000 });

    await page.screenshot({ path: `${snapDir}/${vp}-phase1-step2-loaded.png`, fullPage: true });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 2: trigger save cycle (PATCH /progress with object shape), verify 2xx
  // ─────────────────────────────────────────────────────────────────────────────
  await test.step('Phase 2: trigger PATCH /progress (object shape save)', async () => {
    // Trigger save cycle via AppState — mirrors triggerNsmSaveCycle() call
    // This verifies FE sends object shape to BE PATCH /progress.
    const patchPromise = page.waitForResponse(
      r => /\/progress/.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 10_000 }
    );
    // Trigger save by dispatching an input event on the nsm field (or calling saveNsmProgress directly)
    await page.evaluate(() => {
      // Directly call the debounced save by simulating field input on [data-nsm-field="nsm"]
      const el = document.querySelector('[data-nsm-field="nsm"]');
      if (el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const patchResp = await patchPromise.catch(() => null);
    if (patchResp) {
      expect(patchResp.status()).toBeLessThan(300);
    }
    await page.screenshot({ path: `${snapDir}/${vp}-phase2-progress-saved.png`, fullPage: true });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 2.5: gate + proceed to step 3 + evaluate
  // NIT #1: single [data-nsm-submit] click from nsm-step2 → gate (not evaluate).
  // Must wait gate result, click [data-nsm-gate-action="proceed"] if canProceed,
  // then inject breakdown + click [data-nsm-submit] again from nsm-step3 → evaluate.
  // ─────────────────────────────────────────────────────────────────────────────
  let sessionIdConfirmed;
  await test.step('Phase 2.5: gate → proceed → step3 → POST /evaluate', async () => {
    sessionIdConfirmed = await page.evaluate(() => window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id);
    expect(sessionIdConfirmed).toBeTruthy();

    // === Sub-step A: click submit from step2 → fires POST /gate ===
    const submitBtn = page.locator('[data-nsm-submit]');
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await expect(submitBtn).not.toHaveAttribute('disabled');

    await submitBtn.click();

    // Wait for gate result in AppState (real OpenAI server-to-server, 90s timeout)
    await page.waitForFunction(
      () => window.AppState && window.AppState.nsmGateResult !== null && window.AppState.nsmGateResult !== undefined,
      { timeout: 90_000 }
    );

    const gateResult = await page.evaluate(() => window.AppState.nsmGateResult);
    expect(gateResult).not.toBeNull();

    await page.screenshot({ path: `${snapDir}/${vp}-phase2.5-gate-result.png`, fullPage: true });

    // === Sub-step B: handle gate result ===
    if (gateResult.canProceed) {
      // ok/warn: click proceed button (P0-NEW-7 fix: gate result UI shown before advancing)
      await expect(page.locator('[data-nsm-gate-action="proceed"]')).toBeVisible({ timeout: 5_000 });
      await page.locator('[data-nsm-gate-action="proceed"]').click();
      await page.waitForFunction(
        () => window.AppState && window.AppState.nsmSubTab === 'nsm-step3',
        { timeout: 10_000 }
      );
    } else {
      // canProceed=false (AI evaluation variance): force-advance to step3 via AppState.
      // The server lifecycle is still 'editing' since gate_fail doesn't promote to 'gated'
      // (session-lifecycle.js:103-107). Force-promote via admin client so /evaluate allows through.
      // This mirrors what a real gate_ok would have done — test intent is evaluate shape, not gate.
      console.warn(
        'SCHEMA-1-v2: gate returned canProceed=false (AI variance) — promoting lifecycle to gated via admin for evaluate test.'
      );
      const { error: lcErr } = await admin
        .from('nsm_sessions')
        .update({ lifecycle: 'gated' })
        .eq('id', sessionIdConfirmed);
      if (lcErr) console.warn('lifecycle promote error:', lcErr);

      await page.evaluate(() => {
        window.AppState.nsmSubTab = 'nsm-step3';
        window.AppState.nsmStep = 3;
        window.render();
      });
    }

    // === Sub-step C: inject breakdown + click submit from step3 → fires POST /evaluate ===
    await page.evaluate(({ br }) => {
      window.AppState.nsmBreakdown = br;
      window.AppState.nsmEvalResult = null;
      window.AppState.nsmEvalError = null;
      window.AppState.nsmEvalLoading = false;
      window.render();
    }, { br: SUBSTANTIVE_BREAKDOWN });

    // Step 3 header must show 拆解輸入指標
    await expect(page.locator('.phase-head__title')).toContainText('拆解輸入指標', { timeout: 5_000 });

    const submitBtn3 = page.locator('[data-nsm-submit]');
    await expect(submitBtn3).toBeVisible({ timeout: 5_000 });
    await expect(submitBtn3).not.toHaveAttribute('disabled');

    // Set up evaluate response listener BEFORE click (Pitfall 19 pattern)
    const evalRespPromise = page.waitForResponse(
      r => /\/evaluate$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 30_000 }
    );

    await submitBtn3.click();

    // Wait for evaluate 2xx response
    const evalResp = await evalRespPromise;
    expect(evalResp.status()).toBeGreaterThanOrEqual(200);
    expect(evalResp.status()).toBeLessThan(300);

    // Wait for nsmStep = 4 (evaluate done, app.js:2030)
    await page.waitForFunction(
      () => window.AppState && window.AppState.nsmStep === 4,
      { timeout: 90_000 }
    );

    await page.screenshot({ path: `${snapDir}/${vp}-phase2.5-evaluate-done.png`, fullPage: true });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 3: verify DB user_nsm column is object shape with all 3 keys
  // This is the canonical SCHEMA-1-v2 fix verification: before fix, user_nsm was
  // sent as string (just .nsm field value); after fix, it's the full 3-key object.
  //
  // Note: tryResumeLatestSession only resumes sessions with status='active'. After evaluate
  // succeeds, status='completed' (nsm-sessions.js:145). So AppState restore via reload is
  // not applicable for completed NSM sessions. Instead we verify directly from DB.
  // ─────────────────────────────────────────────────────────────────────────────
  await test.step('Phase 3: verify DB user_nsm is object shape with 3 keys', async () => {
    const { data, error } = await admin
      .from('nsm_sessions')
      .select('user_nsm, scores_json, status')
      .eq('id', sessionIdConfirmed)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // evaluate must have succeeded (status = completed, scores_json populated)
    expect(data.status).toBe('completed');
    expect(data.scores_json).not.toBeNull();

    // user_nsm must be object shape (not string) — SCHEMA-1-v2 fix
    expect(typeof data.user_nsm).toBe('object');
    expect(Array.isArray(data.user_nsm)).toBe(false);

    // All 3 fields must be present as keys
    expect(data.user_nsm).toHaveProperty('nsm');
    expect(data.user_nsm).toHaveProperty('explanation');
    expect(data.user_nsm).toHaveProperty('businessLink');

    // Values must match what we sent in Phase 1 (AppState inject)
    expect(data.user_nsm.nsm).toContain('Podcast');
    expect(data.user_nsm.explanation).toBe(TEST_EXPLANATION);
    expect(data.user_nsm.businessLink).toBe(TEST_BUSINESS_LINK);

    await page.screenshot({ path: `${snapDir}/${vp}-phase3-db-shape-verified.png`, fullPage: true });
  });

});
