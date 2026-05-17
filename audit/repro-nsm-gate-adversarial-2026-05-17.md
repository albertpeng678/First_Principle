# NSM Gate Adversarial Sweep — Audit Report
Lane L9 — Preventive mirror of Lane L2 (CIRCLES gate) applied to NSM gate
Date: 2026-05-17

---

## §1 Spec Path + Skill Citations

**Spec path:** `tests/api/nsm-gate-all-Y-adversarial.spec.js`
**Playwright project:** `api-nsm-gate-adversarial` (registered in `tests/api/playwright.config.js`)
**Reference L2 spec:** `tests/api/circles-gate-all-Y-adversarial.spec.js` (commit f7a43ff)

Skills applied (cited in spec header):

| Skill ref | Usage |
|---|---|
| `api-testing.md:1023-1166` §Error response testing | Assertion order: status 200 first, then body shape, then semantic (canProceed / overallStatus) |
| `api-testing.md:783-848` §Data seeding via service-role | Real DB seed: POST /api/nsm-sessions + PATCH /progress with substantive NSM before adversarial gate call |
| `auth-flows.md:928-949` §API seed auth | getE2eToken() pattern; token cached via beforeAll / clearTokenCache in afterAll |
| `fixtures-and-hooks.md` §Auto-cleanup | cleanupTracker.track('nsm', id) auto-deletes each nsm_sessions row after each test |

**Real-Data Discipline (Iron Laws):**
- IL-1: prompts/nsm-gate.js NOT mocked — real OpenAI gpt-4o calls throughout
- IL-2: No stub timestamps — real Supabase test DB rows created/deleted per test
- IL-3: Test account e2e@first-principle.test against test DB only; no prod URL

---

## §2 Test Result Table

Run: 10/10 passed in 45.0s (1 worker, serial, real OpenAI gpt-4o)

| # | Variant | nsm (chars) | rationale (chars) | canProceed | overallStatus | items[] errors | Result |
|---|---|---|---|---|---|---|---|
| a | nsm="Y" rationale="Y" | 1 | 1 | false | error | 4/4 error | CORRECTLY REJECTED |
| b | nsm="y" rationale="y" | 1 | 1 | false | error | 4/4 error | CORRECTLY REJECTED |
| c | nsm="yes" rationale="yes" | 3 | 3 | false | error | 4/4 error | CORRECTLY REJECTED |
| d | nsm="Y." rationale="Y." | 2 | 2 | false | error | 4/4 error | CORRECTLY REJECTED |
| e | nsm="Y。" rationale="Y。" | 2 | 2 | false | error | 4/4 error | CORRECTLY REJECTED |
| f | nsm="好" rationale="好" | 1 | 1 | false | error | 4/4 error | CORRECTLY REJECTED |
| g | nsm="1" rationale="1" | 1 | 1 | false | error | 4/4 error | CORRECTLY REJECTED |
| h | nsm="." rationale="." | 1 | 1 | false | error | 4/4 error | CORRECTLY REJECTED |
| i | nsm="Y", rationale=padded (asymmetric) | 1 | ~28 | false | error | 4/4 error | CORRECTLY REJECTED |
| j | nsm=padded, rationale="Y" (asymmetric reverse) | ~28 | 1 | false | error | 4/4 error | CORRECTLY REJECTED |

**No leaks detected. 10/10 variants correctly rejected.**

---

## §3 Identified Leaks

**None.** All 10 adversarial variants returned `canProceed=false` and `overallStatus="error"` as expected.

Pre-run risk predictions (from spec header) were not realized:
- Variants i and j (asymmetric — one field padded, one short) were predicted as highest risk because the LLM might evaluate fields independently before applying the quality gate. The "任一觸發" (any-one-triggers) rule in `prompts/nsm-gate.js` held correctly: a single short field was sufficient to trigger all-4-items-error regardless of the other field's length.

---

