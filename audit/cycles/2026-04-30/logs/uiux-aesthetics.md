# uiux-aesthetics coverage report — 2026-04-30

**Auditor:** 美學總監 (Aesthetics Director)
**Probe:** `audit/cycles/2026-04-30/probes/uiux-aesthetics.spec.js`
**Probe config:** `audit/cycles/2026-04-30/probes/playwright.config.js`
**Run:** 80 passed / 0 failed / 10 skipped (legacy `Desktop` alias) — see Playwright output.
**Aggregate dump:** `audit/cycles/2026-04-30/logs/uiux-aesthetics-aggregate.json`

## Viewports tested
Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560 (Desktop alias skipped to avoid duplicate of Desktop-1280).

## Routes tested
- `01-home-guest` — `/?onboarding=0`
- `02-onboarding-welcome` — `/?onboarding=1`
- `03-circles-step-c1` — Phase 1 step C1, drill mode (default first question)
- `04-phase2-conclusion-expanded` — fixture from rwd-visual-gate (`AppState.circlesSubmitState='expanded'`)
- `05-nsm-home` — NSM step 1
- `06-login`
- `07-register`
- `08-review-examples` — `/review-examples.html`
- `09-offcanvas-open` — hamburger drawer open
- `10-history` — `navigate('history')`

Routes pre-captured by sibling rwd-visual-gate spec (and re-reviewed): `02-circles-step-c`, `03-nsm-home`, `05-review-examples`, `06-offcanvas-open`, `07-q-card-expanded`, `08-search-active`, `09-phase2-conclusion-expanded` under `audit/rwd-grid/<viewport>/`.

## Scenarios covered (universe A–M)
- **A.** A1 guest landing screenshot ✓; A2/A3 register/login screenshots ✓ (no DB write, render-only); A4–A6 not exercised by aesthetics (functional).
- **B.** B1 onboarding welcome card render ✓; B5/B6/B7 navbar + offcanvas open ✓.
- **C.** C1–C4 home picker visual chrome ✓ (mode card, type tabs, Q-card chrome).
- **D.** D1, D2, D8, D9 visual chrome on step C1 ✓ (rich-text toolbar, hint card, progress bar). D3/D4/D6 functional — aesthetics covered indirectly via static screenshots.
- **E.** Not visually exercised (gate requires API). Functional auditors own.
- **F.** F3 conclusion-expanded sticky action row ✓ (rendered via fixture).
- **G.** Not visually exercised (score requires evaluate API).
- **H.** Not visually exercised.
- **I.** Simulation mode chrome on home ✓ (mode card).
- **J.** J1, J7 NSM home + step layout ✓.
- **K.** K1/K3 offcanvas drawer + empty state ✓; K5 history view + empty state ✓.
- **L.** L1 review-examples standalone ✓.
- **M.** M2 zero console errors confirmed across all 80 runs; M5 tap targets — see ISSUE-AES-04; M6 focus rings — see ISSUE-AES-05; M7 aria-live — see ISSUE-AES-08.

## Issues found

| ID | Severity | Title |
|---|---|---|
| ISSUE-AES-01 | P1 | `.circles-step-meta` (`25-35 分鐘 · 全 7 步`) fails WCAG AA on tinted blue chip — contrast 1.27:1 |
| ISSUE-AES-02 | P1 | Step pill labels (`問題範圍` / `時間範圍` / `業務影響`) on phase1 progress bar fail AA — 3.48:1 on `--c-bg` |
| ISSUE-AES-03 | P1 | Hint helper / "範例（不同題目）" / "尚無紀錄" use `--c-text-3` which is 3.97:1 on white — fails AA for normal text |
| ISSUE-AES-04 | P1 | Eight buttons land below 44×44 logical-px tap minimum on every touch viewport |
| ISSUE-AES-05 | P1 | `:focus-visible` outline narrowed to `var(--focus-ring)` only on `.btn`; `.circles-q-card`, `.circles-mode-card`, `.circles-type-tab`, `.navbar-tab`, `.offcanvas-item` show no visible focus ring |
| ISSUE-AES-06 | P2 | Nine distinct `font-family` strings active in DOM — `DM Sans` is forked into three different ramps + lone `PingFang TC` / `Arial` / `Times` declarations |
| ISSUE-AES-07 | P2 | Inline `style="…#fff…#1a1a1a…#EEF3FF…"` used in 10 unique places where `--c-*` token already exists — inconsistent with the documented token discipline |
| ISSUE-AES-08 | P2 | "繼續對話" arrow renders inside the same `<button>` text node as "繼續對話" without a separator — measured size 53×14px (`.conclusion-back-btn`) — also fails M5 |
| ISSUE-AES-09 | P2 | Login `忘記密碼？` is an `<a>` 68×17px — both undersize tap target AND visually outranks the primary button (no hierarchy via weight/size) |
| ISSUE-AES-10 | P2 | Home `25-35 分鐘 · 全 7 步` line uses `· · ·` separators glued tight; on Mobile-360 wraps mid-token and creates ragged orphans |

