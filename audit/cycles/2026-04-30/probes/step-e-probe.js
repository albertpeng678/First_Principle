// Step E (評估取捨) probe — runs across 8 viewports, captures step-E render,
// hint overlays, gate-in-context (E2 modify→drafts intact), simulation score nav,
// review-examples filter to step E, history offcanvas, mobile sticky toolbar,
// IME composition behaviour, autosave indicator, prev-step card render, and
// per-solution rendering with L draft solution names. READ-ONLY — no source edits.

const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';
const OUT = path.resolve(__dirname, '../screenshots/step-e');
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

async function probeViewport(vp) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  const findings = [];

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    userAgent: vp.isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
    if (m.type() === 'warning') consoleWarnings.push(m.text());
  });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('requestfailed', req => failedRequests.push(req.url() + ' ' + (req.failure() && req.failure().errorText)));

  try {
    // Suppress onboarding so it doesn't cover the page.
    await page.goto(BASE + '/?onboarding=0', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Pick a question via UI to ensure circlesSelectedQuestion is populated.
    // Use the first question card in 產品設計 tab.
    const cardCount = await page.locator('.circles-q-card').count().catch(() => 0);
    if (cardCount === 0) {
      findings.push({ id: 'NO-CARDS', msg: 'no .circles-q-card on home', severity: 'P0' });
    }
    if (cardCount > 0) {
      await page.locator('.circles-q-card').first().click();
      await page.waitForTimeout(300);
      // Click 確認，開始練習 — reveal full and confirm
      const confirm = page.locator('.circles-q-confirm-btn').first();
      if (await confirm.count()) {
        await confirm.scrollIntoViewIfNeeded();
        await confirm.click();
        await page.waitForTimeout(600);
      }
    }

    // Now we should be on Phase 1 step C1. Seed step E state directly.
    await page.evaluate(() => {
      const A = window.AppState;
      A.view = 'circles';
      A.circlesMode = 'drill';
      A.circlesPhase = 1;
      A.circlesDrillStep = 'E';
      // ensure circlesSession survives navigate()
      A.circlesSession = A.circlesSession || { id: 'probe-fake-id', mode: 'drill', drill_step: 'E' };
      A.circlesStepDrafts = A.circlesStepDrafts || {};
      A.circlesStepDrafts.L = {
        sol1: '方案A 推薦演算法',
        sol2: '方案B 用戶兌換時段',
        sol3: '',
        '方案一': '透過行為訊號自動推薦相關歌曲，廣告後立即接續播放',
        '方案二': '讓用戶用觀看廣告秒數兌換無廣告時段',
        '方案三（可選）': '',
      };
      A.circlesStepDrafts.E = A.circlesStepDrafts.E || {};
      // call render() directly (bypasses navigate()'s circlesSession guard)
      window.render && window.render();
    });
    await page.waitForTimeout(700);

    // Snapshot — step E full page + viewport
    await page.screenshot({ path: path.join(OUT, `${vp.name}-step-e-render.png`), fullPage: true });
    await page.screenshot({ path: path.join(OUT, `${vp.name}-step-e-viewport.png`), fullPage: false });
    // Scroll to bottom and capture viewport with sticky in place
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-step-e-bottom-viewport.png`), fullPage: false });
    await page.evaluate(() => window.scrollTo(0, 0));

    // Check key per-solution cards exist
    const solCards = await page.locator('.circles-step-letter-expansion, .circles-step-pills, .circles-step-pill').count();
    const stepEFields = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label, .circles-field-label, .field-label')).map(n => n.textContent.trim());
      const textareas = document.querySelectorAll('textarea');
      const hintBtns = document.querySelectorAll('button, [role="button"]');
      const htmlContains = ['優點', '缺點', '風險與依賴', '成功指標'].map(k => ({ k, present: document.body.innerText.includes(k) }));
      return {
        labels: labels.slice(0, 30),
        textareaCount: textareas.length,
        keyTerms: htmlContains,
        hasNextBtn: !!document.getElementById('circles-p1-submit'),
        submitText: (document.getElementById('circles-p1-submit') || {}).textContent || null,
        hasPrevStepCard: !!document.querySelector('.prev-step-card, [class*="prev-step"]'),
        bodyTextSnippet: document.body.innerText.slice(0, 600),
      };
    });

    // Horizontal scroll check
    const hScroll = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    if (hScroll.overflowX) findings.push({ id: 'OVERFLOW-X', msg: `docW=${hScroll.docW} winW=${hScroll.winW}`, severity: 'P0' });

    // Tap target audit on touch viewports
    if (vp.isMobile) {
      const tinyTaps = await page.evaluate(() => {
        const out = [];
        const els = document.querySelectorAll('button, [role="button"], a');
        els.forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.width < 44 || r.height < 44) {
            const txt = (el.innerText || el.getAttribute('aria-label') || '').slice(0, 40);
            out.push({ txt, w: Math.round(r.width), h: Math.round(r.height), cls: el.className.slice(0, 80) });
          }
        });
        return out.slice(0, 30);
      });
      if (tinyTaps.length) findings.push({ id: 'TAP-TARGET', msg: `${tinyTaps.length} tiny targets`, samples: tinyTaps.slice(0, 8), severity: 'P1' });
    }

    // Hint overlay test (D9 toggle): try to click the first 提示 button
    const hintRes = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /提示/.test(b.textContent) && !/收起/.test(b.textContent));
      if (!btn) return { found: false };
      btn.click();
      return { found: true, afterText: btn.textContent.trim() };
    });
    if (hintRes.found) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, `${vp.name}-step-e-hint-toggle.png`), fullPage: true });
    }

    // 查看範例 button presence
    const examplePresent = await page.locator('button', { hasText: '查看範例' }).count();

    // IME composition smoke (D3): focus first textarea and dispatch composition events
    const imeRes = await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (!ta) return { ok: false };
      ta.focus();
      // simulate composing
      ta.dispatchEvent(new CompositionEvent('compositionstart'));
      ta.value = 'ㄗ';
      ta.dispatchEvent(new InputEvent('input', { isComposing: true }));
      const composingFlag = !!ta._rtComposing;
      ta.dispatchEvent(new CompositionEvent('compositionend'));
      ta.value = '組字結果';
      ta.dispatchEvent(new InputEvent('input', { isComposing: false }));
      return { ok: true, composingFlag, finalValue: ta.value };
    });

    // Sticky save indicator visible?
    const stickyCheck = await page.evaluate(() => {
      const bar = document.querySelector('.save-indicator, [aria-live="polite"]');
      return { hasSaveIndicator: !!bar, ariaLive: bar && bar.getAttribute('aria-live') };
    });

    // Mobile rt-toolbar visibility (D2)
    const rtToolbar = await page.evaluate(() => {
      const t = document.querySelector('.rt-toolbar-mobile');
      if (!t) return { found: false };
      const cs = getComputedStyle(t);
      return { found: true, display: cs.display, position: cs.position, bottom: cs.bottom };
    });

    // Simulation score nav cache (G3) — render score view at a specific step
    await page.evaluate(() => {
      const A = window.AppState;
      A.circlesMode = 'simulation';
      A.circlesPhase = 3;
      A.circlesStepScores = {
        E: { total: 78, breakdown: [{ key: 'depth', label: '深度', score: 8 }, { key: 'breadth', label: '廣度', score: 7 }], comment: 'E 步分析具體' },
        L: { total: 80, breakdown: [{ key: 'depth', label: '深度', score: 9 }, { key: 'breadth', label: '廣度', score: 7 }], comment: 'L 步多元方案' },
      };
      A.circlesScoreResult = A.circlesStepScores.E;
      A.circlesDrillStep = 'E';
      A.circlesSession = A.circlesSession || { id: 'probe-fake-id', mode: 'simulation', drill_step: 'E' };
      window.render && window.render();
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-step-e-score.png`), fullPage: true });

    // Click prev arrow if present
    const navBtns = await page.evaluate(() => {
      const prev = document.querySelector('[aria-label*="上一步"], [data-score-nav="prev"], button.score-nav-prev');
      const next = document.querySelector('[aria-label*="下一步"], [data-score-nav="next"], button.score-nav-next');
      return { hasPrev: !!prev, hasNext: !!next };
    });

    // review-examples step filter to E (L1)
    await page.goto(BASE + '/review-examples.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const reviewState = await page.evaluate(() => {
      const filter = document.querySelector('#filter-step');
      const search = document.querySelector('#review-examples-search') || document.querySelector('#search');
      const out = { hasFilter: !!filter, filterAria: filter && filter.getAttribute('aria-label'), hasSearch: !!search };
      if (filter) {
        const opts = Array.from(filter.options || []).map(o => ({ value: o.value, label: o.textContent.trim() }));
        out.options = opts;
        const eOpt = opts.find(o => /^E$|評估取捨|^E\b/.test(o.label) || o.value === 'E');
        out.eOptionValue = eOpt && eOpt.value;
        if (eOpt) {
          filter.value = eOpt.value;
          filter.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return out;
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-step-e-review-filter.png`), fullPage: true });
    const reviewVisibleCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('.example-card, .review-card, .card, article');
      let visible = 0;
      cards.forEach(c => { if (c.getBoundingClientRect().height > 0 && getComputedStyle(c).display !== 'none') visible++; });
      return visible;
    });

    // Offcanvas open (K1 K2 K3)
    await page.goto(BASE + '/?onboarding=0', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const hambBtn = page.locator('#btn-hamburger');
    if (await hambBtn.count()) {
      await hambBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `${vp.name}-step-e-offcanvas.png`), fullPage: true });
      await page.locator('#btn-offcanvas-close').click().catch(() => {});
    }

    // M8 — malformed JSON envelope (server-side, viewport irrelevant but logged once on Desktop-1280)
    let m8 = null;
    if (vp.name === 'Desktop-1280') {
      const r = await page.evaluate(async (b) => {
        try {
          const res = await fetch(b + '/api/circles-public/hint', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Guest-ID': '00000000-0000-4000-8000-000000000001' },
            body: '{not-json',
          });
          const txt = await res.text();
          return { status: res.status, body: txt.slice(0, 200), ct: res.headers.get('content-type') };
        } catch (e) { return { err: String(e) }; }
      }, BASE);
      m8 = r;
    }

    return {
      viewport: vp.name,
      consoleErrors,
      consoleWarnings,
      pageErrors,
      failedRequests: failedRequests.slice(0, 20),
      stepEFields,
      hScroll,
      hintRes,
      examplePresent,
      imeRes,
      stickyCheck,
      rtToolbar,
      navBtns,
      reviewState,
      reviewVisibleCount,
      m8,
      findings,
    };
  } catch (e) {
    return { viewport: vp.name, fatal: e.message, stack: e.stack, consoleErrors, pageErrors, findings };
  } finally {
    await browser.close();
  }
}

(async () => {
  const all = [];
  for (const vp of VIEWPORTS) {
    process.stderr.write(`\n=== ${vp.name} ===\n`);
    const r = await probeViewport(vp);
    all.push(r);
  }
  fs.writeFileSync(path.resolve(__dirname, '../logs/step-e-raw.json'), JSON.stringify(all, null, 2));
  process.stderr.write('\nDone. Summary:\n');
  for (const r of all) {
    process.stderr.write(`${r.viewport}: errs=${(r.consoleErrors||[]).length} pageErrs=${(r.pageErrors||[]).length} findings=${(r.findings||[]).length}${r.fatal ? ' FATAL='+r.fatal : ''}\n`);
  }
})();
