// tests/api/circles-evaluator-adversarial.spec.js
//
// Lane L12 — CIRCLES evaluator adversarial sweep (preventive).
// Mirror of L2 (circles-gate-all-Y-adversarial, commit f7a43ff) and
// L9 (nsm-gate-all-Y-adversarial, commit 322dfa8) applied to the CIRCLES
// **evaluator** prompt — POST /api/circles-sessions/:id/evaluate-step.
//
// PURPOSE: Confirm real OpenAI + real prompt does NOT award unreasonably high
//   totalScore for gate-passable but low-quality / meaningless inputs.
//   "Gate-passable" = content is ≥ 10 chars (avoids gate's length guard), but
//   is vague, incoherent, off-topic, or duplicated across fields.
//   If any variant returns totalScore >= 60, that variant is flagged as an
//   evaluator leak.
//
// Skills applied:
//   api-testing.md:1023-1166 §Error response testing
//     — assertion order: status first, then body shape, then semantic assertions
//   api-testing.md:783-848 §Data seeding via service-role
//     — real DB seed via POST /draft → PATCH /progress (substantive flat) →
//       POST /gate → PATCH /progress (adversarial flat) → POST /evaluate-step
//   auth-flows.md:928-949 §API seed auth
//     — getE2eToken() pattern; token cached across tests
//   fixtures-and-hooks.md §Auto-cleanup
//     — cleanupTracker fixture auto-deletes rows after each test
//
// REAL-DATA DISCIPLINE (e2e_real_data_only Iron Law):
//   IL-1  禁 mock prompts/circles-evaluator.js — must hit real OpenAI to surface real behaviour
//   IL-2  禁 stub timestamp — real DB rows only
//   IL-3  禁 prod URL + 真帳號 — e2e@first-principle.test against test DB only
//
// ── Framework structure notes ──────────────────────────────────────────────
// The gate + evaluator both expect a **flat** frameworkDraft:
//   { fieldName: value, fieldName: value, ... }
// NOT the nested form { C1: { fieldName: value } }.
// This matches how tests/factories/circles-phase1.factory.js builds its payloads.
//
// C1 field names (from factory.js):
//   ['問題範圍', '時間範圍', '業務影響', '假設確認']
//
// The seeding strategy is:
//   1. POST /draft → session created
//   2. PATCH /progress with SUBSTANTIVE flat C1 content
//      → computeLifecycle promotes lifecycle=editing
//   3. POST /gate with flat SUBSTANTIVE draft → lifecycle=gated (if AI passes)
//   4. PATCH /progress with flat ADVERSARIAL draft
//      → lifecycle stays gated (monotone guard never demotes)
//   5. POST /evaluate-step → evaluator reads session.framework_draft
//      (adversarial flat content) and must score it LOW (totalScore < 60)
//
// ── Karpathy Think Before — pre-run leak predictions (§3 of audit doc) ────
//   The evaluator prompt (prompts/circles-evaluator.js) has an 輸入品質檢查
//   block at highest priority:
//     - 字數 < 10 → score=1 (our variants ARE ≥ 10 chars, this rule won't fire)
//     - 同一字串原封不動填入多個欄位 → all dims score=1 (variants a, b, c, e trigger)
//     - 內容與主題完全無關 → score=1 (variant f — cooking essay — triggers)
//   Predicted totalScore per variant (C1 has 4 dims; totalScore = sum*100/(4*5)):
//     a (重複廢話句): all 4 fields identical → triggers duplicate rule → all dims=1 → totalScore ≤ 20
//     b (模糊理由句): all 4 fields identical → triggers duplicate rule → totalScore ≤ 20
//     c (後設討論句): all 4 fields identical → triggers duplicate rule → totalScore ≤ 20
//     d (lorem中文): unique per field, vague → dims ≤ 2 each → totalScore ≤ 40
//     e (copy-paste同段落): all 4 fields identical → triggers duplicate rule → totalScore ≤ 20
//     f (離題烹飪): triggers 內容無關 → all dims=1 → totalScore ≤ 20
//     g (AI冗長空話): unique per field, verbose but no substance → dims 1-2 each → totalScore ≤ 40
//   Highest risk of evaluator leak:
//     d and g — unique per field (no duplicate rule), vague but topically adjacent.
//     LLM may hallucinate "some thought process" and award partial credit.
//   Most leak-prone dimension:
//     問題邊界清晰度 (C1 first dimension) — vague content can mimic scoped thinking.

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Real question from circles_database.json (Spotify Podcast — same as sister specs)
const QUESTION_ID = 'circles_001';
const DRILL_STEP  = 'C1';

