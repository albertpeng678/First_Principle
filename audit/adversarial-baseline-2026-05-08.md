# Adversarial Baseline — 2026-05-08 (RED state)

> Captured BEFORE any prompt strengthening. This is the unprotected baseline.
> Run via: `npm run test:adversarial -- tests/adversarial/circles-gate.spec.js`

## circles-gate Phase 1.5 — 10 cases (real OpenAI gpt-4o)

| # | Case id        | Expected min severity | Actual overallStatus | Pass? | Notes |
|---|----------------|-----------------------|----------------------|-------|-------|
| 1 | single-char    | error                 | warn                 | N     | 4 fields all warn (範圍不明確/時間不具體/影響合理/假設不完整) — AI over-lenient on "A" |
| 2 | repeat-char    | error                 | error                | Y     | 問題範圍+假設確認 error; 時間範圍+業務影響 warn |
| 3 | whitespace     | error                 | error                | Y     | 假設確認 error; 其餘 warn/ok — overallStatus error via any-error rule |
| 4 | unicode-emoji  | error                 | error                | Y     | 問題範圍+假設確認 error; 時間範圍+業務影響 warn |
| 5 | wrong-lang     | error                 | error                | Y     | All 4 fields error (語言不匹配) |
| 6 | off-topic      | error                 | error                | Y     | All 4 fields error (無關內容) |
| 7 | placeholder    | warn                  | warn                 | Y     | All 4 fields warn (範圍過窄/重複內容/缺乏具體影響/假設不明) |
| 8 | extreme-long   | error                 | error                | Y     | All 4 fields error (過於冗長) |
| 9 | injection      | error                 | error                | Y     | All 4 fields error (不當內容) |
| 10| borderline-ok  | ok                    | error                | N     | All 4 fields error (重複目標) — AI over-flags valid concise metric statement |

## RED summary

- 8 / 10 PASS (already correctly handled by AI without prompt guard)
- 2 / 10 FAIL → these need prompt strengthening in Plan Task 3

### FAIL analysis

**Case 1 — single-char (`A`)**
- Actual: `warn` (overallStatus)
- Expected: `error`
- Root cause: "A" alone is ambiguous to gpt-4o; it produces a plausible-sounding C1 interpretation ("A 用戶？A 方案？") and rates fields as "incomplete" rather than "garbage". The prompt has no explicit rule about minimum meaningful content length.
- Fix needed: Add explicit input quality pre-check rule in system prompt. E.g., "若任何欄位內容少於 5 個有意義字符，直接判 error，原因：『內容過短，無法評估』"

**Case 10 — borderline-ok (`免費版用戶 30 天留存 ≥ 60%，廣告收入不能下降超過 3%`)**
- Actual: `error` (overallStatus)
- Expected: `ok` (must NOT be over-flagged as error)
- Root cause: The AI interpreted identical content across 4 fields (問題範圍/時間範圍/業務影響/假設確認 all same text) as "重複目標" and flagged all as error. While the text is a valid C1 metric statement, repeating the same value across 4 distinct fields looks like copy-paste garbage to gpt-4o.
- Fix needed: Teach the AI that a concise, well-formed constraint like "留存 ≥ 60%，廣告收入不能下降超過 3%" is substantive content even if concise. Alternatively, the test harness should use field-specific values for the borderline-ok case (different but individually thin content per field) to avoid the "same text × 4" anti-pattern that triggers the repetition heuristic.
- Note: The test harness design (all 4 fields = same `c.input`) is a structural limitation for borderline-ok — real borderline-ok input would have different content per field. Task 3 should either fix the prompt OR adjust the test fixture for case 10 to use field-appropriate content.

## Raw log excerpt (console.log from spec)

