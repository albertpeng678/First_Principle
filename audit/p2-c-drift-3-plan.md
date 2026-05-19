# C-Drift-3 Plan — State + helper refactor (3 fixes)

> Atomic commit 3/4 of Phase 2 NSM↔CIRCLES drift Wave 2.
> Source: `audit/nsm-circles-drift-scan-2026-05-19.md` (D-7 + D-8 + D-11).
> Tracker: `audit/e2e-master-tracker.md` §2 「NSM↔CIRCLES drift scan results」.
>
> **Refactor commit** — touches more code than C-Drift-1/2 but each fix is a structural improvement (helper extraction / new state key / shared component). Risk: regression in 4 reset sites; mitigation: enumerate AppState keys via jest test.
>
> **Karpathy guardrails**:
> - §4.1 Think Before — D-7 helper signature must enumerate ALL NSM AppState keys (verify via grep nsm* keys before writing helper).
> - §4.2 Simplicity First — D-7 helper accepts NO args (mirror `resetCirclesToHome` line 3212); not parametric.
> - §4.3 Surgical Changes — D-11 abstracts CIRCLES `renderSaveIndicator` to take optional `kind` arg; do NOT rewrite CIRCLES call sites' shape.
> - §4.4 Goal-Driven — D-7 verified by jest test that fails when new key added without reset; D-8 verified by 3G throttle history click; D-11 verified by NSM Step 2 typing → visible save state indicator.

---

## §1 Scope

| # | Audit ref | App.js anchor | Effort | User-visible goal |
|---|---|---|---|---|
| 1 | D-7 (P1) | `app.js:2651-2663` + `2666-2684` + `6110-6113` + `6457-6464` — 4 inline NSM reset sites | M | 集中 reset NSM AppState → 新增 nsm* key 不會漏 reset; ghost state 風險降到 0 |
| 2 | D-8 (P1) | `app.js:343-352` renderView NSM branch + `8587` history fetch path | S | offcanvas → 點 NSM session → 顯示 spinner，不再 stale partial flicker |
| 3 | D-11 (P1) | `app.js:3767-3805` renderSaveIndicator + new NSM call sites in renderNSMStep2/3 | M | NSM Step 2 輸入時 → 「儲存中… / 已儲存 / 儲存失敗」visible indicator |

**Tracker cross-ref**: §2「NSM↔CIRCLES drift scan results」狀態 B → A → resolved after this ship.
**Cross-dep**: D-7 helper extraction creates the base for C-Drift-4's NEW STANDING memory recommendation (helper-first mandate). D-11 introduces new AppState key `nsmPhase2SaveState` — must be added to D-7 reset list.

---

## §2 File diff plan

### File: `public/app.js`

---

#### Fix 1 — D-7 resetNsmToHome helper extraction

**New helper location**: insert directly AFTER `resetCirclesToHome` (line 3212-3255), at line ~3256.

**Target shape**:
```js
// Reset NSM sub-state so home renderer shows mockup 06 home (filter rail + q-cards + recent rail).
// Mirrors resetCirclesToHome (app.js:3212-3255). Bug-A fix root cause: 4 inline reset sites
// drift'd over time; this helper centralizes so new nsm* AppState keys reset uniformly.
function resetNsmToHome() {
  AppState.nsmStep = 1;
  AppState.nsmSubTab = null;
  AppState.nsmReportTab = 'overview';
  AppState.nsmSession = null;
  AppState.nsmSelectedQuestion = null;
  AppState.nsmContext = null;
  AppState.nsmContextLoading = false;
  AppState.nsmGateResult = null;
  AppState.nsmGateError = null;
  AppState.nsmGateLoading = false;
  AppState.nsmGateLoadingStep = 0;
  AppState.nsmEvalLoading = false;
  AppState.nsmEvalResult = null;
  AppState.nsmEvalError = null;
  AppState.nsmActiveCompareNode = null;
  AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
  AppState.nsmBreakdown = { reach: '', depth: '', frequency: '' };
  AppState.nsmExampleExpanded = {};
  AppState.nsmDimExampleExpanded = {};
  AppState.nsmContextExpanded = false;
  // D-8 (this commit): also reset session loading
  AppState.nsmSessionLoading = false;
  // D-11 (this commit): also reset save state
  AppState.nsmPhase2SaveState = 'idle';
  // C-Drift-1 cross-dep: nsmGateInflight (will be added in commit 1; if not yet present, no-op)
  AppState.nsmGateInflight = false;
}
```

**Surgical contract**: +27 / 0 lines for helper.

**Call site replacements** (4 sites):

