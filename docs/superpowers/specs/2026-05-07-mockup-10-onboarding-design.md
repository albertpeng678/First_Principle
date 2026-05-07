# Mockup 10 — Onboarding Welcome + 4-Step Coachmark Tour Implementation Design

**Date:** 2026-05-07
**Path 2 sub-project:** Plan D SB2
**Worktree:** `feat/path-2-cross-cutting`
**Mockup contract:** `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/10-onboarding.html`
**Master Spec ref:** §0.4 / §2.13 / Mockup Index 10

---

## 0. Scope

Show first-time-user welcome card on CIRCLES home, then guide them through a 4-step coachmark tour:
1. 練習模式 (mode-section)
2. 題型 (type-tabs)
3. 題目列表 (q-card list)
4. 開始練習 (expanded q-card with `確認，開始練習` button)

**Trigger:** `localStorage['circles_onboarding_done'] !== '1'` AND no recent sessions exist (`AppState.historyList?.length === 0` OR uninitialised).

**Out of scope:** NSM onboarding (separate flow if ever needed); login/register onboarding.

## 1. AppState additions

```js
onboardingComplete: !!localStorage.getItem('circles_onboarding_done'),  // already exists at line 16
                                                                          // RENAME from 'onboardingComplete' to align with localStorage key 'circles_onboarding_done'
onboardingActive: false,         // NEW — true while tour running
onboardingStep: 0,               // NEW — 0 = welcome, 1-4 = tour steps
```

The localStorage key `circles_onboarding_done` is **the** persistence key (mockup line 272).

On `app.js` boot (after `AppState.historyList` populates):
```js
if (!AppState.onboardingComplete && (!AppState.historyList || AppState.historyList.length === 0)) {
  if (AppState.view === 'circles' && AppState.circlesPhase === 1 && !AppState.circlesSelectedQuestion) {
    AppState.onboardingActive = true;
    AppState.onboardingStep = 0;
  }
}
```

## 2. Render — `renderOnboarding()`

