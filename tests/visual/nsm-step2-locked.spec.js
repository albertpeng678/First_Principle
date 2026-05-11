// Task 3 (T3) — X-LockedStep2 TDD spec
// Bug: scored Step 2 renders empty form. Should show disabled textareas with user's
//   saved nsm/explanation/businessLink + 「（未填寫）」 for empty fields.
// Mockup contract: docs/superpowers/specs/mockups/2026-05-12-nsm-locked-states/01-step2-locked.html

const { test, expect } = require('@playwright/test');

async function setupScored(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 2,
      nsmSelectedQuestion: {
        id: 'q17',
        company: 'Zoom',
        product: '視訊會議 SaaS',
        question_type: 'saas',
        field_examples: { step2: { nsm: '範例答案內容', explanation: '範例說明', businessLink: '範例連結' } },
      },
      nsmDefinition: { nsm: 'user wrote this', explanation: '', businessLink: '' },
      nsmBreakdown: { reach: 'r', depth: 'd', frequency: 'f', impact: 'i' },
      nsmEvalResult: { totalScore: 80, coachTree: {}, coachRationale: {} },
      nsmSession: { id: 'sess-1' },
    });
    window.render();
  });
  await page.waitForTimeout(300);
}

// Test 1: .rt-field--locked visible + textarea contains user's nsm
test('Bug X-LockedStep2: scored Step 2 shows rt-field--locked with user nsm content', async ({ page }) => {
  await setupScored(page);

  // rt-field--locked class must be present
  const lockedField = page.locator('.rt-field--locked').first();
  await expect(lockedField).toBeVisible();

  // NSM textarea must contain user's value
  const nsmValue = await page.evaluate(() => {
    const el = document.querySelector('[data-nsm-input="nsm"]');
    return el ? (el.value || el.textContent.trim()) : null;
  });
  expect(nsmValue).toContain('user wrote this');
});

// Test 2: .submit-bar--locked has single 查看評分結果 button, NO 回首頁
test('Bug X-LockedStep2: submit-bar--locked has single 查看評分結果 button, no 回首頁', async ({ page }) => {
  await setupScored(page);

  const lockedBar = page.locator('.submit-bar--locked');
  await expect(lockedBar).toBeVisible();

  // Single primary button with correct text
  const primary = lockedBar.locator('.btn--primary');
  await expect(primary).toContainText('查看評分結果');

  // NO 回首頁 button anywhere in locked bar
  const homeBtn = lockedBar.locator('text=回首頁');
  await expect(homeBtn).toHaveCount(0);
});

// Test 3: 提示 + 範例答案 buttons stay enabled (field_examples fixture present)
test('Bug X-LockedStep2: 提示 + 範例答案 buttons stay clickable in locked state', async ({ page }) => {
  await setupScored(page);

  // 提示 button for nsm field
  const hintBtn = page.locator('[data-nsm-hint="nsm"]').first();
  await expect(hintBtn).toBeEnabled();

  // 範例答案 button (field_examples present in fixture)
  const exampleBtn = page.locator('[data-nsm-example-toggle="nsm"]').first();
  await expect(exampleBtn).toBeEnabled();
});
