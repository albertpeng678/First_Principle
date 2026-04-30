# Audit Cycle — 2026-04-30 — Master Issue Board

## Summary
- Source agents: 10 (8 step coverage + 2 UI/UX auditors)
- Raw findings ingested: ~50 issues across logs
- Deduped MASTER entries: 24
- **Counts: P0:7 / P1:13 / P2:4**
- Test director: main thread
- Status: OPEN
- Baseline Playwright (pre-fix): 434 passed / 0 failed / 292 skipped (from journeys/audit/, 16.6 m)
- Single regression observed: `AUD-026 [P1] offcanvas empty skeleton` on iPhone-14 (intermittent — see MASTER-019)

## Universe drifts to reconcile in this cycle (per skill mandate)
- **DRIFT-01** — `audit-cycle/SKILL.md` step-L universe row lists 4 fields. **Confirmed drift**: `各方案特性` is per-solution data captured at step E (4 sub-fields), not a separate L field. CIRCLES_STEP_CONFIG.L has 3 solution fields by design. → **Fix universe doc; close MASTER-007.**
- **DRIFT-02** — Universe G1 says "radar chart (`renderRadar`) renders" but Phase-3 step-score code emits `circles-dim-row` bars by design. → **Amend universe; close MASTER-018.**
- **DRIFT-03** — Universe row J2 mislabels NSM Step 2 as "3 textareas" — actual is 1 input + 2 textareas. Doc-only.
- **DRIFT-04** — Universe step-E field label `方案優點/方案缺點…` should be `優點/缺點…` (the "方案" prefix is the section title in code). Doc-only.

---

## Issues (sorted P0 → P2)

### MASTER-001 [P0] 查看範例 inline expansion broken on EVERY CIRCLES Phase-1 step
- **Source:** ISSUE-C2-01 (also implicitly hits step-c1, step-i, step-r, step-c2, step-l, step-e, step-s — all share the same handler)
- **Affected viewports:** all 8
- **Root cause:** `public/app.js:2967` handler reads `btn.nextElementSibling`, but the 2026-04-30 redesign inserted `.circles-field-affordance-spacer` between `.field-example-toggle` and `.field-example-body`. Handler bails silently.
- **Suggested fix:** `btn.closest('.circles-field-group').querySelector('.field-example-body')`.
- **Re-verifier:** step-c2 (original filer); plus smoke check from step-c1, step-i, step-r, step-l, step-e, step-s after fix.
- **Status:** open

### MASTER-002 [P0] iPhone-SE expanded question card pushes sticky 確認 button below fold (~9 px)
- **Source:** ISSUE-C1-02
- **Affected viewports:** iPhone-SE (375×667)
- **Suggested fix:** cap `.circles-q-card-full-block` height + internal scroll, or `position: sticky; bottom: 0` on the action row inside the card.
- **Re-verifier:** step-c1
- **Status:** open

### MASTER-003 [P0] Phase-2 conclusion-expanded action row falls below viewport
- **Source:** ISSUE-R-01
- **Affected viewports:** Desktop-1280 (vh=800, 14.4 px below fold), iPhone-SE (96.8 px below)
- **Notes:** `.circles-conclusion-box` is not actually sticky — claim contradicts AUD-061. Box height grows with conclusion content; sticky action row is required.
- **Re-verifier:** step-r
- **Status:** open

### MASTER-004 [P0] Phase-4 final report — per-letter CIRCLES radar not rendered
- **Source:** ISSUE-S-01
- **Affected viewports:** all 8
- **Root cause:** `renderCirclesFinalReport` (public/app.js:4060-4139) emits no SVG/canvas. Universe H2 broken.
- **Re-verifier:** step-s
- **Status:** open

### MASTER-005 [P0] Phase-4 final report — NSM 4-dim tracking-block missing
- **Source:** ISSUE-S-02
- **Affected viewports:** all 8
- **Root cause:** `circlesFrameworkDraft.tracking` data captured at step S but never surfaced in final report.
- **Re-verifier:** step-s
- **Status:** open

### MASTER-006 [P0] Mobile-360 horizontal overflow on multiple CIRCLES steps
- **Source:** ISSUE-C2-02 + ISSUE-L-02 + ISSUE-S-06 (de-duped — same root)
- **Affected viewports:** Mobile-360 (scrollWidth=369 vs clientWidth=360)
- **Offenders:** `.btn.btn-ghost`, `.offcanvas-overlay`, `.circles-submit-bar`
- **Re-verifier:** step-c2 (driver) + step-l + step-s smoke
- **Status:** open

