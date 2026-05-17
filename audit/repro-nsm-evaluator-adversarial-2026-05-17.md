# audit/repro-nsm-evaluator-adversarial-2026-05-17.md

Lane L15 — NSM evaluator adversarial sweep
Date: 2026-05-17
Spec: `tests/api/nsm-evaluator-adversarial.spec.js`

---

## §1 Spec + Skill Citations

**Purpose:** Confirm that the real NSM evaluator prompt (prompts/nsm-evaluator.js + real OpenAI gpt-4o) does NOT award unreasonably high totalScore for gate-passable but low-quality NSM definitions and breakdown inputs.

**Threshold:** totalScore ≥ 60 for clearly meaningless content = NSM evaluator leak.
Formula: totalScore = (alignment + leading + actionability + simplicity + sensitivity) × 4
Threshold 60 ↔ sum < 15 ↔ average dim score < 3.0/5.

**Skills applied:**
- `api-testing.md:1023-1166` §Error response testing — status assertion before body, then semantic assertions
- `api-testing.md:783-848` §Data seeding via service-role — POST /nsm-sessions → PATCH /progress → POST /gate → POST /evaluate (adversarial body)
- `auth-flows.md:928-949` §API seed auth — getE2eToken() pattern, token cached across test suite
- `fixtures-and-hooks.md` §Auto-cleanup — cleanupTracker.track('nsm', id) + auto-DELETE after each test

**Key design difference from L12 (CIRCLES evaluator):**
The NSM evaluate endpoint reads `userNsm` + `userBreakdown` directly from the POST body (not from session.framework_draft). No second PATCH is needed. Adversarial content is sent directly in the POST /evaluate body after seeding lifecycle=gated with substantive content.

**REAL-DATA DISCIPLINE:**
- IL-1: No mock of prompts/nsm-evaluator.js — real OpenAI gpt-4o call
- IL-2: No stub timestamp — real Supabase test DB rows
- IL-3: e2e@first-principle.test + test DB only, not production

---

## §2 Result Table

(Populated after spec run — 2026-05-17.)

| Variant | totalScore | alignment | leading | actionability | simplicity | sensitivity | Verdict |
|---|---|---|---|---|---|---|---|
| a. 通用廢話句 × 5 欄相同 | 20 | 1 | 1 | 1 | 1 | 1 | PASS (< 60) |
| b. 模糊理由句 × 5 欄相同 | 20 | 1 | 1 | 1 | 1 | 1 | PASS (< 60) |
| c. 後設討論句 × 5 欄相同 | 20 | 1 | 1 | 1 | 1 | 1 | PASS (< 60) |
| d. 中文 lorem-ipsum 亂句 | 20 | 1 | 1 | 1 | 1 | 1 | PASS (< 60) |
| e. 同一段落貼滿 5 欄 | 20 | 1 | 1 | 1 | 1 | 1 | PASS (< 60) |
| f. 離題好文章：烹飪散文 | 20 | 1 | 1 | 1 | 1 | 1 | PASS (< 60) |
| g. AI 冗長空話風格 | 40 | 2 | 2 | 2 | 2 | 2 | PASS (< 60) |

**Summary: 7/7 correctly scored low. 0 evaluator leaks. No totalScore ≥ 60.**

---

## §3 Pre-Run Predictions (Karpathy Think Before)

Recorded BEFORE running the spec. Based on analysis of prompts/nsm-evaluator.js §輸入品質檢查.

### Quality guard triggers in prompts/nsm-evaluator.js

The prompt checks at highest priority (§輸入品質檢查):
1. 字數 < 10（剝除空白後）→ that dimension score = 1
2. 重複單一字元 → score = 1
3. 純 whitespace / 全形空白 → score = 1
4. 純 emoji / 隨機 unicode 序列 → score = 1
5. 內容與題目情境完全無關（如「我喜歡吃蘋果」）→ score = 1
6. 明顯為 HTML/JS injection → score = 1
7. **5 個欄位（user_nsm + 4 breakdown）原封不動同字串** → all 5 dim scores = 1, totalScore = 20

