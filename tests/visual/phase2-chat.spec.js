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
