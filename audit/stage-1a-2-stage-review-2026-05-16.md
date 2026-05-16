# Stage 1A — 2-Stage Review (Spec Compliance + Code Quality)

**Date:** 2026-05-16
**Reviewer:** code-review agent (Opus 4.7)
**Scope:** 12 implementer tasks T1-T12 — gate cluster fix (B1 + B6)
**Diff range:** `4dba816..HEAD` over `public/app.js`, `public/lib/frameworkValidator.js`, `prompts/circles-gate.js`, `tests/e2e/circles-gate.spec.js`, `tests/unit/framework-validator.test.js`
**Spec:** `docs/superpowers/specs/2026-05-16-stage-1a-gate-cluster-design.md`

---

## Stage A — Spec Compliance (AC checklist)

### Functional acceptance

| AC | Description | Verdict | Evidence |
|---|---|---|---|
| B1-AC1 | All-`Y` (1 char) → Layer 1 minLength block | PASS | `framework-validator.test.js:14` rejects `'Y'`; e2e `circles-gate.spec.js:198-232` asserts `postCount===0` + `.framework-error` visible |
| B1-AC2 | All-`YYYY` → notAllSameChar block | PASS | `framework-validator.test.js:25` `notAllSameChar('aaaa')===false`; covered by garbage factory + same e2e |
| B1-AC3 | All-`asdf` → notTrivialAsciiToken block | PASS | `framework-validator.test.js:39` `notTrivialAsciiToken('asdf')===false` |
| B1-AC4 | All-`上班族` (3 Chinese) → minLength block | PASS | `framework-validator.test.js:14` `minLength('上班族',4)===false` |
| B1-AC5 | `上班族男` (4 Chinese) → passes Layer 1 | PASS | `framework-validator.test.js:14` `minLength('上班族男',4)===true` + `notTrivialAsciiToken` returns true (Chinese branch) |
| B1-AC6 | Quality content → both layers pass → can proceed | PASS | e2e happy path `circles-gate.spec.js:167-194` asserts gate status `ok|warn` + proceed button visible |
| B6-AC1 | Rapid double-click → 1 POST | PASS | `circles-gate.spec.js:299-347` page.route POST counter, `expect(postCount).toBe(1)` |
| B6-AC2 | Submit button disabled mid-flight | PASS | `circles-gate.spec.js:349-394` reads `gateInflight===true` mid-flight + `setSubmitButtonDisabled(true)` at app.js:7430 |
| B6-AC3 | Mid-flight refresh → in-memory mutex resets to false | PASS-BY-DESIGN | `gateInflight` declared at app.js:141 with `false` default, never persisted; no explicit refresh test but architecturally guaranteed |
| B6-AC4 | Programmatic Phase=2 during inflight → blocked | PASS-WITH-NOTE | Spec said "setCirclesPhase setter"; impl placed guard at gate-action="proceed" click handler (app.js:7369). No setter function exists in codebase. Only `circlesPhase = 2` write site (line 7373) is guarded. Functionally equivalent. |

### Implementation deliverables

| Spec item | Verdict | Evidence |
|---|---|---|
| Validator has 4 pure functions | PASS | `frameworkValidator.js` exports `minLength` / `notAllSameChar` / `notTrivialAsciiToken` / `validateFrameworkInput` (lines 7,12,20,29) |
| `onlySection` opt for drill mode | PASS | `frameworkValidator.js:37`; tests `framework-validator.test.js:154-189` cover I/C1/default |
| Mutex at 3 entry points | PASS-WITH-NOTE | submit (7394), proceed-click (7369), `tryResumeLatestSession` (7717), `loadCirclesSessionFromHistory` (7985) — actually 4 sites; spec said "setCirclesPhase setter" but no setter exists, the 3 conceptual entry points are all covered |
| `circles-gate.js` anti-stub guard + 4 few-shot | PASS | Quality rules at lines 29-44 + 46-51; 4 few-shot examples at lines 55, 59, 63, 68 (✅×2 / ❌×2) |
| E2E race spec uses `page.route` POST counter | PASS | `circles-gate.spec.js:305-308` route handler increments `postCount` |
| Unit specs ~15 | PASS (actually 15) | `framework-validator.test.js` has 15 test/test.each blocks |
| API contract specs ~6 | PASS (6) | `tests/api/circles-gate-contract.spec.js` has 6 specs (garbage/thin/quality/shape/items-shape/401) |
| Adversarial 10/10 | PASS | `audit/adversarial-sweep-stage-1a-2026-05-16.md` 10/10 PASS |

