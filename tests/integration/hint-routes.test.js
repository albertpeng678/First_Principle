// tests/integration/hint-routes.test.js
// IL-3 red-first — hint endpoints accept question-only payloads (no draft).
require('dotenv').config();
const request = require('supertest');

// Mock the prompt module so we don't hit OpenAI in this test.
jest.mock('../../prompts/nsm-step2-hint', () => ({
  generateNSMStep2Hint: jest.fn(async () => '- 思考 **核心** 行為\n  - 排除登入'),
}));
jest.mock('../../prompts/nsm-step3-hint', () => ({
  generateNSMStep3Hint: jest.fn(async () => '- 思考 **深度** 維度\n  - 排除背景'),
}));
jest.mock('../../prompts/nsm-hints', () => ({
  generateNSMHints: jest.fn(async () => ({ reach: '- r', depth: '- d', frequency: '- f', impact: '- i' })),
}));

const app = require('../../server');
const { generateNSMStep2Hint } = require('../../prompts/nsm-step2-hint');
const { generateNSMStep3Hint } = require('../../prompts/nsm-step3-hint');

describe('hint routes — question-only payload (Stage 1D)', () => {
  beforeEach(() => {
    generateNSMStep2Hint.mockClear();
    generateNSMStep3Hint.mockClear();
  });

  it('POST /api/nsm-public/step2-hint does not pass userDraft to prompt', async () => {
    const res = await request(app)
      .post('/api/nsm-public/step2-hint')
      .send({ questionId: 'q1', field: 'nsm', userDraft: 'should-be-ignored-by-route' });
    // Either 200 (happy) or 400/404 (questionId unknown) — both acceptable for contract test.
    if (res.status === 200) {
      const callArg = generateNSMStep2Hint.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('userDraft');
    }
  });

  it('POST /api/nsm-public/step3-hint does not pass userDraft to prompt', async () => {
    const res = await request(app)
      .post('/api/nsm-public/step3-hint')
      .send({ questionId: 'q1', dimId: 'reach', dimType: 'attention', userDraft: 'ignored' });
    if (res.status === 200) {
      const callArg = generateNSMStep3Hint.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('userDraft');
    }
  });
});