1. **Line 2651-2663** (`[data-nsm4-action="retry"]` — 「再練一題」):
   - Current: 7 lines of inline reset + `nsmPickDisplayed(true)` + `render()`.
   - Target: `resetNsmToHome(); nsmPickDisplayed(true); render();` (3 lines).
   - Net: -7 / +3 ≈ -4.

2. **Line 2666-2684** (`[data-nsm4-action="home"]` — 「回首頁」):
   - Current: 11 lines of inline NSM reset + `resetCirclesToHome()` + `AppState.view = 'circles'` + `render()`.
   - Target: `resetNsmToHome(); resetCirclesToHome(); AppState.view = 'circles'; render();` (4 lines).
   - Net: -11 / +4 ≈ -7.

3. **Line 6100-6113** (CIRCLES nsm-promo CTA — 切 view 到 NSM):
   - This is OPPOSITE direction (CIRCLES → NSM transition; clear stale NSM state on entry).
   - Current: 11 lines of inline NSM reset.
   - Target: `resetNsmToHome();` then `AppState.view = 'nsm';` + `render();` (3 lines).
   - Net: -11 / +3 ≈ -8.

4. **Line 6457-6464** (Bug-A fix in qcard click `[data-nsm="start"]`):
   - **CAREFUL**: this is NOT a full reset — qcard click transitions from Step 1 → Step 2 for same NSM flow, preserving selected question.
   - Current: 7 lines reset specific draft fields + transition to step 2.
   - Target: **do NOT replace with `resetNsmToHome()`** — that would clobber `nsmSelectedQuestion`. Keep this site inline.
   - **OR** add 2nd helper `resetNsmDraftOnly()` for question-switch case. **Recommendation**: keep inline; add `// D-7 carve-out: qcard click reset only draft, not selection` comment. Refactor decision: don't.

   - Actually — D-6 (C-Drift-2) ADDS localStorage restore here. So this site is already "special". Confirm with D-2/D-6 reviewer that the post-restore call site stays inline. No change for D-7 at line 6457-6464.

**Total reset-site net**: ~-19 lines (replacing inline blocks with helper calls) + 27 lines helper = +8 net.

**Critical jest enumeration test** (NEW spec, see §3 Spec 1): ensure `resetNsmToHome()` resets every key matching `/^nsm[A-Z]/` in AppState that's NOT a constant (e.g. `NSM_QUESTIONS`, `NSM_TYPE_LABEL`).

---

#### Fix 2 — D-8 nsmSessionLoading state

**AppState declaration**: insert new key after line 120 (`circlesSessionLoading: false,`):
```js
nsmSessionLoading: false,    // R3-equivalent: loading state while fetching NSM session detail
```

**renderView NSM branch**: NSM is currently rendered via `renderNSMStep1/2/3/4` dispatch at line 1298-1303 (inside renderApp / different function). Need to inject loading guard. Let me grep — line 1298 is inside `renderNSM`:
```js
function renderNSM() {
  if (AppState.nsmStep === 1) return renderNSMStep1();
  if (AppState.nsmStep === 2) return renderNSMStep2();
  if (AppState.nsmStep === 3) return renderNSMStep3();
  if (AppState.nsmStep === 4) return renderNSMStep4();
}
```
**Target**: prepend loading guard:
```js
function renderNSM() {
  if (AppState.nsmSessionLoading) {
    return '<div class="loading-wrap">'
      + '<div class="loading-spinner"></div>'
      + '<div class="loading-title">載入練習中…</div>'
      + '</div>';
  }
  if (AppState.nsmStep === 1) return renderNSMStep1();
  ...
}
```
Mirror CIRCLES `renderView` line 347-352 verbatim copy of loading markup.

**Fetch site updates** (lines 8547-8620 — NSM history restore):
- Before `AppState.view = 'nsm'; render();` at line 8582-8583, set `AppState.nsmSessionLoading = true;`.
- After async full fetch resolves/rejects (lines 8587-8619), set `AppState.nsmSessionLoading = false;` in both `.then` and `.catch` paths.

**Surgical contract**: +1 AppState key + 6 lines loading guard + ~3 lines set/clear at fetch site = +10 / 0.

**Reset coverage**: `resetNsmToHome` (D-7 fix) MUST include `nsmSessionLoading = false`. Already in target helper above. ✓

---

#### Fix 3 — D-11 NSM save indicator UI

**Current renderSaveIndicator** (line 3767-3805):
```js
function renderSaveIndicator(state) {
  state = state || (AppState.circlesPhase1SaveState || 'idle');
  // ... 4 states render with .save-indicator class ...
}
function setPhase1SaveState(s) {
  AppState.circlesPhase1SaveState = s;
  // ... in-place swap all .save-indicator HTML ...
}
```

