// TDD: Tests written before implementation
// RED phase: these tests must fail before circles-evaluator.js exists

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

const OpenAI = require('openai');

const { evaluateCirclesStep, STEP_RUBRICS } = require('../prompts/circles-evaluator');

// ── STEP_RUBRICS ──────────────────────────────────────────────────────────────

describe('STEP_RUBRICS', () => {
  test('all 7 step keys exist', () => {
    const keys = Object.keys(STEP_RUBRICS);
    expect(keys).toEqual(expect.arrayContaining(['C1', 'I', 'R', 'C2', 'L', 'E', 'S']));
    expect(keys).toHaveLength(7);
  });

  test('each step has a name string', () => {
    for (const [key, val] of Object.entries(STEP_RUBRICS)) {
      expect(typeof val.name).toBe('string');
      expect(val.name.length).toBeGreaterThan(0);
    }
  });

  test('each step has dimensions array with 4 items', () => {
    for (const [key, val] of Object.entries(STEP_RUBRICS)) {
      expect(Array.isArray(val.dimensions)).toBe(true);
      expect(val.dimensions).toHaveLength(4);
    }
  });

  test('C1 has correct name 澄清情境', () => {
    expect(STEP_RUBRICS.C1.name).toBe('澄清情境');
  });

  test('C1 has the 4 correct dimensions', () => {
    expect(STEP_RUBRICS.C1.dimensions).toEqual([
      '問題邊界清晰度',
      '業務影響連結',
      '時間範圍合理性',
      '假設排除完整性',
    ]);
  });
});

// ── evaluateCirclesStep — input validation ────────────────────────────────────

describe('evaluateCirclesStep — unknown step guard', () => {
  test('unknown step throws error before calling OpenAI', async () => {
    await expect(
      evaluateCirclesStep({
        step: 'INVALID',
        frameworkDraft: {},
        conversation: [],
        questionJson: { problem_statement: 'test', company: 'TestCo' },
        mode: 'drill',
      })
    ).rejects.toThrow('Unknown step: INVALID');

    // OpenAI should never be called
    const mockCreate = new OpenAI().chat.completions.create;
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ── evaluateCirclesStep — OpenAI call parameters ──────────────────────────────

describe('evaluateCirclesStep — OpenAI call', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeMockResponse(payload = {}) {
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              dimensions: [],
              totalScore: 80,
              highlight: '清晰',
              improvement: '需補充',
              coachVersion: '提示',
              ...payload,
            }),
          },
        },
      ],
    };
  }

  test('calls OpenAI with model gpt-4o, temperature 0.3, max_tokens 800', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await evaluateCirclesStep({
      step: 'C1',
      frameworkDraft: { 聚焦問題: '提升留存率' },
      conversation: [],
      questionJson: { problem_statement: '如何提升用戶留存率？', company: 'TestCo' },
      mode: 'drill',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.model).toBe('gpt-4o');
    expect(callArg.temperature).toBe(0.3);
    expect(callArg.max_tokens).toBe(800);
  });

  test('calls OpenAI with response_format json_object', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await evaluateCirclesStep({
      step: 'C1',
      frameworkDraft: {},
      conversation: [],
      questionJson: { problem_statement: 'test', company: 'TestCo' },
      mode: 'drill',
    });

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.response_format).toEqual({ type: 'json_object' });
  });

  test('returns parsed JSON from OpenAI response', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    const expected = {
      dimensions: [{ name: '問題邊界清晰度', score: 4, comment: '邊界清楚' }],
      totalScore: 80,
      highlight: '清晰',
      improvement: '補充更多',
      coachVersion: '提示內容',
    };
    mockCreate.mockResolvedValue(makeMockResponse(expected));

    const result = await evaluateCirclesStep({
      step: 'C1',
      frameworkDraft: {},
      conversation: [],
      questionJson: { problem_statement: 'test', company: 'TestCo' },
      mode: 'drill',
    });

    expect(result.totalScore).toBe(80);
    expect(result.highlight).toBe('清晰');
    expect(result.improvement).toBe('補充更多');
  });

  test('OpenAI errors propagate naturally (no try/catch)', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockRejectedValue(new Error('network failure'));

    await expect(
      evaluateCirclesStep({
        step: 'C1',
        frameworkDraft: {},
        conversation: [],
        questionJson: { problem_statement: 'test', company: 'TestCo' },
        mode: 'drill',
      })
    ).rejects.toThrow('network failure');
  });
});

// ── evaluateCirclesStep — mode handling ───────────────────────────────────────

