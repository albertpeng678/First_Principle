// Phase 2 Chat (mockup 05) — Sections A + B specs
// SB-Phase2-A covers Tasks A1-A3 (Sections A + B foundation).
// SB-Phase2-B will cover Sections C/D/E/F (deferred).
const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

const SAMPLE_QUESTION = {
  id: 'q-test-01',
  company: 'Spotify',
  product: 'Podcast',
  industry: 'streaming',
  question_type: 'design',
  difficulty: 'medium',
  problem_statement: '設計一個新功能，提升 Spotify Podcast 黏著度',
};

const SAMPLE_CONVERSATION_2_TURNS = [
  {
    userMessage: '這個題目是只看 podcast，還是包含音樂？目標是訂閱用戶還是免費用戶？',
    interviewee: '只看 podcast。目標族群以「30 天內註冊但未養成日常收聽習慣的新用戶」為主。',
    coaching: '好的開頭問題。同時釐清「涵蓋範圍」與「目標族群」，避免後續分析展開時邊界模糊。',
    hint: '可追問「為什麼是新用戶 而不是 power user」。',
  },
  {
    userMessage: '那我們希望看到的具體行為改變是什麼？是 DAU、收聽時長、還是完播率？',
    interviewee: '7 日留存率（從 18% 到 25%）。次指標是平均收聽時長 ≥ 15 分鐘的用戶比例。',
    coaching: '指標問得很到位 — 主+次的層次分明。下一輪可以追問「目前哪些行為先發生才能達到 7 日留存？」',
    hint: '可問「新用戶 Day 1 通常會做什麼動作」。',
  },
];

// ─── Task A1: Router test ────────────────────────────────────────────────────

test.describe('Phase 2 Chat — Task A1: Router', () => {
  test('circlesPhase=2 + session + question → renders Phase 2 view (not stub)', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate((q) => {
      window.AppState.view = 'circles';
      window.AppState.circlesPhase = 2;
      window.AppState.circlesSession = { id: 'test-session-001' };
      window.AppState.circlesSelectedQuestion = q;
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesConversation = [];
      window.AppState.circlesMode = 'drill';
      window.renderApp();
    }, SAMPLE_QUESTION);
    await expect(page.locator('[data-view="circles"][data-phase="2"]')).toBeVisible();
    // stub text must be gone
    await expect(page.locator('text=Plan B 實作')).toHaveCount(0);
  });

  test('circlesPhase=2 without session → falls through to stub', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate((q) => {
      window.AppState.view = 'circles';
      window.AppState.circlesPhase = 2;
      window.AppState.circlesSession = null; // no session → stub
      window.AppState.circlesSelectedQuestion = q;
      window.AppState.circlesConversation = [];
      window.renderApp();
    }, SAMPLE_QUESTION);
    // Should NOT show phase-2 view without session
    await expect(page.locator('[data-view="circles"][data-phase="2"]')).toHaveCount(0);
  });
});

// ─── Task A2: Section A — empty chat + icebreaker ────────────────────────────

test.describe('Phase 2 Chat — Task A2: Section A empty', () => {
  test('Section A: empty conversation renders all required elements', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate((q) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: [],
        circlesMode: 'drill',
      });
      window.renderApp();
    }, SAMPLE_QUESTION);

    // navbar
    await expect(page.locator('.navbar')).toBeVisible();
    // 7-step progress bar
    await expect(page.locator('.progress__step')).toHaveCount(7);
    // phase-head num = 2
    await expect(page.locator('.phase-head__num')).toHaveText('2');
    // phase-head eyebrow contains PHASE 2
    await expect(page.locator('.phase-head__eyebrow')).toContainText('PHASE 2');
    // phase-head title = C · 澄清情境
    await expect(page.locator('.phase-head__title')).toContainText('C · 澄清情境');
    // qchip visible
    await expect(page.locator('.qchip')).toBeVisible();
    // icebreaker visible with correct label
    await expect(page.locator('.icebreaker')).toBeVisible();
    await expect(page.locator('.icebreaker')).toContainText('開始提問方向');
    // icebreaker C1 body text
    await expect(page.locator('.icebreaker')).toContainText('先與被訪談者澄清題目本身的邊界');
    // chat-body has 0 bubbles
    await expect(page.locator('.chat-body .bubble')).toHaveCount(0);
    // input bar textarea visible
    await expect(page.locator('.input-bar__textarea')).toBeVisible();
    // send button visible
    await expect(page.locator('.input-bar__send')).toBeVisible();
  });

  test('Section A: icebreaker shows correct text for each drill step', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');

    const stepTexts = {
      C1: '先與被訪談者澄清題目本身的邊界',
      I: '了解目標用戶',
      R: '挖掘真實需求',
      C2: '排序需求',
      L: '列方案',
      E: '評估每個方案',
      S: '總結並設定 tracking',
    };

    for (const [step, expectedText] of Object.entries(stepTexts)) {
      await page.evaluate(({ q, step }) => {
        Object.assign(window.AppState, {
          view: 'circles',
          circlesPhase: 2,
          circlesSession: { id: 's1' },
          circlesSelectedQuestion: q,
          circlesDrillStep: step,
          circlesConversation: [],
          circlesMode: 'drill',
        });
        window.renderApp();
      }, { q: SAMPLE_QUESTION, step });
      await expect(page.locator('.icebreaker')).toContainText(expectedText);
    }
  });

  test('Section A: desktop phase-head meta shows 建議 5-10 輪對話', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate((q) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: [],
        circlesMode: 'drill',
      });
      window.renderApp();
    }, SAMPLE_QUESTION);
    await expect(page.locator('.phase-head__meta')).toContainText('建議 5-10 輪');
  });
});

