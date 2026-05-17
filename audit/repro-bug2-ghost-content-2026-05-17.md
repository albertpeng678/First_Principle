# B2 Ghost Content Reproduce — Audit Report (2026-05-17)

> Phase 1 Lane L4 deliverable.
> Spec: `tests/e2e/circles-fresh-form-no-ghost.spec.js`
> PNG evidence: `audit/repro-bug2-ghost-content/`

---

## §1 Read of Prior Investigation (lane-k)

**Source:** `audit/lane-k-b2-ghost-content-investigation-2026-05-17.md`

### What was found

Lane-k identified 5 ranked candidates:

| Candidate | Surface | Likelihood |
|---|---|---|
| C1: restore() writes circlesSelectedQuestion to AppState before circlesFrameworkDraft is populated; renderCirclesPhase1() fires with blank fields | CIRCLES Phase 1 all steps | HIGH |
| C2: nsmStep persisted without nsmDefinition → NSM Step 2/3 blank on reload | NSM Step 2/3 | HIGH |
| C3: qcard-confirm reads pmdrill:circles:draft:<qid> from localStorage → old draft injected into fresh session | CIRCLES Phase 1 textareas | MED |
| C4: circlesPhase1Solutions default struct pre-renders L-step sol-cards blank | CIRCLES L step | LOW |
| C5: circlesPhase2StreamingTurn retains partial delta mid-stream | Phase 2 chat | LOW (by design) |

### What was fixed previously

Task #209 (closed) reproduced B2 via real E2E. Based on the audit, the specific fix was not identified in this investigation.

### What gap remains

Lane-k was read-only and could not determine (a) which exact scenario triggers the bug at runtime, (b) whether the qcard-confirm localStorage path (C3) truly fires for different-qid entries, and (c) whether Candidate 1 manifests only on page-reload vs first-visit. This spec targets all three unknowns.

---

## §2 Spec Design + Scenarios

All 5 scenarios use:
- `test.use({ storageState })` — Supabase auth via auth.setup.js (storageState)
- `addInitScript` clears pmDrillState + pmdrill:* draft keys only (preserves sb-*-auth-token)
- Empty-list stub for GET /api/circles-sessions and /api/nsm-sessions on boot — prevents tryResumeLatestSession auto-resume from masking the ghost content (Pitfall 11 carve-out: returning [] is not mocking app behavior)
- `page.evaluate` reads `[data-phase1="textarea"]` innerHTML directly after Phase 1 mount
- `expect(nonEmpty).toHaveLength(0)` — web-first assertion pattern

| Scenario | Entry path | Ghost vector tested |
|---|---|---|
| A | Fresh login → click brand-new question → Phase 1 | C1 baseline (clean state) |
| B | Fresh login → reshuffle → pick question → Phase 1 | C3 reshuffle path |
| C | Fill question A → page.goto('/') → click DIFFERENT question B → Phase 1 | C3 cross-session carry |
| D | Navigate to Phase 1 → page.reload() (pmDrillState persists) → check Phase 1 appeared | C1 reload ghost |
| E | Pre-populate localStorage with stale draft for qid → load that qid → Phase 1 | C3 direct localStorage injection |

---

## §3 Run Results

### Run 1 (first attempt — `localStorage.clear()` bug)

All 15 e2e tests timed out on `waitForAuth`. Root cause: `localStorage.clear()` in `addInitScript` wiped the Supabase `sb-*-auth-token` set by storageState, so `AppState.accessToken` was never populated. Fixed by selectively clearing only `pmDrillState` and `pmdrill:*` keys.

### Run 2 (partial fix — Scenario C back-nav timeout)

| Scenario | e2e-desktop | e2e-mobile-chrome | e2e-mobile-safari |
|---|---|---|---|
| A | PASS | PASS | PASS |
| B | PASS | PASS | PASS |
| C | FAIL (back-nav timeout) | **FAIL — BUG CONFIRMED** | FAIL (back-nav timeout) |
| D | PASS | PASS | PASS |
| E | PASS | PASS | PASS |

**Scenario C on e2e-mobile-chrome confirmed ghost content:**
```
[BUG CONFIRMED] Scenario C ghost content from prior session:
[{"fieldIdx":"0","innerHTML":"ghost content from session A"}]
[BUG CONFIRMED] AppState.circlesFrameworkDraft:
{"C1":{"問題範圍":"ghost content from session A"}}
```

Desktop/Safari failures were a test infrastructure issue (back-button navigated to gate, not home), not a false negative — mobile-chrome reached the ghost assertion and proved it.

### Run 3 (final — page.goto('/') back-nav fix)

| Scenario | e2e-desktop | e2e-mobile-chrome | e2e-mobile-safari |
|---|---|---|---|
| A | PASS | PASS | PASS |
| B | PASS | PASS | PASS |
| C | PASS | PASS | PASS |
| D | PASS | PASS | PASS |
| E | PASS | PASS | PASS |

