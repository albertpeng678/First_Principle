// tests/e2e/nsm-dim-card-hint-row-position.spec.js
//
// Phase 1B Wave b — Bug B (NSM dim card hint+example 不在 head row)
// Verifies renderNSMDim template uses canonical .field__label-row + .field__hint-row pattern
// so that hint/example buttons appear inline with dim label (right-aligned), NOT below in body.
//
// Skills applied (RITUAL §3 + /Users/albertpeng/.claude/skills/playwright-skill/core/):
//   §3.13 visual-regression.md — toHaveScreenshot 0.5% threshold pattern
//   §3.4 / Pitfall 18 — page.evaluate getBoundingClientRect for top-alignment assert
//   §3.6 / Pitfall 3 — data-attr locators (data-nsm-dim, data-dim-id)
//   §3.11 mobile-and-responsive.md 49-71 — 3 vp cross-vp
//   §3.18 5x consecutive 0 flake
//   Pitfall 11 — service-role seed via page.evaluate apiFetch, no own API mock
//   Pitfall 14 — test-local fixture (sessionId scoped per-test)
//   Reference mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html:1355-1384 (canonical pattern)
//   Reference STANDING: memory feedback_hint_example_unified_component

'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');

// --- Test fixture constants ---
const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  company: 'Spotify',
  product_context: 'Spotify 是全球最大的音樂串流平台，提供音樂、Podcast 和有聲書服務',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  nsm_type: 'attention',
  field_examples: {
    step3: {
      reach:     '每月使用 Spotify Podcast 的活躍 MAU 占總音樂用戶比例（達到 5 分鐘 + 1 集門檻）',
      depth:     '平均每次 Podcast 收聽時長 / 完播率（完整收聽 80% 以上為有效播放）',
      frequency: 'Podcast 用戶 DAU/MAU 比（目標 >40%，反映習慣形成）',
    },
  },
};

// Audit PNG output dir (human review, separate from toHaveScreenshot baseline)
const AUDIT_DIR = path.join(__dirname, '..', '..', 'audit', 'Bug-B-evidence');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function bootApp(page) {
  // Pitfall 14: clear localStorage before each test to avoid cross-test state
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  // Block session-resume calls so we get a clean boot
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

// Seed NSM session via real apiFetch (Pitfall 11 — no mock of own API),
// then wire AppState to Step 3 with breakdown values so dim cards render.
async function seedAndNavigateToStep3(page) {
  await bootApp(page);
  await waitForAuth(page);

  const sessionId = await page.evaluate(async ({ qid, qjson }) => {
    // Create NSM session
    const res = await window.apiFetch('/api/nsm-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, questionJson: qjson }),
    });
    if (!res.ok) throw new Error('seed NSM session failed: ' + res.status);
    const data = await res.json();
    const sid = data.sessionId || data.id;

    // Wire AppState to Step 3 ready state
    window.AppState.nsmSession = { id: sid };
    window.AppState.nsmSelectedQuestion = qjson;
    window.AppState.nsmDefinition = { nsm: '提高 Podcast 發現率，讓用戶找到並訂閱喜好節目' };
    // Provide non-empty breakdown so submit button is enabled + all dims render with content
    window.AppState.nsmBreakdown = {
      reach:     '每月至少播放 1 首歌的月活用戶數（不是登入數）',
      depth:     '每次 Podcast 平均收聽時長 > 10 分鐘',
      frequency: 'Podcast DAU/MAU > 35%',
    };
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 3;
    window.AppState.nsmSubTab = 'nsm-step3';
    window.render();
    return sid;
  }, { qid: QUESTION_ID, qjson: QUESTION_JSON });

  // Wait for Step 3 view with dim cards
  await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
  // Wait for at least one dim card
  await expect(page.locator('.nsm-dim').first()).toBeVisible({ timeout: 10_000 });

  return sessionId;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Bug B — NSM dim card hint+example 必須在 label-row 右側（mockup 07 line 1355-1384）', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  // ── AC-1: structural positive ── hint-row 必須在 field__label-row 內 ──────
  test('AC-1 structural positive: .field__label-row 包含 .field__hint-row', async ({ page }, testInfo) => {
    await seedAndNavigateToStep3(page);

    // Each dim card must have .field__label-row > .field__hint-row
    const dims = page.locator('.nsm-dim');
    const dimCount = await dims.count();
    expect(dimCount).toBeGreaterThan(0);

    for (let i = 0; i < dimCount; i++) {
      const dimHintRow = dims.nth(i).locator('.field__label-row .field__hint-row');
      await expect(dimHintRow).toBeVisible({ timeout: 5_000 });
    }

    // Capture audit PNG for human review
    const vp = testInfo.project.name;
    await page.locator('.nsm-dim').first().screenshot({
      path: path.join(AUDIT_DIR, `${vp}-step3-dim-card-ac1.png`),
    });
  });

  // ── AC-2: structural negative ── hint-row 不能在 nsm-dim__body 內 ─────────
  test('AC-2 structural negative: .nsm-dim__body 內不能有 .field__hint-row', async ({ page }) => {
    await seedAndNavigateToStep3(page);

    // The hint-row must NOT be inside nsm-dim__body (old broken structure)
    const hintRowsInBody = page.locator('.nsm-dim .nsm-dim__body .field__hint-row');
    await expect(hintRowsInBody).toHaveCount(0);
  });

  // ── AC-3: boundingRect 同行 ── label top ≈ hint-row top (≤4px tolerance) ──
  test('AC-3 bounding-rect: label top 與 hint-row top 差 ≤ 4px（同行對齊）', async ({ page }) => {
    await seedAndNavigateToStep3(page);

    // §3.4 / Pitfall 18: use page.evaluate + getBoundingClientRect
    const alignmentResults = await page.evaluate(() => {
      const dims = Array.from(document.querySelectorAll('.nsm-dim'));
      return dims.map((dim, i) => {
        const labelRow = dim.querySelector('.field__label-row');
        const label = labelRow && labelRow.querySelector('.field__label');
        const hintRow = labelRow && labelRow.querySelector('.field__hint-row');
        if (!label || !hintRow) {
          return { dimIndex: i, error: 'missing label or hintRow in labelRow', labelTop: null, hintTop: null };
        }
        const labelRect = label.getBoundingClientRect();
        const hintRect = hintRow.getBoundingClientRect();
        return {
          dimIndex: i,
          labelTop: Math.round(labelRect.top),
          hintTop: Math.round(hintRect.top),
          diff: Math.abs(labelRect.top - hintRect.top),
        };
      });
    });

    for (const result of alignmentResults) {
      expect(result.error, `dim[${result.dimIndex}] error: ${result.error}`).toBeUndefined();
      expect(result.diff, `dim[${result.dimIndex}] label top=${result.labelTop} hintRow top=${result.hintTop} — diff must be ≤4px`).toBeLessThanOrEqual(4);
    }
  });

  // ── AC-4: visual regression ── toHaveScreenshot 0.5% threshold ──────────
  test('AC-4 visual regression: first dim card toHaveScreenshot baseline', async ({ page }, testInfo) => {
    await seedAndNavigateToStep3(page);

    const vp = testInfo.project.name;
    const firstDim = page.locator('.nsm-dim').first();
    await expect(firstDim).toHaveScreenshot(`nsm-dim-hint-row-${vp}.png`, {
      maxDiffPixelRatio: 0.005,
    });
  });
});
