// tests/scripts/backfill-lifecycle.test.js
const { classify } = require('../../scripts/backfill-lifecycle');

describe('backfill-lifecycle.classify (CIRCLES)', () => {
  test('status=completed → completed', () => {
    expect(classify({ status: 'completed' }, 'circles')).toBe('completed');
  });

  test('lifecycle already completed → completed (idempotent)', () => {
    expect(classify({ lifecycle: 'completed' }, 'circles')).toBe('completed');
  });

  test('gate_result.ok=true → gated', () => {
    expect(classify({ gate_result: { ok: true } }, 'circles')).toBe('gated');
  });

  test('gate_result.ok=false → falls through to content check', () => {
    expect(
      classify({ gate_result: { ok: false }, framework_draft: { C1: { 問題範圍: '真實' } } }, 'circles')
    ).toBe('editing');
  });

  test('framework_draft with real content → editing', () => {
    expect(
      classify({ framework_draft: { C1: { 問題範圍: '我們的目標是...' } } }, 'circles')
    ).toBe('editing');
  });

  test('framework_draft empty + no gate → created', () => {
    expect(classify({ framework_draft: {} }, 'circles')).toBe('created');
  });

  test('framework_draft polluted only → created', () => {
    expect(
      classify({ framework_draft: { C1: { 問題範圍: 'e2e-r1-17896543210' } } }, 'circles')
    ).toBe('created');
  });
});

describe('backfill-lifecycle.classify (NSM)', () => {
  test('status=completed → completed', () => {
    expect(classify({ status: 'completed' }, 'nsm')).toBe('completed');
  });

  test('scores_json present → completed', () => {
    expect(classify({ scores_json: { total: 80 } }, 'nsm')).toBe('completed');
  });

  test('progress_json.gateResult.ok=true → gated', () => {
    expect(classify({ progress_json: { gateResult: { ok: true } } }, 'nsm')).toBe('gated');
  });

  test('user_nsm prose → editing', () => {
    expect(classify({ user_nsm: '週活躍會員數' }, 'nsm')).toBe('editing');
  });

  test('user_breakdown single dim → editing', () => {
    expect(
      classify({ user_breakdown: { reach: '付費會員', depth: '', frequency: '', impact: '' } }, 'nsm')
    ).toBe('editing');
  });

  test('empty NSM row → created', () => {
    expect(classify({}, 'nsm')).toBe('created');
  });

  test('polluted user_explanation only → created', () => {
    expect(classify({ user_explanation: 'e2e-r1-17896543210' }, 'nsm')).toBe('created');
  });
});