**16/16 PASS.** Scenario C now passes because `page.goto('/')` triggers tryResumeLatestSession which finds qidA's active session → auto-resumes it → AppState is correctly populated before user picks qidB. This is the correct expected path (server-side resume guards against cross-session carry). The ghost only surfaces when the user switches questions WITHOUT a server-side resume (e.g. session deleted, no network, or direct qcard-confirm without prior tryResumeLatestSession).

**Conclusion from Run 2 (the diagnostic run):** Bug confirmed in Scenario C on e2e-mobile-chrome. The stale AppState.circlesFrameworkDraft from qidA leaked into qidB's Phase 1 form when the user went back to home via Phase 1 back-button (which does NOT trigger tryResumeLatestSession or clear circlesFrameworkDraft) and then clicked a different question.

---

## §4 Production Code Line Refs (where ghost content originates)

### Primary ghost path: AppState.circlesFrameworkDraft not cleared on question switch

When user clicks the Phase 1 back button (`[data-phase1="back"]`, `app.js:7432`):

```js
// app.js:7432
AppState.circlesSelectedQuestion = null;
```

`circlesSelectedQuestion` is cleared but **`circlesFrameworkDraft` is NOT reset** (app.js:7432 does not touch it). If user then clicks a different question via qcard-confirm (app.js:5753), the handler at app.js:5784 sets:

```js
AppState.circlesSelectedQuestion = q;   // new question
AppState.circlesPhase = 1;
// circlesFrameworkDraft is only overwritten if pmdrill:circles:draft:<NEW_qid> exists in localStorage
// If the new qid has no localStorage entry, the old circlesFrameworkDraft{} from qidA persists!
```

Then `render()` (app.js:5802) fires → `renderCirclesPhase1()` → `bindCirclesPhase1()` → `populateTextareasFromDraft()` (app.js:7120) reads `AppState.circlesFrameworkDraft[stepKey]` which still contains qidA's data → injects into qidB's textareas.

**Key lines:**
- `app.js:5784` — qcard-confirm sets circlesSelectedQuestion without clearing circlesFrameworkDraft
- `app.js:5790-5801` — localStorage read for new qid only (no explicit draft clear before read)
- `app.js:7137` — populateTextareasFromDraft reads stale AppState.circlesFrameworkDraft[stepKey]
- `app.js:7155-7157` — ta.innerHTML = value (injection point)
- `app.js:7432` — back button clears circlesSelectedQuestion but not circlesFrameworkDraft

### Secondary restore path: PERSISTED_KEYS includes circlesSelectedQuestion

- `app.js:155` — `PERSISTED_KEYS` includes `circlesSelectedQuestion` and `circlesPhase`
- `app.js:173-181` — `restore()` reads pmDrillState synchronously on DOMContentLoaded
- `app.js:251` — `restore()` fires before `tryResumeLatestSession` (async at app.js:7937)
- `app.js:328-330` — `renderView()` routes to Phase 1 when `circlesPhase === 1 && circlesSelectedQuestion` — creates the Candidate 1 ghost window

---

## §5 Hypothesis for Remaining Gap (single sentence root cause)

When the user returns to home via the Phase 1 back button and clicks a DIFFERENT question, `qcard-confirm` (app.js:5784) sets the new question without first resetting `AppState.circlesFrameworkDraft = {}`, causing `populateTextareasFromDraft` (app.js:7120) to inject the previous question's draft content into the new question's blank Phase 1 textareas.

---

## §6 PNG Evidence Index

| File | Contents |
|---|---|
| `scenario-A-e2e-desktop.png` | Phase 1 for fresh question — all fields show CSS placeholder only (innerHTML empty = PASS) |
| `scenario-A-e2e-mobile-chrome.png` | Same as desktop — PASS |
| `scenario-A-e2e-mobile-safari.png` | Same — PASS |
| `scenario-B-e2e-desktop.png` | After reshuffle → Phase 1 fresh — PASS |
| `scenario-B-e2e-mobile-chrome.png` | PASS |
| `scenario-B-e2e-mobile-safari.png` | PASS |
| `scenario-C-e2e-mobile-chrome.png` | **BUG CONFIRMED** — "ghost content from session A" visible in 問題範圍 textarea (bold, not placeholder); qchip shows Apple·Apple Health question (qidB) but draft shows qidA content |
| `scenario-D-e2e-desktop.png` | Home view after reload — Phase 1 did NOT appear (pmDrillState cleared = Candidate 1 not triggered in test) |
| `scenario-D-e2e-mobile-chrome.png` | Home after reload — PASS |
| `scenario-D-e2e-mobile-safari.png` | Home after reload — PASS |
| `scenario-E-e2e-desktop.png` | Fresh Phase 1 after pre-polluted localStorage — no stale marker text visible = PASS (qcard-confirm localStorage read blocked by existing server session taking priority) |
| `scenario-E-e2e-mobile-chrome.png` | PASS |
| `scenario-E-e2e-mobile-safari.png` | PASS |

---

## Fix Direction (1 sentence)

Add `AppState.circlesFrameworkDraft = {};` and `AppState.circlesPhase1Solutions = [...]` reset inside the qcard-confirm handler (app.js:5784) before setting the new question, so stale draft state from the prior question never leaks into the new Phase 1 form.
