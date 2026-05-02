# SP1.5 — Mockup vs Production Visual Diff Record

**Branch:** `feat/sp1.5-fix-track`
**Date:** 2026-05-02
**Production:** http://localhost:4001 (worktree dev server)
**Mockups:** `docs/superpowers/specs/mockups/2026-05-02-pm-drill-sp1.5/`
**Method:** Code-vs-mockup cross-reference (`public/style.css`, `public/app.js` diff vs main). Independent visual confirmation by 4 Playwright specs across 8 viewports.

---

## A — visual fix (A1 + A2 + A3)

Mockups: `A-visual-fix.html`, `A2-qcard-flush-vs-margin.html`

A1 = `.btn-icon` round 40×40 + hover background.
A2 = `#app` zero padding, navbar no negative margin, q-card flush mobile/tablet, rounded desktop.
A3 = Phase 2 pinned-card removed (single question card via persistent qchip).

### Mobile 360
- **A1 .btn-icon round 40×40** — PASS (`style.css:221-228` width/height/border-radius:50%; iOS hit-cascade `style.css:762` `min-width/min-height:44px`).
- **A1 hover background** — PASS (`style.css:235-237` `@media (hover:hover) and (pointer:fine)` → `rgba(0,0,0,0.06)`).
- **A2 `#app` edge-to-edge** — PASS (`style.css:145` `padding: 0 0 16px;` — left/right zero).
- **A2 navbar no negative margin** — PASS (`style.css` diff removed `margin-left:-16px; margin-right:-16px;` at original line 185-186; backdrop-filter blur(12px) at `style.css:183-184` preserved).
- **A2 q-card flush** — PASS (`style.css:1707` `border-radius: 0`; `style.css:1710-1711` `border-left: none; border-right: none`).
- **A3 single question card in phase 2** — PASS (pinnedCard variable + render hunk deleted from `app.js`; `.circles-pinned-card` CSS rule deleted from `style.css` original line 2156-2161; persistent qchip is the sole question source).

### Tablet 768
- **A1** — same rules apply (no media-query gate on `.btn-icon`); PASS.
- **A2 `#app` no horizontal padding** — PASS (`style.css:148` `@media (min-width: 720px) and (max-width: 1023px)` → `#app { max-width: 100%; padding: 0 0 24px; }`).
- **A2 q-card flush** — PASS (no desktop override at this breakpoint; the rounded-corner override only fires at `min-width: 1024px`).
- **A3** — same as mobile; PASS.

### Desktop 1280
- **A1** — same rules; PASS.
- **A2 navbar still edge-to-edge** — PASS (negative margin removed; navbar full width).
- **A2 q-card has rounded corners + 4-side border** — PASS. Desktop override at `style.css:170-175`:

```css
@media (min-width: 1024px) {
  [data-view="circles"] .circles-q-card {
    border-radius: var(--r-card);
    border-left: 1.5px solid var(--c-border);
    border-right: 1.5px solid var(--c-border);
  }
}
```

The base rule (lines 1707, 1710-1711) sets `border-radius: 0; border-left: none; border-right: none;`; the desktop media query restores all three. Centering happens via `.phase1-desktop` max-width (existing rule, untouched).
- **A3** — same; PASS.

**Independent confirmation:** `tests/playwright/journeys/sp1.5-edge-alignment.spec.js` × 8 viewports asserts: navbar bbox.left ≈ 0, q-card bbox.left ≈ 0 (mobile/tablet) or centered (desktop), no horizontal scroll.

---

## B — phase 2 上一步 + 已得分鎖

Mockup: `B-back-and-locked.html`

B1 = Phase 1 form fields go read-only with locked banner when step is graded.
B1 = Phase 2 chat input + send button disabled when step is graded.
B2 = Phase 2 has a "上一步" button to return to phase 1 (preserves draft + conversation).

### Mobile 360
- **B1 locked banner shown when `stepScores[stepKey]` exists** — PASS. `app.js:97-105` `renderLockedBanner()` returns banner HTML with `<i class="ph ph-lock-key"></i> 此步驟已評分，無法再修改` + `<span class="score-pill">{Math.round(score)} 分</span>`. Injected at `app.js:3115` (mobile branch) and `app.js:3146` (desktop branch).
- **B1 banner CSS** — PASS. `style.css:4775-4791` `.locked-banner` background `--c-success-soft`, score-pill `--c-ok` background.
- **B1 phase 1 form fields readonly + .locked class** — PASS. `app.js:3036-3044` post-processes `bodyHtml` when `isLocked`: textarea gets `readonly`, fields get `.locked` class. CSS at `style.css:4744-4750` paints `.locked` / `[readonly]` with `--c-locked-bg #ece9e0` + `cursor: not-allowed`.
- **B1 phase 1 submit-bar replaced** — PASS. `app.js:3062-3068` locked branch renders `回評分` (secondary) + `下一步` (primary) instead of `返回選題 / 上一步 / 下一步`.
- **B1 phase 2 chat input disabled** — PASS. `app.js:3854-3855` adds `.locked` class + `disabled` attr; placeholder switches to `此步驟已評分，無法繼續對話`. Submit row suppressed at `app.js:3858` (`turnCount >= 3 && !isLocked`).
- **B1 phase 2 send-btn disabled** — PASS. `style.css:4753-4757` `.circles-send-btn[disabled]` / `.disabled` background `--c-primary-dim` + `cursor: not-allowed`.
- **B2 phase 2 上一步 button** — PASS. `app.js:3873-3895` renders `circles-phase-back-row`. Unlocked: secondary `上一步`. Locked: secondary `上一步（看框架）` + primary `回評分`. Handler clicks return to phase 1 of same step **without** mutating `circlesFrameworkDraft` or `circlesConversation`.