If ALL 5 fields trigger → totalScore = 20 (5 × 1 × 4 = 20).

### Per-variant predictions

**a. 通用廢話句 × 5 欄相同**
- Trigger: Rule 7 ("5 個欄位同字串") fires because userNsm + reach + depth + frequency + impact are identical.
- Predicted: all 5 dims score=1, totalScore=20
- Most leak-prone dim: simplicity (generic statement "提升用戶體驗" might look "clear" to a surface-reading LLM)
- Predicted totalScore: ≤ 20

**b. 模糊理由句 × 5 欄相同**
- Trigger: Rule 7 fires — all 5 fields identical ("因為很重要所以要做這個...")
- Predicted: all 5 dims score=1, totalScore=20
- Predicted totalScore: ≤ 20

**c. 後設討論句 × 5 欄相同**
- Trigger: Rule 7 fires — all 5 fields identical ("需要考慮各種因素...")
- Additionally: pure meta-language with zero substance
- Predicted: all 5 dims score=1, totalScore=20
- Predicted totalScore: ≤ 20

**d. 中文 lorem-ipsum 亂句 (unique per field)**
- Trigger: No Rule 7 (all fields differ). Rule 5 ("內容無關") likely fires — content has zero Spotify/Podcast connection.
- Risk: Each field is 14-25 chars, above the 10-char floor. LLM must evaluate content quality, not just length.
- Most leak-prone dim: simplicity — a short meaningless statement can look "simple" to a naive reading.
- Secondary risk: leading — filler Chinese sometimes phonetically resembles "measurement" talk.
- Predicted dims: 1-2 each. Predicted totalScore: ≤ 40

**e. 同一段落貼滿 5 欄 (all 5 identical)**
- Trigger: Rule 7 ("5 個欄位同字串") fires — userNsm + all 4 breakdown dims are identical.
- Content looks more coherent ("用戶體驗非常重要...制定解決方案") but duplicate rule is highest priority.
- Predicted: all 5 dims score=1, totalScore=20
- Predicted totalScore: ≤ 20

**f. 離題好文章：烹飪散文 (unique per field)**
- Trigger: Rule 5 ("內容與題目情境完全無關") fires — content is about cooking, not Spotify/Podcast.
- All 4 breakdown dims and userNsm are cooking-related, not metric definitions.
- Predicted: all 5 dims score=1 (Rule 5 triggers for all fields), totalScore=20
- Predicted totalScore: ≤ 20

**g. AI 冗長空話風格 (unique per field — HIGHEST RISK)**
- Trigger: No Rule 7 (fields differ). No obvious Rule 5 (content mentions "平台" / "用戶行為" — topically adjacent).
- Risk: Corporate jargon is well-formed Chinese. LLM may grant partial credit.
  - alignment: "反映核心用戶行為" sounds value-linked without quantification → risk of score=2 (acceptable) or score=3 (leak)
  - simplicity: verbose definitions may be read as "clear enough" → risk of partial credit
  - leading: mentions "業務增長策略" but no actual leading indicator → should be 1-2
  - actionability: no specific product action → should be 1-2
  - sensitivity: no cycle/frequency claim → should be 1-2
- Predicted dims: 1-2 each. Predicted totalScore: ≤ 40
- This is the HIGHEST RISK variant for evaluator leak.

### Risk ranking (likelihood of evaluator leak, highest first)
1. g (AI 冗長空話) — unique fields, topically adjacent corporate jargon, no clear quality rule triggers
2. d (lorem-ipsum 亂句) — unique fields, Rule 5 may not fire if LLM focuses on char count
3. f (烹飪散文) — Rule 5 should fire, but some dims might escape if LLM reads "fire/temperature" as metaphor
4. a/b/c/e — Rule 7 "same string" is explicit and highest priority; low leak risk