// ─── Task A3: Section B — 3 bubble types + turn counter ──────────────────────

test.describe('Phase 2 Chat — Task A3: Section B bubbles + turn counter', () => {
  test('Section B: 2-turn conversation renders correct bubble counts', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    // 2 user bubbles
    await expect(page.locator('.bubble--user')).toHaveCount(2);
    // 2 interviewee bubbles
    await expect(page.locator('.bubble--interviewee')).toHaveCount(2);
    // 2 coach bubbles
    await expect(page.locator('.bubble--coach')).toHaveCount(2);
    // No icebreaker in Section B (conversation has turns)
    await expect(page.locator('.icebreaker')).toHaveCount(0);
  });

  test('Section B: turn-counter badge shows "2 輪" in navbar', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    // turn-badge in navbar shows turn count
    await expect(page.locator('.navbar .turn-badge')).toBeVisible();
    await expect(page.locator('.navbar .turn-badge')).toContainText('2 輪');
  });

  test('Section B: no turn-badge shown when conversation is empty', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate((q) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: [],
        circlesMode: 'drill',
      });
      window.renderApp();
    }, SAMPLE_QUESTION);
    await expect(page.locator('.navbar .turn-badge')).toHaveCount(0);
  });

  test('Section B: coach hint toggle expands hint content', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2CoachHintExpanded: {},
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    // initially hint content should be hidden
    const hintContent = page.locator('.bubble--coach__hint-content').first();
    // click first coach hint toggle
    await page.locator('.bubble--coach__hint-toggle').first().click();
    // hint content should now be visible
    await expect(hintContent).toBeVisible();
    // toggle text should change to 收起
    await expect(page.locator('.bubble--coach__hint-toggle').first()).toContainText('收起');
  });

  test('Section B: interviewee bubble has 被訪談者 section label', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    await expect(page.locator('.bubble--interviewee .bubble__section').first()).toContainText('被訪談者');
  });

  test('Section B: coach bubble has 教練點評 section label with graduation-cap icon', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    await expect(page.locator('.bubble--coach .bubble__section').first()).toContainText('教練點評');
    await expect(page.locator('.bubble--coach .bubble__section .ph-graduation-cap').first()).toBeVisible();
  });
});

// ─── Task B1: Section C — Streaming SSE + 3-dot bubble ───────────────────────

const SAMPLE_CONVERSATION_3_TURNS = [
  ...SAMPLE_CONVERSATION_2_TURNS,
  {
    userMessage: '那業務上有什麼限制？例如不能改首頁、不能動付費機制？',
    interviewee: '主要限制是不能動付費訂閱流程，首頁可以改但需要設計審核。',
    coaching: '很好，已經把業務約束框清楚了。',
    hint: '可以再問預算和時間 constraint。',
  },
];

