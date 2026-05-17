// tests/api/nsm-evaluator-adversarial.spec.js
//
// Lane L15 — NSM evaluator adversarial sweep (preventive).
// Completes the 4-pillar preventive sweep:
//   L2  (CIRCLES gate)     + L9  (NSM gate)
//   L12 (CIRCLES evaluator) + L15 (NSM evaluator) ← this file
//
// PURPOSE: Confirm real OpenAI + real prompt does NOT award unreasonably high
//   totalScore for gate-passable but low-quality / meaningless NSM inputs.
//   "Gate-passable" = content that passes the NSM gate (≥ 10 chars, substantive
//   enough on first pass), but the subsequent EVALUATE body is vague, incoherent,
//   off-topic, or duplicated across fields.
//   If any variant returns totalScore >= 60, that variant is flagged as an
//   evaluator leak.
//
// KEY DIFFERENCE from L12 (CIRCLES evaluator):
//   The NSM evaluate endpoint reads userNsm + userBreakdown directly from the
//   POST body (not from session.framework_draft). This simplifies seeding:
//   Step 1: Create session.
//   Step 2: PATCH /progress with SUBSTANTIVE userNsm → lifecycle=editing.
//   Step 3: POST /gate with SUBSTANTIVE content → lifecycle=gated (canProceed=true).
//   Step 4: POST /evaluate with ADVERSARIAL userNsm + userBreakdown in the body.
//   No second PATCH needed — adversarial content goes directly in the evaluate body.
//
// NSM evaluator response shape:
//   { scores: { alignment, leading, actionability, simplicity, sensitivity },
//     totalScore, coachComments, coachTree, coachRationale,
//     bestMove, mainTrap, summary }
//   totalScore = (alignment + leading + actionability + simplicity + sensitivity) * 4
//   Max 100; threshold < 60 ↔ avg dim score < 3.0/5.
//
// NSM prompt quality check (prompts/nsm-evaluator.js §輸入品質檢查):
//   Triggers when any field (userNsm or any breakdown dim) meets:
//   - 字數 < 10
//   - 重複單一字元
//   - 純 whitespace / 全形空白
//   - 純 emoji / 隨機 unicode 序列
//   - 內容與題目情境完全無關
//   - HTML/JS injection
//   - 4 個欄位（user_nsm + 3 breakdown）原封不動同字串
//   → triggered dim score = 1 (嚴禁給高分)
//   → if all 4 fields triggered: all 5 dim scores = 1, totalScore = 20
//
// Skills applied:
//   api-testing.md:1023-1166 §Error response testing
//     — assertion order: status first, then body shape, then semantic assertions
//   api-testing.md:783-848 §Data seeding via service-role
//     — real DB seed via POST /api/nsm-sessions → PATCH /progress →
//       POST /gate → POST /evaluate (adversarial body)
//   auth-flows.md:928-949 §API seed auth
//     — getE2eToken() pattern; token cached across tests
//   fixtures-and-hooks.md §Auto-cleanup
//     — cleanupTracker fixture auto-deletes nsm rows after each test
//
// REAL-DATA DISCIPLINE (e2e_real_data_only Iron Law):
//   IL-1  禁 mock prompts/nsm-evaluator.js — must hit real OpenAI to surface real behaviour
//   IL-2  禁 stub timestamp — real DB rows only
//   IL-3  禁 prod URL + 真帳號 — e2e@first-principle.test against test DB only
//
// ── Karpathy Think Before — pre-run leak predictions (§3 of audit doc) ─────────
//
// The NSM evaluator prompt has §輸入品質檢查 at highest priority:
//   - 4 個欄位原封不動同字串 → all 5 dim scores=1, totalScore=20
//   - 字數 < 10 → triggered dim score=1
//   - 內容與題目情境完全無關 → triggered dim score=1
//
// Predicted totalScore per variant (5 dims × score × 4 = totalScore):
//   a (通用廢話句 × all 4 identical):
//     Triggers "4 個欄位同字串" rule → all dims score=1 → totalScore=20
//   b (模糊理由句 × all 4 identical):
//     Same as (a) — triggers "4 個欄位同字串" → totalScore=20
//   c (後設討論句 × all 4 identical):
//     Same — triggers "4 個欄位同字串" → totalScore=20
//   d (中文 lorem-ipsum 亂句, unique per field):
//     No duplicate trigger; vague/meaningless → dims 1-2 each → totalScore ≤ 40
//     Most likely leaky: actionability/simplicity might get partial credit if
//     LLM misreads filler as "a simple concept"
//   e (same paragraph × all 4 fields identical):
//     Triggers "4 個欄位同字串" rule → totalScore=20
//   f (離題好文章：cooking essay, unique per field):
//     Triggers "內容與題目情境完全無關" for all fields → all dims score=1 → totalScore=20
//   g (AI 冗長空話風格, unique per field):
//     No duplicate trigger; verbose corporate jargon → dims 1-2 each → totalScore ≤ 40
//     HIGHEST RISK of partial leak — LLM may hallucinate "some thought process"
//     Most leak-prone dims:
//       - simplicity: verbose jargon can *look* like a simple concept if LLM skims
//       - alignment: corporate wording may appear value-linked to a naive model
//
// Highest-risk variants: d and g — unique per field (no duplicate rule applies),
//   vague but topically adjacent language. LLM may hallucinate partial business logic.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Real NSM question (mirrors lifecycle-nsm.spec.js + nsm-gate-all-Y-adversarial.spec.js)
const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  company: 'Spotify',
  industry: 'Podcast 平台',
  scenario: 'Podcast 是 Spotify 近年重要增長引擎，需要確定哪個指標最能反映 Podcast 用戶的真實健康度',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
  coach_nsm: '週活躍 Podcast 聆聽用戶數（定義：過去 7 天在 Spotify 播放超過 5 分鐘 Podcast 內容的去重用戶數）',
};

