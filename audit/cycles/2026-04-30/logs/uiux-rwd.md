# RWD 痛點獵人 — coverage report (2026-04-30)

**Auditor:** RWD Pain-Point Hunter (read-only)
**Base URL:** http://localhost:4000
**Probe:** `audit/cycles/2026-04-30/probes/uiux-rwd.js`
**Findings JSON:** `audit/cycles/2026-04-30/probes/uiux-rwd-findings.json`
**Screenshots:** `audit/cycles/2026-04-30/screenshots/uiux-rwd/<viewport>-<route>.png` (72 PNGs, one per viewport×route)

## Viewports tested
Mobile-360, iPhone-SE (375), iPhone-14 (390), iPhone-15-Pro (430), iPad (768),
Desktop-1280, Desktop-1440, Desktop-2560 — **all 8 audit projects**.

## Routes exercised
- `home` — CIRCLES home / question picker (with 5-card random + sticky 確認，開始練習)
- `home-onboarding` — `?onboarding=1` welcome card + coachmark target visibility
- `circles-step-c1` — Phase 1 step C1 (drill mode) post pick + confirm
- `circles-step-c1-keyboard` — same with first textarea focused (mobile-keyboard surrogate; verifies sticky `.rt-toolbar-mobile` + sticky submit do not jump)
- `phase2-conclusion-expanded` — fixture `09-phase2-conclusion-expanded` (sticky action row reachability)
- `nsm-home` — NSM workshop step 1
- `login` — auth login screen
- `review-examples` — standalone `/review-examples.html` SPA
- `offcanvas` — hamburger drawer open

## Scenarios checklist (universe A–M)
- [x] B1/B2 onboarding welcome (B3 replay via `?onboarding=1`)
- [x] B6 navbar tabs visible across all viewports
- [x] B7 offcanvas drawer width / overlay scroll on Mobile-360
- [x] C3 隨機選題 / 換一批 button reachability + size
- [x] C4 sticky **確認，開始練習** submit verified visible bottom-anchored
- [x] D2 rich-text mobile sticky toolbar (`.rt-toolbar-mobile`) — checked off-screen on focus
- [x] F3 conclusion-expanded sticky action row reachability across desktop heights
- [x] J1/J7 NSM home + step-4 subtab row sizing on Mobile-360
- [x] K1 offcanvas drawer width / scroll
- [x] L1 review-examples standalone page (search + step filter)
- [x] M3 mobile-keyboard sticky preserved (textarea focus surrogate — Playwright cannot pop the OS keyboard, but `interactive-widget=resizes-visual` was eyeballed)
- [x] M5 tap-target ≥44×44 on every touch viewport
- [x] Console errors aggregated per route × viewport (zero captured)
- [x] Horizontal scroll check on every route × viewport
- [x] Desktop content/viewport ratio (≥0.85 sanity check)

## Issues found
- **P0:** 0
- **P1:** 6 (clusters; each spans multiple viewports)
- **P2:** 0

No horizontal-scroll P0s. No off-screen sticky-bar P0s. No console errors. The
audit's earlier wide-monitor band fix (CLUSTER-A in `audit-master.spec.js`) is
holding — desktop content/viewport ratio passes at all desktop projects.

---

## Issues

### ISSUE-RWD-01 [P1] 隨機選題 button height 40px (<44 minimum) on every touch viewport
- **Where:** routes `home`, `home-onboarding`, `offcanvas`, `phase2-conclusion-expanded`; viewports Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad (5 touch projects, ×4 routes = 20 hits)
- **Selector:** `button.circles-q-random-btn#circles-random-btn` ("隨機選題")
- **Measured:** 74×40 px
- **Expected:** ≥44×44 (M5 / WCAG 2.5.5)
- **Actual:** 4 px short on the y-axis
- **Screenshots:** `screenshots/uiux-rwd/Mobile-360-home.png`, `iPhone-SE-home.png`, `iPad-home.png`
- **Root cause hypothesis:** `.circles-q-random-btn` has explicit `height: 40px` (or `padding: 6px 12px` + 14px line-height) in style.css. Bump to 44 (or `min-height: 44px` + tap-padding).

### ISSUE-RWD-02 [P1] 前往 NSM banner button height 40px (<44 minimum) on every touch viewport
- **Where:** routes `home`, `home-onboarding`, `offcanvas`, `phase2-conclusion-expanded`; same 5 touch projects (20 hits)
- **Selector:** `button.nsm-banner-btn#circles-nsm-banner-btn` ("前往 NSM →")
- **Measured:** 92×40 px
- **Expected:** ≥44×44
- **Screenshots:** `screenshots/uiux-rwd/Mobile-360-home.png`
- **Root cause hypothesis:** `.nsm-banner-btn` uses the same compact-action sizing as `.circles-q-random-btn` — same fix likely closes both (one min-height token).

