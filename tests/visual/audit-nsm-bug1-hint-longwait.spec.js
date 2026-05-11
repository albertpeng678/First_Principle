/**
 * Bug 1 verification — long-wait capture of NSM Step 2 + Step 3 hint modal
 * with EMPTY draft, to see actual API response vs loading shell.
 * Wait 12s per state to allow gpt-4o full response.
 */
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT_DIR = path.join(__dirname, '../../audit/png-nsm-bug1-longwait');

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 780,  isMobile: true  },
  { name: 'iPad',          width: 768,  height: 1024, isMobile: true  },
  { name: 'Desktop-1280',  width: 1280, height: 800,  isMobile: false },
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function gotoApp(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/Cannot GET/i.test(bodyText)) throw new Error('Server returned 404');
}

async function injectStep(page, step) {
  await page.evaluate((step) => {
    var questions = window.NSM_QUESTIONS || [];
    var q = questions.find(function (x) { return x.id === 'q3'; }) || questions[0];
    var AS = window.AppState;
    AS.view = 'nsm';
    AS.nsmStep = step;
    AS.nsmSelectedQuestion = q;
    AS.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
    AS.nsmBreakdown = { reach: '', depth: '', frequency: '', impact: '' };
    AS.nsmEvalResult = null;
    AS.nsmGateResult = null;
    AS.nsmExampleExpanded = {};
    AS.nsmDimExampleExpanded = {};
    AS.nsmContextExpanded = false;
  }, step);
  await page.evaluate(() => { if (typeof window.render === 'function') window.render(); });
  await page.waitForTimeout(400);
}

for (const vp of VIEWPORTS) {
  test(`Step2-hint-empty-resolved — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep(page, 2);
    await page.locator('[data-nsm-hint="nsm"]').first().click();
    // Wait long enough for gpt-4o to return; cap at 15s
    try {
      await page.waitForFunction(() => {
        var host = document.getElementById('nsm-hint-modal-host');
        if (!host) return false;
        var spinner = host.querySelector('.hint-spinner');
        return !spinner;
      }, { timeout: 15000 });
    } catch (e) { /* timed out — capture whatever rendered */ }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, `step2-hint-empty-resolved-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });

  test(`Step3-hint-empty-resolved — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    const page = await ctx.newPage();
    await gotoApp(page);
    await injectStep(page, 3);
    await page.locator('[data-nsm-step3-hint="reach"]').first().click();
    try {
      await page.waitForFunction(() => {
        var host = document.getElementById('nsm-step3-hint-modal-host') || document.getElementById('nsm-hint-modal-host');
        if (!host) return false;
        var spinner = host.querySelector('.hint-spinner');
        return !spinner;
      }, { timeout: 15000 });
    } catch (e) { /* timed out — capture as-is */ }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, `step3-hint-empty-resolved-${vp.name}.png`), fullPage: true });
    await ctx.close();
  });
}
