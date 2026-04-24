// TDD: Test written before implementation
// RED phase: this test must fail before circles-coach.js exists

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

const { streamCirclesReply, buildSystemPrompt, buildMessages } = require('../prompts/circles-coach');

function makeSession(overrides = {}) {
  return {
    drill_step: 'C1',
    mode: 'drill',
    question_json: {
      problem_statement: '如何提升用戶留存率？',
      company: 'TestCo',
      hidden_context: '上季用戶流失 20%',
    },
    conversation: [],
    ...overrides,
  };
}

// ── exports ──────────────────────────────────────────────────────────────────

test('circles-coach exports streamCirclesReply function', () => {
  expect(typeof streamCirclesReply).toBe('function');
});

test('circles-coach exports buildSystemPrompt function', () => {
  expect(typeof buildSystemPrompt).toBe('function');
});

test('circles-coach exports buildMessages function', () => {
  expect(typeof buildMessages).toBe('function');
});

// ── buildSystemPrompt ─────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  test('drill mode includes drill-specific coaching instruction', () => {
    const prompt = buildSystemPrompt(makeSession({ mode: 'drill' }));
    expect(prompt).toContain('Drill 模式：可給具體引導');
  });

  test('simulation mode includes simulation-specific coaching instruction', () => {
    const prompt = buildSystemPrompt(makeSession({ mode: 'simulation' }));
    expect(prompt).toContain('Simulation 模式：只標方向錯誤，不給正確答案');
  });

  test('simulation mode hint is more vague', () => {
    const prompt = buildSystemPrompt(makeSession({ mode: 'simulation' }));
    expect(prompt).toContain('Simulation 模式：提示可以更模糊一些');
  });

  test('turnCount >= 3 adds submission hint', () => {
    const session = makeSession({
      conversation: [
        { userMessage: 'a' },
        { userMessage: 'b' },
        { userMessage: 'c' },
      ],
    });
    const prompt = buildSystemPrompt(session);
    expect(prompt).toContain('已進行多輪');
  });

  test('turnCount < 3 does not add submission hint', () => {
    const session = makeSession({ conversation: [{ userMessage: 'a' }] });
    const prompt = buildSystemPrompt(session);
    expect(prompt).not.toContain('已進行多輪');
  });

  test('hiddenCtx falls back to empty string when missing', () => {
    const session = makeSession();
    delete session.question_json.hidden_context;
    const prompt = buildSystemPrompt(session);
    // should not throw and hidden context line should have empty value
    expect(prompt).toContain('隱藏資訊（被訪談者知道但不主動說）：');
  });

  test('uses focus variable (with fallback) in 步驟 line', () => {
    const session = makeSession({ drill_step: 'C1' });
    const prompt = buildSystemPrompt(session);
    expect(prompt).toContain('步驟：C1（澄清問題邊界');
  });

  test('unknown step falls back gracefully to empty string', () => {
    const session = makeSession({ drill_step: 'UNKNOWN' });
    const prompt = buildSystemPrompt(session);
    expect(prompt).toContain('步驟：UNKNOWN（）');
  });

  test('throws on invalid mode', () => {
    const session = makeSession({ mode: 'invalid' });
    expect(() => buildSystemPrompt(session)).toThrow('Invalid mode: invalid');
  });
});

// ── buildMessages ─────────────────────────────────────────────────────────────

describe('buildMessages', () => {
  test('empty history returns only user message', () => {
    const msgs = buildMessages(makeSession({ conversation: [] }), 'Hello');
    expect(msgs).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  test('history is sliced to last 8 turns', () => {
    const conversation = Array.from({ length: 12 }, (_, i) => ({
      userMessage: `msg${i}`,
      interviewee: `int${i}`,
      coaching: `coach${i}`,
      hint: `hint${i}`,
    }));
    const msgs = buildMessages(makeSession({ conversation }), 'new');
    // 8 history turns × 2 messages each + 1 new = 17
    expect(msgs).toHaveLength(17);
    // first message in history should be from turn index 4 (last 8 of 12)
    expect(msgs[0].content).toBe('msg4');
  });

  test('reconstructs assistant message in correct format', () => {
    const session = makeSession({
      conversation: [
        { userMessage: '你好', interviewee: '我是受訪者', coaching: '點評', hint: '提示' },
      ],
    });
    const msgs = buildMessages(session, 'next');
    const assistantMsg = msgs[1];
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.content).toBe(
      '【被訪談者】\n我是受訪者\n\n【教練點評】\n點評\n\n【教練提示】\n提示'
    );
  });

  test('handles missing interviewee/coaching/hint with empty strings', () => {
    const session = makeSession({
      conversation: [{ userMessage: '問題' }],
    });
    const msgs = buildMessages(session, 'next');
    const assistantMsg = msgs[1];
    expect(assistantMsg.content).toBe(
      '【被訪談者】\n\n\n【教練點評】\n\n\n【教練提示】\n'
    );
  });
});

// ── streamCirclesReply error handling ────────────────────────────────────────

describe('streamCirclesReply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws user-friendly error when openai create fails', async () => {
    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockRejectedValue(new Error('network error'));

    const session = makeSession();
    const gen = streamCirclesReply(session, 'test');
    await expect(gen.next()).rejects.toThrow('AI 回覆串流失敗，請重試');
  });

  test('yields chunks from stream', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' World' } }] };
      yield { choices: [{ delta: {} }] }; // empty delta, should be skipped
    }

    const mockCreate = new OpenAI().chat.completions.create;
    mockCreate.mockResolvedValue(fakeStream());

    const session = makeSession();
    const results = [];
    for await (const chunk of streamCirclesReply(session, 'test')) {
      results.push(chunk);
    }
    expect(results).toEqual(['Hello', ' World']);
  });
});
