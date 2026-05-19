# Plan — F-CT1.4b CIRCLES side `e.message` leak (Phase 2 C-Drift-5)

**Date**: 2026-05-19
**Status**: PLAN ONLY — no implementation, no production edits, no commits
**Phase**: B (write plan after find-phase audit; awaits user放行 before Phase C implementation)
**Source audit**: `audit/F-CT1.4b-circles-emessage-leak-audit.md` (slot 5 sub-agent `a5397e1e` ship)
**Precedent**: NSM W1-補.7 commit `b126937` — `routes/nsm-sessions.js` line 160-166 (evaluator) + 196-202 (gate)
**Suggested commit boundary**: independent `C-Drift-5` (not bundled into Wave 2)
**Owner gate**: user decision required before any code change

---

## Skill / Spec citation header (RITUAL §3.19)

- **Karpathy §4.1 Think Before** — assumptions stated in §1.2 + §4.3 below; FE/BE contract drift inventoried before any code change
- **Karpathy §4.3 Surgical Changes** — 7 catch blocks → ≤ 7 surgical edits, all mirror NSM canonical shape; no refactor / no helper extraction
- **Karpathy §4.4 Goal-Driven** — non-goal called out (do NOT touch guest-circles-sessions in this plan; do NOT rewrite catch blocks beyond NSM precedent)
- **RITUAL §3.2 Pitfall 11** — error injection is carve-out from "no mocks in e2e"; new classification spec uses jest module mock of `prompts/*` not route mock
- **RITUAL §3.9** — error response testing pattern (status + body code + body error shape; never assert raw message text)
- **STANDING `feedback_find_first_fix_later_via_tracker`** — Phase A find shipped via audit doc; this plan is Phase B prep, NOT Phase C fix
- **STANDING `feedback_tracker_findings_only`** — tracker update at bottom records bug/optimization, not workflow log
- **STANDING `feedback_visual_baseline_from_mockup_not_production`** — §5 verification baselines come from mockup 04/05 gate error states, NOT production self-reference
- **STANDING `feedback_e2e_real_data_only`** — new e2e walk spec uses real Supabase + real OpenAI 503 trigger via prompt-module mock (carve-out), NOT prod URL / NOT stub timestamp
- **STANDING `feedback_two_stage_review_mandatory`** — when fix proceeds, both spec-compliance + code-quality reviewers required (last W1-補.7 wave caught 7 Critical via this gate)

---

## §1 Scope

### 1.1 — 7 catch blocks — severity ranking (audit §3 → plan ship order)

| Ship order | Audit # | Line | Endpoint | Severity | Mirror NSM W1-補.7? | Justification |
|---|---|---|---|---|---|---|
| **1** | #3 | 198 | `POST /:id/gate` | **HIGH** | YES (1:1 mirror of nsm-sessions.js:196-202) | Live Phase 1.5 surface; OpenAI raw error verbatim in DevTools; identical attack surface to pre-W1-補.7 NSM gate |
| **2** | #5 | 306 | `POST /:id/conclusion-check` | MEDIUM | YES (new `CONCLUSION_*` prefix; same 503 + 3-case classify) | Live Phase 2→3 transition; silent UX failure; raw OpenAI leak |
| **3** | #4 | 251 | `POST /:id/message` (SSE) | MEDIUM | PARTIAL — SSE frame, NOT status code (different mechanic) | Live Phase 2 chat; mid-stream OpenAI error in SSE frame body |
| **4** | #2 | 105 | `POST /draft` | LOW | NO — Supabase DB error, NOT OpenAI | Wire leak only; FE persistRetry → DRAFT_CREATE_FAILED already covers user-visible side |
| **5** | #1 | 39 | `POST /` | LOW | NO — Supabase DB error | Likely no live FE caller; same shape as #2 |
| **6** | #6 | 463 | `POST /:id/hint` | LOW-DEAD | YES if patched; recommend DELETE | FE uses `/api/circles-public/hint` not this endpoint; dead from FE |
| **7** | #7 | 482 | `POST /:id/example` | LOW-DEAD | YES if patched; recommend DELETE | Same as #6; FE uses `/api/circles-public/example` |

