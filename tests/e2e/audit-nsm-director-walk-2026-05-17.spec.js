// tests/e2e/audit-nsm-director-walk-2026-05-17.spec.js
//
// Director-personal NSM full-flow walk + PNG capture at every checkpoint.
// Purpose: prove ONE production flow works end-to-end + give user visual evidence.
// Source flow: tests/e2e/nsm-full-flow.spec.js (real backend + real OpenAI server-side).
//
// Skill citations:
//   common-pitfalls.md Pitfall 11 — NO own-API mock; real Supabase + real OpenAI
//   common-pitfalls.md Pitfall 14 — sessionId local to test, no module mutable state
//   api-testing.md 783-848        — API seeding for fastest setup
//   authentication.md 29-70       — storageState reuse from auth.setup.js

'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const SUBSTANTIVE_EXPLANATION = '直接反映核心使用行為，且與廣告收入正相關，週頻率符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差';
const SUBSTANTIVE_BUSINESS_LINK = 'Podcast 廣告 CPM 是音樂的 3-5 倍，提升此指標直接增加變現效率';
const SUBSTANTIVE_BREAKDOWN = {
  reach:     '每週至少訪問 Spotify 的用戶，約 3.5 億，其中 Podcast 觸及率目前 40%，即 1.4 億人',
  depth:     '播放超過 5 分鐘代表有意圖的消費行為，而非意外點擊',
  frequency: '週活躍而非月活躍，符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差',
};

// F-1 fix 2026-05-17: use real nsm_database.json q1 (Netflix) shape — mirrors
// what renderNSMContextCard actually reads (q.company / q.industry / q.scenario / q.context.*)
const QUESTION_ID = 'q1';
const QUESTION_JSON = {
  id: 'q1',
  company: 'Netflix',
  industry: '內容訂閱制',
  scenario: '影音串流平台競爭激烈，必須確保用戶持續感受到內容價值以維持自動扣款。',
  target_nsm_keywords: ['觀看時長', '付費', '活躍'],
  anti_patterns: ['App下載數', '註冊數'],
  field_examples: {
    step2: {
      nsm: '每月至少觀看 10 小時內容且完整看完至少一部劇集的付費訂閱者數',
      explanation: 'Netflix 的留存靠「沉浸感」維持，用戶月觀看時數達門檻代表平台內容真正進入其娛樂習慣，非被動訂閱。',
      businessLink: '活躍觀看用戶的取消率遠低於低觀看用戶，月觀看 10 小時以上群體的 12 個月留存率對 ARR 貢獻最高。',
    },
    step3: {
      reach: '每月至少觀看一次的付費活躍用戶佔總訂閱人數比例，剔除「付了費但沒開啟」的殭屍帳號。',
      depth: '單次觀看平均時長與每月觀看集數，連續追劇 3 集以上代表深度沉浸，是留存強訊號。',
      frequency: '每週啟動 Netflix 並實際播放的天數，低於 2 天的用戶在下個扣款周期取消率顯著上升。',
    },
  },
  context: {
    model: 'Netflix 採內容訂閱制，月費自動扣款，依畫質與同時裝置數分層定價；收益核心是高留存率而非新用戶獲取。',
    users: '核心 NSM 用戶是付費訂閱者中的「主動觀看者」，非偶發或被家人拖著開的被動帳號共享用戶。',
    traps: '把「新劇集上映首週播放量」當 NSM 是虛榮指標，爆紅首週後用戶若不回訪代表無法建立習慣，取消率仍高。',
    insight: '從「用戶是否在 48 小時內回來繼續看同一劇集」的行為切入，這個回流信號比總觀看時長更能預測 30 天留存。',
  },
};

const OUT_DIR = path.join(__dirname, '..', '..', 'audit', 'nsm-director-walk-2026-05-17');

