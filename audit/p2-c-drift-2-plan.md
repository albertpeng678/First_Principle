# C-Drift-2 Plan — P0 NSM localStorage data loss fix (2 fixes)

> Atomic commit 2/4 of Phase 2 NSM↔CIRCLES drift Wave 2.
> Source: `audit/nsm-circles-drift-scan-2026-05-19.md` (D-2 + D-6).
> Tracker: `audit/e2e-master-tracker.md` §2 「NSM↔CIRCLES drift scan results」.
>
> **Why P0**: NSM writes `pmdrill:nsm:draft:` localStorage on every input (line 2144) but 0 read sites. Backend PATCH race / fail → NSM **silent total data loss** vs CIRCLES auto-recovers from local cache. Live Supabase data shows `nsm_sessions` lifecycle 'created':999 vs 'gated':1 = 99.9% drop — D-2 likely amplifier.
>
> **Karpathy guardrails** (per `feedback_karpathy_guidelines_standard`):
> - §4.1 Think Before — CIRCLES has 3 read sites (line 6057 qcard, 8356 boot resume, 8510 restoreCirclesPhase1FromSession). NSM needs **2 read sites** (history restore at 8547 + qcard click at 6457). Boot resume not needed — NSM has no parallel to boot resume code path; NSM rehydrates via history list. **VERIFY** during impl: grep boot resume path; if exists, add 3rd read.
> - §4.2 Simplicity First — copy CIRCLES merge logic verbatim; do NOT design new shape.
> - §4.3 Surgical Changes — only line 6457 + 8547 read sites; do NOT touch write site (already correct at 2144).
> - §4.4 Goal-Driven — user types NSM draft → tab close mid-debounce → reload → draft visible.

---

## §1 Scope

| # | Audit ref | App.js anchor | Effort | User-visible goal |
|---|---|---|---|---|
| 1 | D-2 (P0) | `app.js:8547-8620` NSM history restore branch | M | NSM session restored from history → if backend empty + localStorage fresher, local draft merged into AppState |
| 2 | D-6 (P1, partial) | `app.js:6457-6464` qcard click after Bug-A reset | S | NSM 切題 reset draft → 立刻嘗試 localStorage restore (if same qid practiced before) |

**Tracker cross-ref**: §2「NSM↔CIRCLES drift scan results」狀態 B → 部分 A → resolved after D-1/D-2 ship.
**Cross-dep**: D-6 depends on D-2 (D-2 establishes "NSM has read path" semantics; D-6 extends to qcard click).
**NOT in this commit**: D-7 resetNsmToHome helper (saved for C-Drift-3). The 4 reset sites still inline; this commit only adds the localStorage MERGE block after the existing reset block at 6457-6464.

---

## §2 File diff plan (surgical, no refactor)

### File: `public/app.js` (single-file edit)

---

#### Fix 1 — D-2 NSM history restore reads localStorage

**Location**: lines 8547-8620 (NSM branch of `loadCirclesSessionFromHistory`)
**Current logic** (paraphrase, verbatim already in `Read` output above):
- Seed `AppState.nsmSession = item` (partial list data)
- Set `AppState.nsmDefinition` from `item.user_nsm` (3 branches: string / object / null)
- Set `AppState.nsmBreakdown` from `item.user_breakdown`
- Set `AppState.nsmEvalResult`, etc.
- `render()`
- Async fetch full session via `/api/nsm-sessions/{id}` → set fields again from `full`
- Final `render()`

**CIRCLES reference** (lines 8503-8527):
```js
try {
  var qid = (AppState.circlesSelectedQuestion || {}).id;
  if (qid) {
    var raw = localStorage.getItem('pmdrill:circles:draft:' + qid);
    if (raw) {
      var local = JSON.parse(raw);
      var serverTs = sd.ts || new Date(item.updated_at || item.created_at || 0).getTime();
      var sdEmpty = !sd.P1 && !sd.P1S && !sd.P1L && !sd.P1E && !sd.framework;
      var fdEmpty = !item.framework_draft || Object.keys(item.framework_draft || {}).length === 0;
      var backendEmpty = sdEmpty && fdEmpty;
      var localFresher = local && local.ts && local.ts > serverTs;
      if (local && (localFresher || backendEmpty)) {
        if (local.P1) AppState.circlesPhase1 = local.P1;
        if (local.P1S) AppState.circlesPhase1S = local.P1S;
        if (Array.isArray(local.P1L) && local.P1L.length) AppState.circlesPhase1Solutions = local.P1L;
        if (local.P1E) AppState.circlesPhase1Evaluate = local.P1E;
        if (local.framework) AppState.circlesFrameworkDraft = local.framework;
      }
    }
  }
} catch (_) {}
```