### ISSUE-RWD-03 [P1] CIRCLES Phase 1 「回首頁」 button height 40px on every touch viewport
- **Where:** routes `circles-step-c1`, `circles-step-c1-keyboard`; 5 touch projects (10 hits)
- **Selector:** `button.circles-nav-home#circles-p1-home` ("回首頁")
- **Measured:** 60×40 px
- **Expected:** ≥44×44
- **Screenshots:** `screenshots/uiux-rwd/Mobile-360-circles-step-c1.png`, `iPhone-SE-circles-step-c1.png`
- **Root cause hypothesis:** `.circles-nav-home` shares the small-secondary action style. Pair with RWD-01/02 in one CSS-token bump.

### ISSUE-RWD-04 [P1] 「什麼是 CIRCLES 實戰訓練？」 collapse-toggle button height 42px (<44) on every touch viewport
- **Where:** routes `home`, `home-onboarding`, `offcanvas`, `phase2-conclusion-expanded`; 5 touch projects (20 hits, 4 per viewport)
- **Selector:** `button` rendering "什麼是 CIRCLES 實戰訓練？" (the explainer/disclosure toggle)
- **Measured:** 294–638×42 px depending on viewport (width grows on bigger phones; height pinned 42)
- **Expected:** ≥44×44
- **Screenshots:** `screenshots/uiux-rwd/Mobile-360-home.png`
- **Root cause hypothesis:** Disclosure toggle uses `padding: 10px 16px` with 14px line-height = 42 instead of 44. Add 1 px top/bottom padding.

### ISSUE-RWD-05 [P1] login / NSM step-1 primary action buttons 36–38px tall (<44) on every touch viewport
- **Where:**
  - route `login` — `button.btn` "登入" 286–358 × **38** px (5 touch projects)
  - route `nsm-home` — `button#btn-nsm-step1-next.btn` "開始 NSM 訓練" 328–736 × **36** px (5 touch projects)
- **Expected:** ≥44 height (these are the **primary** CTA on each screen — should be largest, not smallest)
- **Screenshots:** `screenshots/uiux-rwd/Mobile-360-login.png`, `Mobile-360-nsm-home.png`
- **Root cause hypothesis:** Generic `.btn` token bottoms out at ~36 px when there is no explicit `--btn-h` override. The home sticky 確認，開始練習 button uses `.circles-btn-primary` which IS sized correctly (≥48); the global `.btn` rule is not. Either widen `.btn` floor or migrate these CTAs to the same primary token.

### ISSUE-RWD-06 [P1] review-examples standalone page: navbar links + 全展開 / 全收起 controls + 忘記密碼 link all <44px tall on every touch viewport
- **Where:**
  - `a.navbar-logo` "PM Drill" 84×26
  - `a.navbar-tab` "CIRCLES" 68×22, "北極星指標" 80×22
  - `button#expand-all` "全展開" 65×36
  - `button#collapse-all` "全收起" 65×36
  - on `login`: `a#forgot-password-link` "忘記密碼？" 68×17
- **Where (viewports):** Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad
- **Screenshots:** `screenshots/uiux-rwd/Mobile-360-review-examples.png`, `Mobile-360-login.png`
- **Root cause hypothesis:** `review-examples.html` has its own minimal stylesheet that doesn't inherit the main app's `.navbar-tab` sizing — its tabs are inline-flex auto-height. Likewise `#expand-all`/`#collapse-all` and `#forgot-password-link` are `<a>`/`<button>` without explicit min-height + tap padding. Either link to the shared sizing token or add a local rule.

---

## Things that PASSED (worth flagging)

- **No horizontal scroll** on any route × any viewport (the earlier `overflow-x: clip` + 88% wide-band cap is doing its job).
- **Sticky bottom bars** (`.circles-submit-bar`, `.rt-toolbar-mobile`, `.nsm-bottom-bar`) all stay within `winH` after textarea focus — no jump.
- **Desktop content/viewport ratio** ≥0.85 at 1280 / 1440 / 2560 (CLUSTER-A in audit-master.spec.js holding).
- **Console errors:** zero across 9 routes × 8 viewports = 72 page loads.
- **Offcanvas drawer** Mobile-360: width fits, list scrolls, overlay click closes — no overflow.
- **Phase 2 conclusion-expanded** sticky action row: stays anchored on all viewports (incl. iPhone-SE 667).

## Recommendation to Test Director

All 6 issues are **tap-target / sizing** P1s, no layout-breaking P0s. They cluster under
two root-cause groups:

- **Group 1 (4 issues, RWD-01/02/03/04):** Compact secondary-button + disclosure-toggle pattern in the main app — CSS rule(s) for `.circles-q-random-btn`, `.nsm-banner-btn`, `.circles-nav-home`, and the disclosure toggle button bottom out at 40–42px. **One min-height token bump** (e.g. raise `--btn-compact-h` from 40 → 44) likely closes all four.
- **Group 2 (2 issues, RWD-05/06):** Two screens where the primary CTA / nav links are NOT using the standardised primary-button sizing — login screen `.btn`, NSM step-1 `.btn`, plus the review-examples page's standalone navbar/controls. Either migrate to `.circles-btn-primary` / shared token, or set `min-height: 44px` per surface.

A UI/UX mockup gate is needed because making the disclosure toggle 44 px tall changes vertical rhythm on the home page; user should eyeball before merging.

## Log path

`audit/cycles/2026-04-30/logs/uiux-rwd.md`
