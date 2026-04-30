// audit-master.spec.js — Audit baseline failing spec.
// Generated 2026-04-30. One test() per P0/P1 issue from audit/issues-master.md.
// Tests are tagged in title with [Px] severity + cluster. Most are expected to FAIL
// at HEAD — they are the audit's failing baseline; they should turn green once
// the corresponding fix-cluster lands.

const { test, expect } = require('@playwright/test');

// ── helpers ──────────────────────────────────────────────────────────────────
const WIDE = ['Desktop-1440', 'Desktop-2560'];
const ULTRA = ['Desktop-2560'];
const TOUCH = ['Mobile-360', 'iPhone-SE', 'iPhone-14', 'iPhone-15-Pro', 'iPad'];
const PHONE = ['Mobile-360', 'iPhone-SE', 'iPhone-14', 'iPhone-15-Pro'];
const DESKTOP = ['Desktop-1280', 'Desktop-1440', 'Desktop-2560'];

function only(testInfo, names) {
  test.skip(!names.includes(testInfo.project.name), `only ${names.join(',')}`);
}

async function gotoHome(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

async function gotoCirclesStepC(page) {
  // Pick first question card and start in simulation mode.
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Click the first question card
  const card = page.locator('.circles-q-card').first();
  if (await card.count()) {
    await card.click().catch(() => {});
    // confirm button if any
    const confirm = page.locator('.circles-q-confirm-btn').first();
    if (await confirm.count()) await confirm.click().catch(() => {});
  }
  // Wait for submit bar (Step C) to appear
  await page.waitForSelector('.circles-submit-bar, #circles-p1-submit', { timeout: 5000 }).catch(() => {});
}

async function gotoNSM(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // App entry point is the global navigate('nsm') JS call (no URL-param route).
  await page.evaluate(() => window.navigate && window.navigate('nsm'));
  await page.waitForSelector('.nsm-question-list, .nsm-question-card', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function gotoLogin(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.navigate && window.navigate('login'));
  await page.waitForTimeout(400);
}

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-A — Wide-monitor layout (>=1440 fluid grid)
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-A — Wide-monitor layout', () => {
  test('AUD-000-A [P0] desktop home content >=70% viewport at >=1440', async ({ page }, testInfo) => {
    only(testInfo, WIDE);
    await gotoHome(page);
    const ratio = await page.evaluate(() => {
      const el = document.querySelector('.circles-home-desktop') || document.querySelector('main');
      if (!el) return 0;
      return el.getBoundingClientRect().width / window.innerWidth;
    });
    expect(ratio, 'home content/viewport ratio at >=1440').toBeGreaterThanOrEqual(0.70);
  });

  test('AUD-000-A2 [P0] desktop home inner-wrap fills container at 1280 (no mobile-680 squeeze)', async ({ page }, testInfo) => {
    only(testInfo, ['Desktop-1280']);
    await gotoHome(page);
    const data = await page.evaluate(() => {
      const wrap = document.querySelector('.circles-home-desktop .circles-home-wrap');
      const grid = document.querySelector('.circles-home-desktop .ch-grid');
      return {
        wrapW: wrap ? wrap.getBoundingClientRect().width : 0,
        gridW: grid ? grid.getBoundingClientRect().width : 0,
        vw: window.innerWidth,
      };
    });
    // Mobile rule caps .circles-home-wrap at 680px; desktop must override.
    expect(data.wrapW, 'inner wrap width at 1280 desktop').toBeGreaterThanOrEqual(1000);
    expect(data.gridW / data.vw, 'home grid/viewport ratio at 1280').toBeGreaterThanOrEqual(0.80);
  });

  test('AUD-000-A3 [P0] desktop right-rail recent-section is not empty bordered card when no sessions', async ({ page }, testInfo) => {
    only(testInfo, ['Desktop-1280', 'Desktop-1440', 'Desktop-2560']);
    await gotoHome(page);
    await page.waitForTimeout(900); // let async fetchRecentSessions settle (it wipes the slot when empty)
    const data = await page.evaluate(() => {
      const slot = document.getElementById('circles-recent-slot');
      if (!slot) return { exists: false };
      const text = (slot.textContent || '').trim();
      const cs = getComputedStyle(slot);
      const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
      const hasPad = parseFloat(cs.paddingTop) > 0;
      const isHidden = cs.display === 'none' || cs.visibility === 'hidden';
      return { exists: true, text, hasBorder, hasPad, isHidden };
    });
    expect(data.exists, 'recent-slot exists').toBeTruthy();
    // If the slot is rendered as a desktop card (has border + padding) and visible,
    // it must contain placeholder text — not be a hollow bordered box.
    if (!data.isHidden && data.hasBorder && data.hasPad) {
      expect(data.text.length, 'desktop right-rail card must show placeholder text when empty').toBeGreaterThan(0);
    }
  });

  test('AUD-003 [P0] CIRCLES step C uses >=1600px content area at 2560', async ({ page }, testInfo) => {
    only(testInfo, ULTRA);
    await gotoCirclesStepC(page);
    const w = await page.evaluate(() => {
      const el = document.querySelector('.phase1-desktop, .circles-step-form, [data-view="circles"] form, main');
      return el ? el.getBoundingClientRect().width : 0;
    });
    expect(w, 'Step C content area width at 2560').toBeGreaterThanOrEqual(1600);
  });

  test('AUD-004 [P0] NSM Step 1 uses multi-col grid at >=1440', async ({ page }, testInfo) => {
    only(testInfo, WIDE);
    await gotoNSM(page);
    // Count cards on the same y-line as the first card.
    const perRow = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.nsm-question-card'));
      if (cards.length === 0) return 0;
      const firstTop = Math.round(cards[0].getBoundingClientRect().top);
      return cards.filter(c => Math.abs(Math.round(c.getBoundingClientRect().top) - firstTop) < 4).length;
    });
    expect(perRow, 'NSM cards on first row at >=1440').toBeGreaterThanOrEqual(3);
  });

  test('AUD-005 [P0] review-examples >=3 cards/row + >=16px body at 2560', async ({ page }, testInfo) => {
    only(testInfo, ULTRA);
    await page.goto('/review-examples.html');
    await page.waitForLoadState('networkidle');
    const result = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.card'));
      if (cards.length === 0) return { perRow: 0, font: 0 };
      const firstTop = Math.round(cards[0].getBoundingClientRect().top);
      const perRow = cards.filter(c => Math.abs(Math.round(c.getBoundingClientRect().top) - firstTop) < 4).length;
      const body = cards[0].querySelector('.card-title, .card-body, p, div');
      const font = body ? parseFloat(getComputedStyle(body).fontSize) : 0;
      return { perRow, font };
    });
    expect(result.perRow, 'review cards per row at 2560').toBeGreaterThanOrEqual(3);
    expect(result.font, 'card body font-size').toBeGreaterThanOrEqual(16);
  });

  test('AUD-006 [P0] login centered or 2-col on desktop', async ({ page }, testInfo) => {
    only(testInfo, DESKTOP);
    await gotoLogin(page);
    const ok = await page.evaluate(() => {
      const card = document.querySelector('.login-desktop, form, .auth-form, main > div');
      if (!card) return false;
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const verticallyCentered = Math.abs(cy - window.innerHeight / 2) < window.innerHeight * 0.15;
      const wideTwoCol = r.width / window.innerWidth >= 0.55;
      return verticallyCentered || wideTwoCol;
    });
    expect(ok, 'login vertically centered or 2-column wide').toBeTruthy();
  });

  test('AUD-013 [P1] CIRCLES home middle column does not wrap company line at 1280/1440', async ({ page }, testInfo) => {
    only(testInfo, ['Desktop-1280', 'Desktop-1440']);
    await gotoHome(page);
    const wrap = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.circles-q-card-company'));
      if (els.length === 0) return null;
      return els.some(el => {
        const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
        return el.offsetHeight > lh * 1.5;
      });
    });
    expect(wrap, 'no company line wrapped to >1 line').toBe(false);
  });

  test('AUD-031 [P1] iPad home uses >=2 cols of question cards', async ({ page }, testInfo) => {
    only(testInfo, ['iPad']);
    await gotoHome(page);
    const perRow = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.circles-q-card'));
      if (cards.length === 0) return 0;
      const firstTop = Math.round(cards[0].getBoundingClientRect().top);
      return cards.filter(c => Math.abs(Math.round(c.getBoundingClientRect().top) - firstTop) < 4).length;
    });
    expect(perRow, 'question cards per row on iPad').toBeGreaterThanOrEqual(2);
  });

  test('AUD-030 [P1] review-examples on iPad >=15px font + >=2 cards/row', async ({ page }, testInfo) => {
    only(testInfo, ['iPad']);
    await page.goto('/review-examples.html');
    await page.waitForLoadState('networkidle');
    const r = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.card'));
      if (cards.length === 0) return { perRow: 0, font: 0 };
      const firstTop = Math.round(cards[0].getBoundingClientRect().top);
      const perRow = cards.filter(c => Math.abs(Math.round(c.getBoundingClientRect().top) - firstTop) < 4).length;
      const body = cards[0].querySelector('.card-title, p, div');
      const font = body ? parseFloat(getComputedStyle(body).fontSize) : 0;
      return { perRow, font };
    });
    expect(r.perRow, 'iPad review cards per row').toBeGreaterThanOrEqual(2);
    expect(r.font, 'iPad review body font').toBeGreaterThanOrEqual(15);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-B — Sticky bar / header collisions
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-B — Sticky bar / header collisions', () => {
  test('AUD-001 [P0] Step C bottom sticky bar does not cover textareas', async ({ page }) => {
    await gotoCirclesStepC(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const overlap = await page.evaluate(() => {
      const bar = document.querySelector('.circles-submit-bar');
      const tas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
      if (!bar || tas.length === 0) return null;
      const barTop = bar.getBoundingClientRect().top;
      // last visible textarea
      const last = tas[tas.length - 1];
      const r = last.getBoundingClientRect();
      // bottom of last textarea should be above bar top
      return r.bottom > barTop + 4;
    });
    expect(overlap, 'last textarea bottom above sticky bar top').toBe(false);
  });

  test('AUD-002 [P0] Step C top sticky header does not overlap field labels on iPhone-SE', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE']);
    await gotoCirclesStepC(page);
    const r = await page.evaluate(() => {
      const nav = document.querySelector('.navbar');
      const headings = Array.from(document.querySelectorAll('label, .circles-step-field-label, h2, h3'));
      if (!nav || headings.length === 0) return null;
      const navBottom = nav.getBoundingClientRect().bottom;
      // scroll one heading into view via scrollIntoView, then check
      headings[Math.min(2, headings.length - 1)].scrollIntoView({ block: 'start' });
      const top = headings[Math.min(2, headings.length - 1)].getBoundingClientRect().top;
      return { navBottom, top };
    });
    if (r) expect(r.top, 'heading top below navbar bottom').toBeGreaterThanOrEqual(r.navBottom - 1);
  });

  test('AUD-029 [P1] iOS keyboard: focused textarea not occluded by submit bar', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE', 'iPhone-15-Pro']);
    await gotoCirclesStepC(page);
    const ta = page.locator('textarea').first();
    if (!(await ta.count())) test.skip();
    await ta.focus();
    const r = await page.evaluate(() => {
      const bar = document.querySelector('.circles-submit-bar');
      const ta = document.activeElement;
      if (!bar || !ta) return null;
      const tr = ta.getBoundingClientRect();
      const br = bar.getBoundingClientRect();
      const opensFlag = bar.hasAttribute('data-kb-open') || bar.classList.contains('keyboard-open');
      return { taBottom: tr.bottom, barTop: br.top, opensFlag };
    });
    if (r) {
      const ok = r.opensFlag || r.taBottom <= r.barTop + 4;
      expect(ok, 'focused textarea visible above sticky bar OR bar marked keyboard-open').toBeTruthy();
    }
  });

  test('AUD-054 [P1] NSM Step 2 sticky bottom bar does not overlap content', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE', 'iPhone-15-Pro']);
    await gotoNSM(page);
    // Try to enter step 2 by selecting first card + clicking next
    const card = page.locator('.nsm-question-card').first();
    if (await card.count()) await card.click().catch(() => {});
    const next = page.locator('#btn-nsm-step1-next');
    if (await next.count()) await next.click().catch(() => {});
    await page.waitForTimeout(500);
    const overlap = await page.evaluate(() => {
      const bar = document.querySelector('.nsm-step2-desktop, .circles-submit-bar, .practice-bottom-bar, .nsm-bottom-bar');
      const ta = document.querySelector('textarea, [contenteditable="true"]');
      if (!bar || !ta) return null;
      const r = ta.getBoundingClientRect();
      const br = bar.getBoundingClientRect();
      return r.bottom > br.top + 4;
    });
    if (overlap !== null) expect(overlap, 'NSM step 2 textarea above sticky bar').toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-C — Nav consistency
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-C — Nav consistency', () => {
  test('AUD-000-B [P1] only one `北極星指標` entry in top nav', async ({ page }) => {
    await gotoHome(page);
    const count = await page.evaluate(() => {
      const nav = document.querySelector('.navbar');
      if (!nav) return -1;
      const all = Array.from(nav.querySelectorAll('*')).filter(el => {
        if (!el.children.length) return (el.textContent || '').trim() === '北極星指標';
        return false;
      });
      return all.length;
    });
    expect(count, '`北極星指標` entries in top nav').toBe(1);
  });

  test('AUD-007 [P0] review-examples renders global top nav', async ({ page }) => {
    await page.goto('/review-examples.html');
    await page.waitForLoadState('networkidle');
    const hasNav = await page.evaluate(() => !!document.querySelector('.navbar'));
    expect(hasNav, 'review-examples has .navbar').toBe(true);
  });

  test('AUD-033 [P1] Step C top nav active state', async ({ page }) => {
    await gotoCirclesStepC(page);
    const active = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.navbar-tab'));
      const activeTab = tabs.find(t => t.classList.contains('active'));
      return {
        activeCount: tabs.filter(t => t.classList.contains('active')).length,
        ariaCurrent: activeTab ? activeTab.getAttribute('aria-current') : null,
      };
    });
    expect(active.activeCount, 'exactly one .navbar-tab.active in CIRCLES step').toBe(1);
    expect(active.ariaCurrent, 'active tab has aria-current').toBeTruthy();
  });

  test('AUD-034 [P1] login page navbar primary CTA hides or relabels', async ({ page }) => {
    await gotoLogin(page);
    const txt = await page.evaluate(() => {
      const actions = document.getElementById('navbar-actions');
      if (!actions) return '';
      const btn = actions.querySelector('button, a');
      if (!btn || btn.offsetParent === null) return '';
      return (btn.textContent || '').trim();
    });
    expect(txt, 'login navbar CTA hidden or != 登入').not.toBe('登入');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-D — NSM mode routing & headers
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-D — NSM mode routing & headers', () => {
  test('AUD-008 [P0] tap `北極星指標` lands on NSM page', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE', 'iPad']);
    await gotoHome(page);
    // Try to find 北極星指標 button — may be in offcanvas on mobile.
    let clicked = false;
    const visible = page.locator('text=北極星指標').first();
    if (await visible.count()) {
      try {
        await visible.click({ timeout: 1500 });
        clicked = true;
      } catch {}
    }
    if (!clicked) {
      // open hamburger first
      await page.locator('#btn-hamburger').click().catch(() => {});
      await page.locator('text=北極星指標').first().click({ timeout: 1500 }).catch(() => {});
    }
    await page.waitForTimeout(700);
    const onNSM = await page.evaluate(() => !!document.querySelector('.nsm-question-list, .nsm-question-card, [data-view="nsm"]'));
    expect(onNSM, 'NSM view rendered after click').toBe(true);
  });

  test('AUD-009 [P0] NSM step screens never show CIRCLES C header', async ({ page }) => {
    await gotoNSM(page);
    // Try to advance into step 2 to check header
    const card = page.locator('.nsm-question-card').first();
    if (await card.count()) await card.click().catch(() => {});
    const next = page.locator('#btn-nsm-step1-next');
    if (await next.count()) await next.click().catch(() => {});
    await page.waitForTimeout(500);
    const bad = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      return /C\s*[-·]\s*澄清情境/.test(txt);
    });
    expect(bad, 'no CIRCLES C header in NSM mode').toBe(false);
  });

  test('AUD-040 [P1] NSM Step 1 shows exactly 5 cards', async ({ page }) => {
    await gotoNSM(page);
    const n = await page.locator('.nsm-question-card').count();
    expect(n, '.nsm-question-card count').toBe(5);
  });

  test('AUD-016 [P1] NSM 4-step indicator has labels', async ({ page }) => {
    await gotoNSM(page);
    const ok = await page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('.nsm-progress-step'));
      if (steps.length === 0) return false;
      const labels = ['情境', '指標', '拆解', '總結'];
      return steps.every(s => {
        const aria = s.getAttribute('aria-label') || '';
        const txt = (s.textContent || '') + (s.parentElement ? s.parentElement.textContent || '' : '');
        return labels.some(l => aria.includes(l) || txt.includes(l));
      });
    });
    expect(ok, 'each NSM step has Chinese label').toBe(true);
  });

  test('AUD-037 [P1] NSM Step 1 disabled CTA shows helper text', async ({ page }) => {
    await gotoNSM(page);
    const ok = await page.evaluate(() => {
      const btn = document.getElementById('btn-nsm-step1-next');
      if (!btn || !btn.disabled) return true; // already enabled means N/A
      const txt = document.body.innerText || '';
      return /請先選擇/.test(txt);
    });
    expect(ok, 'helper text 請先選擇 visible while CTA disabled').toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-E — Jargon expansion
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-E — Jargon expansion', () => {
  test('AUD-011 [P0] home expands CIRCLES letters and NSM acronym', async ({ page }) => {
    await gotoHome(page);
    const txt = await page.evaluate(() => document.body.innerText || '');
    // CIRCLES letters: at minimum letter list expanded
    const hasCircles = /Comprehend|Clarif|Identif|Report|Cut|Trade|List|Evaluate|Summari/i.test(txt) ||
      /[Cc]\s*[—=:].*?[Ii]\s*[—=:].*?[Rr]/.test(txt);
    const hasNSM = /North\s*Star|N\s*[—=:].*?S\s*[—=:].*?M/i.test(txt) || /北極星指標.*(代表|是|意思)/.test(txt);
    expect(hasCircles, 'CIRCLES letters expanded above fold').toBe(true);
    expect(hasNSM, 'NSM expansion above fold').toBe(true);
  });

  test('AUD-012 [P0] CIRCLES Step C shows letter expansion (Comprehend / Clarify + 澄清情境)', async ({ page }) => {
    await gotoCirclesStepC(page);
    const txt = await page.evaluate(() => document.body.innerText || '');
    expect(txt).toMatch(/Comprehend|Clarify/i);
    expect(txt).toContain('澄清情境');
  });

  test('AUD-035 [P1] 代理變數 has inline plain explanation in NSM Step 3', async ({ page }) => {
    // Best-effort: just check NSM page text — if 代理變數 appears, an explanation must too.
    await gotoNSM(page);
    const txt = await page.evaluate(() => document.body.innerText || '');
    if (!txt.includes('代理變數')) test.skip(true, '代理變數 not on this view');
    expect(txt, '代理變數 has inline explanation').toMatch(/可量化|代表|意思|指的是/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-F — Tap targets <44px
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-F — Tap targets', () => {
  test('AUD-020 [P1] Step C rich-text toolbar buttons >=44x44', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE', 'iPhone-15-Pro', 'iPad']);
    await gotoCirclesStepC(page);
    // focus first textarea so mobile toolbar shows
    const ta = page.locator('textarea').first();
    if (await ta.count()) await ta.focus().catch(() => {});
    await page.waitForTimeout(200);
    const small = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.rt-mtbtn, .rt-toolbar button, [data-rt-action]'));
      const visible = btns.filter(b => b.offsetParent !== null);
      return visible.filter(b => {
        const r = b.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      }).length;
    });
    expect(small, 'rich-text toolbar buttons under 44px').toBe(0);
  });

  test('AUD-021 [P1] 提示 button >=44 high + >=8px from 查看範例', async ({ page }, testInfo) => {
    only(testInfo, TOUCH);
    await gotoCirclesStepC(page);
    const r = await page.evaluate(() => {
      const hints = Array.from(document.querySelectorAll('button, a')).filter(el => /提示/.test(el.textContent || ''));
      const examples = Array.from(document.querySelectorAll('button, a')).filter(el => /查看範例/.test(el.textContent || ''));
      const small = hints.filter(b => b.getBoundingClientRect().height < 44).length;
      let minGap = Infinity;
      hints.forEach(h => examples.forEach(e => {
        const hr = h.getBoundingClientRect();
        const er = e.getBoundingClientRect();
        if (Math.abs(hr.top - er.top) < 60) {
          minGap = Math.min(minGap, Math.abs(hr.left - er.right), Math.abs(er.left - hr.right));
        }
      }));
      return { small, minGap, hintCount: hints.length };
    });
    if (r.hintCount === 0) test.skip(true, 'no 提示 buttons found');
    expect(r.small, '提示 buttons under 44px high').toBe(0);
    if (Number.isFinite(r.minGap)) expect(r.minGap, '提示↔查看範例 gap').toBeGreaterThanOrEqual(8);
  });

  test('AUD-022 [P1] top nav buttons >=44x44 on phone', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE', 'iPhone-15-Pro']);
    await gotoHome(page);
    const small = await page.evaluate(() => {
      const navbar = document.querySelector('.navbar');
      if (!navbar) return -1;
      const btns = Array.from(navbar.querySelectorAll('button, a')).filter(b => b.offsetParent !== null);
      return btns.filter(b => {
        const r = b.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      }).length;
    });
    expect(small, 'navbar buttons under 44px').toBe(0);
  });

  test('AUD-023 [P1] resume × button >=44x44 and >=12px from 繼續', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-15-Pro']);
    await gotoHome(page);
    const r = await page.evaluate(() => {
      const dismiss = document.querySelector('.dismiss');
      const go = document.querySelector('.resume-go');
      if (!dismiss || !go) return null;
      const dr = dismiss.getBoundingClientRect();
      const gr = go.getBoundingClientRect();
      const gap = Math.min(Math.abs(dr.left - gr.right), Math.abs(gr.left - dr.right));
      return { w: dr.width, h: dr.height, gap };
    });
    if (!r) test.skip(true, 'no resume card visible');
    expect(r.w, 'dismiss width').toBeGreaterThanOrEqual(44);
    expect(r.h, 'dismiss height').toBeGreaterThanOrEqual(44);
    expect(r.gap, 'gap to resume-go').toBeGreaterThanOrEqual(12);
  });

  test('AUD-024 [P1] mode chips >=44 high', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-15-Pro']);
    await gotoHome(page);
    const small = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.circles-mode-card, [data-mode]'));
      return chips.filter(c => c.getBoundingClientRect().height < 44).length;
    });
    expect(small, 'mode chips under 44 high').toBe(0);
  });

  test('AUD-051 [P1] 查看範例 has >=44 height + visible affordance', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE']);
    await gotoCirclesStepC(page);
    const ok = await page.evaluate(() => {
      const exs = Array.from(document.querySelectorAll('button, a')).filter(el => /查看範例/.test(el.textContent || ''));
      if (exs.length === 0) return null;
      return exs.every(e => {
        const r = e.getBoundingClientRect();
        const hasIcon = !!e.querySelector('i, svg');
        const cs = getComputedStyle(e);
        const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
        return r.height >= 44 && (hasIcon || hasBorder);
      });
    });
    if (ok === null) test.skip(true, 'no 查看範例 buttons');
    expect(ok, '查看範例 tap target + affordance').toBe(true);
  });

  test('AUD-055 [P1] hamburger has aria-label or visible label', async ({ page }) => {
    await gotoHome(page);
    const ok = await page.evaluate(() => {
      const h = document.getElementById('btn-hamburger');
      if (!h) return false;
      const aria = h.getAttribute('aria-label') || '';
      const adj = (h.parentElement ? h.parentElement.textContent || '' : '');
      return /練習記錄/.test(aria) || /紀錄|記錄/.test(adj);
    });
    expect(ok, 'hamburger aria-label or sibling label').toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-G — Copy consistency
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-G — Copy consistency', () => {
  test('AUD-017 [P1] Step C placeholders contain example + length hint', async ({ page }) => {
    await gotoCirclesStepC(page);
    const phs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('textarea'))
        .map(t => t.getAttribute('placeholder') || '');
    });
    if (phs.length === 0) test.skip(true, 'no textareas');
    const allOk = phs.every(p => /(例如|例：|e\.g\.)/i.test(p) && /(句|字|\d+\s*[-–]\s*\d+)/.test(p));
    expect(allOk, 'every Step C placeholder has example + length hint').toBe(true);
  });

  test('AUD-018 [P1] intermediate step CTA is `下一步` not `送出評分`', async ({ page }) => {
    await gotoCirclesStepC(page);
    const txt = await page.evaluate(() => {
      const btn = document.getElementById('circles-p1-submit');
      return btn ? (btn.textContent || '').trim() : '';
    });
    if (!txt) test.skip(true, 'no submit btn');
    expect(txt, 'intermediate step CTA').toMatch(/下一步/);
    expect(txt, 'intermediate step CTA != 送出評分').not.toMatch(/^送出評分$/);
  });

  test('AUD-019 [P1] empty-submit validation names a field', async ({ page }) => {
    await gotoCirclesStepC(page);
    await page.click('#circles-p1-submit').catch(() => {});
    await page.waitForTimeout(300);
    const txt = await page.evaluate(() => {
      const errs = Array.from(document.querySelectorAll('.circles-error, [role="alert"], .err, .error'))
        .map(e => (e.textContent || '').trim());
      return errs.join(' | ');
    });
    expect(txt, 'validation message includes a field name').toMatch(/問題範圍|業務影響|時間範圍|關鍵假設/);
  });

  test('AUD-041 [P1] placeholders not branded `Netflix` when seed is not Netflix', async ({ page }) => {
    await gotoCirclesStepC(page);
    const r = await page.evaluate(() => {
      const card = document.querySelector('.circles-q-card-company, .circles-current-question, h2, h3');
      const company = card ? (card.textContent || '') : '';
      const phs = Array.from(document.querySelectorAll('textarea')).map(t => t.placeholder || '').join(' ');
      return { company, phs };
    });
    if (/Netflix/i.test(r.company)) test.skip(true, 'seed is Netflix');
    expect(r.phs, 'placeholders mention Netflix when seed is not').not.toMatch(/Netflix/i);
  });

  test('AUD-042 [P1] home shows 新手推薦 / Recommended badge', async ({ page }) => {
    await gotoHome(page);
    const txt = await page.evaluate(() => document.body.innerText || '');
    expect(txt).toMatch(/新手推薦|Recommended|推薦給新手/i);
  });

  test('AUD-043 [P1] login email label is 電子郵件 (not Email)', async ({ page }) => {
    await gotoLogin(page);
    const r = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label')).map(l => (l.textContent || '').trim());
      return labels.join(' | ');
    });
    expect(r, 'login labels include 電子郵件').toMatch(/電子郵件/);
    expect(r, 'login labels avoid bare Email').not.toMatch(/^Email$|\sEmail\s/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-H — Progress bar labels & a11y
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-H — Progress bar labels & a11y', () => {
  test('AUD-015 [P1] CIRCLES progress segments have C/I/R/U/T/L/E/S labels', async ({ page }) => {
    await gotoCirclesStepC(page);
    const ok = await page.evaluate(() => {
      const segs = Array.from(document.querySelectorAll('.circles-progress-seg'));
      if (segs.length === 0) return false;
      return segs.every(s => {
        const aria = s.getAttribute('aria-label') || '';
        const txt = (s.textContent || '').trim();
        return /[CIRUTLES]/.test(txt) || /[CIRUTLES]/.test(aria) || /澄清|定義|發掘|優先|提出|評估|總結/.test(aria + txt);
      });
    });
    expect(ok, 'each segment has letter or step label').toBe(true);
  });

  test('AUD-052 [P1] Step C header shows time-estimate + save reassurance', async ({ page }) => {
    await gotoCirclesStepC(page);
    const txt = await page.evaluate(() => document.body.innerText || '');
    expect(txt).toMatch(/25\s*[-–]\s*35/);
    expect(txt).toMatch(/自動儲存|暫停/);
  });

  test('AUD-046 [P1] auto-save indicator >=14px + aria-live', async ({ page }) => {
    await gotoCirclesStepC(page);
    // type into first textarea to trigger save indicator
    const ta = page.locator('textarea').first();
    if (await ta.count()) {
      await ta.fill('test text for save indicator').catch(() => {});
      await page.waitForTimeout(500);
    }
    const r = await page.evaluate(() => {
      const cands = Array.from(document.querySelectorAll('*')).filter(el => /儲存中|已儲存/.test(el.textContent || '') && el.children.length === 0);
      if (cands.length === 0) return null;
      const el = cands[0];
      const fs = parseFloat(getComputedStyle(el).fontSize);
      let p = el;
      let live = '';
      while (p && p !== document.body) {
        const a = p.getAttribute && p.getAttribute('aria-live');
        if (a) { live = a; break; }
        p = p.parentElement;
      }
      return { fs, live };
    });
    if (!r) test.skip(true, 'no save indicator visible');
    expect(r.fs, 'save indicator font-size').toBeGreaterThanOrEqual(14);
    expect(r.live, 'aria-live on save indicator').toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-I — Misc per-issue
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-I — Misc per-issue', () => {
  test('AUD-014 [P1] `前往 NSM` button does not overlap card body', async ({ page }, testInfo) => {
    only(testInfo, ['Desktop-1280', 'Desktop-1440']);
    await gotoHome(page);
    const r = await page.evaluate(() => {
      const btn = document.getElementById('circles-nsm-banner-btn') || Array.from(document.querySelectorAll('button')).find(b => /前往\s*NSM/.test(b.textContent || ''));
      if (!btn) return null;
      const txt = (btn.textContent || '').trim();
      const r = btn.getBoundingClientRect();
      // walk siblings to detect overlap with sibling text
      const parent = btn.parentElement;
      let overlap = false;
      if (parent) {
        Array.from(parent.children).forEach(c => {
          if (c === btn) return;
          const cr = c.getBoundingClientRect();
          if (r.left < cr.right && r.right > cr.left && r.top < cr.bottom && r.bottom > cr.top) overlap = true;
        });
      }
      return { txt, overlap };
    });
    if (!r) test.skip(true, 'no NSM banner btn');
    expect(r.txt, 'btn shows full label').toMatch(/前往\s*NSM/);
    expect(r.overlap, 'btn does not overlap sibling').toBe(false);
  });

  test('AUD-025 [P1] login active tab has aria-selected + non-fill differentiator', async ({ page }) => {
    await gotoLogin(page);
    const ok = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"], .auth-tab, .login-tab'));
      if (tabs.length === 0) return false;
      const active = tabs.find(t => t.getAttribute('aria-selected') === 'true' || t.classList.contains('active'));
      if (!active) return false;
      const cs = getComputedStyle(active);
      const aria = active.getAttribute('aria-selected') === 'true';
      const fontDiff = parseInt(cs.fontWeight, 10) >= 600;
      const underline = (cs.textDecorationLine || '').includes('underline');
      return aria && (fontDiff || underline);
    });
    expect(ok, 'login active tab a11y + visual differentiator').toBe(true);
  });

  test('AUD-026 [P1] offcanvas does not show empty skeleton perpetually', async ({ page }) => {
    await gotoHome(page);
    await page.click('#btn-hamburger').catch(() => {});
    await page.waitForTimeout(1500);
    const ok = await page.evaluate(() => {
      const list = document.getElementById('offcanvas-list');
      if (!list) return false;
      const txt = (list.textContent || '').trim();
      const hasContent = txt.length > 0;
      const onlySkeletons = list.children.length > 0 && Array.from(list.children).every(c => /skeleton/i.test(c.className || ''));
      return hasContent && !onlySkeletons;
    });
    expect(ok, 'offcanvas has copy/items within 1.5s').toBe(true);
  });

  test('AUD-027 [P1] offcanvas backdrop alpha >=0.5 OR main inert', async ({ page }, testInfo) => {
    only(testInfo, ['Desktop-1440', 'Desktop-2560']);
    await gotoHome(page);
    await page.click('#btn-hamburger').catch(() => {});
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => {
      const ov = document.getElementById('offcanvas-overlay');
      const mainInert = document.getElementById('main')?.hasAttribute('inert');
      if (mainInert) return true;
      if (!ov) return false;
      const bg = getComputedStyle(ov).backgroundColor || '';
      const m = bg.match(/rgba?\([^)]+\)/);
      if (!m) return false;
      const parts = m[0].replace(/rgba?\(|\)/g, '').split(',').map(s => parseFloat(s.trim()));
      const a = parts.length === 4 ? parts[3] : 1;
      return a >= 0.5;
    });
    expect(ok, 'overlay alpha >=0.5 or main inert').toBe(true);
  });

  test('AUD-028 [P1] offcanvas X close button does not overlap a banner', async ({ page }, testInfo) => {
    only(testInfo, ['Desktop-1280']);
    await gotoHome(page);
    await page.click('#btn-hamburger').catch(() => {});
    await page.waitForTimeout(400);
    const overlap = await page.evaluate(() => {
      const x = document.getElementById('btn-offcanvas-close');
      if (!x) return null;
      const xr = x.getBoundingClientRect();
      const banners = Array.from(document.querySelectorAll('[class*="banner"], [class*="notice"]'));
      return banners.some(b => {
        const br = b.getBoundingClientRect();
        return xr.left < br.right && xr.right > br.left && xr.top < br.bottom && xr.bottom > br.top;
      });
    });
    if (overlap === null) test.skip(true, 'no close button visible');
    expect(overlap, 'close X overlaps banner').toBe(false);
  });

  test('AUD-032 [P1] hint affordances are tappable on iPad (not hover-only)', async ({ page }, testInfo) => {
    only(testInfo, ['iPad']);
    await gotoCirclesStepC(page);
    const ok = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a')).filter(e => /提示|查看範例/.test(e.textContent || ''));
      if (els.length === 0) return null;
      return els.every(e => {
        const cs = getComputedStyle(e);
        const hasBorder = parseFloat(cs.borderTopWidth) > 0;
        const hasIcon = !!e.querySelector('i, svg');
        return hasBorder || hasIcon;
      });
    });
    if (ok === null) test.skip(true, 'no hint elements');
    expect(ok, 'hint affordances visible without hover').toBe(true);
  });

  test('AUD-036 [P1] home search input has placeholder + icon', async ({ page }, testInfo) => {
    only(testInfo, ['Desktop-1280', 'Desktop-1440']);
    await gotoHome(page);
    const ok = await page.evaluate(() => {
      const input = document.querySelector('input[type="search"], input[placeholder*="搜尋"], #search-input, .home-search input');
      if (!input) return false;
      const ph = input.getAttribute('placeholder') || '';
      const iconNear = !!(input.parentElement && input.parentElement.querySelector('i, svg'));
      return ph.length > 0 && iconNear;
    });
    expect(ok, 'search input placeholder + icon').toBe(true);
  });

  test('AUD-038 [P1] 什麼是 CIRCLES row shows chevron / 展開 affordance', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE']);
    await gotoHome(page);
    const ok = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('*')).find(el => /什麼是\s*CIRCLES/.test(el.textContent || '') && el.children.length < 8);
      if (!row) return null;
      const hasChevron = !!row.querySelector('i.ph-caret-right, i.ph-caret-down, svg');
      const txt = row.textContent || '';
      return hasChevron || /展開/.test(txt);
    });
    if (ok === null) test.skip(true, 'row not present');
    expect(ok, 'row has chevron or 展開').toBe(true);
  });

  test('AUD-039 [P1] random shuffle gives feedback (aria-live or animation)', async ({ page }) => {
    await gotoHome(page);
    const btn = page.locator('#circles-random-btn').first();
    if (!(await btn.count())) test.skip(true, 'no random btn');
    await btn.click().catch(() => {});
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => {
      const live = document.querySelector('[aria-live="polite"], [aria-live="assertive"]');
      const loading = document.querySelector('[class*="loading"], [class*="shuffling"], [class*="spin"]');
      return !!(live && (live.textContent || '').trim()) || !!loading;
    });
    expect(ok, 'aria-live or loading after shuffle').toBe(true);
  });

  test('AUD-044 [P1] login has 忘記密碼 + password show-toggle', async ({ page }) => {
    await gotoLogin(page);
    const r = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const toggle = document.querySelector('button[aria-label*="顯示密碼"], button[aria-label*="show password" i], .password-toggle, [data-action="toggle-password"]');
      let toggleSize = null;
      if (toggle) {
        const tr = toggle.getBoundingClientRect();
        toggleSize = { w: tr.width, h: tr.height };
      }
      return { hasForgot: /忘記密碼/.test(txt), toggleSize };
    });
    expect(r.hasForgot, '忘記密碼 link').toBe(true);
    expect(r.toggleSize, 'password toggle exists').toBeTruthy();
    expect(r.toggleSize.w, 'toggle width').toBeGreaterThanOrEqual(44);
    expect(r.toggleSize.h, 'toggle height').toBeGreaterThanOrEqual(44);
  });

  test('AUD-045 [P1] email + password input attrs', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-15-Pro', 'iPhone-SE', 'iPad']);
    await gotoLogin(page);
    const r = await page.evaluate(() => {
      const email = document.querySelector('input[type="email"], input[name="email"], input[autocomplete="email"]');
      const toggle = document.querySelector('button[aria-label*="密碼"], .password-toggle, [data-action="toggle-password"]');
      if (!email) return { ok: false, reason: 'no email input' };
      return {
        ok: true,
        type: email.getAttribute('type'),
        inputmode: email.getAttribute('inputmode'),
        autocomplete: email.getAttribute('autocomplete'),
        hasToggle: !!toggle,
      };
    });
    expect(r.ok, 'email input present').toBe(true);
    expect(r.type, 'email type=email').toBe('email');
    expect(r.inputmode, 'inputmode=email').toBe('email');
    expect(r.autocomplete, 'autocomplete=email').toBe('email');
    expect(r.hasToggle, 'password toggle present').toBe(true);
  });

  test('AUD-047 [P1] iPhone-SE first viewport has exactly 1 primary CTA', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE']);
    await gotoHome(page);
    const n = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('[class*="btn-primary"], .circles-btn-primary'));
      return all.filter(el => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < window.innerHeight && el.offsetParent !== null;
      }).length;
    });
    expect(n, 'visible primary CTAs above the fold').toBe(1);
  });

  test('AUD-048 [P1] review-examples mobile cards >=12px gap', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE', 'iPhone-15-Pro']);
    await page.goto('/review-examples.html');
    await page.waitForLoadState('networkidle');
    const minGap = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.card'));
      if (cards.length < 2) return Infinity;
      let g = Infinity;
      for (let i = 1; i < cards.length; i++) {
        const a = cards[i - 1].getBoundingClientRect();
        const b = cards[i].getBoundingClientRect();
        g = Math.min(g, b.top - a.bottom);
      }
      return g;
    });
    expect(minGap, 'min vertical gap between review cards').toBeGreaterThanOrEqual(12);
  });

  test('AUD-049 [P1] review-examples paginates or has search+filter', async ({ page }) => {
    await page.goto('/review-examples.html');
    await page.waitForLoadState('networkidle');
    const r = await page.evaluate(() => {
      const search = document.querySelector('input[type="search"], #search, #review-examples-search');
      const filter = document.querySelector('select, #filter-step');
      const cards = document.querySelectorAll('.card').length;
      return { hasSearchAndFilter: !!search && !!filter, cards };
    });
    const ok = r.hasSearchAndFilter || r.cards <= 20;
    expect(ok, 'search+filter OR <=20 cards').toBe(true);
  });

  test('AUD-050 [P1] iPhone-SE: question card description truncated to 1 line', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE']);
    await gotoHome(page);
    const ok = await page.evaluate(() => {
      const stmts = Array.from(document.querySelectorAll('.circles-q-card-stmt'));
      if (stmts.length === 0) return false;
      return stmts.every(s => {
        const cs = getComputedStyle(s);
        const lh = parseFloat(cs.lineHeight) || 20;
        return s.offsetHeight <= lh * 1.5;
      });
    });
    expect(ok, 'every q-card stmt fits 1 line').toBe(true);
  });

  test('AUD-053 [P1] entering Step C shows spinner / 載入題目', async ({ page }, testInfo) => {
    only(testInfo, ['iPhone-SE']);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    let saw = false;
    page.on('domcontentloaded', () => {});
    const card = page.locator('.circles-q-card').first();
    if (!(await card.count())) test.skip(true, 'no q card');
    // race: click + observe DOM mutations for spinner
    const racePromise = page.evaluate(() => new Promise(resolve => {
      const start = Date.now();
      const obs = new MutationObserver(() => {
        const txt = document.body.innerText || '';
        const spin = document.querySelector('[class*="spinner"], [class*="loading"]');
        if (spin || /載入題目/.test(txt)) {
          obs.disconnect();
          resolve(true);
        }
        if (Date.now() - start > 1500) {
          obs.disconnect();
          resolve(false);
        }
      });
      obs.observe(document.body, { subtree: true, childList: true, attributes: true });
      setTimeout(() => { obs.disconnect(); resolve(false); }, 1500);
    }));
    await card.click().catch(() => {});
    saw = await racePromise;
    expect(saw, 'spinner or 載入題目 visible during transition').toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CLUSTER-J — Console-error free
// ────────────────────────────────────────────────────────────────────────────
test.describe('CLUSTER-J — Console errors / 404s', () => {
  test('AUD-010 [P0] / and /review-examples.html load without console errors or 404s', async ({ page }) => {
    const errors = [];
    const failures = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('response', resp => { if (resp.status() >= 400) failures.push(`${resp.status()} ${resp.url()}`); });
    page.on('requestfailed', req => failures.push(`failed ${req.url()}`));

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto('/review-examples.html');
    await page.waitForLoadState('networkidle');

    expect(errors, 'console errors').toEqual([]);
    expect(failures, 'failed network requests').toEqual([]);
  });
});
