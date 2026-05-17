# Bug 1 FE gateResult Stale-State Audit
**Lane:** L10 | **Date:** 2026-05-17 | **Run against:** http://localhost:4000

---

## §1 FE State Machine Audit — Where gateResult Lives

### 1.1 AppState Initial Value
`public/app.js:28` — `circlesGateResult: null` (initial AppState definition).

### 1.2 PERSISTED_KEYS (CRITICAL LEAK SURFACE)
`public/app.js:154-165` — `circlesGateResult` is included in `PERSISTED_KEYS`.
`public/app.js:166-172` — `persist()` writes all PERSISTED_KEYS to `localStorage.pmDrillState` on every `render()` call.
`public/app.js:173-181` — `restore()` reads `pmDrillState` and populates AppState with all PERSISTED_KEYS.
`public/app.js:251` — `restore()` is called at `DOMContentLoaded` — SYNCHRONOUSLY — before `tryResumeLatestSession()` (async).

**Consequence:** Any stale `circlesGateResult` from a prior session is immediately loaded into AppState before the async server check can overwrite it.

### 1.3 Write Sites

| Line | Context | Value |
|---|---|---|
| 28 | AppState initializer | `null` |
| 3162 | `resetCirclesToHome()` | `null` |
| 5780 | `qcard-confirm` "no live session" branch | `null` |
| 7568 | `clearGateState()` | `null` |
| 7615 | `submitFrameworkToGate()` pre-submit | `null` |
| 7683 | `submitFrameworkToGate()` PATCH retry-exhausted | `null` |
| 7693 | `submitFrameworkToGate()` success path | `result` from POST /gate |
| 8026 | `tryResumeLatestSession()` CIRCLES branch | `latest.gate_result \|\| null` |
| 8185 | `loadCirclesSessionFromHistory()` | `item.gate_result \|\| null` |

### 1.4 Read Sites

| Line | Context |
|---|---|
| 4980-4981 | `renderCirclesGate()` — uses gateResult to choose body HTML |
| 4987 | `renderCirclesGate()` — checks overallStatus for sticky bar |
| 7549 | `bindCirclesGate` proceed handler — L5 LEAK-5 guard |

### 1.5 localStorage / sessionStorage Keys Related to Gate

- `pmDrillState` key — contains `circlesGateResult` as part of PERSISTED_KEYS snapshot. Cleared per test via `addInitScript` removing this key.
- `pmdrill:circles:draft:<qid>` — does NOT contain gateResult; only contains framework draft content.
- `sessionStorage` — not used for gateResult.

### 1.6 `loadCirclesSessionFromHistory` NSM/CIRCLES Branch
`public/app.js:8221+` — The NSM branch does NOT restore `circlesGateResult` (it restores `nsmGateResult`).
`public/app.js:8185` — The CIRCLES branch DOES restore `circlesGateResult = item.gate_result || null`. This is authoritative: it comes from the server's `gate_result` DB column.

### 1.7 `tryResumeLatestSession` CIRCLES Branch
`public/app.js:8026` — Restores `circlesGateResult = latest.gate_result || null`.
This is called async post-login. If it returns a session with `gate_result`, the stale pmDrillState value is overwritten. If it returns nothing (no active session), the stale pmDrillState value persists.

### 1.8 PATCH /progress Body — gateResult field
`public/app.js:7677` — FE sends `{ gateResult: result }` as PATCH body AFTER receiving POST /gate response.
`routes/circles-sessions.js:338` — Server accepts client-supplied `gateResult` and writes it directly to `gate_result` column with NO validation of `canProceed` value.
**Consequence:** Client can overwrite `gate_result` column with arbitrary values via PATCH. HOWEVER: the separate BE lifecycle guard (lines 321-334) blocks `currentPhase > 1` advance if `lifecycle != 'gated'`. The `lifecycle` column is only set to `'gated'` by POST /gate (not by PATCH /progress).

