# F-CT1.4b — CIRCLES side `e.message` leak audit

**Date**: 2026-05-19
**Source**: W1-補.7 spec-compliance reviewer cross-spec drift check
**Scope**: `routes/circles-sessions.js` — 7 catch blocks identified by reviewer
**Phase**: Find-only (per STANDING `feedback_find_first_fix_later_via_tracker`)
**Owner gate**: User decision required before any code change

---

## Spec citation header (RITUAL §3.19)

- **STANDING**: `feedback_find_first_fix_later_via_tracker.md` — scan/audit must split Phase A find (log only) + Phase B fix (after user decision); no autonomous fix
- **STANDING**: `feedback_tracker_findings_only.md` — tracker entry must be the bug/issue itself, not workflow log
- **Karpathy §4.1 Think Before** — state assumptions before fix proposal
- **Karpathy §4.3 Surgical Changes** — find-only doc does NOT propose code; "suggested fix scope" is mapping table, not diff
- **RITUAL §3.2 Pitfall 11** — error injection is a legitimate carve-out from "no mocks in e2e"; CIRCLES adversarial 503/timeout variants are within Pitfall 11 scope
- **NSM W1-補.7 precedent** — `routes/nsm-sessions.js` line 160-166 (evaluator) + line 196-202 (gate) classify e.message into `EVAL_*`/`GATE_*` codes and return 503 `{error: 'ai_service_error', code}` shape; this audit applies the same lens to CIRCLES side

---

## Assumptions stated (Karpathy §4.1)

1. User-supplied line numbers (39 / 105 / 198 / 251 / 306 / 463 / 482) are the 7 catch blocks in scope. Two additional `e.message` exposures in the file (line 133 Supabase DB error, line 288 evaluate-step fallback after EvaluatorError) are NOT in the W1-補.7 reviewer scope and are noted under "out-of-scope but related" only.
2. The NSM W1-補.7 pattern is the canonical fix shape — **503 status + `{error: 'ai_service_error', code: <classification>}` + classification via `eMsg` regex (AbortError|timeout / 429|rate.limit / else)**.
3. CIRCLES FE `renderGateError` (app.js line 5332-5351) already has `GATE_TIMEOUT / GATE_API_ERROR / GATE_PARSE_ERROR / GATE_SYNC_ERROR / DRAFT_CREATE_FAILED` i18n. Adding a `GATE_RATE_LIMIT` case to the BE alone would NOT light up new copy unless `renderGateError` also gains the mapping — but the existing fallback ("審核服務暫時無法使用，請重試") already covers it cleanly, so adding the BE classification is safe (graceful degradation). NSM mirrored this exact pattern (app.js line 1463-1465 — only TIMEOUT / RATE_LIMIT have dedicated copy; everything else falls through to "審核服務暫時無法使用").
4. `routes/guest-circles-sessions.js` has 9 parallel `e.message` leaks (verified via grep). They are explicitly **out of W1-補.7 reviewer scope** but called out at the end of this doc as a follow-up audit (recommend separate F-CT1.4c entry).

---

## Section 1 — Verify 7 catch blocks

Each block was Read via tool against `routes/circles-sessions.js`. Pattern confirmed for all 7.

### 1.1 — Line 39: `POST /api/circles-sessions` (create new session)

```js
27: router.post('/', requireAuth, async (req, res) => {
28:   const { questionId, questionJson, mode, drillStep } = req.body;
...
36:     if (error) throw error;
37:     cache.invalidate(CACHE_KIND, req.user.id);
38:     res.json({ sessionId: data.id });
39:   } catch (e) { res.status(500).json({ error: e.message }); }
```

- **Endpoint**: `POST /api/circles-sessions` — explicit session creation (different path from `/draft`)
- **Throw source**: Supabase insert error (line 36 `throw error`). Not OpenAI — Supabase DB error.
- **User-visible**: Supabase error message verbatim (e.g. `duplicate key value violates unique constraint "circles_sessions_pkey"`). DB schema / constraint names exposed.
- **FE call site**: Not invoked by current FE (FE uses `/draft` for lazy-create — see line 3853). Likely dead or programmatic-only endpoint. **Severity: LOW — but still BE schema leak risk if any future caller hits it.**

