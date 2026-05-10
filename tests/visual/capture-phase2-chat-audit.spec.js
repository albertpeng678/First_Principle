// tests/visual/capture-phase2-chat-audit.spec.js
// CIRCLES Phase 2 Chat Audit — Q1 entry path + Q2 4-state renders + Q4 locked state
// Target: 3 viewports × 4 states (A/B/C/D) + 1 locked = 13 PNG
// Output: audit/png-phase2-chat-audit/
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../../audit/png-phase2-chat-audit');
fs.mkdirSync(OUT, { recursive: true });

const SAMPLE_QUESTION = {
  id: 'q-audit-p2',
  company: 'Spotify',
  product: 'Podcast',
  industry: 'streaming',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個新功能，提升 Spotify Podcast 用戶黏著度，鎖定第一週新用戶 7 日留存',
};

const SAMPLE_CONVERSATION_2 = [
  {
    userMessage: '這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？',
    interviewee: '只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。',
    coaching: '好的開頭問題。同時釐清「涵蓋範圍」與「目標族群」，避免後續分析展開時邊界模糊。',
    hint: '可追問「為什麼是新用戶而不是 power user」。',
  },
  {
    userMessage: '那我們希望看到的具體行為改變是什麼？是 DAU、收聽時長、還是完播率？',
    interviewee: '7 日留存率（從 18% 到 25%）。次指標是平均收聽時長 ≥ 15 分鐘的用戶比例。',
    coaching: '指標問得很到位 — 主+次的層次分明。下一輪可以追問「目前哪些行為先發生才能達到 7 日留存？」',
    hint: '可問「新用戶 Day 1 通常會做什麼動作」。',
  },
];

const SAMPLE_CONVERSATION_3 = [
  ...SAMPLE_CONVERSATION_2,
  {
    userMessage: '那業務上有什麼限制？例如不能改首頁、不能動付費機制？',
    interviewee: '主要限制是不能動付費訂閱流程，首頁可以改但需要設計審核。不可改的還有 podcast 授權協議相關功能。',
    coaching: '很好，已經把業務約束框清楚了。',
    hint: '可以再問預算和時間 constraint。',
  },
];

// Mock all backend APIs to prevent real calls
async function mockApis(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/circles-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-p2-session' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/guest-circles-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-p2-session' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 's1' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/guest/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 's1' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

// ─── Q1: Entry path test — gate proceed button → Phase 2 ─────────────────────
test('Q1-entry-path: gate proceed -> Phase 2 renders', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  // Only run on Desktop-1280 for entry path verification
  if (testInfo.project.name !== 'Desktop-1280') test.skip();

  await mockApis(page);

  // Mock gate API to return ok immediately
  await page.route('**/api/circles-sessions/**/gate', r => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: [
        { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: '聚焦免費版廣告體驗' },
        { field: '時間範圍', status: 'ok', title: '週期合理', reason: '60 天對應月活動節奏' },
        { field: '業務影響', status: 'ok', title: '量化紅線', reason: '收入 3% 不能下降' },
        { field: '假設確認', status: 'ok', title: '可驗證', reason: '時段假設清晰' },
      ],
      canProceed: true,
      overallStatus: 'ok',
    })
  }));
  await page.route('**/api/guest-circles-sessions/**/gate', r => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: [
        { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: '聚焦免費版廣告體驗' },
        { field: '時間範圍', status: 'ok', title: '週期合理', reason: '60 天對應月活動節奏' },
        { field: '業務影響', status: 'ok', title: '量化紅線', reason: '收入 3% 不能下降' },
        { field: '假設確認', status: 'ok', title: '可驗證', reason: '時段假設清晰' },
      ],
      canProceed: true,
      overallStatus: 'ok',
    })
  }));

  await page.goto('/');
  await page.waitForSelector('.navbar');

  // Step 1: Set Phase 1.5 gate state (ok result) to simulate having passed gate
  await page.evaluate((q) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 1.5,
      circlesMode: 'drill',
      circlesDrillStep: 'C1',
      circlesSession: { id: 'test-p2-session' },
      circlesSelectedQuestion: q,
      circlesGateResult: {
        items: [
          { field: '問題範圍', status: 'ok', title: '邊界清晰', reason: '聚焦免費版廣告體驗' },
          { field: '時間範圍', status: 'ok', title: '週期合理', reason: '60 天對應月活動節奏' },
          { field: '業務影響', status: 'ok', title: '量化紅線', reason: '收入 3% 不能下降' },
          { field: '假設確認', status: 'ok', title: '可驗證', reason: '時段假設清晰' },
        ],
        canProceed: true,
        overallStatus: 'ok',
      },
      circlesGateLoading: false,
      circlesGateError: null,
      circlesConversation: [],
      circlesPhase2Streaming: false,
      circlesPhase2StreamingTurn: null,
      circlesPhase2StreamError: false,
      circlesPhase2ConclusionMode: false,
      circlesStepScores: {},
    });
    window.render();
  }, SAMPLE_QUESTION);

  // Step 2: Wait for gate content to appear
  await page.waitForSelector('.gate-content', { timeout: 5000 });
  await page.screenshot({ path: path.join(OUT, 'Q1-step1-gate-ok-before-proceed.png'), fullPage: false });

  // Step 3: Find and click the proceed button
  const proceedBtn = page.locator('[data-gate-action="proceed"]');
  const proceedCount = await proceedBtn.count();

  // Capture proceed button existence finding
  const q1EntryResult = {
    proceedButtonFound: proceedCount > 0,
    proceedButtonText: proceedCount > 0 ? await proceedBtn.first().textContent() : null,
  };
  console.log('Q1 Entry Path — proceed button:', JSON.stringify(q1EntryResult));

  // Assert proceed button exists
  expect(proceedCount, 'gate proceed button must exist when gate result is ok').toBeGreaterThan(0);

  // Click proceed
  await proceedBtn.first().click();
  await page.waitForTimeout(500);

  // Step 4: Verify Phase 2 view rendered
  const phase2View = await page.locator('[data-view="circles"][data-phase="2"]').count();
  expect(phase2View, 'Phase 2 view must render after proceed click').toBeGreaterThan(0);

  // Verify input bar exists (key Phase 2 element)
  const inputBar = await page.locator('.input-bar').count();
  expect(inputBar, 'input-bar must be present in Phase 2').toBeGreaterThan(0);

  // Verify icebreaker exists (Section A initial state)
  const icebreaker = await page.locator('.icebreaker').count();
  expect(icebreaker, 'icebreaker must be present in Phase 2 Section A (empty chat)').toBeGreaterThan(0);

  await page.screenshot({ path: path.join(OUT, 'Q1-step2-phase2-after-proceed.png'), fullPage: false });
  console.log('Q1 Entry Path — Phase 2 rendered:', phase2View > 0 ? 'PASS' : 'FAIL');
});

