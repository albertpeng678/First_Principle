// Probe for step C2 (優先排序) — runs across all 8 audit viewports.
// Drives the app from the home picker into simulation mode, advances to
// step index 3 (C2), captures screenshots, console errors, layout metrics.
//
// Usage:
//   node audit/cycles/2026-04-30/probes/step-c2-probe.js [viewport]
// Where viewport ∈ Mobile-360 | iPhone-SE | iPhone-14 | iPhone-15-Pro |
//                  iPad | Desktop-1280 | Desktop-1440 | Desktop-2560 | all
//
// READ-ONLY against the app — only writes screenshots + console logs to
// audit/cycles/2026-04-30/screenshots/step-c2/

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT  = path.join(__dirname, '..', 'screenshots', 'step-c2');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 780,  isMobile: true  },
  { name: 'iPhone-SE',     width: 375,  height: 667,  isMobile: true  },
  { name: 'iPhone-14',     width: 390,  height: 844,  isMobile: true  },
  { name: 'iPhone-15-Pro', width: 430,  height: 932,  isMobile: true  },
  { name: 'iPad',          width: 768,  height: 1024, isMobile: true  },
  { name: 'Desktop-1280',  width: 1280, height: 800,  isMobile: false },
  { name: 'Desktop-1440',  width: 1440, height: 900,  isMobile: false },
  { name: 'Desktop-2560',  width: 2560, height: 1440, isMobile: false },
];

