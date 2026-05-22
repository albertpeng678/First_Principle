// tests/api/rls-cross-user-isolation.spec.js
//
// RLS Cross-User Isolation — RED-PHASE PROBE
// =========================================================================
// Verifies row-level security (RLS) on the two session tables that hold
// user-generated content:
//
//   - nsm_sessions     (Agent A 5-agent scan: anon GET returned 0 rows — likely RLS ON)
//   - circles_sessions (Agent A 5-agent scan: anon GET returned 608 rows + guest_id
//                       UUIDs — LIKELY RLS OFF, suspected production leak)
//
// This spec is intentionally a RED-PHASE probe. TC3 is EXPECTED to fail today,
// turning the leak into a tracked, machine-verifiable regression.
//
// References
// ----------
//   - playwright-skill `core/api-testing.md`
//       → raw `request.get(url, { headers })` pattern for bypassing storageState
//         and probing Supabase REST directly with the anon key.
//   - playwright-skill `core/multi-user-and-collaboration.md`
//       → cross-user isolation pattern: User A creates resource, User B (in a
//         distinct authenticated context) MUST NOT read it.
//   - RITUAL §3.7 — auth seed via storageState (per-lane c-drift-*.json),
//     so the authenticated probes here do NOT trigger a fresh UI login and
//     do NOT collide with sibling lanes.
//   - Tracker `audit/e2e-master-tracker.md`
//       → P0-SCHEMA-NEW-1 (circles_sessions anon-readable leak, 608 rows)
//       → P0-SCHEMA-4    (nsm_sessions vs circles_sessions RLS asymmetry)
//
// Why no auto-cleanup hook?
//   The two authenticated rows created in TC1/TC2 are seeded under c-drift-1
//   (User A) and read back from c-drift-2 (User B). They tag themselves with
//   a per-run nonce in the question / payload so a downstream cleanup spec
//   (or the global afterAll drainSessions on the c-drift-1 lane) reclaims
//   them. We avoid an inline DELETE here because deleting under c-drift-1
//   storageState would mask any RLS misconfiguration that lets c-drift-2
//   delete c-drift-1's rows — a separate spec's job, not this one's.

const { test, expect, request: pwRequest } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

// Extract Bearer access_token from a storageState JSON file (auth lives in
// localStorage, not cookies, so request.newContext({ storageState }) alone
// does NOT carry the token — we must inject Authorization manually).
function bearerFromStorageState(filepath) {
  const ss = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  for (const origin of ss.origins || []) {
    for (const item of origin.localStorage || []) {
      if (item.name === 'pmDrillState') {
        try {
          const parsed = JSON.parse(item.value);
          if (parsed.accessToken) return parsed.accessToken;
        } catch (_) { /* fallthrough */ }
      }
    }
  }
  throw new Error(`No accessToken in storageState ${filepath}`);
}

// ---------------------------------------------------------------------------
// Lane paths — must match tests/setup/auth.setup.js C_DRIFT_LANES
// ---------------------------------------------------------------------------
const AUTH_DIR = path.join(__dirname, '..', '..', 'playwright', '.auth');
const USER_A_STATE = path.join(AUTH_DIR, 'c-drift-1-user.json'); // creator
const USER_B_STATE = path.join(AUTH_DIR, 'c-drift-2-user.json'); // cross-user reader

