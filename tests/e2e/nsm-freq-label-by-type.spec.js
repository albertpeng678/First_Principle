// tests/e2e/nsm-freq-label-by-type.spec.js
//
// Verify each product type renders the correct frequency label in NSM Step 3.
//   attention   → 習慣頻率
//   transaction → 匹配頻率
//   creator     → 採用頻率
//   saas        → 黏著頻率
//
// Skill citations:
//   api-testing.md 783-848       — AppState injection (10-100× faster than UI)
//   common-pitfalls.md Pitfall 11 — no own-API mock
//   common-pitfalls.md Pitfall 19 — test.step per phase
//   locator-strategy.md           — data-attr + text matching for dim labels

'use strict';

const { test, expect } = require('@playwright/test');

// NSM question IDs that map to each product type (from NSM_QUESTIONS in nsm-db.js).
// The product type is inferred by nsmGuessProductType() which regex-matches
// company/industry/scenario text. We provide a minimal question_json that
// reliably triggers each type.
const TYPE_QUESTIONS = [
  {
    type: 'attention',
    expectedFreqLabel: '習慣頻率',
    questionJson: {
      id: 'test-freq-attention',
      company: 'YouTube',
      industry: '影音平台',
      scenario: '提升用戶每日回訪率，形成習慣性消費內容的行為',
    },
  },
  {
    type: 'transaction',
    expectedFreqLabel: '匹配頻率',
    questionJson: {
      id: 'test-freq-transaction',
      company: 'Airbnb',
      industry: '租屋 marketplace',
      scenario: '提升訪客與房東的成功撮合率，加速預訂完成速度',
    },
  },
  {
    type: 'creator',
    expectedFreqLabel: '採用頻率',
    questionJson: {
      id: 'test-freq-creator',
      company: 'Substack',
      industry: '知識 newsletter 創作',
      scenario: '提升創作者發布頻率與讀者訂閱採用率',
    },
  },
  {
    type: 'saas',
    expectedFreqLabel: '黏著頻率',
    questionJson: {
      id: 'test-freq-saas',
      company: 'Notion',
      industry: 'SaaS 協作工具',
      scenario: '提升企業用戶 DAU/MAU 比，讓 Notion 嵌入日常工作流',
    },
  },
];

async function bootApp(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);

  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

// Navigate to NSM Step 3 (breakdown input) with the given question type.
// Uses AppState injection to skip Step 1/2 (API seeding pattern).
async function navigateToStep3WithType(page, questionJson) {
  await page.evaluate(async (qjson) => {
    // Seed a minimal session without hitting the API (test-only question IDs)
    window.AppState.nsmSession = { id: 'test-session-freq-label' };
    window.AppState.nsmSelectedQuestion = qjson;
    window.AppState.nsmDefinition = {
      nsm: '週活躍用戶數',
      explanation: '直接反映核心使用行為',
      businessLink: '與收入正相關',
    };
    window.AppState.nsmBreakdown = { reach: '', depth: '', frequency: '' };
    window.AppState.nsmEvalResult = null;
    window.AppState.nsmGateResult = null;
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 3;
    window.AppState.nsmSubTab = 'nsm-step3';
    window.render();
  }, questionJson);
}

test.describe('NSM frequency label by product type — post impact-removal', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  for (const { type, expectedFreqLabel, questionJson } of TYPE_QUESTIONS) {
    test(`frequency label for "${type}" type shows "${expectedFreqLabel}"`, async ({ page }) => {
      await test.step('boot app + auth', async () => {
        await bootApp(page);
        await waitForAuth(page);
      });

      await test.step(`navigate to Step 3 with ${type} question`, async () => {
        await navigateToStep3WithType(page, questionJson);
        // Step 3 must be visible
        await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('.phase-head__title')).toContainText('拆解輸入指標', { timeout: 5_000 });
      });

      await test.step(`verify frequency dim card shows "${expectedFreqLabel}"`, async () => {
        // NSM Step 3 renders .nsm-dim cards with .field__label inside .field__label-row for each dim
        // (post Bug B mockup 07 migration, replaces old .nsm-dim__head + .nsm-dim__label).
        // The frequency dim card has data-nsm-dim="frequency" on its textarea.
        const freqTextarea = page.locator('textarea[data-nsm-dim="frequency"]');
        await expect(freqTextarea).toBeVisible({ timeout: 5_000 });

        // The frequency card's .field__label is the closest ancestor .nsm-dim > .field__label-row .field__label
        const freqCard = page.locator('.nsm-dim').filter({ has: page.locator('[data-nsm-dim="frequency"]') });
        await expect(freqCard).toBeVisible({ timeout: 3_000 });
        const freqLabel = freqCard.locator('.field__label-row .field__label');
        await expect(freqLabel).toContainText(expectedFreqLabel, { timeout: 3_000 });
      });

      await test.step('verify only 3 dim cards rendered (no impact card)', async () => {
        // After impact removal, exactly 3 .nsm-dim cards must render.
        const dimCards = page.locator('.nsm-dim');
        await expect(dimCards).toHaveCount(3, { timeout: 5_000 });

        // Confirm no impact textarea exists.
        await expect(page.locator('textarea[data-nsm-dim="impact"]')).toHaveCount(0);
      });
    });
  }
});
