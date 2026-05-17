// tests/unit/prompts-question-only.test.js
// IL-3 red-first unit specs — prompt string-shape verification (no network).
const OpenAI = require('openai');

jest.mock('openai', () => {
  const create = jest.fn(async (args) => {
    // Detect: if response_format is json_object, return JSON envelope; else return bullet string
    if (args && args.response_format && args.response_format.type === 'json_object') {
      return { choices: [{ message: { content: '{"reach":"- a","depth":"- b","frequency":"- c","impact":"- d"}' } }] };
    }
    return { choices: [{ message: { content: '- 思考 **重點** 是什麼？\n  - 從 X 入手' } }] };
  });
  return jest.fn().mockImplementation(() => ({ chat: { completions: { create } } }));
});

const { generateNSMHints } = require('../../prompts/nsm-hints');
const { generateNSMStep2Hint } = require('../../prompts/nsm-step2-hint');
const { generateNSMStep3Hint } = require('../../prompts/nsm-step3-hint');
const { generateCirclesHint } = require('../../prompts/circles-hint');

describe('nsm-hints — question-only + markdown bullet output (Stage 1D)', () => {
  beforeEach(() => {
    const OpenAICtor = require('openai');
    const mockInstance = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1];
    if (mockInstance && mockInstance.value) mockInstance.value.chat.completions.create.mockClear();
  });

  it('signature rejects user_nsm — function does not interpolate user draft', async () => {
    await generateNSMHints({ question_json: { company: 'Netflix', scenario: 'x' }, product_type: 'attention' });
    const OpenAICtor = require('openai');
    const create = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1].value.chat.completions.create;
    const promptArg = create.mock.calls[0][0].messages[0].content;
    expect(promptArg).not.toContain('user_nsm');
    expect(promptArg).not.toContain('學員定義的 NSM');
  });

  it('output spec contains markdown bullet instruction', async () => {
    await generateNSMHints({ question_json: { company: 'Netflix', scenario: 'x' }, product_type: 'attention' });
    const OpenAICtor = require('openai');
    const create = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1].value.chat.completions.create;
    const promptArg = create.mock.calls[0][0].messages[0].content;
    expect(promptArg).toMatch(/markdown bullet|「- 」|頂層「- 」/);
  });

  it('returns 4-dim JSON envelope with reach/depth/frequency/impact keys', async () => {
    const result = await generateNSMHints({ question_json: { company: 'Netflix', scenario: 'x' }, product_type: 'attention' });
    expect(Object.keys(result).sort()).toEqual(['depth', 'frequency', 'impact', 'reach']);
  });
});

describe('nsm-step2-hint — question-only (Stage 1D)', () => {
  beforeEach(() => {
    const OpenAICtor = require('openai');
    const mockInstance = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1];
    if (mockInstance && mockInstance.value) mockInstance.value.chat.completions.create.mockClear();
  });

  it('system prompt does not reference userDraft', async () => {
    await generateNSMStep2Hint({ questionJson: { company: 'X' }, field: 'nsm' });
    const OpenAICtor = require('openai');
    const create = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1].value.chat.completions.create;
    const sys = create.mock.calls[0][0].messages[0].content;
    const usr = create.mock.calls[0][0].messages[1].content;
    expect(sys).not.toContain('userDraft');
    expect(sys).not.toContain('輸入品質檢查');
    expect(usr).not.toContain('學員當前草稿');
  });

  it('signature accepts only {questionJson, field}', async () => {
    // Function should not throw / not require userDraft to work
    await expect(generateNSMStep2Hint({ questionJson: { company: 'X' }, field: 'nsm' })).resolves.toBeDefined();
  });

  it('system prompt still requires bullet output', async () => {
    await generateNSMStep2Hint({ questionJson: { company: 'X' }, field: 'nsm' });
    const OpenAICtor = require('openai');
    const create = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1].value.chat.completions.create;
    const sys = create.mock.calls[0][0].messages[0].content;
    expect(sys).toMatch(/巢狀 markdown bullets|「- 」/);
  });
});

describe('nsm-step3-hint — question-only (Stage 1D)', () => {
  beforeEach(() => {
    const OpenAICtor = require('openai');
    const mockInstance = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1];
    if (mockInstance && mockInstance.value) mockInstance.value.chat.completions.create.mockClear();
  });

  it('system prompt does not reference userDraft', async () => {
    await generateNSMStep3Hint({ questionJson: { company: 'X' }, dimId: 'reach', dimType: 'attention' });
    const OpenAICtor = require('openai');
    const create = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1].value.chat.completions.create;
    const sys = create.mock.calls[0][0].messages[0].content;
    const usr = create.mock.calls[0][0].messages[1].content;
    expect(sys).not.toContain('userDraft');
    expect(sys).not.toContain('輸入品質檢查');
    expect(usr).not.toContain('學員當前草稿');
  });

  it('signature accepts {questionJson, dimId, dimType} only', async () => {
    await expect(generateNSMStep3Hint({ questionJson: { company: 'X' }, dimId: 'depth', dimType: 'saas' })).resolves.toBeDefined();
  });

  it('system prompt still requires bullet output', async () => {
    await generateNSMStep3Hint({ questionJson: { company: 'X' }, dimId: 'reach', dimType: 'attention' });
    const OpenAICtor = require('openai');
    const create = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1].value.chat.completions.create;
    const sys = create.mock.calls[0][0].messages[0].content;
    expect(sys).toMatch(/巢狀 markdown bullets|「- 」/);
  });
});

describe('circles-hint — markdown bullet output (Stage 1D)', () => {
  beforeEach(() => {
    const OpenAICtor = require('openai');
    const mockInstance = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1];
    if (mockInstance && mockInstance.value) mockInstance.value.chat.completions.create.mockClear();
  });

  it('system prompt requires nested bullet format', async () => {
    await generateCirclesHint({ step: 'C1', field: '問題範圍', questionJson: { company: 'Spotify', problem_statement: 'x' } });
    const OpenAICtor = require('openai');
    const create = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1].value.chat.completions.create;
    const sys = create.mock.calls[0][0].messages[0].content;
    expect(sys).toMatch(/巢狀 markdown bullets|「- 」/);
    expect(sys).not.toContain('行與行之間用單一換行符號分隔');
    expect(sys).not.toContain('不要列點符號');
  });

  it('system prompt removes paragraph contract', async () => {
    await generateCirclesHint({ step: 'C1', field: '問題範圍', questionJson: { company: 'Spotify', problem_statement: 'x' } });
    const OpenAICtor = require('openai');
    const create = OpenAICtor.mock.results[OpenAICtor.mock.results.length - 1].value.chat.completions.create;
    const sys = create.mock.calls[0][0].messages[0].content;
    expect(sys).not.toMatch(/3-4 個短行|每行 1 句、≤30 字/);
  });

  it('returned text starts with bullet marker', async () => {
    const result = await generateCirclesHint({ step: 'C1', field: '問題範圍', questionJson: { company: 'Spotify', problem_statement: 'x' } });
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^- /);
  });
});
