# Mockup 10 Onboarding Implementation Plan (Plan D SB2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox `- [ ]` syntax.

**Goal:** Implement first-time-user welcome card + 4-step coachmark tour overlay for CIRCLES home, with `.onb-targeted` spotlight + floating tooltip + Esc/skip handlers + localStorage persistence.

**Architecture:** New top-level overlay layer rendered conditionally on `circlesPhase === 1` home view; ONBOARDING_TARGETS map drives spotlight + tooltip per step; localStorage `circles_onboarding_done` flag persists completion.

**Tech Stack:** Vanilla JS / Playwright / jest.

**Spec:** `docs/superpowers/specs/2026-05-07-mockup-10-onboarding-design.md`
**Mockup:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/10-onboarding.html` (lines 270-994)
**Branch:** `feat/path-2-cross-cutting` (existing worktree)

---

## Task 1 — TDD RED: onboarding specs

**Files:**
- Create: `tests/visual/onboarding.spec.js` (11 specs)

- [ ] **Step 1: Write failing specs**

```js
const { test, expect } = require('@playwright/test');

async function setupCirclesHome(page, opts = {}) {
  await page.route('**/api/(guest-)?circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/(guest-)?circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.history || []) }));
  await page.route('**/api/(guest/)?nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript((flag) => {
    if (flag) localStorage.setItem('circles_onboarding_done', '1');
    else localStorage.removeItem('circles_onboarding_done');
  }, opts.flagSet || false);
  await page.goto('/');
  await page.waitForSelector('.qcard');
}

