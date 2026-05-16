# Persistence Resilience — Implementation Plan (5 P0/P1)

> **Spec:** `docs/superpowers/specs/2026-05-16-persistence-resilience-design.md`
> **Source audit:** `audit/persistence-comprehensive-audit-2026-05-16.md`
> **Bundle rationale:** §1.6 of the spec — all 5 are persistence-layer resilience, share one network-mock fixture, ship together for compounding UX win.
> **Discipline:** IL-3 TDD (red-first on every code task). Karpathy 4-check prepended to every implementer dispatch. No backend prompts. No mockup CSS. zh-TW for toasts.

---

## Task Map (one row per task — bite-sized, ordered)

| # | Task | Finding(s) | Code touchpoint | Test artifact | Sequencing |
|---|---|---|---|---|---|
| T1 | Build `persistRetry` helper + jest specs (8+) | F-01, F-10 prerequisite | `public/lib/persistRetry.js` (new) | `tests/lib/persist-retry.test.js` (new) | First. Blocks T2, T3, T4. |
| T2 | Wire `persistRetry` into `triggerSaveCycle` PATCH | F-01 | `public/app.js:3766-3786` | extend `tests/visual/draft-data-loss-fix.spec.js` + spec 1, 2 in T7 | After T1 |
| T3 | Convert `gateResult` PATCH fire-and-forget → await + retry | F-04 | `public/app.js:7471-7476` | spec 3 in T7; jest fake-timer spec for the await path | After T1, parallel with T2 |
| T4 | Wire `persistRetry` into `submitFrameworkToGate` ensure call + add "重新嘗試" button | F-10 | `public/app.js:7437-7446` | spec 4 in T7 | After T1, parallel with T2/T3 |
| T5 | NSM gate POST: persist `progress_json.gateResult` | F-12 | `routes/nsm-sessions.js:112-134` | `tests/routes/nsm-sessions-resilience.test.js` spec 1 + T7 spec 5a | Parallel with T1-T4. Coordinate merge with lifecycle plan (§8.3) |
| T6 | NSM evaluate: pre-write `evaluating=true` checkpoint + FE recovery | F-14 | `routes/nsm-sessions.js:79-110` + `public/app.js:1564-1610, 7807-7834` | jest contract specs 2-4 + T7 spec 5b | After T5 (same file, sequential edit). Coordinate with lifecycle plan |
| T7 | Playwright E2E: 5 specs, one per finding, network-mock fixture | All 5 | `tests/visual/persistence-resilience.spec.js` (new) | The spec file itself | After T2-T6 functionality lands |
| T8 | Adversarial sweep (5 edge cases from spec §6.4) | All 5 | extend T7 file or a sibling | adversarial section in T7 | After T7 happy paths green |
| T9 | 8 vp Playwright regression + iOS 15-item + director cold-Read 4 toast PNGs | All 5 | no code change | regression report `tests/visual/diffs/persistence-resilience-report.md` + `audit/eyeball-persistence-resilience.md` | Final gate before ship |

**Total tasks:** 9. **New files:** 4 (1 helper + 3 test files). **Edited files:** 3 (`public/app.js`, `routes/nsm-sessions.js`, optionally extending `draft-data-loss-fix.spec.js`).

---

## T1 — `persistRetry` helper + 8 jest specs (red-first)

**Goal:** ship one self-contained 3-function module that takes a `fetch`-returning thunk and retries with `[250, 500, 1000]` ms backoff.

### T1.1 Write failing jest tests first

Create `tests/lib/persist-retry.test.js`. All 8 specs from spec §6.2 must be **red** before any helper code is written. Use jest fake timers for backoff timing assertions.

Test scaffolding outline (do not implement assertions until red):
```
describe('persistRetry', () => {
  test('resolves immediately on 200', ...)
  test('retries on 503 and resolves on 2nd attempt', ...)
  test('retries on TypeError and resolves on 3rd attempt', ...)
  test('throws RetryExhausted after 4 attempts', ...)
  test('does not retry on 4xx', ...) // table: 400, 401, 403, 404
  test('honors [250,500,1000] backoff with fake timers', ...)
  test('onRetry callback fires per retry', ...)
  test('AbortError does not retry', ...)
})
```

Run jest. **All 8 must fail** (module not found / undefined). Commit the red-only test file? **No** — commit it together with green helper at end of T1 (keep history clean per CLAUDE.md commit conventions). But the red state must be observed and noted in T1 completion message.

### T1.2 Write the helper to make tests green

