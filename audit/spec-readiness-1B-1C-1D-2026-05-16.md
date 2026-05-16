# Spec Readiness Review — Stage 1B / 1C / 1D

**Date:** 2026-05-16
**Reviewer:** spec-readiness audit (read-only)
**Specs reviewed:**
- 1B `docs/superpowers/specs/2026-05-16-stage-1b-state-cache-design.md` (commit `2c6fa51`)
- 1C `docs/superpowers/specs/2026-05-16-stage-1c-phase2-ui-fix-design.md` (commit `8ca4b81`)
- 1D `docs/superpowers/specs/2026-05-16-stage-1d-hint-cluster-design.md` (commit `93d2695`)

Cross-reference baselines:
- Stage 1A spec (already shipped): `docs/superpowers/specs/2026-05-16-stage-1a-gate-cluster-design.md`
- `public/app.js` regions inspected: 1771–1820 (NSM toggles), 1990–2070 (NSM submit), 7375–7443 (1A gate), 7918–7975 (1B restore), 8127–8140 (1B delete)
- `tests/adversarial/` inventory: `circles-coach.spec.js`, `circles-evaluator.spec.js`, `circles-final-report.spec.js`, `circles-gate.spec.js`, `nsm-evaluator.spec.js`, `nsm-gate.spec.js`, `nsm-step2-hint.test.js`, `nsm-step3-hint.test.js` — **no** `circles-hint` or `nsm-step1-hint` files

---

## Spec 1B — State / Cache (B3 + B4)

### A. Sections checklist

- §1–9 ALL present: Context, Architecture, Components, Data Flow, Error Handling, Testing, AC, Out of Scope, References. PASS.
- TBD/TODO/placeholder: NONE.
- Internal consistency:
  - State name `circlesScoreResult` referenced consistently across §1, §2, §3, §4, §7. OK.
  - File path `public/app.js` lines 7918–7975 / 8127–8140 / 6415 / 7944 — all spot-checked against actual file. OK (matches grep, restore handler at 7918, delete handler at 8127).
  - `stepKey` derivation rule (`mode==='drill' ? drillStep : STEPS[simStepIndex]`) appears identically in §2 (line 60), §4 (line 113), and AC §7 (line 244). OK.
  - Test IDs B3-U1..U5 / B3-E1..E3 / B4-U1..U4 / B4-A1..A3 / B4-E1..E3 mapped 1:1 to AC. OK.

### B. Cross-spec interaction

- 1A touches `public/app.js:7375-7443` (gate submit) — 1B touches `7918-7975` + `8127-8140`. **No overlap.** Both modify `app.js` but in disjoint regions; merge ordering safe.
- 1B does NOT touch hint modal code (4019/4130/3896) or Phase 2 chat code (774-1048). **No coupling with 1C / 1D.**
- 1B touches `lib/session-cache.js` only as a reference; no edit. Server-side route files explicitly carved out (§8). No race with 1A's gate flow.

### C. Effort estimate

- Files touched: **1** (`public/app.js`). +18 LOC net.
- TDD tasks implied:
  - 5 unit tests (B3) + 4 unit tests (B4) = 9 jest unit
  - 3 API contract tests (B4)
  - 3 + 3 = 6 Playwright E2E specs
  - **Total ~18 tests** for ~18 LOC. Healthy ratio.
- Karpathy simplicity: Both fixes are surgical. B3 = 6-line value derivation mirroring existing line 6556–6561 pattern (no new state). B4 = swap fire-and-forget for await + rollback (proven pattern). No over-engineering.

### D. Unstated assumptions

- §6 line 211: assumes `tests/factories/circles-phase1.factory.js` and `tests/fixtures/auto-cleanup.fixture.js` exist (they do — established in Stage 1A). Implementer should be told to **reuse**, not re-create.
- §6 line 221: state injection via `page.evaluate(window.AppState=...)` — this pattern works only when there is no auto-tryResume race; spec mentions stubbing list endpoints "where needed" but does not specify which. **Recommend implementer pre-flight test** that tryResume isn't auto-firing.
- §5 silently assumes the existing toast helper exists for "刪除失敗，請再試一次" — spec doesn't name the helper. Minor gap; implementer can grep.

