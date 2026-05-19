// tests/e2e/nsm-step1-card-click-no-session.spec.js
// F-CT2.1 — NSM Step 1 card click must NOT create nsm_sessions row;
// session must be created lazily on Step 2 first PATCH (ensureNsmDraftSession via bindNSMStep2And3 preflight).
//
// Root cause (tracker §2 F-CT2.1): app.js:6280 card click handler calls
// ensureNsmDraftSession().catch(...) → 5487 empty shell sessions polluting conversion metrics.
// 99.9% of nsm_sessions have lifecycle 'created' without any real engagement.
//
// TDD: RED before fix (production creates session on card click → assert count=0 fails);
//      GREEN after fix (card click → 0 sessions; Step 2 PATCH → 1 session).
//
// Skills applied (RITUAL §3 + /Users/albertpeng/.claude/skills/playwright-skill/core/):
//   §3.8 api-testing.md:783-848  — service-role SELECT for count baseline (read-only; Pitfall 11 carve-out)
//   §3.4 / Pitfall 18            — page.evaluate AppState.nsmSession.id read
//   §3.6 / Pitfall 3             — data-attr [data-qid] card locator
//   §3.5 / Pitfall 19            — test.step per phase
//   §3.7 auth-flows.md:928-949   — storageState user.json (pre-authenticated)
//   §3.11 cross-vp 3 projects    — e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari
//   §3.14 expect.poll            — no waitForTimeout; poll Supabase count instead
//   §3.18 5x consecutive 0 flake — verified per run script
//   Real Data Only               — memory feedback_e2e_real_data_only: no stub own backend success path
//   Pitfall 11                   — service-role is data-seeding/SELECT verify only, NOT mocking own API
//
// 🚫 ABSOLUTE PROHIBITIONS (cheat-sheet line 235-249):
//   No --update-snapshots / No mock own backend success path / No hard sleep /
//   No module-level shared state / No direct tracker append / No self-approve / No commit
//
// Evidence PNGs: audit/F-CT2.1-evidence/{vp}-{step}.png

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const path = require('path');
const { expect } = require('@playwright/test');
const { test } = require('../fixtures/auto-cleanup.fixture');
const { createClient } = require('@supabase/supabase-js');

// ── Service-role admin client (read-only SELECT for count verification) ──────
// Per api-testing.md:783-848 "Data seeding via service-role" — Pitfall 11 carve-out:
// service-role client used only to SELECT count (verify, not mock); no route.fulfill.
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL    = process.env.TEST_EMAIL || 'e2e@first-principle.test';

