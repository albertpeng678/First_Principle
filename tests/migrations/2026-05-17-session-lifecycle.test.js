// tests/migrations/2026-05-17-session-lifecycle.test.js
// Verifies the lifecycle migration is well-formed and idempotent.
// Does NOT run psql — that's deploy-time. This guards the SQL text.

const fs = require('fs');
const path = require('path');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '2026-05-17-session-lifecycle.sql'),
  'utf8'
);

describe('migration 2026-05-17-session-lifecycle.sql', () => {
  test('adds lifecycle column to circles_sessions with correct shape', () => {
    expect(MIGRATION).toMatch(
      /ALTER TABLE\s+circles_sessions\s+ADD COLUMN IF NOT EXISTS\s+lifecycle\s+TEXT\s+NOT NULL\s+DEFAULT\s+'created'\s+CHECK\s*\(\s*lifecycle\s+IN\s*\(\s*'created'\s*,\s*'editing'\s*,\s*'gated'\s*,\s*'completed'\s*\)\s*\)/i
    );
  });

  test('adds lifecycle column to nsm_sessions with correct shape', () => {
    expect(MIGRATION).toMatch(
      /ALTER TABLE\s+nsm_sessions\s+ADD COLUMN IF NOT EXISTS\s+lifecycle\s+TEXT\s+NOT NULL\s+DEFAULT\s+'created'\s+CHECK\s*\(\s*lifecycle\s+IN\s*\(\s*'created'\s*,\s*'editing'\s*,\s*'gated'\s*,\s*'completed'\s*\)\s*\)/i
    );
  });

  test('creates user index on circles_sessions', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_circles_sessions_lifecycle_user\s+ON\s+circles_sessions\s*\(\s*user_id\s*,\s*lifecycle\s*,\s*updated_at\s+DESC\s*\)/i
    );
  });

  test('creates guest index on circles_sessions', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_circles_sessions_lifecycle_guest\s+ON\s+circles_sessions\s*\(\s*guest_id\s*,\s*lifecycle\s*,\s*updated_at\s+DESC\s*\)/i
    );
  });

  test('creates user index on nsm_sessions', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_nsm_sessions_lifecycle_user\s+ON\s+nsm_sessions\s*\(\s*user_id\s*,\s*lifecycle\s*,\s*updated_at\s+DESC\s*\)/i
    );
  });

  test('is fully idempotent — every DDL statement uses IF NOT EXISTS', () => {
    const ddl = MIGRATION.split(';').map((s) => s.trim()).filter((s) => /^(ALTER|CREATE)/i.test(s));
    expect(ddl.length).toBeGreaterThanOrEqual(5);
    for (const stmt of ddl) {
      expect(stmt).toMatch(/IF NOT EXISTS/i);
    }
  });
});
