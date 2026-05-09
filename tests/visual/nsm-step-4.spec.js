const { test, expect } = require('@playwright/test');

async function mockApis(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

const Q_ATTENTION = {
  id: 'q-spotify',
  company: 'Spotify',
  industry: '音樂串流',
  scenario: '為 Spotify Podcast 定義北極星指標，衡量用戶收聽行為與留存',
  product: 'Spotify Podcast'
};

const MOCK_EVAL_RESULT = {
  scores: {
    alignment: 4,
    leading: 4,
    actionability: 5,
    simplicity: 4,
    sensitivity: 3
  },
  totalScore: 80,
  coachComments: {
    alignment: '與商業價值連結清楚，能直接對應產品 PMF 階段。',
    leading: '是領先指標，但可進一步驗證與留存的因果關係。',
    actionability: '可被 PM/設計團隊每日直接優化，定義具體可量測。',
    simplicity: '指標名稱清楚，但定義公式可進一步簡化。',
    sensitivity: '對週期敏感度尚可，但缺乏 30/60/90 day milestone。'
  },
  coachTree: {
    nsm: '每月新增啟動並留存到第 30 天的 Premium 試用者數',
    reach: '所有曝過情境式提示的 Free 用戶（月活）',
    depth: '看到提示後進入 Premium 試用頁的轉化率',
    frequency: '試用期內每週啟動 Premium 功能的天數 ≥ 4 天',
    impact: '試用結束後 30 天內完成訂閱的轉換率'
  },
  coachRationale: {
    nsm: '教練版 NSM 聚焦於「啟動 → 留存到 30 天」，而非廣泛的月活躍，因為後者容易被短期廣告觸及拉高。',
    reach: '觸及廣度應量到真正接觸到核心功能（升級提示）的用戶，而非平台總曝光。',
    depth: '深度指標應衡量從看到提示到真正進入試用頁的轉化，反映真實意圖。',
    frequency: '習慣頻率以「試用期內每週 ≥ 4 天啟動 Premium 功能」，確保黏著行為形成。',
    impact: '業務影響以 30 天內付費轉換率，直接連結商業變現。'
  },
  bestMove: '把 NSM 拆成「啟用 → 留存」兩階段，準確反映漏斗本質，比單純看總人數更能驅動產品決策。',
  mainTrap: '指標可能被「短期廣告觸及」拉高，建議搭配真實互動數據（如試用期內每週啟動天數）佐證。',
  summary: '整體 NSM 設計扎實，能反映產品健康。下一步建議補上 milestone 與虛榮檢驗以強化指標可信度。'
};

async function setupNSMStep4(page, overrides) {
  await mockApis(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
  await page.evaluate(({ q, evalResult, tab }) => {
    window.AppState.view = 'nsm';
    window.AppState.nsmStep = 4;
    window.AppState.nsmReportTab = tab || 'overview';
    window.AppState.nsmSelectedQuestion = q;
    window.AppState.nsmDefinition = {
      nsm: '每月活躍 Premium 試用者數',
      explanation: '定義說明字數需要夠長才能通過最低驗證',
      businessLink: '業務連結說明需要夠長才能通過最低驗證'
    };
    window.AppState.nsmBreakdown = {
      reach: '所有 Spotify 月活用戶',
      depth: '點擊試用按鈕進入試用頁的人數',
      frequency: '試用期間每週使用天數',
      impact: '試用後付費轉換率'
    };
    window.AppState.nsmEvalResult = evalResult;
    window.AppState.nsmActiveCompareNode = null;
    window.render();
  }, { q: Q_ATTENTION, evalResult: MOCK_EVAL_RESULT, tab: overrides && overrides.tab });
  await page.waitForSelector('[data-nsm-step4]', { timeout: 5000 });
}

test.describe('NSM Step 4 — 總覽 tab (mockup 14 Section A)', () => {
  test('renders tab-bar with 4 tabs, 總覽 active by default', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page);
    const tabs = page.locator('.tab-bar__btn');
    await expect(tabs).toHaveCount(4);
    await expect(page.locator('.tab-bar__btn.is-active')).toHaveText('總覽');
  });

  test('renders nsm-summary with totalScore 80 / 100', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page);
    await expect(page.locator('.nsm-summary__score')).toHaveText('80');
    await expect(page.locator('.nsm-summary__unit')).toHaveText('/ 100');
  });

  test('renders 5-axis pentagon radar SVG', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page);
    await expect(page.locator('.nsm-radar-svg')).toBeVisible();
    await expect(page.locator('.nsm-radar-svg .poly')).toBeVisible();
    // 5 dots
    const dots = page.locator('.nsm-radar-svg .dot');
    await expect(dots).toHaveCount(5);
    // 5 labels
    const labels = page.locator('.nsm-radar-svg .label');
    await expect(labels).toHaveCount(5);
  });

  test('renders 5 score rows with dim names', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page);
    const rows = page.locator('.nsm-score-row');
    await expect(rows).toHaveCount(5);
    // Check 5 dim names
    const names = await page.locator('.nsm-score-row__name').allTextContents();
    expect(names).toContain('價值關聯');
    expect(names).toContain('領先指標');
    expect(names).toContain('操作性');
    expect(names).toContain('可理解性');
    expect(names).toContain('週期敏感');
  });

  test('score 5 renders --high class, score 3 renders --mid class', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page);
    // actionability=5 should be high
    const highScores = page.locator('.nsm-score-row__score--high');
    expect(await highScores.count()).toBeGreaterThan(0);
    // sensitivity=3 → mid
    const midScores = page.locator('.nsm-score-row__score--mid');
    expect(await midScores.count()).toBeGreaterThan(0);
  });

  test('desktop viewport applies nsm-overview--desktop class', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page);
    await expect(page.locator('.nsm-overview--desktop')).toBeVisible();
  });

  test('mobile viewport does NOT apply nsm-overview--desktop class', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupNSMStep4(page);
    await expect(page.locator('.nsm-overview--desktop')).toHaveCount(0);
  });
});