Create `public/lib/persistRetry.js`:
- `export async function persistRetry(fn, { maxAttempts = 4, backoff = [250, 500, 1000], label = '', onRetry } = {})`
- `function isRetryable(err)` — handles TypeError, AbortError(no), Response object with status check
- `function sleep(ms)` — `new Promise(r => setTimeout(r, ms))`
- `class RetryExhausted extends Error` — wraps last error + attempt count

Run jest. **All 8 must pass.** Re-run with `--coverage` and confirm 100% branch coverage on the helper file.

### T1.3 Karpathy check

Before commit: re-read the file. If it's >60 lines, simplify. If there's an exported config object, kill it (callers pass options inline). If there's a class beyond `RetryExhausted`, refactor to functions.

### T1.4 Commit

```
feat(persist-retry): retry helper for fire-and-forget writes (T1)
```

---

## T2 — Wire retry into `triggerSaveCycle` PATCH (F-01)

### T2.1 Red — extend `tests/visual/draft-data-loss-fix.spec.js`

Add 2 specs:
1. With `page.route('**/api/circles-sessions/*/progress', ...)` returning 503 twice then 200, type in C1, assert save-state lands at saved and exactly 3 PATCH attempts fired (count via route handler).
2. With route returning `route.abort('failed')` always, type in C1, assert save-state shows zh-TW error banner within 2s.

Both must be red. Confirm by running:
```bash
npx playwright test tests/visual/draft-data-loss-fix.spec.js --project=Mobile-360
```

### T2.2 Green — edit `public/app.js:3766-3786`