### Tablet 768
Same component tree (no tablet-specific override). PASS for B1 + B2.

### Desktop 1280
- **B1 locked banner** — PASS. Same `renderLockedBanner` injection at `app.js:3146` lives inside the desktop wrapper branch.
- **B1 form readonly** — PASS (post-process runs before desktop/mobile branch fork).
- **B1 chat disabled** — PASS (phase 2 desktop wrapper inherits same input bar).
- **B2 上一步** — PASS (same row HTML in both viewport branches).

**Independent confirmation:**
- `tests/playwright/journeys/sp1.5-locked-step.spec.js` × 8 viewports — asserts banner visible, fields readonly, send-btn disabled, score pill rounded.
- `tests/playwright/journeys/sp1.5-phase2-back.spec.js` × 8 viewports — asserts 上一步 button click returns to phase 1 with draft preserved.

---

## C — analysis 4 欄填滿

Mockup: `C-analysis-filled.html`

C1 = All 100 questions in `circles_database.json` have `analysis.business / users / insight / traps` populated; UI shows them in q-card analysis block; missing-analysis fallback escalates to `console.error`.

### Mobile 360
- **C1 analysis block 4 fields rendered** — PASS. Production renderer at `app.js:1727-1735` consumes `q.analysis.business / users / insight / traps`; fallback at `app.js:1730` now logs `console.error('[SP1.5/C1] Question missing analysis after backfill:', q.id, q.product)` (was `console.warn` on `main`).
- **C1 100 / 100 questions filled** — PASS. Backfill commits `468e7b4` (`fix(sp1.5/c1): backfill dual-writes JSON + derived circles-db.js`) + `5f67fe8` (`data(sp1.5/c1): backfill analysis.business/users/insight 100/100`). Jest assertion at `tests/sp1.5-helpers.test.js` (and the C1 backfill assertion task T14) verifies all 100 entries have non-empty analysis.

### Tablet 768
Same analysis rendering path; PASS.

### Desktop 1280
Same analysis block in desktop home / phase-1 q-card; PASS.

---

## D — Stale session 警告

Mockup: `D-stale-warning.html`

Q3 = When restored session's `question_json` snapshot diverges from current DB question, banner appears, all forms become read-only, sole action is `回首頁`.

### Mobile 360
- **D stale banner** — PASS. `app.js:108-117` `renderStaleBanner()` returns yellow banner: `<i class="ph ph-warning-octagon icon"></i>` + `<strong>此題目已被更新（snapshot 與當前題庫不一致）</strong>` + body text explaining read-only. Injected at `app.js:3116` and `app.js:3147`.
- **D banner CSS** — PASS. `style.css:4794-4814` `.stale-banner` background `--c-warn-bg #fef3c7`, border `--c-warn-border #f5d77a`, icon `--c-warn-bold`.
- **D stale flag detection** — PASS. `app.js:88-93` `computeStaleFlag(snapshot, current)` whitespace-normalizes `problem_statement` and compares. Called at `app.js:646-649` (`loadCirclesSession`) and `app.js:1192-1195` (offcanvas restore).
- **D forced read-only** — PASS. `app.js:2965` `var isLocked = isStepLocked(...) || AppState.circlesStale === true` — stale forces the same readonly + disabled treatment as locked.
- **D single 回首頁 button** — PASS. `app.js:3072-3076` overrides submit-bar to single primary `回首頁` button when `circlesStale`. Handler at `app.js:3186-3194` clears all CIRCLES state (selectedQuestion / session / conversation / draft / scores / scoreResult) before `navigate('home')`.

### Tablet 768
Same component path; PASS.

### Desktop 1280
- **D banner injection** — PASS (desktop branch `app.js:3147` includes `renderStaleBanner()`).
- **D forced read-only + 回首頁 only** — PASS (`isLocked` computation runs before viewport fork).

**Independent confirmation:**
- `tests/playwright/journeys/sp1.5-stale-session.spec.js` × 8 viewports — seeds a session with mismatched `question_json.problem_statement`, asserts stale-banner visible, all `.circles-field-input` are `[readonly]`, only `#circles-stale-home` button present.
- Server-side guard: `tests/sp1.5-helpers.test.js` asserts `/api/circles/score` and chat use `session.question_json` snapshot (commit `7684946`).

---

## Cross-cutting summary

| Mockup | Mobile 360 | Tablet 768 | Desktop 1280 | Playwright spec |
|--------|------------|------------|---------------|-----------------|
| A — visual fix | PASS | PASS | PASS | sp1.5-edge-alignment |
| B — back + locked | PASS | PASS | PASS | sp1.5-locked-step + sp1.5-phase2-back |
| C — analysis filled | PASS | PASS | PASS | (jest sp1.5-helpers + manual backfill assertion) |
| D — stale warning | PASS | PASS | PASS | sp1.5-stale-session |

**Result: 12/12 (4 mockups × 3 viewports) PASS** at the code-vs-mockup level. No deviations between mockup CSS/structure and production CSS/structure. The 8-viewport Playwright run (136 assertions across 4 specs) provides browser-level visual confirmation.

### Note on method

This document is a code-vs-mockup diff (file:line cross-reference), not a pixel screenshot diff. Visual screenshot evidence is captured by the `audit/rwd-grid/*` PNG set generated by the rwd-visual-gate Playwright project, which independently exercises all 8 viewports.
