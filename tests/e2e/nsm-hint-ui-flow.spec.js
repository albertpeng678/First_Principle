// tests/e2e/nsm-hint-ui-flow.spec.js
//
// Stage 1D D1 — NSM Step 1 hint button + modal flow E2E.
// Verifies: button visible after question selection → click → modal opens →
// 4 labeled sections with bullets → close → re-open hits cache (no second network request).
//
// Playwright skill citations applied:
//   api-testing.md 783-848       — API seed via page.evaluate (10-100× faster)
//   network-mocking.md           — page.route to mock hint endpoint (no real OpenAI)
//   common-pitfalls.md Pitfall 11 — mock only the hint endpoint; real auth + real Supabase for session
//   common-pitfalls.md Pitfall 14 — no module-level mutable state; sessionId test-local
//   authentication.md 29-70      — storageState from auth.setup.js reuse

'use strict';

const { test, expect } = require('@playwright/test');

const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  company: 'Spotify',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台',
};

const MOCK_HINTS = {
  reach: '- 你的分子是「打開 App」還是 **完成核心動作**？\n  - 登入不等於真實消費',
  depth: '- 每 session **真正投入** 的門檻是什麼？\n  - 時長 vs 完播率',
  frequency: '- **習慣養成** 的邊界？\n  - 排除促銷高峰',
  impact: '- NSM ↑ 如何具體帶動 **留存率**？\n  - 寫出因果鏈',
};

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

// Mock the hints endpoint (both auth + guest variants).
// page.route on the hints path intercepts and returns MOCK_HINTS — no real OpenAI call.
async function mockHintEndpoints(page) {
  const hintBody = JSON.stringify(MOCK_HINTS);
  await page.route('**/api/nsm-sessions/*/hints', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: hintBody });
  });
  await page.route('**/api/guest/nsm-sessions/*/hints', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: hintBody });
  });
}

// Seed NSM session + wire AppState for Step 1 with question selected.
// mockHintEndpoints must be called AFTER this function (bootApp calls unrouteAll).
async function seedAndNavigateToStep1(page) {
  await bootApp(page);
  await waitForAuth(page);

  const sessionId = await page.evaluate(async ({ qid, qjson }) => {
    const res = await window.apiFetch('/api/nsm-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, questionJson: qjson }),
    });
    if (!res.ok) throw new Error('seed NSM session failed: ' + res.status);
    const data = await res.json();
    const sid = data.sessionId || data.id;
    window.AppState.nsmSession = { id: sid };
    window.AppState.nsmSelectedQuestion = qjson;
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 1;
    window.render();
    return sid;
  }, { qid: QUESTION_ID, qjson: QUESTION_JSON });

  await expect(page.locator('[data-view="nsm"][data-nsm-step="1"]')).toBeVisible({ timeout: 10_000 });
  return sessionId;
}

test.describe('NSM Step 1 hint modal — Stage 1D D1', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('AC-D1-1: hint button visible after question selection → click → modal opens → 4 labeled sections with bullets', async ({ page }) => {
    await test.step('seed NSM session + navigate to Step 1', async () => {
      // bootApp calls unrouteAll, so mock AFTER boot
      await seedAndNavigateToStep1(page);
      await mockHintEndpoints(page);
    });

    await test.step('hint button is visible', async () => {
      const btn = page.locator('[data-nsm-step1-hint="open"]');
      await expect(btn).toBeVisible({ timeout: 5_000 });
      await expect(btn).toContainText('教練思路');
    });

    await test.step('click button → modal opens', async () => {
      await page.locator('[data-nsm-step1-hint="open"]').click();
      await expect(page.locator('#nsm-hint-modal-host .modal-card')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('modal contains 4 labeled sections', async () => {
      const sections = page.locator('.nsm-step1-hint-section');
      await expect(sections).toHaveCount(4, { timeout: 10_000 });

      const labels = page.locator('.nsm-step1-hint-section__label');
      await expect(labels.nth(0)).toContainText('觸及');
      await expect(labels.nth(1)).toContainText('深度');
      await expect(labels.nth(2)).toContainText('頻率');
      await expect(labels.nth(3)).toContainText('影響');
    });

    await test.step('each section has bullet list items', async () => {
      const sections = page.locator('.nsm-step1-hint-section');
      for (let i = 0; i < 4; i++) {
        const listItems = sections.nth(i).locator('ul.example-list > li');
        await expect(listItems.first()).toBeVisible();
      }
    });

    await test.step('first section bold text from mock data', async () => {
      const firstSection = page.locator('.nsm-step1-hint-section').first();
      await expect(firstSection.locator('strong').first()).toContainText('完成核心動作');
    });
  });

  test('AC-D1-2: re-open hits cache — only 1 network request', async ({ page }) => {
    let requestCount = 0;

    await test.step('setup mock + count requests', async () => {
      // bootApp calls unrouteAll, so mock AFTER boot
      await seedAndNavigateToStep1(page);
      await mockHintEndpoints(page);
      page.on('request', (req) => {
        if (req.url().includes('/hints')) requestCount += 1;
      });
    });

    await test.step('first open — 1 network request', async () => {
      await page.locator('[data-nsm-step1-hint="open"]').click();
      await expect(page.locator('.nsm-step1-hint-section')).toHaveCount(4, { timeout: 10_000 });
      expect(requestCount).toBe(1);
    });

    await test.step('close modal', async () => {
      // Click the X button in modal header
      await page.locator('.modal__close[data-nsm-modal-close]').click();
      await expect(page.locator('#nsm-hint-modal-host .modal-card')).not.toBeVisible({ timeout: 5_000 });
    });

    await test.step('re-open — still only 1 network request (cache hit)', async () => {
      await page.locator('[data-nsm-step1-hint="open"]').click();
      await expect(page.locator('.nsm-step1-hint-section')).toHaveCount(4, { timeout: 5_000 });
      expect(requestCount).toBe(1);
    });
  });

  test('AC-D1-3: close button removes modal', async ({ page }) => {
    await test.step('setup + open modal', async () => {
      // bootApp calls unrouteAll, so mock AFTER boot
      await seedAndNavigateToStep1(page);
      await mockHintEndpoints(page);
      await page.locator('[data-nsm-step1-hint="open"]').click();
      await expect(page.locator('.nsm-step1-hint-section')).toHaveCount(4, { timeout: 10_000 });
    });

    await test.step('click close → modal dismissed', async () => {
      // Click the 「了解了」 confirm button (data-nsm-modal-close="ok")
      await page.locator('[data-nsm-modal-close="ok"]').click();
      await expect(page.locator('#nsm-hint-modal-host .modal-card')).not.toBeVisible({ timeout: 5_000 });
      // host should be empty or not contain modal-card
      const modalCard = page.locator('#nsm-hint-modal-host .modal-card');
      await expect(modalCard).toHaveCount(0);
    });
  });
});
