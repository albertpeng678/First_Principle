# E2E Master Tracker — Living Document

> **Single source of truth** for all e2e integration test findings, optimization points, and bug status. Updated continuously every time new issue surfaced or status changes. Per 首要綱領「所有修復必過 e2e 整合測試，嚴格拒絕見樹不見林」.
>
> **Last updated:** 2026-05-17 ~05:30 Taipei (jest 5 fail re-audit + tracker rewrite for full coverage)
> **Update protocol:** new finding → append to relevant §findings + update §verification matrix + bump timestamp. Closed item → move to §closed with commit SHA. Never delete (audit trail).
> **Read this first**, then drill into linked audit slices/specs as needed.

---

## §1 Active P0 Bugs (user-visible / data integrity)

### ~~P0-NEW Lifecycle gate→gated wiring broken (4 routes)~~ — RESOLVED 2026-05-17 (was mis-diagnosis)
- **Verdict**: TEST FIXTURE SHAPE DRIFT, not production bug. Production wiring proven correct.
- **Root cause**: `tests/contracts/lifecycle-{circles,nsm}-route.test.js` stubbed `circles-gate` / `nsm-gate` with legacy `{ ok: true, issues: [] }` shape. Production prompts return `{ canProceed, overallStatus, items }` (since task #208 `B8 gate.ok → canProceed fix`). Routes check `canProceed && overallStatus` — stub had neither → route classified as `gate_fail` → lifecycle stayed `editing`.
- **Production proof**: `tests/api/lifecycle-{circles,nsm}.spec.js` 16/16 PASS with real OpenAI + real Supabase test DB. SLC-AC7 verified end-to-end: POST /gate ok=true → DB row `lifecycle='gated'`.
- **Fix**: stubs updated to `{ canProceed: true, overallStatus: 'ok', items: [] }` and false counterpart. Surgical 4 replace_all (~10 edited sites).
- **Verify**: jest 534/552 (was 530/552; +4 fixed). Real API e2e 16/16. Commit `[pending]`.
- **Lesson (O-8 action)**: master tracker mis-flagged this as P0 user-visible — investigation showed it was test-only. Enforced jest fail tagging policy still warranted (O-8) so next drift caught faster.

### ~~P0-NEW-2 jest tests/circles-sessions.test.js cascade regression~~ — RESOLVED in L5 same commit `93b1b26`
- **Was**: 20 fails when L5 added 403 guards mid-flight before updating test mocks
- **Resolved**: L5's commit includes 3 spec updates (circles-no-bypass + final-report-contract + back-nav-lock) that propagated lifecycle='gated' seed pattern, indirectly resolving the cascade. Final jest 535/552 = best baseline ever.

### ~~P0-#263 iOS Safari Phase 3 restore fallback~~ — RESOLVED 2026-05-17 (Lane L1 — was stale tracker entry)
- **Verdict**: Already fixed in commit `654d0e8` (2026-05-16) before this tracker entry was reconciled. Director cold-verified 3 runs × 4 tests = 12/12 PASS on e2e-mobile-safari (zero flake) + L1's 5/5 burn-in.
- **Root cause (now historical)**: Pre-fix `restoreCirclesPhase1FromSession` (app.js:8140) did not copy `step_scores[stepKey]` into `circlesScoreResult`. `navigateToPhase3 → renderCirclesPhase3` then hit `if (!circlesScoreResult)` branch at app.js:6513 → spinner-forever. Tracker original PNG snapshot of `renderCirclesStub()` was likely captured in a different transient window during navigateToPhase3 race.
- **Fix (commit `654d0e8`)**: 8-LOC addition in `restoreCirclesPhase1FromSession` deriving `circlesScoreResult` from restored `step_scores[stepKey]`, mirroring normal eval path at app.js:6556-6561.
- **Audit doc**: `audit/diagnose-iOS-safari-phase3-restore/diagnose-2026-05-17.md` + 2 trace zips + 7 mobile-safari frames
- **Lesson (cross-ref O-8)**: Master tracker had stale entry — fix was shipped before being reconciled. This is exact case for O-8 enforcement policy (jest/spec status must be re-baselined per ship, not assumed stale).

### P0-#251 Bug 1 Gate 全打 Y 過審 — BACKEND CLEARED, FE INVESTIGATION PENDING (Lane L2)
- **Audit + spec**: `audit/repro-bug1-all-Y-adversarial-2026-05-17.md` + `tests/api/circles-gate-all-Y-adversarial.spec.js` commit `f7a43ff`
- **Backend result**: **10/10 variants correctly rejected** across 3 runs (2 Playwright + 1 node probe), real OpenAI gpt-4o temperature=0.3 + JSON mode. Tested: `"Y"`, `"y"`, `"yes"`, `"Y."`, `"Y。"`, `"Y "`, mixed 1-2 char, `"好"`, `"1"`, `"."`. All returned `canProceed=false, overallStatus=error, items: 4× error:輸入無意義`.
- **Verdict**: API gate (`prompts/circles-gate.js` + `POST /api/circles-sessions/:id/gate`) is **NOT bug source**. Layer 1 (字數<10) + Layer 2 (敷衍) + few-shot 三重覆蓋皆生效。
- **Pivot — FE candidate surfaces** (待 user 決定下一輪 lane scope):
  1. Stale `gateResult` / `canProceed=true` cached in localStorage / sessionStorage / `AppState` from prior real submission
  2. `gateResult` populated via `PATCH /progress` without re-evaluation (cross-ref **LEAK-3** in P0-#255: PATCH /progress 接受 currentPhase 無 gate guard，可能也接受 stale gateResult)
  3. UI 短路 `POST /gate` 在 state 已有 `canProceed=true` 時
  4. **Field name mismatch** suspicion: `question_json.field_examples.C1` spec is `問題範圍, 時間範圍, 業務影響, 假設確認` but common usage / SUBSTANTIVE_DRAFT sends `問題範圍, 影響對象, 核心衝突, 目標結果` — name mismatch could cause OpenAI to evaluate fewer fields under stale-cache scenario
  5. **Cross-ref**: P0-#255 LEAK-5 FE — `bindCirclesGate` proceed handler missing `canProceed` double-check (related root cause)
- **Proposed next lane (待 user 裁示 — NOT dispatched per STANDING)**: FE Bug 1 investigation lane — audit `bindCirclesGate` / `gateResult` storage / `PATCH /progress` body shape; write e2e spec simulating stale-state scenario

### ~~P0-#255 Bug 6 沒審核直接放行~~ — RESOLVED 2026-05-17 (commit `93b1b26`)
- **Fix**: 4 BE handlers + guest variants (8 instances) + FE LEAK-5 defense-in-depth
- **Verify**: tests/api/circles-no-bypass.spec.js 5/5 GREEN × 5 runs no flake + jest 535/552 + lifecycle-circles 8/8 + lifecycle-nsm 8/8 + final-report-contract 2/2 + back-nav-lock 6/6
- **All 5 leak surfaces (LEAK-1 through LEAK-5) sealed.**
- Original investigation evidence preserved below.

### P0-#255 Bug 6 沒審核直接放行 — RED CONFIRMED 2026-05-17 (Lane L3)
- **Audit + spec**: `audit/bug6-bypass-path-enumeration-2026-05-17.md` + `tests/api/circles-no-bypass.spec.js` commit `95b7fd5`
- **Coverage**: 13 BE handlers audited + 8 FE handlers audited
- **4 confirmed leaks (all RED with actual 200 instead of expected 4xx)**:
  - **LEAK-1** `POST /api/circles-sessions/:id/evaluate-step` → 200, totalScore=16 returned with lifecycle='editing' (routes/circles-sessions.js:253)
  - **LEAK-2** `POST /api/circles-sessions/:id/message` → 200, SSE stream opened with lifecycle='editing' (routes/circles-sessions.js:202)
  - **LEAK-3** `PATCH /api/circles-sessions/:id/progress` with currentPhase=2 → 200, DB current_phase written with lifecycle='editing' (routes/circles-sessions.js:304-379, line 312)
  - **LEAK-4** `POST /api/circles-sessions/:id/final-report` → 200 with seeded step_scores + lifecycle='editing' (routes/circles-sessions.js:382)
  - **All 4 mirror to guest variants** (routes/guest-circles-sessions.js): 4 leaks × 2 = 8 handler instances total
- **LEAK-5 FE (defense-in-depth)**: `bindCirclesGate` proceed handler at app.js:~7542 checks `AppState.gateInflight` (race mutex) but NOT `AppState.circlesGateResult.canProceed` — protected only by render-time conditional in `renderCirclesGate` (~line 1469); failed gate result not double-checked at click time
- **Control GREEN**: T-BYPASS-5 incomplete_steps guard 400 — regression safe
- **Proposed fix direction** (待 user 裁示 — NOT yet dispatched per STANDING):
  ```js
  // Add at top of /message, /evaluate-step, /final-report handlers (both auth + guest):
  if (!['gated', 'completed'].includes(session.lifecycle)) {
    return res.status(403).json({ error: 'gate_required', message: 'Session must pass gate before proceeding.' });
  }
  // For PATCH /progress: reject currentPhase > 1 unless lifecycle === 'gated' or 'completed'
  ```
- **Critical implication**: gate is currently **advisory only** at backend — entire UX assumes FE conditional rendering blocks user, but any direct API caller (or FE state corruption / future bugs) bypasses freely. This is the actual root cause of user's repeated 沒審核直接放行 reports.

### ~~P0-#252 Bug 2 PNG-20 Ghost content~~ — RESOLVED 2026-05-17 (commit `c156c6b`)
- **Fix**: 7-line reset block at `public/app.js:5778-5784` qcard-confirm — resets `circlesFrameworkDraft`, `circlesGateResult`, `circlesScoreResult`, `circlesPhase2ConclusionDraft`, `circlesConversation`, `circlesStepScores` before assigning new question
- **Verify**: Scenario C e2e-mobile-chrome 30/30 × 5 runs zero flake + circles-back-nav-lock 16/16 + circles-phase3-restore-real 10/10 + jest 535/552
- **Cosmetic gap noted (separate issue, NOT this fix)**: Scenario E (localStorage stale draft path with no server session) has pre-existing DB-state-dependent flake; loadCirclesSessionFromHistory bypasses localStorage when server session exists, so this is orthogonal
- Original investigation evidence preserved below.

### P0-#252 Bug 2 PNG-20 Ghost content — RED CONFIRMED 2026-05-17 (Lane L4)
- **Audit + spec + PNG**: `audit/repro-bug2-ghost-content-2026-05-17.md` + `tests/e2e/circles-fresh-form-no-ghost.spec.js` + `audit/repro-bug2-ghost-content/` (15 e2e tests + 1 setup × 3 projects)
- **Reproduction confirmed**: Scenario C on e2e-mobile-chrome — console output `[BUG CONFIRMED] AppState.circlesFrameworkDraft: {"C1":{"問題範圍":"ghost content from session A"}}`. PNG `scenario-C-e2e-mobile-chrome.png` shows "ghost content from session A" 渲染在 Apple Health（不同 question）的 Phase 1 問題範圍 textarea。
- **Root cause (1 line)**: `AppState.circlesFrameworkDraft` 不在 qcard-confirm handler (`public/app.js:5784`) 重置；下一題 mount 時 `populateTextareasFromDraft` (`public/app.js:7137-7157`) 把舊 draft `innerHTML` 注入新 textarea
- **Why prior B2 fix didn't cover this**: prior fix likely handled login → fresh login path; new repro is cross-question switch within same session lifetime (qcard-confirm path)
- **Cross-ref**: prior investigation `audit/lane-k-b2-ghost-content-investigation-2026-05-17.md`
- **Proposed fix (待 Director 排程 — L5 還在跑同檔 app.js，避免 conflict)**:
  ```js
  // At qcard-confirm handler (app.js:5784), before assigning new circlesSelectedQuestion:
  AppState.circlesFrameworkDraft = {};
  AppState.circlesPhase1Solutions = [{},{}]; // shape per existing init
  ```
- **Lane note**: e2e-desktop + e2e-mobile-safari 在同一 root cause path 上 fail，但因 test infra back-nav timeout 沒抵達 ghost assertion；mobile-chrome 是乾淨 RED 證據

---

## §2 Active P1 Bugs

### ~~P1-#256 Bug 7 已填內容消失~~ — RESOLVED 2026-05-17 (linked to P0-#263 resolution)
- **Verdict**: Same root cause as P0-#263 (commit `654d0e8` 2026-05-16). Director cold-verified all 3 e2e projects GREEN. No separate fix needed.

### P1-#257 Bug 8 Test 沒用真用戶答案 shape — partial
- **Verified**: retrofit C/D/E/F + Group A V1-V8 all shipped using real Supabase + service-role seed.
- **Open**: master plan F-007 (~65 specs partial mock `/api/circles-sessions` list) still exists — pending Phase 3 fix wave per master plan §7.

### P1-#264 Auth setup race — infra debt
- **Symptom**: `tests/setup/auth.setup.js` ERR::CONNECTION_REFUSED on `page.reload` when many e2e specs run in parallel. Atomic rename fix (`313b4fd`) solved file race but server :4000 brief drops under burst load.
- **Reproduce**: re-running circles-back-nav-lock immediately after T6 cross-vp → setup fails, 15 tests skipped.
- **Next**: lower workers config for setup OR retry helper OR investigate server keep-alive.

### P1 Plan #194 T4 TC1 happy retry timeout
- **Production code shipped** at `87e1999` with caveat. Wire structurally correct (line 7612-7635 try/await/catch).
- **Test fail**: TC1 timeout 60s waiting POST `/circles-sessions/:id/gate` after 503→200 retry.
- **Hypothesis**: ensureCirclesDraftSession internal state pollution from preflight 503 silent catch (line 7099).
- **Next**: dispatch sonnet to trace state propagation post-retry.

### P1 Critical-path mobile flake (.navbar__email race)
- **From**: Task 7 ship gate caveat (commit ab28219 post-ship report)
- **Spec**: `tests/e2e/critical-path-full-flow.spec.js` (commit `9446ad2`) fails on e2e-mobile-chrome + e2e-mobile-safari
- **Same root cause**: `.navbar__email` CSS-hidden on mobile breakpoint (V7 review caught same issue at earlier `c68c924`)
- **Next**: replace `.navbar__email` selector with viewport-agnostic role-based locator (already done in V7 fix `9b41bee` — apply same pattern to critical-path)

### P1 Master plan F-001 Trophy inversion
- **From**: `audit/testing-trophy-audit-2026-05-16.md` + master plan §2
- **State**: 95 E2E specs vs ~18 API specs vs target 60% API / 10% E2E
- **Progress**: Group A V1-V8 added 8 real API specs; ratio improving but not at target
- **Next**: identify ~30-40 more E2E candidates to convert to API tier per surface

---

## §3 Active P2 / Inconclusive

### #253 Bug 3 spinner stuck — INCONCLUSIVE (2026-05-17)
- **Reproduce**: 8s sample window too short; normal evaluate progress observed (checklist stage 1→3).
- **Audit doc**: `audit/bug3-reproduce/` 12 PNG committed `536a1e9`.
- **Next**: longer 60s window + multiple OpenAI hang scenarios OR user input on actual stuck symptom.

### #254 Bug 4 offcanvas delete cache stale — NOT_REPRODUCIBLE (2026-05-17)
- **Reproduce**: 7 scenarios all GREEN with 9-layer defense verified. Spec committed `3af488d`.
- **Cosmetic gap noted** (`_doOffcanvasDelete` doesn't invalidate `AppState.circlesRecentSessions` → home rail stale until next `loadHistoryForRail`)
- **Open**: user re-reproduces? Need: auth state / device / session kind / item identity. Suspect = NSM delete path (B4-E3 still skipped F-P16) or guest path.

### F-P16 NSM session DELETE spec gap
- **Status**: `offcanvas-delete.spec.js` B4-E3 marked skipped pending NSM seed helper.
- **Risk**: NSM delete cache invalidation NOT covered by automated test.

### #207 B5 decision (Stage 1C revert vs keep) pending
- **Context**: Stage 1C qchip-panel ship (commits `f6b18fe` `a0e5531`) was superseded by chat-drift wave 1-4 (qchip-expand 4-block per Phase 1 pattern)
- **Status**: chat-drift commit `49d00ba` already swapped Phase 2 from `renderQchipPanelHtml` to `renderQchipExpand`. Stage 1C effectively deprecated.
- **Cleanup pending**: `renderQchipPanelHtml` (app.js:801) is now orphan, no callers. Safe to delete in cleanup commit.

### #199 Trophy Step 4 — critical-path E2E
- **Status**: master plan F-006 already partly satisfied by `9446ad2` critical-path-full-flow spec
- **Gap**: mobile fails (see P1 above); spec doesn't yet cover Phase 1→4 fully end-to-end (Phase 3 → 4 transition may be missing)

### #205 Retrofit G — delete hollow tests + test-supabase mock library
- **From**: Trophy audit cleanup queue
- **Effort**: medium; trail-following deletions after Retrofit C/D/E/F replaced hollow specs

### #211 B3 retrofit C — real E2E for score restore (vm.createContext kill)
- **Mostly done**: `72e7797` retrofit C replaced hollow B3 restore unit with real E2E. Task may be misclassified pending; verify nothing left.

### #174 B-Hint demand (PAUSED for Trophy reset)
- **Context**: NSM B-Hint cluster feature on hold pending Trophy reset completion
- **State**: Plan #193 has design + plan; impl deferred

---

## §4 Verification Matrix (Last Run 2026-05-17 ~05:30)

| Spec / Suite | Projects | Result | Commit/Notes |
|---|---|---|---|
| **API contract full suite** | 11 api projects | ✅ 137/137 PASS (2.8m) | Includes Group A V1-V8 + Plan #194 T1 422 guard + guest CRUD |
| **Plan #194 T3 gate await PATCH** | 3 e2e | ✅ 50/50 × 5 runs (Re-Review APPROVED) | commit `32d348e` |
| **Plan #194 T6 NSM evaluate checkpoint** | 3 e2e | ✅ 10/10 PASS (21.8s) | commit `87e1999` |
| **Plan #194 T4 ensureCirclesDraftSession retry** | e2e-desktop | ⚠️ 2/3 PASS (TC1 timeout) | commit `87e1999` with caveat |
| **circles-back-nav-lock (chat-drift Wave 2)** | 3 e2e | ✅ 16/16 PASS × 10 runs no flake (post auth fix) | commits `c3bc286` `313b4fd` `217c342` |
| **NSM full flow critical-path** | 3 e2e | ✅ 4/4 PASS (15.5s) | commit `3512675` |
| **Stage 1B B4 offcanvas-delete** | 3 e2e | ✅ 7 PASS / 3 skipped (B4-E3 NSM helper gap) | shipped earlier |
| **Adversarial sweep (jest)** | jest | ✅ 20/20 PASS (28s) | AI evaluator/gate prompt quality OK |
| **Bug 6 Phase 4 422 guard** | api | ✅ 2/2 PASS | commit `611a677` |
| **Bug 7 Phase 3 restore (B3-R1)** | 3 e2e | ❌ 9/10 PASS — **iOS Safari FAIL** | NEW BUG (P0-#263) |
| **Phase 2 qchip visual** | 3 desktop projects × 3 vp | ✅ 24/24 PASS (44s) | chat-drift didn't break baseline |
| **chat-drift cross-vp re-run (post T6)** | 3 e2e | ❌ setup FAIL net::ERR_CONNECTION_REFUSED | infra race (P1-#264) |
| **jest lifecycle contracts (RESOLVED)** | jest | ✅ 32/32 PASS (stub shape fix) | commit `[pending]` — was test fixture drift, not prod bug |
| **jest issue-bug1-nsm-session-restore** | jest | ❌ 1 fail (sets nsmDefinition from item.user_nsm) | Investigate — likely real NSM restore bug |
| **jest full suite** | — | 534/552 (1 remaining fail: nsm-session-restore, 17 skip) | Cleaner baseline post P0-NEW resolution |
| **Real API lifecycle e2e (CIRCLES+NSM)** | api-lifecycle | ✅ 16/16 PASS (60s, real OpenAI) | proves production gate→gated wiring 正常 |
| **Bug 6 bypass — RED→GREEN (L3+L5)** | api | ✅ 5/5 GREEN × 5 runs no flake | RED `95b7fd5` → fix `93b1b26` (4 BE + 4 guest + FE LEAK-5) |
| **Bug 1 全 Y adversarial (Lane L2)** | api-gate-adversarial | ✅ 10/10 PASS × 3 runs (no flake) | `f7a43ff` — backend cleared; FE investigation pending |
| **iOS Safari Phase 3 restore (Lane L1 verify)** | e2e-mobile-safari | ✅ 12/12 PASS × 3 runs (zero flake) + 5/5 burn-in | `654d0e8` (was stale tracker entry; fix shipped 2026-05-16) |
| **Bug 2 ghost content repro (Lane L4)** | 3 e2e | ❌ RED on mobile-chrome Scenario C (BUG CONFIRMED) | `b266907` — fix pending (qcard-confirm reset) |
| **jest full suite (post L5)** | jest | ✅ 535/552 (0 fail, 17 skip) | best baseline ever — was 530/552 at session start |
| **jest issue-bug1-nsm-session-restore (test drift fix)** | jest | ✅ 17/17 PASS (was 16/17) | `f616319` |

---

## §5 Closed Issues (recent ship audit trail)

| Issue | Status | Commits |
|---|---|---|
| Plan #194 T3 await fix (data loss critical) | ✅ APPROVED ship | `32d348e` + Re-Review GREEN |
| Plan #194 T6 NSM evaluate checkpoint | ✅ APPROVED ship | `87e1999` + 10/10 cross-vp |
| Chat-drift plan (qchip 4-block + lock-on-back) | ✅ FULLY SHIPPED end-to-end | 10 commits + push origin/main `ab28219` |
| T5 E2E auth race fix (file-level atomic rename) | ✅ FIXED | `313b4fd` (10/10 GREEN after) — burst-load race still open as P1-#264 |
| Bug 4 offcanvas delete | ⚠️ NOT_REPRODUCIBLE audit | `3af488d` (12 PNG evidence) |
| Bug 5 對話練習 qchip 對齊 (Stage 1C drift) | ✅ SHIPPED via chat-drift | `49d00ba` + `34c1361` |
| Bug 6 Phase 4 422 guard | ✅ VERIFIED | `611a677` |
| Stage 1A Gate cluster (B1+B6) | ✅ SHIPPED | T1-T15 series |
| Stage 1B B3 retrofit C | ✅ shipped | `72e7797` |
| Stage 1B B4 retrofit D | ✅ shipped | `f6aeec0` |
| Stage 1D Retrofit E (NSM hint endpoints) | ✅ shipped | `465f841` |
| 5 P0 Retrofit F (persistRetry helper) | ✅ shipped | `837e435` / `ee9e735` / `5f6b9e2` |
| Stage 0 B7 (pollution cleanup) | ✅ shipped | `45d0e6e`...`1ba062e` |
| Session lifecycle state machine schema | ✅ shipped | `59b5537` `acb04e4` `2139859` |
| CIRCLES + NSM lifecycle wire (handlers) | ✅ verified GREEN end-to-end | `a254e45` `b42aac0` + test stub fix `069986e` |
| jest contract stub shape fix (P0-NEW resolution) | ✅ shipped — was mis-diagnosis | `069986e` |
| iOS Safari Phase 3 restore (P0-#263 + P1-#256) | ✅ already shipped (was stale entry) | `654d0e8` (2026-05-16) — Director verified 12/12 × 3 runs |
| Bug 6 bypass repro (Lane L3) | ✅ TDD-red spec + audit | `95b7fd5` (Phase 1 repro) |
| Bug 6 fix bundle (Lane L5) — 8 BE + FE LEAK-5 sealed | ✅ 5/5 GREEN × 5 runs no flake | `93b1b26` |
| Bug 1 全 Y adversarial repro (Lane L2) | ✅ backend cleared 10/10×3 | `f7a43ff` (FE investigation pending) |
| NSM gate adversarial preventive sweep (Lane L9) | ✅ 10/10 rejected, 0 leak | `322dfa8` — NSM gate solid, mirrors L2 CIRCLES finding |
| jest tests/circles-sessions.test.js cascade restore (Lane L8) | ✅ 62/62 file + 535/552 full jest baseline | `05025b9` — seed lifecycle='gated' in makeSession defaults |
| jest issue-bug1-nsm-session-restore test drift | ✅ 17/17 (was 16/17) | `f616319` — production normalize 3 shapes, test relaxed |
| Bug 2 ghost fix (Lane L11) | ✅ Scen C mobile-chrome 30/30 × 5 runs no flake + cross-vp | `c156c6b` — 7-line reset at qcard-confirm |
| CIRCLES evaluator adversarial preventive sweep (Lane L12) | ✅ 7/7 totalScore=16 (well < 60) | `0efe786` — evaluator robust, 4 dims all min 1/5 |
| Critical-path 3 pre-existing fails (newly surfaced post L11 verify) | ⚠️ pending — needs O-8 investigation | NOT L11-caused (confirmed identical pre-fix); separate lane needed |

---

## §6 Optimization Opportunities

### O-1: Refactor ~65 specs from route.fulfill stubs → real Supabase
- **From**: master plan §7 F-007.
- **Impact**: more real e2e coverage, less drift risk between stub shape vs real response.
- **Effort**: large. Tackle in batches per surface.

### O-2: Delete 5 vm.createContext app.js helper specs
- **From**: master plan F-008.
- **Refactor**: extract tested helpers to importable modules; replace vm.createContext with real imports.
- **Effort**: medium. Already partially done by Retrofit C/D (`72e7797` `f6aeec0`).

### O-3: Unmount stale routes/prompts dead code
- **From**: master plan F-002 + F-003.
- **Files**: `routes/sessions.js`, `routes/guest-sessions.js`, `prompts/coach.js`, `prompts/evaluator.js`, `prompts/issue-generator.js`.
- **Effort**: small. Pure delete after verify not mounted.

### O-4: Mockup 04 (Phase 1.5 Gate) PNG audit + 9 transition drift
- **From**: task #21 PAUSED.
- **Effort**: medium. Pixel-diff against mockup baseline.

### O-5: Plan #194 T7/T8/T9 remaining
- **T7**: reorg persist-retry-browser-real.spec.js → centralized persistence-resilience.spec.js
- **T8**: adversarial edge case 5 specs
- **T9**: final regression + cold-read 4 toast PNGs + audit doc

### O-6: Bug 4 cosmetic — `_doOffcanvasDelete` invalidate `circlesRecentSessions`
- **Identified by**: Bug 4 reproduce sonnet (audit commit `3af488d`)
- **Impact**: home rail shows stale recent sessions briefly after delete
- **Effort**: tiny (~3 lines)

### O-7: NSM seed helper for `offcanvas-delete.spec.js` B4-E3
- **Identified by**: F-P16 gap
- **Effort**: small; will unblock NSM delete cache invalidation test coverage

### O-8: jest "pre-existing fails" reclassification audit
- **Discovery**: 4 lifecycle wire fails + 1 NSM restore fail were misclassified as "baseline acceptable" in chat-drift / Plan #194 ship gates
- **Action**: enforce policy — any NEW commit must show jest count strictly ≥ baseline AND every fail must be tagged with task ID or explicitly acknowledged
- **Effort**: small process; medium investigation if more "baseline" hides bugs

### O-9: Delete orphan `renderQchipPanelHtml` (app.js:801)
- **Identified by**: Review-T4 qchip-expand reuse (commit `49d00ba`)
- **Status**: dead code, zero callers after chat-drift swap
- **Effort**: tiny (~15 lines delete)

### O-10: Extract `_doOffcanvasDelete` / `bindOffcanvas` / similar large fn from app.js
- **Note**: app.js ~8200 LOC; many helpers could be extracted to `public/lib/`
- **From**: pattern observed in retrofit C/D work
- **Effort**: large; do in surface batches

---

## §7 Paused Plans Status (#190-194)

### #190 Lifecycle plan
- **Plan**: `docs/superpowers/plans/2026-05-16-session-lifecycle-state-machine-plan.md`
- **Shipped**: schema + lib + handler wire (`59b5537`...`892b4f4` series)
- **Pending**: see P0-NEW gate→gated wiring bug (lifecycle handler incomplete)

### #191 1B state/cache plan
- **Plan**: `docs/superpowers/plans/2026-05-16-stage-1b-state-cache-plan.md`
- **Shipped**: B3 + B4 ship + retrofit C/D + 1B chat surface bind
- **Pending**: task audit for remaining sub-tasks; cross-tab cache invalidation deeper

### #192 1C Phase 2 UI plan
- **Plan**: `docs/superpowers/plans/2026-05-16-stage-1c-phase2-ui-fix-plan.md`
- **Status**: **SUPERSEDED** by chat-drift wave 1-4 ship
- **Cleanup**: mark task as superseded; delete orphan `renderQchipPanelHtml` (O-9)

### #193 1D B-Hint cluster plan
- **Plan**: `docs/superpowers/plans/2026-05-16-stage-1d-hint-cluster-plan.md`
- **Shipped**: NSM hint endpoints via Retrofit E (`465f841`)
- **Pending**: B-Hint UI ship (PAUSED #174)

### #194 5 P0 resilience plan
- **Plan**: `docs/superpowers/plans/2026-05-16-persistence-resilience-plan.md`
- **Shipped**: T1/T2/T5 pre-existing + T3 (`32d348e`) + T6 (`87e1999`) + T4 partial
- **Pending**: T4 TC1 diagnose, T7 spec reorg, T8 adversarial, T9 final regression

---

## §8 Update Log

- **2026-05-17 ~10:50**: Director dispatch L8 + L9 並行 per user "並行並行並行" directive。**L8 = tests/circles-sessions.test.js regression resolver**（per Trophy reset + Retrofit G #205: 評估 hollow-vs-real，傾向 delete 因為 real coverage 已在 api/ tier）。**L9 = NSM gate adversarial sweep**（mirror L2 pattern for prevention）。Lane scope 設計避免撞 L5 working set（L5 持續 edit app.js + routes/*）。3 slots full: L5 + L8 + L9.
- **2026-05-17 ~10:35**: Director main-agent **investigated 1 remaining jest fail** (`issue-bug1-nsm-session-restore.test.js:208`) — TEST DRIFT, production更 robust（normalize user_nsm 3 種 shape）vs test stale literal string-match。Surgical fix: change `toContain('AppState.nsmDefinition = item.user_nsm')` → `toContain('AppState.nsmDefinition =')`。File 17/17 PASS。**BUT full jest dropped to 514/552 — discovered L5 WIP 撞 20 條 tests/circles-sessions.test.js**。新增 P0-NEW-2 tracker entry。
- **2026-05-17 ~10:33**: Phase 1 Lane L4 returned. P0-#252 Bug 2 ghost content **RED CONFIRMED**. Root cause: `AppState.circlesFrameworkDraft` 不在 qcard-confirm (`app.js:5784`) 重置；新題 mount populateTextareasFromDraft 注入舊 draft。Console + PNG (scenario-C-e2e-mobile-chrome) 證據鐵。Spec/audit/PNG written by sonnet. L5 fix lane 還在跑 — Bug 2 fix lane 待 L5 完才 dispatch（避免 app.js 並行編輯衝突）。
- **2026-05-17 ~10:25**: Phase 1 Lane L1 returned DONE_WITH_CONCERNS — P0-#263 iOS Safari Phase 3 restore + P1-#256 Bug 7 are **STALE entries**, already fixed by commit `654d0e8` (2026-05-16). Director cold-verified 12/12 × 3 runs e2e-mobile-safari zero flake. Both moved to §5 closed. Diagnostic doc + traces + 7 mobile-safari frames preserved. Lanes running: L4 + L5. 1 free slot — holding for L4 (Bug 2 ghost) finding before dispatching Bug 1 FE investigation (potential code-surface overlap).
- **2026-05-17 ~10:10**: Director 由 user 授權 "由你開單最 robust 方式"。Dispatch **L5 = Bug 6 fix bundle**（per L3 推薦方向）— 4 BE handler + FE LEAK-5 + TDD green via 已存 `tests/api/circles-no-bypass.spec.js`。Rationale: blast radius 最大，可能順帶解 Bug 1 FE root cause（待 L5 完後驗證）。Bug 1 FE investigation lane 延後。L1+L4+L5 = 3 slots full。
- **2026-05-17 ~10:05**: Phase 1 Lane L2 returned. P0-#251 Bug 1 backend cleared — 10/10 adversarial variants ("Y", "y", "yes", "Y.", "Y。", "Y ", 混合, "好", "1", ".") rejected × 3 runs (50s + 57s + node probe). Real OpenAI gpt-4o + temperature 0.3 + JSON mode. Layer 1 字數<10 + Layer 2 敷衍 + few-shot 三重覆蓋全生效。Bug pivots to FE — candidate surfaces 4 條 + cross-ref P0-#255 LEAK-5 FE. Commit `f7a43ff`. L1/L4 still running.
- **2026-05-17 ~09:55**: Phase 1 Lane L3 returned. P0-#255 Bug 6 RED confirmed — 4 BE leak paths (evaluate-step / message / progress.currentPhase / final-report) all return 200 with lifecycle='editing', proving gate is advisory-only at backend. + 1 FE defense gap (gate proceed handler missing canProceed double-check). Audit + spec commit `95b7fd5`. Lane L4 (Bug 2 ghost) dispatched. L1/L2 still running.
- **2026-05-17 ~07:00**: P0-NEW lifecycle gate→gated RESOLVED. Investigation showed stub shape drift `{ok, issues}` (legacy) vs prod `{canProceed, overallStatus, items}` (post task #208). Surgical fix 2 test files. jest 534/552 (+4). Real API e2e 16/16 PASS proves production wiring correct end-to-end via real OpenAI. Master tracker reclassified.
- **2026-05-17 ~05:30**: jest 5 fail re-audit — discovered 4 lifecycle gate→gated wiring bugs hidden as "pre-existing" (P0-NEW added). Added Bug 2 ghost re-report. Added critical-path mobile flake (P1). Added paused plans §7. Phase 2 qchip visual 24/24 PASS.
- **2026-05-17 ~05:00**: Initial master tracker. Cap-recovery parallel verification round. Found Bug 7 iOS Safari + Auth race. Verified T3/T6/Bug 6 GREEN. Stage 1B B4 + NSM full flow + adversarial all GREEN.
- **(future entries — append every new finding)**

---

## §9 Cross-References (audit doc map)

| Path | Purpose |
|---|---|
| `audit/findings-slice-circles-2026-05-17.md` | 20 findings on CIRCLES surfaces (master plan Phase 3 audit Lane N) |
| `audit/findings-slice-nsm-2026-05-17.md` | 14 findings on NSM surfaces (Lane O) |
| `audit/findings-slice-cross-2026-05-17.md` | 17 findings on Auth/Onboarding/Cross-surface (Lane P) |
| `audit/findings-slice-edge-2026-05-17.md` | 31 findings on edge cases / race / iOS Safari (Lane Q) |
| `audit/lane-b-test-inventory-2026-05-17.md` | full test inventory map (~210 specs classified by Trophy tier) |
| `audit/lane-c-product-surface-map-2026-05-17.md` | 36 render fn + 57 endpoints + 20 prompts + 72 AppState fields |
| `audit/lane-k-b2-ghost-content-investigation-2026-05-17.md` | Bug 2 ghost content investigation |
| `audit/lane-l-b7-data-loss-vectors-2026-05-17.md` | B7 data loss vector inventory |
| `audit/persistence-comprehensive-audit-2026-05-16.md` | Plan #194 baseline audit |
| `audit/testing-trophy-audit-2026-05-16.md` | Trophy reset baseline |
| `audit/bug3-reproduce/` + `audit/bug3-reproduce-2026-05-17.md` | Bug 3 INCONCLUSIVE evidence |
| `audit/bug4-reproduce/` + `audit/bug4-reproduce-2026-05-17.md` | Bug 4 NOT_REPRODUCIBLE evidence (7 scenarios) |
| `audit/task4-qchip-smoke/` + `audit/task4-sse-fix/` | T4 qchip-expand + SSE fix PNG evidence |
| `audit/eyeball-circles-chat-drift-lock-2026-05-17.md` | chat-drift visual cold-Read |
| `audit/sop-2026-05-17-circles-lock-and-qchip-uat.md` | UAT SOP for chat-drift ship |
| `docs/superpowers/specs/2026-05-17-e2e-integration-coverage-master-plan.md` | Master plan — coverage matrix + 14 known findings F-001..F-014 |
| `docs/superpowers/plans/2026-05-17-circles-chat-drift-and-lock-plan.md` | Chat-drift impl plan (7 tasks) |
| `docs/superpowers/plans/2026-05-16-persistence-resilience-plan.md` | Plan #194 (5 P0 resilience) |
| `docs/superpowers/plans/2026-05-16-real-e2e-integration-execution-plan.md` | Earlier Path 3 plan (Group A V1-V8 + Group B V9-V14) |
| `CLAUDE.md` | live state board for chat history |

---

## §10 Skill Citation Reference

All e2e specs in this tracker apply playwright-skill at `/Users/albertpeng/.claude/skills/playwright-skill/core/`:
- `common-pitfalls.md` Pitfall 11 (no own backend mock) — strictly held; carve-out only for error-state simulation (503/timeout)
- `common-pitfalls.md` Pitfall 14 (no module-level shared state) — per-test isolation
- `common-pitfalls.md` Pitfall 18 (`page.evaluate` only for true JS APIs) — `window.apiFetch` + `AppState` reads
- `common-pitfalls.md` Pitfall 19 (`test.step()` for multi-phase) — every TC wraps phases
- `common-pitfalls.md` Pitfall 3 (role-based locators) — `getByRole` / `data-*` over CSS chain
- `api-testing.md:783-848` (data seeding via service-role) — for stuck-state / pre-populated test data
- `api-testing.md:1023-1166` (error response testing) — 4xx / 5xx contract assertions
- `auth-flows.md:928-949` (API seed auth) — storageState + apiFetch in-page
- `mobile-and-responsive.md:49-71` (device profiles) — 3 e2e projects + iOS Safari WebKit detection
- `network-mocking.md:839-933` (intermittent failure pattern) — retry behavior verification
- `multi-user-and-collaboration.md:27-58` (cross-tab newContext) — when applicable
- `visual-regression.md` (toHaveScreenshot pixel-diff) — baselines + maxDiffPixelRatio 0.005
- `assertions-and-waiting.md` (expect.poll / toBeVisible timeouts) — no `page.waitForTimeout`

Per STANDING memory `feedback_e2e_integration_supreme`: 5x consecutive 0 flake gate before claiming GREEN.
Per `feedback_playwright_skill_cited_application`: every spec cites segment + pattern name (not just file ref).
Per `feedback_two_stage_review_mandatory`: spec compliance + code quality reviewer per commit.
Per `feedback_uiux_visual_only`: Director cold-Read every PNG before approve; sonnet self-Read invalid.

---

## §11 How to Use This Tracker

**For Director (opus)**：
1. Open this file first when starting any session
2. §1-§3 = next-action queue
3. §4 = check matrix before claiming GREEN
4. §6-§10 = backlog + reference
5. **Update §8 timestamp + new finding inline whenever something new surfaces**

**For Implementers (sonnet)**：
1. Pick from §1 / §2 by P0/P1
2. Cite related audit slice (§9) in spec header
3. Apply skill citations (§10) verbatim
4. Don't claim GREEN without 5x consecutive — push back to Director if pressed

**For User**：
1. Read §1 + §3 for what's broken
2. §5 for what's shipped recently
3. §6 for queue
4. §7 for paused work