Replace persistBackend IIFE body with `persistRetry(() => fetch(...))`. Keep the call site fire-and-forget (caller does not await — the helper's job is to retry silently and surface only on exhaust via the save-state bar).

On `RetryExhausted`, dispatch save-state to error variant. Reuse the existing `_saveStateBar` element; extend with one new state value `'error-retry'` — no new CSS class needed if the existing `--c-warn` token is reused for color.

### T2.3 Verify

Re-run jest baseline (`npm test`) — 170/187 baseline must not regress. Re-run T2.1 specs — both green.

### T2.4 Commit

```
fix(circles-save): retry PATCH on 5xx/network failure (T2, F-01)
```

---

## T3 — gateResult PATCH: fire-and-forget → await + retry (F-04)

### T3.1 Red — add T7 spec 3 outline (just this one spec) in a new file `tests/visual/persistence-resilience.spec.js`

Create the file with only spec 3 first (other specs come in T7). The spec asserts:
- POST `/:id/gate` mocked to return ok
- PATCH `/:id/progress` mocked to 503 × 2 then 200
- Gate-pass UI does NOT render until the PATCH lands
- On exhaust variant (PATCH always abort), banner renders + AppState.circlesGateResult is null (assert via `page.evaluate(() => window.AppState?.circlesGateResult)`)

Run — red.

### T3.2 Green — edit `public/app.js:7471-7476`

Inside the existing try block (after JSON parse succeeds), replace the fire-and-forget IIFE with:
```js
try {
  await persistRetry(() => fetch(`/api/circles-sessions/${sid}/progress`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gateResult: result })
  }), { label: 'gateResult-PATCH' });
} catch (err) {
  if (err.name === 'RetryExhausted') {
    AppState.circlesGateResult = null;
    showGateBanner('跨裝置同步失敗，請點「送出」重新提交');
    return;
  }
  throw err;
}
```

`showGateBanner` — small helper, place inline near the gate render code. Reuses existing banner DOM pattern (Phase 1.5 gate result card).

### T3.3 Verify + commit

Spec 3 green. jest baseline holds. Commit:
```
fix(circles-gate): await + retry gateResult PATCH cross-device persist (T3, F-04)
```

---

## T4 — `submitFrameworkToGate` ensure retry + "重新嘗試" button (F-10)

### T4.1 Red — add spec 4 to `tests/visual/persistence-resilience.spec.js`

- POST `/api/circles-sessions/draft` mocked to 500 once then 200; gate submit succeeds without user re-click; assert no error message; assert exactly 2 POST attempts.
- POST `/draft` permanently 500; assert "重新嘗試" button is visible and clickable; clicking it triggers a fresh retry chain (asserts 4 more POST attempts).

Run — red.

### T4.2 Green — edit `public/app.js:7437-7446`

Wrap the `ensureCirclesDraftSession()` call in `persistRetry`. On exhaust, replace the current dead-end string render with a small DOM block: zh-TW banner + a `<button class="onb-tooltip__next">重新嘗試</button>` (reuses existing token class — no new CSS). Button click handler: re-invoke `submitFrameworkToGate()`.

`ensureCirclesDraftSession` itself needs a minor refactor — it currently catches internally and returns null. Change: rethrow on network/5xx so persistRetry can catch; keep return-null for genuine 4xx (e.g., session quota).

### T4.3 Verify + commit

Spec 4 green. jest baseline holds. Commit:
```
fix(circles-gate): retry ensureSession + retry button on exhaust (T4, F-10)
```

---

## T5 — NSM gate POST: persist `progress_json.gateResult` (F-12)

### T5.1 Coordinate with lifecycle plan

**Before writing code:** check whether `docs/superpowers/plans/2026-05-16-session-lifecycle-state-machine-plan.md` has shipped its T5/T6 equivalent (lifecycle transition write inside `routes/nsm-sessions.js` POST `/:id/gate`).

- If lifecycle landed first: rebase. The merged UPDATE statement must set BOTH `lifecycle='gated'` AND `progress_json: { ...prev, gateResult: result }` in one `await db.from(...).update(...)` call.
- If lifecycle has not landed: write the F-12 UPDATE as a standalone statement. Add a TODO comment for the lifecycle merge.
- Either way: per spec §8.3, director sign-off recorded as "F-12 implementer authorized to write merged shape; lifecycle plan adapts downstream."

### T5.2 Red — `tests/routes/nsm-sessions-resilience.test.js` spec 1

```
describe('POST /api/nsm-sessions/:id/gate', () => {
  test('persists gateResult to progress_json', async () => {
    // seed session
    // POST /:id/gate with valid body
    // GET /:id
    // expect(row.progress_json.gateResult).toEqual(responseBody)
  })
})
```

Run — red (current handler does not persist).

### T5.3 Green — edit `routes/nsm-sessions.js:112-134`

After `result = await reviewNSMGate(...)` and before `res.json(result)`:
```js
const { error: upErr } = await db.from('nsm_sessions').update({
  progress_json: { ...(session.progress_json || {}), gateResult: result },
  updated_at: new Date().toISOString()
}).eq('id', req.params.id).eq('user_id', req.user.id);
if (upErr) console.error('[nsm-gate] gateResult persist failed', upErr);
// still return result — FE retry covers cross-device
```

Note: tolerate UPDATE error (log + continue) because the response payload still flows to the requesting tab; only cross-device path is affected, and the FE will retry on next mount.

### T5.4 Verify + commit

Spec 1 green. Existing NSM tests baseline must not regress. Commit:
```
fix(nsm-gate): persist gateResult to progress_json for cross-device sync (T5, F-12)
```

---

## T6 — NSM evaluate checkpoint + FE recovery (F-14)

### T6.1 Red — jest contract specs 2-4 + Playwright spec 5b

`tests/routes/nsm-sessions-resilience.test.js` specs 2-4:
- spec 2: POST `/:id/evaluate` writes `progress_json.evaluating=true` BEFORE evaluateNSM completes. Use a jest mock of `evaluateNSM` that resolves after a 200ms delay; mid-delay, query DB and assert checkpoint.
- spec 3: Success path clears `evaluating=false` and sets `scores_json`.
- spec 4: evaluateNSM throws → handler writes `evaluating=false`, `evaluation_error`, re-throws to 500.

`tests/visual/persistence-resilience.spec.js` spec 5b:
- Mock evaluate route to artificially delay 3s; close page mid-flight; reload; assert recovery banner with zh-TW string and re-evaluate button visible.

All red. Confirm.

### T6.2 Coordinate with lifecycle plan (same file as T5)

Per spec §8.2 — lifecycle plan's evaluate transition sets `lifecycle='completed'` on success. T6 final UPDATE must include `lifecycle='completed'` if lifecycle plan has shipped, otherwise leave a TODO.

### T6.3 Green — edit `routes/nsm-sessions.js:79-110`

Restructure handler:
```js
// 1. Pre-write checkpoint
await db.from('nsm_sessions').update({
  progress_json: { ...(prev || {}), evaluating: true, evaluating_started_at: nowISO },
  updated_at: nowISO
}).eq('id', sid).eq('user_id', uid);

let scores;
try {
  scores = await evaluateNSM(...);
} catch (err) {
  await db.from('nsm_sessions').update({
    progress_json: { ...(prev || {}), evaluating: false, evaluation_error: err.message },
    updated_at: new Date().toISOString()
  }).eq('id', sid).eq('user_id', uid);
  return res.status(500).json({ error: err.message });
}

// 2. Final UPDATE: scores + clear checkpoint (+ lifecycle if landed)
await db.from('nsm_sessions').update({
  scores_json: scores,
  progress_json: { ...(prev || {}), evaluating: false },
  updated_at: new Date().toISOString()
}).eq('id', sid).eq('user_id', uid);

res.json({ scores });
```

### T6.4 Green — FE recovery in `public/app.js`

In NSM Step 4 mount (search for `nsmReportTab` render block, ~1564-1610) and `tryResumeLatestSession` NSM branch (~7807-7834), add:
```js
var pj = session.progress_json || {};
var startedAt = pj.evaluating_started_at ? Date.parse(pj.evaluating_started_at) : 0;
var stuck = pj.evaluating === true && !session.scores_json && (Date.now() - startedAt) > 60_000;
if (stuck) {
  renderEvaluateRecoveryBanner(); // small inline helper, banner DOM + 重新評分 button
  return;
}
```

`renderEvaluateRecoveryBanner` reuses existing banner pattern. Button click → calls existing re-evaluate path.

### T6.5 Verify + commit

All T6 specs green. jest + Playwright NSM baseline holds. Commit:
```
fix(nsm-evaluate): pre-write checkpoint + recovery banner for crash recovery (T6, F-14)
```

---

## T7 — Playwright E2E full suite (network mocks for all 5)

### T7.1 Specs

Complete `tests/visual/persistence-resilience.spec.js` with all 5 specs (specs 1, 2 from T2 file, spec 3 from T3, spec 4 from T4, spec 5a/5b from T5/T6). Refactor any prototype specs added during T2-T6 into this single file.

Reusable fixture inside the spec file:
```js
async function mockFailingRoute(page, urlPattern, { failTimes, failKind = 'status:503' } = {}) {
  let count = 0;
  await page.route(urlPattern, route => {
    count++;
    if (count <= failTimes) {
      if (failKind === 'abort') return route.abort('failed');
      if (failKind.startsWith('status:')) return route.fulfill({ status: parseInt(failKind.split(':')[1], 10) });
    }
    return route.continue();
  });
  return () => count;
}
```

All 5 specs use this fixture. Per spec §6.1, the skill `request-mocking.md` is the pattern source.

### T7.2 Run on Mobile-360 + Desktop-1280

Bundle gate = 2 viewports green for spec correctness. Full 8 vp comes in T9.

### T7.3 Commit

```
test(persistence): E2E network-mock specs for all 5 resilience paths (T7)
```

---

## T8 — Adversarial sweep (5 edge cases)

From spec §6.4. Add to the same file or a sibling `tests/visual/persistence-resilience-adversarial.spec.js`:

1. 12 keystrokes in 2s during a network outage — assert no PATCH starvation, localStorage stays fresh.
2. Mid-retry tab close — assert no orphan timer / unhandled rejection (use `page.on('pageerror')` listener).
3. Server 200 + malformed JSON body — non-retryable, surfaces to user.
4. Evaluate checkpoint at 59s old → no banner; at 61s old → banner shown (two sub-tests).
5. Two tabs both trigger evaluate exhaust — both see banner, only one re-evaluate POST succeeds.

Run all green. Commit:
```
test(persistence): adversarial edge cases for retry + checkpoint paths (T8)
```

---

## T9 — Final regression + director cold-Read

### T9.1 jest baseline

```
npm test
```

Expect ≥170 baseline + new specs (T1 8 + T5/T6 4 = 12 new). New baseline: 182/199. Document any new skipped specs.

### T9.2 Full 8 vp Playwright

```
npm run test:visual -- --grep persistence-resilience
```

across iPhone-SE / iPhone-14 / iPhone-15-Pro / iPad / Mobile-360 / Desktop-1280 / 1440 / 2560. Transient timeouts on iPhone-15-Pro / 14 do not block ship (per CLAUDE.md established pattern), but all 5 specs must pass on at least 6/8 vp.

### T9.3 iOS 15-item walk

Per CLAUDE.md Standing Rule 5. Walk focus / touch / sticky / modal / SSE for: Phase 1 save-state strip (T2 banner), Phase 1.5 gate banner (T3), Phase 1 retry button (T4), NSM Step 4 recovery banner (T6).

### T9.4 Director cold-Read 4 toast PNGs

Capture:
- `audit/persistence-resilience/save-error-banner-mobile.png` + `-desktop.png`
- `audit/persistence-resilience/gate-sync-fail-banner-mobile.png` + `-desktop.png`
- `audit/persistence-resilience/ensure-retry-button-mobile.png` + `-desktop.png`
- `audit/persistence-resilience/nsm-evaluate-recovery-mobile.png` + `-desktop.png`

Director Read each; confirm zh-TW correct, tokens unchanged, no mockup drift.

### T9.5 Write the 2 mandatory artifacts (CLAUDE.md §"Bundle PR must出 4 樣產出")

- `tests/visual/diffs/persistence-resilience-report.md` — pixel-diff summary
- `audit/eyeball-persistence-resilience.md` — director walk notes per PNG

### T9.6 Final commit

```
docs(persistence-resilience): final regression artifacts + director cold-read (T9)
```

---

## Hard constraints checklist (per task)

Every task's implementer dispatch must prepend the Karpathy 4-check (CLAUDE.md memory `feedback_karpathy_guidelines_standard.md`) AND verify:

- [ ] No backend prompt changes (no edit to `lib/ai/*`)
- [ ] No mockup CSS changes
- [ ] IL-3 TDD followed (red shown before green)
- [ ] zh-TW for any user-facing string
- [ ] Existing jest baseline preserved
- [ ] Karpathy: simplicity first — retry helper stays ≤60 lines, ≤3 functions + 1 error class

---

## Writing-plans self-review (superpowers:writing-plans inline)

| Check | Status |
|---|---|
| Every task has a definition-of-done? | Yes — each T-section ends with "Verify + commit" or "Run all green" |
| Tasks are independently testable? | Mostly — T2/T3/T4 are parallel after T1. T5 and T6 are sequential (same file). T7-T9 follow. |
| Red-first explicit per code task? | Yes — T1.1, T2.1, T3.1, T4.1, T5.2, T6.1 all start with "Red" subsection |
| File overlap with parallel plan flagged? | Yes — T5.1 and T6.2 both explicitly check the lifecycle plan and define merge rules |
| Commits planned with message text? | Yes — each task ends with a commit block in code-fence |
| Bite-sized (each task <1 day)? | Yes — T1 is the largest (~3-4h: helper + 8 specs + coverage). Others are ≤2h |
| Rollback path? | Per file — each commit is self-contained. T1 can revert as one unit; T2-T6 revert independently. |
| Final gate clear? | T9 — jest 182/199 + 8 vp Playwright + iOS 15-item + 4 director cold-Reads |

**Issue found in self-review:** "T1.1 says 'do not implement assertions until red' — but jest tests need at least skeleton assertions to be runnable and observably red. **Fix:** clarified that red means 'module not found' error, which is observable without full assertions. Full assertions are written immediately after the skeleton runs and shows the import error. Re-read T1.1 — wording acceptable as-is."

**Issue found in self-review:** "Plan doesn't say what happens if T9 reveals a regression in an existing Playwright spec (not in the 5 new ones). **Fix:** if regression is in a Playwright spec touched by these changes (e.g., draft-data-loss-fix.spec extended in T2), the bundle owner debugs and fixes within the same bundle. If regression is in an unrelated spec (e.g., qchip / typewriter), file a P1 follow-up and ship the bundle (per CLAUDE.md pattern: transient flakes don't block ship)."

---

## Open questions for director (must answer before T5 starts)

1. **Merge UPDATE shape with lifecycle plan?** Spec §8.3. Recommendation: yes, T5 writes the merged shape; lifecycle plan adapts. Confirm or override.
2. **Bundle PR or 5 separate commits?** Plan defaults to 9 sequential commits on `main` (per CLAUDE.md push-direct-to-main memory). Confirm or request PR.
3. **`evaluating_started_at` 60s threshold negotiable?** If user prefers 30s or 90s, adjust §5 + T6 + T8 spec 4 in one place.

---

## File index (where everything lives)

| Artifact | Path |
|---|---|
| Spec | `docs/superpowers/specs/2026-05-16-persistence-resilience-design.md` |
| Plan (this file) | `docs/superpowers/plans/2026-05-16-persistence-resilience-plan.md` |
| Source audit | `audit/persistence-comprehensive-audit-2026-05-16.md` |
| Parallel lifecycle spec | `docs/superpowers/specs/2026-05-16-session-lifecycle-state-machine-design.md` |
| Helper (new) | `public/lib/persistRetry.js` |
| jest unit (new) | `tests/lib/persist-retry.test.js` |
| jest contract (new) | `tests/routes/nsm-sessions-resilience.test.js` |
| Playwright E2E (new) | `tests/visual/persistence-resilience.spec.js` |
| Playwright adversarial (new or sibling) | `tests/visual/persistence-resilience-adversarial.spec.js` |
| Director walk artifact | `audit/eyeball-persistence-resilience.md` |
| Pixel-diff report | `tests/visual/diffs/persistence-resilience-report.md` |
| Toast PNGs | `audit/persistence-resilience/*.png` |

**End of plan.**
