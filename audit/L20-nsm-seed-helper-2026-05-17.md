# L20 — NSM Seed Helper + B4-E3 Unblock
**Date:** 2026-05-17
**Closes:** O-7 (master tracker §6) + F-P16 spec gap
**Commit:** f292a22

---

## §1 Helper API + Location

**File:** `tests/e2e/offcanvas-delete.spec.js` (lines 123–178)
**Function:** `createRealNsmSession(page)`

### API

```js
const sessionId = await createRealNsmSession(page);
// Returns: UUID string of the new NSM session
```

### Key design decisions

1. **Unique question_id per worker** — Uses `crypto.randomUUID()` inside the browser context to generate a per-invocation question_id prefixed `nsm_b4e3_`. This prevents `dedupSessions()` (lib/session-dedup.js) from merging concurrent parallel-worker sessions: three browser workers (desktop / mobile-safari / mobile-chrome) each run B4-E3 simultaneously; without unique question_ids, only one session per question_id appears in loadHistory.

2. **Two-step seed** — POST `/api/nsm-sessions` creates a row with `lifecycle='created'`. The GET list endpoint (routes/nsm-sessions.js:59) filters out `lifecycle='created'` rows. A subsequent PATCH `/api/nsm-sessions/:id/progress` with `userNsm` (substantive content per `hasSubstantiveContent` in lib/session-lifecycle.js:86) promotes lifecycle to `'editing'`, making the session visible in offcanvas loadHistory.

3. **No stub** — Uses real apiFetch from page context, carrying the Bearer token from AppState.accessToken. Mirrors lifecycle-nsm.spec.js `createNsmSession` pattern. No mock of own API per e2e_real_data_only memory rule.

4. **Auto-cleanup** — Sessions are cleaned up via the auto-cleanup fixture (tests/fixtures/auto-cleanup.fixture.js) which fires DELETE after each test. The offcanvas DELETE itself acts as cleanup for the successfully-deleted session.

---

## §2 B4-E3 Unblock Summary

**Before:** `test.skip(true, 'NSM seed helper TBD — track in P3 follow-ups')`

**After:** Full test implementation — boots app, seeds NSM session via helper, opens offcanvas, asserts item visible, clicks delete, asserts item immediately absent (optimistic filter), closes/re-opens offcanvas, asserts item still absent after loadHistory re-fetch.

**Root cause of initial flake (discovered during implementation):** `dedupSessions` deduplicates sessions by `question_id`. Using the shared `nsm_001` question_id caused parallel workers to create competing sessions; only the most-recently-updated one appeared in loadHistory, causing the other workers' tests to fail. Fixed by generating unique question_ids per invocation.

---

## §3 Verification Results

| Verification | Result |
|---|---|
| B4-E3 alone (3 browsers) | 3/3 PASS |
| Full offcanvas-delete.spec.js (10 tests) | 10/10 PASS |
| 5x consecutive B4-E3 | 5/5 no flake (15/15 browser runs) |
| jest full suite | 535/552 (≥535 baseline, no regression) |

### 5x run timings
- Run 1: 4 passed (8.8s)
- Run 2: 4 passed (8.7s)
- Run 3: 4 passed (8.1s)
- Run 4: 4 passed (8.0s)
- Run 5: 4 passed (8.9s)

---

## §4 NSM Delete Cache Invalidation — No Leak Found

The test validates that after DELETE + close + re-open offcanvas, the deleted NSM session does not reappear. This exercises the NSM delete path in app.js:8394 (`/api/nsm-sessions/:id` DELETE) and the subsequent loadHistory re-fetch.

**Finding:** Cache invalidation is working correctly for NSM sessions. The `cache.invalidate(CACHE_KIND, req.user.id)` call in routes/nsm-sessions.js:89 (DELETE handler) ensures the next loadHistory GET hits the DB fresh. No ghost-resurrection was observed across 15 browser runs (5 runs × 3 browsers).

**No action required** — NSM delete cache invalidation is solid.
