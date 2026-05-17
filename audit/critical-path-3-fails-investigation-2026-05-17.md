# L14 — Critical-Path 3 Pre-existing Fails Investigation
**Date:** 2026-05-17
**Lane:** L14 (O-8 enforcement)
**Spec:** `tests/e2e/critical-path-full-flow.spec.js` (commit `9446ad2`)
**Inspector:** Claude Sonnet 4.6

---

## §1 Spec Path + 3 Failing Test Identification

**Spec:** `tests/e2e/critical-path-full-flow.spec.js`
**Config:** `tests/e2e/playwright.config.js`
**Run command:** `npx playwright test --config tests/e2e/playwright.config.js tests/e2e/critical-path-full-flow.spec.js`
**Result:** 1 passed (e2e-desktop setup), 3 failed (1 per e2e project)

All 3 failures are the same test (1 test × 3 projects):

| # | Test Name | Project | Failing Step |
|---|---|---|---|
| 1 | `login → Phase 1 fill + gate → Phase 2 UI → Phase 2 → score → offcanvas delete → hint modal` | `e2e-desktop` | Step 2: `Stage 1A T7 — Phase 1 → gate → canProceed` |
| 2 | `login → Phase 1 fill + gate → Phase 2 UI → Phase 2 → score → offcanvas delete → hint modal` | `e2e-mobile-chrome` | Step 1: `Stage 1A — login via storageState → CIRCLES home visible` |
| 3 | `login → Phase 1 fill + gate → Phase 2 UI → Phase 2 → score → offcanvas delete → hint modal` | `e2e-mobile-safari` | Step 1: `Stage 1A — login via storageState → CIRCLES home visible` |

---

## §2 Trace + Evidence Per Fail

### Fail 1 — e2e-desktop (Step 2: gate-wrap not found)

**Screenshot:** `audit/L14-evidence/fail-desktop-gate-wrap-not-found.png`
**Error-context:** `audit/L14-evidence/error-context-desktop.md`

Screenshot shows: Phase 1.5 page rendered with error state "建立練習失敗 / 無法建立練習，請檢查網路後重試 / DRAFT_CREATE_FAILED" — with "重新嘗試" and "返回修改" buttons.

**Failure mode:** `element(s) not found` — `.gate-wrap` never appears because `submitFrameworkToGate` returned early at the `DRAFT_CREATE_FAILED` branch before reaching the `/gate` POST. The test waited 30_000ms (3× slow multiplier of 10_000ms = 30s — but the explicit timeout is 30_000ms) for `.gate-wrap`, which never rendered.

**Failure path trace (code):**
1. `spec:292` — `window.submitFrameworkToGate()` called
2. `app.js:7630` — `persistRetry(() => ensureCirclesDraftSession())`
3. `app.js:3793` — `ensureCirclesDraftSession` finds `AppState.circlesSession.id` already set (from `seedCirclesSession`) → returns `AppState.circlesSession` (a plain session object, e.g. `{id: "...", status: "editing", ...}`)
4. `lib/persistRetry.js:64-73` — `resp = session_object`; `resp.ok` is `undefined` (falsy); `isRetryable(resp)`: session `.status` is string `"editing"`, not a number → falls through to `return true` → retries
5. After 4 attempts: `RetryExhausted` thrown
6. `app.js:7634-7638` — `circlesGateError = 'DRAFT_CREATE_FAILED'`; `render()` → shows error banner instead of gate result

### Fail 2 — e2e-mobile-chrome (Step 1: .navbar__email hidden)

**Screenshot:** `audit/L14-evidence/fail-mobile-chrome-navbar-email-hidden.png`
**Error-context:** `audit/L14-evidence/error-context-mobile-chrome.md`

Screenshot shows: CIRCLES home fully loaded with user logged in (stats strip shows "0 已完成 · 38 進行中 · 0 本週"). The `.navbar__email` element exists in DOM but is CSS-hidden.

**Failure mode:** `Expected: visible / Received: hidden` — `.navbar__email` resolves to `<span class="navbar__email">e2e@first-principle.test</span>` (element exists) but `style.css:61` applies `@media (max-width: 480px) { .navbar__email { display: none; } }`. Pixel 5 viewport (Playwright device) is 393px wide — within the hidden breakpoint.

Call log: `14 × locator resolved to <span class="navbar__email">e2e@first-principle.test</span> - unexpected value "hidden"` — Playwright auto-retried 14 times in 10_000ms, element always hidden.