test.describe('Onboarding (mockup 10)', () => {
  test('First-time user (no flag, no history) sees welcome card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await expect(page.locator('.onb-welcome')).toBeVisible();
    await expect(page.locator('[data-onb-action="start"]')).toBeVisible();
    await expect(page.locator('[data-onb-action="skip"]').first()).toBeVisible();
  });

  test('Click 開始引導 → step 1 tooltip + .mode-section gets .onb-targeted', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.onb-tooltip__step')).toContainText('第 1 步 / 共 4 步');
    await expect(page.locator('.mode-section.onb-targeted')).toBeVisible();
  });

  test('Click 下一步 progresses 1→2→3→4', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    for (var n = 2; n <= 4; n++) {
      await page.locator('[data-onb-action="next"]').click();
      await page.waitForTimeout(150);
      await expect(page.locator('.onb-tooltip__step')).toContainText('第 ' + n + ' 步 / 共 4 步');
    }
  });

  test('Step 4 button text is 開始練習 not 下一步', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.locator('[data-onb-action="next"]').click();
    await page.locator('[data-onb-action="next"]').click();
    await page.locator('[data-onb-action="next"]').click();
    await expect(page.locator('[data-onb-action="finish"]')).toContainText('開始練習');
  });

  test('Click 略過引導 → set localStorage + close overlay', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="skip"]').first().click();
    await page.waitForTimeout(200);
    expect(await page.locator('.onb-welcome').count()).toBe(0);
    expect(await page.locator('.onb-tooltip').count()).toBe(0);
    var flag = await page.evaluate(() => localStorage.getItem('circles_onboarding_done'));
    expect(flag).toBe('1');
  });

  test('Click 直接自己選題 → set localStorage + close', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    // 直接自己選題 also has data-onb-action="skip" per spec
    await page.locator('[data-onb-action="skip"]').first().click();
    var flag = await page.evaluate(() => localStorage.getItem('circles_onboarding_done'));
    expect(flag).toBe('1');
  });

  test('Esc key skips', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    expect(await page.locator('.onb-tooltip').count()).toBe(0);
  });

  test('Returning user (flag set) does NOT see welcome', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page, { flagSet: true });
    expect(await page.locator('.onb-welcome').count()).toBe(0);
    expect(await page.locator('.onb-tooltip').count()).toBe(0);
  });

  test('User with history does NOT see welcome (even without flag)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page, {
      history: [{ id: 's1', question_id: 'q1', question_json: { id: 'q1', company: 'X', product: 'Y' }, mode: 'drill', drill_step: 'C1', status: 'completed', scores_json: { totalScore: 80 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    });
    expect(await page.locator('.onb-welcome').count()).toBe(0);
  });

  test('Tooltip arrow class matches step direction', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.waitForTimeout(200);
    var arrowClass = await page.locator('.onb-tooltip__arrow').first().getAttribute('class');
    expect(arrowClass).toMatch(/onb-tooltip__arrow--(left|right|top|bottom)/);
  });

  test('Mobile-360 onboarding still shows floating tooltip (NOT sticky-bottom)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupCirclesHome(page);
    await page.locator('[data-onb-action="start"]').click();
    await page.waitForTimeout(200);
    var tt = page.locator('.onb-tooltip');
    await expect(tt).toBeVisible();
    var box = await tt.boundingBox();
    // sticky-bottom would have y near viewport bottom (800 - h); float-near-target sits above bottom
    expect(box.y).toBeLessThan(700);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/onboarding.spec.js --reporter=line
```

Expected: ≥10/11 fail (no `.onb-welcome`, no `.onb-tooltip`).

- [ ] **Step 3: Commit RED**

```bash
git add tests/visual/onboarding.spec.js
git commit -m "test(onboarding): RED — welcome + 4-step coachmark + skip/Esc 11 specs"
```

---

## Task 2 — GREEN: `renderOnboarding` + bindings + spotlight

**Files:**
- Modify: `public/app.js` (add AppState + render + bind)
- Modify: `public/style.css` (append onboarding CSS verbatim from mockup)

- [ ] **Step 1: Add AppState fields + boot trigger**

```js
    onboardingComplete: localStorage.getItem('circles_onboarding_done') === '1',
    onboardingActive: false,
    onboardingStep: 0,    // 0 = welcome, 1-4 = tour steps
```

After AppState init + history loads, add boot trigger (in main render dispatcher or boot fn):
```js
  function maybeStartOnboarding() {
    if (AppState.onboardingComplete) return;
    if (AppState.onboardingActive) return;
    var hasHistory = AppState.historyList && AppState.historyList.length > 0;
    if (hasHistory) return;
    if (AppState.view !== 'circles') return;
    if (AppState.circlesPhase !== 1) return;
    if (AppState.circlesSelectedQuestion) return;
    AppState.onboardingActive = true;
    AppState.onboardingStep = 0;
  }
```

Call `maybeStartOnboarding()` after each `loadHistory()` completion + after each `render()` boot.

- [ ] **Step 2: Add `ONBOARDING_TARGETS` + tour content**

```js
  var ONBOARDING_TARGETS = {
    1: { selector: '.mode-section', title: '選擇練習模式', body: '建議首次選「完整模擬」走完整流程，熟悉後再用「步驟加練」針對弱點刻意練習。', arrow: 'top' },
    2: { selector: '.type-tabs',    title: '選擇題型',     body: '三類題型各有特色：產品設計重發散、產品改進重診斷、產品策略重格局。', arrow: 'top' },
    3: { selector: '.qcard',        title: '看題目卡',     body: '每張卡片附帶業界場景，點開可預覽題目背景與分析框架。', arrow: 'top' },
    4: { selector: '.qcard.is-expanded, .qcard:first-child', title: '開始練習', body: '先讀題目說明再決定：合適就點「確認，開始練習」進入 Phase 1，不合適可上一步換題。', arrow: 'top' },
  };
```

- [ ] **Step 3: Add `renderOnboarding()`**

```js
  function renderOnboardingOverlay() {
    if (!AppState.onboardingActive) return '';
    var step = AppState.onboardingStep;
    if (step === 0) return renderOnbWelcome();
    var t = ONBOARDING_TARGETS[step];
    if (!t) return '';
    var nextOrFinish = step < 4
      ? '<button class="onb-tooltip__next" data-onb-action="next">下一步<i class="ph ph-arrow-right"></i></button>'
      : '<button class="onb-tooltip__next" data-onb-action="finish">開始練習<i class="ph ph-check"></i></button>';
    return '<div class="onb-overlay">'
      +    '<div class="onb-tooltip onb-tooltip--' + t.arrow + '" data-onb-step="' + step + '">'
      +      '<div class="onb-tooltip__arrow onb-tooltip__arrow--' + t.arrow + '"></div>'
      +      '<div class="onb-tooltip__step">第 ' + step + ' 步 / 共 4 步</div>'
      +      '<div class="onb-tooltip__title">' + escHtml(t.title) + '</div>'
      +      '<p class="onb-tooltip__body">' + escHtml(t.body) + '</p>'
      +      '<div class="onb-tooltip__actions">'
      +        '<span class="onb-tooltip__skip" data-onb-action="skip">略過引導</span>'
      +        nextOrFinish
      +      '</div>'
      +    '</div>'
      + '</div>';
  }

  function renderOnbWelcome() {
    return '<div class="onb-welcome">'
      + '<div class="onb-welcome__icon"><i class="ph-fill ph-hand-waving"></i></div>'
      + '<div class="onb-welcome__title">歡迎來到 PM Drill</div>'
      + '<p class="onb-welcome__body">CIRCLES 是 PM 面試常用的七步框架。第一次使用？建議跟著引導跑一輪，5 分鐘內了解整個流程。</p>'
      + '<div class="onb-welcome__actions">'
      +   '<button class="btn btn--primary" data-onb-action="start">開始引導<i class="ph ph-arrow-right"></i></button>'
      +   '<button class="btn btn--ghost" data-onb-action="skip">直接自己選題</button>'
      + '</div></div>';
  }

  function applyOnboardingTargetClass() {
    document.querySelectorAll('.onb-targeted').forEach(function (el) { el.classList.remove('onb-targeted'); });
    if (!AppState.onboardingActive || AppState.onboardingStep === 0) return;
    var t = ONBOARDING_TARGETS[AppState.onboardingStep];
    if (!t) return;
    var el = document.querySelector(t.selector);
    if (el) el.classList.add('onb-targeted');
  }

  // expose
  window.renderOnboardingOverlay = renderOnboardingOverlay;
```

- [ ] **Step 4: Wire renderOnboardingOverlay into renderHome / render dispatcher**

Find `renderCirclesHome()` or whichever renders home — append `renderOnboardingOverlay()` to its returned HTML. Welcome (step 0) renders inline above mode-section (insert via DOM order).

- [ ] **Step 5: Add `bindOnboarding()`**

```js
  function bindOnboarding() {
    document.querySelectorAll('[data-onb-action]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = el.dataset.onbAction;
        if (act === 'start') {
          AppState.onboardingStep = 1;
          render();
          applyOnboardingTargetClass();
        } else if (act === 'next') {
          AppState.onboardingStep++;
          render();
          applyOnboardingTargetClass();
        } else if (act === 'skip' || act === 'finish') {
          localStorage.setItem('circles_onboarding_done', '1');
          AppState.onboardingComplete = true;
          AppState.onboardingActive = false;
          AppState.onboardingStep = 0;
          document.querySelectorAll('.onb-targeted').forEach(function (el) { el.classList.remove('onb-targeted'); });
          render();
        }
      });
    });
    if (AppState.onboardingActive && AppState.onboardingStep > 0) {
      applyOnboardingTargetClass();
    }
    // Esc handler (one-shot per render)
    if (!window._onbEscBound) {
      document.addEventListener('keydown', function escSkip(e) {
        if (e.key === 'Escape' && AppState.onboardingActive) {
          localStorage.setItem('circles_onboarding_done', '1');
          AppState.onboardingComplete = true;
          AppState.onboardingActive = false;
          AppState.onboardingStep = 0;
          document.querySelectorAll('.onb-targeted').forEach(function (el) { el.classList.remove('onb-targeted'); });
          render();
        }
      });
      window._onbEscBound = true;
    }
  }