### 1.2 — Line 105: `POST /api/circles-sessions/draft` (lazy-create draft)

```js
46: router.post('/draft', requireAuth, async (req, res) => {
...
100:     if (raced) return res.json(raced);
101:     throw error;
...
104:     res.json(data);
105:   } catch (e) { res.status(500).json({ error: e.message }); }
```

- **Endpoint**: `POST /api/circles-sessions/draft` — Phase 1 lazy session mint (FE auto-save on first textarea input)
- **Throw source**: Supabase insert/select error after race-window retry. Not OpenAI — Supabase error.
- **User-visible**: Same as 1.1 — Supabase error verbatim. Note FE has `persistRetry` wrapper around this call (app.js line 7928) — 5xx triggers retry, RetryExhausted → `DRAFT_CREATE_FAILED` code surfaces (good fallback). **Severity: LOW — never user-visible thanks to FE retry-then-DRAFT_CREATE_FAILED mapping. But raw `e.message` still flows over wire in 5xx response and ends up in browser DevTools / Sentry / network logs.**

### 1.3 — Line 198: `POST /api/circles-sessions/:id/gate` (Phase 1.5 AI review)

```js
187:   try {
188:     const gateResult = await reviewFramework({ ... });
...
196:     await db.from('circles_sessions').update({ ... }).eq('id', req.params.id).eq('user_id', req.user.id);
197:     res.json(gateResult);
198:   } catch (e) { res.status(500).json({ error: e.message }); }
```

- **Endpoint**: `POST /api/circles-sessions/:id/gate` — Phase 1.5 OpenAI gate review
- **Throw source**: `reviewFramework()` → OpenAI call (rate-limit / timeout / API down). Also: post-AI Supabase UPDATE error.
- **User-visible**: OpenAI raw error verbatim — **identical attack surface to pre-W1-補.7 NSM gate**. May leak: model name, request id, API key fragments in some Anthropic/OpenAI error paths, prompt token counts, internal trace ids.
- **FE call site**: app.js line 7949-8010 (`submitFrameworkToGate`). FE catch at line 8003-8006 maps thrown `e` to `GATE_TIMEOUT` / `GATE_API_ERROR` based on `e.name === 'AbortError'` and `e.message.toLowerCase().includes('timeout')`. But the FE **only checks if response was ok**, not the body — so it sets `GATE_API_ERROR` on `!res.ok` (line 7957) and never reads BE error.code. If BE returned `{error:'ai_service_error', code:'GATE_RATE_LIMIT'}` 503, FE would still set hardcoded `GATE_API_ERROR` because the `if (!res.ok)` branch ignores body parsing.
- **renderGateError(GATE_API_ERROR)**: "審核服務暫時無法使用，請重試" — fallback copy.
- **Severity: HIGH** — exact same vulnerability as NSM gate (which was W1-補.7 P1 priority). User on Phase 1.5 sees raw English OpenAI error in DevTools today.

### 1.4 — Line 251: `POST /api/circles-sessions/:id/message` (Phase 2 SSE)

```js
202: router.post('/:id/message', requireAuth, async (req, res) => {
...
224:   try {
225:     for await (const chunk of streamCirclesReply(session, userMessage)) {
226:       fullText += chunk;
227:       res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
228:     }
...
248:     res.write(`data: ${JSON.stringify({ done: true, turn: newTurn })}\n\n`);
249:     res.end();
250:   } catch (e) {
251:     res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
252:     res.end();
253:   }
```

