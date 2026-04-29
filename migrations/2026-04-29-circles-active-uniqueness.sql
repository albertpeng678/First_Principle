-- B2 — Idempotency for CIRCLES draft autosave
-- Prevents parallel POST /api/(guest-)circles-sessions/draft from creating
-- duplicate active sessions for the same (owner, question, mode, drill_step).
--
-- We index the per-owner key separately because guest_id and user_id are
-- independent columns (a row has exactly one of them set).
-- COALESCE on drill_step so NULL collapses to a fixed sentinel for the
-- partial unique index (Postgres treats NULLs as distinct otherwise).
--
-- Idempotent: IF NOT EXISTS.
-- Apply via Supabase SQL editor or psql.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_user_circles
  ON circles_sessions (user_id, question_id, mode, COALESCE(drill_step, ''))
  WHERE status = 'active' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_guest_circles
  ON circles_sessions (guest_id, question_id, mode, COALESCE(drill_step, ''))
  WHERE status = 'active' AND guest_id IS NOT NULL;