test.describe('NSM Step 4 — 對比 tab (mockup 14 Section B)', () => {
  test('clicking 對比 tab switches active tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page);
    await page.locator('.tab-bar__btn', { hasText: '對比' }).click();
    await expect(page.locator('.tab-bar__btn.is-active')).toHaveText('對比');
  });

  test('mobile 對比 tab renders nsm-compare--stack layout with 5 dim blocks', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupNSMStep4(page, { tab: 'comparison' });
    const blocks = page.locator('.nsm-compare-block');
    await expect(blocks).toHaveCount(5);
    await expect(page.locator('.nsm-compare--stack')).toBeVisible();
  });

  test('desktop 對比 tab renders nsm-compare--grid with header row + 5 data rows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'comparison' });
    await expect(page.locator('.nsm-compare--grid')).toBeVisible();
    await expect(page.locator('.nsm-compare-grid__header')).toBeVisible();
    const rows = page.locator('.nsm-compare-grid__row');
    await expect(rows).toHaveCount(5);
  });

  test('clicking coach card sets is-active and shows coach detail panel (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'comparison' });
    // Click first coach card in grid
    const coachCard = page.locator('.nsm-compare-card--coach').first();
    await coachCard.click();
    await expect(page.locator('.nsm-compare-card--coach.is-active').first()).toBeVisible();
    await expect(page.locator('.nsm-coach-detail')).toBeVisible();
  });

  test('clicking coach card on mobile shows bottom-sheet detail', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupNSMStep4(page, { tab: 'comparison' });
    const coachCard = page.locator('.nsm-compare-card--coach').first();
    await coachCard.click();
    await expect(page.locator('.nsm-detail-sheet')).toBeVisible();
    await expect(page.locator('.nsm-detail-sheet__handle')).toBeVisible();
  });

  test('closing coach detail (x button) removes panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'comparison' });
    await page.locator('.nsm-compare-card--coach').first().click();
    await expect(page.locator('.nsm-coach-detail')).toBeVisible();
    await page.locator('.nsm-coach-detail__close').click();
    await expect(page.locator('.nsm-coach-detail')).toHaveCount(0);
  });
});

