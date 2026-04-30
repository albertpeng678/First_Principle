# step-c2 coverage report — C2 (優先排序)

**Audit cycle:** 2026-04-30
**Agent:** `step-c2`
**Step under test:** C2 — 優先排序 (取捨標準 / 最優先項目 / 暫緩項目 / 排序理由)
**Mode:** simulation only — *drill mode does NOT expose C2* (`public/app.js:1971-1984` — drill pills only render C1/I/R, with copy `C2、L、E、S 需在完整模擬中練習`).
**Baseline commit:** `b7fdb28`
**Probe:** `audit/cycles/2026-04-30/probes/step-c2-probe.js`
**Findings JSON (per viewport):** `audit/cycles/2026-04-30/screenshots/step-c2/<viewport>-findings.json`
**Screenshots:** `audit/cycles/2026-04-30/screenshots/step-c2/<viewport>-{01-home,02-c2-phase1,03-c2-hint-open,04-c2-example-open,05-c2-textarea-focused}.png`

## Viewports tested

All 8 audit projects:
Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Desktop-1280 / Desktop-1440 / Desktop-2560.

## Probe summary table

| VP             | OK | H-scroll | fields visible | small-tap (<44) | console errs | hint cardW | 查看範例 inline opens? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile-360     | Y  | **YES (369 vs 360)** | 4 | 1 (回首頁 60×40) | 0 | 321 | NO |
| iPhone-SE      | Y  | no | 4 | 1 (回首頁 60×40) | 0 | 327 | NO |
| iPhone-14      | Y  | no | 4 | 1 (回首頁 60×40) | 0 | 342 | NO |
| iPhone-15-Pro  | Y  | no | 4 | 1 (回首頁 60×40) | 0 | 360 | NO |
| iPad           | Y  | no | 4 | 1 (回首頁 60×40) | 0 | 360 | NO |
| Desktop-1280   | Y  | no | 4 | 12 (rt-tbtn 26×21, nav 36h) | 0 | 360 | NO |
| Desktop-1440   | Y  | no | 4 | 12 | 0 | 360 | NO |
| Desktop-2560   | Y  | no | 4 | 12 | 0 | 360 | NO |

## Scenario coverage checklist (C2 lens)

