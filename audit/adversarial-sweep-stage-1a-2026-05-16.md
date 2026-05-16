# Adversarial Sweep — Stage 1A CIRCLES Gate

**Date:** 2026-05-16
**Stage:** 1A (B1 + B6 gate cluster)
**Trigger:** T7 prompt change (`prompts/circles-gate.js` commit `ae270f3`)
**Per:** memory `feedback_adversarial_review_testing` — any AI-review prompt change MUST run sweep before ship.
**Cost:** ~$1 OpenAI gpt-4o (10 calls)
**Duration:** 34.1s
**Spec:** `tests/adversarial/circles-gate.spec.js`
**Full log:** `audit/adversarial-sweep-stage-1a-2026-05-16.log` (gitignored)

## Result: 10/10 PASS

| # | Case | Input | overallStatus | Expected | ✓ |
|---|---|---|---|---|---|
| 1 | single-char | `A` | error | ≥ error | ✓ |
| 2 | repeat-char | `A`×100 | error | ≥ error | ✓ |
| 3 | whitespace | `   　　　` | error | ≥ error | ✓ |
| 4 | unicode-emoji | `☃️🌟🎲🚀✨` | error | ≥ error | ✓ |
| 5 | wrong-lang | Spanish sentence | error | ≥ error | ✓ |
| 6 | off-topic | apples + weather | error | ≥ error | ✓ |
| 7 | placeholder | vague placeholder | error | ≥ warn | ✓ |
| 8 | extreme-long | very long stub | error | ≥ error | ✓ |
| 9 | injection | prompt injection | error | ≥ error | ✓ |
| 10 | borderline-ok | legit answer | ok | ok (not over-flagged) | ✓ |

## Item-level evidence (sample)

```
[single-char] overallStatus=error canProceed=false items=[
  {field:"問題範圍", status:"error", title:"欄位內容不足"},
  {field:"時間範圍", status:"error", title:"欄位內容不足"},
  {field:"業務影響", status:"error", title:"欄位內容不足"},
  {field:"假設確認", status:"error", title:"欄位內容不足"},
]

[borderline-ok] overallStatus=ok canProceed=true items=[
  {field:"問題範圍", status:"ok", title:"範圍明確"},
  {field:"時間範圍", status:"ok", title:"時間具體"},
  {field:"業務影響", status:"ok", title:"影響量化"},
  {field:"假設確認", status:"ok", title:"假設具體"},
]
```

## Stages NOT covered this sweep

Per `feedback_adversarial_review_testing` standing rule, full sweep covers 5 stages. This sweep covered only **CIRCLES gate** (the 1 stage T7 modified):
- ✅ CIRCLES gate — verified
- ⏸ CIRCLES evaluator — unchanged, deferred to next prompt-touching stage
- ⏸ CIRCLES final-report — unchanged, deferred
- ⏸ NSM gate — unchanged, deferred
- ⏸ NSM evaluator — unchanged, deferred

Stage 1B (B3 + B4 cache) won't touch prompts — no sweep needed. Stage 1D (B-Hint) WILL touch hint prompts — full 5-stage sweep required then.

## Verdict

**PASS** — T7 prompt change ships safely. Layer 2 semantic check correctly classifies garbage / vague / legit input.