**NSM target shape** (insert after line 8581 `AppState.nsmGateResult = ...` and BEFORE line 8582 `AppState.view = 'nsm'`):
```js
// Mirror CIRCLES localStorage merge (app.js:8503-8527) — prefer local if newer OR backend empty.
// NSM shape: { userNsm: {...}, userBreakdown: {...}, ts }
try {
  var nsmQid = (AppState.nsmSelectedQuestion || {}).id;
  if (nsmQid) {
    var nsmRaw = localStorage.getItem('pmdrill:nsm:draft:' + nsmQid);
    if (nsmRaw) {
      var nsmLocal = JSON.parse(nsmRaw);
      var nsmServerTs = new Date(item.updated_at || item.created_at || 0).getTime();
      var defEmpty = !item.user_nsm
        || (typeof item.user_nsm === 'object' && !item.user_nsm.nsm && !item.user_nsm.explanation && !item.user_nsm.businessLink)
        || (typeof item.user_nsm === 'string' && !item.user_nsm.trim());
      var brEmpty = !item.user_breakdown
        || Object.values(item.user_breakdown).every(function (v) { return !v || !String(v).trim(); });
      var nsmBackendEmpty = defEmpty && brEmpty;
      var nsmLocalFresher = nsmLocal && nsmLocal.ts && nsmLocal.ts > nsmServerTs;
      if (nsmLocal && (nsmLocalFresher || nsmBackendEmpty)) {
        if (nsmLocal.userNsm) AppState.nsmDefinition = {
          nsm: nsmLocal.userNsm.nsm || '',
          explanation: nsmLocal.userNsm.explanation || '',
          businessLink: nsmLocal.userNsm.businessLink || '',
        };
        if (nsmLocal.userBreakdown) AppState.nsmBreakdown = nsmLocal.userBreakdown;
      }
    }
  }
} catch (_) {}
```
**Surgical contract**: +24 / 0 lines. Variable names prefixed `nsm` to avoid shadow risk.
**Repeat for full-fetch branch** (after line 8615 `if (full.progress_json.gateResult !== undefined) AppState.nsmGateResult = full.progress_json.gateResult;` and BEFORE line 8616 `render()`): same merge block but read `full` instead of `item`. **Justification**: full fetch overwrites everything; without re-merge, the first merge gets clobbered. Mirror not present in CIRCLES because CIRCLES does single GET. **DECISION**: ship both merges OR ship only first merge. Recommend BOTH (predicted bug: race between full fetch + user starting to edit; without re-merge edit would be wiped by full).
**Net diff for D-2**: ~+48 lines (two merge blocks).

---

#### Fix 2 — D-6 NSM qcard click localStorage restore