- **Endpoint**: `POST /api/circles-sessions/:id/message` — Phase 2 chat SSE streaming
- **Throw source**: `streamCirclesReply()` mid-stream OpenAI error, or Supabase UPDATE on conversation persist.
- **User-visible**: Raw `e.message` written to SSE payload as `data: {"error":"..."}`. FE (app.js line 1276-1281) **only checks `parsed.error !== undefined`** to set `circlesPhase2StreamError = true`; the message string is dropped. UI shows generic phase-2 stream error banner.
- **Severity: MEDIUM** — message body never rendered, but still flows over wire / present in DevTools network tab + any user-facing error reporter that captures the raw SSE frame. Different shape from status(500) — fix proposal must preserve SSE frame contract.
- **Note**: BE response code is 200 here (SSE established); error rides in the data frame. Cannot return 503 — must mint a `{error:'ai_service_error', code:<CHAT_*>}` SSE frame shape instead.

### 1.5 — Line 306: `POST /api/circles-sessions/:id/conclusion-check`

```js
293: router.post('/:id/conclusion-check', requireAuth, async (req, res) => {
...
303:   try {
304:     const result = await checkConclusion(session.drill_step || 'C1', conclusionText, session.question_json);
305:     res.json(result);
306:   } catch (e) { res.status(500).json({ error: e.message }); }
```

- **Endpoint**: `POST /api/circles-sessions/:id/conclusion-check` — Phase 2 → Phase 3 transition gate (validates conclusion before triggering evaluate-step)
- **Throw source**: `checkConclusion()` → OpenAI call.
- **User-visible**: Raw OpenAI error. FE call at app.js line 7263-7267 reads `checkRes.json()` into `checkData`, but the warn/error branch at line 7310 just `console.warn` — doesn't render user-facing error. **However**, F-CT1.2 was about this exact endpoint catch silently swallowing — so the FE *might* show via outer try at line 7315 (`console.error('[Phase 2] conclusion submit error:', e)`). User just sees "submit button re-enabled, nothing happens".
- **Severity: MEDIUM** — silent UX failure for user; raw OpenAI text leaks in DevTools.

### 1.6 — Line 463: `POST /api/circles-sessions/:id/hint`

```js
448: router.post('/:id/hint', requireAuth, async (req, res) => {
...
460:   try {
461:     const hint = await generateCirclesHint({ step, field, questionJson: session.question_json });
462:     res.json({ hint });
463:   } catch (e) { res.status(500).json({ error: e.message }); }
```

- **Endpoint**: `POST /api/circles-sessions/:id/hint` — AI-generated personalized hint
- **Throw source**: `generateCirclesHint()` → OpenAI call.
- **User-visible**: Raw OpenAI error in response body.
- **FE call site (live)**: **FE actually calls `/api/circles-public/hint` (line 4061), NOT this authenticated endpoint.** Hint overlay never invokes `:id/hint`. This authenticated route exists in code but **appears dead from FE**. Verified via grep — only call sites in repo are tests + guest variant.
- **Severity: LOW (likely dead endpoint)** — recommend cross-check with user whether to delete vs patch.

### 1.7 — Line 482: `POST /api/circles-sessions/:id/example`

```js
467: router.post('/:id/example', requireAuth, async (req, res) => {
...
479:   try {
480:     const example = await generateCirclesExample({ step, field, questionJson: session.question_json });
481:     res.json({ example });
482:   } catch (e) { res.status(500).json({ error: e.message }); }
```

- **Endpoint**: `POST /api/circles-sessions/:id/example` — AI-generated personalized example answer
- **Throw source**: `generateCirclesExample()` → OpenAI call.
- **User-visible**: Raw OpenAI error in response body.
- **FE call site (live)**: Same as 1.6 — FE uses `/api/circles-public/example` (curated JSON, no AI call), not the authenticated AI endpoint. **Likely dead.**
- **Severity: LOW (likely dead endpoint)** — bundle with 1.6 for cleanup decision.

---

## Section 2 — FE handling per endpoint summary table

