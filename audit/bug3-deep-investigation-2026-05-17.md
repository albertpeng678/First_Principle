# Bug 3 Deep Investigation — Spinner Stuck After Boot-Path Resume

**Date:** 2026-05-17
**Spec:** `tests/e2e/bug3-spinner-deep-investigation.spec.js`
**PNG evidence:** `audit/bug3-deep/` (35 PNG across 5 scenarios × 3 projects)
**Run log:** `/tmp/L13b-run.log`
**Final result:** 16/16 PASS (after 2 iterations of spec hardening)

---

## §1 Scenarios, Skills, and Setup

### Investigation scope

Prior audit (commit `536a1e9`, spec `bug3-spinner-stuck-reproduce.spec.js`) was INCONCLUSIVE because the 8-second window showed normal evaluate-step progress rather than stuck spinner. This deep investigation extended the window to 60s and added 4 additional scenarios.

### Skill citations

- `network-mocking.md:839-933` "Intermittent Failure Pattern" — S2/S3/S4 `page.route` mocks for 503/timeout injection
- `assertions-and-waiting.md:253-295` `expect.poll` — 60/72s observation windows in S1 (not `waitForTimeout`)
- `auth-flows.md:928-949` API seed — storageState pre-auth; no UI login
- `mobile-and-responsive.md:49-71` device profiles — 3 e2e projects (Desktop Chrome / Pixel 5 / iPhone 14)
- `common-pitfalls.md` Pitfall 11 — real backend for S1/S5; `page.route` ONLY for S2/S3/S4 error-state simulation
- `common-pitfalls.md` Pitfall 19 — `test.step()` for multi-phase flows

### Root cause established by static analysis (pre-run)

`tryResumeLatestSession` (app.js:8021-8075) hydrates `circlesStepScores` from `step_scores` and derives `circlesLocked` from the score row — but does NOT set `circlesScoreResult`. The `go-phase3` button handler (app.js:6871-6877) only sets `circlesPhase = 3; render()`. `renderCirclesPhase3` (app.js:6514) sees `!AppState.circlesScoreResult` and enters the loading spinner branch — starts 5s interval + 60s slow-warn timer + 300s EVAL_TIMEOUT. No `evaluate-step` API call is ever triggered from this path.

`restoreCirclesPhase1FromSession` (app.js:8180) DOES derive `circlesScoreResult` from `step_scores` (Stage 1B B3 fix) — so the offcanvas-restore path is fine. The bug is exclusively in the **boot-path auto-resume** branch.

---

## §2 Test Result Table

| Scenario | e2e-desktop | e2e-mobile-chrome | e2e-mobile-safari |
|---|---|---|---|
| S1: 60s extended window (real backend) | PASS (BUG reproduced) | PASS (BUG reproduced) | PASS (BUG reproduced) |
| S2: 503-then-200 retry mock | PASS (confirms bug) | PASS (confirms bug) | PASS (confirms bug) |
| S3: Sustained 503 mock | PASS (confirms bug) | PASS (confirms bug) | PASS (confirms bug) |
| S4: 30s delay mock | PASS (confirms bug) | PASS (confirms bug) | PASS (confirms bug) |
| S5: Nav-back state consistency | PASS (PASS) | PASS (PASS) | PASS (PASS) |

**Final run: 16/16 PASS**

---

## §3 Verdict Per Scenario

### S1: Extended 60s observation — BUG CONFIRMED

- **Verdict: BUG**
- `circlesScoreResult` stays null at 0s, 30s, and 60s after clicking 回評分
- `circlesPhase3LoadingSlow` became `true` at ~60s (app.js:6531) — visual slow-warn text appeared: "比預期慢一些...AI 深度分析中，偶而會需要比較久時間，請再等等。"
- `circlesPhase3Error` remained null (will only become non-null at 300s EVAL_TIMEOUT)
- Checklist animated through all 4 steps (cosmetic interval) but score never rendered
- Key assertion: no `/evaluate-step` request was fired by the `go-phase3` click
- PNG evidence: `scenario-1-spinner-at-30s-*.png` + `scenario-1-slow-warn-at-60s-*.png`

### S2: 503-then-200 retry simulation — BUG CONFIRMED (moot)

- **Verdict: BUG (moot scenario)**
- `page.route('**/evaluate-step**', ...)` mock was installed but never triggered
- Spinner stuck, `circlesScoreResult=null`, `phase3Error=null` after 15s
- The 503 mock was never invoked because `go-phase3` does not call `evaluate-step`
- Error banner (`.error-wrap`) did NOT appear — confirms evaluate-step was not fired
- Conclusion: even if we had perfect retry logic, the bug persists because no API call is made

### S3: Sustained 503 simulation — BUG CONFIRMED + error-handling VERIFIED

- **Verdict: BUG (primary); PASS (secondary — error-handling works when evaluate-step IS fired)**
- Primary 30s poll: spinner stuck, no error banner, `phase3Error=null` — evaluate-step never fired
- Secondary: after force-setting `circlesPhase3Error` via `page.evaluate`, `.error-wrap` rendered correctly; retry button visible (disabled when step already scored per AC-4 app.js:6354); when step_scores cleared and retry clicked with 503 mock → error state re-set
- Conclusion: FE error-handling is functional; the bug is upstream (evaluate-step not triggered)

### S4: 30s network delay simulation — BUG CONFIRMED + checklist animation VERIFIED

