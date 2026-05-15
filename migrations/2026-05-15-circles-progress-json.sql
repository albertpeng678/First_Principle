-- CIRCLES session free-form UI state persistence (Bug 6b — Block 2)
-- Adds progress_json JSONB so phase2ConclusionDraft + future UI state can be
-- stored via PATCH /api/circles-sessions/:id/progress and restored on rehydrate.
--
-- Idempotent: uses IF NOT EXISTS so re-applying is a no-op.
-- ACTION REQUIRED: run in Supabase dashboard SQL editor before deploying.

ALTER TABLE circles_sessions
  ADD COLUMN IF NOT EXISTS progress_json JSONB NOT NULL DEFAULT '{}'::jsonb;
