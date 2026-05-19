// tests/circles-gate-backoff.test.js
// Skills applied: Pitfall 14 (test-local timing counter, no module-level state)
//                 §3.9 api-testing (error response simulation via jest.mock OpenAI)
//                 §3.18 5x consecutive 0 flake (jest run × 5)
// Reference: nsm-gate.js retry backoff pattern (line 166: await new Promise(r => setTimeout(r, 800 * (attempt + 1))))
// Threshold: attempt 0→1 retry delay ≥ 800ms; attempt 1→2 retry delay ≥ 1600ms
// F-CT1.3: CIRCLES gate retry 無 backoff fix (tracker §3)

// ── Mock setup (Pitfall 14: test-local, no module-level shared state) ─────────

// We need to control the mock per-test, so we capture the mockCreate reference.
let mockCreate;

jest.mock('openai', () => {
  // The factory is called once; mockCreate is assigned below after jest.mock runs.
  // Use a stable factory that references a module-level var set before each test.
  const factory = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args) => mockCreate(...args),
      },
    },
  }));
  return factory;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAMPLE_FRAMEWORK_DRAFT = {
  '問題範圍': '針對 20-35 歲上班族，平均通勤時間 45 分鐘',
  '時間範圍': '本季 Q2 三個月內完成核心功能上線',
  '業務影響': '提升次月留存率 ≥ 70%，降低 churn 至 15% 以下',
  '假設確認': '假設目標用戶已有通勤 App 使用習慣，且願意付費訂閱',
};

const SAMPLE_QUESTION_JSON = {
  problem_statement: '如何提升通勤 App 的用戶留存率？',
  company: 'CommuteApp',
  common_wrong_directions: [],
};

const VALID_RESPONSE = {
  items: [
    { field: '問題範圍', status: 'ok', title: '範圍明確', reason: '年齡與通勤時間具體', suggestion: null },
    { field: '時間範圍', status: 'ok', title: '時程清晰', reason: '三個月 Q2 有明確邊界', suggestion: null },
    { field: '業務影響', status: 'ok', title: '指標量化', reason: '留存率與 churn 有數字', suggestion: null },
    { field: '假設確認', status: 'ok', title: '假設合理', reason: '付費習慣假設可驗證', suggestion: null },
  ],
  canProceed: true,
  overallStatus: 'ok',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('circles-gate retry backoff (F-CT1.3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('retry attempts have progressive backoff delay (800ms × attempt)', async () => {
    // Pitfall 14: attempt counter is local to this test, not module-level
    let callCount = 0;
    const attemptTimings = [];

    mockCreate = jest.fn().mockImplementation(() => {
      const now = Date.now();
      attemptTimings.push(now);
      callCount++;

      if (callCount < 3) {
        // Simulate 429-like failure for first 2 attempts
        throw new Error('Rate limit exceeded (429)');
      }
      // 3rd attempt succeeds
      return Promise.resolve({
        choices: [{ message: { content: JSON.stringify(VALID_RESPONSE) } }],
      });
    });

    // We need to run the promise and let fake timers advance in parallel.
    // Strategy: run reviewFramework, then advance timers for each expected delay.
    const { reviewFramework } = require('../prompts/circles-gate');

    let resolved = false;
    let result;
    const promise = reviewFramework({
      step: 'C1',
      frameworkDraft: SAMPLE_FRAMEWORK_DRAFT,
      questionJson: SAMPLE_QUESTION_JSON,
      mode: 'drill',
    }).then(r => {
      resolved = true;
      result = r;
    });

    // attempt=0 runs immediately — should throw, then enter catch with backoff
    // First backoff: 800 * (0 + 1) = 800ms
    // Advance past first backoff
    await Promise.resolve(); // flush microtasks so attempt 0 fails
    await Promise.resolve();

    jest.advanceTimersByTime(800);

    // attempt=1 should now run — throw again, backoff 800 * (1 + 1) = 1600ms
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(1600);

    // attempt=2 should now run — succeed
    await Promise.resolve();
    await Promise.resolve();
    await promise;

    expect(resolved).toBe(true);
    expect(callCount).toBe(3);
    expect(result.overallStatus).toBe('ok');
    expect(result.canProceed).toBe(true);

    // Verify timing gaps between attempts
    // attemptTimings[1] - attemptTimings[0] should be ≥ 800ms (fake timer advanced 800ms)
    // attemptTimings[2] - attemptTimings[1] should be ≥ 1600ms (fake timer advanced 1600ms)
    expect(attemptTimings).toHaveLength(3);
    expect(attemptTimings[1] - attemptTimings[0]).toBeGreaterThanOrEqual(800);
    expect(attemptTimings[2] - attemptTimings[1]).toBeGreaterThanOrEqual(1600);
  });

  test('no backoff on first attempt success (fast path unaffected)', async () => {
    // Verify the backoff is only in the catch path — success path stays fast
    let callCount = 0;
    mockCreate = jest.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        choices: [{ message: { content: JSON.stringify(VALID_RESPONSE) } }],
      });
    });

    const { reviewFramework } = require('../prompts/circles-gate');

    const result = await reviewFramework({
      step: 'C1',
      frameworkDraft: SAMPLE_FRAMEWORK_DRAFT,
      questionJson: SAMPLE_QUESTION_JSON,
      mode: 'drill',
    });

    expect(callCount).toBe(1);
    expect(result.overallStatus).toBe('ok');
  });

  test('throws after 3 consecutive failures (no infinite retry)', async () => {
    mockCreate = jest.fn().mockImplementation(() => {
      throw new Error('persistent 429');
    });

    const { reviewFramework } = require('../prompts/circles-gate');

    let resolved = false;
    let rejected = false;
    const promise = reviewFramework({
      step: 'C1',
      frameworkDraft: SAMPLE_FRAMEWORK_DRAFT,
      questionJson: SAMPLE_QUESTION_JSON,
      mode: 'drill',
    }).then(() => { resolved = true; }).catch(() => { rejected = true; });

    // flush attempt 0 failure + backoff 0
    await Promise.resolve(); await Promise.resolve();
    jest.advanceTimersByTime(800);

    // flush attempt 1 failure + backoff 1
    await Promise.resolve(); await Promise.resolve();
    jest.advanceTimersByTime(1600);

    // flush attempt 2 failure (throws — no more retries)
    await Promise.resolve(); await Promise.resolve();
    await promise;

    expect(resolved).toBe(false);
    expect(rejected).toBe(true);
  });
});