async function probeOne(vp) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
  });
  const page = await ctx.newPage();
  const consoleMsgs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', e => consoleMsgs.push({ type: 'pageerror', text: e.message }));

  const findings = { viewport: vp.name, console: consoleMsgs, layout: {} };

  try {
    // 1) Home picker (guest, suppress onboarding).
    await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.circles-home-wrap', { timeout: 10000 });

    // Force simulation mode + select first design question.
    await page.evaluate(() => {
      try { localStorage.setItem('circlesMode', 'simulation'); } catch (e) {}
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.circles-mode-card[data-mode="simulation"].selected', { timeout: 5000 });

    // Snap home with mode selected
    await page.screenshot({ path: path.join(OUT, `${vp.name}-01-home-simulation.png`), fullPage: false });

    // Drive simulation by directly setting state then navigating to C2 via app internals.
    // We advance through phases using saveCirclesProgress + render manually:
    // Pick first question from CIRCLES_QUESTIONS, force simStep=3 (C2), phase 1.
    const advanced = await page.evaluate(async () => {
      try {
        if (!window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) return { ok: false, why: 'no_questions' };
        const q = window.CIRCLES_QUESTIONS.find(x => x.question_type === 'design') || window.CIRCLES_QUESTIONS[0];
        AppState.circlesMode = 'simulation';
        AppState.circlesSelectedQuestion = q;
        AppState.circlesSimStep = 3; // C2
        AppState.circlesPhase = 1;
        AppState.circlesDrillStep = 'C2';
        AppState.circlesPhase1Drafts = AppState.circlesPhase1Drafts || {};
        AppState.circlesPhase1Drafts['C2'] = AppState.circlesPhase1Drafts['C2'] || {};
        // Synthesize a fake session so renderCirclesPhase1 has something
        AppState.circlesSession = { id: 'probe-c2-' + Date.now(), mode: 'simulation', drill_step: 'C2' };
        AppState.view = 'circles';
        if (typeof render === 'function') {
          render();
          return { ok: true, q: q.id };
        }
        return { ok: false, why: 'no_renderer' };
      } catch (e) { return { ok: false, why: String(e) }; }
    });
    findings.advanced = advanced;

    if (advanced.ok) {
      await page.waitForTimeout(400);
      // Wait for any C2 field label to appear
      const labelSel = ':text("取捨標準"), :text("最優先項目"), :text("暫緩項目"), :text("排序理由")';
      try { await page.waitForSelector('text=取捨標準', { timeout: 5000 }); } catch {}

      await page.screenshot({ path: path.join(OUT, `${vp.name}-02-c2-phase1.png`), fullPage: true });

      // Layout metrics
      findings.layout = await page.evaluate(() => {
        const out = { fields: [], stickyBars: [], horizontalScroll: false, body: {} };
        const doc = document.documentElement;
        out.body.scrollWidth = doc.scrollWidth;
        out.body.clientWidth = doc.clientWidth;
        out.horizontalScroll = doc.scrollWidth > doc.clientWidth + 1;
        // Find overflow culprits
        if (out.horizontalScroll) {
          const culprits = [];
          document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.right > doc.clientWidth + 1 || r.left < -1) {
              culprits.push({
                tag: el.tagName, cls: (el.className||'').toString().slice(0,80),
                left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
              });
            }
          });
          out.overflowCulprits = culprits.slice(0, 8);
        }

        const labels = ['取捨標準','最優先項目','暫緩項目','排序理由'];
        labels.forEach(t => {
          const el = Array.from(document.querySelectorAll('label, .circles-field-label, .circles-step-field-label, h3, h2'))
            .find(n => (n.textContent || '').includes(t));
          if (el) {
            const r = el.getBoundingClientRect();
            out.fields.push({ name: t, top: r.top, left: r.left, w: r.width, h: r.height, visible: r.width > 0 && r.height > 0 });
          } else {
            out.fields.push({ name: t, missing: true });
          }
        });

        // Sticky bottom bar (next/prev) and mobile rich-text toolbar
        const sticky = document.querySelectorAll('.rt-toolbar-mobile, .circles-bottom-bar, .circles-phase1-bottom, [class*="sticky"], [class*="bottom-bar"]');
        sticky.forEach(s => {
          const r = s.getBoundingClientRect();
          const cs = getComputedStyle(s);
          out.stickyBars.push({
            cls: s.className,
            top: r.top, left: r.left, w: r.width, h: r.height,
            position: cs.position,
            zIndex: cs.zIndex,
          });
        });

        // Tap targets — buttons within the step form
        const buttons = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        out.smallTaps = buttons.filter(b => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && (r.width < 44 || r.height < 44);
        }).slice(0, 12).map(b => {
          const r = b.getBoundingClientRect();
          return { text: (b.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
        });

        // Hint / 查看範例 buttons present?
        out.hintBtns = Array.from(document.querySelectorAll('button')).filter(b => /提示/.test(b.textContent||'')).length;
        out.exampleBtns = Array.from(document.querySelectorAll('button')).filter(b => /查看範例/.test(b.textContent||'')).length;

        // Progress bar / step pill — does it show C2?
        const progressTexts = Array.from(document.querySelectorAll('.circles-progress, .circles-step-pill, [class*="step"]'))
          .map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 12);
        out.progressTexts = progressTexts;

        return out;
      });

      // Try clicking 提示 button on first field
      try {
        const hintBtn = await page.$('button:has-text("提示"):visible');
        if (hintBtn) {
          await hintBtn.click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(OUT, `${vp.name}-03-c2-hint-open.png`), fullPage: false });
          // Capture overlay metrics
          findings.hintOverlay = await page.evaluate(() => {
            const o = document.getElementById('circles-hint-overlay');
            if (!o) return null;
            const card = o.querySelector('.hint-card');
            const cr = card ? card.getBoundingClientRect() : null;
            return {
              visible: o.classList.contains('visible'),
              cardW: cr ? cr.width : null,
              cardH: cr ? cr.height : null,
              vpW: window.innerWidth, vpH: window.innerHeight,
              hasClose: !!o.querySelector('#hint-close-btn'),
            };
          });
          // Close it
          await page.evaluate(() => { const o = document.getElementById('circles-hint-overlay'); if (o) o.remove(); });
          await page.waitForTimeout(150);
        }
      } catch (e) { findings.hintErr = String(e); }

      // Try 查看範例 (uses .field-example-toggle class)
      try {
        const exBtn = await page.$('.field-example-toggle');
        if (exBtn) {
          await exBtn.scrollIntoViewIfNeeded().catch(() => {});
          await exBtn.click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(OUT, `${vp.name}-04-c2-example-open.png`), fullPage: false });
          findings.exampleInline = await page.evaluate(() => {
            const collapseBtns = Array.from(document.querySelectorAll('.field-example-toggle')).filter(b => /收起範例/.test(b.textContent || ''));
            const openBodies = Array.from(document.querySelectorAll('.field-example-body.open'));
            const bodyText = openBodies.map(b => (b.textContent || '').trim().slice(0, 60));
            return {
              opened: collapseBtns.length > 0 || openBodies.length > 0,
              collapseBtnCount: collapseBtns.length,
              openBodyCount: openBodies.length,
              bodyText,
            };
          });
          await page.evaluate(() => {
            ['circles-example-overlay','circles-hint-overlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
          });
          await page.waitForTimeout(150);
        }
      } catch (e) { findings.exampleErr = String(e); }

      // IME composition test — focus first textarea, simulate composition
      try {
        const ta = await page.$('textarea, [contenteditable="true"]');
        if (ta) {
          await ta.click();
          await page.keyboard.type('注音輸入 ');
          await page.waitForTimeout(200);
          await page.screenshot({ path: path.join(OUT, `${vp.name}-05-c2-textarea-focused.png`), fullPage: false });
          // Focused-state metrics — sticky bar position
          findings.focusMetrics = await page.evaluate(() => {
            const sticky = document.querySelector('.rt-toolbar-mobile');
            if (!sticky) return null;
            const r = sticky.getBoundingClientRect();
            return { top: r.top, height: r.height, vh: window.innerHeight, offset: window.innerHeight - r.bottom };
          });
        }
      } catch (e) { findings.focusErr = String(e); }
    }
  } catch (e) {
    findings.fatal = String(e);
  } finally {
    await browser.close();
  }
  return findings;
}

(async () => {
  const arg = process.argv[2];
  const list = arg && arg !== 'all' ? VIEWPORTS.filter(v => v.name === arg) : VIEWPORTS;
  if (!list.length) { console.error('Unknown viewport:', arg); process.exit(2); }
  const all = [];
  for (const vp of list) {
    process.stderr.write(`> probe ${vp.name}\n`);
    const r = await probeOne(vp);
    all.push(r);
    fs.writeFileSync(path.join(OUT, `${vp.name}-findings.json`), JSON.stringify(r, null, 2));
  }
  fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(all, null, 2));
  console.log(JSON.stringify(all, null, 2));
})();