### E. Verdict

**READY_WITH_NOTES** — dispatch immediately. Director should be ready to answer 2 questions during implementation: (1) which list-endpoint stub to use for B3-E1, (2) which existing toast helper to reuse for B4 rollback.

---

## Spec 1C — Phase 2 UI Fix (B5)

### A. Sections checklist

- §1–9 ALL present (Context / Architecture / Components / Data Flow / Error / Testing / AC / Out of Scope / References). PASS.
- TBD/TODO/placeholder: NONE.
- Internal consistency:
  - Class names `.qchip-panel`, `.qchip-panel__type`, `.qchip-panel__body`, `.qchip-panel__close` consistent across §2 (architecture diagram), §3 (CSS rules), §4 (data flow), §6 (test IDs), §7 (AC). OK.
  - data-attribute names `data-phase2="qchip"`, `data-phase2="qchip-panel"`, `data-phase2="qchip-panel-close"`, `data-phase2="back"` consistent. OK.
  - File line ranges `app.js:774–799` (qchip render), `app.js:1005–1048` (Phase 2 render), `style.css:2007–2014` (.phase-back-row) — quoted consistently. OK.
  - Mockup commit `418900a` referenced in front-matter and §6.1 baseline. OK.
  - §3.2 helper `renderQchipPanelHtml(q)` invoked consistently in §3.3 (line 118) and §3.3 locked-branch note (line 121). OK.

### B. Cross-spec interaction

- 1C edits `public/app.js:774-1048` (Phase 2 render) + `public/style.css:2007-2014` (.phase-back-row) and adds `.qchip-panel*` rules. 1D edits `public/style.css` `.example-list` line 813–815 and adds `.hint-content`. **Different CSS rules, no class collision.** No `line-height` rule overlap.
- 1C does not touch any hint modal code. No coupling with 1D's `_renderHintState`/`markdownBulletsToHtml`.
- 1C does not touch restore (`7918`) or delete (`8127`) — no coupling with 1B.
- 1A gate-submit region (`7375-7443`) is fully outside the Phase 2 render block. No coupling.
- **One subtle ordering note:** 1C modifies `bindCirclesPhase2`. 1B does not bind anything in Phase 2. Order independent.

### C. Effort estimate

- Files touched: **2** (`public/app.js`, `public/style.css`).
- TDD tasks implied:
  - 6 visual regression baselines (3 vp × 2 states)
  - 5 E2E test cases in suite 1 + 3 in suite 2 = **8 E2E**
  - 0 jest unit tests (pure DOM toggle, no state mutation — covered by E2E)
  - Total **~14 tests**. Reasonable.
- Karpathy simplicity: the qchip toggle is a textbook classList toggle + aria sync — no over-engineering. The "上一步 inline" fix is literally a child-element move. The new `renderQchipPanelHtml` helper is justified (called from 3 sites — Locked / conclusion / normal).
- One minor over-spec smell: §3.2 `typeMap` hardcodes 3 question types (`improve/strategy/design`). If the canonical type list lives elsewhere (e.g. `circles_database.json` schema), this duplication may drift. Worth a 30-second confirmation, not a blocker.

### D. Unstated assumptions

- §3.3 mentions both `renderCirclesPhase2Locked` (line 1053) AND a "結論模式分支 (line 892)" — three call sites for `qchipHtml`. Spec assumes implementer will catch all three. **Recommend explicit task: "verify qchip+panel rendered in 3 sites: normal Phase 2 (line ~1044), locked branch (line ~1053), conclusion branch (line ~892)".**
- §4 line 324 mentions optional `AppState.circlesPhase2QchipOpen` for cross-render persistence and explicitly defers to "Stage 1D" — but Stage 1D as currently scoped is hint-only, NOT qchip persistence. This is a **mis-defer** — should read "future stage" not "Stage 1D".
- §6.1 baseline screenshots assume `tests/visual/diffs/` infrastructure already exists; standard Path 2 setup, low risk.

