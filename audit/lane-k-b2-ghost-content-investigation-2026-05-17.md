# Lane K — B2 Ghost Content Investigation (2026-05-17)

## Methodology
Read-only investigation; no file changes. Traced boot sequence, PERSISTED_KEYS restore, tryResumeLatestSession, restoreCirclesPhase1FromSession, bindCirclesPhase1/populateTextareasFromDraft, localStorage draft keys, SSE boot path.

---

## Top 5 candidate root causes (ranked by likelihood)

### Candidate 1: Stale pmDrillState restores circlesSelectedQuestion → Phase 1 form renders with no draft content before server-side resume arrives
- **What**: `PERSISTED_KEYS` (app.js:154) includes `circlesSelectedQuestion`, `circlesPhase`, and `circlesMode`. On every page reload, `restore()` (app.js:172-181) reads `pmDrillState` from localStorage and writes all persisted keys into AppState *before* the first `render()` at DOMContentLoaded (app.js:250-253). If the user had a session open and reloaded, `circlesSelectedQuestion` is non-null and `circlesPhase=1` → `renderView()` immediately routes to `renderCirclesPhase1()` (app.js:327). The textareas render empty because `circlesFrameworkDraft` is NOT in PERSISTED_KEYS and is still `{}`. A visible Phase 1 form exists with a valid question chip but blank fields — "ghost content" state — before `tryResumeLatestSession` (async) can populate `circlesFrameworkDraft` and call `render()` again.
- **Where**: app.js:154 (PERSISTED_KEYS), app.js:172 (restore), app.js:250-253 (DOMContentLoaded boot), app.js:327 (renderView condition), app.js:7756-7897 (tryResumeLatestSession async)
- **When triggered**: Page reload while user is mid-session on Phase 1. The async `tryResumeLatestSession` fetch takes 100-500ms+ to resolve; the first synchronous `render()` fires immediately after `restore()`.
- **Repro hypothesis**: 1) Start a CIRCLES drill/sim session and fill in some text. 2) Hard-reload the page (Cmd+Shift+R). 3) Observe: the Phase 1 form appears instantly with the correct question chip but all textareas empty, before content refills ~0.5s later.
- **Affected surfaces**: CIRCLES Phase 1 all steps (C1/I/R/C2/L/E/S), all viewports.
- **Likelihood**: HIGH
- **Why this matches "ghost content before user fills"**: The form is visibly rendered (not the home screen) the instant the page loads, before the user has done anything in this session. Fields appear to be "waiting for input" but the real draft is missing during the render gap.

---

### Candidate 2: nsmStep persisted; nsmDefinition not persisted → NSM Step 2/3 form renders with empty fields on reload
- **What**: `nsmStep` and `nsmGateResult` are in PERSISTED_KEYS (app.js:156, 158). `nsmDefinition` and `nsmBreakdown` are NOT. On reload with `view='nsm'` and `nsmStep=2` in pmDrillState, `renderView()` calls `renderNSMStep2()` (app.js:1284) which renders all three NSM input fields with empty strings (`def = {nsm:'', explanation:'', businessLink:''}`, app.js:1303-1304) and disables the submit button. The user sees a fully-rendered NSM Step 2 form with blank fields — identical to B2's described symptom.
- **Where**: app.js:156 (nsmStep in PERSISTED_KEYS), app.js:94 (nsmDefinition default empty), app.js:1299-1304 (renderNSMStep2 using def), app.js:7815-7837 (tryResumeLatestSession NSM branch sets nsmDefinition)
- **When triggered**: Reload while on NSM Step 2 or Step 3. Also triggered if user closes browser tab and reopens (pmDrillState persists across sessions).
- **Repro hypothesis**: 1) Navigate to NSM and fill Step 2 fields. 2) Hard-reload. 3) Observe: NSM Step 2 form renders immediately with empty nsm/explanation/businessLink fields, submit disabled.
- **Affected surfaces**: NSM Step 2 and Step 3 forms.
- **Likelihood**: HIGH
- **Why this matches "ghost content before user fills"**: The form surface appears to be a fresh blank state, but from the user's perspective they filled it in a prior session — it looks like content they didn't create, appearing prematurely before server data loads.

---

### Candidate 3: populateTextareasFromDraft fires even when circlesFrameworkDraft is from a different question's draft key
- **What**: `bindCirclesPhase1` → `populateTextareasFromDraft` (app.js:6984) reads `AppState.circlesFrameworkDraft[stepKey]` and injects `innerHTML` into empty textareas (app.js:7019-7020). If `circlesFrameworkDraft` is partially populated from a stale localStorage cache key that doesn't match the current question (logic at app.js:5699-5710), wrong session content could appear in fields for a different question.
- **Where**: app.js:6984-7024 (populateTextareasFromDraft), app.js:5699-5710 (qcard-confirm localStorage read), app.js:7019-7020 (ta.innerHTML = value)
- **When triggered**: User selects a question whose qid matches a stale `pmdrill:circles:draft:<qid>` cache entry that contains content from a previous session on that same question, even if the user intended a fresh start.
- **Repro hypothesis**: 1) Complete a CIRCLES session partially. 2) Reset to home without deleting the session. 3) Click the same question again — if no live session found in pools, localStorage cache is read and injected into fresh textareas.
- **Affected surfaces**: CIRCLES Phase 1 textareas.
- **Likelihood**: MED
- **Why this matches "ghost content before user fills"**: Old answers appear in the new session's form fields without the user typing anything.

---

