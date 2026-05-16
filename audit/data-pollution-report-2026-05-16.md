# Data Pollution Report — 2026-05-16

**Scanned:** albertpeng678@gmail.com (real prod account)
**Patterns:** `e2e-rN-` / `dual-uat-` / `*-178NNN-fN` / `test-stub-` / `smoke-` / `repro-bug1-`
**Result (expanded scope per user request):** 13 sessions confirmed DELETE
- 11 POLLUTED (7 circles + 4 nsm, original scan)
- 2 EMPTY_STUB (nsm, zero content + zero analysis)
- (1 INCOMPLETE_OLD nsm `ee133f7e` held back for inspection — separate decision)

## DELETE list (whole row)

| sessionId | kind | created_at | match field | sample (60 char) | confirm? |
|---|---|---|---|---|---|
| 827ce3ef-f454-4db2-a155-1f37a7542804 | circles | 2026-05-16T04:34:05.970858+00:00 | framework_draft.I.排除對象 | e2e-r2-B4-I-1778906137434-f3 | [x] |
| 460fdeb8-b82d-4558-a432-b183fb4ee5bb | circles | 2026-04-25T04:59:02.584567+00:00 | framework_draft.C1.假設確認 | dual-uat-r5-c1-1778905724006-f3 | [x] |
| a6dc7a29-bf36-4372-8fc5-a50b08efb372 | circles | 2026-05-16T04:16:00.13515+00:00 | framework_draft.C1.假設確認 | e2e-r2-c1-sim-1778904964277-f3 | [x] |
| 23786546-ed15-4b73-a0be-16113f6df505 | circles | 2026-05-16T04:10:34.621996+00:00 | framework_draft.I.排除對象 | e2e-r2-B4-I-1778904727682-f3 | [x] |
| 67b91087-fa35-4be6-bfbf-d1546577d1c2 | circles | 2026-05-16T03:51:46.64546+00:00 | framework_draft.C1.假設確認 | e2e-r2-c1-sim-1778903510779-f3 | [x] |
| 590e2ebd-0186-47d8-b1f3-0ef675d16fc4 | circles | 2026-05-16T03:28:10.300212+00:00 | framework_draft.C1.假設確認 | e2e-r2-c1-sim-1778902094460-f3 | [x] |
| 51eab7eb-732b-4c8d-9579-1a98f6b8bacb | circles | 2026-05-16T03:22:55.084942+00:00 | framework_draft.I.排除對象 | e2e-r2-B4-I-1778901861940-f3 | [x] |
| c4de5423-31f5-4275-a076-a2e4e7ffc5a2 | nsm | 2026-05-16T04:26:53.259324+00:00 | full row (user_nsm + user_breakdown all stub) | repro-bug1-r5-1778906193039 | [x] |
| dc328ed8-e6a9-4e89-9f82-79e06e9fa5e7 | nsm | 2026-05-16T04:03:54.221698+00:00 | full row (user_nsm + user_breakdown all stub) | repro-bug1-r5-1778904780067 | [x] |
| bc285221-4fc6-4090-a5c6-12801031845d | nsm | 2026-05-16T03:38:15.447272+00:00 | full row (user_nsm + user_breakdown all stub) | repro-bug1-r5-1778903427510 | [x] |
| fb367fe0-4d37-414c-be12-4b0363653fd6 | nsm | 2026-05-16T03:13:42.755888+00:00 | full row (user_nsm + user_breakdown all stub) | repro-bug1-r5-1778901909039 | [x] |
| c4591b10-ccd7-41f6-8af1-6a24549f9041 | nsm | 2026-05-16T04:03:37.217402+00:00 | empty_stub (q98, no user content, no analysis) | (empty) | [x] |
| 3ad347f5-a9cf-4c53-bc46-09d9b35b55fb | nsm | 2026-05-16T03:10:51.084408+00:00 | empty_stub (q73, no user content, no analysis) | (empty) | [x] |

## CLEAR-FIELD list (legitimate session, single polluted field)

_(empty — inspection upgraded all 4 NSM polluted rows to DELETE; EMPTY_STUB rows added by inventory expansion)_

## Held back for separate decision

| sessionId | kind | created_at | reason |
|---|---|---|---|
| ee133f7e-5e69-4730-9511-c39fc5b99b0e | nsm | 2026-05-01T07:02:28.838683+00:00 | INCOMPLETE_OLD (14d, has partial real content) — see inspect dump before deciding |