| # | Line | Endpoint | FE handler location | FE displays raw e.message? | Has GATE_*/EVAL_* i18n today? |
|---|------|----------|---------------------|----------------------------|-------------------------------|
| 1 | 39   | POST /                              | (no FE caller found) | N/A (no caller) | N/A |
| 2 | 105  | POST /draft                         | app.js 3856, 3903 + persistRetry 7928 | No — wrapped in persistRetry, falls to `DRAFT_CREATE_FAILED` after retry exhaustion | Yes (DRAFT_CREATE_FAILED) |
| 3 | 198  | POST /:id/gate                      | app.js 7949-8010 (`submitFrameworkToGate`) | No — but FE ignores body, sets hardcoded GATE_API_ERROR on `!res.ok` | Yes (GATE_TIMEOUT/GATE_API_ERROR) — but BE code not consumed |
| 4 | 251  | POST /:id/message (SSE)             | app.js 1191-1295 (`streamCirclesMessage`) | No — `parsed.error` checked truthy, message dropped, sets `circlesPhase2StreamError = true` | No (generic phase-2 error banner only) |
| 5 | 306  | POST /:id/conclusion-check          | app.js 7263 (then 7315 outer catch) | No — only `console.warn`, button re-enables silently | No |
| 6 | 463  | POST /:id/hint                      | (no live FE caller — uses /api/circles-public/hint) | N/A | N/A |
| 7 | 482  | POST /:id/example                   | (no live FE caller — uses /api/circles-public/example) | N/A | N/A |

**Net user-visible message-display surface**: **0 of 7**. Raw `e.message` never renders to user text on screen.

**Net wire/DevTools/Sentry leak surface**: **5 of 7** (1.1 and 1.6/1.7 likely dead from FE, but BE still emits leaky payload if any code path hits them).

**Why this still matters per W1-補.7 lens**: leak is over-the-wire (network response body, browser DevTools, any third-party error reporter, server logs forwarded to log aggregators). The W1-補.7 NSM precedent treated this as a P1 OpenAI-secret leakage class (potential exposure of model names, request IDs, prompt-leak-equivalents in error paths). CIRCLES has identical exposure for items 3, 4, 5.

---

## Section 3 — Severity ranking (user-visible / data-sensitivity)

Ranked from highest to lowest combined severity:

1. **#3 (line 198) — POST /:id/gate** — **HIGH**
   - Mirror image of pre-W1-補.7 NSM gate vulnerability. Live user-facing surface every Phase 1.5 submit. Hits OpenAI directly.
2. **#5 (line 306) — POST /:id/conclusion-check** — **MEDIUM**
   - Live user-facing (Phase 2 → 3 transition). Hits OpenAI. Silent UX failure exacerbates because user doesn't see actionable error.
3. **#4 (line 251) — POST /:id/message (SSE)** — **MEDIUM**
   - Live user-facing chat. Hits OpenAI mid-stream. SSE frame shape — different fix mechanic.
4. **#2 (line 105) — POST /draft** — **LOW**
   - Supabase error not OpenAI; FE wrap with persistRetry → DRAFT_CREATE_FAILED. Wire leak only.
5. **#1 (line 39) — POST /** — **LOW**
   - Supabase error; no live FE caller.
6. **#6 (line 463) — POST /:id/hint** — **LOW**
   - OpenAI call but no live FE caller; likely dead endpoint.
7. **#7 (line 482) — POST /:id/example** — **LOW**
   - Same as #6.

