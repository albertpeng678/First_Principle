// tests/visual/capture-phase2-pngs.spec.js
// Phase 2 Verification Bundle — NSM Step 2 hint+example modal visual captures
// 7 scenarios × 3 viewports = 21 PNG
// Output: audit/png-phase2/
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../../audit/png-phase2');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 1100 },
  { name: 'ipad-768', width: 768, height: 1100 },
  { name: 'desktop-1280', width: 1280, height: 1100 },
];

async function mockBaseApis(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/guest/nsm-sessions**', async (route, request) => {
    if (request.method() === 'POST') return route.fulfill({ status: 200, body: JSON.stringify({ id: 's1', sessionId: 's1' }) });
    return route.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/api/nsm-context**', r => r.fulfill({
    status: 200, body: JSON.stringify({
      model: 'Netflix 訂閱+廣告變現',
      users: '影音娛樂消費者',
      traps: '把 DAU 當 NSM',
      insight: '反映用戶在平台上花費時間深度消費內容'
    })
  }));
}

const SCENARIOS = [
  {
    name: 'A-step2-fields-locked-hint-row',
    desc: 'NSM Step 2 — 3 fields 各有 hint + example 按鈕 (LOCKED hint-row)',
    setup: async (page) => {
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 2;
        window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
        window.render();
      });
      await page.waitForSelector('.nsm-field .field__hint-link');
    },
  },
  {
    name: 'B-step2-example-expanded-bullets',
    desc: 'NSM Step 2 — 展開第一欄 (nsm) 範例，顯示 q.field_examples.step2.nsm 內容',
    setup: async (page) => {
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 2;
        window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
        window.render();
      });
      await page.waitForSelector('.field-example-toggle');
      await page.locator('.field-example-toggle').first().click();
      await page.waitForTimeout(300);
      await page.waitForSelector('.example-expand');
    },
  },
  {
    name: 'C-step3-attention-dims-locked',
    desc: 'NSM Step 3 — 4 dim cards 各有 example 按鈕 (attention product type)',
    setup: async (page) => {
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 3;
        window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
        window.render();
      });
      await page.waitForSelector('.nsm-dim');
    },
  },
  {
    name: 'D-step3-dim-example-expanded',
    desc: 'NSM Step 3 — 展開第一 dim 範例，顯示 q.field_examples.step3.reach 內容',
    setup: async (page) => {
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 3;
        window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
        window.render();
      });
      await page.waitForSelector('.nsm-dim .field-example-toggle');
      await page.locator('.nsm-dim .field-example-toggle').first().click();
      await page.waitForTimeout(300);
      await page.waitForSelector('.nsm-dim .example-expand');
    },
  },
  {
    name: 'E-modal-loading-state',
    desc: '點擊 hint 按鈕後 modal loading state (sparkle icon + 3-dot spinner)',
    extraRoutes: async (page) => {
      await page.route('**/api/nsm-public/step2-hint**', async (route) => {
        // delay 8s to capture loading state
        await new Promise(r => setTimeout(r, 8000));
        return route.fulfill({ status: 200, body: JSON.stringify({ hint: '- test' }) });
      });
    },
    setup: async (page) => {
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 2;
        window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
        window.render();
      });
      await page.waitForSelector('.field__hint-link');
      await page.locator('.field__hint-link').first().click();
      await page.waitForSelector('.modal-card', { timeout: 5000 });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'F-modal-content-state',
    desc: '成功取得 hint 後 modal content state (markdown bullets rendered)',
    extraRoutes: async (page) => {
      await page.route('**/api/nsm-public/step2-hint**', r => r.fulfill({
        status: 200,
        body: JSON.stringify({
          hint: '- **行為動詞**：完成購買 ≥ 1 次\n  - 確保指標聚焦於真實轉換\n- 量化門檻：**每月活躍**用戶（月內至少一次達標）\n- 排除：純瀏覽不下單者'
        })
      }));
    },
    setup: async (page) => {
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 2;
        window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
        window.render();
      });
      await page.waitForSelector('.field__hint-link');
      await page.locator('.field__hint-link').first().click();
      await page.waitForSelector('.modal-card', { timeout: 5000 });
      await page.waitForTimeout(1500);
    },
  },
  {
    name: 'G-modal-error-state',
    desc: 'API 500 後 modal error state (重試 button visible)',
    extraRoutes: async (page) => {
      await page.route('**/api/nsm-public/step2-hint**', r => r.fulfill({ status: 500 }));
    },
    setup: async (page) => {
      await page.evaluate(() => {
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 2;
        window.AppState.nsmSelectedQuestion = window.NSM_QUESTIONS[0];
        window.render();
      });
      await page.waitForSelector('.field__hint-link');
      await page.locator('.field__hint-link').first().click();
      await page.waitForSelector('.modal-card', { timeout: 5000 });
      await page.waitForTimeout(1500);
    },
  },
];

for (const scenario of SCENARIOS) {
  for (const vp of VIEWPORTS) {
    test(`capture ${scenario.name} ${vp.name}`, async ({ page }) => {
      test.setTimeout(30000);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await mockBaseApis(page);
      if (scenario.extraRoutes) {
        await scenario.extraRoutes(page);
      }

      await page.goto('/?circles_onboarding_done=1');
      await page.waitForSelector('.navbar');
      await scenario.setup(page);

      const outPath = path.join(OUT, `${scenario.name}-${vp.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
    });
  }
}