### MASTER-007 [DOC] Step L universe drift — `各方案特性` is captured at step E, not L
- **Source:** ISSUE-L-01 + DRIFT-01
- **Resolution:** confirmed via code reading — `CIRCLES_STEP_CONFIG.L.fields` = 3 solution fields by design. The per-solution characteristics (優點/缺點/風險與依賴/成功指標) are E step. Universe row at `.claude/skills/audit-cycle/SKILL.md` will be updated.
- **Status:** triage closed → universe-doc fix only, no code change. Folded into MASTER-018 / DRIFT batch.

### MASTER-008 [P1] Mobile tap targets <44 px across multiple primary/secondary buttons
- **Source:** ISSUE-C1-01, ISSUE-R-02, ISSUE-R-03, ISSUE-I-01, ISSUE-C2-03, ISSUE-E-01, AES tap cluster, RWD Group 1+2 (de-duped)
- **Affected viewports:** Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad
- **Buttons (consolidated):** `.circles-q-confirm-btn` (36 px), `.circles-q-cancel-btn` (36 px), `繼續對話` (14 px), `回首頁` (60×40), `什麼是 CIRCLES…` disclosure (42 px), `.circles-q-random-btn` (74×40), `.nsm-banner-btn` (92×40), `登入` (38 px), `建立帳號`, `忘記密碼？`, `開始 NSM 訓練` (36 px), `全展開` / `全收起` on review-examples, `確認提交`
- **Suggested fix:** single design pass — define a `--btn-touch-min: 44px` token, apply `min-height` + min tap area uniformly to `.btn`, `.btn-ghost`, `.circles-q-*-btn`, `.nsm-banner-btn`, `.circles-nav-home`, `.conclusion-back-btn`. UI/UX brainstorming + visual companion required (mockup before code).
- **Re-verifier:** step-c1 + step-r + uiux-rwd
- **Status:** open

### MASTER-009 [P1] Sticky 下一步 bottom bar overlaps mid-form fields on step I (and likely peers)
- **Source:** ISSUE-I-02
- **Affected viewports:** mobile (touch)
- **Root cause:** `position: fixed` bottom bar + missing form-bottom padding equal to bar height.
- **Re-verifier:** step-i (smoke step-r/step-c2 too)
- **Status:** open

### MASTER-010 [P1] `.rt-mtbtn` mobile sticky rich-text toolbar buttons render with 0×0 hit area
- **Source:** ISSUE-I-04
- **Affected viewports:** all touch viewports
- **Re-verifier:** step-i
- **Status:** open

### MASTER-011 [P1] Mid-step refresh does not restore typed text in guest mode (silent draft loss)
- **Source:** ISSUE-I-05 + ISSUE-L-03 (`.save-indicator` stays empty after typing in guest)
- **Note:** `[circles auto-save] failed: Failed to fetch` is swallowed. Per universe A6 mandate, silent draft loss = P1.
- **Re-verifier:** step-i + step-l
- **Status:** open

### MASTER-012 [P1] Step I drill mode missing `上一步` button (D8 violation)
- **Source:** ISSUE-I-06
- **Affected viewports:** all 8
- **Re-verifier:** step-i
- **Status:** open

### MASTER-013 [P1] WCAG AA contrast failures
- **Source:** AES P1
- **Offenders:**
  - `.circles-step-meta` chip — 1.27:1
  - Phase-1 step pill labels — 3.48:1
  - All `--c-text-3` body uses — 3.97:1
- **Re-verifier:** uiux-aesthetics
- **Status:** open

### MASTER-014 [P1] Focus-visible rings missing on interactive cards/tabs
- **Source:** AES P1
- **Affected:** `.circles-q-card`, `.circles-mode-card`, type tabs, navbar tabs, offcanvas + history items
- **Re-verifier:** uiux-aesthetics
- **Status:** open

### MASTER-015 [P1] NSM step 4 — `#btn-nsm-home-nav` missing (J8 violation)
- **Source:** ISSUE-NSM-01
- **Affected viewports:** all 8 on Step 4 + gate sub-tab
- **Re-verifier:** step-nsm
- **Status:** open

### MASTER-016 [P1] NSM `重新定義 NSM` handler does not reset breakdown/gate/hints state
- **Source:** ISSUE-NSM-02
- **Note:** Button only renders behind dead `nsmVanityWarning` state.
- **Re-verifier:** step-nsm
- **Status:** open

