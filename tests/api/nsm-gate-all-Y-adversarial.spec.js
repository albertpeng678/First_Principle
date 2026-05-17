// tests/api/nsm-gate-all-Y-adversarial.spec.js
//
// TDD-RED spec: NSM gate adversarial — meaningless single-char / short-token input rejection.
// Lane L9 — preventive mirror of L2 (CIRCLES gate, commit f7a43ff) applied to NSM gate.
//
// PURPOSE: Confirm real OpenAI + real prompt rejects ALL meaningless variants.
//   If any test PASSES (canProceed=true), the test fails → bug confirmed for that variant.
//   This is intentionally TDD-red: we EXPECT canProceed=false for every variant.
//
// Skills applied:
//   api-testing.md:1023-1166 §Error response testing
//     — assertion order: status first, then body shape, then semantic assertions
//   api-testing.md:783-848 §Data seeding via service-role
//     — real DB seed via POST /api/nsm-sessions + PATCH /progress (no OpenAI mocks)
//   auth-flows.md:928-949 §API seed auth
//     — getE2eToken() pattern; token cached across tests
//   fixtures-and-hooks.md §Auto-cleanup
//     — cleanupTracker fixture auto-deletes nsm rows after each test
//
// REAL-DATA DISCIPLINE (e2e_real_data_only Iron Law):
//   IL-1  禁 mock prompts/nsm-gate.js — must hit real OpenAI to surface real behaviour
//   IL-2  禁 stub timestamp — real DB rows only
//   IL-3  禁 prod URL + 真帳號 — e2e@first-principle.test against test DB only
//
// Karpathy Think Before — pre-run leak predictions (§3 of audit doc):
//   NSM gate prompt has explicit 輸入品質檢查 at highest priority:
//     字數 < 10（剝除空白後計算）→ 4 items all error, canProceed=false
//   All 10 variants trigger this rule for at least one field:
//     a-h: both nsm and rationale are < 10 chars; ALSO nsm===rationale (dual trigger)
//     i:   nsm="Y" (1 char) triggers even though rationale is padded
//     j:   rationale="Y" (1 char) triggers even though nsm is padded
//   Predicted result: 10/10 correctly rejected (canProceed=false, overallStatus=error)
//   Highest risk variants: i and j — asymmetric input where one field is substantive.
//     LLM may hallucinate "partial ok" if it evaluates fields independently before
//     applying the input-quality guard. Rule says "任一觸發" → all 4 items error.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Real NSM question (mirrors lifecycle-nsm.spec.js line 24-29)
const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
};

