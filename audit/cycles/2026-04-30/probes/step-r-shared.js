// Shared step-R probe — exercises step R fields + Phase 2 chat (incl.
// conclusion-expanded sticky action row) at one viewport.
// Usage: node step-r-shared.js <viewport-name> <width> <height> [--mobile]
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

const viewport = process.argv[2] || 'Desktop-1280';
const width = parseInt(process.argv[3] || '1280', 10);
const height = parseInt(process.argv[4] || '800', 10);
const isMobile = process.argv.includes('--mobile');

const OUT = path.resolve(__dirname, '..', 'screenshots', 'step-r');
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
function log(label, severity, detail) {
  findings.push({ label, severity, detail });
  console.log(`[${severity}] ${label} :: ${detail}`);
}

async function shoot(page, name) {
  const file = path.join(OUT, `${name}-${viewport}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile,
    hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
    userAgent: isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on('console', m => {
    if (m.type() === 'error') consoleErrs.push(m.text());
  });
  page.on('pageerror', e => consoleErrs.push('PAGEERROR: ' + e.message));

  // ── 1. Boot to Step R via state injection (no real LLM round-trip) ────────
  await page.goto(BASE + '/?onboarding=0');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(700);

  // Drive into a synthetic Phase 1 step R state
  const ok = await page.evaluate(() => {
    if (typeof AppState === 'undefined') return false;
    AppState.view = 'circles';
    AppState.circlesPhase = 1;
    AppState.circlesMode = 'drill';
    AppState.circlesDrillStep = 'R';
    AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS[0] : null);
    AppState.circlesSession = AppState.circlesSession || {
      id: 'probe-r-' + Date.now(),
      drafts: { R: { '功能性需求': '', '情感性需求': '', '社交性需求': '', '核心痛點': '' } }
    };
    if (typeof render === 'function') render();
    return true;
  });
  if (!ok) log('boot', 'P0', 'AppState undefined — could not enter step R via state injection');

  await page.waitForTimeout(700);
  await shoot(page, '01-step-R-fields');

  // ── 2. D1: required fields present ────────────────────────────────────────
  const fieldKeys = ['功能性需求', '情感性需求', '社交性需求', '核心痛點'];
  const fieldStatus = await page.evaluate((keys) => {
    const out = {};
    for (const k of keys) {
      const labels = Array.from(document.querySelectorAll('label, .field-label, .circles-field-label'));
      out[k] = labels.some(l => (l.textContent || '').includes(k));
    }
    out.hintBtns = document.querySelectorAll('.hint-btn, [data-action="hint"], button').length;
    out.exampleBtns = Array.from(document.querySelectorAll('button')).filter(b => /查看範例|範例/.test(b.textContent || '')).length;
    out.textareas = document.querySelectorAll('textarea, .rich-text-editor, [contenteditable="true"]').length;
    out.hintCard = !!document.querySelector('.hint-card, .coach-hint, [class*="hint"]');
    return out;
  }, fieldKeys);
  for (const k of fieldKeys) {
    if (!fieldStatus[k]) log(`D1-field-${k}`, 'P1', `field label "${k}" not found in DOM`);
  }
  if (fieldStatus.exampleBtns === 0) log('D5-example-btn', 'P1', 'no 查看範例 buttons rendered on step R');
  if (fieldStatus.textareas === 0) log('D1-textarea', 'P0', 'no textarea / editor rendered on step R');

  // ── 3. D2: rich-text toolbar (desktop top + mobile sticky) ────────────────
  const toolbar = await page.evaluate(() => ({
    desktopTb: document.querySelectorAll('.rt-tbtn').length,
    mobileTb: document.querySelectorAll('.rt-toolbar-mobile .rt-mtbtn').length,
    mobileTbVisible: (() => {
      const el = document.querySelector('.rt-toolbar-mobile');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    })(),
  }));
  if (!isMobile && toolbar.desktopTb === 0) log('D2-desktop-tb', 'P1', 'no .rt-tbtn desktop toolbar buttons');
  if (isMobile && toolbar.mobileTb === 0) log('D2-mobile-tb', 'P1', 'no .rt-toolbar-mobile buttons');

  // ── 4. M5 tap target audit on visible buttons ─────────────────────────────
  if (isMobile) {
    const small = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll('button, a, [role="button"]')) {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 44 || r.height < 44) {
          out.push({ tag: b.tagName, text: (b.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
      return out.slice(0, 15);
    });
    if (small.length) log('M5-tap-target', 'P1', `${small.length} sub-44px touch targets on step R: ${JSON.stringify(small.slice(0, 5))}`);
  }

  // ── 5. M2 horizontal scroll on step R ─────────────────────────────────────
  const horiz = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (horiz) log('M2-horiz-scroll-R', 'P0', 'step R has horizontal scroll');

  // ── 6. Phase 2: conclusion-expanded sticky action row (F3) ────────────────
  await page.evaluate(() => {
    if (typeof AppState === 'undefined') return;
    AppState.view = 'circles';
    AppState.circlesPhase = 2;
    AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS[0] : null);
    AppState.circlesMode = 'drill';
    AppState.circlesDrillStep = 'R';
    AppState.circlesSubmitState = 'expanded';
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(700);
  await shoot(page, '02-phase2-conclusion-expanded');

  const expanded = await page.evaluate(() => {
    const box = document.querySelector('.circles-conclusion-box, #circles-conclusion-box');
    const back = document.querySelector('#circles-conclusion-back, .conclusion-back-btn');
    const submit = document.querySelector('#circles-conclusion-submit, .conclusion-submit-btn');
    const r = (el) => el ? el.getBoundingClientRect() : null;
    return {
      hasBox: !!box,
      hasBack: !!back,
      hasSubmit: !!submit,
      backRect: r(back),
      submitRect: r(submit),
      vh: window.innerHeight,
      vw: window.innerWidth,
      backText: back ? (back.textContent || '').trim() : '',
      submitText: submit ? (submit.textContent || '').trim() : '',
    };
  });

  if (!expanded.hasBox) {
    log('F3-conclusion-box-missing', 'P0', 'conclusion-expanded fixture: .circles-conclusion-box not in DOM');
  } else {
    if (!expanded.hasBack) log('F3-back-missing', 'P0', '繼續對話 button missing');
    if (!expanded.hasSubmit) log('F3-submit-missing', 'P0', '確認提交 button missing');
    // Sticky reachability — both buttons must be inside viewport rect
    if (expanded.backRect) {
      const r = expanded.backRect;
      if (r.bottom > expanded.vh + 1 || r.top < 0) {
        log('F3-back-not-reachable', 'P0', `繼續對話 outside viewport: rect=${JSON.stringify(r)} vh=${expanded.vh}`);
      }
      if (r.height < 36 && isMobile) log('F3-back-tiny', 'P1', `繼續對話 height ${r.height}px < 44 mobile`);
    }
    if (expanded.submitRect) {
      const r = expanded.submitRect;
      if (r.bottom > expanded.vh + 1 || r.top < 0) {
        log('F3-submit-not-reachable', 'P0', `確認提交 outside viewport: rect=${JSON.stringify(r)} vh=${expanded.vh}`);
      }
    }
  }

  // ── 7. F1: bubble parsing — synthetic chat with 被訪談者/教練點評 ─────────
  await page.evaluate(() => {
    if (typeof AppState === 'undefined') return;
    AppState.circlesPhase = 2;
    AppState.circlesSubmitState = null;
    AppState.circlesConversation = [
      { userMessage: '請問你是誰、為什麼用這個 App？',
        interviewee: '我是 27 歲上班族，每天通勤聽歌。',
        coaching: '提問清晰，建議追問使用情境。',
        hint: '可以接著問：什麼情境下會卡住？' }
    ];
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(500);
  await shoot(page, '03-phase2-chat-bubbles');

  const bubbles = await page.evaluate(() => {
    const ai = document.querySelectorAll('.circles-bubble-ai').length;
    const sectionLabels = Array.from(document.querySelectorAll('.circles-bubble-section')).map(e => (e.textContent || '').trim());
    return { aiCount: ai, sections: sectionLabels };
  });
  if (bubbles.aiCount === 0) log('F1-no-bubbles', 'P0', 'chat history not rendered as .circles-bubble-ai');
  if (!bubbles.sections.includes('被訪談者')) log('F1-no-interviewee-label', 'P1', 'no 被訪談者 section label rendered');
  if (!bubbles.sections.includes('教練點評')) log('F1-no-coaching-label', 'P1', 'no 教練點評 section label rendered');

  // ── 8. M2 final console errors check ──────────────────────────────────────
  if (consoleErrs.length) log('M2-console', 'P1', `console errors (${consoleErrs.length}): ${consoleErrs.slice(0, 3).join(' | ')}`);

  // emit findings.json
  fs.writeFileSync(path.join(__dirname, `step-r-${viewport}.findings.json`), JSON.stringify({ viewport, findings, consoleErrs }, null, 2));

  await browser.close();
  console.log('\nDONE', viewport, 'findings:', findings.length, 'console errs:', consoleErrs.length);
})().catch(e => { console.error(e); process.exit(1); });
