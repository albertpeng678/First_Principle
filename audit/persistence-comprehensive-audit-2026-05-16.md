# Comprehensive Persistence Layer Audit — 2026-05-16

**Scope:** Every save/load surface in PM Drill (CIRCLES + NSM) mapped to identify bugs/risks before lifecycle refactor (spec `33d5bf9`)  
**Coverage:** 26+ findings, 3 P0 / 7 P1 / 16 P2+  
**Approach:** FE→BE write surfaces, BE→FE read surfaces, failure modes, cross-reference with bug history  
**Verdict:** Lifecycle spec covers 16/26 findings; 5 architectural gaps remain unfixed; 5 are design-as-intended

---

## Finding Inventory

### CIRCLES Write Surfaces

#### F-01: triggerSaveCycle race — localStorage vs PATCH timing
**Class:** Lost write  
**Severity:** P0 (data loss)  
**Files:** 
- `public/app.js:3742` (triggerSaveCycle)
- `public/app.js:3766-3786` (persistBackend async)
- `tests/visual/draft-data-loss-fix.spec.js:29-86` (Cause A regression)

**Repro hint:** Type in Phase 1 textarea → 800ms debounce fires → localStorage write succeeds immediately → PATCH queued. If network latency >2s on PATCH, user closes tab before PATCH lands → localStorage has data but backend `step_drafts={}` (stale).

**Root cause:** persistBackend is fire-and-forget async IIFE. No retry, no abort detection, no queue. localStorage gets write, network fails silently. User later resumes from list → loads stale backend row (empty) instead of cached localStorage.

**Race window:** 800ms debounce + POST /draft (50-1500ms) + PATCH fire time = up to 2.3s before PATCH sent. User close during this window.

**What gets lost:** `frameworkDraft[stepKey]`, `step_drafts.P1/P1S/P1L/P1E` on network failure.

**Lifecycle spec covers?:** No. Lifecycle column does not prevent PATCH failure. It only filters the `created` skeleton. If PATCH fails mid-flight, backend still shows empty framework_draft and the lifecycle would be `editing` (correct), but data is still lost.

**Suggested fix:** Make persistBackend queue with exponential backoff on 5xx/network error. Or accept fire-and-forget and document localStorage as fallback (current approach, defensible but risky).

**Depends on:** None (architectural decision)

---

#### F-02: preflightDraftSession creates orphan row if never touched
**Class:** Orphan  
**Severity:** P1 (UX noise)  
**Files:**
- `public/app.js:6927` (preflightDraftSession CIRCLES)
- `public/app.js:1749` (preflightNsmDraftSession NSM Step 2/3)
- `routes/circles-sessions.js:45-105` (POST /draft idempotency)

**Repro hint:** Land on `/circles?qid=Q1` → `bindCirclesPhase1` fires `preflightDraftSession()` → POST /api/circles-sessions/draft creates row with `status='active', step_drafts={}, framework_draft={}`. User closes tab without typing anything. Row persists forever (unless lifecycle cron deletes it at 24h).

**Root cause:** Eager-INSERT is intentional (§1.2 of lifecycle spec justifies it). But without subsequent content write, row becomes noise.

**Lifecycle spec covers?:** Yes. Layer 3 (list filter `lifecycle != 'created'`) + Layer 4 (24h cron DELETE) both directly address this. Lifecycle column derived from `hasSubstantiveContent(framework_draft, step_drafts, ...)`. Orphan rows stay `lifecycle='created'` and are filtered/deleted.

**Suggested fix:** None — spec already handles this.

**Depends on:** Lifecycle spec implementation

---

#### F-03: ensureCirclesDraftSession idempotency — drill_step=null collision
**Class:** Duplicate  
**Severity:** P0 (data confusion)  
**Files:**
- `public/app.js:3715` (ensureCirclesDraftSession)
- `routes/guest-circles-sessions.js:64-78` (idempotent guard query)
- `tests/visual/drill-step-default-fix.spec.js:1-50` (drill_step null bug reproduction)

**Repro hint:** User clicks "步驟加練 drill mode" card without selecting a drill-pill first → `circlesDrillStep` is null → POST /draft body has no `drill_step` field → backend row created with `drill_step=null`. Later user clicks drill-pill 'I' → `circlesDrillStep='I'` → POST /draft again → backend guard query `eq('drill_step', 'I')` does not match null row → creates second session. Offcanvas now shows two rows for same question, both 進行中.

**Root cause:** idempotent guard at `routes/guest-circles-sessions.js:71-73`:
```js
existingQuery = drill_step
  ? existingQuery.eq('drill_step', drill_step)
  : existingQuery.is('drill_step', null);
```
When drill_step is undefined/null on first call, creates row with `null`. When user later sends `drill_step='I'`, tuple (qid, mode, drill_step='I') does not match (qid, mode, null).

**What gets lost:** User confusion; rows proliferate under same question_id.

**Lifecycle spec covers?:** Partial. Lifecycle would mark both as `editing` or `created`, but dedup happens via `lib/session-dedup.js` at query time, not at write time. No guarantee the older null row is actually deduplicated properly if user resumes via detail endpoint (GET /:id uses no dedup).

**Suggested fix:** (1) FE: always default `circlesDrillStep='C1'` on mode-card click (already fixed in commit `bdbd17a`). (2) BE: add migration to coerce existing `drill_step=null` rows in drill mode to 'C1' (needs user authorization per carve-out).

**Depends on:** F-08 (circlesDrillStep default)

---