### Candidate 4: circlesPhase1Solutions default non-empty struct pre-renders L-step sol-cards with empty name/mechanism inputs
- **What**: AppState.circlesPhase1Solutions initialises with two non-null solution objects (app.js:42-45). When `circlesPhase` is 1 and stepKey is 'L', `renderCirclesPhase1Lstep` uses this array to render sol-cards with empty `input.sol-card__name-input` and `.rt-textarea[data-sol-idx]` elements. `populateTextareasFromDraft` then tries to fill them (app.js:7029-7034), but only if `solutions[idx].mechanism` is non-empty. On a fresh session, they render blank. Not strictly "content before user fills" but the sol-card structure renders as if a session is active.
- **Where**: app.js:42-45 (default solutions), app.js:4479 (renderCirclesPhase1Lstep reads solutions)
- **When triggered**: Phase 1 L step render with default AppState.
- **Likelihood**: LOW (empty fields, not ghost content per se)

---

### Candidate 5: SSE streaming turn persists in circlesPhase2StreamingTurn across re-render cycles
- **What**: `circlesPhase2StreamingTurn` is NOT in PERSISTED_KEYS and defaults to null. However during an active stream, if `render()` is called mid-flight (e.g. by an online/offline event), `streamTurn` retains partial deltaText from the in-progress stream (app.js:915-916). This is expected behavior, not a true ghost, but the streaming bubble (`AppState.circlesPhase2Streaming = true`) renders before the user's submitted message completes the round-trip, which could appear as an AI bubble appearing before user interaction is done.
- **Where**: app.js:102-103 (circlesPhase2StreamingTurn), app.js:915-917 (renderCirclesPhase2 streaming state), app.js:1233-1238 (SSE delta accumulation)
- **When triggered**: Mid-stream if render() is re-triggered by external events.
- **Likelihood**: LOW (by design, not a bug)

---

## All restore paths inventoried

| Function | Location | Triggered by | What it restores | Could leak ghost content? |
|---|---|---|---|---|
| `restore()` | app.js:172 | DOMContentLoaded (sync, before first render) | PERSISTED_KEYS: view, circlesSelectedQuestion, circlesPhase, circlesMode, nsmStep, nsmGateResult, etc. | YES — question + phase without content |
| `tryResumeLatestSession` | app.js:7756 | Post-login getSession() callback + post-login success + post-register success | circlesFrameworkDraft, nsmDefinition, nsmBreakdown, step_drafts | NO by itself — but async gap between restore() and this is the ghost window |
| `restoreCirclesPhase1FromSession` | app.js:7959 | loadCirclesSessionFromHistory (offcanvas click) | circlesFrameworkDraft, step_drafts, conversation, gate_result | NO — always followed by render() after full data set |
| `loadCirclesSessionFromHistory` (CIRCLES path) | app.js:8031 | Recent-item click / offcanvas history click | Full session detail via GET /:id | Shows loading spinner during fetch — no ghost window |
| `loadCirclesSessionFromHistory` (NSM path) | app.js:8041 | Same | Partial list data first → then async full fetch updates nsmDefinition | YES — first render() at 8077 shows empty nsmDefinition if list item lacks user_nsm |
| `qcard-confirm localStorage read` | app.js:5699 | qcard confirm button click when no live session found | pmdrill:circles:draft:<qid> framework + P1/P1S/P1L/P1E | YES (Candidate 3) — old cache injected into fresh session |

---

## localStorage usage map

| Key | Set by (file:line) | Read by (file:line) | Cleared when |
|---|---|---|---|
| `pmDrillState` | persist() app.js:169 — every render() call | restore() app.js:174 — DOMContentLoaded | Token clear at logout (app.js:3222) |
| `guestId` | ensureGuestId() app.js:267 | ensureGuestId() app.js:264 | Never (persists across logins) |
| `pmdrill:circles:draft:<qid>` | triggerSaveCycle app.js:3769 | qcard-confirm 5699, tryResume 7864, restoreCirclesPhase1 8004 | Never explicitly — overwritten on next save |
| `pmdrill:nsm:draft:<qid>` | triggerNsmSaveCycle app.js:2080 | Not read back in any restore path (only written) | Never |
| `pmDrillReturnPath` | pre-redirect save app.js:286 | post-auth restore app.js:2844 | On read app.js:2847 |
| `circles_onboarding_done` | onboarding complete app.js:8419, 8435 | AppState init app.js:15 | Never |

---

## Recommendations (1 sentence per — for audit findings doc, NOT fix)

- **F-B2a**: Add a loading/skeleton state during the async gap between `restore()` and `tryResumeLatestSession` resolution when `circlesSelectedQuestion` is non-null in pmDrillState but `circlesFrameworkDraft` is empty.
- **F-B2b**: Do not persist `circlesSelectedQuestion` in PERSISTED_KEYS, or clear it on boot and rely solely on `tryResumeLatestSession` as the authoritative source of resumed session state.
- **F-B2c**: Do not persist `nsmStep` (or reset it to 1 on boot) when `nsmDefinition` is not simultaneously restored, to prevent blank NSM Step 2/3 forms appearing before async resume completes.
- **F-B2d**: Audit `pmdrill:nsm:draft:<qid>` — it is written (app.js:2080) but never read back; either add a restore path or remove the write to avoid dead localStorage accumulation.
- **F-B2e**: The NSM history restore path renders with partial list data first (app.js:8077 render() before full fetch) — check whether `user_nsm` is present in list endpoint responses, or add a field skeleton during the async full-fetch.

---

## Caveats
- Could not determine without runtime repro: exact timing of the async gap (depends on network speed and server latency); whether "PNG 20" refers to Phase 1 form or NSM step 2 surface specifically.
- Needs user clarification: which surface specifically showed ghost content (CIRCLES Phase 1 form, NSM Step 2 fields, Phase 2 chat bubble, or something else)? What does "ghost" look like — empty form with question already selected, or pre-filled text from a previous session?
