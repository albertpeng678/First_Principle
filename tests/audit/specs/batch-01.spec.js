// tests/audit/specs/batch-01.spec.js
// BATCH 01 — CIRCLES Home: Render + RWD
// 10 structural tests + 10 RWD tests × 4 breakpoints = 50 tests

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:4000';
const GUEST_ID = 'audit-batch-01';

const BREAKPOINTS = [
  { name: 'iPhone-SE-320',     width: 320,  height: 568  },
  { name: 'iPhone-14-Pro-390', width: 390,  height: 844  },
  { name: 'iPad-768',          width: 768,  height: 1024 },
  { name: 'desktop-1024',      width: 1024, height: 768  },
];

// --------------- helpers ---------------

async function setupGuest(page, context) {
  await context.addCookies([{ name: 'guest_id', value: GUEST_ID, url: BASE }]);
  await page.addInitScript((id) => {
    try { localStorage.setItem('guestId', id); } catch (_) {}
  }, GUEST_ID);
}

async function waitForCirclesHome(page) {
  // The default view is 'circles' (per AppState.view in app.js).
  // Wait for the title to appear which signals home rendered.
  await page.waitForSelector('.circles-home-title', { timeout: 15000 });
}

async function getHorizontalOverflowOffenders(page) {
  return await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      // ignore zero-size and elements completely off-screen left
      if (r.width === 0 && r.height === 0) return;
      if (r.right > vw + 1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '',
          id: el.id || '',
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    });
    // Filter to leaf-most offenders (skip parents that overflow only because a child does)
    return offenders;
  });
}

async function elementOverflowsViewport(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { exists: false };
    const r = el.getBoundingClientRect();
    return {
      exists: true,
      right: r.right,
      width: r.width,
      vw: window.innerWidth,
      overflows: r.right > window.innerWidth + 1,
    };
  }, selector);
}

// ----------- Test setup -----------

