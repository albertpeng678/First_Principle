// tests/unit/prompts-question-only.test.js
// IL-3 red-first unit specs — prompt string-shape verification (no network).
const OpenAI = require('openai');

jest.mock('openai', () => {
  const create = jest.fn(async () => ({ choices: [{ message: { content: '{"reach":"- a","depth":"- b","frequency":"- c","impact":"- d"}' } }] }));
  return jest.fn().mockImplementation(() => ({ chat: { completions: { create } } }));
});

const { generateNSMHints } = require('../../prompts/nsm-hints');

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
