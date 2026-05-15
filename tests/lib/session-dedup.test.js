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

  test('tie on status — updated_at beats created_at for cross-device freshness', () => {
    // Row A: older created_at but newer updated_at (desktop wrote this last)
    // Row B: newer created_at but no updated_at (mobile snapshot)
    // Expected winner: Row A — because its updated_at is most recent
    const rowA = {
      question_id: 'q3',
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-05T12:00:00Z', // desktop wrote this last
    };
    const rowB = {
      question_id: 'q3',
      status: 'active',
      created_at: '2026-01-03T00:00:00Z', // newer created_at
      updated_at: null,                    // no updated_at (legacy mobile row)
    };
    const result = dedupSessions([rowB, rowA]); // rowB first to test insertion order independence
    expect(result).toHaveLength(1);
    expect(result[0].updated_at).toBe('2026-01-05T12:00:00Z');
  });

  test('tie on status — both have updated_at, most recent updated_at wins', () => {
    const rows = [
      { question_id: 'q4', status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
      { question_id: 'q4', status: 'active', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-08T00:00:00Z' },
    ];
    const result = dedupSessions(rows);
    expect(result).toHaveLength(1);
    expect(result[0].updated_at).toBe('2026-01-10T00:00:00Z');
  });

  test('status rank still wins over updated_at — completed beats active even if active is newer', () => {
    const rows = [
      { question_id: 'q5', status: 'completed', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { question_id: 'q5', status: 'active',    created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
    ];
    const result = dedupSessions(rows);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
  });
});
