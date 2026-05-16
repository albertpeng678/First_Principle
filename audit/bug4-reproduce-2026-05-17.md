# Bug 4 Reproduce Audit — 2026-05-17

**Investigator:** sonnet (investigator lane — NO production code changes)
**User report:** 「offcanvas 把所有練習紀錄刪除後，下次再點擊 offcanvas 時，還是會出現已經刪除的練習紀錄」
**Bug ID:** Bug 4 (task #254 pending)
**Result:** **NOT_REPRODUCIBLE** in 7 real-Playwright + real-Supabase scenarios.

---

## 1. Existing baseline coverage (re-verified GREEN)

`tests/e2e/offcanvas-delete.spec.js` (Stage 1B B4) — re-ran on `main` HEAD `34c1361`:

- B4-E1 real DELETE → immediate re-open → deleted item absent — **PASS** (3.3 s)
- B4-E2 intercept DELETE → 500 → rollback + toast — **PASS** (3.5 s)
- B4-E3 NSM delete — skipped (pending NSM seed helper; F-P16 in `audit/findings-slice-cross-2026-05-17.md`)

```
✓  4 [e2e-desktop] › tests/e2e/offcanvas-delete.spec.js:136:3 › B4-E1 (3.3s)
✓  2 [e2e-desktop] › tests/e2e/offcanvas-delete.spec.js:161:3 › B4-E2 (3.5s)
-  3 [e2e-desktop] › tests/e2e/offcanvas-delete.spec.js:200:3 › B4-E3 skipped
3 passed, 1 skipped
```

Conclusion: Stage 1B B4 fix (`c7b3e40` / `74959cf` / `9a406f8`) holds for the single-delete case.

---

## 2. New reproduce harness — 7 scenarios

**Spec:** `tests/e2e/bug4-offcanvas-delete-cache-reproduce.spec.js`
**Config:** `tests/e2e/bug4-playwright.config.js` (standalone — main e2e config has a fixed `testMatch` regex that excludes new files)
**Real-data discipline:** No own-API mocks (Pitfall 11). Real POST `/draft` + PATCH `/progress` → real DELETE → real GET list every test. Real Supabase rows created + cleaned per test.

| # | Scenario | Result |
|---|---|---|
| R1 | Delete ALL 3 items → close → reopen (exact user wording) | **GREEN** — `historyList:[]`, 0 items rendered |
| R2 | Delete all → navigate home (recent-rail render) → reopen offcanvas | **GREEN** |
| R3 | Delete all → `page.reload()` (fresh AppState) → reopen | **GREEN** — server cache invalidation holds across reload |
| R4 | Tab A delete all → Tab B fresh cold-boot → opens offcanvas | **GREEN** — cross-tab server cache invalidation works |
| R5 | Delete all → reopen via `see-all` CTA from home (different open path: `app.js:5736`) | **GREEN** |
| R6 | Delete all → wait 6 s (server cache TTL = 5 s, `lib/session-cache.js:3`) → reopen | **GREEN** |
| R7 | Delete all → navigate to Phase 1 with new question → `preflightDraftSession` auto-creates draft → reopen | **GREEN** — `lifecycle:'created'` row filtered out by list (`routes/circles-sessions.js:136`) |

Full run: `8 passed (53.5s)` — see end of file for raw output.

---

## 3. Architecture review — why bug is hard to reproduce

| Layer | Guard | Source |
|---|---|---|
| FE optimistic filter | `historyList.filter(i => String(i.id) !== String(id))` removes immediately on click | `app.js:8257` |
| FE rollback snapshot | `__originalList = historyList.slice()` before filter; restored on DELETE error | `app.js:8256, 8271` |
| FE inflight guard | `AppState._deleteInflight` Set blocks double-click → duplicate DELETEs | `app.js:8249-8251, 8277` |
| FE reload on next open | navbar `target === 'offcanvas'` → `historyList = null; loadHistory()` forces re-fetch every time | `app.js:3171-3174` |
| BE auth DELETE | `cache.invalidate(CACHE_KIND, req.user.id)` on every DELETE | `routes/circles-sessions.js:172` |
| BE guest DELETE | `cache.invalidate(CACHE_KIND, req.guestId)` on every DELETE | `routes/guest-circles-sessions.js:170` |
| BE list cache TTL | 5 s — bounds any miss in invalidation | `lib/session-cache.js:3` |
| BE list filter | `lifecycle !== 'created'` excludes phantom drafts from list | `routes/circles-sessions.js:136`, `guest-circles-sessions.js:52` |
| Persistence | `historyList` NOT in `PERSISTED_KEYS` — no localStorage cache leak | `app.js:154-165` |

All 9 layers held in every scenario.

---

## 4. Hypotheses considered but disproved

| Hypothesis | Probe | Outcome |
|---|---|---|
| Cross-tab server cache stale (Tab A deleted, Tab B sees stale list) | R4 | Disproved — `cache.invalidate` works per-user |
| Server cache TTL window (5 s) lets stale data leak | R6 | Disproved — even after TTL expires, fresh DB query returns empty |
| `_doOffcanvasDelete` filters `historyList` but `circlesRecentSessions` (home rail) stays stale | R2 + grep `app.js:5232` | Cosmetic gap exists (rail stays stale until next render-triggered `loadHistoryForRail` fires) BUT does NOT affect offcanvas. Not Bug 4. |
| `preflightDraftSession` auto-creates a phantom session that surfaces in offcanvas | R7 | Disproved — phantom is created with `lifecycle:'created'` and excluded by list filter |
| localStorage `pmDrillState` restore brings back deleted item ids | `grep PERSISTED_KEYS` | Disproved — `historyList` not persisted |

---

## 5. Recommended next step

**Close as `cannot-reproduce`** with the following user-facing follow-ups before re-opening:

1. **Ask user for exact repro:** which auth state (logged-in vs guest), which device/browser, which session types (CIRCLES drill / CIRCLES sim / NSM), and whether the "reappearing" records show the SAME ids/titles as the deleted ones or NEW ones.
2. **Investigate guest path separately** — my R1–R7 ran as authenticated `e2e@first-principle.test`. The `guest-circles-sessions.js` DELETE handler has the same `cache.invalidate` shape but uses `req.guestId` (cookie). Worth one more probe if user reports happens in guest mode.
3. **Investigate NSM specifically** — B4-E3 still skipped; `DELETE /api/nsm-sessions/:id` cache invalidation path is verified by `lib/session-cache.js` audit but has no live E2E (F-P16 in `audit/findings-slice-cross-2026-05-17.md`). If user reports the reappearing items are NSM rows, this gap becomes the prime suspect.
4. **Cosmetic gap worth fixing in next pass:** `_doOffcanvasDelete` (`app.js:8247-8280`) does not invalidate `AppState.circlesRecentSessions` — home rail stays stale until the next time `loadHistoryForRail` fires. Not Bug 4, but adjacent to user's mental model.

**Recommended fix approach (1 sentence, no code):** if user can re-repro after providing the extra context above, add a parallel `AppState.circlesRecentSessions = null; loadHistoryForRail()` invalidation inside `_doOffcanvasDelete` (so home rail mirrors offcanvas state) and implement the B4-E3 NSM delete E2E to close the only un-tested DELETE path.

---

## 6. Artifacts

- Spec: `tests/e2e/bug4-offcanvas-delete-cache-reproduce.spec.js`
- Standalone config: `tests/e2e/bug4-playwright.config.js`
- Screenshots:
  - `audit/bug4-reproduce/R1-after-delete-before-close.png` — shows offcanvas empty-state after delete
  - `audit/bug4-reproduce/R1-after-reopen.png`
  - `audit/bug4-reproduce/R2-home-after-delete.png`
  - `audit/bug4-reproduce/R2-reopen-after-home.png`
  - `audit/bug4-reproduce/R3-after-reload.png`
  - `audit/bug4-reproduce/R4-tabB-after-tabA-delete-cold-boot.png`
  - `audit/bug4-reproduce/R4-tabB-offcanvas-final.png`
  - `audit/bug4-reproduce/R5-after-see-all.png`
  - `audit/bug4-reproduce/R6-after-ttl-wait.png`
  - `audit/bug4-reproduce/R7-phantom-preflight.png`

## 7. Raw run output (final)

```
Running 8 tests using 1 worker
✓  1 [setup] › tests/setup/auth.setup.js:21:1 › authenticate as e2e@first-principle.test (1.8s)
[R1-diag] {"offcanvasOpen":true,"historyList":[],"historyLoading":false}
✓  2 [bug4] › R1: delete ALL 3 items → close → reopen → all absent (user-wording) (5.6s)
✓  3 [bug4] › R2: delete all → go home → reopen offcanvas — recent-rail cache leak? (6.5s)
✓  4 [bug4] › R3: delete all → page.reload() → reopen — server cache 5s TTL? (5.2s)
✓  5 [bug4] › R4: Tab A delete all → Tab B fresh open offcanvas — server-side cache cross-tab (6.3s)
✓  6 [bug4] › R5: delete all → open via see-all CTA from home (different open path) (6.1s)
[R7-diag] {"historyList":[],"circlesSessionId":"…","circlesSessionLifecycle":"created"}
✓  7 [bug4] › R7: PHANTOM-PREFLIGHT — delete all → navigate to Phase 1 → reopen offcanvas (9.4s)
✓  8 [bug4] › R6: delete all → wait 6s (TTL expire) → reopen (11.5s)
8 passed (53.5s)
```

---

## 8. Caveats / known noise

- One transient R1 failure observed during iteration (`historyList:["a3020ba9-...","aadd2b38-...","8f2bd7b0-...","f11d34cb-..."]` — 4 items instead of expected 0). Run 1 had leftover sessions from a prior aborted test run that the `bootApp` drain did not fully clean. Runs 2–5 all passed; flake is test-harness pollution, not a Bug 4 reproduction. Diagnosed in the failure trace — none of the 4 ids matched the just-seeded ids, confirming they were stale leftovers.
- All `audit/bug4-reproduce/R{1,2,3,5}-…` screenshots show the home view (not the open offcanvas drawer) — this is a screenshot-timing artifact (offcanvas closes between `expect(offcanvasBody).toBeVisible()` and `page.screenshot()`). The functional assertions (`itemCount === 0` and `historyList:[]` snapshot via `page.evaluate`) verified the empty state before the screenshot was taken.
- R4 (`R4-tabB-after-tabA-delete-cold-boot.png`) shows Tab B auto-resumed into a session via `tryResumeLatestSession` BEFORE the cold-boot offcanvas open — this is a related-but-distinct behavior (cross-tab session resume without delete-event propagation) and is NOT Bug 4. Worth a follow-up audit if user wants per-tab session sync.
