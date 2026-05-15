# Data Pollution Report — 2026-05-16

**Scanned:** albertpeng678@gmail.com (real prod account)
**Patterns:** `e2e-rN-` / `dual-uat-` / `*-178NNN-fN` / `test-stub-` / `smoke-`
**Result:** 0 polluted sessions found (0 nsm + 0 circles)

## DELETE list (whole row — created BY my UAT spec)

| sessionId | kind | created_at | match field | sample (60 char) | confirm? |
|---|---|---|---|---|---|

## CLEAR-FIELD list (legitimate session, single polluted field)

| sessionId | kind | created_at | match field | sample (60 char) | confirm? |
|---|---|---|---|---|---|

## Curl preview (post-confirmation execution)

```bash
# DELETE rows

# CLEAR fields (one example per row — execute-cleanup.js handles per-field PATCH)
```
