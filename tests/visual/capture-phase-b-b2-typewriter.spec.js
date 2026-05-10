// capture-phase-b-b2-typewriter.spec.js
// Captures 3 PNGs of the Phase 2 typewriter mid-stream state (mockup 05 §G LOCKED).
// Output: audit/png-phase-b/B2-typewriter-{mobile,tablet,desktop}.png
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../../audit/png-phase-b');

const SAMPLE_QUESTION = {
  id: 'q-typewriter-capture',
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

// Mid-stream snapshot: simulate ~50 chars of a 100-char response displayed
const PARTIAL_TEXT = '謝謝你的問題，我先解釋一下背景：目前台灣市場的流失主要發生在用戶加入後的第一到第三天';
const FULL_DELTA_TEXT = PARTIAL_TEXT + '，這段時間他們還沒有找到自己感興趣的內容，研究顯示前三天看完兩集後留存率提升顯著。';

async function mockApis(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/circles-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 'cap-session' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/guest-circles-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 'cap-session' }) });
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

async function captureTypewriterState(page, vpLabel) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');

  // Inject mid-stream state directly (half of full text displayed)
  await page.evaluate(({ q, conv, partial, full }) => {
    Object.assign(window.AppState, {
      view: 'circles', circlesPhase: 2, circlesMode: 'drill', circlesDrillStep: 'C1',
      circlesSession: { id: 'cap-session' }, circlesSelectedQuestion: q, circlesConversation: conv,
      circlesPhase2Streaming: true,
      circlesPhase2StreamingTurn: {
        userMessage: '那業務上有什麼限制？例如不能改首頁？',
        deltaText: full,
        displayedChars: partial.length,
        isDone: false,
      },
      circlesPhase2StreamError: false, circlesPhase2ConclusionMode: false,
      circlesPhase2CoachHintExpanded: {}, circlesStepScores: {},
    });
    window.render();
  }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2, partial: PARTIAL_TEXT, full: FULL_DELTA_TEXT });

  await page.waitForSelector('.bubble-coach__cursor', { timeout: 5000 });
  // Scroll the streaming bubble into view
  await page.locator('.bubble-coach__cursor').last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300); // let animation settle

  const out = path.join(OUT, 'B2-typewriter-' + vpLabel + '.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('Captured:', out);
}

test.describe.configure({ mode: 'parallel' });

test('B2 typewriter capture — mobile', async ({ page }, testInfo) => {
  test.setTimeout(30000);
  if (testInfo.project.name !== 'Mobile-360') test.skip();
  fs.mkdirSync(OUT, { recursive: true });
  await captureTypewriterState(page, 'mobile');
});

test('B2 typewriter capture — tablet', async ({ page }, testInfo) => {
  test.setTimeout(30000);
  if (testInfo.project.name !== 'iPad') test.skip();
  fs.mkdirSync(OUT, { recursive: true });
  await captureTypewriterState(page, 'tablet');
});

test('B2 typewriter capture — desktop', async ({ page }, testInfo) => {
  test.setTimeout(30000);
  if (testInfo.project.name !== 'Desktop-1280') test.skip();
  fs.mkdirSync(OUT, { recursive: true });
  await captureTypewriterState(page, 'desktop');
});