### 1.9 Phase 1 → 1.5 → 2 Transition Triggers
- Phase 1 → 1.5: `submitFrameworkToGate()` is called; sets `circlesPhase = 1.5` (line 7613).
- Phase 1.5 → 2 (proceed): `bindCirclesGate` 'proceed' handler (line 7542). **L5 LEAK-5 guard** checks `circlesGateResult.canProceed === true && overallStatus in ['ok','warn']` before allowing phase advance.
- Phase 1.5 → 1 (back): `bindCirclesGate` 'back' handler (line 7557) + `clearGateState()` (line 7568).

---

## §2 Test Scenarios + Results

All 16 tests PASS (5 scenarios × 3 projects).

| Scenario | Desktop | Mobile Chrome | Mobile Safari | Verdict |
|---|---|---|---|---|
| a — stale pmDrillState restore | PASS | PASS | PASS | Leak surface CONFIRMED |
| b — cross-question state bleed | PASS | PASS | PASS | No cross-Q bleed (app.js:5780 correct) |
| c — pmDrillState phase advance w/o POST /gate | PASS | PASS | PASS | FE LEAK CONFIRMED (see §3) |
| d — L5 LEAK-5 canProceed:false blocks | PASS | PASS | PASS | L5 fix WORKS |
| e — BE lifecycle guard on PATCH /progress | PASS | PASS | PASS | BE guard HOLDS (403) |

**Key console output excerpts (Scenario c, all 3 projects):**
```
[Scenario c] phase on boot (after restore): 1.5
[Scenario c] gateResult on boot: {"canProceed":true,"overallStatus":"ok","items":[]}
[Scenario c] phase 1.5 visible without user action: true
[Scenario c] phase after proceed (if any): 2
[Scenario c] POST /gate calls during test: 0
[Scenario c] LEAK CONFIRMED: phase advanced to 2 via stale pmDrillState WITHOUT POST /gate call.
[Scenario c] Phase 1.5 appeared on boot via pmDrillState restore — user did not initiate gate submit.
```

**Key console output excerpts (Scenario e, all 3 projects):**
```
[Scenario e] PATCH /progress with gateResult body: {"status":200,"ok":true}
[Scenario e] PATCH /progress currentPhase=2 result: {"status":403,"ok":false,"body":"{\"error\":\"gate_required_for_phase_advance\",...}"}
[Scenario e] PASS: BE lifecycle guard blocked phase=2 advance without real gate (status 403)
```

---

## §3 Identified FE Leaks — Smoking-Gun Line References

### LEAK-A (PRIMARY): `circlesGateResult` in PERSISTED_KEYS — stale restoration on boot

**Surface:** `public/app.js:160` — `'circlesGateResult'` listed in `PERSISTED_KEYS`.
**Mechanism:** `persist()` (line 166) writes gateResult to `pmDrillState` on every `render()`. `restore()` (line 173) reads it at `DOMContentLoaded` (line 251) — synchronously, before any async resume. If a prior session had a gate-pass (`canProceed:true, overallStatus:'ok'`), this value is live in AppState immediately on boot.
**Impact demonstrated:** Scenario c — Phase 1.5 appeared on boot WITHOUT user action (visible in PNG `scenario-c-boot-e2e-desktop.png`). User could click "繼續 →" to advance to Phase 2 WITHOUT submitting a new gate evaluation. The stale gate-pass from a prior session was used to navigate forward.
**L5 interaction:** L5 LEAK-5 (app.js:7549-7553) ALLOWS proceed when `canProceed=true && overallStatus in ['ok','warn']` — which the stale pmDrillState value satisfies. So L5 does NOT block this specific leak vector.
**Severity:** HIGH — user can bypass gate by hard-refreshing during a gate-pass state from a different question/session. Phase 2 chat would open without gate being run on the NEW content.

### LEAK-B (SECONDARY): Phase 1.5 auto-renders on boot from pmDrillState