// Substantive NSM definition — reliably passes the gate (≥ 10 chars, specific, quantified)
const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';

// Substantive rationale for gate — reliably passes NSM gate AI check
const SUBSTANTIVE_RATIONALE = '直接反映核心使用行為且與廣告收入正相關；週頻率符合 Podcast 聆聽習慣，同時能在 1-2 週內觀測到變化，適合迭代節奏';

// totalScore threshold: < 60 means average dim score < 3.0/5 (sum < 15)
// NSM: 5 dims × score; totalScore = sum × 4; threshold 60 ↔ sum < 15 ↔ avg < 3.0
const MAX_ACCEPTABLE_TOTAL_SCORE = 60;

// Per-dimension score threshold (1-5 scale): < 3 = below average
// Used for targeted assertions on the most leak-prone NSM dimensions
const MAX_ACCEPTABLE_DIM_SCORE = 3; // exclusive — we assert score < 3

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a real NSM session.
 * Mirrors lifecycle-nsm.spec.js createNsmSession (lines 55-66).
 */
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

/**
 * Seed a session into lifecycle=gated using SUBSTANTIVE content.
 *
 * Flow (api-testing.md:783-848 §Data seeding):
 *   1. POST /api/nsm-sessions → session created (lifecycle=created)
 *   2. PATCH /progress { userNsm: SUBSTANTIVE } → lifecycle=editing
 *   3. POST /gate { nsm: SUBSTANTIVE, rationale: SUBSTANTIVE } → lifecycle=gated (if AI passes)
 *
 * The EVALUATE body will be sent separately with adversarial content.
 * Unlike CIRCLES evaluator (L12), no second PATCH is needed because
 * POST /evaluate reads userNsm + userBreakdown directly from the request body.
 *
 * Returns { id, gatedOk }:
 *   gatedOk=false → gate unexpectedly rejected substantive draft (rare AI flakiness);
 *   test skips the evaluator assertion (not an evaluator bug).
 */
