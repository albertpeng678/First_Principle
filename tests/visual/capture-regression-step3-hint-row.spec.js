/**
 * Capture PNG — UAT regression fix: NSM Step 3 hint-row right-align + spacing
 * Verifies: 提示 + 範例答案 buttons both visible + right-aligned + spaced from textarea
 * Uses Slack (q3, B2B SaaS) for SaaS type coverage
 * Output: audit/png-uat-fix/regression-step3-hint-row-{viewport}.png
 */
const { test } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

const VIEWPORTS = [
  { name: 'mobile-360',   width: 360,  height: 780,  isMobile: true  },
  { name: 'tablet-768',   width: 768,  height: 1024, isMobile: true  },
  { name: 'desktop-1280', width: 1280, height: 800,  isMobile: false },
];

const OUT_DIR = path.join(__dirname, '../../audit/png-uat-fix');

for (const vp of VIEWPORTS) {
  test(`NSM Step 3 hint-row regression fix — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await ctx.newPage();

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Inject AppState: NSM Step 3 unlocked (no evalResult) with Slack (q3, SaaS type)
    await page.evaluate(() => {
      const q = (window.NSM_QUESTIONS || []).find(function(x) { return x.id === 'q3'; })
             || (window.NSM_QUESTIONS && window.NSM_QUESTIONS[0]);
      if (!q) return;

      window.AppState = window.AppState || {};
      window.AppState.view = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmStep2Values = {
        nsm: '每週活躍發言的工作區數',
        explanation: '發言才代表真正的使用，不是只登入',
        businessLink: '發言用戶增加 → 企業留存率提升 → 降低退訂',
      };
      window.AppState.nsmBreakdown = {};
      // No nsmEvalResult → unlocked state (user can edit)
      window.AppState.nsmEvalResult = null;
      window.AppState.nsmDimExampleExpanded = {};
    });

    // Trigger re-render
    await page.evaluate(() => {
      if (typeof window.renderApp === 'function') window.renderApp();
      else if (typeof window.render === 'function') window.render();
    });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${OUT_DIR}/regression-step3-hint-row-${vp.name}.png`,
      fullPage: true,
    });

    await ctx.close();
  });
}
