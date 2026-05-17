# Audit: Bug 1 Gate 全打 Y 過審 — Adversarial Reproduction
**Date:** 2026-05-17
**Phase:** Phase 1 Lane L2 — TDD-red e2e reproduction
**Spec:** `tests/api/circles-gate-all-Y-adversarial.spec.js`
**Tracking:** P0-#251
**Runs:** 3 total (2 × Playwright runner + 1 × inline node probe with real response bodies)

---

## §1 Spec Path + Skill Citations

**Spec path:** `tests/api/circles-gate-all-Y-adversarial.spec.js`

**Playwright config project:** `api-gate-adversarial` (added to `tests/api/playwright.config.js`)

**Skills applied (per spec file header):**
- `api-testing.md:1023-1166` §Error response testing — assertion order: status 200 first, then canProceed, then overallStatus
- `api-testing.md:783-848` §Data seeding via service-role — real DB seed via POST /draft + PATCH /progress, no OpenAI mocks
- `auth-flows.md:928-949` §API seed auth — `getE2eToken()` pattern; token cached across 10 tests
- `fixtures-and-hooks.md` §Auto-cleanup — `cleanupTracker` fixture from `api-cleanup.fixture.js` auto-deletes session rows after each test

**Real-data discipline maintained:**
- 禁 mock `prompts/circles-gate.js` — all 10 tests hit real OpenAI gpt-4o via real Express route
- 禁 stub timestamp — each test creates a real DB row via POST /draft
- 禁 prod URL + 真帳號 — uses `e2e@first-principle.test` against test DB only

---

## §2 Test Result Table

Variants tested against `POST /api/circles-sessions/:id/gate` with `mode=drill, step=C1`.
Each row: all 4 C1 fields (`問題範圍`, `影響對象`, `核心衝突`, `目標結果`) set to the token shown.

| # | Variant | Token | canProceed received | overallStatus | items[] (all fields) | Pass / BUG |
|---|---|---|---|---|---|---|
| a | 7 欄全 "Y" | `Y` | false | error | 4× error:輸入無意義 | PASS (rejected) |
| b | 7 欄全 "y" | `y` | false | error | 4× error:輸入無意義 | PASS (rejected) |
| c | 7 欄全 "yes" | `yes` | false | error | 4× error:輸入無意義 | PASS (rejected) |
| d | 7 欄全 "Y." | `Y.` | false | error | 4× error:輸入無意義 | PASS (rejected) |
| e | 7 欄全 "Y。" | `Y。` | false | error | 4× error:輸入無意義 | PASS (rejected) |
| f | 7 欄全 "Y " (trailing space) | `Y ` | false | error | 4× error:輸入無意義 | PASS (rejected) |
| g | 混合 1–2 字 tokens | Y / Y。/ 1 / X | false | error | 4× error:輸入無意義 | PASS (rejected) |
| h | 7 欄全 "好" (single-char Chinese) | `好` | false | error | 4× error:輸入無意義 | PASS (rejected) |
| i | 7 欄全 "1" | `1` | false | error | 4× error:輸入無意義 | PASS (rejected) |
| j | 7 欄全 "." (punctuation only) | `.` | false | error | 4× error:輸入無意義 | PASS (rejected) |

**Run 1 (Playwright):** 10/10 passed in 50.0s
**Run 2 (Playwright):** 10/10 passed in 56.9s
**Run 3 (inline node probe):** 10/10 correctly rejected with real response bodies confirmed

---

## §3 Identified Leaks

**Pre-run predictions (Karpathy Think Before):**
Before running, predicted leaks at:
1. `"yes"` — recognizable 3-char English word; LLM might treat as affirming intent rather than garbage
2. `"Y."` / `"Y。"` — punctuation padding might fool LLM into counting as content
3. Any variant under `字數 < 10` might short-circuit due to overlapping rules

**Actual leaks:** NONE — 0/10 variants escaped gate.

**Prediction vs Actual comparison:**
All predicted risky variants (`yes`, `Y.`, `Y。`) were correctly rejected. The Layer 1 `字數 < 10` rule in the prompt is robustly followed by gpt-4o at temperature=0.3 across 3 independent runs with no flake.

**Finding:** The API gate (`prompts/circles-gate.js` + `POST /api/circles-sessions/:id/gate`) is **NOT the bug source** for the reported "gate 全打 Y 過審" behavior. The backend prompt correctly rejects all 10 meaningless input variants 100% of the time across 3 runs.

**Hypothesis for where the bug lives:** The user-reported bug likely occurs at the **UI layer**, not the API layer. Possible surfaces:
1. The frontend may display a stale `canProceed=true` result from a previous legitimate run (cached gate result in localStorage / `sessionStorage` / React state)
2. The frontend `gateResult` prop may be populated from `PATCH /progress` (which persists the gate result without re-evaluating) rather than from a fresh `POST /gate` call
3. The UI gate-check may have a code path that short-circuits the API call entirely when certain state conditions are met
4. The frontend may be sending different field names than what the spec defines (the actual C1 fields per `question_json.field_examples.C1` are `問題範圍, 時間範圍, 業務影響, 假設確認` but `SUBSTANTIVE_DRAFT` and common usage sends `問題範圍, 影響對象, 核心衝突, 目標結果` — field name mismatch may cause gate to see fewer fields)

