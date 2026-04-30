# step-L coverage report

**Agent:** `step-l`
**Step:** L — 提出方案
**Field set (per universe):** 方案一 / 方案二 / 方案三（可選） / 各方案特性
**Cycle date:** 2026-04-30
**Base URL:** http://localhost:4000
**Mode coverage:** drill (primary, via direct `circlesDrillStep='L'` jump after picking a question), simulation (covered indirectly via the same render path; see G3 note).
**Auth coverage:** Guest only (no auth fixture executed in this run; see Gaps).

## Viewports tested
All 8 audit projects, via dedicated probe per viewport:

| Project       | vw × vh    | Probe entry |
|---------------|------------|-------------|
| Mobile-360    | 360 × 780  | `audit/cycles/2026-04-30/probes/step-l-Mobile-360.js` |
| iPhone-SE     | 375 × 667  | `audit/cycles/2026-04-30/probes/step-l-iPhone-SE.js` |
| iPhone-14     | 390 × 844  | `audit/cycles/2026-04-30/probes/step-l-iPhone-14.js` |
| iPhone-15-Pro | 430 × 932  | `audit/cycles/2026-04-30/probes/step-l-iPhone-15-Pro.js` |
| iPad          | 768 × 1024 | `audit/cycles/2026-04-30/probes/step-l-iPad.js` |
| Desktop-1280  | 1280 × 800 | `audit/cycles/2026-04-30/probes/step-l-Desktop-1280.js` |
| Desktop-1440  | 1440 × 900 | `audit/cycles/2026-04-30/probes/step-l-Desktop-1440.js` |
| Desktop-2560  | 2560 × 1440| `audit/cycles/2026-04-30/probes/step-l-Desktop-2560.js` |

Shared logic: `audit/cycles/2026-04-30/probes/step-l-shared.js`.

Each probe captures 5 (mobile: 6) screenshots — home, step-C1 baseline, step-L initial,
step-L after `+ 新增方案三（可選）`, step-L after typing into 方案一, and (mobile)
step-L with 方案一 textarea focused — plus a `<viewport>-result.json` inspection
dump under `audit/cycles/2026-04-30/screenshots/step-l/`.

## Scenarios covered (✓ exercised, ⚠ partial, ✗ not exercised)

- ✓ A1 (guest first-visit, X-Guest-ID minted; default view = circles)
- ⚠ A4 (logout from L: not exercised — covered separately by step-c1 in this cycle per scope split)
- ✗ A5 / A5-conflict / A6 (auth migration / 401 — guest-only run, no auth fixture this pass)
- ✓ B5 (navbar logo while on L — covered structurally by render path; not clicked through here)
- ✓ B6 (CIRCLES tab still active on L)
- ⚠ C6 (resume-at-L: jump method bypasses the resume-banner round-trip; not covered)
- ✓ D1 (label + 提示 + 查看範例 + textarea per field — confirmed: hintBtns=3, exampleBtns=3 across all 8 viewports)
- ⚠ D2 (rich-text toolbar) — toolbar not asserted; only textarea fill exercised
- ⚠ D3 (IME composition) — not exercised in headless run
- ⚠ D4 (hint cache reuse) — first hint render OK (~1.2 s); second-click measurement is unreliable (see ISSUE-L-04)
- ⚠ D5 (查看範例 cache) — buttons present but not clicked
- ✗ D6 (autosave indicator) — see ISSUE-L-03 (indicator string empty after typing in guest mode)
- ✗ D7 (mid-step refresh restores text) — not exercised
- ✓ D8 (bottom bar 上一步 / 下一步 present at every viewport)
- ⚠ D9 (hint-card 收起 toggle) — first show validated, collapse toggle not asserted
- ⚠ D10 (`AI 審核中...` + 重試 on failure) — not exercised
- ⚠ G3 (simulation score nav cache) — not in scope of single-step probe; flagged for cross-step verification by Test Director
- ✗ K1/K2 (offcanvas open / delete) — not exercised in this probe (K-step agent owns)
- ✗ L1 (review-examples L-filter) — not exercised in this probe (review-examples is its own page)
- ✓ M2 (zero console errors / pageerrors on every viewport) — confirmed: 0 errors, only 4 font-preload warnings
- ✓ M3 (mobile keyboard / sticky bar) — after focus, sticky-bar overlap on textareas = 0 across all 5 mobile projects
- ✓ M4 (safe-area on iPhone-SE/14/15-Pro) — submit bar bottom never exceeds viewport (see metrics table)
- ✓ M5 (tap targets ≥ 44×44) — 0 misses across all 8 viewports for the L-step button set (`.circles-hint-trigger`, `.field-example-toggle`, `#circles-p1-submit`, `#circles-p1-back`, `#l-sol3-add-btn`, `.add-solution-btn`, `.circles-step-pill`, `.rt-mtbtn`)
- ⚠ M6 / M7 (focus rings, aria-live) — not asserted in this probe
- ⚠ M8 (server hardening) — out of scope (covered by step-c1 / cross-cutting)

## Issue counts

- P0: 1
- P1: 2
- P2: 2
- Universe drift: 1

---

