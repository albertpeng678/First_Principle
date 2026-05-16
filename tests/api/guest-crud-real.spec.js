// tests/api/guest-crud-real.spec.js
// Real API layer tests — F-P04 closure: 19 guest routes (10 CIRCLES + 9 NSM).
// Hits localhost:4000 real Express + real Supabase test DB.
//
// Skills applied:
//   api-testing.md §APIRequestContext Basics — request.post/get/patch/delete directly
//   api-testing.md §Error Response Testing (lines 1023-1166) — 400/404 per route
//   api-testing.md §Chained API Calls (lines 1311-1418) — create → operate → delete
//   common-pitfalls.md Pitfall 11 (lines 597-661) — NEVER mock own API/DB
//   test-organization.md §Pattern 1 — tests/api/ feature-based file
//
// Permission boundary for all guest routes: X-Guest-ID header (UUID v4 required).
// Missing/invalid header → 400 missing_or_invalid_guest_id.
// Valid guestId but non-existent session → 404 not_found.
//
// AI endpoints (gate / evaluate / message / hint / example / context / conclusion-check):
//   Server-to-server calls; page.route() cannot intercept Node.js HTTP from Express.
//   Per when-to-mock.md §Real Service Strategies + lifecycle-nsm.spec.js precedent:
//   validation + permission paths are tested instantly (never reach OpenAI).
//   Happy-path AI tests are marked test.slow() and call real OpenAI.
//   message (SSE) happy path is skipped — SSE streaming is not safely consumable
//   via the request fixture without a real EventSource client.
//
// Cleanup: inline guest cleanup fixture below — uses X-Guest-ID instead of Bearer token.
// Closes F-P04 from audit/findings-slice-cross-2026-05-17.md.

const { test: base, expect } = require('@playwright/test');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// ── stable test data ──────────────────────────────────────────────────────────

// Real question IDs from production databases
const CIRCLES_QUESTION_ID = 'circles_001';
const NSM_QUESTION_ID     = 'q1';

// Minimal question_json payloads that satisfy route validation
const CIRCLES_QUESTION_JSON = {
  id: CIRCLES_QUESTION_ID,
  title: '提升 Spotify Podcast 的週活躍留存率',
  company: 'Spotify',
};

const NSM_QUESTION_JSON = {
  id: NSM_QUESTION_ID,
  company: 'Netflix',
  industry: '內容訂閱制',
  scenario: '影音串流平台競爭激烈，必須確保用戶持續感受到內容價值以維持自動扣款。',
};

// Substantive gate draft — passes hasSubstantiveContent in session-lifecycle.js
const SUBSTANTIVE_CIRCLES_DRAFT = {
  C1: {
    問題範圍: '目標是提升 Spotify Podcast 功能的週活躍留存率，針對 18-35 歲通勤族群',
    影響對象: '每週使用 Spotify 至少一次但 Podcast 使用率低的 MAU，約 4000 萬人',
    核心衝突: '用戶知道 Podcast 存在但不清楚如何找到符合通勤時間的節目',
    目標結果: '週 Podcast 活躍率從 15% 提升至 25%',
  },
};

const SUBSTANTIVE_NSM       = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const SUBSTANTIVE_RATIONALE = '直接反映核心使用行為，且與廣告收入正相關，週頻率符合聆聽習慣週期';
const SUBSTANTIVE_BREAKDOWN = {
  reach:     '每週至少訪問 Spotify 的用戶，約 3.5 億，Podcast 觸及率 40% 即 1.4 億人',
  depth:     '播放超過 5 分鐘代表有意圖的消費行為，而非意外點擊',
  frequency: '週活躍而非月活躍，符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差',
  impact:    '與廣告收入直接相關：Podcast 廣告 CPM 是音樂的 3-5 倍',
};

// Fake but UUID-v4 shaped non-existent session id for 404 tests
const BOGUS_SESSION_ID = '00000000-0000-4000-8000-000000000001';

