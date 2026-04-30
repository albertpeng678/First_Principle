// step-i-runner.js — read-only probe for step I (定義用戶) across 8 viewports.
// Usage: BASE_URL=http://localhost:4000 VIEWPORT=Mobile-360 node step-i-runner.js
// Or omit VIEWPORT to iterate all.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT  = path.resolve(__dirname, '..', 'screenshots', 'step-i');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'Mobile-360',    w: 360,  h: 780,  isMobile: true  },
  { name: 'iPhone-SE',     w: 375,  h: 667,  isMobile: true  },
  { name: 'iPhone-14',     w: 390,  h: 844,  isMobile: true  },
  { name: 'iPhone-15-Pro', w: 430,  h: 932,  isMobile: true  },
  { name: 'iPad',          w: 768,  h: 1024, isMobile: true  },
  { name: 'Desktop-1280',  w: 1280, h: 800,  isMobile: false },
  { name: 'Desktop-1440',  w: 1440, h: 900,  isMobile: false },
  { name: 'Desktop-2560',  w: 2560, h: 1440, isMobile: false },
];

const wantOnly = process.env.VIEWPORT;

async function probe(vp) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => consoleMsgs.push({ type: 'pageerror', text: String(e) }));

  const findings = [];
  const shot = async (tag) => {
    const p = path.join(OUT, `${vp.name}-${tag}.png`);
    await page.screenshot({ path: p, fullPage: true }).catch(()=>{});
    return p;
  };

  // ───── A1/B1: home + onboarding suppressed ─────
  await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await shot('01-home');

  // C1: drill mode
  await page.evaluate(() => {
    try { localStorage.setItem('circlesMode', 'drill'); } catch(e){}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // Click drill mode card if exposed
  const drillCard = page.locator('.circles-mode-card[data-mode="drill"]').first();
  if (await drillCard.count()) await drillCard.click().catch(()=>{});
  await page.waitForTimeout(200);

  // Pre-select drill step I via the pill (data-step="I")
  const pillI = page.locator('.circles-step-pill[data-step="I"]').first();
  const haveStepI = await pillI.count();
  findings.push({ k: 'step-pill-I-exists', v: !!haveStepI });
  if (haveStepI) await pillI.click().catch(()=>{});
  await page.waitForTimeout(200);
  await shot('02-home-drill-I-selected');

  // ───── C4/C5: pick a question card ─────
  const card = page.locator('.circles-q-card').first();
  if (!(await card.count())) {
    findings.push({ k: 'no-question-cards', v: true });
    await browser.close();
    return { vp: vp.name, findings, console: consoleMsgs };
  }
  await card.click().catch(()=>{});
  await page.waitForTimeout(300);
  // sticky 確認 button
  const confirmBtn = page.locator('.circles-q-confirm-btn').first();
  if (await confirmBtn.count()) {
    const box = await confirmBtn.boundingBox().catch(()=>null);
    if (box) findings.push({ k: 'confirm-tap-h', v: box.height });
    await confirmBtn.click().catch(()=>{});
  }
  await page.waitForTimeout(700);
  await shot('03-after-confirm');

  // We may have landed on C1 (default first drill step). Force-jump to I via app state.
  await page.evaluate(() => {
    if (window.AppState) {
      window.AppState.circlesDrillStep = 'I';
      // try to re-render
      if (typeof window.renderCirclesPhase1 === 'function') window.renderCirclesPhase1();
      else if (typeof window.render === 'function') window.render();
    }
  });
  await page.waitForTimeout(500);
  await shot('04-step-I-drill');

  // ───── D1: confirm step I label appears ─────
  const labelText = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h1,h2,h3,.circles-step-label,.circles-info-step,.prev-step-toggle-title')).map(e=>e.innerText).join(' | ')
  );
  findings.push({ k: 'visible-headers', v: labelText.slice(0, 400) });
  findings.push({ k: 'shows-定義用戶', v: /定義用戶/.test(labelText) });

  // D1: count fields (4 expected: 目標用戶分群 / 選定焦點對象 / 用戶動機假設 / 排除對象)
  const fieldLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('label, .circles-field-label, .field-label')).map(e=>e.innerText.trim()).filter(Boolean)
  );
  const expected = ['目標用戶分群', '選定焦點對象', '用戶動機假設', '排除對象'];
  const missing = expected.filter(f => !fieldLabels.some(l => l.includes(f)));
  findings.push({ k: 'expected-fields', v: expected });
  findings.push({ k: 'missing-fields', v: missing });

  // D1/D2: hint + 查看範例 buttons + rich-text editors / textareas
  const counts = await page.evaluate(() => ({
    hintBtns: Array.from(document.querySelectorAll('button')).filter(b=>/提示/.test(b.innerText||'')).length,
    exampleBtns: Array.from(document.querySelectorAll('button')).filter(b=>/查看範例/.test(b.innerText||'')).length,
    textareas: document.querySelectorAll('textarea').length,
    rtEditors: document.querySelectorAll('.rt-editor, [contenteditable="true"]').length,
    rtToolbarsDesktop: document.querySelectorAll('.rt-toolbar:not(.rt-toolbar-mobile) .rt-tbtn').length,
    rtToolbarsMobile: document.querySelectorAll('.rt-toolbar-mobile .rt-mtbtn').length,
    submitBtn: !!document.getElementById('circles-p1-submit'),
    backBtn: !!document.getElementById('circles-p1-back'),
  }));
  findings.push({ k: 'controls', v: counts });

  // D6: autosave indicator presence
  const saveInd = await page.evaluate(() => {
    const e = document.querySelector('.save-indicator');
    return e ? { present: true, ariaLive: e.getAttribute('aria-live') } : { present: false };
  });
  findings.push({ k: 'save-indicator', v: saveInd });

  // D9: hint card toggle text
  const hintToggle = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button,a,.hint-card-toggle'));
    const c = els.find(e => /查看教練提示|收起提示/.test(e.innerText || ''));
    return c ? c.innerText.trim() : null;
  });
  findings.push({ k: 'hint-toggle', v: hintToggle });

  // D7: type into the first textarea, refresh, verify text restored
  const firstTa = page.locator('textarea, [contenteditable="true"]').first();
  if (await firstTa.count()) {
    const sample = `step-I-probe-${vp.name}-${Date.now()}`;
    await firstTa.click().catch(()=>{});
    await firstTa.fill(sample).catch(()=>firstTa.type(sample).catch(()=>{}));
    // wait for autosave debounce
    await page.waitForTimeout(1500);
    await shot('05-typed');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      if (window.AppState) {
        window.AppState.circlesDrillStep = 'I';
        if (typeof window.renderCirclesPhase1 === 'function') window.renderCirclesPhase1();
      }
    });
    await page.waitForTimeout(800);
    const restored = await page.evaluate((s) => {
      return Array.from(document.querySelectorAll('textarea, [contenteditable="true"]')).some(el => (el.value || el.innerText || '').includes(s));
    }, sample);
    findings.push({ k: 'mid-step-refresh-restored', v: restored, sample });
    await shot('06-after-refresh');
  } else {
    findings.push({ k: 'no-input-field-for-typing', v: true });
  }

  // D3: IME compositionstart/end listeners — we just confirm element has them via a no-op composition
  const imeProbe = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return null;
    let composing = false;
    ta.addEventListener('compositionstart', () => composing = true, { once: true });
    ta.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    return { fired: composing, hasRtComposing: '_rtComposing' in ta };
  });
  findings.push({ k: 'ime-probe', v: imeProbe });

  // B5: navbar logo wipe
  const logo = page.locator('#navbar-home-btn').first();
  if (await logo.count()) {
    await logo.click().catch(()=>{});
    await page.waitForTimeout(400);
    const onHome = await page.locator('.circles-q-card, .circles-mode-card').first().count();
    findings.push({ k: 'B5-logo-returns-home', v: !!onHome });
    await shot('07-after-logo');
  }

  // B6: navbar tabs aria-current
  const tabsAria = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="tab"], .navbar-tab, [data-view]')).map(e => ({
      text: (e.innerText||'').trim().slice(0,12),
      ariaCurrent: e.getAttribute('aria-current'),
    }));
  });
  findings.push({ k: 'navbar-tabs', v: tabsAria.slice(0, 6) });

  // B7: hamburger / offcanvas
  const ham = page.locator('#btn-hamburger').first();
  if (await ham.count()) {
    await ham.click().catch(()=>{});
    await page.waitForTimeout(400);
    const oc = await page.locator('#offcanvas').first();
    const open = await oc.isVisible().catch(()=>false);
    findings.push({ k: 'B7-offcanvas-opens', v: open });
    await shot('08-offcanvas');
    const close = page.locator('#btn-offcanvas-close').first();
    if (await close.count()) await close.click().catch(()=>{});
    await page.waitForTimeout(200);
  }

  // L1: review-examples standalone, step filter for I
  await page.goto(`${BASE}/review-examples.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const filterSel = page.locator('#filter-step').first();
  const hasFilter = await filterSel.count();
  findings.push({ k: 'L1-step-filter-exists', v: !!hasFilter });
  if (hasFilter) {
    const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#filter-step option')).map(o=>({v:o.value, t:o.innerText})));
    findings.push({ k: 'L1-filter-options', v: opts });
    // try to select I
    const haveI = opts.some(o => o.v === 'I' || /定義用戶/.test(o.t));
    findings.push({ k: 'L1-has-I-option', v: haveI });
    if (haveI) {
      await page.selectOption('#filter-step', { value: 'I' }).catch(async () => {
        await page.selectOption('#filter-step', { label: 'I — 定義用戶' }).catch(()=>{});
      });
      await page.waitForTimeout(300);
      await shot('09-review-examples-I');
    }
    findings.push({ k: 'L1-aria-label', v: await filterSel.getAttribute('aria-label') });
  }

  // M2: console errors snapshot
  const errs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror');
  findings.push({ k: 'console-errors', v: errs.slice(0, 30) });

  // Tap-target spot check on critical step-I controls (only meaningful on touch)
  if (vp.isMobile) {
    // Re-enter step I to measure
    await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const c2 = page.locator('.circles-q-card').first();
    if (await c2.count()) {
      await c2.click().catch(()=>{});
      const cb = page.locator('.circles-q-confirm-btn').first();
      if (await cb.count()) await cb.click().catch(()=>{});
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        if (window.AppState) {
          window.AppState.circlesDrillStep = 'I';
          if (typeof window.renderCirclesPhase1 === 'function') window.renderCirclesPhase1();
        }
      });
      await page.waitForTimeout(500);
      const taps = await page.evaluate(() => {
        const sel = ['#circles-p1-submit', '#circles-p1-back', '.rt-mtbtn', '.hint-card-toggle'];
        return sel.map(s => {
          const el = document.querySelector(s);
          if (!el) return { sel: s, present: false };
          const r = el.getBoundingClientRect();
          return { sel: s, present: true, w: Math.round(r.width), h: Math.round(r.height) };
        });
      });
      findings.push({ k: 'tap-targets', v: taps });
    }
  }

  await browser.close();
  return { vp: vp.name, findings, console: consoleMsgs };
}

(async () => {
  const list = wantOnly ? VIEWPORTS.filter(v => v.name === wantOnly) : VIEWPORTS;
  const results = [];
  for (const vp of list) {
    process.stdout.write(`▶ ${vp.name}…\n`);
    try {
      const r = await probe(vp);
      results.push(r);
      process.stdout.write(`   findings=${r.findings.length} console-errs=${r.console.filter(c=>c.type==='error'||c.type==='pageerror').length}\n`);
    } catch (e) {
      results.push({ vp: vp.name, error: String(e) });
      process.stdout.write(`   ERROR ${e}\n`);
    }
  }
  const outFile = path.join(OUT, '_results.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  process.stdout.write(`\nWrote ${outFile}\n`);
})();