**Surface:** `public/app.js:160` (circlesPhase in PERSISTED_KEYS) + `public/app.js:251` (restore runs before async resume).
**Mechanism:** `circlesPhase` is also in PERSISTED_KEYS (line 155). If a prior session left `circlesPhase=1.5`, restore() re-sets it. Combined with `circlesGateResult` being stale, the entire Phase 1.5 gate UI appears on boot without user action.
**Impact:** Scenario c boot screenshot shows Phase 1.5 "框架完整 — 繼續 →" immediately on page load without the user submitting a gate. This is the ORIGINAL Bug 1 symptom: user sees a gate-pass they didn't earn in the new session.
**Note:** This is the same root cause as LEAK-A. Both circlesPhase and circlesGateResult in PERSISTED_KEYS combine to reproduce the bug.

### NOT-A-LEAK (confirmed safe): Cross-question state bleed via qcard-confirm

`public/app.js:5780` — `circlesGateResult = null` in the "no live session" qcard-confirm branch. Scenario b confirmed this correctly clears the gate result when switching questions WITHOUT a server session match.

### NOT-A-LEAK (confirmed safe): L5 LEAK-5 canProceed:false guard

`public/app.js:7549-7553` — bindCirclesGate proceed guard. Scenario d confirmed this correctly blocks phase advance for `canProceed:false` and `canProceed:true + overallStatus:'error'`. L5 fix WORKS for gate-fail cases. It does NOT apply to gate-pass stale state (LEAK-A above).

### NOT-A-LEAK (confirmed safe): BE lifecycle guard on PATCH /progress

`routes/circles-sessions.js:321-334` — BE blocks `currentPhase > 1` if `lifecycle != 'gated'`. Scenario e confirmed 403 response for phase advance without a real gate. This is a strong server-side backstop that PREVENTS data corruption even if FE stale state shows a gate-pass UI. However, this guard only fires when FE actually sends a PATCH /progress with currentPhase — which happens in the real flow via `bindCirclesGate` proceed + `ensureCirclesDraftSession`.

**Important nuance for Scenario c's phase=2 advance:** In Scenario c, `circlesSession = null` at the time of the proceed click (no real session was created). The `bindCirclesGate` proceed handler calls `clearGateState() + set circlesPhase=2 + render()` without sending any PATCH /progress (since `_sidPersist` would be null at line 7669). So the FE shows Phase 2 UI but NO server-side phase advance is persisted. The user sees a phantom Phase 2 render, but the DB row remains at `lifecycle='created'`.

---

## §4 Cross-Ref: Did L5's FE LEAK-5 Fix Resolve All Stale-State Vectors?

**Verdict: PARTIAL — L5 resolves gate-fail stale state, but NOT gate-pass stale state.**

| Vector | L5 resolves? | Evidence |
|---|---|---|
| canProceed:false stale gateResult in AppState → proceed blocked | YES | Scenario d PASS; app.js:7550 blocks correctly |
| canProceed:true + overallStatus:'error' → proceed blocked | YES | Scenario d PASS; app.js:7550 blocks correctly |
| canProceed:true + overallStatus:'ok' stale pmDrillState → phase advance WITHOUT real gate | NO | Scenario c LEAK CONFIRMED; phase=2 with 0 POST /gate calls |
| Cross-question state bleed via qcard-confirm | Not L5's domain | Fixed by app.js:5780 (pre-L5 P0-#252 fix) |
| BE lifecycle guard on PATCH /progress | Not L5's domain | routes/circles-sessions.js:321-334 holds independently |

**L5 summary:** L5's `bindCirclesGate` guard (app.js:7549-7553) is a necessary condition check that verifies `canProceed===true && overallStatus in ['ok','warn']`. It correctly blocks FAIL-state stale results from enabling proceed. However, since the stale pmDrillState for a PRIOR gate-pass session also satisfies `canProceed=true && overallStatus='ok'`, L5 allows the proceed to happen. L5 was designed to prevent the race condition bug P0-#255 (mutex leak), not to prevent cross-session stale-state.

---

