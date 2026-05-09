// TDD: Test written before implementation
// RED phase: this test must fail before prompts/nsm-step2-hint.js exists

const { generateNSMStep2Hint } = require('../prompts/nsm-step2-hint');

describe('generateNSMStep2Hint', () => {
  it('exports an async function', () => {
    expect(typeof generateNSMStep2Hint).toBe('function');
  });

  it('returns markdown bullet hint string ≤ 320 chars for valid input', async () => {
    const result = await generateNSMStep2Hint({
      questionJson: { id: 'q1', company: 'Netflix', industry: '訂閱', scenario: '影音串流平台競爭激烈，需確保用戶持續感受到內容價值' },
      field: 'nsm',
      userDraft: '訂閱用戶每月觀看 ≥ 1 集完整內容',
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeLessThanOrEqual(320);
    expect(result.length).toBeGreaterThan(20);
  }, 30000);

  it('handles empty userDraft without crashing', async () => {
    const result = await generateNSMStep2Hint({
      questionJson: { id: 'q1', company: 'Netflix', industry: '訂閱', scenario: 'some scenario' },
      field: 'explanation',
      userDraft: '',
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeLessThanOrEqual(320);
  }, 30000);
});
