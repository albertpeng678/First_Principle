# L26 — NSM /context + /hints + PATCH /progress Comprehensive Bypass Audit
**Date:** 2026-05-17
**Lane:** L26 — preventive completion of L18 scope
**Auditor:** Phase 1 Lane L26 code audit + TDD-green spec
**Reference:** L18 audit `audit/nsm-bypass-path-enumeration-2026-05-17.md` + L18 spec `tests/api/nsm-no-bypass.spec.js`
**Spec:** `tests/api/nsm-context-hints-progress-coverage.spec.js`

---

## §1 Per-Endpoint Security Model Classification

### POST /context (auth + guest)

| Attribute | Detail |
|---|---|
| Handler | `routes/nsm-sessions.js:193-205` (auth) / `routes/guest-nsm-sessions.js:157-169` (guest) |
| Lifecycle guard present? | **No** — only ownership check (`.eq('user_id', req.user.id)` / `.eq('guest_id', req.guestId)`) |
| DB mutation? | **None** — reads `question_json` + calls `generateNSMContext()` + `res.json(context)` |
| Should require gate? | **No** — context generation is informational; no state transition triggered |
| Verdict | **BY-DESIGN OPEN** — safe in all lifecycle states |

Handler trace (auth, `nsm-sessions.js:193-205`):
1. Fetch `question_json` with ownership check (`line 194-200`) — returns 404 if not found
2. Call `generateNSMContext({ question_json })` (`line 202`) — OpenAI read-only
3. `res.json(context)` (`line 203`) — no DB write anywhere in handler

**No vector to exploit.** Even if called with `lifecycle='created'`, the handler returns context and moves on. Lifecycle state is not read or written.

---

### POST /hints (auth + guest)

| Attribute | Detail |
|---|---|
| Handler | `routes/nsm-sessions.js:271-288` (auth) / `routes/guest-nsm-sessions.js:240-257` (guest) |
| Lifecycle guard present? | **No** — only ownership check |
| DB mutation? | **None** — reads `question_json` + calls `generateNSMHints()` + `res.json(hints)` |
| Should require gate? | **No** — STANDING RULE (see §2) |
| Verdict | **BY-DESIGN OPEN** — compliant with STANDING RULE |

Handler trace (auth, `nsm-sessions.js:271-288`):
1. Extract `userNsm` from `req.body` (`line 272`) — optional, coalesced to `''` if absent
2. Fetch `question_json` with ownership check (`line 273-279`) — returns 404 if not found
3. Call `generateNSMHints({ question_json, user_nsm, product_type })` (`line 281-285`) — OpenAI read-only
4. `res.json(hints)` (`line 286`) — no DB write anywhere in handler

**No vector to exploit.** Hints are explicitly open by standing rule design intent.

---

### PATCH /progress (auth + guest)

| Attribute | Detail |
|---|---|
| Handler | `routes/nsm-sessions.js:209-268` (auth) / `routes/guest-nsm-sessions.js:176-237` (guest) |
| Lifecycle guard present? | **Partial** — lifecycle is server-computed (monotone), not caller-controlled |
| DB mutation? | **Yes** — writes `user_nsm`, `user_breakdown`, `user_explanation`, `user_business_link`, `progress_json`, `lifecycle` (monotone only) |
| Should require gate? | **No** — progress is a draft-save path, designed for all lifecycle states |
| Verdict | **NO LIFECYCLE-BYPASS RISK** — classified medium-risk in L18 before L19 /evaluate guard; L19 fix closes that vector |

**Key safety mechanisms in handler:**
1. **`delete req.body.lifecycle`** (`nsm-sessions.js:211`, `guest-nsm-sessions.js:178`) — FE cannot inject lifecycle value; any caller-supplied `lifecycle` field is stripped before processing
2. **`computeLifecycle(prior, body, 'nsm', 'patch')`** (`nsm-sessions.js:248`, `guest-nsm-sessions.js:217`) — route='patch' can only advance `created→editing` (substantive content detected); **cannot reach 'gated' or 'completed'**
3. **Monotone constraint** (`session-lifecycle.js:96-107`) — `if (priorLc === 'completed') return 'completed'`; no demotion ever
4. **`gateResult` is cosmetic** — written to `progress_json` for UI step-restoration; does NOT feed `computeLifecycle` as a promotion trigger; only a real `/gate` call with `route='gate_ok'` promotes to `'gated'`

**L18 medium-risk vector analysis post-L19:**
- L18 identified: `currentStep` can be advanced without gate (data integrity, not state bypass)
- L19 fix (`9142eef`) added lifecycle guard to `/evaluate`: requires `lifecycle in ['gated','completed']`
- Post-L19: even if `progress_json.currentStep=3` is spoofed via PATCH /progress, `/evaluate` returns 403 because `lifecycle` stays `'editing'`
- **Vector is closed.** The cosmetic `currentStep` spoofing cannot unlock evaluate.

---

## §2 Cross-Reference to CIRCLES Design

| Endpoint type | CIRCLES equivalent | Guarded? | Rationale |
|---|---|---|---|
| /context | N/A (NSM-specific) | No | Read-only AI informational call |
| /hints | /hint + /example | No — STANDING OPEN | Memory `feedback_lock_state_hint_example_always_available.md`: "Lock state 仍可看提示/範例 — STANDING RULE: 已評分 locked 只鎖 form 編輯+移除 submit，「提示」+「範例答案」button 永遠可用 / cross-mockup 通用" |
| PATCH /progress | PATCH /progress (CIRCLES) | Monotone lifecycle only | CIRCLES PATCH /progress has identical pattern: L5 fix `93b1b26` guards /evaluate, not /progress itself |

