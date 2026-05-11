// T3 capture spec — scored Step 2 production PNGs × 8 vp
// Output: audit/png-step2-locked-prod/{vp}.png

const { test } = require('@playwright/test');
const fs = require('fs');

fs.mkdirSync('audit/png-step2-locked-prod', { recursive: true });

async function setupScored(page) {
  await page.route('**/api/circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/guest-circles-stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"completed":0,"active":0,"weeklyCompleted":0}' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForSelector('.navbar');
  await page.evaluate(() => {
    Object.assign(window.AppState, {
      view: 'nsm',
      nsmStep: 2,
      nsmSelectedQuestion: {
        id: 'q17',
        company: 'Zoom',
        product: '視訊會議 SaaS',
        question_type: 'saas',
        scenario: '為 Zoom 視訊會議 SaaS 定義北極星指標，衡量用戶從「試用」進入「習慣用 Zoom 開會」的關鍵門檻。',
        field_examples: {
          step2: {
            nsm: '每週使用 Zoom 完成至少 3 場「5 人以上、30 分鐘以上」的會議用戶數',
            explanation: '此指標衡量用戶真正將 Zoom 嵌入工作流程的程度：頻率（每週）× 深度（5 人以上、30 分鐘以上）的交集。',
            businessLink: '養成習慣 → 企業采購擴展 → 付費計劃升級 → NRR > 120%',
          },
        },
      },
      nsmDefinition: {
        nsm: '每週使用 Zoom 完成一場「1 小時 3 人以上會議」的用戶數',
        explanation: '此指標代表用戶已將 Zoom 作為主要協作工具，每週固定使用，且達到中等規模會議（3 人以上），表示從個人轉為團隊採用。',
        businessLink: '習慣用戶增長 → 企業授權擴大 → 付費方案升級 → ARR 持續成長。',
      },
      nsmEvalResult: {
        totalScore: 80,
        coachTree: { nsm: '教練思路文字', reach: '', depth: '', frequency: '', impact: '' },
        coachRationale: {},
      },
      nsmSession: { id: 'sess-zoom-1' },
    });
    window.render();
  });
  await page.waitForTimeout(500);
}

test('capture scored Step 2 production PNG', async ({ page }, testInfo) => {
  await setupScored(page);
  await page.screenshot({
    path: `audit/png-step2-locked-prod/${testInfo.project.name}.png`,
    fullPage: true,
  });
});
