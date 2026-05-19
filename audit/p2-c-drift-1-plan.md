# C-Drift-1 Plan — XS 快攻 (6 surgical fixes)

> Atomic commit 1/4 of Phase 2 NSM↔CIRCLES drift Wave 2.
> Source: `audit/nsm-circles-drift-scan-2026-05-19.md` (D-1 / D-3 / D-4 / D-5 / D-9 / D-10).
> Tracker: `audit/e2e-master-tracker.md` §2 「NSM↔CIRCLES drift scan results」+ §3 COMMON design issue.
>
> **Karpathy guardrails** (per `feedback_karpathy_guidelines_standard`):
> - §4.1 Think Before — every fix has a single named CIRCLES counterpart we mirror; do NOT invent new patterns.
> - §4.2 Simplicity First — each item ≤ ~5 lines diff; no new helpers in this commit.
> - §4.3 Surgical Changes — only line ranges below; do NOT refactor neighboring code (D-7 / D-11 etc. wait for C-Drift-3).
> - §4.4 Goal-Driven — each fix maps to a single verifiable user-visible behavior change documented in §3 of audit doc.
>
> **Find-first compliance** (per `feedback_find_first_fix_later_via_tracker`): this plan is the "Phase B fix" follow-up to the 2026-05-19 find-only drift scan. User has gated (方案 D).

---

## §1 Scope

| # | Audit ref | App.js anchor | Effort | User-visible goal |
|---|---|---|---|---|
| 1 | D-1 (P0) | `app.js:2148` `triggerNsmSaveCycle` PATCH | XS | NSM 5xx 草稿不再 silent loss; mirror P0-#266 CIRCLES shape |
| 2 | D-3 (P1) | `app.js:3146-3147` `renderResumeToast` | XS | 用戶離開 NSM Step 3 評分中 → resume toast 顯示「NSM 評分仍在背景進行中」 |
| 3 | D-4 (P1) | `app.js:141` AppState + `app.js:1973-2110` submit handler | XS | NSM Step 2 雙擊「提交審核」→ 第 2 個 click no-op；只開 1 個 POST /gate |
| 4 | D-5 (P1) | `app.js:4220-4224` `closeNSMStep2HintModal` | XS | NSM Step 3 / Step 1 hint modal 關閉 → in-flight fetch 立刻 abort，舊 response 不灌新 modal |
| 5 | D-9 (P1) | `app.js:1977-1992` inline `ensureNsmSession` | XS | NSM Step 2 同時 click hint+submit → 只跑 1 個 POST /api/nsm-sessions（共用 `_nsmPreflightInFlightForQid` guard） |
| 6 | D-10 (P1) | `app.js:6206-6224` `nsmPickDisplayed` | XS | NSM Step 1 連按「隨機選題」→ 5 題盡可能不重複（pool ≥ 10 時保證 0 重複） |

**Tracker cross-ref**: §2「NSM↔CIRCLES drift scan results」狀態 B → A after this plan ships.

---

## §2 File diff plan (surgical, no refactor)

### File: `public/app.js` (single-file edit)

---

#### Fix 1 — D-1 NSM persistRetry wrap

**Location**: lines 2145-2153 (`triggerNsmSaveCycle` PATCH block)
**Current shape (verbatim)**:
```
var sessionId = AppState.nsmSession && AppState.nsmSession.id;
if (sessionId) {
  var path = (AppState.accessToken ? '/api/nsm-sessions/' : '/api/guest/nsm-sessions/') + sessionId + '/progress';
  window.apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(function (err) { console.error('[nsm-save] PATCH failed:', err); });
}
```
**Target shape**: wrap fetch call in `window.persistRetry.persistRetry(function () { return window.apiFetch(...); })`. Mirror CIRCLES `app.js:3910-3919` verbatim pattern.
**Surgical contract**:
- Add 1 outer wrapper line + 1 closing `})` line + change `window.apiFetch` → `return window.apiFetch`.
- Keep existing `.catch(...)` chain on outer Promise; same log message.
- Net diff: ~+2 / -0 lines.
**Also**: `nsmPersistStep` PATCH (line 2122-2126) and the gate-result persist blocks (lines 2042 / 2056) are intentionally OUT OF SCOPE for this commit — they fire-and-forget different shapes; bundle in C-Drift-1 risks scope creep. Tracker for follow-up if user asks.

---

#### Fix 2 — D-3 nsmEvalLoading enters renderResumeToast