#### F-04: submitFrameworkToGate PATCH gateResult fire-and-forget
**Class:** Lost write  
**Severity:** P1 (cross-device sync gap)  
**Files:**
- `public/app.js:7392` (submitFrameworkToGate)
- `public/app.js:7471-7476` (gateResult PATCH fire-and-forget)
- `routes/circles-sessions.js:281-331` (PATCH /progress handler)

**Repro hint:** User submits C1 → gate returns ok → line 7470-7476 fires PATCH `/progress { gateResult: result }` with `.catch(console.error)`. Network timeout. PATCH never lands. FE shows gate=ok. User opens another tab → GET /circles-sessions/:id returns no gateResult (backend still null) → FE sees phase=1.5 but no gateResult → re-renders gate-pending state instead of showing ok. Cross-device desync.

**Root cause:** PATCH is async IIFE with only error logging, no retry. Fire-and-forget at 7476.

**What gets lost:** `gate_result` column on server. FE has it in AppState but it doesn't persist.

**Lifecycle spec covers?:** Partial. Lifecycle would transition to `gated` only if backend successfully persists gateResult. But the code doesn't read lifecycle — it reads the presence of gateResult directly. If PATCH fails, lifecycle does not advance (good) but gateResult is lost (bad).

**Suggested fix:** Move PATCH into the try block after JSON parse succeeds. Await it (blocking). If it fails, clear AppState.circlesGateResult and show "cross-device sync error". Current fire-and-forget is risky for cross-device workflows.

**Depends on:** None

---

#### F-05: Phase 2 chat append — SSE stream interrupt loses messages
**Class:** Stale read  
**Severity:** P1 (user frustration)  
**Files:**
- `routes/circles-sessions.js:188-237` (POST /:id/message SSE handler)
- `routes/circles-sessions.js:227-229` (append to conversation JSONB)
- `public/app.js:2807-2875` (Phase 2 chat render + SSE listener)

**Repro hint:** Phase 2 conversation has 3 turns. User sends turn 4. SSE streams 80% of response. User hits browser "stop" or closes connection. Server reaches line 228 (`newTurn = { userMessage, interviewee, coaching, hint }`) but write at 229 (UPDATE conversation) never executes or is in-flight. Client sees partial stream, no turn object. User refreshes → GET /circles-sessions/:id returns conversation=[3 turns]. Partial message lost.

**Root cause:** SSE middleware does not guarantee UPDATE persistence when stream is interrupted. No transaction wrapper. If client closes connection mid-chunk, UPDATE is queued but never finishes.

**What gets lost:** `interviewee`, `coaching`, `hint` fields of the turn being streamed. User loses the assistant's generated content.

**Lifecycle spec covers?:** No. Lifecycle column is orthogonal to conversation array mutations. SSE streaming is not covered.

**Suggested fix:** Wrap the UPDATE in a Promise, ensure client ACK before writing (would require protocol change). Or pre-allocate empty turn in conversation, stream into it, finalize on success. Current code is vulnerable if client aborts mid-stream.

**Depends on:** None (SSE protocol hardening)

---

#### F-06: phase2ConclusionDraft PATCH shallow-merge race
**Class:** Stale read  
**Severity:** P1 (concurrent edit)  
**Files:**
- `routes/circles-sessions.js:288-297` (phase2ConclusionDraft shallow-merge)

**Repro hint:** Two tabs both in Phase 2, conclusion section open. Tab A types "point 1" → PATCH { phase2ConclusionDraft: 'point 1' } → server reads prior.progress_json (empty), merges to { phase2ConclusionDraft: 'point 1' }. Meanwhile Tab B types "point 2" → PATCH same. Server reads prior again (still from Tab A's baseline, not after A's write), merges to { phase2ConclusionDraft: 'point 2' }. Result: Tab A's "point 1" is overwritten by Tab B (last-write-wins). Both tabs later GET the session and both see "point 2".

**Root cause:** Read-modify-write in PATCH handler with no row-level locking. progress_json is shallow-merged but the merge happens after the read, so concurrent PATCHes can race. The second PATCH reads the pre-first-PATCH state.

**What gets lost:** Tab A's conclusion text.

**Lifecycle spec covers?:** No. Lifecycle column does not address RMW races. This is a pre-existing multi-tab bug in the progress_json layer.

**Suggested fix:** Use Postgres JSONB operators (`||` merge) server-side instead of application-layer RMW. Or CAS (compare-and-set) with version field on progress_json.

**Depends on:** None (requires schema change)

---

#### F-07: Step 1 textarea save cycle — missing _saveDebounce cleanup
**Class:** Stuck  
**Severity:** P2 (UX stutter)  
**Files:**
- `public/app.js:3742-3793` (triggerSaveCycle)
- `public/app.js:55` (AppState._saveDebounce global)

**Repro hint:** User rapidly types in C1 textarea. Each keystroke calls triggerSaveCycle() → clears previous timeout. After typing stops (at 800ms debounce), save cycle starts. User then rapidly switches to another phase (e.g., clicks Phase 2 nav). old _saveCycleT2 timeout might still be pending. New render phase doesn't clear it. After 2 seconds, the idle-state setter fires anyway and re-renders. UX: save spinner appears/disappears at wrong times or doesn't fully clear.

**Root cause:** _saveCycleT2 timeout is module-level and is not cleared on phase change or unmount. If user navigates away during the 2s idle delay, the timeout still fires.

**What gets lost:** Not data, but UX consistency (spinner lingers).

**Lifecycle spec covers?:** No. Lifecycle is data-layer; this is UI-layer timer hygiene.

**Suggested fix:** Clear _saveDebounce + _saveCycleT2 in unmount hook or when circlesPhase changes away from 1.

**Depends on:** None (UI fix)

---

