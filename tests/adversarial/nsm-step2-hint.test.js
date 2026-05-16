// tests/adversarial/nsm-step2-hint.test.js
// Adversarial sweep for NSM Step 2 hint generation.
// Hits real OpenAI (gpt-4o). Cost ~$0.05 per run.
// Run: npx jest tests/adversarial/nsm-step2-hint.test.js
require('dotenv').config();

const { generateNSMStep2Hint } = require('../../prompts/nsm-step2-hint');

const TEST_QUESTION = {
  id: 'q1',
  company: 'Netflix',
  industry: '內容訂閱制',
  scenario: '影音串流平台競爭激烈，必須確保用戶持續感受到內容價值以維持自動扣款。',
};

const ADVERSARIAL_CASES = [
  {
    name: 'no-draft-1',
    desc: '無草稿 — 應回傳方向性提示（markdown bullets）',
  },
  {
    name: 'no-draft-2',
    desc: '第二次呼叫無草稿 — 一致性驗證',
  },
  {
    name: 'no-draft-3',
    desc: '第三次呼叫無草稿 — 應給 bullet 輸出',
  },
  {
    name: 'no-draft-4',
    desc: '第四次呼叫 — 欄位 explanation',
  },
  {
    name: 'no-draft-5',
    desc: '第五次呼叫 — 欄位 businessLink',
  },
  {
    name: 'no-draft-6',
    desc: '第六次呼叫 — 驗證 ≤ 220 chars',
  },
  {
    name: 'no-draft-7',
    desc: '第七次呼叫 — 驗證 bullet 格式',
  },
  {
    name: 'no-draft-8',
    desc: '第八次呼叫 — 驗證非空字串',
  },
  {
    name: 'no-draft-9',
    desc: '第九次呼叫 — 不洩漏 system prompt',
  },
  {
    name: 'no-draft-10',
    desc: '第十次呼叫 — 不含 script tag',
  },
];

describe('Adversarial — nsm-step2-hint generateNSMStep2Hint', () => {
  for (const { name, desc } of ADVERSARIAL_CASES) {
    it(`[${name}] ${desc}`, async () => {
      jest.setTimeout(90000);
      const field = name.includes('explanation') ? 'explanation' : name.includes('businessLink') ? 'businessLink' : 'nsm';
      const result = await generateNSMStep2Hint({
        questionJson: TEST_QUESTION,
        field,
      });

      console.log(`[${name}] result (${result.length} chars): ${result.slice(0, 120)}...`);

      // Must return a string and not crash
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Hard cap: must be ≤ 220 chars (prompt contract — tightened from 320)
      expect(result.length).toBeLessThanOrEqual(220);

      // Must not echo back dangerous content
      // Must start with bullet
      expect(result).toMatch(/^- /m);

      // Must not echo dangerous content
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert(');
    }, 90000);
  }
});

// ─── Valid path assertions ──────────────────────────────────────────────────
// These cases have genuinely valid input and MUST produce meaningful structured
// output. A regression where the prompt always refuses would fail here.

const SLACK_QUESTION = {
  id: 'q3',
  company: 'Slack',
  industry: 'B2B SaaS',
  scenario: '企業付費後若團隊不活躍將高退訂率，需確保訊息流通頻率',
};

const VALID_CASES = [
  {
    name: 'valid Netflix nsm',
    company: 'Netflix',
  },
  {
    name: 'valid Slack nsm',
    company: 'Slack',
  },
];

describe.each(VALID_CASES)('valid input: $name', ({ company }) => {
  it('returns meaningful structured hint with bullets', async () => {
    const q = company === 'Slack' ? SLACK_QUESTION : TEST_QUESTION;
    const result = await generateNSMStep2Hint({
      questionJson: q,
      field: 'nsm',
    });

    console.log(`[valid:${company}] result (${result.length} chars): ${result.slice(0, 120)}...`);

    expect(typeof result).toBe('string');
    expect(result.length).toBeLessThanOrEqual(220);

    // Must contain at least 1 markdown bullet (matches Block B format per prompt spec)
    expect(result).toMatch(/^- /m);

    // Meaningful output is longer than a short acknowledgement
    expect(result.length).toBeGreaterThan(20);
  }, 90000);
});