### MASTER-017 [P2] NSM step-4 radar — probe drift (radar IS rendered as SVG, not canvas)
- **Source:** ISSUE-NSM-03
- **Resolution:** `public/app.js:5875` calls `renderNSMRadar(scores.scores)` and injects SVG into `.nsm-radar-wrap`. The probe was looking for `<canvas>` and failed. No code defect.
- **Status:** triage closed — downgraded to P2 probe-drift, no fix needed.

### MASTER-018 [DOC] Phase-3 step score — universe drift on G1 (bars by design)
- **Source:** ISSUE-S-04 + DRIFT-02
- **Resolution:** Phase-3 step score uses `circles-dim-row` bars by design; radar is reserved for Phase-4 final report (MASTER-004). Universe row G1 will be reworded to "score breakdown card with `circles-dim-row` bars".
- **Status:** triage closed — universe-doc fix only, no code change.

### MASTER-019 [P1] Phase-4 S-1 摘要 / S-2 追蹤指標 sub-tabs gated on `_isDesktopP1` — invisible on mobile
- **Source:** ISSUE-S-05
- **Affected viewports:** Mobile-360 / iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad
- **Universe H4 violated.**
- **Re-verifier:** step-s
- **Status:** open

### MASTER-020 [P1] Phase-4 PNG export `#btn-export-png` missing from CIRCLES submit-bar
- **Source:** ISSUE-S-03
- **Note:** Only legacy `renderReport` had the button; CIRCLES Phase-4 has only `circles-final-again` + `circles-final-home`. Universe H5 unimplementable.
- **Re-verifier:** step-s
- **Status:** open

### MASTER-021 [P1] Offcanvas intermittent empty-skeleton render
- **Source:** AUD-026 Playwright failure on iPhone-14 + ISSUE-NSM-05 (intermittent on iPhone-14 / Desktop-2560) + ISSUE-I-08 (Mobile-360 stuck on 3 skeletons)
- **Root cause:** race vs list fetch.
- **Re-verifier:** step-nsm + step-i + main suite
- **Status:** open

### MASTER-022 [P2] Typography font-family fragmentation
- **Source:** AES P2
- **Offenders:** 9 distinct font-family strings active (3 different DM Sans fallbacks + leaked `Arial` / `Times`)
- **Re-verifier:** uiux-aesthetics
- **Status:** open

### MASTER-023 [P2] Inline-style hard-coded hex usages where `--c-*` tokens exist
- **Source:** AES P2 (10 instances)
- **Re-verifier:** uiux-aesthetics
- **Status:** open

### MASTER-024 [P2] Misc layout polish
- **Source:** ISSUE-L-05 (progress label "5/7" reads ambiguously), ISSUE-NSM-04 (Step 4 wrapper not widened on Desktop-2560), ISSUE-I-03 (desktop home missing `data-step="I"` pill), ISSUE-I-07 (D9 hint copy not on step I), ISSUE-E-02 (iPhone-SE step-E above-fold field count = 0), `.conclusion-back-btn` 53×14 collapse, login `忘記密碼？` weak hierarchy, meta-strip orphan wrap on Mobile-360
- **Re-verifier:** original filers
- **Status:** open

---

## Coverage gaps (deferred — director's call to fix this cycle or next)
- A3 wrong-credential UX (login)
- A5 / A5-conflict end-to-end migration with real auth fixture
- A6 401-interceptor draft-loss path (partially observed via I-05 silent loss)
- C7 boot resume `confirm('繼續上次的練習？')`
- D3 IME 組字 needs manual review

---

## Cluster fix order (proposed)
1. **MASTER-001** (single-line handler fix; unblocks 7 step probes)
2. **MASTER-006** (Mobile-360 horizontal overflow, single root cause)
3. **MASTER-008** (one design pass on tap-target tokens — UI/UX brainstorming required)
4. **MASTER-013** + **MASTER-014** (contrast + focus rings — UI/UX brainstorming required)
5. **MASTER-002 / MASTER-003 / MASTER-019** (sticky / fold layout — UI/UX brainstorming)
6. **MASTER-004 / MASTER-005 / MASTER-020** (Phase-4 final report rebuild — UI/UX brainstorming + writing-plans)
7. **MASTER-007 / MASTER-017 / MASTER-018** (triage decisions before fix)
8. **MASTER-009 / MASTER-010 / MASTER-011 / MASTER-012** (form/IO bugs — writing-plans, no design)
9. **MASTER-015 / MASTER-016 / MASTER-021** (NSM polish + offcanvas race)
10. **P2 batch** (MASTER-022 / 023 / 024)
