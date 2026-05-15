/**
 * repro-bug1-cross-device.spec.js
 *
 * Bug 1 cross-device session sync × 5 rounds reproduction spec.
 *
 * Strategy:
 *   - Context A (Desktop 1280) and Context B (Mobile 360) both authenticate
 *     directly via the Supabase auth REST endpoint (no UI click path, which is
 *     unreliable in headless mode due to Supabase JS SDK async init timing).
 *   - For each round:
 *       A: PATCH /api/nsm-sessions/:id/progress with a unique payload string.
 *       Wait 7s (> 5s TTL + propagation margin).
 *       B: GET /api/nsm-sessions/:id (cache-free after fix; hits DB directly).
 *       Assert returned user_nsm.nsm matches what A wrote.
 *   - 5/5 rounds must match.
 *
 * Fix markers in production:
 *   - lib/session-cache.js  TTL = 5 000 ms (was 30 000 ms)
 *   - GET /:id              no cache — direct DB read
 *   - PATCH /:id/progress   invalidates cache; sets updated_at
 *   - lib/session-dedup.js  tie-break by updated_at (was created_at)
 */

'use strict';

const { test, expect, chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PROD_URL     = 'https://first-principle.up.railway.app/';
const SB_URL       = 'https://klvlizxmvzfpvfgswmfk.supabase.co';
const SB_ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdmxpenhtdnpmcHZmZ3N3bWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NjcyNDIsImV4cCI6MjA5MjI0MzI0Mn0.KOF72gPKbllpYq7t3ny21HBEScUlj2diSl47oNyhJTY';
const EMAIL        = 'albertpeng678@gmail.com';
const PASSWORD     = '21345678';

const OUT_DIR = path.join(__dirname, '../../audit/repro-bug1');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers — all run inside page.evaluate() so they work in browser context
// ---------------------------------------------------------------------------

/**
 * Authenticate via Supabase password grant.
 * Returns access_token string, or throws.
 */
async function getSupabaseToken(page, sbUrl, sbAnonKey, email, password) {
  return page.evaluate(async ({ sbUrl, sbAnonKey, email, password }) => {
    const r = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': sbAnonKey,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok || !data.access_token) {
      throw new Error('Supabase auth failed: ' + JSON.stringify(data));
    }
    return data.access_token;
  }, { sbUrl, sbAnonKey, email, password });
}

/**
 * Fetch first NSM session for the authenticated user.
 */
async function getFirstNsmSession(page, token) {
  return page.evaluate(async ({ tok }) => {
    const r = await fetch('/api/nsm-sessions', {
      headers: { 'Authorization': 'Bearer ' + tok },
    });
    if (!r.ok) return { ok: false, status: r.status, why: 'list_failed' };
    const list = await r.json();
    if (!Array.isArray(list) || list.length === 0) return { ok: false, why: 'empty_list' };
    return { ok: true, session: list[0] };
  }, { tok: token });
}

/**
 * PATCH the session's user_nsm via the progress endpoint.
 * Body field: userNsm (camelCase) — matches route handler expectation.
 */