**Refactor target** (modest — add `kind` param):
```js
function renderSaveIndicator(state, kind) {
  kind = kind || 'circles';  // 'circles' | 'nsm'
  state = state || (kind === 'nsm'
    ? (AppState.nsmPhase2SaveState || 'idle')
    : (AppState.circlesPhase1SaveState || 'idle'));
  // ... unchanged markup ...
}
function setSaveState(kind, s) {  // generic; setPhase1SaveState becomes alias
  if (kind === 'nsm') {
    AppState.nsmPhase2SaveState = s;
  } else {
    AppState.circlesPhase1SaveState = s;
  }
  // in-place swap — scope by [data-save-kind] OR fallback to all
  var sel = kind === 'nsm' ? '[data-save-kind="nsm"] .save-indicator' : '[data-save-kind="circles"] .save-indicator';
  document.querySelectorAll(sel).forEach(function (wrapper) {
    wrapper.innerHTML = renderSaveIndicator(s, kind);
  });
}
function setPhase1SaveState(s) { setSaveState('circles', s); }
function setNsmPhase2SaveState(s) { setSaveState('nsm', s); }
```

**Add new AppState key**: insert after `circlesPhase1SaveState: 'idle',` (line 56):
```js
nsmPhase2SaveState: 'idle',     // D-11 mirror CIRCLES — 'idle' | 'saving' | 'saved' | 'error'
```

**triggerNsmSaveCycle update** (line 2131-2156):
- Currently no save indicator integration. Add at start of debounce body:
  ```js
  setNsmPhase2SaveState('saving');
  ```
- After PATCH success: `setNsmPhase2SaveState('saved'); setTimeout(function () { setNsmPhase2SaveState('idle'); }, 2000);`
- After PATCH fail (in .catch): `setNsmPhase2SaveState('error');`
- localStorage write fail (already in try/catch line 2154): no try/catch around setItem currently — add explicit catch and set `'error'`.

**NSM Step 2 render integration** — find renderNSMStep2 body (around line 1670 per grep). Inject `<div data-save-kind="nsm">` + `renderSaveIndicator(undefined, 'nsm')` near submit bar. Mirror CIRCLES `renderSaveIndicator()` placement at lines 4688/4692/4806/4810/4972/4976/5401/5414.

**Also**: existing CIRCLES `setPhase1SaveState` callers (lines 3880/3894/3925/3926) untouched — still call alias.

**Surgical contract**: ~+18 / -3 (refactor renderSaveIndicator + setPhase1SaveState; add setSaveState + setNsmPhase2SaveState) + ~+4 NSM step 2 markup integration + ~+5 triggerNsmSaveCycle integration = ~+24 net.

**CSS check**: `.save-indicator` class already styled (CIRCLES path uses it). NSM should reuse exact same CSS. Verify no `.circles-` prefix in CSS. Skill `frontend-design`: don't add new CSS in this commit.

---

## §3 TDD spec list

> RITUAL §3.18 5x consecutive + §3.19 skill citation header mandatory.

### Spec 1 — D-7 helper enumeration test (jest)

- **Path**: `tests/api/nsm-reset-helper-coverage.spec.js` (new jest unit — use vm.createContext load app.js per existing pattern)
- **Test shape**:
  1. Load app.js → init AppState
  2. Mutate every key matching `/^nsm[A-Z]/` to a non-default value (use known seed values)
  3. Call `resetNsmToHome()`
  4. Assert every key reset to its initial value from `AppState` declaration block (line 76-99)
  5. Exclude: constants `NSM_QUESTIONS`, `NSM_TYPE_LABEL`, `NSM_TYPE_ICON`, `NSM_DIMENSION_CONFIGS`, `NSM_SCORE_DIMS`, `NSM_RADAR_*`, `NSM_GATE_LOADING_STEPS`
- **Why jest not playwright**: pure state assertion; no DOM needed.
- **5x consecutive**: N/A (jest); 1 GREEN sufficient.
- **Regression value**: when ANY future commit adds new `nsm*` AppState key, this test FAILS unless `resetNsmToHome` updated. Enforces STANDING.

### Spec 2 — D-7 4 reset sites invoke helper

- **Path**: `tests/e2e/nsm-reset-sites-use-helper.spec.js` (new playwright)
- **Skill citations**:
  ```js
  // Skills cited:
  //   playwright-skill/core/common-pitfalls.md Pitfall 18 — page.evaluate for state read
  //   playwright-skill/core/common-pitfalls.md Pitfall 3 — role-based locators
  //   playwright-skill/core/auth-flows.md:928-949 — API seed auth
  ```
