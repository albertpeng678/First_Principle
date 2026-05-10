/**
 * conversation-persistence-roundtrip.spec.js
 * Regression guard — Issue 3 (2026-05-10):
 *   "如果使用者已進行對話，但他不小心按到上一步，
 *    他回到對話時必須是他進行的問答對話進度"
 *
 * Director audit confirmed: back-btn handler (app.js line 6235-6241) only
 * sets circlesPhase = 1, does NOT reset circlesConversation.
 * This test will FAIL (RED) if someone adds `circlesConversation = []`
 * to that handler in the future.
 *
 * Single test, chromium + Mobile-360 viewport only.
 */

const { test, expect } = require('@playwright/test');

// Stub all network calls so the test is fully self-contained
// (no backend / DB seed required).
async function setupPage(page) {
  await page.route('**/api/(guest-)?circles-stats**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.route('**/api/(guest-)?circles-sessions**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/(guest/)?nsm-sessions**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/config**', r =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supabaseUrl: '', supabaseAnonKey: '' }),
    })
  );
  await page.goto('/');
  await page.waitForSelector('.qcard');
}

test.describe('Conversation persistence on back-button round-trip', () => {

  test('circlesConversation preserved after 上一步 → Phase 1 → back to Phase 2', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await setupPage(page);

    // ── Step 1: inject Phase 2 state with 3 conversation turns ──────────────
    // Phase 2 requires: circlesPhase=2 + circlesSession (truthy) + circlesSelectedQuestion
    await page.evaluate(() => {
      window.AppState.view = 'circles';
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesSelectedQuestion = {
        id: 'q-test-001',
        question: '你如何驗證 PM 的假設？',
        step: 'C1',
      };
      window.AppState.circlesSession = {
        id: 'session-test-001',
        current_phase: 2,
      };
      window.AppState.circlesPhase = 2;
      // 3 completed turns (user + interviewee + coach per turn)
      window.AppState.circlesConversation = [
        {
          userMessage: '我會先定義問題邊界',
          interviewee: '這個問題很常見',
          coaching: '思路清晰，但缺乏量化指標',
          hint: '試著用數字錨定你的假設',
        },
        {
          userMessage: '接著我會做使用者訪談',
          interviewee: '好的出發點',
          coaching: '訪談設計需考慮偏誤',
          hint: null,
        },
        {
          userMessage: '最後驗證假設可行性',
          interviewee: '這步驟很關鍵',
          coaching: '記得設定成功標準',
          hint: '可以用 OKR 框架',
        },
      ];
      window.render();
    });

    // ── Step 2: confirm Phase 2 is rendered with all 3 bubble sets ───────────
    await page.waitForSelector('[data-phase2="back"]', { timeout: 5000 });

    // Each turn produces 1 .bubble--user + 1 .bubble--interviewee + 1 .bubble--coach
    await expect(page.locator('.bubble--user')).toHaveCount(3);
    await expect(page.locator('.bubble--coach')).toHaveCount(3);

    // Conversation content is present
    await expect(page.locator('.bubble--user').first()).toContainText('我會先定義問題邊界');
    await expect(page.locator('.bubble--user').nth(2)).toContainText('最後驗證假設可行性');

    // ── Step 3: click 上一步 (back button) → goes to Phase 1 ─────────────────
    await page.locator('[data-phase2="back"]').click();

    // Verify Phase 2 UI is gone (back btn no longer present)
    await expect(page.locator('[data-phase2="back"]')).toHaveCount(0);

    // ── Step 4: assert circlesPhase = 1 AND conversation still has 3 items ───
    const stateAfterBack = await page.evaluate(() => ({
      phase: window.AppState.circlesPhase,
      convLength: (window.AppState.circlesConversation || []).length,
    }));

    expect(stateAfterBack.phase).toBe(1);
    // KEY ASSERTION — regression guard: if back-btn resets circlesConversation,
    // convLength will be 0 and this assertion will turn RED.
    expect(stateAfterBack.convLength).toBe(3);

    // ── Step 5: advance back to Phase 2 and confirm messages re-render ────────
    await page.evaluate(() => {
      window.AppState.circlesPhase = 2;
      window.render();
    });

    await page.waitForSelector('[data-phase2="back"]', { timeout: 5000 });

    // All 3 conversation turns must re-render from the intact array
    await expect(page.locator('.bubble--user')).toHaveCount(3);
    await expect(page.locator('.bubble--coach')).toHaveCount(3);

    // Spot-check: messages from the original turns are still there
    await expect(page.locator('.bubble--user').first()).toContainText('我會先定義問題邊界');
    await expect(page.locator('.bubble--user').nth(1)).toContainText('接著我會做使用者訪談');
    await expect(page.locator('.bubble--user').nth(2)).toContainText('最後驗證假設可行性');
  });

});