### Fail 3 — e2e-mobile-safari (Step 1: .navbar__email hidden)

**Screenshot:** `audit/L14-evidence/fail-mobile-safari-navbar-email-hidden.png`

Identical failure mode to Fail 2. iPhone 14 viewport is 390px wide — within the hidden breakpoint. Same element found, same `display:none` applied.

---

## §3 Per-Fail Classification

| Fail | Project | Classification | One-liner |
|---|---|---|---|
| 1 | e2e-desktop | **Real Bug** | `persistRetry` misidentifies session object as failed response, triggers RetryExhausted → DRAFT_CREATE_FAILED |
| 2 | e2e-mobile-chrome | **Test Drift** | `.navbar__email` hidden at 480px breakpoint; same fix as V7 pattern (`9b41bee`) not applied to this spec |
| 3 | e2e-mobile-safari | **Test Drift** | Identical to Fail 2 — same `.navbar__email` selector on same breakpoint range |

---

## §4 Root Cause Per Fail

### Fail 1 — Real Bug: `persistRetry` incompatible with non-Response return value

**Root cause:** Commit `87e1999` (Plan #194 T4 RES-AC5 partial ship) wrapped `ensureCirclesDraftSession()` in `window.persistRetry.persistRetry()`. However, `persistRetry` was designed for functions that return `fetch()` Response objects (with `.ok: boolean` and `.status: number`). `ensureCirclesDraftSession` has an **early-exit guard** at `app.js:3793`:

```js
if (AppState.circlesSession && AppState.circlesSession.id) return AppState.circlesSession;
```

When a session already exists (as seeded by `seedCirclesSession` in the test, or by the Phase 1 form preflight in production), this returns the session object directly — not a Response. `persistRetry` at `lib/persistRetry.js:64` checks `resp.ok`; a session object has no `.ok` property (undefined → falsy). Then `isRetryable(resp)` checks `typeof resp.status === 'number'`; the session's `.status` is the string `"editing"` (or `"created"`) not a number, so it falls through to `return true`. This causes `persistRetry` to retry 4 times then throw `RetryExhausted`, which `submitFrameworkToGate` catches and maps to `DRAFT_CREATE_FAILED`.

**Production code lines:**
- `public/lib/persistRetry.js:64-73` — the response-check logic that fails on non-Response objects
- `public/app.js:3793` — early-exit guard in `ensureCirclesDraftSession` that returns session object
- `public/app.js:7630-7638` — persistRetry wrap + RetryExhausted handler → DRAFT_CREATE_FAILED
- Commit `87e1999` (T4 RES-AC5) introduced the persistRetry wrap with a noted CAVEAT: "TC1 happy retry (503 → 200 → gate proceeds) TIMEOUT 60s — pending diagnose post-cap-reset"

**This is a production bug, not just a test issue.** Any user who already has `circlesSession` set (e.g., from history restore or Phase 1 form save) and then clicks the submit gate will hit this RetryExhausted path. The gate will always show "建立練習失敗" instead of proceeding to Phase 1.5.

### Fail 2 + 3 — Test Drift: `.navbar__email` mobile-hidden selector

**Root cause:** The test at `spec:252` asserts:
```js
await expect(page.locator('.navbar__email')).toBeVisible({ timeout: 10_000 });
```

`public/style.css:61` hides `.navbar__email` on `max-width:480px` viewports:
```css
@media (max-width: 480px) { .navbar__email { display: none; } }
```

Both `e2e-mobile-chrome` (Pixel 5 = 393px) and `e2e-mobile-safari` (iPhone 14 = 390px) fall within this breakpoint.

Commit `9b41bee` (V7 auth-flow fix) already documented and fixed this exact issue in `tests/e2e/auth-flow-real.spec.js`, replacing `.navbar__email` with `button[data-nav="logout"]`. The comment in that commit explicitly states:

> "We deliberately avoid `.navbar__email` because style.css:61 hides it on `max-width:480px` (mobile-chrome / mobile-safari projects)."

The fix was applied to `auth-flow-real.spec.js` but not to `critical-path-full-flow.spec.js` (written in the same sprint). This is a test drift — the production UI is correct, the test selector is not viewport-agnostic.

`button[data-nav="logout"]` at `app.js:3047` uses class `navbar__icon-btn` which has no mobile-hide rule in style.css. It is visible on all viewports.

---

## §5 Proposed Fixes Per Fail

### Fix A — Fail 2 + 3 (Test Drift): one-liner selector replacement

**File:** `tests/e2e/critical-path-full-flow.spec.js`
**Line:** 252

Replace:
```js
await expect(page.locator('.navbar__email')).toBeVisible({ timeout: 10_000 });
```
With (V7 pattern from `9b41bee`):
```js
await expect(page.locator('button[data-nav="logout"]')).toBeVisible({ timeout: 10_000 });
```

This is the exact V7 fix pattern applied to `auth-flow-real.spec.js`. It tests the same post-login signal (logout button renders only when `AppState.accessToken` is set — `app.js:3047`) without relying on the mobile-hidden email span. This is a trivially-obvious test drift one-liner.

### Fix B — Fail 1 (Real Bug): production code fix in `persistRetry` wrap

**Classification:** Real bug — production code wrong. Two approaches:

**Option B1 (minimal, surgical):** Add an early-resolve check before calling `persistRetry`:
```js
// app.js:7629 — check if session already exists; skip persistRetry entirely
if (AppState.circlesSession && AppState.circlesSession.id) {
  // Session already exists — skip ensureCirclesDraftSession retry loop
} else {
  try {
    await window.persistRetry.persistRetry(function () {
      return ensureCirclesDraftSession();
    });
  } catch (ensureErr) {
    if (ensureErr && ensureErr.name === 'RetryExhausted') {
      AppState.circlesGateError = 'DRAFT_CREATE_FAILED';
      AppState.circlesGateLoading = false;
      render();
      return;
    }
  }
}
```

**Option B2 (cleaner, fixes root cause in persistRetry wrapper):** Modify `ensureCirclesDraftSession` to always return a Response-compatible object, or wrap the return to use a sentinel. However, this would spread the fix across two functions.

**Option B3 (simplest):** Unwrap `persistRetry` back to a direct call with try/catch (reverting the T4 partial ship):
```js
try {
  await ensureCirclesDraftSession();
} catch (_) {}
```
Then `sid` check at `app.js:7642` already handles null (falls through to DRAFT_CREATE_FAILED). Retry-on-5xx behavior from persistRetry can be re-added with a proper check.

**Recommended:** Option B1 (minimal, preserves T4 retry intent for real 5xx cases while fixing the already-exists path). Requires touching `public/app.js` — **do NOT implement in this investigation lane** (L13 is editing app.js).

**Defer to:** next lane after L13 completes. This is the top-priority real bug.

---

## §6 Cross-reference: V7 Fix Pattern (`9b41bee`)

**Commit `9b41bee`** (`fix(test): V7 auth-flow E2E — mobile selectors + cleanup + IL-3 framing`, 2026-05-17 02:51):

- Applied to: `tests/e2e/auth-flow-real.spec.js`
- Replaced `.navbar__email` with `button[data-nav="logout"]`
- Reason documented: `style.css:61` hides `.navbar__email` on `max-width:480px`
- Verified: 5x consecutive × 3 projects = 65/65 GREEN

**Does the same selector fix apply to `critical-path-full-flow.spec.js`?**
**YES.** The same `.navbar__email` selector on the same mobile viewport breakpoints causes the same `Expected: visible / Received: hidden` failure. The fix is identical: replace `.navbar__email` with `button[data-nav="logout"]` at `spec:252`. This is a 1-line trivially-obvious test drift fix following established V7 pattern.

**The V7 fix was NOT applied to `critical-path-full-flow.spec.js`** because this spec was created in the same development session as the V7 fix, and the spec author carried over the `.navbar__email` selector that was already known-broken on mobile. This is a carry-forward omission, not a new regression.

---

## Summary Table

| Fail | Project | Step | Selector / Code | Classification | Fix Type |
|---|---|---|---|---|---|
| 1 | e2e-desktop | Step 2 gate | `persistRetry` wraps non-Response return from `ensureCirclesDraftSession` | **Real Bug** (production) | app.js surgery — defer post L13 |
| 2 | e2e-mobile-chrome | Step 1 auth | `.navbar__email` hidden at 480px | **Test Drift** | 1-line: `.navbar__email` → `button[data-nav="logout"]` |
| 3 | e2e-mobile-safari | Step 1 auth | `.navbar__email` hidden at 480px | **Test Drift** | Same 1-line fix as Fail 2 |

**Top priority:** Fail 1 (e2e-desktop) is a **real production bug** — any user with an existing session hitting the gate will always see DRAFT_CREATE_FAILED. Must be fixed in a dedicated lane after L13. Fails 2+3 are test drift (1-line trivial) and should be fixed simultaneously with Fix B.