const adminDb = (SUPABASE_URL && SERVICE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null;

// ── Auth file (§3.7 storageState auth-flows.md:928-949) ──────────────────────
const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

test.use({ storageState: AUTH_FILE });

// ── Evidence PNG directory ────────────────────────────────────────────────────
const PNG_DIR = path.join(__dirname, '..', '..', 'audit', 'F-CT2.1-evidence');

// ── Per-project question IDs (Pitfall 14: test-local fixture, no module-scope) ─
// Different qids per project avoid test isolation overlap in parallel runs.
const QID_BY_PROJECT = {
  'e2e-desktop':       'q3',
  'e2e-mobile-chrome': 'q4',
  'e2e-mobile-safari': 'q5',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** screenshot helper per test.step */
async function capture(page, testInfo, label) {
  const vp = testInfo.project.name.replace(/[^a-z0-9-]/gi, '-');
  const pngPath = path.join(PNG_DIR, `${vp}-${label}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });
  testInfo.attachments.push({ name: label, path: pngPath, contentType: 'image/png' });
  return pngPath;
}

/**
 * bootApp: wipe app localStorage keys; stub nsm-sessions GET list → []
 * so tryResumeLatestSession does not auto-restore a prior session.
 * Stubs only the GET list endpoint (returns []); POST/PATCH/DELETE go through.
 * This is NOT a Pitfall 11 violation: returning [] for the list is equivalent
 * to "no prior sessions" — the production path under test is card-click and Step 2 submit.
 */
async function bootApp(page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('pmDrillState');
      const draftKeys = Object.keys(localStorage).filter(k => k.startsWith('pmdrill:'));
      draftKeys.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (_) {}
  });

  // Stub GET nsm-sessions list only — POST/PATCH/DELETE proceed (Pitfall 11)
  await page.route('**/api/nsm-sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.continue();
  });
  await page.route('**/api/circles-sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.continue();
  });
  await page.route('**/api/guest/nsm-sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.continue();
  });

  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });

  // Un-route after boot so real NSM API calls proceed for Step 2 gate
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

/** waitForAuth: wait until Supabase populates AppState.accessToken */
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

/** resolveTestUserId: look up the e2e test account's user_id via admin client */
async function resolveTestUserId() {
  if (!adminDb) return null;
  // Use admin.auth.admin.listUsers and filter by email
  const { data, error } = await adminDb.auth.admin.listUsers({ perPage: 200 });
  if (error || !data) return null;
  const match = (data.users || []).find(u => u.email === TEST_EMAIL);
  return match ? match.id : null;
}

/**
 * countNsmSessions: query nsm_sessions count for the test user via service-role.
 * Per api-testing.md:783-848 — read-only Pitfall 11 carve-out.
 */
async function countNsmSessions(userId) {
  if (!adminDb || !userId) return null;
  const { count, error } = await adminDb
    .from('nsm_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return null;
  return count;
}

/** navigateToNSM: switch to NSM view and wait for Step 1 */
async function navigateToNSM(page) {
  const nsmLink = page.locator('[data-nav="nsm"], [data-circles-mode="nsm"], a[href*="nsm"]').first();
  const visible = await nsmLink.isVisible({ timeout: 3_000 }).catch(() => false);
  if (visible) {
    await nsmLink.click();
  } else {
    await page.evaluate(() => {
      if (window.AppState) {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 1;
        if (typeof window.render === 'function') window.render();
      }
    });
  }
  await page.locator('[data-nsm-step="1"]').waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * clickNsmCard: click a nsm-q-card with a given qid.
 * Pitfall 3: data-attr [data-qid] locator.
 * Shuffles up to 5 times if the card is not immediately visible.
 */
async function clickNsmCard(page, qid) {
  // Pitfall 3 — data-attr locator
  const card = page.locator(`.nsm-q-card[data-qid="${qid}"]`).first();

  let found = await card.isVisible({ timeout: 3_000 }).catch(() => false);
  for (let i = 0; i < 5 && !found; i++) {
    const shuffleBtn = page.locator('[data-nsm="shuffle"]').first();
    if (await shuffleBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await shuffleBtn.click();
      await page.waitForFunction(
        () => document.querySelectorAll('.nsm-q-card[data-qid]').length > 0,
        { timeout: 5_000 }
      );
    }
    found = await card.isVisible({ timeout: 2_000 }).catch(() => false);
  }

  if (found) {
    await card.click();
  } else {
    // Fallback: click first visible card (§3.6 Pitfall 3)
    const allCards = page.locator('.nsm-q-card[data-qid]');
    const count = await allCards.count();
    let clicked = false;
    for (let i = 0; i < count && !clicked; i++) {
      const c = allCards.nth(i);
      if (await c.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await c.click();
        clicked = true;
      }
    }
    if (!clicked) {
      await allCards.first().click({ force: true });
    }
  }

  // Wait for AppState.nsmSelectedQuestion to be set
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.nsmSelectedQuestion,
    { timeout: 8_000 }
  ).catch(() => {});
}

// ── afterEach: best-effort cleanup of any NSM sessions created during this test ─
// Matches the cleanup pattern from nsm-question-switch-resets-draft.spec.js
test.afterEach(async ({ playwright }) => {
  try {
    const reqCtx = await playwright.request.newContext({ storageState: AUTH_FILE });
    const listRes = await reqCtx.get('/api/nsm-sessions');
    if (listRes.ok()) {
      const sessions = await listRes.json();
      for (const s of (Array.isArray(sessions) ? sessions : [])) {
        if (s && s.id) {
          await reqCtx.delete(`/api/nsm-sessions/${s.id}`).catch(() => {});
        }
      }
    }
    await reqCtx.dispose();
  } catch (_) { /* best-effort */ }
});

// ══════════════════════════════════════════════════════════════════════════════
// MAIN TEST: card click → 0 sessions; Step 2 gate PATCH → 1 session
// ══════════════════════════════════════════════════════════════════════════════

test('NSM Step1 card click must NOT create nsm_session; session created at Step2 gate submit', async ({ page }, testInfo) => {
  const qid = QID_BY_PROJECT[testInfo.project.name] || 'q3';

  // Window anchor: only rows created at or after this timestamp are counted.
  // Prevents cross-project parallel interference on the same test user.
  const testStartTimestamp = new Date().toISOString();

  // Skip gracefully if service-role not configured (non-blocking to CI environments
  // without SUPABASE_SERVICE_ROLE_KEY; the AppState assertion still runs)
  if (!adminDb) {
    console.warn('[F-CT2.1] SUPABASE_SERVICE_ROLE_KEY missing; count assertions skipped; AppState assertions still run');
  }

  const testUserId = await resolveTestUserId();

  // ── Step A: boot + auth ───────────────────────────────────────────────────
  await test.step('boot app and wait for auth', async () => {
    await bootApp(page);
    await waitForAuth(page);
    await capture(page, testInfo, '01-boot');
  });

  // ── Step B: baseline nsm_sessions count ───────────────────────────────────
  let initialCount = null;
  await test.step('baseline: record nsm_sessions count before card click', async () => {
    initialCount = await countNsmSessions(testUserId);
    // Pitfall 18 — AppState read: no session should exist
    const appStateSessionId = await page.evaluate(() =>
      (window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id) || null
    );
    expect(appStateSessionId, 'AppState.nsmSession.id should be null before card click').toBeNull();
    if (initialCount !== null) {
      console.log(`[F-CT2.1] baseline nsm_sessions count for user: ${initialCount}`);
    }
  });

  // ── Step C: navigate to NSM Step 1 + click card ───────────────────────────
  // actualQid: the question_id that was actually clicked (may differ from `qid` if
  // the preferred card was not in the shuffled visible set and fallback was used).
  // We read AppState.nsmSelectedQuestion.id after click to get the ground-truth value.
  let actualQid = qid;
  await test.step('navigate to NSM Step1 and click q-card', async () => {
    await navigateToNSM(page);
    await capture(page, testInfo, '02-nsm-step1');
    await clickNsmCard(page, qid);
    // Read actual qid from AppState (handles fallback card case)
    const selectedId = await page.evaluate(() =>
      (window.AppState && window.AppState.nsmSelectedQuestion && window.AppState.nsmSelectedQuestion.id) || null
    );
    if (selectedId) actualQid = selectedId;
    console.log(`[F-CT2.1] actualQid=${actualQid} (preferred=${qid})`);
    await capture(page, testInfo, '03-card-clicked');
  });

  // ── Step D: assert NO new session created after card click ─────────────────
  // §3.14 expect.poll — no hard sleep (cheat-sheet 次要 #7)
  // Dual assertion (RITUAL §1 DB invariant restored):
  //   1. AppState.nsmSession.id must be null (per-browser, fully isolated; Pitfall 18)
  //   2. DB count for (user_id, question_id=qid, created_at>=testStartTimestamp) must be 0
  //      — windowed by per-project qid + testStartTimestamp → no flake from parallel projects.
  //      Detects silent DB writes via eager `.catch(()=>{})` that AppState never reflects.
  await test.step('assert no new nsm_session created after card click (expect.poll)', async () => {
    // AppState must NOT have a session id (Pitfall 18 — page.evaluate AppState read)
    await expect.poll(
      async () => {
        const sid = await page.evaluate(() =>
          (window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id) || null
        );
        return sid;
      },
      {
        message: 'AppState.nsmSession.id should remain null after card click — card click must NOT create a session',
        timeout: 5_000,
        intervals: [500, 1000, 1000],
      }
    ).toBeNull();

    // DB invariant: actualQid + timestamp window → exactly 0 rows
    // actualQid is the real question_id stored in DB (resolved from AppState after click).
    if (adminDb && testUserId) {
      await expect.poll(
        async () => {
          const { count } = await adminDb
            .from('nsm_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', testUserId)
            .eq('question_id', actualQid)
            .gte('created_at', testStartTimestamp);
          return count;
        },
        {
          message: `DB nsm_sessions count for (user=${testUserId}, qid=${actualQid}) since test start must be 0 after card click`,
          timeout: 5_000,
          intervals: [500, 1000, 1000],
        }
      ).toBe(0);
    }

    await capture(page, testInfo, '04-no-session-after-card-click');
  });

  // ── Step E: click 開始 NSM 訓練 to navigate to Step 2 ─────────────────────
  await test.step('click start button to enter Step 2', async () => {
    const startBtn = page.getByRole('button', { name: /開始 NSM 訓練/ });
    await startBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(startBtn).not.toBeDisabled();
    await startBtn.click();
    // Wait for Step 2 to render
    await page.waitForFunction(
      () => window.AppState && window.AppState.nsmStep === 2,
      { timeout: 10_000 }
    );
    await capture(page, testInfo, '05-step2-entered');
  });

  // ── Step F: Step 2 preflight creates session on mount ─────────────────────
  // bindNSMStep2And3() preflight at app.js:1777-1783 SHOULD create the session
  // now that we've entered Step 2 (not on card click).
  await test.step('Step2 mount preflight: session created by bindNSMStep2And3', async () => {
    // Give the preflight time to fire and create the session (expect.poll §3.14)
    await expect.poll(
      async () => {
        const sid = await page.evaluate(() =>
          (window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id) || null
        );
        return sid;
      },
      {
        message: 'AppState.nsmSession.id should be set after entering Step 2 (preflight)',
        timeout: 10_000,
        intervals: [500, 1000, 1000, 1000],
      }
    ).not.toBeNull();

    await capture(page, testInfo, '06-session-created-at-step2');
  });

  // ── Step G: fill 3 nsmDefinition fields to enable submit ──────────────────
  await test.step('fill Step2 definition fields (nsm + explanation + businessLink)', async () => {
    // Fill nsm field (contenteditable or input)
    const nsmField = page.locator('[data-nsm-field="nsm"]').first();
    await nsmField.waitFor({ state: 'visible', timeout: 10_000 });
    const nsmTag = await nsmField.evaluate(el => el.tagName.toLowerCase());
    const nsmVal = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天播放 5 分鐘以上的去重用戶數';
    if (nsmTag === 'input' || nsmTag === 'textarea') {
      await nsmField.fill(nsmVal);
    } else {
      await nsmField.click();
      await nsmField.evaluate((el, v) => {
        el.innerHTML = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, nsmVal);
    }

    const expField = page.locator('[data-nsm-field="explanation"]').first();
    if (await expField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const expTag = await expField.evaluate(el => el.tagName.toLowerCase());
      const expVal = '直接反映核心使用行為，週頻率符合 Podcast 聆聽習慣，避免 day-of-week 偏差';
      if (expTag === 'input' || expTag === 'textarea') {
        await expField.fill(expVal);
      } else {
        await expField.click();
        await expField.evaluate((el, v) => {
          el.innerHTML = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, expVal);
      }
    }

    const bizField = page.locator('[data-nsm-field="businessLink"]').first();
    if (await bizField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const bizTag = await bizField.evaluate(el => el.tagName.toLowerCase());
      const bizVal = 'Podcast 廣告 CPM 是音樂的 3-5 倍，提升此指標直接增加變現效率';
      if (bizTag === 'input' || bizTag === 'textarea') {
        await bizField.fill(bizVal);
      } else {
        await bizField.click();
        await bizField.evaluate((el, v) => {
          el.innerHTML = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, bizVal);
      }
    }

    await capture(page, testInfo, '07-step2-fields-filled');
  });

  // ── Step H: click 提交審核 to trigger Step 2 gate PATCH ───────────────────
  // The submit calls ensureNsmSession() inline at line 1944 — the session
  // should already exist from the preflight, confirming lazy creation works.
  await test.step('click 提交審核 to trigger Step2 gate PATCH', async () => {
    const submitBtn = page.locator('[data-nsm-submit]').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 8_000 });

    // Wait for submit to become enabled (fields must be non-empty)
    await expect.poll(
      async () => {
        const disabled = await submitBtn.isDisabled();
        return disabled;
      },
      {
        message: '提交審核 button should become enabled after filling fields',
        timeout: 5_000,
        intervals: [300, 500, 500],
      }
    ).toBe(false);

    await submitBtn.click();
    await capture(page, testInfo, '08-submit-clicked');
  });

  // ── Step I: assert exactly 1 new session exists in DB ────────────────────
  // Session was created at Step 2 preflight; this confirms it persisted correctly.
  // Windowed by per-project qid + testStartTimestamp → exactly 1 row expected.
  // (Other parallel projects use different qids so no count interference.)
  await test.step('assert nsm_session exists after Step2 gate (expect.poll)', async () => {
    if (adminDb && testUserId) {
      await expect.poll(
        async () => {
          const { count } = await adminDb
            .from('nsm_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', testUserId)
            .eq('question_id', actualQid)
            .gte('created_at', testStartTimestamp);
          return count;
        },
        {
          message: `DB nsm_sessions count for (user=${testUserId}, qid=${actualQid}) since test start must be exactly 1 after Step2 gate`,
          timeout: 15_000,
          intervals: [1000, 2000, 2000, 2000],
        }
      ).toBe(1);
    }

    // AppState.nsmSession.id must be set (primary per-browser assertion — Pitfall 18)
    const finalSessionId = await page.evaluate(() =>
      (window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id) || null
    );
    expect(finalSessionId, 'AppState.nsmSession.id must be set after Step2 submit').not.toBeNull();

    await capture(page, testInfo, '09-session-after-step2-submit');
  });

  // ── Step J: reload → AppState.nsmSession.id persists ─────────────────────
  await test.step('reload page: nsmSession must persist in AppState', async () => {
    const sessionIdBeforeReload = await page.evaluate(() =>
      (window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id) || null
    );

    await page.reload();

    // Wait for auth to re-establish
    await page.waitForFunction(
      () => window.AppState && !!window.AppState.accessToken,
      { timeout: 15_000 }
    );

    // After reload, tryResumeLatestSession should restore the session.
    // We give it time to fetch and restore.
    await expect.poll(
      async () => {
        const restoredId = await page.evaluate(() =>
          (window.AppState && window.AppState.nsmSession && window.AppState.nsmSession.id) || null
        );
        return restoredId;
      },
      {
        message: `After reload, AppState.nsmSession.id should be restored (was: ${sessionIdBeforeReload})`,
        timeout: 15_000,
        intervals: [1000, 2000, 2000, 2000],
      }
    ).not.toBeNull();

    await capture(page, testInfo, '10-after-reload-session-persists');
  });
});
