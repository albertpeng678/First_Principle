# Quarantined Legacy Specs

**Why:** These 20 specs hardcode prod URL (`railway.app`) + real account email
(`albertpeng678@gmail.com`) and write stub strings (`e2e-r${N}-...`) into the
real prod DB. Each run pollutes user's real account.

**Triggered B7 incident:** 2026-05-16 Stage 1A T13 attempted to run full
`tests/visual/playwright.config.js` for cross-vp regression. Playwright's
default testMatch picked up THESE specs and ran them against prod → polluted
user account again (same pattern as original B7 incident).

**Moved here on:** 2026-05-16 (Stage 1A interrupt)

**Do NOT delete:** They contain valuable past investigation scripts. To
re-purpose for Stage 1B/1C, rewrite each to use `tests/helpers/env-guard.js` +
`tests/fixtures/auto-cleanup.fixture.js` (Stage 0 ship) + `e2e@first-principle.test`
account (Stage 0 ship) so they hit test env, not prod with real account.

**To re-enable a single spec:** Move it OUT of this dir + refactor per Stage 0
prevention infra. Add to `tests/e2e/playwright.config.js` testMatch.

**Visual config testMatch** now uses an EXPLICIT allowlist (no wildcard) so a
forgotten quarantine miss can't pollute again.
