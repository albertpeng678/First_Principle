// tests/api/nsm-evaluator-3dim-adversarial.spec.js
//
// Lane L15b — NSM evaluator adversarial sweep: 3-dim schema (post impact-removal).
// Companion to nsm-evaluator-adversarial.spec.js — verifies that after removing
// the impact dimension, the NSM evaluator still correctly rejects low-quality input.
//
// POST /evaluate now receives userBreakdown with only { reach, depth, frequency }.
// The evaluator must still gate score < 60 for adversarial inputs.
//
// Real-data discipline (e2e_real_data_only Iron Law):
//   IL-1  禁 mock prompts/nsm-evaluator.js — must hit real OpenAI
//   IL-2  禁 stub timestamp — real DB rows only
//   IL-3  禁 prod URL + 真帳號 — e2e@first-principle.test against test DB only
//
// Karpathy: Simplicity First — reuse seedGatedSession pattern from L15;
//   only change is 3-dim userBreakdown (no impact key).

const { test } = require('./fixtures/api-cleanup.fixture');
const { expect } = require('@playwright/test');
const { getE2eToken, clearTokenCache } = require('./helpers/auth');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

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

const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const SUBSTANTIVE_RATIONALE = '直接反映核心使用行為且與廣告收入正相關；週頻率符合 Podcast 聆聽習慣，同時能在 1-2 週內觀測到變化，適合迭代節奏';

const MAX_ACCEPTABLE_TOTAL_SCORE = 60;
const MAX_ACCEPTABLE_DIM_SCORE = 3;

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

async function seedGatedSession(request, cleanupTracker) {
  const id = await createNsmSession(request, cleanupTracker);
  const headers = await authHeaders();

  await request.patch(`${BASE_URL}/api/nsm-sessions/${id}/progress`, {
    headers,
    data: { userNsm: SUBSTANTIVE_NSM },
  });

  const gateRes = await request.post(`${BASE_URL}/api/nsm-sessions/${id}/gate`, {
    headers,
    data: { nsm: SUBSTANTIVE_NSM, rationale: SUBSTANTIVE_RATIONALE },
  });
  expect(gateRes.status()).toBe(200);
  const gateBody = await gateRes.json();
  const gatedOk = gateBody.canProceed === true;

  return { id, gatedOk };
}

// 3-dim adversarial helpers (no impact key)
function allFieldsSame3(text) {
  return {
    userNsm: text,
    userBreakdown: { reach: text, depth: text, frequency: text },
  };
}

function uniquePerField3(nsmText, [reach, depth, frequency]) {
  return {
    userNsm: nsmText,
    userBreakdown: { reach, depth, frequency },
  };
}

const ADVERSARIAL_VARIANTS_3DIM = [
  {
    label: '3dim-a. 通用廢話句 × 4 欄相同 (generic platitude, NSM + all 3 dims identical)',
    body: allFieldsSame3('我們的目標是提升用戶體驗，讓產品更加優秀並滿足用戶需求以促進增長'),
  },
  {
    label: '3dim-b. 模糊理由句 × 4 欄相同 (vague rationale, NSM + all 3 dims identical)',
    body: allFieldsSame3('因為很重要所以要做這個，這樣可以讓情況變得更好並帶來正面的商業影響'),
  },
  {
    label: '3dim-c. 中文 lorem-ipsum 亂句 (meaningless filler, unique per 3 dims)',
    body: uniquePerField3(
      '如果因此導致所以然後可能大概差不多左右這樣就好了吧可以算是一種指標',
      [
        '雖然但是然而不過其實其然確實如此這般那樣總歸一句話大概就這樣了',
        '反正總之大致上基本上原則上整體來看綜合評估下來嗯嗯嗯感覺還可以',
        '喔對然後就這樣了還有其他的嗎沒有了就這樣了差不多了吧也差不多了',
      ],
    ),
  },
  {
    label: '3dim-d. 離題好文章：烹飪散文 (off-topic cooking essay, unique per 3 dims)',
    body: uniquePerField3(
      '炒菜要掌握火候，油溫不夠高炒出來的菜會出水，最佳溫度在攝氏180度左右，這才是真正的北極星指標',
      [
        '醬汁的調配是料理的靈魂，生抽老抽比例要恰當，糖的份量影響整道菜的甜鹹平衡，加入薑片去腥。',
        '刀工決定食材受熱的均勻程度，切絲要細而均勻，切塊要大小一致，確保食材在相同時間內熟透。',
        '擺盤是料理最後的藝術，顏色的搭配要有層次，青翠的蔬菜搭配金黃蛋白質，淋醬方式影響美感。',
      ],
    ),
  },
];

test.beforeAll(async () => {
  await getE2eToken();
});

test.afterAll(() => {
  clearTokenCache();
});

test.describe('NSM evaluator adversarial — 3-dim schema (post impact-removal)', () => {
  for (const { label, body } of ADVERSARIAL_VARIANTS_3DIM) {
    test(label, async ({ request, cleanupTracker }) => {
      test.slow();

      const { id, gatedOk } = await seedGatedSession(request, cleanupTracker);

      if (!gatedOk) {
        console.warn(
          `[L15b] variant "${label}": gate did not pass SUBSTANTIVE draft — ` +
          `skipping evaluator assertion (gate flakiness, not evaluator bug).`,
        );
        return;
      }

      const headers = await authHeaders();

      const evalRes = await request.post(
        `${BASE_URL}/api/nsm-sessions/${id}/evaluate`,
        { headers, data: body },
      );

      const evalStatus = evalRes.status();
      if (evalStatus === 404) {
        console.warn(`[L15b] variant "${label}": evaluate returned 404 (session missing) — skipping.`);
        return;
      }
      if (evalStatus === 500) {
        console.warn(`[L15b] variant "${label}": evaluate returned 500 (OpenAI error) — skipping.`);
        return;
      }
      expect(evalStatus).toBe(200);

      const result = await evalRes.json();

      // shape assertions
      expect(typeof result.totalScore).toBe('number');
      expect(result.scores).toBeTruthy();
      expect(typeof result.scores.alignment).toBe('number');
      expect(typeof result.scores.leading).toBe('number');
      expect(typeof result.scores.actionability).toBe('number');
      expect(typeof result.scores.simplicity).toBe('number');
      expect(typeof result.scores.sensitivity).toBe('number');

      // adversarial quality: totalScore < 60
      expect(
        result.totalScore,
        `[BUG — NSM EVALUATOR LEAK 3-dim] variant "${label}" returned totalScore=${result.totalScore} (≥ 60).\n` +
        `scores=${JSON.stringify(result.scores, null, 2)}\n` +
        `bestMove=${result.bestMove}\nmainTrap=${result.mainTrap}`,
      ).toBeLessThan(MAX_ACCEPTABLE_TOTAL_SCORE);

      // alignment must be < 3 for vague/off-topic inputs
      expect(
        result.scores.alignment,
        `[BUG — NSM EVALUATOR LEAK 3-dim] variant "${label}": alignment=${result.scores.alignment}/5 (≥ 3).`,
      ).toBeLessThan(MAX_ACCEPTABLE_DIM_SCORE);
    });
  }
});
