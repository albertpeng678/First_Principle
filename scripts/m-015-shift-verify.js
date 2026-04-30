// MASTER-015 位移驗證 probe
// 對 8 viewport × 11 home button 場景截圖落 audit/cycles/2026-04-30/screenshots/m-015-verify/
//
// Usage: BASE=http://localhost:4011 node scripts/m-015-shift-verify.js
//
// Scenarios:
//   01 phase1-home          — CIRCLES Phase 1 Step C nav home button
//   02 phase2-home          — CIRCLES Phase 2 chat nav home button
//   03 phase3-home          — CIRCLES Phase 3 score nav home button (top + bottom)
//   04 phase4-home          — CIRCLES Phase 4 final report submit-bar
//   05 nsm-step2-home       — NSM step 2 form
//   06 nsm-gate-home        — NSM gate sub-tab
//   07 nsm-step3-home       — NSM step 3 sub-tab
//   08 nsm-step4-home       — NSM step 4 report nav
//   09 nsm-step4-export     — NSM step 4 export tab home
//   10 offcanvas-loading    — offcanvas spinner state
//   11 offcanvas-list       — offcanvas list state
const { chromium } = require('@playwright/test');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4011';
const OUT = path.resolve(__dirname, '..', 'audit/cycles/2026-04-30/screenshots/m-015-verify');

const VIEWPORTS = [
  { id: 'iphone-se',     w: 375,  h: 667  },
  { id: 'iphone-12',     w: 390,  h: 844  },
  { id: 'iphone-pm',     w: 430,  h: 932  },
  { id: 'ipad-portrait', w: 768,  h: 1024 },
  { id: 'ipad-land',     w: 1024, h: 768  },
  { id: 'desktop-1280',  w: 1280, h: 800  },
  { id: 'desktop-1440',  w: 1440, h: 900  },
  { id: 'desktop-2560',  w: 2560, h: 1440 },
];

async function shotCircles(page, vp) {
  // 01 phase1
  await page.goto(BASE + '/?onboarding=0');
  await page.waitForSelector('.circles-q-card');
  await page.locator('.circles-q-card').first().click();
  await page.locator('.circles-q-confirm-btn').first().click();
  await page.waitForSelector('#circles-p1-home');
  await page.screenshot({ path: path.join(OUT, `01-phase1-home_${vp.id}.png`), fullPage: false });

  // simulate phase 2 / 3 / 4 by setting state via window
  // 02 phase2
  await page.goto(BASE + '/?onboarding=0');
  await page.waitForSelector('.circles-q-card');
  await page.locator('.circles-q-card').first().click();
  await page.locator('.circles-q-confirm-btn').first().click();
  await page.evaluate(() => {
    window.AppState.circlesPhase = 2;
    window.AppState.circlesConversation = [];
    if (typeof window.render === 'function') window.render();
  });
  await page.waitForTimeout(200);
  if (await page.locator('#circles-p2-home').count()) {
    await page.screenshot({ path: path.join(OUT, `02-phase2-home_${vp.id}.png`), fullPage: false });
  }
}

async function shotOffcanvas(page, vp) {
  await page.route(/sessions/, async (r) => {
    await new Promise((res) => setTimeout(res, 1500));
    r.continue();
  });
  await page.goto(BASE + '/?onboarding=0');
  await page.waitForFunction(() => document.getElementById('btn-hamburger')?.onclick);
  await page.click('#btn-hamburger');
  await page.waitForSelector('.offcanvas-loading');
  await page.screenshot({ path: path.join(OUT, `10-offcanvas-loading_${vp.id}.png`), fullPage: false });
  // wait for list resolved
  await page.waitForFunction(() => !document.querySelector('.offcanvas-loading'), { timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, `11-offcanvas-list_${vp.id}.png`), fullPage: false });
  await page.unroute(/sessions/);
}

async function shotNsm(page, vp) {
  await page.goto(BASE + '/?view=nsm&onboarding=0');
  await page.waitForTimeout(400);
  // pick a question (needed for renderNSMStep2 → detectProductType)
  await page.evaluate(() => {
    const q = (window.NSM_QUESTIONS && window.NSM_QUESTIONS[0]) || (window.AppState.nsmDisplayedQuestions && window.AppState.nsmDisplayedQuestions[0]);
    if (q) window.AppState.nsmSelectedQuestion = q;
  });
  // step 2
  await page.evaluate(() => {
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-step2';
    if (typeof window.render === 'function') window.render();
  });
  await page.waitForTimeout(150);
  if (await page.locator('#btn-nsm-home-nav').count()) {
    await page.screenshot({ path: path.join(OUT, `05-nsm-step2-home_${vp.id}.png`), fullPage: false });
  }
  // gate
  await page.evaluate(() => { window.AppState.nsmSubTab = 'nsm-gate'; window.render(); });
  await page.waitForTimeout(150);
  if (await page.locator('#btn-nsm-home-nav').count()) {
    await page.screenshot({ path: path.join(OUT, `06-nsm-gate-home_${vp.id}.png`), fullPage: false });
  }
  // step3
  await page.evaluate(() => { window.AppState.nsmSubTab = 'nsm-step3'; window.render(); });
  await page.waitForTimeout(150);
  if (await page.locator('#btn-nsm-home-nav').count()) {
    await page.screenshot({ path: path.join(OUT, `07-nsm-step3-home_${vp.id}.png`), fullPage: false });
  }
  // step4 (loading state)
  await page.evaluate(() => {
    window.AppState.nsmStep = 4;
    window.AppState.nsmSession = null;
    window.render();
  });
  await page.waitForTimeout(150);
  if (await page.locator('#btn-nsm-home-nav').count()) {
    await page.screenshot({ path: path.join(OUT, `08-nsm-step4-home_${vp.id}.png`), fullPage: false });
  }
}

(async () => {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    console.log(`[viewport] ${vp.id}`);
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    try { await shotCircles(page, vp); } catch (e) { console.warn(`circles ${vp.id}:`, e.message); }
    try { await shotNsm(page, vp); } catch (e) { console.warn(`nsm ${vp.id}:`, e.message); }
    try { await shotOffcanvas(page, vp); } catch (e) { console.warn(`offcanvas ${vp.id}:`, e.message); }
    await ctx.close();
  }
  await browser.close();
  console.log('done →', OUT);
})();
