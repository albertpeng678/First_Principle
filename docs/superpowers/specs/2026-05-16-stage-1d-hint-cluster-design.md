# Stage 1D — Hint Cluster (B-Hint) Design Spec

**Date:** 2026-05-16
**Status:** Draft (awaiting user review)
**Cluster:** Stage 1 / 1D — B-Hint (4 prompts + CSS + FE renderer)
**Carve-out:** Modifies 4 BE prompts (Path 2 standing rule invoked: 後端/prompts 不動，except explicit user approval — granted task #174 + 2026-05-16 PNG feedback).
**Coverage:** ALL hint flows — CIRCLES + NSM (3 violators + 1 format-only). Full closeout.
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
- NSM hints modal (step 1 hints, `[data-nsm-hint-toggle]` flow): the NSM Step 1 hints call `/api/nsm-sessions/:id/hints` (or guest variant). Currently FE passes `userNsm: AppState.nsmDefinition?.nsm`. Locate this fetch call, remove `userNsm` from payload.
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

### NSM Step 1 hints (4-dimension JSON flow)

```
[BE] generateNSMHints returns:
  {
    reach:     "- 你的分子是「打開 App」還是**完成核心動作**？\n  - 登入不等於真實消費",
    depth:     "- 每 session **真正投入**的門檻是什麼？\n  - 時長 vs 完播率哪個更能排除背景播放",
    frequency: "- **習慣養成**和偶發使用的邊界怎麼定？\n  - 促銷高峰會虛高頻率，排除它",
    impact:    "- NSM ↑ 如何具體帶動**留存率**？\n  - 寫出因果鏈，不是泛泛「體驗更好」"
  }

[FE] For each dimension card, renders value via markdownBulletsToHtml(hints[dimId])
     (locate the NSM step1 hint toggle rendering in app.js, wire to markdownBulletsToHtml)
```

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
| API contract — question-only payload | jest (supertest) or Playwright `request` context | 4 hint endpoints accept `{ questionId/field/dimId/dimType }` with no draft; respond with `{ hint: string }` or JSON envelope | 8 specs (2 per endpoint: happy + missing questionId) |
| Visual regression — hint modal states | Playwright `toHaveScreenshot` | Hint modal × 3 vp (Mobile-360 / Desktop-1280 / iPhone-14) × 2 states (closed / open with markdown list visible) | 6 baseline specs |
| Adversarial sweep | `npm run test:adversarial` | Per memory `feedback_adversarial_review_testing`: 4 prompt changes touch CIRCLES hint + NSM hint × 3 stages; sweep must cover all affected stages × 10 cases | required gate before ship |

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

### Adversarial sweep coverage

Per memory `feedback_adversarial_review_testing`, adversarial sweep covers 5 AI stages × 10 cases. The 4 prompt changes affect:
- CIRCLES hint (stage: circles-hint)
- NSM step1 hint (stage: nsm-hints)
- NSM step2 hint (stage: nsm-step2-hint)
- NSM step3 hint (stage: nsm-step3-hint)

All 4 must be included in the sweep. If the existing `npm run test:adversarial` script does not include these stages, they must be added before ship.

### Failing-test order (per IL-3 discipline)

1. Write unit tests for 4 prompt builders — red (user_nsm / userDraft still present).
2. Write API contract tests — red (endpoints still accept draft).
3. Refactor 4 prompt files → unit tests green.
4. Update 4 route files → API contract tests green.
5. Update FE `app.js` (remove draft from payloads, unify renderer).
6. Update CSS.
7. Write visual regression specs → capture baseline.
8. Run adversarial sweep — block ship if any ❌.
9. Revert each unit test (confirm red) → restore (confirm green) — IL-3 red-green-revert.

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

### Quality gates

- [ ] ~12 unit tests (prompt builders): 0 failures.
- [ ] 8 API contract tests (4 endpoints × 2 cases): 0 failures.
- [ ] 6 visual regression baseline specs: 0 failures.
- [ ] Adversarial sweep: 0 ❌ on CIRCLES hint + NSM hint × 3 stages (4 affected stages total).
- [ ] Full 8-vp Playwright regression: 0 new failures (pre-existing fail OK per baseline).
- [ ] Director cold-Read PNG: 6 hint modal PNGs (3 vp × 2 states: closed / open) with inline comments.
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
  - `public/app.js` — `openNSMStep2HintModal` (line 4019) / `openNSMStep3HintModal` (line 4130) / `_renderHintState` (line 3896) / `markdownBulletsToHtml` (line 3797) / `_markdownHintToHtml` (line 3868)
  - `public/style.css` — `.example-list` (line 813) / `.example-list li + li` (line 814) / `.example-sub` (line 815)
- Stage 1A spec: `docs/superpowers/specs/2026-05-16-stage-1a-gate-cluster-design.md`
- Master Spec §0.5: `docs/superpowers/specs/2026-05-02-frontend-rewrite-master-spec.md`
- Memory: `feedback_adversarial_review_testing.md` / `feedback_hint_example_unified_component.md` / `feedback_two_stage_review_mandatory.md` / `feedback_ios_review_before_ship.md` / `feedback_full_sit_uat_uiux.md` / `feedback_karpathy_guidelines_standard.md`
