// tests/adversarial/circles-coach.spec.js
// Adversarial sweep for circles-coach.js interviewee vagueness rules.
// 6 negative cases (AI must NOT give quantitative / feature-suggestion answers)
// 3 positive cases (AI must give cooperative 1-fact answers)
// Production config: model=gpt-4o, temperature=0.7 (read from prompts/circles-coach.js)

require('dotenv').config(); // must load before circles-coach.js initialises OpenAI client
const { test, expect } = require('@playwright/test');
const { streamCirclesReply } = require('../../prompts/circles-coach');

// --- Shared session fixture ---
// Spotify Podcast scenario (same as helper.js QUESTION)
const BASE_SESSION = {
  mode: 'drill',
  drill_step: 'I',
  question_json: {
    company: 'Spotify',
    problem_statement: 'Spotify Podcast 想優化免費版用戶的廣告體驗，請設計改善方案',
    hidden_context: '用戶主要在通勤時段使用，廣告打斷感最強；每週聽 3-5 小時；對特定科技類節目黏著度高',
  },
  conversation: [],
};

// Helper: collect full stream into a string and measure tokens (approx char/4)
async function collectReply(userMessage, session = BASE_SESSION) {
  let full = '';
  for await (const chunk of streamCirclesReply(session, userMessage)) {
    full += chunk;
  }
  return full;
}

// Extract the 【被訪談者】 section from the full reply
function extractInterviewee(reply) {
  const m = reply.match(/【被訪談者】\s*([\s\S]*?)(?=\n【|$)/);
  return m ? m[1].trim() : reply.trim();
}

// Check if a string contains explicit numbers (digits) that look quantitative
// e.g. "5 小時", "每天 3 次", "80%", "3 到 5 小時" (range also counts)
const QUANTITATIVE_RE = /\d+\s*(小時|分鐘|次|天|週|月|%|倍|用戶|人)|\d+\s*(到|至|-)\s*\d+/i;
const SEGMENT_LABEL_RE = /power\s*user|casual\s*user|重度用戶|輕度用戶|我屬於|我算是.{0,4}類/i;
const FEATURE_SUGGEST_RE = /可以加|應該做|建議加|你們應該|應該新增|應該改|你們可以|我覺得你們|如果加上|加入.{0,6}功能|做一個.{0,6}功能/i;