**One-line summary**: Gate (#3) is the only HIGH; conclusion-check + message-SSE are MEDIUM (silent UX); draft + create are LOW (Supabase only); hint + example are LOW because no live FE caller (likely dead endpoints).

---

## Section 4 — Suggested fix scope (mapping table — NO code)

Per Karpathy §4.3 Surgical Changes and find-first STANDING, this section is a **mapping table only**, not a code proposal. Final shape is user's decision.

### 4.1 — Per-endpoint suggested code prefix family

| # | Endpoint | Suggested status | Suggested code prefix | Three classifications |
|---|----------|------------------|-----------------------|------------------------|
| 1 | POST /                          | 500 (DB error, not OpenAI) | `DRAFT_*` or new `CREATE_*` | `CREATE_DB_CONFLICT` / `CREATE_DB_ERROR` |
| 2 | POST /draft                     | 500 (DB error) | `DRAFT_*` | `DRAFT_DB_CONFLICT` / `DRAFT_DB_ERROR` |
| 3 | POST /:id/gate                  | **503 (mirror NSM)** | `GATE_*` | `GATE_TIMEOUT` / `GATE_RATE_LIMIT` / `GATE_API_ERROR` — **identical to NSM W1-補.7** |
| 4 | POST /:id/message (SSE)         | 200 + SSE frame `{error, code}` | `CHAT_*` | `CHAT_TIMEOUT` / `CHAT_RATE_LIMIT` / `CHAT_API_ERROR` — note SSE shape, not status code |
| 5 | POST /:id/conclusion-check      | 503 | `CONCLUSION_*` or reuse `GATE_*` | `CONCLUSION_TIMEOUT` / `CONCLUSION_RATE_LIMIT` / `CONCLUSION_API_ERROR` |
| 6 | POST /:id/hint                  | 503 | `HINT_*` (or delete endpoint) | `HINT_TIMEOUT` / `HINT_RATE_LIMIT` / `HINT_API_ERROR` |
| 7 | POST /:id/example               | 503 | `EXAMPLE_*` (or delete endpoint) | `EXAMPLE_TIMEOUT` / `EXAMPLE_RATE_LIMIT` / `EXAMPLE_API_ERROR` |

### 4.2 — Open questions for user decision

1. **Should #6 + #7 be deleted instead of patched?** Live FE uses `/api/circles-public/*`. Suggest: delete after confirming no other internal caller (grep + jest pass).
2. **Should #1 (POST /) be deleted?** FE uses /draft exclusively. Verify no test or admin tool depends on it.
3. **Should #5 reuse GATE_* prefix or get its own CONCLUSION_*?** Reuse keeps FE i18n minimal; new prefix is more accurate. NSM doesn't have this endpoint, so no precedent.
4. **For #3 (gate), do we ALSO need to update FE to actually read `body.code`?** Today FE at line 7957 sets hardcoded `GATE_API_ERROR` on `!res.ok` without parsing body. BE classification adds no user-visible value unless FE branch reads response body. **Recommend: BE fix + FE body-parsing fix as one bundle**.
5. **For #4 (SSE), should we add `code` to the `circlesPhase2StreamError` state object?** Today FE just sets `true`/`false`. To surface code, FE needs to mirror NSM's `circlesPhase3Error = {code, message}` pattern.

### 4.3 — Effort estimate

- BE-only fixes (mirror NSM pattern × 7 catch blocks): ~30 minutes
- FE response-body parsing for #3 + #5: ~20 minutes
- FE SSE frame error code surfacing for #4: ~20 minutes
- 5x consecutive adversarial verification (per RITUAL): ~30 minutes
- **Total: ~100 minutes (1h40m)** if all 7 patched + FE wiring; **~30-40 minutes** if BE-only minimal fix matching NSM precedent

### 4.4 — Commit boundary recommendation

**Recommend independent commit** (NOT bundled with W1-補.7):
- W1-補.7 is already shipped (b126937)
- Karpathy §4.3 Surgical Changes — clean commit boundary, single-concern
- Tracker entry / audit doc / commit can carry F-CT1.4b id for traceability
- Allows independent revert if any catch block has unexpected regression
- Allows phased ship: HIGH-only (#3) commit first, MEDIUM (#4, #5) second, LOW dead-code cleanup third — if user prefers conservative roll-out

---

## Section 5 — Adversarial test coverage

### 5.1 — Existing `tests/api/circles-gate-contract.spec.js` (6 specs)

Read in full. Specs cover:
- Garbage / thin / quality input → `overallStatus` shape assertions (200 OK happy/edge)
- Response shape (items array + field/status keys)
- 401 without token

**Will it fail if BE changes to 503 + code shape?** Only if error injection is added. The 6 current specs all expect 200 OK on healthy gate calls (uses real OpenAI key). **No change needed for the existing 6 specs** because they don't exercise the catch block — they assume OpenAI is up.

### 5.2 — Existing `tests/api/circles-gate-all-Y-adversarial.spec.js`

Mentioned in file list. Likely tests "all-Y" gaming-the-gate scenarios (per W1-補.7 reviewer note that adversarial sweep was run on CIRCLES gate already). Does NOT cover catch-block error classification because that requires mocking OpenAI failure modes.

### 5.3 — Recommended new spec (if fix proceeds)

Per RITUAL §3.2 Pitfall 11 — error injection is a legitimate carve-out from "no mocks in e2e". Recommend new spec file: `tests/api/circles-error-classification.spec.js` covering:

- POST /:id/gate with OpenAI mock returning 429 → expect 503 + `{error:'ai_service_error', code:'GATE_RATE_LIMIT'}`
- POST /:id/gate with simulated AbortError → expect 503 + `code:'GATE_TIMEOUT'`
- POST /:id/gate with generic Error → expect 503 + `code:'GATE_API_ERROR'`
- (parallel triplets for conclusion-check + message SSE if patched)

Pattern: use sinon / jest mocks against the prompt module (NOT against the route — keep route boundary real). Mirror `tests/api/nsm-gate-classification.spec.js` if one exists from W1-補.7.

### 5.4 — Verification gate per RITUAL

After any fix:
- 5x consecutive runs of new error-classification spec
- 5x consecutive runs of existing circles-gate-contract (regression sanity)
- Cross-plan smoke per `feedback_cross_plan_smoke_after_each_ship`

---

## Out-of-scope but related (recorded for follow-up)

These were found during this audit but NOT in W1-補.7 reviewer's 7-line list:

1. **`routes/circles-sessions.js` line 133** — `res.status(500).json({ error: error.message })` on GET /api/circles-sessions list endpoint. Supabase error, leaks DB column names if query fails.
2. **`routes/circles-sessions.js` line 288** — `res.status(500).json({ error: (err && err.message) || 'unknown_error' })` on evaluate-step fallback after EvaluatorError class. EvaluatorError path already has code; fallback still leaks.
3. **`routes/guest-circles-sessions.js`** — **9 parallel `e.message` leaks** of identical shape (verified via grep on lines 127, 143, 196, 243, 269, 270, 288, 435, 454). Guest path duplicates auth path exactly — same vulnerability profile, lower auth-data sensitivity but same OpenAI leak class. **Recommend separate F-CT1.4c entry** if user wants symmetric treatment.
4. **NSM did NOT patch its own `:id/hint` / `:id/example` / `:id/hints` / `:id/draft` etc.** — quick grep should verify if NSM has the same dead-endpoint inventory and whether W1-補.7 left them unpatched intentionally (consistency check).

---

## Audit conclusion

7 catch blocks verified in `routes/circles-sessions.js` at lines 39 / 105 / 198 / 251 / 306 / 463 / 482. All 7 leak BE error message verbatim over the wire. Net user-visible-as-text leak surface is 0 (FE never renders raw message), but wire / DevTools / Sentry / log-aggregator leak surface is 5 of 7.

**Severity**: Only **#3 (gate, line 198)** is HIGH (mirror NSM W1-補.7 OpenAI exposure on live user surface). #4 SSE + #5 conclusion-check are MEDIUM. #1 / #2 are LOW-Supabase. #6 / #7 are LOW-likely-dead.

**Suggested fix scope** is documented as mapping table only (Section 4.1) — no code proposed in this audit per find-first STANDING. **User decision required** on: (a) which severity tier to fix, (b) BE-only vs BE+FE bundle, (c) commit boundary (single vs phased), (d) treatment of dead endpoints #1/#6/#7 (delete vs patch).

End of audit.
