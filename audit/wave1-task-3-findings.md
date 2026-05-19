# Wave 1 Task 3 — F-CT1.3 CIRCLES Gate Retry Backoff

**Task:** Add progressive backoff to `prompts/circles-gate.js` retry loop (mirror `nsm-gate.js` pattern)
**Date:** 2026-05-17
**Status:** STAGED — awaiting Director + 2-stage reviewer sign-off before commit

---

## Root Cause (confirmed)

`prompts/circles-gate.js` retry loop (3 attempts) had no delay between attempts. On 429 rate-limit, all 3 attempts fired consecutively within milliseconds — making retry semantically useless.

`nsm-gate.js` had the correct pattern at line 166:
```js
await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
```
(800ms after attempt 0 → attempt 1, 1600ms after attempt 1 → attempt 2)

`circles-gate.js` catch block was:
```js
catch (e) {
  if (attempt === 2) throw new Error('框架審核暫時失敗，請重試');
  // ← NO BACKOFF HERE
}
```

---

## Fix Applied

File: `prompts/circles-gate.js` lines 118-121

Added 2 lines (1 comment + 1 await) in the catch block, mirroring nsm-gate.js exactly:

```js
catch (e) {
  if (attempt === 2) throw new Error('框架審核暫時失敗，請重試');
  // F-CT1.3 fix: progressive backoff mirror nsm-gate.js pattern (per tracker §3)
  await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
}
```

`git diff` confirmed: only 2 lines added, nothing removed, no other file touched.

---

## Test Evidence

**Test file:** `tests/circles-gate-backoff.test.js`

Skills cited in header:
- Pitfall 14 (test-local timing counter, no module-level state)
- §3.9 api-testing (error response simulation via jest.mock OpenAI)
- §3.18 5x consecutive 0 flake

3 test cases:
1. `retry attempts have progressive backoff delay (800ms × attempt)` — PRIMARY
2. `no backoff on first attempt success (fast path unaffected)`
3. `throws after 3 consecutive failures (no infinite retry)`

**RED phase:** Test 1 failed with `Expected: >= 800 / Received: 0` (timing gap = 0, no backoff)

**GREEN phase:** All 3 tests pass after fix

**5x consecutive:** 3/3 passed × 5 runs = 15/15 total — 0 flake

**Adversarial no-regression:** `tests/adversarial/circles-hint.test.js` — 10/10 pass

---

## 5-step cross-check results

| Step | Result |
|---|---|
| `find tests -name circles-gate-backoff.test.js` | Found at expected path |
| `grep -n 'Skills applied'` | Line 2: 3 skills cited |
| `git ls-files --error-unmatch` | "NOT YET TRACKED" before stage (expected — new file) |
| `git diff --cached prompts/circles-gate.js` | +2 lines only (comment + await) |
| `jest tests/circles-gate-backoff.test.js` | 3/3 PASS |

---

## Staged files

```
modified:   prompts/circles-gate.js
new file:   tests/circles-gate-backoff.test.js
```

**Not committed.** Awaiting Director 2-stage review and user "對" gate per Live demo gate protocol.