// Substantive NSM text used to seed progress before overwriting with adversarial input.
// Must pass hasSubstantiveContent (not a stub token) so progress PATCH succeeds.
// Mirrors lifecycle-nsm.spec.js SUBSTANTIVE_NSM (line 32).
const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function createNsmSession(request, cleanupTracker) {
  const headers = await authHeaders();
  const res = await request.post(`${BASE_URL}/api/nsm-sessions`, {
    headers,
    data: { questionId: QUESTION_ID, questionJson: QUESTION_JSON },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.sessionId).toBeTruthy();
  cleanupTracker.track('nsm', body.sessionId);
  return body.sessionId;
}

async function patchProgress(request, id, data) {
  const headers = await authHeaders();
  return request.patch(`${BASE_URL}/api/nsm-sessions/${id}/progress`, { headers, data });
}

async function postGate(request, id, nsm, rationale) {
  const headers = await authHeaders();
  return request.post(`${BASE_URL}/api/nsm-sessions/${id}/gate`, {
    headers,
    data: { nsm, rationale },
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

// Each entry: { label, nsm, rationale }
// label: human-readable variant name for the test
// nsm:       adversarial NSM definition string
// rationale: adversarial rationale string
//
// Design per task spec:
//   a-h: both fields identical single-char / short tokens
//   i:   nsm short, rationale padded (asymmetric — tests "任一觸發" catches short nsm)
//   j:   nsm padded, rationale short (asymmetric reverse — tests "任一觸發" catches short rationale)
const ADVERSARIAL_VARIANTS = [
  {
    label: 'a. nsm="Y" rationale="Y"',
    nsm: 'Y',
    rationale: 'Y',
  },
  {
    label: 'b. nsm="y" rationale="y"',
    nsm: 'y',
    rationale: 'y',
  },
  {
    label: 'c. nsm="yes" rationale="yes"',
    nsm: 'yes',
    rationale: 'yes',
  },
  {
    label: 'd. nsm="Y." rationale="Y."',
    nsm: 'Y.',
    rationale: 'Y.',
  },
  {
    label: 'e. nsm="Y。" rationale="Y。"',
    nsm: 'Y。',
    rationale: 'Y。',
  },
  {
    label: 'f. nsm="好" rationale="好" (single-char Chinese)',
    nsm: '好',
    rationale: '好',
  },
  {
    label: 'g. nsm="1" rationale="1"',
    nsm: '1',
    rationale: '1',
  },
  {
    label: 'h. nsm="." rationale="."',
    nsm: '.',
    rationale: '.',
  },
  {
    label: 'i. nsm="Y" rationale=padded (asymmetric — short nsm, padded rationale)',
    nsm: 'Y',
    rationale: '這是一段比較長的解釋但內容空洞重複Y Y Y Y Y Y Y Y',
  },
  {
    label: 'j. nsm=padded rationale="Y" (asymmetric reverse — padded nsm, short rationale)',
    nsm: '這是一段比較長的解釋但內容空洞重複Y Y Y Y Y Y Y Y',
    rationale: 'Y',
  },
];

// ── test suite ────────────────────────────────────────────────────────────────

test.describe('NSM gate adversarial — meaningless single-char input rejection', () => {
  for (const { label, nsm, rationale } of ADVERSARIAL_VARIANTS) {
    test(label, async ({ request, cleanupTracker }) => {
      test.slow(); // gate calls real OpenAI — allow extra time

      // Step 1: create a real NSM session
      // (mirrors lifecycle-nsm.spec.js createNsmSession pattern lines 55-66)
      const id = await createNsmSession(request, cleanupTracker);

      // Step 2: seed substantive userNsm first so progress PATCH succeeds,
      // then seed the adversarial nsm.
      // Rationale: some lifecycle checks may require userNsm to be non-empty.
      // We overwrite with adversarial after, so gate sees the adversarial value.
      // (mirrors circles-gate-all-Y-adversarial.spec.js patchProgress pattern lines 84-92)
      await patchProgress(request, id, { userNsm: SUBSTANTIVE_NSM });

      // Step 3: POST /gate with adversarial body — real OpenAI call
      // Per api-testing.md:1023-1166 — assert status first, then body shape
      const gateRes = await postGate(request, id, nsm, rationale);
      expect(gateRes.status()).toBe(200);

      const gateBody = await gateRes.json();

      // Step 4: assert canProceed=false
      // If this fails → canProceed was true → BUG CONFIRMED for this variant
      expect(
        gateBody.canProceed,
        `[BUG] variant "${label}" returned canProceed=true — NSM gate prompt did not reject meaningless input.\n` +
        `nsm="${nsm}"\nrationale="${rationale}"\n` +
        `overallStatus=${gateBody.overallStatus}\n` +
        `items=${JSON.stringify(gateBody.items, null, 2)}`
      ).toBe(false);

      // Step 5: assert overallStatus=error
      // Per prompts/nsm-gate.js 輸入品質檢查: 字數<10 → 4 items all error → overallStatus=error
      expect(
        gateBody.overallStatus,
        `[BUG] variant "${label}" returned overallStatus="${gateBody.overallStatus}" instead of "error".\n` +
        `nsm="${nsm}"\nrationale="${rationale}"\n` +
        `canProceed=${gateBody.canProceed}`
      ).toBe('error');

      // cleanupTracker auto-deletes the nsm session row after this test
    });
  }
});
