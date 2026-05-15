-- NSM persistence fix (Bug 6) — 2026-05-15
-- Adds user_explanation + user_business_link as dedicated TEXT columns.
--
-- NOTE: The primary fix for Bug 6 stores explanation + businessLink inside the
-- existing user_nsm JSONB column as {nsm, explanation, businessLink}. These
-- columns are provided as an alternative denormalized path for direct SQL
-- querying / analytics; the application layer reads from user_nsm.
--
-- Idempotent (safe to run multiple times).

ALTER TABLE nsm_sessions
  ADD COLUMN IF NOT EXISTS user_explanation TEXT,
  ADD COLUMN IF NOT EXISTS user_business_link TEXT;
