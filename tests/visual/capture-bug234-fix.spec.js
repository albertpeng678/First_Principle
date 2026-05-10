/**
 * Capture PNG — UAT fix Bug 2/3/4 NSM Step 3 lock state
 * 3 viewports: Mobile-360 / iPad-768 / Desktop-1280
 * Output: audit/png-uat-fix/issue-bug234-nsm-step3-{viewport}.png
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

const VIEWPORTS = [
  { name: 'mobile-360',   width: 360,  height: 780,  isMobile: true  },
  { name: 'tablet-768',   width: 768,  height: 1024, isMobile: true  },
  { name: 'desktop-1280', width: 1280, height: 800,  isMobile: false },
];

for (const vp of VIEWPORTS) {
  test(`NSM Step 3 lock-state bug234 fix — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await ctx.newPage();

    // Navigate + wait for app
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Inject AppState: NSM Step 3 lock state with eval result + dim data
    await page.evaluate(() => {
      // Pick first question
      const q = window.NSM_QUESTIONS && window.NSM_QUESTIONS[0];
      if (!q) return;

      window.AppState = window.AppState || {};
      window.AppState.drill_step = 'nsm';
      window.AppState.nsmStep = 3;
      window.AppState.nsmSelectedQuestion = q;
      window.AppState.nsmStep2Values = {
        nsm: 'Market size for this question is large',
        explanation: 'Our explanation covers customer needs',
        businessLink: 'Revenue directly tied to metric',
      };
      window.AppState.nsmStep3Values = {
        attention: 'Users pay attention because it solves real pain',
        acquisition: 'We acquire through organic + paid channels',
        adoption: 'Adoption rate is high in target segment',
        retention: 'NPS > 50 indicates strong retention',
      };
      // Simulate eval result (triggers lock state in applyNSMStateOverlay)
      window.AppState.nsmEvalResult = {
        score: 4,
        summary: '整體回答清楚，商業邏輯完整',
        dimensions: {
          attention: { score: 4, feedback: '注意力維度回答精準' },
          acquisition: { score: 3, feedback: '獲取維度有待加強' },
          adoption: { score: 4, feedback: '採用率論述有據' },
          retention: { score: 5, feedback: '留存分析優秀' },
        }
      };
      window.AppState.nsmDimExampleExpanded = {};
    });

    // Trigger re-render
    await page.evaluate(() => {
      if (typeof window.renderApp === 'function') window.renderApp();
    });
    await page.waitForTimeout(500);

    // Screenshot — full NSM Step 3 lock state (Bug 4: 下一步 button visible)
    const outDir = path.join(__dirname, '../../audit/png-uat-fix');
    await page.screenshot({
      path: path.join(outDir, `issue-bug234-nsm-step3-${vp.name}.png`),
      fullPage: true,
    });

    // Now expand the first dim example to verify Bug 3 (expand below textarea)
    // Click the 範例答案 toggle on first dim if present
    const exToggle = page.locator('[data-nsm-dim-example-toggle]').first();
    const exToggleVisible = await exToggle.isVisible().catch(() => false);
    if (exToggleVisible) {
      await exToggle.click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(outDir, `issue-bug234-nsm-step3-example-open-${vp.name}.png`),
        fullPage: true,
      });
    }

    await ctx.close();
  });
}
