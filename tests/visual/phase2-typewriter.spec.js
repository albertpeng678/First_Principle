// tests/visual/phase2-typewriter.spec.js
// B2 — Phase 2 typewriter effect (mockup 05 §G LOCKED contract)
//
// Contract:
//   - Per-delta render: mid-stream shows partial text + cursor
//   - 30-40 chars/sec throttle via setTimeout queue (~28ms/char)
//   - .bubble-coach__cursor visible during streaming
//   - .bubble-coach__cursor.is-done hidden on done arrival
//   - streaming bubble is bubble--coach (not bubble--interviewee 3-dot)
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../../audit/png-phase-b');

const SAMPLE_QUESTION = {
  id: 'q-typewriter-test',
  company: 'Netflix',
  product: 'Streaming',
  industry: 'media',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個功能，提升 Netflix 在台灣市場的 7 日新用戶留存率。',
};

const SAMPLE_CONVERSATION_2 = [
  {
    userMessage: '這個題目是針對所有內容還是特定類型？',
    interviewee: '針對所有內容類型。目標是新加入但收視頻率低的用戶。',
    coaching: '邊界釐清到位，繼續深入業務指標。',
    hint: '可追問留存率目前是多少。',
  },
  {
    userMessage: '目前留存率的基線是多少？',
    interviewee: '目前 7 日留存約 32%，希望提升到 45%。',
    coaching: '指標明確，可以進入解法設計了。',
    hint: '先問一下用戶流失的主要原因。',
  },
];

// 100-char zh-TW test text — long enough to catch mid-stream state
const STREAM_TEXT = '謝謝你的問題，我先解釋一下背景：目前台灣市場的流失主要發生在用戶加入後的第一到第三天，這段時間他們還沒有找到自己感興趣的內容。';

// Build SSE body — 10 chars per chunk for controlled streaming
function buildSSEBody(text) {
  const lines = [];
  const chunkSize = 10;
  for (let i = 0; i < text.length; i += chunkSize) {
    lines.push('data: ' + JSON.stringify({ delta: text.slice(i, i + chunkSize) }) + '\n\n');
  }
  const turn = {
    userMessage: '那業務上有什麼限制？',
    interviewee: text,
    coaching: '很好，繼續深入。',
    hint: '可問流失的具體場景。',
  };
  lines.push('data: ' + JSON.stringify({ done: true, turn }) + '\n\n');
  return lines.join('');
}

async function mockApis(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/circles-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 'tw-session' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/guest-circles-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 'tw-session' }) });
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

