# step-c1 coverage report

**Date:** 2026-04-30
**Agent:** step-c1 (CIRCLES C1 — 澄清情境 + register/login/migration smoke + onboarding + picker + Phase 1.5 gate)
**Probe:** `audit/cycles/2026-04-30/probes/step-c1-all.js`
**Raw findings dump:** `audit/cycles/2026-04-30/logs/step-c1-findings.json`

## Viewports tested
Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560 (all 8).

## Scenarios covered

| ID | Scenario | Result |
|---|---|---|
| A1 | Guest UUID minted in `localStorage.guestId` and used as `X-Guest-ID` | PASS (re-check after probe fix — key is `guestId`, not `guest_id`) |
| A2 | `POST /api/auth/register` envelope (smoke: empty body → 400, no HTML stack leak) | PASS |
| A3 | Login UI route (`navigate('login')`) — covered by audit-master | PASS |
| A4 | Logout `#btn-logout` exists when authed | PASS (presence checked; auth state not exercised in this probe — covered by audit-master) |
| A5 / A5-conflict | Migration not exercised end-to-end (no real auth user); endpoint smoke only | DEFERRED — needs auth fixture; not surfaced as bug |
| A6 | 401 silent failure path | NOT EXERCISED — no draft loss observed in synthetic probe |
| B1 / B3 | `?onboarding=1` replays welcome (`#onb-skip` / `#onb-start` rendered) | PASS on all 8 |
| B4 | `?onboarding=0` suppresses welcome | PASS on all 8 |
| B5 | `#navbar-home-btn` from Phase 1 → picker | PASS on all 8 |
| B6 | Navbar tabs `circles` + `nsm` present with `[data-nav]` | PASS on all 8 |
| B7 | `#btn-hamburger` opens `#offcanvas` (`.open` toggled) + close button works | PASS on all 8 |
| B8 | `GET /login.html` → `302 → /?view=login` | PASS on all 8 |
| C1 | Mode picker — 2 `.circles-mode-card[data-mode]` | PASS on all 8 |
| C2 | 3 `.circles-type-tab[data-type]` | PASS on all 8 |
| C3 | 5 `.circles-q-card` rendered + `#circles-random-btn` triggers `aria-live="polite"` announcement `已隨機重新選 5 題` | PASS on all 8 |
| C4 | Difficulty labels `簡單/中等難度/困難` map; 看完整題目 expand-in-place; sticky 確認按鈕 visible | PARTIAL — see ISSUE-C1-01, ISSUE-C1-02 |
| C5 | Question pick → Phase 1 form (`.circles-step-form` / `textarea`) | PASS on all 8 |
| C6 | Resume banner on home — 0 cards in fresh-guest state (expected) | PASS |
| C7 | Boot `confirm()` resume prompt | NOT TRIGGERED in probe (no lastSessionId); covered by audit-master |
| E1 / E2 | Phase 1.5 gate render via `circlesGateResult` fixture | PASS on all 8 |
| E3 | Simulation override: `#circles-gate-continue` rendered when `overallStatus='error'` + `mode='simulation'` | PASS on all 8 |
| M2 | Console errors / page errors during entire flow | PASS (zero) |
| M5 | Tap targets ≥44×44 on mobile viewports | FAIL — see ISSUE-C1-01 |
| M7 | aria-live announcements (shuffle, save, hint) | PASS (shuffle confirmed; save/hint not exercised in C1 probe) |
| M8 | Malformed JSON body returns `{error:'invalid_json'}` 400, no HTML stack | PASS |

## Issues found

| Severity | Count |
|---|---|
| P0 | 1 |
| P1 | 5 (one root cause across 5 mobile viewports) |
| P2 | 0 |

---

## Issues

