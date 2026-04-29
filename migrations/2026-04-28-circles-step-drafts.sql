-- Phase 2 Spec 2 — CIRCLES Progress Save
-- Ensures circles_sessions table has step_drafts + framework_draft JSONB columns
-- for the auto-save / lazy-create / resume-banner flows.
--
-- Idempotent: uses IF NOT EXISTS so re-applying is a no-op.
-- Run via Supabase SQL editor or: psql $DATABASE_URL -f this-file.sql
-- (no node scripts/migrate.js pattern exists in this repo)

ALTER TABLE circles_sessions
  ADD COLUMN IF NOT EXISTS step_drafts     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS framework_draft JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Helpful index for the resume-banner query: most-recent active session per user.
CREATE INDEX IF NOT EXISTS idx_circles_sessions_active_user
  ON circles_sessions (user_id, updated_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_circles_sessions_active_guest
  ON circles_sessions (guest_id, updated_at DESC)
  WHERE status = 'active';
