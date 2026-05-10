# NSM Evaluator vs CIRCLES Evaluator — Depth Audit

**Date:** 2026-05-10
**Auditor:** Sonnet 4.6 (B6 sub-task)
**Files compared:**
- `prompts/nsm-evaluator.js` (131 lines)
- `prompts/circles-evaluator.js` (129 lines)
**Adversarial specs:**
- `tests/adversarial/nsm-evaluator.spec.js`
- `tests/adversarial/circles-evaluator.spec.js`

---

## Executive Summary

**Verdict: Parity largely acceptable — one minor infrastructure gap found (missing `max_tokens` cap on NSM evaluator). No user-facing quality gap. No rubric rewrite needed.**

NSM evaluator is not shallower than CIRCLES evaluator in terms of rubric depth or coaching richness. In fact, NSM's `coachRationale` (5 × 2-3 sentences explaining each dimension choice) is more detailed than CIRCLES's single `reasoning` block. Refusal guards are equivalent. The sole gap is infrastructural: CIRCLES enforces `max_tokens: 1500`; NSM has no cap, creating unbounded output risk and increased OpenAI cost/latency. This is a 1-line additive fix applied in this task.

**Action taken:** Added `max_tokens: 1500` to NSM evaluator `client.chat.completions.create()` call (additive, surgical). No adversarial changes needed (no user-facing quality gap).

---

## Section-by-Section Comparison

| Aspect | CIRCLES evaluator | NSM evaluator | Parity? |
|---|---|---|---|
| **System prompt 角色** | Formal `system` role message ("你是 PM 面試評審") | Single `user` message combining system + user content | Minor structural diff — both work with gpt-4o; functional parity. Neither gives the AI a different persona. |
| **Rubric depth (per dim)** | `STEP_RUBRICS` constant: 4 named dimensions per step (e.g. C1: 問題邊界清晰度/業務影響連結/時間範圍合理性/假設排除完整性) | 5 inline-described dimensions (alignment/leading/actionability/simplicity/sensitivity) each with 2-3 sentence coachComments guidance | NSM has more dimensions (5 vs 4 for C1); per-dim guidance is inline but equally specific. **Parity ✅** |
| **Good answer shape** | `coachVersion.perField` (demo per field) + `coachVersion.reasoning` (1-2 sentences) | `coachTree` (5 fields with quantified one-liners) + `coachRationale` (5 × 2-3 sentences explaining WHY) | NSM is **richer** — coachRationale provides explicit decision logic per dimension. **NSM advantage** |
| **Refusal guards (gibberish / off-topic / spam)** | 7-condition checklist; all-4-fields trigger → all dims score=1; prohibits `展現了清晰的思路`/`論述合理`/`分析完整`; highlight/improvement field guards named | 7-condition checklist (adds: "5 欄位全相同" check not in CIRCLES); all-5-fields trigger → all dims score=1; prohibits `展現`/`呈現`/`展示了` in summary/bestMove | Near-parity. NSM's "5-field all-same" guard is actually stronger. CIRCLES explicitly names `highlight`/`improvement` for the guard; NSM names `summary`/`bestMove`. Both adequate. **Parity ✅** |
| **JSON schema strictness** | Formal schema with `coachVersion.perField` array generation, field names injected at runtime | Flat JSON with named keys; field names fixed (not injected). No schema drift possible since field set is fixed. | Functional parity. CIRCLES is more dynamic (step-adaptive); NSM fields don't change so static schema is fine. **Parity ✅** |
| **Reasoning chain expected** | `coachVersion.reasoning` — 1-2 sentences, 40-80 chars | `coachRationale` — 5 × 2-3 sentences (one per dimension), explaining AHA moment / excluded vanity metrics / business prediction logic | **NSM advantage** — explicit per-dimension reasoning chain requested. |
| **Score range + meaning** | 1-5 per dimension × 4 scaling; per-step dim count varies (4 for C1); totalScore = sum × 100 / (dim_count × 5) | 1-5 per dimension × 4 scaling; fixed 5 dims; totalScore = (sum of 5) × 4 (range 20-100) | **Parity ✅** — both produce 20-100 scale totalScore. |
| **`max_tokens` cap** | 1500 ✅ | **MISSING** — no cap set | **Gap** — NSM can generate unbounded tokens. Latency + cost risk. Fixed in this task. |
| **Retry logic** | None (comment: callers own retry) | 3-attempt exponential backoff (1s, 2s) | **NSM advantage** |
| **AbortSignal support** | Yes — per-request `signal` option for SSE abort | No | CIRCLES advantage — not material for NSM flow which is fire-and-await. |
| **Product type context injection** | No (single fixed rubric per step) | Yes — `productTypeGuide` dict injected into prompt (attention/transaction/creator/saas) + `guessProductType()` util | **NSM advantage** — richer domain context for AI to calibrate evaluation. |

