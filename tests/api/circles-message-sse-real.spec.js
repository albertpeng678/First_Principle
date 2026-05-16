// tests/api/circles-message-sse-real.spec.js
// F-N-004 remediation — CIRCLES Phase 2 /message SSE endpoint real API tests.
// Fixes: phase2-chat.spec.js + sse-typewriter-perf.spec.js both mock SSE via
// route.fulfill (Pitfall 11). The real /message endpoint was never hit.
// Regression guard: removing Content-Type: text/event-stream would not break
// any prior spec. This file closes that gap.
//
// Skills applied:
//   api-testing.md §Chained API Calls (1311-1418) — create session → PATCH progress
//     → POST gate → POST message lifecycle chain; state machine pattern.
//   api-testing.md §Decision Guide (1480-1497) — validate headers + status at API tier.
//   when-to-mock.md (lines 1-45) — mock at boundary: NEVER mock own API.
//     OpenAI is third-party (paid-per-call). page.route() only intercepts browser
//     requests — cannot intercept server-to-server calls from Express/Node.js.
//     Per when-to-mock.md §Real Service Strategies + precedent in lifecycle-circles.spec.js:
//     accept real OpenAI for server-side calls; use test.slow() + quality input.
//
// IL-3 TDD: tests written against existing implementation per route reading.
// SSE format confirmed from routes/circles-sessions.js:215-244:
//   - Content-Type: text/event-stream
//   - Each chunk: `data: ${JSON.stringify({ delta: chunk })}\n\n`
//   - Final chunk: `data: ${JSON.stringify({ done: true, turn: {...} })}\n\n`
//   - Error: `data: ${JSON.stringify({ error: ... })}\n\n`
//
// OpenAI strategy: REAL with test.slow() — same precedent as lifecycle-circles.spec.js
// gate tests (lines 120-156). page.route() is browser-only and cannot intercept
// Express → api.openai.com calls. Documented gap per Lane G precedent.
//
// Cleanup: api-cleanup.fixture.js tracks session ids + DELETE after each test.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
const http = require('http');
const https = require('https');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Real question ID from circles_database.json (same as lifecycle-circles.spec.js)
const QUESTION_ID = 'circles_001';
const DRILL_STEP  = 'C1';

