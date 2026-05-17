# E2E Master Tracker — Living Document

> **Single source of truth** for all e2e integration test findings, optimization points, and bug status. Updated continuously every time new issue surfaced or status changes. Per 首要綱領「所有修復必過 e2e 整合測試，嚴格拒絕見樹不見林」.
>
> **Last updated:** 2026-05-17 ~05:00 Taipei (post-cap parallel verification round)
> **Update protocol:** new finding → append to §findings + update §verification matrix + bump timestamp. Closed item → move to §closed with commit SHA. Never delete (audit trail).

---

## §1 Active P0 Bugs (user-visible / data integrity)

### P0-#263 iOS Safari Phase 3 restore fallback — NEW (2026-05-17)
- **Reproduce**: `tests/e2e/circles-phase3-restore-real.spec.js` B3-R1 fails ONLY on `e2e-mobile-safari` (WebKit). Desktop + mobile-chrome PASS.
- **Symptom**: page snapshot shows `<div data-view="circles">CIRCLES view — 待 Plan B 實作</div>` — production `renderCirclesStub()` (app.js:353) fallback fired instead of Phase 3 score UI.
- **Trigger logic** (app.js:325-343): Phase 3 render requires `circlesPhase === 3 && circlesSession`. All conditions failed → fallback.
- **Hypothesis**: WebKit-specific async hydration race. `AppState.circlesSession=null` at render OR `circlesPhase` not 3.
- **User-visible match**: matches PNG-23「已填寫內容會消失」report. iOS Safari users may see blank fallback after restoring scored sessions.
- **Next**: dispatch sonnet (post-cap) to investigate `restoreCirclesPhase1FromSession` + `tryResumeLatestSession` WebKit async ordering. Possible fix: `await` state hydration completion before render() OR add WebKit-specific delay/retry.

### P0-#251 Bug 1 Gate 全打 Y 過審 — NEEDS RE-VERIFY
- **Status**: Stage 1A T7+T9 shipped tightened prompt + 10/10 adversarial sweep (commits `ae270f3`, `f53038e`).
- **User report**: still reproducible after ship (per user 2026-05-17 message)
- **Next**: dispatch sonnet to write deterministic e2e spec with literal "Y" answers to verify gate rejects.

### P0-#255 Bug 6 沒審核直接放行 — VERIFIED PARTIAL
- **Verified**: Phase 4 final-report 422 incomplete_steps guard GREEN (`tests/api/circles-final-report-contract.spec.js` 2/2 PASS).
- **Open**: user reported "完整步驟" path may bypass — possibly different surface than F-N-003 guard.
- **Next**: dispatch sonnet to enumerate all gate→advance code paths + verify each has guard.

---

## §2 Active P1 Bugs

