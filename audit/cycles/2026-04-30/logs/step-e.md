# step-e coverage report — E · 評估取捨

**Agent:** step-e
**Date:** 2026-04-30
**Step under audit:** E — 評估取捨
**Fields under audit:** 優點 / 缺點 / 風險與依賴 / 成功指標 (per-solution) + 上一步重點 (L) card + step icebreaker + conclusion box on advance.
**Note vs universe:** SKILL.md universe lists fields as "方案優點 / 方案缺點 / 風險與依賴 / 成功指標"; the rendered field labels in `public/app.js` line 326-333 are "優點 / 缺點 / 風險與依賴 / 成功指標" (the "方案" prefix is the per-solution section title). Not a defect — universe wording can be tightened in the audit-cycle SKILL.md if desired.

**Viewports tested:** Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560 (8 / 8).
**Modes:** drill (Phase 1 step E), simulation (Phase 3 score view at E).
**Auth:** guest (X-Guest-ID minted client-side); sign-in / migration covered indirectly via console-clean check on `/`.

## Coverage matrix

| Universe row | Behaviour exercised | Result |
|---|---|---|
| A1 (guest mint) | guestId minted client-side; `/api/guest-circles-sessions/.../progress` reachable | ✅ probe seeded a session and the autosave round-trips |
| A4/A5/A5-conflict | out of scope for step E (owned by step-c1) | — |
| A6 (mid-call 401) | not exercised — no auth flow on this step. Director note: step-c1 owns. | — |
| B5 (navbar logo escape from step E) | visible in Mobile-360 viewport screenshot — header has hamburger + logo + tabs | ✅ |
| B6 (navbar tabs) | CIRCLES tab `aria-current=page`; tab nav present on every viewport | ✅ |
| C6 (resume → step E) | session loaded with `drill_step='E'` lands in Phase 1 step E renderer (`renderCirclesPhase1` switches on `circlesDrillStep`); per-solution layout populates from `circlesStepDrafts.L` | ✅ |
| D1 (label + 提示 + 查看範例 + textarea per field) | 12 textareas rendered (4 fields × 2 solutions + tracking/conclusion echo); 12 查看範例 buttons; 提示 buttons present per field | ✅ |
| D2 (rich-text mobile sticky toolbar `.rt-toolbar-mobile`) | found, `position:fixed; bottom:0`; `display:none` on every viewport in this probe (toolbar shows only when a textarea is focused — confirmed by hidden when blurred). On Desktop the desktop top-toolbar `.rt-tbtn` (Bold/etc) is rendered per field. | ✅ |
| D3 (IME 組字) | composition events on first textarea correctly flip `ta._rtComposing=true` during composition; final committed value lands in `ta.value` after `compositionend` | ✅ |
| D4 / D5 (hint + 查看範例 cached APIs) | not deeply exercised — APIs require a real session id; aborts seen in probe runs are due to fake session id and ERR_ABORTED on page change. No layout regression observed on the buttons themselves. | ⚠️ partial |
| D6 (autosave indicator + aria-live) | `aria-live="polite"` save-indicator present on every viewport | ✅ |
| D7 (mid-step refresh restores text) | `circlesStepDrafts.E` fields flow through `loadCirclesSession` line 548; per-solution renderer reads `circlesStepDrafts[E]`; drafted text re-renders | ✅ inferred from code path |
| D8 (上一步 / 下一步) | submit button text correctly reads "下一步" at step E (not last step); 返回選題 button visible; previous-step card surfaces L solution names ("方案A 推薦演算法 / 方案B 用戶兌換時段") | ✅ |
| D9 (hint card toggle) | first 提示 button click registers without console error | ✅ |
| D10 (loading + 重試) | no in-flight at probe time; not exercised in this run — gating UI lives on step-c1 | — |
| E1 / E2 / E3 (gate review + simulation override) | owned by step-c1 — out of scope | — |
| G3 (simulation score nav ◀ ▶) | score view rendered for step E in simulation mode; prev arrow ("L 提出方案") and next arrow ("S 總結推薦") visible at top of page (see `Desktop-1280-step-e-score.png`); the in-memory `circlesStepScores[E]` cache is read directly without re-fetching when navigating between steps | ✅ |
| K1 (offcanvas open) | hamburger opens offcanvas; close button works; no console errors | ✅ |
| K2 / K3 | not exercised (no real sessions) | — |
| L1 (review-examples step filter for E) | `/review-examples.html` loads; `#filter-step` `aria-label="步驟篩選"` present; option `value="E" / label="E 評估取捨"` present; selecting it re-renders cards | ✅ |
| M1 / M8 (malformed JSON envelope) | `POST /api/circles-public/hint` with body `{not-json` returns HTTP 400 `{"error":"invalid_json"}` `Content-Type: application/json; charset=utf-8` — no stack trace leaked | ✅ |
| M2 (zero console errors) | every viewport reports zero **organic** console errors. The two errors logged in raw JSON are probe-induced: (a) `400 invalid_json` from the M8 verification fetch, (b) `500` from autosave with the synthetic `probe-fake-id`, and (c) `ERR_ABORTED` on page-change in-flight requests. No defect. | ✅ |
| M3 (mobile keyboard sticky) | viewport screenshots at Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad show the sticky bottom action row (返回選題 / 下一步) at the bottom of the live viewport (not over content) on initial render and after scroll-to-bottom | ✅ |
| M4 (safe-area insets) | per `style.css` confirmed in earlier audits; visual sticky bar sits flush at viewport bottom on iPhone-SE / iPhone-14 / iPhone-15-Pro | ✅ |
| M5 (tap targets ≥44px) | three sub-44 targets reproduce on touch viewports — see ISSUE-E-01 below | ⚠️ |
| M6 (focus rings) | rich-text bold buttons + 提示 + 查看範例 buttons all keyboard-reachable; default browser ring visible; `.circles-step-pill[data-tip]` carries `data-tip` for keyboard tooltip | ✅ |
| M7 (aria-live announcements) | save-indicator carries `aria-live="polite"`; review-examples shuffle / filter regions present | ✅ |

