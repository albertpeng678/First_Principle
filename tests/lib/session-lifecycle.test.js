// tests/lib/session-lifecycle.test.js
const {
  hasSubstantiveContent,
  computeLifecycle,
} = require('../../lib/session-lifecycle');

describe('hasSubstantiveContent (CIRCLES)', () => {
  test('empty patch → false', () => {
    expect(hasSubstantiveContent({}, 'circles', 'patch')).toBe(false);
  });

  test('whitespace-only string → false', () => {
    expect(
      hasSubstantiveContent({ frameworkDraft: { C1: { 問題範圍: '   ' } } }, 'circles', 'patch')
    ).toBe(false);
  });

  test('HTML-only string → false', () => {
    expect(
      hasSubstantiveContent({ frameworkDraft: { C1: { 問題範圍: '<p><br></p>' } } }, 'circles', 'patch')
    ).toBe(false);
  });

  test('polluted stub (matches scan-pollution.isPolluted) → false', () => {
    // Pattern from B7: "e2e-r1-1789..." style stubs
    expect(
      hasSubstantiveContent(
        { frameworkDraft: { C1: { 問題範圍: 'e2e-r1-17896543210' } } },
        'circles',
        'patch'
      )
    ).toBe(false);
  });

  test('real prose → true', () => {
    expect(
      hasSubstantiveContent(
        { frameworkDraft: { C1: { 問題範圍: '我們的目標是把週活躍提升到 30%' } } },
        'circles',
        'patch'
      )
    ).toBe(true);
  });

  test('legacy stepDrafts.framework shape → true', () => {
    expect(
      hasSubstantiveContent(
        { stepDrafts: { framework: { C1: { 問題範圍: '真實內容' } } } },
        'circles',
        'patch'
      )
    ).toBe(true);
  });

  test('phase2ConclusionDraft → true', () => {
    expect(
      hasSubstantiveContent({ phase2ConclusionDraft: '結論是...' }, 'circles', 'patch')
    ).toBe(true);
  });

  test('mixed real + polluted → true (real wins)', () => {
    expect(
      hasSubstantiveContent(
        {
          frameworkDraft: {
            C1: { 問題範圍: 'e2e-r1-17896543210' },
            I:  { 假設: '真實假設內容' },
          },
        },
        'circles',
        'patch'
      )
    ).toBe(true);
  });
});

describe('hasSubstantiveContent (NSM)', () => {
  test('empty patch → false', () => {
    expect(hasSubstantiveContent({}, 'nsm', 'patch')).toBe(false);
  });

  test('userNsm prose → true', () => {
    expect(hasSubstantiveContent({ userNsm: '週活躍會員數' }, 'nsm', 'patch')).toBe(true);
  });

  test('userNsm object shape with non-empty nsm → true', () => {
    expect(
      hasSubstantiveContent({ userNsm: { nsm: '週活躍', explanation: '', businessLink: '' } }, 'nsm', 'patch')
    ).toBe(true);
  });

  test('userBreakdown single dim → true', () => {
    expect(
      hasSubstantiveContent({ userBreakdown: { reach: '所有付費會員', depth: '', frequency: '', impact: '' } }, 'nsm', 'patch')
    ).toBe(true);
  });

  test('all 4 dim empty → false', () => {
    expect(
      hasSubstantiveContent({ userBreakdown: { reach: '', depth: '', frequency: '', impact: '' } }, 'nsm', 'patch')
    ).toBe(false);
  });

  test('polluted userExplanation → false', () => {
    expect(
      hasSubstantiveContent({ userExplanation: 'e2e-r1-17896543210' }, 'nsm', 'patch')
    ).toBe(false);
  });
});

describe('computeLifecycle (transitions)', () => {
  const cases = [
    // [priorLifecycle, patch, route, expected]
    ['created',   {}, 'patch', 'created'],
    ['created',   { frameworkDraft: { C1: { 問題範圍: '真實' } } }, 'patch', 'editing'],
    ['created',   {}, 'gate_ok',          'gated'],
    ['created',   {}, 'analysis_done',    'completed'],
    ['editing',   {}, 'patch',            'editing'],
    ['editing',   { frameworkDraft: { C1: { 問題範圍: '更新' } } }, 'patch', 'editing'],
    ['editing',   {}, 'gate_ok',          'gated'],
    ['editing',   {}, 'gate_fail',        'editing'], // failed gate does not promote
    ['editing',   {}, 'analysis_done',    'completed'],
    ['gated',     {}, 'patch',            'gated'],   // monotone, no demotion
    ['gated',     { frameworkDraft: { C1: { 問題範圍: '改' } } }, 'patch', 'gated'],
    ['gated',     {}, 'gate_ok',          'gated'],
    ['gated',     {}, 'analysis_done',    'completed'],
    ['completed', {}, 'patch',            'completed'], // terminal
    ['completed', {}, 'gate_ok',          'completed'],
    ['completed', {}, 'analysis_done',    'completed'],
  ];

  test.each(cases)(
    'prior=%s + route=%s → %s',
    (prior, patch, route, expected) => {
      expect(computeLifecycle({ lifecycle: prior }, patch, 'circles', route)).toBe(expected);
    }
  );

  test('FE-supplied lifecycle in body is ignored', () => {
    expect(
      computeLifecycle({ lifecycle: 'created' }, { lifecycle: 'completed' }, 'circles', 'patch')
    ).toBe('created');
  });

  test('null prior lifecycle defaults to "created"', () => {
    expect(computeLifecycle({}, {}, 'circles', 'patch')).toBe('created');
  });
});