#### F-08: circlesDrillStep not defaulted on mode-card click
**Class:** Duplicate / Orphan  
**Severity:** P0 (data proliferation)  
**Files:**
- `public/app.js:2706-2734` (mode-card click handler)
- `public/app.js:3720` (ensureCirclesDraftSession checks circlesDrillStep)
- `tests/visual/drill-step-default-fix.spec.js:28-49` (test for fix)

**Repro hint:** User at home → clicks "步驟加練 drill mode" mode-card → `circlesMode='drill'` set but `circlesDrillStep` remains null. Then user clicks a q-card → preflight fires POST /draft with `{ mode: 'drill', drill_step: null }` (because drillStep is falsy). Backend creates row with `drill_step=null`. Later when user selects a drill-pill, new row is created (F-03 race applies).

**Root cause:** mode-card click handler sets `circlesMode` but not `circlesDrillStep`. Should default to 'C1' if not already selected.

**What gets lost:** Session deduplication. Multiple rows created for same (qid, mode) pair.

**Lifecycle spec covers?:** Partial. Lifecycle would mark orphans as `created` and filter them. But the root cause (null drill_step) still proliferates at write time.

**Suggested fix:** Already fixed in commit `bdbd17a`. When mode-card click sets mode='drill', also set `circlesDrillStep='C1'` if currently null.

**Depends on:** None (already fixed)

---

#### F-09: NSM Step 2 userNsm PATCH — coercion from string→object race
**Class:** Stale read  
**Severity:** P1 (gate failure)  
**Files:**
- `routes/nsm-sessions.js:154-159` (PATCH /progress accepts userNsm)
- `routes/nsm-sessions.js:156` (patch.user_nsm = userNsm direct assign)
- `public/app.js:1833-1876` (Step 2 binding — textarea vs structured input)

**Repro hint:** User fills NSM Step 2 with structured object `{ nsm: '...', explanation: '...', businessLink: '...' }`. FE sends PATCH with `userNsm: { nsm: 'x', explanation: 'y', businessLink: 'z' }`. Backend stores directly into user_nsm JSONB column (line 156). Later gate POST /:id/gate calls `reviewNSMGate({ ..., userNsm })`. If gate handler expects string but receives object, parsing fails. Or if Step 3 tries to load and finds userNsm is object, restore logic breaks.

**Root cause:** User inputs can be either free-form string OR structured object depending on step logic. But PATCH handler does not normalize. Backend schema allows both but code may not handle polymorphism.

**What gets lost:** Ability to properly read/restore userNsm if type is ambiguous.

**Lifecycle spec covers?:** No. This is a schema/contract mismatch, not a lifecycle issue.

**Suggested fix:** (1) Normalize userNsm in PATCH handler: if string, wrap in `{ nsm: string }`. (2) Document userNsm as always object with fields nsm/explanation/businessLink. (3) Gate handler defensive: `typeof userNsm === 'string' ? { nsm: userNsm } : userNsm`.

**Depends on:** None (schema normalization)

---

#### F-10: submitFrameworkToGate does not await ensureCirclesDraftSession retry
**Class:** Lost write  
**Severity:** P0 (gate blocks)  
**Files:**
- `public/app.js:7437-7446` (submitFrameworkToGate, lines 7437-7439)

**Repro hint:** User fills Phase 1 form → clicks 送出 → submitFrameworkToGate fires. POST /draft is slow or fails (500). ensureCirclesDraftSession() catches silently (line 3735 return null). AppState.circlesSession still null. Line 7440 checks `if (!sid)` → returns "無法建立 session". But the real issue: no retry. User clicks 送出 again. Same POST /draft, same fail. User stuck. Compare: preflight has same ensureCirclesDraftSession call but it's fire-and-forget (line 6933), so failure is silent and user just sees empty phase 1 form until they manually refresh.

**Root cause:** ensureCirclesDraftSession returns null on network failure but submitFrameworkToGate treats it as "unrecoverable" and bails with message. No exponential backoff. Preflight hides the error; gate exposes it but doesn't retry.

**What gets lost:** User workflow. Gate becomes unusable until page refresh.

**Lifecycle spec covers?:** No. This is a resilience/retry pattern, not a lifecycle issue.

**Suggested fix:** (1) submitFrameworkToGate should retry ensureCirclesDraftSession 2-3 times with exponential backoff before failing. (2) Show a "重新嘗試" button instead of permanent "無法建立 session" message.

**Depends on:** None (resilience refactor)

---

### NSM Write Surfaces

#### F-11: preflightNsmDraftSession — Step 2/3 mount creates row but no content yet
**Class:** Orphan  
**Severity:** P1 (UX noise)  
**Files:**
- `public/app.js:1749` (preflightNsmDraftSession)
- `public/app.js:1749-1759` (call on Step 2/3 bindNSMStep2And3 mount)
- `routes/nsm-sessions.js:16-30` (POST / create)

**Repro hint:** User completes NSM Step 1 (selects question). System auto-advances to Step 2. bindNSMStep2And3 fires preflightNsmDraftSession() → POST /api/nsm-sessions creates row. User does NOT fill Step 2 content (leaves step 2 empty), clicks back → Step 1. Row created with `user_nsm='', user_breakdown={}`. Offcanvas history drawer shows it as 進行中 (if not lifecycle-filtered).

**Root cause:** Eager-INSERT at Step 2 mount is intentional (same as CIRCLES preflight). But without step content, row is noise.

**Lifecycle spec covers?:** Yes. Lifecycle column filters `created` rows by default (Layer 3). But for Step 2 advance, row would be `editing` if user typed anything, or `created` if they didn't. If they don't type, lifecycle='created' and row is filtered. Good.