- **Test shape (3 cases)**:
  - Case A: NSM Step 4 → click 「再練一題」 → assert `AppState.nsmSelectedQuestion === null` AND `AppState.nsmDimExampleExpanded` deep-equal `{}` (ghost state proof).
  - Case B: NSM Step 4 → click 「回首頁」 → assert NSM reset PLUS CIRCLES reset PLUS `view === 'circles'`.
  - Case C: CIRCLES home → click NSM CTA → assert NSM reset before view switch.
- **5x consecutive**: required.

### Spec 3 — D-8 nsmSessionLoading spinner

- **Path**: `tests/e2e/nsm-session-loading-spinner.spec.js` (new playwright)
- **Skill citations**:
  ```js
  // Skills cited:
  //   playwright-skill/core/common-pitfalls.md Pitfall 11 — controlled latency on session GET
  //   playwright-skill/core/common-pitfalls.md Pitfall 3 — role-based locators
  //   playwright-skill/core/network-mocking.md:839-933 — delayed response
  ```
- **Test shape**:
  1. service-role seed NSM session
  2. route `/api/nsm-sessions/{id}` with 3s delay
  3. open offcanvas, click NSM session
  4. immediately assert `.loading-spinner` visible + `.loading-title` text contains 「載入」
  5. wait 5s, assert NSM Step 2 form rendered (no spinner)
- **5x consecutive**: required.

### Spec 4 — D-11 NSM save indicator transitions

- **Path**: `tests/e2e/nsm-save-indicator.spec.js` (new playwright)
- **Skill citations**:
  ```js
  // Skills cited:
  //   playwright-skill/core/common-pitfalls.md Pitfall 11 — error-state mock carve-out
  //   playwright-skill/core/common-pitfalls.md Pitfall 3 — role-based locators
  //   playwright-skill/core/assertions-and-waiting.md — toBeVisible polling
  //   playwright-skill/core/auth-flows.md:928-949 — API seed auth
  ```
- **Test shape (3 cases)**:
  - Case A (idle → saving → saved → idle):
    1. NSM Step 2 form
    2. type in NSM field → wait 800ms debounce
    3. assert `.save-indicator` shows 「儲存中…」
    4. wait response → assert shows 「已儲存」
    5. wait 2s → assert idle (hidden or fade)
  - Case B (error state):
    1. route PATCH `/progress` → 500
    2. type → wait
    3. assert shows 「儲存失敗」 (via persistRetry exhaust)
  - Case C (parallel CIRCLES path unchanged): NSM save indicator does NOT affect `.save-indicator` instances in CIRCLES view (kind-scoped). Switch to CIRCLES tab, type, assert CIRCLES save indicator still works.
- **5x consecutive**: required.

### Spec count summary
- 1 new jest spec (D-7 enumeration)
- 3 new playwright specs (D-7 sites, D-8, D-11)
- **Total**: 4 new test files for commit C-Drift-3.

---

## §4 Risk + rollback

| Fix | Risk if break | Detection signal | Rollback path |
|---|---|---|---|
| D-7 helper | Misses an nsm* key → reset incomplete. Mitigated by jest enumeration test failing pre-commit. | jest spec 1 fails | revert helper definition + revert 3 inline-replaced sites |
| D-7 site #4 (qcard) | If accidentally refactored, loses Bug-A protection + D-6 localStorage restore. | `nsm-question-switch-resets-draft.spec.js` regression | revert that single site to inline |
| D-8 spinner | If `nsmSessionLoading` not cleared on async fetch failure → permanent spinner. Mitigated by setting in both `.then` AND `.catch`. | manual offcanvas + offline test | revert renderNSM guard + fetch site set/clear |
| D-11 setSaveState scope | If `[data-save-kind]` selector wrong, NSM save indicator could update CIRCLES instances and vice versa. Mitigated by spec 4 case C cross-view test. | spec 4 case C fails | revert renderSaveIndicator + setSaveState; restore setPhase1SaveState body |

**Cross-spec drift risk**: HIGH because this commit touches 4 reset sites + renderSaveIndicator widely-reused.
- Run pre-commit: full jest + `nsm-full-flow` + `circles-back-nav-lock` + `nsm-evaluator-error-clears-spinner` + `nsm-question-switch-resets-draft` + visual-regression NSM Step 2/4 snapshots.
- Per `feedback_cross_plan_smoke_after_each_ship`: full smoke required.