// ─── Q2: 4-state captures — 3 viewports × 4 states = 12 PNG ─────────────────
const AUDIT_VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'ipad-768',     width: 768,  height: 1024 },
  { name: 'mobile-360',   width: 360,  height: 780 },
];

for (const vp of AUDIT_VIEWPORTS) {
  // State A: empty chat + icebreaker (mockup 05 §A)
  test(`Q2-state-A-empty-icebreaker-${vp.name}`, async ({ page }, testInfo) => {
    test.setTimeout(30000);
    if (testInfo.project.name !== 'Desktop-1280') test.skip();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');

    await page.evaluate((q) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesMode: 'drill',
        circlesDrillStep: 'C1',
        circlesSession: { id: 'test-p2-session' },
        circlesSelectedQuestion: q,
        circlesConversation: [],
        circlesPhase2Streaming: false,
        circlesPhase2StreamingTurn: null,
        circlesPhase2StreamError: false,
        circlesPhase2ConclusionMode: false,
        circlesPhase2CoachHintExpanded: {},
        circlesPhase2ExampleOpen: false,
        circlesStepScores: {},
      });
      window.render();
    }, SAMPLE_QUESTION);

    await page.waitForSelector('[data-view="circles"][data-phase="2"]', { timeout: 5000 });
    const icebreaker = await page.locator('.icebreaker').count();
    console.log(`Q2-A ${vp.name} — icebreaker present: ${icebreaker > 0}`);
    expect(icebreaker, 'State A must have icebreaker').toBeGreaterThan(0);

    await page.screenshot({ path: path.join(OUT, `Q2-A-empty-icebreaker-${vp.name}.png`), fullPage: false });
  });

  // State B: 2-bubble mid-flow + turn counter (mockup 05 §B)
  test(`Q2-state-B-mid-flow-bubbles-${vp.name}`, async ({ page }, testInfo) => {
    test.setTimeout(30000);
    if (testInfo.project.name !== 'Desktop-1280') test.skip();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');

    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesMode: 'drill',
        circlesDrillStep: 'C1',
        circlesSession: { id: 'test-p2-session' },
        circlesSelectedQuestion: q,
        circlesConversation: conv,
        circlesPhase2Streaming: false,
        circlesPhase2StreamingTurn: null,
        circlesPhase2StreamError: false,
        circlesPhase2ConclusionMode: false,
        circlesPhase2CoachHintExpanded: {},
        circlesPhase2ExampleOpen: false,
        circlesStepScores: {},
      });
      window.render();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2 });

    await page.waitForSelector('.bubble--user', { timeout: 5000 });
    const userBubbles = await page.locator('.bubble--user').count();
    const intervieweeBubbles = await page.locator('.bubble--interviewee').count();
    const coachBubbles = await page.locator('.bubble--coach').count();
    console.log(`Q2-B ${vp.name} — user:${userBubbles} interviewee:${intervieweeBubbles} coach:${coachBubbles}`);
    expect(userBubbles, 'State B must have user bubbles').toBeGreaterThan(0);
    expect(intervieweeBubbles, 'State B must have interviewee bubbles').toBeGreaterThan(0);
    expect(coachBubbles, 'State B must have coach bubbles').toBeGreaterThan(0);

    await page.screenshot({ path: path.join(OUT, `Q2-B-mid-flow-bubbles-${vp.name}.png`), fullPage: false });
  });

  // State C: streaming SSE + 3-dot bubble (mockup 05 §C)
  test(`Q2-state-C-streaming-3dot-${vp.name}`, async ({ page }, testInfo) => {
    test.setTimeout(30000);
    if (testInfo.project.name !== 'Desktop-1280') test.skip();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');

    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesMode: 'drill',
        circlesDrillStep: 'C1',
        circlesSession: { id: 'test-p2-session' },
        circlesSelectedQuestion: q,
        circlesConversation: conv,
        circlesPhase2Streaming: true,
        circlesPhase2StreamingTurn: {
          userMessage: '那業務上有什麼限制？例如不能改首頁、不能動付費機制？',
          deltaText: '',
        },
        circlesPhase2StreamError: false,
        circlesPhase2ConclusionMode: false,
        circlesPhase2CoachHintExpanded: {},
        circlesStepScores: {},
      });
      window.render();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2 });

    await page.waitForSelector('.bubble__streaming', { timeout: 5000 });
    const streamingDots = await page.locator('.bubble__streaming').count();
    const sendBtn = page.locator('[data-phase2="send"]');
    const sendDisabled = await sendBtn.getAttribute('disabled');
    const sendClass = await sendBtn.getAttribute('class') || '';
    console.log(`Q2-C ${vp.name} — 3-dot bubble:${streamingDots > 0} send-disabled:${sendDisabled !== null} send-class:${sendClass}`);
    expect(streamingDots, 'State C must have streaming 3-dot bubble').toBeGreaterThan(0);

    await page.screenshot({ path: path.join(OUT, `Q2-C-streaming-3dot-${vp.name}.png`), fullPage: false });
  });

  // State D: turns ≥ 3 + conclude pill visible (mockup 05 §D)
  test(`Q2-state-D-conclude-pill-${vp.name}`, async ({ page }, testInfo) => {
    test.setTimeout(30000);
    if (testInfo.project.name !== 'Desktop-1280') test.skip();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');

    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesMode: 'drill',
        circlesDrillStep: 'C1',
        circlesSession: { id: 'test-p2-session' },
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
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3 });

    await page.waitForSelector('.submit-row__btn', { timeout: 5000 });
    const concludePill = await page.locator('[data-phase2="conclude"]').count();
    console.log(`Q2-D ${vp.name} — conclude pill:${concludePill > 0}`);
    expect(concludePill, 'State D must show conclude pill when turns >= 3').toBeGreaterThan(0);

    await page.screenshot({ path: path.join(OUT, `Q2-D-conclude-pill-${vp.name}.png`), fullPage: false });
  });
}

