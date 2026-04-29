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

-- ──────────────────────────────────────────────────────────────────────
-- Step 1 — Dedupe pre-existing dup rows (else CREATE UNIQUE INDEX errors).
-- Strategy: per (owner, question, mode, drill_step), keep the row with the
-- MOST data (largest step_drafts payload) and the most recent updated_at;
-- mark older/lighter siblings as 'abandoned' so they fall out of the
-- partial unique index (WHERE status='active').
-- Safe to re-run: only touches rows that share a key with a winner.
-- ──────────────────────────────────────────────────────────────────────
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, question_id, mode, COALESCE(drill_step, '')
      ORDER BY length(COALESCE(step_drafts::text, '{}')) DESC, updated_at DESC, id DESC
    ) AS rn
  FROM circles_sessions
  WHERE status = 'active' AND user_id IS NOT NULL
)
UPDATE circles_sessions s
SET status = 'abandoned'
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY guest_id, question_id, mode, COALESCE(drill_step, '')
      ORDER BY length(COALESCE(step_drafts::text, '{}')) DESC, updated_at DESC, id DESC
    ) AS rn
  FROM circles_sessions
  WHERE status = 'active' AND guest_id IS NOT NULL
)
UPDATE circles_sessions s
SET status = 'abandoned'
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

-- ──────────────────────────────────────────────────────────────────────
-- Step 2 — Enforce uniqueness going forward.
-- ──────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_user_circles
  ON circles_sessions (user_id, question_id, mode, COALESCE(drill_step, ''))
  WHERE status = 'active' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_guest_circles
  ON circles_sessions (guest_id, question_id, mode, COALESCE(drill_step, ''))
  WHERE status = 'active' AND guest_id IS NOT NULL;