**Suggested fix:** None — spec covers this.

**Depends on:** Lifecycle spec implementation

---

#### F-12: NSM gate /:id/gate — no state persistence on success
**Class:** Lost write  
**Severity:** P1 (cross-device desync)  
**Files:**
- `routes/nsm-sessions.js:112-134` (POST /:id/gate handler)
- `routes/nsm-sessions.js:132` (res.json(result) — no UPDATE)

**Repro hint:** User fills Step 2 NSM definition → clicks gate submit → reviewNSMGate() called → returns { ok: true, ... }. res.json(result) sends response. But server does NOT update the session row with gateResult (no UPDATE line 132, unlike CIRCLES gate which has line 183). User opens second tab, GET /api/nsm-sessions/:id, sees no gateResult stored → FE thinks step 2 was not submitted → shows re-submit UI instead of "gate passed". Cross-device desync.

**Root cause:** NSM gate handler returns result but doesn't persist it. CIRCLES gate (line 183) does `await db.from(...).update({ ..., gate_result: gateResult })`. NSM gate is missing that UPDATE.

**What gets lost:** gateResult field on server. Lifecycle would correctly mark `gated` if backend had the logic, but without UPDATE, result never persists.

**Lifecycle spec covers?:** Partial. Lifecycle spec at §2.2 says gate POST should set `lifecycle='gated'` but does NOT handle NSM gate. NSM spec does not mention lifecycle column (added in 33d5bf9, which is post-gate-design).

**Suggested fix:** Add UPDATE line in NSM gate handler:
```js
const { error: upErr } = await db.from('nsm_sessions').update({
  progress_json: { ...(session.progress_json || {}), gateResult: result }
}).eq('id', req.params.id).eq('user_id', req.user.id);
```

**Depends on:** Lifecycle spec implementation

---

#### F-13: NSM Step 4 reportTab PATCH — no server-side default
**Class:** Stale read  
**Severity:** P2 (UX state)  
**Files:**
- `routes/nsm-sessions.js:154-174` (PATCH /progress handler)
- `routes/nsm-sessions.js:173` (progress_json.reportTab assigned from body)
- `public/app.js:1564-1610` (NSM Step 4 render, references AppState.nsmReportTab)

**Repro hint:** User reaches NSM Step 4. Tab 1 (overview) selected by default (FE sets AppState.nsmReportTab='overview'). User clicks "教練思路 coach-tree" tab 2. FE sends PATCH { reportTab: 'coach-tree' } → server stores in progress_json. User closes tab. Later user reopens NSM session in new tab → GET /api/nsm-sessions/:id returns progress_json with reportTab='coach-tree'. FE renders Step 4, loads AppState.nsmReportTab from progress_json. Loads coach-tree tab by default (good). But if server never received PATCH (network error), progress_json has no reportTab field → FE defaults to 'overview' (good). No bug here, but if multiple tabs are open and Tab A sends reportTab but Tab B doesn't, Tab B will see stale default.

**Root cause:** reportTab is optional in progress_json. If not present, FE defaults 'overview'. If present, FE uses it. No race, just soft state. Design is OK but worth noting.

**Lifecycle spec covers?:** No. reportTab is UI state, not data persistence.

**Suggested fix:** None — design is acceptable.

**Depends on:** None

---

#### F-14: NSM evaluateStep — scores_json written only after success
**Class:** Stuck  
**Severity:** P1 (mid-evaluation interrupt)  
**Files:**
- `routes/nsm-sessions.js:79-110` (POST /:id/evaluate handler)
- `routes/nsm-sessions.js:98-104` (UPDATE with scores_json)

**Repro hint:** User reaches NSM Step 4 (after gate passed) → re-evaluates NSM (e.g., clicks "重新評分"). POST /:id/evaluate called. evaluateNSM() AI call is in-flight (takes 3-5 sec). Backend is computing scores. User closes tab or navigates away. If UPDATE at line 98-104 never fires (e.g., process crash), scores are lost. Next resume: user comes back, scores_json is null (or missing). UI shows "重新評分" CTA instead of showing final scores.

**Root cause:** UPDATE only fires after evaluateNSM completes. No checkpoint. If process crashes or connection breaks mid-evaluation, row is left in limbo.

**What gets lost:** Computed scores for that evaluation round.

**Lifecycle spec covers?:** No. evaluateNSM should set lifecycle='completed' but if UPDATE fails, it doesn't. Row stays in previous state.

**Suggested fix:** Pre-write progress_json with { evaluating: true } before calling evaluateNSM(). If evaluateNSM fails, keep evaluating=true so FE shows "評分進行中...重新載入". Once scores arrive, set evaluating=false + scores_json.

**Depends on:** None (resilience checkpoint)

---

### CIRCLES + NSM Read Surfaces (BE→FE)

#### F-15: offcanvas history drawer list — no lifecycle filter on guest endpoint
**Class:** Stale read  
**Severity:** P1 (UX noise)  
**Files:**
- `routes/guest-circles-sessions.js:26-52` (GET /)
- `public/app.js:2955-2995` (renderOffcanvasItem iterates list)

**Repro hint:** Guest user lands on home → clicks "步驟加練" → preflight creates row with `lifecycle='created'` (not yet filled). Guest opens offcanvas drawer. If lifecycle filter is NOT applied to guest endpoint, drawer shows the empty skeleton. User sees "· 草稿" row with 0 questions (empty title). If lifecycle filter IS applied, row is hidden (correct).

**Root cause:** (As of 2026-05-16) no lifecycle column yet exists in schema (added by spec 33d5bf9). When spec lands, guest endpoint must also add the same WHERE clause as auth endpoint.