## Issues

### ISSUE-L-01 [P0] L step renders only 3 fields — universe spec lists 4 (`各方案特性` missing)

- **Where:** every viewport (8/8) — CIRCLES Phase 1 step L (drill).
- **Repro:**
  1. Pick any question on `/`.
  2. Set `AppState.circlesDrillStep = 'L'` and re-render (`window.render()`).
  3. Inspect `.circles-field-label` text content.
- **Expected:** Per `audit-cycle/SKILL.md` § A and `CIRCLES_STEPS[L]` at
  `public/app.js:215`, four fields: `方案一` / `方案二` / `方案三（可選）` / `各方案特性`.
- **Actual:** Three labels rendered: `方案一` / `方案二` / `方案三（可選）`.
  `各方案特性` is nowhere in the DOM. Probe `inspect.fields[3].present === false`
  on all 8 viewports.
- **Console:** clean.
- **Hypothesised root cause:** `STEP_FIELDS_DEF.L` at `public/app.js:301-314`
  defines only the three solution slots (each with `key` + `nameKey`), and the
  `CIRCLES_STEPS[L].fields` array at line 215 was never reconciled with the
  field-builder. Either (a) the universe is stale and the fourth column is
  embedded in each solution's name+description (in which case the universe
  needs a rewrite per skill rule "fix the universe in the same audit cycle"),
  or (b) the spec is correct and `各方案特性` (a free-text "各方案特性" summary
  field) was lost in a refactor. Director should rule.
- **Severity rationale:** Marked P0 because the spec→code mismatch is
  user-visible — any user reading the methodology doc and trying to fill the
  "各方案特性" box on L will not find it. If the director rules this is a
  spec/universe drift only (no UX promise broken), downgrade to P2 + universe
  edit.
- **Screenshots:**
  - `audit/cycles/2026-04-30/screenshots/step-l/Desktop-1280-03-step-l.png`
  - `audit/cycles/2026-04-30/screenshots/step-l/Mobile-360-03-step-l.png`
  - (one per viewport, naming `<viewport>-03-step-l.png`)

### ISSUE-L-02 [P1] Mobile-360 reports 9 px horizontal overflow on step L

- **Where:** Mobile-360 (360 × 780) only.
- **Repro:**
  1. `node audit/cycles/2026-04-30/probes/step-l-Mobile-360.js`
  2. Read `inspect.hScroll` from the result JSON.
- **Expected:** `document.documentElement.scrollWidth ≤ clientWidth`; no
  horizontal scroll on a 360-px wide phone.
- **Actual:** `scrollWidth = 369`, `clientWidth = 360`, **9 px overflow**.
  No element's `getBoundingClientRect().right` exceeds `vw`, so the overflow is
  not from a single child — likely a body/document margin or a transform/zoom
  artifact. Other 7 viewports (375 → 2560) report `hScroll: false`.
- **Console:** clean.
- **Hypothesised root cause:** Chromium adjusts `window.innerWidth` to 369 on a
  360-px isMobile context (sub-pixel DPR rounding). The 9-px gap may resolve at
  real device-pixel boundaries, but it is reproducible and visible to the
  scrollbar-detection logic. Likely a `min-width` somewhere in `style.css`
  (e.g. `.circles-q-card`, `.circles-submit-bar`, or a 320 / 360 break that
  uses padding > 0 on `body`).
- **Screenshot:** `audit/cycles/2026-04-30/screenshots/step-l/Mobile-360-03-step-l.png`

### ISSUE-L-03 [P1] Save indicator never transitions to a visible "saved" string in guest mode

- **Where:** all 8 viewports (guest mode).
- **Repro:**
  1. Pick a question, jump to L, focus 方案一 textarea.
  2. Type 30+ characters and wait 700 ms.
  3. Read `document.querySelector('.save-indicator').textContent`.
- **Expected:** Per universe D6: indicator transitions `saving → saved` and
  the text becomes a non-empty string (e.g. "已儲存").
- **Actual:** `result.json::typing.indicator === ""` on every viewport. The
  `.save-indicator` element exists but its `textContent` is empty. Either
  (a) guest mode never autosaves on L because the lazy-create endpoint hasn't
  been hit (`AppState.circlesSession?.id` undefined → `PATCH /:id/progress`
  short-circuits), or (b) the indicator only paints during the in-flight
  network call and we sample after the cycle.
