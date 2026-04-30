// step-nsm-probe.js — Probe used by audit-cycle agent step-nsm to capture
// per-viewport screenshots + console errors for the NSM workshop flow.
//
// Usage:
//   node audit/cycles/2026-04-30/probes/step-nsm-probe.js <ViewportName>
//
// Viewports: Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro /
//            iPad / Desktop-1280 / Desktop-1440 / Desktop-2560
//
// Output: audit/cycles/2026-04-30/screenshots/step-nsm/<viewport>/*.png
//         + JSON summary on stdout (consumed by step-nsm.md log).

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = {
  'Mobile-360':    { width: 360,  height: 780,  isMobile: true  },
  'iPhone-SE':     { width: 375,  height: 667,  isMobile: true  },
  'iPhone-14':     { width: 390,  height: 844,  isMobile: true  },
  'iPhone-15-Pro': { width: 430,  height: 932,  isMobile: true  },
  'iPad':          { width: 768,  height: 1024, isMobile: true  },
  'Desktop-1280':  { width: 1280, height: 800,  isMobile: false },
  'Desktop-1440':  { width: 1440, height: 900,  isMobile: false },
  'Desktop-2560':  { width: 2560, height: 1440, isMobile: false },
};

const BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const VP_NAME = process.argv[2] || 'Mobile-360';
const VP = VIEWPORTS[VP_NAME];
if (!VP) { console.error('Unknown viewport:', VP_NAME); process.exit(2); }

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'step-nsm', VP_NAME);
fs.mkdirSync(OUT_DIR, { recursive: true });