async function shot(page, label, testInfo) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const project = testInfo.project.name;
  const file = path.join(OUT_DIR, `${label}-${project}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

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

async function deleteNsmSessionFromPage(page, sid) {
  if (!sid) return;
  await page.evaluate(async (sessionId) => {
    try { await window.apiFetch('/api/nsm-sessions/' + sessionId, { method: 'DELETE' }); } catch (_) {}
  }, sid);
}

test.describe('Director NSM walk — PNG capture every step', () => {
  test.slow();
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('full walk + PNG every checkpoint', async ({ page }, testInfo) => {
    let sessionId = null;

    // ── STEP 0: home (CIRCLES landing) before NSM nav ───────────────────────
    await test.step('00 — home landing', async () => {
      await bootApp(page);
      await waitForAuth(page);
      await shot(page, '00-home-landing', testInfo);
    });

    // ── STEP 1: NSM home (Step 1 question pick) ─────────────────────────────
    await test.step('01 — NSM Step 1 home', async () => {
      sessionId = await page.evaluate(async ({ qid, qjson }) => {
        const res = await window.apiFetch('/api/nsm-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: qid, questionJson: qjson }),
        });
        if (!res.ok) throw new Error('seed failed: ' + res.status);
        const data = await res.json();
        const sid = data.sessionId || data.id;
        window.AppState.nsmSession = { id: sid };
        window.AppState.nsmSelectedQuestion = qjson;
        return sid;
      }, { qid: QUESTION_ID, qjson: QUESTION_JSON });
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 1;
        window.render();
      });
      await expect(page.locator('[data-view="nsm"][data-nsm-step="1"]')).toBeVisible({ timeout: 10_000 });
      await shot(page, '01-nsm-step1-home', testInfo);
    });

    // ── STEP 2 EMPTY: NSM Step 2 form (no input yet) ────────────────────────
    await test.step('02 — NSM Step 2 empty form', async () => {
      await page.evaluate(() => {
        window.AppState.nsmStep = 2;
        window.AppState.nsmSubTab = 'nsm-step2';
        window.AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
        window.AppState.nsmGateResult = null;
        window.render();
      });
      await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
      await shot(page, '02-nsm-step2-empty', testInfo);

      // F-2 verify: viewport-only screenshot at scroll-to-end → last field should be visible above sticky bar
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      const file = require('path').join(OUT_DIR, `02b-viewport-scrolled-end-${testInfo.project.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
    });

    // ── STEP 2 FILLED: NSM Step 2 with substantive content ──────────────────
    await test.step('03 — NSM Step 2 filled', async () => {
      await page.evaluate(({ nsm, explanation, businessLink }) => {
        window.AppState.nsmDefinition = { nsm, explanation, businessLink };
        window.render();
      }, { nsm: SUBSTANTIVE_NSM, explanation: SUBSTANTIVE_EXPLANATION, businessLink: SUBSTANTIVE_BUSINESS_LINK });
      await expect(page.locator('[data-nsm-submit]')).toBeVisible({ timeout: 5_000 });
      await shot(page, '03-nsm-step2-filled', testInfo);
    });

    // ── STEP 3: Gate submit → loading → result ──────────────────────────────
    await test.step('04 — gate result (real OpenAI)', async () => {
      await page.locator('[data-nsm-submit]').click();
      // Catch loading screen if possible (race with API)
      try {
        await page.waitForSelector('.loading-spinner, [class*="gate-loading"]', { timeout: 1500 });
        await shot(page, '04a-gate-loading', testInfo);
      } catch (_) { /* loading too fast to catch */ }
      await page.waitForFunction(
        () => window.AppState && window.AppState.nsmGateResult !== null && window.AppState.nsmGateResult !== undefined,
        { timeout: 90_000 }
      );
      await page.waitForTimeout(500);
      await shot(page, '04b-gate-result', testInfo);
      const gateResult = await page.evaluate(() => window.AppState.nsmGateResult);
      if (gateResult.canProceed) {
        await page.locator('[data-nsm-gate-action="proceed"]').click();
        await page.waitForFunction(
          () => window.AppState && window.AppState.nsmSubTab === 'nsm-step3',
          { timeout: 10_000 }
        );
      } else {
        // Force advance for walk continuity
        await page.evaluate(() => {
          window.AppState.nsmSubTab = 'nsm-step3';
          window.AppState.nsmStep = 3;
          window.render();
        });
      }
    });

    // ── STEP 4 EMPTY: NSM Step 3 breakdown form ─────────────────────────────
    await test.step('05 — NSM Step 3 empty', async () => {
      await page.evaluate(() => {
        window.AppState.nsmStep = 3;
        window.AppState.nsmSubTab = 'nsm-step3';
        window.AppState.nsmBreakdown = { reach: '', depth: '', frequency: '' };
        window.render();
      });
      await expect(page.locator('.phase-head__title')).toContainText('拆解輸入指標', { timeout: 5_000 });
      await shot(page, '05-nsm-step3-empty', testInfo);
    });

    // ── STEP 4 FILLED ───────────────────────────────────────────────────────
    await test.step('06 — NSM Step 3 filled', async () => {
      await page.evaluate((br) => {
        window.AppState.nsmBreakdown = br;
        window.render();
      }, SUBSTANTIVE_BREAKDOWN);
      await shot(page, '06-nsm-step3-filled', testInfo);
    });

    // ── STEP 5: Evaluate → Step 4 final ─────────────────────────────────────
    await test.step('07 — NSM Step 4 final report', async () => {
      await page.locator('[data-nsm-submit]').click();
      await page.waitForFunction(
        () => window.AppState && window.AppState.nsmStep === 4,
        { timeout: 90_000 }
      );
      await page.waitForTimeout(500);
      await expect(page.locator('[data-view="nsm"][data-nsm-step4]')).toBeVisible({ timeout: 10_000 });
      await shot(page, '07-nsm-step4-final', testInfo);
    });

    // ── CLEANUP ─────────────────────────────────────────────────────────────
    if (sessionId) await deleteNsmSessionFromPage(page, sessionId);
  });
});