// C1 field names in flat format — from tests/factories/circles-phase1.factory.js
const C1_FIELDS = ['問題範圍', '時間範圍', '業務影響', '假設確認'];

// High-quality substantive C1 draft in FLAT format (field → value mapping).
// Uses factory-style values that reliably pass the gate Layer 1 + Layer 2 checks.
// Drawn from circles-phase1.factory.js QUALITY_POOL pattern.
const SUBSTANTIVE_FLAT_DRAFT = {
  問題範圍: '聚焦 Spotify 免費版通勤用戶在首 7 日的廣告體驗，排除付費方案與創作者後台，核心指標為次月留存率',
  時間範圍: '60 天觀察期；廣告活動以月為週期，2 個完整週期可觀察留存效應與廣告耐受度',
  業務影響: '廣告收入和免費→付費轉換率不能下降超過 3%，次月留存目標提升 ≥ 5 個百分點',
  假設確認: '假設用戶廣告負感主要來自時段與頻率而非廣告本身；通勤族願意接受每集 ≤ 2 則廣告',
};

// totalScore threshold: < 60 means average dimension score < 3.0/5 (i.e., weak)
// C1 has 4 dimensions; totalScore = (sum of dim scores) × 100 / (4 × 5) = sum × 5
// totalScore 60 ↔ sum 12 ↔ avg dim score 3.0/5
const MAX_ACCEPTABLE_TOTAL_SCORE = 60;

// Per-dimension score threshold (1-5 scale): < 3 = below average
// Used for targeted assertions on the two most leak-prone C1 dimensions
const MAX_ACCEPTABLE_DIM_SCORE = 3; // exclusive — we assert score < 3

// Build a flat C1 draft where all 4 fields share the same text
function allFieldsFlat(text) {
  return Object.fromEntries(C1_FIELDS.map((f) => [f, text]));
}

