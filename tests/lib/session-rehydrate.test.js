const { rehydrateQuestionJson } = require('../../lib/session-rehydrate');

describe('session rehydrate', () => {
  test('CIRCLES: merges field_examples from bank when session lacks them', () => {
    const session = {
      id: 's1', question_id: 'circles_001',
      question_json: { id: 'circles_001', company: 'Spotify' },  // no field_examples
    };
    const out = rehydrateQuestionJson(session, 'circles');
    expect(out.question_json.field_examples).toBeTruthy();
  });

  test('does not overwrite existing field_examples', () => {
    const session = {
      id: 's2', question_id: 'circles_001',
      question_json: { id: 'circles_001', field_examples: { custom: true } },
    };
    const out = rehydrateQuestionJson(session, 'circles');
    expect(out.question_json.field_examples).toEqual({ custom: true });
  });

  // T6 dependency: nsm_database.json has no `context` yet (Task 6 backfill pending).
  // This test is skipped until T6 authors the NSM bank content.
  // Re-enable by changing test.skip to test after T6 commit.
  test.skip('NSM: merges context from bank (blocked on T6 nsm_database.json backfill)', () => {
    const session = {
      id: 's3', question_id: 'q17',
      question_json: { id: 'q17', company: 'Zoom' },  // no context
    };
    const out = rehydrateQuestionJson(session, 'nsm');
    // After T6 bank backfill, q17 will have context
    expect(out.question_json).toHaveProperty('context');
  });

  test('returns session unchanged when bank lookup fails', () => {
    const session = { id: 's4', question_id: 'unknown', question_json: { id: 'unknown' } };
    const out = rehydrateQuestionJson(session, 'circles');
    expect(out).toEqual(session);
  });
});