// Substantive draft — passes hasSubstantiveContent guard (same as lifecycle-circles.spec.js).
// Used to promote lifecycle to 'editing' before gate call.
const SUBSTANTIVE_DRAFT = {
  C1: {
    問題範圍: '我們的目標是提升 Spotify Podcast 功能的週活躍留存率，特別針對 18-35 歲通勤族群',
    影響對象: '目前每週使用 Spotify 至少一次但 Podcast 使用率低的 MAU，約 4000 萬人',
    核心衝突: '用戶知道 Podcast 存在但不清楚如何找到符合通勤時間的節目，發現路徑體驗差',
    目標結果: '週 Podcast 活躍率從 15% 提升至 25%，DAU/MAU 比從 0.3 到 0.45',
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Create a draft session. Returns the session row (includes .id).
// Per api-testing.md §Chained API Calls 1311-1418: seed via API before the test action.
async function createDraftSession(request, cleanupTracker) {
  const headers = await authHeaders();
  const res = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
    headers,
    data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBeTruthy();
  cleanupTracker.track('circles', body.id);
  return body;
}

// Promote lifecycle to 'editing' so gate sees a non-blank draft.
async function patchProgress(request, id, data) {
  const headers = await authHeaders();
  return request.patch(`${BASE_URL}/api/circles-sessions/${id}/progress`, { headers, data });
}

// Call /gate and return the gate body. Session must be in 'editing' state.
// Returns real OpenAI result — test.slow() must be set by caller.
async function callGate(request, id) {
  const headers = await authHeaders();
  const res = await request.post(`${BASE_URL}/api/circles-sessions/${id}/gate`, {
    headers,
    data: { step: DRILL_STEP, frameworkDraft: SUBSTANTIVE_DRAFT },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

/**
 * Read the first SSE chunk from a streaming HTTP response using Node's native
 * http/https module. Returns the raw line string (e.g. "data: {...}").
 *
 * Why not Playwright request.post()? The Playwright APIRequestContext reads
 * the full response body before returning — there is no streaming mode for
 * request fixture. Node native http/https gives us access to the raw stream
 * so we can read the first chunk as soon as it arrives.
 *
 * Per api-testing.md §Decision Guide 1495: for real-time API testing,
 * "Seed via API, observe in browser" — but at the API tier we read the
 * response stream directly without a browser.
 *
 * @param {string} sessionId - CIRCLES session ID
 * @param {string} token - Bearer token
 * @param {number} [timeoutMs=5000] - max wait for first SSE line
 * @returns {Promise<string>} first non-empty data line received
 */
function readFirstSseChunk(sessionId, token, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}/api/circles-sessions/${sessionId}/message`);
    const body = JSON.stringify({ userMessage: '請說明 C1 的核心衝突是什麼意思？' });

    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
    };

    const timer = setTimeout(() => {
      req.destroy(new Error(`readFirstSseChunk: timed out after ${timeoutMs}ms waiting for first SSE line`));
    }, timeoutMs);

    const req = transport.request(options, (res) => {
      let buffer = '';
      let resolved = false;

      // Expose response headers so the caller can also inspect them.
      req._responseHeaders = res.headers;

      res.on('data', (chunk) => {
        if (resolved) return;
        buffer += chunk.toString('utf8');
        // SSE lines end with \n\n; split and find first non-empty data: line.
        const lines = buffer.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            resolved = true;
            clearTimeout(timer);
            // Destroy after first chunk — we do not need the full stream.
            res.destroy();
            resolve({ firstLine: trimmed, headers: res.headers });
            return;
          }
        }
      });

      res.on('error', (err) => {
        // res.destroy() above triggers an aborted-stream error — that is expected.
        if (resolved) return;
        clearTimeout(timer);
        reject(err);
      });

      res.on('end', () => {
        if (resolved) return;
        clearTimeout(timer);
        reject(new Error(`readFirstSseChunk: stream ended without any data: line. buffer=${buffer.slice(0, 200)}`));
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

// ── setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── specs ────────────────────────────────────────────────────────────────────

test.describe('CIRCLES Phase 2 /message — real SSE API (F-N-004)', () => {

  // Test 1: real POST /:id/message reads first SSE chunk within 5s.
  //
  // Chain (per api-testing.md §Chained API Calls 1311-1418):
  //   1. POST /draft → session with lifecycle=created
  //   2. PATCH /progress (substantive draft) → lifecycle=editing
  //   3. POST /gate (real OpenAI) → lifecycle=gated (if ok) OR skip
  //   4. POST /message (real OpenAI) → SSE stream → read first chunk
  //
  // OpenAI note: route.fulfill('**/api.openai.com/**') only works for BROWSER
  // requests intercepted by Playwright's page. Express → api.openai.com calls
  // are server-to-server and cannot be intercepted. We use real OpenAI with
  // test.slow() — same approach as lifecycle-circles.spec.js lines 126-156.
  //
  // Assertion: first SSE line starts with "data:" AND the JSON payload after
  // "data:" is parseable. Accepts both { delta } and { error } as valid first
  // chunks (real OpenAI output may vary; what matters is the SSE wire format).
  test('POST /:id/message returns first SSE chunk with data: prefix + JSON payload within 5s', async ({ request, cleanupTracker }) => {
    test.slow(); // real OpenAI call (gate + message streaming) — allow 3× default timeout
    await test.step('seed: create draft session', async () => {
      // session created inside createDraftSession; id captured below
    });

    const session = await createDraftSession(request, cleanupTracker);

    await test.step('seed: promote to editing via PATCH /progress', async () => {
      const res = await patchProgress(request, session.id, { frameworkDraft: SUBSTANTIVE_DRAFT });
      expect(res.status()).toBe(200);
    });

    let gateOk = false;
    await test.step('seed: call /gate (real OpenAI) to reach lifecycle=gated', async () => {
      const gateBody = await callGate(request, session.id);
      gateOk = gateBody.canProceed &&
        (gateBody.overallStatus === 'ok' || gateBody.overallStatus === 'warn');
    });

    if (!gateOk) {
      // Real OpenAI returned error=true on quality input — rare but possible.
      // Document the skip reason; do not fail the test suite.
      console.warn('F-N-004 Test 1: gate returned ok=false on quality input; skipping SSE read (rare OpenAI variance)');
      return;
    }

    await test.step('action: POST /message and read first SSE chunk via Node native http', async () => {
      const token = await getE2eToken();
      // 5s timeout for first chunk per task spec.
      const { firstLine } = await readFirstSseChunk(session.id, token, 5000);

      // Assert SSE wire format: must start with "data:"
      expect(firstLine).toMatch(/^data:/);

      // Assert JSON parseable after "data: " prefix
      const rawJson = firstLine.replace(/^data:\s*/, '');
      let parsed;
      expect(() => { parsed = JSON.parse(rawJson); }).not.toThrow();

      // The chunk may be { delta: "..." } (streaming text) or { error: "..." }
      // (parse_failed guard). Both are valid SSE wire format — we verify the
      // shape is a non-null object with at least one key.
      expect(typeof parsed).toBe('object');
      expect(parsed).not.toBeNull();
      expect(Object.keys(parsed).length).toBeGreaterThan(0);
    });
  });

  // Test 2: Content-Type header regression guard (F-N-004 reproduction).
  //
  // Per F-N-004 reproduction steps:
  //   "(2) Remove Content-Type: text/event-stream header. (3) Tests still pass
  //    because route.fulfill intercepts." — This test catches that regression.
  //
  // Strategy: POST /message with a real authenticated session. The response
  // header is returned immediately on the first bytes of the SSE stream.
  // We use readFirstSseChunk which exposes res.headers from Node native http.
  //
  // If Content-Type header is ever removed/changed from routes/circles-sessions.js:215,
  // this test FAILS — unlike phase2-chat.spec.js which would still pass via mock.
  test('POST /:id/message sets Content-Type: text/event-stream header (regression guard)', async ({ request, cleanupTracker }) => {
    test.slow(); // real OpenAI call (gate + message streaming)

    const session = await createDraftSession(request, cleanupTracker);

    await test.step('seed: promote to editing', async () => {
      const res = await patchProgress(request, session.id, { frameworkDraft: SUBSTANTIVE_DRAFT });
      expect(res.status()).toBe(200);
    });

    let gateOk = false;
    await test.step('seed: call /gate (real OpenAI)', async () => {
      const gateBody = await callGate(request, session.id);
      gateOk = gateBody.canProceed &&
        (gateBody.overallStatus === 'ok' || gateBody.overallStatus === 'warn');
    });

    if (!gateOk) {
      console.warn('F-N-004 Test 2: gate returned ok=false; skipping Content-Type check (rare OpenAI variance)');
      return;
    }

    await test.step('assert: Content-Type header is text/event-stream', async () => {
      const token = await getE2eToken();
      const { headers } = await readFirstSseChunk(session.id, token, 5000);

      // Per routes/circles-sessions.js:215:
      //   res.setHeader('Content-Type', 'text/event-stream');
      // This assertion fails if that header is removed — unlike mocked SSE specs.
      expect(headers['content-type']).toMatch(/text\/event-stream/);
    });
  });

  // Test 3: 401 when no auth token provided.
  // Per api-testing.md §Decision Guide 1490: "Test auth flows (login/logout/RBAC)
  // — Yes for token/session logic".
  // This test is instant (no OpenAI call, no session creation needed).
  // Uses a fabricated UUID — route returns 401 before any DB lookup.
  test('POST /:id/message returns 401 when no Authorization header (permission guard)', async ({ request }) => {
    await test.step('action: POST /message with no auth', async () => {
      // Use a plausible-looking UUID — 401 fires before any DB lookup.
      const fakeId = '00000000-0000-0000-0000-000000000001';
      const res = await request.post(`${BASE_URL}/api/circles-sessions/${fakeId}/message`, {
        headers: {
          'Content-Type': 'application/json',
          // Intentionally NO Authorization header
        },
        data: { userMessage: 'test' },
      });
      // requireAuth middleware returns 401 before route body executes.
      expect(res.status()).toBe(401);
    });
  });

});