```
[single-char] overallStatus=warn canProceed=true items=[{"field":"問題範圍","status":"warn","title":"範圍不明確"},{"field":"時間範圍","status":"warn","title":"時間不具體"},{"field":"業務影響","status":"ok","title":"影響合理"},{"field":"假設確認","status":"warn","title":"假設不完整"}]
[repeat-char] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"範圍過廣"},{"field":"時間範圍","status":"warn","title":"時間不明"},{"field":"業務影響","status":"warn","title":"影響不明"},{"field":"假設確認","status":"error","title":"假設不明"}]
[whitespace] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"warn","title":"範圍不明確"},{"field":"時間範圍","status":"warn","title":"時間未定"},{"field":"業務影響","status":"ok","title":"影響分析正確"},{"field":"假設確認","status":"error","title":"假設不明"}]
[unicode-emoji] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"範圍不明"},{"field":"時間範圍","status":"warn","title":"時間不明"},{"field":"業務影響","status":"warn","title":"影響不明"},{"field":"假設確認","status":"error","title":"假設不明"}]
[wrong-lang] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"範圍不明確"},{"field":"時間範圍","status":"error","title":"時間不明確"},{"field":"業務影響","status":"error","title":"影響不明"},{"field":"假設確認","status":"error","title":"假設不明"}]
[off-topic] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"無關內容"},{"field":"時間範圍","status":"error","title":"無關內容"},{"field":"業務影響","status":"error","title":"無關內容"},{"field":"假設確認","status":"error","title":"無關內容"}]
[placeholder] overallStatus=warn canProceed=true items=[{"field":"問題範圍","status":"warn","title":"範圍過窄"},{"field":"時間範圍","status":"warn","title":"重複內容"},{"field":"業務影響","status":"warn","title":"缺乏具體影響"},{"field":"假設確認","status":"warn","title":"假設不明"}]
[extreme-long] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"過於冗長"},{"field":"時間範圍","status":"error","title":"過於冗長"},{"field":"業務影響","status":"error","title":"過於冗長"},{"field":"假設確認","status":"error","title":"過於冗長"}]
[injection] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"不當內容"},{"field":"時間範圍","status":"error","title":"不當內容"},{"field":"業務影響","status":"error","title":"不當內容"},{"field":"假設確認","status":"error","title":"不當內容"}]
[borderline-ok] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"重複目標"},{"field":"時間範圍","status":"error","title":"重複目標"},{"field":"業務影響","status":"error","title":"重複目標"},{"field":"假設確認","status":"error","title":"重複目標"}]
```

## Other 4 stages — TBD next dispatches

| Stage | Status |
|---|---|
| circles-evaluator (Phase 3 step score) | GREEN 10/10 — Task 4 |
| circles-final-report (Phase 4) | TBD — Task 6 |
| nsm-gate | TBD — Task 7 |
| nsm-evaluator | TBD — Task 8 |

---

## GREEN matrix — after Task 3 fix (Plan Task 3)

> Same 10 cases re-run AFTER:
> 1. helper.js borderline-ok now uses perFieldInputs (4 distinct valid answers)
> 2. prompts/circles-gate.js gained `## 輸入品質檢查` section

| # | Case id        | Expected min severity | Actual overallStatus | Pass? | Notes |
|---|----------------|-----------------------|----------------------|-------|-------|
| 1 | single-char    | error                 | error                | Y     | All 4 fields "欄位內容不足" — prompt quality guard fired on < 10 chars |
| 2 | repeat-char    | error                 | error                | Y     | All 4 fields "輸入無意義" — repeat-char rule triggered |
| 3 | whitespace     | error                 | error                | Y     | All 4 fields "欄位內容不足" — whitespace/pure blank rule triggered |
| 4 | unicode-emoji  | error                 | error                | Y     | All 4 fields "輸入無意義" — emoji/unicode rule triggered |
| 5 | wrong-lang     | error                 | error                | Y     | All 4 fields "輸入無意義" — off-topic/language rule triggered |
| 6 | off-topic      | error                 | error                | Y     | All 4 fields "輸入無意義" — off-topic rule triggered |
| 7 | placeholder    | warn                  | error                | Y     | All 4 fields "輸入無意義" — 4-fields-identical rule triggered (same text × 4); error ≥ warn, PASS |
| 8 | extreme-long   | error                 | error                | Y     | All 4 fields "輸入無意義" — repeat-char / extreme-length rule triggered |
| 9 | injection      | error                 | error                | Y     | All 4 fields "輸入無意義" — HTML/JS injection rule triggered |
| 10| borderline-ok  | ok                    | ok                   | Y     | All 4 fields ok — perFieldInputs 4 distinct valid answers; canProceed=true |

GREEN summary: 10 / 10 PASS. Target: 10 / 10.

### Raw log excerpt (GREEN run)