### ISSUE-C1-01 [P1] `.circles-q-confirm-btn` (確認，開始練習) under 44px tap target on every mobile viewport
- **Where:** `/?onboarding=0` home → expanded question card → `.circles-q-confirm-btn`. Affects Mobile-360, iPhone-SE, iPhone-14, iPhone-15-Pro, iPad.
- **Repro:**
  1. Open `http://localhost:4000/?onboarding=0` in any mobile viewport.
  2. Click the first `.circles-q-card` to expand.
  3. Measure `getBoundingClientRect()` of `.circles-q-confirm-btn`.
- **Expected:** ≥44×44 logical px per § M5.
- **Actual:** Height 36px on every mobile viewport (widths ranging 220–290 px). See `audit/cycles/2026-04-30/screenshots/step-c1/expanded-Mobile-360.png` (and the per-viewport `expanded-*.png` siblings).
- **Console:** clean.
- **Hypothesised root cause:** `public/style.css:2847-2859` defines
  ```
  [data-view="circles"] .circles-q-confirm-btn {
    flex: 1;
    padding: 9px 0;
    font-size: 13px;
    ...
  }
  ```
  No `min-height: 44px` is applied. Total rendered height ≈ 36px (line-height of 13px font + 18px vertical padding). The cancel button sibling (`.circles-q-cancel-btn`, line 2860) has the same defect.

### ISSUE-C1-02 [P0] Sticky 確認按鈕 row falls below viewport on iPhone-SE (375×667) after expand
- **Where:** `/?onboarding=0` on iPhone-SE → expand the first question card.
- **Repro:**
  1. Open `http://localhost:4000/?onboarding=0` at 375×667 (iPhone-SE).
  2. Click the first `.circles-q-card`.
  3. Without scrolling, measure the bottom of `.circles-q-confirm-btn`.
- **Expected:** Bottom edge ≤ viewport height (`window.innerHeight = 667`).
- **Actual:** `bottom = 676.19px`, i.e. **≈9 px below the fold**, requires the user to scroll the entire card up to even reach the primary CTA. Screenshot: `audit/cycles/2026-04-30/screenshots/step-c1/expanded-iPhone-SE.png`.
- **Note:** The same flow on iPhone-14 (390×844), iPhone-15-Pro (430×932), iPhone-SE-larger Mobile-360 (360×780), iPad (768×1024) keeps the button on-screen — only iPhone-SE's 667-px height is short enough to push it off. Since iPhone-SE is one of the 8 audited projects this is a P0 (button covered / unreachable on default fold).
- **Console:** clean.
- **Hypothesised root cause:** The expanded card vertical content (`.circles-q-card-full-block` + `.circles-q-card-stmt` line-clamp removal + sticky button row) plus card padding overruns 667 px. Either (a) `.circles-q-card-full-block` needs an internal `max-height` + scroll on small heights, or (b) the action row needs to live in a `position: sticky; bottom: 0` container relative to the card so it always pins to the visible card area. Not iPhone-14+, where the extra 177–265 px of viewport hides the issue.

### ISSUE-C1-01 sub-finding [P1] `.circles-q-cancel-btn` shares the same height defect
- Same root cause, same `padding: 9px 0; font-size: 13px;` rule (`public/style.css:2860`). Will be closed by the same fix that addresses ISSUE-C1-01.

---

## Notes for director / triage

- A5 / A5-conflict / A6 require a real Supabase auth fixture to fully exercise — recommend the director either give step-c1 a service-role test user or hand A5 to a dedicated agent. Probe currently smoke-tests the endpoints' existence + envelope shape only.
- All other in-scope C / B / E / M items audited were green across all 8 viewports.
- Probe + screenshots are reproducible via:
  ```
  node audit/cycles/2026-04-30/probes/step-c1-all.js
  ```
- Visual fixture screenshots were also captured at `home-<viewport>.png` and `gate-sim-<viewport>.png` for each of the 8 projects under `audit/cycles/2026-04-30/screenshots/step-c1/`.

**Log path:** `audit/cycles/2026-04-30/logs/step-c1.md`
