-- migrations/2026-05-17-session-lifecycle.sql
-- Adds the lifecycle state column + indexes to both session tables.
-- Idempotent: safe to re-run.
-- Default 'created' satisfies the NOT NULL constraint for existing rows
-- and is set by every eager-INSERT pre-flight without code change.
;

ALTER TABLE circles_sessions
  ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'created'
    CHECK (lifecycle IN ('created','editing','gated','completed'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_circles_sessions_lifecycle_user
  ON circles_sessions (user_id, lifecycle, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_circles_sessions_lifecycle_guest
  ON circles_sessions (guest_id, lifecycle, updated_at DESC);

ALTER TABLE nsm_sessions
  ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'created'
    CHECK (lifecycle IN ('created','editing','gated','completed'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nsm_sessions_lifecycle_user
  ON nsm_sessions (user_id, lifecycle, updated_at DESC);
-- no guest_id index: NSM sessions table has no guest path
