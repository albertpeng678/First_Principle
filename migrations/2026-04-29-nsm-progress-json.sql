-- NSM session progress save (Fix-Backend follow-up)
-- Adds progress_json JSONB so Step 1/2/3 partial state can be persisted
-- via PATCH /api/(guest-)nsm-sessions/:id/progress (mirrors CIRCLES).
--
-- Idempotent.

ALTER TABLE nsm_sessions
  ADD COLUMN IF NOT EXISTS progress_json JSONB NOT NULL DEFAULT '{}'::jsonb;