test.describe('Phase 2 Chat — Task B1: Section C streaming', () => {
  test('Section C: streaming=true renders 3-dot bubble + disabled input', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: true,
        circlesPhase2StreamingTurn: { userMessage: '那業務有什麼限制？', deltaText: '' },
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    // Streaming bubble visible
    await expect(page.locator('.bubble__streaming')).toBeVisible();
    // Input placeholder shows waiting message
    await expect(page.locator('.input-bar__textarea')).toHaveAttribute('placeholder', '等待回應中...');
    // Send button is disabled
    await expect(page.locator('.input-bar__send')).toBeDisabled();
  });

  test('Section C: streaming=true shows user message bubble for current streaming turn', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: true,
        circlesPhase2StreamingTurn: { userMessage: '正在等待的這句話', deltaText: '' },
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    // User bubble for streaming turn shows userMessage
    await expect(page.locator('.bubble--user').last()).toContainText('正在等待的這句話');
    // Interviewee streaming bubble below
    await expect(page.locator('.bubble--interviewee').last()).toContainText('');
    await expect(page.locator('.bubble__streaming')).toBeVisible();
  });

  test('Section C: error state renders inline error + 重新發送 button', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2StreamError: true,
        circlesPhase2StreamingTurn: { userMessage: '失敗的訊息', deltaText: '' },
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    // Error banner visible
    await expect(page.locator('.phase2-stream-error')).toBeVisible();
    // 重新發送 button visible
    await expect(page.locator('[data-phase2="retry"]')).toBeVisible();
  });

  test('Section C: send button click with message ≥ 5 chars sets streaming=true', async ({ page }) => {
    await mockApis(page);
    // Mock the SSE endpoint to hang (never resolve) — just test the state change
    await page.route('**/api/guest-circles-sessions/**/message', async (route) => {
      // Return a minimal SSE response that hangs
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: '',
      });
    });
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 'sess-001' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: [],
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION });

    // Type a message and send
    const textarea = page.locator('.input-bar__textarea');
    await textarea.fill('這是一個超過五字的問題');
    await page.locator('.input-bar__send').click();

    // After click, streaming should become true (re-render shows streaming UI)
    await expect(page.locator('.bubble__streaming')).toBeVisible({ timeout: 3000 });
  });

  test('Section C: send button disabled when message < 5 chars', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 'sess-001' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: [],
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION });

    // Type short message
    const textarea = page.locator('.input-bar__textarea');
    await textarea.fill('嗯');
    // Check for inline tip (at least 5 chars)
    await expect(page.locator('.phase2-min-tip')).toBeVisible();
  });
});

// ─── Task B2: Section D — turns ≥ 3 submit pill ──────────────────────────────

test.describe('Phase 2 Chat — Task B2: Section D submit pill', () => {
  test('Section D: turns < 3 → no submit pill', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: false,
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_2_TURNS });

    await expect(page.locator('.submit-row__btn')).toHaveCount(0);
  });

  test('Section D: turns ≥ 3 → submit pill visible', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: false,
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    await expect(page.locator('.submit-row__btn')).toBeVisible();
    await expect(page.locator('.submit-row__btn')).toContainText('對話足夠了，提交這個步驟');
  });

  test('Section D: click pill → circlesPhase2ConclusionMode = true', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: false,
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    await page.locator('.submit-row__btn').click();

    const conclusionMode = await page.evaluate(() => window.AppState.circlesPhase2ConclusionMode);
    expect(conclusionMode).toBe(true);
    // conclusion-box should now be visible
    await expect(page.locator('.conclusion-box')).toBeVisible();
  });
});

// ─── Task B3: Section E — Conclusion box ─────────────────────────────────────

