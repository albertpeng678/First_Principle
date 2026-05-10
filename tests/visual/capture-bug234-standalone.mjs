/**
 * Standalone Playwright capture — UAT fix Bug 2/3/4 NSM Step 3 lock state
 * Run: node tests/visual/capture-bug234-standalone.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT_DIR = path.join(__dirname, '../../audit/png-uat-fix');

const VIEWPORTS = [
  { name: 'mobile-360',   width: 360,  height: 780,  isMobile: true  },
  { name: 'tablet-768',   width: 768,  height: 1024, isMobile: true  },
  { name: 'desktop-1280', width: 1280, height: 800,  isMobile: false },
];

async function injectNSMStep3LockState(page) {
  await page.evaluate(() => {
    // Use first real question from NSM_QUESTIONS (loaded via nsm-db.js)
    const qs = window.NSM_QUESTIONS || [];
    let q = qs[0] || null;

    // If no question or no step3 examples, find one that has them
    if (q && (!q.field_examples || !q.field_examples.step3)) {
      q = qs.find(x => x.field_examples && x.field_examples.step3) || q;
    }

    if (!q) return; // nothing to render

    window.AppState = window.AppState || {};
    window.AppState.view = 'nsm';
    window.AppState.drill_step = 'nsm';
    window.AppState.nsmStep = 3;
    window.AppState.nsmSelectedQuestion = q;

    // Build nsmStep3Values from the question's dimension keys
    const step3ex = (q.field_examples && q.field_examples.step3) || {};
    const dimKeys = Object.keys(step3ex);
    const step3Values = {};
    dimKeys.forEach(k => { step3Values[k] = '這是模擬填入的說明文字，用於展示 Step 3 鎖定狀態的範例答案展開位置。'; });

    window.AppState.nsmStep2Values = {
      nsm: '月活躍用戶數超過 10 萬，且每月核心功能使用率達 40%',
      explanation: '此指標直接反映用戶對產品核心價值的認可，可作為留存與成長的先行指標',
      businessLink: '月活提升 10% 帶動付費轉換增加約 3-5 個百分點，ARR 直接受益',
    };
    window.AppState.nsmStep3Values = step3Values;

    // nsmEvalResult triggers lock state in applyNSMStateOverlay
    const dimFeedback = {};
    dimKeys.forEach((k, i) => { dimFeedback[k] = { score: 3 + (i % 3), feedback: `${k} 維度回答完整，邏輯清晰` }; });
    window.AppState.nsmEvalResult = {
      score: 4,
      summary: '整體回答清楚，商業邏輯完整，建議深化商業連結說明',
      dimensions: dimFeedback,
    };
    window.AppState.nsmDimExampleExpanded = {};
    if (typeof window.renderApp === 'function') window.renderApp();
  });
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await ctx.newPage();

    console.log(`[${vp.name}] loading ${BASE_URL} ...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await injectNSMStep3LockState(page);

    // Screenshot 1: full lock state (Bug 2 + Bug 4 visible)
    const lockPath = `${OUT_DIR}/issue-bug234-nsm-step3-${vp.name}.png`;
    await page.screenshot({ path: lockPath, fullPage: true });
    console.log(`  saved: ${lockPath}`);

    // Click 範例答案 to show expand below textarea (Bug 3)
    const exToggle = page.locator('[data-nsm-dim-example-toggle]').first();
    const exVisible = await exToggle.isVisible().catch(() => false);
    if (exVisible) {
      await exToggle.click();
      await page.waitForTimeout(400);
      const exPath = `${OUT_DIR}/issue-bug234-nsm-step3-example-open-${vp.name}.png`;
      await page.screenshot({ path: exPath, fullPage: true });
      console.log(`  saved: ${exPath}`);
    } else {
      console.log(`  (no example toggle visible — check question stub)`);
    }

    await ctx.close();
  }

  await browser.close();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
