// tests/visual/min-length-frontend.spec.js
// Layer 1 of Combo C — frontend minLength gate.
// Verifies submit-bar primary disabled when any required field below minMax floor.

const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function gotoSimC1(page) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head', { timeout: 5000 });
}

async function gotoDrillC1(page) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.mode-card');
  await page.locator('.mode-card').nth(1).click(); // drill mode
  await page.locator('.drill-pill:visible').first().click(); // C1 drill-pill
  await page.locator('.qcard').first().click();
  await page.locator('.qcard__btn--primary').click();
  await page.waitForSelector('.phase-head', { timeout: 5000 });
}

test.describe('Frontend minLength validation (Layer 1 Combo C)', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Phase 1 C1 simulation ────────────────────────────────────────────────

  test('Phase 1 C1 sim: all fields empty → submit disabled initially', async ({ page }) => {
    await gotoSimC1(page);
    const submit = page.locator('[data-phase1="submit"]').first();
    await expect(submit).toBeDisabled();
  });

  test('Phase 1 C1 sim: submit ENABLED when field 1 has single-repeated char (floors removed)', async ({ page }) => {
    await gotoSimC1(page);
    // Min-length floors removed — single-char-repeat is non-empty so no longer blocked
    // Only fully blank fields block submit now
    await page.evaluate(() => {
      window.AppState.circlesFrameworkDraft = {
        C1: {
          '問題範圍': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          '時間範圍': '時間',
          '業務影響': '影響',
          '假設確認': '假設',
        }
      };
      window.render();
    });
    const submit = page.locator('[data-phase1="submit"]').first();
    await expect(submit).toBeEnabled();
  });

  test('Phase 1 C1 sim: submit ENABLED when one field is short (only empty blocked now)', async ({ page }) => {
    await gotoSimC1(page);
    await page.evaluate(() => {
      // Min-length floors removed — any non-empty content is enough to unblock
      window.AppState.circlesFrameworkDraft = {
        C1: {
          '問題範圍': 'ok',  // short but non-empty → no longer blocked
          '時間範圍': '60 天',
          '業務影響': '廣告收入',
          '假設確認': '假設',
        }
      };
      window.render();
    });
    const submit = page.locator('[data-phase1="submit"]').first();
    await expect(submit).toBeEnabled();
  });

  test('Phase 1 C1 sim: submit ENABLED when all 4 fields have any content', async ({ page }) => {
    await gotoSimC1(page);
    await page.evaluate(() => {
      // Floors removed — any non-empty content unblocks submit
      window.AppState.circlesFrameworkDraft = {
        C1: {
          '問題範圍': '聚焦免費版廣告體驗排除付費方案重點在通勤族每日通勤聽podcast場景與廣告打斷影響及用戶收聽沉浸感',
          '時間範圍': '60天因廣告活動以月為週期需足夠觀察時間才能看出效果',
          '業務影響': '廣告收入和免費到付費轉換率不能下降超過3%這是業務紅線',
          '假設確認': '用戶廣告負感主要來自時段選擇而非廣告本身的內容品質',
        }
      };
      window.render();
    });
    const submit = page.locator('[data-phase1="submit"]').first();
    await expect(submit).toBeEnabled();
  });

  // ── Phase 1 C1 drill ─────────────────────────────────────────────────────

  test('Phase 1 C1 drill: all fields empty → submit disabled', async ({ page }) => {
    await gotoDrillC1(page);
    const submit = page.locator('[data-phase1="submit"]').first();
    await expect(submit).toBeDisabled();
  });

  test('Phase 1 C1 drill: submit ENABLED with sufficient content in all 4 fields', async ({ page }) => {
    await gotoDrillC1(page);
    await page.evaluate(() => {
      window.AppState.circlesFrameworkDraft = {
        C1: {
          '問題範圍': '聚焦免費版廣告體驗排除付費方案重點在通勤族每日通勤聽podcast場景與廣告打斷影響及用戶收聽沉浸感', // >=50
          '時間範圍': '60天因廣告活動以月為週期需足夠觀察時間才能看出效果效果效果效果', // >=30
          '業務影響': '廣告收入和免費到付費轉換率不能下降超過3%這是業務紅線需要嚴格守護不可突破否則整體商業目標無法達成', // >=40
          '假設確認': '用戶廣告負感主要來自時段選擇而非廣告本身的內容品質品質品質品質', // >=30
        }
      };
      window.render();
    });
    const submit = page.locator('[data-phase1="submit"]').first();
    await expect(submit).toBeEnabled();
  });

  // ── NSM Step 2 minLength ─────────────────────────────────────────────────

  const Q_ATTENTION = { id: 'q-att', company: 'Spotify', industry: '音樂串流', scenario: '為 Spotify 定義北極星指標', product: 'Spotify Music' };

  test('NSM Step 2: submit disabled when all fields empty', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-submit]');
    await expect(page.locator('[data-nsm-submit]')).toBeDisabled();
  });

  test('NSM Step 2: submit disabled when nsm too short (below 10 char floor)', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = {
        nsm: '短',  // 1 char — below floor=10
        explanation: '定義說明需要足夠字數才能通過最低長度驗證，請填寫完整說明',
        businessLink: '業務連結說明需要足夠字數才能通過最低長度驗證，請填寫完整說明'
      };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-submit]');
    await expect(page.locator('[data-nsm-submit]')).toBeDisabled();
  });

  test('NSM Step 2: submit ENABLED when all 3 fields meet their floors', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 2;
      window.AppState.nsmSubTab = 'nsm-step2';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = {
        nsm: '每月活躍聆聽用戶總數量',  // 11 chars — above floor=10
        explanation: '定義說明需要足夠字數才能通過最低長度驗證請填寫完整說明字數要達到三十個非空白字元',  // >30
        businessLink: '業務連結說明需要足夠字數才能通過最低長度驗證請填寫完整說明字數要達到三十個非空白字元'  // >30
      };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-submit]');
    await expect(page.locator('[data-nsm-submit]')).toBeEnabled();
  });

  // ── NSM Step 3 minLength ─────────────────────────────────────────────────

  test('NSM Step 3: submit disabled when dim fields below 20-char floor', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: '每月活躍聆聽用戶數', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.AppState.nsmBreakdown = { reach: '短', depth: '', frequency: '', retention: '' };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-submit]');
    await expect(page.locator('[data-nsm-submit]')).toBeDisabled();
  });

  test('NSM Step 3: submit ENABLED when all 4 dims meet 20-char floor', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: '每月活躍聆聽用戶數', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.AppState.nsmBreakdown = {
        reach: '每月觸碰核心播放功能且完整聽完一集的不重複用戶數',
        depth: '每位用戶每週的平均收聽時長與完成率結合品質指標',
        frequency: '過去 30 天內至少回訪 4 次並完整聽完至少一集的用戶比例',
        retention: '首次活躍後第 30 天仍保持每週至少一次收聽的留存率'
      };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-submit]');
    await expect(page.locator('[data-nsm-submit]')).toBeEnabled();
  });
});