describe('evaluateCirclesStep — simulation vs drill mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeMockResponse() {
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              dimensions: [],
              totalScore: 80,
              highlight: '清晰',
              improvement: '需補充',
              coachVersion: '提示',
            }),
          },
        },
      ],
    };
  }

  test('simulation mode includes 完整示範答案 in system prompt', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await evaluateCirclesStep({
      step: 'C1',
      frameworkDraft: {},
      conversation: [],
      questionJson: { problem_statement: 'test', company: 'TestCo' },
      mode: 'simulation',
    });

    const messages = mockCreate.mock.calls[0][0].messages;
    const systemContent = messages.find(m => m.role === 'system').content;
    expect(systemContent).toContain('完整示範答案');
  });

  test('drill mode includes 簡短提示 in system prompt', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await evaluateCirclesStep({
      step: 'C1',
      frameworkDraft: {},
      conversation: [],
      questionJson: { problem_statement: 'test', company: 'TestCo' },
      mode: 'drill',
    });

    const messages = mockCreate.mock.calls[0][0].messages;
    const systemContent = messages.find(m => m.role === 'system').content;
    expect(systemContent).toContain('簡短提示');
  });
});

// ── evaluateCirclesStep — coachAnswer handling ────────────────────────────────

describe('evaluateCirclesStep — coachAnswer from questionJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeMockResponse() {
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              dimensions: [],
              totalScore: 60,
              highlight: '不錯',
              improvement: '加強',
              coachVersion: '提示',
            }),
          },
        },
      ],
    };
  }

  test('coachAnswer is pulled from questionJson.coach_circles[step] when present', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await evaluateCirclesStep({
      step: 'C1',
      frameworkDraft: {},
      conversation: [],
      questionJson: {
        problem_statement: 'test',
        company: 'TestCo',
        coach_circles: { C1: '這是C1的標準答案' },
      },
      mode: 'drill',
    });

    const messages = mockCreate.mock.calls[0][0].messages;
    const systemContent = messages.find(m => m.role === 'system').content;
    expect(systemContent).toContain('這是C1的標準答案');
  });

  test('coachAnswer falls back to empty string when coach_circles missing', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    // No coach_circles in questionJson — should not throw
    await expect(
      evaluateCirclesStep({
        step: 'C1',
        frameworkDraft: {},
        conversation: [],
        questionJson: { problem_statement: 'test', company: 'TestCo' },
        mode: 'drill',
      })
    ).resolves.toBeDefined();
  });

  test('coachAnswer falls back to empty string when step key missing in coach_circles', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await expect(
      evaluateCirclesStep({
        step: 'C1',
        frameworkDraft: {},
        conversation: [],
        questionJson: {
          problem_statement: 'test',
          company: 'TestCo',
          coach_circles: { I: '定義用戶答案' }, // C1 not present
        },
        mode: 'drill',
      })
    ).resolves.toBeDefined();
  });
});

// ── evaluateCirclesStep — conversation formatting ─────────────────────────────

describe('evaluateCirclesStep — conversation formatting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeMockResponse() {
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              dimensions: [],
              totalScore: 70,
              highlight: '好',
              improvement: '改進',
              coachVersion: '提示',
            }),
          },
        },
      ],
    };
  }

  test('empty conversation does not crash and produces empty convText', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await expect(
      evaluateCirclesStep({
        step: 'C1',
        frameworkDraft: {},
        conversation: [],
        questionJson: { problem_statement: 'test', company: 'TestCo' },
        mode: 'drill',
      })
    ).resolves.toBeDefined();

    const messages = mockCreate.mock.calls[0][0].messages;
    const userContent = messages.find(m => m.role === 'user').content;
    expect(userContent).toContain('對話記錄：\n');
  });

  test('null conversation does not crash', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await expect(
      evaluateCirclesStep({
        step: 'C1',
        frameworkDraft: {},
        conversation: null,
        questionJson: { problem_statement: 'test', company: 'TestCo' },
        mode: 'drill',
      })
    ).resolves.toBeDefined();
  });

  test('conversation turns formatted as 學員:...\\n教練:...', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(makeMockResponse());

    await evaluateCirclesStep({
      step: 'C1',
      frameworkDraft: {},
      conversation: [
        { userMessage: '你好', interviewee: '你好，有什麼問題？' },
        { userMessage: '請問範圍？', interviewee: '範圍是全球' },
      ],
      questionJson: { problem_statement: 'test', company: 'TestCo' },
      mode: 'drill',
    });

    const messages = mockCreate.mock.calls[0][0].messages;
    const userContent = messages.find(m => m.role === 'user').content;
    expect(userContent).toContain('學員：你好\n教練：你好，有什麼問題？');
    expect(userContent).toContain('學員：請問範圍？\n教練：範圍是全球');
  });
});
