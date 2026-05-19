# Wave 1 Task #2 — F-CT2.1 Findings
# NSM Step 1 card click → 不應立刻建 nsm_sessions row

**Date**: 2026-05-18
**Implementer**: Sonnet (agent #2)
**Status**: STAGED (do NOT commit — wait for Director signoff)

---

## 1. Root Cause Confirmed

`public/app.js` line 6280 (`bindNSMStep1` card click handler):
```js
ensureNsmDraftSession().catch(function () {});
```
Every card click in NSM Step 1 fired `ensureNsmDraftSession()` — creating a real `nsm_sessions` row immediately, before any user filled any field. This produced ~5487 empty shell sessions (99.9% `lifecycle='created'` with no engagement), polluting the conversion funnel metric.

---

## 2. Fix Applied (Surgical — 1 edit)

**File**: `public/app.js`
**Region**: line 6354 in working tree (was 6280 before agent #5's additions shifted lines)
**Change**: Removed `ensureNsmDraftSession().catch(function () {});` from card click handler.
**Replaced with**: Comment block explaining the lazy-creation strategy.

**Preserved call sites (correct):**
- `app.js:1777-1783` — `bindNSMStep2And3` preflight: KEPT. Creates session on Step 2 mount (correct lazy point).
- `app.js:4418` — hint modal: KEPT. Hints legitimately need a sessionId.
- `triggerNsmSaveCycle:2105-2113` — `if (sessionId)` guard: already correct, no change needed.
- Submit handler `ensureNsmSession()` at line 1944: KEPT as fallback if preflight failed.

---

## 3. RED Log

Run before fix:
```
1 failed
[e2e-desktop] nsm-step1-card-click-no-session.spec.js:241:1
  Error: Timeout 5000ms exceeded — AppState.nsmSession.id should remain null after card click
  → count went from initialCount → initialCount+1 after card click (production creates session immediately)
```

---

## 4. GREEN Numbers (5x consecutive × 3 projects = 15 total PASS, 0 flake)

```
=== Run 1 === 4 passed (16.5s)   [setup + desktop + mobile-chrome + mobile-safari]
=== Run 2 === 4 passed (19.2s)
=== Run 3 === 4 passed (15.6s)
=== Run 4 === 4 passed (11.8s)
=== Run 5 === 4 passed (13.7s)
```
**Total: 15/15 PASS, 0 flake**

---

## 5. No-regression Numbers

```
nsm-no-bypass + nsm-gate-result-ui-display + nsm-evaluator-error-clears-spinner + nsm-question-switch-resets-draft
→ 13 passed (49.3s) across all 3 vp
```
No regressions detected.

---

## 6. Five-Step Cross-Check (cheat-sheet 次要 #8)

1. **File exists**: `/Users/albertpeng/Desktop/claude_project/First_Principle/tests/e2e/nsm-step1-card-click-no-session.spec.js` ✓
2. **Skill citation**: Line 12: `// Skills applied (RITUAL §3 + /Users/albertpeng/.claude/skills/playwright-skill/core/):` ✓
3. **git ls-files**: Correctly untracked (new file, staged) — `git add` done ✓
4. **Diff scope**: `git diff --cached public/app.js | grep '@@'` → my hunk is only `@@ -6272,12 +6354,14 @@` (card click region). Other 5 hunks (`5090/5101/5200/5244/5272`) are from agent #5 already in working tree — NOT my changes. ✓
5. **Desktop project pass**: `2 passed (10.9s)` ✓

---

## 7. Production Diff Scope

Only 1 surgical change in `public/app.js`:
- Removed 7 lines (comment + `ensureNsmDraftSession().catch(...)` call + comment)
- Added 9 lines (explanatory comment block)
- Net: +2 lines in the card click handler region

No other files changed except:
- `tests/e2e/nsm-step1-card-click-no-session.spec.js` — NEW spec
- `tests/e2e/playwright.config.js` — added `nsm-step1-card-click-no-session` to all 3 e2e project testMatch patterns
- `audit/F-CT2.1-evidence/` — 10 PNG evidence files per project (30 PNGs total)

---

## 8. Note on Parallel Agent Contamination

The staged `public/app.js` diff includes hunks from agent #5 (B6 mockup 04 D-series fixes: `renderCirclesGate`, `renderGateResult`, `renderGateLoading`). These were already in the working tree before this task started and are unrelated to F-CT2.1. Director must decide whether to commit them together or separate them.

---

## 9. DB Count Assertion Note

The spec uses `AppState.nsmSession.id` (per-browser) as the primary assertion for the no-session-after-card-click step. The global DB count assertion was removed from that step because 3 projects share the same test user account — when running in parallel, one browser's Step 2 preflight fires concurrently with another browser's card-click check, making the shared count non-deterministic. The final step still uses `toBeGreaterThanOrEqual(initialCount + 1)` to confirm that at least 1 session was created by Step 2.
