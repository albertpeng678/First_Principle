'use strict';

// Manual extraction since public/app.js is a browser script. We extract
// the helpers using vm sandbox or duplicate them in a tiny shim. Simpler:
// import the helpers from a dedicated module if app.js is too large to load.
// For SP1.5, define helpers as pure functions exported via globalThis.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadHelpers() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const ctx = { window: {}, document: { addEventListener: () => {} }, console };
  // Extract just the two helper definitions for unit test
  const isStepLockedMatch = src.match(/function isStepLocked\([^)]*\)\s*\{[^}]+\}/);
  const computeStaleFlagMatch = src.match(/function computeStaleFlag\([^)]*\)\s*\{[\s\S]+?\n\}/);
  if (!isStepLockedMatch || !computeStaleFlagMatch) {
    throw new Error('Helpers not found in app.js');
  }
  vm.createContext(ctx);
  vm.runInContext(isStepLockedMatch[0] + '\n' + computeStaleFlagMatch[0] +
    '\nthis.isStepLocked = isStepLocked; this.computeStaleFlag = computeStaleFlag;', ctx);
  return ctx;
}

describe('isStepLocked', () => {
  test('returns false when no scores', () => {
    const { isStepLocked } = loadHelpers();
    expect(isStepLocked('C1', null)).toBe(false);
    expect(isStepLocked('C1', {})).toBe(false);
    expect(isStepLocked('C1', undefined)).toBe(false);
  });

  test('returns true when step has score', () => {
    const { isStepLocked } = loadHelpers();
    expect(isStepLocked('C1', { C1: { totalScore: 65 } })).toBe(true);
  });

  test('returns false when other step has score', () => {
    const { isStepLocked } = loadHelpers();
    expect(isStepLocked('I', { C1: { totalScore: 65 } })).toBe(false);
  });
});

describe('computeStaleFlag', () => {
  test('returns false when problem_statement matches', () => {
    const { computeStaleFlag } = loadHelpers();
    const snapshot = { problem_statement: 'Spotify Podcast 體驗' };
    const current = { problem_statement: 'Spotify Podcast 體驗' };
    expect(computeStaleFlag(snapshot, current)).toBe(false);
  });

  test('returns true when problem_statement diverges', () => {
    const { computeStaleFlag } = loadHelpers();
    const snapshot = { problem_statement: 'Spotify 播放列表推薦…如何幫助新用戶' };
    const current = { problem_statement: '設計新功能提升 Podcast 體驗' };
    expect(computeStaleFlag(snapshot, current)).toBe(true);
  });

  test('whitespace differences alone do NOT trigger stale', () => {
    const { computeStaleFlag } = loadHelpers();
    const snapshot = { problem_statement: 'Spotify  Podcast\n體驗' };
    const current = { problem_statement: 'Spotify Podcast 體驗' };
    expect(computeStaleFlag(snapshot, current)).toBe(false);
  });

  test('returns false when current is null/missing (treat as not stale)', () => {
    const { computeStaleFlag } = loadHelpers();
    expect(computeStaleFlag({ problem_statement: 'x' }, null)).toBe(false);
    expect(computeStaleFlag(null, { problem_statement: 'x' })).toBe(false);
  });
});