---

## §4 Comparison to prompts/circles-gate.js Spec

**Clauses that should catch each variant:**

| Variant | Applicable Clause | Clause Text |
|---|---|---|
| "Y", "y", "好", "1", "." | Layer 1: 字數 < 10 | 「字數 < 10（剝除空白後計算）」→ status="error" |
| "Y", "好", "1", "." | Layer 1: 重複單一字元 | 「重複單一字元組成（如「aaaa」「同同同同」「1111」）」→ status="error" |
| "Y ", "Y.", "Y。" | Layer 1: 字數 < 10 (stripped) | After stripping whitespace/punctuation, effectively 1 char |
| "yes" | Layer 1: 字數 < 10 | 3 chars < 10 threshold |
| All variants (same token 4 fields) | Layer 1: 同一字串多欄位 | 「同一字串原封不動填入多個欄位（4 欄全相同 → error）」 |
| All variants | Layer 2: 答案若為敷衍 | 「單字 / 純標點 / 無語意 token」→ error |
| All variants | Few-shot Bad 1 | 「目標用戶分群: "Y"... → error」 |

**Verdict:** The prompt has redundant coverage (Layer 1 + Layer 2 + few-shot all fire for these inputs). The LLM at temperature=0.3 reliably follows these rules.

---

## §5 Recommendation for Fix

**The API gate is working correctly — no prompt tightening needed for this bug vector.**

The bug investigation should pivot to **Phase 2 Lane: Frontend gate-state persistence audit** to identify the UI code path that allows a user to bypass the gate without hitting `POST /gate` with fresh adversarial content, or that displays a stale `canProceed=true` from a prior real submission.

Specifically, audit:
1. `public/app.js` — how `gateResult` and `canProceed` are stored and read (localStorage key name, React state lifecycle)
2. Whether clicking "提交審核" in the UI always fires `POST /gate`, or can short-circuit if `gateResult` is already present in state
3. Whether `PATCH /progress` with a pre-populated `gateResult` allows lifecycle to advance to `gated` without a fresh OpenAI call
4. Whether the C1 field names sent from the UI match those in `question_json.field_examples.C1` (a mismatch could cause OpenAI to see "未填" fields and return different results)

**Direction (1 sentence):** Pivot bug hunt to the frontend gate-state machine — the backend API correctly rejects all 10 adversarial variants 100% of the time, so the leak must originate from a UI code path that bypasses or caches the gate call.

---

## §6 Playwright Run Evidence

```
Run 1 — npx playwright test --config tests/api/playwright.config.js tests/api/circles-gate-all-Y-adversarial.spec.js --reporter=list

Running 10 tests using 1 worker
  ✓   1 [api-gate-adversarial] › a. 7 欄全 "Y" (7.3s)
  ✓   2 [api-gate-adversarial] › b. 7 欄全 "y" (6.2s)
  ✓   3 [api-gate-adversarial] › c. 7 欄全 "yes" (5.6s)
  ✓   4 [api-gate-adversarial] › d. 7 欄全 "Y." (4.0s)
  ✓   5 [api-gate-adversarial] › e. 7 欄全 "Y。" (3.8s)
  ✓   6 [api-gate-adversarial] › f. 7 欄全 "Y " (trailing space) (4.8s)
  ✓   7 [api-gate-adversarial] › g. 7 欄混合 1–2 字 tokens (3.5s)
  ✓   8 [api-gate-adversarial] › h. 7 欄全 "好" (single-char Chinese) (5.3s)
  ✓   9 [api-gate-adversarial] › i. 7 欄全 "1" (5.1s)
  ✓  10 [api-gate-adversarial] › j. 7 欄全 "." (punctuation only) (3.6s)
  10 passed (50.0s)

Run 2: 10 passed (56.9s) — identical pass set
```

**Sample real response body for variant a ("Y"):**
```json
{
  "canProceed": false,
  "overallStatus": "error",
  "items": [
    { "field": "問題範圍", "status": "error", "title": "輸入無意義", "reason": "內容無法識別", "suggestion": "請補充至少 30 字符合本步驟主題的具體內容" },
    { "field": "影響對象", "status": "error", "title": "輸入無意義", "reason": "內容無法識別", "suggestion": "請補充至少 30 字符合本步驟主題的具體內容" },
    { "field": "核心衝突", "status": "error", "title": "輸入無意義", "reason": "內容無法識別", "suggestion": "請補充至少 30 字符合本步驟主題的具體內容" },
    { "field": "目標結果", "status": "error", "title": "輸入無意義", "reason": "內容無法識別", "suggestion": "請補充至少 30 字符合本步驟主題的具體內容" }
  ]
}
```
