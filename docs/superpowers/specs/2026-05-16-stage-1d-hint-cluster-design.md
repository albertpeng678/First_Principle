# Stage 1D — Hint Cluster (B-Hint) Design Spec

**Date:** 2026-05-16 (amended: D1 + D2 gaps closed)
**Status:** Ready for plan-writing
**Cluster:** Stage 1 / 1D — B-Hint (4 prompts + 4 routes + FE renderer + CSS + NSM Step 1 hint wiring + 2 new adversarial files)
**Carve-out:** Modifies 4 BE prompts (Path 2 standing rule invoked: 後端/prompts 不動，except explicit user approval — granted task #174 + 2026-05-16 PNG feedback). FE wiring for NSM Step 1 hint added per D1 director resolution 2026-05-16.
**Coverage:** ALL hint flows — CIRCLES + NSM Step 1 (NEW FE wiring) + NSM Step 2 + NSM Step 3. Full closeout.
**Defers:** None. This spec closes the entire B-Hint demand.

---

## 1. Context

### Three demands driving this cluster

**Demand 1 — Question-only prompt (3 violators)**

Hint prompts must generate hints based on the question alone, with no user draft input in the prompt payload. Three prompts currently violate this:

| Prompt | Violation |
|---|---|
| `prompts/nsm-hints.js` `generateNSMHints` | Passes `user_nsm` into the prompt body (`學員定義的 NSM：${user_nsm}`) |
| `prompts/nsm-step2-hint.js` `generateNSMStep2Hint` | Passes `userDraft` into both system prompt logic (branch on draft length/quality) and user message |
| `prompts/nsm-step3-hint.js` `generateNSMStep3Hint` | Same pattern as Step 2: `userDraft` in system prompt + user message |

`prompts/circles-hint.js` `generateCirclesHint` is already compliant — its `userMsg` contains only `questionJson`, `step`, and `field`; no user draft.

**Demand 2 — Markdown list output format (all 4 prompts)**

All 4 hint prompts must produce output in markdown nested bullet format:
- Top-level bullets: `- item`
- Indented sub-items: `  - sub` (2-space indent)
- 1-3 `**bold**` key terms

Currently:
- `circles-hint.js`: outputs plain multi-line text paragraphs (3-4 short lines). No bullets. Compliant on Demand 1 but needs output format change.
- `nsm-step2-hint.js` + `nsm-step3-hint.js`: already request markdown bullets in the system prompt (`巢狀 markdown bullets（頂層用「- 」，子項用「  - 」）`) — these prompts already produce the right format, so this demand is satisfied for step2/step3 by keeping the existing output spec and cleaning up the userDraft dependency.
- `nsm-hints.js`: outputs JSON `{reach, depth, frequency, impact}` (plain text per key, no bullets). Needs structural change to return a markdown list per dimension instead.

**Demand 3 — Wider line-height in hint modal (global CSS, 1 file)**

The hint modal content currently uses `.modal__body { line-height: 1.7 }` inherited. The `.example-list` rule has `line-height: 1.7`. The user feedback requests wider line-height specifically for hint content readability. Target: raise `.example-list` from `1.7` to `1.85`, and add a `.hint-content` rule with `line-height: 1.85` to cover the CIRCLES `_markdownHintToHtml` `<p>` path.

### Standing rule reminders

- Memory `feedback_adversarial_review_testing`: prompt changes on hint stages require adversarial sweep per affected stage before ship.
- Memory `feedback_hint_example_unified_component`: hint + example must always use the unified `field__hint-row` pattern; hint modal is a shared component — no NSM-only or CIRCLES-only CSS variant drift.
- Memory `feedback_two_stage_review_mandatory`: spec compliance + code quality review both required before ship.

---

## 2. Architecture

Three coordinated prongs:

```
Prong A — Prompt refactor (BE, 4 files)
  Remove userDraft / user_nsm from 3 violator prompts.
  No input from FE for draft content. Question context only.

Prong B — Prompt output spec (BE, 4 files)
  Standardise all 4 prompts to emit markdown nested bullets.
  nsm-hints.js: restructure from JSON {reach,depth,frequency,impact}
                → still returns JSON shape but each value is now a
                  markdown bullet string (no raw prose).
  circles-hint.js: replace paragraph format with markdown bullets.
  nsm-step2-hint.js / nsm-step3-hint.js: keep existing bullet output
                spec (already correct); benefit is free after Prong A.

Prong C — CSS + FE renderer (FE, 2 files)
  Widen line-height for hint list content.
  Verify markdownBulletsToHtml already handles nested bullets correctly.
  Verify _markdownHintToHtml (CIRCLES path) — replace with
    markdownBulletsToHtml for unified rendering (both paths share renderer).
```

### Why question-only is correct

Hints are pedagogical scaffolding based on the question's domain context (company, scenario, product type). They tell the learner *how to think about this question*, not how to fix a specific draft. A draft-aware hint creates two problems: (a) it tempts the model to echo the draft back, reducing hint value; (b) it requires the FE to send PII-adjacent draft content on every hint click. Question-only is simpler, safer, and produces more reusable hints (cache hit rate improves because the key is `questionId:field` not `questionId:field:draftHash`).

### Why unified markdown list output

The FE already has `markdownBulletsToHtml` (app.js line 3797) which handles `- top` / `  - sub` / `**bold**` correctly. The NSM step2/step3 hint modals already call this renderer (`markdownBulletsToHtml`). The CIRCLES hint path currently calls `_markdownHintToHtml` (line 3868) which renders `<p>` blocks — switching it to `markdownBulletsToHtml` unifies rendering across all 4 hint flows and eliminates the divergent code path. Both utilities exist in the same `app.js` closure; no new dependency needed.

### Why CSS is one global change

`.example-list` is already the shared class for hint lists in all NSM hint modals (confirmed in `openNSMStep2HintModal` and `openNSMStep3HintModal`). The CIRCLES path renders via `_markdownHintToHtml` into `[data-hint-body]` inside `.modal__body`; after unifying to `markdownBulletsToHtml + example-list`, the single `.example-list` line-height change covers all 4 flows. No per-flow variant needed — consistent with memory `feedback_hint_example_unified_component`.

---

## 3. Components

### Modified files — BE prompts (4)

**`prompts/nsm-hints.js`** — carve-out, Path 2 explicit approval
- Remove `user_nsm` parameter from function signature: `generateNSMHints({ question_json, product_type })` (drop `user_nsm`).
- Remove `學員定義的 NSM：${user_nsm || '（尚未定義）'}` from prompt body.
- Change output format: each of the 4 dimension values in the returned JSON must be a markdown bullet string (2 top-level bullets per dimension, each may have 1 sub-bullet). Prompt instruction: `每個維度回傳 markdown bullet 格式（頂層「- 」，子項「  - 」，1-3 個 **bold**，整段 ≤ 160 chars）`.
- Keep `response_format: { type: 'json_object' }` and the 4-key JSON envelope `{reach, depth, frequency, impact}` — FE renders each value through `markdownBulletsToHtml`.
- Keep `gpt-4o-mini` / `temperature: 0.4`.

**`prompts/nsm-step2-hint.js`** — carve-out, Path 2 explicit approval
- Remove `userDraft` parameter: `generateNSMStep2Hint({ questionJson, field })` (drop `userDraft`).
- Remove entire `## 輸入品質檢查` section (lines 35-50) — this block handled draft quality; now irrelevant.
- Remove draft-length branch logic (`若 userDraft 為空` / `若 userDraft 已有 ≥ 10 字`).
- Simplify system prompt: pure question-context hint, format unchanged (nested bullets ≤ 220 chars, 2 top-level items, 1 sub each, 1-3 bold).
- Remove `學員當前草稿（欄位：${field}）：\n${userDraft || '（空）'}` from user message.
- Keep `gpt-4o` / `temperature: 0.3` / `max_tokens: 400`.

**`prompts/nsm-step3-hint.js`** — carve-out, Path 2 explicit approval
- Same changes as step2: drop `userDraft` from signature + user message + system prompt draft-handling branches.
- `generateNSMStep3Hint({ questionJson, dimId, dimType })` (drop `userDraft`).
- Keep dim-type FIELD_GUIDANCE table, guidanceContext, format spec (nested bullets ≤ 220 chars).
- Keep `gpt-4o` / `temperature: 0.3` / `max_tokens: 400`.

**`prompts/circles-hint.js`** — carve-out, Path 2 explicit approval
- Signature unchanged: `generateCirclesHint({ step, field, questionJson })` — already question-only.
- Change output format instruction in `systemPrompt`: replace current paragraph format (3-4 short lines, no bullets, 100-140 chars, ≤30 chars/line) with nested bullet format:
  - 2 top-level bullets (`- `); each may carry 1 sub-bullet (`  - `).
  - Total ≤ 180 chars (relaxed from 140 to accommodate bullet syntax overhead).
  - 1-3 **bold** key terms (existing bold rules preserved).
  - Remove: `行與行之間用單一換行符號分隔，不要空行、不要 markdown 標題、不要列點符號（「-」「•」「1.」都不要）`.
  - Add: `輸出格式：巢狀 markdown bullets（頂層「- 」，子項「  - 」）；頂層 2 項，每項可帶 1 子項；整段 ≤ 180 chars`.
- Add 2 few-shot examples in system prompt to lock in format: 1 good (Spotify·通勤族·廣告問題) showing correct bullet shape; 1 bad (paragraph prose) showing what to avoid.
- Remove post-processing strip regex `text.replace(/^[\-•·*]\s+/gm, '')` and `text.replace(/^\d+[.、)]\s+/gm, '')` — these currently strip bullets (opposing the new format). New strip: only remove filler prefix patterns.
- Update hard-cap comment: was 200 chars (UI sized for ~140); now 220 chars (bullet overhead).
- Keep `gpt-4o` / `temperature: 0.4` / `max_tokens: 240` (may increase to 280 if needed).

### Modified files — BE routes (4)

Routes that currently pass `userDraft` / `userNsm` in the payload to prompt functions must drop those arguments. No endpoint URL or HTTP method changes.

**`routes/nsm-public.js`**
- `POST /api/nsm-public/step2-hint` (line 26): remove `userDraft` from `req.body` destructure; remove `const draft = ...` local variable; call `generateNSMStep2Hint({ questionJson: q, field })` (no `userDraft`).
- `POST /api/nsm-public/step3-hint` (line 56): same — remove `userDraft` from body + local variable; call `generateNSMStep3Hint({ questionJson: q, dimId, dimType: dimType || 'attention' })`.
- Keep `USER_DRAFT_MAX` / `USER_DRAFT_MAX_S3` constants removed (unused). Also remove the `req.body` destructure of `userDraft`.

**`routes/nsm-sessions.js`**
- `POST /api/nsm-sessions/:id/hints` (line 194): remove `const { userNsm } = req.body`; call `generateNSMHints({ question_json: session.question_json, product_type: guessProductType(session.question_json) })` (drop `user_nsm`).

**`routes/guest-nsm-sessions.js`**
- `POST /api/guest/nsm-sessions/:id/hints` (line 184): same — remove `const { userNsm } = req.body`; drop `user_nsm` argument.

Note: CIRCLES hint routes (`circles-public.js`, `circles-sessions.js`, `guest-circles-sessions.js`) already pass no draft to `generateCirclesHint` — no route changes needed.

### Modified files — FE (2)

**`public/app.js`**
- `openNSMStep2HintModal` (line 4019): Remove `var draft = ((AppState.nsmDefinition || {})[field]) || ''` (line 4052) and `userDraft: draft` from the fetch body (line 4057). Payload becomes `{ questionId: qid, field: field }`.
- `openNSMStep3HintModal` (line 4130): Remove corresponding draft extraction and `userDraft` from step3 fetch payload. Payload becomes `{ questionId: qid, dimId: dimId, dimType: ptype }`.
- **NEW (per D1 resolution): NSM Step 1 hint button + modal flow.**
  - **Current reality (verified):** Backend endpoint `POST /api/nsm-sessions/:id/hints` + `POST /api/guest/nsm-sessions/:id/hints` exist (returning 4-dim JSON `{reach, depth, frequency, impact}`); `prompts/nsm-hints.js` exists; FE has **NO** consumer. The `[data-nsm-hint-toggle]` event handler at `app.js:1771` is dead code (no render site emits the attribute).
  - **Add rendering:** in `renderNSMField` (line 1520, called from `renderNSMStep1` for the 3 fields `nsm/explanation/businessLink`), add a single **「教練思路」** button next to the existing `data-nsm-hint`/example-toggle pair in `field__hint-row`. Use attribute `data-nsm-step1-hint="open"` (no per-field value — Step 1 hints are NSM-level, not field-level; one button per the form, rendered once in the form header, not per field). Decision: render the button in the Step 1 form head (above the 3 fields), NOT inside each field — mirrors mockup 06 §C single coach panel.
  - **Add open function:** `openNSMStep1HintModal()` — mirrors `openNSMStep2HintModal` structure (loading state → fetch → cache → render). Differences: (a) no `field` arg; (b) endpoint = `/api/nsm-sessions/:sessionId/hints` (auth) or `/api/guest/nsm-sessions/:sessionId/hints` (guest), chosen by `AppState.accessToken`; (c) requires `AppState.nsmSession.id` — if missing, call `ensureNsmDraftSession()` first; (d) response is JSON envelope `{reach, depth, frequency, impact}` — render as **4 stacked sub-sections** in modal body, each labeled (`觸及 reach / 深度 depth / 頻率 frequency / 影響 impact`) followed by `<ul class="example-list">markdownBulletsToHtml(value)</ul>`.
  - **Cache key:** `_nsmStep1HintCache[qid]` (one per question — endpoint output is question-only, not field-specific).
  - **Abort controller:** `_nsmStep1HintAbortController` (mirrors step2/3).
  - **Modal shell:** new helper `_renderNSMStep1HintModalShell(bodyHtml, isLoading, isError)` mirroring `_renderNSMStep2HintModalShell`; title 「教練思路 — NSM 4 維度提示」; same close button + footer pattern. Reuse `nsm-hint-modal-host` DOM host.
  - **Event binding:** add `document.querySelectorAll('[data-nsm-step1-hint]').forEach(...)` in `bindNSMStep1()` (called via `bindUI` line 307). Click → `openNSMStep1HintModal()`.
  - **Dead code cleanup:** remove the `[data-nsm-hint-toggle]` handler block at lines 1771-1777 (dead — no render site emits the attribute). Also remove `nsmHintExpanded` from `AppState` defaults (line 97) and from the persist list (line 160) — unused after cleanup.
- CIRCLES hint modal rendering (`_renderHintState`, line 3896): replace `_markdownHintToHtml(j.hint || '')` with `'<ul class="example-list">' + markdownBulletsToHtml(j.hint || '') + '</ul>'` (unified renderer). Update `_hintCache[cacheKey]` hit path similarly.
- CIRCLES hint `renderHintModalShell` `data-hint-body` swap path (`_swapHintBody`): ensure it also uses `markdownBulletsToHtml`.
- `markdownBulletsToHtml` itself: no change — already handles `- top` / `  - sub` / `**bold**`.

**`public/style.css`**
- `.example-list` (line 813): raise `line-height` from `1.7` to `1.85`.
- `.example-list li + li` (line 814): raise `margin-top` from `var(--s-2)` to `var(--s-3)` (4px → 8px). Gives more breathing room between bullet items in hint modal.
- `.example-sub` (line 815): add `line-height: 1.85` explicitly (currently inherits from `.example-list`, but make explicit for clarity).
- Add after `.example-sub`:
  ```css
  .hint-content { line-height: 1.85; }
  ```
  This covers any hint prose rendered outside `.example-list` (defensive).
- No changes to `.modal__body` itself — line-height already 1.7 and the list content is what gets widened.

### No new files

This cluster is entirely surgical modifications to existing files. No new modules, no new route files, no new CSS files.

---

## 4. Data Flow

### Hint button click → modal display

```
User clicks 「查看提示」 button
        │
        ▼
[FE] openHintModal / openNSMStep2HintModal / openNSMStep3HintModal
        │   cache key = questionId + ':' + field (no draft in key)
        │   cache hit? → render immediately, skip fetch
        │
        ▼
POST hint endpoint
  CIRCLES:  /api/circles-public/hint
            body: { step, field, questionId }        ← no draft
  NSM step1: /api/nsm-sessions/:id/hints (or guest)
            body: {}                                  ← no userNsm
  NSM step2: /api/nsm-public/step2-hint
            body: { questionId, field }               ← no userDraft
  NSM step3: /api/nsm-public/step3-hint
            body: { questionId, dimId, dimType }      ← no userDraft
        │
        ▼
[BE] Route handler validates questionId / field / dimId
        │
        ▼
[BE] Prompt function generates hint
        │   Input: question_json (company / scenario / industry) only
        │   Output: markdown nested bullets string
        │           (nsm-hints.js: JSON envelope, each value is md bullets)
        │
        ▼
[BE] Returns { hint: "<markdown string>" }
        │
        ▼
[FE] markdownBulletsToHtml(hint)
     → '<ul class="example-list"><li>…</li><ul class="example-sub">…</ul></ul>'
        │
        ▼
[FE] Inject into modal body
     Rendered with .example-list line-height: 1.85
```

### NSM Step 1 hints (4-dimension JSON flow) — NEW per D1

```
User clicks 「教練思路」 button on NSM Step 1 form (single button, NOT per-field)
        │
        ▼
[FE] openNSMStep1HintModal()
        │   Check AppState.nsmSession.id; if missing, await ensureNsmDraftSession()
        │   cache key = qid (one per question; question-only output)
        │   cache hit? → render immediately, skip fetch
        │
        ▼
[FE] Open nsm-hint-modal-host with loading shell (spinner + "教練思考中…")
        │
        ▼
POST /api/nsm-sessions/:sessionId/hints  (or guest variant if no accessToken)
  body: {}                                  ← NO userNsm payload
        │
        ▼
[BE] Route loads session.question_json + guessProductType, calls
     generateNSMHints({ question_json, product_type })  ← user_nsm removed
        │
        ▼
[BE] Returns JSON envelope:
  {
    reach:     "- 你的分子是「打開 App」還是**完成核心動作**？\n  - 登入不等於真實消費",
    depth:     "- 每 session **真正投入**的門檻是什麼？\n  - 時長 vs 完播率哪個更能排除背景播放",
    frequency: "- **習慣養成**和偶發使用的邊界怎麼定？\n  - 促銷高峰會虛高頻率，排除它",
    impact:    "- NSM ↑ 如何具體帶動**留存率**？\n  - 寫出因果鏈，不是泛泛「體驗更好」"
  }
        │
        ▼
[FE] Render 4 sub-sections inside modal body:
  <div class="nsm-step1-hint-section">
    <div class="nsm-step1-hint-section__label">觸及 reach</div>
    <ul class="example-list">{markdownBulletsToHtml(hints.reach)}</ul>
  </div>
  ... (depth / frequency / impact identical structure)

[FE] Cache: _nsmStep1HintCache[qid] = hints (JSON object)
```

**Failure paths:** missing `sessionId` after `ensureNsmDraftSession()` → error shell; 4xx/5xx → error shell with retry button; partial JSON (missing key) → that dim's section renders `<li>（無內容）</li>` via `markdownBulletsToHtml('')` fallback.

---

## 5. Error Handling

| Failure | Trigger | Behavior | UX |
|---|---|---|---|
| BE returns plain text (non-bullets) | Model ignores format instruction | FE `markdownBulletsToHtml` degrades gracefully: lines without `- ` prefix are wrapped as `<li>` with stripped content | Hint shows; no crash |
| BE returns empty string | Network or model error | `markdownBulletsToHtml('')` returns `<li>（無內容）</li>` (existing fallback) | Modal shows fallback text |
| BE returns 5xx | Server error | Existing error state rendering in modal (spinner → error icon + retry button) | No crash; retry available |
| BE returns 4xx (invalid field / question) | Bad client state | Existing error state | No crash |
| Model returns JSON with missing key (nsm-hints) | Partial response | `JSON.parse` succeeds but `hints[dim]` is undefined; FE renders `markdownBulletsToHtml('')` → fallback | Graceful empty; no crash |
| `markdownBulletsToHtml` receives non-string | Bug in FE dispatch | Guard: `if (!md) return '<li>（無內容）</li>'` (existing) | No crash |

No `<pre>` fallback needed — `markdownBulletsToHtml` is already a robust plain-text fallback renderer. If the model produces bullet-less text, lines are still rendered as `<li>` items (readable). The `<pre>` approach would expose raw markdown syntax to users; `markdownBulletsToHtml` degrades better.

---

## 6. Testing Strategy

### Layered approach

| Layer | Tool | Scope | Count |
|---|---|---|---|
| Unit — prompt builders | jest | 4 prompt functions: (a) `user_nsm` / `userDraft` absent from interpolated string; (b) output format instruction contains `「- 」` bullet keyword; (c) circles-hint output spec includes nested bullet rule | ~12 specs (3 per prompt) |
| API contract — question-only payload | jest (supertest) or Playwright `request` context | 4 hint endpoints accept `{ questionId/field/dimId/dimType }` (or empty for nsm step1) with no draft; respond with `{ hint: string }` or JSON envelope | 8 specs (2 per endpoint: happy + missing questionId) |
| Visual regression — hint modal states | Playwright `toHaveScreenshot` | Hint modal × 3 vp (Mobile-360 / Desktop-1280 / iPhone-14) × 2 states (closed / open with markdown list visible); **+ NSM Step 1 hint modal × 3 vp × open state (per D1)** | 6 + 3 = 9 baseline specs |
| E2E — NSM Step 1 hint flow (NEW per D1) | Playwright | button click → modal open / 4-section render / cache hit on re-open / close | 4 specs |
| Adversarial sweep | `npm run test:adversarial` | Per memory `feedback_adversarial_review_testing`: 4 prompt changes × 10 cases each = 40 cases across 4 files (2 existing + 2 NEW per D2) | required gate before ship |

### Unit test specifics — prompt builder verification

Each unit test mocks `openai.chat.completions.create` and inspects the prompt string passed. Tests assert:

For the 3 violators (post-fix):
```
// nsm-hints.js
expect(prompt).not.toContain('user_nsm');
expect(prompt).not.toContain('學員定義的 NSM');
// nsm-step2-hint.js
expect(systemPrompt).not.toContain('userDraft');
expect(systemPrompt).not.toContain('輸入品質檢查');
expect(userMsg).not.toContain('學員當前草稿');
// nsm-step3-hint.js — same assertions
```

For output format (all 4):
```
// circles-hint.js
expect(systemPrompt).toContain('「- 」');
expect(systemPrompt).toContain('巢狀 markdown bullets');
// nsm-hints.js
expect(prompt).toContain('markdown bullet');
// nsm-step2/step3 — already tested; confirm 「- 」 still present after refactor
```

### Adversarial sweep coverage — explicit 4-file list (per D2 resolution)

Per memory `feedback_adversarial_review_testing`, adversarial sweep covers all hint stages × 10 cases each. The 4 prompt changes affect 4 stages; **all 4 test files must exist and be wired into `npm run test:adversarial` before ship**:

| Stage | Test file | Status | Action |
|---|---|---|---|
| nsm-step2-hint | `tests/adversarial/nsm-step2-hint.test.js` | ✅ EXISTS | Update cases to drop `userDraft` arg (post-Prong-A signature) + assert `^- ` bullet present |
| nsm-step3-hint | `tests/adversarial/nsm-step3-hint.test.js` | ✅ EXISTS | Same — drop `userDraft` arg + assert bullet present |
| circles-hint | `tests/adversarial/circles-hint.test.js` | ❌ **CREATE NEW** | 10 cases mirroring `nsm-step2-hint.test.js` pattern. Call signature: `generateCirclesHint({ step, field, questionJson })` (no draft — already compliant). Stub adversarial inputs are not draft-based; instead test on different `field` × `step` combos × XSS in `questionJson.company` etc. Assert (a) string returned ≤ 220 chars; (b) `^- ` bullet present (Prong-B contract); (c) no XSS echo; (d) no system-prompt leakage. |
| nsm-hints (NSM Step 1) | `tests/adversarial/nsm-step1-hint.test.js` | ❌ **CREATE NEW** | 10 cases for `generateNSMHints({ question_json, product_type })` (no `user_nsm`). Cases: 3 product_types (attention/saas/transaction) × diverse question shapes + XSS in scenario + injection in company name + empty product_type fallback + malformed question_json. Assert (a) response is `{reach, depth, frequency, impact}` object; (b) each value is a markdown bullet string starting with `- `; (c) each value ≤ 200 chars; (d) no XSS echo; (e) no system-prompt leakage. |

`npm run test:adversarial` script must include all 4 files; if registration is missing, add before ship-gate run.

### E2E test additions — NSM Step 1 hint modal (per D1)

New Playwright spec `tests/visual/nsm-step1-hint-modal.spec.js`:
- T-E2E-1: button visible in Step 1 form head; click → modal opens; loading spinner visible.
- T-E2E-2: stub `/api/nsm-sessions/:id/hints` (or guest) with fixture envelope `{reach, depth, frequency, impact}`; assert modal body contains 4 `.nsm-step1-hint-section` with 4 distinct labels (觸及/深度/頻率/影響); assert each section has `ul.example-list > li` count ≥ 1 (Prong-B bullet contract verified end-to-end).
- T-E2E-3: close button click → modal removed; re-open → cache hit (no second network request — assert via `page.waitForResponse` timeout / request count).
- T-E2E-4: visual regression baseline × 3 vp (Mobile-360 / Desktop-1280 / iPhone-14) of open-with-content state.

Network mocking pattern: use `page.route('**/api/**nsm-sessions/*/hints', fulfill JSON)` to keep E2E offline from OpenAI.

### Failing-test order (per IL-3 discipline)

1. Write unit tests for 4 prompt builders — red (user_nsm / userDraft still present).
2. Write API contract tests — red (endpoints still accept draft).
3. Refactor 4 prompt files → unit tests green.
4. Update 4 route files → API contract tests green.
5. Update FE `app.js` (remove draft from payloads, unify renderer).
6. **NEW per D1:** Add NSM Step 1 hint button rendering + `openNSMStep1HintModal` + binding (red → green via Playwright E2E spec).
7. Update CSS (line-height + `.nsm-step1-hint-section__label` if needed).
8. Write visual regression specs → capture baseline (includes 3 new NSM Step 1 vp baselines per D1).
9. **NEW per D2:** Create `tests/adversarial/circles-hint.test.js` + `tests/adversarial/nsm-step1-hint.test.js` (10 cases each).
10. Run adversarial sweep across all 4 files — block ship if any ❌.
11. Revert each unit test (confirm red) → restore (confirm green) — IL-3 red-green-revert.

---

## 7. Acceptance Criteria

Stage 1D is "done" when all below pass:

### Functional

- [ ] **BHint-AC1**: `generateNSMHints` function signature no longer accepts `user_nsm`; calling it with `{ question_json, product_type }` returns `{ reach, depth, frequency, impact }` where each value is a markdown bullet string starting with `- `.
- [ ] **BHint-AC2**: `generateNSMStep2Hint` function signature no longer accepts `userDraft`; calling it with `{ questionJson, field }` returns a markdown bullet string.
- [ ] **BHint-AC3**: `generateNSMStep3Hint` function signature no longer accepts `userDraft`; calling it with `{ questionJson, dimId, dimType }` returns a markdown bullet string.
- [ ] **BHint-AC4**: `generateCirclesHint` function with `{ step, field, questionJson }` returns a markdown nested bullet string (top-level `- ` present; no bare paragraph prose).
- [ ] **BHint-AC5**: `POST /api/nsm-public/step2-hint` and `POST /api/nsm-public/step3-hint` accept request body with no `userDraft` field; respond successfully with `{ hint }`.
- [ ] **BHint-AC6**: `POST /api/nsm-sessions/:id/hints` and `POST /api/guest/nsm-sessions/:id/hints` accept request body with no `userNsm` field; respond successfully with JSON hint envelope.
- [ ] **BHint-AC7**: In the browser, opening a CIRCLES hint modal renders the hint content via `markdownBulletsToHtml` (UL/LI structure) — no raw paragraph `<p>` output.
- [ ] **BHint-AC8**: `.example-list` in `style.css` has `line-height: 1.85`; hint modal bullet items render visually wider than before (verified via director PNG Read).
- [ ] **BHint-AC9** (NEW per D1): NSM Step 1 form renders one `[data-nsm-step1-hint="open"]` 「教練思路」 button in form head; click opens modal; modal body contains 4 `.nsm-step1-hint-section` blocks labeled 觸及/深度/頻率/影響; each block contains `ul.example-list` with ≥ 1 `li`; close button removes modal.
- [ ] **BHint-AC10** (NEW per D1): Re-opening modal for same question hits `_nsmStep1HintCache[qid]` — no second network request observed.
- [ ] **BHint-AC11** (NEW per D2): `tests/adversarial/circles-hint.test.js` and `tests/adversarial/nsm-step1-hint.test.js` exist, contain 10 cases each, included in `npm run test:adversarial`, and pass 0 ❌.

### Quality gates

- [ ] ~12 unit tests (prompt builders): 0 failures.
- [ ] 8 API contract tests (4 endpoints × 2 cases): 0 failures.
- [ ] 9 visual regression baseline specs (6 hint modal + 3 NSM Step 1 hint per D1): 0 failures.
- [ ] 4 NSM Step 1 hint E2E specs (per D1): 0 failures.
- [ ] Adversarial sweep across **4 explicit files** (2 existing + 2 NEW per D2): 0 ❌ × 40 cases total.
- [ ] Full 8-vp Playwright regression: 0 new failures (pre-existing fail OK per baseline).
- [ ] Director cold-Read PNG: 6 hint modal PNGs + 3 NSM Step 1 hint modal PNGs (9 total) with inline comments.
- [ ] Two-stage review (spec compliance + code quality) per memory `feedback_two_stage_review_mandatory`.
- [ ] iOS Safari 15-item static review (per memory `feedback_ios_review_before_ship`) — hint modal touches mobile UX (bottom-sheet on mobile, touch targets, focus).

### Process gates

- [ ] CLAUDE.md state board updated after ship.
- [ ] Standing memory updated if new pattern emerges (e.g., question-only hint policy).

---

## 8. Out of Scope

This spec is the full closeout of the B-Hint demand. No sub-tasks are deferred within this cluster.

| Item | Reason not included |
|---|---|
| Adding new hint stages (e.g., NSM Step 4 / Phase 3 / Phase 4) | No demand; new stages require separate spec + user approval |
| Hint caching backend (Redis / DB) | FE in-memory cache per session is sufficient; backend caching is a performance optimisation deferred to a future spec |
| Streaming hint response (SSE) | Hint payloads are short (≤ 220 chars); streaming adds complexity with no UX benefit |
| Hint history / replay | Out of scope for B-Hint; no user demand |
| Example modal format changes | B-Hint demand is hint-only; example modals are a separate component (no format drift introduced by this spec) |
| CSS changes to non-hint components | Only `.example-list`, `.example-sub`, `.hint-content` modified; no other rule touched |

---

## 9. References

- Task demand: task #174 (original: hint prompts must use question-only) + 2026-05-16 PNG feedback (markdown list output + wider line-height + ALL hint flows)
- Prompt files:
  - `prompts/circles-hint.js` — `generateCirclesHint` (question-only, needs output format)
  - `prompts/nsm-hints.js` — `generateNSMHints` (violator: user_nsm)
  - `prompts/nsm-step2-hint.js` — `generateNSMStep2Hint` (violator: userDraft)
  - `prompts/nsm-step3-hint.js` — `generateNSMStep3Hint` (violator: userDraft)
- Route files:
  - `routes/circles-public.js` (POST `/api/circles-public/hint`) — no route change needed
  - `routes/circles-sessions.js` (POST `/api/circles-sessions/:id/hint`) — no route change needed
  - `routes/guest-circles-sessions.js` (POST `/api/guest/circles-sessions/:id/hint`) — no route change needed
  - `routes/nsm-public.js` (POST `/api/nsm-public/step2-hint` + `step3-hint`) — remove userDraft
  - `routes/nsm-sessions.js` (POST `/api/nsm-sessions/:id/hints`) — remove userNsm
  - `routes/guest-nsm-sessions.js` (POST `/api/guest/nsm-sessions/:id/hints`) — remove userNsm
- FE files:
  - `public/app.js` — `openNSMStep2HintModal` (line 4019) / `openNSMStep3HintModal` (line 4130) / `_renderHintState` (line 3896) / `markdownBulletsToHtml` (line 3797) / `_markdownHintToHtml` (line 3868) / `renderNSMField` (line 1520, hint button site) / `bindNSMStep1` (binding site) / `[data-nsm-hint-toggle]` handler (line 1771, dead code to remove)
  - `public/style.css` — `.example-list` (line 813) / `.example-list li + li` (line 814) / `.example-sub` (line 815)
- Adversarial test files (4 total per D2):
  - `tests/adversarial/nsm-step2-hint.test.js` (existing — update signature)
  - `tests/adversarial/nsm-step3-hint.test.js` (existing — update signature)
  - `tests/adversarial/circles-hint.test.js` (NEW)
  - `tests/adversarial/nsm-step1-hint.test.js` (NEW)
- Stage 1A spec: `docs/superpowers/specs/2026-05-16-stage-1a-gate-cluster-design.md`
- Master Spec §0.5: `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- Memory: `feedback_adversarial_review_testing.md` / `feedback_hint_example_unified_component.md` / `feedback_two_stage_review_mandatory.md` / `feedback_ios_review_before_ship.md` / `feedback_full_sit_uat_uiux.md` / `feedback_karpathy_guidelines_standard.md`