**Location**: lines 3137-3177 (`renderResumeToast`)
**Current state vars detected**: `circlesEvalAway`, `nsmGateAway`, `phase4Away`. NO `nsmEvalAway`.
**Target shape**: after line 3147 add:
```
var nsmEvalAway = AppState.nsmEvalLoading
  && !(AppState.view === 'nsm' && AppState.nsmStep === 3);
```
Then in the if/else chain (lines 3156-3165) append a new branch:
```
} else if (nsmEvalAway) {
  toastCopy = 'NSM 評分仍在背景進行中';
  toastNav  = 'nsm';
}
```
**Surgical contract**: +6 / -0 lines. Toast nav target reuses `'nsm'` (no new navigation handler needed — same as `nsmGateAway`).
**Priority ordering**: place `nsmEvalAway` AFTER `nsmGateAway` and BEFORE `phase4Away` (NSM has dedicated tab; phase4 is final report rare path). Mirror current ordering convention.

---

#### Fix 3 — D-4 nsmGateInflight mutex

**Locations**:
- AppState declaration line 141 (`gateInflight: false`) — add NEW key `nsmGateInflight: false` directly after.
- Submit handler line 1973 (`async function () {`) — add guard at TOP.
- Step 2 success path line 2023 (after `clearInterval` / before `AppState.nsmGateLoading = false`) — keep flag set until response handled.
- Step 2 catch path line 2061 — finally clear in catch.

**Target shape**:
```
// At line 1974 (after `if (nsmSubmitBtn.disabled) return;`)
if (subTab === 'nsm-step2' && AppState.nsmGateInflight) return;
if (subTab === 'nsm-step2') AppState.nsmGateInflight = true;
```
And in the Step 2 try/catch (lines 2012-2067) wrap finally:
```
} finally {
  AppState.nsmGateInflight = false;
}
```
(Currently no finally exists; the catch resets gateLoading. Adding finally requires changing catch into try/catch/finally.)
**Surgical contract**: +5 lines AppState/handler entry + restructure try/catch into try/catch/finally (~+3 lines). Total ~+8 / -0.
**Mirror reference**: CIRCLES gate inflight `app.js:7843, 7874, 8240, 8540`.
**Scope discipline**: Step 3 evaluate (subTab === 'nsm-step3', lines 2068-2107) has `nsmSubmitBtn.disabled = true` immediately + try/finally — already has in-flight protection via DOM disabled state. Do NOT add nsmEvalInflight in this commit.

---

#### Fix 4 — D-5 NSM hint modal close abort all 3 controllers

