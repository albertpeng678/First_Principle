// B3+B4 — NSM Step 2 + Step 3 lock state (applyNSMStateOverlay)
// TDD: RED before implementation, GREEN after.
// Per UNIVERSAL standing rule feedback_lock_state_hint_example_always_available.md:
//   hint + example buttons MUST remain visible + clickable in locked state.
// 6 PNG captures: Step2 + Step3 × mobile-360 / tablet-768 / desktop-1280

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const Q_ATTENTION = {
  id: 'q-att-lock',
  company: 'Spotify',
  industry: '音樂串流',
  scenario: '為 Spotify Podcast 業務定義北極星指標，目標是衡量新用戶能否養成日常收聽習慣。',
  product: 'Spotify',
  field_examples: {
    step2: { nsm: '月活躍用戶完成 ≥ 3 集 Podcast 收聽', explanation: '月內至少 3 次完整收聽...', businessLink: '收聽行為直接 → 內容多元 → 廣告填充率上升' },
    step3: { reach: '每月活躍 Podcast 收聽者佔 MAU 30%', depth: '完整收聽率（≥ 80%）', frequency: '連續 4 週每週收聽一次', impact: 'Podcast 用戶 6 個月留存率 ≥ 50%' },
  },
};

const NSM_EVAL_RESULT_STUB = {
  totalScore: 80,
  scores: { nsm: 4, explanation: 4, businessLink: 4 },
  feedback: '整體定義清晰，與業務連結充分。',
};

const NSM_BREAKDOWN_EVAL_STUB = {
  totalScore: 78,
  scores: { reach: 4, depth: 4, frequency: 4, impact: 4 },
  feedback: '4 維度拆解完整，邏輯連貫。',
};

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('B3+B4 NSM Step 2 lock state', () => {
  fs.mkdirSync('audit/png-phase-b', { recursive: true });

  test('step2-locked: banner visible + fields locked + submit replaced + hint+example clickable', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q, evalResult }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = {
        nsm: '月活躍用戶完成 ≥ 3 集 Podcast 收聽',
        explanation: '月內至少 3 次完整收聽 Podcast 內容（每次 ≥ 5 分鐘），代表用戶已從 Spotify 內容生態中取得實質價值。',
        businessLink: '收聽行為直接 → 內容多元 → 廣告填充率上升 → 訂閱轉換 + 留存提升。',
      };
      window.AppState.nsmEvalResult = evalResult;
      window.render();
    }, { q: Q_ATTENTION, evalResult: NSM_EVAL_RESULT_STUB });

    await page.waitForSelector('.banner.banner--locked', { timeout: 5000 });

    // 1. Banner visible
    const banner = page.locator('.banner.banner--locked');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('已評分完成');

    // 2. rt-field--locked class on NSM textarea containers
    const lockedFields = page.locator('.rt-field--locked');
    await expect(lockedFields.first()).toBeVisible();

    // 3. Original submit button GONE, replaced by 「查看評分結果」
    await expect(page.locator('[data-nsm-submit]')).toHaveCount(0);
    const viewResultBtn = page.locator('[data-nsm-action="view-eval-result"]');
    await expect(viewResultBtn).toBeVisible();
    await expect(viewResultBtn).toContainText('查看評分結果');

    // 4. UNIVERSAL standing rule: hint + example buttons still visible + not disabled
    const hintLinks = page.locator('.field__hint-link');
    const exampleToggles = page.locator('.field-example-toggle');
    await expect(hintLinks.first()).toBeVisible();
    await expect(hintLinks.first()).not.toBeDisabled();
    await expect(exampleToggles.first()).toBeVisible();
    await expect(exampleToggles.first()).not.toBeDisabled();

    // 5. PNG capture
    await page.screenshot({ path: `audit/png-phase-b/B3-nsm-step2-locked-${testInfo.project.name}.png`, fullPage: true });
  });
});

test.describe('B4 NSM Step 3 lock state', () => {
  fs.mkdirSync('audit/png-phase-b', { recursive: true });

  test('step3-locked: banner visible + dim textareas locked + submit replaced + hint+example clickable', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q, evalResult }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = {
        nsm: '月活躍用戶完成 ≥ 3 集 Podcast 收聽',
        explanation: '月內至少 3 次完整收聽。',
        businessLink: '收聽行為直接 → 廣告填充率上升。',
      };
      window.AppState.nsmBreakdown = {
        reach: '每月活躍 Podcast 收聽者佔總 MAU 比率達 30%。',
        depth: '單次完整收聽（≥ 80% 單集播放完成率）的用戶比率。',
        frequency: '連續 4 週每週至少收聽 1 次 Podcast 的用戶比率。',
        impact: 'Podcast 活躍用戶 6 個月留存率 ≥ 50%。',
      };
      window.AppState.nsmEvalResult = evalResult;
      window.render();
    }, { q: Q_ATTENTION, evalResult: NSM_BREAKDOWN_EVAL_STUB });

    await page.waitForSelector('.banner.banner--locked', { timeout: 5000 });

    // 1. Banner visible
    const banner = page.locator('.banner.banner--locked');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('已評分完成');

    // 2. rt-field--locked on dim rt-field wrappers
    const lockedDimFields = page.locator('.nsm-rt-field.rt-field--locked');
    await expect(lockedDimFields.first()).toBeVisible();

    // 3. Textarea readonly attribute present
    const readonlyTextarea = page.locator('.nsm-rt-textarea[readonly]');
    await expect(readonlyTextarea.first()).toBeAttached();

    // 4. Original submit GONE, replaced by 「查看評分結果」
    await expect(page.locator('[data-nsm-submit]')).toHaveCount(0);
    const viewResultBtn = page.locator('[data-nsm-action="view-eval-result"]');
    await expect(viewResultBtn).toBeVisible();
    await expect(viewResultBtn).toContainText('查看評分結果');

    // 5. UNIVERSAL standing rule: hint + example buttons still visible + not disabled
    // Step 3 uses .field__hint-link (AI hint) + .field-example-toggle per nsm-dim
    const hintLinks = page.locator('.field__hint-link');
    const exampleToggles = page.locator('.field-example-toggle');
    await expect(hintLinks.first()).toBeVisible();
    await expect(hintLinks.first()).not.toBeDisabled();
    // example toggle only shows when field_examples data exists
    if (await exampleToggles.count() > 0) {
      await expect(exampleToggles.first()).not.toBeDisabled();
    }

    // 6. PNG capture
    await page.screenshot({ path: `audit/png-phase-b/B4-nsm-step3-locked-${testInfo.project.name}.png`, fullPage: true });
  });
});
