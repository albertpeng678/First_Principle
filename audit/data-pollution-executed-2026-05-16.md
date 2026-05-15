# B7 Cleanup Executed — 2026-05-16

**Scanned account:** albertpeng678@gmail.com (real prod)
**Endpoint:** https://first-principle.up.railway.app
**Total polluted found across 2 scans:** 4 sessions (all circles, 0 nsm)
**Status:** ALL DELETED — re-scan confirms 0 polluted remaining.

## Run 1 (3 sessions deleted)

| sessionId | kind | action | sample pollution | status |
|---|---|---|---|---|
| 175d7c4b-4d1c-446c-9fe5-65456ab3ea01 | circles | DELETE_ROW | step_drafts.framework.I.排除對象 = `e2e-r2-B4-I-1778831647048-f3` | 200_ok |
| 41e7edee-de53-4e80-84a4-d60e94848ead | circles | DELETE_ROW | framework_draft.I.排除對象 = `e2e-r2-B4-I-1778835537531-f3` | 200_ok |
| 8cbf4dcd-eb40-4ba7-b8ae-eb97d8042322 | circles | DELETE_ROW | framework_draft.I.排除對象 = `e2e-r2-B4-I-1778827186275-f3` | 200_ok |

## Run 2 (1 session deleted — surfaced after Run 1 expanded list visibility past BE cache)

| sessionId | kind | action | sample pollution | status |
|---|---|---|---|---|
| dc75d3ad-d6b0-42da-b084-96dd00975c21 | circles | DELETE_ROW | framework_draft.C1.假設確認 = `e2e-r2-c1-sim-1778831879299-f3` | 200_ok |

## Post-cleanup scan (V1 verify)

```
fetching circles session list... 2 circles sessions
fetching circles session details (full fields)... [2/2]
fetching nsm session list... 1 nsm sessions
fetching nsm session details (full fields)... [1/1]

Polluted: 0 (0 nsm, 0 circles)
Total scanned: 3 sessions
```

## Why the 2-run split

First scan returned 5 circles via BE list endpoint (`routes/circles-sessions.js:108-128`).
Default LIMIT is 20, ordered `updated_at DESC` — but BE also has a per-user cache
(`if (!req.query.status && !req.query.limit) cache.get()`) that may have served
a stale 5-row subset omitting `dc75d3ad`. After Run 1 deletions invalidated the cache,
re-scan returned the true 3 remaining (one of which still had pollution).

Fix applied: `scripts/scan-pollution.js fetchSessions` now requests `?limit=50` to
bypass the cache + see all sessions up to 50.

## What remains in the account

- 2 circles sessions (real drafts, no UAT pollution)
- 1 nsm session (`ee133f7e-...`, q17 about Zoom meeting metric — real user content)
