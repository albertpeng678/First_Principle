// audit/cycles/2026-04-30/probes/uiux-rwd.js
// RWD 痛點獵人 multi-viewport probe.
// Runs each route across the 8 audit viewports, detects horizontal overflow,
// off-screen sticky bars, tap-targets <44px, and writes screenshots.
//
// Usage:  node audit/cycles/2026-04-30/probes/uiux-rwd.js
//
// Output: audit/cycles/2026-04-30/screenshots/uiux-rwd/<viewport>-<route>.png
//         audit/cycles/2026-04-30/probes/uiux-rwd-findings.json

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const ROOT = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(ROOT, 'screenshots/uiux-rwd');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'Mobile-360',    width: 360,  height: 780,  isMobile: true,  hasTouch: true },
  { name: 'iPhone-SE',     width: 375,  height: 667,  isMobile: true,  hasTouch: true },
  { name: 'iPhone-14',     width: 390,  height: 844,  isMobile: true,  hasTouch: true },
  { name: 'iPhone-15-Pro', width: 430,  height: 932,  isMobile: true,  hasTouch: true },
  { name: 'iPad',          width: 768,  height: 1024, isMobile: true,  hasTouch: true },
  { name: 'Desktop-1280',  width: 1280, height: 800,  isMobile: false, hasTouch: false },
  { name: 'Desktop-1440',  width: 1440, height: 900,  isMobile: false, hasTouch: false },
  { name: 'Desktop-2560',  width: 2560, height: 1440, isMobile: false, hasTouch: false },
];

