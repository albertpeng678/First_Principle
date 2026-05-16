# Persistence Resilience — Architectural Design (5 P0/P1)

> **Source audit:** `audit/persistence-comprehensive-audit-2026-05-16.md`
> **Scope:** the 5 architectural gaps that the lifecycle spec (`docs/superpowers/specs/2026-05-16-session-lifecycle-state-machine-design.md`) does **not** cover.
> **Ship discipline:** 1 bundle. All 5 are persistence-layer resilience, share one network-mock fixture, and shipping together gives a single compounding UX win ("no more silent data loss / cross-device desync / mid-evaluation black holes").
> **Hard constraints:** No backend prompt changes. No mockup CSS changes. IL-3 TDD (red-first per task). zh-TW for any user-facing toast. Karpathy simplicity-first — retry queue is **3 small functions**, never a "framework".

---

## §1 Context — the 5 findings as problems

Each finding is restated as a one-paragraph problem statement, with severity rationale.

### 1.1 F-01 — `triggerSaveCycle` fire-and-forget PATCH (P0 — data loss)

`public/app.js:3742` (triggerSaveCycle) → `public/app.js:3766-3786` (persistBackend async IIFE). When the user types in Phase 1, the 800ms debounce fires, localStorage write succeeds, then a backend PATCH `/api/circles-sessions/:id/progress` is queued inside a fire-and-forget async IIFE with only `.catch(console.error)`. If network latency >2s or the connection is throttled (Chrome DevTools "offline"), the PATCH never lands. localStorage is fine; backend `framework_draft` is stale `{}`. User resumes on a different device → server is truth → draft appears lost.

**Why P0:** silent backend desync on every flaky network event. Regression of `draft-data-loss-fix.spec.js` if anything goes wrong with the catch. Latent reincarnation flagged as F-26 in the audit.

### 1.2 F-04 — `gateResult` PATCH fire-and-forget after gate succeeds (P1 — cross-device desync)

`public/app.js:7392` (submitFrameworkToGate) → `public/app.js:7471-7476`. After the gate POST returns ok, the FE persists the result to backend via `fetch('/api/circles-sessions/:id/progress', { method:'PATCH', body:{ gateResult: result } })` and only attaches `.catch(console.error)`. If this PATCH fails, the current tab still shows gate=ok (good for this tab), but a second tab opens GET `/:id` and the server returns no `gateResult` → second tab renders gate-pending state. Cross-device desync.

**Why P1 (not P0):** the active tab keeps working; only the cross-device path breaks. Lift to P0 if multi-device is in the success criteria for this product cycle (it is — see CLAUDE.md NSM ↔ CIRCLES parity).

### 1.3 F-10 — `submitFrameworkToGate` POST `/draft` has no retry (P0 — gate blocks)

`public/app.js:7437-7446`. Gate submit calls `ensureCirclesDraftSession()` which calls POST `/api/circles-sessions/draft`. If the POST returns 500 or times out, `ensureCirclesDraftSession` returns `null` silently, and `submitFrameworkToGate` bails with `"無法建立 session"`. User clicks again → same fail → permanent dead end. No backoff. No "重試" CTA.

**Why P0:** the gate becomes the user's funnel; if it deadlocks, the entire CIRCLES flow is unusable.

### 1.4 F-12 — NSM gate handler missing `progress_json.gateResult` persist (P1 — cross-device desync, NSM side)

`routes/nsm-sessions.js:112-134`. The NSM gate handler computes `result = await reviewNSMGate(...)`, then `res.json(result)` — and never UPDATEs the row. Compare to CIRCLES `routes/circles-sessions.js:166-185` which does `await db.from('circles_sessions').update({ ..., gate_result: gateResult }).eq('id', ...)`. NSM is asymmetric. Cross-device tab opens session, server returns no stored gate result → FE shows re-submit UI.

**Why P1:** asymmetry bug, isolated to NSM gate, but breaks the same multi-device guarantee as F-04.

