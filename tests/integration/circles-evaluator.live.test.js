// SP3 — live-API integration test for evaluator coachVersion structured schema.
//
// Isolated in its own file (NOT in tests/circles-evaluator.test.js) because
// `jest.unmock('openai')` would leak to other tests in the same Jest worker:
// any future test added below the unmock would silently call the real API.
//
// Gated on OPENAI_API_KEY — skipped in CI / dev when no key is available.
// Run via the standard `npx jest` invocation; jest config picks this up via
// the testMatch under `tests/**`.

const SHOULD_RUN = !!process.env.OPENAI_API_KEY;
const maybe = SHOULD_RUN ? describe : describe.skip;

maybe('SP3 (live) — coachVersion is structured object', () => {
  it('returns coachVersion with context / perField / reasoning', async () => {
    // No mock at all in this file → require pulls the real openai module.
    const { evaluateCirclesStep } = require('../../prompts/circles-evaluator');
    const result = await evaluateCirclesStep({
      step: 'C1',
      isSimulation: false,
      questionJson: {
        company: 'Spotify',
        product: 'Spotify Podcast',
        problem_statement: '提升 Podcast 體驗',
        coach_circles: { C1: '練習釐清題目邊界...' },
      },
      frameworkDraft: {
        '問題範圍': '聚焦 Podcast 用戶留存',
        '時間範圍': '1 季',
        '業務影響': '增加日均收聽時長',
        '假設確認': '',
      },
      conversation: [],
    });
    expect(result.coachVersion).toBeDefined();
    expect(typeof result.coachVersion).toBe('object');
    expect(typeof result.coachVersion.context).toBe('string');
    expect(Array.isArray(result.coachVersion.perField)).toBe(true);
    expect(result.coachVersion.perField.length).toBeGreaterThan(0);
    expect(typeof result.coachVersion.reasoning).toBe('string');
    expect(result.coachVersion.context.length).toBeGreaterThan(20);
    expect(result.coachVersion.reasoning.length).toBeGreaterThan(20);
  }, 30000);
});