test.describe('NSM Step 4 — 亮點 tab (mockup 14 Section C)', () => {
  test('亮點 tab renders 4 highlight cards', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'highlights' });
    const cards = page.locator('.nsm-highlight');
    await expect(cards).toHaveCount(4);
  });

  test('最大亮點 card has --best modifier + ph-trophy icon', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'highlights' });
    await expect(page.locator('.nsm-highlight--best')).toBeVisible();
    await expect(page.locator('.nsm-highlight--best .ph-trophy')).toBeVisible();
  });

  test('主要陷阱 card has --trap modifier + ph-warning-circle icon', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'highlights' });
    await expect(page.locator('.nsm-highlight--trap')).toBeVisible();
    await expect(page.locator('.nsm-highlight--trap .ph-warning-circle')).toBeVisible();
  });

  test('下一步建議 card has --next modifier with border-left success', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'highlights' });
    await expect(page.locator('.nsm-highlight--next')).toBeVisible();
    await expect(page.locator('.nsm-highlight--next .ph-arrow-right')).toBeVisible();
  });

  test('desktop 亮點 applies nsm-highlights--desktop class', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'highlights' });
    await expect(page.locator('.nsm-highlights--desktop')).toBeVisible();
  });

  test('tablet 亮點 applies nsm-highlights--tablet class', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupNSMStep4(page, { tab: 'highlights' });
    await expect(page.locator('.nsm-highlights--tablet')).toBeVisible();
  });

  test('mobile 亮點 applies base nsm-highlights (no modifier)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupNSMStep4(page, { tab: 'highlights' });
    await expect(page.locator('.nsm-highlights')).toBeVisible();
    await expect(page.locator('.nsm-highlights--desktop')).toHaveCount(0);
    await expect(page.locator('.nsm-highlights--tablet')).toHaveCount(0);
  });
});

test.describe('NSM Step 4 — 完成 tab (mockup 14 Section D)', () => {
  test('完成 tab renders done-panel with check-circle icon', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'done' });
    await expect(page.locator('.done-panel')).toBeVisible();
    await expect(page.locator('.done-panel__icon .ph-check-circle')).toBeVisible();
  });

  test('done-panel title says 完成這次 NSM 訓練', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'done' });
    await expect(page.locator('.done-panel__title')).toHaveText('完成這次 NSM 訓練');
  });

  test('done-panel shows score in body text', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'done' });
    const body = await page.locator('.done-panel__body').textContent();
    expect(body).toContain('80 分');
  });

  test('再練一題 button exists in done panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'done' });
    await expect(page.locator('[data-nsm4-action="retry"]')).toBeVisible();
  });

  test('desktop done panel shows 回首頁 ghost button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'done' });
    await expect(page.locator('[data-nsm4-action="home"]')).toBeVisible();
  });

  test('mobile done panel does NOT show 回首頁 ghost button', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupNSMStep4(page, { tab: 'done' });
    await expect(page.locator('[data-nsm4-action="home"]')).toHaveCount(0);
  });

  test('done-secondary tip card renders 3 list items', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'done' });
    const items = page.locator('.done-secondary__list li');
    await expect(items).toHaveCount(3);
  });
});

test.describe('NSM Step 4 — nsm-summary + navigation', () => {
  test('nsm-nav back button navigates back (nsmStep=3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page);
    await page.locator('.nsm-nav__back').click();
    const step = await page.evaluate(() => window.AppState.nsmStep);
    expect(step).toBe(3);
  });

  test('再練一題 in done tab resets nsmStep to 1', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupNSMStep4(page, { tab: 'done' });
    await page.locator('[data-nsm4-action="retry"]').click();
    const step = await page.evaluate(() => window.AppState.nsmStep);
    expect(step).toBe(1);
  });
});