Returns full overlay HTML when `onboardingActive === true`. Composed as a top-level overlay positioned over CIRCLES home — does NOT replace the home content (the home stays visible behind the dim overlay so user sees what they're about to learn about).

### 2.1 Welcome card (step 0; mockup line 282-318 §A)

```html
<div class="onb-welcome">
  <div class="onb-welcome__icon"><i class="ph-fill ph-hand-waving"></i></div>
  <div class="onb-welcome__title">歡迎來到 PM Drill</div>
  <p class="onb-welcome__body">CIRCLES 是 PM 面試常用的七步框架。第一次使用？建議跟著引導跑一輪，5 分鐘內了解整個流程。</p>
  <div class="onb-welcome__actions">
    <button class="btn btn--primary" data-onb-action="start">開始引導<i class="ph ph-arrow-right"></i></button>
    <button class="btn btn--ghost" data-onb-action="skip">直接自己選題</button>
  </div>
</div>
```

Welcome card positioned ABOVE `.mode-section` in the home content (insert via DOM injection or render conditional in `renderCirclesHome()`). Desktop: max-width matches home content width.

### 2.2 4-step coachmark tour (steps 1-4; mockup line 419-994)

Pattern (per master spec §2.13 + memory feedback `feedback_mockup_strict_compliance`):

```html
<div class="onb-overlay" data-onb-step="{N}">
  <!-- target element gets .onb-targeted class added dynamically -->
  <div class="onb-tooltip onb-tooltip--{position}" style="top:{Y}px; left:{X}px">
    <div class="onb-tooltip__arrow onb-tooltip__arrow--{arrow}"></div>
    <div class="onb-tooltip__step">第 {N} 步 / 共 4 步</div>
    <div class="onb-tooltip__title">{title}</div>
    <p class="onb-tooltip__body">{body}</p>
    <div class="onb-tooltip__actions">
      <span class="onb-tooltip__skip" data-onb-action="skip">略過引導</span>
      {N < 4 ? `<button class="onb-tooltip__next" data-onb-action="next">下一步<i class="ph ph-arrow-right"></i></button>`
             : `<button class="onb-tooltip__next" data-onb-action="finish">開始練習<i class="ph ph-check"></i></button>`}
    </div>
  </div>
</div>
```

`.onb-targeted` is added to the target element to apply spotlight styling via CSS (per mockup line 186 `.onb-targeted { box-shadow: 0 0 0 2px white, 0 0 0 6px navy, 0 0 0 9999px rgba(20,15,10,0.45); position: relative; z-index: 50; }`).

### 2.3 Step targets (per mockup line 419-994)

| Step | Target selector | Tooltip title | Tooltip body |
|---|---|---|---|
| 1 | `.mode-section` | 選擇練習模式 | 建議首次選「完整模擬」走完整流程，熟悉後再用「步驟加練」針對弱點刻意練習。 |
| 2 | `.type-tabs` | 選擇題型 | 三類題型各有特色：產品設計重發散、產品改進重診斷、產品策略重格局。 |
| 3 | `.q-list` (or first `.q-card`) | 看題目卡 | 每張卡片附帶業界場景，點開可預覽題目背景與分析框架。 |
| 4 | first expanded `.q-card` | 開始練習 | 先讀題目說明再決定：合適就點「確認，開始練習」進入 Phase 1，不合適可上一步換題。 |

Tooltip positioning per viewport — see mockup §B/C/D each for exact `top` / `left` / arrow direction across mobile / tablet / desktop. Use viewport-aware positioning helper:

```js
function positionOnboardingTooltip(targetSelector, preferredSide) {
  const tgt = document.querySelector(targetSelector);
  if (!tgt) return null;
  const r = tgt.getBoundingClientRect();
  const isMobile = window.innerWidth < 768;
  // Desktop: place tooltip to the right or left of target with arrow
  // Mobile: still float near target with arrow (per mockup §B' override line 274)
  return computePosition(r, preferredSide, isMobile);
}
```

(Mobile NOT sticky-bottom per master spec §10 mockup contract; same float-near-target pattern.)

### 2.4 Skip handler

`data-onb-action="skip"` from any step / welcome → set `localStorage.circles_onboarding_done = '1'`, `AppState.onboardingComplete = true`, `AppState.onboardingActive = false`, `render()`.

### 2.5 Finish handler (step 4 only)

`data-onb-action="finish"` → same as skip + auto-click the underlying「確認，開始練習」button (or just close overlay; user clicks it themselves to enter Phase 1). Per mockup §D the tooltip says 「先讀題目說明再決定」 — implies user reads + clicks themselves. So `finish` just closes overlay; user's natural next click on the q-card button enters Phase 1. **Pick this interpretation** (mockup-faithful).

## 3. Bindings — `bindOnboarding()`

```js
function bindOnboarding() {
  document.querySelectorAll('[data-onb-action]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const act = el.dataset.onbAction;
      if (act === 'start') {
        AppState.onboardingStep = 1;
        applyOnboardingTarget();
        render();
      } else if (act === 'next') {
        AppState.onboardingStep++;
        applyOnboardingTarget();
        render();
      } else if (act === 'skip' || act === 'finish') {
        localStorage.setItem('circles_onboarding_done', '1');
        AppState.onboardingComplete = true;
        AppState.onboardingActive = false;
        AppState.onboardingStep = 0;
        clearOnboardingTarget();
        render();
      }
    });
  });
  // Esc closes (skip)
  document.addEventListener('keydown', escSkipHandler);
}

function applyOnboardingTarget() {
  clearOnboardingTarget();
  const target = ONBOARDING_TARGETS[AppState.onboardingStep];
  const el = target && document.querySelector(target);
  if (el) el.classList.add('onb-targeted');
}

function clearOnboardingTarget() {
  document.querySelectorAll('.onb-targeted').forEach(el => el.classList.remove('onb-targeted'));
}
```

## 4. CSS additions

Per mockup line 186-265 — verbatim:
- `.onb-overlay` (full-page dim overlay container)
- `.onb-targeted` (spotlight ring + outer dim via box-shadow trick)
- `.onb-welcome` `.onb-welcome__icon/title/body/actions`
- `.onb-tooltip` `.onb-tooltip__step/title/body/actions/skip/next/arrow`
- `.onb-tooltip__arrow--{left,right,top,bottom}`

Mobile + desktop both use floating tooltip near target (no sticky-bottom on mobile per master spec §10).

## 5. Tests (TDD red first)

`tests/visual/onboarding.spec.js`:

| # | Spec | Assertions |
|---|---|---|
| 1 | First-time user (no localStorage flag, no history) sees welcome card | `.onb-welcome` visible / 開始引導 + 直接自己選題 buttons |
| 2 | Click 開始引導 → step 1 tooltip + .mode-section gets .onb-targeted | `.onb-tooltip__step` text "第 1 步 / 共 4 步" / `.mode-section.onb-targeted` |
| 3 | Click 下一步 progresses 1→2→3→4 | each step: correct target gets `.onb-targeted` |
| 4 | Step 4 button text changes from 下一步 to 開始練習 | `.onb-tooltip__next` textContent contains "開始練習" |
| 5 | Click 略過引導 → set localStorage + close overlay | localStorage.circles_onboarding_done === '1' / `.onb-welcome` not visible |
| 6 | Click 直接自己選題 → set localStorage + close | same as #5 |
| 7 | Esc key skips | listener fires |
| 8 | Returning user (localStorage flag set) does NOT see welcome | `.onb-welcome` not present on re-render |
| 9 | User with history does NOT see welcome (even without flag) | `.onb-welcome` not present |
| 10 | Tooltip arrow direction matches target position | `.onb-tooltip__arrow--{left,right,top,bottom}` per step |
| 11 | Mobile + desktop both show floating tooltip (not sticky-bottom on mobile) | `.onb-tooltip` rendered same way at width 360 + 1280 |

Run × 3 viewport = 33 specs.

## 6. Visual verification (director cold review)

15 PNGs (per mockup line 270-994 enumeration: 5 sections × 3 viewports):
- welcome × {Mobile, iPad, Desktop}
- step1 × {Mobile, iPad, Desktop}
- step2 × {Mobile, iPad, Desktop}
- step3 × {Mobile, iPad, Desktop}
- step4 × {Mobile, iPad, Desktop}

Director Read each, verify spotlight ring + tooltip arrow direction matches mockup. Pixel-diff vs mockup 10 baseline. iOS 15-item — onboarding overlay must not break sticky bottom safe-area, must allow Esc to skip, must not cause body scroll lock if user dismisses.

## 7. Out of scope

- Replay onboarding from settings (one-shot first-time only per master spec)
- Different tour for returning user with new feature releases
- NSM workshop onboarding
- Server-side persistence of completion (localStorage only — sufficient per spec)

## 8. Risk + rollback

Risk: low-medium. Pure overlay UI, no API calls. Failure mode: stuck overlay blocking interaction. Mitigation: Esc handler always works; users can clear localStorage manually; emergency global skip via `?onb=skip` query param? — defer this; not in mockup. Rollback: revert single Plan D SB2 commit.

## 9. Success criteria

- [ ] 33 Playwright specs green
- [ ] 8-viewport regression sweep stays green
- [ ] jest 160/160 unchanged
- [ ] 15 PNGs read by opus director
- [ ] Pixel-diff < 0.5% vs mockup 10
- [ ] iOS 15-item check pass (especially overlay focus trap, Esc, no scroll lock issues)
- [ ] eyeball walk doc committed
- [ ] CLAUDE.md updated