### 1.5 F-14 — NSM `evaluate` has no in-flight checkpoint (P1 — mid-evaluation crash loses scores)

`routes/nsm-sessions.js:79-110`. POST `/:id/evaluate` awaits `evaluateNSM()` (3-5s AI call), then UPDATEs `scores_json`. If the process restarts or the connection drops mid-call, the row stays in pre-evaluation state. Next resume: no scores, UI shows "重新評分" CTA, user pays the AI cost twice.

**Why P1:** rare (process crash), but expensive when it happens (AI dollar + user re-do). Cheap fix.

### 1.6 Why these 5 ship as one bundle

| Reason | Detail |
|---|---|
| **Architectural cohesion** | All 5 are write-side resilience. Three patterns repeated across both surfaces (CIRCLES + NSM). |
| **Shared test fixture** | One Playwright `page.route(...)` network-failure helper covers all 5 specs. Reusing it is cheaper than 5 separate test setups. |
| **Compounding UX win** | Shipping one at a time = 5 marginal releases. Shipping together = "persistence is now reliable" — single story for the user and single regression check. |
| **No file thrash** | T2/T3 both touch `public/app.js` near each other; T5/T6 both touch `routes/nsm-sessions.js`. One PR keeps the diff coherent. |

---

## §2 Architecture — 3 patterns, no framework

### 2.1 Pattern A — **Retry Queue with Exponential Backoff** (F-01, F-10)

```
                  ┌─────────────────────────┐
   caller ──fn──▶ │ persistRetry(fn, opts)  │
                  └─────────────────────────┘
                              │
                  attempt 1 ──┤
                              │ ok? ─▶ return result
                              │ fail (5xx / TypeError / AbortError) ?
                  wait 250ms  │
                  attempt 2 ──┤
                              │ ok? ─▶ return result
                              │ fail?
                  wait 500ms  │
                  attempt 3 ──┤
                              │ ok? ─▶ return result
                              │ fail?
                  wait 1000ms │
                  attempt 4 ──┤  (final)
                              │ ok? ─▶ return result
                              │ fail? ─▶ throw RetryExhausted(lastError)
```

