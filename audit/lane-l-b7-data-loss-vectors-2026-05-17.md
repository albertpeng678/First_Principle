# Lane L — B7 Data-Loss Vectors Investigation (2026-05-17)

## Methodology
Read-only walk of `public/app.js`, `routes/nsm-sessions.js`, `routes/circles-sessions.js`, `public/lib/persistRetry.js`, both spec/plan files, and the T1 test file. No runtime repro. Every vector cites file:line.

## 5 P0 plan status
| Task | Status | Shipped commit | What it addresses |
|---|---|---|---|
| T1 persistRetry helper | shipped | 8e7fb39 | Helper exists at `public/lib/persistRetry.js`; 8 jest specs in `tests/lib/persist-retry.test.js`. Module is not yet `require()`d anywhere in `public/app.js`. |
| T2 Wire retry into triggerSaveCycle | NOT DONE | - | F-01: PATCH /progress in persistBackend IIFE still fire-and-forget bare `.catch(function(){})` at app.js:3796 |
| T3 gateResult PATCH await+retry | NOT DONE | - | F-04: gateResult PATCH still bare IIFE at app.js:7512-7517 |
| T4 ensureCirclesDraftSession retry | NOT DONE | - | F-10: ensureCirclesDraftSession silently returns null on failure at app.js:3745-3746 |
| T5 NSM gate persist gateResult | NOT DONE | - | F-12: nsm-sessions.js gate route only writes `lifecycle`, not `progress_json.gateResult` at routes/nsm-sessions.js:150 |
| T6 NSM evaluate checkpoint | NOT DONE | - | F-14: no pre-write checkpoint; crash loses evaluateNSM AI output at routes/nsm-sessions.js:94-126 |

---

## Data-loss vector inventory (ranked by severity)

### V-001: triggerSaveCycle PATCH fire-and-forget — SEVERITY P0
- **Scenario**: User types in Phase 1 field → 800ms debounce fires → localStorage written → PATCH /progress thrown into async IIFE → network drops → IIFE's `catch(_){}` silently swallows error. User opens second device, GET session returns stale `step_drafts:{}`.
- **Code path**: `public/app.js:3777-3797` (`persistBackend` async IIFE; catch at line 3796)
- **What gets lost**: All Phase 1 field content (P1, P1S, P1L, P1E, framework_draft) on the second device.
- **Why current code allows it**: T1 helper was shipped but NOT wired in. The IIFE still uses bare `window.apiFetch(...).catch(function(){})` with no retry. localStorage is single-device; server is multi-device truth.
- **Already addressed by T1?**: No — helper exists but app.js:3787 still calls `window.apiFetch` directly, not `persistRetry`.
- **Recommended fix tier**: persistRetry (T2 as specced)

### V-002: gateResult PATCH fire-and-forget — SEVERITY P0
- **Scenario**: User clicks 送出 → POST /gate returns ok → gate UI renders immediately → IIFE at app.js:7512 fires PATCH gateResult → network drops → catch swallows → second device GET session sees no gate_result → renders gate-pending state.
- **Code path**: `public/app.js:7512-7517` (IIFE PATCH after gate result assigned)
- **What gets lost**: Gate pass/fail result on cross-device reload. User must re-submit gate (another AI call cost).
- **Why current code allows it**: Same pattern as V-001; T2 not yet done; gate UI renders before PATCH completes.
- **Already addressed by T1?**: No.
- **Recommended fix tier**: persistRetry + await (T3 as specced)

### V-003: ensureCirclesDraftSession returns null silently — SEVERITY P0
- **Scenario**: User clicks 送出 gate → ensureCirclesDraftSession POST /draft fails (5xx/timeout) → returns null at line 3746 → submitFrameworkToGate renders 「無法建立 session，請重試」 → user can't proceed at all. No retry, no CTA. Permanent dead-end until page refresh.
- **Code path**: `public/app.js:3726-3748` (ensureCirclesDraftSession catch returns null); `public/app.js:7479-7488` (caller checks null, shows error, returns)
- **What gets lost**: User cannot advance; all typed Phase 1 content is trapped locally until a page refresh succeeds.
- **Why current code allows it**: No retry in ensureCirclesDraftSession; single-attempt POST; silent null means submit is permanently blocked.
- **Already addressed by T1?**: No — T4 not yet done.
- **Recommended fix tier**: persistRetry wrapping ensureCirclesDraftSession (T4 as specced)