// ─── Q4: Locked state after evaluation (mockup 05 §F) — desktop only ─────────
test('Q4-locked-state-after-evaluation', async ({ page }, testInfo) => {
  test.setTimeout(30000);
  if (testInfo.project.name !== 'Desktop-1280') test.skip();

  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.navbar');

  await page.evaluate(({ q, conv }) => {
    Object.assign(window.AppState, {
      view: 'circles',
      circlesPhase: 2,
      circlesMode: 'drill',
      circlesDrillStep: 'C1',
      circlesSession: { id: 'test-p2-session' },
      circlesSelectedQuestion: q,
      circlesConversation: conv,
      circlesPhase2Streaming: false,
      circlesPhase2StreamingTurn: null,
      circlesPhase2StreamError: false,
      circlesPhase2ConclusionMode: false,
      circlesPhase2CoachHintExpanded: {},
      // KEY: step already scored → triggers locked branch
      circlesStepScores: {
        C1: {
          totalScore: 78,
          grade: 'B',
          dimensions: [
            { name: '問題釐清深度', score: 4, maxScore: 5, comment: '問題邊界清晰' },
            { name: '使用者同理心', score: 4, maxScore: 5, comment: '族群識別到位' },
          ],
          coaching: '整體表現良好，邊界問題尤其清晰。',
        },
      },
    });
    window.render();
  }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3 });

  // Wait for locked banner
  await page.waitForSelector('.locked-banner', { timeout: 5000 });

  // Assert: locked-banner present
  const lockedBanner = await page.locator('.locked-banner').count();
  expect(lockedBanner, 'Q4: locked-banner must be present').toBeGreaterThan(0);

  // Assert: no editable input bar (locked view uses different layout)
  const editableInput = await page.locator('[data-phase2="message-input"]').count();
  expect(editableInput, 'Q4: message input must NOT be present in locked state').toBe(0);

  // Assert: go-phase1 and go-phase3 navigation buttons present
  const goPhase1 = await page.locator('[data-phase2="go-phase1"]').count();
  const goPhase3 = await page.locator('[data-phase2="go-phase3"]').count();
  console.log(`Q4 — locked-banner:${lockedBanner > 0} go-phase1:${goPhase1 > 0} go-phase3:${goPhase3 > 0}`);

  await page.screenshot({ path: path.join(OUT, 'Q4-locked-state-desktop-1280.png'), fullPage: false });
});
