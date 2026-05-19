# Audit: Phase 3 → Phase 4 UI Wiring Gap (#199 sub-find)

**Date**: 2026-05-19
**Scope**: Investigation while writing supplementary test for tracker #199 (Phase 3 → Phase 4 transition coverage gap).
**Status**: FIND-ONLY. No production code modified. Per `feedback_find_first_fix_later_via_tracker`.

## Finding

The CIRCLES UI has **no user-facing path** from Phase 3 (score view) to Phase 4 (final report) in production code.

### Evidence

1. `public/app.js` — **`AppState.circlesPhase = 4` is never assigned anywhere in app.js**
   - Confirmed via: `grep -n "circlesPhase\s*=\s*4"` returns 0 matches.
   - Grep for any direct assignment turned up only reads (`=== 4` comparisons in render / toast / bind dispatchers).

2. `public/app.js:6770-6780` — Phase 3 score view's `submit-bar` contains only:
   - `[data-phase3="go-home"]` (回首頁)
   - `[data-phase3="retry-question"]` (再練一題 — resets to home)
   - **No "生成最終報告" / "查看總評" / "下一步 Phase 4" button.**

3. `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/11-phase-3-score.html:575-577` — Mockup 11 submit-bar:
   - `<button class="btn btn--ghost">回首頁</button>`
   - `<button class="btn btn--primary">再練一題</button>`
   - **Mockup itself does not specify a Phase 4 entry button.**

4. Backend never sets `current_phase = 4`:
   - `routes/circles-sessions.js:78` initial draft = 1
   - `lib/evaluate-step-handler.js:93` evaluate-step writes `current_phase: 3`
   - `routes/circles-sessions.js:434` final-report writes `status: 'completed'` + `lifecycle` but does NOT touch `current_phase`.
   - `routes/circles-sessions.js:335` PATCH /progress accepts `currentPhase` — but no FE call sends `currentPhase: 4` (grep confirms).

5. Phase 4 is therefore only reachable via:
   - **`tryResumeLatestSession`** (app.js:8328) if a session row has `current_phase = 4` — but no code path writes that.
   - **Direct AppState injection** in tests.

### Impact

- `renderCirclesPhase4` (app.js:674), `triggerFinalReport` (app.js:707), `renderPhase4Loading/Success/Error` (app.js:486/548/520) are **dead code in production** — implemented but unreachable.
- POST /api/circles-sessions/:id/final-report is also unreachable from the UI; only backend tests exercise it.
- The "生成最終報告" button + sim-mode auto-advance after S step (or drill-mode "下一步" after final score) is **missing UI wiring**.

### What the supplementary test does instead

`tests/e2e/critical-path-full-flow.spec.js` Step 7 simulates the Phase 4 entry path by injecting `AppState.circlesPhase = 4` (mirroring what `tryResumeLatestSession` does when restoring a session with `current_phase = 4`).

This covers:
- `renderCirclesPhase4` container render
- `triggerFinalReport()` auto-fire (real POST /final-report against real backend + real OpenAI)
- `renderPhase4Success` after response (radar SVG + step-rows + grade card)

It does NOT cover the missing UI button. That requires a separate fix (out of scope for #199 supplementary test per `feedback_find_first_fix_later`).

### Recommendation (for user brainstorm — do not auto-fix)

1. Add a Phase 4 entry button to `renderPhase3Score` submit-bar — likely `[data-phase3="go-to-phase4"]` mapped to `AppState.circlesPhase = 4; render();`
2. Update mockup 11 to spec the button.
3. Add PATCH /progress with `currentPhase: 4` so resume path also works.

Tracked in: master tracker §3 #199 (this audit referenced from supplementary test commit).