### E. Verdict

**READY_WITH_NOTES** — dispatch immediately. Director should answer: (1) confirm typeMap (`改善題/策略題/設計題`) is the canonical source-of-truth list. Implementer should be told the qchip+panel must be wired in **3 call sites**, not 1.

---

## Spec 1D — B-Hint Cluster

### A. Sections checklist

- §1–9 ALL present. PASS.
- TBD/TODO/placeholder: NONE in the spec body, BUT see §D below — two implicit gaps (NSM Step 1 hint FE wiring, adversarial test files).
- Internal consistency:
  - Function signatures `generateNSMHints({question_json, product_type})`, `generateNSMStep2Hint({questionJson, field})`, `generateNSMStep3Hint({questionJson, dimId, dimType})`, `generateCirclesHint({step, field, questionJson})` consistent across §2, §3, §4, §7. OK.
  - Route paths consistent across §3 (modified routes) and §4 (data flow). OK.
  - CSS targets `.example-list` / `.example-sub` / `.hint-content` consistent in §3 and §7-AC8. OK.
  - Renderer name `markdownBulletsToHtml` (line 3797) vs `_markdownHintToHtml` (line 3868) appears consistently. OK.
  - 4 prompts / 4 routes / 2 FE files repeat consistently in §3, §6, §9. OK.

### B. Cross-spec interaction

- 1D touches `public/app.js` lines 3797 / 3868 / 3896 / 4019 / 4130 / ~1771 (NSM Step 1 hint flow if wired). 1C touches `app.js` 774-1048. 1B touches 7918-7975 + 8127-8140. **No `app.js` line overlap with 1B or 1C** — clean.
- 1D `style.css` edits `.example-list` (line 813), `.example-list li + li` (814), `.example-sub` (815), adds `.hint-content`. 1C `style.css` removes `.phase-back-row` (2007-2014) and adds `.qchip-panel*`. **Disjoint rule sets — no order risk.** Both raise line-height of different selectors.
- 1D modifies BE prompts + routes (`prompts/*.js`, `routes/nsm-*.js`). 1B / 1C are FE-only. **No BE collision.**
- 1A is shipped; 1A touched only `submitFrameworkToGate` and 3 phase-transition guard sites in `app.js`. **No collision with 1D.**

### C. Effort estimate

- Files touched: **10** (4 prompts + 3 routes + `app.js` + `style.css` + adversarial test additions).
- TDD tasks implied:
  - ~12 unit tests (prompt builders)
  - 8 API contract tests
  - 6 visual regression baselines
  - 4 adversarial stages × 10 cases (= 40 cases — but 2 stages already exist as `nsm-step2-hint.test.js` + `nsm-step3-hint.test.js`)
  - **Total ~26 tests + adversarial gate** — significantly heavier than 1B/1C combined.
- Karpathy simplicity:
  - **Question-only refactor** is a true simplification (removes draft-handling branches in 3 prompts). PASS.
  - **Markdown unification** (drop `_markdownHintToHtml`, use `markdownBulletsToHtml` everywhere) is a true deduplication. PASS.
  - **CSS line-height bump** is one-line per selector. PASS.
  - **Mild concern:** §3 specifies "Add 2 few-shot examples in system prompt" for `circles-hint.js`. Few-shot adds prompt tokens and model attention; risk is acceptable but should be revisited if response time degrades.

### D. Known gaps director should resolve BEFORE dispatch

