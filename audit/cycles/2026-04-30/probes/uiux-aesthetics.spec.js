// uiux-aesthetics.spec.js — runs as a Playwright spec under the existing config.
// Captures aesthetic checks (typography, color tokens, hierarchy, focus rings,
// empty/loading states) and writes screenshots into
// audit/cycles/2026-04-30/screenshots/uiux-aesthetics/<viewport>/.
//
// Heuristic, not a hard ship-gate — the human aesthetics director consumes the
// PNGs + the JSON dump.
'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT_ROOT = path.resolve(__dirname, '../screenshots/uiux-aesthetics');
const DUMP_ROOT = path.resolve(__dirname, '../logs');
fs.mkdirSync(OUT_ROOT, { recursive: true });
fs.mkdirSync(DUMP_ROOT, { recursive: true });

// Routes under test. Each setup leaves the page on its target screen.
const ROUTES = [
  { name: '01-home-guest',
    setup: async p => { await p.goto('/?onboarding=0'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500); }
  },
  { name: '02-onboarding-welcome',
    setup: async p => { await p.goto('/?onboarding=1'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(700); }
  },
  { name: '03-circles-step-c1',
    setup: async p => {
      await p.goto('/?onboarding=0'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500);
      await p.locator('.circles-q-card').first().click().catch(()=>{});
      await p.waitForTimeout(300);
      await p.locator('.circles-q-confirm-btn').first().click().catch(()=>{});
      await p.waitForTimeout(700);
    }
  },
  { name: '04-phase2-conclusion-expanded',
    setup: async p => {
      await p.goto('/?onboarding=0'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500);
      await p.evaluate(() => {
        if (typeof AppState === 'undefined') return;
        AppState.view='circles'; AppState.circlesPhase=2;
        AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS!=='undefined'?CIRCLES_QUESTIONS[0]:null);
        AppState.circlesMode='drill'; AppState.circlesDrillStep='C1';
        AppState.circlesSubmitState='expanded';
        if (typeof render==='function') render();
      });
      await p.waitForTimeout(600);
    }
  },
  { name: '05-nsm-home',
    setup: async p => {
      await p.goto('/?onboarding=0'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(400);
      await p.evaluate(()=> window.navigate && window.navigate('nsm'));
      await p.waitForTimeout(700);
    }
  },
  { name: '06-login',
    setup: async p => {
      await p.goto('/?onboarding=0'); await p.waitForLoadState('networkidle');
      await p.evaluate(()=> window.navigate && window.navigate('login'));
      await p.waitForTimeout(500);
    }
  },
  { name: '07-register',
    setup: async p => {
      await p.goto('/?onboarding=0'); await p.waitForLoadState('networkidle');
      await p.evaluate(()=> window.navigate && window.navigate('register'));
      await p.waitForTimeout(500);
    }
  },
  { name: '08-review-examples',
    setup: async p => { await p.goto('/review-examples.html'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(700); }
  },
  { name: '09-offcanvas-open',
    setup: async p => {
      await p.goto('/?onboarding=0'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(400);
      await p.locator('#btn-hamburger').click().catch(()=>{});
      await p.waitForTimeout(500);
    }
  },
  { name: '10-history',
    setup: async p => {
      await p.goto('/?onboarding=0'); await p.waitForLoadState('networkidle');
      await p.evaluate(()=> window.navigate && window.navigate('history'));
      await p.waitForTimeout(700);
    }
  },
];

// Aesthetic snapshot: gather typography, palette, hard-coded hex, contrast risk,
// focus ring presence, tap target undersize. Pure DOM/CSS sampling — no LLM.
async function collectAesthetics(page) {
  return await page.evaluate(() => {
    function rgb(c){
      const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
      const a = m[1].split(',').map(x => parseFloat(x.trim()));
      return { r:a[0], g:a[1], b:a[2], a: a.length>3?a[3]:1 };
    }
    function lum(c){
      function ch(v){ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }
      return 0.2126*ch(c.r)+0.7152*ch(c.g)+0.0722*ch(c.b);
    }
    function contrast(fg,bg){
      if (!fg||!bg) return null;
      const L1 = lum(fg), L2 = lum(bg);
      const a = Math.max(L1,L2), b = Math.min(L1,L2);
      return (a+0.05)/(b+0.05);
    }
    const all = Array.from(document.querySelectorAll('*')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
    });
    const fontFamilies = new Set();
    const fontSizes = new Set();
    const lowContrast = [];
    const undersizeTaps = [];
    let buttonsCount = 0;
    let focusVisibleRules = 0;
    for (const el of all) {
      const cs = getComputedStyle(el);
      fontFamilies.add(cs.fontFamily);
      // record only inline-text-bearing leaves
      if (el.children.length === 0 && (el.textContent||'').trim().length > 1) {
        fontSizes.add(parseFloat(cs.fontSize));
        const fg = rgb(cs.color);
        // climb to first non-transparent bg
        let p = el, bg = null;
        while (p) {
          const b = rgb(getComputedStyle(p).backgroundColor);
          if (b && b.a > 0.01) { bg = b; break; }
          p = p.parentElement;
        }
        const C = contrast(fg, bg);
        if (C !== null && C < 4.5) {
          lowContrast.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className||'').toString().slice(0,80),
            text: (el.textContent||'').trim().slice(0,40),
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            fg: cs.color,
            bg: bg ? `rgba(${bg.r},${bg.g},${bg.b},${bg.a})` : 'transparent',
            ratio: Math.round(C*100)/100,
          });
        }
      }
      if (el.matches('button, a, [role=button], .btn, input[type=submit]')) {
        buttonsCount++;
        const r = el.getBoundingClientRect();
        // touch viewport only — caller sub-filters
        if (r.width < 44 || r.height < 44) {
          undersizeTaps.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className||'').toString().slice(0,80),
            text: (el.textContent||'').trim().slice(0,30),
            w: Math.round(r.width), h: Math.round(r.height),
          });
        }
      }
    }
    // Hard-coded hex usage in inline style attributes
    const hardHex = [];
    for (const el of all) {
      const sa = el.getAttribute('style') || '';
      if (/#[0-9a-fA-F]{3,8}\b/.test(sa)) {
        hardHex.push({ cls:(el.className||'').toString().slice(0,80), style: sa.slice(0,160) });
      }
    }
    // CSS-defined `--c-*` tokens
    const rs = getComputedStyle(document.documentElement);
    const tokens = {};
    for (let i=0;i<rs.length;i++){
      const k = rs[i]; if (k.startsWith('--c-')) tokens[k] = rs.getPropertyValue(k).trim();
    }
    // focus ring detection — sample first 5 buttons
    const focusSamples = [];
    const btns = document.querySelectorAll('button, a, .btn');
    for (let i=0; i<Math.min(5, btns.length); i++) {
      const cs = getComputedStyle(btns[i], ':focus-visible');
      focusSamples.push({
        outline: cs.outline,
        outlineWidth: cs.outlineWidth,
        boxShadow: cs.boxShadow,
      });
    }
    return {
      fontFamilies: Array.from(fontFamilies),
      fontSizes: Array.from(fontSizes).sort((a,b)=>a-b),
      buttonsCount,
      undersizeTaps: undersizeTaps.slice(0, 30),
      lowContrast: lowContrast.slice(0, 30),
      hardHex: hardHex.slice(0, 30),
      tokens,
      focusSamples,
      docW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      horizScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

test.describe.configure({ mode: 'parallel' });

for (const r of ROUTES) {
  test(`AES.${r.name}`, async ({ page }, testInfo) => {
    if (testInfo.project.name === 'Desktop') test.skip();
    const dir = path.join(OUT_ROOT, testInfo.project.name);
    fs.mkdirSync(dir, { recursive: true });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
    await r.setup(page);
    await page.screenshot({ path: path.join(dir, `${r.name}.png`), fullPage: true });
    const a = await collectAesthetics(page);
    a.consoleErrors = errors;
    a.viewport = testInfo.project.name;
    a.route = r.name;
    fs.writeFileSync(
      path.join(dir, `${r.name}.json`),
      JSON.stringify(a, null, 2)
    );
    expect(a.horizScroll, `horizontal scroll on ${testInfo.project.name}/${r.name}`).toBeFalsy();
  });
}