- [x] **A1** guest first-visit → C2 reachable via simulation: confirmed (probe drives home → simulation → step index 3 = C2 with synthesized session id)
- [x] **A4** logout from C2: not exercised in probe (auth path) — see *Coverage gap 1*
- [x] **A5 / A5-conflict** C1 owns; C2 only spot-checks resume of a C2 draft post-migration — see *Coverage gap 1*
- [x] **A6** mid-call 401 silent loss on C2 autosave — not exercised (no instrumented 401 path; pre-existing universe note)
- [x] **B5** navbar logo from C2 returns to home (verified via existing AUD-000-A6 test on Step C / passes)
- [x] **B6** navbar tabs (CIRCLES / 北極星指標) — not C2-specific; covered by step-nsm
- [x] **C2 (universe row)** = picker question-type tabs — confirmed live counts render on home screenshots
- [x] **C6** resume banner: probe verified the resume slot renders empty (guest, no prior session); cross-device parity covered by C1 agent. **Note**: a session paused at C2 is mode='simulation', sim_step_index=3 — but the recent-card label uses `'Step ' + (sim_step_index+1) + '/7'` (line 1994), which is correct.
- [x] **D1** label / 提示 / 查看範例 / textarea render: 4 fields × 8 viewports all render the expected labels (取捨標準 / 最優先項目 / 暫緩項目 / 排序理由). Hint and example buttons present (4 each).
- [x] **D2** rich-text toolbar: present on every viewport (`.rt-tbtn`). Mobile sticky `.rt-toolbar-mobile` is element-present but width=0 / height=0 until a textarea is focused (by design — element only sizes on focus).
- [x] **D3** IME 組字: probed via typing into focused textarea (no synthetic compositionstart, but no console error and no commit observed); requires manual zhuyin verification. Filed as P2 (verification gap).
- [x] **D4** hint API: clicking 提示 on first C2 field opens the overlay successfully on every viewport (`hintOverlay.visible = true`, has `#hint-close-btn`, cardW range 321-360). API endpoint `/api/circles-public/hint` confirmed reachable (no console errors).
- [x] **D5** 查看範例 inline expansion: **BROKEN — see ISSUE-C2-01 (P0).**
- [x] **D6** autosave saving→saved indicator: not directly captured in probe; visible in screenshots but no programmatic transition assertion. Filed as P2 (probe gap).
- [x] **D7** mid-step refresh restoring text: not exercised (would require real session id).
- [x] **D8** 下一步 / 上一步 + progress bar: progress text reads `C · 優先排序 · 4/7` on every viewport (correct).
- [x] **D9** hint card 查看 ↔ 收起 toggle: hint **overlay** is modal (not inline collapse) — universe row D9 says "card", but C2 implementation uses an overlay modal. No regression — but the universe wording could mislead future agents. Filed as P2 doc inconsistency.
- [x] **D10** loading + retry: not triggered (no fault injection). C1 agent owns gate retry.
- [x] **G3** simulation score nav ◀ ▶ for C2: not exercised in probe (would require completing Phase 3 evaluate-step). C1/I/R/S agents likely cover the cache; flagged as gap for step-c2.
- [x] **K1 / K2** offcanvas open/load/delete with a C2-paused session: not exercised by probe (guest, no rows). Cross-step coverage handled by step-c1 agent.
- [x] **L1** review-examples C2 filter: not exercised — owned by L1 universe row, separate page. Director should ensure step-c2 agent runs the filter for `C2` (`步驟篩選` select). Filed as *Coverage gap 2*.
- [x] **M1** network envelope `{error:'invalid_json'}`: cross-cutting; not C2-specific.
- [x] **M2** zero console errors: confirmed on every viewport (only Google Fonts preload warnings — non-critical).
- [x] **M3** mobile keyboard: focused textarea screenshot shows sticky toolbar in viewport (focusMetrics: top=0, height=0 → toolbar not yet sized — see note on D2).
- [x] **M4** safe-area-inset bottom: visible on iPhone-SE / 14 / 15-Pro screenshots — no obvious cropping.
- [x] **M5** tap targets ≥44×44: 提示 + 查看範例 both 82×44 (PASS). 回首頁 fails on every touch viewport (60×40, 4px below). On desktop, 12 buttons under 44px (rich-text toolbar `.rt-tbtn` 26×21 / 31×21, nav `PM Drill` 111×36) — desktop is non-touch so AUD-020 doesn't catch it.
- [x] **M6** focus rings + tab order: not programmatically asserted. Probed visually OK in screenshots.
- [x] **M7** aria-live: hint overlay loader exists (line 3201). Save indicator + shuffle counter live elsewhere; not C2-specific.
- [x] **M8** server hardening: cross-cutting; not C2-specific.

## Issues found

**Severity totals: P0 × 2, P1 × 1, P2 × 4 (probe / coverage gaps), 0 console errors.**

---

### ISSUE-C2-01 [P0] 查看範例 inline expansion is broken on every CIRCLES Phase 1 step (C1/I/R/C2/L/E/S)

- **Where:** All viewports. CIRCLES Phase 1 → any step → click *查看範例* under any field. Probe-confirmed on C2 + C1.
- **Repro:**
  1. Open `/?onboarding=0`, choose *完整模擬*, pick any 產品設計 question.
  2. (Or, in DevTools, set `AppState.circlesSimStep = 3` to land on C2.)
  3. Phase 1 form renders with 4 fields, each with 提示 + 查看範例.
  4. Click *查看範例* on any field.
