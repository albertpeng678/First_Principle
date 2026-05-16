const { isPolluted, extractStrings } = require('./scan-pollution');

describe('isPolluted regex', () => {
  test.each([
    ['e2e-r2-B4-I-1778822383-f0', true],
    ['dual-uat-r2-nsm-1778822283008', true],
    ['dual-r-uat-test-x', true],
    ['test-stub-foo', true],
    ['smoke-bar', true],
    ['legitimate user answer with 完整中文 reasoning', false],
    ['北極星指標應該是每週活躍的付費用戶數', false],
    ['短答', false],
    ['', false],
    [null, false],
  ])('isPolluted(%j) === %s', (s, expected) => {
    expect(isPolluted(s)).toBe(expected);
  });
});

// Regression: 2026-05-16 prod scan missed `repro-bug1-r5-178NNNNN` (no `-fN`
// suffix, no `e2e-r` / `dual-uat-` prefix) — 4 NSM rows flagged on `reach` only
// because the inner `reach` value happened to match `*-178NNN-fN` while the
// other 3 dims + user_nsm slipped through. Generalize via the "lowercase
// ascii-token chain ending in a 13-digit unix-ms timestamp" shape, which Chinese
// content cannot accidentally match (Chinese chars fall outside [a-z0-9_-]).
describe('isPolluted — generalized timestamp-suffix predicate', () => {
  test.each([
    // The actual missed prod values (user_nsm of all 4 deleted NSM rows):
    ['repro-bug1-r5-1778906193039', true],
    ['repro-bug1-r5-1778904780067', true],
    ['repro-bug1-r5-1778903427510', true],
    ['repro-bug1-r5-1778901909039', true],
    // Director-hypothesized siblings (same shape, different abbreviated dim):
    ['e2e-r2-a6-depth-1778906193039', true],
    ['e2e-r2-a6-reach-1778906193039', true],
    ['e2e-r2-a6-impact-1778906193039', true],
    ['e2e-r2-a6-freq-1778906193039', true],
    // Any future test-stub shape with trailing 13-digit unix-ms:
    ['foo-bar-baz-1789999999999', true],
    ['stub_v2-1778822383000', true],
    // Negatives — must NOT false-positive on Chinese / real content:
    ['北極星指標是每週活躍付費用戶 1778906193039', false], // Chinese before ts
    ['公司年營收 1789000000000', false], // Chinese + number, not a stub shape
    ['1778906193039', false], // bare 13-digit number (could be legit ms reading)
    ['user mentioned 1778906193039 in passing', false], // English sentence
    ['version 1.2.3', false],
  ])('isPolluted(%j) === %s', (s, expected) => {
    expect(isPolluted(s)).toBe(expected);
  });
});

describe('extractStrings (jsonb traversal)', () => {
  test('extracts framework_draft jsonb leaves', () => {
    const session = {
      framework_draft: {
        C1: { problem_scope: 'e2e-r2-B4-C1-1778822383-f0', time_scope: '正常字串' },
        I:  { user_segment: 'dual-uat-test' },
      },
    };
    const out = extractStrings(session, 'circles');
    expect(out).toEqual(
      expect.arrayContaining([
        { path: 'framework_draft.C1.problem_scope', value: 'e2e-r2-B4-C1-1778822383-f0' },
        { path: 'framework_draft.C1.time_scope', value: '正常字串' },
        { path: 'framework_draft.I.user_segment', value: 'dual-uat-test' },
      ])
    );
  });

  test('extracts nsm user_breakdown 4 dims', () => {
    const session = {
      user_nsm: 'normal nsm answer',
      user_breakdown: { reach: 'e2e-r3-reach-test', depth: '正常', frequency: '', impact: 'smoke-x' },
      user_explanation: '',
      user_business_link: null,
    };
    const out = extractStrings(session, 'nsm');
    expect(out).toEqual(
      expect.arrayContaining([
        { path: 'user_nsm', value: 'normal nsm answer' },
        { path: 'user_breakdown.reach', value: 'e2e-r3-reach-test' },
        { path: 'user_breakdown.depth', value: '正常' },
        { path: 'user_breakdown.impact', value: 'smoke-x' },
      ])
    );
  });

  test('extracts circles phase2_chat_history array', () => {
    const session = {
      phase2_chat_history: [
        { role: 'user', text: '正常問題' },
        { role: 'coach', text: 'dual-uat-coach-reply' },
      ],
      phase2_conclusion_draft: 'e2e-r5-conclusion-x',
    };
    const out = extractStrings(session, 'circles');
    expect(out).toEqual(
      expect.arrayContaining([
        { path: 'phase2_chat_history[0].text', value: '正常問題' },
        { path: 'phase2_chat_history[1].text', value: 'dual-uat-coach-reply' },
        { path: 'phase2_conclusion_draft', value: 'e2e-r5-conclusion-x' },
      ])
    );
  });

  test('extracts circles step_drafts jsonb leaves', () => {
    const session = {
      step_drafts: {
        C1: { problem_scope: 'e2e-r9-stepdraft-test', time_scope: '正常 step draft' },
        I:  { user_segment: 'test-stub-segment' },
      },
    };
    const out = extractStrings(session, 'circles');
    expect(out).toEqual(
      expect.arrayContaining([
        { path: 'step_drafts.C1.problem_scope', value: 'e2e-r9-stepdraft-test' },
        { path: 'step_drafts.C1.time_scope', value: '正常 step draft' },
        { path: 'step_drafts.I.user_segment', value: 'test-stub-segment' },
      ])
    );
  });

  test('handles missing fields gracefully', () => {
    expect(extractStrings({}, 'nsm')).toEqual([]);
    expect(extractStrings(null, 'nsm')).toEqual([]);
  });
});

describe('module exports (smoke)', () => {
  test('exports fetchSessions + fetchSessionDetail', () => {
    const mod = require('./scan-pollution');
    expect(typeof mod.fetchSessions).toBe('function');
    expect(typeof mod.fetchSessionDetail).toBe('function');
  });
});