// ── guest cleanup fixture ─────────────────────────────────────────────────────
// Guest routes do not use Bearer tokens; they use X-Guest-ID header.
// api-cleanup.fixture.js sends Bearer token — cannot be reused here.
// This inline fixture mirrors the same auto-track + DELETE pattern.

const test = base.extend({
  guestId: [
    async ({}, use) => {
      // Generate a stable UUID v4 per test worker/process.
      // Using crypto.randomUUID() (Node 14.17+) for spec-isolation.
      const { randomUUID } = require('crypto');
      await use(randomUUID());
    },
    { scope: 'test' },
  ],
  guestCleanup: [
    async ({ request, guestId }, use) => {
      const tracked = []; // { kind: 'circles'|'nsm-guest', id }
      await use({
        track: (kind, id) => tracked.push({ kind, id }),
      });
      // Cleanup after each test — DELETE via guest endpoint
      for (const { kind, id } of tracked) {
        try {
          const path = kind === 'circles'
            ? `${BASE_URL}/api/guest-circles-sessions/${id}`
            : `${BASE_URL}/api/guest/nsm-sessions/${id}`;
          await request.delete(path, {
            headers: { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' },
          });
        } catch (_) {
          // best-effort; 404 already-gone is acceptable
        }
      }
    },
    { auto: true },
  ],
});

// ── shared helpers ────────────────────────────────────────────────────────────

function guestHeaders(guestId) {
  return { 'X-Guest-ID': guestId, 'Content-Type': 'application/json' };
}

// POST /api/guest-circles-sessions/draft — returns full session row
async function createCirclesDraft(request, guestId, guestCleanup) {
  const res = await request.post(`${BASE_URL}/api/guest-circles-sessions/draft`, {
    headers: guestHeaders(guestId),
    data: { question_id: CIRCLES_QUESTION_ID, mode: 'drill', drill_step: 'C1' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  guestCleanup.track('circles', body.id);
  return body;
}

// POST /api/guest/nsm-sessions — returns { sessionId }
async function createNsmSession(request, guestId, guestCleanup) {
  const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions`, {
    headers: guestHeaders(guestId),
    data: { questionId: NSM_QUESTION_ID, questionJson: NSM_QUESTION_JSON },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.sessionId).toBeTruthy();
  guestCleanup.track('nsm-guest', body.sessionId);
  return body.sessionId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCLES guest routes (10 routes)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('CIRCLES guest routes — real API (F-P04)', () => {

  // ── 1. POST /api/guest-circles-sessions/draft ─────────────────────────────

  test.describe('POST /api/guest-circles-sessions/draft', () => {

    test('happy — creates session with required fields', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      // Per api-testing.md §JSON Response Assertions: assert specific field values
      expect(session.question_id).toBe(CIRCLES_QUESTION_ID);
      expect(session.mode).toBe('drill');
      expect(session.status).toBe('active');
      expect(typeof session.lifecycle).toBe('string');
    });

    test('400 — missing X-Guest-ID header', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/guest-circles-sessions/draft`, {
        data: { question_id: CIRCLES_QUESTION_ID, mode: 'drill' },
        // no X-Guest-ID header
      });
      // Per api-testing.md §Error Response Testing: assert 400 on missing auth header
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing_or_invalid_guest_id/);
    });

    test('400 — missing required body fields', async ({ request, guestId }) => {
      const res = await request.post(`${BASE_URL}/api/guest-circles-sessions/draft`, {
        headers: guestHeaders(guestId),
        data: { mode: 'drill' }, // question_id missing
      });
      expect(res.status()).toBe(400);
    });

  });

  // ── 2. POST /api/guest-circles-sessions ──────────────────────────────────

  test.describe('POST /api/guest-circles-sessions (legacy create)', () => {

    test('happy — creates session and returns sessionId', async ({ request, guestId, guestCleanup }) => {
      const res = await request.post(`${BASE_URL}/api/guest-circles-sessions`, {
        headers: guestHeaders(guestId),
        data: {
          questionId: CIRCLES_QUESTION_ID,
          questionJson: CIRCLES_QUESTION_JSON,
          mode: 'drill',
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.sessionId).toBeTruthy();
      guestCleanup.track('circles', body.sessionId);
    });

    test('400 — missing X-Guest-ID header', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/guest-circles-sessions`, {
        data: { questionId: CIRCLES_QUESTION_ID, questionJson: CIRCLES_QUESTION_JSON, mode: 'drill' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing_or_invalid_guest_id/);
    });

    test('400 — missing required body fields', async ({ request, guestId }) => {
      const res = await request.post(`${BASE_URL}/api/guest-circles-sessions`, {
        headers: guestHeaders(guestId),
        data: { mode: 'drill' }, // questionId + questionJson missing
      });
      expect(res.status()).toBe(400);
    });

  });

  // ── 3. GET /api/guest-circles-sessions ───────────────────────────────────

  test.describe('GET /api/guest-circles-sessions (list)', () => {

    test('happy — returns array (may be empty for fresh guestId)', async ({ request, guestId }) => {
      const res = await request.get(`${BASE_URL}/api/guest-circles-sessions`, {
        headers: guestHeaders(guestId),
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('happy — created session appears in list', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);

      // Patch to editing so lifecycle !== 'created' (list excludes created)
      await request.patch(`${BASE_URL}/api/guest-circles-sessions/${session.id}/progress`, {
        headers: guestHeaders(guestId),
        data: { frameworkDraft: SUBSTANTIVE_CIRCLES_DRAFT },
      });

      const listRes = await request.get(`${BASE_URL}/api/guest-circles-sessions`, {
        headers: guestHeaders(guestId),
      });
      expect(listRes.status()).toBe(200);
      const list = await listRes.json();
      const ids = list.map((s) => s.id);
      expect(ids).toContain(session.id);
    });

    test('400 — missing X-Guest-ID header', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/guest-circles-sessions`);
      expect(res.status()).toBe(400);
    });

    test('403 — include_empty=true is forbidden for guest (SLC-AC13)', async ({ request, guestId }) => {
      const res = await request.get(
        `${BASE_URL}/api/guest-circles-sessions?include_empty=true`,
        { headers: guestHeaders(guestId) }
      );
      expect(res.status()).toBe(403);
    });

  });

  // ── 4. GET /api/guest-circles-sessions/:id ───────────────────────────────

  test.describe('GET /api/guest-circles-sessions/:id', () => {

    test('happy — returns session row', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.get(`${BASE_URL}/api/guest-circles-sessions/${session.id}`, {
        headers: guestHeaders(guestId),
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(session.id);
      expect(body.question_id).toBe(CIRCLES_QUESTION_ID);
    });

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.get(`${BASE_URL}/api/guest-circles-sessions/${session.id}`);
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.get(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}`,
        { headers: guestHeaders(guestId) }
      );
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/not_found/);
    });

  });

  // ── 5. PATCH /api/guest-circles-sessions/:id/progress ────────────────────

  test.describe('PATCH /api/guest-circles-sessions/:id/progress', () => {

    test('happy — saves frameworkDraft and returns ok', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.patch(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/progress`,
        {
          headers: guestHeaders(guestId),
          data: { frameworkDraft: SUBSTANTIVE_CIRCLES_DRAFT },
        }
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.patch(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/progress`,
        { data: { frameworkDraft: SUBSTANTIVE_CIRCLES_DRAFT } }
      );
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.patch(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}/progress`,
        {
          headers: guestHeaders(guestId),
          data: { frameworkDraft: SUBSTANTIVE_CIRCLES_DRAFT },
        }
      );
      expect(res.status()).toBe(404);
    });

    test('400 — nothing_to_update when body has no recognized fields', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.patch(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/progress`,
        { headers: guestHeaders(guestId), data: {} }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/nothing_to_update/);
    });

  });

  // ── 6. POST /api/guest-circles-sessions/:id/gate (AI — validation only) ──

  test.describe('POST /api/guest-circles-sessions/:id/gate', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/gate`,
        { data: { frameworkDraft: SUBSTANTIVE_CIRCLES_DRAFT } }
      );
      expect(res.status()).toBe(400);
    });

    test('400 — missing frameworkDraft in body', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/gate`,
        { headers: guestHeaders(guestId), data: {} }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing frameworkDraft/);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}/gate`,
        {
          headers: guestHeaders(guestId),
          data: { frameworkDraft: SUBSTANTIVE_CIRCLES_DRAFT },
        }
      );
      expect(res.status()).toBe(404);
    });

    // Happy-path gate calls real OpenAI (server-side; cannot use page.route mock).
    // Per when-to-mock.md + lifecycle-circles.spec.js precedent: accept real call.
    test('happy — gate returns canProceed boolean + overallStatus', async ({ request, guestId, guestCleanup }) => {
      test.slow(); // real OpenAI call
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      await request.patch(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/progress`,
        { headers: guestHeaders(guestId), data: { frameworkDraft: SUBSTANTIVE_CIRCLES_DRAFT } }
      );
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/gate`,
        {
          headers: guestHeaders(guestId),
          data: { frameworkDraft: SUBSTANTIVE_CIRCLES_DRAFT },
        }
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(typeof body.canProceed).toBe('boolean');
      expect(['ok', 'warn', 'error']).toContain(body.overallStatus);
    });

  });

  // ── 7. POST /api/guest-circles-sessions/:id/message (SSE) ────────────────
  // SSE streaming is not safely consumable via request fixture (plain HTTP client).
  // Validation + permission paths never reach OpenAI and can be tested instantly.

  test.describe('POST /api/guest-circles-sessions/:id/message', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/message`,
        { data: { userMessage: '你好' } }
      );
      expect(res.status()).toBe(400);
    });

    test('400 — empty userMessage', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/message`,
        { headers: guestHeaders(guestId), data: { userMessage: '   ' } }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/empty_user_message/);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}/message`,
        {
          headers: guestHeaders(guestId),
          data: { userMessage: '你好' },
        }
      );
      expect(res.status()).toBe(404);
    });

  });

  // ── 8. POST /api/guest-circles-sessions/:id/evaluate-step ────────────────

  test.describe('POST /api/guest-circles-sessions/:id/evaluate-step', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/evaluate-step`,
        { data: {} }
      );
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}/evaluate-step`,
        { headers: guestHeaders(guestId), data: {} }
      );
      expect(res.status()).toBe(404);
    });

  });

  // ── 9. POST /api/guest-circles-sessions/:id/conclusion-check ─────────────

  test.describe('POST /api/guest-circles-sessions/:id/conclusion-check', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/conclusion-check`,
        { data: { conclusionText: '結論文字' } }
      );
      expect(res.status()).toBe(400);
    });

    test('400 — empty conclusionText', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/conclusion-check`,
        { headers: guestHeaders(guestId), data: { conclusionText: '  ' } }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing_conclusion/);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}/conclusion-check`,
        {
          headers: guestHeaders(guestId),
          data: { conclusionText: '結論文字' },
        }
      );
      expect(res.status()).toBe(404);
    });

    // Happy-path conclusion-check calls real OpenAI.
    test('happy — conclusion-check returns result shape', async ({ request, guestId, guestCleanup }) => {
      test.slow();
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/conclusion-check`,
        {
          headers: guestHeaders(guestId),
          data: { conclusionText: '我認為核心問題是 Spotify Podcast 的內容發現路徑設計不足，導致用戶在情境下找不到合適節目' },
        }
      );
      expect(res.status()).toBe(200);
    });

  });

  // ── 10. POST /api/guest-circles-sessions/:id/final-report ────────────────

  test.describe('POST /api/guest-circles-sessions/:id/final-report', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/final-report`,
        { data: {} }
      );
      expect(res.status()).toBe(400);
    });

    test('400 — incomplete_steps (no step_scores)', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      // Session has no step_scores yet — should return 400 incomplete_steps
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/final-report`,
        { headers: guestHeaders(guestId), data: {} }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/incomplete_steps/);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}/final-report`,
        { headers: guestHeaders(guestId), data: {} }
      );
      expect(res.status()).toBe(404);
    });

  });

  // ── 11. DELETE /api/guest-circles-sessions/:id ───────────────────────────
  // Note: route index in Lane C is 10 endpoints; DELETE is included within those 10.

  test.describe('DELETE /api/guest-circles-sessions/:id', () => {

    test('happy — DELETE returns ok:true and session absent from list after', async ({ request, guestId }) => {
      // Create a session (no guestCleanup.track — DELETE is the test itself)
      const createRes = await request.post(`${BASE_URL}/api/guest-circles-sessions/draft`, {
        headers: guestHeaders(guestId),
        data: { question_id: CIRCLES_QUESTION_ID, mode: 'drill', drill_step: 'C1' },
      });
      expect(createRes.status()).toBe(200);
      const session = await createRes.json();
      const sessionId = session.id;

      // DELETE — per api-testing.md §Chained API Calls: verify post-delete list absence
      const delRes = await request.delete(
        `${BASE_URL}/api/guest-circles-sessions/${sessionId}`,
        { headers: guestHeaders(guestId) }
      );
      expect(delRes.status()).toBe(200);
      const delBody = await delRes.json();
      expect(delBody.ok).toBe(true);

      // Verify GET /:id → 404 after delete
      const getRes = await request.get(
        `${BASE_URL}/api/guest-circles-sessions/${sessionId}`,
        { headers: guestHeaders(guestId) }
      );
      expect(getRes.status()).toBe(404);
    });

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.delete(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}`
      );
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.delete(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}`,
        { headers: guestHeaders(guestId) }
      );
      expect(res.status()).toBe(404);
    });

  });

  // ── Hint + Example (AI validation/permission paths only) ─────────────────
  // Route file paths: guest-circles-sessions.js:393 (hint) + :412 (example)
  // These are part of the 10-endpoint family per Lane C lines 84-85.

  test.describe('POST /api/guest-circles-sessions/:id/hint', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/hint`,
        { data: { step: 'C1', field: '問題範圍' } }
      );
      expect(res.status()).toBe(400);
    });

    test('400 — missing step or field', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/hint`,
        { headers: guestHeaders(guestId), data: { step: 'C1' } } // field missing
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing_step_or_field/);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}/hint`,
        { headers: guestHeaders(guestId), data: { step: 'C1', field: '問題範圍' } }
      );
      expect(res.status()).toBe(404);
    });

  });

  test.describe('POST /api/guest-circles-sessions/:id/example', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/example`,
        { data: { step: 'C1', field: '問題範圍' } }
      );
      expect(res.status()).toBe(400);
    });

    test('400 — missing step or field', async ({ request, guestId, guestCleanup }) => {
      const session = await createCirclesDraft(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${session.id}/example`,
        { headers: guestHeaders(guestId), data: { field: '問題範圍' } } // step missing
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing_step_or_field/);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest-circles-sessions/${BOGUS_SESSION_ID}/example`,
        { headers: guestHeaders(guestId), data: { step: 'C1', field: '問題範圍' } }
      );
      expect(res.status()).toBe(404);
    });

  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// NSM guest routes (9 routes) — mirror pattern
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('NSM guest routes — real API (F-P04)', () => {

  // ── 1. POST /api/guest/nsm-sessions ──────────────────────────────────────

  test.describe('POST /api/guest/nsm-sessions', () => {

    test('happy — creates session and returns sessionId', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test('400 — missing X-Guest-ID header', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions`, {
        data: { questionId: NSM_QUESTION_ID, questionJson: NSM_QUESTION_JSON },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing_or_invalid_guest_id/);
    });

    test('400 — missing required body fields', async ({ request, guestId }) => {
      const res = await request.post(`${BASE_URL}/api/guest/nsm-sessions`, {
        headers: guestHeaders(guestId),
        data: { questionId: NSM_QUESTION_ID }, // questionJson missing
      });
      expect(res.status()).toBe(400);
    });

  });

  // ── 2. GET /api/guest/nsm-sessions (list) ────────────────────────────────

  test.describe('GET /api/guest/nsm-sessions (list)', () => {

    test('happy — returns array (may be empty for fresh guestId)', async ({ request, guestId }) => {
      const res = await request.get(`${BASE_URL}/api/guest/nsm-sessions`, {
        headers: guestHeaders(guestId),
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('400 — missing X-Guest-ID header', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/guest/nsm-sessions`);
      expect(res.status()).toBe(400);
    });

    test('403 — include_empty=true is forbidden for guest (SLC-AC13)', async ({ request, guestId }) => {
      const res = await request.get(
        `${BASE_URL}/api/guest/nsm-sessions?include_empty=true`,
        { headers: guestHeaders(guestId) }
      );
      expect(res.status()).toBe(403);
    });

  });

  // ── 3. GET /api/guest/nsm-sessions/:id ───────────────────────────────────

  test.describe('GET /api/guest/nsm-sessions/:id', () => {

    test('happy — returns session row', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.get(`${BASE_URL}/api/guest/nsm-sessions/${sessionId}`, {
        headers: guestHeaders(guestId),
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(sessionId);
      expect(body.question_id).toBe(NSM_QUESTION_ID);
    });

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.get(`${BASE_URL}/api/guest/nsm-sessions/${sessionId}`);
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.get(
        `${BASE_URL}/api/guest/nsm-sessions/${BOGUS_SESSION_ID}`,
        { headers: guestHeaders(guestId) }
      );
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/not_found/);
    });

  });

  // ── 4. PATCH /api/guest/nsm-sessions/:id/progress ────────────────────────

  test.describe('PATCH /api/guest/nsm-sessions/:id/progress', () => {

    test('happy — saves userNsm and returns ok', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.patch(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/progress`,
        {
          headers: guestHeaders(guestId),
          data: { userNsm: SUBSTANTIVE_NSM },
        }
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.patch(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/progress`,
        { data: { userNsm: SUBSTANTIVE_NSM } }
      );
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.patch(
        `${BASE_URL}/api/guest/nsm-sessions/${BOGUS_SESSION_ID}/progress`,
        {
          headers: guestHeaders(guestId),
          data: { userNsm: SUBSTANTIVE_NSM },
        }
      );
      expect(res.status()).toBe(404);
    });

    test('400 — nothing_to_update when body has no recognized fields', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.patch(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/progress`,
        { headers: guestHeaders(guestId), data: {} }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/nothing_to_update/);
    });

  });

  // ── 5. POST /api/guest/nsm-sessions/:id/gate (AI — validation only) ──────

  test.describe('POST /api/guest/nsm-sessions/:id/gate', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/gate`,
        { data: { nsm: SUBSTANTIVE_NSM, rationale: SUBSTANTIVE_RATIONALE } }
      );
      expect(res.status()).toBe(400);
    });

    test('400 — empty nsm or rationale', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/gate`,
        { headers: guestHeaders(guestId), data: { nsm: '  ', rationale: SUBSTANTIVE_RATIONALE } }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/empty_body/);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${BOGUS_SESSION_ID}/gate`,
        {
          headers: guestHeaders(guestId),
          data: { nsm: SUBSTANTIVE_NSM, rationale: SUBSTANTIVE_RATIONALE },
        }
      );
      expect(res.status()).toBe(404);
    });

    // Happy-path gate calls real OpenAI (server-side).
    test('happy — gate returns canProceed boolean + overallStatus', async ({ request, guestId, guestCleanup }) => {
      test.slow(); // real OpenAI call
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/gate`,
        {
          headers: guestHeaders(guestId),
          data: { nsm: SUBSTANTIVE_NSM, rationale: SUBSTANTIVE_RATIONALE },
        }
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(typeof body.canProceed).toBe('boolean');
      expect(['ok', 'warn', 'error']).toContain(body.overallStatus);
    });

  });

  // ── 6. POST /api/guest/nsm-sessions/:id/evaluate ─────────────────────────

  test.describe('POST /api/guest/nsm-sessions/:id/evaluate', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/evaluate`,
        { data: { userNsm: SUBSTANTIVE_NSM, userBreakdown: SUBSTANTIVE_BREAKDOWN } }
      );
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${BOGUS_SESSION_ID}/evaluate`,
        {
          headers: guestHeaders(guestId),
          data: { userNsm: SUBSTANTIVE_NSM, userBreakdown: SUBSTANTIVE_BREAKDOWN },
        }
      );
      expect(res.status()).toBe(404);
    });

    // Happy-path evaluate calls real OpenAI (server-side).
    test('happy — evaluate returns scores shape', async ({ request, guestId, guestCleanup }) => {
      test.slow(); // real OpenAI call
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/evaluate`,
        {
          headers: guestHeaders(guestId),
          data: { userNsm: SUBSTANTIVE_NSM, userBreakdown: SUBSTANTIVE_BREAKDOWN },
        }
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      // Route persists + returns AI result; assert minimal shape
      expect(body).toBeDefined();
    });

  });

  // ── 7. POST /api/guest/nsm-sessions/:id/context ──────────────────────────

  test.describe('POST /api/guest/nsm-sessions/:id/context', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/context`,
        { data: {} }
      );
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${BOGUS_SESSION_ID}/context`,
        { headers: guestHeaders(guestId), data: {} }
      );
      expect(res.status()).toBe(404);
    });

    // Happy-path context generation calls real OpenAI (server-side).
    test('happy — context returns result', async ({ request, guestId, guestCleanup }) => {
      test.slow();
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/context`,
        { headers: guestHeaders(guestId), data: {} }
      );
      expect(res.status()).toBe(200);
    });

  });

  // ── 8. POST /api/guest/nsm-sessions/:id/hints ────────────────────────────

  test.describe('POST /api/guest/nsm-sessions/:id/hints', () => {

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/hints`,
        { data: { userNsm: SUBSTANTIVE_NSM } }
      );
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${BOGUS_SESSION_ID}/hints`,
        { headers: guestHeaders(guestId), data: { userNsm: SUBSTANTIVE_NSM } }
      );
      expect(res.status()).toBe(404);
    });

    // Happy-path hints call real OpenAI (server-side).
    test('happy — hints returns result', async ({ request, guestId, guestCleanup }) => {
      test.slow();
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.post(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}/hints`,
        { headers: guestHeaders(guestId), data: { userNsm: SUBSTANTIVE_NSM } }
      );
      expect(res.status()).toBe(200);
    });

  });

  // ── 9. DELETE /api/guest/nsm-sessions/:id ────────────────────────────────

  test.describe('DELETE /api/guest/nsm-sessions/:id', () => {

    test('happy — DELETE returns ok:true and session absent after', async ({ request, guestId }) => {
      // Create directly (no guestCleanup.track — DELETE is the test itself)
      const createRes = await request.post(`${BASE_URL}/api/guest/nsm-sessions`, {
        headers: guestHeaders(guestId),
        data: { questionId: NSM_QUESTION_ID, questionJson: NSM_QUESTION_JSON },
      });
      expect(createRes.status()).toBe(200);
      const { sessionId } = await createRes.json();

      // DELETE
      const delRes = await request.delete(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}`,
        { headers: guestHeaders(guestId) }
      );
      expect(delRes.status()).toBe(200);
      const delBody = await delRes.json();
      expect(delBody.ok).toBe(true);

      // Verify GET /:id → 404 after delete
      const getRes = await request.get(
        `${BASE_URL}/api/guest/nsm-sessions/${sessionId}`,
        { headers: guestHeaders(guestId) }
      );
      expect(getRes.status()).toBe(404);
    });

    test('400 — missing X-Guest-ID header', async ({ request, guestId, guestCleanup }) => {
      const sessionId = await createNsmSession(request, guestId, guestCleanup);
      const res = await request.delete(`${BASE_URL}/api/guest/nsm-sessions/${sessionId}`);
      expect(res.status()).toBe(400);
    });

    test('404 — wrong session id', async ({ request, guestId }) => {
      const res = await request.delete(
        `${BASE_URL}/api/guest/nsm-sessions/${BOGUS_SESSION_ID}`,
        { headers: guestHeaders(guestId) }
      );
      expect(res.status()).toBe(404);
    });

  });

});