- **Expected:** The button text flips to *收起範例*; the inline `.field-example-body` block expands beneath the field with the curated example loaded from `/api/circles-public/example`.
- **Actual:** Click is a silent no-op. Button text does not change. No `.field-example-body` element gains the `.open` class. Console: clean.
- **Hypothesised root cause (high confidence):** `public/app.js:2965-2968`:
  ```js
  document.querySelectorAll('.field-example-toggle').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var body = btn.nextElementSibling;
      if (!body || !body.classList.contains('field-example-body')) return; // ← bails here
  ```
  The 2026-04-30 redesign comment at line 2490 split toggle and body (`buildFieldExampleToggleHtml` at 2493 + `buildFieldExampleBodyHtml` at 2500). `buildFieldGroupHtml` (line 2525-2545) puts the toggle inside a `.circles-field-affordances` row alongside `.circles-field-affordance-spacer` + 提示 trigger, while `.field-example-body` is rendered as a SIBLING of `.circles-field-affordances`, NOT as a sibling of the toggle button. So `btn.nextElementSibling` is the spacer span, classList check fails, handler returns. **The example body element exists in the DOM but is never opened.**

  Probe data (Mobile-360):
  ```json
  {"text":"查看範例","hasNextSibling":true,"nextSiblingClass":"circles-field-affordance-spacer"}
  ```
  After click: `field-example-body.open` count = 0; `收起範例` toggle count = 0.

- **Suggested fix shape (NOT applied — director decides):** Replace `var body = btn.nextElementSibling;` with a lookup that reaches outside the affordance row, e.g.
  ```js
  var fieldGroup = btn.closest('.circles-field-group');
  var body = fieldGroup ? fieldGroup.querySelector('.field-example-body') : null;
  ```
  Verify on all 7 steps + any L-step solution variant (`buildSolutionFieldHtml` at line 2550 — separate code path, may also need the same fix).
- **Cross-impact:** Breaks universe row **D5** for **every step agent** (C1/I/R/C2/L/E/S). Director should hand this single bug to one fix agent and re-verify with all step agents. Hint overlay (D4) is a separate code path and works fine.
- **Screenshots:** `screenshots/step-c2/Mobile-360-04-c2-example-open.png` (button text unchanged), all 8 `*-04-c2-example-open.png` show the same.

---

### ISSUE-C2-02 [P0] Mobile-360 horizontal scroll on C2 phase 1 (9 px overflow)

- **Where:** Mobile-360 only. CIRCLES Phase 1 → C2.
- **Repro:** Open in Mobile-360 viewport (360×780), navigate to C2 phase 1 form.
- **Expected:** `documentElement.scrollWidth === clientWidth` (no horizontal scroll).
- **Actual:** `scrollWidth = 369, clientWidth = 360` → **9 px horizontal scroll** on Mobile-360 only. Other phones (iPhone-SE 375 / iPhone-14 390 / iPhone-15-Pro 430 / iPad 768) all pass.
- **Hypothesised root cause:** Probe layout dump shows `.btn.btn-ghost` at left=325 / right=369 / w=44, AND `.offcanvas-overlay` at width=369 (overlay is hidden but not collapsed; element bounding box still extends 9 px past viewport because offcanvas sliding panel `.offcanvas` sits at left=−280). The offcanvas drawer / overlay base width math appears to use `100% + scrollbar_compensation` somewhere in style.css, only triggering at the narrowest 360 px breakpoint. The `.btn.btn-ghost` overflow (likely the navbar hamburger) is a separate suspect; both should be inspected.
- **Probe data:** `screenshots/step-c2/Mobile-360-findings.json` → `layout.overflowCulprits`.
- **Suggested next step:** Run `Mobile-360-02-c2-phase1.png` overlaid against a 360 px viewport ruler; inspect `.offcanvas-overlay`, `.offcanvas`, and `.btn-ghost` widths in computed style at 360 px.
- **Screenshot:** `screenshots/step-c2/Mobile-360-02-c2-phase1.png`.

---

### ISSUE-C2-03 [P1] 回首頁 navbar button is 60×40 — height 4 px below 44 px tap target on every touch viewport

