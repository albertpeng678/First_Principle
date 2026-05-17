// tests/api/circles-gate-all-Y-adversarial.spec.js
//
// TDD-RED spec: CIRCLES gate adversarial — meaningless single-char / short-token input rejection.
// Phase 1 Lane L2 — reproduce Bug 1 (gate 全打 Y 就過審).
//
// PURPOSE: Confirm real OpenAI + real prompt rejects ALL meaningless variants.
//   If any test PASSES (canProceed=true), the test fails → bug confirmed for that variant.
//   This is intentionally TDD-red: we EXPECT canProceed=false for every variant.
//
// Skills applied:
//   api-testing.md:1023-1166 §Error response testing
//     — assertion order: status first, then body shape, then semantic assertions
//   api-testing.md:783-848 §Data seeding via service-role
//     — real DB seed via POST /draft + PATCH /progress (no OpenAI mocks)
//   auth-flows.md:928-949 §API seed auth
//     — getE2eToken() pattern; token cached across tests
//   fixtures-and-hooks.md §Auto-cleanup
//     — cleanupTracker fixture auto-deletes rows after each test
//
// REAL-DATA DISCIPLINE (e2e_real_data_only Iron Law):
//   IL-1  禁 mock prompts/circles-gate.js — must hit real OpenAI to surface real behaviour
//   IL-2  禁 stub timestamp — real DB rows only
//   IL-3  禁 prod URL + 真帳號 — e2e@first-principle.test against test DB only
//
// Karpathy Think Before — pre-run leak predictions (§3 of audit doc):
//   All 10 variants should be caught by prompts/circles-gate.js Layer 1 (字數 < 10 rule).
//   Most likely leaks: "yes" (recognizable 3-char English word, LLM may treat as intent),
//   "Y." / "Y。" (punctuation padding may fool LLM into counting as content).
//   Risk: 同一字串填入多個欄位 rule may not reliably trigger when text is already <10 chars
//   (two overlapping rules, LLM may short-circuit to the wrong branch).

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Real question from circles_database.json (same as lifecycle-circles.spec.js)
const QUESTION_ID = 'circles_001';
const DRILL_STEP  = 'C1';

// C1 field names (all 4 must be filled per CIRCLES C1 schema)
const C1_FIELDS = ['問題範圍', '影響對象', '核心衝突', '目標結果'];

// Build a C1 frameworkDraft where every field gets the same adversarial token
function allFieldsDraft(token) {
  return {
    C1: Object.fromEntries(C1_FIELDS.map((f) => [f, token])),
  };
}

// Build a C1 frameworkDraft with a mix of tokens (one per field, cycling through list)
function mixedFieldsDraft(tokens) {
  return {
    C1: Object.fromEntries(C1_FIELDS.map((f, i) => [f, tokens[i % tokens.length]])),
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

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

async function patchProgress(request, id, frameworkDraft) {
  const headers = await authHeaders();
  const res = await request.patch(`${BASE_URL}/api/circles-sessions/${id}/progress`, {
    headers,
    data: { frameworkDraft },
  });
  // 200 or 400 (nothing_to_update) are both fine for seeding — we care about gate
  return res;
}

async function postGate(request, id, frameworkDraft) {
  const headers = await authHeaders();
  return request.post(`${BASE_URL}/api/circles-sessions/${id}/gate`, {
    headers,
    data: { step: DRILL_STEP, frameworkDraft },
  });
}

// ── setup ─────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── adversarial variants ──────────────────────────────────────────────────────

// Each entry: { label, draft }
// label: human-readable variant name for the test
// draft: frameworkDraft object to POST to /gate
const ADVERSARIAL_VARIANTS = [
  {
    label: 'a. 7 欄全 "Y"',
    draft: allFieldsDraft('Y'),
  },
  {
    label: 'b. 7 欄全 "y"',
    draft: allFieldsDraft('y'),
  },
  {
    label: 'c. 7 欄全 "yes"',
    draft: allFieldsDraft('yes'),
  },
  {
    label: 'd. 7 欄全 "Y."',
    draft: allFieldsDraft('Y.'),
  },
  {
    label: 'e. 7 欄全 "Y。"',
    draft: allFieldsDraft('Y。'),
  },
  {
    label: 'f. 7 欄全 "Y " (trailing space)',
    draft: allFieldsDraft('Y '),
  },
  {
    label: 'g. 7 欄混合 1–2 字 tokens',
    // 4 fields → cycle through 4 distinct tokens (each ≤ 2 chars, meaningless)
    draft: mixedFieldsDraft(['Y', 'Y。', '1', 'X']),
  },
  {
    label: 'h. 7 欄全 "好" (single-char Chinese)',
    draft: allFieldsDraft('好'),
  },
  {
    label: 'i. 7 欄全 "1"',
    draft: allFieldsDraft('1'),
  },
  {
    label: 'j. 7 欄全 "." (punctuation only)',
    draft: allFieldsDraft('.'),
  },
];

// ── test suite ────────────────────────────────────────────────────────────────

test.describe('CIRCLES gate adversarial — meaningless single-char input rejection', () => {
  for (const { label, draft } of ADVERSARIAL_VARIANTS) {
    test(label, async ({ request, cleanupTracker }) => {
      test.slow(); // gate calls real OpenAI — allow extra time

      // Step 1: create a real draft session
      const session = await createDraftSession(request, cleanupTracker);

      // Step 2: seed the adversarial frameworkDraft via PATCH /progress
      // (mirrors lifecycle-circles.spec.js pattern lines 96-107)
      await patchProgress(request, session.id, draft);

      // Step 3: POST /gate with the same adversarial draft
      // Per api-testing.md:1023-1166 — assert status first, then body shape
      const gateRes = await postGate(request, session.id, draft);
      expect(gateRes.status()).toBe(200);

      const gateBody = await gateRes.json();

      // Step 4: assert canProceed=false
      // If this fails → canProceed was true → BUG CONFIRMED for this variant
      expect(
        gateBody.canProceed,
        `[BUG] variant "${label}" returned canProceed=true — gate prompt did not reject meaningless input.\n` +
        `overallStatus=${gateBody.overallStatus}\n` +
        `items=${JSON.stringify(gateBody.items, null, 2)}`
      ).toBe(false);

      // Step 5: assert overallStatus=error
      // Per prompts/circles-gate.js Layer 1: any field with 字數<10 → error
      expect(
        gateBody.overallStatus,
        `[BUG] variant "${label}" returned overallStatus="${gateBody.overallStatus}" instead of "error".\n` +
        `canProceed=${gateBody.canProceed}`
      ).toBe('error');

      // cleanupTracker auto-deletes the session row after this test
    });
  }
});