The CIRCLES L5 fix specifically added the lifecycle guard to `/evaluate-step` (not `/progress`). NSM L19 fix `9142eef` mirrors this exactly: guard on `/evaluate`, not `/progress`. Both systems correctly place the gate guard at the final evaluation endpoint, not at the draft-save path.

The CIRCLES `/hint` and `/example` endpoints are also unconditionally open — consistent with NSM `/hints` being open. This is a cross-product design decision, not NSM-specific.

---

## §3 Test Results

**Run command:**
```
npx playwright test --config tests/api/playwright.config.js tests/api/nsm-context-hints-progress-coverage.spec.js --reporter=list
```

**Log:** `/tmp/L26-run.log`

**Result: 19/19 PASSED — 44.9s total**

| Test | Endpoint | Lifecycle | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| TC-CTX-1 | POST /context (auth) | created | 200 | 200 | GREEN |
| TC-CTX-2 | POST /context (auth) | editing | 200 | 200 | GREEN |
| TC-CTX-3 | POST /context (auth) | completed | 200 | 200 | GREEN |
| TC-CTX-4 | POST /guest/context | created | 200 | 200 | GREEN |
| TC-CTX-5 | POST /context lifecycle mutation check | editing → editing | no mutation | no mutation | GREEN |
| TC-CTX-6 | POST /context ownership guard | non-existent | 404 | 404 | GREEN |
| TC-HNT-1 | POST /hints (auth) | created | 200 | 200 | GREEN |
| TC-HNT-2 | POST /hints (auth) | completed | 200 | 200 | GREEN |
| TC-HNT-3 | POST /guest/hints | editing | 200 | 200 | GREEN |
| TC-HNT-4 | POST /hints lifecycle mutation check | editing → editing | no mutation | no mutation | GREEN |
| TC-HNT-5 | POST /hints ownership guard | non-existent | 404 | 404 | GREEN |
| TC-PRG-1 | PATCH /progress (auth) | created → editing | lifecycle=editing | lifecycle=editing | GREEN |
| TC-PRG-2 | PATCH /progress lifecycle injection | editing (FE sends lifecycle=gated) | lifecycle=editing | lifecycle=editing | GREEN |
| TC-PRG-3 | PATCH /progress gateResult cosmetic write | editing + gateResult payload | lifecycle=editing; gateResult in progress_json | lifecycle=editing; gateResult in progress_json | GREEN |
| TC-PRG-4 | PATCH /progress currentStep=3 + /evaluate blocked | editing | lifecycle=editing; /evaluate 403 | lifecycle=editing; /evaluate 403 | GREEN |
| TC-PRG-5 | PATCH /progress monotone on completed | completed | lifecycle=completed | lifecycle=completed | GREEN |
| TC-PRG-6 | guest PATCH /progress currentStep=3 | editing | lifecycle=editing | lifecycle=editing | GREEN |
| TC-PRG-7 | PATCH /progress ownership guard | non-existent | 404 | 404 | GREEN |
| TC-PRG-8 | PATCH /progress empty body | any | 400 nothing_to_update | 400 nothing_to_update | GREEN |

---

## §4 Findings — Hidden Bypass or By-Design Open?

### /context — SAFE BY DESIGN
- No lifecycle guard present, **and none required**.
- Handler performs zero DB mutations; any lifecycle state can safely generate context.
- Confirmed: TC-CTX-5 verifies lifecycle unchanged after call.
- **No hidden bypass. No leak.**

### /hints — SAFE BY DESIGN (STANDING RULE compliant)
- No lifecycle guard present, **and none should exist** per STANDING RULE.
- STANDING RULE `feedback_lock_state_hint_example_always_available.md` explicitly mandates hints available in all states including 'completed' (locked).
- Handler performs zero DB mutations.
- Confirmed: TC-HNT-4 verifies lifecycle unchanged after call.
- **No hidden bypass. No leak. Design is correct.**

### PATCH /progress — SAFE (medium-risk vector closed by L19)
- `gateResult` written to `progress_json` is cosmetic — does NOT promote lifecycle to 'gated'. Confirmed by TC-PRG-3.
- `currentStep=3` spoofing does NOT promote lifecycle past 'editing'. Confirmed by TC-PRG-6.
- FE-supplied `lifecycle` field is stripped by server before any processing. Confirmed by TC-PRG-2.
- **Critical vector test (TC-PRG-4):** After writing `currentStep=3` via PATCH /progress, calling `/evaluate` returns 403 because lifecycle remains 'editing'. This end-to-end vector check confirms L19 guard closes the L18 medium-risk path completely.
- Monotone constraint prevents any lifecycle demotion. Confirmed by TC-PRG-5.
- **No hidden bypass. No leak. L18 medium-risk vector confirmed closed.**

---

## §5 Recommendation

All three endpoint groups are **safe and require no production code changes.** The L18 "low-risk" and "medium-risk" classifications are confirmed correct:
- `/context` and `/hints` are by-design open with zero mutation risk
- PATCH `/progress` has no lifecycle-bypass risk; the L19 `/evaluate` guard (`9142eef`) fully closes the currentStep-spoofing vector identified in L18

**Close coverage gap:** Done — 19 tests added in `tests/api/nsm-context-hints-progress-coverage.spec.js` covering all three endpoints × auth + guest variants × multiple lifecycle states. No escalation needed.

**No L27 required** from this audit.