test.describe('Phase 2 Chat — Task B3: Section E conclusion-box', () => {
  test('Section E: conclusion mode dims chat + shows conclusion-box with 2px navy border', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: true,
        circlesPhase2ConclusionDraft: '',
        circlesPhase2ExampleOpen: false,
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    // conclusion-box visible
    await expect(page.locator('.conclusion-box')).toBeVisible();
    // chat content dimmed
    await expect(page.locator('.chat-content.chat-content--dimmed')).toBeVisible();
    // title present
    await expect(page.locator('.conclusion-box__title')).toContainText('整理你這個步驟確認了什麼');
    // rt-field visible
    await expect(page.locator('.conclusion-box .rt-field')).toBeVisible();
    // conclusion-actions visible
    await expect(page.locator('.conclusion-actions')).toBeVisible();
    // back button
    await expect(page.locator('.conclusion-actions__back')).toContainText('繼續對話');
    // submit button
    await expect(page.locator('.conclusion-actions__submit')).toBeVisible();
  });

  test('Section E: example toggle expand/collapse', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: true,
        circlesPhase2ConclusionDraft: '',
        circlesPhase2ExampleOpen: false,
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    // Initially collapsed
    await expect(page.locator('.conclusion-box__example')).not.toHaveClass(/is-open/);
    // Click toggle
    await page.locator('.conclusion-box__example-head').click();
    // Should be open
    await expect(page.locator('.conclusion-box__example')).toHaveClass(/is-open/);
  });

  test('Section E: textarea below 30 chars → 確認提交 disabled', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: true,
        circlesPhase2ConclusionDraft: '太短',
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    await expect(page.locator('.conclusion-actions__submit')).toBeDisabled();
  });

  test('Section E: textarea ≥ 30 chars → 確認提交 enabled', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: true,
        circlesPhase2ConclusionDraft: '這是超過三十個字的結論文字，應該要能夠啟用提交按鈕了，好的。',
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    await expect(page.locator('.conclusion-actions__submit')).toBeEnabled();
  });

  test('Section E: 繼續對話 click → conclusionMode false + draft preserved', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    const DRAFT = '這是一段保存的草稿文字，應該在切回對話後保留。';
    await page.evaluate(({ q, conv, draft }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: true,
        circlesPhase2ConclusionDraft: draft,
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS, draft: DRAFT });

    await page.locator('.conclusion-actions__back').click();

    const state = await page.evaluate(() => ({
      conclusionMode: window.AppState.circlesPhase2ConclusionMode,
      draft: window.AppState.circlesPhase2ConclusionDraft,
    }));
    expect(state.conclusionMode).toBe(false);
    expect(state.draft).toBe(DRAFT);
  });

  test('Section E: 確認提交 click → POST conclusion-check ok + evaluate-step ok → circlesPhase=3', async ({ page }) => {
    await mockApis(page);
    await page.route('**/api/guest-circles-sessions/**/conclusion-check', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    );
    await page.route('**/api/guest-circles-sessions/**/evaluate-step', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalScore: 78, dimensions: [] }) })
    );
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 'sess-456' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: true,
        circlesPhase2ConclusionDraft: '問題範圍：聚焦免費 podcast 用戶的 7 日留存；時間框架：H2 內看到 18%→25% 提升；業務約束：不動付費機制。',
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    await page.locator('.conclusion-actions__submit').click();

    // Wait for phase transition
    await page.waitForTimeout(500);
    const phase = await page.evaluate(() => window.AppState.circlesPhase);
    expect(phase).toBe(3);
  });
});

// ─── Task B4: Section F — Locked banner + 2-button row ───────────────────────

test.describe('Phase 2 Chat — Task B4: Section F locked', () => {
  test('Section F: locked step → banner visible + 2-button row + no input', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: false,
        // step is scored → locked
        circlesStepScores: { C1: { totalScore: 78, dimensions: [] } },
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    // locked-banner visible
    await expect(page.locator('.locked-banner')).toBeVisible();
    await expect(page.locator('.locked-banner')).toContainText('此步驟已評分');
    // no input bar
    await expect(page.locator('.input-bar')).toHaveCount(0);
    // 2-button row
    await expect(page.locator('[data-phase2="go-phase1"]')).toBeVisible();
    await expect(page.locator('[data-phase2="go-phase3"]')).toBeVisible();
  });

  test('Section F: 上一步（看框架）click → circlesPhase = 1', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: false,
        circlesStepScores: { C1: { totalScore: 78, dimensions: [] } },
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    await page.locator('[data-phase2="go-phase1"]').click();
    const phase = await page.evaluate(() => window.AppState.circlesPhase);
    expect(phase).toBe(1);
  });

  test('Section F: 回評分 click → circlesPhase = 3', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.navbar');
    await page.evaluate(({ q, conv }) => {
      Object.assign(window.AppState, {
        view: 'circles',
        circlesPhase: 2,
        circlesSession: { id: 's1' },
        circlesSelectedQuestion: q,
        circlesDrillStep: 'C1',
        circlesConversation: conv,
        circlesMode: 'drill',
        circlesPhase2Streaming: false,
        circlesPhase2ConclusionMode: false,
        circlesStepScores: { C1: { totalScore: 78, dimensions: [] } },
      });
      window.renderApp();
    }, { q: SAMPLE_QUESTION, conv: SAMPLE_CONVERSATION_3_TURNS });

    await page.locator('[data-phase2="go-phase3"]').click();
    const phase = await page.evaluate(() => window.AppState.circlesPhase);
    expect(phase).toBe(3);
  });
});