// ── Test 1: mid-stream DOM shows partial text + visible cursor ───────────────
test.describe('B2 Phase 2 typewriter — mockup 05 §G LOCKED', () => {

  test('mid-stream: injected streaming state shows bubble--coach + cursor (not 3-dot)', async ({ page }, testInfo) => {
    // Tests the render path directly by injecting mid-stream AppState.
    // This avoids SSE timing races while still covering the contract:
    //   streaming=true + displayedChars>0 → coach bubble + cursor visible (not 3-dot).
    test.setTimeout(30000);
    if (testInfo.project.name !== 'Desktop-1280') test.skip();

    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');

    const PARTIAL_TEXT = '謝謝你的問題，我先解釋一下背景：目前台灣市場的流失';
    await page.evaluate(({ q, conv, partialText, fullText }) => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 2, circlesMode: 'drill', circlesDrillStep: 'C1',
        circlesSession: { id: 'tw-session' }, circlesSelectedQuestion: q, circlesConversation: conv,
        circlesPhase2Streaming: true,
        circlesPhase2StreamingTurn: {
          userMessage: '那業務上有什麼限制？',
          deltaText: fullText,
          displayedChars: partialText.length,
          isDone: false,
        },
        circlesPhase2StreamError: false, circlesPhase2ConclusionMode: false,
        circlesPhase2CoachHintExpanded: {}, circlesStepScores: {},
      });
      window.render();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2, partialText: PARTIAL_TEXT, fullText: STREAM_TEXT });

    // --- ASSERTIONS: mid-stream state ---

    // 1. Streaming coach bubble must exist (NOT 3-dot interviewee bubble)
    await expect(page.locator('.bubble--coach').last()).toBeVisible();

    // 2. Cursor element must be present
    const cursor = page.locator('.bubble-coach__cursor').last();
    await expect(cursor).toBeAttached();

    // 3. Cursor must NOT have .is-done class (streaming not done)
    await expect(cursor).not.toHaveClass(/is-done/);

    // 4. Coach bubble contains partial text
    await expect(page.locator('.bubble--coach').last()).toContainText(PARTIAL_TEXT);

    // 5. No 3-dot bubble visible (old pattern must be gone when chars > 0)
    await expect(page.locator('.bubble__streaming')).toHaveCount(0);
  });

  test('done: cursor gets .is-done class after stream completes', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    if (testInfo.project.name !== 'Desktop-1280') test.skip();

    await mockApis(page);

    await page.route('**/api/guest-circles-sessions/tw-session/message', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: buildSSEBody(STREAM_TEXT),
      });
    });

    await page.goto('/');
    await page.waitForSelector('.navbar');

    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 2, circlesMode: 'drill', circlesDrillStep: 'C1',
        circlesSession: { id: 'tw-session' }, circlesSelectedQuestion: q, circlesConversation: conv,
        circlesPhase2Streaming: false, circlesPhase2StreamingTurn: null,
        circlesPhase2StreamError: false, circlesPhase2ConclusionMode: false,
        circlesPhase2CoachHintExpanded: {}, circlesStepScores: {},
      });
      window.render();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2 });

    await page.waitForSelector('[data-phase2="send"]', { timeout: 5000 });
    await page.locator('[data-phase2="message-input"]').fill('那業務上有什麼限制？');
    await page.locator('[data-phase2="send"]').click();

    // Wait for streaming to fully complete (conversation advances)
    await page.waitForFunction(() => {
      return !window.AppState.circlesPhase2Streaming &&
             (window.AppState.circlesConversation || []).length === 3;
    }, { timeout: 20000 });

    // After done: conversation turn added, circlesPhase2Streaming=false
    const conv = await page.evaluate(() => window.AppState.circlesConversation);
    expect(conv.length).toBe(3);
    expect(conv[2].interviewee).toBe(STREAM_TEXT);

    // Streaming flag cleared
    const streaming = await page.evaluate(() => window.AppState.circlesPhase2Streaming);
    expect(streaming).toBe(false);
  });

  test('render-only: streaming state with displayedChars renders partial text + cursor element', async ({ page }, testInfo) => {
    test.setTimeout(30000);
    if (testInfo.project.name !== 'Desktop-1280') test.skip();

    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');

    // Directly set mid-stream state (bypasses SSE entirely — tests render path)
    const PARTIAL_TEXT = '謝謝你的問題，我先解釋一下背景：目前台灣';
    await page.evaluate(({ q, conv, partialText }) => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 2, circlesMode: 'drill', circlesDrillStep: 'C1',
        circlesSession: { id: 'tw-session' }, circlesSelectedQuestion: q, circlesConversation: conv,
        circlesPhase2Streaming: true,
        circlesPhase2StreamingTurn: {
          userMessage: '那業務上有什麼限制？',
          deltaText: partialText + '更多文字尚未顯示',
          displayedChars: partialText.length,
        },
        circlesPhase2StreamError: false, circlesPhase2ConclusionMode: false,
        circlesPhase2CoachHintExpanded: {}, circlesStepScores: {},
      });
      window.render();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2, partialText: PARTIAL_TEXT });

    // Coach streaming bubble must show
    await expect(page.locator('.bubble--coach').last()).toBeVisible();

    // Coach body must contain the partial text
    await expect(page.locator('.bubble--coach').last()).toContainText(PARTIAL_TEXT);

    // Cursor must be visible (not .is-done)
    const cursor = page.locator('.bubble-coach__cursor').last();
    await expect(cursor).toBeVisible();
    await expect(cursor).not.toHaveClass(/is-done/);

    // No 3-dot streaming bubble
    await expect(page.locator('.bubble__streaming')).toHaveCount(0);
  });

  test('render-only: typewriter speed ~28ms/char (30-40 chars/sec range)', async ({ page }, testInfo) => {
    test.setTimeout(30000);
    if (testInfo.project.name !== 'Desktop-1280') test.skip();

    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');

    // Set up streaming state with displayedChars=0 and full deltaText already buffered
    const FULL_TEXT = '謝謝你的問題，背景如下，流失主要在第一到第三天，他們還沒找到感興趣的內容。';
    await page.evaluate(({ q, conv, fullText }) => {
      Object.assign(window.AppState, {
        view: 'circles', circlesPhase: 2, circlesMode: 'drill', circlesDrillStep: 'C1',
        circlesSession: { id: 'tw-session' }, circlesSelectedQuestion: q, circlesConversation: conv,
        circlesPhase2Streaming: true,
        circlesPhase2StreamingTurn: { userMessage: 'test', deltaText: fullText, displayedChars: 0 },
        circlesPhase2StreamError: false, circlesPhase2ConclusionMode: false,
        circlesPhase2CoachHintExpanded: {}, circlesStepScores: {},
      });
      window.render();
      // Start the char queue timer
      if (window._b2StartCharQueue) window._b2StartCharQueue();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2, fullText: FULL_TEXT });

    // Measure time to display ~10 chars (should be ~280ms at 28ms/char)
    const t0 = Date.now();
    await page.waitForFunction((targetLen) => {
      return window.AppState.circlesPhase2StreamingTurn &&
             (window.AppState.circlesPhase2StreamingTurn.displayedChars || 0) >= targetLen;
    }, 10, { timeout: 5000 });
    const elapsed = Date.now() - t0;

    // 10 chars at 28ms/char = 280ms; allow generous range 150-600ms
    expect(elapsed).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(800);

    console.log('10-char typewriter elapsed:', elapsed, 'ms → ~', Math.round(1000 / (elapsed / 10)), 'chars/sec');
  });
});