**Phased ship recommendation** (per audit §4.4 + Karpathy §4.3): three commits within C-Drift-5
- **C-Drift-5a**: ship order 1 only (#3 gate) — HIGH, exact NSM mirror, smallest surgical surface, validates BE+FE bundle pattern
- **C-Drift-5b**: ship order 2-3 (#5 conclusion-check + #4 SSE) — MEDIUM cluster, includes SSE-frame variant
- **C-Drift-5c**: ship order 4-7 (#2/#1 DB + #6/#7 dead-endpoint decision) — LOW cluster; user decides delete vs patch for #6/#7

Each sub-commit independently revertable. If user prefers single commit, collapse to one C-Drift-5 commit (BE+FE+specs together).

### 1.2 — Mirror W1-補.7 NSM modification pattern

**Canonical shape** (from `routes/nsm-sessions.js` line 160-166 evaluator and 196-202 gate):

```js
} catch (e) {
  // F-CT1.4: classify error + do NOT leak e.message (may contain sensitive OpenAI info).
  const eMsg = e.message || '';
  let xxxCode;
  if (e.name === 'AbortError' || /timeout/i.test(eMsg)) xxxCode = '<PREFIX>_TIMEOUT';
  else if (e.status === 429 || /rate.?limit/i.test(eMsg)) xxxCode = '<PREFIX>_RATE_LIMIT';
  else xxxCode = '<PREFIX>_API_ERROR';
  res.status(503).json({ error: 'ai_service_error', code: xxxCode });
}
```

**Variants per ship order**:
1. Gate (#3): prefix `GATE_*` — 1:1 NSM mirror
2. Conclusion-check (#5): prefix `CONCLUSION_*` (new; NSM has no parallel endpoint)
3. SSE (#4): 200 status + SSE frame body `data: {"error":"ai_service_error","code":"<CHAT_*>"}\n\n` (NOT 503 — connection already established)
4. Draft (#2): prefix `DRAFT_*` — adapt detection (Supabase error has `error.code` like `23505` not OpenAI `e.status === 429`); use `DRAFT_DB_CONFLICT` for `error.code === '23505'`, else `DRAFT_DB_ERROR`
5. Create (#1): prefix `CREATE_*` — same shape as #2 but cheaper if confirmed dead
6/7. Hint/Example: DELETE preferred over patch (decision pending user)

### 1.3 — Out-of-plan finding: `routes/guest-circles-sessions.js` 9 parallel leaks

`grep "e.message\|error.message" routes/guest-circles-sessions.js` returns 9 hits at lines 49, 127, 143, 168, 196, 243, 288, 435, 454 — identical leak shape to auth path, lower auth-data sensitivity but same OpenAI exposure class on shared prompt modules.

**Not in this plan's scope.** File a sibling entry **F-CT1.4c** in tracker §3 P2 immediately (out-of-scope but related per audit §"Out-of-scope"). Treatment options for F-CT1.4c:
- Mirror F-CT1.4b once F-CT1.4b ships and is proven stable
- Symmetric ship (both same commit) if user wants single sweep
- Decision deferred — log only

---

## §2 File diff plan (no code; surgical change description per file)

### 2.1 — `routes/circles-sessions.js` — BE catch block rewrites

**Per ship order** (line numbers from current HEAD `b126937`):

- **Line 198 (gate)** — replace `catch (e) { res.status(500).json({ error: e.message }); }` with 7-line classifier block mirroring `routes/nsm-sessions.js:196-202`. Prefix `GATE_*`.
- **Line 306 (conclusion-check)** — same 7-line block; prefix `CONCLUSION_*`.
- **Line 251 (SSE frame)** — `catch (e)` block stays 200 status (SSE already established); replace `res.write` content from `{error: e.message}` to `{error: 'ai_service_error', code: <CHAT_*>}`. Same 3-case classify. Keep `res.end()` after frame write.
- **Line 105 (draft)** — Supabase variant: classify `error.code === '23505'` (unique constraint) → `DRAFT_DB_CONFLICT`, else `DRAFT_DB_ERROR`. Status stays 500 (NOT 503 — this is DB not AI).
- **Line 39 (create)** — same as #2 with `CREATE_*` prefix.
- **Lines 463 / 482 (hint / example)** — IF patch path chosen: same 7-line block, prefix `HINT_*` / `EXAMPLE_*`. IF delete path chosen: remove entire router block (lines 446-464 for hint constants + handler, lines 467-483 for example) and any test references.

**Estimated diff**: BE +28 lines / -7 lines (if patch all 7); or +21 / -7 if hint/example deleted; or +14 / -2 for HIGH-only ship.

### 2.2 — `public/app.js` — FE response-body parsing wiring

**Per audit §4.2 open question 4**: BE classification adds NO user-visible value unless FE reads `body.code`. Today FE has TWO failure modes:

- **Line 7949-8010 (submitFrameworkToGate)**: `if (!res.ok)` branch sets hardcoded `GATE_API_ERROR` without parsing response body. **Fix**: try `res.json()` → `body.code` first, fall through to current hardcoded mapping if body missing.
- **Line 5332-5351 (renderGateError)**: ADD `GATE_RATE_LIMIT` case (today only TIMEOUT / PARSE / SYNC / DRAFT have dedicated copy). Mirror NSM app.js line 1463-1465 strings.
- **Line 1276-1281 (SSE error handler)**: today `parsed.error !== undefined` flips `circlesPhase2StreamError = true` (boolean). **Fix**: change state to `{code, message}` object pattern mirroring `circlesPhase3Error` (app.js line 125). Add chat-error rendering branch for `CHAT_RATE_LIMIT` vs `CHAT_TIMEOUT` vs `CHAT_API_ERROR` copy.
- **Line 7263-7319 (conclusion submit handler)**: today on `!checkRes.ok` only `console.warn`; user sees button re-enable with no feedback (F-CT1.2 territory — already partially shipped). **Fix**: surface `body.code` into `circlesPhase3Error` shape (already wired for evaluate-step at line 7299-7303); reuse same pattern for conclusion-check failure.

**Estimated diff**: FE +35 lines / -15 lines (3 render-branch additions + 1 SSE state shape change + 2 body-parsing branches).

### 2.3 — `tests/api/circles-gate-contract.spec.js` — existing spec impact

**Audit §5.1**: 6 existing specs all use happy-path real OpenAI; they assert `overallStatus` shape on 200 OK. They do NOT exercise catch blocks. **No change needed** unless we add error-injection variants here (recommend separate spec file per §3 below).

If any existing spec asserts `error: e.message` shape verbatim — none found via grep — they would need update. None currently do.

### 2.4 — Total estimated diff per ship sub-commit

| Sub-commit | BE diff | FE diff | New specs | Notes |
|---|---|---|---|---|
| C-Drift-5a (#3 only) | +14 / -2 | +18 / -4 | 1 new spec (gate classification) | HIGH; smallest surface |
| C-Drift-5b (#5 + #4) | +12 / -3 | +14 / -8 | 1 new spec (conclusion + SSE) | MEDIUM cluster |
| C-Drift-5c (#1+#2 patch, #6+#7 delete) | +6 / -38 | +3 / -3 | 1 cleanup spec | Dead-code reduction; user decision-gated |
| **All-in-one** | **+28 / -7 (or +6/-38)** | **+35 / -15** | **3 new specs** | If user prefers single commit |

---

## §3 TDD spec plan

### 3.1 — New API spec: `tests/api/circles-emessage-leak-classification.spec.js`

**Pattern**: mirror `tests/api/nsm-gate-all-Y-adversarial.spec.js` (existing W1-補.7 fixture style)

**Error-injection harness**: jest mock the **prompt module** (e.g. `jest.mock('../../prompts/circles-gate', () => ({ reviewFramework: jest.fn() }))`), NOT the route. Per RITUAL §3.2 Pitfall 11 — error injection at module boundary is carve-out; route stays real Express integration.

**Test matrix** (7 endpoints × 3 error scenarios):

| Endpoint | Scenario 1 (timeout) | Scenario 2 (429) | Scenario 3 (generic 500) |
|---|---|---|---|
| `/:id/gate` | `AbortError` thrown → 503 `code: GATE_TIMEOUT` | `Error` with `status:429` → 503 `code: GATE_RATE_LIMIT` | generic `Error` → 503 `code: GATE_API_ERROR` |
| `/:id/conclusion-check` | → 503 `code: CONCLUSION_TIMEOUT` | → 503 `code: CONCLUSION_RATE_LIMIT` | → 503 `code: CONCLUSION_API_ERROR` |
| `/:id/message` (SSE) | → 200 + SSE frame `code: CHAT_TIMEOUT` + connection closed | → SSE frame `code: CHAT_RATE_LIMIT` | → SSE frame `code: CHAT_API_ERROR` |
| `/draft` | (skip — Supabase only) | (skip) | error.code='23505' → 500 `code: DRAFT_DB_CONFLICT` |
| `/` | (skip) | (skip) | error.code='23505' → 500 `code: CREATE_DB_CONFLICT` |
| `/:id/hint` (if patched) | → 503 `code: HINT_TIMEOUT` | → 503 `code: HINT_RATE_LIMIT` | → 503 `code: HINT_API_ERROR` |
| `/:id/example` (if patched) | → 503 `code: EXAMPLE_TIMEOUT` | → 503 `code: EXAMPLE_RATE_LIMIT` | → 503 `code: EXAMPLE_API_ERROR` |

**Critical contract assertions** (per RITUAL §3.9):
- assert response **status** (503 for AI, 500 for DB, 200 for SSE)
- assert response **body shape** = `{error: 'ai_service_error', code: <PREFIX>_<CASE>}` (no `message` key from `e.message`)
- assert response body **does NOT contain `e.message` text** (regex assertion: response body must not contain "openai" / "api key" / model names / stack frames)
- assert error log on server side via spy (`console.error` may still log full error for ops, but never response body)

**Spec count**: ~12 if all 7 patched (gate 3 + conclusion 3 + SSE 3 + draft 1 + create 1 + hint 1 + example 1); ~6 if HIGH-only ship.

### 3.2 — New E2E spec: `tests/e2e/circles-error-i18n-walk.spec.js`

**User journey**: simulate user submitting Phase 1.5 framework → gate fails with 503 → verify Chinese error copy + retry button + accessibility.

**Pattern**: mirror existing `nsm-evaluator-error-clears-spinner.spec.js` (post-Wave 1B-a, in `tests/e2e/`).

**3 viewports** (e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari) — STANDING `feedback_test_all_devices_visual`:
- AC1: simulate `/:id/gate` 503 response (use Playwright `route.fulfill` to intercept response, not module mock)
- AC2: assert `[data-gate-action="retry"]` rendered + visible
- AC3: assert error copy is Chinese (regex `/[一-鿿]/`), not raw English from OpenAI
- AC4: assert `error-wrap__code` displays code (e.g. `GATE_RATE_LIMIT`)
- AC5: PNG snapshot diff (toHaveScreenshot) — baseline from mockup 04 error state, NOT production self-reference per STANDING `feedback_visual_baseline_from_mockup_not_production`

**Spec count**: 3 viewports × 5 AC = 15 specs.

### 3.3 — 5x consecutive run verification

Per RITUAL + STANDING `feedback_two_stage_review_caught_critical`:
- After each sub-commit: run new classification spec **5x consecutive** (0 flakes required)
- Run existing `circles-gate-contract.spec.js` **5x** (regression sanity)
- Run `cross-plan-smoke` per `feedback_cross_plan_smoke_after_each_ship`
- 2-stage reviewer: spec-compliance reviewer + code-quality reviewer (parallel dispatch)

### 3.4 — Adversarial sweep (existing infrastructure)

`tests/api/circles-gate-all-Y-adversarial.spec.js` already exists for gate. **No change needed** — confirmed by audit §5.2 (it tests gaming-the-gate scenarios, not catch-block classification). New catch-block classification spec is orthogonal.

---

## §4 Risk + rollback

### 4.1 — Cross-spec contract drift risks

| Risk | Probability | Mitigation |
|---|---|---|
| Existing `circles-gate-contract.spec.js` asserts old shape | LOW (grep confirms no `e.message` assertion) | Pre-flight grep before any edit; if found, update spec in same commit |
| Production FE breaks because BE 500 → 503 status change | LOW (FE already handles `!res.ok` generically) | E2E walk spec asserts FE error UI renders for 503 same as 500 |
| FE `circlesPhase2StreamError` boolean → object breaks existing render branches | MEDIUM (4 call sites assume boolean) | Sweep all 4 sites in same commit (line 931, 1267, 1278, 1291); update truthy checks if needed |
| `renderGateError` adding `GATE_RATE_LIMIT` arm breaks i18n fallback | LOW (defaults to generic message) | Test fallback path explicitly; mirror NSM precedent |
| Hint/example deletion breaks unknown internal caller | LOW (grep confirms only test + guest refs) | Sweep `grep -r "/:id/hint\|/:id/example"` across repo before delete; jest full pass gate |

### 4.2 — Rollback procedure

- **Per-sub-commit revert**: `git revert <C-Drift-5a-sha>` — surgical, each block independent
- **Full rollback**: `git revert C-Drift-5a..C-Drift-5c` if all three landed
- **Cache invalidation**: not needed — error classification is response-shape only, no DB schema change
- **FE backwards compat**: FE body-parsing branch SHOULD fall through to hardcoded `GATE_API_ERROR` when `body.code` absent (graceful degradation) — verify in spec

### 4.3 — Existing test spec `error: e.message` shape audit

Grep `tests/ -rE "error.*e\.message|error.*err\.message"` shows zero matches in current test files. **No existing spec depends on the leaky shape.** Safe to change.

### 4.4 — FE renderGateError fallback verification

Audit §1.2 assumption 3 — even if BE 503 returns new `GATE_RATE_LIMIT` code without FE arm, existing default `'審核服務暫時無法使用，請重試'` covers gracefully. **Adding FE arm is non-blocking; BE-only ship is still net positive.** But adding FE arm is recommended same commit per Karpathy §4.4 (goal-driven — user-visible value).

---

## §5 Mockup-as-spec verification

### 5.1 — Mockup 04 gate error state reference

**Source**: `docs/superpowers/specs/mockups/2026-05-02-frontend-rewrite/04-phase-1-5-gate.html`

Audit confirms mockup 04 contains:
- Three-state gate UI (ok / warn / error) with 'error' state featuring `error-wrap` block, retry + back buttons, error code chip
- Existing production `renderGateError` (app.js line 5332-5351) already mirrors mockup 04 error pattern

**Verification**: PNG diff of new e2e walk spec must match mockup 04 error-state screenshot (mockup-sourced baseline per STANDING).

### 5.2 — Is a new mockup state needed?

| New code | Needs new mockup state? | Justification |
|---|---|---|
| `GATE_RATE_LIMIT` | NO | Reuses existing error-wrap shell; only sub-copy differs (mirror NSM "API 用量達上限") |
| `CONCLUSION_*` | NO | Conclusion submit failure already implies user is in Phase 2 evaluator-error context (F-CT1.2 already shipped uses circlesPhase3Error); reuse mockup 12 error state |
| `CHAT_*` | **MAYBE** | Today Phase 2 SSE error has NO dedicated mockup state; uses generic "stream-error banner" pattern. May need design pass — log as P3 follow-up if user wants polished chat-error UX |
| `DRAFT_DB_CONFLICT` | NO | FE persistRetry already wraps; user sees `DRAFT_CREATE_FAILED` per mockup 04 same error block |
| `HINT_*` / `EXAMPLE_*` | NO (likely deleted) | If patched, hint/example overlays show inline error already; if deleted, no UI surface |

**Verdict**: No new mockup state required for HIGH ship (#3 only). Chat SSE (#4) may warrant mockup design discussion BEFORE ship — recommend logging as B14 follow-up; ship #4 with generic stream-error pattern as interim.

### 5.3 — Director eyeball walk per Master Spec §0.5 layer 6

Before commit: 3-viewport PNG capture of gate-error state across new code paths (`GATE_TIMEOUT` / `GATE_RATE_LIMIT` / `GATE_API_ERROR`). Director Read each PNG; user 1px-strict signoff per `feedback_live_demo_gate_protocol`.

---

## §6 Commit boundary verdict + ship timing

### 6.1 — Commit boundary

**Recommend**: **independent commit C-Drift-5 (or 3 sub-commits C-Drift-5a/b/c)** — NOT bundled with Wave 2 NSM-side drift or W1-補.7 retroactive amend.

Reasoning:
1. **W1-補.7 already shipped `b126937`** — amend forbidden per STANDING `feedback_two_stage_review_caught_critical`
2. **Karpathy §4.3 Surgical** — clean single-concern commit (CIRCLES side e.message classification mirror)
3. **Karpathy §4.1 Think Before** — Wave 2 (NSM drift) is unrelated scope; bundling violates surgical-changes principle
4. **Independent revert** — if any one of the 7 catch blocks has unexpected regression, can revert in isolation
5. **Phased ship optionality** — user can choose HIGH-only first, then MEDIUM cluster, then LOW cleanup; aligns with `feedback_find_first_fix_later_via_tracker`

### 6.2 — Ship timing verdict

**Verdict: 建議等 Wave 2 (NSM drift) ship 完才動 C-Drift-5。**

Justification:
- Wave 2 already in flight (per CLAUDE.md "本 session 累計 commits"); landing two parallel drift fixes risks merge conflict in `routes/circles-sessions.js` + `routes/nsm-sessions.js` adjacency
- C-Drift-5 is non-urgent — net user-visible-as-text leak is 0/7; wire/DevTools leak is real but not user-impacting in immediate hours
- 2-stage reviewer parallelism: dispatching C-Drift-5 reviewer pair while Wave 2 reviewers active = director-overload risk per `feedback_director_self_confirm_forbidden`
- Wave 2 ship will likely teach lessons (any new STANDING from review?) applicable to C-Drift-5 — better to absorb learning first

**Trigger to start C-Drift-5**: Wave 2 fully merged + 2-stage review GREEN + cross-plan smoke GREEN + tracker §3 swept of Wave 2 items.

---

## §7 Skill cite confirmation

This plan invoked / confirmed adherence to:

- Karpathy §4.1 Think Before — assumptions stated §1.2 §4.3 §6.2
- Karpathy §4.3 Surgical Changes — 7 surgical edits, ≤ 7 catch blocks, NO refactor
- Karpathy §4.4 Goal-Driven — non-goals stated (out-of-plan: guest-circles, mockup design for chat SSE)
- RITUAL §3.2 Pitfall 11 — error injection carve-out at module boundary not route
- RITUAL §3.9 — error response testing pattern enforced
- STANDING `feedback_find_first_fix_later_via_tracker` — plan is Phase B prep; Phase C awaits user gate
- STANDING `feedback_tracker_findings_only` — tracker update below records bug not workflow

---

## §8 Tracker update (to append to `audit/e2e-master-tracker.md` §3 P2 F-CT1.4b)

Replace current `F-CT1.4b` block status line with:

> **狀態：【A — plan ready，等 user 決定 ship 時機（建議 Wave 2 完才動 C-Drift-5）】**
>
> **Plan**: `audit/p2-c-drift-f-ct1.4b-circles-emessage-leak-plan.md`
> **Audit (find-phase)**: `audit/F-CT1.4b-circles-emessage-leak-audit.md`
> **Commit boundary**: independent `C-Drift-5` (HIGH-only / 3-phase split optional)
> **Sibling debt**: F-CT1.4c (`routes/guest-circles-sessions.js` 9 parallel leaks) — file new tracker §3 P2 entry

---

## End of plan

**Director self-confirm not applicable** — this is a plan doc, NOT a ship. Quiz reviewer per `feedback_director_self_confirm_forbidden` triggers at Phase C dispatch (≥3 sub-agent wave), not Phase B plan-write.

**Awaiting user gate** before any code change. Per STANDING `feedback_find_first_fix_later_via_tracker`, this document does NOT propose code in §2 — only diff-shape descriptions and ship-sequence recommendations.
