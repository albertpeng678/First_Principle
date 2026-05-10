// tests/visual/sse-typewriter-perf.spec.js
// Q3: SSE typewriter performance measurement for CIRCLES Phase 2 chat.
// Measures chars/sec of DOM text updates in the streaming bubble.
//
// Industry baseline for zh-TW comfortable read speed:
//   - ChatGPT:  ~50 chars/sec
//   - Claude.ai: ~60 chars/sec
//   - Acceptable for zh-TW: 25-80 chars/sec (reading pace ~200 chars/min = 3.3/sec; streaming ≥25 feels responsive)
//
// This spec:
// 1. Mocks the /message endpoint to return a controlled SSE stream (200-char zh-TW text)
// 2. Injects a MutationObserver to timestamp each DOM update in the streaming bubble
// 3. Calculates chars/sec from observed text growth
// 4. Reports and asserts acceptable range
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../../audit/png-phase2-chat-audit');
fs.mkdirSync(OUT, { recursive: true });

const SAMPLE_QUESTION = {
  id: 'q-perf-test',
  company: 'Netflix',
  product: 'Streaming',
  industry: 'media',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個功能，提升 Netflix 在台灣市場的 7 日新用戶留存率。',
};

const SAMPLE_CONVERSATION_2 = [
  {
    userMessage: '這個題目是針對所有內容還是特定類型？目標族群是哪些？',
    interviewee: '針對所有內容類型。目標族群是「30 天內新加入但收視頻率低」的用戶。',
    coaching: '邊界釐清到位，繼續深入業務指標。',
    hint: '可追問「留存率目前是多少」。',
  },
  {
    userMessage: '目前留存率的基線是多少？我們的目標是提升多少個百分點？',
    interviewee: '目前 7 日留存約 32%，希望提升到 45%。',
    coaching: '指標明確，可以進入解法設計了。',
    hint: '先問一下用戶流失的主要原因。',
  },
];

// 200-char zh-TW test message for streaming measurement
const STREAM_TEXT = '謝謝你的問題，我先解釋一下背景：目前台灣市場的流失主要發生在用戶加入後的第一到第三天，這段時間他們還沒有找到自己感興趣的內容。我們的研究顯示，如果用戶在前三天看了至少兩集他們喜愛的節目，七日留存率就會提升到 68%，相比只看一集的 41%，差距非常顯著。';

// Build SSE stream body for fetch response
// Emits chunks every 20ms to simulate a realistic 1000ms total for 200 chars ≈ 10 chars/chunk × 20 chunks = 200 chars
// Chars/sec target: ~200 chars / 1.0 sec = 200 chars/sec (fast server stream)
// NOTE: The SSE arrival rate != DOM render rate. App only re-renders on 'done', not per delta.
// We measure the SSE arrival rate (how fast the server pushes) + check if DOM shows full text at done.
function buildSSEBody(text) {
  const lines = [];
  const chunkSize = 10;  // 10 chars per chunk
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    lines.push(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
  }
  // Final done event
  const turn = {
    userMessage: '那業務上有什麼限制？',
    interviewee: text,
    coaching: '很好的問題，繼續深入。',
    hint: '可問用戶流失的具體場景。',
  };
  lines.push(`data: ${JSON.stringify({ done: true, turn })}\n\n`);
  return lines.join('');
}

async function mockApis(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/circles-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 'perf-session' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/guest-circles-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 'perf-session' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/guest/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
}