### V-004: NSM gate result not persisted to server — SEVERITY P1
- **Scenario**: NSM gate POST returns ok/warn → FE assigns `AppState.nsmGateResult` → gate-pass UI shows → FE fires a separate PATCH for gateResult (`public/app.js:1988-1993`) → but `routes/nsm-sessions.js:150` only writes `lifecycle`, not `progress_json.gateResult` → second device GET session: `progress_json.gateResult` is null → re-submit UI shown.
- **Code path**: `routes/nsm-sessions.js:148-152` (UPDATE only sets `lifecycle`); `public/app.js:1988-1993` (FE sends PATCH but route ignores gateResult key in body — the route's PATCH /progress handler would need to handle it, but the nsm-sessions PATCH /progress route was checked separately)
- **What gets lost**: NSM gate result on cross-device reload. User re-submits gate (another AI cost).
- **Why current code allows it**: NSM gate route never persists `gateResult` to `progress_json`; spec F-12 T5 not yet done.
- **Already addressed by T1?**: No. Requires T5 (backend route change).
- **Recommended fix tier**: server idempotency (T5 as specced)

### V-005: NSM evaluate no pre-write checkpoint — SEVERITY P1
- **Scenario**: User clicks 重新評分 → POST /evaluate → `evaluateNSM` AI call (3-5s) → process crashes or connection drops mid-call → `scores_json` never written → next resume: no scores, shows 重新評分 → user pays AI cost again.
- **Code path**: `routes/nsm-sessions.js:94-126` (no checkpoint before `evaluateNSM()` at line 104)
- **What gets lost**: 3-5s AI evaluation result; user must re-evaluate.
- **Why current code allows it**: No `evaluating=true` checkpoint written before the AI call; crash leaves row in pre-evaluation state with no recovery signal.
- **Already addressed by T1?**: No. Requires T6 (backend checkpoint pattern).
- **Recommended fix tier**: Pre-write checkpoint + recovery (T6 as specced)

### V-006: Phase 2 conclusion draft PATCH fire-and-forget, no localStorage fallback on restore — SEVERITY P1
- **Scenario**: User types conclusion in Phase 2 → `localStorage.setItem('pmdrill:phase2:conclusion:...')` at app.js:6793 → debounced PATCH at app.js:6801 fires and fails (`.catch(function(){})`) → page refresh → `restoreCirclesPhase1FromSession` and `tryResumeLatestSession` both only read `progress_json.phase2ConclusionDraft` from server (app.js:7996, 7851) → the localStorage key `pmdrill:phase2:conclusion:*` is NEVER read back on restore.
- **Code path**: Write: `public/app.js:6793, 6801-6805`; Restore: `public/app.js:7996` (reads server only), `public/app.js:7851` (reads server only)
- **What gets lost**: Phase 2 conclusion draft typed since last successful PATCH. The localStorage write exists but is orphaned — no restore path reads it.
- **Why current code allows it**: localStorage write key `pmdrill:phase2:conclusion:*` is not read in any restore function. Not covered by the 5 P0 plan.
- **Already addressed by T1?**: No. Not in T2-T6 spec.
- **Recommended fix tier**: persistRetry on the PATCH + add localStorage read in restore path

### V-007: NSM definition/breakdown not in PERSISTED_KEYS — SEVERITY P2
- **Scenario**: User fills NSM definition (step 1/2) → triggers `triggerNsmSaveCycle` at app.js:2067 which writes localStorage + PATCH. If PATCH fails and page is hard-refreshed before PATCH completes: localStorage key `pmdrill:nsm:draft:*` exists but is only read in `triggerNsmSaveCycle` context. `AppState.nsmDefinition` and `AppState.nsmBreakdown` are NOT in `PERSISTED_KEYS` (app.js:153-164), so `persist()/restore()` at page load won't recover them.
- **Code path**: `public/app.js:153-164` (PERSISTED_KEYS list); `public/app.js:2067-2092` (triggerNsmSaveCycle); restore via `tryResumeLatestSession` reads server `user_nsm`/`user_breakdown` at app.js:7827-7828 — this IS the recovery path, but only if network is available.
- **What gets lost**: NSM definition + breakdown content on offline page refresh before PATCH completes.
- **Why current code allows it**: nsmDefinition/nsmBreakdown missing from PERSISTED_KEYS; `pmdrill:nsm:draft:*` localStorage key is written but never read back on session restore.
- **Already addressed by T1?**: No.
- **Recommended fix tier**: Add localStorage fallback read in tryResumeLatestSession NSM branch (low-risk, mirrors CIRCLES pattern at app.js:7861-7881)

---

## Race condition map
| Race | Trigger | Window | Loss type | Mitigation needed |
|---|---|---|---|---|
| Concurrent PATCH /progress (multi-tab) | Two tabs both typing Phase 1 | Between read-modify-write in route | Step key collision partially mitigated by shallow-merge at circles-sessions.js:330 — but `frameworkDraft` is a full overwrite (line 304), not merged | Server-side per-key merge for frameworkDraft |
| SSE stream abort mid-token | Page navigation while streaming | Between POST /message and `done` event | Streaming turn lost; `circlesConversation` not appended | AbortController abort handled at app.js:1270-1273 — cleanly aborts; no corruption, but turn is lost and shows retry UI |
| ensureCirclesDraftSession + PATCH race | triggerSaveCycle fires before session ID set | Between POST /draft response and PATCH /progress | PATCH skipped (guarded at app.js:3782) | Current guard is correct; no loss if session creation succeeds |
| gateResult PATCH vs page unload | User closes tab immediately after gate pass | Between gate UI render and PATCH completion | gateResult not persisted | await+retry (T3) |

## localStorage vs server divergence
- **When can they diverge?**: Any time a PATCH /progress fails (network drop, 5xx, offline). localStorage is written synchronously; server write is async fire-and-forget.
- **What's the canonical source?**: Server for cross-device; localStorage for same-device crash recovery. Code at app.js:8007-8011 uses `ts` timestamp + `backendEmpty` flag to pick winner.
- **Recovery strategy in code**: `restoreCirclesPhase1FromSession` (app.js:8001-8021) merges localStorage when `localFresher || backendEmpty`. Logic is correct for Phase 1 fields. NOT implemented for Phase 2 conclusion draft (V-006) or NSM definition (V-007).

## 5 P0 plan adequacy assessment
- **Does the existing 5 P0 plan cover ALL vectors above?** No. V-006 (Phase 2 conclusion localStorage orphan) and V-007 (NSM definition missing from PERSISTED_KEYS) are NOT in the plan. Vectors V-001 through V-005 map 1:1 to F-01/F-04/F-10/F-12/F-14.
- **Are T2-T5 task definitions still correct?** Yes — the specs are accurate. T2/T3/T4 wire persistRetry into app.js callsites that were correctly identified. T5/T6 address the backend gaps correctly.
- **Critical gap found**: T1 was shipped (`public/lib/persistRetry.js` exists, tests pass) but `require('../../public/lib/persistRetry')` is not called anywhere in `public/app.js`. The browser bundle does not load the helper yet. T2 must add the `<script>` tag or inline require before wiring.
- **Recommendation**: **EXTEND** the 5 P0 plan with two additional tasks: T2b (Phase 2 conclusion localStorage restore) and T2c (NSM definition localStorage restore + PERSISTED_KEYS audit). Keep T2-T6 as-is.

## Caveats
- Could not assess runtime behavior of `frameworkDraft` full-overwrite race (multi-tab) without a live two-tab repro.
- `public/lib/persistRetry.js` is a Node CJS module (`module.exports`); browser does not load it via `<script>` unless bundled or loaded as a module. This loading mechanism was not visible in `index.html` — needs verification before T2 wires it.
- `pmdrill:phase2:conclusion:*` localStorage write confirmed at app.js:6793 but zero read references found — confirmed orphan by grep.
