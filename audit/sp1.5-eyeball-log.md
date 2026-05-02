# SP1.5 — Screenshot Eyeball + Test Run Log

Date: 2026-05-02
Branch: feat/sp1.5-fix-track
Worktree dev server: http://localhost:4001 (port 4001 to avoid clash with main repo's 4000 server)

## Baseline (pre-SP1.5, captured Task 1)

- Playwright total: ~1527 passing
- Jest total: 109 passing

## Task-level test runs

### T7 helpers — `tests/sp1.5-helpers.test.js`
- 7/7 jest passed (3 isStepLocked + 4 computeStaleFlag)
- Run: `npx jest tests/sp1.5-helpers.test.js`

### T8/T9/T10/T11 (locked banner) — `tests/sp1.5-locked-banner.test.js`
- 4/4 jest passed (numeric score, float, zero, undefined)
- Caught critical bug: `escHtml(85)` throws TypeError (Number has no `.replace`); fixed with `Math.round(score || 0)`.
- Run: `npx jest tests/sp1.5-locked-banner.test.js`

### T14 C1 backfill validation — `tests/circles-database-analysis.test.js`
- Pre-backfill: 3/3 jest FAILED (100/100 questions missing analysis)
- Post-backfill: 3/3 jest PASSED (100/100 populated; JSON ⇄ JS sync verified)
- Run: `npx jest tests/circles-database-analysis.test.js`
- OpenAI cost: ~$1, ~5 min wall time

### T18 Q3 backend snapshot-guard — `tests/snapshot-guard.test.js`
- 2/2 jest passed (no prompt file does runtime DB lookup; routes pass question_json)

### T19 Q3 audit-stale-sessions ops sweep
- 506 sessions scanned; 8 stale identified
- Stale set includes the user-reported `b715b898-70ac-47e6-b0e5-38b9ad8af07e` Spotify Podcast vs Playlist drift
- Plan's two-table assumption fixed (single `circles_sessions` table with `guest_id` discriminator)

### T20-T23 — 4 SP1.5 Playwright specs × 8 viewports

Run command:
```
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test \
  --config=tests/playwright/playwright.config.js \
  tests/playwright/journeys/sp1.5-edge-alignment.spec.js \
  tests/playwright/journeys/sp1.5-locked-step.spec.js \
  tests/playwright/journeys/sp1.5-phase2-back.spec.js \
  tests/playwright/journeys/sp1.5-stale-session.spec.js \
  --project=Mobile-360 --project=iPhone-SE --project=iPhone-14 --project=iPhone-15-Pro \
  --project=iPad --project=Desktop-1280 --project=Desktop-1440 --project=Desktop-2560 \
  --reporter=list
```

Result: **136 passed (40.2s)** — all 17 tests × 8 viewports green.

Test breakdown:
- sp1.5-edge-alignment.spec.js: 5 tests (A1 round-icons, A2 navbar-edges, A2 #app zero padding, A2 no body h-scroll, A3 zero pinned-card)
- sp1.5-locked-step.spec.js: 4 tests (banner+score, textareas readonly+locked, submit-bar 回評分+下一步, phase 2 chat disabled)
- sp1.5-phase2-back.spec.js: 3 tests (上一步 visible, navigates to phase 1 + draft preserved, conversation preserved)
- sp1.5-stale-session.spec.js: 5 tests (banner, fields readonly, chat input not rendered when stale, snapshot product shown, 回首頁 only)

5 fixes applied during test bring-up:
1. Test bug: `navigate('circles')` resets state when `circlesSession` is null. Tests now seed `circlesSession = { id: 'mock-test-session-id' }` before navigate.
2. Implementation bug: `.locked` regex was too strict; rewrote as word-boundary class injection that handles multi-class textareas + skips re-injection.
3. Test expectation: stale session phase 2 has NO `#circles-msg-input` element (replaced by single 回首頁 button); test rewritten to assert count=0 + 回首頁 visible.

Screenshots produced under `test-results/` — verified test outcomes by exit code (0 = all green) plus per-viewport explicit project iteration in run output.

## Regression — full Playwright suite

Run command:
```
PMDRILL_BASE_URL=http://localhost:4001 npx playwright test --config=tests/playwright/playwright.config.js --reporter=list
```

Run started at ~08:00:00, ongoing at the time of this writing. To be appended to this log when complete.

## Regression — full jest suite

Result: **125 passed / 0 failed**

Breakdown vs baseline 109:
- +7 sp1.5-helpers
- +4 sp1.5-locked-banner
- +3 circles-database-analysis
- +2 snapshot-guard
- = 16 new tests, all green
- Plus: existing 109 still all green (no regression)

## Console errors during dev walkthrough

(To be added if dev-walkthrough manually performed by controller before merge.)

## File audit

- 30 commits on `feat/sp1.5-fix-track`
- Mockup files: `docs/superpowers/specs/mockups/2026-05-02-pm-drill-sp1.5/{A,B,C,D,A2}-*.html`
- Spec: `docs/superpowers/specs/2026-05-02-sp1.5-fix-track-design.md`
- Plan: `docs/superpowers/plans/2026-05-02-sp1.5-fix-track-plan.md`