---

## §4 Comparison to prompts/nsm-evaluator.js Clauses

| Variant | Triggering Clause | Expected Behaviour |
|---|---|---|
| a | §輸入品質檢查 Rule 7: 5 欄同字串 | All 5 dims score=1, totalScore=20 |
| b | §輸入品質檢查 Rule 7: 5 欄同字串 | All 5 dims score=1, totalScore=20 |
| c | §輸入品質檢查 Rule 7: 5 欄同字串 | All 5 dims score=1, totalScore=20 |
| d | §輸入品質檢查 Rule 5: 內容無關 | dims 1-2 each; no hallucination of "具體" |
| e | §輸入品質檢查 Rule 7: 5 欄同字串 | All 5 dims score=1, totalScore=20 |
| f | §輸入品質檢查 Rule 5: 內容完全無關 | All 5 dims score=1, totalScore=20 |
| g | Evaluation criteria §1-5 (no shortcut) | dims 1-2; 嚴禁 hallucinate 「定義清晰」for garbage |

Key prompt clauses protecting quality:
- **嚴禁** hallucinate「定義清晰」「合理」「具體」「扎實」「思路清晰」於 garbage 輸入
- **嚴禁** 給 score ≥ 3 於 < 10 字輸入或無意義輸入
- bestMove 對 garbage 輸入應該空字串或填「本次無法辨識亮點」
- mainTrap 對 garbage 輸入應具體點出欄位問題

---

## §5 Conclusion

(Populated after spec run.)

**Pre-run prediction:** NSM evaluator should be robust for variants a/b/c/e (Rule 7 explicit) and f (Rule 5 clear).
Variants d and g are the highest risk — depends on whether the LLM respects the "嚴禁 hallucinate" clause
for vague but topically adjacent content.

**Actual verdict: NSM evaluator ROBUST — 7/7 correctly scored low, 0 leaks.**

Notable observations:
- Variant d (中文 lorem-ipsum 亂句, unique per field): Scored totalScore=20 (all dims=1). More conservative than predicted (predicted ≤ 40). The LLM correctly identified all fields as content-unrelated to Spotify/Podcast context.
- Variant g (AI 冗長空話風格, unique per field, highest risk): Scored totalScore=40 (all dims=2). This was the highest-scoring variant as predicted. The prompt's "嚴禁 hallucinate 定義清晰" clause held — scores stayed at 2 (not 3), keeping totalScore well below the 60 threshold.
- Variants a/b/c/e (5-field identical): All scored totalScore=20 (all dims=1), exactly matching predictions. Rule 7 fired correctly.
- Variant f (cooking essay, unique per field): totalScore=20 (all dims=1). Rule 5 (內容完全無關) fired for all fields as predicted.

**Evaluator robustness status: ROBUST — no leaks across any of the 7 variants.**

---

## §6 Cross-Ref to 4-Pillar Preventive Sweep

| Pillar | Lane | Spec | Commit | Status |
|---|---|---|---|---|
| CIRCLES gate | L2 | `tests/api/circles-gate-all-Y-adversarial.spec.js` | `f7a43ff` | PASS 10/10 |
| NSM gate | L9 | `tests/api/nsm-gate-all-Y-adversarial.spec.js` | `322dfa8` | PASS 10/10 |
| CIRCLES evaluator | L12 | `tests/api/circles-evaluator-adversarial.spec.js` | `0efe786` | PASS 7/7 |
| NSM evaluator | L15 | `tests/api/nsm-evaluator-adversarial.spec.js` | this run | TBD |

**4-pillar sweep completion: 4/4 COMPLETE — all pillars confirmed robust.**

Run result: L15 7/7 PASS — NSM evaluator robust (0 leaks, all totalScore < 60).
Spec commit: see git log (2026-05-17).
