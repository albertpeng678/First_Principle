# Group B — Bug Findings

> Created 2026-05-17. Append new entries below; do not edit past entries.

---

## BUG-GB-001 — circles-delete-rollback-real: residual flake after Lane T fix attempt

**Date:** 2026-05-17
**Spec:** `tests/e2e/circles-delete-rollback-real.spec.js`
**Commit:** uncommitted (Lane T working tree edits, not shipped)
**Status:** REJECTED — 5/5 consecutive GREEN gate NOT met

### Lane T edits reviewed

Lane T made 3 changes (diff reviewed):
1. TC1: `bootApp` guard reads `page.context()._options?.baseURL` and throws if not `http`
2. TC3: Replace `page.mouse.click(coords)` with `page.evaluate(sel => el.click())` — eliminates viewport-reflow flake per common-pitfalls.md Pitfall 3
3. TC3: Added comment disclosing DELETE 200 mock (controlled deviation)

### 5-run results (with correct config: `--config tests/e2e/playwright.config.js`)

Note: first 5 runs used wrong invocation (no --config), causing 5/5 systematic failure on `Cannot navigate to invalid URL`. Corrected to proper config invocation per `npm run test:e2e:gate`.

| Run | Result | Projects failed |
|-----|--------|-----------------|
| 1 | FAIL | e2e-desktop + e2e-mobile-chrome (TC1: happy path) |
| 2 | FAIL | e2e-mobile-safari (TC1: happy path) |
| 3 | FAIL | e2e-mobile-safari (TC2: rollback) |
| 4 | PASS | 10/10 (all 3 projects × 3 tests + setup) |
| 5 | FAIL | e2e-mobile-chrome (TC2: rollback) + e2e-mobile-safari (TC1: happy path) |

**Score: 1/5 GREEN. Gate requires 5/5. NOT MET.**

### Failure signature

Failing step: "open offcanvas and confirm item visible"
Error: `expect(locator).toBeVisible() failed — element(s) not found`
Locator: `[data-offcanvas="item"][data-id="<uuid>"]`

The seeded session does not reliably appear in the offcanvas. This is a pre-existing race in the bootApp → seedRealCirclesSession → openOffcanvasAndAwaitItem pipeline — unrelated to Lane T's double-click fix. It was already present before Lane T's edits (confirmed: Review-5 found 3-run flake on commit f6aeec0).

### Root cause hypothesis

The offcanvas history load (`GET /api/circles-sessions`) is a real API call that returns in variable time. If the offcanvas opens and the GET resolves before the seeded session propagates (e.g., DB write not yet visible to read replica / eventual consistency), the item is absent. The `openOffcanvasAndAwaitItem` helper may have insufficient timeout or retry for the seed-to-visible lag.

### TC3 fix assessment

Lane T's `page.evaluate` double-click fix (Pitfall 3) is correct in principle and TC3 itself passed in all 4 non-skipped runs. The residual flake is in TC1 and TC2, not TC3.

### Action required

1. Do NOT commit the working tree edits
2. Investigate `openOffcanvasAndAwaitItem` — add robust polling or increase timeout for seed propagation
3. Re-run 5 consecutive GREEN gate after fix

---

### RESOLUTION 2026-05-17 — Lane T2

**Root cause confirmed:** Race between `seedRealCirclesSession` POST/PATCH (200 returned) and the subsequent `loadHistory` GET that fires when the offcanvas opens. Server returns 200 before the new row is consistently readable via the list endpoint under load, so the offcanvas renders without the seeded item. Web-first `toBeVisible` retry on the DOM does not trigger a refetch — it just polls a stale rendered list.

**Fix (surgical, no sleep, no retry loop):** After PATCH /progress, poll `GET /api/circles-sessions` via `expect.poll` until the seeded `sessionId` is present in the list. This blocks `seedRealCirclesSession` from returning until DB read-after-write is confirmed via the same path the UI will call. Bumped `openOffcanvasAndAwaitItem` web-first ceiling from 10s → 15s for headroom on the in-flight loadHistory GET only.

Why robust (not hiding race):
- Polls the **same endpoint** the UI uses, so we verify exactly what the test depends on
- No fixed delay — passes immediately when DB is consistent, fails fast (15s) with explicit propagation message when something is actually broken
- Per playwright-skill/core/common-pitfalls.md Pitfall 1 (lines 9-66): "wait for a specific condition" not "wait an arbitrary amount"

**5/5 GREEN gate result:**
| Run | Result |
|-----|--------|
| 1 | PASS 10/10 |
| 2 | PASS 10/10 |
| 3 | PASS 10/10 |
| 4 | PASS 10/10 |
| 5 | PASS 10/10 |

**Status:** CLOSED.
