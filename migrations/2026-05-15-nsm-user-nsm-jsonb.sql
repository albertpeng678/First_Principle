-- Bug A fix (2026-05-15): ALTER user_nsm from TEXT to JSONB.
-- Background: Bug 6 FE implementer sends {nsm, explanation, businessLink} object
-- via PATCH /progress, but the column remained TEXT from the initial schema.
-- Supabase rejects the object → 400 DB error → updated_at never bumped →
-- tryResumeLatestSession sort breaks → session not resumed on re-login.
--
-- USING clause handles existing row values:
--   NULL / empty string → '{}'::jsonb
--   Already-JSON string (starts with { or [) → cast directly
--   Plain text (legacy NSM string) → wrapped as {nsm: '...', explanation: '', businessLink: ''}
--
-- Idempotent: If column is already JSONB this will fail with a harmless type-match
-- error. Safe to run multiple times by wrapping in a DO block below.

DO $$
BEGIN
  -- Only run if user_nsm is still TEXT (data_type = 'text')
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nsm_sessions'
      AND column_name = 'user_nsm'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE nsm_sessions
      ALTER COLUMN user_nsm DROP DEFAULT,
      ALTER COLUMN user_nsm SET DATA TYPE jsonb USING (
        CASE
          WHEN user_nsm IS NULL OR trim(user_nsm) = '' THEN '{}'::jsonb
          WHEN trim(user_nsm) ~ '^[{\[]' THEN user_nsm::jsonb
          ELSE jsonb_build_object('nsm', user_nsm, 'explanation', '', 'businessLink', '')
        END
      ),
      ALTER COLUMN user_nsm SET DEFAULT '{}'::jsonb;
  END IF;
END
$$;