- **Verdict: BUG (boot-path); PASS (checklist animation)**
- 30s delay mock installed but never triggered (evaluate-step not fired from go-phase3)
- `circlesPhase3LoadingStep` advanced from 0 to 1+ over 15s (5s interval cosmetic animation works)
- Score remained null; spinner remained visible
- Checklist steps advance by timer regardless of whether evaluate-step is in-flight — this is CORRECT behavior (cosmetic progress indicator, not real progress signal)

### S5: Nav-back state consistency — PASS

- **Verdict: PASS**
- Phase 3 timers (5s interval + 60s slow-warn + 300s EVAL_TIMEOUT) correctly cleared when nav-back clicked (app.js:6579-6585 `clearPhase3Timers()`)
- `circlesPhase3LoadingStep` stopped incrementing after nav-back
- No spinner visible on Phase 1 after nav-back (only Phase 3 has spinner)
- No orphan timer state after navigation
- PNG evidence: `scenario-5-timers-cleared-no-spinner-*.png`

---

## §4 Root Cause + Production Code Line References + Proposed Fix

### Root cause

**File:** `public/app.js`
**Function:** `tryResumeLatestSession` (line ~7932, CIRCLES branch starting ~8021)

The CIRCLES branch of `tryResumeLatestSession` hydrates all session fields EXCEPT `circlesScoreResult`. Specifically, at lines 8021-8075 it sets:
- `circlesStepScores = latest.step_scores` (line 8031)
- `circlesLocked` derived from step_scores (line 8075)
- BUT DOES NOT set `circlesScoreResult`

When user clicks 回評分 (Phase 2 → Phase 3, app.js:6873-6876):
```js
goPhase3Btn.addEventListener('click', function () {
  AppState.circlesPhase = 3;
  render();
});
```

`renderCirclesPhase3()` (line 6514) then tests `!AppState.circlesScoreResult` at line 6520 → enters loading spinner branch → no `evaluate-step` call is triggered from render. The function that fires `evaluate-step` is `_triggerEvaluateStep` (line ~6645) which is only called from the Phase 2 submit path (Section E, line 6977) and the Phase 3 retry button handler (line 6602-6611). Neither is triggered by `go-phase3`.

### Proposed fix

In `tryResumeLatestSession` (app.js), after setting `circlesStepScores` at line 8031, add the same `circlesScoreResult` derivation that `restoreCirclesPhase1FromSession` does at line 8180:

**Insert after line 8031** (`AppState.circlesStepScores = latest.step_scores || {};`):
```js
// Fix Bug 3 (P2-#253): derive circlesScoreResult from step_scores in boot-path
// auto-resume so that "回評分" click renders Phase 3 score UI immediately
// instead of entering stuck spinner. Mirrors restoreCirclesPhase1FromSession
// (app.js:8180) — same Stage 1B B3 fix for the tryResumeLatestSession path.
var __rlMode = AppState.circlesMode === 'drill';
var __rlSimSteps = ['C1','I','R','C2','L','E','S'];
var __rlStepKey = __rlMode
  ? (AppState.circlesDrillStep || 'C1')
  : (__rlSimSteps[AppState.circlesSimStep || 0] || 'C1');
var __rlScoreRow = (AppState.circlesStepScores && AppState.circlesStepScores[__rlStepKey]) || null;
AppState.circlesScoreResult = (__rlScoreRow && __rlScoreRow.totalScore != null) ? __rlScoreRow : null;
```

**Why this works:** `circlesScoreResult` set from existing `step_scores` → `renderCirclesPhase3` takes the `circlesScoreResult exists` branch (line 6548) → `renderPhase3Score()` → score renders immediately. No `evaluate-step` call needed (score already exists from prior evaluation).

**Scope:** 1 logical block, ~7 lines, purely additive. Mirrors already-correct code at line 8180. Zero risk of regression to non-scored sessions (null-safe guard: `__rlScoreRow.totalScore != null`).

**Related fix:** Same pattern needed for simulation mode (`circlesSimStep`) — the proposed fix handles both drill and sim via the `__rlMode` ternary.

---

## §5 Reclassification of P2-#253

**Previous status:** INCONCLUSIVE (8s window too short; normal evaluate-step progress observed)

**New status:** BUG CONFIRMED — definitive

**Mechanistic evidence (static analysis):**
- `tryResumeLatestSession` does not set `circlesScoreResult` (line 8031 vs 8180)
- `go-phase3` handler fires no evaluate-step (line 6873-6876)
- `renderCirclesPhase3` enters spinner branch when `circlesScoreResult=null` (line 6520)
- No code path from Phase 2 → Phase 3 nav (boot-path) triggers evaluate-step

**Dynamic evidence (16/16 tests GREEN):**
- S1: spinner visible at 0s, 30s, 60s; slow-warn at 60s; no evaluate-step request; `circlesScoreResult=null` throughout
- S2: 503 mock never invoked (evaluate-step never fired)
- S3: sustained 503 mock never invoked; spinner stuck same as S1
- S4: 30s delay mock never invoked; checklist animates cosmetically but score never arrives

**Prior INCONCLUSIVE explanation:** The 8s window captured the loading-step animation interval firing (5s tick), which looked like "normal evaluate progress." It was NOT evaluate progress — it was the cosmetic checklist animation. The actual evaluate-step was never in flight.

**Recommended action:** Implement proposed fix in §4 (L13b Phase 2 or standalone hotfix). Estimated fix: < 10 lines in `tryResumeLatestSession`, mirroring the existing Stage 1B B3 fix.