- **Backoff schedule:** `[250, 500, 1000]` ms. Max 4 attempts total (1 + 3 retries). Fixed schedule, no jitter — the test surface gains nothing from jitter and we lose determinism.
- **Retryable errors only:** network errors (`TypeError`, `AbortError` from `fetch`), HTTP 5xx, HTTP 0 (CORS/offline). **Non-retryable:** 4xx (client error — retrying won't fix it).
- **Caller contract:** `persistRetry(fn, { label, maxAttempts?, onRetry? })`. `fn` returns a `Promise<Response>` (the bare `fetch` call). The helper inspects the response and re-throws to drive retry.
- **No global queue, no observer pattern.** Each call is a self-contained promise. If two `persistRetry` calls overlap, they overlap — last-write-wins applies, same as today. That's a separate concern (F-06) explicitly out of scope.

**Why this pattern over alternatives:**
- A real queue with persistence (IndexedDB-backed) would survive tab close — but the audit flagged localStorage as the source of truth for unflushed writes, so adding a second cache layer doubles the surface. **Rejected.**
- A generic observable retry library (`p-retry`, `axios-retry`) drags in npm weight. We have 3 small functions; we ship them. **Rejected.**

### 2.2 Pattern B — **Await + Surface-on-Fail** (F-04)

```
USER          FE: submitFrameworkToGate         BE: gate handler
 │  click 送出                │                          │
 │ ─────────────────────────▶ │                          │
 │                            │ POST /:id/gate           │
 │                            │ ───────────────────────▶ │
 │                            │                          │ run gate AI
 │                            │ ◀─ 200 { ok, ... }       │
 │                            │ persistRetry(            │
 │                            │   PATCH /:id/progress    │
 │                            │   { gateResult })        │
 │                            │ ───────────────────────▶ │
 │                            │ ◀─ 200                   │
 │                            │ render gate pass UI      │
 │ ◀───────────────────────── │ done                     │
 │                            │                          │
 │                            │ ── fail path ──          │
 │                            │ persistRetry exhausts    │
 │                            │ AppState.circlesGateResult = null
 │                            │ render banner: 「跨裝置同步失敗，請重新提交」
 │                            │                          │
```

- **Change:** today's fire-and-forget IIFE becomes an `await persistRetry(() => fetch('PATCH ...'))`. The gate result UI does not render until the PATCH lands (or exhausts).
- **Failure mode:** on exhaust, clear `AppState.circlesGateResult` and show a zh-TW banner. User can re-click submit (POST /:id/gate is idempotent in practice — it overwrites — so re-running is safe).
- **Why not pure await without retry:** transient flakes (single dropped packet) would cause repeated user submits = repeated AI cost. Retry buffers that.

### 2.3 Pattern C — **Pre-write Checkpoint + Recovery** (F-14, NSM-gate-side of F-12)

```
USER       FE                      BE: evaluate handler            DB
 │  click 重新評分     │                              │                 │
 │ ─────────────────▶  │ POST /:id/evaluate           │                 │
 │                     │ ────────────────────────────▶│ UPDATE progress_json
 │                     │                              │ → { evaluating: true }
 │                     │                              │ ───────────────▶│
 │                     │                              │ ◀── ok          │
 │                     │                              │ evaluateNSM (3-5s AI)
 │                     │                              │  …              │
 │                     │                              │  …              │
 │                     │                              │  done           │
 │                     │                              │ UPDATE scores_json,
 │                     │                              │   progress_json.evaluating=false
 │                     │                              │ ───────────────▶│
 │                     │ ◀── 200 { scores }           │ ◀── ok          │
 │                     │ render Step 4 with scores    │                 │
 │                     │                              │                 │
 │                     │ ── crash mid-evaluate ──     │                 │
 │                     │ (process dies after          │                 │
 │                     │  checkpoint, before scores)  │                 │
 │                     │                              │                 │
 │  page reload        │                              │                 │
 │ ─────────────────▶  │ GET /:id                     │                 │
 │                     │ ◀── progress_json.evaluating=true              │
 │                     │ render Step 4 with banner:                     │
 │                     │ 「評分進行中…請稍候或重新嘗試」                  │
 │                     │ (re-evaluate button enabled)                   │
```

- The checkpoint is a single `UPDATE` to `progress_json.evaluating=true`. On normal success path, the final UPDATE clears `evaluating` and adds `scores_json`.
- On resume, if `progress_json.evaluating === true` AND `scores_json` is null/empty AND `updated_at` is older than 60s, the FE shows a recoverable state with a re-evaluate CTA. The 60s gate prevents flashing the banner during a normal in-flight call.
- **F-12 reuses this pattern:** NSM gate handler adds one UPDATE line to persist `progress_json.gateResult = result` after `reviewNSMGate` returns ok. No checkpoint pre-write needed (gate is short, ~1s) — just the missing UPDATE.

### 2.4 Pattern summary table

| Pattern | Findings | Mechanism | Net new code |
|---|---|---|---|
| A. Retry Queue | F-01, F-10 | `persistRetry(fn, opts)` wraps `fetch` calls | 1 helper file, 3 functions |
| B. Await + Surface-on-Fail | F-04 | Convert IIFE → `await persistRetry(...)`, banner on exhaust | ~10 lines in `submitFrameworkToGate` |
| C. Checkpoint + Recovery | F-14, F-12 | `UPDATE progress_json` before/after long op | 1 UPDATE line each (F-12), 2 UPDATEs + 1 FE branch (F-14) |

---

## §3 Components — file-by-file

| Finding | File | Function / line | Change |
|---|---|---|---|
| F-01, F-10 (helper) | `public/lib/persistRetry.js` (new) | `persistRetry()`, `isRetryable()`, `sleep()` | New file, 3 small functions, ~40 lines |
| F-01 | `public/app.js` | `persistBackend` IIFE inside `triggerSaveCycle` (~3766-3786) | Replace IIFE body with `persistRetry(() => fetch(...))`; **keep fire-and-forget at the call site**: caller still doesn't await — `persistRetry`'s job is to be silent on success, log+toast on exhaust. localStorage stays as the synchronous truth. |
| F-04 | `public/app.js` | `submitFrameworkToGate` (~7471-7476) | Inside the existing `try { ... }`, await `persistRetry(() => fetch('PATCH .../progress', { body: { gateResult } }))`. On `RetryExhausted`, clear `AppState.circlesGateResult` and render zh-TW banner: 「跨裝置同步失敗，請點「送出」重新提交」. |
| F-10 | `public/app.js` | `submitFrameworkToGate` (~7437-7446) | Wrap `ensureCirclesDraftSession()` call in `persistRetry`. If exhausted, show banner: 「無法建立練習，請檢查網路後重試」 + an explicit "重新嘗試" button instead of the current dead-end string. |
| F-12 | `routes/nsm-sessions.js` | POST `/:id/gate` (~112-134) | After `result = await reviewNSMGate(...)` and before `res.json(result)`, add: `await db.from('nsm_sessions').update({ progress_json: { ...(session.progress_json || {}), gateResult: result } }).eq('id', req.params.id).eq('user_id', req.user.id);`. Tolerate error: log + still return `result` (FE retry covers cross-device). |
| F-14 | `routes/nsm-sessions.js` | POST `/:id/evaluate` (~79-110) | (a) Before `await evaluateNSM(...)`, write checkpoint `UPDATE progress_json={...prev, evaluating:true, evaluating_started_at: nowISO}`. (b) After scores arrive, the existing UPDATE additionally sets `evaluating:false`. (c) On evaluateNSM throw, write `UPDATE progress_json.evaluating=false, evaluation_error=msg` and re-throw to the existing 500 path. |
| F-14 (FE recovery) | `public/app.js` | NSM Step 4 mount / tryResumeLatestSession (~1564-1610, ~7807-7834) | After loading session, if `progress_json.evaluating === true` AND no `scores_json` AND `(now - evaluating_started_at) > 60_000`, render banner 「上次評分未完成，請重新評分」 with an enabled "重新評分" button. |
| Tests | `tests/lib/persist-retry.test.js` (new) | jest unit, 8+ specs | See §6.2 |
| Tests | `tests/routes/nsm-sessions-resilience.test.js` (new) | jest API contract, 4 specs | F-12 persist, F-14 checkpoint, F-14 error path, F-14 success clears evaluating |
| Tests | `tests/visual/persistence-resilience.spec.js` (new) | Playwright E2E, 5 specs | One per finding, all using `page.route(...)` mocks |

**Total new files:** 4 (1 helper + 3 test files). **Edits in existing code:** 3 files (`public/app.js`, `routes/nsm-sessions.js`, and that's it for prod code). No backend prompt changes. No mockup CSS changes.

---

## §4 Data flow — sequence diagrams

See §2.1 / §2.2 / §2.3. The 3 ASCII diagrams above cover all 5 findings:
- Pattern A diagram → F-01 (PATCH inside `triggerSaveCycle`) and F-10 (POST inside `submitFrameworkToGate`).
- Pattern B diagram → F-04 (gateResult PATCH).
- Pattern C diagram → F-14 (evaluate checkpoint) and F-12 (gate UPDATE is the "success path" half of Pattern C, no checkpoint pre-write).

---

## §5 Error handling — degrade gracefully

### 5.1 Retryable vs non-retryable

| Error class | Retryable? | Rationale |
|---|---|---|
| `TypeError` from fetch (network down) | Yes | Transient by definition |
| `AbortError` (request aborted by us) | **No** | We aborted intentionally; retrying would defeat the abort |
| HTTP 0 (CORS / opaque) | Yes | Often offline transient |
| HTTP 408, 429, 5xx | Yes | Server/transport flake |
| HTTP 4xx (except 408/429) | No | Client error — fix the request, don't retry |
| Response body parse error | No | Bad contract; retry won't help |

### 5.2 Max retry count

Hard ceiling: **4 attempts total** (1 + 3 retries). Backoff total worst-case wait: 250 + 500 + 1000 = **1.75s** before exhaust. Within the user's tolerance for a "save" or "submit" action. Anything longer than that and the user will refresh/abandon anyway.

### 5.3 User-facing toasts (all zh-TW)

| Trigger | Message | Where rendered |
|---|---|---|
| F-01 PATCH exhausted | 「儲存草稿時網路異常，已暫存本機，請稍後再試」 | Phase 1 save-state strip (existing `_saveStateBar`) — extend with a `state: 'error-retry'` variant; non-blocking |
| F-04 gate PATCH exhausted | 「跨裝置同步失敗，請點「送出」重新提交」 | Inline banner above Phase 1.5 gate result card |
| F-10 ensure POST exhausted | 「無法建立練習，請檢查網路後重試」 + 「重新嘗試」 button | Replaces the current dead-end string at the bottom of Phase 1 form |
| F-14 evaluate stuck | 「上次評分未完成，請重新評分」 | NSM Step 4 banner above scores area |

All toasts use existing styling tokens (`--c-warn`, `--c-text-1`). No new design components. Mockup CSS untouched (see hard constraints).

### 5.4 Graceful degrade on hard fail

If the retry helper itself throws unexpectedly (defensive — should be impossible), the caller's existing `.catch(console.error)` still catches. **No regression** vs today's behavior on a code defect inside the helper.

---

## §6 Testing strategy

### 6.1 Playwright skill picked: **`request-mocking.md`**

Path: `/Users/albertpeng/.claude/skills/playwright-skill/playwright-cli/request-mocking.md`.

**Why this skill (over `race-testing` or `network-mocking`):**
- The audit requires us to simulate (a) total network failure (`route.abort('failed')`), (b) HTTP 5xx, (c) high-latency timeouts, and (d) success after N retries. `request-mocking.md` documents all four mechanically: `--status=503`, `route-list`, `unroute`, and conditional handlers via `run-code`. The "Advanced Mocking" section covers per-call counters (return 503 the first 2 calls, then 200) which is exactly the success-after-retry test (T7 spec).
- No dedicated `race-testing.md` exists in the cache. The other plausible candidate (`core/clock-and-time-mocking.md`) covers time but not network fault injection.
- The skill's run-code pattern using `page.route('**/api/...', route => { count++; if (count<3) route.abort('failed'); else route.continue(); })` is the single most idiomatic Playwright pattern for "prove the retry actually runs N times".

### 6.2 jest unit + contract (red-first per IL-3)

**`tests/lib/persist-retry.test.js`** — 8 specs (T1):

1. Resolves immediately on first-attempt 200
2. Retries on 503 and resolves on 2nd attempt
3. Retries on TypeError and resolves on 3rd attempt
4. Throws `RetryExhausted` after 4 failed attempts
5. Does **not** retry on 400/401/403/404
6. Honors backoff timing: between attempts 1↔2 wait ≥250ms, 2↔3 ≥500ms, 3↔4 ≥1000ms (use jest fake timers + advanceTimersByTime)
7. `onRetry` callback fires once per retry with `(attempt, error)`
8. Aborted requests (`AbortError`) do **not** retry

**`tests/routes/nsm-sessions-resilience.test.js`** — 4 specs (T5, T6 backend half):

1. POST `/:id/gate` success → row's `progress_json.gateResult` matches response body (F-12)
2. POST `/:id/evaluate` writes `progress_json.evaluating=true` BEFORE evaluateNSM is invoked (mock evaluateNSM with a delay, assert DB state mid-flight) (F-14)
3. POST `/:id/evaluate` success → `progress_json.evaluating=false` and `scores_json` populated
4. POST `/:id/evaluate` failure (mock evaluateNSM to throw) → `progress_json.evaluating=false`, `evaluation_error` recorded, route returns 500

### 6.3 Playwright E2E

**`tests/visual/persistence-resilience.spec.js`** — 5 specs (T7), one per finding, all under Mobile-360 + Desktop-1280 (2 viewports for the bundle; full 8 vp on T9 regression):

1. **F-01 retry happy path:** load /circles?qid=Q1, type in C1, mock PATCH /progress to return 503 twice then 200, expect save-state to land at 'saved' (not 'error'); verify only 3 PATCH attempts were made via `route-list`-style counter.
2. **F-01 retry exhaust:** mock PATCH to abort('failed') indefinitely, expect zh-TW save-state error banner after ≤2s.
3. **F-04 gate await:** mock POST /:id/gate to return ok, mock subsequent PATCH /progress to 503 twice then 200, verify gate-pass UI renders only after the PATCH lands; on exhaust, verify the banner.
4. **F-10 ensure retry:** mock POST /draft to return 500 once then 200, click submit, verify session created and gate proceeds.
5. **F-12 + F-14 NSM:** mock POST /nsm/:id/gate, assert that GET /:id afterward shows `gateResult` in payload (F-12); separately, mock /:id/evaluate AI call with a 3s artificial delay, kill the request mid-flight by closing the page, reload, assert recovery banner appears (F-14).

### 6.4 Adversarial sweep (T8)

Edge cases the basic tests don't cover:
- Max retry exhausted during a typing burst (12 keystrokes during 2s outage → 12 retry chains overlap; assert no PATCH starvation, last write wins, localStorage stays fresh)
- Mid-retry tab close (start retry chain, close tab between attempts; assert no orphan timer, no unhandled rejection)
- Server returns 200 with malformed JSON (parse error path — non-retryable, surfaces to user)
- Evaluate checkpoint with `updated_at` exactly 59s old → no banner; at 61s old → banner shown
- Two tabs both hit evaluate exhaust scenario → both see banner, only one re-evaluate POST succeeds (existing inflight guard covers, verify not broken)

### 6.5 8-viewport regression + iOS 15-item + director cold-Read (T9)

Full Playwright suite × 8 viewport (iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Mobile-360 / Desktop-1280 / 1440 / 2560). Confirm no regression in: typewriter spec, qchip spec, lock-state spec, NSM specs. iOS 15-item walk on Phase 1 save-state + Phase 1.5 gate + NSM Step 4 banner (focus/touch/sticky/modal/SSE behavior). Director cold-Read of the 4 new toast PNGs (4 toast variants × Mobile-360 + Desktop-1280 = 8 PNGs).

---

## §7 Acceptance criteria

| ID | Criterion | How verified |
|---|---|---|
| **RES-AC1** | `persistRetry` retries 5xx and network errors with `[250, 500, 1000]` ms backoff; throws `RetryExhausted` after 4 attempts; does not retry 4xx or AbortError | jest specs 1-8 in §6.2 all green |
| **RES-AC2** | F-01: with mocked PATCH 503×2 → 200, Phase 1 typing eventually shows saved-state and only 3 PATCH attempts fire | Playwright spec 1 green |
| **RES-AC3** | F-01: with mocked PATCH always abort, save-state shows zh-TW error banner within 2s; localStorage value is intact | Playwright spec 2 green + localStorage value asserted |
| **RES-AC4** | F-04: gate-pass UI does not render until PATCH gateResult lands; exhaust path clears AppState.circlesGateResult and shows zh-TW banner | Playwright spec 3 green |
| **RES-AC5** | F-10: with POST /draft 500×1 → 200, gate submit succeeds without user re-click; with permanent 500, "重新嘗試" button is visible | Playwright spec 4 green |
| **RES-AC6** | F-12: after NSM gate POST returns ok, GET /:id includes `progress_json.gateResult` byte-for-byte equal to the gate response body | jest contract spec 1 + Playwright spec 5a green |
| **RES-AC7** | F-14: pre-write checkpoint visible in DB during evaluate in-flight; cleared on success; preserved with `evaluation_error` on failure | jest contract specs 2-4 green |
| **RES-AC8** | F-14 recovery: on resume with `evaluating=true` AND `updated_at` >60s old AND no scores, banner renders with re-evaluate button | Playwright spec 5b green |
| **RES-AC9** | No regression in jest baseline (170/187, +12 new = 182/199) and no regression in 8 vp Playwright suite | T9 green |
| **RES-AC10** | All user-facing toasts are zh-TW, use existing tokens, no new mockup CSS | Director cold-Read of 4 toast PNGs |
| **RES-AC11** | No conflict with lifecycle spec — `routes/nsm-sessions.js` gate/evaluate edits coexist with lifecycle transition writes (same handler, additive UPDATE fields) | Manual merge review at T5/T6; jest contract assertions check both `lifecycle` and `progress_json.gateResult` are set after gate |

---

## §8 Out of scope (and explicit conflict flags with lifecycle plan)

### 8.1 Out of scope

- **F-02, F-11, F-15** — orphan rows + guest filter. Covered by lifecycle spec Layer 3/4.
- **F-03, F-08** — drill_step null dedup. Already fixed in `bdbd17a`; BE migration deferred per audit.
- **F-05** — Phase 2 SSE interrupt. Needs protocol redesign; separate plan.
- **F-06** — `phase2ConclusionDraft` RMW race. Needs JSONB merge operator on the server; separate plan.
- **F-07, F-13, F-16, F-17, F-18, F-19, F-20, F-21** — P2/P3 polish. Not in this bundle.
- **F-22..F-26** — already fixed or mitigated, per audit.
- **All backend AI prompts** — locked under Path 2 carve-out.
- **All mockup CSS** — locked.

### 8.2 Conflict flags with `2026-05-16-session-lifecycle-state-machine-design.md` (running in parallel)

| File | Lifecycle change | Resilience change | Coexistence rule |
|---|---|---|---|
| `routes/nsm-sessions.js` POST `/:id/gate` | Set `lifecycle='gated'` on success | F-12: write `progress_json.gateResult = result` on success | Both UPDATEs in the **same** `await db.from(...).update({ lifecycle, progress_json })` call. Merge into one UPDATE to avoid 2 round trips. T5 must read the lifecycle PR's diff and merge cleanly. |
| `routes/nsm-sessions.js` POST `/:id/evaluate` | Set `lifecycle='completed'` on success | F-14: pre-write `progress_json.evaluating=true`; post-write `evaluating=false` + scores_json | Two separate UPDATEs are fine (pre-checkpoint UPDATE precedes evaluateNSM; final UPDATE sets `lifecycle` + `scores_json` + `evaluating=false` together). T6 must merge with whichever plan lands second. |
| `routes/circles-sessions.js` POST `/:id/gate` | Set `lifecycle='gated'` on success | None this bundle (CIRCLES gate already persists `gate_result`) | No conflict. |
| `routes/circles-sessions.js` PATCH `/:id/progress` | Run `computeLifecycle()` | None this bundle | No conflict. |
| `public/app.js` | "No write changes" per lifecycle §3 | T2, T3, T4, T6-FE edits | No conflict — lifecycle is BE-only on FE side. |

**Merge order policy:** whichever spec ships first wins the file imports / function signatures. The second spec rebases on top of the first. Both specs flag this section so the executing agent reads before touching shared files.

### 8.3 Director must resolve before T5/T6 starts

**Open question:** the audit's F-12 suggested patch uses a separate UPDATE call. The lifecycle spec wants a separate UPDATE for `lifecycle`. To minimize round trips we merge into one — but the lifecycle plan's exact UPDATE shape is not pinned down in `§3` (it says "set `lifecycle='gated'`" without showing the full payload). **Director sign-off needed:** "yes, merge F-12 gateResult write into the same UPDATE statement that the lifecycle plan adds, even if the lifecycle PR hasn't shipped yet — T5 implementer is authorized to write the merged shape and the lifecycle plan will adapt downstream."

---

## §9 Brainstorming self-review (superpowers:brainstorming inline)

> Per the brainstorming skill: did we explore alternatives, did we surface unknowns, did we pick the simplest viable path?

| Check | Status |
|---|---|
| Alternative architectures considered? | Yes — §2.1 documents rejected alternatives (persistent queue, npm retry lib) and why. §2.2 rejects pure await without retry. §2.3 rejects "long poll evaluate status" in favor of a single checkpoint. |
| Unknowns surfaced? | §8.3 calls out the one director-decision needed (merge UPDATE shape with lifecycle plan). |
| Simplest viable path? | Yes — Pattern A is 3 functions. Pattern B is ~10 lines. Pattern C is 1-3 UPDATE lines per route. No new abstractions, no new dependencies. |
| Edge cases enumerated? | §5 covers retryable/non-retryable, max attempt, user-facing toasts, graceful degrade on helper defect. §6.4 covers adversarial cases. |
| Assumptions tested? | Backoff timing tested (jest fake timers). Cross-device persistence tested (jest contract spec asserts row state). Recovery 60s threshold tested (adversarial 59s/61s pair). |
| What did we explicitly choose not to do? | §8.1 lists 15+ findings deferred with rationale. |

**Issue found in self-review:** "RES-AC11 mentions 'manual merge review' for the lifecycle conflict — that's a director task, not an acceptance criterion. **Fix:** keep it as RES-AC11 because the merged code must pass the same assertions whether or not the lifecycle plan landed first; the criterion is testable (`progress_json.gateResult` set AND `lifecycle='gated'` set after gate POST) even if the implementation path differs. Verified — criterion stays."

---

## §10 Writing-plans self-review (superpowers:writing-plans inline — spec-side check)

> The plan doc has its own self-review; this section checks the spec itself against the writing-plans rubric.

| Check | Status |
|---|---|
| Single source of truth for what to build? | Yes — §3 file-by-file table is authoritative. |
| Acceptance criteria measurable? | Yes — every RES-AC has a "How verified" column. |
| Test strategy explicit? | Yes — §6 splits jest unit / jest contract / Playwright E2E / adversarial / 8 vp regression, each with file path. |
| Out-of-scope explicit? | §8 lists 15 deferred findings + 5 file overlap rules + 1 director question. |
| Failure modes specified? | §5 table + §2.1 retryable/non-retryable list. |
| Karpathy 4 checks (Think before / Simplicity / Surgical / Goal-driven)? | Think-before: §2 documents pattern choice. Simplicity: 3 functions, no framework. Surgical: §3 says exactly which files; nothing else moves. Goal-driven: every layer maps to one of the 5 findings; no nice-to-have. |

**Issue found:** "I asserted `[250, 500, 1000]` backoff totaling 1.75s without checking against the existing `_saveCycleT2` 2s idle delay in `triggerSaveCycle`. **Fix:** §5.2 already notes 1.75s is within tolerance; the 2s idle delay is on a different timer (UI spinner timing, F-07) and unrelated to PATCH timing. Verified independent — no overlap. No spec change needed."

---

## §11 Hard constraints check

| Constraint | Honored? |
|---|---|
| No backend prompt changes | Yes — no edit to `lib/ai/*` |
| No mockup CSS changes | Yes — toasts reuse `--c-warn` / existing save-state strip / existing banner pattern |
| IL-3 TDD (red-first per task) | Yes — plan §T1, T5, T6 all start with failing tests |
| No conflict with lifecycle plan | §8.2 documents 5 file overlaps + merge order policy |
| zh-TW for user-facing strings | §5.3 lists all 4 toasts in zh-TW |
| Karpathy simplicity-first | §2.1 explicitly limits retry to 3 functions, no generic framework |

**End of spec.**