## §5 Recommendation

### §5.1 Bug 1 Verdict
**Bug 1 is STILL OPEN at one FE leak surface: LEAK-A (PERSISTED_KEYS includes circlesGateResult).**

The original Bug 1 symptom — user sees "全 Y 過審" without a real gate evaluation — can be reproduced via:
1. Complete a gate on Question A (gets circlesGateResult={canProceed:true, overallStatus:'ok'} in pmDrillState)
2. Hard-refresh page (or log out and log back in on a fresh device where pmDrillState is still in localStorage)
3. Navigate to CIRCLES — if no active session matches, tryResumeLatestSession returns nothing
4. App restores to Phase 1.5 with stale gate-pass UI
5. User clicks "繼續 →" → Phase 2 renders without a new gate submission

**L5's FE LEAK-5 fix (P0-#255) does NOT close P0-#251.** These are orthogonal bugs.

### §5.2 Proposed Fix (for Director dispatch to L13)

**Fix F1 — Remove `circlesGateResult` from PERSISTED_KEYS (app.js:160)**

Remove `'circlesGateResult'` from the PERSISTED_KEYS array. gateResult does not need to survive page reload — the authoritative value is always fetched from the server via `tryResumeLatestSession` (which reads `gate_result` from DB) or `loadCirclesSessionFromHistory`.

**Impact:** Zero — the only value gateResult needs to survive to is within a single page session. If user refreshes, tryResumeLatestSession will restore the correct value from the server's gate_result column (which IS authoritative and populated by POST /gate).

**Code change:** `public/app.js:160` — delete the line `'circlesGateResult',`.

**Fix F2 — Remove `circlesPhase` = 1.5 from restore() path**

A stale `circlesPhase=1.5` should also not auto-restore to Phase 1.5 on boot. Two options:
  - Option A: After restore(), if `circlesPhase === 1.5`, reset it to 1 (safest — gate state is always ephemeral).
  - Option B: Keep circlesPhase in PERSISTED_KEYS but clip 1.5 to 1 on restore (surgical).

Proposed: add a clip in restore() body: `if (AppState.circlesPhase === 1.5) AppState.circlesPhase = 1;`

**Fix F2 location:** `public/app.js:181` (immediately after the restore() for-loop).

### §5.3 Closing P0-#251

P0-#251 should remain OPEN until Fix F1 + F2 are implemented and verified. With the current code (as of L5/f7a43ff + 93b1b26):
- The BE is clean: POST /gate actually validates via OpenAI; lifecycle guard blocks unauthorized phase advance (Scenario e).
- The FE has a stale-state window: pmDrillState with gate-pass + empty tryResumeLatestSession → phantom Phase 2 render.
- The phantom render is FE-only (no DB corruption) because circlesSession=null means no PATCH /progress is sent.
- However, the user SEES a gate-pass they did not earn, which is the Bug 1 report.

Recommendation: dispatch L13 to implement Fix F1 + F2, then rerun Scenario c to verify the leak is closed.

---

## §6 PNG Evidence

All 24 screenshots in `audit/bug1-fe-gate-stale/`:

- `scenario-c-boot-e2e-desktop.png` — Phase 1.5 "框架完整 — 繼續 →" appearing on page load WITHOUT user gate submission (smoking gun visual for LEAK-A).
- `scenario-c-after-e2e-desktop.png` — Phase 2 "CIRCLES view — 待 Plan B 實作" after clicking proceed with stale gateResult.
- `scenario-d-e2e-desktop.png` — Phase 1.5 "方向需修正" with L5 gate blocking proceed (no "繼續" button visible — only "返回修改"). Confirms L5 works for fail state.
- `scenario-a-home-e2e-desktop.png` — Home view with stale gateResult in AppState (home rendered correctly despite stale state in memory).
- `scenario-a-phase15-e2e-desktop.png` — Phase 1.5 "框架完整" injected via page.evaluate; demonstrates stale gate-pass can be shown programmatically.