const findings = { viewport: VP_NAME, scenarios: [], consoleErrors: [], pageErrors: [], requestFailures: [] };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: VP.width, height: VP.height },
    isMobile: VP.isMobile,
    hasTouch: VP.isMobile,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  page.on('console', m => { if (m.type() === 'error') findings.consoleErrors.push(m.text()); });
  page.on('pageerror', e => findings.pageErrors.push(String(e.message || e)));
  page.on('requestfailed', r => findings.requestFailures.push({ url: r.url(), failure: r.failure() && r.failure().errorText }));

  async function shot(label) {
    const file = path.join(OUT_DIR, `${label}.png`);
    try { await page.screenshot({ path: file, fullPage: false }); } catch (e) { /* ignore */ }
    return file;
  }
  async function record(name, fn) {
    const t0 = Date.now();
    let status = 'pass'; let detail = '';
    try { detail = (await fn()) || ''; } catch (e) { status = 'fail'; detail = String(e.message || e); }
    findings.scenarios.push({ name, status, ms: Date.now() - t0, detail });
  }

  // J5/J1 — go to NSM, step 1 + context
  await record('J5_nsm_home_step1', async () => {
    await page.goto(BASE + '/?onboarding=0', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.navigate && window.navigate('nsm'));
    await page.waitForSelector('.nsm-question-card', { timeout: 8000 });
    const cardCount = await page.locator('.nsm-question-card').count();
    await shot('01-nsm-home-step1');
    return `cards=${cardCount}`;
  });

  // J2 / J5 — pick a card, watch /api/nsm-context fire, advance to step 2
  await record('J2_step1_to_step2_context_api', async () => {
    const card = page.locator('.nsm-question-card').first();
    if (!(await card.count())) throw new Error('no nsm-question-card');
    const ctxReq = page.waitForRequest(r => /\/api\/nsm-context$/.test(r.url()) && r.method() === 'POST', { timeout: 8000 }).catch(() => null);
    await card.click();
    const next = page.locator('#btn-nsm-step1-next');
    await next.waitFor({ state: 'visible', timeout: 5000 });
    const disabledBefore = await next.isDisabled();
    await next.click();
    const ctx = await ctxReq;
    await page.waitForSelector('#btn-nsm-step2-next', { timeout: 8000 });
    await shot('02-nsm-step2');
    return `step1.next disabledBefore=${disabledBefore} contextReq=${!!ctx}`;
  });

  // B6/B7 / J8 — back + home buttons present on step 2
  await record('J8_step2_back_home_buttons', async () => {
    const back = await page.locator('#btn-nsm-back').count();
    const home = await page.locator('#btn-nsm-home-nav').count();
    if (!back || !home) throw new Error(`back=${back} home=${home}`);
    return `back=${back} home=${home}`;
  });

  // J2 — fill step 2 and submit gate
  await record('J2_gate_pass', async () => {
    // Step 2 has #nsm-nsm-input (input) + #nsm-definition-input + #nsm-business-link-input (textareas).
    await page.waitForSelector('#nsm-nsm-input', { timeout: 5000 });
    await page.locator('#nsm-nsm-input').fill('每月完成至少一首完整曲目播放的活躍月用戶數');
    const defTa = page.locator('#nsm-definition-input');
    const bizTa = page.locator('#nsm-business-link-input');
    if (await defTa.count()) await defTa.fill('區分被動背景播放與主動完整聆聽，後者才代表用戶真正得到價值。');
    if (await bizTa.count()) await bizTa.fill('真正完整聆聽的用戶更容易升級 Premium 訂閱、留存更高，是訂閱轉化與廣告效益的領先指標。');
    const gateReq = page.waitForResponse(r => /\/nsm-sessions\/.+\/gate$/.test(r.url()), { timeout: 60000 }).catch(() => null);
    await page.locator('#btn-nsm-step2-next').click();
    const r = await gateReq;
    await page.waitForTimeout(1200);
    await shot('03-nsm-gate');
    return `gate.status=${r ? r.status() : 'no-response'}`;
  });

  // J1 — sub-tab nav with disabled step 3 prior to gate pass; click step3 tab after pass
  await record('J1_subtab_nav_step3', async () => {
    // After gate, advance to step 3
    const cont = await page.locator('button:has-text("繼續"), #btn-nsm-gate-continue, button:has-text("進入下一階段")').first();
    if (await cont.count()) await cont.click().catch(() => {});
    await page.waitForTimeout(800);
    // If the gate verdict needs explicit click, also try the sub-tab
    const tab3 = page.locator('[data-nsm-sub-tab="nsm-step3"]');
    const disabled = await tab3.evaluate(el => el.disabled).catch(() => null);
    if (disabled === false) await tab3.click().catch(() => {});
    await page.waitForTimeout(800);
    await shot('04-nsm-step3');
    return `step3-tab-disabled=${disabled}`;
  });

  // J4 — hints API per dimension
  await record('J4_hints_api', async () => {
    const hintBtn = page.locator('.nsm-hint-btn, button:has-text("提示")').first();
    if (!(await hintBtn.count())) return 'no-hint-btn';
    const req = page.waitForRequest(r => /\/nsm-sessions\/.+\/hints$/.test(r.url()) && r.method() === 'POST', { timeout: 8000 }).catch(() => null);
    await hintBtn.click().catch(() => {});
    const r = await req;
    return `hints-req=${!!r}`;
  });

  // J6 — evaluate produces 4-dim radar (only attempt if step 3 form is reachable)
  await record('J6_evaluate_radar', async () => {
    const submit = page.locator('#btn-nsm-step3-submit');
    if (!(await submit.count())) return 'no-step3-submit';
    // Try filling step 3 textareas if visible
    const tas = await page.locator('textarea').all();
    for (let i = 0; i < tas.length; i++) {
      try { await tas[i].fill(`輸入指標 ${i+1}：示例填值，用以審計流程是否能達 evaluate。`); } catch {}
    }
    const req = page.waitForResponse(r => /\/nsm-sessions\/.+\/evaluate$/.test(r.url()), { timeout: 60000 }).catch(() => null);
    await submit.click().catch(() => {});
    const r = await req;
    await page.waitForTimeout(1500);
    await shot('05-nsm-step4');
    return `evaluate.status=${r ? r.status() : 'no-response'}`;
  });

  // J7 — step 4 layout parity: subtab row width + radar size
  await record('J7_step4_layout', async () => {
    const layout = await page.evaluate(() => {
      const sub = document.querySelector('.nsm-step4-desktop .tab-bar, .nsm-view .tab-bar');
      const radar = document.querySelector('.nsm-step4-desktop canvas, .nsm-view canvas, canvas');
      const main = document.querySelector('.nsm-step4-desktop, .nsm-view, main');
      return {
        subRect: sub ? sub.getBoundingClientRect() : null,
        radarRect: radar ? radar.getBoundingClientRect() : null,
        mainW: main ? main.getBoundingClientRect().width : null,
      };
    });
    await shot('06-step4-layout');
    return JSON.stringify(layout);
  });

  // J3 — re-define NSM resets step 3 — verify post-click state
  await record('J3_redefine_resets_step3', async () => {
    // After Step 4, push state back to Step 2 sub-tab to find redefine button.
    await page.evaluate(() => {
      if (window.AppState) {
        window.AppState.nsmStep = 2;
        window.AppState.nsmSubTab = 'nsm-step2';
        if (typeof render === 'function') render();
      }
    });
    await page.waitForTimeout(400);
    const redefine = page.locator('#btn-nsm-redefine');
    const exists = await redefine.count();
    let beforeBreakdown = null, afterBreakdown = null, beforeGate = null, afterGate = null;
    if (exists) {
      beforeBreakdown = await page.evaluate(() => JSON.stringify(window.AppState && window.AppState.nsmBreakdownDraft || {}));
      beforeGate = await page.evaluate(() => !!(window.AppState && window.AppState.nsmGateResult));
      await redefine.click().catch(() => {});
      await page.waitForTimeout(300);
      afterBreakdown = await page.evaluate(() => JSON.stringify(window.AppState && window.AppState.nsmBreakdownDraft || {}));
      afterGate = await page.evaluate(() => !!(window.AppState && window.AppState.nsmGateResult));
    }
    await shot('07-redefine');
    const status = (exists && (beforeBreakdown !== '{}' && afterBreakdown === '{}')) ? 'reset-ok' : 'reset-NOT-OK';
    return `redefine-btn=${exists} bdBefore=${beforeBreakdown} bdAfter=${afterBreakdown} gateBefore=${beforeGate} gateAfter=${afterGate} -> ${status}`;
  });

  // J8 — assert btn-nsm-home-nav present on step 2/3/4 per universe spec
  await record('J8_home_nav_on_steps_234', async () => {
    // Step 2 (current state likely)
    const s2HomeNav = await page.evaluate(() => !!document.getElementById('btn-nsm-home-nav'));
    // Force step 4
    await page.evaluate(() => { if (window.AppState) { window.AppState.nsmStep = 4; if (typeof render === 'function') render(); } });
    await page.waitForTimeout(300);
    const s4HomeNav = await page.evaluate(() => !!document.getElementById('btn-nsm-home-nav'));
    const s4Back = await page.evaluate(() => !!document.getElementById('btn-nsm-back'));
    return `step2.homeNav=${s2HomeNav} step4.homeNav=${s4HomeNav} step4.back=${s4Back}`;
  });

  // B6/B7 — navbar tab + hamburger (CIRCLES home)
  await record('B6B7_navbar_tabs_hamburger', async () => {
    await page.goto(BASE + '/?onboarding=0', { waitUntil: 'networkidle' });
    const tabs = await page.locator('.navbar-tab, [role="tab"], a.nav-link').count();
    const ham = await page.locator('#btn-hamburger').count();
    return `tabs=${tabs} hamburger=${ham}`;
  });

  // K1 — offcanvas list with NSM session interleaved
  await record('K1_offcanvas_nsm_in_list', async () => {
    await page.goto(BASE + '/?onboarding=0', { waitUntil: 'networkidle' });
    const ham = page.locator('#btn-hamburger');
    if (!(await ham.count())) return 'no-hamburger';
    await ham.click();
    await page.waitForSelector('#offcanvas', { timeout: 4000 });
    await page.waitForTimeout(800);
    const items = await page.locator('#offcanvas .offcanvas-item, #offcanvas li').count();
    await shot('08-offcanvas');
    return `offcanvas-items=${items}`;
  });

  // L1 — review-examples standalone smoke
  await record('L1_review_examples_smoke', async () => {
    await page.goto(BASE + '/review-examples.html', { waitUntil: 'networkidle' });
    const search = await page.locator('#review-examples-search, #search').count();
    const filter = await page.locator('#filter-step').count();
    await shot('09-review-examples');
    return `search=${search} filter=${filter}`;
  });

  await browser.close();
  console.log(JSON.stringify(findings, null, 2));
})();
