const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setupNSMStep2(page, q) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ q }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-step2';
    window.AppState.nsmSelectedQuestion = q;
    window.render();
  }, { q });
  await page.waitForSelector('[data-nsm-field="nsm"]', { timeout: 3000 });
}

const Q_ATTENTION = {
  id: 'q-att', company: 'Spotify', industry: '音樂串流',
  scenario: '為 Spotify 定義北極星指標，衡量用戶日常收聽行為', product: 'Spotify Music',
  field_examples: {
    step2: {
      nsm: '- 行為動詞：**每月完成**至少一首完整曲目播放\n- 量化門檻：月活躍用戶',
      explanation: '- 活躍用戶定義：每月至少播放一首完整歌曲\n- 量化指標清楚',
      businessLink: '- 直接關聯訂閱留存率\n- 用戶收聽越多越難取消訂閱',
    },
    step3: {
      reach: '- 母群體：月活躍訂閱用戶\n- 達標：播放任一曲目 ≥ 30 秒',
      depth: '- 深度行為：每月播放時長超過 10 小時',
      frequency: '- 週期：每週\n- 頻率：至少 3 次播放行為',
      impact: '- 三個月留存率 > 80%',
    },
  },
};
const Q_SAAS      = { id: 'q-saas', company: 'Slack', industry: 'B2B SaaS', scenario: 'Workspace activation', product: 'Slack' };

test.describe('NSM Step 2 + Step 3 (mockup 07)', () => {
  test('Step 2 renders 3-step guide + 3 fields (no sub-tabs per mockup 07 v3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    expect(await page.locator('.nsm-sub-tab').count()).toBe(0);
    expect(await page.locator('.nsm-sub-tabs').count()).toBe(0);
    expect(await page.locator('.nsm-guide__step').count()).toBe(3);
    expect(await page.locator('.nsm-field').count()).toBe(3);
  });

  test('Step 2 example-toggle expands example', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    var firstToggle = page.locator('[data-nsm-example-toggle]').first();
    await firstToggle.click();
    // New LOCKED class structure: .example-expand rendered inline after toggle
    await expect(page.locator('.nsm-field .example-expand').first()).toBeVisible();
  });

  test('Step 2 NSM input typing updates AppState.nsmDefinition.nsm', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    await page.locator('[data-nsm-field="nsm"]').fill('每月活躍聆聽用戶數');
    var v = await page.evaluate(() => window.AppState.nsmDefinition && window.AppState.nsmDefinition.nsm);
    expect(v).toBe('每月活躍聆聽用戶數');
  });

  test('Step 2 提交審核 disabled when nsm or businessLink empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    var btn = page.locator('[data-nsm-submit]');
    await expect(btn).toBeDisabled();
  });

  test('Step 2 提交審核 enabled when all 3 fields meet minLength floor', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep2(page, Q_ATTENTION);
    await page.evaluate(() => {
      // nsm floor=10, explanation floor=30, businessLink floor=30 (non-whitespace chars)
      window.AppState.nsmDefinition = {
        nsm: '每月活躍聆聽用戶總數量',  // 11 chars — above floor=10
        explanation: '定義說明需要足夠字數才能通過最低長度驗證請填寫完整說明內容字數需達到三十個非空白字元',  // >30
        businessLink: '業務連結說明需要足夠字數才能通過最低長度驗證請填寫完整說明字數需達到三十個非空白字元以上'  // >30
      };
      window.render();
    });
    await expect(page.locator('[data-nsm-submit]')).toBeEnabled();
  });

  test('Step 3 attention type renders 4 dim labels: 觸及/互動/習慣/留存', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: 'X', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' }; // unlock step3 sub-tab
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('.nsm-dim');
    var labels = await page.locator('.nsm-dim__label').allTextContents();
    expect(labels).toEqual(['觸及廣度', '互動深度', '習慣頻率', '留存驅力']);
  });

  test('Step 3 saas type renders 4 dim labels: 啟用/席次/黏著/擴張', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: 'X', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.render();
    }, { q: Q_SAAS });
    await page.waitForSelector('.nsm-dim');
    var labels = await page.locator('.nsm-dim__label').allTextContents();
    expect(labels).toEqual(['啟用廣度', '席次深度', '黏著頻率', '擴張信號']);
  });

  test('Step 3 dim hint-toggle expands hint', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      // depth dim for saas has hint content — toggle it open
      window.AppState.nsmHintExpanded = { depth: true };
      window.render();
    }, { q: Q_SAAS });
    await page.waitForSelector('.nsm-dim__hint-btn');
    await expect(page.locator('.nsm-dim__hint-content').first()).toBeVisible();
  });

  test('Step 3 dim textarea typing updates AppState.nsmBreakdown', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('[data-nsm-dim="reach"]');
    await page.locator('[data-nsm-dim="reach"]').first().fill('reach-test-content');
    await page.waitForTimeout(100);
    var v = await page.evaluate(() => window.AppState.nsmBreakdown && window.AppState.nsmBreakdown.reach);
    expect(v).toContain('reach-test-content');
  });

  test('Step 3 提交審核 disabled when any dim empty', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.AppState.nsmBreakdown = { reach: 'A', depth: '', frequency: '', impact: '' };
      window.render();
    }, { q: Q_ATTENTION });
    await expect(page.locator('[data-nsm-submit]')).toBeDisabled();
  });

  test('Step 3 attention dims desc verbatim from mockup 07', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: 'X', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.render();
    }, { q: Q_ATTENTION });
    await page.waitForSelector('.nsm-dim__desc');
    var descs = await page.locator('.nsm-dim__desc').allTextContents();
    expect(descs).toEqual([
      '有多少用戶真正觸碰到核心功能（非僅登入）',
      '每位用戶每次使用的品質與投入程度',
      '用戶是否形成定期回訪的使用習慣',
      '什麼讓用戶持續回訪而非逐漸流失',
    ]);
  });

  test('Step 3 saas dims desc verbatim from mockup 07', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page);
    await page.goto('/');
    await page.evaluate(({ q }) => {
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSubTab = 'nsm-step3';
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmDefinition = { nsm: 'X', explanation: 'Y', businessLink: 'Z' };
      window.AppState.nsmGateResult = { overall_status: 'ok' };
      window.render();
    }, { q: Q_SAAS });
    await page.waitForSelector('.nsm-dim__desc');
    var descs = await page.locator('.nsm-dim__desc').allTextContents();
    expect(descs).toEqual([
      '新客戶中有多少真正完成啟用',
      '每個帳號內有多少人在真正使用核心功能',
      '使用頻率是否顯示產品已嵌入日常工作流',
      '現有客戶是否在增加使用',
    ]);
  });
});