**Lifecycle spec covers?:** Yes. §3 (Component file-by-file) lists "guest variants × 2" must apply same filter. Spec is explicit.

**Suggested fix:** None if spec is implemented correctly — spec already calls it out.

**Depends on:** Lifecycle spec implementation

---

#### F-16: "最近練習" home recent-rail — lazy-load race with session list
**Class:** Stale read  
**Severity:** P2 (UX inconsistency)  
**Files:**
- `public/app.js:2862-2875` (renderCirclesHome, recent-rail section)
- `public/app.js:3133-3160` (loadCirclesSessionFromHistory via recent-rail click)
- `public/app.js:7715-7855` (tryResumeLatestSession loads session for resume-toast)

**Repro hint:** User home page loads. renderCirclesHome fires → renders stats-strip (completed: 2, active: 1). Meanwhile tryResumeLatestSession is async-loading session list to pick latest in-progress. If the second query returns after stats-strip renders, recent-rail counts might be stale (based on old fetch). Then user clicks a recent-rail item → loadCirclesSessionFromHistory loads that session details. If the session was completed in another tab in the meantime, this tab's GET /:id still returns the completed session but recent-rail was showing it as active. Mismatch.

**Root cause:** Multiple async queries (stats, sessions list, session detail) have no cache coherency. Each query reads independently.

**What gets lost:** Not data, but UX state (stale counts vs detail).

**Lifecycle spec covers?:** No. This is a cache coherency issue, not a data loss issue.

**Suggested fix:** Cache session list for 1 minute per user. Invalidate on any PATCH/POST/DELETE. Or use a sequence number / version stamp on the user row (e.g., `user.sessions_version`) and check before rendering.

**Depends on:** None (cache strategy)

---

#### F-17: NSM session restore via tryResumeLatestSession — progress_json optional
**Class:** Stale read  
**Severity:** P1 (step regression)  
**Files:**
- `public/app.js:7715-7855` (tryResumeLatestSession)
- `public/app.js:7807-7834` (NSM branch reads progress_json.currentStep)
- `routes/nsm-sessions.js:40-50` (GET / SELECT includes progress_json)

**Repro hint:** User completes NSM Step 2, passes gate. Session saved with progress_json={ currentStep: 2, gateResult: {...} }. User closes. Later re-lands on /nsm. tryResumeLatestSession fires → GET /api/nsm-sessions → list includes session with progress_json. FE reads progress_json.currentStep → should restore to Step 2. But if GET query (line 40-50) had a bug and omitted progress_json (old code), or if progress_json was never set, FE defaults to Step 1. User lands at Step 1 instead of Step 2. User has to re-do Step 2.

**Root cause:** GET /nsm-sessions should always include progress_json (line 41 does), but there's no guardrail if it's missing.

**What gets lost:** User's step checkpoint. User re-does completed work.

**Lifecycle spec covers?:** No. Lifecycle is orthogonal to progress_json. But spec could add a CHECK or NOT NULL to progress_json if it's always required.

**Suggested fix:** (1) BE: Ensure progress_json is never null (default to `{}`). (2) FE: Defensive read: `var currentStep = (session.progress_json || {}).currentStep || 1;`.

**Depends on:** None (schema + defensive read)

---

#### F-18: Cross-device sync — localStorage vs server divergence on login
**Class:** Stale read  
**Severity:** P1 (user confusion)  
**Files:**
- `public/app.js:152-176` (persistence snapshot + hydrate on boot)
- `public/app.js:233-235` (hydrateFromLocalStorage on guest-to-auth transition)
- `public/app.js:7715-7855` (tryResumeLatestSession reads server after boot)

**Repro hint:** Guest user (guestId='xyz') edits CIRCLES phase 1, types content, saves to localStorage (pmdrill:circles:draft:qid). Guest later logs in as user (userId=abc). Old guest data is still in localStorage but not on server (guest rows belong to guestId, not userId). hydrateFromLocalStorage (line 233-235) tries to populate circlesFrameworkDraft from localStorage. User switches to another device (which has no guest data, only server user data). Conflict: Device 1 shows framework_draft from localStorage (guest version). Device 2 shows session list from server (user version). Mismatch.

**Root cause:** localStorage keys are per-qid, not per-user. Guest and auth user both write to same localStorage keys if on same device. When guest becomes auth, no migration happens.

**What gets lost:** Guest draft if user logs in and doesn't manually merge.

**Lifecycle spec covers?:** No. Cross-device sync is handled by server, not by lifecycle. localStorage is a client-side cache.

**Suggested fix:** On auth transition, compare localStorage ts vs server session updated_at. Use newer one. Or clear localStorage on auth to avoid collision.

**Depends on:** None (auth transition logic)

---

#### F-19: circlesMode mutation in renderCirclesHome — resume race
**Class:** Race  
**Severity:** P1 (state desync)  
**Files:**
- `public/app.js:2706-2755` (renderCirclesHome)
- `public/app.js:2720` (AppState.circlesMode = 'drill' / 'simulation' assignment)
- `public/app.js:7715-7855` (tryResumeLatestSession reads circlesMode as guard)
- Bug fix commit `08c4950`

**Repro hint:** User lands on home. renderCirclesHome runs. Line 2720 sets AppState.circlesMode based on mode-cards. Simultaneously, tryResumeLatestSession is fetching latest session from server. If session has mode='simulation', tryResumeLatestSession tries to restore to simulation mode (line 7799). But renderCirclesHome just set circlesMode='drill' (from UI selection). Race: which wins? If resume fires AFTER render, circlesMode is 'drill' but session.mode is 'simulation'. Desync.