async function patchUserNsm(page, token, sessionId, value) {
  return page.evaluate(async ({ tok, sid, val }) => {
    const r = await fetch(`/api/nsm-sessions/${sid}/progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + tok,
      },
      body: JSON.stringify({ userNsm: val }),
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body };
  }, { tok: token, sid: sessionId, val: value });
}

/**
 * GET session detail (cache-free after fix) and extract the nsm string.
 * user_nsm in DB may be an object { nsm, ... } or a plain string (legacy).
 */
async function getUserNsm(page, token, sessionId) {
  return page.evaluate(async ({ tok, sid }) => {
    const r = await fetch(`/api/nsm-sessions/${sid}`, {
      headers: { 'Authorization': 'Bearer ' + tok },
    });
    if (!r.ok) return { ok: false, status: r.status };
    const data = await r.json();
    const raw = data.user_nsm;
    let nsm;
    if (raw && typeof raw === 'object') {
      nsm = raw.nsm || '';
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        nsm = (parsed && typeof parsed === 'object') ? (parsed.nsm || '') : raw;
      } catch (_) {
        nsm = raw;
      }
    } else {
      nsm = '';
    }
    return {
      ok: true,
      nsm,
      rawUserNsm: raw,
      updatedAt: data.updated_at,
    };
  }, { tok: token, sid: sessionId });
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.describe.serial('Bug 1 cross-device sync × 5 rounds', () => {
  test('5 rounds: Context A (desktop) writes → Context B (mobile) reads fresh', async ({}, testInfo) => {
    testInfo.setTimeout(600_000);

    const browser = await chromium.launch({ headless: true, channel: 'chrome' });

    // Two fully-isolated browser contexts (separate cookie + localStorage jars).
    const ctxA = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      isMobile: false,
    });
    const ctxB = await browser.newContext({
      viewport: { width: 360, height: 780 },
      isMobile: true,
      hasTouch: true,
    });

    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // Navigate to prod so fetch('/api/...') uses the prod origin.
    console.log('[setup] loading prod in both contexts');
    await Promise.all([
      pageA.goto(PROD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 }),
      pageB.goto(PROD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 }),
    ]);
    // Wait for app JS to execute.
    await Promise.all([
      pageA.waitForFunction(() => typeof window.AppState !== 'undefined', { timeout: 30_000 }),
      pageB.waitForFunction(() => typeof window.AppState !== 'undefined', { timeout: 30_000 }),
    ]);
    console.log('[setup] app JS ready in both contexts');

    // Authenticate — direct Supabase password grant (bypasses UI).
    console.log('[setup] authenticating via Supabase API');
    const [tokenA, tokenB] = await Promise.all([
      getSupabaseToken(pageA, SB_URL, SB_ANON_KEY, EMAIL, PASSWORD),
      getSupabaseToken(pageB, SB_URL, SB_ANON_KEY, EMAIL, PASSWORD),
    ]);
    console.log('[setup] tokenA:', tokenA.slice(0, 40) + '...');
    console.log('[setup] tokenB:', tokenB.slice(0, 40) + '...');

    // Resolve a session to use across all rounds.
    const sessionResult = await getFirstNsmSession(pageA, tokenA);
    if (!sessionResult.ok) {
      throw new Error('Cannot resolve NSM session: ' + JSON.stringify(sessionResult));
    }
    const SESSION_ID = sessionResult.session.id;
    const QUESTION_ID = sessionResult.session.question_id;
    console.log(`[setup] session id=${SESSION_ID} question=${QUESTION_ID}`);

    // -----------------------------------------------------------------------
    // 5 Rounds
    // -----------------------------------------------------------------------
    const results = [];

    for (let round = 1; round <= 5; round++) {
      const payload = `repro-bug1-r${round}-${Date.now()}`;
      console.log(`\n=== Round ${round}/5 ===`);
      console.log(`[r${round}] payload = "${payload}"`);

      // A writes.
      const patchResult = await patchUserNsm(pageA, tokenA, SESSION_ID, payload);
      console.log(`[r${round}] A PATCH → status=${patchResult.status} ok=${patchResult.ok} body=${JSON.stringify(patchResult.body)}`);

      // Screenshot A immediately after write.
      await pageA.screenshot({
        path: path.join(OUT_DIR, `round-${round}-A-desktop.png`),
        fullPage: false,
      });

      // Wait beyond TTL (5s) + network margin = 7s.
      console.log(`[r${round}] waiting 7s for cache TTL expiry...`);
      await pageA.waitForTimeout(7_000);

      // B reads — GET /:id is cache-free (direct DB) after fix.
      const getResult = await getUserNsm(pageB, tokenB, SESSION_ID);
      console.log(`[r${round}] B GET  → ok=${getResult.ok} nsm="${getResult.nsm}" updated_at=${getResult.updatedAt}`);

      // Screenshot B after read.
      await pageB.screenshot({
        path: path.join(OUT_DIR, `round-${round}-B-mobile.png`),
        fullPage: false,
      });

      const match = patchResult.ok && getResult.ok && getResult.nsm === payload;
      const roundRecord = {
        round,
        payload,
        A_patch_ok: patchResult.ok,
        A_patch_status: patchResult.status,
        B_get_ok: getResult.ok,
        B_nsm_read: getResult.nsm,
        B_updated_at: getResult.updatedAt,
        match,
      };
      results.push(roundRecord);
      console.log(`[r${round}] RESULT: match=${match} (A="${payload}" B="${getResult.nsm}")`);
    }

    // Persist results JSON.
    const resultsPath = path.join(OUT_DIR, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log('\n=== All Results ===');
    console.log(JSON.stringify(results, null, 2));

    await ctxA.close();
    await ctxB.close();
    await browser.close();

    // Assert 5/5 rounds passed.
    const passCount = results.filter(r => r.match).length;
    expect(
      passCount,
      [
        `cross-device sync: expected 5/5 match, got ${passCount}/5.`,
        '',
        'Results:',
        JSON.stringify(results, null, 2),
      ].join('\n'),
    ).toBe(5);
  });
});