**Location**: lines 6457-6464 (Bug-A reset inside `startBtn` click handler)
**Current**:
```js
// Bug-A fix: mirror CIRCLES Bug 2 #252 c156c6b pattern — reset stale draft on question switch
AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
AppState.nsmBreakdown = { reach: '', depth: '', frequency: '' };
AppState.nsmEvalResult = null;
AppState.nsmGateResult = null;
AppState.nsmSession = null;
AppState.nsmStep = 2;
render();
```
**CIRCLES reference** (lines 6049-6068, qcard click path):
```js
// Reset draft state when switching questions to prevent ghost content (P0-#252 fix)
AppState.circlesFrameworkDraft = {};
// ... resets ...
try {
  var raw = localStorage.getItem('pmdrill:circles:draft:' + qid);
  if (raw) {
    var local = JSON.parse(raw);
    if (local && typeof local === 'object') {
      if (local.framework) AppState.circlesFrameworkDraft = local.framework;
      if (local.P1) AppState.circlesPhase1 = local.P1;
      ...
    }
  }
} catch (_) { /* localStorage unreadable — fresh start */ }
```
**Target shape** (insert between current line 6463 `AppState.nsmStep = 2;` and line 6464 `render();`):
```js
// D-6 fix: after Bug-A reset, restore localStorage draft if user practiced this qid before
// Mirror CIRCLES app.js:6056-6068 qcard click pattern
try {
  var nsmQid = (AppState.nsmSelectedQuestion || {}).id;
  if (nsmQid) {
    var nsmRaw = localStorage.getItem('pmdrill:nsm:draft:' + nsmQid);
    if (nsmRaw) {
      var nsmLocal = JSON.parse(nsmRaw);
      if (nsmLocal && typeof nsmLocal === 'object') {
        if (nsmLocal.userNsm) AppState.nsmDefinition = {
          nsm: nsmLocal.userNsm.nsm || '',
          explanation: nsmLocal.userNsm.explanation || '',
          businessLink: nsmLocal.userNsm.businessLink || '',
        };
        if (nsmLocal.userBreakdown) AppState.nsmBreakdown = nsmLocal.userBreakdown;
      }
    }
  }
} catch (_) {}
```
**Surgical contract**: +18 / 0 lines.
**Behavior**: no TS compare here (CIRCLES qcard restore also doesn't TS-compare — qcard click implies fresh entry, no backend to race with). Always restore if local exists.

---

## §3 TDD spec list

> RITUAL §3.18 5x consecutive + §3.19 skill citation header mandatory.

### Spec 1 — D-2 history restore reads localStorage when backend empty

- **Path**: `tests/e2e/nsm-history-localstorage-restore.spec.js` (new — mirror `circles-draft-retry-real.spec.js` pattern but for restore)
- **Skill citations**:
  ```js
  // Skills cited:
  //   playwright-skill/core/common-pitfalls.md Pitfall 18 — localStorage via page.evaluate
  //   playwright-skill/core/common-pitfalls.md Pitfall 3 — role-based locators
  //   playwright-skill/core/api-testing.md:783-848 — service-role seed
  //   playwright-skill/core/auth-flows.md:928-949 — API seed auth
  ```
- **Test shape (case A: backend empty)**:
  1. service-role seed NSM session with `user_nsm: {}, user_breakdown: {}`
  2. page.evaluate `localStorage.setItem('pmdrill:nsm:draft:' + qid, JSON.stringify({ userNsm: { nsm: 'DAU', explanation: 'X', businessLink: 'Y' }, userBreakdown: { reach: 'A', depth: 'B', frequency: 'C' }, ts: Date.now() }))`
  3. open offcanvas, click NSM session
  4. assert NSM Step 2 form shows `DAU` / `X` / `Y` / `A` / `B` / `C`
- **Test shape (case B: backend stale, local fresher)**:
  1. seed session with `user_nsm.nsm='OLD'`, `updated_at` set to 1 hour ago
  2. localStorage `ts: Date.now()` (now); userNsm `{ nsm: 'NEW' }`
  3. open from offcanvas → assert `NEW` shown (not OLD)
- **Test shape (case C: backend fresher, local stale)**:
  1. seed `updated_at: now`; userNsm `{ nsm: 'BACKEND' }`
  2. localStorage `ts: now - 1hour`; userNsm `{ nsm: 'STALE' }`
  3. open → assert `BACKEND` shown
- **Test shape (case D: full fetch race)**:
  1. seed list-endpoint return empty user_nsm; full-endpoint return populated `BACKEND-FULL` value
  2. localStorage has `LOCAL-FRESH`
  3. open → assert eventually shows `BACKEND-FULL` (full fetch newer, wins re-merge)
  4. **OR** if user starts typing during full fetch race — expect their edits preserved. (Deferred to manual test; e2e too flaky.)
- **5x consecutive**: required.

### Spec 2 — D-6 qcard click restores local draft

- **Path**: `tests/e2e/nsm-qcard-click-restores-local-draft.spec.js` (new)
- **Skill citations**: identical to Spec 1.
- **Test shape**:
  1. NSM Step 1: pick question A → Step 2 → type `DAU` → wait 2s for debounce + PATCH success
  2. back to Step 1 via `[data-nsm-action="back"]`
  3. pick question B → Step 2 → form empty (correct)
  4. back to Step 1
  5. pick question A again → click `[data-nsm="start"]`
  6. assert NSM Step 2 form shows `DAU` (restored from local)
- **5x consecutive**: required.

### Spec count summary
- 2 new e2e specs.
- **Total**: 2 new test files for commit C-Drift-2.

---

## §4 Risk + rollback

| Fix | Risk if break | Detection signal | Rollback path |
|---|---|---|---|
| D-2 first merge | If `nsmBackendEmpty` heuristic too aggressive (e.g. legacy session with `user_nsm: { nsm: '', explanation: 'partial' }` flagged empty), backend data silently overridden by stale local. | Spec case C fails; user reports "我評過分了 但表單空了" | revert merge block lines |
| D-2 second merge (full fetch) | Race: full fetch comes in AFTER user starts editing → local merge clobbers edits. Mitigation: only merge if userInput hasn't fired. **Skipping second merge IS the safer path** — accept that first-render local-merge gets clobbered when full fetch lands. | Manual race test | drop second merge |
| D-6 | If user has fresh-typed CIRCLES habit (instant clean form) NSM differing behavior could confuse. But: CIRCLES has same behavior (line 6056-6068) — convergence is the goal. | spec 2 + cross-spec smoke `nsm-question-switch-resets-draft.spec.js` | revert lines 6464-6481 |

**Cross-spec drift risk**: `nsm-question-switch-resets-draft.spec.js` may assert "form is empty" after question switch — D-6 changes behavior. **Need to verify this spec BEFORE shipping**:
- If spec asserts empty form unconditionally → spec needs update (commit C-Drift-2 includes spec update).
- If spec asserts empty form ONLY when no localStorage → no change needed.
- **Action for implementer**: Read `nsm-question-switch-resets-draft.spec.js` first; cite findings in commit message.

**Director-clarification-needed items**:
1. **D-2 second merge** — ship both merges OR only first? Recommendation: first only (safer; second merge is theoretical edge case + clobber risk too high).
2. **`nsm-question-switch-resets-draft.spec.js` compatibility** — needs spec audit before fix.
3. **Cross-cutting**: D-1 (C-Drift-1) ships persistRetry → reduces frequency of empty-backend race. D-2 is the safety net. Both should ship; order doesn't matter strictly but C-Drift-1 first is cleaner.

---

## §5 Mockup-as-spec verification

> Per `feedback_mockup_strict_compliance`: any UI-touching fix must reference mockup.

**No mockup changes required** for C-Drift-2. All 2 fixes are state-hydration logic; visible DOM identical pre/post — only field VALUES change (from empty → restored). No new UI surfaces.

**Mockup references for behavior verification** (no diff, just citation):
- mockup `07-nsm-step-2.html` — Step 2 form shape with NSM definition fields. User after D-2/D-6 sees same form shape but with their previously-typed draft populated.
- mockup `09-offcanvas-history.html` — offcanvas open + click → restore flow visualized.

**Visual regression guard**: do NOT update toHaveScreenshot baselines.

---

## §6 Effort + commit message preview

- **Engineering effort**: ~1 天 (8 hr) — 3 hr write fixes (2 merge blocks D-2 + 1 D-6) + 3 hr write 2 specs with 4 cases + 1 hr 5x flakeproof + 1 hr 2-stage review.
- **Higher-than-XS** because D-2 has 4 e2e cases (each with seed/restore/assert lifecycle = ~30 LOC) and TS heuristic logic that benefits from manual cross-check.

**Commit message draft**:
```
fix(nsm): C-Drift-2 — P0 NSM localStorage restore (D-2 + D-6)

NSM 寫 pmdrill:nsm:draft 但從不讀 → 後端 PATCH race / fail = NSM silent
total data loss (CIRCLES 有 fallback recovery; NSM 無)。本 commit 補 2 處 read。

- D-2: app.js:8581 NSM history restore branch 加 localStorage merge
       (mirror CIRCLES app.js:8503-8527 pattern；TS compare + backend empty fallback)
- D-6: app.js:6464 qcard click reset 後加 local restore
       (mirror CIRCLES app.js:6056-6068；always restore if local exists)

依附 C-Drift-1 D-1 (persistRetry) — 兩個一起把 NSM 草稿持久層補完。

Mirror refs: CIRCLES app.js:8503-8527 (history restore) / 6056-6068 (qcard restore)

New specs:
- tests/e2e/nsm-history-localstorage-restore.spec.js (4 cases × 5x GREEN)
- tests/e2e/nsm-qcard-click-restores-local-draft.spec.js (5x GREEN)

Refs: audit/nsm-circles-drift-scan-2026-05-19.md §3 D-2 / D-6
Tracker: audit/e2e-master-tracker.md §2 NSM↔CIRCLES drift scan results
```