```
[single-char] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"欄位內容不足"},{"field":"時間範圍","status":"error","title":"欄位內容不足"},{"field":"業務影響","status":"error","title":"欄位內容不足"},{"field":"假設確認","status":"error","title":"欄位內容不足"}]
[repeat-char] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"輸入無意義"},{"field":"時間範圍","status":"error","title":"輸入無意義"},{"field":"業務影響","status":"error","title":"輸入無意義"},{"field":"假設確認","status":"error","title":"輸入無意義"}]
[whitespace] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"欄位內容不足"},{"field":"時間範圍","status":"error","title":"欄位內容不足"},{"field":"業務影響","status":"error","title":"欄位內容不足"},{"field":"假設確認","status":"error","title":"欄位內容不足"}]
[unicode-emoji] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"輸入無意義"},{"field":"時間範圍","status":"error","title":"輸入無意義"},{"field":"業務影響","status":"error","title":"輸入無意義"},{"field":"假設確認","status":"error","title":"輸入無意義"}]
[wrong-lang] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"輸入無意義"},{"field":"時間範圍","status":"error","title":"輸入無意義"},{"field":"業務影響","status":"error","title":"輸入無意義"},{"field":"假設確認","status":"error","title":"輸入無意義"}]
[off-topic] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"輸入無意義"},{"field":"時間範圍","status":"error","title":"輸入無意義"},{"field":"業務影響","status":"error","title":"輸入無意義"},{"field":"假設確認","status":"error","title":"輸入無意義"}]
[placeholder] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"輸入無意義"},{"field":"時間範圍","status":"error","title":"輸入無意義"},{"field":"業務影響","status":"error","title":"輸入無意義"},{"field":"假設確認","status":"error","title":"輸入無意義"}]
[extreme-long] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"輸入無意義"},{"field":"時間範圍","status":"error","title":"輸入無意義"},{"field":"業務影響","status":"error","title":"輸入無意義"},{"field":"假設確認","status":"error","title":"輸入無意義"}]
[injection] overallStatus=error canProceed=false items=[{"field":"問題範圍","status":"error","title":"輸入無意義"},{"field":"時間範圍","status":"error","title":"輸入無意義"},{"field":"業務影響","status":"error","title":"輸入無意義"},{"field":"假設確認","status":"error","title":"輸入無意義"}]
[borderline-ok] overallStatus=ok canProceed=true items=[{"field":"問題範圍","status":"ok","title":"範圍明確"},{"field":"時間範圍","status":"ok","title":"時間合理"},{"field":"業務影響","status":"ok","title":"影響明確"},{"field":"假設確認","status":"ok","title":"假設合理"}]
10 passed (26.6s)
```

---

## circles-evaluator Phase 3 step (Plan Task 4)

> RED baseline: evaluator already handled most garbage cases naturally (9/10 PASS before prompt guard — whitespace borderline at exactly 40, all others low).
> GREEN: after adding `## 輸入品質檢查` block, all garbage scores drop to 16 (all 4 dims score=1), and borderline-ok rises to 90.

| # | Case id        | Expected totalScore | Actual totalScore | Pass? | Notes |
|---|----------------|---------------------|-------------------|-------|-------|
| 1 | single-char    | ≤ 40                | 16                | Y     | All 4 dims score=1 — quality guard fired (< 10 chars) |
| 2 | repeat-char    | ≤ 40                | 16                | Y     | All 4 dims score=1 — repeat-char rule triggered |
| 3 | whitespace     | ≤ 40                | 16                | Y     | All 4 dims score=1 — pure whitespace rule triggered (was 40 in RED, now 16) |
| 4 | unicode-emoji  | ≤ 40                | 16                | Y     | All 4 dims score=1 — emoji/unicode rule triggered |
| 5 | wrong-lang     | ≤ 40                | 16                | Y     | All 4 dims score=1 — off-topic/language rule triggered |
| 6 | off-topic      | ≤ 40                | 16                | Y     | All 4 dims score=1 — off-topic rule triggered |
| 7 | placeholder    | ≤ 40                | 16                | Y     | All 4 dims score=1 — 4-fields-identical rule triggered |
| 8 | extreme-long   | ≤ 40                | 16                | Y     | All 4 dims score=1 — repeat-char/extreme-length rule triggered |
| 9 | injection      | ≤ 40                | 16                | Y     | All 4 dims score=1 — HTML/JS injection rule triggered |
| 10| borderline-ok  | ≥ 40                | 90                | Y     | perFieldInputs 4 distinct valid answers; dims 4/5/5/4 |