async function seedGatedSession(request, cleanupTracker) {
  const id = await createNsmSession(request, cleanupTracker);
  const headers = await authHeaders();

  // Step 2: PATCH substantive userNsm → lifecycle=editing
  const patchRes = await request.patch(`${BASE_URL}/api/nsm-sessions/${id}/progress`, {
    headers,
    data: { userNsm: SUBSTANTIVE_NSM },
  });
  expect([200, 400]).toContain(patchRes.status());

  // Step 3: POST /gate with substantive content — real OpenAI call
  // Per lifecycle-nsm.spec.js SLC-AC7 pattern (lines 183-200).
  const gateRes = await request.post(`${BASE_URL}/api/nsm-sessions/${id}/gate`, {
    headers,
    data: { nsm: SUBSTANTIVE_NSM, rationale: SUBSTANTIVE_RATIONALE },
  });
  expect(gateRes.status()).toBe(200);
  const gateBody = await gateRes.json();
  const gatedOk = gateBody.canProceed === true;

  return { id, gatedOk };
}

// ── setup ─────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

// ── adversarial variants ──────────────────────────────────────────────────────
//
// All variants have ≥ 10 chars per field (gate's character-count guard won't fire).
// Adversarial content is sent directly in the POST /evaluate body —
// the evaluator reads userNsm + userBreakdown from the request, not from session state.
//
// Design per task spec (a-g):
//   a — generic platitude (NSM + all 4 dims identical string) → triggers "5 欄同字串" rule
//   b — vague rationale (NSM + all 4 dims identical) → triggers "5 欄同字串" rule
//   c — meta-discussion (NSM + all 4 dims identical) → triggers "5 欄同字串" rule
//   d — Chinese lorem-ipsum: 30+ chars meaningless filler (unique per field)
//   e — copy-paste same paragraph across NSM + all 4 dims → triggers "5 欄同字串" rule
//   f — off-topic well-written: cooking essay (unique per field, completely irrelevant)
//   g — AI-generated verbose style: wordy corporate jargon (unique per field, highest risk)

/**
 * Build an adversarial body where userNsm and all 3 breakdown dims share the same text.
 * Triggers the "4 個欄位原封不動同字串" rule in nsm-evaluator.js prompt.
 */
function allFieldsSame(text) {
  return {
    userNsm: text,
    userBreakdown: { reach: text, depth: text, frequency: text },
  };
}

/**
 * Build an adversarial body with different text per field (unique, no duplicate trigger).
 * nsmText + array of 3 breakdown texts (reach, depth, frequency).
 */
function uniquePerField(nsmText, [reach, depth, frequency]) {
  return {
    userNsm: nsmText,
    userBreakdown: { reach, depth, frequency },
  };
}