// ---------------------------------------------------------------------------
// Env — Supabase anon-key endpoint for direct REST probes
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Per-run nonce so created rows are attributable / sweepable
const RUN_NONCE = `rls-probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.describe('RLS cross-user isolation — nsm_sessions + circles_sessions', () => {
  test.beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'rls-cross-user-isolation: SUPABASE_URL and SUPABASE_ANON_KEY required in .env.local'
      );
    }
  });

  // -------------------------------------------------------------------------
  // TC1 — authenticated cross-user read against /api/nsm-sessions/:id
  //
  // User A (c-drift-1) creates an NSM session via the public API.
  // User B (c-drift-2) then GETs that session by id using their OWN auth.
  // Expected: 404 OR empty payload — NEVER User A's row.
  // -------------------------------------------------------------------------
  test('TC1 nsm_sessions — User B cannot read User A row via /api/nsm-sessions/:id', async ({
    playwright,
  }) => {
    // --- User A creates an NSM session ---
    // Bearer extracted manually since auth lives in localStorage (not cookies).
    const aCtx = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Authorization: 'Bearer ' + bearerFromStorageState(USER_A_STATE) },
    });
    // FIX (round-2 quiz Q2): real route at routes/nsm-sessions.js:19-20 expects
    // { questionId, questionJson } (camelCase). Previous payload used snake_case
    // and would have 400'd; spec would fail for wrong reason (假綠 risk).
    const createRes = await aCtx.post('/api/nsm-sessions', {
      data: {
        questionId: `nsm-${RUN_NONCE}-q1`,
        questionJson: {
          id: `nsm-${RUN_NONCE}-q1`,
          problem_statement: `[${RUN_NONCE}] RLS probe — owner is c-drift-1`,
          question_type: 'general',
        },
      },
    });
    expect(createRes.status(), 'User A create must succeed').toBeLessThan(400);
    const createdA = await createRes.json();
    // Real route returns { sessionId } per routes/nsm-sessions.js:29
    const sessionId = createdA?.sessionId || createdA?.id;
    expect(sessionId, 'User A response must include sessionId').toBeTruthy();
    await aCtx.dispose();

    // --- User B attempts to read it ---
    const bCtx = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Authorization: 'Bearer ' + bearerFromStorageState(USER_B_STATE) },
    });
    const readRes = await bCtx.get(`/api/nsm-sessions/${sessionId}`);
    const status = readRes.status();

    // Accept 404 (preferred — row hidden) or 403 (forbidden).
    // If 200, body MUST be empty/null (some endpoints filter rather than 404).
    if (status === 200) {
      const body = await readRes.json().catch(() => null);
      const leaked =
        body && (body.id === sessionId || body.session?.id === sessionId || body.data?.id === sessionId);
      expect(leaked, `LEAK: User B (c-drift-2) read User A's nsm_session ${sessionId}`).toBeFalsy();
    } else {
      expect([403, 404]).toContain(status);
    }
    await bCtx.dispose();
  });

  // -------------------------------------------------------------------------
  // TC2 — authenticated cross-user read against /api/circles-sessions/:id
  // Same shape as TC1 but for circles_sessions.
  // -------------------------------------------------------------------------
  test('TC2 circles_sessions — User B cannot read User A row via /api/circles-sessions/:id', async ({
    playwright,
  }) => {
    const aCtx = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Authorization: 'Bearer ' + bearerFromStorageState(USER_A_STATE) },
    });
    // FIX (round-2 quiz Q2): real route at routes/circles-sessions.js:27-29 requires
    // { questionId, questionJson, mode } — mode is required (drillStep optional).
    // FIX (round-3 5x serial): use RUN_NONCE-unique questionId so the CIRCLES
    // UNIQUE active constraint (migrations/2026-04-29-circles-active-uniqueness.sql)
    // doesn't 500 on second test run for the same (user_id, question_id) pair.
    const circlesQid = `rls-tc2-${RUN_NONCE}`;
    const createRes = await aCtx.post('/api/circles-sessions', {
      data: {
        questionId: circlesQid,
        questionJson: {
          id: circlesQid,
          problem_statement: `[${RUN_NONCE}] RLS probe — owner is c-drift-1`,
          mode: 'drill',
        },
        mode: 'drill',
      },
    });
    expect(createRes.status(), 'User A create must succeed').toBeLessThan(400);
    const createdA = await createRes.json();
    // Real route returns { sessionId } per routes/circles-sessions.js:37
    const sessionId = createdA?.sessionId || createdA?.id;
    expect(sessionId, 'User A response must include sessionId').toBeTruthy();
    await aCtx.dispose();

    const bCtx = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Authorization: 'Bearer ' + bearerFromStorageState(USER_B_STATE) },
    });
    const readRes = await bCtx.get(`/api/circles-sessions/${sessionId}`);
    const status = readRes.status();

    if (status === 200) {
      const body = await readRes.json().catch(() => null);
      const leaked =
        body && (body.id === sessionId || body.session?.id === sessionId || body.data?.id === sessionId);
      expect(leaked, `LEAK: User B (c-drift-2) read User A's circles_session ${sessionId}`).toBeFalsy();
    } else {
      expect([403, 404]).toContain(status);
    }
    await bCtx.dispose();
  });

  // -------------------------------------------------------------------------
  // TC3 — THE LEAK (expected to FAIL today)
  //
  // Anonymous probe (anon key only, NO user JWT) directly against Supabase
  // REST. circles_sessions currently returns rows + guest_id UUIDs to anon.
  // Once RLS is enabled with `auth.uid() = user_id` policy, this MUST return
  // zero rows.
  // -------------------------------------------------------------------------
  test('TC3 circles_sessions — anon REST returns 0 rows (FAILS today — proves leak)', async () => {
    const anon = await pwRequest.newContext({
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const res = await anon.get(
      `${SUPABASE_URL}/rest/v1/circles_sessions?select=id,guest_id&limit=5`
    );
    expect(res.ok(), `anon REST should respond (got ${res.status()})`).toBeTruthy();
    const rows = await res.json();
    expect(Array.isArray(rows), 'PostgREST returns an array').toBe(true);

    // THE LEAK ASSERTION — currently failing per Agent A scan (608 rows visible).
    expect(
      rows.length,
      `RLS LEAK on circles_sessions: anon key read ${rows.length} rows ` +
        `(sample: ${JSON.stringify(rows.slice(0, 2))}). Enable RLS with ` +
        `auth.uid() = user_id policy.`
    ).toBe(0);

    await anon.dispose();
  });

  // -------------------------------------------------------------------------
  // TC4 — anon probe against nsm_sessions (likely passes today per Agent A)
  // Kept so any future regression that drops nsm RLS is caught immediately.
  // -------------------------------------------------------------------------
  test('TC4 nsm_sessions — anon REST returns 0 rows (regression guard)', async () => {
    const anon = await pwRequest.newContext({
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const res = await anon.get(`${SUPABASE_URL}/rest/v1/nsm_sessions?select=id&limit=5`);
    expect(res.ok(), `anon REST should respond (got ${res.status()})`).toBeTruthy();
    const rows = await res.json();
    expect(Array.isArray(rows), 'PostgREST returns an array').toBe(true);
    expect(
      rows.length,
      `RLS REGRESSION on nsm_sessions: anon key read ${rows.length} rows. ` +
        `nsm_sessions was previously RLS-protected; do not weaken it.`
    ).toBe(0);

    await anon.dispose();
  });

  // -------------------------------------------------------------------------
  // TC5 — anon WITH correct x-guest-id reads own row (proves USING clause works)
  //
  // Per round-3 quiz Q3: TC3 only proves denial. We also need to prove the new
  // policy USING clause is not deny-all. Seed a circles row tagged with a
  // known guest_id, then read via anon REST WITH matching x-guest-id header.
  // Expected: 1 row returned.
  // -------------------------------------------------------------------------
  test('TC5 circles_sessions — anon WITH matching x-guest-id reads own guest row', async () => {
    // Seed via service-role so we don't depend on app flow.
    const { createClient } = require('@supabase/supabase-js');
    const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const guestId = `rls-tc5-${RUN_NONCE}`;
    const { data: seeded, error: seedErr } = await admin
      .from('circles_sessions')
      .insert({
        guest_id: guestId,
        question_id: 'q1',
        question_json: { id: 'q1', problem_statement: `[${RUN_NONCE}] TC5 own-read` },
        mode: 'drill',
      })
      .select('id')
      .single();
    expect(seedErr, 'service-role seed must succeed').toBeFalsy();

    // Anon probe WITH the correct x-guest-id header
    const anon = await pwRequest.newContext({
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-guest-id': guestId,
      },
    });
    const res = await anon.get(
      `${SUPABASE_URL}/rest/v1/circles_sessions?select=id,guest_id&guest_id=eq.${guestId}&limit=5`
    );
    expect(res.ok()).toBeTruthy();
    const rows = await res.json();
    expect(rows.length, 'Guest WITH correct header must see own row').toBe(1);
    expect(rows[0].id).toBe(seeded.id);

    await anon.dispose();
    // Cleanup
    await admin.from('circles_sessions').delete().eq('id', seeded.id);
  });

  // -------------------------------------------------------------------------
  // TC6 — anon WITH WRONG x-guest-id reads 0 rows (proves no enumeration)
  //
  // Per round-3 quiz Q3: also prove that an attacker who guesses a wrong
  // x-guest-id can't read other guest rows. Seed under one guest_id, query
  // under another → expect 0 rows.
  // -------------------------------------------------------------------------
  test('TC6 circles_sessions — anon WITH WRONG x-guest-id reads 0 rows', async () => {
    const { createClient } = require('@supabase/supabase-js');
    const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const ownerGuest = `rls-tc6-owner-${RUN_NONCE}`;
    const attackerGuest = `rls-tc6-attacker-${RUN_NONCE}`;
    const { data: seeded, error: seedErr } = await admin
      .from('circles_sessions')
      .insert({
        guest_id: ownerGuest,
        question_id: 'q1',
        question_json: { id: 'q1', problem_statement: `[${RUN_NONCE}] TC6 wrong-header` },
        mode: 'drill',
      })
      .select('id')
      .single();
    expect(seedErr).toBeFalsy();

    // Anon probe WITH WRONG x-guest-id
    const anon = await pwRequest.newContext({
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-guest-id': attackerGuest,  // ← does NOT match seeded row
      },
    });
    const res = await anon.get(
      `${SUPABASE_URL}/rest/v1/circles_sessions?select=id,guest_id&guest_id=eq.${ownerGuest}&limit=5`
    );
    expect(res.ok()).toBeTruthy();
    const rows = await res.json();
    expect(
      rows.length,
      `RLS LEAK: anon WITH wrong x-guest-id read ${rows.length} rows ` +
        `(should be 0 — proves no enumeration via guessed UUID)`
    ).toBe(0);

    await anon.dispose();
    await admin.from('circles_sessions').delete().eq('id', seeded.id);
  });
});