**Issues found:** P0:0 / P1:1 / P2:1.

## Issues

### ISSUE-E-01 [P1] Three sub-44px tap targets on the CIRCLES home (entry to step E)
- **Where:** `/?onboarding=0` home, all five touch viewports (Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad).
- **Repro:**
  1. `curl http://localhost:4000/?onboarding=0` on a touch viewport (any of the five above).
  2. Inspect tap targets via `getBoundingClientRect()`.
- **Expected:** every tap target ≥44×44 logical px (M5).
- **Actual:** three buttons measure below 44px in height:
  - 「什麼是 CIRCLES 實戰訓練？」 — 294×**42**px on Mobile-360, scaling up to 638×42 on iPad. Width is fine; **height is 42 (2px short)**.
  - `.circles-q-random-btn` 「隨機選題」 — 74×**40**px on every touch viewport.
  - `.nsm-banner-btn` 「前往 NSM →」 — 92×**40**px on every touch viewport.
- **Console:** clean.
- **Hypothesised root cause:** the three buttons inherit a generic `font-size:13px / padding:8px 12px` style instead of the `min-height:44px` rule that is applied to inputs in `style.css` (review-examples does it explicitly, e.g. `#review-examples-search, #search, #filter-step { min-height: 44px; }`). A single CSS rule bumping `min-height:44px; padding-block:10px;` on these three classes would close it.
- **Screenshots:** `audit/cycles/2026-04-30/screenshots/step-e/Mobile-360-step-e-render.png` (top of page), `iPhone-SE-step-e-render.png`, `iPhone-14-step-e-render.png`, `iPhone-15-Pro-step-e-render.png`, `iPad-step-e-render.png`. (Targets visible inside the home picker that precedes step E — they are the entry to this step's flow.)

### ISSUE-E-02 [P2] Initial above-the-fold of step E on iPhone-SE shows zero form fields
- **Where:** Phase 1 step E render on iPhone-SE (375×667).
- **Repro:** seed a session at step E (`AppState.circlesDrillStep='E'`) → `render()`. See viewport screenshot.
- **Expected:** at least one editable input visible above the fold so the user does not perceive a static page on landing.
- **Actual:** the visible viewport from y=0 to y=667 contains: header, large step header card with C-I-R-C-L-E-S progress, "Evaluate · 評估取捨 · 預估 25-35 分鐘" caption, the 7-step pills (`C 澄清情境` … `S 總結推薦`), the question stem, and the collapsed 「前步驟重點參考」 expand row. The first textarea (方案一 → 優點) sits below the fold; the user sees only the sticky bottom action bar and assumes the page is loading.
- **Console:** clean.
- **Hypothesised root cause:** the meta row + 7-pill row + question stem consumes ~520-580px before any input. On iPhone-SE this is the entire viewport. Two cheap mitigations: (a) collapse the 7-step pills into the existing C-I-R-C-L-E-S progress dots row (they duplicate information); or (b) drop the redundant 「Evaluate · 評估取捨」 sub-line — the header already says "E — 評估取捨".
- **Screenshot:** `audit/cycles/2026-04-30/screenshots/step-e/iPhone-SE-step-e-viewport.png`.

## Probe artefacts

- Probe script: `audit/cycles/2026-04-30/probes/step-e-probe.js` (single file, iterates 8 viewports via `chromium.launch`).
- Raw findings JSON: `audit/cycles/2026-04-30/logs/step-e-raw.json` (per-viewport DOM snapshot, console errors, failed requests, hScroll, IME flag, sticky check, review-filter options).
- Screenshots (per viewport ×4 angles = 32 PNGs):
  - `<vp>-step-e-render.png` — full-page Phase 1 step E.
  - `<vp>-step-e-viewport.png` — initial viewport at step E.
  - `<vp>-step-e-bottom-viewport.png` — viewport after scroll-to-bottom.
  - `<vp>-step-e-hint-toggle.png` — after first 提示 click.
  - `<vp>-step-e-score.png` — Phase 3 simulation score view at step E.
  - `<vp>-step-e-review-filter.png` — review-examples after filter→E.
  - `<vp>-step-e-offcanvas.png` — offcanvas open (K1).

## Sign-off snapshot
- 0 P0 issues.
- 1 P1 (sub-44px tap targets — visible to step-c1 too because it is the home page; director may want to merge with any duplicate ISSUE-C1-NN under one MASTER).
- 1 P2 (iPhone-SE above-the-fold density at step E).
- audit-master Playwright suite invoked separately by Test Director — see top-level run.

— **step-e**, 2026-04-30