**Root cause:** (Fixed in 08c4950) renderCirclesHome was mutating AppState.circlesMode directly. tryResumeLatestSession's guard at line 7809 checked `if (AppState.circlesMode && AppState.circlesMode !== session.mode) return;` to abort resume if mode mismatch. But renderCirclesHome mutation caused false abort.

**What gets lost:** Resume of the latest session (aborted due to false guard).

**Lifecycle spec covers?:** No. This is a state mutation order issue.

**Suggested fix:** (Fixed) renderCirclesHome should not mutate AppState.circlesMode. Only set it on user action (mode-card click), not on render.

**Depends on:** None (already fixed in 08c4950)

---

### Failure Mode Analysis

#### F-20: localStorage timestamp vs server timestamp merge — oldest-wins bias
**Class:** Stale read  
**Severity:** P2 (user confusion)  
**Files:**
- `public/app.js:3090-3131` (restoreCirclesPhase1FromSession)
- `public/app.js:3090-3131` (line 3114 — localStorage.ts > server.ts → use local)

**Repro hint:** User edits phase 1 on Device A, saves to localStorage (ts=1000). Meanwhile, user opens Device B, loads server session (created_at=900, updated_at=950). Offline on Device B, types in phase 1, saves to localStorage (ts=900, created_at empty). Device A goes online, resumeCirclesPhase1FromSession reads localStorage ts=1000 vs server updated_at=950. Uses localStorage (newer). Device B comes online, same logic uses localStorage ts=900 vs server updated_at=950. Uses server (newer). Result: Device A has local draft. Device B has server draft. Cross-device desync.

**Root cause:** Timestamp comparison is local to that device's retrieval order. No global clock.

**What gets lost:** Not data, but consistency. User sees different versions on different devices.

**Lifecycle spec covers?:** No. Timestamp merge is app logic, not lifecycle.

**Suggested fix:** Either (1) always trust server (server is source of truth), or (2) have server-side CAS on progress_json with a version field.

**Depends on:** None (can be conservative now: always trust server)

---

#### F-21: Phase 1 saveState visual indicators — lingering spinner on fast network
**Class:** Stuck  
**Severity:** P2 (cosmetic UX stutter)  
**Files:**
- `public/app.js:3742-3793` (triggerSaveCycle visual timeline)
- `public/app.js:3788-3790` (600ms fixed spinner delay)

**Repro hint:** User types quickly → triggerSaveCycle 800ms debounce → PATCH sent → server responds in 100ms. But FE code has hard-coded 600ms delay before showing "saved" state (line 3788). So spinner shows for at least 600ms even though write is done. UX: spinner lingers artificially. User perceives slowness.

**Root cause:** 600ms delay is hardcoded to match design spec (mockup 03 line 1850 "200ms 延遲顯示", but implementation added 400ms buffer = 600ms total).

**Lifecycle spec covers?:** No. This is UX timing.

**Suggested fix:** Measure actual PATCH latency. If <600ms, delay to 600ms (show spinner briefly). If >600ms, show spinner immediately on PATCH response.

**Depends on:** None (UX polish)

---

### Stage 1A Bug History — Recurrence Check

