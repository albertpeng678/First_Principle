// step-i-fast.js — minimal step-I probe across 8 viewports, ~30s each.
// Read-only. Captures findings JSON + a focused screenshot.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:4000';
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

async function probe(vp) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  const consoleMsgs = [];
  page.on('console', m => { if (m.type()==='error') consoleMsgs.push({ type:'error', text:m.text() }); });
  page.on('pageerror', e => consoleMsgs.push({ type: 'pageerror', text: String(e) }));

  const findings = {};
  const shot = async (tag) => {
    const p = path.join(OUT, `fast-${vp.name}-${tag}.png`);
    await page.screenshot({ path: p, fullPage: false }).catch(()=>{});
    return p;
  };

  await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  // Pre-select drill mode + step I via state
  await page.evaluate(() => {
    try {
      localStorage.setItem('circlesMode', 'drill');
      localStorage.setItem('drillStep', 'I');
    } catch(e){}
  });
  await page.reload({ waitUntil: 'networkidle' }).catch(()=>{});
  await page.waitForTimeout(600);

  // Click first question card → confirm
  await page.locator('.circles-q-card').first().waitFor({ state: 'attached', timeout: 8000 }).catch(()=>{});
  const card = page.locator('.circles-q-card').first();
  if (!(await card.count())) {
    findings.no_question_cards = true;
    await browser.close();
    return { vp: vp.name, findings, console: consoleMsgs };
  }
  await card.click().catch(()=>{});
  await page.waitForTimeout(200);
  const confirmBtn = page.locator('.circles-q-confirm-btn').first();
  if (await confirmBtn.count()) {
    findings.confirm_box = await confirmBtn.boundingBox().catch(()=>null);
    await confirmBtn.click().catch(()=>{});
  }
  await page.waitForTimeout(700);

  // Force step I render — try multiple times because confirm flow may async-render
  for (let i=0;i<3;i++) {
    await page.evaluate(() => {
      if (window.AppState) {
        window.AppState.circlesDrillStep = 'I';
        if (typeof window.renderCirclesPhase1 === 'function') window.renderCirclesPhase1();
        else if (typeof window.render === 'function') window.render();
      }
    });
    await page.waitForTimeout(500);
    const onI = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.circles-field-label')).map(e=>e.innerText.trim());
      return labels.some(l => /目標用戶分群|選定焦點對象|用戶動機假設|排除對象/.test(l));
    });
    if (onI) break;
  }
  await page.waitForTimeout(300);
  await shot('stepI');

  // Capture core form state
  findings.form = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label, .circles-field-label')).map(e=>e.innerText.trim()).filter(Boolean);
    const expected = ['目標用戶分群', '選定焦點對象', '用戶動機假設', '排除對象'];
    const missing = expected.filter(f => !labels.some(l=>l.includes(f)));

    const hintBtns = Array.from(document.querySelectorAll('button')).filter(b=>/提示/.test(b.innerText||''));
    const exBtns = Array.from(document.querySelectorAll('button, summary, a')).filter(b=>/查看範例/.test(b.innerText||''));

    const stepLabelEl = document.querySelector('h1,h2,h3,.circles-step-label,.prev-step-toggle-title');
    const hasDefineUser = /定義用戶/.test(document.body.innerText || '');

    const stickyBar = document.querySelector('#circles-p1-sticky, .circles-p1-sticky, .sticky-submit-bar, [class*="sticky"]');
    let stickyBox = null;
    if (stickyBar) {
      const r = stickyBar.getBoundingClientRect();
      stickyBox = { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width), cls: stickyBar.className };
    }

    const submit = document.getElementById('circles-p1-submit');
    const back = document.getElementById('circles-p1-back');

    const taps = ['#circles-p1-submit','#circles-p1-back','.rt-mtbtn','.hint-card-toggle','.circles-step-pill','button.rt-tbtn'].map(s=>{
      const el = document.querySelector(s);
      if (!el) return { sel: s, present: false };
      const r = el.getBoundingClientRect();
      return { sel: s, w: Math.round(r.width), h: Math.round(r.height), present: true };
    });

    const save = document.querySelector('.save-indicator, [aria-live="polite"]');
    const saveInfo = save ? { tag: save.tagName, cls: save.className, ariaLive: save.getAttribute('aria-live'), text: (save.innerText||'').trim().slice(0,40) } : null;

    const rtToolbarsDesktop = document.querySelectorAll('.rt-toolbar:not(.rt-toolbar-mobile)').length;
    const rtToolbarsMobile = document.querySelectorAll('.rt-toolbar-mobile').length;
    const rtMobileBtns = document.querySelectorAll('.rt-toolbar-mobile .rt-mtbtn').length;
    const rtDesktopBtns = document.querySelectorAll('.rt-toolbar:not(.rt-toolbar-mobile) .rt-tbtn').length;

    const textareas = document.querySelectorAll('textarea').length;
    const editors = document.querySelectorAll('.rt-editor, [contenteditable="true"]').length;

    // Progress bar
    const progress = document.querySelector('.progress, [role="progressbar"], .circles-progress, .circles-step-pill.active');
    const progressInfo = progress ? { tag: progress.tagName, cls: progress.className } : null;

    return {
      labels: labels.slice(0,20),
      missing_fields: missing,
      hasDefineUser,
      step_label: stepLabelEl ? stepLabelEl.innerText.trim().slice(0,40) : null,
      hint_btn_count: hintBtns.length,
      example_btn_count: exBtns.length,
      sticky: stickyBox,
      submit_present: !!submit,
      back_present: !!back,
      taps,
      save_indicator: saveInfo,
      rt_toolbar_desktop: rtToolbarsDesktop,
      rt_toolbar_mobile: rtToolbarsMobile,
      rt_mobile_buttons: rtMobileBtns,
      rt_desktop_buttons: rtDesktopBtns,
      textareas,
      editors,
      progress: progressInfo,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });

  // Focus first textarea to test mobile sticky toolbar appearance (D2)
  const ta = page.locator('textarea').first();
  if (await ta.count()) {
    await ta.click().catch(()=>{});
    await page.waitForTimeout(400);
    findings.focus_state = await page.evaluate(() => {
      const mt = document.querySelector('.rt-toolbar-mobile');
      if (!mt) return { mobile_toolbar: null };
      const r = mt.getBoundingClientRect();
      const cs = getComputedStyle(mt);
      return { mobile_toolbar: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), display: cs.display, visibility: cs.visibility, position: cs.position } };
    });
    await shot('focused');
  }

  // Type sample text → wait for autosave indicator
  if (await ta.count()) {
    await ta.fill(`probe-${vp.name}-${Date.now()}`).catch(()=>{});
    await page.waitForTimeout(1500);
    findings.save_indicator_after_typing = await page.evaluate(() => {
      const e = document.querySelector('.save-indicator, [aria-live="polite"]');
      if (!e) return null;
      return { text: (e.innerText||'').trim().slice(0,40), ariaLive: e.getAttribute('aria-live'), cls: e.className };
    });
  }

  // K1: hamburger offcanvas — show resume / step-I session breadcrumb
  const ham = page.locator('#btn-hamburger').first();
  if (await ham.count()) {
    await ham.click().catch(()=>{});
    await page.waitForTimeout(400);
    findings.offcanvas = await page.evaluate(() => {
      const oc = document.querySelector('#offcanvas');
      if (!oc) return null;
      const visible = oc.offsetParent !== null;
      const text = (oc.innerText||'').slice(0,400);
      const hasStepI = /定義用戶|step.?I/i.test(text);
      return { visible, hasStepI, snippet: text.slice(0,200) };
    });
    await shot('offcanvas');
    const close = page.locator('#btn-offcanvas-close').first();
    if (await close.count()) await close.click().catch(()=>{});
    await page.waitForTimeout(200);
  }

  // C6: home resume banner
  await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  findings.resume_banner = await page.evaluate(() => {
    const sel = ['.resume-banner','.circles-resume','[class*="resume"]'];
    for (const s of sel) {
      const e = document.querySelector(s);
      if (e) return { sel: s, text: (e.innerText||'').slice(0,160), cls: e.className };
    }
    return null;
  });

  findings.console_errors = consoleMsgs.slice(0, 20);

  await browser.close();
  return { vp: vp.name, findings, console: consoleMsgs };
}

(async () => {
  const wantOnly = process.env.VIEWPORT;
  const list = wantOnly ? VIEWPORTS.filter(v => v.name === wantOnly) : VIEWPORTS;
  const results = [];
  for (const vp of list) {
    const t0 = Date.now();
    process.stdout.write(`▶ ${vp.name}…\n`);
    try {
      const r = await Promise.race([
        probe(vp),
        new Promise((_, rej) => setTimeout(()=>rej(new Error('timeout-60s')), 60000))
      ]);
      results.push(r);
      process.stdout.write(`   done in ${Date.now()-t0}ms missing=${JSON.stringify((r.findings.form||{}).missing_fields||[])} errs=${(r.console||[]).length}\n`);
    } catch (e) {
      results.push({ vp: vp.name, error: String(e) });
      process.stdout.write(`   ERROR ${e}\n`);
    }
  }
  const outFile = path.join(OUT, '_results.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  process.stdout.write(`Wrote ${outFile}\n`);
})();