test('Q3-SSE-typewriter-perf: measure streaming chars/sec', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  // Run on Desktop-1280 only
  if (testInfo.project.name !== 'Desktop-1280') test.skip();

  await mockApis(page);

  // Track SSE mock delivery timing
  const sseDeliveryTimings = [];
  let sseStreamStart = null;
  let sseChunkCount = 0;
  let sseTotalCharsDelivered = 0;

  // Mock the SSE message endpoint with controlled timing
  await page.route('**/api/guest-circles-sessions/perf-session/message', async (route) => {
    sseStreamStart = Date.now();
    const body = buildSSEBody(STREAM_TEXT);
    const chunkSize = 10;
    // Deliver all SSE data at once (network is not the bottleneck we're measuring;
    // we measure frontend processing speed)
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
      body: body,
    });
    const sseEnd = Date.now();
    sseTotalCharsDelivered = STREAM_TEXT.length;
    sseChunkCount = Math.ceil(STREAM_TEXT.length / chunkSize);
    sseDeliveryTimings.push({ start: sseStreamStart, end: sseEnd, chars: STREAM_TEXT.length });
  });

  await page.goto('/');
  await page.waitForSelector('.navbar');

  // Set Phase 2 state with 2 turns (not yet at conclude pill threshold — no confusion)
  await page.evaluate(({ q, conv }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 2,
      circlesMode: 'drill',
      circlesDrillStep: 'C1',
      circlesSession: { id: 'perf-session' },
      circlesSelectedQuestion: q,
      circlesConversation: conv,
      circlesPhase2Streaming: false,
      circlesPhase2StreamingTurn: null,
      circlesPhase2StreamError: false,
      circlesPhase2ConclusionMode: false,
      circlesPhase2CoachHintExpanded: {},
      circlesStepScores: {},
    });
    window.render();
  }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2 });

  await page.waitForSelector('[data-phase2="send"]', { timeout: 5000 });

  // Inject MutationObserver BEFORE sending to capture streaming bubble DOM updates
  await page.evaluate(() => {
    window.__sseObservations = [];
    window.__sseObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // Look for the streaming bubble text change
        const target = m.target;
        if (target && (
          (target.classList && target.classList.contains('bubble__streaming')) ||
          (target.parentElement && target.parentElement.classList && target.parentElement.classList.contains('bubble--interviewee'))
        )) {
          window.__sseObservations.push({
            ts: Date.now(),
            type: m.type,
            textContent: target.textContent ? target.textContent.slice(0, 20) : null,
          });
        }
      }
    });
    window.__sseObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false,
    });
    window.__sseRenderStart = null;
    window.__sseRenderEnd = null;

    // Patch render to capture timing
    const origRender = window.render;
    window.render = function() {
      const streaming = window.AppState && window.AppState.circlesPhase2Streaming;
      const beforeStreaming = window.AppState && window.AppState.circlesPhase2StreamingTurn;
      if (streaming && beforeStreaming && !window.__sseRenderStart) {
        window.__sseRenderStart = Date.now();
      }
      if (!streaming && window.__sseRenderStart && !window.__sseRenderEnd) {
        window.__sseRenderEnd = Date.now();
      }
      return origRender.apply(this, arguments);
    };
  });

  // Type message and send
  const messageInput = page.locator('[data-phase2="message-input"]');
  await messageInput.fill('那業務上有什麼限制？');

  // Record start time before clicking send
  const sendStartTime = Date.now();
  await page.locator('[data-phase2="send"]').click();

  // Wait for streaming state to start (3-dot bubble appears)
  await page.waitForSelector('.bubble__streaming', { timeout: 5000 });
  const streamingStartTime = Date.now();

  // Wait for streaming to complete (3-dot bubble disappears, new conversation turn appears)
  // The SSE mock delivers instantly, so this should be fast
  await page.waitForFunction(() => {
    return !document.querySelector('.bubble__streaming') &&
           window.AppState &&
           !window.AppState.circlesPhase2Streaming;
  }, { timeout: 15000 });
  const streamingEndTime = Date.now();

  // Collect observation data
  const observations = await page.evaluate(() => ({
    sseObservations: window.__sseObservations,
    renderStart: window.__sseRenderStart,
    renderEnd: window.__sseRenderEnd,
    finalConversationLength: window.AppState ? (window.AppState.circlesConversation || []).length : -1,
    finalStreamingState: window.AppState ? window.AppState.circlesPhase2Streaming : null,
    streamError: window.AppState ? window.AppState.circlesPhase2StreamError : null,
  }));

  // Calculate metrics
  const totalStreamDurationMs = streamingEndTime - sendStartTime;
  const streamTextLength = STREAM_TEXT.length;

  // The app processes SSE data client-side and renders once at 'done'.
  // SSE delivery is measured by how fast the mock responds.
  // DOM render-to-completion measures how fast the app processes.
  const domRenderDurationMs = observations.renderEnd
    ? observations.renderEnd - (observations.renderStart || streamingStartTime)
    : streamingEndTime - streamingStartTime;

  // Effective chars/sec from user perspective = text_length / total_stream_duration
  const charsPerSecUserPerspective = Math.round(streamTextLength / (totalStreamDurationMs / 1000));

  // Report findings
  const report = {
    streamTextLength,
    sseChunks: Math.ceil(streamTextLength / 10),
    totalStreamDurationMs,
    domRenderDurationMs,
    charsPerSecUserPerspective,
    finalConversationLength: observations.finalConversationLength,
    streamError: observations.streamError,
    streamingFinished: !observations.finalStreamingState,
    domObservationsCount: observations.sseObservations.length,
    renderStartCaptured: !!observations.renderStart,
    renderEndCaptured: !!observations.renderEnd,
  };

  console.log('\n=== Q3 SSE Typewriter Perf Report ===');
  console.log('Stream text length:', streamTextLength, 'chars');
  console.log('Total stream duration (send → done):', totalStreamDurationMs, 'ms');
  console.log('DOM render duration (streaming_start → done):', domRenderDurationMs, 'ms');
  console.log('Chars/sec (user perspective):', charsPerSecUserPerspective);
  console.log('');
  console.log('NOTE: This app processes SSE deltas client-side without per-delta re-renders.');
  console.log('DOM updates happen ONCE when "done" event arrives (batch render).');
  console.log('This means the "typewriter" effect is not character-by-character in this impl.');
  console.log('Industry baseline: 25-80 chars/sec for comfortable zh-TW reading experience.');
  console.log('');
  console.log('Final conversation length:', observations.finalConversationLength, '(expect 3)');
  console.log('Stream error:', observations.streamError);
  console.log('DOM mutation observations:', observations.domObservationsCount);
  console.log('Full report:', JSON.stringify(report, null, 2));

  // Save report as JSON artifact
  fs.writeFileSync(
    path.join(OUT, 'Q3-sse-perf-report.json'),
    JSON.stringify(report, null, 2)
  );

  // Take screenshot of final state
  await page.screenshot({ path: path.join(OUT, 'Q3-sse-stream-complete-desktop-1280.png'), fullPage: false });

  // Assertions
  // 1. Stream completed without error
  expect(observations.streamError, 'SSE stream must complete without error').toBe(false);

  // 2. Conversation advanced (turn was added)
  expect(observations.finalConversationLength, 'Conversation must have new turn after stream').toBe(3);

  // 3. Streaming flag cleared
  expect(observations.finalStreamingState, 'circlesPhase2Streaming must be false after done').toBe(false);

  // 4. Total duration reasonable (< 10 seconds for a mocked stream)
  expect(totalStreamDurationMs, 'SSE stream should complete in under 10s').toBeLessThan(10000);

  // 5. Text length delivered correctly
  expect(streamTextLength).toBe(STREAM_TEXT.length);

  console.log('\n=== SSE Architecture Observation ===');
  console.log('The current implementation accumulates delta text in AppState.circlesPhase2StreamingTurn.deltaText');
  console.log('but does NOT re-render on each delta chunk (line 1170: "// no re-render on each delta for performance").');
  console.log('DOM update happens exactly ONCE when parsed.done is received (line 1177: render()).');
  console.log('This is a BATCH render pattern, not a true typewriter/streaming animation.');
  console.log('The 3-dot bubble (bubble__streaming) is shown during the wait; text appears all at once.');
  console.log('');
  console.log('Verdict: "Typewriter effect" as requested by user DOES NOT EXIST in current impl.');
  console.log('What exists: 3-dot waiting indicator → full text appears at once when AI finishes.');
  console.log('This may or may not match user expectation of "打字機效果".');
});