**Visual-regression risk**: D-11 introduces NEW `.save-indicator` DOM in NSM Step 2 render output. NSM Step 2 visual snapshots WILL diff. **Required action**:
- Per `feedback_visual_baseline_from_mockup_not_production` STANDING: update NSM Step 2 mockup `07-nsm-step-2.html` first to include `.save-indicator` placement, then capture mockup HTML baseline, then verify production matches mockup. NOT `--update-snapshots` from production.

**Director-clarification-needed items**:
1. **D-11 mockup update** — mockup 07 currently does NOT include save indicator (CIRCLES Phase 1 mockup 03 does). User must approve mockup 07 update before D-11 visual baselines can be re-captured. **BLOCKER**: requires user gate.
2. **D-7 site #4 carve-out** — confirm decision: stays inline (recommended) OR extract `resetNsmDraftOnly` helper.
3. **D-7 reset key list** — includes `nsmPhase2SaveState` (D-11 new) and `nsmSessionLoading` (D-8 new) — both cross-deps within this commit. Implementer must add ALL 3 fixes' new keys to helper enumeration list.

---

## §5 Mockup-as-spec verification

| Fix | Mockup ref | Verification action |
|---|---|---|
| D-7 | No DOM delta; behavior-only refactor. No mockup change. | Pre-/post-screenshot identical |
| D-8 | mockup `09-offcanvas-history.html` + new spinner state in transition mockup `16-flow-transitions-edge.html` §D. Loading spinner markup already exists in CIRCLES (line 347-352) — reuse exact class names so design system consistent. | Compare new spinner render against CIRCLES one — should be visually identical |
| D-11 | mockup `07-nsm-step-2.html` MUST be updated to include save indicator placement matching mockup `03-phase-1-form.html` save-indicator location. **NEW MOCKUP WORK REQUIRED — user gate per STANDING `feedback_mockup_first`** | Cannot ship D-11 until mockup updated + user 放行 |

**Recommendation**: If mockup 07 update blocked, **split D-11 out of C-Drift-3** into deferred commit C-Drift-3b. Ship D-7 + D-8 in C-Drift-3a; D-11 ships after mockup approval.

---

## §6 Effort + commit message preview

- **Engineering effort**: ~1 天 (8 hr) IF mockup 07 already updated.
  - D-7: 2 hr (helper + 3 site replacements + jest enumeration spec)
  - D-8: 1.5 hr (state + renderView guard + spec)
  - D-11: 2.5 hr (renderSaveIndicator refactor + 4 call sites + spec with 3 cases)
  - Cross-spec smoke + 2-stage review: 2 hr
- **+ if mockup 07 update needed**: +2 hr (sonnet mockup dispatch + user 放行 wait)
- **Likely total**: 1-1.5 day.

**Commit message draft (assuming all 3 ship)**:
```
refactor(nsm): C-Drift-3 — resetNsmToHome helper + sessionLoading + save indicator
                            (D-7 + D-8 + D-11)

D-7: 抽 resetNsmToHome 集中 reset 19 個 nsm* key；4 處 inline reset 改呼叫 helper
     (site 4 qcard click 保留 inline 因為要保留 nsmSelectedQuestion + D-6 local restore)
     新加 jest enumeration spec — 未來新增 nsm* key 漏 reset 會 fail
D-8: app.js:120 加 nsmSessionLoading state + renderNSM 先 guard spinner
     mirror circlesSessionLoading (app.js:347-352) 完全 reuse 同 markup
D-11: renderSaveIndicator 加 kind param; setSaveState/setNsmPhase2SaveState 新增
      triggerNsmSaveCycle 串 saving/saved/error 三態; NSM Step 2 render 加 [data-save-kind="nsm"]
      mockup 07 同步更新放置位置 (cross-ref mockup 03 save-indicator pattern)

Mirror refs: CIRCLES app.js:3212-3255 (helper) / 347-352 (loading) / 3767-3805 (save indicator)

New specs:
- tests/api/nsm-reset-helper-coverage.spec.js (jest enumeration — STANDING enforcement)
- tests/e2e/nsm-reset-sites-use-helper.spec.js (3 cases × 5x GREEN)
- tests/e2e/nsm-session-loading-spinner.spec.js (5x GREEN)
- tests/e2e/nsm-save-indicator.spec.js (3 cases × 5x GREEN)

Refs: audit/nsm-circles-drift-scan-2026-05-19.md §3 D-7 / D-8 / D-11
Tracker: audit/e2e-master-tracker.md §2 NSM↔CIRCLES drift scan results
Mockup: docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/07-nsm-step-2.html (D-11)
```
