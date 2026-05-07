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
| circles-evaluator (Phase 3 step score) | TBD — Task 5 |
| circles-final-report (Phase 4) | TBD — Task 6 |
| nsm-gate | TBD — Task 7 |
| nsm-evaluator | TBD — Task 8 |