**Location**: lines 4220-4224 (`closeNSMStep2HintModal`)
**Current**:
```
function closeNSMStep2HintModal() {
  if (_nsmHintAbortController) { try { _nsmHintAbortController.abort(); } catch (e) {} _nsmHintAbortController = null; }
  var host = document.getElementById('nsm-hint-modal-host');
  if (host) host.innerHTML = '';
}
```
**Target**: add 2 more abort blocks for `_nsmStep3HintAbortController` (declared line 4229) and `_nsmStep1HintAbortController` (declared line 4371). Pattern verbatim from existing block; null-safe.
**Surgical contract**: +2 lines.
**Naming note**: function name `closeNSMStep2HintModal` is misleading after this fix (it's now a unified close handler — already called by Step 1/2/3 retry paths in delegation at line 4334-4366). Do NOT rename in this commit (cross-file impact); leave a 1-line comment: `// closes all NSM hint modals (Step 1/2/3) — name kept for backward compat`. Rename = C-Drift-3 refactor candidate.

---

#### Fix 5 — D-9 delete inline ensureNsmSession duplicate

**Location**: lines 1978-1992 (inline `ensureNsmSession` inside submit handler)
**Action**: Delete the inline declaration. Callers at lines 2013 + 2075 already call `ensureNsmSession()` (bare identifier). Rename those 2 sites → `ensureNsmDraftSession()` (the canonical module-scope helper at line 1777).
**Surgical contract**: -15 / +0 lines (delete inline helper) and +0 / +0 net on call sites (just rename identifier).
**Behavior delta**: line 1777 has `_nsmPreflightInFlightForQid` guard — if click hint + click submit fire in same tick, second call returns `null` instead of POSTing. Submit code path at line 2013 / 2075 receives `null` sessionId. Need to handle: if `sessionId` is null after first await, retry via `ensureNsmDraftSession()` once after a 50ms backoff, or surface gate error.
**Safer alternative**: Keep both helpers (do nothing in C-Drift-1); only audit-document the risk. **DECISION REQUIRED FROM DIRECTOR** — see §4 risk.
**Recommendation**: ship the delete + handle null with single 50ms retry (mirror CIRCLES `app.js:7918` P0-NEW-3 pattern: skip when session already exists). +5 lines delete-then-retry shim at each call site.

---

#### Fix 6 — D-10 nsmPickDisplayed excludeCurrent

**Location**: lines 6206-6224
**Current signature**: `function nsmPickDisplayed(clearSelection)`
**Target signature**: `function nsmPickDisplayed(clearSelection, excludeCurrent)`
**Surgical contract**: insert excludeCurrent filter block AFTER pool filter (after line 6217) and BEFORE shuffle (before line 6219):
```
if (excludeCurrent && AppState.nsmDisplayedQuestions && AppState.nsmDisplayedQuestions.length) {
  var curIds = AppState.nsmDisplayedQuestions.map(function (q) { return q.id; });
  var excluded = pool.filter(function (q) { return curIds.indexOf(q.id) < 0; });
  if (excluded.length >= 5) pool = excluded;
}
```
Verbatim mirror of `circlesPickDisplayed` lines 5527-5531.
**Caller updates**: search for all `nsmPickDisplayed(` callers; the reshuffle CTA caller (find via grep — likely in `bindNSMStep1` reshuffle button handler) needs `nsmPickDisplayed(false, true)`. All other callers keep `(false)` / `(true)`.
**Surgical contract net**: +5 lines (filter block) + ~1 line per caller updated. Total ~+7 / -0.

---

## §3 TDD spec list

> Per RITUAL §3.19: every new e2e spec MUST include skill citation header inline.
> Per `feedback_must_read_playwright_skill_before_tests`: sonnet must Read `/Users/albertpeng/.claude/skills/playwright-skill/core/` BEFORE writing.
> Per RITUAL §3.18: 5x consecutive 0-flake GREEN required before commit.

### Spec 1 — D-1 NSM persistRetry behavior

- **Path**: `tests/e2e/nsm-draft-retry-real.spec.js` (new — mirror `circles-draft-retry-real.spec.js`)
- **Pattern**: Pitfall 11 carve-out (mock 503 backend response 3x then 200) + network-mocking.md:839-933 intermittent failure pattern.
- **Skill citation header** (top of spec):
  ```js
  // Skills cited:
  //   playwright-skill/core/common-pitfalls.md Pitfall 11 — error-state mock carve-out
  //   playwright-skill/core/network-mocking.md:839-933 — intermittent failure
  //   playwright-skill/core/api-testing.md:783-848 — service-role seed
  ```
- **Test shape**:
  1. service-role seed NSM session for e2e test user (per §3.8)
  2. open NSM Step 2, fill draft fields, wait 1s for debounce
  3. route.fulfill `/progress` PATCH → 503 three times then 200
  4. assert eventually 200 succeeds (persistRetry runs 3 attempts)
  5. reload, assert draft fields visible (backend persisted)
- **5x consecutive**: 5 GREEN runs required pre-commit.

### Spec 2 — D-3 NSM eval resume toast

- **Path**: `tests/e2e/nsm-eval-resume-toast.spec.js` (new)
- **Pattern**: Pitfall 18 (page.evaluate only for true JS APIs — set `window.AppState.nsmEvalLoading` directly to simulate in-flight); auth-flows.md:928-949 API seed.
- **Skill citation header**:
  ```js
  // Skills cited:
  //   playwright-skill/core/common-pitfalls.md Pitfall 18 — page.evaluate JS APIs only
  //   playwright-skill/core/common-pitfalls.md Pitfall 3 — role-based locators
  //   playwright-skill/core/auth-flows.md:928-949 — API seed auth
  ```
- **Test shape**:
  1. login as e2e user, navigate NSM Step 3
  2. page.evaluate set `AppState.nsmEvalLoading = true; render();`
  3. navigate to CIRCLES tab via `data-nav="circles"`
  4. assert `[data-resume-toast-wrap]` visible with text `NSM 評分仍在背景進行中`
  5. click toast → assert navigated back to NSM Step 3
- **5x consecutive**: required.

### Spec 3 — D-4 NSM gate inflight mutex

- **Path**: `tests/e2e/nsm-gate-double-click-mutex.spec.js` (new)
- **Pattern**: Pitfall 11 (network throttle via route.continue with delay) + assertions-and-waiting.md (expect.poll for network request count).
- **Skill citation header**:
  ```js
  // Skills cited:
  //   playwright-skill/core/common-pitfalls.md Pitfall 11 — controlled latency
  //   playwright-skill/core/assertions-and-waiting.md — expect.poll for count
  //   playwright-skill/core/api-testing.md:783-848 — service-role seed
  ```
- **Test shape**:
  1. seed NSM session, fill Step 2 form
  2. route `/gate` POST with 3s delay
  3. count POST count = c; click submit 3x in 100ms
  4. wait 5s, assert POST count = c+1 (only 1 went through)
- **5x consecutive**: required.

### Spec 4 — D-5 NSM hint modal close abort

- **Path**: `tests/e2e/nsm-hint-modal-close-aborts-all.spec.js` (new)
- **Pattern**: Pitfall 14 (no module-level shared state — use page.evaluate read of abort controller state) + network-mocking.md:839-933.
- **Skill citation header**:
  ```js
  // Skills cited:
  //   playwright-skill/core/common-pitfalls.md Pitfall 14 — no shared state
  //   playwright-skill/core/common-pitfalls.md Pitfall 18 — page.evaluate JS APIs only
  //   playwright-skill/core/network-mocking.md:839-933 — controlled response
  ```
- **Test shape (Step 3 path)**:
  1. NSM Step 3 open reach hint with 5s delay on `/api/nsm-public/step3-hint`
  2. ESC to close
  3. open depth hint (different dimType)
  4. wait 3s; assert depth modal shows depth content, NOT reach content
- **Test shape (Step 1 path)**:
  1. NSM Step 1 select question → open hint modal with 5s `/hints` delay
  2. click close (X)
  3. open hint modal again with different question
  4. assert response from question 2 lands in modal (question 1 aborted)
- **5x consecutive**: required.

### Spec 5 — D-9 ensureNsmSession dedupe

- **Path**: `tests/e2e/nsm-session-create-dedupe.spec.js` (new)
- **Pattern**: Pitfall 11 (delay POST) + assertions-and-waiting.md (expect.poll).
- **Skill citation header**: identical to Spec 3.
- **Test shape**:
  1. NSM Step 2 with NO session yet (AppState.nsmSession === null)
  2. throttle `/api/nsm-sessions` POST with 2s delay
  3. trigger hint button click AND submit button click within 100ms
  4. wait 5s; assert only 1 POST observed
- **5x consecutive**: required.

### Spec 6 — D-10 nsmPickDisplayed excludeCurrent

- **Path**: `tests/api/nsm-pick-displayed-exclude-current.spec.js` (new jest unit, NOT playwright — pure function test)
- **Pattern**: pure function test; mock `NSM_QUESTIONS` global with 10 items.
- **Skill citation header**: jest comment block citing the pure-function rationale.
- **Test shape**:
  1. seed `AppState.nsmDisplayedQuestions` with 5 known ids
  2. call `nsmPickDisplayed(false, true)` 5 times
  3. assert no overlap between previous 5 and new 5 (when pool ≥ 10)
- **5x consecutive**: N/A (jest); 1 GREEN run sufficient.

### Spec count summary
- 5 new playwright e2e specs (D-1, D-3, D-4, D-5, D-9)
- 1 new jest spec (D-10)
- **Total**: 6 new test files for commit C-Drift-1.

---

## §4 Risk + rollback

| Fix | Risk if break | Detection signal | Rollback path |
|---|---|---|---|
| D-1 | If persistRetry never resolves on permanent 5xx, NSM PATCH chain blocks. CIRCLES uses fire-and-forget IIFE so blocking is OK. NSM uses `.catch` chain — same shape. | `nsm-draft-retry-real.spec.js` fails / NSM home stops loading | revert lines 2145-2153 to pre-edit `apiFetch().catch` form |
| D-3 | Toast collides if NSM eval + CIRCLES eval both in-flight (rare; same user can't be in both). Priority order matters. | `nsm-eval-resume-toast.spec.js` + manual cross-tab check | revert lines 3146-3165 |
| D-4 | If mutex flag never cleared (e.g. mid-flight reload), user blocked from re-submitting until next reload. AppState NOT persisted (line 141 comment "in-memory only, never persisted") — safe. | `nsm-gate-double-click-mutex.spec.js` + manual reload-mid-submit recovery test | revert AppState key + handler delta |
| D-5 | If abort fires too aggressively, currently in-flight hint that user wants → cancelled silently. Mirror CIRCLES exact pattern — same risk profile. | Manual Step 3 hint open + immediate close + reopen same dim → must show fresh load not stale | revert 2 added abort lines |
| D-9 | **HIGHEST RISK** — delete inline helper could break Step 2/3 submit if `ensureNsmDraftSession` returns null (mid-flight dedupe). Need null-handling. | `nsm-session-create-dedupe.spec.js` + `nsm-full-flow.spec.js` regression | revert delete; OR keep inline helper but rename + add guard |
| D-10 | If pool < 10, exclude logic could exhaust pool. Guarded by `if (excluded.length >= 5) pool = excluded` — mirror CIRCLES exact pattern. | jest unit test + `nsm-question-switch-resets-draft.spec.js` regression | revert function signature + filter block |

**Cross-spec drift risk**: NEW-Test-Debt §3 entry warns about 2-stage review cross-spec drift. After C-Drift-1 ship, run:
- `npm test -- nsm-full-flow nsm-evaluator-error-clears-spinner nsm-question-switch-resets-draft nsm-hint-ui-flow nsm-gate-result-ui-display`
- `npm test -- circles-back-nav-lock` (sanity — Persistence)
- Per `feedback_cross_plan_smoke_after_each_ship`: full smoke required.

**Director-clarification-needed items**:
1. **D-9 inline helper delete** — confirm decision: full delete + retry shim, OR keep both helpers (safer; defer dedupe to C-Drift-3 refactor). Audit recommends full delete; risk lives in submit-handler null-handling.
2. **D-1 retry on nsmPersistStep (line 2122) + gateResult persist (2042/2056)** — these are also PATCH fire-and-forget. Audit row 13 implies "ALL NSM PATCH". Plan limits to `triggerNsmSaveCycle` only. Confirm scope OR expand to all 3 PATCH sites in this commit.

---

## §5 Mockup-as-spec verification

> Per `feedback_mockup_strict_compliance`: any UI-touching fix must reference mockup.

**No mockup changes required** for C-Drift-1. All 6 fixes are state-machine / behavior-layer, not visual. Specifically:
- D-1 — backend retry; no UI delta.
- D-3 — toast reuses existing `resume-toast` markup (mockup 16 §D verbatim shell at app.js:3169-3176); only adds 1 new copy variant. No mockup PNG diff needed.
- D-4 — mutex is behavioral; no DOM markup added.
- D-5 — only changes abort timing, no DOM delta.
- D-9 — refactor; no UI delta.
- D-10 — same DOM (5 cards) just different content. Visual identity preserved.

**Visual regression guard**: per `feedback_visual_baseline_from_mockup_not_production` STANDING — do NOT update any `toHaveScreenshot` baseline in this commit. If existing baselines fail (e.g. NSM Step 1 5-card layout), root-cause first — likely test fixture order, not real drift.

---

## §6 Effort + commit message preview

- **Engineering effort**: ~半天 (5 hr) total — 3 hr write fixes + 2 hr write 5 specs + 5x flakeproof + 2-stage review.
- **5 GREEN runs** (per spec) = ~10 min × 5 specs = 50 min.
- **2-stage review** per commit (spec-compliance + code-quality reviewer) = ~1 hr.

**Commit message draft** (zh-TW per STANDING + Karpathy goal-driven):
```
fix(nsm): C-Drift-1 — 6 XS drift fix mirror CIRCLES helpers (D-1/3/4/5/9/10)

- D-1: NSM triggerNsmSaveCycle PATCH wrap window.persistRetry (5xx 不再 silent loss)
- D-3: nsmEvalLoading 進 renderResumeToast (Step 3 評分背景跑也有 toast)
- D-4: AppState.nsmGateInflight mutex (Step 2 雙擊不再開 2 個 /gate POST)
- D-5: closeNSMStep2HintModal 加 abort Step 1/3 controllers (modal 關 → fetch abort)
- D-9: 刪 inline ensureNsmSession 重複 (Step 2/3 共用 ensureNsmDraftSession guard)
- D-10: nsmPickDisplayed 加 excludeCurrent (reshuffle 5 題不重複)

Mirror refs: CIRCLES app.js:3910 (persistRetry) / 5527-5531 (excludeCurrent) / 4106-4114 (abort)

New specs:
- tests/e2e/nsm-draft-retry-real.spec.js (5x GREEN)
- tests/e2e/nsm-eval-resume-toast.spec.js (5x GREEN)
- tests/e2e/nsm-gate-double-click-mutex.spec.js (5x GREEN)
- tests/e2e/nsm-hint-modal-close-aborts-all.spec.js (5x GREEN)
- tests/e2e/nsm-session-create-dedupe.spec.js (5x GREEN)
- tests/api/nsm-pick-displayed-exclude-current.spec.js (jest)

Refs: audit/nsm-circles-drift-scan-2026-05-19.md §3 D-1/3/4/5/9/10
Tracker: audit/e2e-master-tracker.md §2 NSM↔CIRCLES drift scan results
```
