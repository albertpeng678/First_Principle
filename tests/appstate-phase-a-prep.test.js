'use strict';

// Skills cited:
//   superpowers:test-driven-development — RED first (declare expectation before AppState patch lands)
//   playwright-skill/core/common-pitfalls.md Pitfall 18 — N/A (no DOM); pure source-text assertion
//   Karpathy §4.4 Goal-Driven — single verifiable outcome per key
//   RITUAL §3.18 — 5x consecutive runs required pre-commit
//   RITUAL §3.19 — skill citation header (this block)
//
// Phase A prep — atomic AppState key declaration spec.
// Verifies 4 new NSM-mirror keys exist in public/app.js AppState block with correct defaults,
// and confirms NONE of them are added to PERSISTED_KEYS (all 4 are in-memory only).
//
// Source plan: audit/phase-a-prep-appstate-atomic-commit-plan.md
// Unblocks: Wave 2 C-Drift-1/2/3/4 parallel commits.

const fs = require('fs');
const path = require('path');

const APP_PATH = path.join(__dirname, '..', 'public', 'app.js');

describe('Phase A prep — new AppState keys declared inert', () => {
  let src;

  beforeAll(() => {
    src = fs.readFileSync(APP_PATH, 'utf8');
  });

  test('declares nsmGateInflight with default false', () => {
    // matches:    nsmGateInflight: false,
    expect(src).toMatch(/\bnsmGateInflight\s*:\s*false\b/);
  });

  test('declares nsmSessionLoading with default false', () => {
    expect(src).toMatch(/\bnsmSessionLoading\s*:\s*false\b/);
  });

  test('declares nsmPhase2SaveState with default "idle"', () => {
    expect(src).toMatch(/\bnsmPhase2SaveState\s*:\s*['"]idle['"]/);
  });

  test('declares nsmRecentSessions with default null', () => {
    expect(src).toMatch(/\bnsmRecentSessions\s*:\s*null\b/);
  });

  test('none of the 4 new keys appear in PERSISTED_KEYS array', () => {
    // Extract the PERSISTED_KEYS array literal.
    const m = src.match(/const\s+PERSISTED_KEYS\s*=\s*\[([\s\S]*?)\]/);
    expect(m).not.toBeNull();
    const arr = m[1];
    expect(arr).not.toMatch(/['"]nsmGateInflight['"]/);
    expect(arr).not.toMatch(/['"]nsmSessionLoading['"]/);
    expect(arr).not.toMatch(/['"]nsmPhase2SaveState['"]/);
    expect(arr).not.toMatch(/['"]nsmRecentSessions['"]/);
  });
});