**Gap D-1 (CONFIRMED — NSM Step 1 hint FE wiring missing):**
- Spec §3 line 151 says: "NSM hints modal (step 1 hints, `[data-nsm-hint-toggle]` flow): the NSM Step 1 hints call `/api/nsm-sessions/:id/hints` (or guest variant). Currently FE passes `userNsm: AppState.nsmDefinition?.nsm`. Locate this fetch call, remove `userNsm` from payload."
- **Reality (verified via grep):** `[data-nsm-hint-toggle]` handler at `app.js:1771-1777` does NOT call any hint endpoint. It only toggles `AppState.nsmHintExpanded[did]` and re-renders. The actual fetch wiring **does not exist in FE**. The only `userNsm` in FE app.js are at lines 2010 (NSM evaluate) and 2065 (NSM save) — neither is a hint endpoint.
- BE endpoint `POST /api/nsm-sessions/:id/hints` exists (per spec §3 line 139), but no FE consumer.
- **Director must decide ONE of:**
  - (a) **Add scope:** wire FE call to `/api/nsm-sessions/:id/hints` from `[data-nsm-hint-toggle]` (turns toggle into a real fetch + modal render path). Adds ~25 LOC, 4–6 more tests.
  - (b) **Defer:** explicitly drop NSM Step 1 hint from this cluster; modify §3 line 151, §6 line 291 (drop `nsm-hints` adversarial stage), §7 BHint-AC1 + AC6, and write a memory entry "NSM Step1 hint FE wiring deferred".
  - Without a decision, implementer will discover the gap mid-task and stall.

**Gap D-2 (CONFIRMED — adversarial test files missing):**
- Spec §6 line 287–294 asserts adversarial sweep must cover **4 stages**: circles-hint, nsm-hints, nsm-step2-hint, nsm-step3-hint.
- **Reality (verified via `ls tests/adversarial/`):**
  - `nsm-step2-hint.test.js` EXISTS
  - `nsm-step3-hint.test.js` EXISTS
  - `circles-hint.spec.js` / `.test.js` **DOES NOT EXIST**
  - `nsm-step1-hint.spec.js` / `.test.js` / `nsm-hints.spec.js` **DOES NOT EXIST**
- Spec §6 line 294 says "must be added before ship" but doesn't list it as a §3 component task or count it in §7 quality-gate test counts.
- **Director must decide:**
  - (a) Add explicit §3 task: "create `tests/adversarial/circles-hint.spec.js` + `nsm-step1-hint.spec.js` with 10 cases each, mirror existing hint test scaffold"
  - (b) Defer with memory entry and reduce ship gate to "2 of 4 hint stages adversarially covered; 2 deferred"
  - This compounds with D-1: if D-1 picks (b)-defer, then `nsm-step1-hint.spec.js` is also deferred and only `circles-hint.spec.js` needs creating.

**Gap D-3 (analogous unstated assumption):**
- §3 (`prompts/circles-hint.js`): "Remove post-processing strip regex `text.replace(/^[\-•·*]\s+/gm, '')`". Spec doesn't confirm whether this regex lives in the prompt module itself or in a downstream handler in `routes/circles-public.js`. **Implementer will need to grep both files.** Minor.

**Gap D-4 (carve-out approval audit trail):**
- Spec front-matter cites "task #174 + 2026-05-16 PNG feedback" as Path 2 carve-out approval for prompt edits. Director should confirm that approval is on record (memory or commit message) before implementer ships, otherwise a code-review reviewer will flag it.

### E. Verdict

**BLOCKED** — spec edit required before dispatch. Director must resolve **D-1** (NSM Step 1 hint scope) and **D-2** (adversarial test file scope) and amend the spec; otherwise implementer will hit the gaps mid-task and either stall or silently shrink scope. D-3 and D-4 can be answered live during implementation.

---

## Final Summary

| Spec | Sections OK | Internal cons | Cross-spec risk | Effort (tasks) | Verdict |
|---|---|---|---|---|---|
| 1B | 9/9 PASS | PASS | LOW (disjoint app.js regions vs 1A/1C/1D; no CSS) | ~18 tests, 1 file, +18 LOC | READY_WITH_NOTES |
| 1C | 9/9 PASS | PASS (1 mis-defer to "Stage 1D" should be "future") | LOW (disjoint CSS rules vs 1D; disjoint app.js regions vs 1B/1A) | ~14 tests, 2 files | READY_WITH_NOTES |
| 1D | 9/9 PASS | PASS (in spec body); 2 hidden gaps in scope | LOW vs 1B/1C (disjoint files & rules); MEDIUM vs reality (FE wiring missing) | ~26 tests + adversarial × 4 stages, 10 files | **BLOCKED** |