// Routes are functions because some need JS navigation.
const ROUTES = [
  {
    key: 'home',
    label: 'CIRCLES home (question picker)',
    setup: async (page) => {
      await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
    },
  },
  {
    key: 'home-onboarding',
    label: 'Onboarding welcome card',
    setup: async (page) => {
      await page.goto(`${BASE}/?onboarding=1`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    },
  },
  {
    key: 'circles-step-c1',
    label: 'CIRCLES Phase 1 step C1 (drill)',
    setup: async (page) => {
      await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      // pick first card
      await page.locator('.circles-q-card').first().click().catch(()=>{});
      await page.waitForTimeout(200);
      await page.locator('.circles-q-confirm-btn').first().click().catch(()=>{});
      await page.waitForSelector('.circles-submit-bar, #circles-p1-submit', { timeout: 4000 }).catch(()=>{});
      await page.waitForTimeout(400);
    },
  },
  {
    key: 'circles-step-c1-keyboard',
    label: 'C1 with mobile keyboard simulated (textarea focus)',
    setup: async (page) => {
      await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await page.locator('.circles-q-card').first().click().catch(()=>{});
      await page.waitForTimeout(200);
      await page.locator('.circles-q-confirm-btn').first().click().catch(()=>{});
      await page.waitForSelector('.circles-submit-bar, #circles-p1-submit', { timeout: 4000 }).catch(()=>{});
      // focus first textarea/contenteditable
      const ta = page.locator('textarea, [contenteditable="true"]').first();
      if (await ta.count()) await ta.focus().catch(()=>{});
      await page.waitForTimeout(400);
    },
  },
  {
    key: 'phase2-conclusion-expanded',
    label: 'Phase 2 conclusion-expanded (sticky action row)',
    setup: async (page) => {
      // route fixture from rwd-visual-gate
      await page.goto(`${BASE}/?onboarding=0&fixture=09-phase2-conclusion-expanded`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
    },
  },
  {
    key: 'nsm-home',
    label: 'NSM workshop home (step 1)',
    setup: async (page) => {
      await page.goto(`${BASE}/?onboarding=0&view=nsm`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
    },
  },
  {
    key: 'login',
    label: 'Login screen',
    setup: async (page) => {
      await page.goto(`${BASE}/?onboarding=0&view=login`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
    },
  },
  {
    key: 'review-examples',
    label: 'review-examples standalone',
    setup: async (page) => {
      await page.goto(`${BASE}/review-examples.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
    },
  },
  {
    key: 'offcanvas',
    label: 'Offcanvas drawer open',
    setup: async (page) => {
      await page.goto(`${BASE}/?onboarding=0`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await page.locator('#btn-hamburger').click().catch(()=>{});
      await page.waitForTimeout(400);
    },
  },
];

const findings = [];

function rec(viewport, route, severity, title, detail) {
  findings.push({ viewport, route, severity, title, detail });
}

async function audit(page, vp, route) {
  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(String(err)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    await route.setup(page);
  } catch (e) {
    rec(vp.name, route.key, 'P0', `Setup threw: ${route.label}`, String(e));
    return;
  }

  // 1. Horizontal overflow
  const horiz = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    let widest = null;
    let widestW = 0;
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > winW + 1 && r.width > widestW) {
        widestW = r.width;
        widest = `${el.tagName.toLowerCase()}${el.id ? '#'+el.id : ''}${el.className && typeof el.className === 'string' ? '.'+el.className.split(' ').slice(0,2).join('.') : ''}`;
      }
    });
    return { docW, winW, widest, widestW };
  });
  if (horiz.docW > horiz.winW + 1) {
    rec(vp.name, route.key, 'P0',
      `Horizontal scroll: docW=${horiz.docW} > winW=${horiz.winW}`,
      `widest offending element: ${horiz.widest} (width ${Math.round(horiz.widestW)}px)`);
  }

  // 2. Sticky/fixed bottom bars off-screen
  const stickyCheck = await page.evaluate(() => {
    const winH = window.innerHeight;
    const targets = [
      '.circles-submit-bar', '.circles-submit-row',
      '.rt-toolbar-mobile',
      '.nsm-bottom-bar', '#circles-gate-continue',
    ];
    const out = [];
    targets.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.offsetParent === null && getComputedStyle(el).display === 'none') return;
        const r = el.getBoundingClientRect();
        out.push({ sel, top: r.top, bottom: r.bottom, height: r.height, winH, visible: r.bottom > 0 && r.top < winH });
      });
    });
    return out;
  });
  for (const s of stickyCheck) {
    if (s.height > 0 && (s.bottom > s.winH + 4 || s.top > s.winH)) {
      rec(vp.name, route.key, 'P1',
        `Sticky bar off-screen: ${s.sel}`,
        `bottom=${Math.round(s.bottom)} > winH=${s.winH}`);
    }
  }

  // 3. Tap targets on touch viewports
  if (vp.hasTouch) {
    const small = await page.evaluate(() => {
      const sels = ['button', 'a', '[role=button]', '.btn', '.rt-mtbtn', '.rt-tbtn',
        '.circles-type-tab', '.circles-mode-card', '.s-step-tab', '.nsm-subtab',
        '.offcanvas-delete-btn', '.history-delete-btn', '.dismiss', '.resume-go'];
      const seen = new Set();
      const bad = [];
      sels.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return; // hidden
          if (getComputedStyle(el).visibility === 'hidden') return;
          if (r.width < 44 || r.height < 44) {
            bad.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className && typeof el.className === 'string' ? el.className.slice(0, 60) : ''),
              id: el.id || '',
              w: Math.round(r.width), h: Math.round(r.height),
              text: (el.textContent || '').trim().slice(0, 30),
            });
          }
        });
      });
      return bad.slice(0, 15);
    });
    if (small.length) {
      rec(vp.name, route.key, 'P1',
        `Tap-target <44px: ${small.length} hits`,
        small.map(b => `${b.tag}.${b.cls.split(' ')[0]}#${b.id} ${b.w}x${b.h} "${b.text}"`).join(' | '));
    }
  }

  // 4. Content/viewport ratio on desktop
  if (!vp.isMobile) {
    const ratio = await page.evaluate(() => {
      const el = document.querySelector('.circles-home-desktop')
        || document.querySelector('.app-shell')
        || document.querySelector('main')
        || document.querySelector('#app');
      if (!el) return null;
      return el.getBoundingClientRect().width / window.innerWidth;
    });
    if (ratio !== null && ratio < 0.85) {
      rec(vp.name, route.key, 'P1',
        `Content/viewport ratio ${ratio.toFixed(2)} < 0.85 on desktop`,
        `route=${route.key}`);
    }
  }

  // 5. Screenshot (full page so we see scrollbar)
  const shot = path.join(SHOT_DIR, `${vp.name}-${route.key}.png`);
  await page.screenshot({ path: shot, fullPage: false }).catch(()=>{});

  if (consoleErrors.length) {
    rec(vp.name, route.key, 'P1',
      `Console errors: ${consoleErrors.length}`,
      consoleErrors.slice(0, 3).join(' || '));
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      deviceScaleFactor: vp.isMobile ? 2 : 1,
    });
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      try {
        await audit(page, vp, route);
      } catch (e) {
        rec(vp.name, route.key, 'P1', `audit threw`, String(e));
      } finally {
        await page.close();
      }
    }
    await ctx.close();
    process.stdout.write(`  done ${vp.name}\n`);
  }
  await browser.close();

  const out = path.join(__dirname, 'uiux-rwd-findings.json');
  fs.writeFileSync(out, JSON.stringify(findings, null, 2));
  console.log(`\n${findings.length} findings written to ${out}`);
  // Group summary
  const bySev = findings.reduce((m,f)=>((m[f.severity]=(m[f.severity]||0)+1),m),{});
  console.log('Severity:', bySev);
})();