// Build a flat C1 draft with different text per field (from an array, one per field)
function perFieldFlat(texts) {
  return Object.fromEntries(C1_FIELDS.map((f, i) => [f, texts[i % texts.length]]));
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getE2eToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Seed a session into lifecycle=gated state using SUBSTANTIVE content,
 * then overwrite framework_draft with adversarial content.
 *
 * Flow:
 *   1. POST /draft   → lifecycle=created
 *   2. PATCH /progress frameworkDraft=SUBSTANTIVE_FLAT_DRAFT → lifecycle=editing
 *      Note: frameworkDraft is stored nested under framework_draft in DB.
 *            The lifecycle module uses collectCirclesStrings which handles
 *            both flat and nested forms.
 *   3. POST /gate frameworkDraft=SUBSTANTIVE_FLAT_DRAFT → lifecycle=gated (if AI passes)
 *      The gate prompt reads Object.entries(frameworkDraft) and expects flat field→value.
 *   4. PATCH /progress frameworkDraft=adversarialFlat → lifecycle stays gated (monotone)
 *      The evaluator reads session.framework_draft (adversarial flat content).
 *
 * Returns { id, gatedOk }:
 *   gatedOk=false → gate unexpectedly rejected substantive draft (rare); test skips.
 */
async function seedGatedSessionWithAdversarial(request, cleanupTracker, adversarialFlat) {
  const headers = await authHeaders();

  // Step 1: Create draft session
  const draftRes = await request.post(`${BASE_URL}/api/circles-sessions/draft`, {
    headers,
    data: { question_id: QUESTION_ID, mode: 'drill', drill_step: DRILL_STEP },
  });
  expect(draftRes.status()).toBe(200);
  const session = await draftRes.json();
  expect(session.id).toBeTruthy();
  cleanupTracker.track('circles', session.id);

  // Step 2: PATCH substantive content to promote lifecycle to editing
  // Note: we send frameworkDraft as flat (field→value) so PATCH /progress stores it
  // directly as framework_draft. The gate also receives this flat format.
  const patchSubstantiveRes = await request.patch(
    `${BASE_URL}/api/circles-sessions/${session.id}/progress`,
    { headers, data: { frameworkDraft: SUBSTANTIVE_FLAT_DRAFT } },
  );
  expect([200, 400]).toContain(patchSubstantiveRes.status());

  // Step 3: POST /gate with flat substantive content — real OpenAI call
  // Gate prompt reads Object.entries(frameworkDraft) → expects flat field→value pairs.
  // Per lifecycle-circles.spec.js SLC-AC7 pattern (lines 126-156).
  const gateRes = await request.post(
    `${BASE_URL}/api/circles-sessions/${session.id}/gate`,
    {
      headers,
      data: { step: DRILL_STEP, frameworkDraft: SUBSTANTIVE_FLAT_DRAFT },
    },
  );
  expect(gateRes.status()).toBe(200);
  const gateBody = await gateRes.json();
  const gatedOk = gateBody.canProceed === true;

  // Step 4: PATCH adversarial frameworkDraft — overwrites framework_draft in DB.
  // Lifecycle stays gated (monotone guard; SLC-AC9 verified in lifecycle-circles.spec.js).
  // The evaluate-step handler reads session.framework_draft, now adversarial content.
  //
  // Acceptable PATCH statuses:
  //   200 — updated successfully
  //   400 — nothing_to_update (adversarial == existing; harmless, evaluator will still run)
  //   404 — session not found (rare environmental issue; flag to skip evaluator assertion)
  let patchAdversarialOk = false;
  if (gatedOk) {
    const patchAdversarialRes = await request.patch(
      `${BASE_URL}/api/circles-sessions/${session.id}/progress`,
      { headers, data: { frameworkDraft: adversarialFlat } },
    );
    const patchStatus = patchAdversarialRes.status();
    if (patchStatus === 404) {
      console.warn(
        `[L12] variant seeding: PATCH adversarial returned 404 (session missing after gate) — ` +
        `skipping evaluator assertion for this variant.`,
      );
    } else {
      expect([200, 400]).toContain(patchStatus);
      patchAdversarialOk = true;
    }
  }

  return { id: session.id, gatedOk: gatedOk && patchAdversarialOk };
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
// All variants are ≥ 10 chars per field (gate's character-count guard won't fire).
// Variants are submitted to the EVALUATOR after gate passes with substantive content.
// The evaluator receives the adversarial flat content as session.framework_draft.
//
// Design per task spec (a-g):
//   a — generic platitude repeated across all 4 fields (triggers duplicate rule)
//   b — vague rationale repeated across all 4 fields (triggers duplicate rule)
//   c — meta-discussion / no content repeated across all 4 fields (triggers duplicate)
//   d — Chinese lorem-ipsum: 30+ chars of meaningless filler (unique per field)
//   e — copy-paste same substantial-looking paragraph across all 4 fields (duplicate)
//   f — off-topic: cooking essay completely unrelated to Spotify Podcast (irrelevant)
//   g — AI-generated style: verbose but no substance (unique per field, most risky)

const ADVERSARIAL_VARIANTS = [
  {
    label: 'a. 通用廢話句 × 4 欄 (generic platitude, all identical)',
    draft: allFieldsFlat('我們的目標是提升用戶體驗，讓產品更加優秀並滿足用戶需求'),
    // All 4 fields identical → triggers 同一字串全欄位 rule → all dims score=1
    // Predicted: totalScore ≤ 20
  },
  {
    label: 'b. 模糊理由句 × 4 欄 (vague rationale, all identical)',
    draft: allFieldsFlat('因為很重要所以要做這個，這樣可以讓情況變得更好並帶來正面影響'),
    // All 4 fields identical → triggers duplicate rule → totalScore ≤ 20
    // Predicted: totalScore ≤ 20
  },
  {
    label: 'c. 後設討論句 × 4 欄 (meta-discussion, all identical)',
    draft: allFieldsFlat('需要考慮各種因素和場景，並對不同維度進行全面分析和評估'),
    // All 4 fields identical → triggers duplicate rule → all dims score=1
    // Also: pure meta-language with zero substance
    // Predicted: totalScore ≤ 20
  },
  {
    label: 'd. 中文 lorem-ipsum 亂句 (meaningless filler, unique per field)',
    draft: perFieldFlat([
      '如果因此導致所以然後可能大概差不多左右這樣就好了吧',
      '雖然但是然而不過其實其然確實如此這般那樣總歸一句話',
      '反正總之大致上基本上原則上整體來看綜合評估下來嗯嗯嗯',
      '喔對然後就這樣了還有其他的嗎沒有了就這樣了差不多了',
    ]),
    // Each field ≥ 14 chars, meaningless Chinese filler — no Spotify/Podcast connection
    // No duplicate trigger (fields differ), but quality check for 內容無關應觸發
    // Predicted: totalScore ≤ 40 (dims 1-2 per field → avg ≤ 40)
  },
  {
    label: 'e. 同一段落貼滿 4 欄 (copy-paste identical paragraph)',
    draft: allFieldsFlat(
      '用戶體驗非常重要，我們需要提升留存率和活躍度，通過數據分析找到問題根本原因並制定解決方案',
    ),
    // All 4 fields identical → triggers 同一字串原封不動填入多個欄位 rule → all dims=1
    // Predicted: totalScore ≤ 20
  },
  {
    label: 'f. 離題好文章：100 字烹飪散文 (off-topic cooking essay, unique per field)',
    draft: perFieldFlat([
      '炒菜的時候要掌握火候，油溫不夠高炒出來的菜會出水，油溫太高容易燒焦食材，最佳溫度在攝氏180度左右，這樣炒出來的食材外酥內嫩。',
      '醬汁的調配是料理的靈魂，生抽老抽比例要恰當，糖的份量影響整道菜的甜鹹平衡，加入薑片去腥提鮮是傳統粵式烹飪的精髓所在。',
      '刀工決定食材受熱的均勻程度，切絲要細而均勻，切塊要大小一致，這樣才能確保同一鍋中所有食材在相同時間內達到最佳熟度。',
      '擺盤是料理最後的藝術，顏色的搭配要有層次，青翠的蔬菜搭配金黃的蛋白質，淋上醬汁的方式也影響整道菜的視覺美感與食慾。',
    ]),
    // Content is well-written, topically coherent — but about cooking, not Spotify Podcast
    // Triggers 內容與本步驟主題完全無關 rule for all fields
    // Predicted: totalScore ≤ 20 (all dims score=1)
  },
  {
    label: 'g. AI 冗長空話風格 (verbose AI-generated, no substance, unique per field)',
    draft: perFieldFlat([
      '在當今數位化時代的快速發展背景下，用戶需求日益複雜多元，產品設計需要從多個維度出發進行全方位的綜合性考量和策略佈局。',
      '透過深度分析各個利益相關方的核心訴求與期待，我們能夠更好地理解問題的本質，並在此基礎上制定出符合實際情況的最優解決路徑。',
      '基於數據驅動的決策框架，結合質性研究的深度洞察，可以幫助團隊在不確定環境中找到清晰的前進方向，實現業務目標的有效達成。',
      '最終，通過持續迭代優化的敏捷方法論，配合跨部門協作的組織能力建設，將能夠有效推動整體業務指標的提升和用戶價值的最大化。',
    ]),
    // Verbose corporate jargon — well-formed Chinese, ≥ 30 chars per field, unique fields
    // No Spotify/Podcast specifics, no quantitative claims, no scoped thinking
    // Highest risk of partial credit — monitoring 問題邊界清晰度 + 業務影響連結
    // Predicted: dims 1-2 per field → totalScore ≤ 40
  },
];

// ── test suite ────────────────────────────────────────────────────────────────

test.describe('CIRCLES evaluator adversarial — low-quality gate-passable input scoring', () => {
  for (const { label, draft } of ADVERSARIAL_VARIANTS) {
    test(label, async ({ request, cleanupTracker }) => {
      test.slow(); // gate + evaluate both call real OpenAI — allow extra time

      // Steps 1-4: Create session, gate with SUBSTANTIVE flat draft, then overwrite
      // framework_draft with adversarial flat content. See seedGatedSessionWithAdversarial.
      const { id, gatedOk } = await seedGatedSessionWithAdversarial(request, cleanupTracker, draft);

      // Guard: if AI unexpectedly rejected the substantive draft, skip the evaluator
      // assertion (rare gate flakiness; not a bug in the evaluator).
      if (!gatedOk) {
        console.warn(
          `[L12] variant "${label}": gate did not pass SUBSTANTIVE draft — ` +
          `skipping evaluator assertion (gate flakiness, not evaluator bug).`,
        );
        return;
      }

      const headers = await authHeaders();

      // Step 5: POST /evaluate-step — evaluator reads session.framework_draft
      // which now contains the adversarial flat content from step 4.
      // Per api-testing.md:1023-1166 — assert status first, then body shape.
      const evalRes = await request.post(
        `${BASE_URL}/api/circles-sessions/${id}/evaluate-step`,
        { headers },
      );

      // Route must return 200 on success.
      // 422 = step_already_scored (session scored in a prior test run due to cleanup
      // failure — treat as infra skip, not an evaluator behaviour issue).
      if (evalRes.status() === 422) {
        console.warn(
          `[L12] variant "${label}": evaluate-step returned 422 step_already_scored ` +
          `(prior test run left a scored session; infra issue, not evaluator bug). Skipping.`,
        );
        return;
      }
      expect(evalRes.status()).toBe(200);

      const body = await evalRes.json();

      // ── shape assertions (mirrors circles-evaluate-step-contract.spec.js) ──
      expect(Array.isArray(body.dimensions)).toBe(true);
      expect(body.dimensions.length).toBeGreaterThan(0);
      expect(typeof body.totalScore).toBe('number');

      // ── ADVERSARIAL QUALITY ASSERTIONS ──

      // Assert 1: totalScore < 60 (average dimension score < 3.0/5)
      // Formula: totalScore = sum_of_dim_scores × 100 / (numDims × 5)
      // For C1 (4 dims): totalScore = sum × 5; threshold 60 → sum < 12 → avg < 3.0
      expect(
        body.totalScore,
        `[BUG — EVALUATOR LEAK] variant "${label}" returned totalScore=${body.totalScore} (≥ 60).\n` +
        `The evaluator awarded ≥ 3/5 average for low-quality adversarial content.\n` +
        `dimensions=${JSON.stringify(body.dimensions, null, 2)}\n` +
        `highlight=${body.highlight}\n` +
        `improvement=${body.improvement}`,
      ).toBeLessThan(MAX_ACCEPTABLE_TOTAL_SCORE);

      // Assert 2: 問題邊界清晰度 (C1 first dimension — rigour) score < 3
      // This dimension is most at risk for vague/generic content leaks.
      const rigourDim = body.dimensions.find(
        (d) => d.name && (d.name.includes('問題邊界') || d.name.includes('邊界') || d.name.includes('清晰')),
      );
      if (rigourDim) {
        expect(
          rigourDim.score,
          `[BUG — EVALUATOR LEAK] variant "${label}": rigour dim ("${rigourDim.name}") ` +
          `scored ${rigourDim.score}/5 (≥ 3) for adversarial content.\n` +
          `comment: ${rigourDim.comment}`,
        ).toBeLessThan(MAX_ACCEPTABLE_DIM_SCORE);
      }

      // Assert 3: 業務影響連結 (C1 second dimension — business impact specificity) score < 3
      // Off-topic / platitude content has zero business specificity.
      const businessDim = body.dimensions.find(
        (d) => d.name && (d.name.includes('業務') || d.name.includes('影響') || d.name.includes('連結')),
      );
      if (businessDim) {
        expect(
          businessDim.score,
          `[BUG — EVALUATOR LEAK] variant "${label}": business dim ("${businessDim.name}") ` +
          `scored ${businessDim.score}/5 (≥ 3) for adversarial content.\n` +
          `comment: ${businessDim.comment}`,
        ).toBeLessThan(MAX_ACCEPTABLE_DIM_SCORE);
      }

      // cleanupTracker auto-deletes the session row after this test
    });
  }
});