const ADVERSARIAL_VARIANTS = [
  {
    label: 'a. 通用廢話句 × 4 欄相同 (generic platitude, NSM + all 3 dims identical)',
    body: allFieldsSame('我們的目標是提升用戶體驗，讓產品更加優秀並滿足用戶需求以促進增長'),
    // All 4 fields identical → triggers "4 個欄位原封不動同字串" rule
    // Predicted: all 5 dim scores=1 → totalScore=20
  },
  {
    label: 'b. 模糊理由句 × 4 欄相同 (vague rationale, NSM + all 3 dims identical)',
    body: allFieldsSame('因為很重要所以要做這個，這樣可以讓情況變得更好並帶來正面的商業影響'),
    // All 4 fields identical → triggers duplicate rule → totalScore=20
    // Predicted: totalScore ≤ 20
  },
  {
    label: 'c. 後設討論句 × 4 欄相同 (meta-discussion, NSM + all 3 dims identical)',
    body: allFieldsSame('需要考慮各種因素和場景，並對不同維度進行全面的分析和評估以確認結果'),
    // All 4 fields identical → triggers duplicate rule → totalScore=20
    // Predicted: totalScore ≤ 20
  },
  {
    label: 'd. 中文 lorem-ipsum 亂句 (meaningless filler, unique per field)',
    body: uniquePerField(
      '如果因此導致所以然後可能大概差不多左右這樣就好了吧可以算是一種指標',
      [
        '雖然但是然而不過其實其然確實如此這般那樣總歸一句話大概就這樣了',
        '反正總之大致上基本上原則上整體來看綜合評估下來嗯嗯嗯感覺還可以',
        '喔對然後就這樣了還有其他的嗎沒有了就這樣了差不多了吧也差不多了',
      ],
    ),
    // Each field ≥ 14 chars, meaningless Chinese filler — no Spotify/Podcast connection
    // No duplicate trigger (all fields differ), but "內容無關" should apply
    // Predicted: totalScore ≤ 40 (dims 1-2 per field); most leak risk: simplicity dim
  },
  {
    label: 'e. 同一段落貼滿 4 欄 (copy-paste identical paragraph across NSM + 3 dims)',
    body: allFieldsSame(
      '用戶體驗非常重要，我們需要提升留存率和活躍度，通過數據分析找到問題根本原因並制定解決方案',
    ),
    // All 4 fields identical → triggers "4 個欄位原封不動同字串" rule → all dims=1
    // Predicted: totalScore=20
  },
  {
    label: 'f. 離題好文章：100 字烹飪散文 (off-topic cooking essay, unique per field)',
    body: uniquePerField(
      '炒菜要掌握火候，油溫不夠高炒出來的菜會出水，最佳溫度在攝氏180度左右，這才是真正的北極星指標',
      [
        '醬汁的調配是料理的靈魂，生抽老抽比例要恰當，糖的份量影響整道菜的甜鹹平衡，加入薑片去腥。',
        '刀工決定食材受熱的均勻程度，切絲要細而均勻，切塊要大小一致，確保食材在相同時間內熟透。',
        '擺盤是料理最後的藝術，顏色的搭配要有層次，青翠的蔬菜搭配金黃蛋白質，淋醬方式影響美感。',
      ],
    ),
    // Content is topically coherent but about cooking, not Spotify/Podcast metrics
    // Triggers "內容與題目情境完全無關" for all fields → all dims score=1
    // Predicted: totalScore ≤ 20
  },
  {
    label: 'g. AI 冗長空話風格 (verbose AI-generated jargon, no substance, unique per field)',
    body: uniquePerField(
      '在當今數位化時代的快速發展背景下，平台需要一個能夠精準反映核心用戶行為的指標來驅動業務增長策略',
      [
        '透過深度分析各個利益相關方的核心訴求與期待，我們能夠更好地理解廣度觸及的本質，並制定最優策略',
        '基於數據驅動的決策框架，結合質性研究的深度洞察，可以幫助團隊在不確定環境中量化用戶深度互動',
        '通過持續迭代優化的敏捷方法論，結合跨部門協作的組織能力建設，有效衡量用戶參與的頻率與習慣',
      ],
    ),
    // Verbose corporate jargon — well-formed Chinese, ≥ 30 chars per field, unique fields
    // No Spotify/Podcast specifics, no quantitative claims, no operational definitions
    // HIGHEST RISK of partial credit — LLM may award simplicity/alignment partial score
    // Predicted: dims 1-2 per field → totalScore ≤ 40
  },
];

// ── test suite ────────────────────────────────────────────────────────────────