```

Wire `bindOnboarding()` into post-render dispatch when `AppState.view === 'circles'` and home phase.

- [ ] **Step 6: Append CSS to `public/style.css`**

Append from mockup 10 line 1-265:
- `.onb-overlay` `.onb-targeted` (key: `box-shadow: 0 0 0 2px white, 0 0 0 6px navy, 0 0 0 9999px rgba(20,15,10,0.45); position: relative; z-index: 50;`)
- `.onb-welcome` `.onb-welcome__icon/title/body/actions`
- `.onb-tooltip` (z-index: 60, max-width: 320px, navy bg, white text, padding 16px, border-radius 8px)
- `.onb-tooltip__arrow` + 4 modifiers
- `.onb-tooltip__step/title/body/actions/skip/next`

- [ ] **Step 7: Run onboarding specs to verify GREEN**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 --project=Mobile-360 --project=iPad tests/visual/onboarding.spec.js --reporter=line
```

Expected: 33/33 pass.

- [ ] **Step 8: Run regression sweep**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Desktop-1280 tests/visual/restore-no-drift.spec.js tests/visual/offcanvas-item-click-restore.spec.js tests/visual/home-stats-guest.spec.js --reporter=line 2>&1 | tail -5
```

Expected: 11 + 15 + 4 = 30 specs pass.

- [ ] **Step 9: Commit GREEN**

```bash
git add public/app.js public/style.css
git commit -m "feat(plan-d-sb2): GREEN — onboarding welcome + 4-step coachmark tour (mockup 10)"
```

---

## Task 3 — 8-viewport regression sweep

- [ ] **Step 1: Full 8-viewport on onboarding**

```bash
npx playwright test --config=tests/visual/playwright.config.js --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 tests/visual/onboarding.spec.js --reporter=line
```

Expected: 88/88 pass.

- [ ] **Step 2: jest baseline**

```bash
npm test
```

Expected: 160/160 unchanged.

- [ ] **Step 3: Self-review report**

Report DONE with:
- 3 commit SHAs
- Playwright 88/88 (8 vp × 11)
- jest 160/160
- Files changed: `tests/visual/onboarding.spec.js` (new), `public/app.js` (+~120 lines), `public/style.css` (+~80 lines)
- Confirmation NO file outside list touched
