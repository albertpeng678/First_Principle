// Shared probe runner for step L (提出方案) — fields 方案一 / 方案二 / 方案三 / 各方案特性.
// Usage from per-viewport entry file:
//   require('./step-l-shared').run({ name: 'iPhone-SE', width: 375, height: 667, isMobile: true });
//
// Captures screenshots into audit/cycles/2026-04-30/screenshots/step-l/ and prints
// console errors plus a JSON summary so the agent can include them in the log.
//
// Read-only: this script never edits source. It exercises real flows through the UI.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const SHOT_ROOT = path.resolve(__dirname, '..', 'screenshots', 'step-l');

function ts() { return new Date().toISOString().replace(/[:.]/g, '-'); }

async function shot(page, viewport, label) {
  const file = path.join(SHOT_ROOT, `${viewport}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

async function pickFirstQuestion(page) {
  await page.waitForSelector('.circles-q-card', { timeout: 8000 });
  const card = page.locator('.circles-q-card').first();
  await card.click().catch(() => {});
  // sticky confirm
  const confirm = page.locator('.circles-q-confirm-btn').first();
  if (await confirm.count()) await confirm.click().catch(() => {});
  await page.waitForSelector('#circles-p1-submit, .circles-submit-bar', { timeout: 8000 });
}

async function jumpToStepL(page) {
  // Drill mode: click the L pill if present, else mutate AppState directly + re-render.
  const pill = page.locator('.circles-step-pill[data-step="L"]');
  if (await pill.count()) {
    await pill.first().click().catch(() => {});
  }
  // Force render of L step (covers desktop where pills may be hidden)
  await page.evaluate(() => {
    if (typeof AppState !== 'undefined') {
      AppState.circlesMode = 'drill';
      AppState.circlesDrillStep = 'L';
      // Trigger re-render via the global render entrypoint.
      if (typeof window.render === 'function') {
        try { window.render(); } catch (e) {}
      }
    }
  });
  await page.waitForTimeout(600);
}

async function inspectLFields(page) {
  return page.evaluate(() => {
    function rect(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    const labels = Array.from(document.querySelectorAll('.circles-field-label, .field-label, label'))
      .map(el => (el.textContent || '').trim())
      .filter(Boolean);
    const sol3Add = document.getElementById('l-sol3-add-btn');
    const fields = ['方案一', '方案二', '方案三（可選）', '各方案特性'].map(name => {
      const found = labels.find(l => l.includes(name));
      return { name, present: !!found };
    });
    const ta = Array.from(document.querySelectorAll('.circles-phase1-wrap textarea, .circles-phase1-wrap [contenteditable]'));
    const taRects = ta.map(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height) };
    });
    return {
      stepHeader: (document.querySelector('.circles-nav-title') || {}).textContent || '',
      fields,
      labels,
      sol3AddVisible: sol3Add ? getComputedStyle(sol3Add).display !== 'none' : false,
      sol3AddRect: rect('#l-sol3-add-btn'),
      submitBar: rect('.circles-submit-bar'),
      submitBtn: rect('#circles-p1-submit'),
      backBtn: rect('#circles-p1-back'),
      hintBtns: document.querySelectorAll('.circles-hint-trigger').length,
      exampleBtns: document.querySelectorAll('.field-example-toggle').length,
      textareas: taRects,
      docHeight: document.documentElement.scrollHeight,
      vh: window.innerHeight,
      vw: window.innerWidth,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

async function checkTapTargets(page, isMobile) {
  if (!isMobile) return null;
  return page.evaluate(() => {
    const sels = ['.circles-hint-trigger', '.field-example-toggle', '.rt-mtbtn', '.rt-tbtn', '#circles-p1-submit', '#circles-p1-back', '#l-sol3-add-btn', '.add-solution-btn', '.circles-step-pill'];
    const small = [];
    sels.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && (r.width < 44 || r.height < 44)) {
          small.push({ sel, w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 30) });
        }
      });
    });
    return small;
  });
}

async function exerciseSol3Add(page) {
  const btn = page.locator('#l-sol3-add-btn');
  if (!(await btn.count())) return { found: false };
  const visibleBefore = await btn.isVisible().catch(() => false);
  if (!visibleBefore) return { found: true, visibleBefore: false };
  await btn.click().catch(() => {});
  await page.waitForTimeout(400);
  const sol3FieldVisible = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.circles-field-label, .field-label, label'))
      .map(el => (el.textContent || '').trim());
    return labels.some(l => l.includes('方案三'));
  });
  return { found: true, visibleBefore: true, sol3FieldVisible };
}

async function exerciseTyping(page) {
  // Type into 方案一 textarea (first solution textarea) so we can verify
  // autosave indicator + IME behaviour later.
  const ta = page.locator('.circles-phase1-wrap textarea').first();
  if (!(await ta.count())) return { typed: false };
  await ta.click().catch(() => {});
  await ta.fill('用戶主動廣告兌換機制：聽 N 廣告後解鎖 30 分鐘無廣告時段。').catch(() => {});
  await page.waitForTimeout(700);
  const indicator = await page.evaluate(() => {
    const el = document.querySelector('.save-indicator');
    return el ? (el.textContent || '').trim() : null;
  });
  return { typed: true, indicator };
}

async function exerciseHintCache(page) {
  const hintBtns = page.locator('.circles-hint-trigger');
  if (!(await hintBtns.count())) return { found: false };
  const t0 = Date.now();
  await hintBtns.first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const firstShown = await page.evaluate(() => !!document.querySelector('.hint-card, .hint-overlay, .circles-hint-popover'));
  const t1 = Date.now() - t0;
  // close & re-open
  await hintBtns.first().click().catch(() => {});
  await page.waitForTimeout(150);
  const t2 = Date.now();
  await hintBtns.first().click().catch(() => {});
  await page.waitForTimeout(400);
  const secondShown = await page.evaluate(() => !!document.querySelector('.hint-card, .hint-overlay, .circles-hint-popover'));
  const t3 = Date.now() - t2;
  return { found: true, firstShown, firstMs: t1, secondShown, secondMs: t3 };
}

async function checkStickyOverlap(page, height) {
  return page.evaluate((h) => {
    const bar = document.querySelector('.circles-submit-bar');
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    const tas = Array.from(document.querySelectorAll('.circles-phase1-wrap textarea'));
    const overlapped = tas.filter(t => {
      const tr = t.getBoundingClientRect();
      return tr.bottom > r.top && tr.bottom <= h + 5 && tr.top < r.top;
    }).length;
    return { barTop: r.top, barH: r.height, overlapped, vh: h };
  }, height);
}

async function run(viewport) {
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: !!viewport.isMobile,
    hasTouch: !!viewport.isMobile,
  });
  const page = await context.newPage();
  const consoleMsgs = [];
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push({ type: m.type(), text: m.text() });
  });
  page.on('pageerror', e => consoleMsgs.push({ type: 'pageerror', text: String(e) }));

  const out = { viewport: viewport.name, base: BASE, started: ts(), steps: {} };
  try {
    await page.goto(BASE + '/?onboarding=0');
    await page.waitForLoadState('networkidle');
    out.steps.home = await shot(page, viewport.name, '01-home');

    await pickFirstQuestion(page);
    out.steps.stepC1 = await shot(page, viewport.name, '02-step-c1');

    await jumpToStepL(page);
    out.steps.stepL = await shot(page, viewport.name, '03-step-l');

    out.inspect = await inspectLFields(page);
    out.tapTargets = await checkTapTargets(page, viewport.isMobile);
    out.sticky = await checkStickyOverlap(page, viewport.height);

    out.sol3 = await exerciseSol3Add(page);
    out.steps.stepLWithSol3 = await shot(page, viewport.name, '04-step-l-sol3');

    out.typing = await exerciseTyping(page);
    out.hintCache = await exerciseHintCache(page);
    out.steps.stepLAfterTyping = await shot(page, viewport.name, '05-step-l-typed');

    // Mobile keyboard simulation: focus textarea, then verify sticky bar still on screen
    if (viewport.isMobile) {
      const ta = page.locator('.circles-phase1-wrap textarea').first();
      if (await ta.count()) {
        await ta.focus().catch(() => {});
        await page.waitForTimeout(400);
        out.steps.stepLFocus = await shot(page, viewport.name, '06-step-l-focus');
        out.stickyOnFocus = await checkStickyOverlap(page, viewport.height);
      }
    }
  } catch (e) {
    out.error = String(e && e.stack || e);
  }
  out.console = consoleMsgs;
  out.finished = ts();
  console.log(JSON.stringify(out, null, 2));
  // Also persist the JSON next to the screenshots for the audit log
  try {
    const jsonOut = path.join(SHOT_ROOT, `${viewport.name}-result.json`);
    fs.writeFileSync(jsonOut, JSON.stringify(out, null, 2), 'utf8');
  } catch (e) {}
  await browser.close();
  return out;
}

module.exports = { run };

if (require.main === module) {
  const arg = process.argv[2] || 'Desktop-1280';
  const map = {
    'Mobile-360':    { name: 'Mobile-360',    width: 360,  height: 780,  isMobile: true },
    'iPhone-SE':     { name: 'iPhone-SE',     width: 375,  height: 667,  isMobile: true },
    'iPhone-14':     { name: 'iPhone-14',     width: 390,  height: 844,  isMobile: true },
    'iPhone-15-Pro': { name: 'iPhone-15-Pro', width: 430,  height: 932,  isMobile: true },
    'iPad':          { name: 'iPad',          width: 768,  height: 1024, isMobile: true },
    'Desktop-1280':  { name: 'Desktop-1280',  width: 1280, height: 800,  isMobile: false },
    'Desktop-1440':  { name: 'Desktop-1440',  width: 1440, height: 900,  isMobile: false },
    'Desktop-2560':  { name: 'Desktop-2560',  width: 2560, height: 1440, isMobile: false },
  };
  if (!map[arg]) { console.error('unknown viewport:', arg); process.exit(2); }
  run(map[arg]).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