test.describe('Adversarial — circles-coach 被訪談者 vagueness rules', () => {
  test.describe.configure({ mode: 'serial' });

  // ────────────────────────────────────────────────
  // NEGATIVE CASES — AI 不可量化 / 不可分類 / 不可建議功能
  // ────────────────────────────────────────────────

  test('[neg-1] 一週用幾小時 → 不可給具體數字，應模糊回', async () => {
    test.setTimeout(60_000);
    const reply = await collectReply('你一週大概用幾小時 Spotify Podcast？');
    const interviewee = extractInterviewee(reply);
    console.log('[neg-1] interviewee:', interviewee);
    expect(interviewee).not.toMatch(QUANTITATIVE_RE);
    expect(interviewee.length).toBeGreaterThan(0);
  });

  test('[neg-2] 屬於哪種類型用戶 → 不可主動分類', async () => {
    test.setTimeout(60_000);
    const reply = await collectReply('你覺得你屬於哪種類型的用戶？power user 還是 casual user？');
    const interviewee = extractInterviewee(reply);
    console.log('[neg-2] interviewee:', interviewee);
    expect(interviewee).not.toMatch(SEGMENT_LABEL_RE);
  });

  test('[neg-3] 應該加什麼功能 → 不可 propose 解法', async () => {
    test.setTimeout(60_000);
    const reply = await collectReply('你覺得 Spotify Podcast 應該加什麼功能來改善廣告體驗？');
    const interviewee = extractInterviewee(reply);
    console.log('[neg-3] interviewee:', interviewee);
    expect(interviewee).not.toMatch(FEATURE_SUGGEST_RE);
  });

  test('[neg-4] 連追 3 問同一量化問題 → 仍維持模糊', async () => {
    test.setTimeout(120_000);
    // Simulate 2 prior turns pushing for a number, then ask a third time
    const sessionWithHistory = {
      ...BASE_SESSION,
      conversation: [
        {
          userMessage: '你一週用幾小時？',
          interviewee: '應該滿常的吧，說不太準。',
          coaching: '',
          hint: '',
        },
        {
          userMessage: '大概幾小時嘛，給個範圍也好。',
          interviewee: '嗯…比一般人多一點吧，但我沒特別算過。',
          coaching: '',
          hint: '',
        },
      ],
    };
    const reply = await collectReply('你就說個粗略數字嘛，3 小時還是 5 小時？', sessionWithHistory);
    const interviewee = extractInterviewee(reply);
    console.log('[neg-4] interviewee:', interviewee);
    expect(interviewee).not.toMatch(QUANTITATIVE_RE);
  });

  test('[neg-5] 引導式 — 我猜你每天用 5 次以上？→ 不可附和具體數字', async () => {
    test.setTimeout(60_000);
    const reply = await collectReply('我猜你每天至少用 5 次以上吧？');
    const interviewee = extractInterviewee(reply);
    console.log('[neg-5] interviewee:', interviewee);
    // Should not confirm or echo the specific number
    expect(interviewee).not.toMatch(/每天.{0,4}5\s*次|5\s*次.{0,4}每天|每天.{0,4}\d+\s*次/);
    expect(interviewee).not.toMatch(QUANTITATIVE_RE);
  });

  test('[neg-6] 描述使用場景 → 一次只給 1 個場景，不列舉', async () => {
    test.setTimeout(60_000);
    const reply = await collectReply('你能描述你通常在什麼場景下用 Spotify Podcast 嗎？');
    const interviewee = extractInterviewee(reply);
    console.log('[neg-6] interviewee:', interviewee);
    // Should not list multiple scenarios with bullets or enumeration
    const bulletCount = (interviewee.match(/[、，,]\s*(?:還有|也會|有時|另外|加上)/g) || []).length;
    expect(bulletCount, `gave ${bulletCount} extra scenarios`).toBeLessThanOrEqual(1);
    // Length guard: 1-2 sentences should be well under 120 chars
    expect(interviewee.length).toBeLessThanOrEqual(120);
  });

  // ────────────────────────────────────────────────
  // POSITIVE CASES — AI 應 cooperative，給 1 個具體事實
  // ────────────────────────────────────────────────

  test('[pos-1] 最近什麼時候用過 → 給 1 個具體時間', async () => {
    test.setTimeout(60_000);
    const reply = await collectReply('你最近什麼時候用過 Spotify Podcast？');
    const interviewee = extractInterviewee(reply);
    console.log('[pos-1] interviewee:', interviewee);
    // Should give some concrete timeframe (yesterday / commute / morning etc.)
    const hasTimeRef = /昨天|今天|早上|通勤|剛才|上週|前幾天|剛剛|這週|最近/.test(interviewee);
    expect(hasTimeRef, `no time reference in: ${interviewee}`).toBe(true);
    // Should be short
    expect(interviewee.length).toBeLessThanOrEqual(80);
  });

  test('[pos-2] 會推薦給朋友嗎 → 1-2 句感性 reason', async () => {
    test.setTimeout(60_000);
    const reply = await collectReply('你會推薦 Spotify Podcast 給朋友嗎？為什麼？');
    const interviewee = extractInterviewee(reply);
    console.log('[pos-2] interviewee:', interviewee);
    // Should give a substantive answer (at least some content)
    expect(interviewee.length).toBeGreaterThan(5);
    expect(interviewee.length).toBeLessThanOrEqual(120);
  });

  test('[pos-3] 有什麼讓你不方便的 → 給 1 個痛點，不 propose 解法', async () => {
    test.setTimeout(60_000);
    const reply = await collectReply('有沒有什麼讓你覺得不方便的地方？');
    const interviewee = extractInterviewee(reply);
    console.log('[pos-3] interviewee:', interviewee);
    // Should mention a pain point
    const hasPainPoint = /廣告|打斷|不方便|煩|停|突然|切換|跳出|無法|沒辦法/.test(interviewee);
    expect(hasPainPoint, `no pain point in: ${interviewee}`).toBe(true);
    // Should NOT propose a solution
    expect(interviewee).not.toMatch(FEATURE_SUGGEST_RE);
  });
});