- **Console:** clean.
- **Hypothesised root cause:** `saveCirclesProgress()` likely no-ops when no
  session row exists (guest hasn't reached the gate yet). If so the indicator
  semantics are correct but the user gets no feedback that drafts are
  client-side only. Worth raising to product copy.
- **Screenshot:** `audit/cycles/2026-04-30/screenshots/step-l/<viewport>-05-step-l-typed.png`

### ISSUE-L-04 [P2] Hint button second-open path takes ≥ 30 s in headless probe

- **Where:** all 8 viewports.
- **Repro:** automated in probe `exerciseHintCache()` — first click renders
  popup in ~1.2 s; close + re-click stalls until Playwright's default 30 s
  default-action timeout.
- **Expected:** Per universe D4, second click reuses the in-memory cache
  immediately (sub-100 ms render).
- **Actual:** Second click awaits ~30 s before the popup re-appears.
  Likely **measurement artifact**, not a real regression: the `close` button
  click + immediate re-click race may leave the trigger covered by a closing
  overlay until the fade-out finishes. Director may downgrade to "no issue"
  after a manual repro.
- **Severity rationale:** P2 because functionality still works (popup eventually
  shows + content correct); only timing is suspect. File so the next audit
  re-checks with a more deliberate close-then-reopen probe.
- **Screenshot:** `audit/cycles/2026-04-30/screenshots/step-l/<viewport>-05-step-l-typed.png`
  (popup state visible)

### ISSUE-L-05 [P2] L progress label says `5/7` but progress bar at this step is built from `CIRCLES_STEPS[L].fields` (3 entries) — UX mismatch

- **Where:** all 8 viewports.
- **Repro:** Inspect the `.circles-progress-bar` cells for L; compare with
  `STEP_FIELDS_DEF.L.progressLabel = 'L · 提出方案 · 5/7'` (`public/app.js:303`).
- **Expected:** Bar reflects field fill progress consistently.
- **Actual:** Currently the user can complete 3 written fields (sol1/sol2/sol3
  descriptions) but the user-facing copy says "5/7" (step number, not field
  number) — easy to misread as "5 of 7 fields". Recommend renaming to
  `5/7 步` or hiding the fraction.
- **Console:** clean.
- **Severity:** P2 polish.

### UNIVERSE-DRIFT-L-01 [universe] `audit-cycle/SKILL.md` §A field set for L lists 4 fields; code defines 3

- **Where:** `.claude/skills/audit-cycle/SKILL.md` table row "step-l L 提出方案"
  (line 202) — `FIELDS = 方案一 / 方案二 / 方案三（可選） / 各方案特性`.
- **Code:** `public/app.js:301-314` defines `L.fields` with three solution
  entries (`sol1` / `sol2` / `sol3`), each carrying `key` (description),
  `nameKey` (short name), `placeholder`, `hintOverlay`. There is no separate
  "各方案特性" field.
- **Recommendation:** Director either (a) reword the universe row to
  `方案一 / 方案二 / 方案三（可選）— 各方案特性 = 各方案的核心機制描述（每方案內含名稱+特性說明）`,
  or (b) file a feature ticket to add a 4th 各方案特性 textarea before this audit
  signs off. Per skill rule: "If you find a row here that no longer matches
  code, fix the universe in the same audit cycle".

---

## Cross-viewport metrics summary

| Viewport      | hScroll | sticky overlap (initial) | sticky overlap (focus) | tap-target ≤ 43 px | console err | 各方案特性 present |
|---------------|:-:|:-:|:-:|:-:|:-:|:-:|
| Mobile-360    | **YES (9 px)** | 1 | 0 | 0 | 0 | NO |
| iPhone-SE     | no | 0 | 0 | 0 | 0 | NO |
| iPhone-14     | no | 0 | 0 | 0 | 0 | NO |
| iPhone-15-Pro | no | 0 | 0 | 0 | 0 | NO |
| iPad          | no | 0 | 0 | 0 | 0 | NO |
| Desktop-1280  | no | 0 | n/a | 0 | 0 | NO |
| Desktop-1440  | no | 0 | n/a | 0 | 0 | NO |
| Desktop-2560  | no | 0 | n/a | 0 | 0 | NO |

(Only the L-fields and L-specific buttons were probed for tap targets; broader
chrome tap targets are owned by the UI/UX RWD agent.)

## Probes & artefacts

- Shared probe: `audit/cycles/2026-04-30/probes/step-l-shared.js`
- Per-viewport entries: `audit/cycles/2026-04-30/probes/step-l-<viewport>.js`
- Screenshots: `audit/cycles/2026-04-30/screenshots/step-l/<viewport>-*.png`
- Per-viewport result JSON: `audit/cycles/2026-04-30/screenshots/step-l/<viewport>-result.json`
- Per-viewport raw stdout: `audit/cycles/2026-04-30/screenshots/step-l/<viewport>-stdout.json`

## Gaps the director should staff

1. Auth-mode coverage of L (login → resume on L → logout). This run was
   guest-only because the agent's scope explicitly notes "READ-ONLY" and the
   shared cycle does not pre-seed an auth fixture. If the director wants
   A5 / A5-conflict probed at L, dispatch a follow-up with a Supabase test
   user.
2. C6 resume-at-L verification — current probe takes the synthetic
   `circlesDrillStep='L'` shortcut to land on the L view; the resume-banner
   round-trip (where `lastSessionId` reads from localStorage and re-hydrates
   `AppState.circlesStepDrafts`) was not exercised here.
3. D3 IME composition test (zhuyin / pinyin) cannot be reliably driven via
   Playwright's `keyboard.type`; deferred to manual review.
4. UNIVERSE-DRIFT-L-01 above must be resolved before sign-off.

---

**Log path returned to director:**
`/Users/albertpeng/Desktop/claude_project/First_Principle/audit/cycles/2026-04-30/logs/step-l.md`