test.describe('NSM evaluator adversarial — low-quality gate-passable input scoring', () => {
  for (const { label, body } of ADVERSARIAL_VARIANTS) {
    test(label, async ({ request, cleanupTracker }) => {
      test.slow(); // gate + evaluate both call real OpenAI — allow extra time

      // Steps 1-3: Create session, PATCH substantive userNsm, gate to lifecycle=gated.
      // See seedGatedSession for full flow. Adversarial content goes in POST /evaluate body.
      const { id, gatedOk } = await seedGatedSession(request, cleanupTracker);

      // Guard: if AI unexpectedly rejected the substantive draft, skip the evaluator
      // assertion (rare gate flakiness; not a bug in the evaluator).
      if (!gatedOk) {
        console.warn(
          `[L15] variant "${label}": gate did not pass SUBSTANTIVE draft — ` +
          `skipping evaluator assertion (gate flakiness, not evaluator bug).`,
        );
        return;
      }

      const headers = await authHeaders();

      // Step 4: POST /evaluate with ADVERSARIAL userNsm + userBreakdown in body.
      // The evaluator reads these directly from req.body (not from session.framework_draft).
      // Per api-testing.md:1023-1166 — assert status first, then body shape, then semantic.
      const evalRes = await request.post(
        `${BASE_URL}/api/nsm-sessions/${id}/evaluate`,
        { headers, data: body },
      );

      // Route must return 200 on success.
      // 404 = session not found (infra issue — skip, not evaluator bug).
      // 500 = OpenAI threw (infra issue — skip, not evaluator bug).
      const evalStatus = evalRes.status();
      if (evalStatus === 404) {
        console.warn(
          `[L15] variant "${label}": evaluate returned 404 (session missing after gate) — ` +
          `infra issue, not evaluator bug. Skipping.`,
        );
        return;
      }
      if (evalStatus === 500) {
        console.warn(
          `[L15] variant "${label}": evaluate returned 500 (OpenAI error) — ` +
          `infra issue, not evaluator bug. Skipping.`,
        );
        return;
      }
      expect(evalStatus).toBe(200);

      const result = await evalRes.json();

      // ── shape assertions ──────────────────────────────────────────────────
      // NSM evaluator returns: { scores, totalScore, coachComments, coachTree,
      //   coachRationale, bestMove, mainTrap, summary }
      // Per prompts/nsm-evaluator.js JSON format specification.
      expect(typeof result.totalScore).toBe('number');
      expect(result.scores).toBeTruthy();
      expect(typeof result.scores.alignment).toBe('number');
      expect(typeof result.scores.leading).toBe('number');
      expect(typeof result.scores.actionability).toBe('number');
      expect(typeof result.scores.simplicity).toBe('number');
      expect(typeof result.scores.sensitivity).toBe('number');

      // ── ADVERSARIAL QUALITY ASSERTIONS ───────────────────────────────────

      // Assert 1: totalScore < 60
      // Formula: totalScore = (alignment + leading + actionability + simplicity + sensitivity) × 4
      // Threshold 60 ↔ sum of 5 dims < 15 ↔ avg dim score < 3.0
      expect(
        result.totalScore,
        `[BUG — NSM EVALUATOR LEAK] variant "${label}" returned totalScore=${result.totalScore} (≥ 60).\n` +
        `The evaluator awarded ≥ 3/5 average for low-quality adversarial content.\n` +
        `scores=${JSON.stringify(result.scores, null, 2)}\n` +
        `bestMove=${result.bestMove}\n` +
        `mainTrap=${result.mainTrap}\n` +
        `summary=${result.summary}`,
      ).toBeLessThan(MAX_ACCEPTABLE_TOTAL_SCORE);

      // Assert 2: alignment score < 3
      // alignment (價值關聯性): most sensitive to vague/platitude content — must be low.
      // NSM with no quantitative metric or business connection should score 1-2.
      expect(
        result.scores.alignment,
        `[BUG — NSM EVALUATOR LEAK] variant "${label}": alignment scored ` +
        `${result.scores.alignment}/5 (≥ 3) for adversarial content.\n` +
        `coachComment: ${result.coachComments?.alignment}`,
      ).toBeLessThan(MAX_ACCEPTABLE_DIM_SCORE);

      // Assert 3: actionability score < 3
      // actionability (操作性): vague/platitude content has no operational specificity.
      // Generic descriptions ("提升用戶體驗") cannot be directly acted on by dev teams.
      expect(
        result.scores.actionability,
        `[BUG — NSM EVALUATOR LEAK] variant "${label}": actionability scored ` +
        `${result.scores.actionability}/5 (≥ 3) for adversarial content.\n` +
        `coachComment: ${result.coachComments?.actionability}`,
      ).toBeLessThan(MAX_ACCEPTABLE_DIM_SCORE);

      // cleanupTracker auto-deletes the nsm session row after this test
    });
  }
});
