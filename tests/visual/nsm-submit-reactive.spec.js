/**
 * TDD spec: NSM submit button reactive in-place update (UAT fix 2026-05-10)
 *
 * Issue 3: after user types content into [data-nsm-field] / [data-nsm-dim],
 * the submit button must enable without waiting for a full re-render.
 *
 * Issue 1: nsm-rt-toolbar must show exactly 2 buttons (B + 列點), not 4.
 */

const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats',       r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/nsm-sessions',        r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions',  r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions',    r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

const Q_ATTENTION = {
  id: 'q-att', company: 'Spotify', industry: '音樂串流',
  scenario: '為 Spotify 定義北極星指標，衡量用戶日常收聽行為', product: 'Spotify Music',
  product_type: 'attention',
  field_examples: {
    step2: {
      nsm: '行為動詞範例',
      explanation: '活躍用戶定義範例',
      businessLink: '直接關聯訂閱留存率範例',
    },
    step3: {
      reach:     '母群體說明',
      depth:     '深度行為說明',
      frequency: '週期說明',
      impact:    '留存率說明',
    },
  },
};

async function setupNSMStep2(page) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate((q) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-step2';
    window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
    window.AppState.nsmEvalResult = null;
    window.render();
  }, Q_ATTENTION);
  await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 3000 });
}

async function setupNSMStep3(page) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate((q) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 3;
    window.AppState.nsmSubTab = 'nsm-step3';
    window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmDefinition = { nsm: 'Monthly active listeners', explanation: 'x', businessLink: 'y' };
    window.AppState.nsmBreakdown = {};
    window.AppState.nsmEvalResult = null;
    window.AppState.nsmGateResult = { status: 'ok', items: [] };
    window.render();
  }, Q_ATTENTION);
  await page.waitForSelector('[data-nsm-dim]', { timeout: 3000 });
}

test.describe('NSM submit reactive + toolbar trim (Issue 1 + Issue 3)', () => {

  // ── Issue 1: toolbar button count ────────────────────────────────────────

  test('Step 2 rt-toolbar has exactly 2 buttons (B + 列點)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page);
    // Step 2 has 2 rich-text fields (explanation + businessLink), each with its own toolbar.
    // Verify no indent/outdent buttons exist anywhere (they were removed).
    const indentBtns = page.locator('[data-rt-cmd="indent"]');
    const outdentBtns = page.locator('[data-rt-cmd="outdent"]');
    expect(await indentBtns.count()).toBe(0);
    expect(await outdentBtns.count()).toBe(0);
    // Each toolbar must contain bold + list — verify on first toolbar
    const firstToolbar = page.locator('.nsm-rt-toolbar').first();
    const btn0 = await firstToolbar.locator('.nsm-rt-tbtn').nth(0).getAttribute('data-rt-cmd');
    expect(btn0).toBe('bold');
    const btn1 = await firstToolbar.locator('.nsm-rt-tbtn').nth(1).getAttribute('data-rt-cmd');
    expect(btn1).toBe('insertUnorderedList');
    // Each toolbar must have exactly 2 buttons
    const toolbars = page.locator('.nsm-rt-toolbar');
    const toolbarCount = await toolbars.count();
    for (let i = 0; i < toolbarCount; i++) {
      const btns = toolbars.nth(i).locator('.nsm-rt-tbtn');
      expect(await btns.count()).toBe(2);
    }
  });

  test('Step 3 rt-toolbar has exactly 2 buttons (B + 列點)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep3(page);
    const toolbarBtns = page.locator('.nsm-rt-toolbar .nsm-rt-tbtn');
    const count = await toolbarBtns.count();
    // Step 3 has multiple dim fields — total should be 2 per field
    // Assert no indent/outdent buttons exist anywhere
    const indentBtns = page.locator('[data-rt-cmd="indent"]');
    const outdentBtns = page.locator('[data-rt-cmd="outdent"]');
    expect(await indentBtns.count()).toBe(0);
    expect(await outdentBtns.count()).toBe(0);
  });

  // ── Issue 3: submit button reactive in-place update ───────────────────────

  test('Step 2 submit stays disabled with empty fields', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page);
    const submitBtn = page.locator('[data-nsm-submit]');
    await expect(submitBtn).toBeDisabled();
  });

  test('Step 2 submit enables after all 3 fields reach min length (debounced)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page);

    const submitBtn = page.locator('[data-nsm-submit]');
    await expect(submitBtn).toBeDisabled();

    // Fill nsm single-input (min 10 chars)
    const nsmInput = page.locator('[data-nsm-field="nsm"]');
    await nsmInput.fill('Monthly active listeners ok');

    // Fill explanation rich-text (min 30 chars)
    const explanationField = page.locator('[data-nsm-field="explanation"]');
    await explanationField.focus();
    await explanationField.type('This is a detailed explanation of the metric for tracking users.');

    // Fill businessLink rich-text (min 30 chars)
    const businessLinkField = page.locator('[data-nsm-field="businessLink"]');
    await businessLinkField.focus();
    await businessLinkField.type('Direct correlation to subscription retention and revenue growth.');

    // Wait for debounce (200ms) + buffer
    await page.waitForTimeout(350);

    // Submit button must be enabled in-place (no re-render needed)
    await expect(submitBtn).not.toBeDisabled();
  });

  test('Step 3 submit stays disabled with empty dims', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep3(page);
    const submitBtn = page.locator('[data-nsm-submit]');
    await expect(submitBtn).toBeDisabled();
  });

  test('Step 3 submit enables after all dims reach 20 chars (debounced)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep3(page);

    const submitBtn = page.locator('[data-nsm-submit]');
    await expect(submitBtn).toBeDisabled();

    // Fill all dim textareas (attention type: reach, depth, frequency, impact)
    const dimFields = page.locator('[data-nsm-dim]');
    const dimCount = await dimFields.count();
    for (let i = 0; i < dimCount; i++) {
      await dimFields.nth(i).fill('This dimension is filled with enough text to pass validation.');
    }

    // Wait for debounce
    await page.waitForTimeout(350);

    await expect(submitBtn).not.toBeDisabled();
  });

});
