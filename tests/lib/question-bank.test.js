const { circlesById, nsmById } = require('../../lib/question-bank');

describe('question-bank lookup', () => {
  test('circlesById returns row with field_examples for circles_001', () => {
    const q = circlesById('circles_001');
    expect(q).toBeTruthy();
    expect(q.id).toBe('circles_001');
    expect(q.field_examples).toBeTruthy();
  });

  test('nsmById returns row for q17', () => {
    const q = nsmById('q17');
    expect(q).toBeTruthy();
    expect(q.id).toBe('q17');
  });

  test('returns null for unknown id', () => {
    expect(circlesById('zzz')).toBeNull();
    expect(nsmById('zzz')).toBeNull();
  });
});
