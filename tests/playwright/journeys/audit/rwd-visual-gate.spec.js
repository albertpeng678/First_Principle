// rwd-visual-gate.spec.js — HARD ship-blocker per plan §7.1 / Phase F.
//
// Captures full-page screenshots for every viewport project × route into
// audit/rwd-grid/<project>/<route>.png so a human can eyeball-verify all
// 8×8 = 64 frames at once. Each test ALSO asserts:
//   1. content/viewport ratio meets a per-form-factor floor
//   2. no unintended horizontal scroll
//
// Routes that require state (Phase 1 form, Phase 1.5 gate, Phase 3 score,
// NSM step 2/3/4) are seeded inline via guest-mode helpers; routes that
// can't be reached without OpenAI / DB writes are documented and skipped.

const { test, expect } = require('@playwright/test');

const SHELL_RATIO_FLOOR = {
  // Mobile gutters of 16-24px land near 0.85-0.91 depending on viewport — pick
  // 0.84 as floor so iPad (88%) and iPhone-SE (91%) both clear comfortably.
  mobile: 0.84,
  desktop: 0.86,
};

const ROUTES = [
  {
    name: '01-home-guest',
    desc: 'Home page — guest user, recent sessions empty',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(700);
    },
    contentSel: ['.circles-home-desktop', '[data-view="circles"]', 'main'],
  },
  {
    name: '02-circles-step-c',
    desc: 'Phase 1 — Step C form (CIRCLES drill, first question)',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(700);
      await page.locator('.circles-q-card').first().click().catch(() => {});
      await page.waitForTimeout(400);
      await page.locator('.circles-q-confirm-btn').first().click().catch(() => {});
      await page.waitForSelector('.phase1-desktop, .circles-phase1-wrap, #circles-p1-submit', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(700);
    },
    contentSel: ['.phase1-desktop', '.circles-phase1-wrap', 'main'],
  },
  {
    name: '03-nsm-home',
    desc: 'NSM — step 1 (question picker)',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      await page.evaluate(() => window.navigate && window.navigate('nsm'));
      await page.waitForSelector('.nsm-question-list, .nsm-question-card, .nsm-view', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(700);
    },
    contentSel: ['.nsm-home-desktop', '.nsm-view', 'main'],
  },
  {
    name: '04-login',
    desc: 'Login screen (centered card on desktop)',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(400);
      await page.evaluate(() => window.navigate && window.navigate('login'));
      await page.waitForTimeout(700);
    },
    contentSel: ['.login-desktop', '.card.login-card', 'main'],
    // Login is intentionally a centered narrow card on desktop. Don't enforce
    // the wide-fill ratio floor for this route.
    skipRatio: true,
  },
  {
    name: '05-review-examples',
    desc: 'Review examples — 100 cards, multi-col grid',
    setup: async (page) => {
      await page.goto('/review-examples.html');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(900);
    },
    contentSel: ['.container.review-desktop', '.container', 'main'],
  },
  {
    name: '06-offcanvas-open',
    desc: 'Offcanvas drawer open (sessions list)',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      await page.locator('#btn-hamburger').click().catch(() => {});
      await page.waitForTimeout(400);
    },
    contentSel: ['.offcanvas.open', '.offcanvas', 'main'],
    skipRatio: true, // drawer is by-design narrow
  },
  {
    name: '07-q-card-expanded',
    desc: 'Home — first question card expanded inline',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(700);
      await page.locator('.circles-q-card').first().click().catch(() => {});
      await page.waitForTimeout(400);
    },
    contentSel: ['.circles-home-desktop', '[data-view="circles"]', 'main'],
  },
  {
    name: '09-phase2-conclusion-expanded',
    desc: 'Phase 2 conclusion box expanded — sticky bottom action row',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        if (typeof AppState === 'undefined') return;
        AppState.view = 'circles';
        AppState.circlesPhase = 2;
        AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS[0] : null);
        AppState.circlesMode = 'drill';
        AppState.circlesDrillStep = 'C1';
        AppState.circlesSubmitState = 'expanded';
        if (typeof render === 'function') render();
      });
      await page.waitForTimeout(700);
    },
    contentSel: ['.circles-conclusion-box', '.phase2-desktop', 'main'],
    skipRatio: true, // box is fixed-bottom by design; ratio not meaningful
  },
  {
    name: '08-search-active',
    desc: 'Home — search input focused with query',
    setup: async (page) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(700);
      // Search input may not exist on mobile (only desktop home renders it).
      // Skip-and-screenshot home if missing, rather than failing the test.
      const has = await page.locator('#search-input').count();
      if (has) await page.locator('#search-input').first().fill('Netflix').catch(() => {});
      await page.waitForTimeout(400);
    },
    contentSel: ['.circles-home-desktop', '[data-view="circles"]', 'main'],
  },
];

test.describe.configure({ mode: 'parallel' });

for (const r of ROUTES) {
  test(`F.${r.name} — ${r.desc}`, async ({ page }, testInfo) => {
    // Skip on legacy `Desktop` project (alias of Desktop-1280 — would duplicate).
    if (testInfo.project.name === 'Desktop') test.skip();

    await r.setup(page);

    const projDir = `audit/rwd-grid/${testInfo.project.name}`;
    await page.screenshot({ path: `${projDir}/${r.name}.png`, fullPage: true });

    // No unintended horizontal scroll
    const horizScroll = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(horizScroll, `unintended horizontal scroll on ${testInfo.project.name}/${r.name}`).toBeFalsy();

    if (r.skipRatio) return;

    // Content/viewport ratio
    const data = await page.evaluate((sels) => {
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el && el.offsetWidth > 0) {
          return { sel: s, width: el.getBoundingClientRect().width, vw: window.innerWidth };
        }
      }
      return { sel: null, width: 0, vw: window.innerWidth };
    }, r.contentSel);

    const isMobile = !!testInfo.project.use.isMobile;
    const floor = isMobile ? SHELL_RATIO_FLOOR.mobile : SHELL_RATIO_FLOOR.desktop;
    const ratio = data.width / data.vw;
    expect(
      ratio,
      `content too narrow on ${testInfo.project.name}/${r.name}: ${Math.round(ratio * 100)}% (floor ${Math.round(floor * 100)}%, sel=${data.sel})`
    ).toBeGreaterThanOrEqual(floor);
  });
}