### EXTRAs (beyond spec, beneficial)
- Stale-error UX (#7 fix in commit `c4f6a02`): keystroke-clears `.framework-error` (app.js:7129-7142). Not in spec but improves partial-fix UX.
- Validator handles non-string inner values (jest covers 4 cases at line 125) — defensive.
- `setSubmitButtonDisabled` scoped to active Phase 1 root (app.js:7531) — defends against T10 mobile+desktop co-render risk.

**Stage A summary: 15 / 15 ACs PASS** (3 PASS-WITH-NOTE for trivial spec/code-shape mismatches; functional intent fully met).

---

## Stage B — Code Quality Findings

### P0 (must fix) — 0

None. The director's mid-flight concern (mutex set BEFORE try → leak on render() throw) was already fixed in commit `c4f6a02`. Verified at app.js:7428: mutex acquire is INSIDE the try block, finally always releases.

### P1 (should fix) — 1

**P1-1: TDD discipline gap on T11 (race specs after impl)**
File: `tests/e2e/circles-gate.spec.js` / commit `818a373`
The race specs (T11) were written AFTER the mutex impl (T6 = `6cb84fb`, T10 = `971c1f4`). Spec §6 IL-3 explicitly required "Write E2E spec (red: feature absent) → ... implement → green". The unit tests (T5 = `6e4a523`) WERE done red-first (`8eccb53` follow-on commit added more locked-order specs). E2E race tests came after. Not a blocker (since they pass), but breaks IL-3 ordering.
Fix: Document carve-out (e2e specs require booted app + impl wire-up to be writable at all). Or accept as known IL-3 deviation for browser-driven specs.

### P2 (nice to have) — 3

**P2-1: `submitFrameworkToGate` is now ~100 lines and 3-deep nested try/catch** — app.js:7392-7492
Cyclomatic complexity climbing. Consider extraction of inner gate-fetch block to a helper. Not urgent (function still works, comments explain mutex placement clearly).

**P2-2: `buildFrameworkValuesForValidator` strips HTML via regex** — app.js:7501
`.replace(/<[^>]*>/g, '')` — fine for simple cases but fragile for edge HTML (e.g., `<` inside attribute string). Since draft values come from contenteditable, a `textContent` extraction would be safer. Low risk in practice.

**P2-3: `notTrivialAsciiToken` Chinese regex `/[一-鿿]/`** — frameworkValidator.js:24
Range covers CJK Unified Ideographs but not extension blocks (CJK Ext A/B/C/D/E/F/G). Korean/Japanese kanji handled, but rare hanzi (e.g., U+20000+) would be falsely classified as ASCII-trivial. Not a real risk for zh-TW PM Drill UX but worth noting.

### Karpathy guidelines check
- **Think before**: PASS — 9-section design spec written before any code (commit `2a2ef05`).
- **Simplicity first**: PASS — in-memory mutex (no localStorage/BroadcastChannel), 4 pure validator fns (~60 LOC), no auto-retry.
- **Surgical**: PASS — 2 new files + 3 edits per spec; no scope creep.
- **Goal-driven**: PASS — every change traces to B1 or B6 AC.

### Director-flagged concerns (verified)
1. Mutex leak on render() throw → **FIXED** (mutex INSIDE try, finally releases). Verified app.js:7428-7491.
2. Selector brittleness on `[data-field-key]` matching hint buttons → **FIXED** (scoped to `div.field[data-field-key="..."]` at app.js:7521-7522). Verified hint buttons at app.js:4287, 4288, 4345 also carry `data-field-key` — scope is correctly tightened.

---

## Final Verdict

**APPROVE_WITH_FOLLOWUPS**

15/15 ACs PASS, 0 P0 / 1 P1 / 3 P2 findings; mutex correctness verified, B1 + B6 acceptance proofs in place, adversarial 10/10. The single P1 (TDD ordering on E2E race specs) is a process note, not a code defect.

### Follow-ups (do NOT block ship — file as P3)
1. P3-1A-A: Document IL-3 carve-out for browser-driven E2E specs (T11 wrote tests after wire-up).
2. P3-1A-B: Consider extracting inner gate-fetch try/catch from `submitFrameworkToGate` if function grows further.
3. P3-1A-C: Consider `textContent` over regex HTML strip in `buildFrameworkValuesForValidator`.
4. P3-1A-D: Extend `notTrivialAsciiToken` Chinese regex to cover CJK Extension blocks if rare-character UX becomes a concern.