## §4 Comparison: NSM Gate Prompt Clauses vs CIRCLES Gate (Layer 1 / Layer 2 Coverage Parity)

### prompts/nsm-gate.js — 輸入品質檢查 section (lines 118-133)

The NSM gate prompt has an explicit "輸入品質檢查（最高優先級，先於 4 項標準）" block with these rules:

| Rule | Clause text | Variants covered |
|---|---|---|
| 字數 < 10 | 字數 < 10（剝除空白後計算） | a, b, c, d, e, f, g, h, i (nsm side), j (rationale side) |
| 重複單一字元 | 重複單一字元（如「aaaa」「同同同同」） | a, b (single repeated char) |
| 純 whitespace / 全形空白 | 純 whitespace / 全形空白 | (not directly tested, belt-and-suspenders) |
| 純 emoji / 隨機 unicode | 純 emoji / 隨機 unicode 序列 | (not directly tested) |
| 內容與題目無關 | 內容與題目情境完全無關 | (not directly tested) |
| HTML/JS injection | 明顯為 HTML/JS injection 嘗試 | (not directly tested) |
| nsm === rationale | nsm 與 rationale 完全相同字串（無分化） | a, b, c, d, e, f, g, h |

**任一觸發 rule:** Any single condition triggers all-4-items-error + canProceed=false. This is what catches the asymmetric variants i and j.

### prompts/circles-gate.js — Layer 1 / Layer 2 comparison

The CIRCLES gate prompt (as documented in the L2 audit) uses a "字數 < 10" rule for each of the 4 C1 fields. The NSM gate uses the same 字數 < 10 threshold but applies it to two fields (nsm, rationale) rather than 4 C1 fields.

| Coverage dimension | CIRCLES gate (L2) | NSM gate (L9) | Parity |
|---|---|---|---|
| Minimum character threshold | 字數 < 10 per field | 字數 < 10 per field | Aligned |
| 任一觸發 semantics | All fields must pass; any field triggers gate fail | "任一觸發" → all 4 criteria error | Aligned |
| nsm===rationale identical string check | Not applicable (4 distinct fields) | Explicit: nsm 與 rationale 完全相同字串 | NSM has extra layer |
| Asymmetric field handling | N/A | Tested (variants i, j) | NSM L9 extends beyond L2 scope |
| explicit "最高優先級" ordering | Present in circles-gate | Present: "先於 4 項標準" | Aligned |

**Conclusion: NSM gate has parity with CIRCLES gate on Layer 1 (字數 threshold) and Layer 2 (任一觸發 semantics), with an additional safeguard for identical nsm/rationale strings.**

---

## §5 Conclusion

NSM gate is solid. All 10 adversarial variants (single-char tokens, punctuation-padded tokens, Chinese single-char, asymmetric padded/short combinations) were correctly rejected with `canProceed=false` and `overallStatus="error"`. The `prompts/nsm-gate.js` 輸入品質檢查 block — particularly the 字數 < 10 and 任一觸發 rules — provides robust Layer 1 robustness equivalent to the CIRCLES gate validated in Lane L2.

---

## §6 Cross-ref to L2 CIRCLES Adversarial Conclusion

Lane L2 (`tests/api/circles-gate-all-Y-adversarial.spec.js`, commit f7a43ff):
- 10 CIRCLES variants tested, 0 leaks found
- CIRCLES gate cleared with all 10/10 correctly rejected

Lane L9 (this audit):
- 10 NSM variants tested, 0 leaks found
- NSM gate cleared with all 10/10 correctly rejected

**Combined conclusion across L2 + L9:** Both CIRCLES and NSM gate prompts have equivalent Layer 1/2 robustness. Single-char, punctuation-padded, and asymmetric adversarial inputs are reliably rejected by both gate prompts. No preventive bugs found on either side.

---

Run log: `/tmp/L9-run.log`
Playwright project: `api-nsm-gate-adversarial`
Config: `tests/api/playwright.config.js`