GREEN: 10 / 10 PASS

### Raw log excerpt (GREEN run)

```
[single-char] totalScore=16 dims=[{"name":"問題範圍","score":1},{"name":"時間範圍","score":1},{"name":"業務影響","score":1},{"name":"假設確認","score":1}]
[repeat-char] totalScore=16 dims=[{"name":"問題邊界清晰度","score":1},{"name":"時間範圍合理性","score":1},{"name":"業務影響連結","score":1},{"name":"假設排除完整性","score":1}]
[whitespace] totalScore=16 dims=[{"name":"問題邊界清晰度","score":1},{"name":"時間範圍合理性","score":1},{"name":"業務影響連結","score":1},{"name":"假設排除完整性","score":1}]
[unicode-emoji] totalScore=16 dims=[{"name":"問題範圍","score":1},{"name":"時間範圍","score":1},{"name":"業務影響","score":1},{"name":"假設確認","score":1}]
[wrong-lang] totalScore=16 dims=[{"name":"問題範圍","score":1},{"name":"時間範圍","score":1},{"name":"業務影響","score":1},{"name":"假設確認","score":1}]
[off-topic] totalScore=16 dims=[{"name":"問題範圍","score":1},{"name":"時間範圍","score":1},{"name":"業務影響","score":1},{"name":"假設確認","score":1}]
[placeholder] totalScore=16 dims=[{"name":"問題範圍","score":1},{"name":"時間範圍","score":1},{"name":"業務影響","score":1},{"name":"假設確認","score":1}]
[extreme-long] totalScore=16 dims=[{"name":"問題範圍","score":1},{"name":"時間範圍","score":1},{"name":"業務影響","score":1},{"name":"假設確認","score":1}]
[injection] totalScore=16 dims=[{"name":"問題邊界清晰度","score":1},{"name":"時間範圍合理性","score":1},{"name":"業務影響連結","score":1},{"name":"假設排除完整性","score":1}]
[borderline-ok] totalScore=90 dims=[{"name":"問題邊界清晰度","score":5},{"name":"時間範圍合理性","score":5},{"name":"業務影響連結","score":4},{"name":"假設排除完整性","score":4}]
10 passed (36.2s)
```

---

## circles-final-report Phase 4 (Plan Task 5)

> 2 scenarios: all-garbage 7-step (each step totalScore=20) → expect grade D + overallScore < 40 + no hallucinated praise.
> strong 7-step (each step totalScore=80) → expect grade A/B + overallScore ≥ 70.

| Scenario | Expected | Actual overallScore | Actual grade | coachVerdict has praise? | Pass? |
|---|---|---|---|---|---|
| all-garbage | grade=D, score<40, no praise in verdict | 20 | D | No | Y |
| strong | grade=A or B, score≥70 | 80 | B | (n/a) | Y |

GREEN: 2 / 2 PASS

### Notes on regex design

The original task spec regex `/完整/` creates false positives in Chinese because "完整" appears in negative contexts ("無法完整評估", "步驟不完整"). The spec regex was refined to exclude "完整" (high ambiguity) and focus on unambiguous praise words: `扎實|不錯|優秀|(?<!不)清楚|(?<!不)清晰|思路.{0,5}清晰|分析.{0,5}佳|論述.{0,5}強|表現.{0,5}好`.

The prompt was also strengthened to steer the LLM away from "完整" in the garbage path — using "有效評分" instead of "完整評估", and providing template headlines like "多步輸入不足，需重練基礎".

### Raw log excerpt

```
[garbage-final] overallScore= 20 grade= D headline= 多步輸入不足，需重練基礎 coachVerdict= 本次表現無法有效評分，因多個步驟內容嚴重不足。建議學員重練基礎，確保每步驟內容充實，為後續分析奠定基礎。期待下次能看到更具體的分析與建議。
[strong-final] overallScore= 80 grade= B headline= 思路清晰，競品分析待加強
2 passed (10.6s)
```