### P1-#256 Bug 7 已填內容消失 — partial coverage
- **Verified**: Phase 3 restore desktop + mobile-chrome GREEN.
- **Open**: iOS Safari fallback fail (see P0-#263 — same root cause).

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

---

## §3 Active P2 / Inconclusive

### #253 Bug 3 spinner stuck — INCONCLUSIVE (2026-05-17)
- **Reproduce**: 8s sample window too short; normal evaluate progress observed (checklist stage 1→3).
- **Audit doc**: `audit/bug3-reproduce/` 12 PNG committed `536a1e9`.
- **Next**: longer 60s window + multiple OpenAI hang scenarios OR user input on actual stuck symptom.

### #254 Bug 4 offcanvas delete cache stale — NOT_REPRODUCIBLE (2026-05-17)
- **Reproduce**: 7 scenarios all GREEN with 9-layer defense verified. Spec committed `3af488d`.
- **Open**: user re-reproduces? Need: auth state / device / session kind / item identity. Suspect = NSM delete path (B4-E3 still skipped F-P16) or guest path.

### F-P16 NSM session DELETE spec gap
- **Status**: `offcanvas-delete.spec.js` B4-E3 marked skipped pending NSM seed helper.
- **Risk**: NSM delete cache invalidation NOT covered by automated test.

---

## §4 Verification Matrix (Last Run 2026-05-17 ~05:00)

| Spec | Projects | Result | Commit/Notes |
|---|---|---|---|
| **API contract full suite** | 11 projects | ✅ 137/137 PASS (2.8m) | Includes Group A V1-V8 + Plan #194 T1 422 guard + guest CRUD |
| **Plan #194 T3 gate await PATCH** | 3 e2e | ✅ 50/50 × 5 runs (Re-Review APPROVED) | commit `32d348e` |
| **Plan #194 T6 NSM evaluate checkpoint** | 3 e2e | ✅ 10/10 PASS (21.8s) | commit `87e1999` |
| **Plan #194 T4 ensureCirclesDraftSession retry** | e2e-desktop | ⚠️ 2/3 PASS (TC1 timeout) | commit `87e1999` with caveat |
| **circles-back-nav-lock (chat-drift Wave 2)** | 3 e2e | ✅ 16/16 PASS × 10 runs no flake (post auth fix `313b4fd`) | commits `c3bc286` `313b4fd` `217c342` |
| **NSM full flow critical-path** | 3 e2e | ✅ 4/4 PASS (15.5s) | commit `3512675` |
| **Stage 1B B4 offcanvas-delete** | 3 e2e | ✅ 7 PASS / 3 skipped (B4-E3 NSM helper gap) | shipped earlier |
| **Adversarial sweep** | jest | ✅ 20/20 PASS (28s) | AI evaluator/gate prompt quality OK |
| **Bug 6 Phase 4 422 guard** | api | ✅ 2/2 PASS | commit `611a677` |
| **Bug 7 Phase 3 restore (B3-R1)** | 3 e2e | ❌ 9/10 PASS — **iOS Safari FAIL** | NEW BUG (P0-#263) |
| **chat-drift cross-vp re-run (post T6)** | 3 e2e | ❌ setup FAIL net::ERR_CONNECTION_REFUSED | infra race (P1-#264) |
| jest full suite | — | 530/552 (5 pre-existing fail / 17 skip / **0 new regression**) | baseline holds |

---

## §5 Closed Issues (recent ship audit trail)

| Issue | Status | Commits |
|---|---|---|
| Plan #194 T3 await fix (data loss critical) | ✅ APPROVED ship | `32d348e` + Re-Review GREEN |
| Plan #194 T6 NSM evaluate checkpoint | ✅ APPROVED ship | `87e1999` + 10/10 cross-vp |
| Chat-drift plan (qchip 4-block + lock-on-back) | ✅ FULLY SHIPPED end-to-end | 10 commits + push origin/main `ab28219` |
| T5 E2E auth race fix | ✅ FIXED | `313b4fd` (10/10 GREEN after) |
| Bug 4 offcanvas delete | ⚠️ NOT_REPRODUCIBLE audit | `3af488d` |
| Bug 5 對話練習 qchip 對齊 (Stage 1C drift) | ✅ SHIPPED via chat-drift | `49d00ba` + `34c1361` |
| Bug 6 Phase 4 422 guard | ✅ VERIFIED | `611a677` |
| Stage 1A Gate cluster (B1+B6) | ✅ SHIPPED | T1-T15 series |

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

---

## §7 Update Log

- **2026-05-17 ~05:00**: Initial master tracker. Cap-recovery parallel verification round. Found Bug 7 iOS Safari + Auth race. Verified T3/T6/Bug 6 GREEN. Stage 1B B4 + NSM full flow + adversarial all GREEN.
- **(future entries — append every new finding)**

---

## §8 Skill Citation Reference

All e2e specs in this tracker apply playwright-skill at `/Users/albertpeng/.claude/skills/playwright-skill/core/`:
- `common-pitfalls.md` Pitfall 11 (no own backend mock) — strictly held
- `api-testing.md:783-848` (data seeding via service-role) — for stuck-state / pre-populated test data
- `auth-flows.md:928-949` (API seed auth) — storageState + apiFetch in-page
- `mobile-and-responsive.md:49-71` (device profiles) — 3 e2e projects + iOS Safari WebKit detection
- `network-mocking.md:839-933` (intermittent failure pattern) — retry behavior verification
- `multi-user-and-collaboration.md:27-58` (cross-tab) — when applicable

Per STANDING memory `feedback_e2e_integration_supreme`: 5x consecutive 0 flake gate before claiming GREEN.