---

### ISSUE-AES-01 [P1] `.circles-step-meta` chip fails WCAG AA — 1.27:1
- **Where:** `/` (and `02-onboarding-welcome`, `09-offcanvas-open` — same component); every viewport.
- **Repro:**
  1. Open `http://localhost:4000/?onboarding=0`.
  2. Inspect the `25-35 分鐘 · 全 7 步 · 無提示` line below the recommend-mode card.
  3. fg `rgb(90,80,70)` = `--c-text-2` (#5a5046); bg `rgba(26,86,219,0.08)` = `--c-primary-lt` over `--c-bg` (#F2F0EB).
- **Expected:** ≥4.5:1 (AA normal text) — text is 11px so AA-Large does not apply.
- **Actual:** 1.27:1. The translucent blue tint hides the warm-grey text almost entirely on the warm beige page background. Screenshot: `audit/cycles/2026-04-30/screenshots/uiux-aesthetics/Mobile-360/01-home-guest.png` (top-of-page meta chip area).
- **Console:** clean.
- **Hypothesised root cause:** `style="…color:var(--c-text-2,#5a5a5a);…"` in `.circles-step-meta` was authored when the surrounding background was white; once `--c-primary-lt` was added behind the meta chip the contrast collapsed. Fix should switch to `--c-primary` (≥7:1) or remove the tinted background.

### ISSUE-AES-02 [P1] Phase-1 step pills `問題範圍` etc. — 3.48:1
- **Where:** `/` (Phase 1 progress bar) — every viewport.
- **Repro:** Pick the first question, click 確認，開始練習; the four sub-step pills `問題範圍 / 時間範圍 / 業務影響 / 假設確認` render at `font-size:10px / weight:700`, fg `--c-text-3` (#8a7e6f) on `--c-bg` (#F2F0EB).
- **Expected:** ≥4.5:1 for AA normal text. (10px does not qualify as AA-Large even at weight 700, which requires ≥18.66px.)
- **Actual:** 3.48:1 on five touch viewports + three desktop viewports. Screenshot: `audit/cycles/2026-04-30/screenshots/uiux-aesthetics/Desktop-1440/03-circles-step-c1.png` (header strip).
- **Hypothesised root cause:** Step labels demoted to `--c-text-3` to push focus to the active label; demotion is too aggressive. Use `--c-text-2` (#5a5046, 6.7:1) or bump the weight + size.

### ISSUE-AES-03 [P1] `--c-text-3` body usage on white — 3.97:1
- **Where:** Hint helper rows (`說明問題範圍、時間框架、業務約束…`), `範例（不同題目）` example-card label, recent-sessions slot empty-state `尚無紀錄`. Phase 1 step C1, Phase 2 conclusion-expanded, home recent-sessions sidebar.
- **Repro:** Hover any 提示 helper line on step C1 / 04-phase2-conclusion-expanded / home empty-recent-sessions slot. fg `#8a7e6f`, bg `#fff`.
- **Expected:** ≥4.5:1 (AA normal).
- **Actual:** 3.97:1 — fails AA, just barely passes AA-Large. Screenshot: `audit/cycles/2026-04-30/screenshots/uiux-aesthetics/Desktop-1280/04-phase2-conclusion-expanded.png`.
- **Hypothesised root cause:** `--c-text-3` is used as a "hint" colour but only meets AA-Large; promote to `--c-text-2` for any 11–13px body usage, or darken the token globally.

### ISSUE-AES-04 [P1] Tap targets <44×44 on touch viewports
- **Where:** Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad on multiple routes.
- **Affected buttons (selector → measured):**
  - `.circles-q-random-btn` (`隨機選題`) — 74×40 — home.
  - `.nsm-banner-btn` (`前往 NSM →`) — 92×40 — home.
  - `.btn` ‘什麼是 CIRCLES 實戰訓練？’ disclosure — 294×42 (height fail).
  - `.circles-nav-home` (`回首頁`) — 60×40 — phase1.
  - `.circles-nav-home-btn` 62×36 + `.conclusion-back-btn` 53×14 + `.conclusion-submit-btn` 76×33 — phase2 conclusion-expanded sticky row.
  - `.btn.btn-primary.nsm-next-btn` `開始 NSM 訓練` — 736×36 (iPad) / 343×36 (iPhone-SE) — height fail.
  - `.btn.btn-primary` `登入` / `建立帳號` — 286×38 / 301×38 — height fail.
  - `<a>忘記密碼？</a>` — 68×17 — both dims fail.
  - review-examples navbar `PM Drill` 84×26, `CIRCLES` 68×22, `北極星指標` 80×22, `全展開` 65×36.
- **Expected:** ≥44×44 logical-px on every touch viewport (M5).
- **Actual:** 8 distinct selectors fail, repeating across all 5 touch viewports. Screenshots: `audit/cycles/2026-04-30/screenshots/uiux-aesthetics/iPhone-SE/{01,03,04,05,06}-*.png`.
- **Hypothesised root cause:** Buttons authored at desktop heights (32–40px) without the touch-viewport bump. The `.btn` height should be raised to 44px on mobile or per-component `min-height:44px` added.

### ISSUE-AES-05 [P1] Focus rings missing on key interactive surfaces
- **Where:** All routes, all viewports.
- **Repro:** Tab through `/`. Focus moves but no visible ring lands on `.circles-q-card`, `.circles-mode-card`, `.circles-type-tab`, `.navbar-tab`, `.offcanvas-item`, `.history-item`, `#filter-step` (review-examples). The buttons that DO get a ring are `.btn` only, via the global `--focus-ring` rule.
- **Expected:** Visible focus ring on every interactive element (M6 + WCAG 2.4.7).
- **Actual:** Sampled focus-visible computed styles via the probe (`focusSamples` block in JSON dumps); only `.btn` returns a non-zero outline / boxShadow. Screenshots produced via static capture cannot show focus, but the JSON evidence is in the per-route `*.json` files.
- **Hypothesised root cause:** Only `.btn` got the `:focus-visible { outline: var(--focus-ring); … }` rule; cards / tabs / nav links were never wired up.

### ISSUE-AES-06 [P2] Nine distinct font-family strings in DOM
- **Where:** Every route.
- **Detail:** Aggregate dump shows nine variants: `"PingFang TC"`, `"DM Sans", -apple-system, "system-ui", "Segoe UI", sans-serif`, `Arial`, `Phosphor`, `"Instrument Serif", serif`, `"DM Sans", sans-serif`, `Times`, `"DM Sans", -apple-system, sans-serif`, `monospace`. Three different `DM Sans` fallback ramps will render differently on a system without DM Sans loaded. `Arial` and `Times` are leaks (likely from default user-agent).
- **Expected:** A single `--font-sans` and `--font-serif` token, used everywhere; no element bare to UA defaults.
- **Hypothesised root cause:** Inline-style spots set `font-family` directly; some sub-components didn't inherit. Centralise to two tokens.

### ISSUE-AES-07 [P2] Hard-coded hex in inline `style=""`
- **Where:** 10 unique inline styles flagged. Examples:
  - `.circles-mode-recommend-badge` → `color:#fff;background:var(--c-primary,#1a56db)` — hard-coded `#fff` should be `var(--c-card)` or `var(--c-on-primary)`.
  - `auth-tab login-tab active` → `border:1px solid var(--border,#e5e5e5);background:var(--c-primary,#1a56d…)` — `#e5e5e5` does not match any `--c-border-*` token (closest is `rgba(60,45,30,0.08)`).
  - `font-size:11px;color:#1a1a1a` — should be `var(--c-text)`.
- **Expected:** No hard-coded hex when a `--c-*` token covers the colour role.
- **Hypothesised root cause:** Drift over time. One pass through `app.js`'s inline-style strings closes this.

### ISSUE-AES-08 [P2] `← 繼續對話` button is a single text node, ~53×14px
- **Where:** Phase 2 conclusion-expanded sticky bottom action row.
- **Detail:** `.conclusion-back-btn` measured 53×14 — both arrow `←` and label `繼續對話` are inline text in the same button with no padding, so the whole button collapses to the tight text box. This breaks both visual hierarchy (looks like a link, not a sibling button to the primary `確認提交`) and tap-target M5.
- **Hypothesised root cause:** `padding:0` on the styled selector, missing `min-height:44px` and missing `gap` for the icon glyph.

### ISSUE-AES-09 [P2] `忘記密碼？` link visually outranks the wrong action
- **Where:** Login + Register screens, all viewports.
- **Detail:** Centred, underlined link sits *above* the primary button area but at 14px — same size as the surrounding labels, weight 400, with default underline. There is no visible secondary-button treatment; the link reads as flat text. Combined with the undersize tap target (68×17), users may miss it entirely on touch viewports.

### ISSUE-AES-10 [P2] `25-35 分鐘 · 全 7 步 · 無提示` wraps poorly on Mobile-360
- **Where:** Home `.circles-step-meta` strip on Mobile-360.
- **Detail:** The three middle-dot tokens are glued tight (`gap:6px 14px;flex-wrap:wrap`); on 360px width the line wraps after `· 全 7 步` leaving `· 無提示` orphaned to a second line. Adds visual noise on the densest viewport.

---

## Cross-cutting positives (no issue filed)
- Zero console errors / unhandled rejections across all 80 runs (M2 ✓).
- Zero unintended horizontal scroll on any viewport × route (probe assertion passed everywhere).
- `--c-*` token system is comprehensive (full token list captured per route in `tokens` block of each JSON).

## Hand-off
Director (you): screenshots and JSON evidence are under
`audit/cycles/2026-04-30/screenshots/uiux-aesthetics/<viewport>/<route>.{png,json}`.
Aggregate at `audit/cycles/2026-04-30/logs/uiux-aesthetics-aggregate.json`.
This log: **`audit/cycles/2026-04-30/logs/uiux-aesthetics.md`**.

Read-only — no source edits performed.