- **Where:** Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad — every touch device — on C2 phase 1 (probably global navbar).
- **Repro:** Open C2 phase 1 in any touch viewport. Locate navbar `回首頁` button.
- **Expected:** ≥ 44×44 logical px (per AUD-022 / WCAG 2.5.5 spirit).
- **Actual:** 60 × **40** — width OK, height 4 px short.
- **Hypothesised root cause:** Navbar height capped to `36-40 px` in style.css for mobile; padding does not push the button up to 44.
- **Cross-impact:** Affects every CIRCLES route + NSM route (global navbar) — not C2-specific, but caught here.
- **Note:** AUD-022 (top-nav buttons ≥ 44×44) is filtered to iPhone-SE + iPhone-15-Pro. If AUD-022 currently passes, the test may be measuring the wrong button (e.g. the hamburger icon), not 回首頁. Suggest director verify.
- **Screenshot:** `screenshots/step-c2/iPhone-SE-02-c2-phase1.png`.

---

### ISSUE-C2-04 [P2] Probe coverage gap — IME composition not synthetically reproduced

- **Where:** All viewports. C2 textarea IME 組字 path.
- **Detail:** The probe types ASCII via `page.keyboard.type` after focusing the textarea, which does not exercise the `compositionstart` / `compositionend` listener (universe row D3). To verify zhuyin / pinyin partial-commit safety, a future probe should fire `dispatchEvent(new CompositionEvent('compositionstart'))` followed by character-by-character mocked composition.
- **Suggested:** Add a dedicated IME probe in cycle 2026-05-X with `_rtComposing` assertion before/after each step.

---

### ISSUE-C2-05 [P2] Probe coverage gap — autosave indicator transition not asserted

- **Where:** All viewports. C2 phase 1 textarea input.
- **Detail:** `.save-indicator` saving → saved transition (universe D6) is visually present in screenshots but the probe does not poll for the aria-live announcement. Future probe should attach a MutationObserver on `.save-indicator` and capture both states.

---

### ISSUE-C2-06 [P2] Probe coverage gap — review-examples C2 step filter not exercised

- **Where:** `/review-examples.html` → step filter `C2 優先排序`.
- **Detail:** Universe row L1 calls for the standalone page's `#filter-step` to filter to C2. Step-c2 probe does not hit this surface. Recommend a follow-up probe `step-c2-review-examples.js` that selects the C2 filter, asserts `#search-results .review-card` count > 0, and snapshots zero JS errors.

---

### ISSUE-C2-07 [P2] Doc / wording inconsistency — universe D9 says "hint card" but C2 implementation is overlay modal

- **Where:** `.claude/skills/audit-cycle/SKILL.md` row D9 ("Hint card toggle: collapsed shows `查看教練提示`; expanded shows `收起提示`").
- **Detail:** On Phase 1 C2 (and other steps), the 提示 button opens a full-screen overlay (`#circles-hint-overlay`, line 3190+) with a close (×) button — not an inline expand/collapse card. The universe wording would mislead a fresh agent. Director should reconcile in the next universe pass.

---

## Coverage gaps the director should re-dispatch

1. **Auth-mode + migration on C2** — step-c1 owns A2/A3/A5/A5-conflict in detail; step-c2 should still receive a focused re-run that creates a guest C2 draft, signs in, and asserts the C2 row migrated to `circles_sessions` with `user_id` set, `guest_id=null`, `drill_step='C2'`. Probe did not exercise this.
2. **review-examples filter on C2** — see ISSUE-C2-06.
3. **G3 score nav ◀ ▶** through a C2 score after evaluate-step — requires an LLM call, deferred to integration cycle.

## Status hand-off

- **Returned to director.** Recommend the `field-example-body` lookup (ISSUE-C2-01) be triaged immediately as it is a cross-step P0 affecting C1/I/R/C2/L/E/S — fix it once, re-verify in step-c1, step-i, step-r, step-c2, step-l, step-e, step-s.
- **Log path:** `audit/cycles/2026-04-30/logs/step-c2.md`
- **All probes + raw findings:** `audit/cycles/2026-04-30/probes/step-c2-probe.js` + `audit/cycles/2026-04-30/screenshots/step-c2/*-findings.json`