test.describe('Batch 01 — CIRCLES Home: Render + RWD', () => {

  test.describe('Render structure (10 tests)', () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test.beforeEach(async ({ page, context }) => {
      await setupGuest(page, context);
      await page.goto(BASE);
      await waitForCirclesHome(page);
    });

    test('1. Page title is "PM Drill — 第一性原理訓練器"', async ({ page }) => {
      await expect(page).toHaveTitle('PM Drill — 第一性原理訓練器');
    });

    test('2. Navbar shows "PM Drill" logo + hamburger button', async ({ page }) => {
      const logo = page.locator('.navbar .navbar-logo');
      await expect(logo).toBeVisible();
      await expect(logo).toHaveText(/PM Drill/);
      const hamb = page.locator('#btn-hamburger');
      await expect(hamb).toBeVisible();
      await expect(hamb).toHaveAttribute('aria-label', '開啟選單');
    });

    test('3. Main content has [data-view="circles"] wrapper', async ({ page }) => {
      const wrapper = page.locator('[data-view="circles"]');
      await expect(wrapper.first()).toBeVisible();
    });

    test('4. .circles-home-title exists with text "CIRCLES 訓練"', async ({ page }) => {
      const title = page.locator('.circles-home-title');
      await expect(title).toBeVisible();
      await expect(title).toHaveText('CIRCLES 訓練');
    });

    test('5. .circles-home-title has font-family DM Sans (NOT Instrument Serif) — spec line 7556', async ({ page }) => {
      const ff = await page.locator('.circles-home-title').evaluate(el => getComputedStyle(el).fontFamily);
      // Computed font-family will list the resolved fallbacks; "DM Sans" must be the primary stated face.
      expect(ff).toMatch(/DM Sans/i);
      expect(ff).not.toMatch(/Instrument Serif/i);
    });

    test('6. NO circles-home-back button in DOM — spec line 7557', async ({ page }) => {
      const back = page.locator('#circles-home-back');
      await expect(back).toHaveCount(0);
    });

    test('7. Info card exists (.circles-info-card)', async ({ page }) => {
      await expect(page.locator('.circles-info-card')).toBeVisible();
    });

    test('8. Info card body collapsed by default (display: none)', async ({ page }) => {
      const body = page.locator('#info-card-body');
      await expect(body).toHaveCount(1);
      const display = await body.evaluate(el => el.style.display || getComputedStyle(el).display);
      expect(display).toBe('none');
    });

    test('9. Mode selector renders 2 cards (.circles-mode-card)', async ({ page }) => {
      const cards = page.locator('.circles-mode-card');
      await expect(cards).toHaveCount(2);
    });

    test('10. Type tabs render 3 tabs (產品設計/產品改進/產品策略)', async ({ page }) => {
      const tabs = page.locator('.circles-type-tab');
      await expect(tabs).toHaveCount(3);
      await expect(page.locator('.circles-type-tab[data-type="design"]')).toContainText('產品設計');
      await expect(page.locator('.circles-type-tab[data-type="improve"]')).toContainText('產品改進');
      await expect(page.locator('.circles-type-tab[data-type="strategy"]')).toContainText('產品策略');
    });
  });

  // RWD tests at each breakpoint
  for (const bp of BREAKPOINTS) {
    test.describe(`RWD @ ${bp.name} (${bp.width}×${bp.height})`, () => {
      test.use({ viewport: { width: bp.width, height: bp.height } });

      test.beforeEach(async ({ page, context }) => {
        await setupGuest(page, context);
        await page.goto(BASE);
        await waitForCirclesHome(page);
      });

      test(`No horizontal overflow at ${bp.width}px`, async ({ page }) => {
        const offenders = await getHorizontalOverflowOffenders(page);
        // Filter to top-most offenders (most informative). Allow up to 1px sub-pixel rounding.
        const real = offenders.filter(o => o.right > bp.width + 1);
        expect(real, `Horizontal overflow @ ${bp.width}px: ${JSON.stringify(real.slice(0, 5))}`).toHaveLength(0);
      });

      test(`Navbar fits at ${bp.width}px (no element clipped)`, async ({ page }) => {
        const navStatus = await page.evaluate((vw) => {
          const nav = document.querySelector('.navbar');
          if (!nav) return { ok: false, reason: 'no navbar' };
          const r = nav.getBoundingClientRect();
          if (r.right > vw + 1) return { ok: false, reason: 'navbar overflows', right: r.right, vw };
          // Check children
          const offenders = [];
          nav.querySelectorAll('*').forEach(el => {
            const cr = el.getBoundingClientRect();
            if (cr.width > 0 && cr.right > vw + 1) {
              offenders.push({ tag: el.tagName.toLowerCase(), cls: (el.className||'').toString().slice(0,40), right: Math.round(cr.right) });
            }
          });
          return { ok: offenders.length === 0, offenders };
        }, bp.width);
        expect(navStatus.ok, `Navbar overflow: ${JSON.stringify(navStatus)}`).toBe(true);
      });

      test(`Question cards width <= viewport at ${bp.width}px`, async ({ page }) => {
        // Wait for at least one q-card or accept empty state
        const cards = page.locator('.circles-q-card');
        const n = await cards.count();
        if (n === 0) {
          // Allow zero-questions empty state
          test.info().annotations.push({ type: 'note', description: 'No question cards rendered (data may be empty)' });
          return;
        }
        const widths = await cards.evaluateAll(els => els.map(el => {
          const r = el.getBoundingClientRect();
          return { right: r.right, width: r.width };
        }));
        const offenders = widths.filter(w => w.right > bp.width + 1);
        expect(offenders, `Q card overflow: ${JSON.stringify(offenders)}`).toHaveLength(0);
      });

      test(`Mode cards stack or shrink properly at ${bp.width}px`, async ({ page }) => {
        const info = await page.evaluate((vw) => {
          const cards = Array.from(document.querySelectorAll('.circles-mode-card'));
          if (cards.length !== 2) return { count: cards.length };
          return cards.map(c => {
            const r = c.getBoundingClientRect();
            return { right: r.right, left: r.left, width: r.width };
          });
        }, bp.width);
        expect(Array.isArray(info)).toBe(true);
        expect(info.length).toBe(2);
        for (const c of info) {
          expect(c.right, `Mode card right ${c.right} > vw ${bp.width}`).toBeLessThanOrEqual(bp.width + 1);
          expect(c.width, `Mode card width too small (${c.width})`).toBeGreaterThanOrEqual(60);
        }
      });

      test(`Type tabs scrollable or fit at ${bp.width}px`, async ({ page }) => {
        const status = await page.evaluate((vw) => {
          const wrap = document.querySelector('.circles-type-tabs');
          if (!wrap) return { ok: false, reason: 'no .circles-type-tabs' };
          const wrapR = wrap.getBoundingClientRect();
          const tabs = Array.from(wrap.querySelectorAll('.circles-type-tab'));
          const lastR = tabs[tabs.length - 1]?.getBoundingClientRect();
          // Either container fits in viewport AND last tab is fully inside, OR container is scrollable.
          const overflowX = getComputedStyle(wrap).overflowX;
          const containerFits = wrapR.right <= vw + 1;
          const lastFits = lastR ? (lastR.right <= vw + 1) : true;
          const scrollable = overflowX === 'auto' || overflowX === 'scroll';
          return {
            ok: (containerFits && lastFits) || scrollable,
            containerFits, lastFits, scrollable,
            wrapRight: wrapR.right, lastRight: lastR?.right,
          };
        }, bp.width);
        expect(status.ok, `Type tabs neither fit nor scrollable: ${JSON.stringify(status)}`).toBe(true);
      });

      test(`Touch targets >= 44x44 at ${bp.width}px (interactive elements)`, async ({ page }) => {
        const small = await page.evaluate(() => {
          const sel = '.circles-mode-card, .circles-type-tab, .circles-step-pill, .nsm-banner-btn, #circles-random-btn, #btn-hamburger, .circles-q-card, .circles-resume-card';
          const offenders = [];
          document.querySelectorAll(sel).forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
              offenders.push({
                cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : '',
                id: el.id || '',
                w: Math.round(r.width),
                h: Math.round(r.height),
              });
            }
          });
          return offenders;
        });
        expect(small, `Touch targets < 44px: ${JSON.stringify(small)}`).toHaveLength(0);
      });

      test(`Font >= 11px at ${bp.width}px (no unreadable text)`, async ({ page }) => {
        const tiny = await page.evaluate(() => {
          const sel = '[data-view="circles"] *';
          const offenders = [];
          document.querySelectorAll(sel).forEach(el => {
            // Only check elements with direct visible text node
            const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
            if (!hasText) return;
            const fs = parseFloat(getComputedStyle(el).fontSize || '0');
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (fs > 0 && fs < 11) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : '',
                fs: Math.round(fs * 10) / 10,
                txt: (el.textContent || '').trim().slice(0, 30),
              });
            }
          });
          return offenders;
        });
        expect(tiny, `Font < 11px: ${JSON.stringify(tiny.slice(0, 5))}`).toHaveLength(0);
      });

      test(`NSM banner button visible at ${bp.width}px`, async ({ page }) => {
        const btn = page.locator('#circles-nsm-banner-btn');
        await expect(btn).toBeVisible();
        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        // Button right edge inside viewport
        expect(box.x + box.width, `NSM btn right ${box.x + box.width} > vw ${bp.width}`).toBeLessThanOrEqual(bp.width + 1);
      });

      test(`Random button (#circles-random-btn) visible + clickable at ${bp.width}px`, async ({ page }) => {
        const rnd = page.locator('#circles-random-btn');
        await expect(rnd).toBeVisible();
        await expect(rnd).toBeEnabled();
        await expect(rnd).toHaveText(/隨機選題/);
        // Pointer-events not blocked
        const blocked = await rnd.evaluate(el => getComputedStyle(el).pointerEvents === 'none');
        expect(blocked).toBe(false);
        // Click should not throw
        await rnd.click({ trial: false });
      });

      test(`No text overflow on company badges at ${bp.width}px`, async ({ page }) => {
        const offenders = await page.evaluate((vw) => {
          const els = Array.from(document.querySelectorAll('.circles-q-card-company'));
          const out = [];
          els.forEach(el => {
            const r = el.getBoundingClientRect();
            // Check overflow: scrollWidth > clientWidth + 1 indicates clipped text
            const clipped = el.scrollWidth > el.clientWidth + 1;
            if (clipped || r.right > vw + 1) {
              out.push({
                txt: (el.textContent || '').trim().slice(0, 40),
                right: Math.round(r.right),
                scrollW: el.scrollWidth,
                clientW: el.clientWidth,
                clipped,
              });
            }
          });
          return out;
        }, bp.width);
        expect(offenders, `Company badge overflow: ${JSON.stringify(offenders)}`).toHaveLength(0);
      });
    });
  }
});
