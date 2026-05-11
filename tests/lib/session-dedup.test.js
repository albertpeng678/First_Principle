'use strict';

const { dedupSessions } = require('../../lib/session-dedup');

describe('dedupSessions', () => {
  test('completed beats active for same question_id', () => {
    const rows = [
      { question_id: 'q1', status: 'active',    created_at: '2026-01-02T00:00:00Z' },
      { question_id: 'q1', status: 'completed', created_at: '2026-01-01T00:00:00Z' },
    ];
    const result = dedupSessions(rows);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
  });

  test('tie on status — most recent created_at wins', () => {
    const rows = [
      { question_id: 'q2', status: 'active', created_at: '2026-01-01T00:00:00Z' },
      { question_id: 'q2', status: 'active', created_at: '2026-01-03T00:00:00Z' },
      { question_id: 'q2', status: 'active', created_at: '2026-01-02T00:00:00Z' },
    ];
    const result = dedupSessions(rows);
    expect(result).toHaveLength(1);
    expect(result[0].created_at).toBe('2026-01-03T00:00:00Z');
  });

  test('multiple distinct question_ids are all preserved', () => {
    const rows = [
      { question_id: 'circles_001', status: 'completed', created_at: '2026-01-01T00:00:00Z' },
      { question_id: 'circles_002', status: 'active',    created_at: '2026-01-02T00:00:00Z' },
      { question_id: 'circles_003', status: 'active',    created_at: '2026-01-03T00:00:00Z' },
    ];
    const result = dedupSessions(rows);
    expect(result).toHaveLength(3);
    const ids = result.map(r => r.question_id).sort();
    expect(ids).toEqual(['circles_001', 'circles_002', 'circles_003']);
  });
});
