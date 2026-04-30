// step-c1 audit probe — exercises C1 + register + migrate + onboarding + picker
// + Phase 1.5 gate scope items across all 8 viewport projects.
// Read-only: no source edits. Writes screenshots + JSON findings only.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'step-c1');
const LOG_DIR = path.join(__dirname, '..', 'logs');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 780,  isMobile: true },
  { name: 'iPhone-SE',     width: 375,  height: 667,  isMobile: true },
  { name: 'iPhone-14',     width: 390,  height: 844,  isMobile: true },
  { name: 'iPhone-15-Pro', width: 430,  height: 932,  isMobile: true },
  { name: 'iPad',          width: 768,  height: 1024, isMobile: true },
  { name: 'Desktop-1280',  width: 1280, height: 800,  isMobile: false },
  { name: 'Desktop-1440',  width: 1440, height: 900,  isMobile: false },
  { name: 'Desktop-2560',  width: 2560, height: 1440, isMobile: false },
];

const findings = []; // {viewport, scenario, severity, summary, detail, screenshot}

function record(f) {
  findings.push(f);
  console.log(`[${f.severity}] ${f.viewport} ${f.scenario}: ${f.summary}`);
}

async function probeViewport(vp) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', e => pageErrors.push(String(e)));

  // ---------- B4 / A1: guest first-visit, suppress onboarding for clean baseline ----------
  await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });

  // A1: x-guest-id minted (key is 'guestId' per app.js:1151)
  const guestId = await page.evaluate(() => {
    try { return localStorage.getItem('guestId'); } catch { return null; }
  });
  if (!guestId || !/^[0-9a-f-]{36}$/i.test(guestId)) {
    record({ viewport: vp.name, scenario: 'A1', severity: 'P1',
      summary: 'guest_id not present or not UUID',
      detail: `localStorage.guest_id = ${guestId}` });
  }

  // C1: mode picker — both cards visible
  const modeCards = await page.locator('.circles-mode-card[data-mode]').count();
  if (modeCards < 2) {
    const shot = path.join(OUT_DIR, `ISSUE-MODE-PICKER-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    record({ viewport: vp.name, scenario: 'C1-picker', severity: 'P0',
      summary: `expected 2 .circles-mode-card[data-mode], got ${modeCards}`,
      detail: 'Mode picker missing on home', screenshot: shot });
  }

  // C2: type tabs ×3
  const typeTabs = await page.locator('.circles-type-tab[data-type]').count();
  if (typeTabs !== 3) {
    record({ viewport: vp.name, scenario: 'C2', severity: 'P1',
      summary: `expected 3 type tabs, got ${typeTabs}`, detail: '' });
  }

  // C3: 5 random questions + 換一批 aria-live
  const cardCount = await page.locator('.circles-q-card').count();
  if (cardCount !== 5) {
    record({ viewport: vp.name, scenario: 'C3', severity: 'P1',
      summary: `expected 5 question cards, got ${cardCount}`, detail: '' });
  }
  // 換一批 button click → aria-live region created with '已隨機重新選 5 題'
  const shuffleBtn = page.locator('#circles-random-btn');
  if (await shuffleBtn.count()) {
    await shuffleBtn.first().click().catch(() => {});
    await page.waitForTimeout(150);
    const ariaText = await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('[aria-live="polite"]'));
      return r.map(e => e.textContent.trim()).join(' | ');
    });
    if (!ariaText.includes('已隨機重新選 5 題')) {
      record({ viewport: vp.name, scenario: 'C3-aria-live', severity: 'P1',
        summary: 'after 換一批, aria-live did not announce 已隨機重新選 5 題',
        detail: `texts: ${ariaText.slice(0, 200)}` });
    }
  } else {
    record({ viewport: vp.name, scenario: 'C3-shuffle-btn', severity: 'P1',
      summary: '換一批 button not found', detail: '' });
  }

  // C4: difficulty badges DIFF_LABEL maps easy/medium/hard
  const diffs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.circles-q-card-difficulty, .circles-q-card-diff'))
      .map(e => e.textContent.trim());
  });
  const allowed = ['簡單', '中等難度', '困難', ''];
  const bad = diffs.filter(d => !allowed.includes(d));
  if (bad.length) {
    record({ viewport: vp.name, scenario: 'C4-diff', severity: 'P2',
      summary: `unexpected difficulty label: ${bad.join('|')}`, detail: '' });
  }

  // C4: 看完整題目 expand-in-place — click first card to expand
  const homeShot = path.join(OUT_DIR, `home-${vp.name}.png`);
  await page.screenshot({ path: homeShot, fullPage: false });

  // Sticky 確認 button reachable test (after expansion)
  const firstCard = page.locator('.circles-q-card').first();
  if (await firstCard.count()) {
    await firstCard.click().catch(() => {});
    await page.waitForTimeout(400);
    const expanded = await page.evaluate(() => {
      return !!document.querySelector('.circles-q-card-full-block, .circles-q-card-full-text');
    });
    if (!expanded) {
      record({ viewport: vp.name, scenario: 'C4-expand', severity: 'P1',
        summary: 'click did not expand question card in-place', detail: '' });
    }
    // sticky 確認按鈕
    const submitVis = await page.evaluate(() => {
      const btn = document.querySelector('.circles-q-confirm-btn, #circles-p1-submit, .circles-submit-bar button');
      if (!btn) return { present: false };
      const r = btn.getBoundingClientRect();
      return { present: true, top: r.top, bottom: r.bottom, h: r.height, w: r.width,
               vh: window.innerHeight, vw: window.innerWidth };
    });
    if (!submitVis.present) {
      record({ viewport: vp.name, scenario: 'C4-sticky', severity: 'P0',
        summary: 'no sticky 確認按鈕 visible after expansion',
        detail: JSON.stringify(submitVis) });
    } else {
      // tap target M5: ≥44 logical px
      if (vp.isMobile && (submitVis.h < 44 || submitVis.w < 44)) {
        record({ viewport: vp.name, scenario: 'M5-tap', severity: 'P1',
          summary: `confirm btn ${submitVis.w}x${submitVis.h} < 44`,
          detail: '' });
      }
      // off-screen check
      if (submitVis.bottom > submitVis.vh + 1 || submitVis.top < 0) {
        record({ viewport: vp.name, scenario: 'C4-sticky-offscreen', severity: 'P0',
          summary: `sticky button bottom ${submitVis.bottom} vs vh ${submitVis.vh}`,
          detail: '' });
      }
    }
    const expandShot = path.join(OUT_DIR, `expanded-${vp.name}.png`);
    await page.screenshot({ path: expandShot, fullPage: false });
  }

  // C6/C7: resume banner check (likely empty for fresh guest, ok)
  const banner = await page.locator('.circles-resume-banner, .resume-go').count();
  // No assertion; just record state for the log
  record({ viewport: vp.name, scenario: 'C6-banner', severity: 'INFO',
    summary: `resume-banner cards: ${banner}`, detail: '' });

  // ---------- B5: navbar logo from Phase 1 → home ----------
  // Push into Phase 1 by clicking a question's confirm
  if (await page.locator('.circles-q-confirm-btn').count()) {
    // Pick question
    await page.locator('.circles-q-confirm-btn').first().click().catch(() => {});
    await page.waitForTimeout(800);
    const inP1 = await page.evaluate(() => {
      return !!document.querySelector('textarea, .rt-editor, .phase1-desktop, .circles-step-form');
    });
    if (!inP1) {
      record({ viewport: vp.name, scenario: 'C5', severity: 'P1',
        summary: 'pick question did not advance to Phase 1 form', detail: '' });
    }
    // B5: navbar logo
    const logo = page.locator('#navbar-home-btn');
    if (await logo.count()) {
      await logo.click().catch(() => {});
      await page.waitForTimeout(400);
      const back = await page.evaluate(() => !!document.querySelector('.circles-q-card'));
      if (!back) {
        record({ viewport: vp.name, scenario: 'B5', severity: 'P1',
          summary: 'navbar logo did not return to picker', detail: '' });
      }
    } else {
      record({ viewport: vp.name, scenario: 'B5', severity: 'P1',
        summary: '#navbar-home-btn missing', detail: '' });
    }
  }

  // ---------- B6: navbar tabs CIRCLES / 北極星指標 ----------
  const tabsInfo = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[data-nav]'));
    return tabs.map(t => ({ nav: t.dataset.nav, ariaCurrent: t.getAttribute('aria-current'),
      text: t.textContent.trim().slice(0, 20) }));
  });
  if (!tabsInfo.find(t => t.nav === 'circles') || !tabsInfo.find(t => t.nav === 'nsm')) {
    record({ viewport: vp.name, scenario: 'B6', severity: 'P1',
      summary: `expected nav tabs circles+nsm, got ${JSON.stringify(tabsInfo)}`, detail: '' });
  }

  // ---------- B7: hamburger + offcanvas ----------
  const hamburger = page.locator('#btn-hamburger');
  if (!(await hamburger.count())) {
    record({ viewport: vp.name, scenario: 'B7', severity: 'P1',
      summary: '#btn-hamburger missing', detail: '' });
  } else {
    await hamburger.click().catch(() => {});
    await page.waitForTimeout(300);
    const open = await page.evaluate(() => {
      const oc = document.getElementById('offcanvas');
      return oc ? oc.classList.contains('open') : false;
    });
    if (!open) {
      const shot = path.join(OUT_DIR, `ISSUE-OFFCANVAS-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      record({ viewport: vp.name, scenario: 'B7', severity: 'P1',
        summary: 'offcanvas did not open after #btn-hamburger click',
        detail: '', screenshot: shot });
    }
    // tap target on hamburger
    const hSize = await hamburger.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    if (vp.isMobile && (hSize.w < 44 || hSize.h < 44)) {
      record({ viewport: vp.name, scenario: 'M5-tap', severity: 'P1',
        summary: `hamburger ${hSize.w}x${hSize.h} < 44`, detail: '' });
    }
    // close
    await page.locator('#btn-offcanvas-close').click().catch(() => {});
    await page.waitForTimeout(200);
  }

  // ---------- B8: /login.html → 302 ----------
  const resp = await page.request.get(`${BASE}/login.html`, { maxRedirects: 0 }).catch(e => null);
  if (!resp || resp.status() !== 302) {
    record({ viewport: vp.name, scenario: 'B8', severity: 'P1',
      summary: `/login.html status ${resp ? resp.status() : 'no-resp'} (expected 302)`,
      detail: '' });
  } else {
    const loc = resp.headers()['location'];
    if (loc !== '/?view=login') {
      record({ viewport: vp.name, scenario: 'B8', severity: 'P2',
        summary: `/login.html → ${loc} (expected /?view=login)`, detail: '' });
    }
  }

  // ---------- M8: malformed JSON envelope ----------
  const badJson = await page.request.post(`${BASE}/api/circles-public/hint`, {
    headers: { 'content-type': 'application/json', 'x-guest-id': '00000000-0000-0000-0000-000000000000' },
    data: '{not-json',
  }).catch(e => null);
  if (badJson) {
    let body = ''; try { body = await badJson.text(); } catch {}
    if (badJson.status() !== 400 || !body.includes('invalid_json')) {
      record({ viewport: vp.name, scenario: 'M8', severity: 'P1',
        summary: `malformed JSON returned status ${badJson.status()}`,
        detail: `body=${body.slice(0,200)}` });
    }
  }

  // ---------- A2: register endpoint shape (light smoke — does not actually create) ----------
  // Intentionally hit with empty body to confirm 400 envelope, no HTML stack trace.
  const reg = await page.request.post(`${BASE}/api/auth/register`, {
    headers: { 'content-type': 'application/json' }, data: {},
  }).catch(e => null);
  if (reg) {
    let body = ''; try { body = await reg.text(); } catch {}
    if (reg.status() === 200) {
      record({ viewport: vp.name, scenario: 'A2', severity: 'P1',
        summary: 'register accepted empty body (200)', detail: body.slice(0, 200) });
    } else if (body.includes('<pre>') || body.includes('Error:')) {
      record({ viewport: vp.name, scenario: 'A2-leak', severity: 'P1',
        summary: 'register error leaks HTML stack', detail: body.slice(0, 200) });
    }
  }

  // ---------- B1/B3: onboarding replay ----------
  await page.goto(`${BASE}/?onboarding=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const welcome = await page.evaluate(() => {
    const card = document.querySelector('#onboarding-welcome, .onboarding-welcome, [data-onboarding]');
    return !!card || !!document.getElementById('onb-skip') || !!document.getElementById('onb-start');
  });
  if (!welcome) {
    const shot = path.join(OUT_DIR, `ISSUE-ONBOARDING-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    record({ viewport: vp.name, scenario: 'B1/B3', severity: 'P1',
      summary: '?onboarding=1 did not render welcome / onb-skip / onb-start',
      detail: '', screenshot: shot });
  }

  // ---------- E1/E2/E3: Phase 1.5 gate render check via fixture state ----------
  await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const gateRender = await page.evaluate(() => {
    if (typeof AppState === 'undefined' || typeof CIRCLES_QUESTIONS === 'undefined') return null;
    AppState.view = 'circles';
    AppState.circlesPhase = 1.5;
    AppState.circlesMode = 'simulation';
    AppState.circlesDrillStep = 'C1';
    AppState.circlesSelectedQuestion = CIRCLES_QUESTIONS[0];
    AppState.circlesGateResult = {
      overallStatus: 'error',
      canProceed: false,
      items: [{ field: '問題範圍', title: '範圍過寬', reason: 'audit fixture', suggestion: 'narrow it' }],
    };
    if (typeof render === 'function') render();
    return {
      hasContinue: !!document.querySelector('#circles-gate-continue, [data-gate="continue"]'),
      hasModify: !!document.querySelector('#circles-gate-modify, [data-gate="modify"]'),
      bodyText: document.body.textContent.slice(0, 500),
    };
  });
  if (gateRender) {
    if (!gateRender.hasContinue) {
      record({ viewport: vp.name, scenario: 'E3-sim-override', severity: 'P1',
        summary: 'simulation fail-state gate missing #circles-gate-continue',
        detail: '' });
    }
  }
  const gateShot = path.join(OUT_DIR, `gate-sim-${vp.name}.png`);
  await page.screenshot({ path: gateShot, fullPage: false });

  // ---------- M2: console errors collected ----------
  if (consoleErrors.length || pageErrors.length) {
    record({ viewport: vp.name, scenario: 'M2-console', severity: 'P1',
      summary: `console errors: ${consoleErrors.length} pageerrors: ${pageErrors.length}`,
      detail: [...consoleErrors, ...pageErrors].slice(0, 5).join(' | ') });
  }

  await browser.close();
}

(async () => {
  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.name} ===`);
    try { await probeViewport(vp); }
    catch (e) {
      record({ viewport: vp.name, scenario: 'PROBE', severity: 'P1',
        summary: `probe crashed: ${e.message}`, detail: e.stack?.slice(0, 400) });
    }
  }
  fs.writeFileSync(path.join(LOG_DIR, 'step-c1-findings.json'),
    JSON.stringify(findings, null, 2));
  console.log(`\n=== TOTAL FINDINGS: ${findings.length} ===`);
})();