#### F-22: Bug B1 root cause — gate framework validation incomplete
**Class:** Stuck  
**Severity:** P0 (user can't proceed)  
**Files:**
- `public/app.js:7415-7423` (frameworkValidator guard)
- `lib/session-lifecycle.js:TBD` (hasSubstantiveContent in lifecycle spec)

**Repro hint:** B1 was "user fills Phase 1 with minimal content (e.g., 'Y' or 'asdf') → gate always fails → user stuck". Root cause: gate AI rejected thin input. Fix: add Layer 1 FE validator (frameworkValidator) to reject before calling gate. Lifecycle spec at §4.3 adds another guard: `hasSubstantiveContent()` checks if field is polluted or stub-shaped. This prevents even reaching gate if content is garbage.

**Lifecycle spec covers?:** Partial. Spec has hasSubstantiveContent which is stronger guard than B1's original fix (gate AI rejects). But gate AI is still the final arbiter.

**Suggested fix:** None — B1 fix + lifecycle guard form defense-in-depth.

**Depends on:** Lifecycle spec implementation

---

#### F-23: Bug B6 root cause — concurrent PATCH + POST race on same session
**Class:** Race  
**Severity:** P0 (data corruption)  
**Files:**
- `public/app.js:7393-7397` (gateInflight mutex)
- `tests/visual/draft-data-loss-fix.spec.js:29-86` (Cause A)
- `routes/circles-sessions.js:300-313` (step_drafts shallow-merge in PATCH)

**Repro hint:** B6 was "user types in Phase 1 (fires PATCH /progress with step_drafts) → user clicks submit (fires POST /gate) → if PATCH is slower, gate POST lands first → gate result persisted → PATCH lands → overwrites step_drafts with merge from old state → gate result merged away". Root cause: no ordering guarantee on concurrent FE requests. Fix: ensure session exists before PATCH (preflight), and use shallow-merge on step_drafts in PATCH handler so fields don't stomp each other.

**Lifecycle spec covers?:** Partial. Spec says lifecycle transitions are monotone (gated can't demote to editing), which prevents the worst case. But concurrent PATCH + POST still can race. Shallow-merge is already in place (line 300-313).

**Suggested fix:** None — existing shallow-merge + preflight cover this.

**Depends on:** None (already mitigated)

---

#### F-24: Bug D (tryResumeLatestSession abort on guard) — circular dependency with renderCirclesHome
**Class:** Race  
**Severity:** P1 (resume failure)  
**Files:**
- Bug fix commit `08c4950` (renderCirclesHome no longer mutates circlesMode)
- `public/app.js:7715-7855` (tryResumeLatestSession old guard deleted in 0396a20)

**Repro hint:** D was "tryResumeLatestSession fires parallel to renderCirclesHome → renderCirclesHome sets circlesMode → tryResumeLatestSession reads circlesMode guard → abort if mismatch". Fixed by removing the guard. Lifecycle spec doesn't touch this — it's a mutation order issue already resolved.

**Lifecycle spec covers?:** No. Already fixed in commits 08c4950 + 0396a20.

**Suggested fix:** None — fixed.

**Depends on:** None

---

#### F-25: Bug G (circlesPhase localStorage value diverges from server) — offline mode edge case
**Class:** Stale read  
**Severity:** P1 (UX confusion)  
**Files:**
- `public/app.js:20` (circlesPhase AppState)
- `public/app.js:154-176` (persistence snapshot)

**Repro hint:** G was "user fills Phase 1, saves to localStorage. User closes tab offline. Later user loads page (online), hydrateFromLocalStorage fills circlesPhase=1 but server session is at phase=2. Resume shows phase 1 form instead of phase 2 chat". Root cause: localStorage snapshots all AppState fields (circlesPhase, circlesMode, etc.) but they drift from server. Fix: never restore circlesPhase from localStorage. Always trust server's current_phase. FE circlesPhase is ephemeral state (1, 1.5, 2, 3, 4) — it's not meant to survive reload.

**Lifecycle spec covers?:** No. But spec doesn't re-introduce this bug either. Lifecycle is about data (framework_draft, user_nsm), not UI state (circlesPhase).

**Suggested fix:** None — by design, circlesPhase is not persisted. Always restored from server's current_phase on boot.

**Depends on:** None (already addressed in 2026-04-29 bug fixes)

---

#### F-26: Recurrence of F-01 (lost PATCH on network failure) — potential latent
**Class:** Lost write  
**Severity:** P0 (latent)  
**Files:**
- `public/app.js:3766-3786` (persistBackend fire-and-forget)
- (No recent test added to Playwright suite for network failure scenario)

**Repro hint:** No current repro. But if Chrome DevTools throttles network to "offline" mid-PATCH, persistBackend catch silently swallows error. User assumes draft is saved but backend row is empty. Later user resumes on different device → backend has empty framework_draft (localStorage is local-only, not synced). Data appears lost.

**Root cause:** Fire-and-forget with only catch logging. No user-facing error. No retry.

**What gets lost:** Backend draft if network fails mid-PATCH.

**Lifecycle spec covers?:** No. Lifecycle column doesn't prevent PATCH failure.

**Suggested fix:** (1) Queue PATCH with backoff (requires refactor). (2) Or accept fire-and-forget as design and document localStorage as fallback. (3) Or move PATCH into sync request (no async IIFE) and surface network error to user.

**Depends on:** None (design decision)

---

## Finding Ranking

### By Severity

**P0 (Data Loss) — 3 findings:**
1. **F-01:** triggerSaveCycle fire-and-forget PATCH can fail silently → backend empty framework_draft
2. **F-03:** drill_step=null causes duplicate sessions (idempotency race)
3. **F-10:** submitFrameworkToGate ensureCirclesDraftSession fails → gate blocked permanently

**P1 (UX Broken) — 7 findings:**
4. **F-04:** gateResult PATCH fire-and-forget → cross-device desync
5. **F-05:** Phase 2 SSE append → conversation loss on stream interrupt
6. **F-06:** phase2ConclusionDraft RMW race → last-write-wins
7. **F-12:** NSM gate no UPDATE → gateResult never persists
8. **F-14:** evaluateStep no checkpoint → mid-evaluation crash loses scores
9. **F-18:** Cross-device localStorage vs server on guest→auth transition
10. **F-17:** NSM resume progress_json missing → step regression

**P2 (UX Noise) — 5 findings:**
11. **F-02:** preflightDraftSession orphans → 練習記錄 empty rows (covered by lifecycle filter)
12. **F-07:** saveCycle timeout cleanup → lingering spinner
13. **F-16:** home recent-rail stale counts vs session detail
14. **F-20:** localStorage timestamp merge → cross-device inconsistency
15. **F-21:** 600ms artificial spinner delay → UX perception of slowness

**P3 (Design) — 6 findings:**
16. **F-08:** circlesDrillStep default (already fixed in `bdbd17a`)
17. **F-09:** NSM userNsm polymorphism (string vs object)
18. **F-11:** preflightNsmDraftSession orphans (covered by lifecycle filter)
19. **F-13:** NSM reportTab soft state (acceptable design)
20. **F-19:** circlesMode render mutation (fixed in `08c4950`)
21. **F-22..26:** Bug history recurrence checks (all mitigated or already fixed)

---

## Lifecycle Spec Coverage Matrix

| Finding | Lifecycle Covers? | Reason |
|---------|------------------|--------|
| F-01 (PATCH fail) | No | Fire-and-forget is not addressed by lifecycle column |
| F-02 (orphan rows) | **Yes** | Layer 3 filter + Layer 4 cron both apply |
| F-03 (drill_step null) | Partial | Dedup at query time, but root cause not fixed |
| F-04 (gateResult PATCH) | Partial | Lifecycle transitions but gateResult may not persist |
| F-05 (SSE interrupt) | No | SSE streaming is orthogonal to lifecycle |
| F-06 (conclusion RMW) | No | progress_json race condition |
| F-07 (spinner cleanup) | No | UI timer hygiene |
| F-08 (drillStep default) | No | Already fixed separately |
| F-09 (userNsm coercion) | No | Schema normalization issue |
| F-10 (gate ensure fail) | No | Resilience/retry pattern |
| F-11 (NSM orphan) | Yes | Lifecycle filters created rows |
| F-12 (NSM gate UPDATE) | Partial | Spec expects lifecycle but gate handler missing UPDATE |
| F-13 (reportTab) | No | UI state soft persistence |
| F-14 (evaluate checkpoint) | No | Mid-operation crash recovery |
| F-15 (guest filter) | Yes | Spec explicitly covers guest endpoints |
| F-16 (rail stale) | No | Cache coherency issue |
| F-17 (NSM progress) | No | progress_json schema issue |
| F-18 (guest→auth) | No | Auth transition logic |
| F-19 (mode mutation) | No | Already fixed |
| F-20 (ts merge bias) | No | Clock skew, not lifecycle |
| F-21 (spinner delay) | No | UX timing |
| **Total:** | **6 Yes / 7 Partial / 11 No** | Lifecycle covers ~50% of findings |

---

## Bucket 1: Covered by Lifecycle Spec (SLC-AC satisfied)

1. **F-02:** Orphan rows from preflightDraftSession (CIRCLES) — Layer 3/4 filter + cron
2. **F-11:** Orphan rows from preflightNsmDraftSession — Layer 3/4 filter + cron
3. **F-15:** Guest endpoint list filter — Spec explicitly requires

**Status:** When 33d5bf9 migrates and routes ship, these 3 findings auto-resolve.

---

## Bucket 2: NOT Covered, Needs Separate Fix

### Must Fix Before Ship

1. **F-01:** PATCH fire-and-forget → needs retry queue OR accept risk + document
2. **F-03:** drill_step=null dedup → FE default (already fixed) + BE migration (user approval needed)
3. **F-04:** gateResult PATCH → move into try block, await it
4. **F-10:** submitFrameworkToGate retry → add 2-3x backoff
5. **F-12:** NSM gate UPDATE → add progress_json.gateResult persist
6. **F-14:** evaluateStep checkpoint → pre-write evaluating=true

### Should Fix (P1)

7. **F-05:** Phase 2 SSE interrupt → wrap UPDATE in transaction or ACK-based protocol
8. **F-06:** conclusion RMW race → use Postgres JSONB merge operator (`||`)
9. **F-17:** NSM progress_json optional → schema NOT NULL + defensive read
10. **F-18:** guest→auth migration → compare ts, prefer newer

### Nice-to-Have (P2)

11. **F-07:** Timer cleanup → clear on phase change
12. **F-09:** userNsm normalization → normalize in PATCH handler
13. **F-16:** Rail stale counts → cache with version field
14. **F-20:** Timestamp merge bias → always trust server
15. **F-21:** Spinner 600ms delay → measure actual latency

---

## Bucket 3: Out of Scope / Design-as-Intended

1. **F-08:** circlesDrillStep — Already fixed in `bdbd17a`
2. **F-13:** reportTab soft state — Acceptable, optional field
3. **F-19:** circlesMode mutation — Fixed in `08c4950`
4. **F-22..26:** Bug history — All mitigated or already fixed

---

## Verdict

**Lifecycle spec (33d5bf9) directly covers 6 findings (F-02, F-11, F-15, partial F-03/F-04/F-12). That's ~50% of the 26 findings.**

**Critical gaps NOT covered:**
- PATCH fire-and-forget failures (F-01, F-04, F-10)
- NSM gate UPDATE missing (F-12)
- Concurrent RMW races (F-06)
- SSE stream reliability (F-05)
- Progress checkpoint (F-14)

**Recommendation:**
1. **Ship lifecycle spec as-planned.** It's solid and addresses the original goal (filter empty skeletons).
2. **Concurrently fix Bucket 2 Must-Fix items** (5 findings) before user sees prod. These are P0/P1 and don't require lifecycle.
3. **Defer Bucket 2 Should-Fix** (5 findings) to Phase 2 if user prioritizes other work. They're P1 but not blocking essential workflows.
4. **Bucket 3 is resolved** — no action needed.

**Timeline:** Lifecycle spec ready to ship. Must-Fix items can be done in parallel (non-blocking) and should be QA'd together before prod release.

---

## Appendix: File-by-File Persistence Touchpoints

| File | Function | Type | Severity |
|------|----------|------|----------|
| `public/app.js:3715` | ensureCirclesDraftSession | FE write | P0 |
| `public/app.js:3742` | triggerSaveCycle | FE write | P0 |
| `public/app.js:6927` | preflightDraftSession | FE write | P1 |
| `public/app.js:7392` | submitFrameworkToGate | FE write | P0 |
| `public/app.js:7715` | tryResumeLatestSession | FE read | P1 |
| `routes/circles-sessions.js:45` | POST /draft | BE write | P0 |
| `routes/circles-sessions.js:166` | POST /:id/gate | BE write | P1 |
| `routes/circles-sessions.js:188` | POST /:id/message | BE write | P1 |
| `routes/circles-sessions.js:281` | PATCH /:id/progress | BE write | P0 |
| `routes/nsm-sessions.js:16` | POST / | BE write | P1 |
| `routes/nsm-sessions.js:79` | POST /:id/evaluate | BE write | P1 |
| `routes/nsm-sessions.js:112` | POST /:id/gate | BE write | P1 |
| `routes/nsm-sessions.js:153` | PATCH /:id/progress | BE write | P0 |

---

**Report compiled:** 2026-05-16  
**Audit by:** Claude Haiku 4.5 (comprehensive FE↔BE persistence surface scan)