---

## Adversarial Test Coverage Comparison

| Coverage aspect | CIRCLES adversarial | NSM adversarial | Notes |
|---|---|---|---|
| Test cases | 10 shared cases from helper.js | 10 shared cases from helper.js | Parity |
| Garbage score threshold | `totalScore ≤ 40` | `totalScore < 40` (strict) | NSM slightly stricter |
| Per-dim score check | Not checked individually | All dim scores must be `≤ 2` | **NSM stronger** |
| Hallucinated praise regex | Not checked | `HALLUCINATED_PRAISE` regex on `result.summary` | **NSM stronger** |
| Borderline-ok threshold | `≥ 40` | `≥ 60` | NSM has higher bar for valid input |

---

## Specific Code References

**CIRCLES system role separation (circles-evaluator.js line 111-124):**
```js
messages: [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userMsg },
],
max_tokens: 1500,
```

**NSM single-message, no `max_tokens` (nsm-evaluator.js line 112-116 — before fix):**
```js
messages: [{ role: 'user', content: prompt }]
// no max_tokens
```

**NSM after fix (this task — additive 1 line):**
```js
messages: [{ role: 'user', content: prompt }],
max_tokens: 1500,
```

**NSM coachRationale depth example (lines 98-104) — demonstrates NSM advantage:**
```
"nsm": "<2-3 句：教練為何這樣定義 NSM——從 AHA 時刻切入、排除哪些虛榮指標、如何直接預測商業結果>"
"reach": "<2-3 句：廣度指標選擇邏輯——對應哪個核心用戶行為、為何不選登入數或 DAU>"
```
CIRCLES equivalent is a single `reasoning` block (1-2 sentences covering all fields).

---

## Recommendation

| Finding | Severity | Action |
|---|---|---|
| Missing `max_tokens: 1500` on NSM evaluator | Minor / infrastructure | Fixed (additive 1 line) |
| No system/user role separation in NSM | Cosmetic | No action — gpt-4o handles single-user-message prompts correctly; refactoring would change behavior boundary without clear benefit |
| AbortSignal not wired in NSM | Low — NSM is fire-and-await | No action |
| CIRCLES adversarial lacks per-dim score check + praise regex | Low — covered by totalScore threshold | No action per scope (not NSM evaluator) |

**Overall: No major rewrite needed. NSM evaluator is on par with or ahead of CIRCLES evaluator on rubric depth and coaching output richness. The `max_tokens` fix is the only material change.**

---

## Karpathy Compliance

1. **Think Before** — Read both prompts fully; compared section-by-section before drawing conclusions.
2. **Simplicity First** — Audit-only conclusion reached first; only applied the 1-line `max_tokens` fix.
3. **Surgical Changes** — Single additive line in `nsm-evaluator.js`, no restructuring.
4. **Goal-Driven** — User concern was NSM shallowness vs CIRCLES. Finding: NSM is not shallower. Gap is infrastructure only.
